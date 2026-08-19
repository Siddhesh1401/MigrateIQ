'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StudioMockup } from '../components/StudioMockup';
import { ArchitectureFlow } from '../components/ArchitectureFlow';
import { DatabaseEcosystem } from '../components/DatabaseEcosystem';
import { AuditReportModal } from '../components/AuditReportModal';
import {
  WindowsIcon,
  AiSparkleIcon,
  ShieldAlertIcon,
  DryRunIcon,
  StreamEtlIcon,
  BenchmarkChartIcon,
  AuditReportIcon,
  VersionHistoryIcon,
  LockDowntimeIcon,
  SchemaMismatchIcon,
  UndoRollbackIcon,
  CheckCircleIcon
} from '../components/Icons';
import styles from './page.module.css';

export default function HomePage() {
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);

  const metrics = [
    { label: 'Data Integrity Parity', value: '100.00%', desc: 'Verified with penny-accurate decimal sums & MD5 checks' },
    { label: 'Migration Engine', value: 'Bidirectional', desc: 'MongoDB ⇄ PostgreSQL (Dual-direction schema mapping)' },
    { label: 'Schema Evolution', value: 'AI NL2DDL', desc: 'Plain English prompts to zero-downtime atomic SQL' },
    { label: 'Local-First Execution', value: 'Zero Cloud DB', desc: 'Credentials & data never leave your local machine' },
  ];

  const painPoints = [
    {
      icon: <LockDowntimeIcon size={26} color="#EF4444" />,
      title: 'One wrong ALTER TABLE locks your production database',
      desc: 'Executing unoptimized DDL statements acquires exclusive ACCESS EXCLUSIVE table locks, queuing incoming queries and causing total application outages.',
      solution: 'MigrateIQ automatically wraps changes in 5s lock timeouts and executes non-blocking CONCURRENT indexes.'
    },
    {
      icon: <SchemaMismatchIcon size={26} color="#F59E0B" />,
      title: 'Moving between Document & Relational models is painful',
      desc: 'Nested document arrays, polymorphic schemas, and mixed field types cannot be directly imported into rigid SQL tables without data truncation.',
      solution: 'AI-assisted schema engine maps arrays to foreign key child tables and polymorphic specs to indexed JSONB.'
    },
    {
      icon: <UndoRollbackIcon size={26} color="#2563EB" />,
      title: 'No deterministic safety or one-click rollback',
      desc: 'Traditional migration scripts leave developers without an automated safety net if constraints fail mid-transfer.',
      solution: 'Simulates inside transactional dry runs first, and automatically generates reversible .sql rollback scripts.'
    },
  ];

  const features = [
    {
      icon: <AiSparkleIcon size={22} color="#0284C7" />,
      title: 'Bidirectional AI Schema Mapping',
      desc: 'Translates unstructured BSON into normalized 3NF relational schemas, and denormalizes SQL tables back into native MongoDB document collections.',
      tag: 'Core Intelligence',
    },
    {
      icon: <VersionHistoryIcon size={22} color="#2563EB" />,
      title: 'AI Schema Update Assistant (NL2DDL)',
      desc: 'Type schema changes in plain English. The AI engine generates production-safe DDL wrapped in 5-second lock timeouts and non-blocking indexes.',
      tag: 'Workflow C',
    },
    {
      icon: <ShieldAlertIcon size={22} color="#EF4444" />,
      title: 'Pre-Migration Risk & Health Linter',
      desc: 'Calculates a 0–100 Schema Health Score. Statically audits schemas for missing indexes, dirty data types, and potential foreign key locks.',
      tag: 'Safety Guardrail',
    },
    {
      icon: <DryRunIcon size={22} color="#7C3AED" />,
      title: 'Transactional Dry Run Engine',
      desc: 'Executes a non-destructive dry run inside an isolated database transaction, verifying constraints and predicting errors before permanent writes.',
      tag: 'Zero Risk',
    },
    {
      icon: <StreamEtlIcon size={22} color="#2563EB" />,
      title: 'Chunk-Level Error Isolation',
      desc: 'Streams data in 500-record batches. If 1 record fails type conversion, it isolates the bad document while inserting the 499 valid records seamlessly.',
      tag: 'High Throughput',
    },
    {
      icon: <BenchmarkChartIcon size={22} color="#10B981" />,
      title: 'Real-Time Query Latency Benchmarking',
      desc: 'Executes 1,000 non-mutating parallel queries against both live databases and renders side-by-side latency bar charts to scientifically prove performance.',
      tag: 'Verification',
    },
    {
      icon: <AuditReportIcon size={22} color="#0284C7" />,
      title: 'Executive PDF & HTML Audit Reports',
      desc: 'Generates branded verification certificates with exact row count reconciliations, MD5 integrity proofs, and query speedups for team presentations.',
      tag: 'Compliance Ready',
    },
    {
      icon: <VersionHistoryIcon size={22} color="#F59E0B" />,
      title: 'Local Schema Version History',
      desc: 'Audits every database change in a local timeline with timestamp, diff preview, and one-click rollback script generation.',
      tag: 'Audit Trail',
    },
    {
      icon: <CheckCircleIcon size={22} color="#10B981" />,
      title: 'Offline Demo Mode (Built-In Dataset)',
      desc: 'Test full migration workflows instantly using our bundled 20,650 document e-commerce sample database without needing live database servers.',
      tag: 'Instant Try',
    },
  ];

  return (
    <div className={styles.page}>
      {/* ================= HERO SECTION ================= */}
      <section className={styles.heroSection}>
        <div className="container">
          <div className={styles.heroContent}>
            {/* Top Live Pill */}
            <div className={styles.heroBadgeRow}>
              <div className="badge-pill-live">
                <span className="pulse-dot"></span>
                <span>MigrateIQ v1.0 Desktop Available for Windows</span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className={styles.heroTitle}>
              Migrate & Evolve Databases.{' '}
              <span className={styles.titleGradient}>Safely. Intelligently.</span>
            </h1>

            {/* Subtitle */}
            <p className={styles.heroSubtitle}>
              The intelligent desktop platform for <strong>bidirectional database migration</strong> (MongoDB ⇄ PostgreSQL)
              and <strong>zero-downtime schema updates</strong>. Combines AI schema modeling with deterministic safety guardrails.
            </p>

            {/* CTAs */}
            <div className={styles.heroCtaRow}>
              <Link href="/download" className="btn-primary" style={{ padding: '13px 26px', fontSize: '0.95rem' }}>
                <WindowsIcon size={18} color="#FFFFFF" />
                Download for Windows (.exe)
              </Link>
              <Link href="/how-it-works" className="btn-secondary" style={{ padding: '13px 24px', fontSize: '0.95rem' }}>
                Explore How It Works →
              </Link>
            </div>

            {/* Micro Trust Details */}
            <p className={styles.heroTrustLine}>
              100% Local Execution · Zero credentials sent to cloud · Free & Open Source
            </p>
          </div>

          {/* Centerpiece Hero UI Showcase */}
          <StudioMockup />
        </div>
      </section>

      {/* ================= METRICS & ENGINEERING PROOF BAR ================= */}
      <section className={styles.metricsSection}>
        <div className="container">
          <div className={styles.metricsGrid}>
            {metrics.map((m, idx) => (
              <div key={idx} className={styles.metricCard}>
                <div className={styles.metricValue}>{m.value}</div>
                <div className={styles.metricLabel}>{m.label}</div>
                <div className={styles.metricDesc}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ARCHITECTURE PIPELINE FLOW ================= */}
      <section className={styles.architectureSection}>
        <div className="container">
          <ArchitectureFlow />
        </div>
      </section>

      {/* ================= PAIN POINTS SECTION ================= */}
      <section className={styles.painSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-ai">The Real-World Problem</span>
            <h2 className={styles.sectionTitle}>Database Migrations Are Terrifying. They Don't Have to Be.</h2>
            <p className={styles.sectionSubtitle}>
              Engineers dread database changes because one mistake can cause silent data corruption, lock tables, or crash production services.
            </p>
          </div>

          <div className={styles.painGrid}>
            {painPoints.map((item, idx) => (
              <div key={idx} className={styles.painCard}>
                <div className={styles.painIcon}>{item.icon}</div>
                <h3 className={styles.painTitle}>{item.title}</h3>
                <p className={styles.painDesc}>{item.desc}</p>
                <div className={styles.painSolution}>
                  <strong>How MigrateIQ solves it:</strong> {item.solution}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURES BENTO GRID ================= */}
      <section className={styles.featuresSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-brand">Enterprise Grade Capabilities</span>
            <h2 className={styles.sectionTitle}>Everything You Need for Safe Database Evolution</h2>
            <p className={styles.sectionSubtitle}>
              Whether migrating 50,000 documents across database engines or executing live schema updates,
              MigrateIQ provides complete deterministic safety.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {features.map((feat, idx) => (
              <div key={idx} className={styles.featureCard}>
                <div className={styles.featureCardTop}>
                  <div className={styles.featureIcon}>{feat.icon}</div>
                  <span className="badge badge-ai">{feat.tag}</span>
                </div>
                <h3 className={styles.featureTitle}>{feat.title}</h3>
                <p className={styles.featureDesc}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= DATABASE ECOSYSTEM COMPATIBILITY GRID ================= */}
      <section className={styles.ecosystemSection}>
        <div className="container">
          <DatabaseEcosystem />
        </div>
      </section>

      {/* ================= BENCHMARK SHOWCASE CARD ================= */}
      <section className={styles.benchmarkSection}>
        <div className="container">
          <div className={styles.benchmarkCard}>
            <div className={styles.benchmarkContent}>
              <span className="badge badge-success">⚡ Live Query Latency Verification</span>
              <h2 className={styles.benchmarkTitle}>Prove the Speedup with Live Benchmarks</h2>
              <p className={styles.benchmarkDesc}>
                Don’t just guess if your target PostgreSQL database is faster. MigrateIQ includes an
                integrated benchmark engine that runs 1,000 non-mutating parallel lookups against both databases
                to generate real latency bar charts for your thesis and team reports.
              </p>
              <ul className={styles.benchmarkPoints}>
                <li><CheckCircleIcon size={16} color="#10B981" /> <strong>Primary Key Lookups:</strong> 3.4x faster on PostgreSQL (1.2ms vs 4.1ms)</li>
                <li><CheckCircleIcon size={16} color="#10B981" /> <strong>Category Filter Queries:</strong> 2.5x faster (5.9ms vs 14.8ms)</li>
                <li><CheckCircleIcon size={16} color="#10B981" /> <strong>Aggregations & Joins:</strong> 3.2x faster (11.4ms vs 36.2ms)</li>
              </ul>
              <button
                className="btn-secondary"
                onClick={() => setAuditModalOpen(true)}
                style={{ marginTop: '18px', padding: '10px 20px', fontSize: '0.875rem' }}
              >
                📄 Preview Sample Executive Audit Certificate
              </button>
            </div>
            <div className={styles.benchmarkVisual}>
              <div className={styles.chartHeader}>
                <span>Average Query Latency (Lower is Better)</span>
                <span className={styles.chartSample}>1,000 Queries</span>
              </div>
              <div className={styles.barGroup}>
                <div className={styles.barLabelRow}>
                  <span>MongoDB (Source)</span>
                  <span className={styles.barTime}>18.4 ms</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFillMongo} style={{ width: '85%' }}></div>
                </div>
              </div>
              <div className={styles.barGroup}>
                <div className={styles.barLabelRow}>
                  <span>PostgreSQL (Target)</span>
                  <span className={styles.barTimeHighlight}>6.2 ms (⚡ 2.9x Faster)</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFillPg} style={{ width: '30%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DOWNLOAD CTA BANNER ================= */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            <div className={styles.ctaCardContent}>
              <h2 className={styles.ctaTitle}>Ready to Experience Safe Database Migration?</h2>
              <p className={styles.ctaSubtitle}>
                Download the Windows desktop application. Free, open-source, and ready to run on your local machine.
              </p>
              <div className={styles.ctaButtonRow}>
                <Link href="/download" className="btn-primary" style={{ padding: '14px 32px', fontSize: '1.025rem' }}>
                  <WindowsIcon size={20} color="#FFFFFF" />
                  Download for Windows (.exe)
                </Link>
                <Link href="/download#faq" className="btn-secondary" style={{ padding: '14px 28px', fontSize: '0.95rem' }}>
                  System Requirements & FAQ
                </Link>
              </div>
              <div className={styles.ctaBadgeRow}>
                <span>Version 1.0.0</span>
                <span>•</span>
                <span>Windows 10 / 11 64-bit</span>
                <span>•</span>
                <span>Includes Demo Mode</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audit Report Preview Modal */}
      <AuditReportModal isOpen={auditModalOpen} onClose={() => setAuditModalOpen(false)} />
    </div>
  );
}
