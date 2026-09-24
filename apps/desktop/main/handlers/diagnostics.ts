/**
 * MigrateIQ - Diagnostics & Audit Report IPC Handler
 * 
 * Handles exporting 1:1 migration manifests, auto-saving diagnostic snapshots,
 * and generating executive PDF audit reports via native Electron printToPDF.
 */

import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import type { IPCResponse } from '@migrateiq/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

export function setupDiagnosticsHandlers(): void {
  // ── 1. Save Diagnostic Snapshot to Workspace ─────────────────────────────
  ipcMain.handle(
    'diagnostics:save-snapshot',
    async (
      _event,
      payload: { markdown: string; json: Record<string, unknown>; step: number }
    ): Promise<IPCResponse<{ savedPath: string }>> => {
      try {
        const diagnosticsDir = path.join(process.cwd(), 'apps', 'desktop', 'diagnostics');
        await fs.mkdir(diagnosticsDir, { recursive: true });

        const mdPath = path.join(diagnosticsDir, 'latest-migration-snapshot.md');
        const jsonPath = path.join(diagnosticsDir, 'latest-run.json');

        await fs.writeFile(mdPath, payload.markdown, 'utf-8');
        await fs.writeFile(jsonPath, JSON.stringify(payload.json, null, 2), 'utf-8');

        return {
          success: true,
          data: { savedPath: mdPath }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  );

  // ── 2. Export Executive PDF Audit Report ─────────────────────────────────
  ipcMain.handle(
    'diagnostics:export-pdf',
    async (
      _event,
      payload: { html: string; defaultFilename?: string }
    ): Promise<IPCResponse<{ filePath: string }>> => {
      let printWindow: BrowserWindow | null = null;

      try {
        const defaultName = payload.defaultFilename || `MigrateIQ-Audit-Report-${Date.now()}.pdf`;

        // Prompt user for save destination
        const saveDialogResult = await dialog.showSaveDialog({
          title: 'Save Executive PDF Audit Report',
          defaultPath: path.join(app.getPath('downloads'), defaultName),
          filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
        });

        if (saveDialogResult.canceled || !saveDialogResult.filePath) {
          return {
            success: false,
            error: 'Save cancelled by user'
          };
        }

        const targetFilePath = saveDialogResult.filePath;

        // Create hidden off-screen BrowserWindow to render HTML to PDF
        printWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });

        // Load the HTML content
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`);

        // Generate vector PDF with high-quality print background
        const pdfBuffer = await printWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: {
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4
          }
        });

        await fs.writeFile(targetFilePath, pdfBuffer);

        return {
          success: true,
          data: { filePath: targetFilePath }
        };

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      } finally {
        if (printWindow) {
          printWindow.destroy();
          printWindow = null;
        }
      }
    }
  );
}
