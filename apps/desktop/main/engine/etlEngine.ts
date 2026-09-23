/**
 * MigrateIQ - ETL Engine (Phase 9)
 * 
 * The core live migration engine that streams data from MongoDB to PostgreSQL.
 * Implements batch processing, row-level error isolation, progress tracking,
 * and crash recovery with rollback script generation.
 * 
 * Key Features:
 * - Streaming cursor (no memory overload on 20,000+ documents)
 * - Batch insert with row-by-row retry fallback
 * - Real-time ETA calculation
 * - Chunk-level error isolation (1 bad row doesn't abort 20,000 good ones)
 * - Circular FK handling via deferred constraints
 * - Password masking in all logs
 * 
 * Referenced Specs:
 * - phase_plan-v2.md Lines 472-605 (Phase 9 Technical Spec)
 * - product_blueprint-v7.md Step 7 (Migration Progress UI)
 * - AGENTS.md: Array→Child Table Rule, parameterized SQL, password masking
 */

import { MongoClient, ObjectId } from 'mongodb';
import { Client as PgClient } from 'pg';
import type {
  ConnectionConfig,
  CollectionMapping,
  FieldMapping,
  MigrationResult,
  MigrationProgressEvent,
  MigrationLogEntry,
  TableMigrationProgress,
  SkippedRow,
  ETLBatchResult
} from '@migrateiq/shared';
import { maskSensitiveFields, sanitizeIdentifier } from '../utils';

export interface MigrationOptions {
  sourceConfig: ConnectionConfig;
  targetConfig: ConnectionConfig;
  mappings: CollectionMapping[];
  tableOrder: string[]; // From topological sort
  deferredConstraintSqls?: string[]; // SQL stmts for deferred FK constraints
  batchSize?: number;
  onProgress?: (progress: MigrationProgressEvent) => void;
  onLog?: (log: MigrationLogEntry) => void;
  checkCancellation?: () => boolean;
  onRollbackScriptReady?: (script: string) => Promise<void>; // Called before first INSERT
}

