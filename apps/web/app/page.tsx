import React from 'react';
import type { DatabaseType } from '@migrateiq/shared';

export default function HomePage() {
  const supportedTypes: DatabaseType[] = ['mongodb', 'postgresql'];

  return (
    <main style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          backgroundColor: 'var(--brand-primary)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.25rem'
        }}>
          M
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            MigrateIQ
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Intelligent Database Migration Planner
          </p>
        </div>
      </header>

      <section style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
          Landing Website Scaffold Active (Phase 0)
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          This is the Next.js 14 App Router scaffold for MigrateIQ. Full 5-page marketing site will be styled in Phase 1.
        </p>

        <div style={{
          display: 'inline-flex',
          gap: '0.5rem',
          alignItems: 'center',
          backgroundColor: 'var(--bg-sidebar)',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.875rem'
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Shared Types Connected:</span>
          <strong>{supportedTypes.join(' ↔ ')}</strong>
        </div>
      </section>
    </main>
  );
}
