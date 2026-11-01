import { ipcMain, dialog } from 'electron';
import ElectronStore from 'electron-store';
import * as fs from 'fs/promises';
import type {
  ConnectionConfig,
  IPCResponse,
  MigrationHistoryItem,
  WizardStateSnapshot,
  AppSettings,
  SchemaHistoryItem
} from '@migrateiq/shared';
import { maskSensitiveFields } from '../utils';

// Re-export shared types for callers
export type { MigrationHistoryItem, WizardStateSnapshot, AppSettings, SchemaHistoryItem };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavedConnection {
  id: string;
  name: string;
  type: 'mongodb' | 'postgresql';
  config: ConnectionConfig;
  savedAt: string; // ISO timestamp
}

// ── electron-store instance ───────────────────────────────────────────────────

interface StoreSchema {
  savedConnections: SavedConnection[];
  wizardState: WizardStateSnapshot | null;
  migrationHistory: MigrationHistoryItem[];
  schemaHistory: SchemaHistoryItem[];
  appSettings: AppSettings;
}

const defaultAppSettings: AppSettings = {
  aiProvider: 'gemini',
  apiKey: '',
  batchSize: 500,
  lockTimeoutSeconds: 5,
};

const store = new ElectronStore<StoreSchema>({
  name: 'migrateiq-data',
  defaults: {
    savedConnections: [],
    wizardState: null,
    migrationHistory: [],
    schemaHistory: [],
    appSettings: defaultAppSettings,
  },
});

// Also reference secondary schema store if created by schemaUpdate.ts
interface SchemaStoreData {
  schemaHistory: SchemaHistoryItem[];
}
const secondarySchemaStore = new ElectronStore<SchemaStoreData>({
  name: 'migrateiq-schema-store',
  defaults: {
    schemaHistory: [],
  },
});

