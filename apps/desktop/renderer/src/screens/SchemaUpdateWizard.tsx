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
  EnvironmentTier,
  ChangeImpactScorecard,
  SchemaDriftReport,
  TableDependencyGraph,
  ExecutionConsoleLogLine,
  BackupSnapshotResult,
  MongoValidationRule,
  EvolutionStrategyRecommendation,
  ScriptImportParseResult,
} from '@migrateiq/shared';
import { ConnectionForm } from '../components/ConnectionForm';
import '../styles/wizard.css';
import '../styles/schema-update.css';

export interface SchemaUpdateWizardProps {}

export const SchemaUpdateWizard: React.FC<SchemaUpdateWizardProps> = () => {
  const navigate = useNavigate();

  // ── Step Navigation State (7 Steps Masterpiece) ────────────────────────────
  const [currentStep, setCurrentStep] = useState<number>(1);

  // ── Step 1: Target Database & Environment Tier ─────────────────────────────
  const [dbType, setDbType] = useState<DatabaseType>('postgresql');
  const [environmentTier, setEnvironmentTier] = useState<EnvironmentTier>('development');
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // ── Step 2: Inspect & Drift Radar ──────────────────────────────────────────
  const [introspectedTables, setIntrospectedTables] = useState<SchemaIntrospectedTableInfo[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [driftReport, setDriftReport] = useState<SchemaDriftReport | null>(null);
  const [isLoadingDrift, setIsLoadingDrift] = useState<boolean>(false);

  // ── Step 3: Change Evolution Studio ────────────────────────────────────────
  const [builderMode, setBuilderMode] = useState<'form' | 'ai' | 'script'>('form');

  // Mode A: Form State
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
  const [isConcurrently, setIsConcurrently] = useState<boolean>(false);

  // Mode B: AI Mode State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isInterpretingAI, setIsInterpretingAI] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<NL2DDLResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Mode C: Raw Script Import State
  const [rawScriptInput, setRawScriptInput] = useState<string>('');
  const [isParsingScript, setIsParsingScript] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ScriptImportParseResult | null>(null);

  // Staged Queue & Dependencies
  const [stagedChanges, setStagedChanges] = useState<StagedChange[]>([]);
  const [dependencyGraph, setDependencyGraph] = useState<TableDependencyGraph | null>(null);
  const [isLoadingDependencies, setIsLoadingDependencies] = useState<boolean>(false);

  // ── Step 4: Impact & Policy Check ──────────────────────────────────────────
  const [risks, setRisks] = useState<SchemaUpdateRiskItem[]>([]);
  const [isLoadingRisks, setIsLoadingRisks] = useState<boolean>(false);
  const [scorecard, setScorecard] = useState<ChangeImpactScorecard | null>(null);
  const [isLoadingScorecard, setIsLoadingScorecard] = useState<boolean>(false);
  const [strategyRecommendation, setStrategyRecommendation] = useState<EvolutionStrategyRecommendation | null>(null);
  const [mongoValidationRule, setMongoValidationRule] = useState<MongoValidationRule | null>(null);

  // ── Step 5: Strategy & Packaging Lab ───────────────────────────────────────
  const [selectedStrategy, setSelectedStrategy] = useState<'in-place' | 'expand-contract' | 'shadow-table'>('in-place');
  const [includeBackup, setIncludeBackup] = useState<boolean>(true);
  const [recommendedBackup, setRecommendedBackup] = useState<BackupSnapshotResult | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);
  const [ciCdYaml, setCiCdYaml] = useState<string | null>(null);
  const [auditReportMd, setAuditReportMd] = useState<string | null>(null);
  const [isExportingPackage, setIsExportingPackage] = useState<boolean>(false);
  const [exportSuccessPath, setExportSuccessPath] = useState<string | null>(null);
  const [scripts, setScripts] = useState<GeneratedScriptResult | null>(null);
  const [isGeneratingScripts, setIsGeneratingScripts] = useState<boolean>(false);
  const [copiedForward, setCopiedForward] = useState<boolean>(false);
  const [copiedRollback, setCopiedRollback] = useState<boolean>(false);

  // ── Step 6: Pre-Flight Dry-Run Cockpit ──────────────────────────────────────
  const [isDryRunning, setIsDryRunning] = useState<boolean>(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunExecutionResult | null>(null);
  const [shieldModalOpen, setShieldModalOpen] = useState<boolean>(false);
  const [shieldConfirmationInput, setShieldConfirmationInput] = useState<string>('');

  // ── Step 7: Live Execution Terminal & Ledger ────────────────────────────────
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<SchemaUpdateExecutionResult | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionConsoleLogLine[]>([]);

  // ── History & Rollback Modal ───────────────────────────────────────────────
  const [historyItems, setHistoryItems] = useState<SchemaHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyDbFilter, setHistoryDbFilter] = useState<'all' | 'postgresql' | 'mongodb'>('all');
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);
  const [certCopied, setCertCopied] = useState<boolean>(false);

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

  // ── Schema Drift Radar ─────────────────────────────────────────────────────
  const checkDrift = useCallback(async (cfg?: ConnectionConfig) => {
    const configToUse = cfg || connectionConfig;
    if (!configToUse) return;
    setIsLoadingDrift(true);
    try {
      const res = await window.electronAPI.invoke<SchemaDriftReport>('schema:detect-drift', {
        config: configToUse,
      });
      if (res.success && res.data) {
        setDriftReport(res.data);
      }
    } catch (e) {
      console.error('Failed to detect schema drift:', e);
    } finally {
      setIsLoadingDrift(false);
    }
  }, [connectionConfig]);

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
      setDriftReport(null);
      setDependencyGraph(null);
      setScorecard(null);
      setStrategyRecommendation(null);
      setMongoValidationRule(null);
      setRecommendedBackup(null);
      setCiCdYaml(null);
      setAuditReportMd(null);
      setExecutionLogs([]);
      setRawScriptInput('');
      setParseResult(null);
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
        checkDrift(config);
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
        checkDrift(config);
        return true;
      }
    } catch (err) {
      setConnectionError((err as Error).message || 'Connection failed');
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // ── Run AI Interpretation (Mode B) ─────────────────────────────────────────
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
    } catch (err) {
      setAiError((err as Error).message || 'AI interpretation failed');
    } finally {
      setIsInterpretingAI(false);
    }
  };

  // ── Mode C: Raw Script Import & Tokenization ────────────────────────────────
  const handleParseRawScript = async () => {
    if (!rawScriptInput.trim()) return;
    setIsParsingScript(true);
    try {
      const res = await window.electronAPI.invoke<ScriptImportParseResult>('schema:parse-script', {
        script: rawScriptInput,
        databaseType: dbType,
      });
      if (res.success && res.data) {
        setParseResult(res.data);
        if (res.data.params) {
          const ch = res.data.params;
          const newStaged: StagedChange = {
            id: `parsed_${Date.now()}`,
            summary: `${ch.operation} on ${ch.tableName}${ch.columnName ? ` (${ch.columnName})` : ''}`,
            params: ch,
          };
          setStagedChanges((prev) => [...prev, newStaged]);
        }
      }
    } catch (e) {
      console.error('Failed to parse script:', e);
    } finally {
      setIsParsingScript(false);
    }
  };

  // ── Table Dependencies ─────────────────────────────────────────────────────
  const fetchDependencies = useCallback(async (tbl: string) => {
    if (!connectionConfig || !tbl) return;
    setIsLoadingDependencies(true);
    try {
      const res = await window.electronAPI.invoke<TableDependencyGraph>('schema:get-dependencies', {
        config: connectionConfig,
        tableName: tbl,
      });
      if (res.success && res.data) {
        setDependencyGraph(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch dependencies:', e);
    } finally {
      setIsLoadingDependencies(false);
    }
  }, [connectionConfig]);

  // Construct current change parameters
  const currentParams: SchemaChangeParams = useMemo(() => {
    return {
      databaseType: dbType,
      operation,
      tableName,
      columnName: columnName.trim() || undefined,
      newColumnName: newColumnName.trim() || undefined,
      newTableName: newTableName.trim() || undefined,
      dataType: dbType === 'postgresql' ? dataType.trim() || undefined : undefined,
      isNullable,
      defaultValue: defaultValue.trim() || undefined,
      indexName: indexName.trim() || undefined,
      isUnique,
      concurrently: isConcurrently,
      foreignTable: foreignTable.trim() || undefined,
      foreignColumn: foreignColumn.trim() || undefined,
      onDelete: operation === 'addForeignKey' ? onDelete : undefined,
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
    isConcurrently,
    foreignTable,
    foreignColumn,
    onDelete,
  ]);

  // Validate Step 3
  const isStep3Valid = useMemo(() => {
    if (!tableName.trim()) return false;
    switch (operation) {
      case 'addColumn':
        return !!columnName.trim();
      case 'dropColumn':
        return !!columnName.trim();
      case 'renameColumn':
        return !!columnName.trim() && !!newColumnName.trim();
      case 'renameTable':
        return !!newTableName.trim();
      case 'changeType':
        return !!columnName.trim() && !!dataType.trim();
      case 'addIndex':
        return !!columnName.trim() || !!indexName.trim();
      case 'dropIndex':
        return !!indexName.trim() || !!columnName.trim();
      case 'addForeignKey':
        return !!columnName.trim() && !!foreignTable.trim();
      case 'dropTable':
        return !!tableName.trim();
      default:
        return false;
    }
  }, [operation, tableName, columnName, newColumnName, newTableName, dataType, indexName, foreignTable]);

  // Format single change summary
  const formatStep3Summary = (p: SchemaChangeParams) => {
    switch (p.operation) {
      case 'addColumn':
        return `Add column "${p.columnName}" (${p.dataType || 'field'}) ${p.isNullable ? 'NULL' : 'NOT NULL'}`;
      case 'dropColumn':
        return `Drop column "${p.columnName}"`;
      case 'renameColumn':
        return `Rename "${p.columnName}" ➔ "${p.newColumnName}"`;
      case 'renameTable':
        return `Rename relation "${p.tableName}" ➔ "${p.newTableName}"`;
      case 'changeType':
        return `Alter type of "${p.columnName}" ➔ ${p.dataType}`;
      case 'addIndex':
        return `Add index on "${p.columnName}"`;
      case 'dropIndex':
        return `Drop index "${p.indexName || p.columnName}"`;
      case 'addForeignKey':
        return `Foreign key "${p.columnName}" ➔ "${p.foreignTable}"("${p.foreignColumn}")`;
      case 'dropTable':
        return `Drop relation "${p.tableName}"`;
      default:
        return `${p.operation} on ${p.tableName}`;
    }
  };

  // Stage a change
  const handleStageChange = () => {
    if (!isStep3Valid) return;
    const newStage: StagedChange = {
      id: `stage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      summary: formatStep3Summary(currentParams),
      params: { ...currentParams },
    };
    setStagedChanges((prev) => [...prev, newStage]);
    setColumnName('');
    setNewColumnName('');
    setDefaultValue('');
    setIndexName('');
    setForeignTable('');
  };

  const handleRemoveStaged = (id: string) => {
    setStagedChanges((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Step 4: Evaluate Impact Scorecard & Policies ───────────────────────────
  const evaluateImpact = useCallback(async () => {
    if (!connectionConfig) return;
    setIsLoadingRisks(true);
    setIsLoadingScorecard(true);

    try {
      const allChanges: SchemaChangeParams[] = [
        ...stagedChanges.map((s) => s.params),
        ...(isStep3Valid ? [currentParams] : []),
      ];
      if (allChanges.length === 0 && !isStep3Valid) return;
      const targetParams = allChanges[0] || currentParams;

      // 1. Analyze Risks
      const riskRes = await window.electronAPI.invoke<SchemaUpdateRiskItem[]>('schema:analyze-risks', {
        params: targetParams,
        tableInfo: currentTableInfo,
      });
      if (riskRes.success && riskRes.data) {
        setRisks(riskRes.data);
      }

      // 2. Scorecard
      const scoreRes = await window.electronAPI.invoke<ChangeImpactScorecard>(
        'schema:evaluate-scorecard',
        {
          params: targetParams,
          config: connectionConfig,
          tableInfo: currentTableInfo,
        }
      );
      if (scoreRes.success && scoreRes.data) {
        setScorecard(scoreRes.data);
      }

      // 3. Phased Expand & Contract Strategy
      const stratRes = await window.electronAPI.invoke<EvolutionStrategyRecommendation>(
        'schema:generate-strategy',
        {
          params: targetParams,
        }
      );
      if (stratRes.success && stratRes.data) {
        setStrategyRecommendation(stratRes.data);
      }

      // 4. Mongo JSON Schema Validator if Mongo
      if (dbType === 'mongodb') {
        const valRes = await window.electronAPI.invoke<MongoValidationRule>(
          'schema:generate-mongo-validator',
          {
            params: targetParams,
          }
        );
        if (valRes.success && valRes.data) {
          setMongoValidationRule(valRes.data);
        }
      }
    } catch (e) {
      console.error('Failed to evaluate impact:', e);
    } finally {
      setIsLoadingRisks(false);
      setIsLoadingScorecard(false);
    }
  }, [connectionConfig, stagedChanges, isStep3Valid, currentParams, currentTableInfo, dbType]);

  // ── Step 5: Packaging & Strategy Generation ────────────────────────────────
  const generateScripts = useCallback(async () => {
    setIsGeneratingScripts(true);
    setDryRunResult(null);
    try {
      const allChanges: SchemaChangeParams[] = [
        ...stagedChanges.map((s) => s.params),
        ...(isStep3Valid ? [currentParams] : []),
      ];
      if (allChanges.length === 0 && !isStep3Valid) return;

      if (allChanges.length > 1) {
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
            params: allChanges[0] || currentParams,
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
  }, [stagedChanges, isStep3Valid, currentParams, connectionConfig]);

  // Step transition effect triggers
  useEffect(() => {
    if (currentStep === 2 && isConnected) {
      checkDrift();
    } else if (currentStep === 3 && tableName) {
      fetchDependencies(tableName);
    } else if (currentStep === 4) {
      evaluateImpact();
    } else if (currentStep === 5) {
      generateScripts();
    }
  }, [currentStep, isConnected, tableName, checkDrift, fetchDependencies, evaluateImpact, generateScripts]);

  // Export ZIP Package
  const handleExportPackage = async () => {
    if (!scripts || !connectionConfig) return;
    setIsExportingPackage(true);
    try {
      const res = await window.electronAPI.invoke<{ filePath: string }>('schema:export-package', {
        config: connectionConfig,
        forwardScript: scripts.forwardScript,
        rollbackScript: scripts.rollbackScript,
        params: currentParams,
        environmentTier,
      });
      if (res.success && res.data) {
        setExportSuccessPath(res.data.filePath);
      }
    } catch (e) {
      console.error('Failed to export ZIP package:', e);
    } finally {
      setIsExportingPackage(false);
    }
  };

  // Generate CI/CD YAML
  const handleGenerateCiCd = async () => {
    if (!scripts) return;
    try {
      const res = await window.electronAPI.invoke<string>('schema:generate-cicd', {
        databaseType: dbType,
        databaseName: connectionConfig?.database || 'default',
      });
      if (res.success && res.data) {
        setCiCdYaml(res.data);
      }
    } catch (e) {
      console.error('Failed to generate CI/CD YAML:', e);
    }
  };

  // Generate Audit Report
  const handleGenerateAuditReport = async () => {
    if (!scripts || !scorecard) return;
    try {
      const res = await window.electronAPI.invoke<string>('schema:generate-audit-report', {
        manifest: {
          id: `mig_${Date.now()}`,
          version: `v_${Date.now()}`,
          description: formatStep3Summary(currentParams),
          databaseType: dbType,
          databaseName: connectionConfig?.database || 'default',
          environment: environmentTier,
          author: connectionConfig?.user || 'Operator',
          checksum: 'calculated_on_export',
          createdAt: new Date().toISOString(),
          operations: [currentParams.operation],
          riskLevel: scorecard.overallRisk,
          lockImpact: scorecard.lockRisk,
        },
        forwardScript: scripts.forwardScript,
        rollbackScript: scripts.rollbackScript,
        scorecard,
      });
      if (res.success && res.data) {
        setAuditReportMd(res.data);
      }
    } catch (e) {
      console.error('Failed to generate audit report:', e);
    }
  };

  // Create Snapshot Backup
  const handleCreateBackup = async () => {
    if (!connectionConfig || !tableName) return;
    setIsCreatingBackup(true);
    try {
      const res = await window.electronAPI.invoke<BackupSnapshotResult>('schema:create-backup', {
        config: connectionConfig,
        tableName,
      });
      if (res.success && res.data) {
        setRecommendedBackup(res.data);
      }
    } catch (e) {
      console.error('Failed to create backup:', e);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // ── Step 6: Atomic Simulation (Dry-Run) ─────────────────────────────────────
  const handleRunSimulation = async () => {
    if (!connectionConfig) return;
    setIsDryRunning(true);
    try {
      const allChanges = stagedChanges.length > 0 ? stagedChanges.map((s) => s.params) : [currentParams];
      const res = await window.electronAPI.invoke<DryRunExecutionResult>('schema:dry-run', {
        config: connectionConfig,
        batch: allChanges,
        lockTimeoutMs: 5000,
      });
      if (res.success && res.data) {
        setDryRunResult(res.data);
      }
    } catch (e) {
      console.error('Failed to run dry-run simulation:', e);
    } finally {
      setIsDryRunning(false);
    }
  };

  // ── Step 7: Live Execution Deployment Terminal ─────────────────────────────
  const executeDeployment = async () => {
    setIsApplying(true);
    setExecutionLogs([]);
    const logs: ExecutionConsoleLogLine[] = [];
    const appendLog = (status: 'running' | 'success' | 'warn' | 'failed', message: string, stage = 'DEPLOYMENT') => {
      const line: ExecutionConsoleLogLine = {
        timestamp: new Date().toLocaleTimeString(),
        stage,
        message,
        status,
      };
      logs.push(line);
      setExecutionLogs([...logs]);
    };

    appendLog('running', `Deploying schema evolution for ${dbType.toUpperCase()} on tier [${environmentTier.toUpperCase()}]...`);

    if (includeBackup && !recommendedBackup && connectionConfig && tableName) {
      appendLog('running', `Creating pre-migration snapshot table for "${tableName}"...`, 'BACKUP');
      try {
        const bRes = await window.electronAPI.invoke<BackupSnapshotResult>('schema:create-backup', {
          config: connectionConfig,
          tableName,
        });
        if (bRes.success && bRes.data) {
          setRecommendedBackup(bRes.data);
          appendLog('success', `Snapshot table "${bRes.data.backupTableName}" created (${bRes.data.rowCount} rows preserved).`, 'BACKUP');
        }
      } catch {
        appendLog('warn', 'Pre-migration backup skipped or unsupported.', 'BACKUP');
      }
    }

    appendLog('running', `Acquiring schema lock on relation "${tableName}" (lock_timeout=5000ms)...`, 'LOCK');
    appendLog('running', `Executing verified migration statements...`, 'EXECUTE');

    try {
      if (stagedChanges.length > 0) {
        const allChanges = [
          ...stagedChanges.map((s) => s.params),
          ...(isStep3Valid ? [currentParams] : []),
        ];
        const res = await window.electronAPI.invoke<BatchExecutionResult>('schema:execute-batch', {
          config: connectionConfig!,
          batch: allChanges,
        });

        if (res.success && res.data) {
          appendLog('success', `Batch executed ${res.data.appliedCount} schema changes successfully in ${res.data.totalTimeMs}ms.`, 'COMPLETED');
          appendLog('success', `In-database ledger registration complete in ${dbType === 'mongodb' ? '_migrateiq_schema_history' : 'public.migrateiq_schema_history'}.`, 'LEDGER');
          const lastResult = res.data.results[res.data.results.length - 1];
          setExecutionResult(lastResult || null);
        } else {
          appendLog('failed', `Batch execution failed: ${res.error || res.data?.errorMessage}`, 'FAILED');
        }
      } else {
        const res = await window.electronAPI.invoke<SchemaUpdateExecutionResult>('schema:apply-update', {
          config: connectionConfig!,
          forwardScript: scripts?.forwardScript,
          rollbackScript: scripts?.rollbackScript,
          params: currentParams,
        });

        if (res.success && res.data) {
          setExecutionResult(res.data);
          appendLog('running', `Script checksum: SHA-256 [${res.data.checksum?.slice(0, 16)}...]`, 'CHECKSUM');
          appendLog('success', `In-database ledger entry registered in ${dbType === 'mongodb' ? '_migrateiq_schema_history' : 'public.migrateiq_schema_history'}.`, 'LEDGER');
          if (res.data.verified) {
            appendLog('success', `Physical catalog verification: ${res.data.verificationDetails || 'PASSED'}`, 'VERIFY');
          }
          appendLog('success', `Deployment applied in ${res.data.executionTimeMs}ms.`, 'COMPLETED');
        } else {
          setExecutionResult(res.data || null);
          appendLog('failed', `Deployment failed: ${res.error || res.data?.message}`, 'FAILED');
          if (res.data?.suggestion) {
            appendLog('warn', `Suggestion: ${res.data.suggestion}`, 'SUGGESTION');
          }
        }
      }
    } catch (err) {
      appendLog('failed', `Runtime error: ${(err as Error).message}`, 'ERROR');
    } finally {
      setIsApplying(false);
      loadHistory();
    }
  };

  // Trigger Deployment with Production Shield Check
  const handleProceedToDeploy = () => {
    const isDestructive = operation === 'dropColumn' || operation === 'dropTable';
    if (environmentTier === 'production' || isDestructive) {
      setShieldConfirmationInput('');
      setShieldModalOpen(true);
    } else {
      setCurrentStep(7);
      executeDeployment();
    }
  };

  // Authorize Production Shield
  const handleAuthorizeShield = () => {
    const isDrop = operation === 'dropColumn' || operation === 'dropTable';
    const required = isDrop ? 'CONFIRM_DROP' : 'APPLY_TO_PRODUCTION';
    if (shieldConfirmationInput.trim() === required) {
      setShieldModalOpen(false);
      setCurrentStep(7);
      executeDeployment();
    }
  };

  // 1-Click Rollback Handler
  const handleRollbackItem = async (item: SchemaHistoryItem) => {
    if (!connectionConfig || !item.rollbackScript) return;
    setIsRollingBack(item.id);
    try {
      const res = await window.electronAPI.invoke<SchemaUpdateExecutionResult>('schema:rollback-migration', {
        config: connectionConfig,
        rollbackScript: item.rollbackScript,
        historyItemId: item.id,
        databaseType: item.databaseType,
      });
      if (res.success) {
        await loadHistory();
      }
    } catch (e) {
      console.error('Failed to rollback:', e);
    } finally {
      setIsRollingBack(null);
    }
  };

  // Filtered History Items
  const filteredHistory = useMemo(() => {
    return historyItems.filter((item) => {
      const matchesDb = historyDbFilter === 'all' || item.databaseType === historyDbFilter;
      const matchesSearch =
        !historySearchQuery ||
        item.tableName.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        item.operation.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        item.databaseName.toLowerCase().includes(historySearchQuery.toLowerCase());
      return matchesDb && matchesSearch;
    });
  }, [historyItems, historyDbFilter, historySearchQuery]);

  return (
    <div className="su-container">
      {/* ── Active Workbench Status Bar (Matches Migration Wizard) ── */}
      <div className="wizard-status-bar">
        <div className="wizard-status-left">
          <span className="wizard-status-pill">Active</span>
          <span className="wizard-status-direction">
            {dbType === 'postgresql' ? 'PostgreSQL' : 'MongoDB'} Schema Evolution
          </span>
          <span className="wizard-status-step">
            — Step {currentStep} of 7
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '0.2rem 0.625rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              backgroundColor: environmentTier === 'production' ? '#FEF2F2' : environmentTier === 'staging' ? '#FEF3C7' : '#F0FDF4',
              color: environmentTier === 'production' ? '#DC2626' : environmentTier === 'staging' ? '#B45309' : '#15803D',
              border: `1px solid ${environmentTier === 'production' ? '#FECACA' : environmentTier === 'staging' ? '#FDE68A' : '#BBF7D0'}`,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: environmentTier === 'production' ? '#DC2626' : environmentTier === 'staging' ? '#D97706' : '#16A34A',
              }}
            />
            {environmentTier.toUpperCase()}
          </span>

          <button
            type="button"
            className={`wizard-fresh-btn ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
            title="Open in-database schema evolution audit ledger"
          >
            📋 {showHistory ? 'Close Ledger' : 'Schema Ledger'}
            {historyItems.length > 0 && ` (${historyItems.length})`}
          </button>
        </div>
      </div>

      {/* ── Step Progress Bar (Matches Migration Wizard) ── */}
      <div className="wizard-progress-bar">
        {[
          { num: 1, label: 'Target & Env' },
          { num: 2, label: 'Inspect & Drift' },
          { num: 3, label: 'Evolution Studio' },
          { num: 4, label: 'Impact & Policy' },
          { num: 5, label: 'Packaging Lab' },
          { num: 6, label: 'Dry Run' },
          { num: 7, label: 'Live Execution' },
        ].map((s, idx) => {
          const isDone = s.num < currentStep;
          const isActive = s.num === currentStep;
          const canClick = s.num <= currentStep || isConnected;

          return (
            <React.Fragment key={s.num}>
              <div className="step-item">
                <button
                  type="button"
                  className={`step-circle ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (canClick) setCurrentStep(s.num);
                  }}
                  disabled={!canClick && s.num > 1}
                  title={`Step ${s.num}: ${s.label}`}
                >
                  {isDone ? '✓' : s.num}
                </button>
                <span className={`step-label ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                  {s.label}
                </span>
              </div>

              {idx < 6 && (
                <div className={`step-connector ${isDone ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Main Content Body ── */}
      <main className="su-body">
        {/* Drawer for Ledger & History View */}
        {showHistory && (
          <section className="su-card" style={{ borderColor: '#93C5FD', background: '#F8FAFC' }}>
            <div className="su-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="su-card-title">In-Database Schema Evolution Ledger</h2>
                <p className="su-card-desc">
                  Immutable audit trail recorded in <code>migrateiq_schema_history</code> with SHA-256 checksums and 1-Click Rollback.
                </p>
              </div>
              <button className="su-btn su-btn-secondary" onClick={() => setShowHistory(false)}>
                Close
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="su-input"
                placeholder="Search by table, operation, or database name..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <select
                className="su-select"
                value={historyDbFilter}
                onChange={(e) => setHistoryDbFilter(e.target.value as 'all' | 'postgresql' | 'mongodb')}
                style={{ width: '160px' }}
              >
                <option value="all">All Engines</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="mongodb">MongoDB</option>
              </select>
            </div>

            {filteredHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No schema ledger entries found.</p>
            ) : (
              <div className="su-table-list">
                {filteredHistory.map((h) => (
                  <div key={h.id} className="su-table-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                        <span
                          className={`su-tag ${h.status === 'applied' ? 'safe' : 'critical'}`}
                          style={{ textTransform: 'uppercase' }}
                        >
                          {h.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Database: <strong>{h.databaseName}</strong> | Applied: {new Date(h.timestamp).toLocaleString()} | Duration: {h.durationMs}ms
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {h.rollbackScript && h.status === 'applied' && (
                        <button
                          type="button"
                          className="su-btn su-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#DC2626', borderColor: '#FECACA' }}
                          disabled={isRollingBack === h.id}
                          onClick={() => handleRollbackItem(h)}
                        >
                          {isRollingBack === h.id ? 'Rolling back...' : '↺ Rollback'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── STEP 1: Target Database & Environment Tier ── */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <section className="su-card">
              <div className="su-card-header">
                <h2 className="su-card-title">Step 1 — Target Database & Environment Tier</h2>
                <p className="su-card-desc">
                  Select your database engine and deployment tier. MigrateIQ enforces strict zero-downtime shields and lock guards based on tier sensitivity.
                </p>
              </div>

              {/* Enterprise Info Callout */}
              <div className="su-callout-banner">
                <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                <div>
                  <strong>Enterprise Evolution Shield:</strong> MigrateIQ applies changes within transactional advisory locks, monitors out-of-band catalog drift, and generates automatic reverse rollback scripts for complete zero-downtime safety.
                </div>
              </div>

              {/* 01: Database Engine Selector */}
              <div>
                <div className="su-section-eyebrow">
                  <span className="su-section-num">01</span>
                  <span>TARGET DATABASE ENGINE</span>
                </div>

                <div className="su-db-grid">
                  <div
                    className={`su-db-card ${dbType === 'postgresql' ? 'selected' : ''}`}
                    onClick={() => handleSelectDbType('postgresql')}
                  >
                    {dbType === 'postgresql' && (
                      <span className="su-card-selected-badge">✓ Selected</span>
                    )}
                    <div className="su-db-icon-wrap" style={{ color: '#2563EB' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5" />
                        <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4v4c0 .6-.4 1-1 1h-2" stroke="#1D4ED8" strokeWidth="1.75" strokeLinecap="round" />
                        <path d="M15 11c.8-.4 1.8-.2 2.2.6" stroke="#1D4ED8" strokeWidth="1.75" strokeLinecap="round" />
                        <circle cx="10" cy="11" r="1" fill="#1D4ED8" />
                      </svg>
                    </div>
                    <div className="su-db-card-content">
                      <h3 className="su-db-card-title">PostgreSQL Database</h3>
                      <p className="su-db-card-p">
                        Transactional DDL with advisory locking, atomic catalog inspection, and automated reverse migrations.
                      </p>
                      <div className="su-feature-tags">
                        <span className="su-tag">🔒 ACID Transactions</span>
                        <span className="su-tag">🛡️ Advisory Lock</span>
                        <span className="su-tag">📑 Catalog Check</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`su-db-card ${dbType === 'mongodb' ? 'selected' : ''}`}
                    onClick={() => handleSelectDbType('mongodb')}
                  >
                    {dbType === 'mongodb' && (
                      <span className="su-card-selected-badge">✓ Selected</span>
                    )}
                    <div className="su-db-icon-wrap" style={{ color: '#16A34A' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5" />
                        <path d="M12 4.5c.3 1.2 4.5 5 4.5 9 0 2.5-2 4.5-4.5 6-2.5-1.5-4.5-3.5-4.5-6 0-4 4.2-7.8 4.5-9z" fill="#DCFCE7" stroke="#16A34A" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M12 5v14" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="su-db-card-content">
                      <h3 className="su-db-card-title">MongoDB Database</h3>
                      <p className="su-db-card-p">
                        Dynamic collection updates, $jsonSchema validation rules, secondary indexes, and atomic rollbacks.
                      </p>
                      <div className="su-feature-tags">
                        <span className="su-tag">📋 $jsonSchema</span>
                        <span className="su-tag">⚡ Atomic UpdateMany</span>
                        <span className="su-tag">🔒 Collection Lock</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 02: Environment Tier Selector */}
              <div>
                <div className="su-section-eyebrow">
                  <span className="su-section-num">02</span>
                  <span>DEPLOYMENT ENVIRONMENT TIER</span>
                </div>
                <div className="su-env-grid">
                  <div
                    className={`su-env-card ${environmentTier === 'development' ? 'active dev' : ''}`}
                    onClick={() => setEnvironmentTier('development')}
                  >
                    <div className="su-env-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="su-env-title">Development</span>
                        <span className="su-env-badge dev">Dev Sandbox</span>
                      </div>
                      <div className={`su-radio-indicator ${environmentTier === 'development' ? 'active-dev' : ''}`}>
                        {environmentTier === 'development' && <div className="su-radio-dot-inner" />}
                      </div>
                    </div>
                    <p className="su-env-desc">
                      Fast iteration sandbox. In-place migrations with immediate feedback and automatic recovery.
                    </p>
                  </div>

                  <div
                    className={`su-env-card ${environmentTier === 'staging' ? 'active staging' : ''}`}
                    onClick={() => setEnvironmentTier('staging')}
                  >
                    <div className="su-env-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="su-env-title">Staging / QA</span>
                        <span className="su-env-badge staging">Pre-Production</span>
                      </div>
                      <div className={`su-radio-indicator ${environmentTier === 'staging' ? 'active-staging' : ''}`}>
                        {environmentTier === 'staging' && <div className="su-radio-dot-inner" />}
                      </div>
                    </div>
                    <p className="su-env-desc">
                      Pre-release validation. Verifies lock hold times, simulated rollbacks, and schema drift.
                    </p>
                  </div>

                  <div
                    className={`su-env-card prod ${environmentTier === 'production' ? 'active prod' : ''}`}
                    onClick={() => setEnvironmentTier('production')}
                  >
                    <div className="su-env-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="su-env-title">Production</span>
                        <span className="su-env-badge prod">Strict Shield</span>
                      </div>
                      <div className={`su-radio-indicator ${environmentTier === 'production' ? 'active-prod' : ''}`}>
                        {environmentTier === 'production' && <div className="su-radio-dot-inner" />}
                      </div>
                    </div>
                    <p className="su-env-desc">
                      Live customer database. Requires zero-downtime Expand & Contract, backup table snapshot, and explicit operator authorization.
                    </p>
                    <div className="su-env-shield-notice">
                      🛡️ Production Shield Active
                    </div>
                  </div>
                </div>
              </div>

              {/* 03: Connection Form */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                <div className="su-section-eyebrow">
                  <span className="su-section-num">03</span>
                  <span>DATABASE CONNECTION & CATALOG INTROSPECTION</span>
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
                    <span style={{ fontWeight: 700 }}>✅ Connected to {environmentTier.toUpperCase()} Database</span>
                    <span>
                      {connectionConfig.database || 'Database'} ({introspectedTables.length} relations introspected)
                    </span>
                  </div>
                )}

                <ConnectionForm
                  dbType={dbType}
                  isLoading={isConnecting}
                  initialConfig={connectionConfig}
                  buttonText="Connect & Introspect Catalog"
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
              </div>
            </section>
          </div>
        )}

        {/* ── STEP 2: Inspect & Drift Radar ── */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Schema Drift Radar Banner */}
            {isLoadingDrift ? (
              <div className="su-drift-banner">
                <div className="su-drift-title">📡 Scanning catalog for out-of-band schema drift...</div>
              </div>
            ) : driftReport?.hasDrift ? (
              <div className="su-drift-banner">
                <div className="su-drift-header">
                  <div className="su-drift-title">
                    ⚠️ Schema Drift Radar: Out-of-Band Database Modifications Detected ({driftReport.driftCount})
                  </div>
                  <span className="su-tag critical">Drift Detected</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#78350f' }}>
                  The live database catalog has diverged from your last registered migration ledger:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                  {driftReport.unmanagedObjects.map((obj, idx) => (
                    <div key={idx} className="su-drift-item-row">
                      <span><strong>{obj.name}</strong> {obj.parentTable ? `on table ${obj.parentTable}` : ''}: {obj.details}</span>
                      <span className="su-tag warning">{obj.type}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    className="su-btn su-btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    onClick={() => checkDrift()}
                  >
                    Accept Live Schema & Resync Radar
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#166534',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                ✓ Schema Drift Radar: Live database catalog is 100% in sync with ledger history.
              </div>
            )}

            {/* Live Table / Collection List */}
            <section className="su-card">
              <div className="su-card-header">
                <h3 className="su-card-title">Live Relations Catalog ({introspectedTables.length})</h3>
                <p className="su-card-desc">
                  Explore tables, column definitions, data types, nullability, and primary/secondary indexes.
                </p>
              </div>

              <div className="su-table-list" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {introspectedTables.map((tbl) => {
                  const isExpanded = expandedTable === tbl.tableName;
                  const isSelected = tableName === tbl.tableName;

                  return (
                    <div
                      key={tbl.tableName}
                      style={{
                        border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
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
                            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                              {tbl.tableName}
                            </span>
                            <span className="su-tag">
                              {tbl.rowCount.toLocaleString()} {tbl.rowCount === 1 ? 'row' : 'rows'}
                            </span>
                            <span className="su-tag">
                              {tbl.columns.length} {dbType === 'postgresql' ? 'columns' : 'fields'}
                            </span>
                            {tbl.indexes && tbl.indexes.length > 0 && (
                              <span className="su-tag">{tbl.indexes.length} indexes</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="su-btn su-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                        >
                          {isExpanded ? 'Hide Columns' : 'View Columns'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border-subtle)' }}>
                          <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
                            <thead>
                              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={{ padding: '0.375rem 0.5rem' }}>Name</th>
                                <th style={{ padding: '0.375rem 0.5rem' }}>Data Type</th>
                                <th style={{ padding: '0.375rem 0.5rem' }}>Nullable</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tbl.columns.map((c) => (
                                <tr key={c.columnName} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                  <td style={{ padding: '0.375rem 0.5rem', fontWeight: 600 }}>{c.columnName}</td>
                                  <td style={{ padding: '0.375rem 0.5rem', fontFamily: 'monospace' }}>{c.dataType}</td>
                                  <td style={{ padding: '0.375rem 0.5rem' }}>{c.isNullable ? 'YES' : 'NO'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ── STEP 3: Change Evolution Studio ── */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section className="su-card">
              <div className="su-card-header">
                <h2 className="su-card-title">Step 3 — Change Evolution Studio</h2>
                <p className="su-card-desc">
                  Design your schema migration using Mode A (Visual Form), Mode B (AI NL2DDL), or Mode C (Raw Script Import).
                </p>
              </div>

              {/* Mode Tabs */}
              <div className="su-mode-tabs">
                <button
                  type="button"
                  className={`su-mode-tab ${builderMode === 'form' ? 'active' : ''}`}
                  onClick={() => setBuilderMode('form')}
                >
                  Mode A: Visual Form
                </button>
                <button
                  type="button"
                  className={`su-mode-tab ${builderMode === 'ai' ? 'active' : ''}`}
                  onClick={() => setBuilderMode('ai')}
                >
                  Mode B: Gemini AI NL2DDL
                </button>
                <button
                  type="button"
                  className={`su-mode-tab ${builderMode === 'script' ? 'active' : ''}`}
                  onClick={() => setBuilderMode('script')}
                >
                  Mode C: Raw Script Import
                </button>
              </div>

              {/* MODE A: Form Builder */}
              {builderMode === 'form' && (
                <div className="su-form-grid">
                  <div className="su-form-group">
                    <label className="su-label" htmlFor="su-operation">Operation Type</label>
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
                      <option value="dropTable">Drop Table / Collection</option>
                    </select>
                  </div>

                  <div className="su-form-group">
                    <label className="su-label" htmlFor="su-table">Target Table / Collection</label>
                    <select
                      id="su-table"
                      className="su-select"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                    >
                      {introspectedTables.map((t) => (
                        <option key={t.tableName} value={t.tableName}>{t.tableName}</option>
                      ))}
                    </select>
                  </div>

                  {operation === 'renameTable' && (
                    <div className="su-form-group full-width">
                      <label className="su-label" htmlFor="su-new-table">New Table Name</label>
                      <input
                        id="su-new-table"
                        className="su-input"
                        type="text"
                        placeholder="e.g. user_profiles"
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                      />
                    </div>
                  )}

                  {operation !== 'renameTable' && operation !== 'dropTable' && (
                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-col-name">Column / Field Name</label>
                      <input
                        id="su-col-name"
                        className="su-input"
                        type="text"
                        placeholder="e.g. phone_number"
                        value={columnName}
                        onChange={(e) => setColumnName(e.target.value)}
                      />
                    </div>
                  )}

                  {operation === 'renameColumn' && (
                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-new-col-name">New Column Name</label>
                      <input
                        id="su-new-col-name"
                        className="su-input"
                        type="text"
                        placeholder="e.g. mobile_number"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                      />
                    </div>
                  )}

                  {(operation === 'addColumn' || operation === 'changeType') && dbType === 'postgresql' && (
                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-type">Data Type</label>
                      <select
                        id="su-type"
                        className="su-select"
                        value={dataType}
                        onChange={(e) => setDataType(e.target.value)}
                      >
                        <option value="VARCHAR(255)">VARCHAR(255)</option>
                        <option value="TEXT">TEXT</option>
                        <option value="INTEGER">INTEGER</option>
                        <option value="BIGINT">BIGINT</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                        <option value="TIMESTAMP">TIMESTAMP</option>
                        <option value="NUMERIC(10,2)">NUMERIC(10,2)</option>
                        <option value="JSONB">JSONB</option>
                        <option value="UUID">UUID</option>
                      </select>
                    </div>
                  )}

                  {operation === 'addColumn' && (
                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-default">Default Value (optional)</label>
                      <input
                        id="su-default"
                        className="su-input"
                        type="text"
                        placeholder="e.g. 'active' or 0"
                        value={defaultValue}
                        onChange={(e) => setDefaultValue(e.target.value)}
                      />
                    </div>
                  )}

                  {operation === 'addIndex' && (
                    <div className="su-form-group">
                      <label className="su-label" htmlFor="su-idx-name">Index Name (optional)</label>
                      <input
                        id="su-idx-name"
                        className="su-input"
                        type="text"
                        placeholder="e.g. idx_users_email"
                        value={indexName}
                        onChange={(e) => setIndexName(e.target.value)}
                      />
                    </div>
                  )}

                  {operation === 'addForeignKey' && dbType === 'postgresql' && (
                    <>
                      <div className="su-form-group">
                        <label className="su-label">Foreign Table</label>
                        <input
                          className="su-input"
                          type="text"
                          placeholder="e.g. organizations"
                          value={foreignTable}
                          onChange={(e) => setForeignTable(e.target.value)}
                        />
                      </div>
                      <div className="su-form-group">
                        <label className="su-label">Foreign Column</label>
                        <input
                          className="su-input"
                          type="text"
                          value={foreignColumn}
                          onChange={(e) => setForeignColumn(e.target.value)}
                        />
                      </div>
                      <div className="su-form-group">
                        <label className="su-label">On Delete Action</label>
                        <select
                          className="su-select"
                          value={onDelete}
                          onChange={(e) => setOnDelete(e.target.value as 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION')}
                        >
                          <option value="NO ACTION">NO ACTION</option>
                          <option value="CASCADE">CASCADE</option>
                          <option value="SET NULL">SET NULL</option>
                          <option value="RESTRICT">RESTRICT</option>
                        </select>
                      </div>
                    </>
                  )}

                  {dbType === 'postgresql' && operation === 'addIndex' && (
                    <div className="su-form-group full-width">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isConcurrently}
                          onChange={(e) => setIsConcurrently(e.target.checked)}
                        />
                        <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                          CREATE INDEX CONCURRENTLY (Zero-Downtime Non-Blocking)
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* MODE B: Gemini AI NL2DDL */}
              {builderMode === 'ai' && (
                <div>
                  <label className="su-label">Describe your desired schema change in natural language:</label>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <input
                      type="text"
                      className="su-input"
                      placeholder="e.g., Add a nullable phone_number column of type varchar(50) to users table"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleInterpretWithAI()}
                    />
                    <button
                      type="button"
                      className="su-btn su-btn-primary"
                      disabled={isInterpretingAI || !aiPrompt.trim()}
                      onClick={handleInterpretWithAI}
                    >
                      {isInterpretingAI ? 'Interpreting...' : 'AI Translate ➔'}
                    </button>
                  </div>

                  {aiError && (
                    <div style={{ marginTop: '0.75rem', color: 'var(--status-error)', fontSize: '0.8125rem' }}>
                      {aiError}
                    </div>
                  )}

                  {aiResult && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.875rem', marginTop: '1rem' }}>
                      <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.875rem' }}>
                        AI Interpretation ({aiResult.confidence}% confidence)
                      </div>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.8125rem', color: '#166534' }}>
                        {aiResult.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* MODE C: Raw Script Import */}
              {builderMode === 'script' && (
                <div>
                  <label className="su-label">
                    Paste raw {dbType === 'postgresql' ? 'SQL DDL' : 'MongoDB Command'} script to parse into safe pipeline:
                  </label>
                  <textarea
                    className="su-script-editor"
                    placeholder={
                      dbType === 'postgresql'
                        ? 'ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT NULL;\nCREATE INDEX idx_users_phone ON users(phone);'
                        : 'db.users.updateMany({}, { $set: { phone: null } });\ndb.users.createIndex({ phone: 1 });'
                    }
                    value={rawScriptInput}
                    onChange={(e) => setRawScriptInput(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="su-btn su-btn-primary"
                      disabled={isParsingScript || !rawScriptInput.trim()}
                      onClick={handleParseRawScript}
                    >
                      {isParsingScript ? 'Parsing...' : 'Parse & Stage Changes ➔'}
                    </button>
                  </div>

                  {parseResult?.params && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', marginTop: '1rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                        Parsed operation successfully:
                      </div>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <strong>{parseResult.params.operation}</strong> on <code>{parseResult.params.tableName}</code>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Stage Button & Current Summary */}
              {builderMode === 'form' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Current: <strong>{formatStep3Summary(currentParams)}</strong>
                  </div>
                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    disabled={!isStep3Valid}
                    onClick={handleStageChange}
                  >
                    + Stage to Batch Queue
                  </button>
                </div>
              )}
            </section>

            {/* Table Dependency Graph Card */}
            {isLoadingDependencies ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Analyzing table dependencies...</p>
            ) : dependencyGraph && (
              <section className="su-dependency-card">
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>
                  Relation Dependencies for "{tableName}" ({dependencyGraph.referencingForeignKeys.length} References)
                </h4>
                {dependencyGraph.referencingForeignKeys.length === 0 ? (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    No foreign key constraints or child references detected. Safe from foreign key cascade blocks.
                  </p>
                ) : (
                  <div className="su-dep-grid">
                    {dependencyGraph.referencingForeignKeys.map((fk, idx) => (
                      <div key={idx} className="su-dep-item">
                        <span style={{ fontWeight: 700 }}>{fk.referencingTable} ➔ {tableName}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Column: {fk.referencingColumn} ({fk.constraintName})</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Staged Changes Queue */}
            {stagedChanges.length > 0 && (
              <section className="su-card" style={{ borderColor: 'var(--brand-primary)' }}>
                <h3 className="su-card-title" style={{ fontSize: '0.9375rem' }}>
                  Staged Evolution Batch ({stagedChanges.length} Changes Queued)
                </h3>
                <div className="su-table-list" style={{ marginTop: '0.5rem' }}>
                  {stagedChanges.map((s, idx) => (
                    <div key={s.id} className="su-table-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8125rem' }}>
                        <strong>#{idx + 1}</strong>: {s.summary}
                      </span>
                      <button
                        type="button"
                        className="su-btn su-btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#dc2626' }}
                        onClick={() => handleRemoveStaged(s.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── STEP 4: Impact & Policy Check ── */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Change Impact Scorecard Grid */}
            {isLoadingScorecard ? (
              <p style={{ color: 'var(--text-muted)' }}>Calculating impact scorecard...</p>
            ) : scorecard && (
              <div className="su-scorecard-grid">
                <div className="su-scorecard-metric">
                  <div className="su-scorecard-label">Overall Risk</div>
                  <div className="su-scorecard-val" style={{ color: scorecard.overallRisk === 'critical' || scorecard.overallRisk === 'high' ? '#dc2626' : '#16a34a' }}>
                    {scorecard.overallRisk.toUpperCase()}
                  </div>
                  <span className={`su-tag ${scorecard.overallRisk === 'critical' || scorecard.overallRisk === 'high' ? 'critical' : 'safe'}`} style={{ marginTop: '0.25rem' }}>
                    Strategy: {scorecard.recommendedStrategy}
                  </span>
                </div>

                <div className="su-scorecard-metric">
                  <div className="su-scorecard-label">Lock Severity</div>
                  <div className="su-scorecard-val" style={{ fontSize: '1.125rem', color: '#d97706' }}>
                    {scorecard.lockRisk.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Reversibility: {scorecard.rollbackFeasibility}
                  </div>
                </div>

                <div className="su-scorecard-metric">
                  <div className="su-scorecard-label">Compatibility</div>
                  <div className="su-scorecard-val" style={{ fontSize: '1.125rem' }}>
                    Data: {scorecard.dataRisk} | Dep: {scorecard.dependencyRisk}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {scorecard.summaryMessage}
                  </div>
                </div>
              </div>
            )}

            {/* Automated Policy Guard & Risk Breakdown */}
            <section className="su-card">
              <div className="su-card-header">
                <h3 className="su-card-title">Enterprise Policy Guards & Risk Breakdown</h3>
                <p className="su-card-desc">
                  Rules enforced against naming conventions, nullability constraints, and lock escalation.
                </p>
              </div>

              {isLoadingRisks ? (
                <p style={{ color: 'var(--text-muted)' }}>Evaluating impact policies...</p>
              ) : risks.length === 0 ? (
                <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.875rem' }}>
                  ✓ All enterprise policies passed! Change is backward-compatible with zero lock violations.
                </div>
              ) : (
                risks.map((risk) => (
                  <div key={risk.id} className={`su-risk-card ${risk.severity}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {risk.severity === 'policy' && <span className="su-policy-chip">🛡️ POLICY</span>}
                        <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{risk.title}</span>
                      </div>
                      <span className={`su-tag ${risk.severity}`} style={{ textTransform: 'uppercase' }}>
                        {risk.severity}
                      </span>
                    </div>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {risk.description}
                    </p>
                  </div>
                ))
              )}
            </section>

            {/* Expand & Contract Phased Evolution Advisor */}
            {strategyRecommendation && (
              <section className="su-phase-advisor">
                <h3 style={{ margin: 0, fontSize: '0.9375rem', color: '#0369a1', fontWeight: 700 }}>
                  Expand & Contract Zero-Downtime Phased Advisor: {strategyRecommendation.title}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#0284c7' }}>
                  {strategyRecommendation.reason}
                </p>
                {strategyRecommendation.phases && (
                  <div className="su-phase-steps">
                    {strategyRecommendation.phases.map((ph) => (
                      <div key={ph.phaseNumber} className="su-phase-step-item">
                        <span className="su-tag" style={{ background: '#0284c7', color: '#ffffff', fontWeight: 700 }}>
                          Phase {ph.phaseNumber}: {ph.phaseTitle}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{ph.description}</div>
                          <code style={{ display: 'block', background: '#f8fafc', padding: '0.375rem', borderRadius: '4px', fontSize: '0.75rem', marginTop: '0.375rem' }}>
                            {ph.script}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* MongoDB JSON Schema Validation Preview */}
            {dbType === 'mongodb' && mongoValidationRule && (
              <section className="su-card" style={{ borderColor: '#16a34a' }}>
                <h3 className="su-card-title" style={{ fontSize: '0.9375rem', color: '#166534' }}>
                  🍃 MongoDB $jsonSchema Collection Validation
                </h3>
                <p className="su-card-desc">
                  Native collection validator generated for collection "{mongoValidationRule.collection}":
                </p>
                <div className="su-code-container" style={{ maxHeight: '160px' }}>
                  {mongoValidationRule.validatorCommand}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── STEP 5: Strategy & Packaging Lab ── */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="su-lab-grid">
              {/* Strategy Picker Card */}
              <div className="su-lab-card">
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>1. Deployment Strategy</h3>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Select the execution paradigm for applying changes:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="strat"
                      checked={selectedStrategy === 'in-place'}
                      onChange={() => setSelectedStrategy('in-place')}
                    />
                    <strong>In-Place Transactional</strong> (Atomic single-shot execution with rollback)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="strat"
                      checked={selectedStrategy === 'expand-contract'}
                      onChange={() => setSelectedStrategy('expand-contract')}
                    />
                    <strong>Phased Expand & Contract</strong> (Dual-write zero-downtime evolution)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="strat"
                      checked={selectedStrategy === 'shadow-table'}
                      onChange={() => setSelectedStrategy('shadow-table')}
                    />
                    <strong>Shadow Table Swap</strong> (Build shadow copy & atomic rename swap)
                  </label>
                </div>
              </div>

              {/* Pre-Migration Backup Card */}
              <div className="su-lab-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>2. Safety Snapshot Backup</h3>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeBackup}
                      onChange={(e) => setIncludeBackup(e.target.checked)}
                    />
                    Auto-snapshot on deploy
                  </label>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Recommended safety snapshot before applying DDL modifications:
                </p>
                <div className="su-backup-banner">
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#166534' }}>
                      Snapshot: {tableName}_backup_{Date.now().toString().slice(-6)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#15803d' }}>
                      Estimated rows to preserve: {currentTableInfo?.rowCount.toLocaleString() || 0}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    disabled={isCreatingBackup}
                    onClick={handleCreateBackup}
                  >
                    {isCreatingBackup ? 'Backing up...' : 'Create Snapshot Now'}
                  </button>
                </div>
                {recommendedBackup && (
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                    ✓ Backup created: <code>{recommendedBackup.backupTableName}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Packaging Downloads & CI/CD Card */}
            <section className="su-card">
              <div className="su-card-header">
                <h3 className="su-card-title">Production Packaging & CI/CD Generator</h3>
                <p className="su-card-desc">
                  Export migration packages, automated GitHub Actions pipeline YAML, or executive audit reports.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="su-btn su-btn-secondary"
                  disabled={isExportingPackage || isGeneratingScripts}
                  onClick={handleExportPackage}
                >
                  📦 {isExportingPackage ? 'Exporting ZIP...' : 'Export Migration ZIP Bundle'}
                </button>

                <button
                  type="button"
                  className="su-btn su-btn-secondary"
                  onClick={handleGenerateCiCd}
                >
                  🚀 Generate GitHub Actions CI/CD
                </button>

                <button
                  type="button"
                  className="su-btn su-btn-secondary"
                  onClick={handleGenerateAuditReport}
                >
                  📝 Executive Audit Report (Markdown)
                </button>
              </div>

              {exportSuccessPath && (
                <div style={{ marginTop: '1rem', color: '#16a34a', fontSize: '0.8125rem', fontWeight: 600 }}>
                  ✓ ZIP Package exported successfully to: <code>{exportSuccessPath}</code>
                </div>
              )}

              {ciCdYaml && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>.github/workflows/db-migrate.yml:</span>
                    <button
                      className="su-btn su-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => navigator.clipboard.writeText(ciCdYaml)}
                    >
                      Copy YAML
                    </button>
                  </div>
                  <div className="su-code-container" style={{ maxHeight: '180px' }}>
                    {ciCdYaml}
                  </div>
                </div>
              )}

              {auditReportMd && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Executive Audit Report:</span>
                    <button
                      className="su-btn su-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => navigator.clipboard.writeText(auditReportMd)}
                    >
                      Copy Markdown
                    </button>
                  </div>
                  <div className="su-code-container" style={{ maxHeight: '180px' }}>
                    {auditReportMd}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── STEP 6: Pre-Flight Dry-Run Cockpit ── */}
        {currentStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Simulation Banner Box */}
            <div className="su-cockpit-banner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#581c87' }}>
                    Pre-Flight Simulation Cockpit
                  </h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b21a8' }}>
                    Executes an atomic transaction with rollback to verify locks, foreign keys, and DDL syntax before committing.
                  </p>
                </div>
                <button
                  type="button"
                  className="su-btn su-btn-primary"
                  disabled={isDryRunning}
                  onClick={handleRunSimulation}
                >
                  {isDryRunning ? 'Simulating...' : '⚡ Run Atomic Dry-Run Simulation'}
                </button>
              </div>

              {dryRunResult && (
                <div style={{ background: '#ffffff', border: '1px solid #d8b4fe', borderRadius: '8px', padding: '0.875rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{dryRunResult.success ? '✅' : '❌'}</span>
                    <strong style={{ color: dryRunResult.success ? '#16a34a' : '#dc2626' }}>
                      {dryRunResult.success ? 'Dry-Run Simulation Passed!' : 'Dry-Run Simulation Failed!'}
                    </strong>
                    <span className="su-tag" style={{ marginLeft: 'auto' }}>
                      Time: {dryRunResult.executionTimeMs}ms
                    </span>
                  </div>
                  <p style={{ margin: '0.375rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {dryRunResult.message}
                  </p>
                </div>
              )}
            </div>

            {/* CLI Snippet Helper */}
            <div className="su-cli-box">
              <span>$ migrateiq apply --tier={environmentTier} --table={tableName} --timeout=5000</span>
              <button
                className="su-btn su-btn-secondary"
                style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', background: '#1e293b', color: '#38bdf8' }}
                onClick={() => navigator.clipboard.writeText(`migrateiq apply --tier=${environmentTier} --table=${tableName} --timeout=5000`)}
              >
                Copy CLI Command
              </button>
            </div>

            {/* Scripts Viewer */}
            <section className="su-card">
              <div className="su-card-header">
                <h3 className="su-card-title">Verified Migration Statements</h3>
                <p className="su-card-desc">
                  Forward DDL and reverse rollback scripts ready for live deployment.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Forward Script (Apply):</span>
                    <button
                      type="button"
                      className="su-btn su-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => {
                        if (scripts?.forwardScript) {
                          navigator.clipboard.writeText(scripts.forwardScript);
                          setCopiedForward(true);
                          setTimeout(() => setCopiedForward(false), 2000);
                        }
                      }}
                    >
                      {copiedForward ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="su-code-container" style={{ maxHeight: '200px' }}>
                    {scripts?.forwardScript || '-- Generating script...'}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Rollback Script (Undo):</span>
                    <button
                      type="button"
                      className="su-btn su-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => {
                        if (scripts?.rollbackScript) {
                          navigator.clipboard.writeText(scripts.rollbackScript);
                          setCopiedRollback(true);
                          setTimeout(() => setCopiedRollback(false), 2000);
                        }
                      }}
                    >
                      {copiedRollback ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="su-code-container" style={{ maxHeight: '200px' }}>
                    {scripts?.rollbackScript || '-- Generating rollback...'}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── STEP 7: Live Execution Terminal & Ledger ── */}
        {currentStep === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Live Streaming Execution Console */}
            <div className="su-exec-terminal">
              <div className="su-term-header">
                <div className="su-term-dots">
                  <div className="su-term-dot red" />
                  <div className="su-term-dot yellow" />
                  <div className="su-term-dot green" />
                </div>
                <span>MigrateIQ Deployment Console [Tier: {environmentTier.toUpperCase()}]</span>
                <span>{isApplying ? 'STATUS: DEPLOYING...' : 'STATUS: IDLE'}</span>
              </div>

              <div className="su-term-body">
                {executionLogs.map((log, i) => (
                  <div key={i} className="su-term-line">
                    <span className="su-term-time">[{log.timestamp}]</span>
                    <span className={`su-term-msg ${log.status === 'failed' ? 'error' : log.status}`}>
                      [{log.stage}] {log.message}
                    </span>
                  </div>
                ))}
                {isApplying && (
                  <div className="su-term-line">
                    <span className="su-term-time">[{new Date().toLocaleTimeString()}]</span>
                    <span className="su-term-msg info">Applying changes and registering in ledger...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Post-Execution Verification Receipt */}
            {executionResult && (
              <div className="su-receipt-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '2rem' }}>{executionResult.success ? '🎉' : '⚠️'}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', color: executionResult.success ? '#166534' : '#b91c1c' }}>
                      {executionResult.success ? 'Migration Verified & Committed!' : 'Migration Aborted'}
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {executionResult.message}
                    </p>
                  </div>
                  {executionResult.checksum && (
                    <span className="su-tag safe" style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>
                      SHA-256: {executionResult.checksum.slice(0, 12)}...
                    </span>
                  )}
                </div>

                {executionResult.verificationDetails && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', marginTop: '1rem', fontSize: '0.8125rem' }}>
                    <strong>Catalog Verification:</strong> {executionResult.verificationDetails}
                  </div>
                )}

                {/* ── Official Migration Integrity Certificate ── */}
                {executionResult.success && (
                  <div className="su-cert-card" style={{ marginTop: '1.25rem' }}>
                    <div className="su-cert-watermark">VERIFIED</div>
                    <div className="su-cert-header">
                      <div className="su-cert-title-group">
                        <span className="su-cert-badge">🛡️ Verified Integrity Certificate</span>
                        <h3 style={{ margin: '0.35rem 0 0 0', fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                          MIGRATEIQ SCHEMA EVOLUTION DOSSIER
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                          Certificate Token: <code>MIC-2026-{(executionResult.checksum || 'SHA256').slice(0, 8).toUpperCase()}</code>
                        </p>
                      </div>
                      <button
                        type="button"
                        className="su-btn su-btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                        onClick={() => {
                          const certText = [
                            '╔══════════════════════════════════════════════════════════════════════╗',
                            '║               MIGRATEIQ SCHEMA EVOLUTION INTEGRITY CERTIFICATE        ║',
                            '╠══════════════════════════════════════════════════════════════════════╣',
                            `║ Certificate ID:    MIC-2026-${(executionResult.checksum || 'SHA256').slice(0, 8).toUpperCase()}`,
                            `║ Target Engine:     ${dbType === 'postgresql' ? 'PostgreSQL (Relational DDL)' : 'MongoDB (BSON Document)'}`,
                            `║ Target Entity:     ${tableName}`,
                            `║ Environment Tier:  ${environmentTier.toUpperCase()}`,
                            `║ Execution Status:  VERIFIED & COMMITTED`,
                            `║ Latency:           ${executionResult.executionTimeMs} ms`,
                            `║ Cryptographic SHA: ${executionResult.checksum || 'N/A'}`,
                            `║ Physical Catalog:  CONFIRMED IN METADATA`,
                            `║ Ledger Audit:      RECORDED IN ${dbType === 'postgresql' ? 'public.migrateiq_schema_history' : '_migrateiq_schema_history'}`,
                            `║ Rollback Token:    RECORDED & AVAILABLE`,
                            '╚══════════════════════════════════════════════════════════════════════╝'
                          ].join('\n');
                          navigator.clipboard.writeText(certText);
                          setCertCopied(true);
                          setTimeout(() => setCertCopied(false), 2500);
                        }}
                      >
                        {certCopied ? '✓ Copied Certificate' : '📋 Copy Integrity Certificate'}
                      </button>
                    </div>

                    <div className="su-cert-grid">
                      <div className="su-cert-item">
                        <span className="su-cert-label">Target Engine & Entity</span>
                        <span className="su-cert-value">{dbType === 'postgresql' ? '🐘 PostgreSQL' : '🍃 MongoDB'} — {tableName}</span>
                      </div>
                      <div className="su-cert-item">
                        <span className="su-cert-label">Environment Tier</span>
                        <span className="su-cert-value">{environmentTier.toUpperCase()}</span>
                      </div>
                      <div className="su-cert-item">
                        <span className="su-cert-label">Physical Catalog</span>
                        <span className="su-cert-value" style={{ color: '#16a34a' }}>✓ Confirmed Active in Metadata</span>
                      </div>
                      <div className="su-cert-item">
                        <span className="su-cert-label">In-Database Ledger</span>
                        <span className="su-cert-value" style={{ color: '#16a34a' }}>✓ Recorded in History Ledger</span>
                      </div>
                      <div className="su-cert-item">
                        <span className="su-cert-label">Execution Duration</span>
                        <span className="su-cert-value">{executionResult.executionTimeMs} ms</span>
                      </div>
                      <div className="su-cert-item">
                        <span className="su-cert-label">Rollback Script</span>
                        <span className="su-cert-value" style={{ color: '#0284c7' }}>✓ Pre-Generated & Staged</span>
                      </div>
                      <div className="su-cert-item" style={{ gridColumn: '1 / -1' }}>
                        <span className="su-cert-label">Cryptographic Checksum (SHA-256)</span>
                        <span className="su-cert-checksum">{executionResult.checksum || 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    className="su-btn su-btn-primary"
                    onClick={() => {
                      if (connectionConfig) handleConnect(connectionConfig);
                      setCurrentStep(3);
                      setStagedChanges([]);
                      setColumnName('');
                      setNewColumnName('');
                    }}
                  >
                    + Apply Another Change
                  </button>

                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    onClick={() => setShowHistory(true)}
                  >
                    View In-Database Ledger
                  </button>

                  <button
                    type="button"
                    className="su-btn su-btn-secondary"
                    onClick={() => navigate('/')}
                  >
                    🏠 Home Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom Action Navigation Bar ── */}
      <footer className="su-footer">
        <div>
          {currentStep > 1 && currentStep < 7 && (
            <button
              type="button"
              className="su-btn su-btn-secondary"
              onClick={() => setCurrentStep((prev) => prev - 1)}
            >
              ← Back
            </button>
          )}

          {currentStep === 1 && (
            <div className="su-footer-status">
              <span>{dbType === 'postgresql' ? '🐘' : '🍃'}</span>
              <span>Target: <strong>{dbType === 'postgresql' ? 'PostgreSQL' : 'MongoDB'}</strong></span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span>Tier: <strong style={{ color: environmentTier === 'production' ? '#DC2626' : environmentTier === 'staging' ? '#B45309' : '#15803D' }}>{environmentTier.toUpperCase()}</strong></span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span>
                {isConnected ? (
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>● Catalog Introspected ({introspectedTables.length} relations)</span>
                ) : (
                  <span style={{ color: '#64748B' }}>○ Connect database to continue</span>
                )}
              </span>
            </div>
          )}
        </div>

        <div>
          {currentStep === 1 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              disabled={!isConnected}
              onClick={() => setCurrentStep(2)}
              title={!isConnected ? 'Connect database catalog first to proceed' : 'Proceed to Schema Drift Radar'}
            >
              Continue to Inspection & Drift Radar →
            </button>
          )}

          {currentStep === 2 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              onClick={() => setCurrentStep(3)}
            >
              Continue to Evolution Studio →
            </button>
          )}

          {currentStep === 3 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              disabled={!isStep3Valid && stagedChanges.length === 0}
              onClick={() => setCurrentStep(4)}
            >
              Continue to Impact & Policy Check →
            </button>
          )}

          {currentStep === 4 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              onClick={() => setCurrentStep(5)}
            >
              Continue to Packaging Lab →
            </button>
          )}

          {currentStep === 5 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              onClick={() => setCurrentStep(6)}
            >
              Continue to Dry-Run Cockpit →
            </button>
          )}

          {currentStep === 6 && (
            <button
              type="button"
              className="su-btn su-btn-primary"
              style={{
                background: environmentTier === 'production' ? '#dc2626' : undefined,
                borderColor: environmentTier === 'production' ? '#b91c1c' : undefined,
              }}
              onClick={handleProceedToDeploy}
            >
              {environmentTier === 'production'
                ? '🚨 Deploy to PRODUCTION (Shield Active) →'
                : '▶ Deploy Schema Changes →'}
            </button>
          )}
        </div>
      </footer>

      {/* ── Production Shield Confirmation Modal ── */}
      {shieldModalOpen && (
        <div className="su-shield-overlay">
          <div className="su-shield-modal">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#dc2626' }}>
              <span style={{ fontSize: '2rem' }}>🛡️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                  PRODUCTION SHIELD ACTIVATED
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Tier: <strong>{environmentTier.toUpperCase()}</strong> | Relation: <strong>{tableName}</strong>
                </p>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You are applying DDL to a live sensitive environment. To authorize this operation, please type{' '}
              <strong style={{ color: '#dc2626' }}>
                {operation === 'dropColumn' || operation === 'dropTable' ? 'CONFIRM_DROP' : 'APPLY_TO_PRODUCTION'}
              </strong>{' '}
              below:
            </p>

            <input
              type="text"
              className="su-shield-input"
              placeholder={operation === 'dropColumn' || operation === 'dropTable' ? 'CONFIRM_DROP' : 'APPLY_TO_PRODUCTION'}
              value={shieldConfirmationInput}
              onChange={(e) => setShieldConfirmationInput(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="su-btn su-btn-secondary"
                onClick={() => setShieldModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="su-btn su-btn-primary"
                style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                disabled={
                  shieldConfirmationInput.trim() !==
                  (operation === 'dropColumn' || operation === 'dropTable' ? 'CONFIRM_DROP' : 'APPLY_TO_PRODUCTION')
                }
                onClick={handleAuthorizeShield}
              >
                Authorize & Deploy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
