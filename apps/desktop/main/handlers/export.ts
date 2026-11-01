/**
 * MigrateIQ - Phase 10 Completion & Export Studio IPC Handlers
 * 
 * Handles IPC channels for Phase 10:
 * - `export:erd-data`: Introspects or builds ERD tables, relationships & Mermaid syntax
 * - `export:erd-png`: Saves high-resolution rendered ERD PNG to user's storage
 * - `export:refactoring-kit`: Generates and exports the 4-file Refactoring Kit ZIP archive
 * - `export:audit-report`: Generates and exports executive vector PDF or HTML report
 * - `export:rollback-script`: Exports the migration rollback SQL script
 * - `export:layer2-guide`: Exports standalone Layer 2 markdown migration guide
 */

import { ipcMain, dialog, app } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  ConnectionConfig,
  CollectionMapping,
  RefactoringKitPayload,
  AuditReportPayload,
  ERDData
} from '@migrateiq/shared';
import { introspectPostgresERD, buildERDFromMappings } from '../engine/erdGenerator';
import { createRefactoringKitZip, generateLayer2MigrationGuide } from '../engine/refactoringKitGenerator';
import { exportAuditReportHtml, exportAuditReportPdf } from '../engine/auditReportGenerator';
import { maskSensitiveFields } from './risk';

