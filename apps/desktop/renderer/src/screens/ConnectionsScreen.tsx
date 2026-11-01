import React, { useState, useEffect } from 'react';
import type { ConnectionConfig } from '@migrateiq/shared';
import type { SavedConnection } from '../../../main/handlers/store';

export interface ConnectionsScreenProps {}

interface FormState {
  name: string;
  type: 'mongodb' | 'postgresql';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  connectionString: string;
}

const initialFormState: FormState = {
  name: '',
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: '',
  user: 'postgres',
  password: '',
  ssl: false,
  connectionString: '',
};

export const ConnectionsScreen: React.FC<ConnectionsScreenProps> = () => {
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, { testing: boolean; ok?: boolean; message?: string }>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [modalTestStatus, setModalTestStatus] = useState<{ testing: boolean; ok?: boolean; message?: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const res = await window.electronAPI.invoke<SavedConnection[]>('store:get-connections');
      if (res.success && Array.isArray(res.data)) {
        setConnections(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setModalTestStatus(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (conn: SavedConnection) => {
    setEditingId(conn.id);
    const cfg = conn.config || {};
    setFormData({
      name: conn.name,
      type: conn.type || (cfg.type as 'mongodb' | 'postgresql') || 'postgresql',
      host: cfg.host || 'localhost',
      port: cfg.port || (conn.type === 'mongodb' ? 27017 : 5432),
      database: cfg.database || '',
      user: cfg.user || '',
      password: cfg.password || '',
      ssl: Boolean(cfg.ssl),
      connectionString: cfg.connectionString || '',
    });
    setModalTestStatus(null);
    setIsModalOpen(true);
  };

  const handleTestConnection = async (connId: string, config: ConnectionConfig) => {
    setTestResults((prev) => ({
      ...prev,
      [connId]: { testing: true },
    }));

    try {
      const res = await window.electronAPI.invoke<{ ok: boolean; latencyMs: number; message: string }>(
        'db:test-connection',
        config
      );
      if (res.success && res.data) {
        const latency = res.data.latencyMs;
        setTestResults((prev) => ({
          ...prev,
          [connId]: { testing: false, ok: true, message: `${latency}ms` },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [connId]: { testing: false, ok: false, message: res.error || 'Connection failed' },
        }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [connId]: { testing: false, ok: false, message: err instanceof Error ? err.message : 'Error' },
      }));
    }
  };

  const handleModalTest = async () => {
    setModalTestStatus({ testing: true });
    const configToTest: ConnectionConfig = {
      type: formData.type,
      host: formData.host,
      port: Number(formData.port),
      database: formData.database,
      user: formData.user,
      password: formData.password,
      ssl: formData.ssl,
      connectionString: formData.connectionString.trim() ? formData.connectionString.trim() : undefined,
    };

    try {
      const res = await window.electronAPI.invoke<{ ok: boolean; latencyMs: number; message: string }>(
        'db:test-connection',
        configToTest
      );
      if (res.success && res.data) {
        setModalTestStatus({ testing: false, ok: true, message: `Connected successfully (${res.data.latencyMs}ms)` });
      } else {
        setModalTestStatus({ testing: false, ok: false, message: res.error || 'Connection failed' });
      }
    } catch (err) {
      setModalTestStatus({ testing: false, ok: false, message: err instanceof Error ? err.message : 'Error' });
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const config: ConnectionConfig = {
      type: formData.type,
      host: formData.host,
      port: Number(formData.port),
      database: formData.database,
      user: formData.user,
      password: formData.password,
      ssl: formData.ssl,
      connectionString: formData.connectionString.trim() ? formData.connectionString.trim() : undefined,
    };

    try {
      if (editingId) {
        await window.electronAPI.invoke('store:update-connection', {
          id: editingId,
          name: formData.name,
          config,
        });
      } else {
        await window.electronAPI.invoke('store:save-connection', {
          name: formData.name,
          config,
        });
      }
      setIsModalOpen(false);
      loadConnections();
    } catch {
      // Ignored
    }
  };

  const handleDeleteConnection = async (id: string) => {
    try {
      await window.electronAPI.invoke('store:delete-connection', id);
      setDeleteConfirmId(null);
      loadConnections();
    } catch {
      // Ignored
    }
  };

  const filteredConnections = connections.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(q);
    const dbMatch = c.config?.database?.toLowerCase().includes(q);
    const hostMatch = c.config?.host?.toLowerCase().includes(q);
    return nameMatch || dbMatch || hostMatch;
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#0F172A' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Saved Database Profiles
          </h1>
          <p style={{ marginTop: '0.375rem', color: '#64748B', fontSize: '0.875rem' }}>
            Manage and test credentials for your PostgreSQL clusters and MongoDB instances.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1.125rem',
            backgroundColor: '#2563EB',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#FFFFFF',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            transition: 'background-color 0.2s',
          }}
        >
          + Add New Connection
        </button>
      </div>

      {/* ── Search & Counter Bar ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        marginBottom: '1.5rem',
      }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
          Total Profiles: <strong style={{ color: '#0F172A' }}>{connections.length}</strong>
        </div>

        <div style={{ width: '280px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search saved profiles..."
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

      {/* ── Connections Grid ── */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#64748B' }}>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>Loading connection profiles...</p>
        </div>
      ) : filteredConnections.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          padding: '4rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔌</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#1E293B' }}>
            No saved database connections
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
            Add your database credentials to quickly launch migrations or test connection latency anytime.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Create Your First Connection Profile
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.25rem',
        }}>
          {filteredConnections.map((conn) => {
            const isPg = conn.type === 'postgresql' || conn.config?.type === 'postgresql';
            const test = testResults[conn.id];

            return (
              <div
                key={conn.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{isPg ? '🐘' : '🍃'}</span>
                      <strong style={{ fontSize: '1rem', color: '#0F172A' }}>{conn.name}</strong>
                    </div>

                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: isPg ? '#EFF6FF' : '#F0FDF4',
                      color: isPg ? '#1D4ED8' : '#15803D',
                    }}>
                      {isPg ? 'PostgreSQL' : 'MongoDB'}
                    </span>
                  </div>

                  {/* Card Details */}
                  <div style={{
                    fontSize: '0.8125rem',
                    color: '#64748B',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    backgroundColor: '#F8FAFC',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    marginBottom: '1rem',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>Host:</span>{' '}
                      <span style={{ color: '#0F172A' }}>
                        {conn.config?.host || 'localhost'}:{conn.config?.port || (isPg ? 5432 : 27017)}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>Database:</span>{' '}
                      <span style={{ color: '#0F172A' }}>{conn.config?.database || 'default'}</span>
                    </div>
                    {conn.config?.user && (
                      <div>
                        <span style={{ fontWeight: 600 }}>User:</span>{' '}
                        <span style={{ color: '#0F172A' }}>{conn.config.user}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div>
                  {/* Live test feedback */}
                  {test && (
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginBottom: '0.75rem',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '4px',
                      backgroundColor: test.testing ? '#F1F5F9' : test.ok ? '#F0FDF4' : '#FEF2F2',
                      color: test.testing ? '#475569' : test.ok ? '#16A34A' : '#DC2626',
                    }}>
                      {test.testing ? '⏳ Pinging database...' : test.ok ? `✅ Connected (${test.message})` : `❌ ${test.message}`}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled={test?.testing}
                      onClick={() => handleTestConnection(conn.id, conn.config)}
                      style={{
                        background: 'none',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#2563EB',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      ⚡ Test Connection
                    </button>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(conn)}
                        style={{
                          background: 'none',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(conn.id)}
                        style={{
                          background: 'none',
                          border: '1px solid #FCA5A5',
                          borderRadius: '6px',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#DC2626',
                          cursor: 'pointer',
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Connection Modal ── */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsModalOpen(false)}
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
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #E2E8F0',
            }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#0F172A' }}>
                {editingId ? 'Edit Connection Profile' : 'Add New Connection Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94A3B8', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveConnection} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Type selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Database Engine
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'postgresql', port: 5432 })}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: formData.type === 'postgresql' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                      backgroundColor: formData.type === 'postgresql' ? '#EFF6FF' : '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      color: formData.type === 'postgresql' ? '#1D4ED8' : '#475569',
                    }}
                  >
                    🐘 PostgreSQL
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'mongodb', port: 27017 })}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: formData.type === 'mongodb' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                      backgroundColor: formData.type === 'mongodb' ? '#EFF6FF' : '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      color: formData.type === 'mongodb' ? '#1D4ED8' : '#475569',
                    }}
                  >
                    🍃 MongoDB
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Profile Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Local PG Instance or Prod Mongo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8125rem',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Host & Port */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Host
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Database */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Database Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. ecommerce_db"
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8125rem',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* User & Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.user}
                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* SSL */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="ssl-check"
                  checked={formData.ssl}
                  onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                />
                <label htmlFor="ssl-check" style={{ fontSize: '0.8125rem', color: '#334155', cursor: 'pointer' }}>
                  Enable SSL / TLS encrypted connection
                </label>
              </div>

              {/* Modal test button and status */}
              {modalTestStatus && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: modalTestStatus.testing ? '#F1F5F9' : modalTestStatus.ok ? '#F0FDF4' : '#FEF2F2',
                  color: modalTestStatus.testing ? '#475569' : modalTestStatus.ok ? '#16A34A' : '#DC2626',
                }}>
                  {modalTestStatus.testing ? '⏳ Pinging database...' : modalTestStatus.ok ? `✅ ${modalTestStatus.message}` : `❌ ${modalTestStatus.message}`}
                </div>
              )}

              {/* Footer buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleModalTest}
                  disabled={modalTestStatus?.testing}
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#2563EB',
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Test Ping
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.8125rem',
                      color: '#475569',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      backgroundColor: '#2563EB',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {editingId ? 'Save Changes' : 'Save Connection'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {deleteConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteConfirmId(null)}
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
              borderRadius: '10px',
              maxWidth: '400px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 800, color: '#DC2626' }}>
              Delete Saved Connection?
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: '#64748B' }}>
              Are you sure you want to remove this connection profile from your saved list? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.8125rem',
                  color: '#475569',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConnection(deleteConfirmId)}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: '#DC2626',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
