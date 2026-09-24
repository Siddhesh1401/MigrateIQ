/**
 * MigrateIQ - Live Migration Progress Screen (Phase 9 - Step 7)
 * 
 * Real-time migration monitoring UI with live progress bars, ETA calculation,
 * log viewer, and cancel functionality.
 * 
 * Features:
 * - Overall progress bar (tables completed)
 * - Per-table progress bar with row count
 * - Real-time ETA and rows/sec display
 * - Scrollable log viewer with color-coded levels
 * - Cancel button with graceful shutdown
 * - Completion summary with rollback option
 * 
 * Theme: Strictly Light Theme (#F8FAFC canvas, #FFFFFF cards, #2563EB primary)
 */

import React, { useState, useEffect, useRef } from 'react';
import type {
  MigrationProgressEvent,
  MigrationLogEntry,
  MigrationResult
} from '@migrateiq/shared';
import { useWizardStore } from '../store/wizardStore';
import { generate1To1Markdown, generateExecutiveHtml } from '../utils/reportGenerator';
import '../styles/migration-progress.css';

interface MigrationProgressScreenProps {
  onBack: () => void;
  onComplete: () => void;
}

const MigrationProgressScreen: React.FC<MigrationProgressScreenProps> = ({
  onBack,
  onComplete
}) => {
  const wizardStore = useWizardStore();
  const { 
    sourceConfig, 
    targetConfig, 
    schemaMapping, 
    migrationResult,
    migrationLogs,
    setMigrationResult, 
    setMigrationLogs, 
    appendMigrationLog 
  } = wizardStore;

  const [status, setStatus] = useState<'idle' | 'confirming' | 'running' | 'completed' | 'error' | 'cancelled'>(
    migrationResult ? 'completed' : 'idle'
  );
  const [progress, setProgress] = useState<MigrationProgressEvent | null>(null);
  const [logs, setLogs] = useState<MigrationLogEntry[]>(migrationLogs || []);
  const [result, setResult] = useState<MigrationResult | null>(migrationResult);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRollback, setShowRollback] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [localToast, setLocalToast] = useState<string | null>(null);

  const showLocalToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => setLocalToast(null), 3800);
  };

  const handleCopyReport = async () => {
    try {
      const stateSnapshot = wizardStore.getState();
      const md = generate1To1Markdown(stateSnapshot);
      await navigator.clipboard.writeText(md);
      if (window.electronAPI) {
        window.electronAPI.invoke('diagnostics:save-snapshot', {
          markdown: md,
          json: stateSnapshot,
          step: 7,
        }).catch(() => {});
      }
      showLocalToast('✅ Copied 1:1 Report to Clipboard!');
    } catch (err) {
      showLocalToast('❌ Copy error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDownloadPdfReport = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    showLocalToast('⏳ Generating Executive PDF Audit Report...');
    try {
      const stateSnapshot = wizardStore.getState();
      const html = generateExecutiveHtml(stateSnapshot);
      const res = await window.electronAPI.invoke<{ filePath: string }>('diagnostics:export-pdf', {
        html,
        defaultFilename: `MigrateIQ-Audit-Report-${wizardStore.direction || 'migration'}-${Date.now()}.pdf`,
      });
      if (res.success && res.data?.filePath) {
        showLocalToast('📄 PDF Audit Report saved successfully!');
      } else if (res.error && res.error !== 'Save cancelled by user') {
        showLocalToast('❌ PDF Export failed: ' + res.error);
      }
    } catch (err) {
      showLocalToast('❌ PDF Export error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const logContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  // Keep ref in sync with state (for use inside IPC callbacks)
  useEffect(() => { autoScrollRef.current = autoScroll; }, [autoScroll]);

  // Listen to IPC progress events
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const unsubProgress = window.electronAPI.on('migration:progress', (_event: unknown, ...args: unknown[]) => {
      const progressPayload = args[0] as MigrationProgressEvent;
      setProgress(progressPayload);

      if (progressPayload.type === 'complete') {
        setStatus('completed');
      } else if (progressPayload.type === 'error') {
        setStatus('error');
        setErrorMessage(progressPayload.error || 'Unknown error');
      } else if (progressPayload.type === 'cancel') {
        setStatus('cancelled');
      }
    });

    const unsubLog = window.electronAPI.on('migration:log', (_event: unknown, ...args: unknown[]) => {
      const logPayload = args[0] as MigrationLogEntry;
      setLogs(prev => [...prev, logPayload]);
      appendMigrationLog(logPayload);
    });

    return () => {
      if (typeof unsubProgress === 'function') unsubProgress();
      if (typeof unsubLog === 'function') unsubLog();
    };
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleConfirmStart = (): void => {
    setStatus('confirming');
  };

  const handleStartMigration = async () => {
    if (!sourceConfig || !targetConfig || !schemaMapping) {
      setErrorMessage('Missing configuration. Please complete all previous steps.');
      setStatus('error');
      return;
    }

    setStatus('running');
    setProgress(null);
    setLogs([]);
    setMigrationLogs([]);
    setErrorMessage(null);
    setResult(null);
    setMigrationResult(null);

    const wizardContent = document.querySelector('.wizard-content');
    if (wizardContent) {
      wizardContent.scrollTo({ top: 0, behavior: 'instant' });
    }

    try {
      const response = await window.electronAPI.invoke<MigrationResult>('migration:start', {
        sourceConfig,
        targetConfig,
        mappings: schemaMapping,
        batchSize: 500
      });

      if (response.success && response.data) {
        setResult(response.data);
        setMigrationResult(response.data);
        setStatus('completed');
      } else {
        setErrorMessage(response.error || 'Migration failed');
        setStatus('error');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMessage(msg);
      setStatus('error');
    }
  };

  const handleCancelConfirm = (): void => {
    setStatus('idle');
  };

  const handleCancelMigration = async () => {
    try {
      await window.electronAPI.invoke('migration:cancel', {});
      setStatus('cancelled');
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  };

  const handleViewRollback = () => {
    setShowRollback(true);
  };

  const handleExecuteRollback = async () => {
    if (!result?.rollbackScript || !targetConfig) return;

    const confirmed = confirm(
      `⚠️ WARNING: This will DELETE all migrated data!\n\n` +
      `Tables affected: ${result.tableResults.map(t => t.tableName).join(', ')}\n` +
      `Rows to delete: ${result.migratedRows}\n\n` +
      `This action cannot be undone. Continue?`
    );

    if (!confirmed) return;

    try {
      const response = await window.electronAPI.invoke<{ rowsDeleted: number }>('migration:execute-rollback', {
        targetConfig,
        script: result.rollbackScript
      });

      if (response.success) {
        alert(`✅ Rollback completed. Deleted ${response.data?.rowsDeleted || 0} rows.`);
        setShowRollback(false);
      } else {
        alert(`❌ Rollback failed: ${response.error}`);
      }
    } catch (error) {
      alert(`❌ Rollback error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const formatETA = (ms: number | undefined): string => {
    if (!ms || !isFinite(ms) || ms < 0) return 'Calculating...';
    
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatRowsPerSec = (rps: number | undefined): string => {
    if (!rps || !isFinite(rps)) return '0';
    return Math.round(rps).toLocaleString();
  };

  // ============================================
  // Render: Idle State (Start Button)
  // ============================================
  if (status === 'idle') {
    return (
      <div className="migration-progress-container">
        <div className="migration-header-area">
          <div className="migration-header-title-group">
            <h1>Step 7: Live Migration</h1>
            <p className="migration-header-subtitle">
              Ready to migrate data from MongoDB to PostgreSQL
            </p>
          </div>
        </div>

        <div className="migration-ready-card">
          <div className="migration-ready-icon">🚀</div>
          <div className="migration-ready-content">
            <h2>Ready to Start Migration</h2>
            <p>
              This will execute the live migration for {schemaMapping?.length || 0} collection(s).
              The process streams data in batches, isolates errors, and generates rollback scripts.
            </p>
            <div className="migration-ready-stats">
              <div className="migration-ready-stat">
                <span className="migration-ready-stat-label">Collections</span>
                <span className="migration-ready-stat-value">{schemaMapping?.length || 0}</span>
              </div>
              <div className="migration-ready-stat">
                <span className="migration-ready-stat-label">Batch Size</span>
                <span className="migration-ready-stat-value">500 rows</span>
              </div>
              <div className="migration-ready-stat">
                <span className="migration-ready-stat-label">Error Handling</span>
                <span className="migration-ready-stat-value">Isolated</span>
              </div>
            </div>
          </div>
        </div>

        <div className="migration-actions">
          <button className="btn-secondary" onClick={onBack}>
            ← Back
          </button>
          <button className="btn-primary" onClick={handleConfirmStart}>
            Start Migration →
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Confirmation Modal
  // ============================================
  if (status === 'confirming') {
    return (
      <div className="migration-progress-container">
        <div className="migration-modal-overlay">
          <div className="migration-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="migration-confirm-title">
            <div className="migration-confirm-modal-header">
              <span className="migration-confirm-modal-icon">⚠️</span>
              <h2 id="migration-confirm-title">You are about to run the actual migration.</h2>
            </div>

            <div className="migration-confirm-modal-body">
              <p>
                This will <strong>create tables and insert data</strong> into your PostgreSQL database.
                Make sure you have a backup of your existing data before continuing.
              </p>

              <div className="migration-confirm-snapshot-warning">
                <div className="migration-confirm-snapshot-title">⚠️ IMPORTANT: This is a snapshot migration.</div>
                <p>New data written to MongoDB <strong>AFTER you click "Start"</strong> will NOT be included.</p>
                <p>Recommendation: Put your application in <strong>maintenance mode</strong> (stop new writes) before running for best accuracy.</p>
              </div>
            </div>

            <div className="migration-confirm-modal-actions">
              <button
                id="migration-confirm-cancel-btn"
                className="btn-secondary"
                onClick={handleCancelConfirm}
              >
                Cancel
              </button>
              <button
                id="migration-confirm-start-btn"
                className="btn-danger"
                onClick={handleStartMigration}
              >
                Yes, Start Migration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Running State (Progress Bars)
  // ============================================
  if (status === 'running') {
    const overallProgress = progress?.completedTables && progress?.totalTables
      ? Math.round((progress.completedTables / progress.totalTables) * 100)
      : 0;

    const currentTableProgress = progress?.currentTableProgress || 0;

    return (
      <div className="migration-progress-container">
        <div className="migration-header-area">
          <div className="migration-header-title-group">
            <h1>Migration in Progress</h1>
            <p className="migration-header-subtitle">
              Migrating data from MongoDB to PostgreSQL...
            </p>
          </div>
          <div className="migration-header-badges">
            <div className="migration-badge running">
              <span className="migration-badge-icon">⚡</span>
              Running
            </div>
            <div className="migration-badge stats">
              {formatRowsPerSec(progress?.rowsPerSecond)} rows/sec
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="migration-progress-card">
          <div className="migration-progress-header">
            <h3>Overall Progress</h3>
            <span className="migration-progress-percentage">{overallProgress}%</span>
          </div>
          <div className="migration-progress-bar-container">
            <div className="migration-progress-bar" style={{ width: `${overallProgress}%` }} />
          </div>
          <div className="migration-progress-info">
            <span>{progress?.completedTables || 0} / {progress?.totalTables || 0} tables</span>
            <span>ETA: {formatETA(progress?.estimatedTimeRemainingMs)}</span>
          </div>
        </div>

        {/* Current Table Progress */}
        {progress?.currentTable && (
          <div className="migration-progress-card">
            <div className="migration-progress-header">
              <h3>Current Table: {progress.currentTable}</h3>
              <span className="migration-progress-percentage">{currentTableProgress}%</span>
            </div>
            <div className="migration-progress-bar-container">
              <div className="migration-progress-bar secondary" style={{ width: `${currentTableProgress}%` }} />
            </div>
            <div className="migration-progress-info">
              <span>
                {progress.currentTableRowsCompleted?.toLocaleString() || 0} / {progress.currentTableRows?.toLocaleString() || 0} rows
              </span>
              {progress.currentBatch && (
                <span>Batch {progress.currentBatch}</span>
              )}
            </div>
          </div>
        )}

        {/* Log Viewer */}
        <div className="migration-log-card">
          <div className="migration-log-header">
            <h3>Migration Log</h3>
            <label className="migration-log-autoscroll">
              <input
                type="checkbox"
                id="migration-autoscroll-toggle"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
          </div>
          <div className="migration-log-container" ref={logContainerRef}>
            {logs.length === 0 && (
              <div className="migration-log-empty">Waiting for logs...</div>
            )}
            {logs.map((log, index) => (
              <div key={index} className={`migration-log-entry migration-log-${log.level}`}>
                <span className="migration-log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                {log.table && <span className="migration-log-table">[{log.table}]</span>}
                <span className="migration-log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cancel Button */}
        <div className="migration-actions">
          <button className="btn-danger" onClick={handleCancelMigration}>
            Cancel Migration
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Completed State (Summary)
  // ============================================
  if (status === 'completed') {
    return (
      <div className="migration-progress-container">
        {localToast && (
          <div className="wizard-toast-banner">
            {localToast}
          </div>
        )}
        <div className="migration-header-area">
          <div className="migration-header-title-group">
            <h1>✅ Migration Complete</h1>
            <p className="migration-header-subtitle">
              Data migration completed successfully
            </p>
          </div>
        </div>

        <div className="migration-summary-card success">
          <div className="migration-summary-icon">🎉</div>
          <div className="migration-summary-content">
            <h2>Migration Successful!</h2>
            <p>
              {(result?.migratedRows ?? progress?.migratedRows ?? 0).toLocaleString()} rows migrated across {result?.completedTables ?? progress?.completedTables ?? 0} tables
              in {result?.duration ? Math.round(result.duration / 1000) : (progress?.duration ? Math.round(progress.duration / 1000) : 0)} seconds.
            </p>
            <div className="migration-summary-stats">
              <div className="migration-summary-stat">
                <span className="migration-summary-stat-label">Tables</span>
                <span className="migration-summary-stat-value">{result?.completedTables ?? progress?.completedTables ?? 0}</span>
              </div>
              <div className="migration-summary-stat">
                <span className="migration-summary-stat-label">Rows Migrated</span>
                <span className="migration-summary-stat-value">{(result?.migratedRows ?? progress?.migratedRows ?? 0).toLocaleString()}</span>
              </div>
              <div className="migration-summary-stat">
                <span className="migration-summary-stat-label">Skipped</span>
                <span className="migration-summary-stat-value">{result?.skippedRows ?? 0}</span>
              </div>
              <div className="migration-summary-stat">
                <span className="migration-summary-stat-label">Duration</span>
                <span className="migration-summary-stat-value">
                  {result?.duration ? Math.round(result.duration / 1000) : (progress?.duration ? Math.round(progress.duration / 1000) : 0)}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rollback Option */}
        {result?.rollbackScript && !showRollback && (
          <div className="migration-rollback-card">
            <div className="migration-rollback-icon">🔄</div>
            <div className="migration-rollback-content">
              <h3>Rollback Available</h3>
              <p>A rollback script has been generated in case you need to undo this migration.</p>
              <button className="btn-secondary" onClick={handleViewRollback}>
                View Rollback Script
              </button>
            </div>
          </div>
        )}

        {/* Rollback Script Viewer */}
        {showRollback && result?.rollbackScript && (
          <div className="migration-rollback-viewer">
            <div className="migration-rollback-viewer-header">
              <h3>Rollback Script</h3>
              <button className="btn-text" onClick={() => setShowRollback(false)}>
                Close
              </button>
            </div>
            <pre className="migration-rollback-script">{result.rollbackScript}</pre>
            <div className="migration-rollback-actions">
              <button className="btn-danger" onClick={handleExecuteRollback}>
                ⚠️ Execute Rollback (Delete Data)
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="migration-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={onBack}>
              ← Back to Wizard
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => setStatus('confirming')}
              title="Re-run the live migration again"
            >
              🔄 Re-run Migration
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', fontSize: '0.8125rem' }}
              onClick={handleCopyReport}
            >
              📋 Copy 1:1 Report
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#2563EB', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', fontSize: '0.8125rem' }}
              onClick={handleDownloadPdfReport}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? '⏳ Generating...' : '📄 Download Executive PDF'}
            </button>
          </div>

          <button className="btn-primary" onClick={onComplete}>
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Error/Cancelled State
  // ============================================
  return (
    <div className="migration-progress-container">
      <div className="migration-header-area">
        <div className="migration-header-title-group">
          <h1>{status === 'cancelled' ? '⚠️ Migration Cancelled' : '❌ Migration Failed'}</h1>
          <p className="migration-header-subtitle">
            {status === 'cancelled' 
              ? 'Migration was cancelled by user'
              : 'An error occurred during migration'
            }
          </p>
        </div>
      </div>

      <div className={`migration-summary-card ${status === 'cancelled' ? 'warning' : 'error'}`}>
        <div className="migration-summary-icon">{status === 'cancelled' ? '⚠️' : '❌'}</div>
        <div className="migration-summary-content">
          <h2>{status === 'cancelled' ? 'Migration Cancelled' : 'Migration Failed'}</h2>
          <p>
            {status === 'cancelled'
              ? 'The migration was cancelled after processing some data. Use the rollback script to undo changes.'
              : errorMessage || 'An unknown error occurred during migration.'
            }
          </p>
        </div>
      </div>

      {/* Log Viewer */}
      {logs.length > 0 && (
        <div className="migration-log-card">
          <div className="migration-log-header">
            <h3>Migration Log</h3>
          </div>
          <div className="migration-log-container" ref={logContainerRef}>
            {logs.map((log, index) => (
              <div key={index} className={`migration-log-entry migration-log-${log.level}`}>
                <span className="migration-log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                {log.table && <span className="migration-log-table">[{log.table}]</span>}
                <span className="migration-log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="migration-actions">
        <button className="btn-secondary" onClick={onBack}>
          ← Back to Wizard
        </button>
        <button className="btn-primary" onClick={() => {
          // Clear logs when retrying so old run logs don't persist
          setLogs([]);
          setProgress(null);
          setErrorMessage(null);
          setStatus('idle');
        }}>
          Try Again
        </button>
      </div>
    </div>
  );
};

export default MigrationProgressScreen;
