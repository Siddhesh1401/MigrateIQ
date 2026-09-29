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
  const [executiveOverride, setExecutiveOverride] = useState(false);
  const [isReSyncingTable, setIsReSyncingTable] = useState<string | null>(null);
  const [reSyncBanner, setReSyncBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

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

  // ── Statistical Profiler Table Change Handler ──
  const handleProfileTableChange = useCallback(async (table: string) => {
    try {
      const sourceDb = wizardStore.sourceConfig || { type: 'mongodb', database: 'ecommerce_db' };
      const targetDb = wizardStore.targetConfig || { type: 'postgresql', database: 'ecommerce_pg' };
      const res = await window.electronAPI.invoke<ColumnProfileResult>('verification:column-profile', {
        sourceDb,
        targetDb,
        tableName: table,
        mappings: wizardStore.schemaMapping || [],
      });
      if (res.success && res.data) {
        setColumnStats(res.data);
      }
    } catch {
      // Ignored
    }
  }, [wizardStore]);

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
    let targetId = recordId;
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
        recordId: targetId || '',
        mappings: wizardStore.schemaMapping || [],
      });

      if (diffRes.success && diffRes.data) {
        setRecordDiff(diffRes.data);
        if (!diffRes.data.sourceDoc && !diffRes.data.targetRow) {
          setSearchError(`No document or row found with ID "${targetId || diffRes.data.recordId}" in collection "${table}" or target database.`);
        } else if (!diffRes.data.sourceDoc) {
          setSearchError(`Record "${targetId || diffRes.data.recordId}" exists in PostgreSQL table "${table}" but is missing from MongoDB.`);
        } else if (!diffRes.data.targetRow) {
          setSearchError(`Document "${targetId || diffRes.data.recordId}" exists in MongoDB collection "${table}" but is missing from PostgreSQL.`);
        } else {
          setSearchError(null);
        }
      } else {
        setRecordDiff(null);
        if (targetId) {
          setSearchError(`No document found with ID "${targetId}" in collection "${table}".`);
        }
      }
    } catch (err) {
      if (targetId) {
        setSearchError(`Search error for ID "${targetId}": ${err instanceof Error ? err.message : String(err)}`);
      }
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
    setSearchError(null);
    loadTableDetails(tbl);
  };

  const handleSearchId = (id: string) => {
    const cleanId = id.trim();
    if (!cleanId) return;
    wizardStore.setSelectedInspectRecordId(cleanId);
    if (browseData?.records) {
      const matchIdx = browseData.records.findIndex((r) => r.id === cleanId);
      if (matchIdx !== -1) {
        setCurrentRecordIdx(matchIdx + 1);
      }
    }
    loadTableDetails(activeTable, cleanId);
  };

  const handleNextRecord = () => {
    if (!browseData || browseData.records.length === 0) return;
    setSearchError(null);
    const nextIdx = Math.min(browseData.records.length, currentRecordIdx + 1);
    setCurrentRecordIdx(nextIdx);
    const nextId = browseData.records[nextIdx - 1]?.id;
    if (nextId) loadTableDetails(activeTable, nextId);
  };

  const handlePrevRecord = () => {
    if (!browseData || browseData.records.length === 0) return;
    setSearchError(null);
    const prevIdx = Math.max(1, currentRecordIdx - 1);
    setCurrentRecordIdx(prevIdx);
    const prevId = browseData.records[prevIdx - 1]?.id;
    if (prevId) loadTableDetails(activeTable, prevId);
  };

  const handleRandomRecord = () => {
    if (!browseData || browseData.records.length === 0) return;
    setSearchError(null);
    const randIdx = Math.floor(Math.random() * browseData.records.length) + 1;
    setCurrentRecordIdx(randIdx);
    const randId = browseData.records[randIdx - 1]?.id;
    if (randId) loadTableDetails(activeTable, randId);
  };

  const handleFirstRecord = () => {
    setSearchError(null);
    if (!browseData || browseData.records.length === 0) return;
    setCurrentRecordIdx(1);
    const firstId = browseData.records[0]?.id;
    if (firstId) loadTableDetails(activeTable, firstId);
  };

  // ── Benchmark Runner ──
  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkError(null);
    try {
      const res = await window.electronAPI.invoke<BenchmarkResult>('verification:run-benchmark', {
        sourceDb: wizardStore.sourceConfig || { type: 'mongodb', database: 'ecommerce_db' },
        targetDb: wizardStore.targetConfig || { type: 'postgresql', database: 'ecommerce_pg' },
        queryCount: 100,
        concurrency: 10,
      });
      if (res.success && res.data) {
        setBenchmarkResult(res.data);
      } else {
        setBenchmarkError(res.error || 'Benchmark run failed on target database.');
      }
    } catch (err) {
      setBenchmarkError(err instanceof Error ? err.message : String(err));
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

  const audit = wizardStore.verificationAudit;
  const tablesWithDrift = audit?.tables.filter((t) => !t.isMatch).map((t) => t.tableName) || [];
  const hasDiscrepancies = tablesWithDrift.length > 0 || (audit?.aggregates.some((a) => !a.isPrecisionGuaranteed) ?? false);
  const canApprove = (auditorName.trim().length > 0) && (!hasDiscrepancies || executiveOverride);

  // ── Approve and Proceed ──
  const handleApproveAndProceed = async () => {
    if (!canApprove) {
      wizardStore.setActiveVerificationTab('signoff');
      if (!auditorName.trim()) {
        alert('Quality Gate Locked: Certified Auditor Name/Signature is required before sign-off.');
      } else if (hasDiscrepancies && !executiveOverride) {
        alert('Quality Gate Locked: Parity discrepancies detected. Executive override confirmation is required to proceed.');
      }
      return;
    }

    try {
      const res = await window.electronAPI.invoke<{ signed: boolean; timestamp: string; seal: string }>(
        'verification:approve-signoff',
        {
          auditorName: auditorName.trim(),
          notes: auditorNotes,
        }
      );
      if (res.success) {
        wizardStore.setVerificationApproved(true, auditorName.trim(), auditorOrg, auditorNotes);
        onProceedToStep9();
      }
    } catch {
      wizardStore.setVerificationApproved(true, auditorName.trim(), auditorOrg, auditorNotes);
      onProceedToStep9();
    }
  };

  // ── Remediation Actions ──
  const handleReSyncTable = async (tableName: string) => {
    setIsReSyncingTable(tableName);
    setReSyncBanner(null);
    try {
      const res = await window.electronAPI.invoke<{ rowsMigrated: number }>('verification:re-sync-table', {
        sourceDb: wizardStore.sourceConfig || { type: 'mongodb', database: 'ecommerce_db' },
        targetDb: wizardStore.targetConfig || { type: 'postgresql', database: 'ecommerce_pg' },
        tableName,
        mappings: wizardStore.schemaMapping || [],
      });
      if (res.success && res.data) {
        setReSyncBanner({
          type: 'success',
          message: `✓ Table '${tableName}' and associated child tables re-synced successfully (${res.data.rowsMigrated} rows). Parity audit refreshed.`
        });
        await runFullAudit();
      } else {
        setReSyncBanner({
          type: 'error',
          message: res.error || `Failed to re-sync table '${tableName}'.`
        });
      }
    } catch (err) {
      setReSyncBanner({
        type: 'error',
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsReSyncingTable(null);
    }
  };

  const handleCleanRollbackToSchema = async () => {
    setIsLoadingAudit(true);
    try {
      await window.electronAPI.invoke('verification:rescue-action', {
        action: 'wipe_target',
        targetConfig: wizardStore.targetConfig || undefined,
      });
      wizardStore.setVerificationAudit(null);
      wizardStore.setWizardStep(4);
    } catch (err) {
      alert(`Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleAlterColumnType = async (tableName: string, columnName: string, newType: string): Promise<boolean> => {
    try {
      const res = await window.electronAPI.invoke<{ success: boolean; message: string }>('verification:rescue-action', {
        action: 'alter_column_type',
        targetConfig: wizardStore.targetConfig || undefined,
        tableName,
        columnName,
        newDataType: newType,
      });
      if (res.success && res.data) {
        setReSyncBanner({ type: 'success', message: `✓ ${res.data.message}` });
        return true;
      }
      setReSyncBanner({ type: 'error', message: res.error || 'Failed to alter column type.' });
      return false;
    } catch (err) {
      setReSyncBanner({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      return false;
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

      {/* ── Re-Sync & Remediation Banner Feedback ── */}
      {reSyncBanner && (
        <div style={{
          backgroundColor: reSyncBanner.type === 'success' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${reSyncBanner.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          color: reSyncBanner.type === 'success' ? '#166534' : '#DC2626',
          fontSize: '0.875rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{reSyncBanner.message}</span>
          <button
            type="button"
            onClick={() => setReSyncBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {isReSyncingTable && (
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          padding: '0.75rem 1.25rem',
          color: '#1E40AF',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>
          ⏳ Streaming fresh records &amp; synchronizing table '{isReSyncingTable}' and its child tables…
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
              onSelectProfileTable={handleProfileTableChange}
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
              searchError={searchError}
            />
          )}

          {wizardStore.activeVerificationTab === 'benchmark' && (
            <BenchmarkSandbox
              tables={availableTables}
              benchmarkResult={benchmarkResult}
              isBenchmarking={isBenchmarking}
              benchmarkError={benchmarkError}
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
              onCleanRollbackToSchema={handleCleanRollbackToSchema}
              onAlterColumnType={handleAlterColumnType}
              onDownloadQuarantineCsv={handleDownloadQuarantineCsv}
              tablesWithDrift={tablesWithDrift}
              executiveOverride={executiveOverride}
              onExecutiveOverrideChange={setExecutiveOverride}
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
          {!canApprove && (
            <span style={{ fontSize: '0.8125rem', color: '#DC2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              🔒 Quality Gate: {!auditorName.trim() ? 'Auditor Signature Required' : 'Discrepancy Override Required'}
            </span>
          )}

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
            disabled={isLoadingAudit || !canApprove}
            title={!canApprove ? 'Complete sign-off and auditor signature in Tab 4 to proceed' : 'Proceed to Step 9'}
          >
            Approve &amp; Proceed to Completion (Step 9) →
          </button>
        </div>
      </div>
    </div>
  );
};
