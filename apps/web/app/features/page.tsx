'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  WindowsIcon,
  AiSparkleIcon,
  ShieldAlertIcon,
  DryRunIcon,
  StreamEtlIcon,
  BenchmarkChartIcon,
  VersionHistoryIcon,
  LockDowntimeIcon,
  SchemaMismatchIcon,
  UndoRollbackIcon,
  CheckCircleIcon
} from '../../components/Icons';
import styles from './page.module.css';

export const dynamic = 'force-static';

export default function FeaturesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All 12 Features' },
    { id: 'ai', label: 'AI Intelligence' },
    { id: 'safety', label: 'Safety & Guardrails' },
    { id: 'etl', label: 'ETL & Performance' },
    { id: 'tooling', label: 'Reporting & Tooling' },
  ];

  const features = [
    {
      id: 1,
      category: 'ai',
      categoryLabel: 'AI Intelligence',
      title: 'Bidirectional AI Schema Mapping',
      icon: <AiSparkleIcon size={24} color="#0284C7" />,
      desc: 'When you connect your MongoDB database, the app samples your collections and feeds polymorphic structures to our schema engine. The AI translates nested document arrays into 3NF normalized tables with foreign keys and maps dynamic fields to indexed JSONB columns.',
      previewType: 'mapping',
      previewCode: `orders.items[] (Array) ➔ CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE
);`,
      whyItMatters: [
        'Eliminates days of writing manual DDL mapping scripts',
        'Understands domain entities and business logic, not just primitive types',
        'Fully bidirectional: also denormalizes relational SQL into MongoDB BSON'
      ]
    },
    {
      id: 2,
      category: 'safety',
      categoryLabel: 'Safety & Guardrails',
      title: 'Pre-Migration Risk & Health Linter',
      icon: <ShieldAlertIcon size={24} color="#EF4444" />,
      desc: 'Before a single row is written, the static rule engine scans your source schema and sampled records. It categorizes hazards as Critical (will cause failure), Warning (type coercions), or Info (performance insights), proposing automated remediations for each.',
      previewType: 'risk',
      previewCode: `🔴 CRITICAL: NOT NULL column proposed without default on populated table
🟡 WARNING: 45 documents contain string prices ("29.99") ➔ Coerced to NUMERIC(10,2)
🟢 INFO: Kahn's DAG sort eliminated 3 circular foreign key deadlocks`,
      whyItMatters: [
        'Catches data type mismatches before they crash the ETL pipeline',
        'Guarantees zero silent truncation or data loss during conversion',
        'Gives developers full manual override controls for every single column'
      ]
    },
    {
      id: 3,
      category: 'safety',
      categoryLabel: 'Safety & Guardrails',
      title: 'Transactional Dry Run Simulation',
      icon: <DryRunIcon size={24} color="#7C3AED" />,
      desc: 'Simulate the entire migration in an isolated database transaction without writing a single permanent row. The engine executes all DDL and loads a 500-record batch to verify constraints, foreign keys, and indexes before issuing an automatic ROLLBACK.',
      previewType: 'dryrun',
      previewCode: `BEGIN; -- Isolated Transaction
CREATE TABLE users (...); CREATE TABLE orders (...);
Inserted 500 sample rows ➔ All constraints validated!
ROLLBACK; -- 0 permanent modifications written`,
      whyItMatters: [
        'Eliminates anxiety before modifying production or staging databases',
        'Validates unique keys, foreign keys, and check constraints under real SQL conditions',
        'Generates an exact execution forecast before live writes'
      ]
    },
    {
      id: 4,
      category: 'safety',
      categoryLabel: 'Safety & Guardrails',
      title: 'Auto-Generated Reversible Rollback Scripts',
      icon: <UndoRollbackIcon size={24} color="#2563EB" />,
      desc: 'Every schema migration and update automatically generates a fully verified rollback SQL script. If an unexpected issue arises post-migration, running this script cleanly drops foreign keys and tables in exact reverse topological order.',
      previewType: 'rollback',
      previewCode: `-- Reversible Rollback Script (Reverse DAG Order)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;`,
      whyItMatters: [
        'Guaranteed deterministic escape hatch for every migration',
        'Prevents orphaned foreign key tables or broken production states',
        'Saved locally in your project audit history forever'
      ]
    },
    {
      id: 5,
      category: 'etl',
      categoryLabel: 'ETL & Performance',
      title: 'Live Streaming ETL with Chunk Error Isolation',
      icon: <StreamEtlIcon size={24} color="#2563EB" />,
      desc: 'High-throughput streaming ETL processing data in 500-record chunks. If a single dirty document fails type validation mid-stream, MigrateIQ isolates the bad record to an error report and saves the remaining 499 rows without crashing the migration.',
      previewType: 'etl',
      previewCode: `Streaming: 20,750 records in topological order (21,450 rows/sec)
Batch #3: 1 invalid phone string detected ➔ Isolated to error log
Inserted: 499 / 500 rows successfully in current chunk`,
      whyItMatters: [
        'Prevents 1 corrupt legacy document from aborting a 100,000-row migration',
        'High streaming throughput exceeding 20,000 rows per second',
        'Exports bad rows to a downloadable JSON file for easy manual inspection'
      ]
    },
    {
      id: 6,
      category: 'tooling',
      categoryLabel: 'Reporting & Tooling',
      title: '100% Local Execution (Zero Cloud DB)',
      icon: <LockDowntimeIcon size={24} color="#059669" />,
      desc: 'MigrateIQ is a standalone desktop application. Your database credentials, connection strings, and production records never leave your local machine. No cloud intermediaries, no data retention, and zero external tracking.',
      previewType: 'local',
      previewCode: `Local Execution: C:\\Users\\...\\AppData\\Roaming\\MigrateIQ
Network Activity: Local Direct Connection Only (mongodb://, postgresql://)
Cloud DB Transfer: 0 KB (Zero Third-Party Proxies)`,
      whyItMatters: [
        'Compliant with strict SOC-2, HIPAA, and GDPR data privacy standards',
        'Zero risk of leaked production connection credentials',
        'Runs completely offline in air-gapped corporate environments'
      ]
    },
    {
      id: 7,
      category: 'tooling',
      categoryLabel: 'Reporting & Tooling',
      title: 'Interactive ERD Diagram Generator & Export',
      icon: <SchemaMismatchIcon size={24} color="#0284C7" />,
      desc: 'Instantly renders a visual Entity Relationship Diagram (ERD) of your target schema. Inspect tables, column types, primary keys, and interactive foreign key connection lines, and export high-resolution PNG images for team documentation.',
      previewType: 'erd',
      previewCode: `[users] ──(1:N)──< [orders] ──(1:N)──< [order_items]
[products] ──────────(1:N)───────────< [order_items]
[categories] ────────(1:N)───────────< [products]`,
      whyItMatters: [
        'Helps engineering teams visualize the transformed schema at a glance',
        'Perfect for architectural reviews, pull requests, and final year thesis presentations',
        'Exports high-resolution diagrams in 1 click'
      ]
    },
    {
      id: 8,
      category: 'ai',
      categoryLabel: 'AI Intelligence',
      title: 'AI Schema Health Score (0–100)',
      icon: <AiSparkleIcon size={24} color="#10B981" />,
      desc: 'As soon as your source MongoDB database is introspected, MigrateIQ audits the schema and outputs an actionable 0–100 health score with categorized deductions for polymorphic fields, sparse properties, and missing query indexes.',
      previewType: 'health',
      previewCode: `AI Schema Health Score: 71 / 100
🔴 -15 pts: orders.items has polymorphic nested structure
🟡 -10 pts: users.phone has 3 inconsistent data types
🟡 -4 pts: products collection lacks search index`,
      whyItMatters: [
        'Provides an objective, quantified benchmark of database quality',
        'Reveals hidden technical debt in legacy NoSQL databases before moving to SQL',
        'Suggests 1-click automated remediations to boost score to 98/100'
      ]
    },
    {
      id: 9,
      category: 'etl',
      categoryLabel: 'ETL & Performance',
      title: 'Partial & Incremental Collection Filtering',
      icon: <CheckCircleIcon size={24} color="#2563EB" />,
      desc: 'Migrate exactly what you need. Select specific collections to include or exclude, and apply ISO date range filters (e.g. only orders created after Jan 1, 2026) for staging test environments and phased migrations.',
      previewType: 'partial',
      previewCode: `Selected Collections (4 of 7): users, products, orders, order_items
Excluded: audit_logs (10,000 docs), temp_sessions (4,500 docs)
Date Range Filter: createdAt >= '2026-01-01T00:00:00Z'`,
      whyItMatters: [
        'Avoids migrating gigabytes of obsolete historical logs to staging',
        'Enables rapid development iteration on small data subsets',
        'Reduces migration execution time by over 80% for testing'
      ]
    },
    {
      id: 10,
      category: 'tooling',
      categoryLabel: 'Reporting & Tooling',
      title: 'Local Schema Version History (Git for DB)',
      icon: <VersionHistoryIcon size={24} color="#F59E0B" />,
      desc: 'Every schema alteration made through Workflow C is recorded in a local timeline with timestamp, forward DDL, before/after diffs, and instant rollback script generation. Review past schema changes anytime.',
      previewType: 'history',
      previewCode: `v1.2.0 · Aug 19, 2026: ADD COLUMN users.phone VARCHAR(15)
v1.1.0 · Aug 18, 2026: CREATE INDEX idx_orders_user_id
v1.0.0 · Aug 17, 2026: Initial Migration from MongoDB`,
      whyItMatters: [
        'Maintains a complete local audit trail of all database evolution',
        'Allows rolling back specific past changes even weeks later',
        'Zero setup required — stored automatically on your local machine'
      ]
    },
    {
      id: 11,
      category: 'tooling',
      categoryLabel: 'Reporting & Tooling',
      title: 'Offline Demo Mode (Built-In 20,650 Doc Dataset)',
      icon: <CheckCircleIcon size={24} color="#10B981" />,
      desc: 'Don’t have live database instances ready? Click "Try with Demo Data" to load our pre-bundled 20,650 document e-commerce dataset. Test the entire 8-step migration and live benchmarking without installing MongoDB or PostgreSQL.',
      previewType: 'demo',
      previewCode: `Demo Dataset Loaded: ShopBridge E-Commerce DB
Collections: 7 · Documents: 20,650 · Embedded Arrays: 5,000
Ready to test full 8-step migration in under 60 seconds!`,
      whyItMatters: [
        'Perfect for project evaluators, professors, and team presentations',
        'Requires zero local database servers or credentials to try',
        'Demonstrates every advanced feature on realistic messy real-world data'
      ]
    },
    {
      id: 12,
      category: 'etl',
      categoryLabel: 'ETL & Performance',
      title: 'Real-Time Query Latency Benchmarking',
      icon: <BenchmarkChartIcon size={24} color="#10B981" />,
      desc: 'After migration, MigrateIQ executes 1,000 non-mutating parallel lookups against both databases to compare query performance and renders side-by-side latency bar charts proving PostgreSQL relational indexing speedups.',
      previewType: 'benchmark',
      previewCode: `MongoDB Average Latency: 18.4 ms (1,000 queries)
PostgreSQL Average Latency: 6.2 ms (1,000 queries)
⚡ Verified Performance Speedup: 2.9x Faster`,
      whyItMatters: [
        'Scientifically proves performance improvements with real data',
        'Provides empirical evidence for technical thesis reports and management reviews',
        'Identifies indexing bottlenecks before deploying applications'
      ]
    }
  ];

  const filteredFeatures = selectedCategory === 'all'
    ? features
    : features.filter(f => f.category === selectedCategory);

  const competitorComparison = [
    {
      feature: 'AI Schema Understanding (NoSQL ➔ SQL)',
      migrateiq: '✅ Full AI Normalization & JSONB',
      flyway: '❌ Manual SQL Only',
      prisma: '❌ Schema locked to Prisma',
      awsDms: '❌ Raw JSON string dumps'
    },
    {
      feature: 'Deterministic Pre-Migration Risk Linter',
      migrateiq: '✅ 0–100 Health Score + Linter',
      flyway: '❌ None',
      prisma: '❌ Basic CLI warnings',
      awsDms: '❌ None'
    },
    {
      feature: 'Transactional Dry Run Simulation',
      migrateiq: '✅ ACID Transaction Simulation',
      flyway: '❌ Paid Enterprise Only',
      prisma: '❌ None',
      awsDms: '❌ None'
    },
    {
      feature: 'Chunk-Level Error Isolation (500-row)',
      migrateiq: '✅ Row-by-Row Fault Isolation',
      flyway: '❌ Total Pipeline Crash',
      prisma: '❌ Batch Fails All Rows',
      awsDms: '⚠️ Complex Cloud DLQ'
    },
    {
      feature: 'Auto-Generated Rollback Scripts',
      migrateiq: '✅ 1-Click Reverse SQL (.sql)',
      flyway: '❌ Paid Pro Tier Only',
      prisma: '⚠️ Manual down migrations',
      awsDms: '❌ None'
    },
    {
      feature: '1,000-Query Latency Benchmarking',
      migrateiq: '✅ Built-In Visual Benchmarks',
      flyway: '❌ None',
      prisma: '❌ None',
      awsDms: '❌ None'
    },
    {
      feature: 'Zero-Downtime NL2DDL Updates',
      migrateiq: '✅ Plain English + 5s Timeouts',
      flyway: '❌ None',
      prisma: '❌ None',
      awsDms: '❌ None'
    },
    {
      feature: 'Pricing & Local Privacy',
      migrateiq: '✅ 100% Free & 100% Local',
      flyway: '💰 $3,500+/yr Enterprise',
      prisma: '⚠️ Cloud lock-in features',
      awsDms: '💰 Hourly Cloud Billing'
    }
  ];

  return (
    <div className={styles.page}>
      {/* ================= HERO HEADER ================= */}
      <section className={styles.headerSection}>
        <div className="container">
          <div className={styles.headerContent}>
            <span className="badge badge-brand">Comprehensive Capabilities</span>
            <h1 className={styles.pageTitle}>Engineered for Zero Data Loss</h1>
            <p className={styles.pageSubtitle}>
              Every single feature in MigrateIQ was designed to solve a specific pain point that software
              engineers experience during production database migrations.
            </p>

            {/* Category Filter Pills */}
            <div className={styles.filterTrack}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`${styles.filterBtn} ${selectedCategory === cat.id ? styles.filterBtnActive : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= 12 FEATURES DEEP DIVE GRID ================= */}
      <section className={styles.featuresSection}>
        <div className="container">
          <div className={styles.featuresGrid}>
            {filteredFeatures.map((f) => (
              <div key={f.id} className={styles.featureCard}>
                <div className={styles.featureCardTop}>
                  <div className={styles.iconBadgeRow}>
                    <div className={styles.featureIcon}>{f.icon}</div>
                    <span className="badge badge-ai">{f.categoryLabel}</span>
                  </div>
                  <span className={styles.featureNum}>#{f.id.toString().padStart(2, '0')}</span>
                </div>

                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>

                {/* What You'll See Box */}
                <div className={styles.previewBox}>
                  <div className={styles.previewHeader}>
                    <span>Engine Output Preview</span>
                    <span className={styles.previewTag}>SIMULATION</span>
                  </div>
                  <pre className={styles.previewCode}>
                    <code>{f.previewCode}</code>
                  </pre>
                </div>

                {/* Why It Matters */}
                <div className={styles.whyMattersBox}>
                  <h4 className={styles.whyTitle}>Why It Matters:</h4>
                  <ul className={styles.whyList}>
                    {f.whyItMatters.map((item, idx) => (
                      <li key={idx}>
                        <CheckCircleIcon size={14} color="#10B981" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= COMPETITOR COMPARISON MATRIX ================= */}
      <section className={styles.comparisonSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-brand">Market Comparison</span>
            <h2 className={styles.sectionTitle}>Why Not Just Use Flyway, Prisma, or AWS DMS?</h2>
            <p className={styles.sectionSubtitle}>
              Traditional tools either require expert manual SQL scripting, lock you into specific ORM frameworks,
              or dump messy un-normalized JSON into columns. MigrateIQ combines AI intelligence with deterministic safety.
            </p>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.compTable}>
              <thead>
                <tr>
                  <th>Feature / Capability</th>
                  <th className={styles.highlightCol}>MigrateIQ</th>
                  <th>Flyway</th>
                  <th>Prisma Migrate</th>
                  <th>AWS DMS</th>
                </tr>
              </thead>
              <tbody>
                {competitorComparison.map((row, idx) => (
                  <tr key={idx}>
                    <td className={styles.featureNameCell}>
                      <strong>{row.feature}</strong>
                    </td>
                    <td className={styles.migrateiqCell}>{row.migrateiq}</td>
                    <td>{row.flyway}</td>
                    <td>{row.prisma}</td>
                    <td>{row.awsDms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================= FINAL DOWNLOAD CTA ================= */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            <div className={styles.ctaCardContent}>
              <h2 className={styles.ctaTitle}>Experience the Full Feature Suite</h2>
              <p className={styles.ctaSubtitle}>
                Download MigrateIQ for Windows. Test with sample data or run live migrations with 100% local safety.
              </p>
              <div className={styles.ctaButtonRow}>
                <Link href="/download" className="btn-primary" style={{ padding: '14px 32px', fontSize: '1.025rem' }}>
                  <WindowsIcon size={20} color="#FFFFFF" />
                  Download for Windows (.exe)
                </Link>
                <Link href="/about" className="btn-secondary" style={{ padding: '14px 28px', fontSize: '0.95rem' }}>
                  Learn About the Team →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
