import React, { useState, useEffect, useMemo } from 'react';
import type { MigrationHistoryItem, SchemaHistoryItem } from '@migrateiq/shared';

export interface HistoryScreenProps {}

type HistoryCategoryFilter = 'all' | 'migrations' | 'schema_updates' | 'completed' | 'failed';

interface UnifiedHistoryEntry {
  id: string;
  kind: 'migration' | 'schema_update';
  dateTime: string;
  title: string;
  direction?: string;
  status: 'completed' | 'warning' | 'failed';
  sourceDb?: string;
  targetDb?: string;
  details?: Record<string, unknown>;
  rollbackScript?: string;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const [unifiedItems, setUnifiedItems] = useState<UnifiedHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryCategoryFilter>('all');
  const [selectedModalItem, setSelectedModalItem] = useState<UnifiedHistoryEntry | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    loadAllHistory();
  }, []);

  const loadAllHistory = async () => {
    setIsLoading(true);
    try {
      const [migRes, schemaRes] = await Promise.all([
        window.electronAPI.invoke<MigrationHistoryItem[]>('store:get-migration-history'),
        window.electronAPI.invoke<SchemaHistoryItem[]>('store:get-schema-history'),
      ]);

      const entries: UnifiedHistoryEntry[] = [];

      if (migRes.success && Array.isArray(migRes.data)) {
        for (const m of migRes.data) {
          entries.push({
            id: m.id,
            kind: 'migration',
            dateTime: m.dateTime,
            title: `Full Data Migration (${m.direction || 'Unspecified'})`,
            direction: m.direction,
            status: m.status,
            sourceDb: m.sourceDb,
            targetDb: m.targetDb,
            details: (m as unknown as Record<string, unknown>),
          });
        }
      }

      if (schemaRes.success && Array.isArray(schemaRes.data)) {
        for (const s of schemaRes.data) {
          const status = s.status === 'applied' ? 'completed' : s.status === 'rolled_back' ? 'warning' : 'failed';
          entries.push({
            id: s.id,
            kind: 'schema_update',
            dateTime: s.timestamp,
            title: `Schema Update: [${s.operation}] on ${s.tableName}`,
            direction: `${s.databaseType.toUpperCase()} (${s.databaseName || 'default'})`,
            status,
            sourceDb: s.databaseName,
            targetDb: s.databaseName,
            details: {
              operation: s.operation,
              tableName: s.tableName,
              databaseType: s.databaseType,
              databaseName: s.databaseName,
              durationMs: s.durationMs,
              errorMessage: s.errorMessage,
              forwardScript: s.forwardScript,
            },
            rollbackScript: s.rollbackScript,
          });
        }
      }

      // Sort newest first
      entries.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      setUnifiedItems(entries);
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadRollback = async (entry: UnifiedHistoryEntry) => {
    const filename = `rollback-${entry.kind}-${Date.now()}.sql`;
    try {
      const res = await window.electronAPI.invoke<{ filePath: string }>('export:rollback-script', {
        defaultFilename: filename,
        fallbackSql: entry.rollbackScript || `-- Rollback script for ${entry.title}\n`,
      });
      if (res.success && res.data?.filePath) {
        setNotification(`Rollback script saved to ${res.data.filePath}`);
        setTimeout(() => setNotification(null), 4000);
      }
    } catch {
      // Fallback
      const blob = new Blob([entry.rollbackScript || ''], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (filter === 'migrations') return item.kind === 'migration';
      if (filter === 'schema_updates') return item.kind === 'schema_update';
      if (filter === 'completed') return item.status === 'completed';
      if (filter === 'failed') return item.status === 'failed';
      return true;
    });
  }, [unifiedItems, filter]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#0F172A' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Unified Migration &amp; Schema History
          </h1>
          <p style={{ marginTop: '0.375rem', color: '#64748B', fontSize: '0.875rem' }}>
            Consolidated ledger of all ETL data transfers, schema evolutions, and operational rollbacks.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAllHistory}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.875rem',
            backgroundColor: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#334155',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          🔄 Refresh Log
        </button>
      </div>

      {notification && (
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          color: '#1E40AF',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span>✅</span>
          <span>{notification}</span>
        </div>
      )}

      {/* ── Filter Tabs ── */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        backgroundColor: '#FFFFFF',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        {([
          { id: 'all', label: `All (${unifiedItems.length})` },
          { id: 'migrations', label: `Migrations (${unifiedItems.filter((i) => i.kind === 'migration').length})` },
          { id: 'schema_updates', label: `Schema Updates (${unifiedItems.filter((i) => i.kind === 'schema_update').length})` },
          { id: 'completed', label: `Completed (${unifiedItems.filter((i) => i.status === 'completed').length})` },
          { id: 'failed', label: `Failed (${unifiedItems.filter((i) => i.status === 'failed').length})` },
        ] as const).map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: isActive ? '1px solid #2563EB' : '1px solid #E2E8F0',
                backgroundColor: isActive ? '#EFF6FF' : '#F8FAFC',
                color: isActive ? '#1D4ED8' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── History Items List ── */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#64748B' }}>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>Loading history records...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          padding: '4rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#1E293B' }}>
            No history entries matching this filter
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto' }}>
            Run migrations or schema updates through the wizards to record audit milestones and execution diagnostics.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {filteredItems.map((item) => {
            const isCompleted = item.status === 'completed';
            const isWarning = item.status === 'warning';
            const isFailed = item.status === 'failed';

            const statusBadge = isCompleted
              ? { bg: '#F0FDF4', text: '#16A34A', icon: '✅', label: 'Completed' }
              : isWarning
              ? { bg: '#FFFBEB', text: '#D97706', icon: '⚠️', label: 'Warnings / Rolled Back' }
              : { bg: '#FEF2F2', text: '#DC2626', icon: '❌', label: 'Failed' };

            const dateStr = new Date(item.dateTime).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: isFailed ? '1px solid #FECACA' : '1px solid #E2E8F0',
                  padding: '1.125rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                {/* Left meta */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: item.kind === 'migration' ? '#EFF6FF' : '#F3E8FF',
                      color: item.kind === 'migration' ? '#1D4ED8' : '#7E22CE',
                    }}>
                      {item.kind === 'migration' ? '🚀 MIGRATION' : '🛠️ SCHEMA UPDATE'}
                    </span>
                    <strong style={{ fontSize: '0.9375rem', color: '#0F172A' }}>{item.title}</strong>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: '#64748B', display: 'flex', gap: '1rem' }}>
                    <span>📅 {dateStr}</span>
                    {item.direction && (
                      <span>🔗 {item.direction}</span>
                    )}
                  </div>
                </div>

                {/* Right actions & status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    backgroundColor: statusBadge.bg,
                    color: statusBadge.text,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}>
                    {statusBadge.icon} {statusBadge.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedModalItem(item)}
                    style={{
                      background: 'none',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#2563EB',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    View Full Report →
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadRollback(item)}
                    title="Download Rollback Script"
                    style={{
                      background: 'none',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    💾 Rollback Script
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Report Modal ── */}
      {selectedModalItem && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedModalItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #E2E8F0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>📋</span>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#0F172A' }}>
                  Execution Report &amp; Diagnostics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModalItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Operation:</span>
                <span style={{ color: '#0F172A', fontWeight: 700 }}>{selectedModalItem.title}</span>

                <span style={{ color: '#64748B', fontWeight: 600 }}>Timestamp:</span>
                <span style={{ color: '#334155' }}>{new Date(selectedModalItem.dateTime).toLocaleString()}</span>

                <span style={{ color: '#64748B', fontWeight: 600 }}>Final Status:</span>
                <span style={{ color: selectedModalItem.status === 'completed' ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                  {selectedModalItem.status.toUpperCase()}
                </span>

                {selectedModalItem.direction && (
                  <>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Route / Database:</span>
                    <span style={{ color: '#334155' }}>{selectedModalItem.direction}</span>
                  </>
                )}
              </div>

              {selectedModalItem.details && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Diagnostics Snapshot &amp; Payload:
                  </div>
                  <pre style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '0.875rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: '#0F172A',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {JSON.stringify(selectedModalItem.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              padding: '1rem 1.5rem',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
            }}>
              <button
                type="button"
                onClick={() => handleDownloadRollback(selectedModalItem)}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#2563EB',
                  border: '1px solid #2563EB',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                Download Rollback Script
              </button>
              <button
                type="button"
                onClick={() => setSelectedModalItem(null)}
                style={{
                  padding: '0.45rem 1.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: '#0F172A',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
