import React from 'react';
import type { DryRunResult, CollectionMapping } from '@migrateiq/shared';

export interface SkippedRowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentResult: DryRunResult;
  schemaMapping?: CollectionMapping[] | null;
  modalTableFilter: string;
  setModalTableFilter: (tbl: string) => void;
  modalSearch: string;
  setModalSearch: (search: string) => void;
  quarantinePolicyAcknowledged: boolean;
  onOpenRemediationStudio: (tab: 'smart' | 'manual') => void;
  onApplyQuickFix: (tbl: string, fld: string) => void;
  onAcknowledgeQuarantine: () => void;
}

export const SkippedRowsModal: React.FC<SkippedRowsModalProps> = ({
  isOpen,
  onClose,
  currentResult,
  schemaMapping = [],
  modalTableFilter,
  setModalTableFilter,
  modalSearch,
  setModalSearch,
  quarantinePolicyAcknowledged,
  onOpenRemediationStudio,
  onApplyQuickFix,
  onAcknowledgeQuarantine,
}) => {
  if (!isOpen) return null;

  const safeMappings = schemaMapping || [];

  const filteredSkippedRows = currentResult.allSkippedRows.filter((row) => {
    const matchesTable =
      modalTableFilter === 'all' ||
      row.targetTable === modalTableFilter ||
      row.collection === modalTableFilter;
    const matchesSearch =
      !modalSearch ||
      row.documentId.toLowerCase().includes(modalSearch.toLowerCase()) ||
      row.reason.toLowerCase().includes(modalSearch.toLowerCase()) ||
      (row.field && row.field.toLowerCase().includes(modalSearch.toLowerCase()));
    return matchesTable && matchesSearch;
  });

  return (
    <div className="dry-run-modal-backdrop" onClick={onClose}>
      <div className="dry-run-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dry-run-modal-header">
          <h3>Affected / Skipped Rows Analysis</h3>
          <button className="dry-run-modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dry-run-modal-body">
          {/* In-Modal Resolution Strategy Callout */}
          {currentResult.totalSampleFailed > 0 && (
            <div className="dry-run-resolution-card" style={{ padding: '1rem', background: '#F8FAFC' }}>
              <div className="dry-run-resolution-header">
                <div className="dry-run-resolution-header-left">
                  <span className="dry-run-resolution-icon" style={{ fontSize: '1.25rem' }}>
                    💡
                  </span>
                  <div>
                    <h4 style={{ fontSize: '0.9375rem' }}>Resolution Strategies for Skipped Records</h4>
                    <p style={{ fontSize: '0.78125rem' }}>
                      Choose Option A (Recommended fallback), Option B (relax schema), or Option C (route to DLQ):
                    </p>
                  </div>
                </div>
              </div>
              <div className="dry-run-strategies-grid modal-grid" style={{ gap: '0.75rem' }}>
                {/* In-modal Option A */}
                <div className="dry-run-strategy-box recommended" style={{ padding: '0.875rem' }}>
                  <div className="dry-run-strategy-tag recommended">🌟 Option A • Recommended</div>
                  <h5 style={{ fontSize: '0.875rem' }}>⚡ Configure & Apply Fix</h5>
                  <p style={{ fontSize: '0.75rem' }}>
                    Open Studio to inspect AI Before/After or set precision defaults for 100% data pass without crashes.
                  </p>
                  <button
                    className="dry-run-strategy-btn recommended"
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={() => onOpenRemediationStudio('smart')}
                  >
                    🔧 Configure & Apply Fix →
                  </button>
                </div>

                {/* In-modal Option B */}
                <div className="dry-run-strategy-box caution" style={{ padding: '0.875rem' }}>
                  <div className="dry-run-strategy-tag caution">⚠️ Option B • Caution</div>
                  <h5 style={{ fontSize: '0.875rem' }}>🔓 Relax to NULLABLE</h5>
                  <p style={{ fontSize: '0.75rem' }}>
                    Makes column nullable. Warning: downstream app code may crash with NullPointerExceptions.
                  </p>
                  <button
                    className="dry-run-strategy-btn caution"
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={() => {
                      const firstRow = currentResult.allSkippedRows[0];
                      const targetTbl =
                        firstRow?.targetTable ||
                        currentResult.tables.find((t) => t.sampleFailed > 0)?.targetTableName ||
                        currentResult.tables[0]?.targetTableName ||
                        '';
                      const matchingCol = safeMappings.find(
                        (m) =>
                          m.targetTableName.toLowerCase() === targetTbl.toLowerCase() ||
                          m.collectionName.toLowerCase() === targetTbl.toLowerCase()
                      );
                      const targetFld =
                        firstRow?.field ||
                        matchingCol?.fields.find(
                          (f) => !f.isNullable && f.targetColumn !== 'id' && f.targetColumn !== '_id'
                        )?.targetColumn ||
                        '';
                      onApplyQuickFix(targetTbl, targetFld);
                    }}
                  >
                    ⚠️ Set Nullable
                  </button>
                </div>

                {/* In-modal Option C */}
                <div className="dry-run-strategy-box warning" style={{ padding: '0.875rem' }}>
                  <div className="dry-run-strategy-tag warning">⚠️ Option C • DLQ</div>
                  <h5 style={{ fontSize: '0.875rem' }}>🛡️ Route to DLQ</h5>
                  <p style={{ fontSize: '0.75rem' }}>
                    Retains NOT NULL and quarantines records to DLQ. Warning: row-count mismatch in ETL reconciliation.
                  </p>
                  <button
                    className="dry-run-strategy-btn warning"
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={onAcknowledgeQuarantine}
                  >
                    {quarantinePolicyAcknowledged ? '🛡️ Quarantined ✓' : '🛡️ Quarantine (DLQ)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="dry-run-modal-filter-bar">
            <select
              value={modalTableFilter}
              onChange={(e) => setModalTableFilter(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8125rem',
              }}
            >
              <option value="all">All Tables ({currentResult.allSkippedRows.length})</option>
              {currentResult.tables
                .filter((t) => t.skippedRows.length > 0)
                .map((t) => (
                  <option key={t.targetTableName} value={t.targetTableName}>
                    {t.targetTableName} ({t.skippedRows.length})
                  </option>
                ))}
            </select>

            <input
              type="text"
              className="dry-run-modal-search-input"
              placeholder="Search by Document ID or error reason..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
            />
          </div>

          {filteredSkippedRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
              No skipped rows matching your criteria.
            </div>
          ) : (
            filteredSkippedRows.map((row) => (
              <div key={row.documentId} className="dry-run-skipped-item-card">
                <div className="dry-run-skipped-item-top">
                  <span className="dry-run-skipped-id">Doc ID: {row.documentId}</span>
                  <span className="dry-run-pill child">{row.targetTable}</span>
                </div>
                <div className="dry-run-skipped-reason">
                  ⚠️ <strong>Failure Reason:</strong> {row.reason}
                </div>
                {row.rawSampleSnippet && (
                  <div className="dry-run-skipped-snippet">{row.rawSampleSnippet}</div>
                )}
                {(() => {
                  const matchingCol = safeMappings.find(
                    (m) =>
                      m.targetTableName.toLowerCase() === row.targetTable.toLowerCase() ||
                      m.collectionName.toLowerCase() === row.targetTable.toLowerCase()
                  );
                  const fieldMeta = matchingCol?.fields.find(
                    (f) =>
                      (row.field && (f.targetColumn === row.field || f.sourceField === row.field)) ||
                      (!f.isNullable && f.targetColumn !== 'id' && f.targetColumn !== '_id')
                  );
                  if (!fieldMeta) return null;
                  return (
                    <div
                      style={{
                        margin: '0.4rem 0',
                        padding: '0.35rem 0.6rem',
                        background: '#F8FAFC',
                        borderRadius: '4px',
                        border: '1px solid #E2E8F0',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: '#334155',
                      }}
                    >
                      <span style={{ color: '#64748B', userSelect: 'none' }}>Target Column DDL: </span>
                      <strong>{fieldMeta.targetColumn}</strong> {fieldMeta.targetType.toUpperCase()}
                      {fieldMeta.defaultValue ? ` DEFAULT ${fieldMeta.defaultValue}` : ''}
                      {fieldMeta.isNullable ? '' : ' NOT NULL'}
                    </div>
                  );
                })()}
                <div className="dry-run-row-action-bar">
                  {(row.reason.toLowerCase().includes('not null') ||
                    row.reason.toLowerCase().includes('constraint') ||
                    Boolean(row.field)) && (
                    <>
                      <button
                        className="dry-run-row-default-btn"
                        onClick={() => onOpenRemediationStudio('smart')}
                        title="Open Remediation Studio to inspect Before & After and apply defaults"
                      >
                        🔧 Configure Fix in Studio
                      </button>
                      <button
                        className="dry-run-row-fix-btn"
                        onClick={() => {
                          const matchingCol = safeMappings.find(
                            (m) =>
                              m.targetTableName.toLowerCase() === row.targetTable.toLowerCase() ||
                              m.collectionName.toLowerCase() === row.targetTable.toLowerCase()
                          );
                          const targetFld =
                            row.field ||
                            matchingCol?.fields.find(
                              (f) => !f.isNullable && f.targetColumn !== 'id' && f.targetColumn !== '_id'
                            )?.targetColumn ||
                            '';
                          onApplyQuickFix(row.targetTable, targetFld);
                        }}
                        title="Make column nullable in PostgreSQL (Caution: App crash risk)"
                      >
                        ⚠️ Make Nullable
                      </button>
                    </>
                  )}
                  <button
                    className={`dry-run-row-quarantine-btn ${
                      quarantinePolicyAcknowledged ? 'active' : ''
                    }`}
                    onClick={onAcknowledgeQuarantine}
                  >
                    {quarantinePolicyAcknowledged ? '🛡️ Quarantined to DLQ ✓' : '🛡️ Route to DLQ (Audit Log)'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="dry-run-modal-footer">
          <button className="dry-run-btn-back" onClick={onClose}>
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
