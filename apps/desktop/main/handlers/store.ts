import { ipcMain } from 'electron';
import ElectronStore from 'electron-store';
import type { ConnectionConfig, IPCResponse } from '@migrateiq/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavedConnection {
  id: string;
  name: string;
  type: 'mongodb' | 'postgresql';
  config: ConnectionConfig;
  savedAt: string; // ISO timestamp
}

export interface WizardStateSnapshot {
  direction: 'mongodb-to-postgres' | 'postgres-to-mongo' | null;
  wizardStep: number;
  sourceConfig: ConnectionConfig | null;
  targetConfig: ConnectionConfig | null;
  status: 'in-progress' | 'completed' | 'cancelled';
  savedAt: string;
}

// ── electron-store instance ───────────────────────────────────────────────────

interface StoreSchema {
  savedConnections: SavedConnection[];
  wizardState: WizardStateSnapshot | null;
}

const store = new ElectronStore<StoreSchema>({
  name: 'migrateiq-data',
  defaults: {
    savedConnections: [],
    wizardState: null,
  },
});

// ── Handlers ──────────────────────────────────────────────────────────────────

export function setupStoreHandlers(): void {
  // ── Saved Connections ──────────────────────────────────────────────────────

  /** Save a named connection to persistent store */
  ipcMain.handle(
    'store:save-connection',
    async (
      _event,
      payload: { name: string; config: ConnectionConfig }
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

        const newConn: SavedConnection = {
          id: `conn_${Date.now()}`,
          name: payload.name.trim(),
          type: connType,
          config: {
            ...payload.config,
            type: connType,
            name: payload.name.trim(),
          },
          savedAt: new Date().toISOString(),
        };

        // Replace if a connection with the same name already exists
        const filtered = existing.filter(
          (c) => c.name.toLowerCase() !== newConn.name.toLowerCase()
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
}
