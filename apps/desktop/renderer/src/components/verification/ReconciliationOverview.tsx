import React, { useState } from 'react';
import type {
  TableReconciliation,
  AggregateReconciliation,
  OrphanReconciliation,
  ColumnProfileResult
} from '@migrateiq/shared';

export interface ReconciliationOverviewProps {
  tables: TableReconciliation[];
  aggregates: AggregateReconciliation[];
  orphans: OrphanReconciliation[];
  columnStats?: ColumnProfileResult | null;
  onSelectTable?: (tableName: string) => void;
}

export const ReconciliationOverview: React.FC<ReconciliationOverviewProps> = ({
  tables,
  aggregates,
  orphans,
  columnStats,
  onSelectTable
}) => {
  const [filterText, setFilterText] = useState('');
  const [selectedProfileTab, setSelectedProfileTab] = useState<string>(
    tables[0]?.tableName || ''
  );

  const filteredTables = tables.filter((t) =>
    t.tableName.toLowerCase().includes(filterText.toLowerCase())
  );

  const allVolumetricMatched = tables.length > 0 && tables.every((t) => t.isMatch);
  const allFinancialsMatched = aggregates.length === 0 || aggregates.every((a) => a.isPrecisionGuaranteed);
  const allOrphansClean = orphans.length === 0 || orphans.every((o) => o.isClean && o.sortOrderSequenceValid);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── 1. Volumetric Parity Audit Table ── */}
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h3 className="v-card-title">
              <span>📊 Volumetric Row Count Parity</span>
              {allVolumetricMatched ? (
                <span className="v-badge-success">✓ 100% Match Across All Tables</span>
              ) : (
                <span className="v-badge-danger">⚠ Row Count Drift Detected</span>
              )}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Verifies 1:1 row counts between source MongoDB collections and target PostgreSQL relational tables ($\Delta = 0$).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Filter tables…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                width: '180px',
              }}
            />
          </div>
        </div>

        <div className="v-table-wrap">
          <table className="v-table">
            <thead>
              <tr>
                <th>Target Table</th>
                <th>Type</th>
                <th>Source (Mongo)</th>
                <th>Target (Postgres)</th>
                <th>Delta (Δ)</th>
                <th>Parity Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#64748B', padding: '1.5rem' }}>
                    No tables matching &quot;{filterText}&quot;
                  </td>
                </tr>
              ) : (
                filteredTables.map((tbl) => (
                  <tr key={tbl.tableName}>
                    <td>
                      <strong style={{ color: '#0F172A' }}>{tbl.tableName}</strong>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.6875rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        backgroundColor: tbl.sourceType === 'child_table' ? '#F3E8FF' : '#F1F5F9',
                        color: tbl.sourceType === 'child_table' ? '#7E22CE' : '#475569',
                      }}>
                        {tbl.sourceType === 'child_table' ? 'Child Array' : 'Primary'}
                      </span>
                    </td>
                    <td>{tbl.sourceCount.toLocaleString()}</td>
                    <td>{tbl.targetCount.toLocaleString()}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: tbl.delta === 0 ? '#15803D' : '#DC2626',
                      }}>
                        {tbl.delta === 0 ? '0' : `+${tbl.delta}`}
                      </span>
                    </td>
                    <td>
                      {tbl.isMatch ? (
                        <span className="v-badge-success">✓ 100% Match</span>
                      ) : (
                        <span className="v-badge-danger">⚠ Drift ({tbl.delta})</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => onSelectTable && onSelectTable(tbl.tableName)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          padding: '0.2rem 0.5rem',
                        }}
                      >
                        Inspect 1:1 →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Financial & Numeric Aggregations (Stripe Pattern) ── */}
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h3 className="v-card-title">
              <span>💰 Financial & Numeric Sum Proofs (Stripe Pattern)</span>
              {allFinancialsMatched ? (
                <span className="v-badge-success">✓ 0.0000% Drift Proof</span>
              ) : (
                <span className="v-badge-warning">⚠ Financial Precision Drift</span>
              )}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Guarantees IEEE-754 double precision vs PostgreSQL NUMERIC conversions preserve every cent down to 4 decimal places ($\epsilon &lt; 10^{'{ -4 }'} \%$).
            </p>
          </div>
        </div>

        {aggregates.length === 0 ? (
          <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '8px', color: '#64748B', fontSize: '0.875rem' }}>
            ℹ️ No financial currency or numerical summation columns configured in schema mapping.
          </div>
        ) : (
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Numeric Column</th>
                  <th>Metric</th>
                  <th>MongoDB Total</th>
                  <th>PostgreSQL Total</th>
                  <th>Mathematical Drift</th>
                  <th>Precision Proof</th>
                </tr>
              </thead>
              <tbody>
                {aggregates.map((agg, idx) => (
                  <tr key={`${agg.tableName}-${agg.columnName}-${idx}`}>
                    <td><strong>{agg.tableName}</strong></td>
                    <td><code style={{ background: '#F1F5F9', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>{agg.columnName}</code></td>
                    <td><span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#2563EB' }}>{agg.metric}</span></td>
                    <td>{agg.sourceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td>{agg.targetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: agg.isPrecisionGuaranteed ? '#15803D' : '#DC2626'
                      }}>
                        {agg.driftPercentage.toFixed(4)}%
                      </span>
                    </td>
                    <td>
                      {agg.isPrecisionGuaranteed ? (
                        <span className="v-badge-success">✓ Zero-Drift Certified</span>
                      ) : (
                        <span className="v-badge-warning">⚠ Precision Warning</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. Referential Integrity & Sequence Scanner (Shopify & Chu et al.) ── */}
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h3 className="v-card-title">
              <span>🔗 Referential Integrity & Sequence Scanner (Shopify Pattern)</span>
              {allOrphansClean ? (
                <span className="v-badge-success">✓ 0 Orphaned Records</span>
              ) : (
                <span className="v-badge-danger">⚠ Orphaned Records Detected</span>
              )}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Audits all decomposed child tables via SQL <code style={{ background: '#F1F5F9', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>LEFT JOIN</code> queries for missing parent foreign keys and checks gapless sequence indexing (<code style={{ background: '#F1F5F9', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>sort_order = 0..N-1</code>).
            </p>
          </div>
        </div>

        {orphans.length === 0 ? (
          <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '8px', color: '#64748B', fontSize: '0.875rem' }}>
            ℹ️ No child tables or foreign-key relationships in current schema mapping.
          </div>
        ) : (
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th>Child Table</th>
                  <th>Parent Table</th>
                  <th>Foreign Key</th>
                  <th>Orphaned Rows</th>
                  <th>Array Sequence Integrity</th>
                  <th>Constraint Health</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((orph, i) => (
                  <tr key={`${orph.childTable}-${orph.parentTable}-${i}`}>
                    <td><strong>{orph.childTable}</strong></td>
                    <td>{orph.parentTable}</td>
                    <td><code>{orph.foreignKeyColumn}</code></td>
                    <td>
                      <span style={{ fontWeight: 700, color: orph.orphanCount === 0 ? '#15803D' : '#DC2626' }}>
                        {orph.orphanCount}
                      </span>
                    </td>
                    <td>
                      {orph.sortOrderSequenceValid ? (
                        <span style={{ color: '#15803D', fontWeight: 600 }}>✓ Gapless [0..N-1] Preserved</span>
                      ) : (
                        <span style={{ color: '#DC2626', fontWeight: 600 }}>⚠ Gaps or Inversions Detected</span>
                      )}
                    </td>
                    <td>
                      {orph.isClean && orph.sortOrderSequenceValid ? (
                        <span className="v-badge-success">✓ Passed</span>
                      ) : (
                        <span className="v-badge-danger">⚠ Action Needed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 4. Column-Level Statistical Profiler (Monte Carlo Pattern) ── */}
      {columnStats && columnStats.columns.length > 0 && (
        <div className="v-card">
          <div className="v-card-header">
            <div>
              <h3 className="v-card-title">
                <span>📈 Column-Level Statistical Profiler (Monte Carlo Standard)</span>
                {!columnStats.silentNullDetected ? (
                  <span className="v-badge-success">✓ Zero Silent Nulls</span>
                ) : (
                  <span className="v-badge-danger">⚠ Silent Nullification Bug Detected!</span>
                )}
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
                Verifies per-column null percentages and distinct value cardinality across both engines to prevent mapping omissions.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 600 }}>Table:</span>
              <select
                value={selectedProfileTab}
                onChange={(e) => setSelectedProfileTab(e.target.value)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                }}
              >
                {tables.map((t) => (
                  <option key={t.tableName} value={t.tableName}>
                    {t.tableName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th>Column Name</th>
                  <th>SQL Type</th>
                  <th>Mongo Null %</th>
                  <th>Postgres Null %</th>
                  <th>Null Delta</th>
                  <th>Unique Values (Mongo ⟷ PG)</th>
                  <th>Profile Status</th>
                </tr>
              </thead>
              <tbody>
                {columnStats.columns.map((col) => (
                  <tr key={col.columnName}>
                    <td><code>{col.columnName}</code></td>
                    <td><span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0284C7' }}>{col.sqlType}</span></td>
                    <td>{col.sourceNullPct.toFixed(1)}%</td>
                    <td>{col.targetNullPct.toFixed(1)}%</td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        color: col.nullPctDelta < 2 ? '#15803D' : '#D97706',
                      }}>
                        ±{col.nullPctDelta.toFixed(1)}%
                      </span>
                    </td>
                    <td>{col.sourceDistinctCount.toLocaleString()} ⟷ {col.targetDistinctCount.toLocaleString()}</td>
                    <td>
                      {col.isProfileValid ? (
                        <span className="v-badge-success">✓ Healthy</span>
                      ) : (
                        <span className="v-badge-danger">⚠ Null Anomaly</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
