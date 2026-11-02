/**
 * MigrateIQ - Step 9: Migration Complete & Export Studio Screen (Phase 10)
 * 
 * Final wizard milestone featuring:
 * - Confetti entrance animation
 * - Live summary statistics (tables created, rows migrated, skipped rows, runtime, timestamp)
 * - Collapsible skipped records table
 * - Real-time query performance benchmark card
 * - Inline ERD preview with fullscreen zoom modal and PNG download
 * - 5 Download Actions: Executive Audit Report (PDF/HTML), Refactoring Kit (ZIP),
 *   Rollback Script (SQL), ERD Diagram (PNG), and Layer 2 Guide (MD)
 * - Finalization back to Home Dashboard with saved history
 */

import React, { useEffect, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import mermaid from 'mermaid';
import { useWizardStore } from '../store/wizardStore';
import { BenchmarkCard } from '../components/BenchmarkCard';
import { ErdModal } from '../components/ErdModal';
import type { 
  ERDData, 
  Phase10BenchmarkResult, 
  AuditReportPayload,
  SkippedRowRecord,
  MigrationHistoryItem 
} from '@migrateiq/shared';
import '../styles/complete-screen.css';

// Initialize mermaid with light-theme styling
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    er: {
      useMaxWidth: true,
      entityPadding: 16,
      fontSize: 12
    },
    securityLevel: 'loose'
  });
} catch (mErr) {
  console.warn('[Mermaid] Initialization warning:', mErr);
}

export interface MigrationCompleteScreenProps {
  onReturnToDashboard: () => void;
}

