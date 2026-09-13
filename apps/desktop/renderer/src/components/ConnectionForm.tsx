import React, { useState, useEffect } from 'react';
import type { ConnectionConfig } from '@migrateiq/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedConnection {
  id: string;
  name: string;
  type: 'mongodb' | 'postgresql';
  config: ConnectionConfig;
  savedAt: string;
}

export interface ConnectionFormProps {
  dbType: 'mongodb' | 'postgresql';
  isLoading?: boolean;
  initialConfig?: ConnectionConfig | null;
  buttonText?: string;
  onConnect: (config: ConnectionConfig) => Promise<void>;
  onSave?: (name: string, config: ConnectionConfig) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  dbType,
  isLoading = false,
  initialConfig,
  buttonText,
  onConnect,
  onSave,
}) => {
  const [tab, setTab] = useState<'string' | 'fields'>(
    initialConfig?.connectionString ? 'string' : (initialConfig?.host ? 'fields' : 'string')
  );
  const [connectionString, setConnectionString] = useState(initialConfig?.connectionString || '');
  const [showPassword, setShowPassword] = useState(false);
  const [shouldSave, setShouldSave] = useState(false);
  const [connectionName, setConnectionName] = useState(initialConfig?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Individual field tab state
  const [host, setHost] = useState(initialConfig?.host || 'localhost');
  const [port, setPort] = useState(
    initialConfig?.port ? String(initialConfig.port) : (dbType === 'mongodb' ? '27017' : '5432')
  );
  const [username, setUsername] = useState(initialConfig?.user || '');
  const [password, setPassword] = useState(initialConfig?.password || '');
  const [database, setDatabase] = useState(initialConfig?.database || '');
  const [pgSchema, setPgSchema] = useState(initialConfig?.schema || 'public');

  // Saved connections dropdown
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string>('');
  const [loadingConnections, setLoadingConnections] = useState(false);

  // Load saved connections for this db type on mount
  useEffect(() => {
    loadSavedConnections();
  }, [dbType]);

  const loadSavedConnections = () => {
    setLoadingConnections(true);
    window.electronAPI
      .invoke<SavedConnection[]>('store:get-connections', dbType)
      .then((response) => {
        if (response.success && response.data) {
          setSavedConnections(response.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConnections(false));
  };

  const handleLoadSavedConnection = (connId: string) => {
    setSelectedSavedId(connId);
    const conn = savedConnections.find((c) => c.id === connId);
    if (!conn) return;

    const cfg = conn.config;
    if (cfg.connectionString) {
      setTab('string');
      setConnectionString(cfg.connectionString);
      setDatabase(cfg.database || '');
    } else {
      setTab('fields');
      setHost(cfg.host || 'localhost');
      setPort(cfg.port ? String(cfg.port) : (dbType === 'mongodb' ? '27017' : '5432'));
      setUsername(cfg.user || '');
      setPassword(cfg.password || '');
      setDatabase(cfg.database || '');
    }
    setPgSchema(cfg.schema || 'public');
    setConnectionName(conn.name);
  };

  const handleDeleteSavedConnection = async () => {
    if (!selectedSavedId) return;
    const connToDelete = savedConnections.find((c) => c.id === selectedSavedId);
    if (!connToDelete) return;

    const confirmed = window.confirm(`Are you sure you want to delete saved connection "${connToDelete.name}"?`);
    if (!confirmed) return;

    try {
      const res = await window.electronAPI.invoke('store:delete-connection', selectedSavedId);
      if (res.success) {
        setSavedConnections((prev) => prev.filter((c) => c.id !== selectedSavedId));
        setSelectedSavedId('');
        setSaveMessage({ type: 'success', text: `Connection "${connToDelete.name}" deleted.` });
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to delete connection' });
    }
  };

  const buildConfig = (): ConnectionConfig => {
    if (tab === 'string') {
      return {
        type: dbType,
        connectionString,
        database: database.trim(),
        schema: dbType === 'postgresql' ? (pgSchema.trim() || 'public') : undefined,
      };
    }
    return {
      type: dbType,
      host,
      port: parseInt(port, 10),
      user: username,
      password,
      database,
      schema: dbType === 'postgresql' ? (pgSchema.trim() || 'public') : undefined,
    };
  };

  // Explicit Save Connection Button handler
  const handleSaveConnectionNow = async () => {
    if (!connectionName.trim()) {
      setSaveMessage({ type: 'error', text: 'Please enter a name for this connection.' });
      return;
    }

    const config = buildConfig();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await window.electronAPI.invoke<SavedConnection>(
        'store:save-connection',
        { name: connectionName.trim(), config }
      );

      if (response.success && response.data) {
        setSavedConnections((prev) => {
          const filtered = prev.filter((c) => c.name.toLowerCase() !== connectionName.trim().toLowerCase());
          return [...filtered, response.data!];
        });
        setSelectedSavedId(response.data.id);
        setSaveMessage({ type: 'success', text: `Saved "${connectionName.trim()}" for future use!` });
        setShouldSave(false);
        if (onSave) onSave(connectionName.trim(), config);
      } else {
        setSaveMessage({ type: 'error', text: response.error || 'Failed to save connection' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save connection' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleConnect = async () => {
    const config = buildConfig();
    await onConnect(config);

    // If shouldSave is checked and a name was given, auto-save during connect as well
    if (shouldSave && connectionName.trim()) {
      handleSaveConnectionNow();
    }
  };

  // Real-time Cloud Pooler Detection
  const targetStr = (tab === 'string' ? connectionString : host).toLowerCase();
  const detectedCloud = targetStr.includes('supabase.co')
    ? 'supabase'
    : targetStr.includes('neon.tech')
    ? 'neon'
    : targetStr.includes('railway.app')
    ? 'railway'
    : targetStr.includes('render.com') || targetStr.includes('onrender.com')
    ? 'render'
    : null;

  const placeholders = {
    mongodb: 'mongodb://username:password@host:27017/dbname',
    postgresql: 'postgresql://username:password@host:5432/dbname',
  };

  const notes = {
    mongodb: 'Supports MongoDB Atlas (mongodb+srv://...) and local connections',
    postgresql: 'Supports Supabase, Neon, Railway, Render, AWS RDS, and local PostgreSQL',
  };

  const defaultButtonLabel = dbType === 'mongodb' ? 'Test Connection & Read Schema' : 'Test Connection & Verify';
  const effectiveButtonLabel = buttonText || defaultButtonLabel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Saved Connections Dropdown & Delete Action ── */}
      {savedConnections.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          backgroundColor: 'var(--bg-surface-secondary, #F1F5F9)',
          padding: '0.75rem',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)'
        }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            ⚡ Use a Saved Connection
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={selectedSavedId}
              onChange={(e) => handleLoadSavedConnection(e.target.value)}
              style={{
                flex: 1,
                padding: '0.625rem 0.75rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '0.9rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="">
                {loadingConnections ? 'Loading…' : `— Select saved ${dbType === 'mongodb' ? 'MongoDB' : 'PostgreSQL'} connection —`}
              </option>
              {savedConnections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} {conn.config.database ? `(${conn.config.database})` : ''}
                </option>
              ))}
            </select>

            {selectedSavedId && (
              <button
                type="button"
                onClick={handleDeleteSavedConnection}
                title="Delete this saved connection"
                style={{
                  padding: '0.625rem 0.75rem',
                  border: '1px solid #FCA5A5',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setTab('string')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0',
            fontSize: '0.9375rem',
            fontWeight: tab === 'string' ? 600 : 500,
            color: tab === 'string' ? 'var(--brand-primary)' : 'var(--text-muted)',
            borderBottom: tab === 'string' ? '2px solid var(--brand-primary)' : 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Connection String
        </button>
        <button
          onClick={() => setTab('fields')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0',
            fontSize: '0.9375rem',
            fontWeight: tab === 'fields' ? 600 : 500,
            color: tab === 'fields' ? 'var(--brand-primary)' : 'var(--text-muted)',
            borderBottom: tab === 'fields' ? '2px solid var(--brand-primary)' : 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Individual Fields
        </button>
      </div>

      {/* ── Tab 1: Connection String ── */}
      {tab === 'string' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder={placeholders[dbType]}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '0.9375rem',
                fontFamily: 'monospace',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                paddingRight: '2.5rem',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '0.25rem',
              }}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            {notes[dbType]}
          </p>

          {dbType === 'postgresql' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                PostgreSQL Schema (optional)
              </label>
              <input
                type="text"
                value={pgSchema}
                onChange={(e) => setPgSchema(e.target.value)}
                placeholder="public (default)"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  fontSize: '0.9375rem',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Individual Fields ── */}
      {tab === 'fields' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { label: 'Host', value: host, setter: setHost, placeholder: 'localhost', type: 'text' },
            { label: 'Port', value: port, setter: setPort, placeholder: dbType === 'mongodb' ? '27017' : '5432', type: 'number' },
            { label: 'Username', value: username, setter: setUsername, placeholder: '', type: 'text' },
            { label: 'Password', value: password, setter: setPassword, placeholder: '', type: 'password' },
            { label: 'Database Name', value: database, setter: setDatabase, placeholder: '', type: 'text' },
            ...(dbType === 'postgresql'
              ? [{ label: 'PostgreSQL Schema', value: pgSchema, setter: setPgSchema, placeholder: 'public (default)', type: 'text' }]
              : []),
          ].map(({ label, value, setter, placeholder, type }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                {label}
              </label>
              <input
                type={type}
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  fontSize: '0.9375rem',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Real-time Cloud Pooler Warning Banner ── */}
      {detectedCloud && (
        <div style={{
          padding: '0.875rem 1rem',
          border: '1px solid #93C5FD',
          borderRadius: '8px',
          backgroundColor: '#EFF6FF',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ️</span>
          <div>
            <strong style={{ color: '#1E40AF', fontSize: '0.875rem' }}>
              {detectedCloud === 'supabase' ? 'Supabase' : detectedCloud === 'neon' ? 'Neon' : detectedCloud === 'railway' ? 'Railway' : 'Render'} Connection Detected
            </strong>
            <p style={{ color: '#1D4ED8', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
              {detectedCloud === 'supabase'
                ? 'For DDL migration actions, ensure you use the Direct Connection URL (port 5432) instead of the transaction pooler URL (port 6543).'
                : detectedCloud === 'neon'
                ? 'Use direct connection (remove -pooler from your hostname) for uninterrupted schema creation.'
                : 'Direct connection configuration detected.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Save Connection Section ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        backgroundColor: '#FAFAFA',
        padding: '0.875rem',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id="save-connection"
            checked={shouldSave}
            onChange={(e) => setShouldSave(e.target.checked)}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <label htmlFor="save-connection" style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
            💾 Save this connection for future use
          </label>
        </div>

        {shouldSave && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              type="text"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder={`Connection name (e.g., My Local ${dbType === 'mongodb' ? 'MongoDB' : 'PostgreSQL'})`}
              style={{
                flex: 1,
                padding: '0.625rem 0.75rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={handleSaveConnectionNow}
              disabled={isSaving || !connectionName.trim()}
              style={{
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '0.625rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: (isSaving || !connectionName.trim()) ? 'not-allowed' : 'pointer',
                opacity: (isSaving || !connectionName.trim()) ? 0.6 : 1,
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              {isSaving ? 'Saving…' : 'Save Connection'}
            </button>
          </div>
        )}

        {saveMessage && (
          <p style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: saveMessage.type === 'success' ? '#16A34A' : '#DC2626',
            margin: 0,
          }}>
            {saveMessage.type === 'success' ? '✅' : '❌'} {saveMessage.text}
          </p>
        )}
      </div>

      {/* ── Connect Button ── */}
      <button
        onClick={handleConnect}
        disabled={isLoading}
        style={{
          backgroundColor: 'var(--brand-primary)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '0.875rem 1.25rem',
          fontSize: '0.9375rem',
          fontWeight: 600,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          transition: 'all 200ms ease',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => {
          if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
        }}
      >
        {isLoading ? 'Connecting & Testing…' : effectiveButtonLabel}
      </button>
    </div>
  );
};
