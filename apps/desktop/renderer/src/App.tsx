import React from 'react';
import type { DatabaseType, ConnectionConfig } from '@migrateiq/shared';

export interface AppProps {}

export const App: React.FC<AppProps> = () => {
  const sampleConfig: ConnectionConfig = {
    type: 'mongodb' as DatabaseType,
    database: 'ecommerce_db',
    host: 'localhost',
    port: 27017
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: 'var(--bg-canvas)'
    }}>
      {/* Top Header */}
      <header style={{
        height: '56px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 1.5rem',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: 'var(--brand-primary)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.875rem'
          }}>
            M
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
            MigrateIQ
          </span>
          <span style={{
            fontSize: '0.75rem',
            backgroundColor: 'var(--bg-sidebar)',
            color: 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}>
            v1.0.0 (Phase 0 Scaffold)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--status-success)'
          }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Electron Bridge Ready
          </span>
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{
        flex: 1,
        padding: '2rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '2.5rem',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: '#EFF6FF',
            color: 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.75rem'
          }}>
            ⚡
          </div>

          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            Desktop App Scaffold Active
          </h1>

          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            marginBottom: '1.5rem'
          }}>
            Electron 28 + Vite + React 18 + TypeScript environment initialized successfully. The full App Shell with persistent sidebar navigation will be built in Phase 2.
          </p>

          <div style={{
            backgroundColor: 'var(--bg-sidebar)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'left',
            fontSize: '0.8125rem',
            fontFamily: 'monospace'
          }}>
            <div style={{ color: 'var(--accent-ai)', fontWeight: 600, marginBottom: '0.5rem' }}>
              ✓ Shared Types Package Connected:
            </div>
            <div style={{ color: 'var(--text-primary)' }}>
              Source Type: <span style={{ color: 'var(--brand-primary)' }}>{sampleConfig.type}</span>
            </div>
            <div style={{ color: 'var(--text-primary)' }}>
              Default Database: <span style={{ color: 'var(--brand-primary)' }}>{sampleConfig.database}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
