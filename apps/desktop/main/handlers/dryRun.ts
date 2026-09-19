/**
 * MigrateIQ - Dry Run IPC Handlers (Step 6)
 *
 * Coordinates execution between the Renderer and Main process,
 * streaming live progress events over native Electron IPC.
 */

import { ipcMain, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import type { IPCResponse, DryRunResult, DryRunProgressPayload } from '@migrateiq/shared';
import { executeDryRunSimulation, DryRunOptions } from '../engine/dryRun';

export function setupDryRunHandlers(): void {
  ipcMain.handle(
    'migration:dry-run',
    async (event, payload: DryRunOptions): Promise<IPCResponse<DryRunResult>> => {
      try {
        const result = await executeDryRunSimulation({
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

  ipcMain.handle(
    'dossier:export-pdf',
    async (
      _event,
      payload: { htmlContent: string; defaultFilename?: string }
    ): Promise<IPCResponse<{ filePath?: string; cancelled?: boolean }>> => {
      let printWin: BrowserWindow | null = null;
      try {
        const { htmlContent, defaultFilename = `migrateiq-preflight-dossier-${Date.now()}.pdf` } = payload;

        const saveDialogResult = await dialog.showSaveDialog({
          title: 'Save Pre-Flight Verification Dossier (PDF)',
          defaultPath: defaultFilename,
          filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        });

        if (saveDialogResult.canceled || !saveDialogResult.filePath) {
          return { success: true, data: { cancelled: true } };
        }

        printWin = new BrowserWindow({
          show: false,
          width: 1200,
          height: 1600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            javascript: false,
          },
        });

        const encodedHtml = Buffer.from(htmlContent, 'utf-8').toString('base64');
        await printWin.loadURL(`data:text/html;charset=utf-8;base64,${encodedHtml}`);

        const pdfBuffer = await printWin.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          margins: {
            marginType: 'custom',
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4,
          },
        });

        await fs.promises.writeFile(saveDialogResult.filePath, pdfBuffer);

        return {
          success: true,
          data: { filePath: saveDialogResult.filePath, cancelled: false },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        if (printWin && !printWin.isDestroyed()) {
          printWin.close();
        }
      }
    }
  );
}

