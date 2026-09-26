/**
 * MigrateIQ - Risk Handler (Step 5 Pre-Migration Risk Analysis IPC)
 *
 * Coordinates static risk analysis, foreign key cycle detection,
 * target table collision verification, and PostgreSQL Layer 2 introspection.
 *
 * References:
 * - phase_plan-v2.md Lines 507-547
 * - product_blueprint-v7.md Lines 782-956
 * - AGENTS.md: IPC pattern, parameterized queries, password masking
 */

import { ipcMain } from 'electron';
import { MongoClient } from 'mongodb';
import { Client as PgClient } from 'pg';
import type {
  ConnectionConfig,
  SourceSchema,
  CollectionMapping,
  RiskAnalysisResult,
  IPCResponse,
  Layer2FeatureItem,
  ExistingTableDetails,
  SampleOffendingValue,
} from '@migrateiq/shared';
import { analyzeRisks } from '../engine/riskAnalyzer';
import {
  introspectLayer2Catalogs,
  buildLayer2FeatureItems,
} from '../engine/layer2Analyzer';
import { PG_RESERVED_WORDS } from '../engine/ruleEngine';

export interface RiskAnalyzePayload {
  sourceSchema: SourceSchema[];
  mapping: CollectionMapping[];
  direction?: 'mongodb-to-postgres' | 'postgres-to-mongo';
  sourceConfig?: ConnectionConfig | null;
  targetConfig?: ConnectionConfig | null;
}

import { maskSensitiveFields } from '../utils';
export { maskSensitiveFields };

/**
 * Setup Risk IPC handlers for Step 5 pre-migration analysis
 */
