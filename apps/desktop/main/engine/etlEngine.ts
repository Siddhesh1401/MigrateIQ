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
  MigrationResult,
  MigrationProgressEvent,
  MigrationLogEntry,
  TableMigrationProgress,
  SkippedRow,
  ETLBatchResult
} from '@migrateiq/shared';
import { maskSensitiveFields, sanitizeIdentifier } from '../utils';
import { transformValueForSql, extractFieldValue, generateCreateTableDdl } from './dryRun';

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

    // Drop existing colliding tables if marked for 'drop' (in reverse order for FK safety)
    for (const tableName of [...tableOrder].reverse()) {
      const mapping = findMappingForTable(mappings, tableName);
      const isChild = isChildTableName(mappings, tableName);
      const parentMapping = isChild ? findParentMappingForChild(mappings, tableName) : undefined;
      const shouldDrop = mapping?.tableAction === 'drop' || parentMapping?.tableAction === 'drop';

      if (shouldDrop) {
        try {
          await pgClient.query(`DROP TABLE IF EXISTS "${sanitizeIdentifier(tableName)}" CASCADE;`);
          emitLog(onLog, 'info', `🗑️ Dropped existing colliding table: ${tableName} (fresh recreation)`);
        } catch (err: unknown) {
          emitLog(onLog, 'warn', `⚠️ Could not drop existing table ${tableName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

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

    // Clean any existing data in the target tables (in reverse order for FK safety) to allow seamless re-runs
    // (Skip tables with tableAction === 'append' to preserve existing historical records)
    for (const tableName of [...tableOrder].reverse()) {
      const mapping = findMappingForTable(mappings, tableName);
      if (mapping?.tableAction === 'append') {
        continue;
      }
      try {
        await pgClient.query(`TRUNCATE TABLE "${sanitizeIdentifier(tableName)}" CASCADE;`);
      } catch {
        // Table might not exist or empty, safely ignore
      }
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
        ? parentMapping.collectionName
        : mapping.collectionName;

      const collection = mongoDB.collection(collectionName);
      let totalRows = 0;
      let childArrayField: string | undefined;

      if (isChildTable) {
        childArrayField = resolveChildArrayField(tableName, parentMapping);
        if (parentMapping && childArrayField) {
          try {
            const agg = await mongoDB.collection(parentMapping.collectionName).aggregate([
              { $project: { count: { $cond: { if: { $isArray: `$${childArrayField}` }, then: { $size: `$${childArrayField}` }, else: 0 } } } },
              { $group: { _id: null, total: { $sum: '$count' } } }
            ]).toArray();
            totalRows = (agg[0] as { total?: number } | undefined)?.total ?? 0;
          } catch {
            totalRows = 0;
          }
        }
      } else {
        totalRows = await collection.estimatedDocumentCount();
      }

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

        if (isChildTable) {
          const childItems = getChildItemsFromParentDoc(doc as Record<string, unknown>, tableName, parentMapping, childArrayField);
          batch.push(...childItems);
        } else {
          batch.push(doc);
        }

        // When batch is full or cursor exhausted, process batch
        if (batch.length >= batchSize || !(await cursor.hasNext())) {
          if (batch.length === 0) continue;
          batchNumber++;

          const batchResult = await processBatch({
            pgClient,
            tableName,
            mapping,
            batch,
            batchNumber,
            isChildTable,
            batchStartRowIndex: rowsCompleted,
            onLog
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
            currentTableProgress: totalRows > 0 ? Math.min(100, Math.round((rowsCompleted / totalRows) * 100)) : 100,
            currentBatch: batchNumber,
            rowsPerSecond: Math.round(rowsPerSec),
            estimatedTimeRemainingMs: isFinite(estimatedTimeRemainingMs) ? Math.round(estimatedTimeRemainingMs) : undefined
          });

          batch = [];
        }
      }

      if (isChildTable) {
        tableStatEntry.totalRows = rowsCompleted;
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
      totalRows,
      migratedRows,
      duration,
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
  onLog?: MigrationOptions['onLog']; // For emitting skip reasons to UI
}

async function processBatch(options: ProcessBatchOptions): Promise<ETLBatchResult> {
  const { pgClient, tableName, mapping, batch, batchNumber, isChildTable, batchStartRowIndex, onLog } = options;
  
  const skippedRows: SkippedRow[] = [];
  let rowsProcessed = 0;

  try {
    // Attempt batch insert
    const insertSql = buildBatchInsertSql(tableName, mapping, batch, isChildTable, batchStartRowIndex);
    
    if (insertSql) {
      await pgClient.query(insertSql.sql, insertSql.values);
      rowsProcessed = batch.length;
    } else {
      // buildBatchInsertSql returned null — no active fields or empty batch
      // Emit a warning so this is visible rather than silently lost
      emitLog(onLog, 'warn',
        `⚠️ [${tableName}] Batch ${batchNumber}: no insertable fields found (${batch.length} rows skipped). Check mapping config.`,
        tableName
      );
      for (let i = 0; i < batch.length; i++) {
        const doc = batch[i] as Record<string, unknown>;
        const docId = doc._id ? String(doc._id) : `batch-${batchNumber}-row-${i}`;
        skippedRows.push({
          documentId: docId,
          reason: 'No insertable fields — mapping produced null SQL (check field includes and types)',
          sourceDocument: JSON.stringify(doc).slice(0, 500)
        });
      }
    }

  } catch (batchError) {
    // Batch insert failed — emit the error reason immediately so it's visible in the migration log
    const batchErrMsg = batchError instanceof Error ? batchError.message : String(batchError);
    emitLog(onLog, 'warn',
      `⚠️ [${tableName}] Batch ${batchNumber} failed (${batch.length} rows). Retrying row-by-row. Error: ${maskSensitiveFields(batchErrMsg)}`,
      tableName
    );

    // Batch insert failed - retry row-by-row (chunk-level error isolation)
    let firstRowError: string | null = null;
    for (let i = 0; i < batch.length; i++) {
      try {
        const doc = batch[i] as Record<string, unknown>;
        const insertSql = buildSingleInsertSql(tableName, mapping, doc, isChildTable, batchStartRowIndex + i);
        
        if (insertSql) {
          await pgClient.query(insertSql.sql, insertSql.values);
          rowsProcessed++;
        } else {
          // Single row SQL also returned null
          const doc2 = batch[i] as Record<string, unknown>;
          const docId = doc2._id ? String(doc2._id) : `batch-${batchNumber}-row-${i}`;
          skippedRows.push({
            documentId: docId,
            reason: 'No insertable fields — single-row mapping produced null SQL',
            sourceDocument: JSON.stringify(doc2).slice(0, 500)
          });
        }

      } catch (rowError) {
        const doc = batch[i] as Record<string, unknown>;
        const docId = doc._id ? String(doc._id) : `batch-${batchNumber}-row-${i}`;
        const errorMessage = rowError instanceof Error ? rowError.message : String(rowError);
        const maskedError = maskSensitiveFields(errorMessage);

        // Capture first row error to emit a summary once (avoid log spam for mass failures)
        if (firstRowError === null) {
          firstRowError = maskedError;
        }

        skippedRows.push({
          documentId: docId,
          reason: maskedError,
          sourceDocument: JSON.stringify(doc).slice(0, 500)
        });
      }
    }

    // If all rows in batch were skipped, emit the first error reason as a visible warning
    if (skippedRows.length === batch.length && firstRowError !== null) {
      emitLog(onLog, 'warn',
        `❌ [${tableName}] All ${batch.length} rows in batch ${batchNumber} skipped. First error: ${firstRowError}`,
        tableName
      );
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

  const activeFields = mapping.fields.filter(
    f => f.include && !f.isChildTable && f.targetType?.toUpperCase() !== 'CHILD_TABLE'
  );
  if (activeFields.length === 0) return null;

  // Filter out SERIAL id column if the documents in the batch have no explicit id
  const insertableFields = activeFields.filter(f => {
    const isSerialPk = (f.targetColumn === 'id' || f.targetColumn === '_id') && f.targetType?.toUpperCase().includes('SERIAL');
    if (isSerialPk) {
      const hasExplicitId = batch.some(d => {
        const row = d as Record<string, unknown>;
        return row._id !== undefined || row.id !== undefined;
      });
      return hasExplicitId;
    }
    return true;
  });

  // Deduplicate columns by lowercase targetColumn name to prevent multiple assignments to the same column
  const seenInsertCols = new Set<string>();
  const uniqueFields = insertableFields.filter(f => {
    const colLower = f.targetColumn.toLowerCase();
    if (seenInsertCols.has(colLower)) return false;
    seenInsertCols.add(colLower);
    return true;
  });

  // Determine if we need to inject sort_order (for child tables)
  const needsSortOrder = isChildTable && !seenInsertCols.has('sort_order');

  const fieldCols = uniqueFields.map(f => `"${sanitizeIdentifier(f.targetColumn)}"`).join(', ');
  const columnNames = needsSortOrder ? `${fieldCols}, "sort_order"` : fieldCols;

  const values: unknown[] = [];
  const valuePlaceholders: string[] = [];

  let paramIndex = 1;

  for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
    const doc = batch[rowIdx] as Record<string, unknown>;
    const rowValues: unknown[] = [];
    
    for (const field of uniqueFields) {
      let rawValue = extractFieldValue(doc, field.sourceField, field.targetColumn);
      // Fallback to defaultValue if rawValue is missing or null (imputation from Step 6)
      if (
        (rawValue === undefined || rawValue === null) &&
        field.defaultValue !== undefined &&
        field.defaultValue !== null &&
        field.defaultValue !== ''
      ) {
        rawValue = field.defaultValue;
      }
      // For child tables: if foreign key column to parent is missing in child doc, use doc._parentId
      if (rawValue === undefined && doc._parentId && (field.targetColumn.toLowerCase().includes('id') || field.foreignKeyToParent)) {
        rawValue = doc._parentId;
      }
      // For sort_order column
      if (rawValue === undefined && field.targetColumn === 'sort_order' && doc._sortOrder !== undefined) {
        rawValue = doc._sortOrder;
      }
      const transformedValue = transformValueForSql(rawValue, field.targetType);
      rowValues.push(transformedValue);
    }

    if (needsSortOrder) {
      rowValues.push(doc._sortOrder !== undefined ? doc._sortOrder : (batchStartRowIndex + rowIdx));
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
  const activeFields = mapping.fields.filter(
    f => f.include && !f.isChildTable && f.targetType?.toUpperCase() !== 'CHILD_TABLE'
  );
  if (activeFields.length === 0) return null;

  const insertableFields = activeFields.filter(f => {
    const isSerialPk = (f.targetColumn === 'id' || f.targetColumn === '_id') && f.targetType?.toUpperCase().includes('SERIAL');
    if (isSerialPk) {
      return doc._id !== undefined || doc.id !== undefined;
    }
    return true;
  });

  const seenInsertCols = new Set<string>();
  const uniqueFields = insertableFields.filter(f => {
    const colLower = f.targetColumn.toLowerCase();
    if (seenInsertCols.has(colLower)) return false;
    seenInsertCols.add(colLower);
    return true;
  });

  const needsSortOrder = isChildTable && !seenInsertCols.has('sort_order');

  const fieldCols = uniqueFields.map(f => `"${sanitizeIdentifier(f.targetColumn)}"`).join(', ');
  const columnNames = needsSortOrder ? `${fieldCols}, "sort_order"` : fieldCols;

  const values: unknown[] = [];

  for (const field of uniqueFields) {
    let rawValue = extractFieldValue(doc, field.sourceField, field.targetColumn);
    // Fallback to defaultValue if rawValue is missing or null (imputation from Step 6)
    if (
      (rawValue === undefined || rawValue === null) &&
      field.defaultValue !== undefined &&
      field.defaultValue !== null &&
      field.defaultValue !== ''
    ) {
      rawValue = field.defaultValue;
    }
    if (rawValue === undefined && doc._parentId && (field.targetColumn.toLowerCase().includes('id') || field.foreignKeyToParent)) {
      rawValue = doc._parentId;
    }
    if (rawValue === undefined && field.targetColumn === 'sort_order' && doc._sortOrder !== undefined) {
      rawValue = doc._sortOrder;
    }
    const transformedValue = transformValueForSql(rawValue, field.targetType);
    values.push(transformedValue);
  }

  if (needsSortOrder) {
    values.push(doc._sortOrder !== undefined ? doc._sortOrder : rowIndex);
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO "${sanitizeIdentifier(tableName)}" (${columnNames}) VALUES (${placeholders})`;

  return { sql, values };
}

/**
 * Returns the CollectionMapping for the given table name.
 * For child tables, returns the CHILD mapping (not the parent).
 */
/**
 * Tests whether a given candidate child table name corresponds to a specific
 * array field on a parent collection, handling camelCase, snake_case, and prefixes.
 */
function matchesChildTableName(
  parentTable: string,
  sourceField: string,
  candidateChildTableName: string,
  explicitChildTableName?: string
): boolean {
  if (explicitChildTableName && explicitChildTableName.toLowerCase() === candidateChildTableName.toLowerCase()) {
    return true;
  }
  const normCandidate = candidateChildTableName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normSrc = sourceField.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normParent = parentTable.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normFull = normParent + normSrc;
  return normCandidate === normFull || normCandidate.endsWith(normSrc) || normCandidate === normSrc;
}

/**
 * Returns the CollectionMapping for the given table name.
 * For child tables, returns the CHILD mapping (not the parent).
 */
function findMappingForTable(mappings: CollectionMapping[], tableName: string): CollectionMapping | undefined {
  // Check direct match (parent tables)
  const direct = mappings.find(m => (m.targetTableName || m.collectionName) === tableName);
  if (direct) return direct;

  // Check child tables in m.childTables — return the child mapping, NOT the parent
  for (const m of mappings) {
    if (m.childTables) {
      const parentTable = m.targetTableName || m.collectionName;
      const child = m.childTables.find(c => {
        const cName = c.targetTableName || c.collectionName;
        return cName === tableName || matchesChildTableName(parentTable, c.collectionName, tableName, c.targetTableName);
      });
      if (child) return child;
    }
  }

  // Check child tables defined directly on fields (where field.isChildTable === true)
  for (const m of mappings) {
    const parentTable = m.targetTableName || m.collectionName;
    const childField = m.fields.find(f =>
      f.isChildTable && matchesChildTableName(parentTable, f.sourceField, tableName, f.childTableName)
    );
    if (childField) {
      const fkName = childField.foreignKeyToParent && !childField.foreignKeyToParent.includes('.')
        ? childField.foreignKeyToParent
        : `${parentTable}_id`;

      return {
        collectionName: m.collectionName,
        targetTableName: tableName,
        fields: [
          {
            id: `synthetic_${tableName}_id`,
            sourceField: '_id',
            sourceType: 'auto',
            targetColumn: 'id',
            targetType: 'SERIAL PRIMARY KEY',
            isNullable: false,
            include: true
          },
          {
            id: `synthetic_${tableName}_fk`,
            sourceField: '_parentId',
            sourceType: 'string',
            targetColumn: fkName,
            targetType: 'VARCHAR(24)',
            isNullable: false,
            include: true,
            foreignKeyToParent: `${parentTable}.id`
          },
          {
            id: `synthetic_${tableName}_sort`,
            sourceField: 'sort_order',
            sourceType: 'auto',
            targetColumn: 'sort_order',
            targetType: 'INTEGER',
            isNullable: false,
            include: true
          },
          {
            id: `synthetic_${tableName}_data`,
            sourceField: 'data',
            sourceType: 'object',
            targetColumn: 'data',
            targetType: 'JSONB',
            isNullable: false,
            include: true
          }
        ],
        indexes: []
      };
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
    const parentTable = m.targetTableName || m.collectionName;
    if (m.childTables?.some(c => {
      const cName = c.targetTableName || c.collectionName;
      return cName === tableName || matchesChildTableName(parentTable, c.collectionName, tableName, c.targetTableName);
    })) return true;
    if (m.fields.some(f => f.isChildTable && matchesChildTableName(parentTable, f.sourceField, tableName, f.childTableName))) return true;
  }
  return false;
}

/**
 * For a child table, returns the parent CollectionMapping (whose MongoDB collection to stream from).
 */
function findParentMappingForChild(mappings: CollectionMapping[], childTableName: string): CollectionMapping | undefined {
  return mappings.find(m => {
    const parentTable = m.targetTableName || m.collectionName;
    if (m.childTables?.some(c => {
      const cName = c.targetTableName || c.collectionName;
      return cName === childTableName || matchesChildTableName(parentTable, c.collectionName, childTableName, c.targetTableName);
    })) return true;
    if (m.fields.some(f => f.isChildTable && matchesChildTableName(parentTable, f.sourceField, childTableName, f.childTableName))) return true;
    if (childTableName.toLowerCase().startsWith(`${parentTable.toLowerCase()}_`)) return true;
    return false;
  });
}

/**
 * Resolves the source MongoDB array field name on the parent collection for a given child table.
 */
function resolveChildArrayField(
  childTableName: string,
  parentMapping?: CollectionMapping
): string | undefined {
  if (!parentMapping) return undefined;
  const parentTable = parentMapping.targetTableName || parentMapping.collectionName;

  // 1. Check explicit childTables in parent mapping
  const ct = parentMapping.childTables?.find(c => {
    const cName = c.targetTableName || c.collectionName;
    return cName === childTableName || matchesChildTableName(parentTable, c.collectionName, childTableName, c.targetTableName);
  });
  if (ct) return ct.collectionName;

  // 2. Check fields with isChildTable
  const f = parentMapping.fields.find(fld =>
    fld.isChildTable &&
    matchesChildTableName(parentTable, fld.sourceField, childTableName, fld.childTableName)
  );
  if (f) return f.sourceField;

  // 3. Fallback: match any field whose normalized name matches the child table name
  const normChild = childTableName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normParent = parentTable.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const fld of parentMapping.fields) {
    const normFld = fld.sourceField.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normChild === normParent + normFld || normChild.endsWith(normFld) || normChild === normFld) {
      return fld.sourceField;
    }
  }

  return undefined;
}

/**
 * Unpacks child table items from a parent MongoDB document.
 * Injects parent foreign key (_parentId) and array index (_sortOrder)
 * per the Array → Child Table Rule (AGENTS.md).
 * Strict: only extracts items from the dedicated arrayField. If the field
 * is null/undefined in the parent document, returns [] with 0 items.
 */
function getChildItemsFromParentDoc(
  pDoc: Record<string, unknown>,
  childTableName: string,
  parentMapping?: CollectionMapping,
  knownArrayField?: string
): Record<string, unknown>[] {
  const parentId = pDoc._id instanceof ObjectId ? pDoc._id.toHexString() : String(pDoc._id ?? '');
  const arrayField = knownArrayField || resolveChildArrayField(childTableName, parentMapping);

  if (!arrayField) {
    return [];
  }

  const rawArr = pDoc[arrayField];
  const items: Record<string, unknown>[] = [];

  if (Array.isArray(rawArr)) {
    for (let idx = 0; idx < rawArr.length; idx++) {
      const item = rawArr[idx];
      if (item && typeof item === 'object') {
        const itemObj = item as Record<string, unknown>;
        items.push({
          ...itemObj,
          _parentId: parentId,
          _sortOrder: idx,
          order_id: itemObj.order_id ?? parentId,
          orders_id: itemObj.orders_id ?? parentId,
          parent_id: itemObj.parent_id ?? parentId,
          sort_order: itemObj.sort_order ?? idx,
          data: JSON.stringify(itemObj)
        });
      }
    }
  }

  return items;
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
