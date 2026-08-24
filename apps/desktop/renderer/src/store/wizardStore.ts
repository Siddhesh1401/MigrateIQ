import { create } from 'zustand';
import type { ConnectionConfig, SourceSchema } from '@migrateiq/shared';

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
  layer2Features: Layer2Features | null;
  wizardStep: number; // 1-8
  isDemoMode: boolean;

  // Actions
  setDirection: (dir: 'mongodb-to-postgres' | 'postgres-to-mongo') => void;
  setSourceConfig: (config: ConnectionConfig) => void;
  setSourceSchema: (schema: SourceSchema[]) => void;
  setTargetConfig: (config: ConnectionConfig) => void;
  setLayer2Features: (features: Layer2Features) => void;
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
  layer2Features: null,
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
    set({ direction: dir, wizardStep: 2 });
    persistWizardState({ direction: dir, wizardStep: 2, sourceConfig: null, targetConfig: null, status: 'in-progress' });
  },

  setSourceConfig: (config) => set({ sourceConfig: config }),

  setSourceSchema: (schema) => set({ sourceSchema: schema }),

  setTargetConfig: (config) => set({ targetConfig: config }),

  setLayer2Features: (features) => set({ layer2Features: features }),

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
