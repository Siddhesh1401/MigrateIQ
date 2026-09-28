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
  onChange?: (config?: ConnectionConfig) => void;
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
      return decodeURIComponent(pathname.split('/')[0].split('?')[0]);
    }
  } catch {
    const match = uri.match(/[:\/]\d+\/([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
  }
  return '';
}

export function updateDatabaseInConnectionString(uri: string, newDb: string): string {
  if (!uri || !newDb || typeof uri !== 'string') return uri;
  try {
    const isMongoSrv = uri.startsWith('mongodb+srv://');
    const isMongo = uri.startsWith('mongodb://');
    
    let prefix = '';
    if (isMongoSrv) { prefix = 'mongodb+srv://'; }
    else if (isMongo) { prefix = 'mongodb://'; }
    else if (uri.startsWith('postgresql://')) { prefix = 'postgresql://'; }
    else if (uri.startsWith('postgres://')) { prefix = 'postgres://'; }
    else return uri;

    const dummyUrl = uri.replace(/^[a-z0-9+]+:\/\//i, 'http://');
    const parsed = new URL(dummyUrl);
    parsed.pathname = '/' + encodeURIComponent(newDb.trim());
    
    return parsed.toString().replace(/^http:\/\//, prefix);
  } catch {
    const match = uri.match(/^([a-z0-9+]+:\/\/[^/?#]+)(\/[^?#]*)?(\?.*)?$/i);
    if (match) {
      const base = match[1];
      const search = match[3] || '';
      return `${base}/${encodeURIComponent(newDb.trim())}${search}`;
    }
    return uri;
  }
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

export function getLastUsedConfig(_type: 'mongodb' | 'postgresql'): Partial<ConnectionConfig> | null {
  return null;
}

export function saveLastUsedConfig(_config: ConnectionConfig): void {
  // Forms start fresh and clean; saved connections are managed via electron-store
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

  // Track the last emitted config to prevent echoing our own edits back into form state
  const lastEmittedConfigRef = React.useRef<string | null>(
    initialConfig ? JSON.stringify(initialConfig) : null
  );

  // Synchronize with initialConfig updates (only when changed externally, not from active typing)
  useEffect(() => {
    if (!initialConfig) {
      setConnectionString('');
      setDatabase('');
      setUsername('');
      setPassword('');
      setHost('localhost');
      setPort(dbType === 'mongodb' ? '27017' : '5432');
      setPgSchema('public');
      setConnectionName('');
      setSelectedSavedId('');
      lastEmittedConfigRef.current = null;
      return;
    }

    const serialized = JSON.stringify(initialConfig);
    if (serialized === lastEmittedConfigRef.current) {
      // Echo of our own local typing update — do not overwrite user's in-progress typing!
      return;
    }
    lastEmittedConfigRef.current = serialized;

    const extracted = initialConfig.connectionString
      ? extractDatabaseFromConnectionString(initialConfig.connectionString)
      : '';
    const targetDb = initialConfig.database || extracted || '';

    if (initialConfig.connectionString) {
      setTab('string');
      setConnectionString(initialConfig.connectionString);
      setDatabase(targetDb);
    } else if (initialConfig.host) {
      setTab('fields');
      setHost(initialConfig.host);
      setPort(initialConfig.port ? String(initialConfig.port) : (dbType === 'mongodb' ? '27017' : '5432'));
      setUsername(initialConfig.user || '');
      setPassword(initialConfig.password || '');
      setDatabase(targetDb);
    }
    if (initialConfig.schema) {
      setPgSchema(initialConfig.schema);
    }
    if (initialConfig.name) {
      setConnectionName(initialConfig.name);
    }
  }, [initialConfig, dbType]);

  // Fetch and refresh saved connections list (without auto-select side-effect)
  const refreshSavedConnections = useCallback(async (selectId?: string): Promise<void> => {
    try {
      const response = await window.electronAPI.invoke<SavedConnection[]>('store:get-connections', dbType);
      if (response.success && response.data) {
        setSavedConnections(response.data);
        if (selectId) {
          const found = response.data.find((c) => c.id === selectId);
          if (found) {
            setSelectedSavedId(found.id);
            setConnectionName(found.name);
          }
        }
      }
    } catch { /* silent */ }
  }, [dbType]);

  // Load saved connections once on mount (with optional auto-select matching initialConfig)
  useEffect(() => {
    setLoadingConnections(true);
    window.electronAPI
      .invoke<SavedConnection[]>('store:get-connections', dbType)
      .then((response) => {
        if (response.success && response.data) {
          setSavedConnections(response.data);

          // Auto-select if initialConfig matches a saved connection
          const cfg = initialConfig;
          if (cfg && (cfg.connectionString || cfg.host || cfg.database)) {
            const targetDb = (
              cfg.database ||
              (cfg.connectionString ? extractDatabaseFromConnectionString(cfg.connectionString) : '')
            ).trim().toLowerCase();
            const targetConnStr = (cfg.connectionString || '').trim();

            const match = response.data.find((c) => {
              if (cfg.name && c.name.toLowerCase() === cfg.name.toLowerCase()) return true;
              if (targetConnStr && c.config.connectionString) {
                if (targetConnStr === c.config.connectionString.trim()) return true;
              }
              const savedDb = (
                c.config.database ||
                (c.config.connectionString ? extractDatabaseFromConnectionString(c.config.connectionString) : '')
              ).trim().toLowerCase();
              if (targetDb && (targetDb === savedDb || targetDb === c.name.toLowerCase())) return true;
              if (cfg.host && c.config.host) {
                return (
                  cfg.host === c.config.host &&
                  String(cfg.port) === String(c.config.port) &&
                  cfg.database === c.config.database
                );
              }
              return false;
            });
            if (match) {
              // Only update the dropdown selector, NOT connectionName
              // connectionName is only set when user explicitly picks from the dropdown
              setSelectedSavedId(match.id);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConnections(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbType]);

  const getDefaultConnectionName = (): string => {
    const cleanDb = database.trim() || (connectionString ? extractDatabaseFromConnectionString(connectionString) : '');
    return cleanDb || (dbType === 'mongodb' ? 'mongodb_database' : 'postgres_database');
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
      const finalUri = effectiveDb && trimmedStr ? updateDatabaseInConnectionString(trimmedStr, effectiveDb) : trimmedStr;
      const cfg: ConnectionConfig = {
        type: dbType,
        connectionString: finalUri,
        database: effectiveDb,
        schema: dbType === 'postgresql' ? (pgSchema.trim() || 'public') : undefined,
        name: connectionName.trim() || undefined,
      };
      return cfg;
    }
    const cfg: ConnectionConfig = {
      type: dbType,
      host: host.trim() || 'localhost',
      port: parseInt(port, 10) || (dbType === 'mongodb' ? 27017 : 5432),
      user: username.trim(),
      password,
      database: database.trim() || (dbType === 'mongodb' ? 'test' : 'postgres'),
      schema: dbType === 'postgresql' ? (pgSchema.trim() || 'public') : undefined,
      name: connectionName.trim() || undefined,
    };
    return cfg;
  };

  const handleTabSwitch = (newTab: 'string' | 'fields') => {
    if (newTab === tab) return;
    setTab(newTab);

    if (newTab === 'fields' && connectionString) {
      try {
        const normalized = connectionString
          .replace(/^mongodb\+srv:\/\//, 'http://')
          .replace(/^mongodb:\/\//, 'http://')
          .replace(/^postgresql:\/\//, 'http://')
          .replace(/^postgres:\/\//, 'http://');
        const parsed = new URL(normalized);
        if (parsed.hostname) setHost(parsed.hostname);
        if (parsed.port) setPort(parsed.port);
        if (parsed.username) setUsername(decodeURIComponent(parsed.username));
        if (parsed.password) setPassword(decodeURIComponent(parsed.password));
        const extracted = extractDatabaseFromConnectionString(connectionString);
        if (extracted) setDatabase(extracted);
      } catch {}
    } else if (newTab === 'string') {
      const auth = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
      const effectiveHost = host.trim() || 'localhost';
      const effectivePort = port.trim() || (dbType === 'mongodb' ? '27017' : '5432');
      const effectiveDb = database.trim() || (dbType === 'mongodb' ? 'test' : 'postgres');
      if (!connectionString || connectionString.trim() === '') {
        const synth = dbType === 'mongodb'
          ? `mongodb://${auth}${effectiveHost}:${effectivePort}/${effectiveDb}`
          : `postgresql://${auth}${effectiveHost}:${effectivePort}/${effectiveDb}`;
        setConnectionString(synth);
      } else if (database.trim()) {
        setConnectionString(updateDatabaseInConnectionString(connectionString, database.trim()));
      }
    }

    setTimeout(() => {
      const cfg = buildConfig();
      lastEmittedConfigRef.current = JSON.stringify(cfg);
      saveLastUsedConfig(cfg);
      onChange?.(cfg);
    }, 0);
  };

  type FieldKey = 'host' | 'port' | 'username' | 'password' | 'database' | 'schema';

  const handleFieldChange = (field: FieldKey, val: string) => {
    if (selectedSavedId) setSelectedSavedId('');
    setSaveMessage(null);

    let nextHost = host;
    let nextPort = port;
    let nextUsername = username;
    let nextPassword = password;
    let nextDatabase = database;
    let nextPgSchema = pgSchema;
    let nextConnectionString = connectionString;

    switch (field) {
      case 'host':
        setHost(val);
        nextHost = val;
        break;
      case 'port':
        setPort(val);
        nextPort = val;
        break;
      case 'username':
        setUsername(val);
        nextUsername = val;
        break;
      case 'password':
        setPassword(val);
        nextPassword = val;
        break;
      case 'database':
        setDatabase(val);
        nextDatabase = val;
        if (tab === 'string' && nextConnectionString) {
          nextConnectionString = updateDatabaseInConnectionString(nextConnectionString, val.trim());
          setConnectionString(nextConnectionString);
        }
        break;
      case 'schema':
        setPgSchema(val);
        nextPgSchema = val;
        break;
    }

    const effectiveDb = nextDatabase.trim() || (dbType === 'mongodb' ? 'test' : 'postgres');

    const newConfig: ConnectionConfig = tab === 'string'
      ? {
          type: dbType,
          connectionString: nextConnectionString.trim(),
          database: effectiveDb,
          schema: dbType === 'postgresql' ? (nextPgSchema.trim() || 'public') : undefined,
          name: connectionName.trim() || undefined,
        }
      : {
          type: dbType,
          host: nextHost.trim() || 'localhost',
          port: parseInt(nextPort, 10) || (dbType === 'mongodb' ? 27017 : 5432),
          user: nextUsername,
          password: nextPassword,
          database: effectiveDb,
          schema: dbType === 'postgresql' ? (nextPgSchema.trim() || 'public') : undefined,
          name: connectionName.trim() || undefined,
        };

    lastEmittedConfigRef.current = JSON.stringify(newConfig);
    saveLastUsedConfig(newConfig);
    onChange?.(newConfig);
  };

  const handleConnectionStringChange = (val: string) => {
    setConnectionString(val);
    if (selectedSavedId) setSelectedSavedId('');
    setSaveMessage(null);
    const extracted = extractDatabaseFromConnectionString(val);
    if (extracted) {
      setDatabase(extracted);
    }

    const effectiveDb = extracted || database.trim() || (dbType === 'mongodb' ? 'test' : 'postgres');
    const newConfig: ConnectionConfig = {
      type: dbType,
      connectionString: val.trim(),
      database: effectiveDb,
      schema: dbType === 'postgresql' ? (pgSchema.trim() || 'public') : undefined,
      name: connectionName.trim() || undefined,
    };

    lastEmittedConfigRef.current = JSON.stringify(newConfig);
    saveLastUsedConfig(newConfig);
    onChange?.(newConfig);
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
      onChange?.(undefined);
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

    // Immediately propagate the loaded configuration to the wizard store
    if (onSave) onSave(conn.name, cfg);
    onChange?.(cfg);
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

  // Explicit Save Connection Button handler
  const handleSaveConnectionNow = async (overrideName?: string): Promise<boolean> => {
    const trimmedStr = connectionString.trim();
    const hasDetails = tab === 'string' ? Boolean(trimmedStr) : Boolean(host.trim());
    if (!hasDetails) {
      setSaveMessage({ type: 'error', text: 'Please fill in connection details before saving.' });
      setTimeout(() => setSaveMessage(null), 4000);
      return false;
    }

    // Always derive the save name from the actual database name (not the custom connection label)
    // This prevents Step 2 (source) and Step 3 (target) from using the same label and overwriting each other
    const dbName = (
      database.trim() ||
      (connectionString ? extractDatabaseFromConnectionString(connectionString) : '') ||
      getDefaultConnectionName()
    );
    // Allow explicit override (e.g. user typed a custom name in the "Save this connection" field)
    const nameToSave = (overrideName && overrideName !== dbName
      ? (connectionName.trim() === overrideName ? overrideName : dbName)
      : dbName
    ).trim() || dbName;

    const config = buildConfig();
    // Ensure the name is reflected in config
    const configWithName: typeof config = { ...config, name: nameToSave };

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await window.electronAPI.invoke<SavedConnection>(
        'store:save-connection',
        { name: nameToSave, config: configWithName }
      );

      if (response.success && response.data) {
        setShouldSave(false);
        setSaveMessage({ type: 'success', text: `✅ Saved "${nameToSave}" to saved connections!` });
        // Refresh the dropdown list and select the new entry
        await refreshSavedConnections(response.data.id);
        return true;
      } else {
        setSaveMessage({ type: 'error', text: response.error || 'Failed to save connection' });
        return false;
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: (err as Error).message || 'Failed to save connection' });
      return false;
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 8000);
    }
  };

  const handleConnect = async () => {
    // Always use the database name as the save key — never the saved-connection's custom name
    const saveKey = (
      database.trim() ||
      (connectionString ? extractDatabaseFromConnectionString(connectionString) : '') ||
      getDefaultConnectionName()
    );
    const config = { ...buildConfig(), name: saveKey };

    // Test connection first
    const connectResult = await onConnect(config);

    // If successful: notify wizard store AND auto-save to electron-store
    const isSuccessful = connectResult !== false;
    if (isSuccessful) {
      if (onSave) onSave(saveKey, config);
      await handleSaveConnectionNow(saveKey);
    }
  };

  // Real-time Cloud Host & Pooler Detection
  const targetStr = (tab === 'string' ? connectionString : host).toLowerCase();
  const effectivePort = tab === 'string'
    ? (targetStr.match(/:(\d+)/)?.[1] || (dbType === 'postgresql' ? '5432' : '27017'))
    : String(port || '');

  const isSupabase = targetStr.includes('supabase.co');
  const isSupabasePooler = isSupabase && (effectivePort === '6543' || targetStr.includes(':6543') || targetStr.includes('pooler.supabase'));

  const isNeon = targetStr.includes('neon.tech');
  const isNeonPooler = isNeon && targetStr.includes('-pooler.');

  const isRailway = targetStr.includes('railway.app');
  const isRender = targetStr.includes('render.com') || targetStr.includes('onrender.com');

  const detectedCloud = isSupabase
    ? { provider: 'supabase', isPooler: isSupabasePooler }
    : isNeon
    ? { provider: 'neon', isPooler: isNeonPooler }
    : isRailway
    ? { provider: 'railway', isPooler: false }
    : isRender
    ? { provider: 'render', isPooler: false }
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
            {savedConnections.map((conn) => {
              const displayDb = conn.config.database ? `[${conn.config.database}]` : '';
              const displayName = conn.name === conn.config.database
                ? conn.name
                : `${conn.name} ${displayDb}`.trim();
              return (
                <option key={conn.id} value={conn.id}>
                  {displayName}
                </option>
              );
            })}
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
          onClick={() => handleTabSwitch('string')}
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
          onClick={() => handleTabSwitch('fields')}
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
              <label htmlFor="conn-string-db" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: '#0F172A' }}>
                Database Name {database ? `(Detected: "${database}")` : '(optional override)'}
              </label>
              <input
                id="conn-string-db"
                type="text"
                value={database}
                onChange={(e) => handleFieldChange('database', e.target.value)}
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
                <label htmlFor="conn-string-schema" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: '#0F172A' }}>
                  PostgreSQL Schema (optional)
                </label>
                <input
                  id="conn-string-schema"
                  type="text"
                  value={pgSchema}
                  onChange={(e) => handleFieldChange('schema', e.target.value)}
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
            { label: 'Host', field: 'host' as const, value: host, placeholder: 'localhost', type: 'text' },
            { label: 'Port', field: 'port' as const, value: port, placeholder: dbType === 'mongodb' ? '27017' : '5432', type: 'number' },
            { label: 'Username', field: 'username' as const, value: username, placeholder: 'e.g. postgres', type: 'text' },
            { label: 'Password', field: 'password' as const, value: password, placeholder: '••••••••', type: 'password' },
            { label: 'Database Name', field: 'database' as const, value: database, placeholder: dbType === 'mongodb' ? 'phase9b_source_mongo' : 'phase9b_target_pg', type: 'text' },
            ...(dbType === 'postgresql'
              ? [{ label: 'PostgreSQL Schema', field: 'schema' as const, value: pgSchema, placeholder: 'public (default)', type: 'text' }]
              : []),
          ].map(({ label, field, value, placeholder, type }) => (
            <div key={field}>
              <label htmlFor={`field-${field}`} style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem', color: '#0F172A' }}>
                {label}
              </label>
              <input
                id={`field-${field}`}
                type={type}
                value={value}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
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
          border: `1px solid ${detectedCloud.isPooler ? '#FCD34D' : '#93C5FD'}`,
          borderRadius: '8px',
          backgroundColor: detectedCloud.isPooler ? '#FFFBEB' : '#EFF6FF',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
            {detectedCloud.isPooler ? '⚠️' : 'ℹ️'}
          </span>
          <div>
            <strong style={{
              color: detectedCloud.isPooler ? '#92400E' : '#1E40AF',
              fontSize: '0.875rem'
            }}>
              {detectedCloud.provider === 'supabase'
                ? (detectedCloud.isPooler ? 'Supabase Pooler Detected (Port 6543)' : 'Supabase Direct Connection Detected (Port 5432)')
                : detectedCloud.provider === 'neon'
                ? (detectedCloud.isPooler ? 'Neon Pooler Detected' : 'Neon Direct Connection Detected')
                : detectedCloud.provider === 'railway'
                ? 'Railway Connection Detected'
                : 'Render Connection Detected'}
            </strong>
            <p style={{
              color: detectedCloud.isPooler ? '#B45309' : '#1D4ED8',
              fontSize: '0.8125rem',
              margin: '0.25rem 0 0'
            }}>
              {detectedCloud.provider === 'supabase'
                ? (detectedCloud.isPooler
                    ? 'For DDL migration actions, ensure you switch to the Direct Connection URL (port 5432) instead of the transaction pooler URL (port 6543).'
                    : 'Direct connection configuration verified — optimal for schema creation and batch inserts.')
                : detectedCloud.provider === 'neon'
                ? (detectedCloud.isPooler
                    ? 'Use direct connection (remove -pooler from your hostname) for uninterrupted schema creation.'
                    : 'Direct connection configuration verified — optimal for schema creation and batch inserts.')
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
                const name = connectionName.trim() || getDefaultConnectionName();
                handleSaveConnectionNow(name);
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
              placeholder={getDefaultConnectionName()}
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
