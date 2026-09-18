import React, { useState, useEffect, useCallback } from 'react';
import type { ConnectionConfig } from '@migrateiq/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavedConnection {
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
  onConnect: (config: ConnectionConfig) => Promise<boolean | void>;
  onSave?: (name: string, config: ConnectionConfig) => void;
  onChange?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function extractDatabaseFromConnectionString(uri: string): string {
  if (!uri || typeof uri !== 'string') return '';
  try {
    const normalized = uri
      .replace(/^mongodb\+srv:\/\//, 'http://')
      .replace(/^mongodb:\/\//, 'http://')
      .replace(/^postgresql:\/\//, 'http://')
      .replace(/^postgres:\/\//, 'http://');
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.replace(/^\/+/, '');
    if (pathname && pathname !== '/') {
      return pathname.split('/')[0].split('?')[0];
    }
  } catch {
    const match = uri.match(/[:\/]\d+\/([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) return match[1];
  }
  return '';
}

export function extractHostFromConnectionString(uri: string): string {
  if (!uri || typeof uri !== 'string') return '';
  try {
    const normalized = uri
      .replace(/^mongodb\+srv:\/\//, 'http://')
      .replace(/^mongodb:\/\//, 'http://')
      .replace(/^postgresql:\/\//, 'http://')
      .replace(/^postgres:\/\//, 'http://');
    const parsed = new URL(normalized);
    return parsed.host || parsed.hostname || '';
  } catch {
    return '';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  dbType,
  isLoading = false,
  initialConfig,
  buttonText,
  onConnect,
  onSave,
  onChange,
}) => {
  const [tab, setTab] = useState<'string' | 'fields'>(
    initialConfig?.connectionString ? 'string' : (initialConfig?.host ? 'fields' : 'string')
  );
  const [connectionString, setConnectionString] = useState(initialConfig?.connectionString || '');
  const [showPassword, setShowPassword] = useState(true); // Default visible for URI so users can read what they typed
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
  const [database, setDatabase] = useState(
    initialConfig?.database ||
    (initialConfig?.connectionString ? extractDatabaseFromConnectionString(initialConfig.connectionString) : '')
  );
  const [pgSchema, setPgSchema] = useState(initialConfig?.schema || 'public');

  // Saved connections dropdown
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string>('');
  const [loadingConnections, setLoadingConnections] = useState(false);

  // Synchronize with initialConfig updates
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.connectionString) {
        setTab('string');
        setConnectionString(initialConfig.connectionString);
        const extracted = extractDatabaseFromConnectionString(initialConfig.connectionString);
        setDatabase(initialConfig.database || extracted || '');
      } else if (initialConfig.host) {
        setTab('fields');
        setHost(initialConfig.host);
        setPort(initialConfig.port ? String(initialConfig.port) : (dbType === 'mongodb' ? '27017' : '5432'));
        setUsername(initialConfig.user || '');
        setPassword(initialConfig.password || '');
        setDatabase(initialConfig.database || '');
      }
      if (initialConfig.schema) {
        setPgSchema(initialConfig.schema);
      }
      if (initialConfig.name) {
        setConnectionName(initialConfig.name);
      }
    }
  }, [initialConfig, dbType]);

  // Load saved connections for this db type on mount
  const loadSavedConnections = useCallback(() => {
    setLoadingConnections(true);
    window.electronAPI
      .invoke<SavedConnection[]>('store:get-connections', dbType)
      .then((response) => {
        if (response.success && response.data) {
          setSavedConnections(response.data);

          // If initialConfig matches an existing saved connection, auto-select it in dropdown
          if (initialConfig) {
            const match = response.data.find((c) => {
              if (initialConfig.name && c.name.toLowerCase() === initialConfig.name.toLowerCase()) return true;
              if (initialConfig.connectionString && c.config.connectionString) {
                return initialConfig.connectionString.trim() === c.config.connectionString.trim();
              }
              if (initialConfig.host && c.config.host) {
                return (
                  initialConfig.host === c.config.host &&
                  String(initialConfig.port) === String(c.config.port) &&
                  initialConfig.database === c.config.database
                );
              }
              return false;
            });
            if (match) {
              setSelectedSavedId(match.id);
              setConnectionName(match.name);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConnections(false));
  }, [dbType, initialConfig]);

  useEffect(() => {
    loadSavedConnections();
  }, [loadSavedConnections]);

  const handleFieldChange = (setter: (val: string) => void, val: string) => {
    setter(val);
    if (selectedSavedId) setSelectedSavedId('');
    setSaveMessage(null);
    onChange?.();
  };

  const handleConnectionStringChange = (val: string) => {
    setConnectionString(val);
    if (selectedSavedId) setSelectedSavedId('');
    setSaveMessage(null);
    const extracted = extractDatabaseFromConnectionString(val);
    if (extracted) {
      setDatabase(extracted);
    }
    onChange?.();
  };

  const handleLoadSavedConnection = (connId: string) => {
    setSelectedSavedId(connId);
    setSaveMessage(null);

    // If user selected the blank option: clear form cleanly
    if (!connId) {
      setConnectionString('');
      setHost('localhost');
      setPort(dbType === 'mongodb' ? '27017' : '5432');
      setUsername('');
      setPassword('');
      setDatabase('');
      setPgSchema('public');
      setConnectionName('');
      onChange?.();
      return;
    }

    const conn = savedConnections.find((c) => c.id === connId);
    if (!conn) return;

    const cfg = conn.config;
    if (cfg.connectionString) {
      setTab('string');
      setConnectionString(cfg.connectionString);
      const extracted = extractDatabaseFromConnectionString(cfg.connectionString);
      setDatabase(cfg.database || extracted || '');
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
    onChange?.();
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
      } else {
        setSaveMessage({ type: 'error', text: res.error || 'Failed to delete connection' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to delete connection' });
    }
  };

  const getAutoConnectionName = (): string => {
    const trimmedStr = connectionString.trim();
    const extractedDb = extractDatabaseFromConnectionString(trimmedStr);
    const dbLabel = database.trim() || extractedDb || (dbType === 'mongodb' ? 'test' : 'postgres');
    const hostLabel = tab === 'string'
      ? (extractHostFromConnectionString(trimmedStr) || 'localhost')
      : `${host || 'localhost'}:${port || (dbType === 'mongodb' ? '27017' : '5432')}`;
    return `${dbType === 'mongodb' ? 'MongoDB' : 'PostgreSQL'} (${dbLabel} @ ${hostLabel})`;
  };


  const buildConfig = (): ConnectionConfig => {
    if (tab === 'string') {
      const trimmedStr = connectionString.trim();
      const extractedDb = extractDatabaseFromConnectionString(trimmedStr);
      const effectiveDb = database.trim() || extractedDb || (dbType === 'mongodb' ? 'test' : 'postgres');
      return {
        type: dbType,
        connectionString: trimmedStr,
        database: effectiveDb,
        schema: dbType === 'postgresql' ? (pgSchema.trim() || 'public') : undefined,
        name: connectionName.trim() || undefined,
      };
    }
    return {
      type: dbType,
      host: host.trim() || 'localhost',
      port: parseInt(port, 10) || (dbType === 'mongodb' ? 27017 : 5432),
      user: username.trim(),
      password,
      database: database.trim() || (dbType === 'mongodb' ? 'test' : 'postgres'),
      schema: dbType === 'postgresql' ? (pgSchema.trim() || 'public') : undefined,
      name: connectionName.trim() || undefined,
    };
  };

  // Explicit Save Connection Button handler
  const handleSaveConnectionNow = async (overrideName?: string): Promise<boolean> => {
    const nameToSave = (overrideName || connectionName || getAutoConnectionName()).trim();
    if (!nameToSave) {
      setSaveMessage({ type: 'error', text: 'Please enter a name for this connection.' });
      return false;
    }

    const config = buildConfig();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await window.electronAPI.invoke<SavedConnection>(
        'store:save-connection',
        { name: nameToSave, config }
      );

      if (response.success && response.data) {
        setSavedConnections((prev) => {
          const filtered = prev.filter((c) => c.name.toLowerCase() !== nameToSave.toLowerCase());
          return [...filtered, response.data!];
        });
        setSelectedSavedId(response.data.id);
        setSaveMessage({ type: 'success', text: `Saved "${nameToSave}" for future use!` });
        setShouldSave(false);
        setConnectionName(nameToSave);
        if (onSave) onSave(nameToSave, config);
        return true;
      } else {
        setSaveMessage({ type: 'error', text: response.error || 'Failed to save connection' });
        return false;
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save connection' });
      return false;
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleConnect = async () => {
    const config = buildConfig();
    
    // Test connection first
    const connectResult = await onConnect(config);

    // CRITICAL: Only auto-save if connection test actually succeeded!
    const isSuccessful = connectResult !== false;
    if (isSuccessful && shouldSave) {
      const nameToSave = connectionName.trim() || getAutoConnectionName();
      await handleSaveConnectionNow(nameToSave);
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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        backgroundColor: '#F8FAFC',
        padding: '0.875rem 1rem',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
      }}>
        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
          ⚡ Use a Saved Connection {savedConnections.length > 0 ? `(${savedConnections.length} available)` : ''}
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={selectedSavedId}
            onChange={(e) => handleLoadSavedConnection(e.target.value)}
            style={{
              flex: 1,
              padding: '0.625rem 0.75rem',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              fontSize: '0.9rem',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <option value="">
              {loadingConnections ? 'Loading saved connections…' : `— Select saved ${dbType === 'mongodb' ? 'MongoDB' : 'PostgreSQL'} connection —`}
            </option>
            {savedConnections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} {conn.config.database ? `[${conn.config.database}]` : ''}
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
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #E2E8F0' }}>
        <button
          type="button"
          onClick={() => { setTab('string'); onChange?.(); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0',
            fontSize: '0.9375rem',
            fontWeight: tab === 'string' ? 600 : 500,
            color: tab === 'string' ? '#2563EB' : '#64748B',
            borderBottom: tab === 'string' ? '2px solid #2563EB' : 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Connection String
        </button>
        <button
          type="button"
          onClick={() => { setTab('fields'); onChange?.(); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0',
            fontSize: '0.9375rem',
            fontWeight: tab === 'fields' ? 600 : 500,
            color: tab === 'fields' ? '#2563EB' : '#64748B',
            borderBottom: tab === 'fields' ? '2px solid #2563EB' : 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Individual Fields
        </button>
      </div>

      {/* ── Tab 1: Connection String ── */}
      {tab === 'string' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: '#0F172A' }}>
              {dbType === 'mongodb' ? 'MongoDB URI / Connection String' : 'PostgreSQL Connection URL'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={connectionString}
                onChange={(e) => handleConnectionStringChange(e.target.value)}
                placeholder={placeholders[dbType]}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '0.9375rem',
                  fontFamily: 'monospace',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
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
                title={showPassword ? 'Mask sensitive details' : 'Show full connection string'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0.375rem 0 0' }}>
              {notes[dbType]}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: dbType === 'postgresql' ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: '#0F172A' }}>
                Database Name {database ? `(Detected: "${database}")` : '(optional override)'}
              </label>
              <input
                type="text"
                value={database}
                onChange={(e) => handleFieldChange(setDatabase, e.target.value)}
                placeholder={dbType === 'mongodb' ? 'e.g. migrateiq_test' : 'e.g. postgres'}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {dbType === 'postgresql' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: '#0F172A' }}>
                  PostgreSQL Schema (optional)
                </label>
                <input
                  type="text"
                  value={pgSchema}
                  onChange={(e) => handleFieldChange(setPgSchema, e.target.value)}
                  placeholder="public (default)"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            )}
          </div>
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
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: '#0F172A' }}>
                {label}
              </label>
              <input
                type={type}
                value={value}
                onChange={(e) => handleFieldChange(setter, e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '0.9375rem',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
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
        backgroundColor: '#F8FAFC',
        padding: '0.875rem',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="save-connection"
              checked={shouldSave}
              onChange={(e) => {
                setShouldSave(e.target.checked);
                if (e.target.checked && !connectionName.trim()) {
                  setConnectionName(getAutoConnectionName());
                }
              }}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label
              htmlFor="save-connection"
              style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1E293B', cursor: 'pointer', userSelect: 'none' }}
            >
              💾 Save this connection for future use
            </label>
          </div>

          {!shouldSave && (
            <button
              type="button"
              onClick={() => {
                const autoName = connectionName.trim() || getAutoConnectionName();
                handleSaveConnectionNow(autoName);
              }}
              disabled={isSaving}
              style={{
                background: 'none',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '0.3rem 0.625rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                backgroundColor: '#FFFFFF',
              }}
            >
              {isSaving ? 'Saving…' : 'Quick Save Now'}
            </button>
          )}
        </div>

        {shouldSave && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              type="text"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder={getAutoConnectionName()}
              style={{
                flex: 1,
                padding: '0.625rem 0.75rem',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={() => handleSaveConnectionNow()}
              disabled={isSaving}
              style={{
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '0.625rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
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
        type="button"
        onClick={handleConnect}
        disabled={isLoading}
        style={{
          backgroundColor: '#2563EB',
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
          if (!isLoading) e.currentTarget.style.backgroundColor = '#1D4ED8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#2563EB';
        }}
      >
        {isLoading ? 'Connecting & Testing…' : effectiveButtonLabel}
      </button>
    </div>
  );
};
