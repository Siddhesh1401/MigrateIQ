/**
 * MigrateIQ - Live Migration IPC Handlers (Phase 9)
 *
 * Coordinates the live migration execution between Renderer and Main process,
 * streaming real-time progress events over native Electron IPC.
 *
 * IPC Channels:
 * - migration:start → Initiates live migration with ETL engine
 * - migration:cancel → Gracefully cancels in-progress migration
 * - migration:progress → (main→renderer) Real-time progress events
 * - migration:log → (main→renderer) Structured log entries
 * - migration:get-rollback → Retrieves rollback script from last migration
 * - migration:execute-rollback → Executes rollback to undo migration
 *
 * Referenced Specs:
 * - phase_plan-v2.md Lines 472-605 (Phase 9 Technical Spec)
 * - product_blueprint-v7.md Step 7 (Migration Progress UI)
 * - AGENTS.md: IPC pattern, parameterized SQL, password masking
 */

import { ipcMain } from 'electron';
import { Client as PgClient } from 'pg';
import type {
  IPCResponse,
  MigrationResult,
  MigrationProgressEvent,
  MigrationLogEntry,
  MigrationRollbackInfo,
  ConnectionConfig,
  CollectionMapping,
  MigrationHistoryItem
} from '@migrateiq/shared';
import { topologicalSort } from '../engine/topologicalSort';
import { executeMigration } from '../engine/etlEngine';
import { maskSensitiveFields } from '../utils';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

// Global migration state (single migration at a time)
let activeMigration: {
  cancelRequested: boolean;
  startTime: string;
  sourceConfig: ConnectionConfig;
  targetConfig: ConnectionConfig;
  mappings: CollectionMapping[];
} | null = null;

/**
 * Sets up all migration-related IPC handlers
 */
