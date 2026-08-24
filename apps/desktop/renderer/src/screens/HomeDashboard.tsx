import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  sourceConfig: unknown;
  targetConfig: unknown;
  status: 'in-progress' | 'completed' | 'cancelled';
  savedAt: string;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  const navigate = useNavigate();
  const wizardStore = useWizardStore();
  const [migrations] = useState<Migration[]>([]);
  const [inProgressState, setInProgressState] = useState<WizardStateSnapshot | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);

  // On mount: check electron-store for an in-progress wizard state
  useEffect(() => {
    window.electronAPI
      .invoke<WizardStateSnapshot | null>('store:get-wizard-state')
      .then((response) => {
        if (response.success && response.data && response.data.status === 'in-progress') {
          setInProgressState(response.data);
        }
      })
      .catch(() => {
        // Ignore — non-critical
      });
  }, []);

  const showResumeBanner = !resumeDismissed && inProgressState !== null;

  const handleStartMigration = () => {
    navigate('/migrate');
  };

  const handleStartSchemaUpdate = () => {
    navigate('/schema-update');
  };

  const handleLaunchDemo = () => {
    navigate('/migrate', { state: { demoMode: true } });
  };

  const handleResume = () => {
    // Restore direction and step into Zustand so the wizard reopens at the right step
    if (inProgressState?.direction) {
      wizardStore.setDirection(inProgressState.direction);
      // Immediately override step to the saved step
      wizardStore.setWizardStep(inProgressState.wizardStep);
    }
    navigate('/migrate');
  };

  const handleDismissResume = async () => {
    setResumeDismissed(true);
    // Clear from electron-store
    await window.electronAPI.invoke('store:clear-wizard-state').catch(() => {});
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: '✅', label: 'Completed', className: 'completed' };
      case 'warning':
        return { icon: '⚠️', label: 'Completed with warnings', className: 'warning' };
      case 'failed':
        return { icon: '❌', label: 'Failed', className: 'failed' };
      default:
        return { icon: '?', label: 'Unknown', className: 'failed' };
    }
  };

  const directionLabel = inProgressState?.direction === 'mongodb-to-postgres'
    ? 'MongoDB → PostgreSQL'
    : inProgressState?.direction === 'postgres-to-mongo'
    ? 'PostgreSQL → MongoDB'
    : '';

  return (
    <div className="dashboard-container">
      {/* Resume Banner — Shown when an in-progress migration is found in electron-store */}
      {showResumeBanner && (
        <div className="resume-banner">
          <div className="resume-content">
            <span>📋</span>
            <div>
              <strong>You have an unfinished migration.</strong>
              {directionLabel && (
                <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  ({directionLabel} — at Step {inProgressState?.wizardStep ?? 1} of 8)
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                padding: '0.25rem 0.5rem',
              }}
              onClick={handleDismissResume}
              title="Dismiss and clear this migration"
            >
              Discard ×
            </button>
            <button className="resume-button" onClick={handleResume}>
              Resume →
            </button>
          </div>
        </div>
      )}

      {/* Welcome Section with Entry Cards */}
      <section className="welcome-section">
        <h1 className="welcome-heading">Welcome to MigrateIQ</h1>
        <p className="welcome-subtitle">
          AI-Powered Database Migration, Schema Evolution & Real-Time Risk Analysis
        </p>

        <div className="cards-grid">
          {/* Card A - Migrate My Database */}
          <div
            className="entry-card"
            onClick={handleStartMigration}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStartMigration(); } }}
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
              className="card-button"
              onClick={(e) => { e.stopPropagation(); handleStartMigration(); }}
            >
              Start Migration →
            </button>
          </div>

          {/* Card B - Update My Database */}
          <div
            className="entry-card"
            onClick={handleStartSchemaUpdate}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStartSchemaUpdate(); } }}
            role="button"
            tabIndex={0}
            aria-label="Update My Database"
          >
            <div className="card-icon">✏️</div>
            <h2 className="card-title">Update My Database</h2>
            <p className="card-description">
              Safely add, remove, or rename columns, indexes, and constraints in your existing database.
            </p>
            <button
              className="card-button"
              onClick={(e) => { e.stopPropagation(); handleStartSchemaUpdate(); }}
            >
              Start Schema Update →
            </button>
          </div>

          {/* Card C - Try with Sample Data (Demo Mode) */}
          <div
            className="entry-card demo"
            onClick={handleLaunchDemo}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLaunchDemo(); } }}
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
              className="card-button"
              onClick={(e) => { e.stopPropagation(); handleLaunchDemo(); }}
            >
              Launch Demo →
            </button>
            <div className="demo-badge">No setup required</div>
          </div>
        </div>
      </section>

      {/* Recent Migrations Section */}
      <section className="recent-section">
        <h2 className="section-heading">Recent Migrations</h2>

        <div className="migrations-table">
          {migrations.length > 0 ? (
            <>
              {/* Table Header */}
              <div className="table-header">
                <div>Date & Time</div>
                <div>Direction</div>
                <div>Status</div>
                <div>Action</div>
              </div>

              {/* Table Rows */}
              {migrations.map((migration) => {
                const status = getStatusBadge(migration.status);
                return (
                  <div key={migration.id} className="table-row">
                    <div className="table-cell muted">{migration.dateTime}</div>
                    <div className="table-cell">{migration.direction}</div>
                    <div className="table-cell">
                      <div className={`status-badge ${status.className}`}>
                        <span>{status.icon}</span>
                        <span>{status.label}</span>
                      </div>
                    </div>
                    <div className="table-cell">
                      <a
                        href="#report"
                        className="view-report-link"
                        onClick={(e) => {
                          e.preventDefault();
                          // Will open report modal in Phase 10
                        }}
                      >
                        View Report
                      </a>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            /* Empty State */
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p className="empty-state-text">
                No migrations yet. Start your first one above.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
