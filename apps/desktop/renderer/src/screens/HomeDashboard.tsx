import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConnectionConfig } from '@migrateiq/shared';
import { useWizardStore } from '../store/wizardStore';
import '../styles/dashboard.css';

export interface HomeDashboardProps {}

interface Migration {
  id: string;
  dateTime: string;
  direction: string;
  status: 'completed' | 'warning' | 'failed';
}

interface WizardStateSnapshot {
  direction: 'mongodb-to-postgres' | 'postgres-to-mongo' | null;
  wizardStep: number;
  sourceConfig: ConnectionConfig | null;
  targetConfig: ConnectionConfig | null;
  status: 'in-progress' | 'completed' | 'cancelled';
  savedAt: string;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  const navigate    = useNavigate();
  const wizardStore = useWizardStore();
  const [migrations] = useState<Migration[]>([]);
  const [inProgressState, setInProgressState] = useState<WizardStateSnapshot | null>(null);
  const [resumeDismissed, setResumeDismissed]  = useState(false);

  useEffect(() => {
    window.electronAPI
      .invoke<WizardStateSnapshot | null>('store:get-wizard-state')
      .then((response) => {
        if (response.success && response.data && response.data.status === 'in-progress') {
          setInProgressState(response.data);
        }
      })
      .catch(() => {});
  }, []);

  const showResumeBanner = !resumeDismissed && inProgressState !== null;

  const handleResume = () => {
    if (inProgressState?.direction) {
      wizardStore.setDirection(inProgressState.direction);
      if (inProgressState.sourceConfig) {
        wizardStore.setSourceConfig(inProgressState.sourceConfig);
      }
      if (inProgressState.targetConfig) {
        wizardStore.setTargetConfig(inProgressState.targetConfig);
      }
      wizardStore.setWizardStep(inProgressState.wizardStep);
    }
    navigate('/migrate');
  };

  const handleDismissResume = async () => {
    setResumeDismissed(true);
    await window.electronAPI.invoke('store:clear-wizard-state').catch(() => {});
  };

  const getStatusBadge = (status: string) => {
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
            <button className="resume-discard-btn" onClick={handleDismissResume} title="Discard this migration">
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
            onClick={() => navigate('/migrate')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/migrate'); } }}
            role="button"
            tabIndex={0}
            aria-label="Migrate My Database"
          >
            <div className="card-icon">🔄</div>
            <h2 className="card-title">Migrate My Database</h2>
            <p className="card-description">
              Move all data from MongoDB to PostgreSQL or PostgreSQL to MongoDB with AI-powered schema mapping.
            </p>
            <button
              id="btn-start-migration"
              className="card-button"
              onClick={(e) => { e.stopPropagation(); navigate('/migrate'); }}
            >
              Start Migration →
            </button>
          </div>

          {/* Card B — Update My Database */}
          <div
            id="card-schema-update"
            className="entry-card"
            onClick={() => navigate('/schema-update')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/schema-update'); } }}
            role="button"
            tabIndex={0}
            aria-label="Update My Database Schema"
          >
            <div className="card-icon">✏️</div>
            <h2 className="card-title">Update My Database</h2>
            <p className="card-description">
              Safely add, remove, or rename columns, indexes, and constraints in your existing database.
            </p>
            <button
              id="btn-start-schema-update"
              className="card-button"
              onClick={(e) => { e.stopPropagation(); navigate('/schema-update'); }}
            >
              Start Schema Update →
            </button>
          </div>

          {/* Card C — Demo Mode */}
          <div
            id="card-demo"
            className="entry-card demo"
            onClick={() => navigate('/migrate', { state: { demoMode: true } })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/migrate', { state: { demoMode: true } }); } }}
            role="button"
            tabIndex={0}
            aria-label="Try with Sample Data in Demo Mode"
          >
            <div className="card-icon">🎮</div>
            <h2 className="card-title">Try with Sample Data</h2>
            <p className="card-description">
              No database? No problem. Try a full migration instantly using our built-in e-commerce sample dataset.
            </p>
            <button
              id="btn-launch-demo"
              className="card-button"
              onClick={(e) => { e.stopPropagation(); navigate('/migrate', { state: { demoMode: true } }); }}
            >
              Launch Demo →
            </button>
            <div className="demo-badge">⚡ No setup required</div>
          </div>
        </div>
      </section>

      {/* ── Recent Migrations Section ── */}
      <section className="recent-section">
        <div className="section-heading-row">
          <h2 className="section-heading">Recent Migrations</h2>
          {migrations.length > 0 && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {migrations.length} total
            </span>
          )}
        </div>

        <div className="migrations-table">
          {migrations.length > 0 ? (
            <>
              <div className="table-header">
                <div>Date &amp; Time</div>
                <div>Direction</div>
                <div>Status</div>
                <div>Action</div>
              </div>
              {migrations.map((migration) => {
                const badge = getStatusBadge(migration.status);
                return (
                  <div key={migration.id} className="table-row">
                    <div className="table-cell muted">{migration.dateTime}</div>
                    <div className="table-cell">{migration.direction}</div>
                    <div className="table-cell">
                      <span className={`status-badge ${badge.className}`}>
                        {badge.icon} {badge.label}
                      </span>
                    </div>
                    <div className="table-cell">
                      <a
                        href="#report"
                        className="view-report-link"
                        onClick={(e) => { e.preventDefault(); }}
                      >
                        View Report →
                      </a>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon-wrap">📭</div>
              <p className="empty-state-title">No migrations yet</p>
              <p className="empty-state-text">
                Start your first migration above to see your history here.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
