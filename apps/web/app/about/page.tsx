'use client';

import React from 'react';
import Link from 'next/link';
import {
  WindowsIcon,
  AiSparkleIcon,
  ShieldAlertIcon,
  BenchmarkChartIcon,
  LockDowntimeIcon
} from '../../components/Icons';
import styles from './page.module.css';

export const dynamic = 'force-static';

export default function AboutPage() {
  const teamMembers = [
    {
      name: 'Siddhesh',
      role: 'Project Lead & Desktop ETL Architect',
      focus: 'Electron 28+ Main process, Kahn’s topological DAG sorter, chunk-level streaming ETL engine, and Zustand state synchronization.',
      avatarBg: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      initials: 'SP',
      tag: 'Core Desktop & Engine'
    },
    {
      name: 'Team Member 2',
      role: 'MongoDB Testbed & BSON Introspection',
      focus: '20,650 document ShopBridge e-commerce testbed, native MongoDB driver pipeline, polymorphic type sampling, and health scoring algorithms.',
      avatarBg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      initials: 'TM',
      tag: 'NoSQL Source Engine'
    },
    {
      name: 'Team Member 3',
      role: 'PostgreSQL Platform & 5-Stage Verification',
      focus: '3NF relational normalization, GIN JSONB indexing, 1,000-query parallel benchmark runner, and MD5 cryptographic integrity proofs.',
      avatarBg: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
      initials: 'TM',
      tag: 'Relational & Benchmark'
    },
    {
      name: 'Team Member 4',
      role: 'AI NL2DDL Assistant & Audit Generator',
      focus: 'Gemini AI prompt engineering, zero-downtime lock timeout guardrails, Next.js 14 marketing portal, and Executive PDF/HTML report generation.',
      avatarBg: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
      initials: 'TM',
      tag: 'AI Evolution & Reports'
    }
  ];

  const pillars = [
    {
      icon: <ShieldAlertIcon size={24} color="#EF4444" />,
      title: 'Deterministic Safety First',
      desc: 'Database changes should never be a leap of faith. Every schema migration is validated inside transactional dry runs with automatic rollback generation before live execution.'
    },
    {
      icon: <LockDowntimeIcon size={24} color="#059669" />,
      title: '100% Local-First Privacy',
      desc: 'Your database credentials, connection strings, and production data stay strictly on your local PC. No cloud DB proxies, no account signups, and zero vendor lock-in.'
    },
    {
      icon: <AiSparkleIcon size={24} color="#0284C7" />,
      title: 'AI Augmented, Human Controlled',
      desc: 'AI handles the tedious work of normalizing complex polymorphic arrays and drafting DDL, while developers maintain granular review and column-by-column override control.'
    },
    {
      icon: <BenchmarkChartIcon size={24} color="#10B981" />,
      title: 'Empirical Verification',
      desc: 'We don’t just claim performance improvements. MigrateIQ proves them scientifically by running 1,000 live parallel benchmark queries and generating audit certificates.'
    }
  ];

  const techStack = [
    { name: 'Electron 28+', category: 'Desktop Shell', desc: 'Cross-platform native window runtime' },
    { name: 'Next.js 14 (App Router)', category: 'Frontend Portal', desc: 'Server-rendered high-performance web app' },
    { name: 'TypeScript 5.4', category: 'Language', desc: '100% strict type safety across all monorepo workspaces' },
    { name: 'Node.js Main Process', category: 'ETL Engine', desc: 'Multi-threaded streaming data pipeline' },
    { name: 'MongoDB Native Driver', category: 'NoSQL Connection', desc: 'BSON cursor streaming & aggregation' },
    { name: 'node-postgres (pg)', category: 'SQL Connection', desc: 'High-throughput connection pooling & SSL' },
    { name: 'Google AI Studio (Gemini)', category: 'AI Intelligence', desc: 'Context-aware schema modeling & NL2DDL' },
    { name: 'Zustand & Electron Store', category: 'State & Storage', desc: 'Reactive desktop state & local encrypted storage' },
  ];

  return (
    <div className={styles.page}>
      {/* ================= HERO HEADER ================= */}
      <section className={styles.heroSection}>
        <div className="container">
          <div className={styles.heroContent}>
            <span className="badge badge-brand">Final Year Engineering Capstone</span>
            <h1 className={styles.heroTitle}>About MigrateIQ</h1>
            <p className={styles.heroSubtitle}>
              MigrateIQ was conceived and engineered by a team of four computer science undergraduates
              to solve one of the most stressful challenges in modern software engineering:
              <strong> safe, reliable database migration and zero-downtime schema evolution.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ================= THE PROBLEM & MISSION ================= */}
      <section className={styles.missionSection}>
        <div className="container">
          <div className={styles.missionCard}>
            <div className={styles.missionHeader}>
              <span className="badge badge-ai">Our Motivation</span>
              <h2 className={styles.missionTitle}>Why We Built MigrateIQ</h2>
            </div>
            <div className={styles.missionBody}>
              <p>
                In the software industry, database migrations are notoriously feared. Engineering teams delay moving
                from NoSQL document databases (like MongoDB) to relational systems (like PostgreSQL) because manual
                scripting is tedious, error-prone, and fraught with risks of silent data corruption or application downtime.
              </p>
              <p>
                Existing enterprise migration tools either cost thousands of dollars, lock developers into proprietary
                cloud ecosystems, or dump un-normalized JSON into columns without solving the actual relational data modeling problem.
              </p>
              <p>
                We built <strong>MigrateIQ</strong> as an open-source, local-first desktop application that combines
                <strong> AI schema understanding</strong> with <strong>strict deterministic safety guardrails</strong>:
                from automated 3NF table normalization and 0–100 health scoring to transactional dry-runs and penny-accurate mathematical audits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TEAM MEMBERS GRID ================= */}
      <section className={styles.teamSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-brand">Engineering Team</span>
            <h2 className={styles.sectionTitle}>Meet the Builders</h2>
            <p className={styles.sectionSubtitle}>
              The four computer science students behind the architecture, ETL streaming engine, and AI modeling platform.
            </p>
          </div>

          <div className={styles.teamGrid}>
            {teamMembers.map((member, idx) => (
              <div key={idx} className={styles.memberCard}>
                <div className={styles.memberTop}>
                  <div className={styles.avatarBox} style={{ background: member.avatarBg }}>
                    {member.initials}
                  </div>
                  <div className={styles.memberTitles}>
                    <h3 className={styles.memberName}>{member.name}</h3>
                    <span className={styles.memberRole}>{member.role}</span>
                  </div>
                </div>
                <span className="badge badge-ai" style={{ alignSelf: 'flex-start' }}>{member.tag}</span>
                <p className={styles.memberFocus}>{member.focus}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ENGINEERING PILLARS ================= */}
      <section className={styles.pillarsSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-ai">Core Architecture</span>
            <h2 className={styles.sectionTitle}>Our Architectural Philosophy</h2>
            <p className={styles.sectionSubtitle}>
              The core principles that govern every algorithm, IPC channel, and UI component in MigrateIQ.
            </p>
          </div>

          <div className={styles.pillarsGrid}>
            {pillars.map((pillar, idx) => (
              <div key={idx} className={styles.pillarCard}>
                <div className={styles.pillarIcon}>{pillar.icon}</div>
                <h3 className={styles.pillarTitle}>{pillar.title}</h3>
                <p className={styles.pillarDesc}>{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= MONOREPO TECHNOLOGY STACK ================= */}
      <section className={styles.techSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-brand">Under the Hood</span>
            <h2 className={styles.sectionTitle}>The Technology Monorepo</h2>
            <p className={styles.sectionSubtitle}>
              Built with industry-standard frameworks and native drivers for maximum performance, security, and developer ergonomics.
            </p>
          </div>

          <div className={styles.techGrid}>
            {techStack.map((tech, idx) => (
              <div key={idx} className={styles.techCard}>
                <div className={styles.techCardTop}>
                  <h4 className={styles.techName}>{tech.name}</h4>
                  <span className={styles.techCategory}>{tech.category}</span>
                </div>
                <p className={styles.techDesc}>{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL DOWNLOAD CTA ================= */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            <div className={styles.ctaCardContent}>
              <h2 className={styles.ctaTitle}>Experience MigrateIQ Today</h2>
              <p className={styles.ctaSubtitle}>
                Download the free Windows desktop app and run your first migration in under 10 minutes.
              </p>
              <div className={styles.ctaButtonRow}>
                <Link href="/download" className="btn-primary" style={{ padding: '14px 32px', fontSize: '1.025rem' }}>
                  <WindowsIcon size={20} color="#FFFFFF" />
                  Download for Windows (.exe)
                </Link>
                <Link href="/how-it-works" className="btn-secondary" style={{ padding: '14px 28px', fontSize: '0.95rem' }}>
                  Explore How It Works →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
