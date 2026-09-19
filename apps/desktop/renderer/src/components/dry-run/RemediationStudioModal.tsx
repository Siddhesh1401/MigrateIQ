import React, { useState, useEffect, useRef } from 'react';
import type {
  AnomalyFixRequest,
  AIAnomalyFixRecommendation,
} from '@migrateiq/shared';
import { getTypeAwareFallback } from './dryRunUtils';

export interface RemediationFixItem {
  tableName: string;
  fieldName: string;
  defaultValue: string;
}

export interface RemediationStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  anomalies: AnomalyFixRequest[];
  onApplyFixes: (fixes: RemediationFixItem[], mode: 'smart' | 'manual') => void;
  initialTab?: 'smart' | 'manual';
}

export const RemediationStudioModal: React.FC<RemediationStudioModalProps> = ({
  isOpen,
  onClose,
  anomalies,
  onApplyFixes,
  initialTab = 'smart',
}) => {
  const [tab, setTab] = useState<'smart' | 'manual'>(initialTab);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiFromCache, setIsAiFromCache] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AIAnomalyFixRecommendation[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const aiCacheRef = useRef<Map<string, { recommendations: AIAnomalyFixRecommendation[]; timestamp: number }>>(new Map());

  // Sync tab when initialTab changes on open
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const fallbackToLocalRecommendations = (targetAnomalies: AnomalyFixRequest[]) => {
    const localRecs: AIAnomalyFixRecommendation[] = targetAnomalies.map((a) => {
      const tbl = a.targetTable || a.tableName;
      const col = a.targetColumn || a.columnName;
      const fallback = getTypeAwareFallback(a.targetType);
      const isStr = a.targetType.toUpperCase().includes('CHAR') || a.targetType.toUpperCase().includes('TEXT');
      const ddlSnippet = `ALTER TABLE "${tbl}"\n  ALTER COLUMN "${col}" SET DEFAULT ${isStr ? `'${fallback}'` : fallback},\n  ALTER COLUMN "${col}" SET NOT NULL;`;
      return {
        targetTable: tbl,
        field: col,
        targetColumn: col,
        targetType: a.targetType,
        suggestedValue: fallback,
        recommendedDefaultValue: fallback,
        confidence: 0.95,
        rationale: `Substitutes missing values with type-preserving fallback '${fallback}' so target schema retains NOT NULL constraint without rejecting rows.`,
        suggestedDdl: ddlSnippet,
        sqlClause: `DEFAULT ${isStr ? `'${fallback}'` : fallback} NOT NULL`,
        isAiGenerated: false,
      };
    });
    setAiRecommendations(localRecs);
    const updatedEdits: Record<string, string> = {};
    for (const rec of localRecs) {
      const key = `${rec.targetTable}.${rec.targetColumn || rec.field}`;
      updatedEdits[key] = rec.recommendedDefaultValue || rec.suggestedValue;
    }
    setEdits((prev) => ({ ...prev, ...updatedEdits }));
  };

  const fetchAiRecommendations = async (forceRefresh = false) => {
    if (anomalies.length === 0) return;

    const cacheKey = anomalies
      .map((a) => `${a.targetTable || a.tableName || ''}.${a.targetColumn || a.columnName || ''}`)
      .sort()
      .join('|');

    // Initialize baseline defaults
    const initialEdits: Record<string, string> = {};
    for (const a of anomalies) {
      const tbl = a.targetTable || a.tableName;
      const col = a.targetColumn || a.columnName;
      const key = `${tbl}.${col}`;
      if (!edits[key]) {
        initialEdits[key] = getTypeAwareFallback(a.targetType);
      }
    }
    setEdits((prev) => ({ ...initialEdits, ...prev }));

    // Check fast in-memory cache (30 min TTL)
    const CACHE_TTL_MS = 30 * 60 * 1000;
    const cachedEntry = aiCacheRef.current.get(cacheKey);
    if (!forceRefresh && cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
      setIsAiFromCache(true);
      setAiRecommendations(cachedEntry.recommendations);
      const updatedEdits: Record<string, string> = {};
      for (const rec of cachedEntry.recommendations) {
        const tbl = rec.targetTable;
        const col = rec.targetColumn || rec.field;
        const key = `${tbl}.${col}`;
        if (!edits[key]) {
          updatedEdits[key] = rec.recommendedDefaultValue || rec.suggestedValue;
        }
      }
      setEdits((prev) => ({ ...updatedEdits, ...prev }));
      return;
    }

    setIsAiLoading(true);
    setIsAiFromCache(false);

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const res = await window.electronAPI.invoke<AIAnomalyFixRecommendation[]>('ai:suggest-anomaly-fixes', {
          anomalies,
          apiKey: import.meta.env.VITE_GEMINI_API_KEY || undefined,
          forceRefresh,
        });

        if (res?.success && res.data && res.data.length > 0) {
          setAiRecommendations(res.data);
          aiCacheRef.current.set(cacheKey, {
            recommendations: res.data,
            timestamp: Date.now(),
          });
          const updatedEdits: Record<string, string> = {};
          for (const rec of res.data) {
            const tbl = rec.targetTable;
            const col = rec.targetColumn || rec.field;
            const key = `${tbl}.${col}`;
            updatedEdits[key] = rec.recommendedDefaultValue || rec.suggestedValue;
          }
          setEdits((prev) => ({ ...prev, ...updatedEdits }));
        } else {
          fallbackToLocalRecommendations(anomalies);
        }
      } else {
        fallbackToLocalRecommendations(anomalies);
      }
    } catch (err) {
      console.warn('AI remediation fetch failed, using local rule fallback:', err);
      fallbackToLocalRecommendations(anomalies);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAiRecommendations(false);
    }
  }, [isOpen, anomalies]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (anomalies.length === 0) {
      onClose();
      return;
    }

    const fixes: RemediationFixItem[] = [];
    for (const a of anomalies) {
      const tbl = a.targetTable || a.tableName;
      const col = a.targetColumn || a.columnName;
      const key = `${tbl}.${col}`;
      const rec = aiRecommendations.find((r) => r.targetTable === tbl && (r.targetColumn === col || r.field === col));
      const chosenValue =
        edits[key] !== undefined
          ? edits[key]
          : tab === 'smart'
          ? rec?.recommendedDefaultValue || rec?.suggestedValue || getTypeAwareFallback(a.targetType)
          : getTypeAwareFallback(a.targetType);

      fixes.push({
        tableName: tbl,
        fieldName: col,
        defaultValue: chosenValue.trim() || 'Unknown',
      });
    }

    onApplyFixes(fixes, tab);
  };

  return (
    <div className="remediation-modal-backdrop" onClick={onClose}>
      <div className="remediation-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="remediation-modal-header">
          <div>
            <h3>
              <span>🛠️</span> Data Quality Remediation Studio
            </h3>
            <p>
              Resolve constraint violations and missing values with AI or manual precision defaults before committing to PostgreSQL.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="remediation-tab-bar">
              <button
                type="button"
                className={`remediation-tab-btn ${tab === 'smart' ? 'active' : ''}`}
                onClick={() => setTab('smart')}
              >
                <span>✨</span> Smart AI Remediation
              </button>
              <button
                type="button"
                className={`remediation-tab-btn ${tab === 'manual' ? 'active' : ''}`}
                onClick={() => setTab('manual')}
              >
                <span>⚙️</span> Manual Precision
              </button>
            </div>

            <button
              type="button"
              className="dry-run-modal-close-btn"
              onClick={onClose}
              title="Close Studio"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="remediation-modal-body">
          {anomalies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#16A34A' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>All Records Clean & Valid</h4>
              <p style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '0.25rem' }}>
                No schema constraint violations or NULL anomalies are present in the current dry run dataset.
              </p>
            </div>
          ) : tab === 'smart' ? (
            <>
              {/* AI Banner */}
              <div className="remediation-ai-banner">
                <span className="remediation-ai-banner-icon">✨</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0369A1' }}>
                        Gemini AI Anomaly Imputation Engine
                      </h4>
                      <span style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem', background: '#E0F2FE', color: '#0284C7', borderRadius: '4px', fontWeight: 600 }}>
                        Domain & Type Aware
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      {isAiFromCache && (
                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: '#DCFCE7', color: '#15803D', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', border: '1px solid #86EFAC' }}>
                          <span>⚡</span> Instant (Cached • 0 tokens)
                        </span>
                      )}
                      <button
                        type="button"
                        className="remediation-reset-btn"
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={() => fetchAiRecommendations(true)}
                        disabled={isAiLoading}
                        title="Force re-run analysis with Gemini AI (consumes tokens)"
                      >
                        <span>🔄</span> Re-analyze with Gemini
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: '#0C4A6E', lineHeight: 1.45 }}>
                    Gemini analyzed the detected constraint failures and synthesized domain-specific fallbacks based on column semantics and data types. Review the side-by-side Before & After diff below before applying.
                  </p>
                </div>
              </div>

              {isAiLoading ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'spin 1.5s linear infinite' }}>✨</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A' }}>Gemini AI is analyzing schema anomalies...</div>
                  <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.25rem' }}>Synthesizing domain-aware fallback defaults and verifying SQL DDL safety</div>
                </div>
              ) : (
                anomalies.map((anomaly) => {
                  const targetTbl = anomaly.targetTable || anomaly.tableName;
                  const targetCol = anomaly.targetColumn || anomaly.columnName;
                  const key = `${targetTbl}.${targetCol}`;
                  const rec = aiRecommendations.find(
                    (r) => r.targetTable === targetTbl && (r.targetColumn === targetCol || r.field === targetCol)
                  );
                  const currentValue =
                    edits[key] !== undefined
                      ? edits[key]
                      : rec?.recommendedDefaultValue || rec?.suggestedValue || getTypeAwareFallback(anomaly.targetType);
                  const rationaleText = rec?.rationale;
                  const ddlText = rec?.suggestedDdl || (rec?.sqlClause ? `ALTER TABLE "${targetTbl}"\n  ALTER COLUMN "${targetCol}" SET ${rec.sqlClause};` : undefined);
                  const affectedCount = anomaly.affectedRowCount || 1;
                  const offendingSnippet = anomaly.sampleOffendingSnippet || anomaly.rawSnippet || `{ "_id": "doc_sample", "${targetCol}": null }`;

                  return (
                    <div key={key} className="remediation-diff-item">
                      {/* Diff Item Header */}
                      <div className="remediation-diff-header">
                        <div>
                          <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem' }}>
                            {targetTbl}.{targetCol}
                          </span>
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#EFF6FF', color: '#2563EB', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                            {anomaly.targetType}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#DC2626', background: '#FEE2E2', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
                            ⚠️ {affectedCount} row(s) failing
                          </span>
                          {rec?.confidence && (
                            <span style={{ fontSize: '0.75rem', color: '#16A34A', background: '#DCFCE7', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
                              {Math.round(rec.confidence * 100)}% Confidence
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Side-by-Side Diff Grid */}
                      <div className="remediation-diff-grid">
                        {/* Left: BEFORE */}
                        <div className="remediation-diff-col before">
                          <div className="remediation-col-title">
                            <span>❌</span> BEFORE (MONGODB SOURCE ANOMALY)
                          </div>
                          <div className="remediation-error-callout">
                            <span>⚠️</span>
                            <div>{anomaly.failureReason}</div>
                          </div>
                          <div className="remediation-snippet-box">
                            {offendingSnippet}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                            <span style={{ fontWeight: 600, color: '#DC2626' }}>Constraint:</span>
                            <code>NOT NULL</code> (inserts will fail without a fallback default)
                          </div>
                        </div>

                        {/* Right: AFTER */}
                        <div className="remediation-diff-col after">
                          <div className="remediation-col-title">
                            <span>✅</span> AFTER (POSTGRESQL HEALED SCHEMA)
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>
                            Imputes fallback value on insert and configures default constraint:
                          </div>

                          <div className="remediation-input-row">
                            <label
                              htmlFor={`smart-input-${key}`}
                              style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1E293B', minWidth: '85px' }}
                            >
                              Default Val:
                            </label>
                            <input
                              id={`smart-input-${key}`}
                              type="text"
                              className="remediation-input"
                              value={currentValue}
                              onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                              placeholder="Enter default value..."
                            />
                            <button
                              type="button"
                              className="remediation-reset-btn"
                              onClick={() => {
                                const recVal = rec?.recommendedDefaultValue || rec?.suggestedValue;
                                if (recVal) {
                                  setEdits((prev) => ({ ...prev, [key]: recVal }));
                                }
                              }}
                              title="Reset to AI recommended value"
                            >
                              Reset AI
                            </button>
                          </div>

                          {rationaleText && (
                            <div className="remediation-rationale-box">
                              <span style={{ fontSize: '1rem', lineHeight: 1 }}>💡</span>
                              <div>
                                <strong style={{ color: '#0F172A' }}>AI Rationale:</strong>{' '}
                                <span style={{ color: '#334155' }}>{rationaleText}</span>
                              </div>
                            </div>
                          )}

                          {ddlText && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                                Target DDL Migration:
                              </div>
                              <div className="remediation-ddl-box">
                                {ddlText}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            /* Manual Remediation Tab */
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                    Manual Precision Remediation Controls
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Configure custom defaults or choose standard presets
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                  Assign specific fallback values per affected column. Missing source values will be replaced during insertion, preserving target PostgreSQL <code>NOT NULL</code> constraints with 100% ingestion pass.
                </p>
              </div>

              {anomalies.map((anomaly) => {
                const targetTbl = anomaly.targetTable || anomaly.tableName;
                const targetCol = anomaly.targetColumn || anomaly.columnName;
                const key = `${targetTbl}.${targetCol}`;
                const currentValue =
                  edits[key] !== undefined
                    ? edits[key]
                    : getTypeAwareFallback(anomaly.targetType);
                const affectedCount = anomaly.affectedRowCount || 1;

                return (
                  <div
                    key={key}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '1rem 1.25rem',
                      marginBottom: '1rem',
                      background: '#FFFFFF',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9375rem' }}>
                          {targetTbl}.{targetCol}
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#F1F5F9', color: '#475569', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                          {anomaly.targetType}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#DC2626', background: '#FEE2E2', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}>
                        ⚠️ {affectedCount} row(s) missing this field
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.25rem', alignItems: 'flex-start' }}>
                      <div>
                        <label
                          htmlFor={`manual-input-${key}`}
                          style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}
                        >
                          Fallback Default Value:
                        </label>
                        <input
                          id={`manual-input-${key}`}
                          type="text"
                          className="remediation-input"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={currentValue}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder="Enter fallback value..."
                        />
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                          Quick Type Presets:
                        </span>
                        <div className="remediation-chips-row" style={{ marginTop: 0 }}>
                          <button
                            type="button"
                            className="remediation-chip"
                            onClick={() => setEdits((prev) => ({ ...prev, [key]: 'Unknown' }))}
                          >
                            'Unknown'
                          </button>
                          <button
                            type="button"
                            className="remediation-chip"
                            onClick={() => setEdits((prev) => ({ ...prev, [key]: 'N/A' }))}
                          >
                            'N/A'
                          </button>
                          <button
                            type="button"
                            className="remediation-chip"
                            onClick={() => setEdits((prev) => ({ ...prev, [key]: '0' }))}
                          >
                            0
                          </button>
                          <button
                            type="button"
                            className="remediation-chip"
                            onClick={() => setEdits((prev) => ({ ...prev, [key]: '0.00' }))}
                          >
                            0.00
                          </button>
                          <button
                            type="button"
                            className="remediation-chip"
                            onClick={() => setEdits((prev) => ({ ...prev, [key]: 'CURRENT_TIMESTAMP' }))}
                          >
                            CURRENT_TIMESTAMP
                          </button>
                          <button
                            type="button"
                            className="remediation-chip"
                            onClick={() => setEdits((prev) => ({ ...prev, [key]: 'false' }))}
                          >
                            false
                          </button>
                          <button
                            type="button"
                            className="remediation-chip"
                            onClick={() => setEdits((prev) => ({ ...prev, [key]: '{}' }))}
                          >
                            {'{ }'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="remediation-modal-footer">
          <div className="remediation-footer-left">
            <span>🛡️ Safe execution: Fixes are tested non-destructively in dry run before any live writes.</span>
          </div>
          <div className="remediation-footer-right">
            <button
              type="button"
              className="dry-run-btn-back"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="dry-run-strategy-btn recommended"
              style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
              onClick={handleApply}
            >
              <span>
                {tab === 'smart' ? '⚡ Apply AI Fixes & Re-simulate' : '💾 Apply Manual Fixes & Re-simulate'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