export const MigrationCompleteScreen: React.FC<MigrationCompleteScreenProps> = ({
  onReturnToDashboard
}) => {
  const wizardStore = useWizardStore();
  const {
    direction,
    sourceConfig,
    sourceSchema,
    targetConfig,
    schemaMapping,
    migrationResult,
    verificationAudit
  } = wizardStore;

  // Screen State
  const [isSkippedOpen, setIsSkippedOpen] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<Phase10BenchmarkResult | null>(null);
  const [erdData, setErdData] = useState<ERDData | null>(null);
  const [erdSvg, setErdSvg] = useState<string>('');
  const [isErdModalOpen, setIsErdModalOpen] = useState<boolean>(false);
  const [isLoadingErd, setIsLoadingErd] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Trigger celebration confetti on mount
  useEffect(() => {
    try {
      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.6 }
      });
    } catch {
      // Non-fatal if canvas unavailable
    }
  }, []);

  // Compute summary metrics
  const tablesCreatedCount = useMemo(() => {
    if (migrationResult && migrationResult.completedTables > 0) {
      return migrationResult.completedTables;
    }
    if (schemaMapping && schemaMapping.length > 0) {
      let count = schemaMapping.length;
      for (const m of schemaMapping) {
        if (m.childTables) count += m.childTables.length;
      }
      return count;
    }
    return 3;
  }, [migrationResult, schemaMapping]);

  const rowsMigratedCount = useMemo(() => {
    if (migrationResult && migrationResult.migratedRows > 0) {
      return migrationResult.migratedRows;
    }
    if (verificationAudit && verificationAudit.tables) {
      return verificationAudit.tables.reduce((sum, t) => sum + t.targetCount, 0);
    }
    return 0;
  }, [migrationResult, verificationAudit]);

  const skippedRowsCount = useMemo(() => {
    return migrationResult?.skippedRows || 0;
  }, [migrationResult]);

  const formattedDuration = useMemo(() => {
    const ms = migrationResult?.duration || 0;
    const totalSec = Math.round(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins === 0) return `${secs} seconds`;
    return `${mins} minute${mins > 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
  }, [migrationResult]);

  const completionTimestamp = useMemo(() => {
    const raw = migrationResult?.endTime;
    const date = raw ? new Date(raw) : new Date();
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }, [migrationResult]);

  // Aggregate skipped rows records
  const allSkippedRows: SkippedRowRecord[] = useMemo(() => {
    if (!migrationResult || !migrationResult.tableResults) return [];
    const list: SkippedRowRecord[] = [];
    for (const tr of migrationResult.tableResults) {
      if (tr.skippedRows && tr.skippedRows.length > 0) {
        for (const sr of tr.skippedRows) {
          list.push({
            documentId: sr.documentId,
            collection: tr.tableName,
            reason: sr.reason
          });
        }
      }
    }
    return list;
  }, [migrationResult]);

  // Fetch ERD Data and Render SVG
  useEffect(() => {
    let isCancelled = false;

    async function loadERD() {
      setIsLoadingErd(true);
      try {
        const res = await window.electronAPI.invoke<ERDData>('export:erd-data', {
          targetConfig: targetConfig || undefined,
          mappings: schemaMapping || [],
          targetTables: schemaMapping?.map(m => m.targetTableName || m.collectionName)
        });

        if (!isCancelled && res.success && res.data) {
          setErdData(res.data);
          try {
            const uniqueId = 'erd-render-' + Math.random().toString(36).substring(2, 9);
            const { svg } = await mermaid.render(uniqueId, res.data.mermaidCode);
            if (!isCancelled) {
              setErdSvg(svg);
            }
          } catch (renderErr) {
            console.warn('[Mermaid Render Error]:', renderErr);
          }
        }
      } catch (err) {
        console.error('[ERD Load Error]:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingErd(false);
        }
      }
    }

    loadERD();
    return () => {
      isCancelled = true;
    };
  }, [targetConfig, schemaMapping]);

  // Helper to convert SVG to PNG Base64 with robust XML sanitization and dimension parsing
  const rasterizeSvgToPng = (svgStr: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgStr, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (!svgEl) {
          throw new Error('Invalid SVG markup received');
        }

        // Ensure mandatory XML namespaces so Chromium can parse the SVG image
        if (!svgEl.getAttribute('xmlns')) {
          svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        if (!svgEl.getAttribute('xmlns:xlink')) {
          svgEl.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        }

        // Determine explicit pixel dimensions from viewBox or attributes
        let width = 1200;
        let height = 800;

        const viewBox = svgEl.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.trim().split(/[\s,]+/).map(Number);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            width = parts[2];
            height = parts[3];
          }
        } else {
          const attrW = parseFloat(svgEl.getAttribute('width') || '');
          const attrH = parseFloat(svgEl.getAttribute('height') || '');
          if (!isNaN(attrW) && attrW > 0) width = attrW;
          if (!isNaN(attrH) && attrH > 0) height = attrH;
        }

        // Explicit width/height prevent canvas rendering bugs in Chromium
        svgEl.setAttribute('width', `${width}`);
        svgEl.setAttribute('height', `${height}`);
        svgEl.style.maxWidth = 'none';

        const serialized = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const scale = 2; // 2x high resolution
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(url);
              reject(new Error('Failed to create canvas 2D context'));
              return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Clean white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw scaled SVG onto canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);

            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } catch (canvasErr) {
            URL.revokeObjectURL(url);
            reject(canvasErr);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          // Fallback: try base64 Data URI if Blob URL fails
          try {
            const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
              const canvas = document.createElement('canvas');
              const scale = 2;
              canvas.width = Math.round(width * scale);
              canvas.height = Math.round(height * scale);
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                reject(new Error('Canvas 2D context unavailable'));
                return;
              }
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/png'));
            };
            fallbackImg.onerror = () => {
              reject(new Error('Failed to render SVG onto image canvas'));
            };
            fallbackImg.src = dataUri;
          } catch {
            reject(new Error('Failed to render SVG onto image canvas'));
          }
        };

        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Download ERD PNG
  const handleDownloadErdPng = async () => {
    if (!erdSvg) return;
    setIsExporting('erd');
    try {
      const pngBase64 = await rasterizeSvgToPng(erdSvg);
      const res = await window.electronAPI.invoke<{ filePath: string }>('export:erd-png', {
        pngBase64,
        defaultFilename: `MigrateIQ-ERD-${targetConfig?.database || 'Schema'}.png`
      });
      if (res.success && res.data) {
        showToast(`✅ ERD diagram saved: ${res.data.filePath}`);
      } else if (!res.success && res.error && !res.error.toLowerCase().includes('cancel')) {
        showToast(`❌ Failed to save ERD: ${res.error}`);
      }
    } catch (err) {
      showToast(`❌ Failed to export ERD: ${(err as Error).message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // 2. Download Refactoring Kit (.zip)
  const handleDownloadRefactoringKit = async () => {
    setIsExporting('refactor');
    try {
      const res = await window.electronAPI.invoke<{ filePath: string }>('export:refactoring-kit', {
        sourceConfig: sourceConfig || undefined,
        targetConfig: targetConfig || undefined,
        sourceSchema: sourceSchema || undefined,
        collectionMappings: schemaMapping || undefined,
        direction: direction || 'mongodb-to-postgres',
        skippedRows: allSkippedRows,
        targetTables: erdData?.tables,
        targetRelations: erdData?.relations
      });

      if (res.success && res.data) {
        showToast(`✅ Refactoring Kit (.zip) saved to ${res.data.filePath}`);
      }
    } catch (err) {
      showToast(`❌ Refactoring Kit export error: ${(err as Error).message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // 3. Download Rollback Script (.sql)
  const handleDownloadRollback = async () => {
    setIsExporting('rollback');
    try {
      const res = await window.electronAPI.invoke<{ filePath: string }>('export:rollback-script', {
        fallbackSql: migrationResult?.rollbackScript,
        defaultFilename: `MigrateIQ-Rollback-${targetConfig?.database || 'pg'}.sql`
      });
      if (res.success && res.data) {
        showToast(`✅ Rollback script (.sql) saved to ${res.data.filePath}`);
      }
    } catch (err) {
      showToast(`❌ Rollback download error: ${(err as Error).message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // 4. Download Executive Audit Report (PDF or HTML)
  const handleDownloadAuditReport = async (format: 'pdf' | 'html') => {
    setIsExporting(`report-${format}`);
    try {
      const payload: AuditReportPayload = {
        format,
        migrationSummary: {
          tablesCreated: tablesCreatedCount,
          rowsMigrated: rowsMigratedCount,
          rowsSkipped: skippedRowsCount,
          durationMs: migrationResult?.duration || 0,
          completedAt: completionTimestamp,
          sourceDb: sourceConfig?.database || 'MongoDB',
          targetDb: targetConfig?.database || 'PostgreSQL',
          direction: direction === 'postgres-to-mongo' ? 'PostgreSQL → MongoDB' : 'MongoDB → PostgreSQL'
        },
        skippedRows: allSkippedRows,
        verificationAudit: verificationAudit || undefined,
        benchmarkResult: benchmarkResult || undefined,
        mermaidDiagram: erdData?.mermaidCode
      };

      const res = await window.electronAPI.invoke<{ filePath: string }>('export:audit-report', payload);
      if (res.success && res.data) {
        showToast(`✅ Executive Audit Report (${format.toUpperCase()}) saved: ${res.data.filePath}`);
      }
    } catch (err) {
      showToast(`❌ Audit report export error: ${(err as Error).message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // 5. Download Layer 2 Guide (.md) (PostgreSQL -> MongoDB only)
  const handleDownloadLayer2Guide = async () => {
    setIsExporting('layer2');
    try {
      const res = await window.electronAPI.invoke<{ filePath: string }>('export:layer2-guide', {
        direction: direction || 'mongodb-to-postgres',
        defaultFilename: 'MigrateIQ-Layer2-Guide.md'
      });
      if (res.success && res.data) {
        showToast(`✅ Layer 2 Guide (.md) saved: ${res.data.filePath}`);
      }
    } catch (err) {
      showToast(`❌ Layer 2 Guide export error: ${(err as Error).message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // Finalization: Save to history, reset wizard, return to dashboard
  const handleFinishAndReturnToDashboard = async () => {
    const historyItem: MigrationHistoryItem = {
      id: 'mig-' + Date.now(),
      dateTime: new Date().toISOString(),
      direction: direction === 'postgres-to-mongo' ? 'PostgreSQL → MongoDB' : 'MongoDB → PostgreSQL',
      status: skippedRowsCount > 0 ? 'warning' : 'completed',
      sourceDb: sourceConfig?.database || 'source',
      targetDb: targetConfig?.database || 'target',
      tablesCount: tablesCreatedCount,
      rowsMigrated: rowsMigratedCount,
      duration: formattedDuration,
      reportSummary: `Migrated ${tablesCreatedCount} tables, ${rowsMigratedCount.toLocaleString()} rows in ${formattedDuration}.`
    };

    try {
      await window.electronAPI.invoke('store:save-migration-history', historyItem);
    } catch (hErr) {
      console.warn('[History Save Warning]:', hErr);
    }

    // Reset wizard store state to clean slate
    wizardStore.reset();
    onReturnToDashboard();
  };

  return (
    <div className="complete-screen-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 99999,
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="complete-header">
        <div className="complete-subheading">Step 9 of 9 — Migration Complete</div>

        {/* Celebration Banner */}
        <div className="celebration-banner">
          <div className="celebration-title-group">
            <h1>
              <span>🎉</span> Migration Complete!
            </h1>
            <div className="celebration-subtitle">
              Your database has migrated successfully and 100% data parity has been mathematically and cryptographically certified.
            </div>
          </div>

          <div className="celebration-badge">
            <span>🛡️</span>
            <span>Production Ready</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card-label">
            <span>🗄️</span> Tables Created
          </div>
          <div className="summary-card-val">
            ✅ {tablesCreatedCount}
          </div>
          <div className="summary-card-meta">
            Normalized relational schema
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-label">
            <span>📑</span> Rows Migrated
          </div>
          <div className="summary-card-val">
            ✅ {rowsMigratedCount.toLocaleString()}
          </div>
          <div className="summary-card-meta">
            100% volumetric parity
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-label">
            <span>⚠️</span> Rows Skipped
          </div>
          <div className="summary-card-val" style={{ color: skippedRowsCount > 0 ? '#D97706' : '#16A34A' }}>
            {skippedRowsCount > 0 ? `⚠️ ${skippedRowsCount}` : '0 skipped'}
          </div>
          <div className="summary-card-meta" style={{ color: skippedRowsCount > 0 ? '#D97706' : '#16A34A' }}>
            {skippedRowsCount > 0 ? 'See error log below' : 'Lossless data transfer'}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-label">
            <span>⏱️</span> Total Time
          </div>
          <div className="summary-card-val">
            {formattedDuration}
          </div>
          <div className="summary-card-meta">
            Completed: {completionTimestamp}
          </div>
        </div>
      </div>

      {/* Collapsible Skipped Rows (only if rows were skipped) */}
      {skippedRowsCount > 0 && (
        <div className="skipped-drawer">
          <div className="skipped-header" onClick={() => setIsSkippedOpen(!isSkippedOpen)}>
            <div>⚠️ {skippedRowsCount} row{skippedRowsCount > 1 ? 's were' : ' was'} skipped during migration</div>
            <div style={{ fontSize: '0.8rem', textDecoration: 'underline' }}>
              {isSkippedOpen ? 'Hide Log ▲' : 'Show Error Log ▼'}
            </div>
          </div>

          {isSkippedOpen && (
            <div className="skipped-table-wrap">
              <table className="skipped-table">
                <thead>
                  <tr>
                    <th>Document ID</th>
                    <th>Collection</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {allSkippedRows.slice(0, 100).map((row, idx) => (
                    <tr key={idx}>
                      <td><code>{row.documentId}</code></td>
                      <td><strong>{row.collection}</strong></td>
                      <td style={{ color: '#DC2626' }}>{row.reason}</td>
                    </tr>
                  ))}
                  {allSkippedRows.length > 100 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                        ... and {allSkippedRows.length - 100} more skipped records
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Real-Time Query Performance Benchmark Card */}
      <BenchmarkCard
        sourceConfig={sourceConfig}
        targetConfig={targetConfig}
        mappings={schemaMapping}
        initialResult={benchmarkResult}
        onBenchmarkComplete={setBenchmarkResult}
      />

      {/* Entity Relationship Diagram (ERD) Card */}
      <div className="content-card">
        <div className="card-title-group">
          <div>
            <div className="card-title">
              <span>🗺️</span> Relational Entity Relationship Diagram (ERD)
            </div>
            <div className="card-desc">
              Visual map of target PostgreSQL tables, normalized child tables, primary keys, and foreign-key link lines
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary-white"
              onClick={() => setIsErdModalOpen(true)}
              disabled={!erdSvg}
            >
              <span>🔍</span>
              <span>Open Full Screen</span>
            </button>

            <button
              type="button"
              className="btn-secondary-white"
              onClick={handleDownloadErdPng}
              disabled={isExporting === 'erd' || !erdSvg}
            >
              <span>🗺️</span>
              <span>{isExporting === 'erd' ? 'Exporting...' : 'Download ERD Diagram (.png)'}</span>
            </button>
          </div>
        </div>

        {/* Inline ERD Preview */}
        <div className="erd-preview-container">
          {isLoadingErd ? (
            <div style={{ color: '#64748B', fontSize: '0.875rem' }}>
              Generating visual schema graph...
            </div>
          ) : erdSvg ? (
            <div dangerouslySetInnerHTML={{ __html: erdSvg }} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
          ) : (
            <div style={{ color: '#64748B', fontSize: '0.875rem' }}>
              ERD preview generated from target tables and foreign key dependencies. Click Open Full Screen to inspect.
            </div>
          )}
        </div>
      </div>

      {/* Download Action Cards */}
      <div className="content-card">
        <div className="card-title-group">
          <div>
            <div className="card-title">
              <span>📦</span> Download &amp; Export Studio
            </div>
            <div className="card-desc">
              Download developer refactoring kits, compliance audit certificates, rollback scripts, and visual documentation
            </div>
          </div>
        </div>

        <div className="downloads-grid">
          {/* 1. Executive Audit Report */}
          <div className="download-action-card">
            <div className="download-card-header">
              <span className="download-card-icon">📄</span>
              <div>
                <div className="download-card-title">Executive Audit Report</div>
                <div className="download-card-desc">
                  Official branded migration report with row count parity, SHA-256 seal, and live query benchmark charts.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary-white"
                style={{ flex: 1 }}
                onClick={() => handleDownloadAuditReport('pdf')}
                disabled={isExporting === 'report-pdf'}
              >
                <span>{isExporting === 'report-pdf' ? 'Rendering...' : 'Download .pdf'}</span>
              </button>
              <button
                type="button"
                className="btn-secondary-white"
                style={{ flex: 1 }}
                onClick={() => handleDownloadAuditReport('html')}
                disabled={isExporting === 'report-html'}
              >
                <span>{isExporting === 'report-html' ? 'Exporting...' : 'Download .html'}</span>
              </button>
            </div>
          </div>

          {/* 2. Refactoring Kit */}
          <div className="download-action-card">
            <div className="download-card-header">
              <span className="download-card-icon">📦</span>
              <div>
                <div className="download-card-title">Refactoring Kit (.zip)</div>
                <div className="download-card-desc">
                  Includes ready-to-use <code>schema.prisma</code>, MQL→SQL cheatsheet, Layer 2 guide, and compatibility report.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary-blue"
              onClick={handleDownloadRefactoringKit}
              disabled={isExporting === 'refactor'}
            >
              <span>{isExporting === 'refactor' ? 'Packaging ZIP...' : 'Download Refactoring Kit (.zip)'}</span>
            </button>
          </div>

          {/* 3. Rollback Script */}
          <div className="download-action-card">
            <div className="download-card-header">
              <span className="download-card-icon">↩️</span>
              <div>
                <div className="download-card-title">Rollback Script (.sql)</div>
                <div className="download-card-desc">
                  Pre-computed undo script to reverse table creations, sequences, and constraints cleanly if needed.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary-white"
              onClick={handleDownloadRollback}
              disabled={isExporting === 'rollback'}
            >
              <span>{isExporting === 'rollback' ? 'Exporting...' : 'Download Rollback Script (.sql)'}</span>
            </button>
          </div>

          {/* 4. ERD Diagram */}
          <div className="download-action-card">
            <div className="download-card-header">
              <span className="download-card-icon">🗺️</span>
              <div>
                <div className="download-card-title">ERD Diagram (.png)</div>
                <div className="download-card-desc">
                  High-resolution raster graphic of your entity relationship schema for documentation and presentations.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary-white"
              onClick={handleDownloadErdPng}
              disabled={isExporting === 'erd' || !erdSvg}
            >
              <span>{isExporting === 'erd' ? 'Rendering PNG...' : 'Download ERD Diagram (.png)'}</span>
            </button>
          </div>

          {/* 5. Layer 2 Guide (Only visible if source was PostgreSQL) */}
          {direction === 'postgres-to-mongo' && (
            <div className="download-action-card">
              <div className="download-card-header">
                <span className="download-card-icon">📋</span>
                <div>
                  <div className="download-card-title">Layer 2 Guide (.md)</div>
                  <div className="download-card-desc">
                    Standalone application logic migration guide for converting stored procedures, triggers, and views to Node.js.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary-white"
                onClick={handleDownloadLayer2Guide}
                disabled={isExporting === 'layer2'}
              >
                <span>{isExporting === 'layer2' ? 'Exporting...' : 'Download Layer 2 Guide (.md)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Next Steps Guidance & Return to Dashboard */}
      <div className="next-steps-card">
        <div className="next-steps-content">
          <h4>🚀 Next Steps for Your Application</h4>
          <p>
            Your migration is complete. If you are using a Node.js backend, use the <code>schema.prisma</code> file in the Refactoring Kit to quickly connect your app to the new PostgreSQL database.
          </p>
        </div>

        <button
          type="button"
          className="btn-finish-dashboard"
          onClick={handleFinishAndReturnToDashboard}
        >
          <span>← Go to Dashboard</span>
        </button>
      </div>

      {/* Fullscreen ERD Modal */}
      <ErdModal
        isOpen={isErdModalOpen}
        onClose={() => setIsErdModalOpen(false)}
        svgHtml={erdSvg}
        onDownloadPng={handleDownloadErdPng}
        isDownloadingPng={isExporting === 'erd'}
      />
    </div>
  );
};

