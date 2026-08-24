import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

export interface HomeDashboardProps {}

interface Migration {
  id: string;
  dateTime: string;
  direction: string;
  status: 'completed' | 'warning' | 'failed';
}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  const navigate = useNavigate();
  const [migrations] = useState<Migration[]>([]);
  const [showResumeCard] = useState(false);

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
    navigate('/migrate');
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

  return (
    <div className="dashboard-container">
      {/* Resume Banner - Shown only if unfinished migration exists */}
      {showResumeCard && (
        <div className="resume-banner">
          <div className="resume-content">
            <span>📋</span>
            <span>You have an unfinished migration.</span>
          </div>
          <button className="resume-button" onClick={handleResume}>
            Resume →
          </button>
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
