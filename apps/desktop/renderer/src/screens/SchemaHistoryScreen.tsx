import React, { useState, useEffect, useMemo } from 'react';
import type { SchemaHistoryItem } from '@migrateiq/shared';

export interface SchemaHistoryScreenProps {}

export const SchemaHistoryScreen: React.FC<SchemaHistoryScreenProps> = () => {
  const [historyItems, setHistoryItems] = useState<SchemaHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbFilter, setDbFilter] = useState<'all' | 'postgresql' | 'mongodb'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedScriptIds, setExpandedScriptIds] = useState<Set<string>>(new Set());
  const [expandedErrorIds, setExpandedErrorIds] = useState<Set<string>>(new Set());
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Load schema history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await window.electronAPI.invoke<SchemaHistoryItem[]>('store:get-schema-history');
      if (res.success && Array.isArray(res.data)) {
        setHistoryItems(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  const toggleScript = (id: string) => {
    setExpandedScriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleError = (id: string) => {
    setExpandedErrorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadRollback = async (item: SchemaHistoryItem) => {
    const filename = `rollback-${item.tableName}-${Date.now()}.sql`;
    try {
      const res = await window.electronAPI.invoke<{ filePath: string }>('export:rollback-script', {
        defaultFilename: filename,
        fallbackSql: item.rollbackScript || `-- Rollback script for ${item.operation} on ${item.tableName}\n`,
      });
      if (res.success && res.data?.filePath) {
        setExportNotice(`Saved rollback script to ${res.data.filePath}`);
        setTimeout(() => setExportNotice(null), 4000);
      }
    } catch {
      // Fallback: browser download if in web mode
      const blob = new Blob([item.rollbackScript || ''], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportFullChangelog = async () => {
    try {
      const res = await window.electronAPI.invoke<{ filePath: string }>('store:export-schema-changelog');
      if (res.success && res.data?.filePath) {
        setExportNotice(`Changelog exported successfully to ${res.data.filePath}`);
        setTimeout(() => setExportNotice(null), 5000);
      }
    } catch {
      // Ignored
    }
  };

  // Filter and search
  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      // Database type filter
      if (dbFilter !== 'all' && item.databaseType !== dbFilter) {
        return false;
      }
      // Search query filter (matches tableName, operation, databaseName, or forwardScript)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTable = item.tableName.toLowerCase().includes(q);
        const matchOp = item.operation.toLowerCase().includes(q);
        const matchDb = item.databaseName?.toLowerCase().includes(q);
        const matchScript = item.forwardScript?.toLowerCase().includes(q);
        if (!matchTable && !matchOp && !matchDb && !matchScript) return false;
      }
      return true;
    });
  }, [historyItems, dbFilter, searchQuery]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#0F172A' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Schema Version History
          </h1>
          <p style={{ marginTop: '0.375rem', color: '#64748B', fontSize: '0.875rem' }}>
            Auditable, Git-like timeline of every schema evolution, index creation, and DDL migration executed.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={loadHistory}
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
            🔄 Refresh
          </button>

          <button
            type="button"
            onClick={handleExportFullChangelog}
            disabled={historyItems.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              backgroundColor: historyItems.length === 0 ? '#94A3B8' : '#2563EB',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: historyItems.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            📥 Export Full History (.md)
          </button>
        </div>
      </div>

      {exportNotice && (
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
          <span>{exportNotice}</span>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        {/* Database Filters */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'postgresql', 'mongodb'] as const).map((filter) => {
            const isActive = dbFilter === filter;
            const labels = { all: 'All Databases', postgresql: '🐘 PostgreSQL', mongodb: '🍃 MongoDB' };
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setDbFilter(filter)}
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
                {labels[filter]}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            placeholder="Search by table, operation, SQL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2rem',
              fontSize: '0.8125rem',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: '0.65rem', top: '0.45rem', fontSize: '0.85rem', color: '#94A3B8' }}>
            🔍
          </span>
        </div>
      </div>

      {/* ── Timeline View ── */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#64748B' }}>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>Loading schema evolution timeline...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          padding: '4rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#1E293B' }}>
            No schema evolution history recorded
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto' }}>
            When you perform schema modifications or evolve table definitions using the Schema Update Assistant,
            every DDL change and compensating rollback script will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredItems.map((item) => {
            const isFailed = item.status === 'failed';
            const isRolledBack = item.status === 'rolled_back';
            const isExpandedScript = expandedScriptIds.has(item.id);
            const isExpandedError = expandedErrorIds.has(item.id);

            const statusBadge = isFailed
              ? { bg: '#FEF2F2', text: '#DC2626', label: 'Failed' }
              : isRolledBack
              ? { bg: '#FFFBEB', text: '#D97706', label: 'Rolled Back' }
              : { bg: '#F0FDF4', text: '#16A34A', label: 'Applied' };

            const dateStr = new Date(item.timestamp).toLocaleString(undefined, {
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
                  padding: '1.25rem 1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
                      📅 {dateStr}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: item.databaseType === 'postgresql' ? '#EFF6FF' : '#F0FDF4',
                      color: item.databaseType === 'postgresql' ? '#1D4ED8' : '#15803D',
                    }}>
                      {item.databaseType === 'postgresql' ? '🐘 PostgreSQL' : '🍃 MongoDB'}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '4px',
                    backgroundColor: statusBadge.bg,
                    color: statusBadge.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}>
                    {isFailed ? '❌' : isRolledBack ? '⚠️' : '✅'} {statusBadge.label}
                  </span>
                </div>

                {/* Operation and Target info */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{item.operation.replace(/_/g, ' ')}</span>
                    <span style={{ color: '#64748B', fontWeight: 400 }}>on</span>
                    <code style={{
                      backgroundColor: '#F1F5F9',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      color: '#0F172A',
                    }}>
                      {item.tableName}
                    </code>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.25rem' }}>
                    Database: <strong style={{ color: '#334155' }}>{item.databaseName || 'default'}</strong>
                    {item.durationMs !== undefined && (
                      <span style={{ marginLeft: '1rem' }}>Duration: {item.durationMs}ms</span>
                    )}
                    {item.author && (
                      <span style={{ marginLeft: '1rem' }}>Author: {item.author}</span>
                    )}
                  </div>
                </div>

                {/* Actions row */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => toggleScript(item.id)}
                    style={{
                      background: 'none',
                      border: '1px solid #CBD5E1',
                      borderRadius: '4px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#2563EB',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {isExpandedScript ? 'Hide Script ▲' : 'View Script ▼'}
                  </button>

                  {item.rollbackScript && (
                    <button
                      type="button"
                      onClick={() => handleDownloadRollback(item)}
                      style={{
                        background: 'none',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      💾 Download Rollback .sql
                    </button>
                  )}

                  {isFailed && item.errorMessage && (
                    <button
                      type="button"
                      onClick={() => toggleError(item.id)}
                      style={{
                        background: 'none',
                        border: '1px solid #FCA5A5',
                        borderRadius: '4px',
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#DC2626',
                        cursor: 'pointer',
                      }}
                    >
                      {isExpandedError ? 'Hide Error Details ▲' : 'View Error Details ▼'}
                    </button>
                  )}
                </div>

                {/* Expanded Script Panel */}
                {isExpandedScript && (
                  <div style={{
                    marginTop: '1rem',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '0.875rem 1rem',
                  }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                      Executed DDL / Query:
                    </div>
                    <pre style={{
                      margin: 0,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.75rem',
                      color: '#0F172A',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                      maxHeight: '250px',
                      overflowY: 'auto',
                    }}>
                      {item.forwardScript || '-- No script recorded'}
                    </pre>

                    {item.rollbackScript && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                          Compensating Rollback Script:
                        </div>
                        <pre style={{
                          margin: 0,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '0.75rem',
                          color: '#B45309',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.5,
                        }}>
                          {item.rollbackScript}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded Error Details */}
                {isExpandedError && item.errorMessage && (
                  <div style={{
                    marginTop: '1rem',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    padding: '0.875rem 1rem',
                    color: '#991B1B',
                    fontSize: '0.8125rem',
                  }}>
                    <strong>Execution Error:</strong>
                    <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {item.errorMessage}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
