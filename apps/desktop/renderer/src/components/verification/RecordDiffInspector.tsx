import React, { useState } from 'react';
import type { RecordDiffResult, ChunkHashResult } from '@migrateiq/shared';

export interface RecordDiffInspectorProps {
  tables: string[];
  selectedTable: string;
  onSelectTable: (table: string) => void;
  recordDiff: RecordDiffResult | null;
  chunkHashes: ChunkHashResult | null;
  isLoading: boolean;
  onSearchId: (id: string) => void;
  onNextRecord: () => void;
  onPrevRecord: () => void;
  onRandomRecord: () => void;
  onFirstRecord: () => void;
  currentRecordIndex: number;
  totalRecords: number;
}

export const RecordDiffInspector: React.FC<RecordDiffInspectorProps> = ({
  tables,
  selectedTable,
  onSelectTable,
  recordDiff,
  chunkHashes,
  isLoading,
  onSearchId,
  onNextRecord,
  onPrevRecord,
  onRandomRecord,
  onFirstRecord,
  currentRecordIndex,
  totalRecords,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearchId(searchInput.trim());
    }
  };

  return (
    <div className="diff-inspector-container">
      {/* ── Toolbar: Table Selector, Live Search & Navigator ── */}
      <div className="diff-toolbar">
        <div className="diff-toolbar-left">
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>Table:</label>
          <select
            value={selectedTable}
            onChange={(e) => onSelectTable(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.875rem',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
            }}
          >
            {tables.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Live ID Search Bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <input
              type="text"
              placeholder="Enter _id (e.g. 654321...)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="diff-search-input"
            />
            <button
              type="submit"
              className="btn-verify-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8125rem' }}
            >
              🔍 Find
            </button>
          </form>
        </div>

        {/* Record Navigator Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600, marginRight: '0.25rem' }}>
            Record {currentRecordIndex} of {totalRecords || 1}
          </span>
          <button
            type="button"
            className="btn-verify-secondary"
            onClick={onFirstRecord}
            disabled={isLoading || currentRecordIndex <= 1}
            title="Jump to first record"
          >
            ⏮️ First
          </button>
          <button
            type="button"
            className="btn-verify-secondary"
            onClick={onPrevRecord}
            disabled={isLoading || currentRecordIndex <= 1}
            title="Previous record"
          >
            ◀️ Prev
          </button>
          <button
            type="button"
            className="btn-verify-secondary"
            onClick={onRandomRecord}
            disabled={isLoading}
            title="Sample random record"
          >
            🎲 Random
          </button>
          <button
            type="button"
            className="btn-verify-secondary"
            onClick={onNextRecord}
            disabled={isLoading || (totalRecords > 0 && currentRecordIndex >= totalRecords)}
            title="Next record"
          >
            Next ▶️
          </button>
        </div>
      </div>

      {/* ── Side-by-Side Split View ── */}
      {isLoading ? (
        <div className="v-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          <span style={{ fontSize: '2rem' }}>⚡</span>
          <p style={{ marginTop: '0.5rem', fontWeight: 600 }}>Fetching live document across port 27017 and 5432…</p>
        </div>
      ) : !recordDiff ? (
        <div className="v-card" style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
          No record selected. Use the search bar or navigator above to inspect records.
        </div>
      ) : (
        <>
          <div className="diff-split-view">
            {/* Left: Source MongoDB Document */}
            <div className="diff-panel">
              <div className="diff-panel-header">
                <span>🍃 Source: MongoDB Document ({selectedTable})</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#2563EB' }}>
                  _id: {recordDiff.recordId}
                </span>
              </div>
              <div className="diff-code-body">
                <pre style={{ margin: 0 }}>
                  {JSON.stringify(recordDiff.sourceDoc, null, 2)}
                </pre>
              </div>
            </div>

            {/* Right: Target PostgreSQL Relational Row */}
            <div className="diff-panel">
              <div className="diff-panel-header">
                <span>🐘 Target: PostgreSQL Row ({selectedTable})</span>
                <span className={recordDiff.isIdentical ? 'v-badge-success' : 'v-badge-danger'}>
                  {recordDiff.isIdentical ? '✓ 100% Identical' : '⚠ Discrepancy Found'}
                </span>
              </div>
              <div className="diff-code-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {recordDiff.fields.map((f) => (
                    <div
                      key={f.fieldName}
                      className={`diff-field-row ${
                        f.matchStatus === 'exact_match'
                          ? 'matched'
                          : f.matchStatus === 'type_coerced'
                          ? 'coerced'
                          : 'mismatch'
                      }`}
                    >
                      <div>
                        <strong>{f.targetColumnName}: </strong>
                        <span style={{ color: '#1E293B' }}>
                          {f.targetValue === null || f.targetValue === undefined
                            ? '<NULL>'
                            : typeof f.targetValue === 'object'
                            ? JSON.stringify(f.targetValue)
                            : String(f.targetValue)}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: '#64748B', marginLeft: '0.5rem' }}>
                          ({f.targetSqlType})
                        </span>
                      </div>

                      <div>
                        {f.matchStatus === 'exact_match' && (
                          <span style={{ color: '#15803D', fontWeight: 700, fontSize: '0.75rem' }}>✓ Match</span>
                        )}
                        {f.matchStatus === 'type_coerced' && (
                          <span style={{ color: '#2563EB', fontWeight: 700, fontSize: '0.75rem' }} title="Safely coerced data type (e.g. ISO string to TIMESTAMPTZ)">
                            ⚡ Coerced
                          </span>
                        )}
                        {f.matchStatus === 'mismatch' && (
                          <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.75rem' }}>⚠ Mismatch</span>
                        )}
                        {f.matchStatus === 'missing' && (
                          <span style={{ color: '#D97706', fontWeight: 700, fontSize: '0.75rem' }}>× Missing</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Chunk-Level SHA-256 Fingerprint Grid (The CockroachDB / Dynamo Pattern) ── */}
          {chunkHashes && (
            <div className="v-card" style={{ marginTop: '0.5rem' }}>
              <div className="v-card-header">
                <div>
                  <h3 className="v-card-title">
                    <span>🔐 1,000-Row Chunk Cryptographic Fingerprint Grid</span>
                    <span className="v-badge-success">
                      ✓ {chunkHashes.matchedChunks} / {chunkHashes.totalChunks} Chunks Verified (SHA-256)
                    </span>
                  </h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
                    Divided into 1,000-row micro-batches. Hashes are computed over canonical sorted JSON representations of source documents and target rows.
                  </p>
                </div>
              </div>

              <div className="chunk-grid">
                {chunkHashes.chunks.map((chk) => (
                  <div
                    key={chk.chunkIndex}
                    className={`chunk-tile ${chk.isMatch ? 'verified' : ''}`}
                    onClick={() => setSelectedChunk(chk.chunkIndex)}
                    title={`Click to inspect Chunk #${chk.chunkIndex}: ${chk.startId}..${chk.endId}`}
                  >
                    <span className="chunk-tile-title">
                      {chk.isMatch ? '✓ ' : '⚠ '}Chunk #{chk.chunkIndex}
                    </span>
                    <span className="chunk-tile-rows">{chk.rowCount.toLocaleString()} rows</span>
                    <span className="chunk-tile-hash">SHA: {chk.sourceSha256.substring(0, 8)}…</span>
                  </div>
                ))}
              </div>

              {selectedChunk !== null && (
                <div style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <strong>Chunk #{selectedChunk} Detail: </strong>
                    <span style={{ fontFamily: 'monospace', color: '#1E40AF' }}>
                      Hash: {chunkHashes.chunks.find((c) => c.chunkIndex === selectedChunk)?.sourceSha256}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedChunk(null)}
                    style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontWeight: 700 }}
                  >
                    × Close
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