interface TableStats {
  tableName: string;
  totalRows: number;
  rowsCompleted: number;
  startTime: string;
  endTime?: string;
  skippedRows: SkippedRow[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  error?: string;
}

/**
 * Executes the live migration from MongoDB to PostgreSQL
 */
export async function executeMigration(options: MigrationOptions): Promise<MigrationResult> {
  const {
    sourceConfig,
    targetConfig,
    mappings,
    tableOrder,
    batchSize = 500,
    onProgress,
    onLog,
    checkCancellation,
    onRollbackScriptReady
  } = options;

  let mongoClient: MongoClient | null = null;
  let pgClient: PgClient | null = null;

  const startTime = new Date().toISOString();
  const tableStats: TableStats[] = [];

  try {
    // ── Step 1: Connect to MongoDB ───────────────────────────────────────
    emitLog(onLog, 'info', `🔌 Connecting to MongoDB...`);
    mongoClient = new MongoClient(
      sourceConfig.connectionString || buildMongoConnectionString(sourceConfig),
      { serverSelectionTimeoutMS: 10000 }
    );
    await mongoClient.connect();
    const mongoDB = sourceConfig.database
      ? mongoClient.db(sourceConfig.database)
      : mongoClient.db();
    emitLog(onLog, 'info', `✅ Connected to MongoDB database: ${mongoDB.databaseName}`);

    // ── Step 2: Connect to PostgreSQL ────────────────────────────────────
    emitLog(onLog, 'info', `🔌 Connecting to PostgreSQL...`);
    pgClient = new PgClient({
      connectionString: targetConfig.connectionString,
      host: targetConfig.host,
      port: targetConfig.port,
      user: targetConfig.user,
      password: targetConfig.password,
      database: targetConfig.database,
      ssl: targetConfig.ssl ? { rejectUnauthorized: false } : false
    });
    await pgClient.connect();
    const targetSchema = sanitizeIdentifier(targetConfig.schema || 'public');
    await pgClient.query(`SET search_path TO "${targetSchema}"`);
    emitLog(onLog, 'info', `✅ Connected to PostgreSQL schema: ${targetSchema}`);

    // ── Step 3: Pre-generate DROP TABLE rollback script BEFORE any data changes ──
    // CRITICAL: Must be on disk before first CREATE TABLE so crash recovery works.
    const rollbackScript = generateRollbackScript(tableOrder, startTime);
    if (onRollbackScriptReady) {
      await onRollbackScriptReady(rollbackScript);
      emitLog(onLog, 'info', `💾 Rollback script saved to disk (crash recovery ready)`);
    }

    // ── Step 4: Create tables in dependency order ─────────────────────────
    emitLog(onLog, 'info', `📐 Creating tables in safe order...`);
    for (const tableName of tableOrder) {
      const mapping = findMappingForTable(mappings, tableName);
      if (!mapping) continue;

      const isChildTable = isChildTableName(mappings, tableName);
      const { sql } = generateCreateTableDdl(
        tableName,
        mapping.fields,
        isChildTable
      );

      await pgClient.query(sql);
      emitLog(onLog, 'info', `✅ Created table: ${tableName}`);
    }

    // ── Step 5: Migrate data table-by-table ───────────────────────────────
    emitLog(onLog, 'info', `📦 Starting data migration...`);
    emitProgress(onProgress, {
      type: 'start',
      totalTables: tableOrder.length,
      completedTables: 0,
      startTime
    });

    for (let i = 0; i < tableOrder.length; i++) {
      // Check cancellation
      if (checkCancellation && checkCancellation()) {
        emitLog(onLog, 'warn', `⚠️ Migration cancelled by user`);
        break;
      }

      const tableName = tableOrder[i];
      const mapping = findMappingForTable(mappings, tableName);
      if (!mapping) {
        emitLog(onLog, 'warn', `⚠️ No mapping found for table: ${tableName}. Skipping.`);
        continue;
      }

      const isChildTable = isChildTableName(mappings, tableName);
      // For child tables, query the parent collection (child data is embedded in parent docs)
      const parentMapping = findParentMappingForChild(mappings, tableName);
      const collectionName = isChildTable && parentMapping
        ? (parentMapping.targetTableName || parentMapping.collectionName)
        : (mapping.targetTableName || mapping.collectionName);

      const collection = mongoDB.collection(collectionName);
      // Use estimatedDocumentCount (O(1)) for progress display; avoids full collection scan
      const totalRows = await collection.estimatedDocumentCount();

      const tableStatEntry: TableStats = {
        tableName,
        totalRows,
        rowsCompleted: 0,
        startTime: new Date().toISOString(),
        skippedRows: [],
        status: 'running'
      };
      tableStats.push(tableStatEntry);

      emitLog(onLog, 'info', `📊 Migrating table: ${tableName} (${totalRows} rows)`, tableName);
      emitProgress(onProgress, {
        type: 'table_start',
        totalTables: tableOrder.length,
        completedTables: i,
        currentTable: tableName,
        currentTableRows: totalRows,
        currentTableRowsCompleted: 0,
        currentTableProgress: 0
      });

      // Stream documents in batches with noCursorTimeout to prevent timeout on large collections
      const cursor = collection.find({}).batchSize(batchSize).addCursorFlag('noCursorTimeout', true);
      let batch: unknown[] = [];
      let rowsCompleted = 0;
      let batchNumber = 0;
      const perfStart = Date.now();

      while (await cursor.hasNext()) {
        // Check cancellation between batches
        if (checkCancellation && checkCancellation()) {
          emitLog(onLog, 'warn', `⚠️ Migration cancelled during table: ${tableName}`);
          tableStatEntry.status = 'skipped';
          break;
        }

        const doc = await cursor.next();
        if (!doc) continue;

        batch.push(doc);

        // When batch is full or cursor exhausted, process batch
        if (batch.length >= batchSize || !(await cursor.hasNext())) {
          batchNumber++;

          const batchResult = await processBatch({
            pgClient,
            tableName,
            mapping,
            batch,
            batchNumber,
            isChildTable,
            batchStartRowIndex: rowsCompleted
          });

          rowsCompleted += batchResult.rowsProcessed;
          tableStatEntry.rowsCompleted = rowsCompleted;
          tableStatEntry.skippedRows.push(...batchResult.skippedRows);

          // Calculate ETA
          const elapsedMs = Date.now() - perfStart;
          const rowsPerSec = rowsCompleted / (elapsedMs / 1000);
          const rowsRemaining = totalRows - rowsCompleted;
          const estimatedTimeRemainingMs = rowsRemaining / rowsPerSec * 1000;

          emitProgress(onProgress, {
            type: 'table_progress',
            totalTables: tableOrder.length,
            completedTables: i,
            currentTable: tableName,
            currentTableRows: totalRows,
            currentTableRowsCompleted: rowsCompleted,
            currentTableProgress: Math.round((rowsCompleted / totalRows) * 100),
            currentBatch: batchNumber,
            rowsPerSecond: Math.round(rowsPerSec),
            estimatedTimeRemainingMs: isFinite(estimatedTimeRemainingMs) ? Math.round(estimatedTimeRemainingMs) : undefined
          });

          batch = [];
        }
      }

      tableStatEntry.endTime = new Date().toISOString();
      tableStatEntry.status = 'completed';

      emitLog(
        onLog,
        'info',
        `✅ Completed table: ${tableName} (${rowsCompleted}/${totalRows} rows, ${tableStatEntry.skippedRows.length} skipped)`,
        tableName
      );

      emitProgress(onProgress, {
        type: 'table_complete',
        totalTables: tableOrder.length,
        completedTables: i + 1,
        currentTable: tableName,
        currentTableRows: totalRows,
        currentTableRowsCompleted: rowsCompleted,
        currentTableProgress: 100
      });

      // (Rollback script was already generated as DROP TABLE before data load)
    }

    // ── Step 6: Apply deferred FK constraints (for circular FK deps) ─────
    if (options.deferredConstraintSqls && options.deferredConstraintSqls.length > 0) {
      emitLog(onLog, 'info', `🔗 Applying ${options.deferredConstraintSqls.length} deferred FK constraint(s)...`);
      for (const constraintSql of options.deferredConstraintSqls) {
        try {
          await pgClient.query(constraintSql);
        } catch (fkErr) {
          const fkMsg = fkErr instanceof Error ? fkErr.message : String(fkErr);
          emitLog(onLog, 'warn', `⚠️ Deferred FK constraint failed (non-blocking): ${fkMsg}`);
        }
      }
      emitLog(onLog, 'info', `✅ FK constraints applied`);
    }

    // ── Step 7: Build final result ────────────────────────────────────────
    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    const completedTables = tableStats.filter(t => t.status === 'completed').length;
    const failedTables = tableStats.filter(t => t.status === 'failed').length;
    const totalRows = tableStats.reduce((sum, t) => sum + t.totalRows, 0);
    const migratedRows = tableStats.reduce((sum, t) => sum + t.rowsCompleted, 0);
    const skippedRows = tableStats.reduce((sum, t) => sum + t.skippedRows.length, 0);

    emitLog(onLog, 'info', `✅ Migration completed: ${migratedRows}/${totalRows} rows migrated, ${skippedRows} skipped`);
    emitProgress(onProgress, {
      type: 'complete',
      totalTables: tableOrder.length,
      completedTables,
      startTime,
      endTime
    });

    return {
      success: true,
      totalTables: tableOrder.length,
      completedTables,
      failedTables,
      totalRows,
      migratedRows,
      skippedRows,
      duration,
      startTime,
      endTime,
      tableResults: tableStats.map(toTableMigrationProgress),
      rollbackScript // Already generated and saved; return it for UI display too
    };

  } catch (error) {
    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    const errorMessage = error instanceof Error ? error.message : String(error);

    emitLog(onLog, 'error', `❌ Migration failed: ${maskSensitiveFields(errorMessage)}`);
    emitProgress(onProgress, {
      type: 'error',
      error: maskSensitiveFields(errorMessage),
      startTime,
      endTime
    });

    return {
      success: false,
      totalTables: tableOrder.length,
      completedTables: tableStats.filter(t => t.status === 'completed').length,
      failedTables: tableStats.filter(t => t.status === 'failed').length + 1,
      totalRows: tableStats.reduce((sum, t) => sum + t.totalRows, 0),
      migratedRows: tableStats.reduce((sum, t) => sum + t.rowsCompleted, 0),
      skippedRows: tableStats.reduce((sum, t) => sum + t.skippedRows.length, 0),
      duration,
      startTime,
      endTime,
      error: maskSensitiveFields(errorMessage),
      tableResults: tableStats.map(toTableMigrationProgress)
    };

  } finally {
    if (mongoClient) await mongoClient.close().catch(() => {});
    if (pgClient) await pgClient.end().catch(() => {});
  }
}

// ============================================
// Batch Processing Logic
// ============================================

interface ProcessBatchOptions {
  pgClient: PgClient;
  tableName: string;
  mapping: CollectionMapping;
  batch: unknown[];
  batchNumber: number;
  isChildTable: boolean;
  batchStartRowIndex: number; // Used to compute sort_order for child table rows
}

async function processBatch(options: ProcessBatchOptions): Promise<ETLBatchResult> {
  const { pgClient, tableName, mapping, batch, batchNumber, isChildTable, batchStartRowIndex } = options;
  
  const skippedRows: SkippedRow[] = [];
  let rowsProcessed = 0;

  try {
    // Attempt batch insert
    const insertSql = buildBatchInsertSql(tableName, mapping, batch, isChildTable, batchStartRowIndex);
    
    if (insertSql) {
      await pgClient.query(insertSql.sql, insertSql.values);
      rowsProcessed = batch.length;
    }

  } catch (batchError) {
    // Batch insert failed - retry row-by-row (chunk-level error isolation)
    for (let i = 0; i < batch.length; i++) {
      try {
        const doc = batch[i] as Record<string, unknown>;
        const insertSql = buildSingleInsertSql(tableName, mapping, doc, isChildTable, batchStartRowIndex + i);
        
        if (insertSql) {
          await pgClient.query(insertSql.sql, insertSql.values);
          rowsProcessed++;
        }

      } catch (rowError) {
        const doc = batch[i] as Record<string, unknown>;
        const docId = doc._id ? String(doc._id) : `batch-${batchNumber}-row-${i}`;
        const errorMessage = rowError instanceof Error ? rowError.message : String(rowError);

        skippedRows.push({
          documentId: docId,
          reason: maskSensitiveFields(errorMessage),
          sourceDocument: JSON.stringify(doc).slice(0, 500)
        });
      }
    }
  }

  return {
    success: skippedRows.length === 0,
    rowsProcessed,
    rowsSkipped: skippedRows.length,
    skippedRows
  };
}

// ============================================
// SQL Generation
// ============================================

function buildBatchInsertSql(
  tableName: string,
  mapping: CollectionMapping,
  batch: unknown[],
  isChildTable: boolean,
  batchStartRowIndex: number
): { sql: string; values: unknown[] } | null {
  if (batch.length === 0) return null;

  const activeFields = mapping.fields.filter(f => f.include);
  if (activeFields.length === 0) return null;

  // Determine if we need to inject sort_order (for child tables)
  const needsSortOrder = isChildTable && !activeFields.some(f => f.targetColumn === 'sort_order');

  const fieldCols = activeFields.map(f => `"${sanitizeIdentifier(f.targetColumn)}"`).join(', ');
  const columnNames = needsSortOrder ? `${fieldCols}, "sort_order"` : fieldCols;

  const values: unknown[] = [];
  const valuePlaceholders: string[] = [];

  let paramIndex = 1;

  for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
    const doc = batch[rowIdx] as Record<string, unknown>;
    const rowValues: unknown[] = [];
    
    for (const field of activeFields) {
      const rawValue = extractFieldValue(doc, field.sourceField);
      const transformedValue = transformValueForSql(rawValue, field.targetType);
      rowValues.push(transformedValue);
    }

    if (needsSortOrder) {
      rowValues.push(batchStartRowIndex + rowIdx);
    }

    const placeholders = rowValues.map(() => `$${paramIndex++}`).join(', ');
    valuePlaceholders.push(`(${placeholders})`);
    values.push(...rowValues);
  }