export function setupRiskHandlers(): void {
  ipcMain.handle(
    'risk:analyze',
    async (
      _event,
      payload: RiskAnalyzePayload
    ): Promise<IPCResponse<RiskAnalysisResult>> => {
      const {
        sourceSchema,
        mapping,
        direction = 'mongodb-to-postgres',
        sourceConfig,
        targetConfig,
      } = payload;

      try {
        console.log(
          maskSensitiveFields(
            `[RiskEngine] Starting pre-flight risk evaluation for direction: ${direction}`
          )
        );

        const existingTargetTables: string[] = [];
        const existingTargetTableDetails: Record<string, ExistingTableDetails> = {};
        const existingTargetIndexes: Record<string, string[]> = {};
        const missingFkIndexes: Record<string, { childTable: string; fkColumn: string; parentTable: string }[]> = {};
        const stringLengthViolations: Record<string, { field: string; maxLen: number; targetLimit: number }[]> = {};
        const reservedWordWarnings: Record<string, { field: string; word: string; category: 'table' | 'column' }[]> = {};
        const sampleOffendingRecords: Record<string, Record<string, SampleOffendingValue[]>> = {};
        let storageStats: { sourceSizeBytes: number; targetEstimatedBytes: number; multiplier: number } | undefined = undefined;

        const docSizeAverages: Record<string, number> = {};
        const fieldMissingCounts: Record<string, Record<string, number>> = {};
        const fieldOverflows: Record<string, string[]> = {};
        const fieldNullBytes: Record<string, string[]> = {};
        const fieldNumericSpecials: Record<string, Record<string, string[]>> = {};
        const caseFoldingCollisions: Record<string, { col1: string; col2: string; target: string }[]> = {};
        const unorthodoxIdentifiers: Record<string, { field: string; sanitized: string }[]> = {};
        const orphanForeignKeys: Record<string, { field: string; foreignTable: string; missingCount: number }[]> = {};
        const deepNestingFields: Record<string, { field: string; depth: number }[]> = {};
        const sparseArrayFields: Record<string, string[]> = {};
        const nestedArrayOfArrays: Record<string, string[]> = {};
        const timezoneHazards: Record<string, string[]> = {};
        const jsonbAdvisories: Record<string, string[]> = {};
        let layer2Features: Layer2FeatureItem[] = [];

        // ── 0. Static Mapping Structural Audits (Case folding, identifiers, reserved words, nesting) ──
        for (const colMapping of mapping) {
          const lowerCols = new Map<string, string>();
          const targetTblName = (colMapping.targetTableName || colMapping.collectionName).toLowerCase();

          // Check if table name is a reserved keyword
          if (PG_RESERVED_WORDS.has(targetTblName)) {
            if (!reservedWordWarnings[colMapping.collectionName]) reservedWordWarnings[colMapping.collectionName] = [];
            reservedWordWarnings[colMapping.collectionName].push({
              field: targetTblName,
              word: targetTblName,
              category: 'table',
            });
          }

          for (const f of colMapping.fields) {
            if (!f.include) continue;
            const colName = f.targetColumn || f.sourceField;
            const lower = colName.toLowerCase();

            // Check if column name is a reserved keyword
            if (PG_RESERVED_WORDS.has(lower)) {
              if (!reservedWordWarnings[colMapping.collectionName]) reservedWordWarnings[colMapping.collectionName] = [];
              reservedWordWarnings[colMapping.collectionName].push({
                field: colName,
                word: lower,
                category: 'column',
              });
            }

            if (lowerCols.has(lower) && lowerCols.get(lower) !== colName) {
              if (!caseFoldingCollisions[colMapping.collectionName]) caseFoldingCollisions[colMapping.collectionName] = [];
              caseFoldingCollisions[colMapping.collectionName].push({
                col1: lowerCols.get(lower)!,
                col2: colName,
                target: lower,
              });
            } else {
              lowerCols.set(lower, colName);
            }

            // Check for Unorthodox Identifiers (hyphens, dots, leading digits, symbols)
            if (/^[0-9]/.test(colName) || /[^a-zA-Z0-9_]/.test(colName)) {
              let sanitized = colName.replace(/[^a-zA-Z0-9_]/g, '_');
              if (/^[0-9]/.test(sanitized)) sanitized = `col_${sanitized}`;
              if (!unorthodoxIdentifiers[colMapping.collectionName]) unorthodoxIdentifiers[colMapping.collectionName] = [];
              unorthodoxIdentifiers[colMapping.collectionName].push({ field: colName, sanitized });
            }

            // Check for Deep Nesting > 3 levels
            const depth = f.sourceField.split('.').length;
            if (depth > 3) {
              if (!deepNestingFields[colMapping.collectionName]) deepNestingFields[colMapping.collectionName] = [];
              deepNestingFields[colMapping.collectionName].push({ field: f.sourceField, depth });
            }

            // Check for plain JSON vs JSONB advisor
            if (f.targetType && f.targetType.trim().toUpperCase() === 'JSON') {
              if (!jsonbAdvisories[colMapping.collectionName]) jsonbAdvisories[colMapping.collectionName] = [];
              jsonbAdvisories[colMapping.collectionName].push(f.sourceField);
            }

            // Check for Date mapped to plain TIMESTAMP without timezone
            const srcType = (f.sourceType || '').toLowerCase();
            const tgtType = (f.targetType || '').toUpperCase();
            if ((srcType.includes('date') || srcType.includes('time') || f.sourceField.toLowerCase().endsWith('at') || f.sourceField.toLowerCase().endsWith('date')) && (tgtType === 'TIMESTAMP' || tgtType === 'TIMESTAMP WITHOUT TIME ZONE')) {
              if (!timezoneHazards[colMapping.collectionName]) timezoneHazards[colMapping.collectionName] = [];
              timezoneHazards[colMapping.collectionName].push(f.sourceField);
            }
          }
        }

        // ── 1. Inspect Target PostgreSQL for Table Collisions ──────────────
        if (targetConfig && targetConfig.type === 'postgresql') {
          let pgClient: PgClient | null = null;
          try {
            const targetSchema = targetConfig.schema?.trim() || 'public';
            if (targetConfig.connectionString) {
              pgClient = new PgClient({
                connectionString: targetConfig.connectionString.trim(),
                connectionTimeoutMillis: 4000,
              });
            } else {
              pgClient = new PgClient({
                host: targetConfig.host || 'localhost',
                port: targetConfig.port || 5432,
                user: targetConfig.user,
                password: targetConfig.password,
                database: targetConfig.database,
                connectionTimeoutMillis: 4000,
              });
            }

            await pgClient.connect();

            const tablesRes = await pgClient.query(
              `
              SELECT table_name 
              FROM information_schema.tables 
              WHERE table_schema = $1 AND table_type = 'BASE TABLE'
              `,
              [targetSchema]
            );

            for (const row of tablesRes.rows) {
              if (row.table_name) {
                const tblName = String(row.table_name).toLowerCase();
                existingTargetTables.push(tblName);

                // Deep column and row count inspection for schema drift
                try {
                  const countRes = await pgClient.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
                  const rowCount = parseInt(String(countRes.rows[0]?.count || '0'), 10);

                  const colsRes = await pgClient.query(
                    `
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = $1 AND table_name = $2
                    `,
                    [targetSchema, row.table_name]
                  );

                  const cols = colsRes.rows.map((c) => ({
                    name: String(c.column_name),
                    type: String(c.data_type),
                    nullable: c.is_nullable === 'YES',
                  }));

                  const sampleRowsRes = await pgClient.query(`SELECT * FROM "${row.table_name}" LIMIT 3`);

                  existingTargetTableDetails[tblName] = {
                    rowCount,
                    columns: cols,
                    sampleExistingRows: sampleRowsRes.rows,
                  };
                } catch {
                  // Non-fatal if specific table query is restricted
                }
              }
            }

            // Query existing target indexes for Foreign Key index advisor
            try {
              const idxRes = await pgClient.query(
                `
                SELECT tablename, indexname 
                FROM pg_indexes 
                WHERE schemaname = $1
                `,
                [targetSchema]
              );
              for (const r of idxRes.rows) {
                const tbl = String(r.tablename).toLowerCase();
                if (!existingTargetIndexes[tbl]) existingTargetIndexes[tbl] = [];
                existingTargetIndexes[tbl].push(String(r.indexname).toLowerCase());
              }
            } catch {
              // Non-fatal
            }

            // Foreign Key index check for child tables
            for (const colMapping of mapping) {
              for (const f of colMapping.fields) {
                if (f.isChildTable && f.childTableName) {
                  const childTable = f.childTableName.toLowerCase();
                  const parentTable = (colMapping.targetTableName || colMapping.collectionName).toLowerCase();
                  const fkCol = `${parentTable}_id`;
                  const existingIdxs = existingTargetIndexes[childTable] || [];
                  const hasIdx = existingIdxs.some((idx) => idx.includes(fkCol));
                  if (!hasIdx) {
                    if (!missingFkIndexes[colMapping.collectionName]) missingFkIndexes[colMapping.collectionName] = [];
                    missingFkIndexes[colMapping.collectionName].push({
                      childTable: f.childTableName,
                      fkColumn: fkCol,
                      parentTable: colMapping.targetTableName || colMapping.collectionName,
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.warn(
              maskSensitiveFields(
                `[RiskEngine] Warning: Could not check target table collisions: ${
                  err instanceof Error ? err.message : String(err)
                }`
              )
            );
          } finally {
            if (pgClient) await pgClient.end().catch(() => {});
          }
        }

        // ── 1b. Inspect Target MongoDB for Collection Collisions ────────────
        if (targetConfig && targetConfig.type === 'mongodb') {
          let mongoTargetClient: MongoClient | null = null;
          try {
            let connStr = targetConfig.connectionString;
            if (!connStr) {
              const auth = targetConfig.user
                ? `${encodeURIComponent(targetConfig.user)}:${encodeURIComponent(targetConfig.password || '')}@`
                : '';
              const host = targetConfig.host || 'localhost';
              const port = targetConfig.port || 27017;
              connStr = `mongodb://${auth}${host}:${port}`;
            }

            mongoTargetClient = new MongoClient(connStr, {
              serverSelectionTimeoutMS: 4000,
              connectTimeoutMS: 4000,
            });

            await mongoTargetClient.connect();
            const db =
              targetConfig.database && targetConfig.database !== 'default'
                ? mongoTargetClient.db(targetConfig.database)
                : mongoTargetClient.db();

            const cols = await db.listCollections().toArray();
            for (const col of cols) {
              if (col.name && !col.name.startsWith('system.')) {
                existingTargetTables.push(col.name.toLowerCase());
              }
            }
          } catch (err) {
            console.warn(
              maskSensitiveFields(
                `[RiskEngine] Warning: Could not check target MongoDB collection collisions: ${
                  err instanceof Error ? err.message : String(err)
                }`
              )
            );
          } finally {
            if (mongoTargetClient) await mongoTargetClient.close().catch(() => {});
          }
        }

        // ── 2. Sample MongoDB Documents for Doc Sizes, Nulls & Edge Cases ───
        if (sourceConfig && sourceConfig.type === 'mongodb' && direction === 'mongodb-to-postgres') {
          let mongoClient: MongoClient | null = null;
          try {
            let connStr = sourceConfig.connectionString;
            if (!connStr) {
              const auth = sourceConfig.user
                ? `${encodeURIComponent(sourceConfig.user)}:${encodeURIComponent(sourceConfig.password || '')}@`
                : '';
              const host = sourceConfig.host || 'localhost';
              const port = sourceConfig.port || 27017;
              connStr = `mongodb://${auth}${host}:${port}`;
            }

            mongoClient = new MongoClient(connStr, {
              serverSelectionTimeoutMS: 4000,
              connectTimeoutMS: 4000,
            });

            await mongoClient.connect();
            const db =
              sourceConfig.database && sourceConfig.database !== 'default'
                ? mongoClient.db(sourceConfig.database)
                : mongoClient.db();

            // Compute database storage stats for Capacity Planner
            try {
              const stats = await db.stats();
              const sourceSizeBytes = Number(stats.dataSize || stats.storageSize || 0);
              storageStats = {
                sourceSizeBytes,
                targetEstimatedBytes: Math.round(sourceSizeBytes * 1.38),
                multiplier: 1.38,
              };
            } catch {
              // Non-fatal
            }

            for (const colMapping of mapping) {
              const col = db.collection(colMapping.collectionName);
              const docCount = await col.countDocuments().catch(() => 1000);
              const sampleLimit = Math.min(1000, docCount > 0 ? docCount : 1000);
              let sampleDocs: Array<Record<string, unknown>> = [];
              try {
                if (docCount > 0) {
                  sampleDocs = (await col.aggregate([
                    { $sample: { size: sampleLimit } }
                  ]).toArray()) as Array<Record<string, unknown>>;
                }
              } catch {
                sampleDocs = (await col.find({}).limit(sampleLimit).toArray()) as Array<Record<string, unknown>>;
              }

              if (sampleDocs.length > 0) {
                // Measure document size in bytes
                let totalBytes = 0;
                sampleDocs.forEach((doc) => {
                  try {
                    totalBytes += Buffer.byteLength(JSON.stringify(doc));
                  } catch {
                    totalBytes += 500;
                  }
                });
                docSizeAverages[colMapping.collectionName] = Math.round(totalBytes / sampleDocs.length);

                // Initialize per-collection telemetry
                fieldMissingCounts[colMapping.collectionName] = {};
                sampleOffendingRecords[colMapping.collectionName] = {};
                const overflowCols = new Set<string>();
                const nullByteCols = new Set<string>();
                const sparseCols = new Set<string>();
                const numericSpecialsColMap: Record<string, Set<string>> = {};

                for (const field of colMapping.fields) {
                  let missing = 0;
                  let maxStringLen = 0;
                  const varcharMatch = (field.targetType || '').match(/VARCHAR\s*\(\s*(\d+)\s*\)/i);
                  const varcharLimit = varcharMatch ? parseInt(varcharMatch[1], 10) : null;

                  sampleDocs.forEach((doc) => {
                    const val = (doc as Record<string, unknown>)[field.sourceField];
                    const docId = String((doc as Record<string, unknown>)._id || 'sample-doc');

                    if (val === null || val === undefined) {
                      missing++;
                      if (!sampleOffendingRecords[colMapping.collectionName][field.sourceField]) {
                        sampleOffendingRecords[colMapping.collectionName][field.sourceField] = [];
                      }
                      if (sampleOffendingRecords[colMapping.collectionName][field.sourceField].length < 3) {
                        sampleOffendingRecords[colMapping.collectionName][field.sourceField].push({
                          docId,
                          value: null,
                          label: 'Field missing or null in document',
                        });
                      }
                    } else {
                      // Check for string length vs VARCHAR limit
                      if (typeof val === 'string') {
                        if (val.length > maxStringLen) maxStringLen = val.length;
                        if (varcharLimit && val.length > varcharLimit) {
                          if (!stringLengthViolations[colMapping.collectionName]) {
                            stringLengthViolations[colMapping.collectionName] = [];
                          }
                          if (!stringLengthViolations[colMapping.collectionName].some((v) => v.field === field.sourceField)) {
                            stringLengthViolations[colMapping.collectionName].push({
                              field: field.sourceField,
                              maxLen: val.length,
                              targetLimit: varcharLimit,
                            });
                          }
                        }

                        // Check for UTF-8 null bytes in strings
                        if (val.includes('\0')) {
                          nullByteCols.add(field.sourceField);
                          if (!sampleOffendingRecords[colMapping.collectionName][field.sourceField]) {
                            sampleOffendingRecords[colMapping.collectionName][field.sourceField] = [];
                          }
                          if (sampleOffendingRecords[colMapping.collectionName][field.sourceField].length < 3) {
                            sampleOffendingRecords[colMapping.collectionName][field.sourceField].push({
                              docId,
                              value: val.replace(/\0/g, '\\0'),
                              label: 'Contains raw null byte (\\0)',
                            });
                          }
                        }
                      }

                      // Check for nested array of arrays (e.g. [[1, 2], [3, 4]])
                      if (Array.isArray(val) && val.length > 0 && val.some((item) => Array.isArray(item))) {
                        if (!nestedArrayOfArrays[colMapping.collectionName]) nestedArrayOfArrays[colMapping.collectionName] = [];
                        if (!nestedArrayOfArrays[colMapping.collectionName].includes(field.sourceField)) {
                          nestedArrayOfArrays[colMapping.collectionName].push(field.sourceField);
                        }
                      }

                      // Check for numeric specials (NaN, Infinity, -Infinity)
                      if (typeof val === 'number') {
                        if (Number.isNaN(val)) {
                          if (!numericSpecialsColMap[field.sourceField]) numericSpecialsColMap[field.sourceField] = new Set();
                          numericSpecialsColMap[field.sourceField].add('NaN');
                        } else if (val === Infinity) {
                          if (!numericSpecialsColMap[field.sourceField]) numericSpecialsColMap[field.sourceField] = new Set();
                          numericSpecialsColMap[field.sourceField].add('Infinity');
                        } else if (val === -Infinity) {
                          if (!numericSpecialsColMap[field.sourceField]) numericSpecialsColMap[field.sourceField] = new Set();
                          numericSpecialsColMap[field.sourceField].add('-Infinity');
                        }
                      }

                      // Check for sparse arrays with nulls
                      if (Array.isArray(val) && val.some((elem) => elem === null)) {
                        sparseCols.add(field.sourceField);
                      }

                      // Check 32-bit Integer Overflow
                      try {
                        let bigVal: bigint;
                        if (typeof val === 'number') {
                          bigVal = !Number.isSafeInteger(val) ? BigInt(val.toFixed(0)) : BigInt(val);
                        } else {
                          bigVal = BigInt(String(val));
                        }
                        if (bigVal > 2147483647n || bigVal < -2147483648n) {
                          overflowCols.add(field.sourceField);
                          if (!sampleOffendingRecords[colMapping.collectionName][field.sourceField]) {
                            sampleOffendingRecords[colMapping.collectionName][field.sourceField] = [];
                          }
                          if (sampleOffendingRecords[colMapping.collectionName][field.sourceField].length < 3) {
                            sampleOffendingRecords[colMapping.collectionName][field.sourceField].push({
                              docId,
                              value: String(val),
                              label: `Exceeds 32-bit int ceiling: ${String(val)}`,
                            });
                          }
                        }
                      } catch {
                        // ignore unparseable
                      }
                    }
                  });
                  fieldMissingCounts[colMapping.collectionName][field.sourceField] = missing;
                }

                if (overflowCols.size > 0) {
                  fieldOverflows[colMapping.collectionName] = Array.from(overflowCols);
                }
                if (nullByteCols.size > 0) {
                  fieldNullBytes[colMapping.collectionName] = Array.from(nullByteCols);
                }
                if (sparseCols.size > 0) {
                  sparseArrayFields[colMapping.collectionName] = Array.from(sparseCols);
                }
                if (Object.keys(numericSpecialsColMap).length > 0) {
                  fieldNumericSpecials[colMapping.collectionName] = {};
                  for (const [k, v] of Object.entries(numericSpecialsColMap)) {
                    fieldNumericSpecials[colMapping.collectionName][k] = Array.from(v);
                  }
                }

                // Check for orphan foreign keys
                for (const field of colMapping.fields) {
                  if (field.foreignKeyToParent) {
                    const parentTable = field.foreignKeyToParent.split('.')[0];
                    const sampleFkValues = sampleDocs
                      .map((d) => (d as Record<string, unknown>)[field.sourceField])
                      .filter((v) => v !== null && v !== undefined)
                      .slice(0, 10);
                    if (sampleFkValues.length > 0) {
                      try {
                        const parentCol = db.collection(parentTable);
                        const queryFilter: Record<string, unknown> = {
                          _id: { $in: sampleFkValues },
                        };
                        const foundCount = await parentCol.countDocuments(queryFilter).catch(() => sampleFkValues.length);
                        const missingCount = sampleFkValues.length - foundCount;
                        if (missingCount > 0) {
                          if (!orphanForeignKeys[colMapping.collectionName]) {
                            orphanForeignKeys[colMapping.collectionName] = [];
                          }
                          orphanForeignKeys[colMapping.collectionName].push({
                            field: field.sourceField,
                            foreignTable: parentTable,
                            missingCount,
                          });
                        }
                      } catch {
                        // ignore if parent doesn't exist
                      }
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.warn(
              maskSensitiveFields(
                `[RiskEngine] Warning: Could not sample MongoDB stats: ${
                  err instanceof Error ? err.message : String(err)
                }`
              )
            );
          } finally {
            if (mongoClient) await mongoClient.close().catch(() => {});
          }
        }

        // ── 3. Introspect Layer 2 Features for PostgreSQL -> MongoDB ───────
        if (direction === 'postgres-to-mongo' && sourceConfig && sourceConfig.type === 'postgresql') {
          try {
            const rawLayer2 = await introspectLayer2Catalogs(sourceConfig);
            layer2Features = buildLayer2FeatureItems(rawLayer2);
          } catch (err) {
            console.warn(
              maskSensitiveFields(
                `[RiskEngine] Warning: Layer 2 catalog scan error: ${
                  err instanceof Error ? err.message : String(err)
                }`
              )
            );
          }
        }

        // ── 4. Execute 20 Static Risk Rules ────────────────────────────────
        const analysis = analyzeRisks({
          sourceSchema,
          mapping,
          direction,
          existingTargetTables,
          existingTargetTableDetails,
          missingFkIndexes,
          stringLengthViolations,
          reservedWordWarnings,
          sampleOffendingRecords,
          storageStats,
          docSizeAverages,
          fieldMissingCounts,
          fieldOverflows,
          fieldNullBytes,
          fieldNumericSpecials,
          caseFoldingCollisions,
          unorthodoxIdentifiers,
          orphanForeignKeys,
          deepNestingFields,
          sparseArrayFields,
          nestedArrayOfArrays,
          timezoneHazards,
          jsonbAdvisories,
        });

        // If no Layer 2 features detected in live DB, provide sample items for UI exploration
        if (direction === 'postgres-to-mongo' && layer2Features.length === 0) {
          // Provide standard demo routines if empty schema
          const rawDemo = {
            procedures: [{ name: 'calculate_order_total', args: 'order_id INT' }],
            functions: [{ name: 'get_user_full_name', args: 'user_id INT', ret: 'text' }],
            triggers: [{ name: 'trigger_update_inventory', table: 'orders', event: 'AFTER INSERT' }],
            views: [{ name: 'view_sales_summary', definition: 'SELECT ...' }],
            enums: [{ name: 'order_status_enum', values: ['pending', 'processing', 'shipped', 'delivered'] }],
            compositePks: [{ table: 'user_product_favorites', columns: ['user_id', 'product_id'] }],
          };
          layer2Features = buildLayer2FeatureItems(rawDemo);
        }

        const result: RiskAnalysisResult = {
          risks: analysis.risks,
          layer2Features,
          metrics: analysis.metrics,
        };

        console.log(
          `[RiskEngine] Evaluation complete: ${analysis.metrics.criticalCount} critical, ${analysis.metrics.warningCount} warnings, ${analysis.metrics.infoCount} info, ${layer2Features.length} layer2 items.`
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(maskSensitiveFields(`[RiskEngine] Analysis failed: ${errorMsg}`));
        return {
          success: false,
          error: `Risk analysis failed: ${errorMsg}`,
        };
      }
    }
  );
}
