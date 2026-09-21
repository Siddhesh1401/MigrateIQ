import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MigrationHistoryItem, WizardStateSnapshot } from '@migrateiq/shared';
import { useWizardStore } from '../store/wizardStore';
import '../styles/dashboard.css';

export interface HomeDashboardProps {}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  const navigate    = useNavigate();
  const wizardStore = useWizardStore();
  const [migrations, setMigrations] = useState<MigrationHistoryItem[]>([]);
  const [inProgressState, setInProgressState] = useState<WizardStateSnapshot | null>(null);
  const [resumeDismissed, setResumeDismissed]  = useState(false);
  const [selectedReport, setSelectedReport]   = useState<MigrationHistoryItem | null>(null);
  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 1. Check for unfinished migration in progress
    window.electronAPI
      .invoke<WizardStateSnapshot | null>('store:get-wizard-state')
      .then((response) => {
        if (response.success && response.data && response.data.status === 'in-progress') {
          setInProgressState(response.data);
        }
      })
      .catch(() => {});

    // 2. Load recent migration history from electron-store
    window.electronAPI
      .invoke<MigrationHistoryItem[]>('store:get-migration-history')
      .then((response) => {
        if (response.success && Array.isArray(response.data)) {
          setMigrations(response.data);
        }
      })
      .catch(() => {});
  }, []);

  // Handle Escape key and focus management for report modal
  useEffect(() => {
    if (!selectedReport) return;

    modalCardRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedReport(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      lastActiveElementRef.current?.focus();
    };
  }, [selectedReport]);

  const showResumeBanner = !resumeDismissed && inProgressState !== null;

  const handleResume = (): void => {
    if (inProgressState?.direction) {
      wizardStore.setDirection(inProgressState.direction);
      if (inProgressState.sourceConfig) {
        wizardStore.setSourceConfig(inProgressState.sourceConfig);
      }
      if (inProgressState.targetConfig) {
        wizardStore.setTargetConfig(inProgressState.targetConfig);
      }
      // If paused past connection phase (Step > 2), schemaMapping is in-memory only.
      // Reset step to 1 so the user can verify connections and introspect schemas cleanly.
      const isPastConnection = (inProgressState.wizardStep ?? 1) > 2;
      const targetStep = isPastConnection ? 1 : (inProgressState.wizardStep || 1);
      wizardStore.setWizardStep(targetStep);
      navigate('/migrate', {
        state: isPastConnection
          ? { resumeNotice: 'Your connection settings were saved. Please reconnect to regenerate your schema mapping.' }
          : undefined,
      });
      return;
    }
    navigate('/migrate');
  };

  const handleDismissResume = async (): Promise<void> => {
    setResumeDismissed(true);
    setInProgressState(null);
    wizardStore.reset();
    await window.electronAPI.invoke('store:clear-wizard-state').catch(() => {});
  };

  const handleStartNewMigration = (): void => {
    wizardStore.reset();
    wizardStore.setIsDemoMode(false);
    navigate('/migrate');
  };

  const handleStartSchemaUpdate = (): void => {
    navigate('/schema-update');
  };

  const handleLaunchDemo = (): void => {
    wizardStore.reset();
    wizardStore.setIsDemoMode(true);
    wizardStore.setDirection('mongodb-to-postgres');
    navigate('/migrate', { state: { demoMode: true } });
  };

  const getStatusBadge = (status: MigrationHistoryItem['status']) => {
    switch (status) {
      case 'completed': return { icon: '✓', label: 'Completed',             className: 'completed' };
      case 'warning':   return { icon: '!', label: 'Completed w/ warnings', className: 'warning'   };
      case 'failed':    return { icon: '✕', label: 'Failed',                className: 'failed'    };
      default:          return { icon: '?', label: 'Unknown',               className: 'failed'    };
    }
  };

  const directionLabel = inProgressState?.direction === 'mongodb-to-postgres'
    ? 'MongoDB → PostgreSQL'
    : inProgressState?.direction === 'postgres-to-mongo'
    ? 'PostgreSQL → MongoDB'
    : '';

  return (
    <div className="dashboard-container">

      {/* ── Resume Banner ── */}
      {showResumeBanner && (
        <div className="resume-banner" role="alert">
          <div className="resume-content">
            <div className="resume-icon">📋</div>
            <div>
              <strong>Unfinished migration detected</strong>
              {directionLabel && (
                <span style={{ display: 'block', marginTop: '0.125rem', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 400 }}>
                  {directionLabel} — paused at Step {inProgressState?.wizardStep ?? 1} of 8
                </span>
              )}
            </div>
          </div>
          <div className="resume-actions">
            <button className="resume-discard-btn" onClick={handleDismissResume} title="Discard this migration and clear temporary state">
              Discard ×
            </button>
            <button className="resume-button" onClick={handleResume}>
              Resume →
            </button>
          </div>
        </div>
      )}

      {/* ── Welcome Section ── */}
      <section className="welcome-section">
        <div className="welcome-kicker">
          <span>⚡</span>
          AI-Powered
        </div>
        <h1 className="welcome-heading">Welcome to MigrateIQ</h1>
        <p className="welcome-subtitle">
          Migrate databases, evolve schemas, and analyse migration risks — all in one place.
        </p>

        <div className="cards-grid">
          {/* Card A — Migrate My Database */}
          <div
            id="card-migrate"
            className="entry-card"
            onClick={handleStartNewMigration}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStartNewMigration(); } }}
            role="button"
            tabIndex={0}
            aria-label="Start Migration: Migrate My Database"
          >
            <div className="card-icon" aria-hidden="true">🔄</div>
            <h2 className="card-title">Migrate My Database</h2>
            <p className="card-description">
              Move all data from MongoDB to PostgreSQL or PostgreSQL to MongoDB with AI-powered schema mapping.
            </p>
            <span className="card-button" aria-hidden="true">
              Start Migration →
            </span>
          </div>

          {/* Card B — Update My Database */}
          <div
            id="card-schema-update"
            className="entry-card"
            onClick={handleStartSchemaUpdate}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStartSchemaUpdate(); } }}
            role="button"
            tabIndex={0}
            aria-label="Start Schema Update: Update My Database"
          >
            <div className="card-icon" aria-hidden="true">✏️</div>
            <h2 className="card-title">Update My Database</h2>
            <p className="card-description">
              Safely add, remove, or rename columns, indexes, and constraints in your existing database.
            </p>
            <span className="card-button" aria-hidden="true">
              Start Schema Update →
            </span>
          </div>

          {/* Card C — Demo Mode */}
          <div
            id="card-demo"
            className="entry-card demo"
            onClick={handleLaunchDemo}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLaunchDemo(); } }}
            role="button"
            tabIndex={0}
            aria-label="Try with Sample Data in Demo Mode"
          >
            <div className="card-icon" aria-hidden="true">🎮</div>
            <h2 className="card-title">Try with Sample Data</h2>
            <p className="card-description">
              No database? No problem. Try a full migration instantly using our built-in e-commerce sample dataset.
            </p>
            <span className="card-button" aria-hidden="true">
              Launch Demo →
            </span>
            <div className="demo-badge">⚡ No setup required</div>
          </div>
        </div>
      </section>

      {/* ── Recent Migrations Section ── */}
      <section className="recent-section" aria-labelledby="recent-migrations-heading">
        <div className="section-heading-row">
          <h2 id="recent-migrations-heading" className="section-heading">Recent Migrations</h2>
          {migrations.length > 0 && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {migrations.length} total
            </span>
          )}
        </div>

        <div className="migrations-table-container">
          {migrations.length > 0 ? (
            <table className="migrations-table" role="table">
              <thead>
                <tr className="table-header-row">
                  <th scope="col" className="table-header-cell">Date &amp; Time</th>
                  <th scope="col" className="table-header-cell">Direction</th>
                  <th scope="col" className="table-header-cell">Status</th>
                  <th scope="col" className="table-header-cell">Action</th>
                </tr>
              </thead>
              <tbody>
                {migrations.map((migration) => {
                  const badge = getStatusBadge(migration.status);
                  return (
                    <tr key={migration.id} className="table-row">
                      <td className="table-cell muted">{migration.dateTime}</td>
                      <td className="table-cell font-medium">{migration.direction}</td>
                      <td className="table-cell">
                        <span className={`status-badge ${badge.className}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </td>
                      <td className="table-cell">
                        <button
                          type="button"
                          className="view-report-btn"
                          onClick={(e) => {
                            lastActiveElementRef.current = e.currentTarget;
                            setSelectedReport(migration);
                          }}
                          title="View Migration Report Summary"
                        >
                          View Report →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon-wrap" aria-hidden="true">📭</div>
              <p className="empty-state-title">No migrations yet</p>
              <p className="empty-state-text">
                Start your first migration above to see your history here.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── View Report Placeholder Modal (Phase 3 Requirement) ── */}
      {selectedReport && (
        <div
          className="report-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          onClick={() => setSelectedReport(null)}
        >
          <div
            ref={modalCardRef}
            tabIndex={-1}
            className="report-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ outline: 'none' }}
          >
            <div className="report-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontSize: '1.25rem' }}>📋</span>
                <h3 id="report-modal-title" className="report-modal-title">
                  Migration Report Summary
                </h3>
              </div>
              <button
                type="button"
                className="report-modal-close"
                onClick={() => setSelectedReport(null)}
                aria-label="Close Report Modal"
              >
                ×
              </button>
            </div>

            <div className="report-modal-body">
              <div className="report-detail-row">
                <span className="report-detail-label">Execution Time:</span>
                <span className="report-detail-val">{selectedReport.dateTime}</span>
              </div>
              <div className="report-detail-row">
                <span className="report-detail-label">Direction:</span>
                <span className="report-detail-val font-semibold">{selectedReport.direction}</span>
              </div>
              <div className="report-detail-row">
                <span className="report-detail-label">Final Status:</span>
                <span className="report-detail-val">
                  <span className={`status-badge ${getStatusBadge(selectedReport.status).className}`}>
                    {getStatusBadge(selectedReport.status).icon} {getStatusBadge(selectedReport.status).label}
                  </span>
                </span>
              </div>
              {selectedReport.sourceDb && (
                <div className="report-detail-row">
                  <span className="report-detail-label">Source Database:</span>
                  <span className="report-detail-val monospace">{selectedReport.sourceDb}</span>
                </div>
              )}
              {selectedReport.targetDb && (
                <div className="report-detail-row">
                  <span className="report-detail-label">Target Database:</span>
                  <span className="report-detail-val monospace">{selectedReport.targetDb}</span>
                </div>
              )}
              {selectedReport.rowsMigrated !== undefined && (
                <div className="report-detail-row">
                  <span className="report-detail-label">Rows Transferred:</span>
                  <span className="report-detail-val font-semibold">{selectedReport.rowsMigrated.toLocaleString()} rows</span>
                </div>
              )}
              {selectedReport.duration && (
                <div className="report-detail-row">
                  <span className="report-detail-label">Duration:</span>
                  <span className="report-detail-val">{selectedReport.duration}</span>
                </div>
              )}

              <div className="report-modal-note">
                <p>
                  <strong>💡 Phase 10 Audit Documentation:</strong> Full downloadable executive PDF/HTML audit reports, checksum verifications, and ERD architecture diagrams are generated upon completion of Phase 10 (Live Migration Completion).
                </p>
              </div>
            </div>

            <div className="report-modal-footer">
              <button
                type="button"
                className="report-modal-btn"
                onClick={() => setSelectedReport(null)}
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
