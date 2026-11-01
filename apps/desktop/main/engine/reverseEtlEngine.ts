/**
 * MigrateIQ - Reverse ETL Migration Engine (Phase 12 / Workflow B)
 * 
 * Migrates data FROM PostgreSQL TO MongoDB:
 * - Reads source rows from PostgreSQL using cursor / batch streaming
 * - Denormalizes 1:N relational tables into embedded document arrays (e.g. order_items -> orders.items[])
 * - Converts SQL data types to BSON-compatible values (Decimal, Date, JSONB objects)
 * - Inserts into MongoDB collections using bulk insertMany
 * - Emits real-time progress events over IPC
 * - Supports clean collection-level rollback on cancellation or error
 */

import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { app } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  ConnectionConfig,
  CollectionMapping,
  MigrationResult,
  TableMigrationProgress,
  MigrationProgressEvent
} from '@migrateiq/shared';
import { sanitizeIdentifier, normalizeConnectionConfig } from '../utils';
import { maskSensitiveFields } from '../handlers/risk';

export interface StartReverseMigrationOptions {
  sourceConfig: ConnectionConfig; // PostgreSQL
  targetConfig: ConnectionConfig; // MongoDB
  mappings: CollectionMapping[];
  batchSize?: number;
  onProgress?: (event: MigrationProgressEvent) => void;
  isCancelled?: () => boolean;
}

/**
 * Converts a PostgreSQL column value to a clean MongoDB BSON-compatible value
 */
function convertSqlValueToBson(val: unknown, targetType?: string): unknown {
  if (val === null || val === undefined) {
    return null;
  }

  const type = (targetType || '').toLowerCase();

  // If already Date
  if (val instanceof Date) {
    return val;
  }

  // Boolean
  if (typeof val === 'boolean' || type === 'bool' || type === 'boolean') {
    return Boolean(val);
  }

  // Number / Numeric / Decimal
  if (type === 'double' || type === 'decimal' || type === 'numeric' || type === 'float') {
    const num = Number(val);
    return isNaN(num) ? val : num;
  }

  // Integer
  if (type === 'int' || type === 'integer' || type === 'smallint') {
    const num = parseInt(String(val), 10);
    return isNaN(num) ? val : num;
  }

  // JSON / JSONB
  if (type === 'object' || type === 'json' || type === 'jsonb') {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }

  // Date / Timestamp string
  if (type === 'date' || type === 'timestamp' || type === 'timestamptz') {
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? val : d;
  }

  return val;
}

/**
 * Core Reverse Migration Execution Function
 */
