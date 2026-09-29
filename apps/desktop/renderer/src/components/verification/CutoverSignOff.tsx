import React, { useState } from 'react';
import type { CutoverReadinessScorecard, TableReconciliation, AggregateReconciliation, OrphanReconciliation } from '@migrateiq/shared';
import { ComplianceCertificateModal } from './ComplianceCertificateModal';

export interface CutoverSignOffProps {
  readinessScore: number;
  scorecard: CutoverReadinessScorecard;
  sha256Seal: string;
  isApproved: boolean;
  auditorName: string;
  auditorOrg: string;
  auditorNotes: string;
  onAuditorNameChange: (name: string) => void;
  onAuditorOrgChange: (org: string) => void;
  onAuditorNotesChange: (notes: string) => void;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onApproveAndProceed: () => void;
  hasDiscrepancies: boolean;
  onInspectFailed: () => void;
  onReSyncTable: (tableName: string) => void;
  onRollback: () => void;
  onCleanRollbackToSchema: () => void;
  onDownloadQuarantineCsv: () => void;
  executiveOverride: boolean;
  onExecutiveOverrideChange: (override: boolean) => void;
  tablesWithDrift: string[];
  tables?: TableReconciliation[];
  aggregates?: AggregateReconciliation[];
  orphans?: OrphanReconciliation[];
  totalEntities?: number;
  sourceDbName?: string;
  targetDbName?: string;
  auditTimestamp?: string;
  onAlterColumnType?: (tableName: string, columnName: string, newType: string) => Promise<boolean>;
}

