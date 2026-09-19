import { create } from 'zustand';
import type { 
  ConnectionConfig, 
  SourceSchema, 
  CollectionMapping, 
  RiskAnalysisResult, 
  AutoFixAction,
  DryRunResult,
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
  setDeferForeignKeys: (defer: boolean) => void;
  setQuarantinePolicyAcknowledged: (acknowledged: boolean) => void;
  toggleAcknowledgeRisk: (riskId: string) => void;
  toggleAcknowledgeLayer2: (featureId: string) => void;
  applyAutoFix: (action: AutoFixAction) => void;
  applyDefaultValue: (tableName: string, fieldName: string, defaultValue: string) => void;
  applyBatchDefaultValues: (fixes: Array<{ tableName: string; fieldName: string; defaultValue: string }>) => void;
  applyAllAutoFixes: () => void;
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
    persistWizardState({
      direction: s.direction,
      wizardStep: s.wizardStep,
      sourceConfig: config,
      targetConfig: s.targetConfig,
      status: 'in-progress',
    });
  },

  setSourceSchema: (schema) => set({ sourceSchema: schema }),

  setTargetConfig: (config: ConnectionConfig | null) => {
    set({ targetConfig: config });
    const s = get();
    persistWizardState({
      direction: s.direction,
      wizardStep: s.wizardStep,
      sourceConfig: s.sourceConfig,
      targetConfig: config,
      status: 'in-progress',
    });
  },

  setSchemaMapping: (mapping) => set({ schemaMapping: mapping, riskAnalysis: null, dryRunResult: null, acknowledgedRiskIds: [] }),

  setLayer2Features: (features) => set({ layer2Features: features }),

  setRiskAnalysis: (result) => set({ riskAnalysis: result }),

  setDryRunResult: (result) => set({ dryRunResult: result }),

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

      updatedRiskAnalysis = {
        ...riskAnalysis,
        risks: updatedRisks,
        metrics: {
          ...riskAnalysis.metrics,
          criticalCount,
          warningCount,
          infoCount,
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

  // ── Batch Auto-Fix: Apply ALL fixable warnings in one click ─────────────
  applyAllAutoFixes: () => {
    const { riskAnalysis, applyAutoFix } = get();
    if (!riskAnalysis) return;
    const fixableRisks = riskAnalysis.risks.filter(
      (r) => r.autoFixAvailable && r.autoFixAction && !r.fixed && r.severity !== 'critical'
    );
    // Apply each fix sequentially — each call is a pure mutation so order is safe
    for (const risk of fixableRisks) {
      applyAutoFix(risk.autoFixAction!);
    }
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
