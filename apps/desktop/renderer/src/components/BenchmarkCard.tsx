/**
 * MigrateIQ - Real-Time Query Performance Benchmark Component (Phase 10)
 * 
 * Runs 1,000 non-mutating parallel queries across live MongoDB and PostgreSQL
 * and renders comparative latency bars and speedup metrics.
 */

import React, { useState } from 'react';
import type { 
  ConnectionConfig, 
  CollectionMapping, 
  Phase10BenchmarkResult 
} from '@migrateiq/shared';

export interface BenchmarkCardProps {
  sourceConfig: ConnectionConfig | null;
  targetConfig: ConnectionConfig | null;
  mappings: CollectionMapping[] | null;
  initialResult?: Phase10BenchmarkResult | null;
  onBenchmarkComplete?: (result: Phase10BenchmarkResult) => void;
}

export const BenchmarkCard: React.FC<BenchmarkCardProps> = ({
  sourceConfig,
  targetConfig,
  mappings,
  initialResult = null,
  onBenchmarkComplete
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<Phase10BenchmarkResult | null>(initialResult);
  const [error, setError] = useState<string | null>(null);

  const handleRunBenchmark = async () => {
    if (!sourceConfig || !targetConfig) {
      setError('Cannot execute benchmark: source or target database configuration is missing.');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const res = await window.electronAPI.invoke<Phase10BenchmarkResult>(
        'benchmark:run-comparison',
        {
          sourceConfig,
          targetConfig,
          queryCount: 1000,
          concurrency: 25,
          mappings: mappings || []
        }
      );

      if (res.success && res.data) {
        setResult(res.data);
        onBenchmarkComplete?.(res.data);
      } else {
        setError(res.error || 'Benchmark execution failed.');
      }
    } catch (err) {
      setError((err as Error).message || 'Unexpected error running benchmark.');
    } finally {
      setIsRunning(false);
    }
  };

  // Determine bar widths
  const mongoAvg = result?.mongo.avgLatencyMs || 0;
  const pgAvg = result?.postgres.avgLatencyMs || 0;
  const maxAvg = Math.max(mongoAvg, pgAvg, 0.1);

  const mongoBarWidth = Math.max(12, Math.min(100, Math.round((mongoAvg / maxAvg) * 100)));
  const pgBarWidth = Math.max(12, Math.min(100, Math.round((pgAvg / maxAvg) * 100)));

  return (
    <div className="content-card">
      <div className="card-title-group">
        <div>
          <div className="card-title">
            <span>⚡</span> Real-Time Query Performance Benchmark
          </div>
          <div className="card-desc">
            Measure and verify live query latency across 1,000 parallel lookups between MongoDB and PostgreSQL
          </div>
        </div>

        <div>
          <button
            type="button"
            className="btn-primary-blue"
            onClick={handleRunBenchmark}
            disabled={isRunning || !sourceConfig || !targetConfig}
          >
            {isRunning ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14, border: '2px solid #FFF', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                <span>Benchmarking 1,000 Queries...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>{result ? 'Re-run 1,000 Query Benchmark' : 'Run 1,000 Query Benchmark'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '0.75rem 1rem', borderRadius: 6, fontSize: '0.85rem', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {isRunning && (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', background: '#F8FAFC', borderRadius: 8, border: '1px dashed #CBD5E1' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
            Executing 1,000 Parallel Lookups Across Live Databases
          </div>
          <p style={{ color: '#64748B', fontSize: '0.875rem', maxWidth: 600, margin: '0 auto' }}>
            Testing primary key lookups, category index filtering, and relational joins under concurrent load. Safe non-mutating queries only.
          </p>
        </div>
      )}

      {!isRunning && result && (
        <div className="benchmark-display">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
              Benchmark Results (1,000 parallel lookups)
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
              Completed at {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* MongoDB Bar */}
          <div className="bar-row">
            <div className="bar-label">
              <span>🍃</span> MongoDB (Source)
            </div>
            <div className="bar-track">
              <div className="bar-fill-mongo" style={{ width: `${mongoBarWidth}%` }}>
                {mongoAvg.toFixed(1)} ms avg
              </div>
            </div>
            <div className="bar-stat">
              {mongoAvg.toFixed(1)} ms
            </div>
          </div>

          {/* PostgreSQL Bar */}
          <div className="bar-row">
            <div className="bar-label">
              <span>🐘</span> PostgreSQL (Target)
            </div>
            <div className="bar-track">
              <div className="bar-fill-pg" style={{ width: `${pgBarWidth}%` }}>
                {pgAvg.toFixed(1)} ms avg
              </div>
            </div>
            <div className="bar-stat" style={{ color: '#2563EB' }}>
              {pgAvg.toFixed(1)} ms
              <span className="speedup-pill">⚡ {result.speedupFactor.toFixed(1)}x Faster</span>
            </div>
          </div>

          {/* Query Type Breakdown Table */}
          <table className="cat-table">
            <thead>
              <tr>
                <th>Query Pattern</th>
                <th>MongoDB Latency (avg)</th>
                <th>PostgreSQL Latency (avg)</th>
                <th>Speedup Multiplier</th>
                <th>Queries Tested</th>
              </tr>
            </thead>
            <tbody>
              {result.categories.map((cat, idx) => (
                <tr key={idx}>
                  <td><strong>• {cat.name}</strong></td>
                  <td>{cat.mongoAvgMs.toFixed(1)} ms</td>
                  <td style={{ color: '#2563EB', fontWeight: 600 }}>{cat.postgresAvgMs.toFixed(1)} ms</td>
                  <td>
                    <span className="speedup-pill">⚡ {cat.speedupFactor.toFixed(1)}x faster</span>
                  </td>
                  <td style={{ color: '#64748B' }}>{cat.queriesRun} queries</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Throughput metrics */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', fontSize: '0.825rem', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '0.75rem' }}>
            <div>Throughput: <strong>{result.postgres.throughputQps.toLocaleString()} QPS</strong> (PostgreSQL) vs <strong>{result.mongo.throughputQps.toLocaleString()} QPS</strong> (MongoDB)</div>
            <div>P95 Latency: <strong>{result.postgres.p95LatencyMs.toFixed(1)} ms</strong> (PG) vs <strong>{result.mongo.p95LatencyMs.toFixed(1)} ms</strong> (Mongo)</div>
          </div>
        </div>
      )}

      {!isRunning && !result && (
        <div style={{ padding: '1.25rem', background: '#F8FAFC', borderRadius: 8, textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
          Click <strong>Run 1,000 Query Benchmark</strong> to measure real latency and throughput differences between your source and target databases.
        </div>
      )}
    </div>
  );
};