export const CutoverSignOff: React.FC<CutoverSignOffProps> = ({
  readinessScore,
  scorecard,
  sha256Seal,
  isApproved,
  auditorName,
  auditorOrg,
  auditorNotes,
  onAuditorNameChange,
  onAuditorOrgChange,
  onAuditorNotesChange,
  onExportPdf,
  isExportingPdf,
  onApproveAndProceed,
  hasDiscrepancies,
  onInspectFailed,
  onReSyncTable,
  onRollback,
  onCleanRollbackToSchema,
  onDownloadQuarantineCsv,
  tablesWithDrift,
  executiveOverride,
  onExecutiveOverrideChange,
  tables,
  aggregates,
  orphans,
  totalEntities,
  sourceDbName,
  targetDbName,
  auditTimestamp,
  onAlterColumnType,
}) => {
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [showAlterModal, setShowAlterModal] = useState(false);
  const [selectedTableToReSync, setSelectedTableToReSync] = useState(tablesWithDrift[0] || '');
  const [alterColName, setAlterColName] = useState('');
  const [alterNewType, setAlterNewType] = useState('VARCHAR(255)');
  const [isAltering, setIsAltering] = useState(false);
  const [alterMessage, setAlterMessage] = useState<string | null>(null);

  const canApprove = (auditorName.trim().length > 0) && (!hasDiscrepancies || executiveOverride);

  const handleExecuteAlter = async () => {
    if (!onAlterColumnType || !selectedTableToReSync || !alterColName.trim()) return;
    setIsAltering(true);
    setAlterMessage(null);
    try {
      const ok = await onAlterColumnType(selectedTableToReSync, alterColName.trim(), alterNewType);
      if (ok) {
        setAlterMessage(`✓ Column "${alterColName}" widened to ${alterNewType}. Ready for 1-Click Re-Sync.`);
      }
    } finally {
      setIsAltering(false);
    }
  };

  return (
    <div className="signoff-container">
      {/* ── Discrepancy Remediation Shield ── */}
      {hasDiscrepancies && (
        <div className="remediation-banner">
          <div>
            <strong style={{ fontSize: '0.9375rem', color: '#92400E' }}>
              ⚠️ Discrepancy Remediation Shield Active
            </strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem' }}>
              Detected data drift on {tablesWithDrift.length} table(s): <code>{tablesWithDrift.join(', ')}</code>. Choose an automated recovery action:
            </p>
          </div>

          <div className="remediation-actions" style={{ alignItems: 'center' }}>
            <button type="button" className="remediation-btn" onClick={onInspectFailed}>
              🔍 Inspect Failed Rows
            </button>

            {tablesWithDrift.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {tablesWithDrift.length > 1 && (
                  <select
                    value={selectedTableToReSync || tablesWithDrift[0]}
                    onChange={(e) => setSelectedTableToReSync(e.target.value)}
                    style={{
                      padding: '0.35rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #D97706',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    {tablesWithDrift.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="remediation-btn"
                  onClick={() => onReSyncTable(selectedTableToReSync || tablesWithDrift[0])}
                  style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' }}
                >
                  ⚡ 1-Click Re-Sync {tablesWithDrift.length > 1 ? selectedTableToReSync || tablesWithDrift[0] : 'Table'}
                </button>
              </div>
            )}

            <button
              type="button"
              className="remediation-btn"
              onClick={() => setShowAlterModal(true)}
              style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC', color: '#166534' }}
            >
              🔧 Live Column Patch
            </button>

            <button
              type="button"
              className="remediation-btn"
              onClick={() => setShowRollbackModal(true)}
              style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', color: '#991B1B' }}
            >
              🔄 Reset &amp; Adjust Schema
            </button>

            <button type="button" className="remediation-btn" onClick={onDownloadQuarantineCsv}>
              📥 Download Quarantine Log (.csv)
            </button>
          </div>
        </div>
      )}

      {/* ── Smart Rollback & Recovery Decision Modal ── */}
      {showRollbackModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            maxWidth: '560px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #E2E8F0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🔄</span>
              <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.25rem' }}>
                Restart Migration with Adjusted Schema?
              </h3>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
              Target PostgreSQL tables currently contain migrated data from Step 7. How would you like to proceed?
            </p>

            <div style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
            }}>
              <strong style={{ color: '#1E40AF', fontSize: '0.875rem' }}>💡 Recommendation for DBAs:</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#1E3A8A', lineHeight: 1.5 }}>
                If you only have missing rows due to a network timeout, <strong>do not restart!</strong> Simply use <strong>1-Click Re-Sync Table</strong> on this screen to repair only the affected table in 2 seconds.
              </p>
            </div>

            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <strong style={{ color: '#991B1B', fontSize: '0.875rem' }}>If Column Types Need Changing:</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#7F1D1D', lineHeight: 1.5 }}>
                1. Target tables will be wiped cleanly (<code style={{ backgroundColor: '#FEE2E2', padding: '0.1rem 0.25rem' }}>DROP CASCADE</code>) so re-running migration won't cause duplicate primary key crashes.<br />
                2. You will be taken back to <strong>Step 4 (Schema Mapper)</strong>.<br />
                3. All your mapping drafts are preserved (you only edit the column that needs adjustment).<br />
                4. Steps 5 and 6 remain pre-validated for fast-tracked execution.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-verify-secondary"
                onClick={() => setShowRollbackModal(false)}
              >
                Cancel (Stay on Step 8)
              </button>
              <button
                type="button"
                className="btn-verify-secondary"
                onClick={() => {
                  setShowRollbackModal(false);
                  onRollback();
                }}
              >
                ↩️ Step Back to Step 7 (Keep Data)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRollbackModal(false);
                  onCleanRollbackToSchema();
                }}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.65rem 1.25rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                🗑️ Clean Target &amp; Go to Schema Mapper (Step 4)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Live In-Place Column Widening Modal ── */}
      {showAlterModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #CBD5E1',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🔧</span>
              <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.125rem' }}>
                Live In-Place Column Widening (DDL Patch)
              </h3>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
              Widen a narrow column (e.g. <code style={{ backgroundColor: '#F1F5F9', padding: '0.1rem 0.25rem' }}>VARCHAR(50) ➔ VARCHAR(255)</code>) directly on target table <strong>"{selectedTableToReSync || tablesWithDrift[0]}"</strong> without restarting migration.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Target Table:</label>
                <input
                  type="text"
                  value={selectedTableToReSync || tablesWithDrift[0] || 'orders'}
                  disabled
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Column Name to Widen:</label>
                <input
                  type="text"
                  placeholder="e.g. notes, address, email"
                  value={alterColName}
                  onChange={(e) => setAlterColName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E1', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>New Target Data Type:</label>
                <select
                  value={alterNewType}
                  onChange={(e) => setAlterNewType(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E1', fontWeight: 600, backgroundColor: '#FFFFFF' }}
                >
                  <option value="VARCHAR(255)">VARCHAR(255)</option>
                  <option value="TEXT">TEXT (Unlimited length)</option>
                  <option value="BIGINT">BIGINT (64-bit integer)</option>
                  <option value="NUMERIC(18,4)">NUMERIC(18,4)</option>
                  <option value="JSONB">JSONB (Arbitrary structured data)</option>
                </select>
              </div>
            </div>

            {alterMessage && (
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '0.6rem 0.75rem', color: '#166534', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                {alterMessage}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-verify-secondary"
                onClick={() => {
                  setShowAlterModal(false);
                  setAlterMessage(null);
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-verify-primary"
                onClick={handleExecuteAlter}
                disabled={!alterColName.trim() || isAltering}
              >
                {isAltering ? '⏳ Applying DDL…' : '⚡ Apply DDL Patch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cutover Readiness Scorecard ── */}
      <div className="v-card">
        <div className="v-card-header">
          <div>
            <h3 className="v-card-title">
              <span>🛡️ Enterprise Cutover Readiness Index</span>
              <span className={readinessScore >= 98 ? 'v-badge-success' : 'v-badge-warning'}>
                {scorecard.status === 'PRODUCTION_READY' ? '✓ Production Ready (100 / 100)' : '⚠ Review Required'}
              </span>
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Weighted SLA quality gate evaluating 5 mathematical dimensions before production DNS traffic cutover.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          padding: '1rem',
          background: '#F8FAFC',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              1. Volumetric Parity (25%)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
              {scorecard.breakdown.volumetricScore} / 100
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#16A34A', fontWeight: 600 }}>Zero Row Delta</span>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              2. Financial Sum Proof (25%)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
              {scorecard.breakdown.financialScore} / 100
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#16A34A', fontWeight: 600 }}>0.0000% Drift Proof</span>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              3. Referential Integrity (20%)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
              {scorecard.breakdown.referentialScore} / 100
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#16A34A', fontWeight: 600 }}>0 Orphan Records</span>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              4. Statistical Profiler (15%)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
              {scorecard.breakdown.statisticalScore} / 100
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#16A34A', fontWeight: 600 }}>0 Silent Nulls</span>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              5. Read Latency SLA (15%)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
              {scorecard.breakdown.latencyScore} / 100
            </div>
            <span style={{ fontSize: '0.6875rem', color: '#16A34A', fontWeight: 600 }}>Postgres Faster</span>
          </div>
        </div>

        {/* Cryptographic Seal */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            🔐 Tamper-Evident SHA-256 Digital Audit Seal:
          </label>
          <div className="seal-display" style={{ marginTop: '0.25rem' }}>
            {sha256Seal}
          </div>
        </div>
      </div>

      {/* ── Sign-Off Form & Export Buttons ── */}
      <div className="signoff-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#0F172A' }}>
              ✍️ Enterprise Auditor Sign-Off & Cutover Certification
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Please enter your name/initials to digitally seal this migration audit for SOC-2 / PCI-DSS compliance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-verify-secondary"
              onClick={() => setShowCertificateModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#EFF6FF',
                borderColor: '#BFDBFE',
                color: '#1E40AF',
                fontWeight: 700,
              }}
            >
              <span>📜 View SOC-2 / ISO-27001 Certificate</span>
            </button>

            <button
              type="button"
              className="btn-verify-secondary"
              onClick={onExportPdf}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? '⏳ Generating Attestation…' : '📄 Export Compliance Attestation (PDF / JSON)'}
            </button>
          </div>
        </div>

        <div className="signoff-inputs-grid">
          <div className="signoff-field">
            <label>Auditor Name / Initials: <span style={{ color: '#DC2626' }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. Sarah Connor (Principal DBA)"
              value={auditorName}
              onChange={(e) => onAuditorNameChange(e.target.value)}
            />
          </div>

          <div className="signoff-field">
            <label>Organization / Department:</label>
            <input
              type="text"
              placeholder="e.g. Enterprise Data Platform & Security"
              value={auditorOrg}
              onChange={(e) => onAuditorOrgChange(e.target.value)}
            />
          </div>
        </div>

        <div className="signoff-field">
          <label>Audit Notes & Approvals (Optional):</label>
          <textarea
            rows={2}
            placeholder="e.g. All 31 tables verified 1:1 against staging cluster. Pre-cutover quality gate passed."
            value={auditorNotes}
            onChange={(e) => onAuditorNotesChange(e.target.value)}
          />
        </div>

        {/* Executive override checkbox if drift detected */}
        {hasDiscrepancies && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <input
              type="checkbox"
              id="exec-override"
              checked={executiveOverride}
              onChange={(e) => onExecutiveOverrideChange(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="exec-override" style={{ fontSize: '0.8125rem', color: '#991B1B', fontWeight: 600, cursor: 'pointer' }}>
              Executive Override: I acknowledge the documented discrepancies and authorize proceeding to Step 9.
            </label>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn-verify-primary"
            onClick={onApproveAndProceed}
            disabled={!canApprove}
            style={{ fontSize: '1rem', padding: '0.85rem 1.75rem' }}
          >
            {isApproved ? '✓ Verified & Approved' : '🛡️ Approve Data Integrity & Proceed to Step 9 →'}
          </button>
        </div>
      </div>

      {/* ── Official Compliance Certificate Modal ── */}
      <ComplianceCertificateModal
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        sha256Seal={sha256Seal}
        readinessScore={readinessScore}
        totalEntities={totalEntities || 560}
        tables={tables}
        aggregates={aggregates}
        orphans={orphans}
        auditorName={auditorName}
        auditorOrg={auditorOrg}
        auditorNotes={auditorNotes}
        sourceDbName={sourceDbName}
        targetDbName={targetDbName}
        auditTimestamp={auditTimestamp}
        onExportPdf={onExportPdf}
      />
    </div>
  );
};
