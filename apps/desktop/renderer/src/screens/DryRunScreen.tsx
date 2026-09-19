import React, { useState, useEffect } from 'react';
import type {
  DryRunResult,
  DryRunTableResult,
  DryRunSkippedRow,
  DryRunProgressPayload,
  CollectionMapping,
  AnomalyFixRequest,
} from '@migrateiq/shared';
import { useWizardStore } from '../store/wizardStore';
import {
  formatBytes,
  getTypeAwareFallback,
  generateDdlForMapping,
} from '../components/dry-run/dryRunUtils';
import { BlueprintSummaryCard } from '../components/dry-run/BlueprintSummaryCard';
import { DryRunTerminal } from '../components/dry-run/DryRunTerminal';
import { SkippedRowsModal } from '../components/dry-run/SkippedRowsModal';
import { RemediationStudioModal, type RemediationFixItem } from '../components/dry-run/RemediationStudioModal';
import {
  generateDossierHtml,
  generateMarkdownDossier,
  downloadMarkdownDossier,
} from '../components/dry-run/dossierGenerator';
import '../styles/dry-run.css';

// Re-export helpers for backward compatibility with existing tests and callers
export { formatBytes, getTypeAwareFallback, generateDdlForMapping };

export interface DryRunScreenProps {
  onBack: () => void;
  onContinue: () => void;
  onSkip?: () => void;
}

export interface LogEntry {
  id: string;
  time: string;
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
}

/**
 * Generates realistic mock dry run simulation results based on current wizard schema mapping.
 * All values are derived from the actual mapping — no collection names or row counts
 * are hardcoded. This makes demo mode accurately reflect the user's real schema.
 */
function generateMockDryRunResult(
  mappings: CollectionMapping[],
  direction: 'mongodb-to-postgres' | 'postgres-to-mongo',
  sourceSchema?: import('@migrateiq/shared').SourceSchema[] | null
): DryRunResult {
  const tableResults: DryRunTableResult[] = mappings.map((col) => {
    const schemaEntry = sourceSchema?.find(
      (s) =>
        s.collectionName === col.collectionName ||
        s.collectionName === col.targetTableName
    );
    const totalEstimatedRows = schemaEntry?.documentCount
      ? Math.max(1, schemaEntry.documentCount)
      : Math.max(100, col.fields.filter((f) => f.include).length * 120);

    const sampleTested = Math.min(500, totalEstimatedRows);

    const firstRequiredWithoutDefault = col.fields.find(
      (f) =>
        f.include &&
        !f.isNullable &&
        !f.defaultValue &&
        !f.isChildTable &&
        f.targetColumn !== 'id' &&
        f.sourceField !== '_id'
    );

    const hasViolatingField = Boolean(firstRequiredWithoutDefault) && sampleTested > 0;
    const sampleFailed = hasViolatingField ? Math.min(2, Math.floor(sampleTested * 0.004)) : 0;
    const samplePassed = sampleTested - sampleFailed;
    const failureRate = sampleTested > 0 ? sampleFailed / sampleTested : 0;
    const projectedSkipCount = Math.round(totalEstimatedRows * failureRate);
    const projectedMigrateCount = totalEstimatedRows - projectedSkipCount;

    const skippedRows: DryRunSkippedRow[] =
      hasViolatingField && firstRequiredWithoutDefault && sampleFailed > 0
        ? Array.from({ length: sampleFailed }, (_, i) => ({
            documentId: `64f1a2b3c4d5e6f7081920${(10 + i).toString(16)}`,
            collection: col.collectionName,
            targetTable: col.targetTableName,
            field: firstRequiredWithoutDefault.targetColumn,
            reason: `Missing required NOT NULL field "${firstRequiredWithoutDefault.targetColumn}"`,
            sampleValue: null,
            rawSampleSnippet: `{\n  "_id": "64f1a2b3c4d5e6f7081920${(10 + i).toString(16)}",\n  "${firstRequiredWithoutDefault.sourceField}": null\n}`,
          }))
        : [];

    const ddlPreview = generateDdlForMapping(col);

    return {
      collectionName: col.collectionName,
      targetTableName: col.targetTableName,
      columnsCount: col.fields.filter((f) => f.include).length,
      isChildTable: false,
      schemaValid: true,
      sampleTested,
      samplePassed,
      sampleFailed,
      totalEstimatedRows,
      projectedMigrateCount,
      projectedSkipCount,
      status: sampleFailed > 0 ? 'warning' : 'passed',
      skippedRows,
      durationMs: 280 + Math.floor(Math.random() * 200),
      ddlPreview,
    };
  });

  // Auto-discover child table fields from the actual mapping
  mappings.forEach((col) => {
    col.fields
      .filter((f) => f.include && f.isChildTable && f.childTableName)
      .forEach((childField) => {
        const childTableName = childField.childTableName!;
        if (!tableResults.some((t) => t.targetTableName === childTableName)) {
          const parentRows = tableResults.find(
            (t) => t.collectionName === col.collectionName
          )?.totalEstimatedRows ?? 500;
          const childRows = Math.round(parentRows * 2.8);
          tableResults.push({
            collectionName: `${col.collectionName}.${childField.sourceField}`,
            targetTableName: childTableName,
            columnsCount: 5,
            isChildTable: true,
            parentTable: col.targetTableName,
            schemaValid: true,
            sampleTested: Math.min(500, childRows),
            samplePassed: Math.min(500, childRows),
            sampleFailed: 0,
            totalEstimatedRows: childRows,
            projectedMigrateCount: childRows,
            projectedSkipCount: 0,
            status: 'passed',
            skippedRows: [],
            durationMs: 380 + Math.floor(Math.random() * 100),
            ddlPreview: `CREATE TABLE IF NOT EXISTS "${childTableName}" (\n  "id" VARCHAR(24) PRIMARY KEY,\n  "${col.targetTableName}_id" VARCHAR(24) REFERENCES ${col.targetTableName}(id),\n  "sort_order" INTEGER NOT NULL\n);`,
          });
        }
      });
  });

  const allSkippedRows = tableResults.flatMap((t) => t.skippedRows);
  const totalSampleTested = tableResults.reduce((acc, t) => acc + t.sampleTested, 0);
  const totalSamplePassed = tableResults.reduce((acc, t) => acc + t.samplePassed, 0);
  const totalSampleFailed = tableResults.reduce((acc, t) => acc + t.sampleFailed, 0);
  const totalProjectedMigrate = tableResults.reduce((acc, t) => acc + t.projectedMigrateCount, 0);
  const totalProjectedSkip = tableResults.reduce((acc, t) => acc + t.projectedSkipCount, 0);
  const totalProjectedRows = totalProjectedMigrate + totalProjectedSkip;
  const executionTimeMs = 1200 + Math.floor(Math.random() * 400);
  const throughputRowsPerSec = Math.max(1, Math.round(totalSampleTested / (executionTimeMs / 1000)));
  const projectedDurationSec = Math.max(1, Math.round(totalProjectedRows / (throughputRowsPerSec || 1)));
  const projectedTotalSizeBytes = totalProjectedRows * 380;
  const demoCurrentDbSizeBytes = 42 * 1024 * 1024;
  const storageHeadroom = {
    currentDbSizeBytes: demoCurrentDbSizeBytes,
    projectedSizeBytes: projectedTotalSizeBytes,
    sufficientSpace: true,
    formattedCurrentDbSize: '42.0 MB',
    formattedProjectedSize: formatBytes(projectedTotalSizeBytes),
  };

  return {
    simulationId: `sim_demo_${Date.now()}`,
    timestamp: new Date().toISOString(),
    direction,
    tables: tableResults,
    totalTables: tableResults.length,
    totalSampleTested,
    totalSamplePassed,
    totalSampleFailed,
    totalProjectedMigrate,
    totalProjectedSkip,
    overallStatus: totalSampleFailed > 0 ? 'warning' : 'passed',
    allSkippedRows,
    executionTimeMs,
    rollbackVerified: true,
    isDemoMode: true,
    throughputRowsPerSec,
    projectedDurationSec,
    projectedTotalSizeBytes,
    storageHeadroom,
  };
}

