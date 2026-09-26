import { create } from 'zustand';
import type { 
  ConnectionConfig, 
  SourceSchema, 
  CollectionMapping, 
  RiskAnalysisResult, 
  AutoFixAction,
  DryRunResult,
  MigrationResult,
  MigrationLogEntry,
} from '@migrateiq/shared';

export interface Layer2Features {
  storedProcedures: { name: string; count: number };
  functions: { name: string; count: number };
  triggers: { name: string; count: number };
  views: { name: string; count: number };
  checkConstraints: { name: string; count: number };
  enumTypes: { name: string; count: number };
  compositePrimaryKeys: { table: string; columns: string[] }[];
}

export interface WizardState {
  // Current state
  direction: 'mongodb-to-postgres' | 'postgres-to-mongo' | null;
  sourceConfig: ConnectionConfig | null;
  sourceSchema: SourceSchema[] | null;
  targetConfig: ConnectionConfig | null;
  schemaMapping: CollectionMapping[] | null;
  layer2Features: Layer2Features | null;
  riskAnalysis: RiskAnalysisResult | null;
  dryRunResult: DryRunResult | null;
  migrationResult: MigrationResult | null;
  migrationLogs: MigrationLogEntry[];
  acknowledgedRiskIds: string[];
  acknowledgedLayer2Ids: string[];
  recommendedBatchSize: number;
  deferForeignKeys: boolean;
  quarantinePolicyAcknowledged: boolean;
  wizardStep: number; // 1-8
  isDemoMode: boolean;

  // Actions
  setDirection: (dir: 'mongodb-to-postgres' | 'postgres-to-mongo') => void;
  setSourceConfig: (config: ConnectionConfig | null) => void;
  setSourceSchema: (schema: SourceSchema[]) => void;
  setTargetConfig: (config: ConnectionConfig | null) => void;
  setSchemaMapping: (mapping: CollectionMapping[]) => void;
  setLayer2Features: (features: Layer2Features) => void;
  setRiskAnalysis: (result: RiskAnalysisResult | null) => void;
  setDryRunResult: (result: DryRunResult | null) => void;
  setMigrationResult: (result: MigrationResult | null) => void;
  setMigrationLogs: (logs: MigrationLogEntry[]) => void;
  appendMigrationLog: (log: MigrationLogEntry) => void;
  setDeferForeignKeys: (defer: boolean) => void;
  setQuarantinePolicyAcknowledged: (acknowledged: boolean) => void;
  toggleAcknowledgeRisk: (riskId: string) => void;
  toggleAcknowledgeLayer2: (featureId: string) => void;
  applyAutoFix: (action: AutoFixAction) => void;
  applyDefaultValue: (tableName: string, fieldName: string, defaultValue: string) => void;
  applyBatchDefaultValues: (fixes: Array<{ tableName: string; fieldName: string; defaultValue: string }>) => void;
  applyAllAutoFixes: () => void;
  applyAllSafeRemediations: () => void;
  acknowledgeAllCritical: () => void;
  resolveAndAcknowledgeAll: () => void;
  acknowledgeAllOfType: (autoFixType: string) => void;
  setWizardStep: (step: number) => void;
  setIsDemoMode: (isDemoMode: boolean) => void;
  reset: () => void;
  getState: () => WizardState;
}

const initialState = {
  direction: null,
  sourceConfig: null,
  sourceSchema: null,
  targetConfig: null,
  schemaMapping: null,
  layer2Features: null,
  riskAnalysis: null,
  dryRunResult: null,
  migrationResult: null,
  migrationLogs: [],
  acknowledgedRiskIds: [],
  acknowledgedLayer2Ids: [],
  recommendedBatchSize: 500,
  deferForeignKeys: false,
  quarantinePolicyAcknowledged: false,
  wizardStep: 1,
  isDemoMode: false,
};

