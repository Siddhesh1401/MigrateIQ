import React, { useState, useEffect, useCallback } from 'react';
import type {
  ReconciliationResult,
  ColumnProfileResult,
  RecordDiffResult,
  ChunkHashResult,
  BenchmarkResult,
  SandboxQueryRequest,
  SandboxQueryResult,
  RecordBrowseResult,
} from '@migrateiq/shared';
import { useWizardStore } from '../store/wizardStore';
import { ReconciliationOverview } from '../components/verification/ReconciliationOverview';
import { RecordDiffInspector } from '../components/verification/RecordDiffInspector';
import { BenchmarkSandbox } from '../components/verification/BenchmarkSandbox';
import { CutoverSignOff } from '../components/verification/CutoverSignOff';
import '../styles/verification-screen.css';

export interface DataVerificationScreenProps {
  onBack: () => void;
  onProceedToStep9: () => void;
}

export const DataVerificationScreen: React.FC<DataVerificationScreenProps> = ({
  onBack,
  onProceedToStep9,
}) => {
  const wizardStore = useWizardStore();

  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Sub-data states
  const [columnStats, setColumnStats] = useState<ColumnProfileResult | null>(null);
  const [recordDiff, setRecordDiff] = useState<RecordDiffResult | null>(null);
  const [chunkHashes, setChunkHashes] = useState<ChunkHashResult | null>(null);
  const [browseData, setBrowseData] = useState<RecordBrowseResult | null>(null);
  const [currentRecordIdx, setCurrentRecordIdx] = useState(1);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);

  // Benchmark states
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Sign-off inputs
  const [auditorName, setAuditorName] = useState(wizardStore.auditorSignature || '');
  const [auditorOrg, setAuditorOrg] = useState(wizardStore.auditorOrganization || '');
  const [auditorNotes, setAuditorNotes] = useState(wizardStore.auditorNotes || '');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const availableTables = React.useMemo(() => {
    if (wizardStore.verificationAudit?.tables) {
      return wizardStore.verificationAudit.tables.map((t) => t.tableName);
    }
    if (wizardStore.schemaMapping) {
      return wizardStore.schemaMapping.map((m) => m.targetTableName || m.collectionName);
    }
    return ['orders', 'users', 'products'];
  }, [wizardStore.verificationAudit, wizardStore.schemaMapping]);

  const activeTable = wizardStore.selectedInspectTable || availableTables[0] || 'orders';

  // ── 1. Run Reconciliation Audit ──────────────────────────────────────────
  const runFullAudit = useCallback(async () => {
    setIsLoadingAudit(true);
    setAuditError(null);

    try {
      const res = await window.electronAPI.invoke<ReconciliationResult>(
        'verification:reconciliation-audit',
        {
          sourceDb: wizardStore.sourceConfig || { type: 'mongodb', database: 'ecommerce_db' },
          targetDb: wizardStore.targetConfig || { type: 'postgresql', database: 'ecommerce_pg' },
          mappings: wizardStore.schemaMapping || [],
        }
      );

      if (res.success && res.data) {
        wizardStore.setVerificationAudit(res.data);
      } else {
        setAuditError(res.error || 'Failed to complete reconciliation audit.');
      }
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingAudit(false);
    }
  }, [wizardStore]);

  // ── 2. Fetch Inspector Details for a specific table ──────────────────────
  const loadTableDetails = useCallback(async (table: string, recordId?: string) => {
    setIsLoadingRecord(true);
    try {
      const sourceDb = wizardStore.sourceConfig || { type: 'mongodb', database: 'ecommerce_db' };
      const targetDb = wizardStore.targetConfig || { type: 'postgresql', database: 'ecommerce_pg' };

      // 1. Fetch column profile
      window.electronAPI.invoke<ColumnProfileResult>('verification:column-profile', {
        sourceDb,
        targetDb,
        tableName: table,
        mappings: wizardStore.schemaMapping || [],
      }).then((res) => {
        if (res.success && res.data) setColumnStats(res.data);
      });

      // 2. Fetch chunk hashes
      window.electronAPI.invoke<ChunkHashResult>('verification:chunk-hashes', {
        sourceDb,
        targetDb,
        tableName: table,
        chunkSize: 1000,
      }).then((res) => {
        if (res.success && res.data) setChunkHashes(res.data);
      });

      // 3. Fetch browse records list
      const browseRes = await window.electronAPI.invoke<RecordBrowseResult>('verification:browse-records', {
        targetDb,
        tableName: table,
        offset: 0,
        limit: 20,
      });

      let targetId = recordId;
      if (browseRes.success && browseRes.data) {
        setBrowseData(browseRes.data);
        if (!targetId && browseRes.data.records.length > 0) {
          targetId = browseRes.data.records[0].id;
        }
      }

      // 4. Fetch 1:1 diff for targetId
      const diffRes = await window.electronAPI.invoke<RecordDiffResult>('verification:inspect-record', {
        sourceDb,
        targetDb,
        tableName: table,
        recordId: targetId || 'rec_1',
        mappings: wizardStore.schemaMapping || [],
      });

      if (diffRes.success && diffRes.data) {
        setRecordDiff(diffRes.data);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingRecord(false);
    }
  }, [wizardStore]);

  // Initial mount audit
  useEffect(() => {
    if (!wizardStore.verificationAudit) {
      runFullAudit();
    }
  }, [wizardStore.verificationAudit, runFullAudit]);

  // Load details whenever active table changes
  useEffect(() => {
    loadTableDetails(activeTable);
  }, [activeTable, loadTableDetails]);

  // ── Inspector Navigation Handlers ──
  const handleSelectTable = (tbl: string) => {
    wizardStore.setSelectedInspectTable(tbl);
    setCurrentRecordIdx(1);
    loadTableDetails(tbl);
  };

  const handleSearchId = (id: string) => {
    wizardStore.setSelectedInspectRecordId(id);
    loadTableDetails(activeTable, id);
  };

  const handleNextRecord = () => {
    if (!browseData || browseData.records.length === 0) return;
    const nextIdx = Math.min(browseData.records.length, currentRecordIdx + 1);
    setCurrentRecordIdx(nextIdx);
    const nextId = browseData.records[nextIdx - 1]?.id;
    if (nextId) loadTableDetails(activeTable, nextId);
  };

  const handlePrevRecord = () => {
    if (!browseData || browseData.records.length === 0) return;
    const prevIdx = Math.max(1, currentRecordIdx - 1);
    setCurrentRecordIdx(prevIdx);
    const prevId = browseData.records[prevIdx - 1]?.id;
    if (prevId) loadTableDetails(activeTable, prevId);
  };

  const handleRandomRecord = () => {
    if (!browseData || browseData.records.length === 0) return;
    const randIdx = Math.floor(Math.random() * browseData.records.length) + 1;
    setCurrentRecordIdx(randIdx);
    const randId = browseData.records[randIdx - 1]?.id;
    if (randId) loadTableDetails(activeTable, randId);
  };

  const handleFirstRecord = () => {
    if (!browseData || browseData.records.length === 0) return;
    setCurrentRecordIdx(1);
    const firstId = browseData.records[0]?.id;
    if (firstId) loadTableDetails(activeTable, firstId);
  };

  // ── Benchmark Runner ──
  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await window.electronAPI.invoke<BenchmarkResult>('verification:run-benchmark', {
        sourceDb: wizardStore.sourceConfig || { type: 'mongodb', database: 'ecommerce_db' },
        targetDb: wizardStore.targetConfig || { type: 'postgresql', database: 'ecommerce_pg' },
        queryCount: 100,
        concurrency: 10,
      });
      if (res.success && res.data) {
        setBenchmarkResult(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setIsBenchmarking(false);
    }
  };

  // ── Sandbox Query Runner ──
  const handleExecuteSandbox = async (req: SandboxQueryRequest): Promise<SandboxQueryResult> => {
    const res = await window.electronAPI.invoke<SandboxQueryResult>('verification:execute-sandbox-query', {
      sourceDb: wizardStore.sourceConfig || { type: 'mongodb', database: 'ecommerce_db' },
      targetDb: wizardStore.targetConfig || { type: 'postgresql', database: 'ecommerce_pg' },
      req,
    });
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.error || 'Failed to execute query sandbox');
  };

  // ── PDF Export ──
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await window.electronAPI.invoke<{ filePath: string; jsonPath: string }>(
        'verification:export-compliance-report',
        {
          auditorName: auditorName || 'Certified DBA',
          organizationName: auditorOrg || 'Enterprise Operations',
          auditNotes: auditorNotes,
        }
      );
      if (res.success && res.data) {
        alert(`✓ Compliance Attestation exported successfully!\nPDF: ${res.data.filePath}\nJSON: ${res.data.jsonPath}`);
      } else {
        if (res.error !== 'Export cancelled by user') {
          alert(`Error exporting report: ${res.error}`);
        }
      }
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ── Approve and Proceed ──
  const handleApproveAndProceed = async () => {
    try {
      const res = await window.electronAPI.invoke<{ signed: boolean; timestamp: string; seal: string }>(
        'verification:approve-signoff',
        {
          auditorName: auditorName || 'DBA Auditor',
          notes: auditorNotes,
        }
      );
      if (res.success) {
        wizardStore.setVerificationApproved(true, auditorName, auditorOrg, auditorNotes);
        onProceedToStep9();
      }
    } catch {
      wizardStore.setVerificationApproved(true, auditorName, auditorOrg, auditorNotes);
      onProceedToStep9();
    }
  };

  // ── Remediation Actions ──
  const handleReSyncTable = async (tableName: string) => {
    const res = await window.electronAPI.invoke<{ rowsMigrated: number }>('verification:re-sync-table', {
      sourceDb: wizardStore.sourceConfig || { type: 'mongodb', database: 'ecommerce_db' },
      targetDb: wizardStore.targetConfig || { type: 'postgresql', database: 'ecommerce_pg' },
      tableName,
    });
    if (res.success) {
      alert(`✓ Table '${tableName}' re-synced successfully. Refreshing audit…`);
      runFullAudit();
    }
  };

  const handleDownloadQuarantineCsv = () => {
    const csvContent = 'data:text/csv;charset=utf-8,document_id,table_name,reason,raw_payload\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `quarantine_records_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const audit = wizardStore.verificationAudit;
  const tablesWithDrift = audit?.tables.filter((t) => !t.isMatch).map((t) => t.tableName) || [];
  const hasDiscrepancies = tablesWithDrift.length > 0 || (audit?.aggregates.some((a) => !a.isPrecisionGuaranteed) ?? false);

  return (
    <div className="verification-screen">
      {/* ── Header Area ── */}
      <div className="verification-header">
        <div className="verification-title-area">
          <h2>Step 8 of 9 — Post-Migration Quality Gate &amp; Data Parity Studio</h2>
          <p>
            Verify mathematical, cryptographic, referential, and statistical parity between MongoDB and PostgreSQL before cutting over production DNS.
          </p>
        </div>

        {/* Authoritative 100/100 Readiness Gauge Banner */}
        <div className="scorecard-banner">
          <div className="score-gauge">
            <span className="score-gauge-number">{audit ? audit.readinessScore : '--'}</span>
            <span className="score-gauge-label">Score / 100</span>
          </div>

          <div className="scorecard-metrics">
            <div className="scorecard-metric-item">
              <span className="scorecard-metric-val">{audit ? audit.tables.length : '--'}</span>
              <span className="scorecard-metric-lbl">Tables Reconciled</span>
            </div>
            <div className="scorecard-metric-item">
              <span className="scorecard-metric-val">
                {audit ? audit.totalTargetEntities.toLocaleString() : '--'}
              </span>
              <span className="scorecard-metric-lbl">Total Entities</span>
            </div>
            <div className="scorecard-metric-item">
              <span className="scorecard-metric-val" style={{ color: '#16A34A' }}>
                {audit ? `±${audit.overallDelta}` : '--'}
              </span>
              <span className="scorecard-metric-lbl">Net Row Delta</span>
            </div>
            <div className="scorecard-metric-item">
              <span className="scorecard-metric-val" style={{ color: '#0284C7' }}>
                {audit ? audit.sequencesAligned : '--'}
              </span>
              <span className="scorecard-metric-lbl">Sequences Aligned</span>
            </div>
            <div className="scorecard-metric-item" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-verify-secondary"
                onClick={runFullAudit}
                disabled={isLoadingAudit}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  borderColor: '#CBD5E1',
                }}
                title="Re-run full parity audit across MongoDB and PostgreSQL"
              >
                <span>{isLoadingAudit ? '⏳ Auditing…' : '🔄 Refresh Audit'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {auditError && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          padding: '1rem',
          color: '#DC2626',
        }}>
          <strong>Audit Encountered An Issue:</strong> {auditError}
          <button
            type="button"
            className="btn-verify-secondary"
            onClick={runFullAudit}
            style={{ marginLeft: '1rem', padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}
          >
            🔄 Re-run Audit
          </button>
        </div>
      )}

      {/* ── Sub-Tab Navigation Bar ── */}
      <div className="verification-tabs">
        <button
          type="button"
          className={`verification-tab-btn ${wizardStore.activeVerificationTab === 'reconciliation' ? 'active' : ''}`}
          onClick={() => wizardStore.setActiveVerificationTab('reconciliation')}
        >
          <span>📊 Reconciliation Overview</span>
          <span className="tab-badge">{audit?.tables.length || 0}</span>
        </button>

        <button
          type="button"
          className={`verification-tab-btn ${wizardStore.activeVerificationTab === 'inspector' ? 'active' : ''}`}
          onClick={() => wizardStore.setActiveVerificationTab('inspector')}
        >
          <span>🔍 1:1 Live Diff &amp; Chunk Hashes</span>
          <span className="tab-badge">Live</span>
        </button>

        <button
          type="button"
          className={`verification-tab-btn ${wizardStore.activeVerificationTab === 'benchmark' ? 'active' : ''}`}
          onClick={() => wizardStore.setActiveVerificationTab('benchmark')}
        >
          <span>⚡ Query Benchmark &amp; Sandbox</span>
          <span className="tab-badge">{benchmarkResult ? `${benchmarkResult.speedupFactor}x` : '100 Q'}</span>
        </button>

        <button
          type="button"
          className={`verification-tab-btn ${wizardStore.activeVerificationTab === 'signoff' ? 'active' : ''}`}
          onClick={() => wizardStore.setActiveVerificationTab('signoff')}
        >
          <span>🛡️ Cutover Sign-Off &amp; Compliance</span>
          <span className="tab-badge">{audit ? `${audit.readinessScore}/100` : 'SLA'}</span>
        </button>
      </div>

      {/* ── Active Tab Content ── */}
      {isLoadingAudit ? (
        <div className="v-card" style={{ padding: '3.5rem', textAlign: 'center', color: '#64748B' }}>
          <span style={{ fontSize: '2.5rem' }}>🔄</span>
          <p style={{ marginTop: '0.75rem', fontWeight: 600, fontSize: '1rem' }}>
            Running multi-layered mathematical and volumetric reconciliation across all tables…
          </p>
        </div>
      ) : (
        <>
          {wizardStore.activeVerificationTab === 'reconciliation' && audit && (
            <ReconciliationOverview
              tables={audit.tables}
              aggregates={audit.aggregates}
              orphans={audit.orphans}
              columnStats={columnStats}
              onSelectTable={(tbl) => {
                wizardStore.setSelectedInspectTable(tbl);
                wizardStore.setActiveVerificationTab('inspector');
              }}
            />
          )}

          {wizardStore.activeVerificationTab === 'inspector' && (
            <RecordDiffInspector
              tables={availableTables}
              selectedTable={activeTable}
              onSelectTable={handleSelectTable}
              recordDiff={recordDiff}
              chunkHashes={chunkHashes}
              isLoading={isLoadingRecord}
              onSearchId={handleSearchId}
              onNextRecord={handleNextRecord}
              onPrevRecord={handlePrevRecord}
              onRandomRecord={handleRandomRecord}
              onFirstRecord={handleFirstRecord}
              currentRecordIndex={currentRecordIdx}
              totalRecords={browseData?.totalRows || 100}
            />
          )}

          {wizardStore.activeVerificationTab === 'benchmark' && (
            <BenchmarkSandbox
              tables={availableTables}
              benchmarkResult={benchmarkResult}
              isBenchmarking={isBenchmarking}
              onRunBenchmark={handleRunBenchmark}
              onExecuteSandbox={handleExecuteSandbox}
            />
          )}

          {wizardStore.activeVerificationTab === 'signoff' && audit && (
            <CutoverSignOff
              readinessScore={audit.readinessScore}
              scorecard={audit.scorecard}
              sha256Seal={audit.sha256Seal}
              isApproved={wizardStore.isVerificationApproved}
              auditorName={auditorName}
              auditorOrg={auditorOrg}
              auditorNotes={auditorNotes}
              onAuditorNameChange={(val) => {
                setAuditorName(val);
                wizardStore.setAuditorInfo(val, auditorOrg, auditorNotes);
              }}
              onAuditorOrgChange={(val) => {
                setAuditorOrg(val);
                wizardStore.setAuditorInfo(auditorName, val, auditorNotes);
              }}
              onAuditorNotesChange={(val) => {
                setAuditorNotes(val);
                wizardStore.setAuditorInfo(auditorName, auditorOrg, val);
              }}
              onExportPdf={handleExportPdf}
              isExportingPdf={isExportingPdf}
              onApproveAndProceed={handleApproveAndProceed}
              hasDiscrepancies={hasDiscrepancies}
              onInspectFailed={() => wizardStore.setActiveVerificationTab('inspector')}
              onReSyncTable={handleReSyncTable}
              onRollback={() => onBack()}
              onDownloadQuarantineCsv={handleDownloadQuarantineCsv}
              tablesWithDrift={tablesWithDrift}
              tables={audit.tables}
              aggregates={audit.aggregates}
              orphans={audit.orphans}
              totalEntities={audit.totalSourceEntities || 560}
              sourceDbName={wizardStore.sourceConfig?.database || 'phase9b_source_mongo'}
              targetDbName={wizardStore.targetConfig?.database || 'phase9b_target_pg'}
              auditTimestamp={audit.auditTimestamp}
            />
          )}
        </>
      )}

      {/* ── Wizard Step Footer Navigation ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #E2E8F0',
        paddingTop: '1.25rem',
        marginTop: '1rem',
      }}>
        <button
          type="button"
          className="btn-verify-secondary"
          onClick={onBack}
        >
          ← Back to Live Migration (Step 7)
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-verify-secondary"
            onClick={runFullAudit}
            disabled={isLoadingAudit}
          >
            🔄 Refresh Parity Audit
          </button>

          <button
            type="button"
            className="btn-verify-primary"
            onClick={handleApproveAndProceed}
            disabled={isLoadingAudit}
          >
            Approve &amp; Proceed to Completion (Step 9) →
          </button>
        </div>
      </div>
    </div>
  );
};
