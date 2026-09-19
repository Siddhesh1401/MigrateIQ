import React from 'react';
import type { DryRunResult } from '@migrateiq/shared';

export interface BlueprintSummaryCardProps {
  result: DryRunResult;
  onViewAffectedRows: (tableName?: string) => void;
}

export const BlueprintSummaryCard: React.FC<BlueprintSummaryCardProps> = ({
  result,
  onViewAffectedRows,
}) => {
  // Aggregate skipped rows by table for high-level blueprint summary
  const skippedByTable: Record<string, { count: number; reason: string }> = {};
  result.allSkippedRows.forEach((row) => {
    const tbl = row.targetTable || row.collection || 'unknown';
    if (!skippedByTable[tbl]) {
      skippedByTable[tbl] = { count: 0, reason: row.reason };
    }
    skippedByTable[tbl].count++;
  });

  return (
    <div className="dry-run-blueprint-summary-card">
      <div className="blueprint-summary-header">
        <h4 className="blueprint-summary-title">
          DRY RUN COMPLETE — Nothing was changed in your database
        </h4>
        <span className="blueprint-summary-status-pill">
          {result.overallStatus === 'passed' ? '100% Passed' : 'Validation Anomalies Detected'}
        </span>
      </div>

      <div className="blueprint-summary-body">
        {/* 1. Would create table lines */}
        <div className="blueprint-summary-group">
          {result.tables.map((tbl) => (
            <div key={`schema_${tbl.targetTableName}`} className="blueprint-summary-line success">
              <span className="blueprint-check-icon">✅</span>
              <span className="blueprint-line-text">
                Would create table: <strong>{tbl.targetTableName}</strong> ({tbl.columnsCount} columns)
              </span>
            </div>
          ))}
        </div>

        {/* 2. Would migrate row lines */}
        <div className="blueprint-summary-group">
          {result.tables.map((tbl) => (
            <div key={`migrate_${tbl.targetTableName}`} className="blueprint-summary-line success">
              <span className="blueprint-check-icon">✅</span>
              <span className="blueprint-line-text">
                Would migrate: <strong>{tbl.projectedMigrateCount.toLocaleString()}</strong> rows →{' '}
                <strong>{tbl.targetTableName}</strong>
              </span>
            </div>
          ))}
        </div>

        {/* 3. Skipped rows lines */}
        {Object.keys(skippedByTable).length > 0 ? (
          <div className="blueprint-summary-group warnings">
            {Object.entries(skippedByTable).map(([tblName, { count, reason }]) => (
              <div key={`skip_${tblName}`} className="blueprint-summary-line warning">
                <span className="blueprint-warn-icon">⚠️</span>
                <div className="blueprint-skip-content">
                  <span className="blueprint-line-text">
                    <strong>{count}</strong> rows in "<strong>{tblName}</strong>" would be skipped —{' '}
                    {reason.length > 80 ? `${reason.substring(0, 80)}...` : reason}
                  </span>
                  <button
                    type="button"
                    className="blueprint-view-affected-btn"
                    onClick={() => onViewAffectedRows(tblName)}
                  >
                    [View affected rows]
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="blueprint-summary-group clean">
            <div className="blueprint-summary-line success">
              <span className="blueprint-check-icon">✅</span>
              <span className="blueprint-line-text">
                <strong>0</strong> rows would be skipped — all records conform to schema constraints.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