export function setupExportHandlers(): void {
  // -------------------------------------------------------------
  // 1. Generate / Introspect ERD Data
  // -------------------------------------------------------------
  ipcMain.handle(
    'export:erd-data',
    async (
      _event,
      payload: {
        targetConfig?: ConnectionConfig;
        mappings?: CollectionMapping[];
        targetTables?: string[];
      }
    ): Promise<{ success: boolean; data?: ERDData; error?: string }> => {
      try {
        const { targetConfig, mappings = [], targetTables } = payload || {};

        if (targetConfig && targetConfig.database) {
          try {
            const erd = await introspectPostgresERD(targetConfig, targetTables);
            if (erd.tables.length > 0) {
              return { success: true, data: erd };
            }
          } catch (liveErr) {
            console.warn('[ERD Engine] Live introspection failed, falling back to schema mappings:', liveErr);
          }
        }

        // Fallback to mappings
        const fallbackErd = buildERDFromMappings(mappings);
        return { success: true, data: fallbackErd };
      } catch (err) {
        return {
          success: false,
          error: maskSensitiveFields((err as Error).message || 'Failed to generate ERD data')
        };
      }
    }
  );

  // -------------------------------------------------------------
  // 2. Export Rendered ERD as PNG
  // -------------------------------------------------------------
  ipcMain.handle(
    'export:erd-png',
    async (
      _event,
      payload: { pngBase64: string; defaultFilename?: string }
    ): Promise<{ success: boolean; data?: { filePath: string }; error?: string }> => {
      try {
        const { pngBase64, defaultFilename = `MigrateIQ-ERD-Diagram-${Date.now()}.png` } = payload;
        if (!pngBase64) {
          return { success: false, error: 'No image data provided for ERD export.' };
        }

        const saveRes = await dialog.showSaveDialog({
          title: 'Save Entity Relationship Diagram (PNG)',
          defaultPath: path.join(app.getPath('downloads'), defaultFilename),
          filters: [{ name: 'PNG Images', extensions: ['png'] }]
        });

        if (saveRes.canceled || !saveRes.filePath) {
          return { success: false, error: 'Export canceled by user.' };
        }

        const cleanBase64 = pngBase64.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        await fs.writeFile(saveRes.filePath, buffer);

        return {
          success: true,
          data: { filePath: saveRes.filePath }
        };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to export ERD PNG'
        };
      }
    }
  );

  // -------------------------------------------------------------
  // 3. Export Refactoring Kit (.zip)
  // -------------------------------------------------------------
  ipcMain.handle(
    'export:refactoring-kit',
    async (
      _event,
      payload: RefactoringKitPayload
    ): Promise<{ success: boolean; data?: { filePath: string; byteCount: number }; error?: string }> => {
      try {
        const defaultFilename = `MigrateIQ-Refactoring-Kit-${Date.now()}.zip`;
        const saveRes = await dialog.showSaveDialog({
          title: 'Save Developer Refactoring Kit (.zip)',
          defaultPath: path.join(app.getPath('downloads'), defaultFilename),
          filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
        });

        if (saveRes.canceled || !saveRes.filePath) {
          return { success: false, error: 'Export canceled by user.' };
        }

        const result = await createRefactoringKitZip(payload, saveRes.filePath);
        if (!result.success) {
          return { success: false, error: result.error };
        }

        return {
          success: true,
          data: { filePath: result.filePath, byteCount: result.byteCount }
        };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to generate Refactoring Kit ZIP'
        };
      }
    }
  );

  // -------------------------------------------------------------
  // 4. Export Executive Audit Report (PDF / HTML)
  // -------------------------------------------------------------
  ipcMain.handle(
    'export:audit-report',
    async (
      _event,
      payload: AuditReportPayload
    ): Promise<{ success: boolean; data?: { filePath: string }; error?: string }> => {
      try {
        const isPdf = payload.format === 'pdf';
        const ext = isPdf ? 'pdf' : 'html';
        const defaultFilename = `MigrateIQ-Audit-Report-${Date.now()}.${ext}`;

        const saveRes = await dialog.showSaveDialog({
          title: `Save Executive Migration Audit Report (${ext.toUpperCase()})`,
          defaultPath: path.join(app.getPath('downloads'), defaultFilename),
          filters: [
            isPdf
              ? { name: 'PDF Documents', extensions: ['pdf'] }
              : { name: 'HTML Web Pages', extensions: ['html'] }
          ]
        });

        if (saveRes.canceled || !saveRes.filePath) {
          return { success: false, error: 'Export canceled by user.' };
        }

        const res = isPdf
          ? await exportAuditReportPdf(payload, saveRes.filePath)
          : await exportAuditReportHtml(payload, saveRes.filePath);

        if (!res.success) {
          return { success: false, error: res.error };
        }

        return {
          success: true,
          data: { filePath: res.filePath }
        };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to export audit report'
        };
      }
    }
  );

  // -------------------------------------------------------------
  // 5. Download Rollback Script (.sql)
  // -------------------------------------------------------------
  ipcMain.handle(
    'export:rollback-script',
    async (
      _event,
      payload?: { defaultFilename?: string; fallbackSql?: string }
    ): Promise<{ success: boolean; data?: { filePath: string }; error?: string }> => {
      try {
        const defaultName = payload?.defaultFilename || `MigrateIQ-Rollback-${Date.now()}.sql`;
        const saveRes = await dialog.showSaveDialog({
          title: 'Save Migration Rollback Script (SQL)',
          defaultPath: path.join(app.getPath('downloads'), defaultName),
          filters: [{ name: 'SQL Scripts', extensions: ['sql'] }]
        });

        if (saveRes.canceled || !saveRes.filePath) {
          return { success: false, error: 'Export canceled by user.' };
        }

        let sqlContent = payload?.fallbackSql || '';

        // Try reading the latest real rollback script generated during live migration
        try {
          const rollbackDir = path.join(app.getPath('userData'), 'rollback-scripts');
          const files = await fs.readdir(rollbackDir);
          const rollbackFiles = files
            .filter(f => f.startsWith('rollback-') && f.endsWith('.sql'))
            .sort()
            .reverse();

          if (rollbackFiles.length > 0) {
            const latestScriptPath = path.join(rollbackDir, rollbackFiles[0]);
            sqlContent = await fs.readFile(latestScriptPath, 'utf-8');
          }
        } catch {
          // If directory doesn't exist, use fallback
        }

        if (!sqlContent) {
          sqlContent = `-- MigrateIQ Generated Rollback Script\n-- Notice: No custom statements recorded.\n`;
        }

        await fs.writeFile(saveRes.filePath, sqlContent, 'utf-8');
        return {
          success: true,
          data: { filePath: saveRes.filePath }
        };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to export rollback script'
        };
      }
    }
  );

  // -------------------------------------------------------------
  // 6. Download Standalone Layer 2 Migration Guide (.md)
  // -------------------------------------------------------------
  ipcMain.handle(
    'export:layer2-guide',
    async (
      _event,
      payload?: { direction?: string; defaultFilename?: string }
    ): Promise<{ success: boolean; data?: { filePath: string }; error?: string }> => {
      try {
        const defaultName = payload?.defaultFilename || `MigrateIQ-Layer2-Guide-${Date.now()}.md`;
        const saveRes = await dialog.showSaveDialog({
          title: 'Save Layer 2 Application Logic Migration Guide (Markdown)',
          defaultPath: path.join(app.getPath('downloads'), defaultName),
          filters: [{ name: 'Markdown Documents', extensions: ['md'] }]
        });

        if (saveRes.canceled || !saveRes.filePath) {
          return { success: false, error: 'Export canceled by user.' };
        }

        const mdContent = generateLayer2MigrationGuide(payload?.direction);
        await fs.writeFile(saveRes.filePath, mdContent, 'utf-8');

        return {
          success: true,
          data: { filePath: saveRes.filePath }
        };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to export Layer 2 guide'
        };
      }
    }
  );
}

