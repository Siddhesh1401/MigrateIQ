import { ipcMain } from 'electron';
import ElectronStore from 'electron-store';
import { randomUUID } from 'crypto';
import type { AIUsageLogEntry, AIUsageStats, IPCResponse } from '@migrateiq/shared';

interface AIUsageStoreSchema {
  logs: AIUsageLogEntry[];
  currentDate: string; // YYYY-MM-DD
  requestsToday: number;
  tokensToday: number;
  lifetimeRequests: number;
  lifetimeTokens: number;
  lastUsedTimestamp: string | null;
}

const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

const aiStore = new ElectronStore<AIUsageStoreSchema>({
  name: 'migrateiq-ai-usage',
  defaults: {
    logs: [],
    currentDate: getTodayDateString(),
    requestsToday: 0,
    tokensToday: 0,
    lifetimeRequests: 0,
    lifetimeTokens: 0,
    lastUsedTimestamp: null,
  },
});

/**
 * Checks and rolls over the daily counter if a new day has started
 */
function ensureTodayCounters(): void {
  const today = getTodayDateString();
  const storedDate = aiStore.get('currentDate', today);
  if (storedDate !== today) {
    aiStore.set('currentDate', today);
    aiStore.set('requestsToday', 0);
    aiStore.set('tokensToday', 0);
  }
}

/**
 * Records an AI request execution into persistent electron-store
 */
export function recordAIUsage(entry: Omit<AIUsageLogEntry, 'id'>): void {
  try {
    ensureTodayCounters();

    const logEntry: AIUsageLogEntry = {
      ...entry,
      id: randomUUID(),
    };

    const logs = aiStore.get('logs', []);
    // Prepend and keep the latest 500 entries
    const updatedLogs = [logEntry, ...logs].slice(0, 500);

    const isActualApiCall = entry.status !== 'cached';
    const currentReqToday = aiStore.get('requestsToday', 0);
    const currentTokensToday = aiStore.get('tokensToday', 0);
    const lifetimeReq = aiStore.get('lifetimeRequests', 0);
    const lifetimeTok = aiStore.get('lifetimeTokens', 0);

    aiStore.set('logs', updatedLogs);
    aiStore.set('lastUsedTimestamp', logEntry.timestamp);

    if (isActualApiCall) {
      aiStore.set('requestsToday', currentReqToday + 1);
      aiStore.set('tokensToday', currentTokensToday + entry.totalTokens);
      aiStore.set('lifetimeRequests', lifetimeReq + 1);
      aiStore.set('lifetimeTokens', lifetimeTok + entry.totalTokens);
    }
  } catch (err) {
    console.warn('[AI Usage Store] Failed to record usage entry:', err);
  }
}

/**
 * Retrieves overall usage metrics
 */
export function getAIUsageStats(): AIUsageStats {
  ensureTodayCounters();
  return {
    requestsToday: aiStore.get('requestsToday', 0),
    dailyLimit: 1500, // Google Gemini Flash free tier limit per day
    tokensToday: aiStore.get('tokensToday', 0),
    lifetimeRequests: aiStore.get('lifetimeRequests', 0),
    lifetimeTokens: aiStore.get('lifetimeTokens', 0),
    lastUsedTimestamp: aiStore.get('lastUsedTimestamp', null),
  };
}

/**
 * Retrieves the full chronological log array
 */
export function getAIUsageLogs(): AIUsageLogEntry[] {
  return aiStore.get('logs', []);
}

/**
 * Clears logs while preserving daily & lifetime counters
 */
export function clearAIUsageLogs(): void {
  aiStore.set('logs', []);
}

/**
 * Reset all counters and logs (full reset)
 */
export function resetAllAIUsage(): void {
  aiStore.set('logs', []);
  aiStore.set('requestsToday', 0);
  aiStore.set('tokensToday', 0);
  aiStore.set('lifetimeRequests', 0);
  aiStore.set('lifetimeTokens', 0);
  aiStore.set('lastUsedTimestamp', null);
}

/**
 * Setup IPC Handlers for AI Usage Tracking
 */
export function setupAIUsageHandlers(): void {
  ipcMain.handle(
    'ai:get-usage-stats',
    async (): Promise<IPCResponse<AIUsageStats>> => {
      try {
        const stats = getAIUsageStats();
        return { success: true, data: stats };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    'ai:get-usage-logs',
    async (): Promise<IPCResponse<AIUsageLogEntry[]>> => {
      try {
        const logs = getAIUsageLogs();
        return { success: true, data: logs };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    'ai:clear-usage-logs',
    async (): Promise<IPCResponse<boolean>> => {
      try {
        clearAIUsageLogs();
        return { success: true, data: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    'ai:reset-usage-all',
    async (): Promise<IPCResponse<boolean>> => {
      try {
        resetAllAIUsage();
        return { success: true, data: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );
}