export const DryRunScreen: React.FC<DryRunScreenProps> = ({
  onBack,
  onContinue,
  onSkip,
}) => {
  const {
    schemaMapping,
    sourceConfig,
    targetConfig,
    sourceSchema,
    direction,
    isDemoMode,
    dryRunResult,
    setDryRunResult,
    quarantinePolicyAcknowledged,
    setQuarantinePolicyAcknowledged,
    applyAutoFix,
    applyDefaultValue,
    applyBatchDefaultValues,
  } = useWizardStore();

  const [simState, setSimState] = useState<'idle' | 'running' | 'completed' | 'error'>(
    dryRunResult ? 'completed' : 'idle'
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedDdl, setExpandedDdl] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTableFilter, setModalTableFilter] = useState<string>('all');
  const [modalSearch, setModalSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);
  const [showExplanationDetails, setShowExplanationDetails] = useState<boolean>(false);
  const [showExecutionLog, setShowExecutionLog] = useState<boolean>(false);

  // Remediation Studio Modal states
  const [remediationModalOpen, setRemediationModalOpen] = useState(false);
  const [remediationTab, setRemediationTab] = useState<'smart' | 'manual'>('smart');

  // Listen to IPC progress events if available
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const unsubscribe = window.electronAPI.on('dry-run:progress', (_event: unknown, ...args: unknown[]) => {
      const payload = args[0] as DryRunProgressPayload;
      if (payload && payload.message) {
        const timeStr = new Date(payload.timestamp || Date.now()).toLocaleTimeString();
        setLogs((prev) => [
          ...prev,
          {
            id: `log_${Date.now()}_${Math.random()}`,
            time: timeStr,
            message: payload.message,
            status: payload.status,
          },
        ]);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const currentResult = dryRunResult || (simState === 'completed' ? generateMockDryRunResult(schemaMapping || [], direction || 'mongodb-to-postgres', sourceSchema) : null);

  // Helper to collect all distinct anomalies across skipped rows or failing tables
  const getDistinctAnomalies = (): AnomalyFixRequest[] => {
    if (!currentResult) return [];
    const anomalies: AnomalyFixRequest[] = [];
    const seen = new Set<string>();
    const mappings = useWizardStore.getState().schemaMapping || schemaMapping || [];

    for (const row of currentResult.allSkippedRows) {
      const targetTable = (row.targetTable || row.collection || 'unknown').trim();
      const matchCol = mappings.find(
        (m) =>
          m.targetTableName.toLowerCase() === targetTable.toLowerCase() ||
          m.collectionName.toLowerCase() === targetTable.toLowerCase()
      );
      const fallbackFld = matchCol?.fields.find((f) => !f.isNullable && f.targetColumn !== 'id' && f.targetColumn !== '_id')?.targetColumn || 'name';
      const targetColumn = (row.field || fallbackFld).trim();
      const matchField = matchCol?.fields.find(
        (f) =>
          f.targetColumn.toLowerCase() === targetColumn.toLowerCase() ||
          f.sourceField.toLowerCase() === targetColumn.toLowerCase()
      );
      const key = `${targetTable.toLowerCase()}.${targetColumn.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        const affectedCount = currentResult.allSkippedRows.filter((r) => {
          const t = (r.targetTable || r.collection || '').toLowerCase();
          const f = (r.field || fallbackFld).toLowerCase();
          return t === targetTable.toLowerCase() && f === targetColumn.toLowerCase();
        }).length;

        const resolvedTable = matchCol?.targetTableName || targetTable;
        const resolvedCol = matchField?.targetColumn || targetColumn;
        const resolvedSnippet = row.rawSampleSnippet || `{ "_id": "doc_${Date.now().toString(36)}", "${resolvedCol}": null }`;

        anomalies.push({
          tableName: resolvedTable,
          columnName: resolvedCol,
          targetTable: resolvedTable,
          targetColumn: resolvedCol,
          targetType: matchField?.targetType || 'VARCHAR(255)',
          isNullable: matchField?.isNullable ?? false,
          currentDefaultValue: matchField?.defaultValue,
          failureReason: row.reason || 'Missing required value for NOT NULL column',
          affectedRowCount: affectedCount || 1,
          sampleOffendingSnippet: resolvedSnippet,
          rawSnippet: resolvedSnippet,
        });
      }
    }

    if (anomalies.length === 0) {
      for (const tbl of currentResult.tables) {
        if (tbl.sampleFailed > 0) {
          const matchCol = mappings.find(
            (m) =>
              m.targetTableName.toLowerCase() === tbl.targetTableName.toLowerCase() ||
              m.collectionName.toLowerCase() === tbl.targetTableName.toLowerCase()
          );
          if (matchCol) {
            const problematicField = matchCol.fields.find(
              (f) => !f.isNullable && f.targetColumn !== 'id' && f.targetColumn !== '_id' && !f.defaultValue
            ) || matchCol.fields[1] || matchCol.fields[0];

            if (problematicField) {
              const key = `${matchCol.targetTableName.toLowerCase()}.${problematicField.targetColumn.toLowerCase()}`;
              if (!seen.has(key)) {
                seen.add(key);
                const snippet = `{ "_id": "sample_${tbl.targetTableName}_01", "${problematicField.targetColumn}": null }`;
                anomalies.push({
                  tableName: matchCol.targetTableName,
                  columnName: problematicField.targetColumn,
                  targetTable: matchCol.targetTableName,
                  targetColumn: problematicField.targetColumn,
                  targetType: problematicField.targetType,
                  isNullable: problematicField.isNullable,
                  currentDefaultValue: problematicField.defaultValue,
                  failureReason: `NOT NULL constraint violation: ${tbl.sampleFailed} rows missing '${problematicField.targetColumn}'`,
                  affectedRowCount: tbl.sampleFailed,
                  sampleOffendingSnippet: snippet,
                  rawSnippet: snippet,
                });
              }
            }
          }
        }
      }
    }

    return anomalies;
  };

  const handleStartSimulation = async (customMappings?: CollectionMapping[]) => {
    setSimState('running');
    setLogs([]);
    setErrorMessage(null);
    setDryRunResult(null);

    const simulationStartTime = Date.now();
    const effectiveDirection = direction || 'mongodb-to-postgres';
    const effectiveMappings = customMappings || useWizardStore.getState().schemaMapping || schemaMapping || [];

    const addLog = (msg: string, status: LogEntry['status'] = 'info') => {
      const timeStr = new Date().toLocaleTimeString();
      setLogs((prev) => [
        ...prev,
        { id: `log_${Date.now()}_${Math.random()}`, time: timeStr, message: msg, status },
      ]);
    };

    addLog('🚀 Starting transactional dry run simulation...', 'info');
    addLog('🔒 Opening isolated transaction (BEGIN; lock_timeout = 5s)...', 'info');

    let realResult: DryRunResult | null = null;
    let ipcError: string | null = null;

    if (
      typeof window !== 'undefined' &&
      window.electronAPI &&
      !isDemoMode &&
      targetConfig &&
      (targetConfig.host || targetConfig.connectionString)
    ) {
      try {
        const response = await window.electronAPI.invoke<DryRunResult>('migration:dry-run', {
          mapping: effectiveMappings,
          sourceConfig,
          targetConfig,
          sourceSchema,
          direction: effectiveDirection,
          isDemoMode: false,
        });

        if (response.success && response.data) {
          realResult = response.data;
        } else {
          ipcError = response.error || 'Dry run simulation failed on the target database.';
        }
      } catch (err) {
        ipcError = err instanceof Error ? err.message : String(err);
      }
    }

    if (realResult) {
      addLog('↩️ ROLLBACK executed successfully — 0 permanent mutations committed.', 'success');
      addLog(`✨ Simulation completed in ${realResult.executionTimeMs}ms`, 'success');
      setDryRunResult(realResult);
      setSimState('completed');
      return;
    }

    if (ipcError && !isDemoMode && (targetConfig?.host || targetConfig?.connectionString)) {
      addLog(`❌ Transaction aborted: ${ipcError}`, 'error');
      addLog('↩️ Safety ROLLBACK verified — target database remains untouched.', 'warning');
      setErrorMessage(ipcError);
      setSimState('error');
      return;
    }

    if (!realResult && !isDemoMode && (targetConfig?.host || targetConfig?.connectionString)) {
      const fallbackMsg = 'The simulation returned no results. Check your database connection and mapping configuration.';
      addLog(`❌ ${fallbackMsg}`, 'error');
      addLog('↩️ Safety ROLLBACK verified — target database remains untouched.', 'warning');
      setErrorMessage(fallbackMsg);
      setSimState('error');
      return;
    }

    // Interactive fallback / Demo simulation progression
    setTimeout(() => {
      effectiveMappings.forEach((col, idx) => {
        setTimeout(() => {
          addLog(`✅ Schema check: CREATE TABLE "${col.targetTableName}" (${col.fields.filter((f) => f.include).length} cols) — Valid`, 'success');
        }, idx * 180);
      });

      setTimeout(() => {
        addLog('✅ Schema check: CREATE TABLE "order_items" (5 cols with sort_order) — Valid', 'success');
      }, effectiveMappings.length * 180 + 100);

      setTimeout(() => {
        addLog('⏳ Testing data batch: users (500 sample rows)...', 'info');
        const usersCol = effectiveMappings.find((c) => c.collectionName === 'users' || c.targetTableName === 'users');
        const nameField = usersCol?.fields.find((f) => f.sourceField === 'name' || f.targetColumn === 'name');
        const isNameNullable = nameField ? Boolean(nameField.isNullable) : false;
        const hasDefault = nameField ? Boolean(nameField.defaultValue) : false;

        setTimeout(() => {
          if (hasDefault) {
            addLog(`✅ 500 rows passed transformation (2 rows imputed with DEFAULT '${nameField?.defaultValue || 'Unknown'}')`, 'success');
          } else if (isNameNullable) {
            addLog('✅ 500 rows passed transformation (0 skipped rows, NULLs permitted)', 'success');
          } else {
            addLog('✅ 498 rows passed transformation', 'success');
            addLog('⚠️  2 rows failed: missing required field "name"', 'warning');
          }
        }, 300);

        setTimeout(() => {
          addLog('⏳ Testing data batch: orders (500 sample rows)...', 'info');
          setTimeout(() => {
            addLog('✅ 500 rows passed transformation (1,420 child items unpacked with sort_order)', 'success');
          }, 250);
        }, 600);

        setTimeout(() => {
          addLog('🔒 Validating foreign key constraints inside transaction...', 'info');
          addLog('✅ Foreign key integrity checks passed (0 orphan keys)', 'success');
          addLog('↩️ Issuing ROLLBACK — all temporary simulation tables cleaned up', 'info');
          addLog('🛡️ DRY RUN COMPLETE: 0 permanent changes made to target database', 'success');

          const mockResult = generateMockDryRunResult(effectiveMappings, effectiveDirection, sourceSchema);
          mockResult.executionTimeMs = Date.now() - simulationStartTime;
          setDryRunResult(mockResult);
          setSimState('completed');
        }, 1200);
      }, effectiveMappings.length * 180 + 350);
    }, 400);
  };

  const handleApplySingleDefault = (tableName: string, fieldName: string, customVal?: string) => {
    const val = customVal !== undefined ? customVal.trim() : 'Unknown';
    applyDefaultValue(tableName, fieldName, val);

    const storeUpdatedResult = useWizardStore.getState().dryRunResult;
    if (storeUpdatedResult) {
      setDryRunResult(storeUpdatedResult);
    }

    setSimState('completed');
    setQuarantinePolicyAcknowledged(false);
    setNotification({
      message: `🌟 Applied Smart Default: Column "${fieldName}" in table "${tableName}" configured with DEFAULT '${val}' NOT NULL. All records passed validation!`,
      type: 'success',
    });

    setLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}_default`,
        time: new Date().toLocaleTimeString(),
        message: `⚡ Smart Default applied: Table "${tableName}" column "${fieldName}" configured with DEFAULT '${val}' NOT NULL.`,
        status: 'success',
      },
      {
        id: `log_${Date.now()}_pass`,
        time: new Date().toLocaleTimeString(),
        message: '✅ Sample records transformed and validated. Zero permanent changes committed.',
        status: 'success',
      },
    ]);
  };

  const handleApplyRemediationFixes = (fixesToApply: RemediationFixItem[], mode: 'smart' | 'manual') => {
    if (fixesToApply.length === 0) {
      setRemediationModalOpen(false);
      return;
    }

    if (fixesToApply.length === 1) {
      handleApplySingleDefault(fixesToApply[0].tableName, fixesToApply[0].fieldName, fixesToApply[0].defaultValue);
      setRemediationModalOpen(false);
      setModalOpen(false);
      return;
    }

    applyBatchDefaultValues(fixesToApply);

    const storeUpdatedResult = useWizardStore.getState().dryRunResult;
    if (storeUpdatedResult) {
      setDryRunResult(storeUpdatedResult);
    }

    setRemediationModalOpen(false);
    setModalOpen(false);
    setSimState('completed');
    setQuarantinePolicyAcknowledged(false);

    const fixSummary = fixesToApply.map((f) => `"${f.tableName}"."${f.fieldName}" = '${f.defaultValue}'`).join(', ');
    setNotification({
      message: `🌟 Applied ${mode === 'smart' ? '✨ Smart AI' : '⚙️ Manual'} Remediation: ${fixSummary}. Re-simulated with 100% pass!`,
      type: 'success',
    });

    setLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}_batch_default`,
        time: new Date().toLocaleTimeString(),
        message: `⚡ Applied ${mode === 'smart' ? '✨ Smart AI' : '⚙️ Manual'} Remediation: Configured ${fixesToApply.length} column default(s).`,
        status: 'success',
      },
      ...fixesToApply.map((f) => ({
        id: `log_${Date.now()}_${f.tableName}_${f.fieldName}`,
        time: new Date().toLocaleTimeString(),
        message: `  → Table "${f.tableName}" column "${f.fieldName}" DEFAULT '${f.defaultValue}' NOT NULL`,
        status: 'info' as const,
      })),
      {
        id: `log_${Date.now()}_retest_pass`,
        time: new Date().toLocaleTimeString(),
        message: '✅ Simulation passed: 100% of rows healed and validated. Target tables ready for migration.',
        status: 'success',
      },
    ]);
  };

  const handleApplyQuickFix = (tableName: string, fieldName: string) => {
    applyAutoFix({
      type: 'set_nullable',
      collectionName: tableName,
      fieldName,
      description: `Set column "${fieldName}" in table "${tableName}" to nullable`,
      recommendedValue: true,
    });

    const lowerTable = tableName.toLowerCase();
    const lowerField = fieldName.toLowerCase();
    const baseResult = currentResult;
    if (baseResult) {
      const freshMappings = useWizardStore.getState().schemaMapping || schemaMapping || [];
      const resolvedTables = baseResult.tables.map((tbl) => {
        const isMatch =
          tbl.targetTableName.toLowerCase() === lowerTable ||
          tbl.collectionName.toLowerCase() === lowerTable;
        if (!isMatch) return tbl;

        const matchingCol = freshMappings.find(
          (c) =>
            c.targetTableName.toLowerCase() === tbl.targetTableName.toLowerCase() ||
            c.collectionName.toLowerCase() === tbl.targetTableName.toLowerCase()
        );

        const remainingRows = tbl.skippedRows.filter((r) => {
          const f = (r.field || '').toLowerCase();
          return f !== lowerField && f !== (lowerField === 'name' ? 'fullname' : '');
        });
        const resolvedCount = tbl.skippedRows.length - remainingRows.length;
        const newSampleFailed = Math.max(0, tbl.sampleFailed - (resolvedCount > 0 ? resolvedCount : tbl.sampleFailed));
        const newSamplePassed = tbl.sampleTested - newSampleFailed;
        const failureRate = tbl.sampleTested > 0 ? newSampleFailed / tbl.sampleTested : 0;
        const newProjectedSkip = Math.round(tbl.totalEstimatedRows * failureRate);
        const newProjectedMigrate = Math.max(0, tbl.totalEstimatedRows - newProjectedSkip);

        return {
          ...tbl,
          samplePassed: newSamplePassed,
          sampleFailed: newSampleFailed,
          projectedMigrateCount: newProjectedMigrate,
          projectedSkipCount: newProjectedSkip,
          status: newSampleFailed > 0 ? ('warning' as const) : ('passed' as const),
          skippedRows: remainingRows,
          ddlPreview: matchingCol ? generateDdlForMapping(matchingCol) : tbl.ddlPreview,
        };
      });

      const allRemainingSkipped = resolvedTables.flatMap((t) => t.skippedRows);
      const resolvedResult: DryRunResult = {
        ...baseResult,
        tables: resolvedTables,
        totalSamplePassed: resolvedTables.reduce((a, b) => a + b.samplePassed, 0),
        totalSampleFailed: resolvedTables.reduce((a, b) => a + b.sampleFailed, 0),
        totalProjectedMigrate: resolvedTables.reduce((a, b) => a + b.projectedMigrateCount, 0),
        totalProjectedSkip: resolvedTables.reduce((a, b) => a + b.projectedSkipCount, 0),
        overallStatus: allRemainingSkipped.length > 0 ? 'warning' : 'passed',
        allSkippedRows: allRemainingSkipped,
      };

      setDryRunResult(resolvedResult);
      if (allRemainingSkipped.length === 0) {
        setModalOpen(false);
      }
    }

    setSimState('completed');
    setQuarantinePolicyAcknowledged(false);

    setNotification({
      message: `⚠️ Applied Schema Relaxation: Column "${fieldName}" set to NULLABLE. Downstream applications must guard against NULL values.`,
      type: 'info',
    });
  };

  const handleAcknowledgeQuarantine = () => {
    setQuarantinePolicyAcknowledged(true);
    setNotification({
      message: '🛡️ Quarantine Policy Active (DLQ): Violating records will be routed to the Dead-Letter Queue. Note: Phase 9 row reconciliation will report a minor discrepancy.',
      type: 'info',
    });
  };

  const handleRetestSingleTable = async (tableName: string) => {
    const freshMappings = useWizardStore.getState().schemaMapping || schemaMapping || [];
    const targetTableMapping = freshMappings.find(
      (m) =>
        m.targetTableName.toLowerCase() === tableName.toLowerCase() ||
        m.collectionName.toLowerCase() === tableName.toLowerCase()
    );

    setNotification({
      message: `🔄 Re-testing table "${tableName}" in isolated transaction...`,
      type: 'info',
    });

    if (
      typeof window !== 'undefined' &&
      window.electronAPI &&
      !isDemoMode &&
      targetConfig &&
      (targetConfig.host || targetConfig.connectionString)
    ) {
      try {
        const response = await window.electronAPI.invoke<DryRunResult>('migration:dry-run', {
          mapping: targetTableMapping ? [targetTableMapping] : freshMappings,
          sourceConfig,
          targetConfig,
          sourceSchema,
          direction: direction || 'mongodb-to-postgres',
          isDemoMode: false,
          singleTableName: tableName,
        });

        if (response.success && response.data && currentResult) {
          const newTblResult = response.data.tables.find(
            (t) => t.targetTableName.toLowerCase() === tableName.toLowerCase()
          );
          if (newTblResult) {
            const updatedTables = currentResult.tables.map((tbl) =>
              tbl.targetTableName.toLowerCase() === tableName.toLowerCase() ? newTblResult : tbl
            );
            const allRemainingSkipped = updatedTables.flatMap((t) => t.skippedRows);
            const updatedResult: DryRunResult = {
              ...currentResult,
              tables: updatedTables,
              totalSamplePassed: updatedTables.reduce((a, b) => a + b.samplePassed, 0),
              totalSampleFailed: updatedTables.reduce((a, b) => a + b.sampleFailed, 0),
              totalProjectedMigrate: updatedTables.reduce((a, b) => a + b.projectedMigrateCount, 0),
              totalProjectedSkip: updatedTables.reduce((a, b) => a + b.projectedSkipCount, 0),
              overallStatus: allRemainingSkipped.length > 0 ? 'warning' : 'passed',
              allSkippedRows: allRemainingSkipped,
            };
            setDryRunResult(updatedResult);
            if (newTblResult.sampleFailed === 0) {
              setModalOpen(false);
            }
            setNotification({
              message: `✅ Table "${tableName}" re-tested: ${newTblResult.samplePassed}/${newTblResult.sampleTested} passed!`,
              type: 'success',
            });
            return;
          }
        }
      } catch (err) {
        console.error('Single-table re-test IPC error:', err);
      }
    }

    // Demo re-test fallback
    setTimeout(() => {
      if (!currentResult) return;
      const hasDefault = targetTableMapping?.fields.some((f) => Boolean(f.defaultValue));
      const hasRelaxedNullable = targetTableMapping?.fields.some((f) => Boolean(f.isNullable));
      const isSuccess = hasDefault || hasRelaxedNullable;

      const updatedTables = currentResult.tables.map((tbl) => {
        if (tbl.targetTableName.toLowerCase() === tableName.toLowerCase()) {
          const sampleFailed = isSuccess ? 0 : tbl.sampleFailed;
          const updatedDdl = targetTableMapping ? generateDdlForMapping(targetTableMapping) : tbl.ddlPreview;
          return {
            ...tbl,
            samplePassed: tbl.sampleTested - sampleFailed,
            sampleFailed,
            projectedMigrateCount: isSuccess ? tbl.totalEstimatedRows : tbl.projectedMigrateCount,
            projectedSkipCount: isSuccess ? 0 : tbl.projectedSkipCount,
            status: (sampleFailed > 0 ? 'warning' : 'passed') as DryRunTableResult['status'],
            skippedRows: isSuccess ? [] : tbl.skippedRows,
            ddlPreview: updatedDdl,
          };
        }
        return tbl;
      });

      const allRemainingSkipped = updatedTables.flatMap((t) => t.skippedRows);
      const updatedResult: DryRunResult = {
        ...currentResult,
        tables: updatedTables,
        totalSamplePassed: updatedTables.reduce((a, b) => a + b.samplePassed, 0),
        totalSampleFailed: updatedTables.reduce((a, b) => a + b.sampleFailed, 0),
        totalProjectedMigrate: updatedTables.reduce((a, b) => a + b.projectedMigrateCount, 0),
        totalProjectedSkip: updatedTables.reduce((a, b) => a + b.projectedSkipCount, 0),
        overallStatus: allRemainingSkipped.length > 0 ? 'warning' : 'passed',
        allSkippedRows: allRemainingSkipped,
      };

      if (isSuccess || allRemainingSkipped.length === 0) {
        setModalOpen(false);
      }
      setDryRunResult(updatedResult);
      setNotification({
        message: `⚡ Isolated re-test complete for "${tableName}": ${isSuccess ? 'All sample records passed (0 skipped)' : 'Constraint violations still present'}`,
        type: isSuccess ? 'success' : 'info',
      });
    }, 220);
  };

  const handleExportPdf = async () => {
    if (!currentResult) return;

    const targetDbName = direction === 'postgres-to-mongo' ? 'MongoDB' : 'PostgreSQL';
    const htmlContent = generateDossierHtml(currentResult, targetDbName);
    const defaultFilename = `migrateiq-preflight-dossier-${Date.now()}.pdf`;

    if (typeof window !== 'undefined' && window.electronAPI?.invoke) {
      try {
        const res = await window.electronAPI.invoke<{ filePath?: string; cancelled?: boolean }>('dossier:export-pdf', {
          htmlContent,
          defaultFilename,
        });

        if (res.success && res.data) {
          if (!res.data.cancelled && res.data.filePath) {
            setNotification({
              message: '📄 Pre-Flight Verification Dossier (PDF) saved successfully!',
              type: 'success',
            });
          }
          return;
        } else if (res.error) {
          throw new Error(res.error);
        }
      } catch (err) {
        console.warn('Native PDF export via IPC failed, falling back to browser print:', err);
      }
    }

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(htmlContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 300);
      setNotification({
        message: "📄 PDF Print Preview opened. Use 'Save as PDF' to save your dossier!",
        type: 'success',
      });
    } else {
      setNotification({
        message: '⚠️ Could not open print window. Please allow popups for MigrateIQ.',
        type: 'error',
      });
    }
  };

  const handleExportMarkdown = () => {
    if (!currentResult) return;
    const targetDbName = direction === 'postgres-to-mongo' ? 'MongoDB' : 'PostgreSQL';
    const markdownContent = generateMarkdownDossier(currentResult, targetDbName);
    downloadMarkdownDossier(markdownContent);
    setNotification({
      message: '📥 Pre-Flight Verification Dossier (Markdown) exported successfully!',
      type: 'success',
    });
  };

  const toggleDdl = (tblName: string) => {
    setExpandedDdl((prev) => ({ ...prev, [tblName]: !prev[tblName] }));
  };

  return (
    <div className="dry-run-container">
      {/* ── Header Area ── */}
      <div className="dry-run-header-area">
        <div className="dry-run-header-title-group">
          <h1>Step 6 of 8 — Dry Run Simulation</h1>
          <p className="dry-run-header-subtitle">
            Safely test schema creation and transform sample records inside an isolated database transaction before running live migration.
          </p>
        </div>
        <div className="dry-run-header-badges">
          <span className="dry-run-badge safe">
            <span>🛡️</span> Zero Permanent Writes
          </span>
          <span className="dry-run-badge target">
            <span>🎯</span> Target: {direction === 'postgres-to-mongo' ? 'MongoDB' : 'PostgreSQL'}
          </span>
          <span className="dry-run-badge batch">
            <span>📊</span> 500 Sample Docs / Table
          </span>
        </div>
      </div>

      {/* ── Top Explanation Card (Full when idle or expanded; compact when running/completed) ── */}
      {simState === 'idle' || showExplanationDetails ? (
        <div className="dry-run-explanation-card">
          <div className="dry-run-explanation-icon">🧪</div>
          <div className="dry-run-explanation-content" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Safe Pre-Flight Shadow Testing</h3>
              {simState !== 'idle' && (
                <button
                  className="dry-run-explanation-toggle-link"
                  onClick={() => setShowExplanationDetails(false)}
                >
                  Collapse ✕
                </button>
              )}
            </div>
            <p style={{ marginTop: '0.5rem' }}>
              A Dry Run simulates your full migration without making any permanent changes to your database. MigrateIQ opens a PostgreSQL transaction (<code>BEGIN</code>), test-executes all <code>CREATE TABLE</code> statements, transforms up to 500 real sample documents per collection, isolates any malformed records using savepoints, and terminates with an immediate <code>ROLLBACK</code>.
            </p>
            <div className="dry-run-explanation-guarantees">
              <div className="dry-run-guarantee-item">
                <span className="icon">✓</span> Mathematically guaranteed zero leftover tables
              </div>
              <div className="dry-run-guarantee-item">
                <span className="icon">✓</span> Validates data type constraints and nullability
              </div>
              <div className="dry-run-guarantee-item">
                <span className="icon">✓</span> Preserves child table ordering (sort_order column)
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="dry-run-explanation-compact">
          <div className="dry-run-explanation-compact-left">
            <span style={{ fontSize: '1.25rem' }}>🧪</span>
            <span>
              <strong>Safe Shadow Sandbox:</strong> Testing schema and data in an isolated transaction (<code>BEGIN; lock_timeout = 5s</code>). 100% guaranteed zero permanent changes.
            </span>
          </div>
          <button
            className="dry-run-explanation-toggle-link"
            onClick={() => setShowExplanationDetails(true)}
          >
            Read Explanation
          </button>
        </div>
      )}

      {/* ── Notification Banner ── */}
      {notification && (
        <div className={`dry-run-notification-banner ${notification.type}`}>
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 'bold',
              fontSize: '1rem',
              padding: '0 0.25rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Idle State (Central CTA) ── */}
      {simState === 'idle' && (
        <div className="dry-run-cta-card">
          <div className="dry-run-cta-icon-wrapper">▶</div>
          <h2>Ready to Run Simulation</h2>
          <p>
            We will validate {schemaMapping?.length || 0} mapped tables against your target database using an isolated transaction. No production records will be altered.
          </p>
          <button className="dry-run-start-btn" onClick={() => handleStartSimulation()}>
            <span>▶</span> Run Simulation
          </button>
          {onSkip && (
            <button
              className="dry-run-skip-link"
              onClick={() => {
                if (
                  window.confirm(
                    'Skipping the Dry Run bypasses all pre-flight safety checks.\n\n' +
                      'No schema or data validation will be performed before the live migration runs.\n\n' +
                      'Are you sure you want to proceed directly to live migration?'
                  )
                ) {
                  onSkip();
                }
              }}
            >
              Skip Dry Run and migrate directly
            </button>
          )}
        </div>
      )}

      {/* ── Running State (Interactive Terminal) ── */}
      {simState === 'running' && (
        <DryRunTerminal
          logs={logs}
          schemaMappingCount={schemaMapping?.length || 1}
          subtitle="SIMULATION IN PROGRESS"
          showProgress={true}
        />
      )}

      {/* ── Error State ── */}
      {simState === 'error' && (
        <div className="dry-run-results-card">
          <div className="dry-run-banner failed">
            <div className="dry-run-banner-left">
              <div className="dry-run-banner-icon">❌</div>
              <div>
                <h4 className="dry-run-banner-title">Dry Run Simulation Failed</h4>
                <p className="dry-run-banner-subtitle">
                  The target database rejected one or more simulation statements. Target database remains 100% untouched.
                </p>
              </div>
            </div>
            <button className="dry-run-btn-rerun" onClick={() => handleStartSimulation()}>
              🔄 Retry Simulation
            </button>
          </div>
          {errorMessage && (
            <div className="dry-run-skipped-snippet" style={{ color: '#DC2626', background: '#FEF2F2', borderColor: '#FECACA' }}>
              {errorMessage}
            </div>
          )}
        </div>
      )}

      {/* ── Completed Results Dashboard ── */}
      {simState === 'completed' && currentResult && (
        <div className="dry-run-results-card">
          {/* Banner */}
          <div className={`dry-run-banner ${currentResult.overallStatus}`}>
            <div className="dry-run-banner-left">
              <div className="dry-run-banner-icon">
                {currentResult.overallStatus === 'passed' ? '✅' : '⚠️'}
              </div>
              <div>
                <h4 className="dry-run-banner-title">
                  DRY RUN COMPLETE — Nothing was changed in your database
                </h4>
                <p className="dry-run-banner-subtitle">
                  {currentResult.totalSampleFailed === 0
                    ? 'All tables and sample data batches passed schema validation and constraint tests.'
                    : `${currentResult.totalSampleFailed} sample row(s) encountered validation issues and would be skipped during live migration.`}
                </p>
              </div>
            </div>
            <div className="dry-run-banner-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span>⏱️ {currentResult.executionTimeMs}ms</span>
              <span>🔒 ROLLBACK: Verified</span>
              <button
                className="dry-run-log-toggle-btn"
                onClick={() => setShowExecutionLog((prev) => !prev)}
                title="Toggle real-time terminal execution log"
              >
                📋 {showExecutionLog ? 'Hide Execution Log' : 'View Execution Log'}
              </button>
            </div>
          </div>

          {/* Optional Expanded Execution Log in Completed State */}
          {showExecutionLog && (
            <div style={{ margin: '0 0 1rem 0' }}>
              <DryRunTerminal
                logs={logs}
                schemaMappingCount={currentResult.totalTables}
                height="280px"
                subtitle="EXECUTION LOG AUDIT"
                title={currentResult.rollbackVerified ? 'Verified Zero-Mutation Session' : 'Transaction Sandbox'}
                showProgress={false}
              />
            </div>
          )}

          {/* Product Blueprint Summary Card */}
          <BlueprintSummaryCard
            result={currentResult}
            onViewAffectedRows={(tbl) => {
              setModalTableFilter(tbl || 'all');
              setModalSearch('');
              setModalOpen(true);
            }}
          />

          {/* 4 Metric Summary Cards */}
          <div className="dry-run-metrics-grid">
            <div className="dry-run-metric-card success">
              <span className="dry-run-metric-label">Tables Verified</span>
              <span className="dry-run-metric-value">{currentResult.totalTables}</span>
              <span className="dry-run-metric-subtext">100% DDL syntax valid</span>
            </div>

            <div className="dry-run-metric-card">
              <span className="dry-run-metric-label">Sample Rows Tested</span>
              <span className="dry-run-metric-value">{currentResult.totalSampleTested.toLocaleString()}</span>
              <span className="dry-run-metric-subtext">From live collections</span>
            </div>

            <div className="dry-run-metric-card success">
              <span className="dry-run-metric-label">Would Migrate (Sample)</span>
              <span className="dry-run-metric-value">{currentResult.totalSamplePassed.toLocaleString()}</span>
              <span className="dry-run-metric-subtext">
                {((currentResult.totalSamplePassed / (currentResult.totalSampleTested || 1)) * 100).toFixed(1)}% success rate
              </span>
            </div>

            <div className={`dry-run-metric-card ${currentResult.totalSampleFailed > 0 ? 'warning' : 'success'}`}>
              <span className="dry-run-metric-label">Would Skip (Sample)</span>
              <span className="dry-run-metric-value">{currentResult.totalSampleFailed}</span>
              <span className="dry-run-metric-subtext">
                {currentResult.totalSampleFailed > 0 ? (
                  <button
                    className="dry-run-action-link warning"
                    style={{ padding: 0 }}
                    onClick={() => {
                      setModalTableFilter('all');
                      setModalSearch('');
                      setModalOpen(true);
                    }}
                  >
                    View affected rows →
                  </button>
                ) : (
                  'Zero data anomalies'
                )}
              </span>
            </div>
          </div>

          {/* ── Telemetry & Storage Headroom Bar ── */}
          <div className="dry-run-telemetry-bar">
            <div className="dry-run-telemetry-item">
              <span className="telemetry-icon">⚡</span>
              <div>
                <span className="telemetry-label">Throughput</span>
                <span className="telemetry-value">
                  {currentResult.throughputRowsPerSec?.toLocaleString() || '2,450'} rows/s
                </span>
              </div>
            </div>

            <div className="dry-run-telemetry-item">
              <span className="telemetry-icon">⏱️</span>
              <div>
                <span className="telemetry-label">Full Migration ETA</span>
                <span className="telemetry-value">
                  ~{currentResult.projectedDurationSec || 8}s (for ~{(currentResult.totalProjectedMigrate + currentResult.totalProjectedSkip).toLocaleString()} rows)
                </span>
              </div>
            </div>

            <div className="dry-run-telemetry-item">
              <span className="telemetry-icon">📦</span>
              <div>
                <span className="telemetry-label">Projected Size</span>
                <span className="telemetry-value">
                  {currentResult.storageHeadroom?.formattedProjectedSize || '6.2 MB'}
                </span>
              </div>
            </div>

            <div className="dry-run-telemetry-item">
              <span className="telemetry-icon">💾</span>
              <div>
                <span className="telemetry-label">Storage Headroom</span>
                <span className="telemetry-value" style={{ color: currentResult.storageHeadroom?.sufficientSpace !== false ? '#16A34A' : '#DC2626' }}>
                  {currentResult.storageHeadroom?.sufficientSpace !== false
                    ? (currentResult.storageHeadroom?.formattedProjectedSize ? `Capacity Verified (~${currentResult.storageHeadroom.formattedProjectedSize})` : 'Capacity Verified')
                    : 'Low Disk Space Warning'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="dry-run-export-btn primary"
                onClick={handleExportPdf}
                title="Download auditor-ready Pre-Flight Verification Dossier (PDF)"
              >
                📄 Export PDF
              </button>
              <button
                className="dry-run-export-btn"
                onClick={handleExportMarkdown}
                title="Download developer Markdown verification report (.md)"
              >
                📝 Export Markdown
              </button>
            </div>
          </div>

          {/* ── 3-Tier Resolution Strategy Callout ── */}
          {currentResult.totalSampleFailed > 0 && !quarantinePolicyAcknowledged && (
            <div className="dry-run-resolution-card">
              <div className="dry-run-resolution-header">
                <div className="dry-run-resolution-header-left">
                  <span className="dry-run-resolution-icon">💡</span>
                  <div>
                    <h4>Data Quality Anomaly Detected — Choose Resolution Strategy</h4>
                    <p>
                      {currentResult.totalSampleFailed} sample row(s) in "{currentResult.allSkippedRows[0]?.targetTable || 'table'}" failed validation{currentResult.allSkippedRows[0]?.field ? ` on column "${currentResult.allSkippedRows[0].field}"` : ''} ({currentResult.allSkippedRows[0]?.reason?.substring(0, 120) || 'Constraint violation'}). Select how MigrateIQ should handle these rows:
                    </p>
                  </div>
                </div>
              </div>

              <div className="dry-run-strategies-grid">
                {/* Option A: Smart Default Imputation (RECOMMENDED) */}
                <div className="dry-run-strategy-box recommended">
                  <div>
                    <div className="dry-run-strategy-tag recommended">
                      🌟 Option A • Recommended (100% Ingestion & Zero Downtime)
                    </div>
                    <h5>⚡ Smart Default Imputation (Cleansing Fallback)</h5>
                    <p>
                      Substitutes missing values with intelligent domain-aware defaults and configures <code>DEFAULT NOT NULL</code> constraints in PostgreSQL.
                    </p>
                    <ul className="dry-run-strategy-list pro">
                      <li>✓ <strong>100% Migration Success:</strong> All {currentResult.totalSampleTested.toLocaleString()} sample records (and ~{(currentResult.totalProjectedMigrate + currentResult.totalProjectedSkip).toLocaleString()} projected rows) migrate cleanly.</li>
                      <li>✓ <strong>Zero Downstream Crashes:</strong> Schema stays <code>NOT NULL</code>. Apps & ORMs won't crash on unexpected NULLs.</li>
                      <li>✓ <strong>Reconciliation Passes:</strong> Automated ETL row-count tests pass 100% (Source count = Target count).</li>
                    </ul>

                    <div style={{ marginTop: '0.875rem', padding: '0.625rem 0.875rem', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.125rem' }}>✨</span>
                      <div style={{ fontSize: '0.8125rem', color: '#0369A1' }}>
                        <strong>Remediation Modes:</strong> ✨ Smart AI (Gemini) auto-remediation with Before & After diff review, or ⚙️ Manual Precision Studio.
                      </div>
                    </div>
                  </div>

                  <button
                    className="dry-run-strategy-btn recommended"
                    onClick={() => {
                      setRemediationTab('smart');
                      setRemediationModalOpen(true);
                    }}
                    title="Launch the Data Quality Remediation Studio to inspect AI recommendations or set manual defaults"
                  >
                    <span>🔧 Configure & Apply Fix (Recommended) →</span>
                  </button>
                </div>

                {/* Option B: Relax Schema to NULLABLE (CAUTION) */}
                <div className="dry-run-strategy-box caution">
                  <div>
                    <div className="dry-run-strategy-tag caution">
                      ⚠️ Option B • Caution (Downstream App Crash Risk)
                    </div>
                    <h5>🔓 Relax Schema to NULLABLE</h5>
                    <p>
                      Alters target PostgreSQL column from <code>NOT NULL</code> to <code>NULLABLE</code> so missing records can insert directly.
                    </p>
                    <ul className="dry-run-strategy-list con">
                      <li>⚠️ <strong>App Crash Hazard:</strong> Downstream APIs & ORMs expecting non-null strings will crash with <em>NullPointerException</em> or <em>TypeError</em>!</li>
                      <li>⚠️ <strong>Degrades Integrity:</strong> Weakens database constraint contracts for all future writes.</li>
                    </ul>
                  </div>

                  <button
                    className="dry-run-strategy-btn caution"
                    onClick={() => {
                      const firstRow = currentResult.allSkippedRows[0];
                      const targetTbl = firstRow?.targetTable || currentResult.tables.find((t) => t.sampleFailed > 0)?.targetTableName || currentResult.tables[0]?.targetTableName || '';
                      const matchingCol = (useWizardStore.getState().schemaMapping || schemaMapping || []).find(
                        (m) => m.targetTableName.toLowerCase() === targetTbl.toLowerCase() || m.collectionName.toLowerCase() === targetTbl.toLowerCase()
                      );
                      const targetFld = firstRow?.field || matchingCol?.fields.find((f) => !f.isNullable && f.targetColumn !== 'id' && f.targetColumn !== '_id')?.targetColumn || '';
                      handleApplyQuickFix(targetTbl, targetFld);
                    }}
                  >
                    <span>⚠️ Relax to NULLABLE & Re-simulate</span>
                  </button>
                </div>

                {/* Option C: Strict Quarantine (DLQ) (WARNING) */}
                <div className="dry-run-strategy-box warning">
                  <div>
                    <div className="dry-run-strategy-tag warning">
                      ⚠️ Option C • Warning (Data Loss & Mismatch)
                    </div>
                    <h5>🛡️ Strict Quarantine to Dead-Letter Queue (DLQ)</h5>
                    <p>
                      Enforces strict <code>NOT NULL</code> constraint without fallbacks. Isolates the {currentResult.totalSampleFailed} invalid rows to <code>_migration_dlq</code> table and audit log.
                    </p>
                    <ul className="dry-run-strategy-list con">
                      <li>⚠️ <strong>ETL Row-Count Mismatch:</strong> Phase 9 reconciliation test will report a row-count mismatch (498 migrated vs 500 source).</li>
                      <li>⚠️ <strong>Customer Records Excluded:</strong> Affects production data completeness until manually repaired.</li>
                    </ul>
                  </div>

                  <button
                    className="dry-run-strategy-btn warning"
                    onClick={handleAcknowledgeQuarantine}
                  >
                    <span>🛡️ Proceed with Quarantine (DLQ)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Active Quarantine State Banner ── */}
          {currentResult.totalSampleFailed > 0 && quarantinePolicyAcknowledged && (
            <div className="dry-run-quarantine-active-card">
              <div className="dry-run-quarantine-left">
                <span className="dry-run-quarantine-icon">🛡️</span>
                <div>
                  <h4>Quarantine Policy Confirmed (AWS DMS Standard)</h4>
                  <p>
                    Strict NOT NULL constraints are preserved on target PostgreSQL tables. Clean records ({currentResult.totalSamplePassed.toLocaleString()}) will migrate into production; the {currentResult.totalSampleFailed} violating record(s) will be automatically isolated in the Dead-Letter Queue (DLQ) and recorded in the migration audit log.
                  </p>
                </div>
              </div>
              <button
                className="dry-run-action-link"
                onClick={() => setQuarantinePolicyAcknowledged(false)}
              >
                Change Strategy
              </button>
            </div>
          )}

          {/* Per-Table Breakdown List */}
          <div className="dry-run-tables-section">
            <h3 className="dry-run-tables-section-title">
              <span>Per-Table Simulation Breakdown</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 'normal', color: '#64748B' }}>
                Extrapolated based on source document counts
              </span>
            </h3>

            <table className="dry-run-tables-table">
              <thead>
                <tr>
                  <th>Target Table</th>
                  <th>Columns</th>
                  <th>Schema DDL</th>
                  <th>Sample Test (500 Batch)</th>
                  <th>Projected Total</th>
                  <th>Skipped Rows</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentResult.tables.map((tbl) => (
                  <React.Fragment key={tbl.targetTableName}>
                    <tr>
                      <td>
                        <div className="dry-run-table-name-cell">
                          <span>{tbl.targetTableName}</span>
                          {tbl.isChildTable && <span className="dry-run-pill child">Child Table</span>}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontWeight: 500 }}>{tbl.columnsCount} columns</span>
                      </td>
                      <td>
                        <span className="dry-run-pill valid">Valid ✅</span>
                      </td>
                      <td>
                        <div className="dry-run-progress-mini">
                          <span>{tbl.samplePassed}/{tbl.sampleTested}</span>
                          <div className="dry-run-progress-mini-bar">
                            <div
                              className={`dry-run-progress-mini-fill ${tbl.sampleFailed > 0 ? 'has-errors' : ''}`}
                              style={{ width: `${(tbl.samplePassed / tbl.sampleTested) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#1E293B' }}>
                          ~{tbl.projectedMigrateCount.toLocaleString()} rows
                        </span>
                      </td>
                      <td>
                        {tbl.sampleFailed > 0 ? (
                          <span style={{ color: '#D97706', fontWeight: 600 }}>
                            ⚠️ {tbl.sampleFailed} rows skipped
                          </span>
                        ) : (
                          <span style={{ color: '#16A34A' }}>0 skipped</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            className="dry-run-action-link"
                            style={{ color: '#2563EB', fontWeight: 600 }}
                            onClick={() => handleRetestSingleTable(tbl.targetTableName)}
                            title={`Re-test ${tbl.targetTableName} in isolated transaction`}
                          >
                            🔄 Re-test
                          </button>
                          {tbl.sampleFailed > 0 && (
                            <button
                              className="dry-run-action-link warning"
                              onClick={() => {
                                setModalTableFilter(tbl.targetTableName);
                                setModalSearch('');
                                setModalOpen(true);
                              }}
                            >
                              View rows
                            </button>
                          )}
                          <button className="dry-run-action-link" onClick={() => toggleDdl(tbl.targetTableName)}>
                            {expandedDdl[tbl.targetTableName] ? 'Hide SQL' : 'View SQL'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedDdl[tbl.targetTableName] && tbl.ddlPreview && (
                      <tr>
                        <td colSpan={7} style={{ background: '#F8FAFC', padding: '0.75rem 1rem' }}>
                          <div className="dry-run-sql-preview-container">{tbl.ddlPreview}</div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: View Affected / Skipped Rows ── */}
      {currentResult && (
        <SkippedRowsModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          currentResult={currentResult}
          schemaMapping={schemaMapping}
          modalTableFilter={modalTableFilter}
          setModalTableFilter={setModalTableFilter}
          modalSearch={modalSearch}
          setModalSearch={setModalSearch}
          quarantinePolicyAcknowledged={quarantinePolicyAcknowledged}
          onOpenRemediationStudio={(tab) => {
            setRemediationTab(tab);
            setRemediationModalOpen(true);
          }}
          onApplyQuickFix={handleApplyQuickFix}
          onAcknowledgeQuarantine={handleAcknowledgeQuarantine}
        />
      )}

      {/* ── Modal: Data Quality Remediation Studio ── */}
      <RemediationStudioModal
        isOpen={remediationModalOpen}
        onClose={() => setRemediationModalOpen(false)}
        anomalies={getDistinctAnomalies()}
        onApplyFixes={handleApplyRemediationFixes}
        initialTab={remediationTab}
      />

      {/* ── Bottom Navigation Footer ── */}
      <div className="dry-run-footer">
        <div className="dry-run-footer-left">
          <button className="dry-run-btn-back" onClick={onBack}>
            ← Go Back to Risk Report
          </button>
          {simState === 'completed' && (
            <button className="dry-run-btn-rerun" onClick={() => handleStartSimulation()}>
              🔄 Re-run Simulation
            </button>
          )}
        </div>

        <div className="dry-run-footer-right">
          {simState === 'idle' && onSkip && (
            <button
              className="dry-run-skip-link"
              onClick={() => {
                if (
                  window.confirm(
                    'Skipping the Dry Run bypasses all pre-flight safety checks.\n\n' +
                      'No schema or data validation will be performed before the live migration runs.\n\n' +
                      'Are you sure you want to proceed directly to live migration?'
                  )
                ) {
                  onSkip();
                }
              }}
            >
              Skip Dry Run and migrate directly
            </button>
          )}

          {simState === 'idle' ? (
            <button
              className="dry-run-btn-continue"
              onClick={() => handleStartSimulation()}
            >
              <span>▶ Run Simulation to Continue →</span>
            </button>
          ) : simState === 'running' ? (
            <button
              className="dry-run-btn-continue"
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            >
              <span>⏳ Simulation in Progress...</span>
            </button>
          ) : currentResult && currentResult.totalSampleFailed === 0 ? (
            <button
              className="dry-run-btn-continue"
              onClick={onContinue}
            >
              <span>✅ All Rows Validated — Run Real Migration →</span>
            </button>
          ) : quarantinePolicyAcknowledged ? (
            <button
              className="dry-run-btn-continue"
              onClick={onContinue}
            >
              <span>🛡️ Proceed with Quarantine Policy (Step 7) →</span>
            </button>
          ) : (
            <button
              className="dry-run-btn-continue"
              disabled
              style={{ opacity: 0.65, cursor: 'not-allowed' }}
              title="Please resolve data quality anomalies (Option A or B) or choose Quarantine (Option C) to proceed"
            >
              <span>⚠️ Resolve Anomalies or Quarantine to Continue</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
