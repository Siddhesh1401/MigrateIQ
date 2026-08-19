'use client';

import React from 'react';
import { CheckCircleIcon, BenchmarkChartIcon, LockDowntimeIcon } from './Icons';
import styles from './AuditReportModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditReportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Modal Window Top Controls */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <span className="badge badge-success">✓ Official Verification Certificate</span>
            <h3 className={styles.modalTitle}>Executive Database Migration Audit Report</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Certificate Paper Container */}
        <div className={styles.paperBody}>
          {/* Certificate Header Strip */}
          <div className={styles.certHeader}>
            <div className={styles.certBrandRow}>
              <div className={styles.certLogo}>
                <span className={styles.certLogoText}>Migrate<strong className={styles.certLogoAccent}>IQ</strong></span>
                <span className={styles.certDocType}>Executive Audit Certificate</span>
              </div>
              <div className={styles.certIdBadge}>
                <span>Audit ID: <strong>MIQ-2026-8891-CERT</strong></span>
                <span>Date: August 19, 2026 · 10:42:05 UTC</span>
              </div>
            </div>

            <div className={styles.certMetaGrid}>
              <div className={styles.metaBox}>
                <span className={styles.metaLabel}>Source Engine:</span>
                <span className={styles.metaValue}>🍃 MongoDB v7.0 (shopbridge_prod)</span>
              </div>
              <div className={styles.metaBox}>
                <span className={styles.metaLabel}>Target Engine:</span>
                <span className={styles.metaValue}>🐘 PostgreSQL v16 (supabase_prod)</span>
              </div>
              <div className={styles.metaBox}>
                <span className={styles.metaLabel}>Execution Duration:</span>
                <span className={styles.metaValue}>⚡ 1.42s (20,749 Rows)</span>
              </div>
              <div className={styles.metaBox}>
                <span className={styles.metaLabel}>Overall Integrity:</span>
                <span className={styles.metaValueSuccess}>100.00% Zero Data Loss</span>
              </div>
            </div>
          </div>

          {/* Section 1: Entity Reconciliation Table */}
          <div className={styles.sectionBlock}>
            <h4 className={styles.sectionHeading}>1. Entity & Row Count Reconciliation</h4>
            <div className={styles.tableWrapper}>
              <table className={styles.certTable}>
                <thead>
                  <tr>
                    <th>Source Collection</th>
                    <th>Target Relational Table</th>
                    <th>Source Rows</th>
                    <th>Migrated Rows</th>
                    <th>Integrity Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>users</code></td>
                    <td><code>users</code></td>
                    <td>2,000</td>
                    <td>2,000</td>
                    <td className={styles.cellSuccess}>✓ 100% Match</td>
                  </tr>
                  <tr>
                    <td><code>categories</code></td>
                    <td><code>categories</code></td>
                    <td>15</td>
                    <td>15</td>
                    <td className={styles.cellSuccess}>✓ 100% Match</td>
                  </tr>
                  <tr>
                    <td><code>products</code></td>
                    <td><code>products (JSONB)</code></td>
                    <td>500</td>
                    <td>500</td>
                    <td className={styles.cellSuccess}>✓ 100% Match</td>
                  </tr>
                  <tr>
                    <td><code>orders (embedded)</code></td>
                    <td><code>orders (Parent)</code></td>
                    <td>5,000</td>
                    <td>5,000</td>
                    <td className={styles.cellSuccess}>✓ 100% Match</td>
                  </tr>
                  <tr>
                    <td><code>orders.items[]</code></td>
                    <td><code>order_items (Child FK)</code></td>
                    <td>13,234</td>
                    <td>13,234</td>
                    <td className={styles.cellSuccess}>✓ 100% Extracted</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Mathematical Precision & Cryptographic Hashes */}
          <div className={styles.sectionBlock}>
            <h4 className={styles.sectionHeading}>2. Mathematical & Cryptographic Proofs</h4>
            <div className={styles.proofsGrid}>
              <div className={styles.proofCard}>
                <div className={styles.proofHeader}>
                  <CheckCircleIcon size={16} color="#10B981" />
                  <span className={styles.proofTitle}>Penny-Accurate Revenue Sum</span>
                </div>
                <div className={styles.proofValRow}>
                  <span>MongoDB: <code>$1,248,392.50</code></span>
                  <span>Postgres: <code>$1,248,392.50</code></span>
                </div>
                <span className={styles.proofSub}>Reconciled to 0.0000% variance.</span>
              </div>

              <div className={styles.proofCard}>
                <div className={styles.proofHeader}>
                  <LockDowntimeIcon size={16} color="#2563EB" />
                  <span className={styles.proofTitle}>MD5 Cryptographic Hash Spot-Check</span>
                </div>
                <div className={styles.proofValRow}>
                  <span>Sampled Records: <strong>500 / 500</strong></span>
                  <span className={styles.badgeHashMatch}>100% Hash Identity</span>
                </div>
                <span className={styles.proofSub}>0 bit-level field corruptions.</span>
              </div>

              <div className={styles.proofCard}>
                <div className={styles.proofHeader}>
                  <BenchmarkChartIcon size={16} color="#059669" />
                  <span className={styles.proofTitle}>Foreign Key Orphan Check</span>
                </div>
                <div className={styles.proofValRow}>
                  <span>Orphan Foreign Keys: <strong>0</strong></span>
                  <span className={styles.badgeFkValid}>DAG Topological Order</span>
                </div>
                <span className={styles.proofSub}>Referential integrity enforced.</span>
              </div>
            </div>
          </div>

          {/* Section 3: Performance Benchmark Proof */}
          <div className={styles.sectionBlock}>
            <h4 className={styles.sectionHeading}>3. Real-Time 1,000-Query Latency Benchmark</h4>
            <div className={styles.benchmarkSummary}>
              <div className={styles.benchRow}>
                <span>MongoDB Average Latency:</span>
                <span className={styles.benchTimeMongo}>18.4 ms</span>
              </div>
              <div className={styles.benchRow}>
                <span>PostgreSQL Target Latency:</span>
                <span className={styles.benchTimePg}>6.2 ms (⚡ 2.9x Faster)</span>
              </div>
            </div>
          </div>

          {/* Verification Stamp Footer */}
          <div className={styles.certFooter}>
            <div className={styles.certSeal}>
              <div className={styles.sealCircle}>
                <span>VERIFIED</span>
                <small>ZERO LOSS</small>
              </div>
              <div className={styles.sealText}>
                <h5>Audited by MigrateIQ Autonomous Engine</h5>
                <p>Mathematical reconciliation passed all 5 stages of integrity verification.</p>
              </div>
            </div>
            <div className={styles.certActions}>
              <button className="btn-secondary" onClick={onClose} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
