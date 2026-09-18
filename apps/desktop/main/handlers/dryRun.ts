/**
 * MigrateIQ - Dry Run IPC Handlers (Step 6)
 *
 * Coordinates execution between the Renderer and Main process,
 * streaming live progress events over native Electron IPC.
 */

import { ipcMain } from 'electron';
import type { IPCResponse, DryRunResult, DryRunProgressPayload } from '@migrateiq/shared';
import { executeDryRunSimulation, DryRunOptions } from '../engine/dryRun';

export function setupDryRunHandlers(): void {
  ipcMain.handle(
    'migration:dry-run',
    async (event, payload: DryRunOptions): Promise<IPCResponse<DryRunResult>> => {
      try {
        let runSimulation = executeDryRunSimulation;
        // In development mode, dynamically invalidate require cache so engine updates reload without restarting Electron
        if (process.env.NODE_ENV !== 'production') {
          try {
            const enginePath = require.resolve('../engine/dryRun');
            delete require.cache[enginePath];
            const freshEngine = require('../engine/dryRun');
            if (freshEngine && freshEngine.executeDryRunSimulation) {
              runSimulation = freshEngine.executeDryRunSimulation;
            }
          } catch {}
        }

        const result = await runSimulation({
          ...payload,
          onProgress: (progress: DryRunProgressPayload) => {
            // Push real-time event directly to caller's webContents
            try {
              event.sender.send('dry-run:progress', progress);
            } catch {
              // Ignore progress push errors if sender was disposed
            }
          },
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );
}
