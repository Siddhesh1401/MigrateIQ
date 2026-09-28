import React, { useState } from 'react';
import type {
  BenchmarkResult,
  SandboxQueryRequest,
  SandboxQueryResult,
} from '@migrateiq/shared';

export interface BenchmarkSandboxProps {
  tables: string[];
  benchmarkResult: BenchmarkResult | null;
  isBenchmarking: boolean;
  onRunBenchmark: () => void;
  onExecuteSandbox: (req: SandboxQueryRequest) => Promise<SandboxQueryResult>;
}

export const BenchmarkSandbox: React.FC<BenchmarkSandboxProps> = ({
  tables,
  benchmarkResult,
  isBenchmarking,
  onRunBenchmark,
  onExecuteSandbox,
}) => {
  const [selectedTable, setSelectedTable] = useState(tables[0] || 'orders');
  const [mqlQuery, setMqlQuery] = useState('{"status": "completed"}');
  const [sqlQuery, setSqlQuery] = useState(`SELECT * FROM ${tables[0] || 'orders'} WHERE status = 'completed' LIMIT 5;`);
  const [isExecutingSandbox, setIsExecutingSandbox] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxQueryResult | null>(null);

  const handleTableChange = (tbl: string) => {
    setSelectedTable(tbl);
    setSqlQuery(`SELECT * FROM ${tbl} LIMIT 5;`);
    setMqlQuery('{}');
  };

  const handleExecuteSandbox = async () => {
    setIsExecutingSandbox(true);
    try {
      const res = await onExecuteSandbox({
        tableName: selectedTable,
        mongoMql: mqlQuery,
        postgresSql: sqlQuery,
        limit: 5,
      });
      setSandboxResult(res);
    } catch {
      // Handled
    } finally {
      setIsExecutingSandbox(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── 1. Dual-Database Query Performance Benchmark ── */}
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h3 className="v-card-title">
              <span>⚡ Dual-Engine Real-Time Query Benchmark</span>
              {benchmarkResult && (
                <span className="v-badge-success">
                  🚀 PostgreSQL is {benchmarkResult.speedupFactor}x Faster
                </span>
              )}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Executes 100 concurrent test queries across live MongoDB (port 27017) and PostgreSQL (port 5432) to verify target read latency.
            </p>
          </div>

          <button
            type="button"
            className="btn-verify-primary"
            onClick={onRunBenchmark}
            disabled={isBenchmarking}
          >
            {isBenchmarking ? '⏳ Running 100 Queries…' : '▶ Run 100 Query Benchmark'}
          </button>
        </div>

        {benchmarkResult && (
          <>
            <div className="speedup-callout">
              <div>
                <span className="speedup-text">
                  🚀 PostgreSQL Delivered {benchmarkResult.speedupFactor}x Faster Lookups
                </span>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#1E40AF' }}>
                  Measured P50 latency dropped from {benchmarkResult.mongo.p50LatencyMs}ms (Mongo) down to {benchmarkResult.postgres.p50LatencyMs}ms (PostgreSQL).
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E3A8A' }}>
                  {benchmarkResult.postgres.throughputQps.toLocaleString()} QPS
                </span>
                <p style={{ margin: 0, fontSize: '0.6875rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
                  Target Postgres Throughput
                </p>
              </div>
            </div>

            <div className="benchmark-cards-grid">
              {/* Mongo metrics */}
              <div className="engine-benchmark-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.9375rem', color: '#0F172A' }}>🍃 MongoDB (Source Engine)</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>100 Queries</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>P50 Median Latency:</span>
                    <strong>{benchmarkResult.mongo.p50LatencyMs} ms</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>P95 Latency:</span>
                    <strong>{benchmarkResult.mongo.p95LatencyMs} ms</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>P99 Latency:</span>
                    <strong>{benchmarkResult.mongo.p99LatencyMs} ms</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Average Latency:</span>
                    <strong>{benchmarkResult.mongo.avgLatencyMs} ms</strong>
                  </div>
                </div>
              </div>

              {/* PostgreSQL metrics */}
              <div className="engine-benchmark-card" style={{ borderColor: '#BFDBFE', background: '#F0F9FF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.9375rem', color: '#1E40AF' }}>🐘 PostgreSQL (Target Engine)</strong>
                  <span className="v-badge-success" style={{ fontSize: '0.6875rem' }}>⚡ Optimized B-Tree</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>P50 Median Latency:</span>
                    <strong style={{ color: '#16A34A' }}>{benchmarkResult.postgres.p50LatencyMs} ms</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>P95 Latency:</span>
                    <strong style={{ color: '#16A34A' }}>{benchmarkResult.postgres.p95LatencyMs} ms</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>P99 Latency:</span>
                    <strong style={{ color: '#16A34A' }}>{benchmarkResult.postgres.p99LatencyMs} ms</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Average Latency:</span>
                    <strong style={{ color: '#16A34A' }}>{benchmarkResult.postgres.avgLatencyMs} ms</strong>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 2. Interactive Dual-Query Sandbox ── */}
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h3 className="v-card-title">
              <span>🧪 Interactive Dual-Query Sandbox (Developer Console)</span>
              {sandboxResult && (
                <span className={sandboxResult.isResultIdentical ? 'v-badge-success' : 'v-badge-warning'}>
                  {sandboxResult.isResultIdentical ? '✓ Row Counts & Semantics Match' : '⚠ Result Divergence'}
                </span>
              )}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Test your backend application queries before cutover. Run MongoDB MQL on the left and PostgreSQL SQL on the right to compare live outputs.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <select
              value={selectedTable}
              onChange={(e) => handleTableChange(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8125rem',
                fontWeight: 600,
                backgroundColor: '#FFFFFF',
              }}
            >
              {tables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <button
              type="button"
              className="btn-verify-primary"
              onClick={handleExecuteSandbox}
              disabled={isExecutingSandbox}
              style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem' }}
            >
              {isExecutingSandbox ? '⏳ Running…' : '⚡ Execute Both'}
            </button>
          </div>
        </div>

        <div className="sandbox-split-view">
          {/* Left: Mongo MQL query */}
          <div className="sandbox-editor-box">
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              🍃 MongoDB Filter (.find(filter)):
            </label>
            <textarea
              className="sandbox-textarea"
              value={mqlQuery}
              onChange={(e) => setMqlQuery(e.target.value)}
              placeholder='e.g. {"status": "completed"}'
            />
          </div>

          {/* Right: Postgres SQL query */}
          <div className="sandbox-editor-box">
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              🐘 PostgreSQL Query (SELECT ...):
            </label>
            <textarea
              className="sandbox-textarea"
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="e.g. SELECT * FROM orders WHERE status = 'completed' LIMIT 5;"
            />
          </div>
        </div>

        {/* Live Sandbox Execution Output */}
        {sandboxResult && (
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <div>
                <strong>MongoDB: </strong>
                <span>{sandboxResult.mongoCount} matches in {sandboxResult.mongoLatencyMs}ms</span>
              </div>
              <div>
                <strong>PostgreSQL: </strong>
                <span>{sandboxResult.postgresCount} matches in {sandboxResult.postgresLatencyMs}ms</span>
              </div>
              <div>
                <span className={sandboxResult.isResultIdentical ? 'v-badge-success' : 'v-badge-warning'}>
                  {sandboxResult.isResultIdentical ? '✓ Parity Verified' : '⚠ Count Diverged'}
                </span>
              </div>
            </div>

            <div className="diff-split-view">
              <div style={{ background: '#FFFFFF', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '0.75rem', maxHeight: '180px', overflow: 'auto' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#64748B' }}>MongoDB Sample Output:</strong>
                <pre style={{ margin: 0 }}>{JSON.stringify(sandboxResult.mongoSample, null, 2)}</pre>
              </div>

              <div style={{ background: '#FFFFFF', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '0.75rem', maxHeight: '180px', overflow: 'auto' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#64748B' }}>PostgreSQL Sample Output:</strong>
                <pre style={{ margin: 0 }}>{JSON.stringify(sandboxResult.postgresSample, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