export function setupMigrationHandlers(): void {
  
  // ============================================
  // migration:start — Initiate Live Migration
  // ============================================
  ipcMain.handle(
    'migration:start',
    async (
      event,
      payload: {
        sourceConfig: ConnectionConfig;
        targetConfig: ConnectionConfig;
        mappings: CollectionMapping[];
        batchSize?: number;
      }
    ): Promise<IPCResponse<MigrationResult>> => {
      try {
        // Check if migration already in progress
        if (activeMigration) {
          return {
            success: false,
            error: 'A migration is already in progress. Please cancel it first or wait for completion.'
          };
        }

        const { sourceConfig, targetConfig, mappings, batchSize = 500 } = payload;

        // Validate inputs
        if (!mappings || mappings.length === 0) {
          return {
            success: false,
            error: 'No mappings provided. Please configure schema mapping first (Step 4).'
          };
        }

        // Initialize migration state
        activeMigration = {
          cancelRequested: false,
          startTime: new Date().toISOString(),
          sourceConfig,
          targetConfig,
          mappings
        };

        // Emit log entry
        const logEntry: MigrationLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Migration started for ${mappings.length} collection(s) with batch size ${batchSize}`
        };
        event.sender.send('migration:log', logEntry);

        // Step 1: Perform topological sort to determine table order
        emitLog(event.sender, 'info', '📊 Computing table dependency order...');
        const sortResult = topologicalSort(mappings);

        if (!sortResult.success) {
          activeMigration = null;
          return {
            success: false,
            error: `Topological sort failed: ${sortResult.error}`
          };
        }

        if (sortResult.cycles && sortResult.cycles.length > 0) {
          const cycleInfo = sortResult.cycles.map(c => c.tables.join(' ↔ ')).join(', ');
          emitLog(
            event.sender,
            'warn',
            `⚠️ Circular foreign key dependencies detected: ${cycleInfo}. Constraints will be added after data load.`
          );
        }

        emitLog(event.sender, 'info', `✅ Table order computed: ${sortResult.orderedTables.join(' → ')}`);

        // Step 2: Execute migration with ETL engine
        const migrationResult = await executeMigration({
          sourceConfig,
          targetConfig,
          mappings,
          tableOrder: sortResult.orderedTables,
          batchSize,
          onProgress: (progress: MigrationProgressEvent) => {
            try {
              // Check for cancel request
              if (activeMigration?.cancelRequested) {
                progress.type = 'cancel';
              }
              event.sender.send('migration:progress', progress);
            } catch {
              // Ignore errors if sender is disposed
            }
          },
          onLog: (log: MigrationLogEntry) => {
            try {
              // Send the MigrationLogEntry object directly (NOT JSON-stringified)
              event.sender.send('migration:log', log);
            } catch {
              // Ignore errors if sender is disposed
            }
          },
          checkCancellation: () => activeMigration?.cancelRequested || false,
          // Save rollback script BEFORE first INSERT (crash recovery)
          onRollbackScriptReady: async (script: string) => {
            await saveRollbackScript(script, new Date().toISOString());
          }
        });

        // Step 3: Save migration result to history
        if (migrationResult.success) {
          await saveMigrationHistory(migrationResult, sourceConfig, targetConfig);
        }

        // Clear active migration state
        activeMigration = null;

        return {
          success: true,
          data: migrationResult
        };

      } catch (error) {
        activeMigration = null;
        const errorMessage = error instanceof Error ? error.message : String(error);
        emitLog(event.sender, 'error', `❌ Migration failed: ${errorMessage}`);
        
        return {
          success: false,
          error: maskSensitiveFields(errorMessage)
        };
      }
    }
  );

  // ============================================
  // migration:cancel — Cancel Active Migration
  // ============================================
  ipcMain.handle(
    'migration:cancel',
    async (_event): Promise<IPCResponse<{ cancelled: boolean }>> => {
      try {
        if (!activeMigration) {
          return {
            success: false,
            error: 'No active migration to cancel'
          };
        }

        activeMigration.cancelRequested = true;

        return {
          success: true,
          data: { cancelled: true }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage
        };
      }
    }
  );

  // ============================================
  // migration:get-rollback — Retrieve Rollback Script
  // ============================================
  ipcMain.handle(
    'migration:get-rollback',
    async (_event): Promise<IPCResponse<MigrationRollbackInfo>> => {
      try {
        const rollbackDir = path.join(app.getPath('userData'), 'rollback-scripts');
        
        // Check if rollback directory exists
        try {
          await fs.access(rollbackDir);
        } catch {
          return {
            success: true,
            data: {
              available: false,
              tables: [],
              rowCount: 0,
              createdAt: ''
            }
          };
        }

        // Find most recent rollback script
        const files = await fs.readdir(rollbackDir);
        const rollbackFiles = files
          .filter(f => f.startsWith('rollback-') && f.endsWith('.sql'))
          .sort()
          .reverse();

        if (rollbackFiles.length === 0) {
          return {
            success: true,
            data: {
              available: false,
              tables: [],
              rowCount: 0,
              createdAt: ''
            }
          };
        }

        const latestFile = rollbackFiles[0];
        const filePath = path.join(rollbackDir, latestFile);
        const script = await fs.readFile(filePath, 'utf-8');

        // Parse metadata from script (embedded as SQL comments)
        const tables = extractMetadata(script, 'TABLES');
        const rowCount = parseInt(extractMetadata(script, 'ROW_COUNT') || '0', 10);
        const createdAt = extractMetadata(script, 'CREATED_AT');

        return {
          success: true,
          data: {
            available: true,
            tables: tables.split(',').filter(Boolean),
            rowCount,
            createdAt,
            script
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage
        };
      }
    }
  );

  // ============================================
  // migration:execute-rollback — Execute Rollback
  // ============================================
  ipcMain.handle(
    'migration:execute-rollback',
    async (
      _event,
      payload: { targetConfig: ConnectionConfig; script: string }
    ): Promise<IPCResponse<{ rowsDeleted: number }>> => {
      let client: PgClient | null = null;

      try {
        const { targetConfig, script } = payload;

        // Connect to PostgreSQL
        client = new PgClient({
          connectionString: targetConfig.connectionString,
          host: targetConfig.host,
          port: targetConfig.port,
          user: targetConfig.user,
          password: targetConfig.password,
          database: targetConfig.database,
          ssl: targetConfig.ssl ? { rejectUnauthorized: false } : false
        });

        await client.connect();

        // Execute rollback script in a transaction
        await client.query('BEGIN');
        const result = await client.query(script);
        await client.query('COMMIT');

        const rowsDeleted = result.rowCount || 0;

        return {
          success: true,
          data: { rowsDeleted }
        };
      } catch (error) {
        // Rollback on error
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch {
            // Ignore rollback errors
          }
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: maskSensitiveFields(errorMessage)
        };
      } finally {
        if (client) {
          await client.end().catch(() => {});
        }
      }
    }
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Emits a structured log entry to the renderer process
 */
function emitLog(
  sender: Electron.WebContents,
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  table?: string
): void {
  try {
    const logEntry: MigrationLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: maskSensitiveFields(message),
      table
    };
    sender.send('migration:log', logEntry);
  } catch {
    // Ignore if sender is disposed
  }
}

/**
 * Saves rollback script to disk for crash recovery.
 */
async function saveRollbackScript(script: string, timestamp: string): Promise<void> {
  const rollbackDir = path.join(app.getPath('userData'), 'rollback-scripts');
  await fs.mkdir(rollbackDir, { recursive: true });

  const filename = `rollback-${timestamp.replace(/[:.]/g, '-')}.sql`;
  const filePath = path.join(rollbackDir, filename);

  await fs.writeFile(filePath, script, 'utf-8');
}

/**
 * Saves a completed migration to the electron-store history.
 */
async function saveMigrationHistory(
  result: MigrationResult,
  sourceConfig: ConnectionConfig,
  targetConfig: ConnectionConfig
): Promise<void> {
  try {
    const historyItem: MigrationHistoryItem = {
      id: `migration-${Date.now()}`,
      dateTime: result.endTime,
      direction: 'MongoDB → PostgreSQL',
      status: result.failedTables > 0 ? 'warning' : 'completed',
      sourceDb: sourceConfig.database,
      targetDb: targetConfig.database,
      tablesCount: result.completedTables,
      rowsMigrated: result.migratedRows,
      duration: `${Math.round(result.duration / 1000)}s`,
      reportSummary: `${result.migratedRows} rows migrated, ${result.skippedRows} skipped, ${result.failedTables} failed tables`
    };

    // Fetch existing history and prepend the new entry
    const existingResponse = await new Promise<{ success: boolean; data?: MigrationHistoryItem[] }>((resolve) => {
      ipcMain.emit('store:get-migration-history', {}, (resp: { success: boolean; data?: MigrationHistoryItem[] }) => resolve(resp));
    }).catch(() => ({ success: false, data: [] }));

    const history: MigrationHistoryItem[] = [
      historyItem,
      ...(Array.isArray(existingResponse?.data) ? existingResponse.data : [])].slice(0, 50); // Keep last 50

    // Write back to store
    const Store = (await import('electron-store')).default;
    const store = new Store<{ migrationHistory: MigrationHistoryItem[] }>();
    store.set('migrationHistory', history);

  } catch {
    // Non-critical: history save failure does not break migration
  }
}

/**
 * Extracts metadata from SQL script comments
 * Format: -- METADATA:KEY:value
 */
function extractMetadata(script: string, key: string): string {
  const regex = new RegExp(`-- METADATA:${key}:(.+)`, 'i');
  const match = script.match(regex);
  return match ? match[1].trim() : '';
}
