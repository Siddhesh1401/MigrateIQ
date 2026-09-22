import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  DryRunExecutionResult,
  BatchExecutionResult,
  StagedChange,
} from '@migrateiq/shared';
import { ConnectionForm } from '../components/ConnectionForm';
import '../styles/schema-update.css';

export interface SchemaUpdateWizardProps {}

export const SchemaUpdateWizard: React.FC<SchemaUpdateWizardProps> = () => {
  const navigate = useNavigate();

  // ── Step Navigation State ──────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<number>(1);

  // ── Step 1: Database Selector ──────────────────────────────────────────────
  const [dbType, setDbType] = useState<DatabaseType>('postgresql');

  // ── Step 2: Connection & Introspection ─────────────────────────────────────
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [introspectedTables, setIntrospectedTables] = useState<SchemaIntrospectedTableInfo[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
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
  const [scripts, setScripts] = useState<GeneratedScriptResult | null>(null);
  const [isGeneratingScripts, setIsGeneratingScripts] = useState<boolean>(false);
  const [copiedForward, setCopiedForward] = useState<boolean>(false);
  const [copiedRollback, setCopiedRollback] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // ── Step 6: Execution Results ──────────────────────────────────────────────
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<SchemaUpdateExecutionResult | null>(null);
  const [historyItems, setHistoryItems] = useState<SchemaHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // ── Enterprise 10/10 Upgrades State ────────────────────────────────────────
  const [isConcurrently, setIsConcurrently] = useState<boolean>(false);
  const [stagedChanges, setStagedChanges] = useState<StagedChange[]>([]);
  const [isDryRunning, setIsDryRunning] = useState<boolean>(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunExecutionResult | null>(null);

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

  // ── Handle Switching Target Database (Step 1) ──────────────────────────────
  const handleSelectDbType = (newType: DatabaseType) => {
    if (newType !== dbType) {
      setDbType(newType);
      setIsConnected(false);
      setConnectionConfig(null);
      setIntrospectedTables([]);
      setExpandedTable(null);
      setTableName('');
      setColumnName('');
      setNewColumnName('');
      setNewTableName('');
      setDataType(newType === 'mongodb' ? '' : 'VARCHAR(255)');
      setIsNullable(true);
      setDefaultValue('');
      setIndexName('');
      setIsUnique(false);
      setIsConcurrently(false);
      setStagedChanges([]);
      setDryRunResult(null);
      setForeignTable('');
      setForeignColumn('id');
      setRisks([]);
      setScripts(null);
      setExecutionResult(null);
      setConnectionError(null);
      setAiResult(null);
      setAiError(null);
    }
  };

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

        const indexesByTable: Record<string, string[]> = {};
        if (res.data.indexes) {
          res.data.indexes.forEach((idx) => {
            if (!indexesByTable[idx.tablename]) indexesByTable[idx.tablename] = [];
            indexesByTable[idx.tablename].push(idx.indexname);
          });
        }

        const tables: SchemaIntrospectedTableInfo[] = res.data.tables.map((t) => ({
          tableName: t.table_name,
          rowCount: t.estimated_rows ?? 0,
          columns: t.columns.map((c, idx) => ({
            columnName: c,
            dataType: t.column_types[idx] || 'text',
            isNullable: t.is_nullables ? t.is_nullables[idx] === 'YES' : true,
          })),
          indexes: indexesByTable[t.table_name] || [],
        }));

        setIntrospectedTables(tables);
        if (tables.length > 0 && (!tableName || !tables.some((t) => t.tableName === tableName))) {
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
          indexes: [],
        }));

        setIntrospectedTables(tables);
        if (tables.length > 0 && (!tableName || !tables.some((t) => t.tableName === tableName))) {
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
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || undefined,
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
      originalDataType:
        operation === 'changeType'
          ? currentTableInfo?.columns.find((c) => c.columnName === columnName.trim())?.dataType
          : undefined,
      isNullable,
      defaultValue: defaultValue.trim() || undefined,
      indexName: indexName.trim() || undefined,
      isUnique,
      concurrently: isConcurrently,
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
    currentTableInfo,
    isNullable,
    defaultValue,
    indexName,
    isUnique,
    isConcurrently,
    foreignTable,
    foreignColumn,
    onDelete,
  ]);

  // ── Step 3 Form Validity Checker ──────────────────────────────────────────
  const isStep3Valid = useMemo(() => {
    if (!tableName) return false;
    switch (operation) {
      case 'addColumn':
        return dbType === 'postgresql'
          ? Boolean(columnName.trim() && dataType.trim())
          : Boolean(columnName.trim());
      case 'dropColumn':
        return Boolean(columnName.trim());
      case 'renameColumn':
        return Boolean(
          columnName.trim() &&
            newColumnName.trim() &&
            columnName.trim() !== newColumnName.trim()
        );
      case 'renameTable':
        return Boolean(
          newTableName.trim() &&
            tableName.trim() !== newTableName.trim()
        );
      case 'changeType':
        return Boolean(columnName.trim() && dataType.trim());
      case 'addIndex':
        return Boolean(columnName.trim());
      case 'dropIndex':
        return Boolean(indexName.trim() || columnName.trim());
      case 'addForeignKey':
        return Boolean(
          columnName.trim() &&
            foreignTable.trim() &&
            foreignColumn.trim()
        );
      default:
        return false;
    }
  }, [
    dbType,
    tableName,
    operation,
    columnName,
    newColumnName,
    newTableName,
    dataType,
    indexName,
    foreignTable,
    foreignColumn,
  ]);

  // ── Multi-Change Staging Queue Helpers ─────────────────────────────────────
  const formatStep3Summary = (p: SchemaChangeParams): string => {
    switch (p.operation) {
      case 'addColumn':
        return `Add column "${p.columnName}" (${p.dataType || 'VARCHAR'}) to "${p.tableName}"`;
      case 'dropColumn':
        return `Drop column "${p.columnName}" from "${p.tableName}"`;
      case 'renameColumn':
        return `Rename column "${p.columnName}" to "${p.newColumnName}" in "${p.tableName}"`;
      case 'renameTable':
        return `Rename table "${p.tableName}" to "${p.newTableName}"`;
      case 'changeType':
        return `Change type of "${p.columnName}" to ${p.dataType} in "${p.tableName}"`;
      case 'addIndex':
        return `Add ${p.isUnique ? 'unique ' : ''}index ${p.concurrently ? '(CONCURRENTLY) ' : ''}on "${p.tableName}"("${p.columnName}")`;
      case 'dropIndex':
        return `Drop index "${p.indexName || p.columnName}" from "${p.tableName}"`;
      case 'addForeignKey':
        return `Add foreign key from "${p.tableName}"."${p.columnName}" to "${p.foreignTable}"."${p.foreignColumn}"`;
      default:
        return `${p.operation} on ${p.tableName}`;
    }
  };

  const handleAddToStagingQueue = () => {
    if (!isStep3Valid) return;
    const newStaged: StagedChange = {
      id: `staged_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      summary: formatStep3Summary(currentParams),
      params: { ...currentParams },
    };
    setStagedChanges((prev) => [...prev, newStaged]);
    // Reset specific fields for convenient next entry
    setColumnName('');
    setNewColumnName('');
    setDefaultValue('');
    setIndexName('');
    setIsConcurrently(false);
  };

  const handleRemoveFromStagingQueue = (id: string) => {
    setStagedChanges((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearStagingQueue = () => {
    setStagedChanges([]);
  };

  // ── Visual Schema Diff Computation ─────────────────────────────────────────
  interface DiffColumnItem {
    name: string;
    type: string;
    nullable: boolean;
    status: 'unchanged' | 'added' | 'removed' | 'modified';
    oldName?: string;
    oldType?: string;
  }

  const schemaDiff = useMemo(() => {
    if (!currentTableInfo) return null;
    const beforeCols = currentTableInfo.columns || [];
    const afterCols: DiffColumnItem[] = beforeCols.map((c) => ({
      name: c.columnName,
      type: c.dataType,
      nullable: c.isNullable,
      status: 'unchanged',
    }));

    // Apply staged changes on this table
    const relevantStaged = stagedChanges
      .filter((s) => s.params.tableName === currentTableInfo.tableName)
      .map((s) => s.params);

    const relevantChanges = [
      ...relevantStaged,
      ...(currentParams.tableName === currentTableInfo.tableName && isStep3Valid ? [currentParams] : []),
    ];

    for (const change of relevantChanges) {
      if (change.operation === 'addColumn' && change.columnName) {
        afterCols.push({
          name: change.columnName,
          type: change.dataType || 'VARCHAR(255)',
          nullable: change.isNullable !== false,
          status: 'added',
        });
      } else if (change.operation === 'dropColumn' && change.columnName) {
        const found = afterCols.find((c) => c.name === change.columnName);
        if (found) {
          found.status = 'removed';
        }
      } else if (change.operation === 'renameColumn' && change.columnName && change.newColumnName) {
        const found = afterCols.find((c) => c.name === change.columnName);
        if (found) {
          found.oldName = found.name;
          found.name = change.newColumnName;
          found.status = 'modified';
        }
      } else if (change.operation === 'changeType' && change.columnName && change.dataType) {
        const found = afterCols.find((c) => c.name === change.columnName);
        if (found) {
          found.oldType = found.type;
          found.type = change.dataType;
          found.status = 'modified';
        }
      }
    }

    return {
      tableName: currentTableInfo.tableName,
      beforeCols,
      afterCols,
    };
  }, [currentTableInfo, stagedChanges, currentParams, isStep3Valid]);

  // ── Evaluate Risks (Single or Staged Batch) ─────────────────────────────────
  const evaluateRisks = useCallback(async () => {
    setIsLoadingRisks(true);
    try {
      if (stagedChanges.length > 0) {
        const allChanges: SchemaChangeParams[] = [
          ...stagedChanges.map((s) => s.params),
          ...(isStep3Valid ? [currentParams] : []),
        ];
        const allRisks: SchemaUpdateRiskItem[] = [];
        for (const ch of allChanges) {
          const tInfo = introspectedTables.find((t) => t.tableName === ch.tableName);
          const res = await window.electronAPI.invoke<SchemaUpdateRiskItem[]>(
            'schema:analyze-risks',
            {
              params: ch,
              tableInfo: tInfo,
            }
          );
          if (res.success && res.data) {
            allRisks.push(...res.data);
          }
        }
        const seen = new Set<string>();
        const uniqueRisks = allRisks.filter((r) => {
          const key = `${r.id}_${r.title}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setRisks(uniqueRisks);
      } else {
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
      }
    } catch (e) {
      console.error('Failed to analyze risks:', e);
    } finally {
      setIsLoadingRisks(false);
    }
  }, [currentParams, currentTableInfo, stagedChanges, isStep3Valid, introspectedTables]);

  // ── Generate Scripts (Single or Staged Batch) ──────────────────────────────
  const generateScripts = useCallback(async () => {
    setIsGeneratingScripts(true);
    setDryRunResult(null);
    try {
      if (stagedChanges.length > 0) {
        const allChanges: SchemaChangeParams[] = [
          ...stagedChanges.map((s) => s.params),
          ...(isStep3Valid ? [currentParams] : []),
        ];
        const forwardList: string[] = [];
        const rollbackList: string[] = [];
        for (const ch of allChanges) {
          const res = await window.electronAPI.invoke<GeneratedScriptResult>(
            'schema:generate-scripts',
            {
              params: ch,
              schema: connectionConfig?.schema || 'public',
            }
          );
          if (res.success && res.data) {
            forwardList.push(res.data.forwardScript);
            rollbackList.push(res.data.rollbackScript);
          }
        }
        setScripts({
          forwardScript: forwardList.join('\n\n'),
          rollbackScript: rollbackList.reverse().join('\n\n'),
          operationSummary: `Batch execution of ${allChanges.length} schema changes`,
        });
      } else {
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
      }
    } catch (e) {
      console.error('Failed to generate scripts:', e);
    } finally {
      setIsGeneratingScripts(false);
    }
  }, [currentParams, connectionConfig, stagedChanges, isStep3Valid]);

  // Step Transition Effects
  useEffect(() => {
    if (currentStep === 4) {
      evaluateRisks();
    } else if (currentStep === 5) {
      generateScripts();
    }
  }, [currentStep, evaluateRisks, generateScripts]);

  // ── Copy Forward Script to Clipboard ───────────────────────────────────────
  const handleCopyForward = () => {
    if (!scripts?.forwardScript) return;
    navigator.clipboard.writeText(scripts.forwardScript);
    setCopiedForward(true);
    setTimeout(() => setCopiedForward(false), 2000);
  };

  // ── Download Both Scripts Bundle ──────────────────────────────────────────
  const handleDownloadBothScripts = () => {
    if (!scripts) return;
    const bundled = [
      `-- ============================================================`,
      `-- MigrateIQ Schema Update Script Bundle`,
      `-- Database Type: ${dbType.toUpperCase()}`,
      `-- Table: ${tableName} | Operation: ${operation}`,
      `-- Generated: ${new Date().toISOString()}`,
      `-- ============================================================`,
      ``,
      `-- >>> 1. FORWARD DDL SCRIPT >>>`,
      scripts.forwardScript,
      ``,
      `-- ============================================================`,
      `-- >>> 2. ROLLBACK DDL SCRIPT >>>`,
      scripts.rollbackScript,
      `-- ============================================================`,
    ].join('\n');

    const blob = new Blob([bundled], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema_bundle_${operation}_${tableName}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Copy Rollback Script to Clipboard ──────────────────────────────────────
  const handleCopyRollback = () => {
    if (!scripts?.rollbackScript) return;
    navigator.clipboard.writeText(scripts.rollbackScript);
    setCopiedRollback(true);
    setTimeout(() => setCopiedRollback(false), 2000);
  };

  // ── Dry Run Simulation Execution ───────────────────────────────────────────
  const handleExecuteDryRun = async () => {
    if (!connectionConfig) return;
    setIsDryRunning(true);
    setDryRunResult(null);

    const batchToSimulate: SchemaChangeParams[] = [
      ...stagedChanges.map((s) => s.params),
      ...(isStep3Valid ? [currentParams] : []),
    ];

    try {
      const res = await window.electronAPI.invoke<DryRunExecutionResult>(
        'schema:dry-run',
        {
          config: connectionConfig,
          params: batchToSimulate[0] || currentParams,
          batch: batchToSimulate.length > 0 ? batchToSimulate : undefined,
          lockTimeoutMs: 5000,
        }
      );
      if (res.data) {
        setDryRunResult(res.data);
      } else if (res.error) {
        setDryRunResult({
          success: false,
          executionTimeMs: 0,
          simulatedOnly: true,
          message: res.error,
          error: res.error,
        });
      }
    } catch (err: unknown) {
      setDryRunResult({
        success: false,
        executionTimeMs: 0,
        simulatedOnly: true,
        message: (err as Error).message || 'Dry run simulation failed',
        error: (err as Error).message,
      });
    } finally {
      setIsDryRunning(false);
    }
  };

  // ── Execute Schema Update on Live Database ─────────────────────────────────
  const handleApplyUpdate = async () => {
    if (!connectionConfig || !scripts) return;
    setIsConfirmModalOpen(false);
    setIsApplying(true);
    setCurrentStep(6);

    try {
      const batchToExecute: SchemaChangeParams[] = [
        ...stagedChanges.map((s) => s.params),
        ...(isStep3Valid ? [currentParams] : []),
      ];

      if (batchToExecute.length > 1 || stagedChanges.length > 0) {
        const res = await window.electronAPI.invoke<BatchExecutionResult>(
          'schema:execute-batch',
          {
            config: connectionConfig,
            batch: batchToExecute,
          }
        );
        if (res.data) {
          setExecutionResult({
            success: res.data.success,
            executionTimeMs: res.data.totalTimeMs,
            message: res.data.success
              ? `Successfully applied all ${res.data.appliedCount} staged schema change(s) in batch!`
              : `Batch execution: ${res.data.appliedCount} applied, ${res.data.failedCount} failed.`,
            sqlExecuted: res.data.results.map((r) => r.sqlExecuted).filter(Boolean).join('\n\n'),
            error: res.data.errorMessage,
          });
          if (res.data.success) {
            setStagedChanges([]);
          }
        } else {
          setExecutionResult({
            success: false,
            executionTimeMs: 0,
            message: res.error || 'Failed to execute batch',
            error: res.error,
          });
        }
        loadHistory();
        return;
      }

      // Single change execution
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
  const handleApplyAutoFix = async () => {
    setIsNullable(true);
    setIsLoadingRisks(true);
    try {
      const fixedParams: SchemaChangeParams = { ...currentParams, isNullable: true };
      const res = await window.electronAPI.invoke<SchemaUpdateRiskItem[]>(
        'schema:analyze-risks',
        {
          params: fixedParams,
          tableInfo: currentTableInfo,
        }
      );
      if (res.success && res.data) {
        setRisks(res.data);
      }
    } catch (e) {
      console.error('Failed to re-analyze risks:', e);
    } finally {
      setIsLoadingRisks(false);
    }
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
                onClick={() => handleSelectDbType('postgresql')}
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
                onClick={() => handleSelectDbType('mongodb')}
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

              {isConnected && connectionConfig && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1.25rem',
                    color: '#166534',
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>✅ Connected</span>
                  <span>
                    Connected to <strong>{connectionConfig.database || 'Database'}</strong> ({introspectedTables.length} {dbType === 'postgresql' ? 'tables' : 'collections'} found)
                  </span>
                </div>
              )}

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
                    Click any table or collection to inspect columns, data types, nullability, and indexes.
                  </p>
                </div>

                <div className="su-table-list" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                  {introspectedTables.map((tbl) => {
                    const isExpanded = expandedTable === tbl.tableName;
                    const isSelected = tableName === tbl.tableName;

                    return (
                      <div
                        key={tbl.tableName}
                        style={{
                          border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: '0.5rem',
                          background: isSelected ? '#EFF6FF' : '#FFFFFF',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          className="su-table-row"
                          style={{
                            cursor: 'pointer',
                            padding: '0.75rem 1rem',
                            border: 'none',
                            marginBottom: 0,
                            borderRadius: 0,
                            background: 'transparent',
                          }}
                          onClick={() => {
                            setTableName(tbl.tableName);
                            setExpandedTable(isExpanded ? null : tbl.tableName);
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {isExpanded ? '▼' : '▶'}
                              </span>
                              <span className="su-table-name" style={{ fontWeight: 600 }}>{tbl.tableName}</span>
                              {isSelected && (
                                <span className="su-tag" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                                  Selected
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', paddingLeft: '1rem' }}>
                              {tbl.columns.length} columns/fields
                              {tbl.indexes && tbl.indexes.length > 0 ? ` • ${tbl.indexes.length} indexes` : ''}
                            </div>
                          </div>
                          <span className="su-row-count-badge">
                            {tbl.rowCount !== undefined ? `${tbl.rowCount.toLocaleString()} rows` : 'Active'}
                          </span>
                        </div>

                        {/* Collapsible Schema Preview */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: '0.75rem 1rem',
                              borderTop: '1px solid var(--border-color)',
                              background: '#F8FAFC',
                              fontSize: '0.8125rem',
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                              Columns & Fields:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                              {tbl.columns.map((c) => (
                                <span
                                  key={c.columnName}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.2rem 0.5rem',
                                    background: '#FFFFFF',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                  }}
                                >
                                  <strong>{c.columnName}</strong>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    {c.dataType}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '0.05rem 0.3rem',
                                      borderRadius: '3px',
                                      background: c.isNullable ? '#E2E8F0' : '#FEE2E2',
                                      color: c.isNullable ? '#475569' : '#DC2626',
                                    }}
                                  >
                                    {c.isNullable ? 'NULL' : 'NOT NULL'}
                                  </span>
                                </span>
                              ))}
                            </div>

                            {tbl.indexes && tbl.indexes.length > 0 && (
                              <div style={{ marginTop: '0.4rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Indexes: </span>
                                <span style={{ color: 'var(--text-secondary)' }}>{tbl.indexes.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

                {/* Data Type (PostgreSQL only) */}
                {dbType === 'postgresql' && (operation === 'addColumn' || operation === 'changeType') && (
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

                    {/* Zero-Downtime CONCURRENTLY Toggle for PostgreSQL */}
                    {dbType === 'postgresql' && (
                      <div className="su-concurrent-box" style={{ gridColumn: 'span 2' }}>
                        <div className="su-concurrent-info">
                          <span className="su-concurrent-title">
                            ⚡ Zero-Downtime Indexing (CONCURRENTLY)
                          </span>
                          <span className="su-concurrent-desc">
                            Builds index without an exclusive write lock (SHARE UPDATE EXCLUSIVE lock). Safe for live production tables.
                          </span>
                        </div>
                        <div
                          className="su-toggle-container"
                          onClick={() => setIsConcurrently(!isConcurrently)}
                        >
                          <div className={`su-toggle-track ${isConcurrently ? 'active' : ''}`}>
                            <div className="su-toggle-thumb" />
                          </div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isConcurrently ? '#16A34A' : 'var(--text-muted)' }}>
                            {isConcurrently ? 'Active' : 'Off'}
                          </span>
                        </div>
                      </div>
                    )}
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
                    {isInterpretingAI ? 'Interpreting...' : '🤖 Let AI Interpret This'}
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

            {/* Staging Queue Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="su-btn su-btn-secondary"
                disabled={!isStep3Valid}
                onClick={handleAddToStagingQueue}
                style={{ borderColor: '#2563EB', color: '#2563EB', fontWeight: 600 }}
              >
                📥 Stage This Change (+ Add to Batch)
              </button>
            </div>

            {/* Multi-Change Staging Queue Tray */}
            {stagedChanges.length > 0 && (
              <div className="su-staging-tray">
                <div className="su-staging-header">
                  <div className="su-staging-title">
                    <span>📦 Staged Schema Evolution Queue</span>
                    <span className="su-staging-counter">{stagedChanges.length} staged</span>
                  </div>
                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                    onClick={handleClearStagingQueue}
                  >
                    Clear Queue
                  </button>
                </div>

                <div className="su-staging-list">
                  {stagedChanges.map((staged, idx) => (
                    <div key={staged.id} className="su-staging-item">
                      <div className="su-staging-item-left">
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          #{idx + 1}
                        </span>
                        <span className="su-staging-op-tag">
                          {staged.params.operation}
                        </span>
                        <span className="su-staging-summary">
                          {staged.summary}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="su-staging-remove-btn"
                        title="Remove from queue"
                        onClick={() => handleRemoveFromStagingQueue(staged.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Schema Diff Panel */}
            {schemaDiff && currentTableInfo && (
              <div className="su-diff-card">
                <div className="su-diff-header">
                  <div className="su-diff-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                    </svg>
                    <span>Visual Schema Impact Diff: "{schemaDiff.tableName}"</span>
                  </div>
                  <span className="su-tag" style={{ background: '#F1F5F9', color: '#475569' }}>
                    Live Structural Preview
                  </span>
                </div>

                <div className="su-diff-grid">
                  {/* Before */}
                  <div className="su-diff-col">
                    <div className="su-diff-col-header">
                      <span>Current Schema ({schemaDiff.beforeCols.length} columns)</span>
                      <span className="su-diff-col-tag before">Before</span>
                    </div>
                    <div className="su-diff-list">
                      {schemaDiff.beforeCols.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No existing columns introspected</div>
                      ) : (
                        schemaDiff.beforeCols.map((col) => (
                          <div key={col.columnName} className="su-diff-row">
                            <span style={{ fontWeight: 600 }}>{col.columnName}</span>
                            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{col.dataType}</span>
                              <span style={{ fontSize: '0.6875rem', color: col.isNullable ? '#64748B' : '#DC2626' }}>
                                {col.isNullable ? 'NULL' : 'NOT NULL'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* After */}
                  <div className="su-diff-col">
                    <div className="su-diff-col-header">
                      <span>Predicted Schema ({schemaDiff.afterCols.filter((c) => c.status !== 'removed').length} columns)</span>
                      <span className="su-diff-col-tag after">Target After Apply</span>
                    </div>
                    <div className="su-diff-list">
                      {schemaDiff.afterCols.map((col) => (
                        <div key={col.name} className={`su-diff-row ${col.status}`}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{col.name}</span>
                            {col.oldName && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: '0.375rem' }}>
                                (was {col.oldName})
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem' }}>
                              {col.type}
                              {col.oldType && ` (was ${col.oldType})`}
                            </span>
                            {col.status === 'added' && (
                              <span className="su-diff-badge add">+ ADD</span>
                            )}
                            {col.status === 'removed' && (
                              <span className="su-diff-badge drop">- DROP</span>
                            )}
                            {col.status === 'modified' && (
                              <span className="su-diff-badge mod">~ MOD</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
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

                  <div className="su-risk-counter policy" style={{ background: '#F5F3FF', borderColor: '#DDD6FE' }}>
                    <div className="su-risk-count-num" style={{ color: '#7C3AED' }}>
                      {risks.filter((r) => r.severity === 'policy').length}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#5B21B6' }}>Enterprise Policies</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Naming & Standards Guard</div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {risk.severity === 'policy' && (
                          <span className="su-policy-chip">
                            🛡️ {risk.ruleId || 'POLICY'}
                          </span>
                        )}
                        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                          {risk.title}
                        </span>
                      </div>
                      <span
                        className={`su-tag ${risk.severity === 'policy' ? 'su-risk-badge policy' : ''}`}
                        style={{
                          textTransform: 'uppercase',
                          color:
                            risk.severity === 'critical'
                              ? 'var(--status-error)'
                              : risk.severity === 'warning'
                              ? 'var(--status-warning)'
                              : risk.severity === 'policy'
                              ? '#6D28D9'
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
                Review the generated forward DDL and rollback scripts before executing against the live database.
              </p>
            </div>

            {/* Safety Annotations */}
            <ul className="su-checklist">
              <li className="su-checklist-item">
                <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>✓</span>
                <span>Lock timeout enforced at <strong>5 seconds</strong> — query will abort safely if lock cannot be acquired within 5s.</span>
              </li>
              <li className="su-checklist-item">
                <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>✓</span>
                <span>
                  {dbType === 'postgresql'
                    ? 'Wrapped in atomic transaction (BEGIN ... COMMIT) — all changes roll back automatically on error.'
                    : 'Targeted native collection operations with explicit error boundaries.'}
                </span>
              </li>
              <li className="su-checklist-item">
                <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>✓</span>
                <span>Estimated execution time: <strong>&lt; 100ms</strong> for single schema alterations.</span>
              </li>
            </ul>

            {/* Dual Stacked Panels: Forward Script & Rollback Script */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1.25rem 0' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    Forward DDL Script
                  </span>
                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                    onClick={handleCopyForward}
                  >
                    {copiedForward ? '✓ Forward Copied!' : '📋 Copy Forward Script'}
                  </button>
                </div>
                <div className="su-code-container" style={{ maxHeight: '200px' }}>
                  {isGeneratingScripts
                    ? '-- Generating safe forward script...'
                    : scripts?.forwardScript || '-- No forward script generated'}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#B45309' }}>
                    Rollback Script (run this to undo)
                  </span>
                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                    onClick={handleCopyRollback}
                  >
                    {copiedRollback ? '✓ Rollback Copied!' : '📋 Copy Rollback Script'}
                  </button>
                </div>
                <div
                  className="su-code-container"
                  style={{ maxHeight: '180px', borderLeft: '4px solid #F59E0B' }}
                >
                  {isGeneratingScripts
                    ? '-- Generating safe rollback script...'
                    : scripts?.rollbackScript || '-- No rollback script generated'}
                </div>
              </div>
            </div>

            {/* Dry Run Simulation Result Banner */}
            {dryRunResult && (
              <div className={`su-dryrun-box ${dryRunResult.success ? 'pass' : 'fail'}`}>
                <div className="su-dryrun-header">
                  <div className="su-dryrun-status">
                    <span>{dryRunResult.success ? '✅' : '❌'}</span>
                    <span>{dryRunResult.success ? 'Dry-Run Simulation Passed' : 'Dry-Run Simulation Failed'}</span>
                  </div>
                  <span className="su-tag" style={{ background: '#FFFFFF', fontWeight: 700 }}>
                    {dryRunResult.executionTimeMs}ms • Auto-Rolled Back
                  </span>
                </div>
                <div className="su-dryrun-msg">
                  {dryRunResult.message}
                </div>
                {dryRunResult.suggestion && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#92400E', fontWeight: 600 }}>
                    Suggestion: {dryRunResult.suggestion}
                  </div>
                )}
                <div className="su-dryrun-chips">
                  <span className="su-dryrun-chip">Lock Timeout: {dryRunResult.lockTimeoutMs || 5000}ms</span>
                  <span className="su-dryrun-chip">Database: {connectionConfig?.database}</span>
                  <span className="su-dryrun-chip">Zero Persistent Changes</span>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="su-code-toolbar">
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="su-btn su-btn-secondary"
                  onClick={handleDownloadBothScripts}
                >
                  ⬇ Download Both Scripts (.sql)
                </button>

                <button
                  type="button"
                  className="su-btn su-btn-secondary"
                  style={{ borderColor: '#2563EB', color: '#2563EB', fontWeight: 600 }}
                  disabled={isDryRunning}
                  onClick={handleExecuteDryRun}
                >
                  {isDryRunning ? '⏳ Simulating Dry-Run...' : '🧪 Execute Dry-Run (Zero-Downtime Test)'}
                </button>
              </div>

              <button
                type="button"
                className="su-btn su-btn-primary"
                onClick={() => setIsConfirmModalOpen(true)}
              >
                {stagedChanges.length > 0
                  ? `▶ Apply Staged Batch (${stagedChanges.length + (isStep3Valid ? 1 : 0)}) →`
                  : '▶ Apply This Change →'}
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
                  Acquiring lock and running safe transactional schema operations.
                </p>
              </div>
            ) : executionResult ? (
              <div>
                <div className={`su-result-banner ${executionResult.success ? 'success' : 'failed'}`}>
                  <div style={{ fontSize: '2.5rem' }}>{executionResult.success ? '🎉' : '⚠️'}</div>
                  <h3 className={`su-result-title ${executionResult.success ? 'success' : 'failed'}`}>
                    {executionResult.success
                      ? 'Schema Update Applied Successfully!'
                      : 'Schema Update Aborted'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
                    {executionResult.message}
                  </p>
                  {!executionResult.success && (
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--status-error)' }}>
                      The change was not applied. Your database is unchanged.
                    </p>
                  )}
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

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                  {scripts?.rollbackScript && (
                    <button
                      type="button"
                      className="su-btn su-btn-secondary"
                      onClick={handleCopyRollback}
                    >
                      {copiedRollback ? '✓ Rollback Copied!' : '📋 Copy Rollback Script'}
                    </button>
                  )}

                  {!executionResult.success && (
                    <button
                      type="button"
                      className="su-btn su-btn-secondary"
                      style={{ borderColor: 'var(--status-error)', color: 'var(--status-error)' }}
                      onClick={() => setCurrentStep(3)}
                    >
                      ← Fix and Retry
                    </button>
                  )}

                  <button
                    type="button"
                    className="su-btn su-btn-primary"
                    onClick={() => {
                      if (connectionConfig) {
                        handleConnect(connectionConfig);
                      }
                      setCurrentStep(3);
                      setAiPrompt('');
                      setAiResult(null);
                      setColumnName('');
                      setNewColumnName('');
                      setStagedChanges([]);
                      setDryRunResult(null);
                    }}
                  >
                    Make Another Change
                  </button>

                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    onClick={() => setShowHistory(true)}
                  >
                    View Updates History
                  </button>

                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    onClick={() => navigate('/')}
                  >
                    🏠 Go to Dashboard
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
              type="button"
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
              type="button"
              className="su-btn su-btn-primary"
              onClick={() => setCurrentStep(2)}
            >
              Continue to Connection →
            </button>
          )}

          {currentStep === 2 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              disabled={!isConnected}
              onClick={() => setCurrentStep(3)}
            >
              Continue to Change Builder →
            </button>
          )}

          {currentStep === 3 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              disabled={!isStep3Valid && stagedChanges.length === 0}
              onClick={() => setCurrentStep(4)}
            >
              {stagedChanges.length > 0
                ? `Analyze Risks (${stagedChanges.length + (isStep3Valid ? 1 : 0)} Changes) →`
                : 'Analyze Risks →'}
            </button>
          )}

          {currentStep === 4 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              onClick={() => setCurrentStep(5)}
            >
              Preview Scripts →
            </button>
          )}

          {currentStep === 5 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              onClick={() => setIsConfirmModalOpen(true)}
            >
              {stagedChanges.length > 0
                ? `▶ Apply Staged Batch (${stagedChanges.length + (isStep3Valid ? 1 : 0)}) →`
                : '▶ Apply This Change →'}
            </button>
          )}
        </div>
      </footer>

      {/* ── Confirmation Modal ── */}
      {isConfirmModalOpen && (
        <div className="su-modal-overlay">
          <div className="su-modal">
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              Confirm Live Database Modification
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You are about to execute DDL against <strong>{connectionConfig?.database}</strong> ({dbType}). This will modify the live schema.
            </p>

            {stagedChanges.length > 0 ? (
              <div
                style={{
                  background: 'var(--bg-sidebar)',
                  padding: '0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  marginBottom: '1.5rem',
                  border: '1px solid var(--border-color)',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Staged Batch Queue ({stagedChanges.length + (isStep3Valid ? 1 : 0)} changes):
                </div>
                {stagedChanges.map((s, idx) => (
                  <div key={s.id} style={{ marginBottom: '0.25rem' }}>
                    #{idx + 1}: <strong>{s.params.operation}</strong> on <code>{s.params.tableName}</code> — {s.summary}
                  </div>
                ))}
                {isStep3Valid && (
                  <div>
                    #{stagedChanges.length + 1}: <strong>{operation}</strong> on <code>{tableName}</code> — {formatStep3Summary(currentParams)}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                  <strong>Lock Timeout:</strong> 5 seconds
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--bg-sidebar)',
                  padding: '0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  marginBottom: '1.5rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div><strong>Operation:</strong> {operation}</div>
                <div><strong>Table:</strong> {tableName}</div>
                {columnName && <div><strong>Column / Field:</strong> {columnName}</div>}
                {newColumnName && <div><strong>New Name:</strong> {newColumnName}</div>}
                {isConcurrently && <div><strong>Zero-Downtime:</strong> CONCURRENTLY enabled</div>}
                <div><strong>Lock Timeout:</strong> 5 seconds</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="su-btn su-btn-secondary"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="su-btn su-btn-primary"
                onClick={handleApplyUpdate}
              >
                Confirm & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
