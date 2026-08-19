'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  WindowsIcon,
  BenchmarkChartIcon,
  AuditReportIcon,
  UndoRollbackIcon,
  CheckCircleIcon
} from '../../components/Icons';
import styles from './page.module.css';

export const dynamic = 'force-static';

export default function HowItWorksPage() {
  const [activeWorkflow, setActiveWorkflow] = useState<'migration' | 'schemaUpdate'>('migration');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [activeParadigmTab, setActiveParadigmTab] = useState<'array' | 'polymorphic' | 'reverse'>('array');

  const migrationSteps = [
    {
      num: '01',
      title: 'Direction',
      badge: 'Bidirectional',
      heading: 'Choose Migration Direction',
      desc: 'Select MongoDB ➔ PostgreSQL (3NF Normalization) or PostgreSQL ➔ MongoDB (Denormalization).',
      uiType: 'direction',
      tags: ['NoSQL ➔ SQL', 'SQL ➔ NoSQL']
    },
    {
      num: '02',
      title: 'Source & Health',
      badge: '0–100 Score',
      heading: 'Connect Source & AI Health Audit',
      desc: 'Connects to MongoDB, samples documents, and computes an instant 0–100 Schema Health Score.',
      uiType: 'health',
      tags: ['BSON Sampler', 'Health Scoring']
    },
    {
      num: '03',
      title: 'Target Validation',
      badge: 'Clean State',
      heading: 'Connect Target & Enforce Safety',
      desc: 'Enforces blank target rules and SSL encryption on Supabase, Neon, AWS RDS, or Local Postgres.',
      uiType: 'target',
      tags: ['SSL Handshake', 'Pooler Ready']
    },
    {
      num: '04',
      title: 'AI Schema Mapping',
      badge: '3NF + JSONB',
      heading: 'AI Schema Mapping & Normalization',
      desc: 'Translates embedded arrays to child foreign key tables and polymorphic specs to indexed JSONB.',
      uiType: 'mapping',
      tags: ['3NF Normalization', 'JSONB GIN']
    },
    {
      num: '05',
      title: 'Risk & Linting',
      badge: 'Static Audit',
      heading: 'Pre-Migration Risk & Linting Audit',
      desc: 'Audits column coercions, string-to-number hazards, and foreign key dependency order.',
      uiType: 'risk',
      tags: ['Type Coercion', 'Lock Linter']
    },
    {
      num: '06',
      title: 'Dry Run',
      badge: 'Simulation',
      heading: 'Transactional Dry Run Simulation',
      desc: 'Executes DDL and samples inside an isolated transaction with zero permanent writes.',
      uiType: 'dryrun',
      tags: ['ACID Transaction', 'Simulation']
    },
    {
      num: '07',
      title: 'Live ETL Stream',
      badge: '20,000+ Rows/s',
      heading: 'Live Streaming ETL & Chunk Error Isolation',
      desc: 'Streams 500-record batches. If 1 document fails, it isolates the bad row and inserts 499 rows.',
      uiType: 'etl',
      tags: ['Batch Streaming', 'Chunk Isolation']
    },
    {
      num: '08',
      title: 'Audit & Deliverables',
      badge: 'Verification',
      heading: 'Executive Verification & Deliverables',
      desc: 'Runs 1,000-query live benchmarks and downloads PDF audit reports, rollback .sql, and Prisma kits.',
      uiType: 'verification',
      tags: ['1,000-Query Benchmark', 'PDF Report']
    }
  ];

  const schemaUpdateSteps = [
    {
      num: '01',
      title: 'Connect Target',
      badge: 'SSL Direct',
      heading: 'Connect Live Database',
      desc: 'Connect to live PostgreSQL staging or production with SSL encryption.',
      uiType: 'update_connect',
      tags: ['Supabase', 'Neon', 'AWS RDS']
    },
    {
      num: '02',
      title: 'Introspect',
      badge: 'AST Parser',
      heading: 'Introspect Schema & Graph',
      desc: 'Explores existing tables, columns, row counts, and foreign key dependency links.',
      uiType: 'update_introspect',
      tags: ['Table Graph', 'Constraint Map']
    },
    {
      num: '03',
      title: 'Describe Change',
      badge: 'NL2DDL',
      heading: 'Describe Change (Form or AI Plain English)',
      desc: 'Type change in plain English (e.g. "Add optional phone column to users") or use form controls.',
      uiType: 'update_nl2ddl',
      tags: ['Natural Language', 'Zero Downtime']
    },
    {
      num: '04',
      title: 'Lock Risk Linter',
      badge: 'Lock Safety',
      heading: 'Pre-Execution Lock & Risk Linter',
      desc: 'Audits DDL for exclusive table locks and downtime hazards.',
      uiType: 'update_risk',
      tags: ['Table Lock Check', 'Zero Outage']
    },
    {
      num: '05',
      title: 'Review DDL',
      badge: '5s Timeout',
      heading: 'Review Generated DDL & Rollback Scripts',
      desc: 'Wraps SQL in SET lock_timeout = \'5s\', uses CONCURRENT indexes, and generates rollback script.',
      uiType: 'update_preview',
      tags: ['SET lock_timeout', 'CONCURRENTLY']
    },
    {
      num: '06',
      title: 'Apply & Version',
      badge: 'Audit Trail',
      heading: 'Atomic Execution & Version History',
      desc: 'Executes inside transaction and saves audit diff in local schema version history.',
      uiType: 'update_history',
      tags: ['Atomic Commit', 'Local Versioning']
    }
  ];

  const currentSteps = activeWorkflow === 'migration' ? migrationSteps : schemaUpdateSteps;
  const current = currentSteps[activeStep] || currentSteps[0];

  const paradigmExamples = {
    array: {
      title: 'Parent-Child Array Normalization',
      badge: 'Document Array ➔ Relational Foreign Keys',
      sourceCode: `// MongoDB Source (orders collection)
{
  "_id": ObjectId("665a1b2c4e3f..."),
  "orderNumber": "ORD-2026-9812",
  "totalAmount": 249.99,
  "items": [
    { "productId": ObjectId("..."), "name": "Keychron Q1", "price": 199.99, "qty": 1 },
    { "productId": ObjectId("..."), "name": "Desk Mat", "price": 50.00, "qty": 1 }
  ]
}`,
      targetCode: `-- PostgreSQL Target (Generated 3NF Relational Tables)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL
);

-- Child Table with Foreign Key
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL
);`
    },
    polymorphic: {
      title: 'Polymorphic Specifications ➔ Typed JSONB',
      badge: 'Unstructured Specs ➔ Indexed JSONB Column',
      sourceCode: `// MongoDB Source (products collection)
{
  "_id": ObjectId("665a0df8c91a..."),
  "name": "Sony WH-1000XM5",
  "specs": {
    "noiseCanceling": true,
    "batteryLife": "30h",
    "codecs": ["LDAC", "AAC", "SBC"]
  }
}`,
      targetCode: `-- PostgreSQL Target (Relational Table + GIN JSONB Index)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Fast GIN index for high-speed specification search
CREATE INDEX idx_products_specs ON products USING GIN(specs);`
    },
    reverse: {
      title: 'PostgreSQL ➔ MongoDB Denormalization',
      badge: 'Relational JOINs ➔ Embedded Document Arrays',
      sourceCode: `-- PostgreSQL Source (orders JOIN order_items)
SELECT o.id, o.order_number, o.total_amount,
       json_agg(json_build_object(
         'productId', oi.product_id,
         'productName', oi.product_name,
         'price', oi.price,
         'quantity', oi.quantity
       )) AS items
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.order_number, o.total_amount;`,
      targetCode: `// MongoDB Target (Auto-Embedded Collection)
{
  "_id": ObjectId("665a1b2c4e3f..."),
  "orderNumber": "ORD-2026-9812",
  "totalAmount": 249.99,
  "items": [
    { "productId": ObjectId("..."), "productName": "Keychron Q1", "price": 199.99, "quantity": 1 }
  ]
}`
    }
  };

  const activeParadigm = paradigmExamples[activeParadigmTab];

  return (
    <div className={styles.page}>
      {/* ================= PAGE HERO HEADER ================= */}
      <section className={styles.headerSection}>
        <div className="container">
          <div className={styles.headerContent}>
            <span className="badge badge-brand">Architecture & Process Guide</span>
            <h1 className={styles.pageTitle}>How MigrateIQ Works</h1>
            <p className={styles.pageSubtitle}>
              MigrateIQ combines two essential developer tools into a single local desktop platform.
              Select a workflow below to explore its step-by-step architecture.
            </p>

            {/* High-Impact Workflow Selector Section */}
            <div className={styles.workflowSelectorWrapper}>
              <div className={styles.workflowSelectorLabel}>
                <span>Select Desktop Workflow:</span>
              </div>

              <div className={styles.workflowGrid}>
                {/* Workflow A & B Card */}
                <button
                  className={`${styles.workflowCard} ${activeWorkflow === 'migration' ? styles.workflowCardActive : ''}`}
                  onClick={() => {
                    setActiveWorkflow('migration');
                    setActiveStep(0);
                  }}
                >
                  <div className={styles.wfCardTop}>
                    <span className={styles.wfPill}>Workflow A & B</span>
                    <span className={styles.stepCountBadge}>8 Steps</span>
                  </div>
                  <div className={styles.wfCardBody}>
                    <h3 className={styles.wfTitle}>Full Database Migration</h3>
                    <p className={styles.wfDesc}>Bidirectional transfer: MongoDB ⇄ PostgreSQL with 3NF normalization & JSONB indexing.</p>
                  </div>
                  <div className={styles.wfFooter}>
                    <span className={styles.activeIndicator}>
                      {activeWorkflow === 'migration' ? '✓ Currently Viewing' : 'Click to Inspect →'}
                    </span>
                  </div>
                </button>

                {/* Workflow C Card */}
                <button
                  className={`${styles.workflowCard} ${activeWorkflow === 'schemaUpdate' ? styles.workflowCardActive : ''}`}
                  onClick={() => {
                    setActiveWorkflow('schemaUpdate');
                    setActiveStep(0);
                  }}
                >
                  <div className={styles.wfCardTop}>
                    <span className={styles.wfPillAi}>Workflow C</span>
                    <span className={styles.stepCountBadge}>6 Steps</span>
                  </div>
                  <div className={styles.wfCardBody}>
                    <h3 className={styles.wfTitle}>AI Schema Update Assistant</h3>
                    <p className={styles.wfDesc}>Zero-downtime alterations: plain English NL2DDL wrapped in 5s lock timeouts.</p>
                  </div>
                  <div className={styles.wfFooter}>
                    <span className={styles.activeIndicator}>
                      {activeWorkflow === 'schemaUpdate' ? '✓ Currently Viewing' : 'Click to Inspect →'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= COMPACT SINGLE-VIEW EXPLORER ================= */}
      <section className={styles.explorerSection}>
        <div className="container">
          <div className={styles.studioContainer}>
            {/* Top Horizontal Step Track */}
            <div className={styles.topStepTrack}>
              {currentSteps.map((step, idx) => {
                const isActive = activeStep === idx;
                const isDone = activeStep > idx;
                return (
                  <button
                    key={idx}
                    className={`${styles.stepTrackBtn} ${isActive ? styles.stepTrackBtnActive : ''} ${isDone ? styles.stepTrackBtnDone : ''}`}
                    onClick={() => setActiveStep(idx)}
                  >
                    <span className={styles.stepTrackNum}>
                      {isDone ? '✓' : step.num}
                    </span>
                    <div className={styles.stepTrackText}>
                      <span className={styles.stepTrackTitle}>{step.title}</span>
                      <span className={styles.stepTrackBadge}>{step.badge}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Interactive Inspector Body */}
            <div className={styles.studioBody}>
              {/* Top Sub-Header inside Studio */}
              <div className={styles.studioInspectorHeader}>
                <div className={styles.studioTitleCol}>
                  <div className={styles.stepPill}>
                    <span>Step {current.num}</span>
                    <span className={styles.dotDivider}>•</span>
                    <span>{current.badge}</span>
                  </div>
                  <h2 className={styles.studioMainHeading}>{current.heading}</h2>
                  <p className={styles.studioDescText}>{current.desc}</p>
                </div>

                <div className={styles.tagsRow}>
                  {current.tags.map((t, tIdx) => (
                    <span key={tIdx} className={styles.techTag}>#{t}</span>
                  ))}
                </div>
              </div>

              {/* Simulation Box */}
              <div className={styles.stepVisualBox}>
                <div className={styles.visualBoxHeader}>
                  <div className={styles.visualHeaderDots}>
                    <span className={styles.vDot}></span>
                    <span className={styles.vDot}></span>
                    <span className={styles.vDot}></span>
                  </div>
                  <span className={styles.visualHeaderTitle}>MigrateIQ Desktop Engine — Live Step {current.num} Simulation</span>
                  <span className={styles.visualLiveBadge}>LIVE SIMULATOR</span>
                </div>

                <div className={styles.visualBoxBody}>
                  {/* Step 1 UI */}
                  {current.uiType === 'direction' && (
                    <div className={styles.simDirectionGrid}>
                      <div className={`${styles.simDirectionCard} ${styles.simDirectionCardActive}`}>
                        <div className={styles.simDirTop}>
                          <span className={styles.simDirIcon}>🍃 ➔ 🐘</span>
                          <span className={styles.simDirActiveTag}>✓ Active Mode</span>
                        </div>
                        <h4>MongoDB ➔ PostgreSQL</h4>
                        <p>3NF Normalization · Arrays to Foreign Keys · Indexed JSONB</p>
                      </div>
                      <div className={styles.simDirectionCard}>
                        <div className={styles.simDirTop}>
                          <span className={styles.simDirIcon}>🐘 ➔ 🍃</span>
                          <span className={styles.simDirSelectBtn}>Switch</span>
                        </div>
                        <h4>PostgreSQL ➔ MongoDB</h4>
                        <p>Denormalization · SQL JOINs to Embedded Document Arrays</p>
                      </div>
                    </div>
                  )}

                  {/* Step 2 UI */}
                  {current.uiType === 'health' && (
                    <div className={styles.simHealthBox}>
                      <div className={styles.healthDialRow}>
                        <div className={styles.healthScoreCard}>
                          <span className={styles.healthScoreBig}>94</span>
                          <span className={styles.healthScoreMax}>/ 100</span>
                          <span className={styles.healthStatusGood}>Clean & Ready</span>
                        </div>
                        <div className={styles.healthBreakdown}>
                          <div className={styles.healthItem}>
                            <CheckCircleIcon size={15} color="#10B981" />
                            <span>20,750 documents sampled across 7 collections</span>
                          </div>
                          <div className={styles.healthItem}>
                            <CheckCircleIcon size={15} color="#10B981" />
                            <span>No circular foreign key deadlocks detected</span>
                          </div>
                          <div className={styles.healthItemWarn}>
                            <span className={styles.warnIcon}>⚠️</span>
                            <span>45 string prices auto-coerced to NUMERIC(10,2)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3 UI */}
                  {current.uiType === 'target' && (
                    <div className={styles.simTargetBox}>
                      <div className={styles.targetField}>
                        <span className={styles.targetFieldLabel}>Target Database:</span>
                        <span className={styles.targetFieldValue}>PostgreSQL (Supabase Cloud / Port 5432)</span>
                      </div>
                      <div className={styles.targetField}>
                        <span className={styles.targetFieldLabel}>Database State:</span>
                        <span className={styles.targetFieldClean}>✓ 100% Clean Target (0 Pre-existing Tables)</span>
                      </div>
                      <div className={styles.targetField}>
                        <span className={styles.targetFieldLabel}>Encryption:</span>
                        <span className={styles.targetFieldValue}>TLS 1.3 Active (SSL Required)</span>
                      </div>
                    </div>
                  )}

                  {/* Step 4 UI */}
                  {current.uiType === 'mapping' && (
                    <div className={styles.simMappingBox}>
                      <div className={styles.mappingRow}>
                        <span className={styles.sourceTag}>orders.items (Array)</span>
                        <span className={styles.mapArrow}>➔</span>
                        <span className={styles.targetTag}>CREATE TABLE order_items (FK ➔ orders.id CASCADE)</span>
                      </div>
                      <div className={styles.mappingRow}>
                        <span className={styles.sourceTag}>products.specs (Dynamic)</span>
                        <span className={styles.mapArrow}>➔</span>
                        <span className={styles.targetTag}>products.specs (JSONB + GIN Index)</span>
                      </div>
                    </div>
                  )}

                  {/* Step 5 UI */}
                  {current.uiType === 'risk' && (
                    <div className={styles.simRiskBox}>
                      <div className={styles.riskCardWarn}>
                        <div className={styles.riskCardHeader}>
                          <span className={styles.riskBadgeWarn}>WARNING AUTO-RESOLVED</span>
                          <span>Field: products.price (Type Inconsistency)</span>
                        </div>
                        <p>45 documents contain string prices (&quot;29.99&quot;). Coerced to NUMERIC(10,2) with 0 data loss.</p>
                      </div>
                      <div className={styles.riskCardInfo}>
                        <div className={styles.riskCardHeader}>
                          <span className={styles.riskBadgeInfo}>LOCK PREVENTED</span>
                          <span>Kahn&apos;s DAG Sorter</span>
                        </div>
                        <p>Execution order: categories ➔ users ➔ products ➔ orders ➔ order_items.</p>
                      </div>
                    </div>
                  )}

                  {/* Step 6 UI */}
                  {current.uiType === 'dryrun' && (
                    <div className={styles.simTerminalBox}>
                      <p className={styles.termLine}><span className={styles.termKeyword}>BEGIN;</span> -- Isolated dry-run transaction</p>
                      <p className={styles.termLine}><span className={styles.termSuccess}>✓ CREATE TABLE users, orders, order_items</span> (DDL validated)</p>
                      <p className={styles.termLine}><span className={styles.termSuccess}>✓ Inserted 500 sample rows</span> (0 constraint errors)</p>
                      <p className={styles.termLine}><span className={styles.termKeyword}>ROLLBACK;</span> -- 0 permanent writes</p>
                      <p className={styles.termHighlight}>🎉 Dry Run Simulation PASSED · Ready for real migration</p>
                    </div>
                  )}

                  {/* Step 7 UI */}
                  {current.uiType === 'etl' && (
                    <div className={styles.simEtlBox}>
                      <div className={styles.etlProgressHeader}>
                        <span>Streaming in Dependency Order</span>
                        <span className={styles.etlSpeed}>21,450 rows / sec</span>
                      </div>
                      <div className={styles.etlTrack}>
                        <div className={styles.etlFill} style={{ width: '78%' }}></div>
                      </div>
                      <div className={styles.etlStatsRow}>
                        <span>Progress: 16,185 / 20,750 rows (78%)</span>
                        <span>ETA: ~0.2s</span>
                      </div>
                    </div>
                  )}

                  {/* Step 8 UI */}
                  {current.uiType === 'verification' && (
                    <div className={styles.simDeliverablesGrid}>
                      <div className={styles.deliverableCard}>
                        <AuditReportIcon size={20} color="#0284C7" />
                        <div className={styles.delivText}>
                          <h5>Executive Audit Report</h5>
                          <span>PDF & HTML Certificate</span>
                        </div>
                      </div>
                      <div className={styles.deliverableCard}>
                        <BenchmarkChartIcon size={20} color="#10B981" />
                        <div className={styles.delivText}>
                          <h5>1,000-Query Benchmark</h5>
                          <span>2.9x Speedup Chart</span>
                        </div>
                      </div>
                      <div className={styles.deliverableCard}>
                        <UndoRollbackIcon size={20} color="#2563EB" />
                        <div className={styles.delivText}>
                          <h5>Rollback Script</h5>
                          <span>Reversible .sql</span>
                        </div>
                      </div>
                      <div className={styles.deliverableCard}>
                        <CheckCircleIcon size={20} color="#10B981" />
                        <div className={styles.delivText}>
                          <h5>Refactoring Kit</h5>
                          <span>schema.prisma</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Workflow C Step UIs */}
                  {current.uiType?.startsWith('update_') && (
                    <div className={styles.simTerminalBox}>
                      <p className={styles.termLine}><span className={styles.termKeyword}>SET lock_timeout = &apos;5s&apos;;</span></p>
                      <p className={styles.termLine}><span className={styles.termKeyword}>BEGIN;</span></p>
                      <p className={styles.termLine}><span className={styles.termSuccess}>ALTER TABLE users ADD COLUMN phone VARCHAR(15) NULL;</span></p>
                      <p className={styles.termLine}><span className={styles.termSuccess}>CREATE INDEX CONCURRENTLY idx_users_phone ON users(phone);</span></p>
                      <p className={styles.termLine}><span className={styles.termKeyword}>COMMIT;</span></p>
                      <p className={styles.termHighlight}>✓ Zero-Downtime Alteration Applied & Recorded in Schema Version History</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Navigation Footer inside Studio */}
              <div className={styles.studioFooter}>
                <button
                  className="btn-secondary"
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  ← Previous Step
                </button>
                <div className={styles.stepProgressDots}>
                  {currentSteps.map((_, dotIdx) => (
                    <span
                      key={dotIdx}
                      className={`${styles.pDot} ${dotIdx === activeStep ? styles.pDotActive : ''}`}
                      onClick={() => setActiveStep(dotIdx)}
                    />
                  ))}
                </div>
                <button
                  className="btn-primary"
                  disabled={activeStep === currentSteps.length - 1}
                  onClick={() => setActiveStep(Math.min(currentSteps.length - 1, activeStep + 1))}
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  Next Step ({activeStep + 2 <= currentSteps.length ? `Step 0${activeStep + 2}` : 'Complete'}) →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PARADIGM SHIFT VISUALIZER ================= */}
      <section className={styles.paradigmSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-brand">Data Modeling Foundations</span>
            <h2 className={styles.sectionTitle}>Document vs. Relational Paradigm Shift</h2>
            <p className={styles.sectionSubtitle}>
              How MigrateIQ resolves structural incompatibilities between MongoDB hierarchical BSON
              and PostgreSQL normalized relational tables.
            </p>

            <div className={styles.paradigmTabs}>
              <button
                className={`${styles.pTabBtn} ${activeParadigmTab === 'array' ? styles.pTabBtnActive : ''}`}
                onClick={() => setActiveParadigmTab('array')}
              >
                1. Array Normalization
              </button>
              <button
                className={`${styles.pTabBtn} ${activeParadigmTab === 'polymorphic' ? styles.pTabBtnActive : ''}`}
                onClick={() => setActiveParadigmTab('polymorphic')}
              >
                2. Polymorphic JSONB
              </button>
              <button
                className={`${styles.pTabBtn} ${activeParadigmTab === 'reverse' ? styles.pTabBtnActive : ''}`}
                onClick={() => setActiveParadigmTab('reverse')}
              >
                3. Reverse Denormalization
              </button>
            </div>
          </div>

          <div className={styles.paradigmCard}>
            <div className={styles.paradigmCardHeader}>
              <h3 className={styles.paradigmTitle}>{activeParadigm.title}</h3>
              <span className="badge badge-ai">✨ {activeParadigm.badge}</span>
            </div>

            <div className={styles.paradigmCodeGrid}>
              <div className={styles.paradigmCodeCol}>
                <div className={styles.codeColTop}>
                  <span>Source Format</span>
                  <span className={styles.codeColFormat}>Input Document</span>
                </div>
                <pre className={styles.codeBlock}>
                  <code>{activeParadigm.sourceCode}</code>
                </pre>
              </div>

              <div className={styles.paradigmCodeCol}>
                <div className={styles.codeColTop}>
                  <span>Target Format</span>
                  <span className={styles.codeColFormat}>Output DDL / JSON</span>
                </div>
                <pre className={styles.codeBlock}>
                  <code>{activeParadigm.targetCode}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL DOWNLOAD CTA ================= */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            <div className={styles.ctaCardContent}>
              <h2 className={styles.ctaTitle}>Ready to Run Your First Migration?</h2>
              <p className={styles.ctaSubtitle}>
                Download the desktop application for Windows. Free, open-source, and includes offline Demo Mode.
              </p>
              <div className={styles.ctaButtonRow}>
                <Link href="/download" className="btn-primary" style={{ padding: '14px 32px', fontSize: '1.025rem' }}>
                  <WindowsIcon size={20} color="#FFFFFF" />
                  Download for Windows (.exe)
                </Link>
                <Link href="/features" className="btn-secondary" style={{ padding: '14px 28px', fontSize: '0.95rem' }}>
                  Explore All 12 Features →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