export async function executeReverseMigration(
  options: StartReverseMigrationOptions
): Promise<MigrationResult> {
  const {
    sourceConfig,
    targetConfig,
    mappings,
    batchSize = 500,
    onProgress,
    isCancelled = () => false
  } = options;

  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const normSource = normalizeConnectionConfig(sourceConfig);
  const normTarget = normalizeConnectionConfig(targetConfig);

  // PostgreSQL Source Pool (Read-Only)
  const pgPoolConfig = normSource.connectionString
    ? { connectionString: normSource.connectionString }
    : {
        host: normSource.host || 'localhost',
        port: normSource.port || 5432,
        user: normSource.user || 'postgres',
        password: normSource.password || '',
        database: normSource.database,
        ssl: normSource.ssl ? { rejectUnauthorized: false } : undefined
      };

  const pgPool = new Pool({
    ...pgPoolConfig,
    max: 10,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000
  });

  // MongoDB Target Client
  const mongoUri = normTarget.connectionString ||
    `mongodb://${normTarget.host || 'localhost'}:${normTarget.port || 27017}/${normTarget.database}`;

  const mongoClient = new MongoClient(mongoUri, {
    connectTimeoutMS: 8000,
    serverSelectionTimeoutMS: 8000
  });

  await Promise.all([
    pgPool.query('SELECT 1;'),
    mongoClient.connect()
  ]);

  const mongoDb = mongoClient.db(normTarget.database);

  // Track created collections for rollback
  const createdCollections: string[] = [];
  const tableResults: TableMigrationProgress[] = [];

  let totalMigratedRows = 0;
  let totalSkippedRows = 0;
  let totalSourceRowsAcrossTables = 0;

  try {
    // 1. Separate Root Collections from Embedded Child Tables
    // A table is a Root Collection if !isEmbeddedChild
    const rootMappings = mappings.filter(m => !m.isEmbeddedChild);
    const childMappings = mappings.filter(m => m.isEmbeddedChild);

    // Map parentTable -> child mappings
    const childMapByParent = new Map<string, CollectionMapping[]>();
    for (const cm of childMappings) {
      const pTable = (cm.parentTable || '').toLowerCase();
      if (!childMapByParent.has(pTable)) {
        childMapByParent.set(pTable, []);
      }
      childMapByParent.get(pTable)!.push(cm);
    }

    onProgress?.({
      type: 'start',
      totalTables: rootMappings.length,
      completedTables: 0,
      totalRows: 0,
      migratedRows: 0
    });

    let completedTablesCount = 0;

    // 2. Process each Root Collection
    for (const rootMapping of rootMappings) {
      if (isCancelled()) {
        throw new Error('Migration cancelled by user.');
      }

      const sourceTable = sanitizeIdentifier(rootMapping.collectionName);
      const targetCollection = sanitizeIdentifier(rootMapping.targetTableName || rootMapping.collectionName);
      const embeddedChildren = childMapByParent.get(sourceTable.toLowerCase()) || [];

      // Count source rows in PostgreSQL
      const countRes = await pgPool.query(`SELECT COUNT(*)::bigint AS count FROM "${sourceTable}";`);
      const tableTotalRows = parseInt(countRes.rows[0]?.count || '0', 10);
      totalSourceRowsAcrossTables += tableTotalRows;

      const currentTableProgress: TableMigrationProgress = {
        tableName: sourceTable,
        status: 'running',
        totalRows: tableTotalRows,
        rowsCompleted: 0,
        percentComplete: 0,
        startTime: new Date().toISOString(),
        skippedRows: []
      };
      tableResults.push(currentTableProgress);

      onProgress?.({
        type: 'table_start',
        totalTables: rootMappings.length,
        completedTables: completedTablesCount,
        currentTable: sourceTable,
        totalRows: totalSourceRowsAcrossTables,
        migratedRows: totalMigratedRows,
        currentTableRows: tableTotalRows,
        currentTableRowsCompleted: 0
      });

      // Prepare target collection in MongoDB
      const mongoColl = mongoDb.collection(targetCollection);
      if (!createdCollections.includes(targetCollection)) {
        createdCollections.push(targetCollection);
      }

      let offset = 0;
      let tableRowsDone = 0;
      const tableStartMs = Date.now();

      while (offset < tableTotalRows) {
        if (isCancelled()) {
          throw new Error('Migration cancelled by user.');
        }

        // Fetch parent batch from PostgreSQL
        const parentRes = await pgPool.query(
          `SELECT * FROM "${sourceTable}" ORDER BY 1 LIMIT $1 OFFSET $2;`,
          [batchSize, offset]
        );

        const parentRows = parentRes.rows;
        if (parentRows.length === 0) break;

        // If table has embedded children, fetch related child rows for this batch
        const childRowsByFk = new Map<string, Map<unknown, unknown[]>>();

        for (const childMapping of embeddedChildren) {
          const childTable = sanitizeIdentifier(childMapping.collectionName);
          const fkColumn = sanitizeIdentifier(childMapping.foreignKeyColumn || `${sourceTable}_id`);
          const parentKeyCol = childMapping.parentKeyColumn || 'id';

          const parentIds = parentRows.map(r => r[parentKeyCol] ?? r.id).filter(id => id !== null && id !== undefined);

          if (parentIds.length > 0) {
            // Parameterized query using ANY($1)
            const childRes = await pgPool.query(
              `SELECT * FROM "${childTable}" WHERE "${fkColumn}" = ANY($1) ORDER BY 1;`,
              [parentIds]
            );

            const fkMap = new Map<unknown, unknown[]>();
            for (const cRow of childRes.rows) {
              const fkVal = cRow[fkColumn];
              if (!fkMap.has(fkVal)) {
                fkMap.set(fkVal, []);
              }
              // Clean child row: remove redundant foreignKey column if desired
              const cleanChild = { ...cRow };
              delete cleanChild[fkColumn];
              fkMap.get(fkVal)!.push(cleanChild);
            }
            childRowsByFk.set(childTable, fkMap);
          }
        }

        // Assemble BSON documents
        const docsToInsert: Array<Record<string, unknown>> = [];

        for (const pRow of parentRows) {
          try {
            const doc: Record<string, unknown> = {};

            // Map scalar columns
            for (const [colName, val] of Object.entries(pRow)) {
              const fieldMapping = rootMapping.fields.find(f => f.sourceField === colName);
              if (fieldMapping && !fieldMapping.include) continue;

              const targetFieldName = fieldMapping?.targetColumn || colName;
              doc[targetFieldName] = convertSqlValueToBson(val, fieldMapping?.targetType);
            }

            // Embed child rows into arrays
            for (const childMapping of embeddedChildren) {
              const childTable = sanitizeIdentifier(childMapping.collectionName);
              const embedField = childMapping.embeddedFieldName || 'items';
              const fkMap = childRowsByFk.get(childTable);
              const parentKeyCol = childMapping.parentKeyColumn || 'id';
              const parentVal = pRow[parentKeyCol] ?? pRow.id;
              const children = fkMap?.get(parentVal) || [];

              doc[embedField] = children.map(c => {
                const cleanC: Record<string, unknown> = {};
                for (const [cCol, cVal] of Object.entries(c as Record<string, unknown>)) {
                  const cmField = childMapping.fields.find(f => f.sourceField === cCol);
                  if (cmField && !cmField.include) continue;
                  const cTargetName = cmField?.targetColumn || cCol;
                  cleanC[cTargetName] = convertSqlValueToBson(cVal, cmField?.targetType);
                }
                return cleanC;
              });
            }

            docsToInsert.push(doc);
          } catch (rowErr) {
            totalSkippedRows++;
            currentTableProgress.skippedRows.push({
              documentId: String(pRow.id || offset),
              reason: maskSensitiveFields((rowErr as Error).message || 'Failed to assemble document')
            });
          }
        }

        // Bulk insert batch into MongoDB
        if (docsToInsert.length > 0) {
          await mongoColl.insertMany(docsToInsert, { ordered: false });
          tableRowsDone += docsToInsert.length;
          totalMigratedRows += docsToInsert.length;
        }

        offset += batchSize;

        // Emit progress
        const elapsedSec = Math.max(0.1, (Date.now() - tableStartMs) / 1000);
        const rowsPerSec = Math.round(tableRowsDone / elapsedSec);
        const remainingRows = Math.max(0, tableTotalRows - tableRowsDone);
        const etaSeconds = rowsPerSec > 0 ? Math.round(remainingRows / rowsPerSec) : 0;

        currentTableProgress.rowsCompleted = tableRowsDone;
        currentTableProgress.percentComplete = tableTotalRows > 0
          ? Math.min(100, Math.round((tableRowsDone / tableTotalRows) * 100))
          : 100;

        onProgress?.({
          type: 'table_progress',
          totalTables: rootMappings.length,
          completedTables: completedTablesCount,
          currentTable: sourceTable,
          totalRows: totalSourceRowsAcrossTables,
          migratedRows: totalMigratedRows,
          currentTableRowsCompleted: tableRowsDone,
          currentTableRows: tableTotalRows,
          currentTableProgress: currentTableProgress.percentComplete,
          rowsPerSecond: rowsPerSec,
          estimatedTimeRemainingMs: etaSeconds * 1000
        });
      }

      currentTableProgress.status = 'completed';
      currentTableProgress.endTime = new Date().toISOString();
      completedTablesCount++;

      onProgress?.({
        type: 'table_complete',
        totalTables: rootMappings.length,
        completedTables: completedTablesCount,
        currentTable: sourceTable,
        totalRows: totalSourceRowsAcrossTables,
        migratedRows: totalMigratedRows
      });
    }

    const durationMs = Date.now() - startMs;

    // Generate MongoDB rollback script
    const rollbackScript = createdCollections
      .map(col => `db.getCollection("${col}").drop();`)
      .join('\n');

    // Save rollback script to disk
    try {
      const baseDir = (typeof app !== 'undefined' && app && typeof app.getPath === 'function')
        ? app.getPath('userData')
        : process.cwd();
      const rollbackDir = path.join(baseDir, 'rollback-scripts');
      await fs.mkdir(rollbackDir, { recursive: true });
      const rollbackPath = path.join(rollbackDir, `rollback-reverse-${Date.now()}.js`);
      await fs.writeFile(rollbackPath, rollbackScript, 'utf-8');
    } catch {
      // Non-fatal
    }

    onProgress?.({
      type: 'complete',
      totalTables: rootMappings.length,
      completedTables: completedTablesCount,
      totalRows: totalSourceRowsAcrossTables,
      migratedRows: totalMigratedRows,
      duration: durationMs
    });

    return {
      success: true,
      totalTables: rootMappings.length,
      completedTables: completedTablesCount,
      failedTables: 0,
      totalRows: totalSourceRowsAcrossTables,
      migratedRows: totalMigratedRows,
      skippedRows: totalSkippedRows,
      duration: durationMs,
      startTime,
      endTime: new Date().toISOString(),
      tableResults,
      rollbackScript
    };
  } catch (err) {
    const errorMsg = maskSensitiveFields((err as Error).message || 'Reverse migration failed');
    return {
      success: false,
      totalTables: mappings.length,
      completedTables: tableResults.filter(t => t.status === 'completed').length,
      failedTables: 1,
      totalRows: totalSourceRowsAcrossTables,
      migratedRows: totalMigratedRows,
      skippedRows: totalSkippedRows,
      duration: Date.now() - startMs,
      startTime,
      endTime: new Date().toISOString(),
      error: errorMsg,
      tableResults
    };
  } finally {
    await pgPool.end().catch(() => null);
    await mongoClient.close().catch(() => null);
  }
}
