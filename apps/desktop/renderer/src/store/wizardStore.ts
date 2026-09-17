import { create } from 'zustand';
import type { 
  ConnectionConfig, 
  SourceSchema, 
  CollectionMapping, 
  RiskAnalysisResult, 
  AutoFixAction 
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
  acknowledgedRiskIds: string[];
  acknowledgedLayer2Ids: string[];
  recommendedBatchSize: number;
  deferForeignKeys: boolean;
  wizardStep: number; // 1-8
  isDemoMode: boolean;

  // Actions
  setDirection: (dir: 'mongodb-to-postgres' | 'postgres-to-mongo') => void;
  setSourceConfig: (config: ConnectionConfig) => void;
  setSourceSchema: (schema: SourceSchema[]) => void;
  setTargetConfig: (config: ConnectionConfig) => void;
  setSchemaMapping: (mapping: CollectionMapping[]) => void;
  setLayer2Features: (features: Layer2Features) => void;
  setRiskAnalysis: (result: RiskAnalysisResult | null) => void;
  setDeferForeignKeys: (defer: boolean) => void;
  toggleAcknowledgeRisk: (riskId: string) => void;
  toggleAcknowledgeLayer2: (featureId: string) => void;
  applyAutoFix: (action: AutoFixAction) => void;
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
  acknowledgedRiskIds: [],
  acknowledgedLayer2Ids: [],
  recommendedBatchSize: 500,
  deferForeignKeys: false,
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

  setSourceConfig: (config) => set({ sourceConfig: config }),

  setSourceSchema: (schema) => set({ sourceSchema: schema }),

  setTargetConfig: (config) => set({ targetConfig: config }),

  setSchemaMapping: (mapping) => set({ schemaMapping: mapping, riskAnalysis: null, acknowledgedRiskIds: [] }),

  setLayer2Features: (features) => set({ layer2Features: features }),

  setRiskAnalysis: (result) => set({ riskAnalysis: result }),

  setDeferForeignKeys: (defer) => set({ deferForeignKeys: defer }),

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
        if (col.collectionName !== action.collectionName) return col;
        return {
          ...col,
          fields: col.fields.map((f) =>
            f.sourceField === action.fieldName || f.targetColumn === action.fieldName
              ? { ...f, isNullable: true }
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