function isValidMigrationRecord(record: unknown): record is MigrationHistoryItem {
  if (!record || typeof record !== 'object') return false;
  const r = record as Partial<MigrationHistoryItem>;
  if (typeof r.id !== 'string' || !r.id.trim() || r.id.length > 100) return false;
  if (typeof r.dateTime !== 'string' || !r.dateTime.trim()) return false;
  if (typeof r.direction !== 'string' || !r.direction.trim()) return false;
  if (!r.status || !['completed', 'warning', 'failed'].includes(r.status)) return false;
  return true;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export function setupStoreHandlers(): void {
  // ── Saved Connections ──────────────────────────────────────────────────────

  /** Save a named connection to persistent store */
  ipcMain.handle(
    'store:save-connection',
    async (
      _event,
      payload: { id?: string; name: string; config: ConnectionConfig }
    ): Promise<IPCResponse<SavedConnection>> => {
      try {
        const existing: SavedConnection[] = store.get('savedConnections', []);

        let connType: 'mongodb' | 'postgresql' = 'mongodb';
        if (payload.config.type === 'postgresql' || payload.config.type === 'mongodb') {
          connType = payload.config.type;
        } else if (payload.config.connectionString) {
          connType = payload.config.connectionString.startsWith('postgres') ? 'postgresql' : 'mongodb';
        } else if (payload.config.port === 5432) {
          connType = 'postgresql';
        }

        const connName = (payload.name || '').trim() || `Connection_${Date.now()}`;
        const connId = payload.id || `conn_${Date.now()}`;

        const newConn: SavedConnection = {
          id: connId,
          name: connName,
          type: connType,
          config: {
            ...payload.config,
            type: connType,
            name: connName,
          },
          savedAt: new Date().toISOString(),
        };

        // Filter out if existing connection has same ID or same name
        const filtered = existing.filter(
          (c) => c && c.id !== connId && typeof c.name === 'string' && c.name.toLowerCase() !== newConn.name.toLowerCase()
        );
        store.set('savedConnections', [...filtered, newConn]);

        return { success: true, data: newConn };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save connection',
        };
      }
    }
  );

  /** Update an existing connection */
  ipcMain.handle(
    'store:update-connection',
    async (
      _event,
      payload: { id: string; name?: string; config: ConnectionConfig }
    ): Promise<IPCResponse<SavedConnection>> => {
      try {
        const existing: SavedConnection[] = store.get('savedConnections', []);
        const target = existing.find((c) => c.id === payload.id);
        if (!target) {
          return { success: false, error: `Connection with id ${payload.id} not found` };
        }

        const updated: SavedConnection = {
          ...target,
          name: payload.name ? payload.name.trim() : target.name,
          config: {
            ...target.config,
            ...payload.config,
            name: payload.name ? payload.name.trim() : target.name,
          },
          savedAt: new Date().toISOString(),
        };

        const updatedList = existing.map((c) => (c.id === payload.id ? updated : c));
        store.set('savedConnections', updatedList);
        return { success: true, data: updated };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to update connection',
        };
      }
    }
  );

  /** Get all saved connections (optionally filtered by db type) */
  ipcMain.handle(
    'store:get-connections',
    async (
      _event,
      dbType?: 'mongodb' | 'postgresql'
    ): Promise<IPCResponse<SavedConnection[]>> => {
      try {
        const all: SavedConnection[] = store.get('savedConnections', []);
        const result = dbType
          ? all.filter((c) => {
              const t = c.type || (c.config?.type) || (c.config?.connectionString?.startsWith('postgres') ? 'postgresql' : 'mongodb');
              return t === dbType;
            })
          : all;
        return { success: true, data: result };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to load connections',
        };
      }
    }
  );

  /** Delete a saved connection by id */
  ipcMain.handle(
    'store:delete-connection',
    async (_event, id: string): Promise<IPCResponse<null>> => {
      try {
        const existing: SavedConnection[] = store.get('savedConnections', []);
        store.set('savedConnections', existing.filter((c) => c.id !== id));
        return { success: true, data: null };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to delete connection',
        };
      }
    }
  );

  /** Clear all saved connections */
  ipcMain.handle(
    'store:clear-all-connections',
    async (): Promise<IPCResponse<null>> => {
      try {
        store.set('savedConnections', []);
        return { success: true, data: null };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to clear connections',
        };
      }
    }
  );

  // ── Wizard State Persistence ───────────────────────────────────────────────

  /** Persist the current wizard state to disk (called after each step) */
  ipcMain.handle(
    'store:save-wizard-state',
    async (_event, snapshot: WizardStateSnapshot): Promise<IPCResponse<null>> => {
      try {
        store.set('wizardState', snapshot);
        return { success: true, data: null };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save wizard state',
        };
      }
    }
  );

  /** Load the persisted wizard state (called on app start / HomeDashboard mount) */
  ipcMain.handle(
    'store:get-wizard-state',
    async (): Promise<IPCResponse<WizardStateSnapshot | null>> => {
      try {
        const state = store.get('wizardState', null);
        return { success: true, data: state };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to load wizard state',
        };
      }
    }
  );

  /** Clear the wizard state (called on migration complete or cancel) */
  ipcMain.handle(
    'store:clear-wizard-state',
    async (): Promise<IPCResponse<null>> => {
      try {
        store.delete('wizardState');
        return { success: true, data: null };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to clear wizard state',
        };
      }
    }
  );

  // ── Migration History ──────────────────────────────────────────────────────

  /** Get recent migration history (read from electron-store) */
  ipcMain.handle(
    'store:get-migration-history',
    async (): Promise<IPCResponse<MigrationHistoryItem[]>> => {
      try {
        const history = store.get('migrationHistory', []);
        return { success: true, data: history };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to load migration history',
        };
      }
    }
  );

  /** Save a migration record to persistent history */
  ipcMain.handle(
    'store:save-migration-history',
    async (
      _event,
      record: MigrationHistoryItem
    ): Promise<IPCResponse<MigrationHistoryItem>> => {
      try {
        if (!isValidMigrationRecord(record)) {
          return {
            success: false,
            error: 'Invalid migration record: id, dateTime, direction, and valid status are required',
          };
        }
        const existing = store.get('migrationHistory', []);
        // Prepend to display most recent first, keep up to 50
        const updated = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, 50);
        store.set('migrationHistory', updated);
        return { success: true, data: record };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save migration history',
        };
      }
    }
  );

  /** Clear migration history */
  ipcMain.handle(
    'store:clear-migration-history',
    async (): Promise<IPCResponse<null>> => {
      try {
        store.set('migrationHistory', []);
        return { success: true, data: null };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to clear migration history',
        };
      }
    }
  );

  // ── Schema History ─────────────────────────────────────────────────────────

  /** Get unified schema version history (merging store and schemaStore) */
  ipcMain.handle(
    'store:get-schema-history',
    async (): Promise<IPCResponse<SchemaHistoryItem[]>> => {
      try {
        const primary = store.get('schemaHistory', []);
        const secondary = secondarySchemaStore.get('schemaHistory', []);

        // Combine and deduplicate by item id
        const map = new Map<string, SchemaHistoryItem>();
        for (const item of [...secondary, ...primary]) {
          if (item && item.id) {
            map.set(item.id, item);
          }
        }
        const sorted = Array.from(map.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return { success: true, data: sorted };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to load schema history',
        };
      }
    }
  );

  /** Save a schema history item */
  ipcMain.handle(
    'store:save-schema-history',
    async (
      _event,
      item: SchemaHistoryItem
    ): Promise<IPCResponse<SchemaHistoryItem>> => {
      try {
        const existing = store.get('schemaHistory', []);
        const updated = [item, ...existing.filter((h) => h.id !== item.id)].slice(0, 100);
        store.set('schemaHistory', updated);
        // Also sync to secondary store
        const secExisting = secondarySchemaStore.get('schemaHistory', []);
        secondarySchemaStore.set('schemaHistory', [item, ...secExisting.filter((h) => h.id !== item.id)].slice(0, 100));
        return { success: true, data: item };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save schema history item',
        };
      }
    }
  );

  /** Clear schema history */
  ipcMain.handle(
    'store:clear-schema-history',
    async (): Promise<IPCResponse<null>> => {
      try {
        store.set('schemaHistory', []);
        secondarySchemaStore.set('schemaHistory', []);
        return { success: true, data: null };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to clear schema history',
        };
      }
    }
  );

  /** Export schema history as formatted Markdown Changelog */
  ipcMain.handle(
    'store:export-schema-changelog',
    async (): Promise<IPCResponse<{ filePath: string }>> => {
      try {
        const primary = store.get('schemaHistory', []);
        const secondary = secondarySchemaStore.get('schemaHistory', []);
        const map = new Map<string, SchemaHistoryItem>();
        for (const item of [...secondary, ...primary]) {
          if (item && item.id) map.set(item.id, item);
        }
        const items = Array.from(map.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        let md = `# 📜 Database Schema Evolution Changelog\n\n`;
        md += `**Generated by MigrateIQ** on ${new Date().toLocaleString()}\n`;
        md += `**Total Recorded Changes:** ${items.length}\n\n---\n\n`;

        if (items.length === 0) {
          md += `*No schema evolution entries recorded yet.*\n`;
        } else {
          for (const item of items) {
            const dateStr = new Date(item.timestamp).toLocaleString();
            const statusIcon = item.status === 'applied' ? '✅' : item.status === 'rolled_back' ? '⚠️' : '❌';
            md += `### ${statusIcon} [${item.operation}] \`${item.tableName}\` — ${dateStr}\n\n`;
            md += `- **Database:** \`${item.databaseType.toUpperCase()}\` (${maskSensitiveFields(item.databaseName)})\n`;
            md += `- **Status:** \`${item.status.toUpperCase()}\` | **Duration:** ${item.durationMs || 0}ms\n`;
            if (item.author) md += `- **Author:** ${item.author}\n`;
            if (item.errorMessage) md += `- **Error Details:** \`${item.errorMessage}\`\n`;
            md += `\n**Executed Forward Script:**\n\`\`\`sql\n${item.forwardScript || '-- No script recorded'}\n\`\`\`\n\n`;
            if (item.rollbackScript) {
              md += `**Rollback Script:**\n\`\`\`sql\n${item.rollbackScript}\n\`\`\`\n\n`;
            }
            md += `---\n\n`;
          }
        }

        const saveRes = await dialog.showSaveDialog({
          title: 'Export Schema Evolution Changelog (Markdown)',
          defaultPath: `migrateiq-schema-changelog-${Date.now()}.md`,
          filters: [{ name: 'Markdown Document', extensions: ['md'] }],
        });

        if (saveRes.canceled || !saveRes.filePath) {
          return { success: false, error: 'Export canceled by user.' };
        }

        await fs.writeFile(saveRes.filePath, md, 'utf-8');
        return { success: true, data: { filePath: saveRes.filePath } };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to export schema changelog',
        };
      }
    }
  );

  // ── App Settings ───────────────────────────────────────────────────────────

  /** Get application settings */
  ipcMain.handle(
    'store:get-settings',
    async (): Promise<IPCResponse<AppSettings>> => {
      try {
        const settings = store.get('appSettings', defaultAppSettings);
        return { success: true, data: { ...defaultAppSettings, ...settings } };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to load settings',
        };
      }
    }
  );

  /** Save application settings */
  ipcMain.handle(
    'store:save-settings',
    async (_event, newSettings: Partial<AppSettings>): Promise<IPCResponse<AppSettings>> => {
      try {
        const current = store.get('appSettings', defaultAppSettings);
        const merged: AppSettings = {
          ...defaultAppSettings,
          ...current,
          ...newSettings,
        };
        store.set('appSettings', merged);
        return { success: true, data: merged };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save settings',
        };
      }
    }
  );

  /** Export settings to JSON file */
  ipcMain.handle(
    'store:export-settings',
    async (): Promise<IPCResponse<{ filePath: string }>> => {
      try {
        const settings = store.get('appSettings', defaultAppSettings);
        const json = JSON.stringify(settings, null, 2);

        const saveRes = await dialog.showSaveDialog({
          title: 'Export MigrateIQ Settings (JSON)',
          defaultPath: `migrateiq-settings-${Date.now()}.json`,
          filters: [{ name: 'JSON Files', extensions: ['json'] }],
        });

        if (saveRes.canceled || !saveRes.filePath) {
          return { success: false, error: 'Export canceled by user.' };
        }

        await fs.writeFile(saveRes.filePath, json, 'utf-8');
        return { success: true, data: { filePath: saveRes.filePath } };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to export settings',
        };
      }
    }
  );

  /** Import settings from JSON file */
  ipcMain.handle(
    'store:import-settings',
    async (): Promise<IPCResponse<AppSettings>> => {
      try {
        const openRes = await dialog.showOpenDialog({
          title: 'Import MigrateIQ Settings (JSON)',
          filters: [{ name: 'JSON Files', extensions: ['json'] }],
          properties: ['openFile'],
        });

        if (openRes.canceled || openRes.filePaths.length === 0) {
          return { success: false, error: 'Import canceled by user.' };
        }

        const raw = await fs.readFile(openRes.filePaths[0], 'utf-8');
        const parsed = JSON.parse(raw) as Partial<AppSettings>;

        const current = store.get('appSettings', defaultAppSettings);
        const merged: AppSettings = {
          ...defaultAppSettings,
          ...current,
          ...parsed,
        };
        store.set('appSettings', merged);
        return { success: true, data: merged };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to import settings JSON',
        };
      }
    }
  );
}
