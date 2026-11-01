/**
 * MigrateIQ - Real-Time Benchmark IPC Handlers (Phase 10)
 * 
 * Handles `benchmark:run-comparison` channel.
 * Executes live parallel queries against MongoDB and PostgreSQL.
 */

import { ipcMain } from 'electron';
import type { 
  ConnectionConfig, 
  CollectionMapping, 
  Phase10BenchmarkResult 
} from '@migrateiq/shared';
import { runQueryBenchmark } from '../engine/benchmarkEngine';
import { maskSensitiveFields } from './risk';

export interface BenchmarkIpcPayload {
  sourceConfig: ConnectionConfig;
  targetConfig: ConnectionConfig;
  queryCount?: number;
  concurrency?: number;
  mappings?: CollectionMapping[];
}

export function setupBenchmarkHandlers(): void {
  ipcMain.handle('benchmark:run-comparison', async (_event, payload: BenchmarkIpcPayload) => {
    try {
      if (!payload || !payload.sourceConfig || !payload.targetConfig) {
        return {
          success: false,
          error: 'Missing required database connection configuration for benchmark.'
        };
      }

      const result: Phase10BenchmarkResult = await runQueryBenchmark({
        sourceConfig: payload.sourceConfig,
        targetConfig: payload.targetConfig,
        queryCount: payload.queryCount || 1000,
        concurrency: payload.concurrency || 20,
        mappings: payload.mappings || []
      });

      return {
        success: true,
        data: result
      };
    } catch (err) {
      const errorMsg = maskSensitiveFields((err as Error).message || 'Failed to execute query benchmark');
      return {
        success: false,
        error: errorMsg
      };
    }
  });
}