  const sql = `INSERT INTO "${sanitizeIdentifier(tableName)}" (${columnNames}) VALUES ${valuePlaceholders.join(', ')}`;

  return { sql, values };
}

function buildSingleInsertSql(
  tableName: string,
  mapping: CollectionMapping,
  doc: Record<string, unknown>,
  isChildTable: boolean,
  rowIndex: number
): { sql: string; values: unknown[] } | null {
  const activeFields = mapping.fields.filter(f => f.include);
  if (activeFields.length === 0) return null;

  const needsSortOrder = isChildTable && !activeFields.some(f => f.targetColumn === 'sort_order');

  const fieldCols = activeFields.map(f => `"${sanitizeIdentifier(f.targetColumn)}"`).join(', ');
  const columnNames = needsSortOrder ? `${fieldCols}, "sort_order"` : fieldCols;

  const values: unknown[] = [];

  for (const field of activeFields) {
    const rawValue = extractFieldValue(doc, field.sourceField);
    const transformedValue = transformValueForSql(rawValue, field.targetType);
    values.push(transformedValue);
  }

  if (needsSortOrder) {
    values.push(rowIndex);
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO "${sanitizeIdentifier(tableName)}" (${columnNames}) VALUES (${placeholders})`;

  return { sql, values };
}

function generateCreateTableDdl(
  tableName: string,
  fields: FieldMapping[],
  isChildTable: boolean
): { sql: string } {
  const safeTableName = sanitizeIdentifier(tableName);
  const activeFields = fields.filter(f => f.include);

  const columnDefs: string[] = [];
  let hasPk = false;

  for (const field of activeFields) {
    const colName = sanitizeIdentifier(field.targetColumn);
    const colType = (field.targetType || 'TEXT').toUpperCase().replace(/[^A-Z0-9_(),\s\[\]]/g, '').trim() || 'TEXT';
    const isNullable = field.isNullable ? '' : ' NOT NULL';
    const isPk = (colName === 'id' || colName === '_id') && !hasPk;

    if (isPk) {
      hasPk = true;
      columnDefs.push(`  "${colName}" ${colType} PRIMARY KEY`);
    } else {
      columnDefs.push(`  "${colName}" ${colType}${isNullable}`);
    }
  }

  // Array→Child Table Rule (AGENTS.md): auto-add sort_order for child tables,
  // value is the 0-based array element index — populated during INSERT.
  if (isChildTable && !activeFields.some(f => f.targetColumn === 'sort_order')) {
    columnDefs.push(`  "sort_order" INTEGER NOT NULL DEFAULT 0`);
  }

  const sql = `CREATE TABLE IF NOT EXISTS "${safeTableName}" (\n${columnDefs.join(',\n')}\n);`;
  return { sql };
}

// ============================================
// Utility Functions (Reused from dryRun.ts)
// ============================================

function extractFieldValue(
  doc: Record<string, unknown>,
  sourceField: string
): unknown {
  if (!doc || typeof doc !== 'object') return undefined;

  // Direct match
  if (sourceField in doc && doc[sourceField] !== undefined) {
    return doc[sourceField];
  }

  // Dot-notation navigation (e.g. "address.city")
  if (sourceField.includes('.')) {
    const parts = sourceField.split('.');
    let current: unknown = doc;
    for (const p of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[p];
    }
    if (current !== undefined) return current;
  }

  // Normalized case-insensitive match (handles minor name variations)
  const normalizedSource = sourceField.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, val] of Object.entries(doc)) {
    if (val === undefined) continue;
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKey === normalizedSource) {
      return val;
    }
  }

  return undefined;
}

function transformValueForSql(value: unknown, targetType: string): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle BSON types
  if (value && typeof value === 'object') {
    const bson = value as Record<string, unknown>;
    if (bson._bsontype === 'ObjectId' || value instanceof ObjectId) {
      return (value as ObjectId).toHexString();
    }
    if (bson._bsontype === 'Decimal128' || bson._bsontype === 'Long') {
      return bson.toString();
    }
  }

  const upperType = targetType.toUpperCase();

  // Date/Timestamp
  if (upperType.includes('TIMESTAMP') || upperType.includes('DATE')) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'number') {
      const ms = Math.abs(value) < 10000000000 ? value * 1000 : value;
      return new Date(ms).toISOString();
    }
  }

  // UUID
  if (upperType === 'UUID') {
    if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return value.toLowerCase();
    }
  }

  // Integer
  if (upperType.includes('INT') || upperType === 'BIGINT' || upperType === 'SMALLINT') {
    if (typeof value === 'number') {
      return Math.floor(value);
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
  }

  // Boolean
  if (upperType.includes('BOOL')) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const s = value.trim().toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
    }
  }

  // JSON/JSONB
  if (upperType.includes('JSON')) {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
  }

  // Default: string
  return String(value);
}

/**
 * Returns the CollectionMapping for the given table name.
 * For child tables, returns the CHILD mapping (not the parent).
 */
function findMappingForTable(mappings: CollectionMapping[], tableName: string): CollectionMapping | undefined {
  // Check direct match (parent tables)
  const direct = mappings.find(m => (m.targetTableName || m.collectionName) === tableName);
  if (direct) return direct;

  // Check child tables — return the child mapping, NOT the parent
  for (const m of mappings) {
    if (m.childTables) {
      const child = m.childTables.find(c => (c.targetTableName || c.collectionName) === tableName);
      if (child) return child;
    }
  }

  return undefined;
}

/**
 * Returns true if the given table name refers to a child table.
 */
function isChildTableName(mappings: CollectionMapping[], tableName: string): boolean {
  for (const m of mappings) {
    if ((m.targetTableName || m.collectionName) === tableName) return false;
    if (m.childTables?.some(c => (c.targetTableName || c.collectionName) === tableName)) return true;
  }
  return false;
}

/**
 * For a child table, returns the parent CollectionMapping (whose MongoDB collection to stream from).
 */
function findParentMappingForChild(mappings: CollectionMapping[], childTableName: string): CollectionMapping | undefined {
  return mappings.find(m =>
    m.childTables?.some(c => (c.targetTableName || c.collectionName) === childTableName)
  );
}

function toTableMigrationProgress(stats: TableStats): TableMigrationProgress {
  return {
    tableName: stats.tableName,
    status: stats.status,
    totalRows: stats.totalRows,
    rowsCompleted: stats.rowsCompleted,
    percentComplete: stats.totalRows > 0 ? Math.round((stats.rowsCompleted / stats.totalRows) * 100) : 0,
    startTime: stats.startTime,
    endTime: stats.endTime,
    error: stats.error,
    skippedRows: stats.skippedRows
  };
}

/**
 * Generates a DROP TABLE rollback script.
 * Uses CASCADE to handle FK dependencies.
 * Generated BEFORE any data is inserted so crash recovery always has a valid script.
 */
function generateRollbackScript(
  tableOrder: string[],
  timestamp: string
): string {
  // Drop in REVERSE order (child tables first, then parents)
  const reversedTables = [...tableOrder].reverse();
  const dropStatements = reversedTables.map(
    t => `DROP TABLE IF EXISTS "${sanitizeIdentifier(t)}" CASCADE;`
  );

  return [
    `-- MigrateIQ Rollback Script (DROP TABLE strategy)`,
    `-- METADATA:TABLES:${tableOrder.join(',')}`,
    `-- METADATA:ROW_COUNT:0`,
    `-- METADATA:CREATED_AT:${timestamp}`,
    ``,
    `BEGIN;`,
    ``,
    ...dropStatements,
    ``,
    `COMMIT;`
  ].join('\n');
}

function buildMongoConnectionString(config: ConnectionConfig): string {
  const auth = config.user ? `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password || '')}@` : '';
  const host = config.host || 'localhost';
  const port = config.port || 27017;
  return `mongodb://${auth}${host}:${port}`;
}

function emitProgress(
  callback: ((progress: MigrationProgressEvent) => void) | undefined,
  progress: MigrationProgressEvent
): void {
  if (callback) {
    try {
      callback(progress);
    } catch {
      // Ignore callback errors
    }
  }
}

function emitLog(
  callback: ((log: MigrationLogEntry) => void) | undefined,
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  table?: string
): void {
  if (callback) {
    try {
      callback({
        timestamp: new Date().toISOString(),
        level,
        message: maskSensitiveFields(message),
        table
      });
    } catch {
      // Ignore callback errors
    }
  }
}
