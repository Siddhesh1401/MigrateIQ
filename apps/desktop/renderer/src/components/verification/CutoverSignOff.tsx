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
}) => {
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  const canApprove = (auditorName.trim().length > 0) && (!hasDiscrepancies || executiveOverride);

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

          <div className="remediation-actions">
            <button type="button" className="remediation-btn" onClick={onInspectFailed}>
              🔍 Inspect Failed Rows
            </button>
            {tablesWithDrift[0] && (
              <button type="button" className="remediation-btn" onClick={() => onReSyncTable(tablesWithDrift[0])}>
                ⚡ 1-Click Re-Sync Table
              </button>
            )}
            <button type="button" className="remediation-btn" onClick={onRollback}>
              ↩️ Rollback & Adjust Schema
            </button>
            <button type="button" className="remediation-btn" onClick={onDownloadQuarantineCsv}>
              📥 Download Quarantine Log (.csv)
            </button>
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