/** Persist current wizard snapshot to electron-store via IPC */
function persistWizardState(state: {
  direction: WizardState['direction'];
  wizardStep: number;
  sourceConfig: ConnectionConfig | null;
  targetConfig: ConnectionConfig | null;
  status: 'in-progress' | 'completed' | 'cancelled';
}): void {
  if (typeof window === 'undefined' || !window.electronAPI) return;

  window.electronAPI
    .invoke('store:save-wizard-state', {
      direction: state.direction,
      wizardStep: state.wizardStep,
      sourceConfig: state.sourceConfig,
      targetConfig: state.targetConfig,
      status: state.status,
      savedAt: new Date().toISOString(),
    })
    .catch(() => {
      // Swallow silently — persistence failure must never crash the wizard
    });
}

export const useWizardStore = create<WizardState>((set, get) => ({
  ...initialState,

  setDirection: (dir) => {
    set({ direction: dir });
    const s = get();
    persistWizardState({ direction: dir, wizardStep: s.wizardStep, sourceConfig: s.sourceConfig, targetConfig: s.targetConfig, status: 'in-progress' });
  },

  setSourceConfig: (config: ConnectionConfig | null) => {
    set({ sourceConfig: config });
    const s = get();
    persistWizardState({ direction: s.direction, wizardStep: s.wizardStep, sourceConfig: config, targetConfig: s.targetConfig, status: 'in-progress' });
  },

  setSourceSchema: (schema) => set({ sourceSchema: schema }),

  setTargetConfig: (config: ConnectionConfig | null) => {
    set({ targetConfig: config });
    const s = get();
    persistWizardState({ direction: s.direction, wizardStep: s.wizardStep, sourceConfig: s.sourceConfig, targetConfig: config, status: 'in-progress' });
  },

  setSchemaMapping: (mapping) => set({ schemaMapping: mapping, riskAnalysis: null, dryRunResult: null, migrationResult: null, migrationLogs: [], acknowledgedRiskIds: [] }),

  setLayer2Features: (features) => set({ layer2Features: features }),

  setRiskAnalysis: (result) => set({ riskAnalysis: result }),

  setDryRunResult: (result) => set({ dryRunResult: result }),

  setMigrationResult: (result) => set({ migrationResult: result }),

  setMigrationLogs: (logs) => set({ migrationLogs: logs }),

  appendMigrationLog: (log) => set((s) => ({ migrationLogs: [...s.migrationLogs, log] })),

  setDeferForeignKeys: (defer) => set({ deferForeignKeys: defer }),

  setQuarantinePolicyAcknowledged: (acknowledged) => set({ quarantinePolicyAcknowledged: acknowledged }),

  toggleAcknowledgeRisk: (riskId) => {
    const { acknowledgedRiskIds } = get();
    const isAck = acknowledgedRiskIds.includes(riskId);
    set({
      acknowledgedRiskIds: isAck
        ? acknowledgedRiskIds.filter((id) => id !== riskId)
        : [...acknowledgedRiskIds, riskId],
    });
  },

  toggleAcknowledgeLayer2: (featureId) => {
    const { acknowledgedLayer2Ids } = get();
    const isAck = acknowledgedLayer2Ids.includes(featureId);
    set({
      acknowledgedLayer2Ids: isAck
        ? acknowledgedLayer2Ids.filter((id) => id !== featureId)
        : [...acknowledgedLayer2Ids, featureId],
    });
  },

  applyAutoFix: (action: AutoFixAction) => {
    const { schemaMapping, riskAnalysis } = get();
    if (!schemaMapping) return;

    let updatedMappings = [...schemaMapping];

    if (action.type === 'set_nullable' && action.fieldName) {
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, isNullable: true }
              : f
          ),
        };
      });
    } else if (action.type === 'set_default_value' && action.fieldName) {
      const defVal = typeof action.recommendedValue === 'string' ? action.recommendedValue : 'Unknown';
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, defaultValue: defVal, isNullable: false }
              : f
          ),
        };
      });
    } else if (action.type === 'create_child_table' && action.fieldName) {
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName
              ? {
                  ...f,
                  isChildTable: true,
                  childTableName: `${action.collectionName}_${action.fieldName}`,
                  include: true,
                }
              : f
          ),
        };
      });
    } else if (action.type === 'reduce_batch_size') {
      const newSize = typeof action.recommendedValue === 'number' ? action.recommendedValue : 50;
      set({ recommendedBatchSize: newSize });
    } else if (action.type === 'defer_foreign_keys') {
      set({ deferForeignKeys: true });
    } else if (action.type === 'change_column_type' && action.fieldName) {
      const newType = typeof action.recommendedValue === 'string' ? action.recommendedValue : 'BIGINT';
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, targetType: newType }
              : f
          ),
        };
      });
    } else if (action.type === 'rename_target_column' && action.fieldName) {
      const newName = typeof action.recommendedValue === 'string' ? action.recommendedValue : `${action.fieldName}_col`;
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, targetColumn: newName }
              : f
          ),
        };
      });
    } else if (action.type === 'rename_target_table') {
      const newName = typeof action.recommendedValue === 'string' ? action.recommendedValue : `${action.collectionName}s`;
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName) return col;
        return {
          ...col,
          targetTableName: newName,
        };
      });
    } else if (action.type === 'set_table_action') {
      const act = (typeof action.recommendedValue === 'string' ? action.recommendedValue : 'append') as 'drop' | 'append' | 'rename';
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          tableAction: act,
        };
      });
    } else if (action.type === 'sanitize_null_bytes' && action.fieldName) {
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, sanitizeNullBytes: true, transformationRule: 'strip_null_bytes' }
              : f
          ),
        };
      });
    } else if (action.type === 'resolve_numeric_special' && action.fieldName) {
      const strat = typeof action.recommendedValue === 'string' ? action.recommendedValue : 'DOUBLE PRECISION';
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) => {
            if (f.sourceField === action.fieldName || f.targetColumn === action.fieldName) {
              if (strat === 'nullify') {
                return { ...f, transformationRule: 'nullify_infinity' };
              } else {
                return { ...f, targetType: 'DOUBLE PRECISION' };
              }
            }
            return f;
          }),
        };
      });
    } else if (action.type === 'resolve_case_collision' && action.fieldName) {
      const newCol = typeof action.recommendedValue === 'string' ? action.recommendedValue : `${action.fieldName}_alt`;
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, targetColumn: newCol }
              : f
          ),
        };
      });
    } else if (action.type === 'sanitize_identifier' && action.fieldName) {
      const clean = typeof action.recommendedValue === 'string' ? action.recommendedValue : action.fieldName.replace(/[^a-zA-Z0-9_]/g, '_');
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, targetColumn: clean }
              : f
          ),
        };
      });
    } else if (action.type === 'resolve_orphan_fk' && action.fieldName) {
      const strat = (typeof action.recommendedValue === 'string' ? action.recommendedValue : 'set_null') as 'set_null' | 'remove_constraint';
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) => {
            if (f.sourceField === action.fieldName || f.targetColumn === action.fieldName) {
              if (strat === 'remove_constraint') {
                return { ...f, foreignKeyToParent: undefined, orphanStrategy: 'remove_constraint' };
              } else {
                return { ...f, orphanStrategy: 'set_null', transformationRule: 'orphan_set_null' };
              }
            }
            return f;
          }),
        };
      });
    } else if (action.type === 'resolve_deep_nesting' && action.fieldName) {
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, targetType: 'JSONB', isJsonb: true }
              : f
          ),
        };
      });
    } else if (action.type === 'sanitize_sparse_array' && action.fieldName) {
      const strat = (typeof action.recommendedValue === 'string' ? action.recommendedValue : 'filter_nulls') as 'filter_nulls' | 'allow_nulls';
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, sparseArrayStrategy: strat, transformationRule: strat === 'filter_nulls' ? 'filter_array_nulls' : undefined }
              : f
          ),
        };
      });
    } else if (action.type === 'assign_primary_key') {
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName) return col;
        const idCol = typeof action.recommendedValue === 'string' ? action.recommendedValue : 'id';
        const existing = col.fields.find((f) => f.targetColumn === idCol);
        if (existing) {
          return {
            ...col,
            fields: col.fields.map((f) => f.targetColumn === idCol ? { ...f, include: true, isNullable: false } : f),
          };
        }
        return {
          ...col,
          fields: [
            {
              id: `pk-${col.collectionName}`,
              sourceField: '_id',
              sourceType: 'ObjectId',
              targetColumn: idCol,
              targetType: 'VARCHAR(64)',
              isNullable: false,
              include: true,
              transformationRule: 'primary_key',
            },
            ...col.fields,
          ],
        };
      });
    } else if (action.type === 'promote_varchar_length' && action.fieldName) {
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, targetType: 'TEXT' }
              : f
          ),
        };
      });
    } else if (action.type === 'sanitize_reserved_keyword' && action.fieldName) {
      const safeAlias = typeof action.recommendedValue === 'string' ? action.recommendedValue : `${action.fieldName}_val`;
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, targetColumn: safeAlias }
              : f
          ),
        };
      });
    } else if (action.type === 'create_foreign_key_index') {
      const idxName = typeof action.recommendedValue === 'string' ? action.recommendedValue : `idx_${action.fieldName}`;
      updatedMappings = updatedMappings.map((col) => {
        if (col.collectionName !== action.collectionName && col.targetTableName !== action.collectionName) return col;
        const currentIndices = col.indexes || [];
        const exists = currentIndices.some((i) => i.targetIndexName === idxName);
        if (exists) return col;
        return {
          ...col,
          indexes: [
            ...currentIndices,
            {
              sourceIndexName: idxName,
              targetIndexName: idxName,
              targetSql: `CREATE INDEX CONCURRENTLY "${idxName}" ON "${col.targetTableName || col.collectionName}" ("${action.fieldName}");`,
              include: true,
              isConcurrently: true,
            },
          ],
        };
      });
    }

    // Update risk item status to fixed
    let updatedRiskAnalysis = riskAnalysis;
    if (riskAnalysis) {
      const updatedRisks = riskAnalysis.risks.map((r) => {
        if (
          r.autoFixAction?.type === action.type &&
          r.autoFixAction?.collectionName === action.collectionName &&
          (!action.fieldName || r.autoFixAction?.fieldName === action.fieldName)
        ) {
          return { ...r, fixed: true, acknowledged: true };
        }
        return r;
      });
      const criticalCount = updatedRisks.filter((r) => r.severity === 'critical' && !r.fixed && !r.acknowledged).length;
      const warningCount = updatedRisks.filter((r) => r.severity === 'warning' && !r.fixed).length;
      const infoCount = updatedRisks.filter((r) => r.severity === 'info').length;
      const safetyScore = Math.max(0, Math.min(100, 100 - (criticalCount * 15 + warningCount * 4)));

      updatedRiskAnalysis = {
        ...riskAnalysis,
        risks: updatedRisks,
        metrics: {
          ...riskAnalysis.metrics,
          criticalCount,
          warningCount,
          infoCount,
          safetyScore,
          recommendedBatchSize:
            action.type === 'reduce_batch_size'
              ? (action.recommendedValue as number) || 50
              : riskAnalysis.metrics.recommendedBatchSize,
        },
      };
    }

    set({
      schemaMapping: updatedMappings,
      riskAnalysis: updatedRiskAnalysis,
    });
  },

  applyDefaultValue: (tableName: string, fieldName: string, defaultValue: string) => {
    const { schemaMapping, dryRunResult } = get();
    if (!schemaMapping) return;

    const lowerTable = tableName.toLowerCase();
    const lowerField = fieldName.toLowerCase();

    const updated = schemaMapping.map((col) => {
      const matchTable =
        col.collectionName.toLowerCase() === lowerTable ||
        col.targetTableName.toLowerCase() === lowerTable;
      if (!matchTable) return col;

      const fieldIdx = col.fields.findIndex(
        (f) =>
          f.sourceField.toLowerCase() === lowerField ||
          f.targetColumn.toLowerCase() === lowerField ||
          (lowerField === 'name' && (f.sourceField.toLowerCase() === 'fullname' || f.targetColumn.toLowerCase() === 'fullname'))
      );

      if (fieldIdx >= 0) {
        return {
          ...col,
          fields: col.fields.map((f, idx) =>
            idx === fieldIdx
              ? { ...f, defaultValue, isNullable: false }
              : f
          ),
        };
      }
      return col;
    });

    // Also resolve dryRunResult in store for rows associated with this specific field
    let updatedDryRun = dryRunResult;
    if (dryRunResult) {
      const updatedTables = dryRunResult.tables.map((tbl) => {
        const matchTable =
          tbl.targetTableName.toLowerCase() === lowerTable ||
          tbl.collectionName.toLowerCase() === lowerTable;
        if (!matchTable) return tbl;

        // Only resolve skipped rows associated with this field
        const remainingTableSkipped = tbl.skippedRows.filter((r) => {
          const f = (r.field || '').toLowerCase();
          return f !== lowerField && f !== (lowerField === 'name' ? 'fullname' : '');
        });
        const resolvedCount = tbl.skippedRows.length - remainingTableSkipped.length;
        if (resolvedCount <= 0 && tbl.sampleFailed === 0) return tbl;

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
          skippedRows: remainingTableSkipped,
        };
      });

      const remainingSkipped = updatedTables.flatMap((t) => t.skippedRows);
      updatedDryRun = {
        ...dryRunResult,
        tables: updatedTables,
        totalSamplePassed: updatedTables.reduce((a, b) => a + b.samplePassed, 0),
        totalSampleFailed: updatedTables.reduce((a, b) => a + b.sampleFailed, 0),
        totalProjectedMigrate: updatedTables.reduce((a, b) => a + b.projectedMigrateCount, 0),
        totalProjectedSkip: updatedTables.reduce((a, b) => a + b.projectedSkipCount, 0),
        overallStatus: remainingSkipped.length > 0 ? 'warning' : 'passed',
        allSkippedRows: remainingSkipped,
      };
    }

    set({ schemaMapping: updated, dryRunResult: updatedDryRun });
  },

  applyBatchDefaultValues: (fixes: Array<{ tableName: string; fieldName: string; defaultValue: string }>) => {
    const { schemaMapping, dryRunResult } = get();
    if (!schemaMapping || fixes.length === 0) return;

    let updated = [...schemaMapping];
    fixes.forEach(({ tableName, fieldName, defaultValue }) => {
      const lowerTable = tableName.toLowerCase();
      const lowerField = fieldName.toLowerCase();

      updated = updated.map((col) => {
        const matchTable =
          col.collectionName.toLowerCase() === lowerTable ||
          col.targetTableName.toLowerCase() === lowerTable;
        if (!matchTable) return col;

        const fieldIdx = col.fields.findIndex(
          (f) =>
            f.sourceField.toLowerCase() === lowerField ||
            f.targetColumn.toLowerCase() === lowerField ||
            (lowerField === 'name' && (f.sourceField.toLowerCase() === 'fullname' || f.targetColumn.toLowerCase() === 'fullname'))
        );

        if (fieldIdx >= 0) {
          return {
            ...col,
            fields: col.fields.map((f, idx) =>
              idx === fieldIdx ? { ...f, defaultValue, isNullable: false } : f
            ),
          };
        }
        return col;
      });
    });

    let updatedDryRun = dryRunResult;
    if (dryRunResult) {
      const updatedTables = dryRunResult.tables.map((tbl) => {
        const tblFixes = fixes.filter(
          (fx) =>
            tbl.targetTableName.toLowerCase() === fx.tableName.toLowerCase() ||
            tbl.collectionName.toLowerCase() === fx.tableName.toLowerCase()
        );
        if (tblFixes.length === 0) return tbl;

        const fixedFields = tblFixes.map((fx) => fx.fieldName.toLowerCase());
        const remainingTableSkipped = tbl.skippedRows.filter((r) => {
          const f = (r.field || '').toLowerCase();
          return !fixedFields.includes(f) && !(fixedFields.includes('name') && f === 'fullname');
        });

        const resolvedCount = tbl.skippedRows.length - remainingTableSkipped.length;
        if (resolvedCount <= 0 && tbl.sampleFailed === 0) return tbl;

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
          skippedRows: remainingTableSkipped,
        };
      });

      const remainingSkipped = updatedTables.flatMap((t) => t.skippedRows);
      updatedDryRun = {
        ...dryRunResult,
        tables: updatedTables,
        totalSamplePassed: updatedTables.reduce((a, b) => a + b.samplePassed, 0),
        totalSampleFailed: updatedTables.reduce((a, b) => a + b.sampleFailed, 0),
        totalProjectedMigrate: updatedTables.reduce((a, b) => a + b.projectedMigrateCount, 0),
        totalProjectedSkip: updatedTables.reduce((a, b) => a + b.projectedSkipCount, 0),
        overallStatus: remainingSkipped.length > 0 ? 'warning' : 'passed',
        allSkippedRows: remainingSkipped,
      };
    }

    set({ schemaMapping: updated, dryRunResult: updatedDryRun });
  },

  // ── Batch Auto-Fix: Apply ALL fixable risks (both critical and warnings) ──
  applyAllAutoFixes: () => {
    const { riskAnalysis, applyAutoFix } = get();
    if (!riskAnalysis) return;
    const fixableRisks = riskAnalysis.risks.filter(
      (r) => r.autoFixAvailable && r.autoFixAction && !r.fixed
    );
    // Apply each fix sequentially — each call is a pure mutation so order is safe
    for (const risk of fixableRisks) {
      applyAutoFix(risk.autoFixAction!);
    }
  },

  // ── Apply All Safe Remediations: Bounded, non-destructive auto-fixes ──
  applyAllSafeRemediations: () => {
    const { riskAnalysis, applyAutoFix } = get();
    if (!riskAnalysis) return;
    const safeFixable = riskAnalysis.risks.filter(
      (r) => r.decisionTier === 'safe' && r.autoFixAvailable && r.autoFixAction && !r.fixed
    );
    for (const risk of safeFixable) {
      applyAutoFix(risk.autoFixAction!);
    }
  },

  // ── Acknowledge All Critical: Mark all critical issues as acknowledged ──
  acknowledgeAllCritical: () => {
    const { riskAnalysis, acknowledgedRiskIds } = get();
    if (!riskAnalysis) return;
    const criticalIds = riskAnalysis.risks
      .filter((r) => r.severity === 'critical' && !r.fixed)
      .map((r) => r.id);
    const merged = Array.from(new Set([...acknowledgedRiskIds, ...criticalIds]));
    set({ acknowledgedRiskIds: merged });
  },

  // ── Resolve & Acknowledge All: 1-Click Fix for all critical + warnings ──
  resolveAndAcknowledgeAll: () => {
    const { applyAllAutoFixes, acknowledgeAllCritical } = get();
    applyAllAutoFixes();
    acknowledgeAllCritical();
  },

  // ── Acknowledge All of Same Type: batch-ignore identical warning categories ─
  acknowledgeAllOfType: (autoFixType: string) => {
    const { riskAnalysis, acknowledgedRiskIds } = get();
    if (!riskAnalysis) return;
    const sameTypeIds = riskAnalysis.risks
      .filter(
        (r) =>
          r.severity === 'warning' &&
          !r.fixed &&
          (r.autoFixAction?.type === autoFixType || (!r.autoFixAction && autoFixType === 'none'))
      )
      .map((r) => r.id);
    const merged = Array.from(new Set([...acknowledgedRiskIds, ...sameTypeIds]));
    set({ acknowledgedRiskIds: merged });
  },

  setWizardStep: (step) => {
    set({ wizardStep: step });
    const s = get();
    persistWizardState({
      direction: s.direction,
      wizardStep: step,
      sourceConfig: s.sourceConfig,
      targetConfig: s.targetConfig,
      status: step >= 8 ? 'completed' : 'in-progress',
    });
  },

  setIsDemoMode: (isDemoMode) => set({ isDemoMode }),

  reset: () => {
    set(initialState);
    // Clear persisted wizard state on explicit reset
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.invoke('store:clear-wizard-state').catch(() => {});
    }
  },

  getState: () => get(),
}));
