import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  DatabaseType,
  SchemaOperationType,
  SchemaChangeParams,
  NL2DDLResponse,
  SchemaUpdateRiskItem,
  GeneratedScriptResult,
  SchemaUpdateExecutionResult,
  SchemaHistoryItem,
  SchemaIntrospectedTableInfo,
  ConnectionConfig,
  PostgresIntrospectionResult,
  SourceSchema,
} from '@migrateiq/shared';
import { ConnectionForm } from '../components/ConnectionForm';
import '../styles/schema-update.css';

export interface SchemaUpdateWizardProps {}

export const SchemaUpdateWizard: React.FC<SchemaUpdateWizardProps> = () => {
  // ── Step Navigation State ──────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<number>(1);

  // ── Step 1: Database Selector ──────────────────────────────────────────────
  const [dbType, setDbType] = useState<DatabaseType>('postgresql');

  // ── Step 2: Connection & Introspection ─────────────────────────────────────
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [introspectedTables, setIntrospectedTables] = useState<SchemaIntrospectedTableInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // ── Step 3: Change Specification ───────────────────────────────────────────
  const [builderMode, setBuilderMode] = useState<'form' | 'ai'>('form');

  // Form State
  const [operation, setOperation] = useState<SchemaOperationType>('addColumn');
  const [tableName, setTableName] = useState<string>('');
  const [columnName, setColumnName] = useState<string>('');
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [newTableName, setNewTableName] = useState<string>('');
  const [dataType, setDataType] = useState<string>('VARCHAR(255)');
  const [isNullable, setIsNullable] = useState<boolean>(true);
  const [defaultValue, setDefaultValue] = useState<string>('');
  const [indexName, setIndexName] = useState<string>('');
  const [isUnique, setIsUnique] = useState<boolean>(false);
  const [foreignTable, setForeignTable] = useState<string>('');
  const [foreignColumn, setForeignColumn] = useState<string>('id');
  const [onDelete, setOnDelete] = useState<'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'>('NO ACTION');

  // AI Mode State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isInterpretingAI, setIsInterpretingAI] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<NL2DDLResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Step 4: Risk Assessment ────────────────────────────────────────────────
  const [risks, setRisks] = useState<SchemaUpdateRiskItem[]>([]);
  const [isLoadingRisks, setIsLoadingRisks] = useState<boolean>(false);

  // ── Step 5: Script Preview ─────────────────────────────────────────────────
  const [activeScriptTab, setActiveScriptTab] = useState<'forward' | 'rollback'>('forward');
  const [scripts, setScripts] = useState<GeneratedScriptResult | null>(null);
  const [isGeneratingScripts, setIsGeneratingScripts] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // ── Step 6: Execution Results ──────────────────────────────────────────────
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<SchemaUpdateExecutionResult | null>(null);
  const [historyItems, setHistoryItems] = useState<SchemaHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Current table info helper
  const currentTableInfo = useMemo(() => {
    return introspectedTables.find((t) => t.tableName === tableName);
  }, [introspectedTables, tableName]);

  // Load Schema History
  const loadHistory = useCallback(async () => {
    try {
      const res = await window.electronAPI.invoke<SchemaHistoryItem[]>('schema:get-history');
      if (res.success && res.data) {
        setHistoryItems(res.data);
      }
    } catch (e) {
      console.error('Failed to load schema history:', e);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Handle Connection ──────────────────────────────────────────────────────
  const handleConnect = async (config: ConnectionConfig): Promise<boolean> => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      if (config.type === 'postgresql') {
        const res = await window.electronAPI.invoke<PostgresIntrospectionResult>(
          'db:connect-postgresql',
          config
        );
        if (!res.success || !res.data) {
          setConnectionError(res.error || 'Failed to connect to PostgreSQL');
          return false;
        }

        const tables: SchemaIntrospectedTableInfo[] = res.data.tables.map((t) => ({
          tableName: t.table_name,
          rowCount: 100, // sample estimate
          columns: t.columns.map((c, idx) => ({
            columnName: c,
            dataType: t.column_types[idx] || 'text',
            isNullable: t.is_nullables ? t.is_nullables[idx] === 'YES' : true,
          })),
        }));

        setIntrospectedTables(tables);
        if (tables.length > 0 && !tableName) {
          setTableName(tables[0].tableName);
        }
        setConnectionConfig(config);
        setIsConnected(true);
        return true;
      } else {
        // MongoDB
        const res = await window.electronAPI.invoke<SourceSchema[]>('db:connect-mongodb', config);
        if (!res.success || !res.data) {
          setConnectionError(res.error || 'Failed to connect to MongoDB');
          return false;
        }

        const tables: SchemaIntrospectedTableInfo[] = res.data.map((s) => ({
          tableName: s.collectionName,
          rowCount: s.documentCount,
          columns: s.fields.map((f) => ({
            columnName: f.name,
            dataType: f.bsonType,
            isNullable: f.isNullable,
          })),
        }));

        setIntrospectedTables(tables);
        if (tables.length > 0 && !tableName) {
          setTableName(tables[0].tableName);
        }
        setConnectionConfig(config);
        setIsConnected(true);
        return true;
      }
    } catch (err) {
      setConnectionError((err as Error).message || 'Connection failed');
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // ── Run AI Interpretation ──────────────────────────────────────────────────
  const handleInterpretWithAI = async () => {
    if (!aiPrompt.trim()) return;

    setIsInterpretingAI(true);
    setAiError(null);
    setAiResult(null);

    try {
      const res = await window.electronAPI.invoke<NL2DDLResponse>('schema:interpret-nl2ddl', {
        prompt: aiPrompt,
        databaseType: dbType,
        existingTables: introspectedTables.map((t) => t.tableName),
      });

      if (!res.success || !res.data) {
        setAiError(res.error || 'Could not interpret statement');
        return;
      }

      setAiResult(res.data);
      // Auto populate form
      const data = res.data;
      if (data.operation) setOperation(data.operation);
      if (data.tableName) setTableName(data.tableName);
      if (data.columnName) setColumnName(data.columnName);
      if (data.newColumnName) setNewColumnName(data.newColumnName);
      if (data.newTableName) setNewTableName(data.newTableName);
      if (data.dataType) setDataType(data.dataType);
      if (data.isNullable !== undefined) setIsNullable(data.isNullable);
      if (data.defaultValue !== undefined) setDefaultValue(data.defaultValue);
      if (data.indexName) setIndexName(data.indexName);
      if (data.isUnique !== undefined) setIsUnique(data.isUnique);
      if (data.foreignTable) setForeignTable(data.foreignTable);
      if (data.foreignColumn) setForeignColumn(data.foreignColumn);
    } catch (err) {
      setAiError((err as Error).message || 'AI interpretation failed');
    } finally {
      setIsInterpretingAI(false);
    }
  };

  // ── Construct Current Params ───────────────────────────────────────────────
  const currentParams: SchemaChangeParams = useMemo(() => {
    return {
      databaseType: dbType,
      operation,
      tableName,
      columnName: columnName.trim() || undefined,
      newColumnName: newColumnName.trim() || undefined,
      newTableName: newTableName.trim() || undefined,
      dataType: dataType.trim() || undefined,
      isNullable,
      defaultValue: defaultValue.trim() || undefined,
      indexName: indexName.trim() || undefined,
      isUnique,
      foreignTable: foreignTable.trim() || undefined,
      foreignColumn: foreignColumn.trim() || undefined,
      onDelete,
    };
  }, [
    dbType,
    operation,
    tableName,
    columnName,
    newColumnName,
    newTableName,
    dataType,
    isNullable,
    defaultValue,
    indexName,
    isUnique,
    foreignTable,
    foreignColumn,
    onDelete,
  ]);

  // ── Evaluate Risks ─────────────────────────────────────────────────────────
  const evaluateRisks = useCallback(async () => {
    setIsLoadingRisks(true);
    try {
      const res = await window.electronAPI.invoke<SchemaUpdateRiskItem[]>(
        'schema:analyze-risks',
        {
          params: currentParams,
          tableInfo: currentTableInfo,
        }
      );
      if (res.success && res.data) {
        setRisks(res.data);
      }
    } catch (e) {
      console.error('Failed to analyze risks:', e);
    } finally {
      setIsLoadingRisks(false);
    }
  }, [currentParams, currentTableInfo]);

  // ── Generate Scripts ───────────────────────────────────────────────────────
  const generateScripts = useCallback(async () => {
    setIsGeneratingScripts(true);
    try {
      const res = await window.electronAPI.invoke<GeneratedScriptResult>(
        'schema:generate-scripts',
        {
          params: currentParams,
          schema: connectionConfig?.schema || 'public',
        }
      );
      if (res.success && res.data) {
        setScripts(res.data);
      }
    } catch (e) {
      console.error('Failed to generate scripts:', e);
    } finally {
      setIsGeneratingScripts(false);
    }
  }, [currentParams, connectionConfig]);

  // Step Transition Effects
  useEffect(() => {
    if (currentStep === 4) {
      evaluateRisks();
    } else if (currentStep === 5) {
      generateScripts();
    }
  }, [currentStep, evaluateRisks, generateScripts]);

  // ── Copy Script to Clipboard ───────────────────────────────────────────────
  const handleCopyScript = () => {
    if (!scripts) return;
    const textToCopy =
      activeScriptTab === 'forward' ? scripts.forwardScript : scripts.rollbackScript;
    navigator.clipboard.writeText(textToCopy);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // ── Download Script File ───────────────────────────────────────────────────
  const handleDownloadScript = () => {
    if (!scripts) return;
    const text = activeScriptTab === 'forward' ? scripts.forwardScript : scripts.rollbackScript;
    const blob = new Blob([text], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema_update_${operation}_${tableName}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Execute Schema Update on Live Database ─────────────────────────────────
  const handleApplyUpdate = async () => {
    if (!connectionConfig || !scripts) return;
    setIsConfirmModalOpen(false);
    setIsApplying(true);
    setCurrentStep(6);

    try {
      const res = await window.electronAPI.invoke<SchemaUpdateExecutionResult>(
        'schema:apply-update',
        {
          config: connectionConfig,
          forwardScript: scripts.forwardScript,
          rollbackScript: scripts.rollbackScript,
          params: currentParams,
        }
      );

      if (res.data) {
        setExecutionResult(res.data);
      } else {
        setExecutionResult({
          success: false,
          executionTimeMs: 0,
          message: res.error || 'Failed to apply update',
          error: res.error,
        });
      }
      loadHistory();
    } catch (err) {
      setExecutionResult({
        success: false,
        executionTimeMs: 0,
        message: (err as Error).message || 'Execution error',
        error: (err as Error).message,
      });
    } finally {
      setIsApplying(false);
    }
  };

  // ── 1-Click Auto Fix for NOT NULL ──────────────────────────────────────────
  const handleApplyAutoFix = () => {
    setIsNullable(true);
    setTimeout(() => {
      evaluateRisks();
    }, 50);
  };

  return (
    <div className="su-container">
      {/* ── Top Header & Stepper ── */}
      <header className="su-header">
        <div className="su-title-row">
          <div className="su-title-left">
            <h1 className="su-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Schema Update Assistant
            </h1>
            <span className="su-badge">Workflow C</span>
          </div>

          <button
            className="su-btn su-btn-secondary"
            style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }}
            onClick={() => setShowHistory(!showHistory)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {showHistory ? 'Hide History' : 'Recent Updates'}
          </button>
        </div>

        {/* Stepper Steps */}
        <nav className="su-stepper" aria-label="Wizard Steps">
          {[
            { num: 1, label: 'Database' },
            { num: 2, label: 'Inspect' },
            { num: 3, label: 'Define Change' },
            { num: 4, label: 'Risk Scan' },
            { num: 5, label: 'Preview' },
            { num: 6, label: 'Execute' },
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <button
                type="button"
                className={`su-step-item ${currentStep === s.num ? 'active' : ''} ${
                  currentStep > s.num ? 'completed' : ''
                }`}
                onClick={() => {
                  if (s.num <= currentStep || isConnected) {
                    setCurrentStep(s.num);
                  }
                }}
                disabled={s.num > 2 && !isConnected}
              >
                <span className="su-step-num">
                  {currentStep > s.num ? '✓' : s.num}
                </span>
                <span>{s.label}</span>
              </button>
              {idx < 5 && <div className="su-step-divider" />}
            </React.Fragment>
          ))}
        </nav>
      </header>

      {/* ── Main Content Body ── */}
      <main className="su-body">
        {/* Drawer for History View */}
        {showHistory && (
          <section className="su-card" style={{ borderColor: '#93C5FD', background: '#F8FAFC' }}>
            <div className="su-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="su-card-title">Recent Schema Evolution History</h2>
                <p className="su-card-desc">Audit trail of schema changes applied or attempted across databases.</p>
              </div>
              <button className="su-btn su-btn-secondary" onClick={() => setShowHistory(false)}>
                Close
              </button>
            </div>

            {historyItems.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No schema updates recorded yet.</p>
            ) : (
              <div className="su-table-list">
                {historyItems.map((h) => (
                  <div key={h.id} className="su-table-row">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{h.operation}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>on</span>
                        <code style={{ background: '#E2E8F0', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8125rem' }}>
                          {h.tableName}
                        </code>
                        <span className={`su-tag`} style={{ textTransform: 'uppercase' }}>
                          {h.databaseType}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(h.timestamp).toLocaleString()} • {h.durationMs}ms
                      </span>
                    </div>

                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: h.status === 'applied' ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
                        color: h.status === 'applied' ? 'var(--status-success)' : 'var(--status-error)',
                      }}
                    >
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── STEP 1: Choose Target Database ── */}
        {currentStep === 1 && (
          <section className="su-card">
            <div className="su-card-header">
              <h2 className="su-card-title">Step 1 — Select Target Database</h2>
              <p className="su-card-desc">
                Choose which database engine you want to safely evolve. MigrateIQ supports transactional DDL on PostgreSQL and native collections update on MongoDB.
              </p>
            </div>

            <div className="su-db-grid">
              {/* PostgreSQL Card */}
              <div
                className={`su-db-card ${dbType === 'postgresql' ? 'selected' : ''}`}
                onClick={() => setDbType('postgresql')}
              >
                <div className="su-db-icon-wrap" style={{ color: '#2563EB' }}>
                  🐘
                </div>
                <h3 className="su-db-card-title">PostgreSQL Database</h3>
                <p className="su-db-card-p">
                  Transactional schema alterations with safe lock timeout, automatic rollback scripts, and relation constraint verification.
                </p>
                <div className="su-feature-tags">
                  <span className="su-tag">ACID Transactions</span>
                  <span className="su-tag">5s Lock Timeout</span>
                  <span className="su-tag">Foreign Keys</span>
                  <span className="su-tag">Type Casting</span>
                </div>
              </div>

              {/* MongoDB Card */}
              <div
                className={`su-db-card ${dbType === 'mongodb' ? 'selected' : ''}`}
                onClick={() => setDbType('mongodb')}
              >
                <div className="su-db-icon-wrap" style={{ color: '#16A34A' }}>
                  🍃
                </div>
                <h3 className="su-db-card-title">MongoDB Database</h3>
                <p className="su-db-card-p">
                  Flexible document updates, collection renaming, secondary index creation, and schema evolution commands.
                </p>
                <div className="su-feature-tags">
                  <span className="su-tag">UpdateMany</span>
                  <span className="su-tag">Compound Indexes</span>
                  <span className="su-tag">Field Unset</span>
                  <span className="su-tag">Collection Rename</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── STEP 2: Database Connection & Introspection ── */}
        {currentStep === 2 && (
          <div>
            <section className="su-card">
              <div className="su-card-header">
                <h2 className="su-card-title">Step 2 — Connect & Inspect Live Tables</h2>
                <p className="su-card-desc">
                  Connect to your live {dbType === 'postgresql' ? 'PostgreSQL' : 'MongoDB'} database to introspect active tables, schema layouts, and row counts.
                </p>
              </div>

              <ConnectionForm
                dbType={dbType}
                isLoading={isConnecting}
                initialConfig={connectionConfig}
                buttonText="Connect & Inspect Schema"
                onConnect={handleConnect}
              />

              {connectionError && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.875rem 1.25rem',
                    background: 'var(--status-error-bg)',
                    border: '1px solid var(--status-error-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--status-error)',
                    fontSize: '0.875rem',
                  }}
                >
                  <strong>Connection Error:</strong> {connectionError}
                </div>
              )}
            </section>

            {isConnected && introspectedTables.length > 0 && (
              <section className="su-card">
                <div className="su-card-header">
                  <h3 className="su-card-title">Introspected Relations ({introspectedTables.length})</h3>
                  <p className="su-card-desc">
                    These active tables and collections were detected on the database. Select any to see columns.
                  </p>
                </div>

                <div className="su-table-list" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {introspectedTables.map((tbl) => (
                    <div
                      key={tbl.tableName}
                      className="su-table-row"
                      style={{
                        cursor: 'pointer',
                        background: tableName === tbl.tableName ? 'var(--brand-primary-light)' : undefined,
                      }}
                      onClick={() => setTableName(tbl.tableName)}
                    >
                      <div>
                        <span className="su-table-name">{tbl.tableName}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {tbl.columns.map((c) => c.columnName).slice(0, 5).join(', ')}
                          {tbl.columns.length > 5 ? ` +${tbl.columns.length - 5} more` : ''}
                        </div>
                      </div>
                      <span className="su-row-count-badge">
                        {tbl.rowCount ? `${tbl.rowCount.toLocaleString()} rows` : 'Active table'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── STEP 3: Define Changes (Dual Mode) ── */}
        {currentStep === 3 && (
          <section className="su-card">
            <div className="su-card-header">
              <h2 className="su-card-title">Step 3 — Define Schema Changes</h2>
              <p className="su-card-desc">
                Construct your schema modification using either the structured Form Builder or natural language AI (Gemini NL2DDL).
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="su-mode-tabs">
              <button
                type="button"
                className={`su-mode-tab ${builderMode === 'form' ? 'active' : ''}`}
                onClick={() => setBuilderMode('form')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                Mode A: Form Builder
              </button>

              <button
                type="button"
                className={`su-mode-tab ${builderMode === 'ai' ? 'active' : ''}`}
                onClick={() => setBuilderMode('ai')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Mode B: Gemini AI NL2DDL
              </button>
            </div>

            {/* MODE A: Structured Form Builder */}
            {builderMode === 'form' && (
              <div className="su-form-grid">
                {/* Operation Dropdown */}
                <div className="su-form-group">
                  <label className="su-label" htmlFor="su-operation">
                    Operation Type
                  </label>
                  <select
                    id="su-operation"
                    className="su-select"
                    value={operation}
                    onChange={(e) => setOperation(e.target.value as SchemaOperationType)}
                  >
                    <option value="addColumn">Add Column / Field</option>
                    <option value="dropColumn">Drop Column / Field</option>
                    <option value="renameColumn">Rename Column</option>
                    <option value="renameTable">Rename Table / Collection</option>
                    {dbType === 'postgresql' && <option value="changeType">Change Column Type</option>}
                    <option value="addIndex">Add Index</option>
                    <option value="dropIndex">Drop Index</option>
                    {dbType === 'postgresql' && <option value="addForeignKey">Add Foreign Key</option>}
                  </select>
                </div>

                {/* Target Table Dropdown / Input */}
                <div className="su-form-group">
                  <label className="su-label" htmlFor="su-table">
                    Target Table / Collection
                  </label>
                  {introspectedTables.length > 0 ? (
                    <select
                      id="su-table"
                      className="su-select"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                    >
                      {introspectedTables.map((t) => (
                        <option key={t.tableName} value={t.tableName}>
                          {t.tableName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="su-table"
                      className="su-input"
                      type="text"
                      placeholder="e.g. users, orders"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                    />
                  )}
                </div>

                {/* Rename Table: New Table Name */}
                {operation === 'renameTable' && (
                  <div className="su-form-group full-width">
                    <label className="su-label" htmlFor="su-new-table">
                      New Table Name
                    </label>
                    <input
                      id="su-new-table"
                      className="su-input"
                      type="text"
                      placeholder="e.g. customer_accounts"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                    />
                  </div>
                )}

                {/* Column Name */}
                {operation !== 'renameTable' && (
                  <div className="su-form-group">
                    <label className="su-label" htmlFor="su-column">
                      {operation === 'addIndex' || operation === 'dropIndex' ? 'Column to Index' : 'Column Name'}
                    </label>
                    {currentTableInfo && (operation === 'dropColumn' || operation === 'renameColumn' || operation === 'changeType') ? (
                      <select
                        id="su-column"
                        className="su-select"
                        value={columnName}
                        onChange={(e) => setColumnName(e.target.value)}
                      >
                        <option value="">Select column...</option>
                        {currentTableInfo.columns.map((c) => (
                          <option key={c.columnName} value={c.columnName}>
                            {c.columnName} ({c.dataType})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="su-column"
                        className="su-input"
                        type="text"
                        placeholder="e.g. status, loyalty_points"
                        value={columnName}
                        onChange={(e) => setColumnName(e.target.value)}
                      />
                    )}
                  </div>
                )}

                {/* Rename Column: New Column Name */}
                {operation === 'renameColumn' && (
                  <div className="su-form-group">
                    <label className="su-label" htmlFor="su-new-col">
                      New Column Name
                    </label>
                    <input
                      id="su-new-col"
                      className="su-input"
                      type="text"
                      placeholder="e.g. account_status"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                    />
                  </div>
                )}

                {/* Data Type */}
                {(operation === 'addColumn' || operation === 'changeType') && (
                  <div className="su-form-group">
                    <label className="su-label" htmlFor="su-datatype">
                      Data Type
                    </label>
                    <select
                      id="su-datatype"
                      className="su-select"
                      value={dataType}
                      onChange={(e) => setDataType(e.target.value)}
                    >
                      <option value="VARCHAR(255)">VARCHAR(255)</option>
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="BIGINT">BIGINT</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                      <option value="TIMESTAMP">TIMESTAMP WITH TIME ZONE</option>
                      <option value="NUMERIC(10,2)">NUMERIC(10,2)</option>
                      <option value="JSONB">JSONB</option>
                      <option value="UUID">UUID</option>
                    </select>
                  </div>
                )}

                {/* Add Column: Nullable & Default */}
                {operation === 'addColumn' && (
                  <>
                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-default">
                        Default Value (Optional)
                      </label>
                      <input
                        id="su-default"
                        className="su-input"
                        type="text"
                        placeholder="e.g. 'active', 0, CURRENT_TIMESTAMP"
                        value={defaultValue}
                        onChange={(e) => setDefaultValue(e.target.value)}
                      />
                    </div>

                    <div className="su-form-group" style={{ justifyContent: 'center' }}>
                      <label className="su-checkbox-label">
                        <input
                          type="checkbox"
                          checked={isNullable}
                          onChange={(e) => setIsNullable(e.target.checked)}
                        />
                        <span>Allow NULL values (Nullable)</span>
                      </label>
                    </div>
                  </>
                )}

                {/* Add Index: Options */}
                {operation === 'addIndex' && (
                  <>
                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-idx-name">
                        Index Name (Optional)
                      </label>
                      <input
                        id="su-idx-name"
                        className="su-input"
                        type="text"
                        placeholder={`idx_${tableName}_${columnName || 'col'}`}
                        value={indexName}
                        onChange={(e) => setIndexName(e.target.value)}
                      />
                    </div>
                    <div className="su-form-group" style={{ justifyContent: 'center' }}>
                      <label className="su-checkbox-label">
                        <input
                          type="checkbox"
                          checked={isUnique}
                          onChange={(e) => setIsUnique(e.target.checked)}
                        />
                        <span>Enforce Unique Constraint</span>
                      </label>
                    </div>
                  </>
                )}

                {/* Foreign Key Options */}
                {operation === 'addForeignKey' && (
                  <>
                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-fk-table">
                        Foreign Referenced Table
                      </label>
                      <select
                        id="su-fk-table"
                        className="su-select"
                        value={foreignTable}
                        onChange={(e) => setForeignTable(e.target.value)}
                      >
                        <option value="">Select table...</option>
                        {introspectedTables.map((t) => (
                          <option key={t.tableName} value={t.tableName}>
                            {t.tableName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-fk-col">
                        Referenced Column
                      </label>
                      <input
                        id="su-fk-col"
                        className="su-input"
                        type="text"
                        placeholder="id"
                        value={foreignColumn}
                        onChange={(e) => setForeignColumn(e.target.value)}
                      />
                    </div>

                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-fk-delete">
                        ON DELETE Action
                      </label>
                      <select
                        id="su-fk-delete"
                        className="su-select"
                        value={onDelete}
                        onChange={(e) => setOnDelete(e.target.value as typeof onDelete)}
                      >
                        <option value="NO ACTION">NO ACTION</option>
                        <option value="CASCADE">CASCADE</option>
                        <option value="SET NULL">SET NULL</option>
                        <option value="RESTRICT">RESTRICT</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* MODE B: Gemini AI NL2DDL Text Prompt */}
            {builderMode === 'ai' && (
              <div className="su-ai-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>✨</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                    Describe Your Schema Change in Plain English
                  </span>
                </div>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Gemini translates your request into safe SQL/DDL operations automatically.
                </p>

                <textarea
                  className="su-textarea"
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="e.g. Add column loyalty_points INTEGER with default 0 to customers table"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />

                {/* Example Chips */}
                <div className="su-example-chips">
                  {[
                    `Add column status VARCHAR(50) with default 'active' to ${tableName || 'orders'}`,
                    `Create unique index on ${tableName || 'users'}(email)`,
                    `Rename column is_verified to verified in ${tableName || 'users'}`,
                    `Drop column temp_notes from ${tableName || 'orders'}`,
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="su-chip"
                      onClick={() => setAiPrompt(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                  <button
                    className="su-btn su-btn-primary"
                    disabled={!aiPrompt.trim() || isInterpretingAI}
                    onClick={handleInterpretWithAI}
                  >
                    {isInterpretingAI ? 'Interpreting...' : 'Translate to Schema Change'}
                  </button>
                </div>

                {aiError && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: 'var(--status-error-bg)',
                      color: 'var(--status-error)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {aiError}
                  </div>
                )}

                {aiResult && (
                  <div className="su-ai-interpretation">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        Interpreted Operation: {aiResult.operation}
                      </span>
                      <span
                        className="su-tag"
                        style={{
                          background: aiResult.isFallback ? 'var(--status-warning-bg)' : 'var(--accent-ai-light)',
                          color: aiResult.isFallback ? 'var(--status-warning)' : 'var(--accent-ai)',
                        }}
                      >
                        {aiResult.isFallback ? 'Offline Regex Match' : `Gemini AI (${Math.round(aiResult.confidence * 100)}% Match)`}
                      </span>
                    </div>

                    <p style={{ margin: '0.5rem 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {aiResult.explanation}
                    </p>

                    <button
                      className="su-btn su-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => setBuilderMode('form')}
                    >
                      View & Tweak in Form Builder
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── STEP 4: Risk Assessment ── */}
        {currentStep === 4 && (
          <section className="su-card">
            <div className="su-card-header">
              <h2 className="su-card-title">Step 4 — Automated Risk Assessment</h2>
              <p className="su-card-desc">
                MigrateIQ pre-flight scanner analyzes your changes against table data size, locks, and constraints to prevent production downtime.
              </p>
            </div>

            {isLoadingRisks ? (
              <p style={{ color: 'var(--text-muted)' }}>Scanning schema changes for risks...</p>
            ) : (
              <div>
                {/* Risk Counters */}
                <div className="su-risk-counters">
                  <div className="su-risk-counter critical">
                    <div className="su-risk-count-num" style={{ color: 'var(--status-error)' }}>
                      {risks.filter((r) => r.severity === 'critical').length}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Critical Risks</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Potential failure or data loss</div>
                    </div>
                  </div>

                  <div className="su-risk-counter warning">
                    <div className="su-risk-count-num" style={{ color: 'var(--status-warning)' }}>
                      {risks.filter((r) => r.severity === 'warning').length}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Warnings</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lock delays or cast checks</div>
                    </div>
                  </div>

                  <div className="su-risk-counter info">
                    <div className="su-risk-count-num" style={{ color: 'var(--status-success)' }}>
                      {risks.filter((r) => r.severity === 'info').length}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Safe Checks</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Backward compatible</div>
                    </div>
                  </div>
                </div>

                {/* Risk Cards */}
                {risks.map((risk) => (
                  <div key={risk.id} className={`su-risk-card ${risk.severity}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                        {risk.title}
                      </span>
                      <span
                        className="su-tag"
                        style={{
                          textTransform: 'uppercase',
                          color:
                            risk.severity === 'critical'
                              ? 'var(--status-error)'
                              : risk.severity === 'warning'
                              ? 'var(--status-warning)'
                              : 'var(--status-success)',
                        }}
                      >
                        {risk.severity}
                      </span>
                    </div>

                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {risk.description}
                    </p>

                    {/* Auto Fix Button */}
                    {risk.autoFixAvailable && (
                      <div className="su-autofix-bar">
                        <span style={{ fontSize: '0.8125rem', color: '#92400E', fontWeight: 600 }}>
                          1-Click Remediation: {risk.autoFixAction?.description}
                        </span>
                        <button className="su-btn su-btn-primary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }} onClick={handleApplyAutoFix}>
                          Apply Auto-Fix
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── STEP 5: Safe Script Preview ── */}
        {currentStep === 5 && (
          <section className="su-card">
            <div className="su-card-header">
              <h2 className="su-card-title">Step 5 — Script Preview & Safety Verification</h2>
              <p className="su-card-desc">
                Review the exact forward SQL/commands and generated rollback scripts before executing.
              </p>
            </div>

            {/* Checklist */}
            <ul className="su-checklist">
              <li className="su-checklist-item">
                <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>✓</span>
                <span>Lock timeout enforced at <strong>5 seconds</strong> to prevent deadlock blocks.</span>
              </li>
              <li className="su-checklist-item">
                <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>✓</span>
                <span>Wrapped in atomic <strong>BEGIN ... COMMIT</strong> transaction.</span>
              </li>
              <li className="su-checklist-item">
                <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>✓</span>
                <span>Automated rollback script generated and verified.</span>
              </li>
            </ul>

            {/* Tabs for Forward vs Rollback */}
            <div className="su-mode-tabs" style={{ maxWidth: '360px', margin: '1rem 0' }}>
              <button
                type="button"
                className={`su-mode-tab ${activeScriptTab === 'forward' ? 'active' : ''}`}
                onClick={() => setActiveScriptTab('forward')}
              >
                Forward DDL Script
              </button>
              <button
                type="button"
                className={`su-mode-tab ${activeScriptTab === 'rollback' ? 'active' : ''}`}
                onClick={() => setActiveScriptTab('rollback')}
              >
                Rollback Script
              </button>
            </div>

            {/* Code Box */}
            <div className="su-code-container">
              {isGeneratingScripts
                ? '-- Generating safe transaction script...'
                : activeScriptTab === 'forward'
                ? scripts?.forwardScript
                : scripts?.rollbackScript}
            </div>

            {/* Toolbar */}
            <div className="su-code-toolbar">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="su-btn su-btn-secondary" onClick={handleCopyScript}>
                  {copiedScript ? '✓ Copied' : 'Copy Script'}
                </button>
                <button className="su-btn su-btn-secondary" onClick={handleDownloadScript}>
                  Download .sql
                </button>
              </div>

              <button
                className="su-btn su-btn-danger"
                onClick={() => setIsConfirmModalOpen(true)}
              >
                Apply Changes to Live Database
              </button>
            </div>
          </section>
        )}

        {/* ── STEP 6: Execution Results ── */}
        {currentStep === 6 && (
          <section className="su-card">
            <div className="su-card-header">
              <h2 className="su-card-title">Step 6 — Live Execution Result</h2>
              <p className="su-card-desc">
                Outcome of the live schema modification executed against the target database.
              </p>
            </div>

            {isApplying ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                  Applying schema update...
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Acquiring lock and running transactional DDL.
                </p>
              </div>
            ) : executionResult ? (
              <div>
                <div className={`su-result-banner ${executionResult.success ? 'success' : 'failed'}`}>
                  <div style={{ fontSize: '2.5rem' }}>{executionResult.success ? '🎉' : '⚠️'}</div>
                  <h3 className={`su-result-title ${executionResult.success ? 'success' : 'failed'}`}>
                    {executionResult.success ? 'Schema Update Applied Successfully!' : 'Schema Update Aborted'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
                    {executionResult.message}
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Execution Time: {executionResult.executionTimeMs}ms
                  </p>
                </div>

                {executionResult.suggestion && (
                  <div
                    style={{
                      background: '#FEF3C7',
                      border: '1px solid #FCD34D',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                      color: '#92400E',
                    }}
                  >
                    <strong>Remediation Suggestion:</strong> {executionResult.suggestion}
                  </div>
                )}

                {executionResult.sqlExecuted && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                      Executed SQL / Command:
                    </div>
                    <div className="su-code-container" style={{ maxHeight: '180px' }}>
                      {executionResult.sqlExecuted}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    className="su-btn su-btn-primary"
                    onClick={() => {
                      setCurrentStep(3);
                      setAiPrompt('');
                      setAiResult(null);
                      setColumnName('');
                    }}
                  >
                    Perform Another Schema Update
                  </button>

                  <button
                    className="su-btn su-btn-secondary"
                    onClick={() => setShowHistory(true)}
                  >
                    View Updates History
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </main>

      {/* ── Bottom Navigation Bar ── */}
      <footer className="su-footer">
        <div>
          {currentStep > 1 && currentStep < 6 && (
            <button
              className="su-btn su-btn-secondary"
              onClick={() => setCurrentStep((prev) => prev - 1)}
            >
              ← Back
            </button>
          )}
        </div>

        <div>
          {currentStep === 1 && (
            <button
              className="su-btn su-btn-primary"
              onClick={() => setCurrentStep(2)}
            >
              Continue to Connection →
            </button>
          )}

          {currentStep === 2 && (
            <button
              className="su-btn su-btn-primary"
              disabled={!isConnected}
              onClick={() => setCurrentStep(3)}
            >
              Continue to Change Builder →
            </button>
          )}

          {currentStep === 3 && (
            <button
              className="su-btn su-btn-primary"
              disabled={!tableName || (operation !== 'renameTable' && !columnName)}
              onClick={() => setCurrentStep(4)}
            >
              Analyze Risks →
            </button>
          )}

          {currentStep === 4 && (
            <button
              className="su-btn su-btn-primary"
              onClick={() => setCurrentStep(5)}
            >
              Preview Scripts →
            </button>
          )}

          {currentStep === 5 && (
            <button
              className="su-btn su-btn-danger"
              onClick={() => setIsConfirmModalOpen(true)}
            >
              Apply to Live Database
            </button>
          )}
        </div>
      </footer>

      {/* ── Confirmation Modal ── */}
      {isConfirmModalOpen && (
        <div className="su-modal-overlay">
          <div className="su-modal">
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--status-error)' }}>
              Confirm Live Database Modification
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You are about to execute a schema evolution operation on the live database{' '}
              <strong>{connectionConfig?.database}</strong> ({dbType}).
            </p>

            <div
              style={{
                background: 'var(--bg-sidebar)',
                padding: '0.875rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
                marginBottom: '1.5rem',
              }}
            >
              <div><strong>Operation:</strong> {operation}</div>
              <div><strong>Table:</strong> {tableName}</div>
              {columnName && <div><strong>Column:</strong> {columnName}</div>}
              <div><strong>Lock Timeout:</strong> 5 seconds</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="su-btn su-btn-secondary"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="su-btn su-btn-danger"
                onClick={handleApplyUpdate}
              >
                Yes, Execute Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
