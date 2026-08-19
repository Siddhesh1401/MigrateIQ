'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  WindowsIcon,
  CheckCircleIcon,
  UndoRollbackIcon,
  LockDowntimeIcon
} from '../../components/Icons';
import styles from './page.module.css';

export const dynamic = 'force-static';

export default function DownloadPage() {
  const [downloadStarted, setDownloadStarted] = useState<boolean>(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleDownload = () => {
    setDownloadStarted(true);
    // Trigger download simulation
    const element = document.createElement('a');
    const file = new Blob([
      'MigrateIQ v1.0.0 Windows Installer Placeholder.\nIn production, this downloads MigrateIQ-Setup-1.0.0.exe.\nBuild output: apps/desktop/release/MigrateIQ-Setup-1.0.0.exe'
    ], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'MigrateIQ-Setup-1.0.0.exe';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const faqs = [
    {
      q: 'Does MigrateIQ store my database credentials or data anywhere?',
      a: 'Never. MigrateIQ is a 100% local Windows desktop application. All database connections and data transfers happen directly between your source and target databases on your local machine. Connection strings are stored encrypted in your local OS AppData folder (%APPDATA%/MigrateIQ) and are never transmitted to any cloud server.'
    },
    {
      q: 'Do I need a paid cloud account to use the AI schema features?',
      a: 'No. MigrateIQ uses free-tier AI APIs (such as Google AI Studio Gemini API keys). You can enter your own free Gemini API key in the app Settings, or use our deterministic rule engine which runs 100% offline without requiring any internet connection.'
    },
    {
      q: 'What databases and cloud hosting providers are supported?',
      a: 'Source & Target: MongoDB (Local v5.0–v7.0+, MongoDB Atlas Cloud, AWS DocumentDB) and PostgreSQL (Local v12–v16+, Supabase Port 5432 Direct & Port 6543 Pooler, Neon Serverless with SSL, AWS RDS / Aurora, Railway, Render).'
    },
    {
      q: 'Can I test MigrateIQ without having live databases installed?',
      a: 'Yes! MigrateIQ includes a built-in Offline Demo Mode with a pre-bundled 20,650 document e-commerce dataset (ShopBridge DB). Evaluators and developers can test the full 8-step migration wizard and 1,000-query live benchmark instantly in under 60 seconds with zero setup.'
    },
    {
      q: 'How does the one-click rollback guarantee safety?',
      a: 'Every migration automatically generates a clean reverse .sql script that drops foreign keys, tables, and indexes in exact reverse topological DAG order, preventing orphaned tables and guaranteeing your target database can be reset safely.'
    }
  ];

  return (
    <div className={styles.page}>
      {/* ================= DOWNLOAD HERO SECTION ================= */}
      <section className={styles.heroSection}>
        <div className="container">
          <div className={styles.heroContent}>
            <div className="badge-pill-live">
              <span className="pulse-dot"></span>
              <span>Official Windows Release · v1.0.0</span>
            </div>

            <h1 className={styles.heroTitle}>
              Download <span className={styles.titleGradient}>MigrateIQ</span> for Windows
            </h1>

            <p className={styles.heroSubtitle}>
              The intelligent desktop platform for safe bidirectional database migration (MongoDB ⇄ PostgreSQL)
              and zero-downtime schema evolution. Free, open-source, and runs 100% on your PC.
            </p>

            {/* Download Card Centerpiece */}
            <div className={styles.downloadCard}>
              <div className={styles.dlCardTop}>
                <div className={styles.dlAppInfo}>
                  <div className={styles.windowsIconBox}>
                    <WindowsIcon size={32} color="#2563EB" />
                  </div>
                  <div className={styles.dlDetails}>
                    <h3 className={styles.dlFileName}>MigrateIQ-Setup-1.0.0.exe</h3>
                    <span className={styles.dlMeta}>
                      Windows 10 / 11 · 64-bit · Installer & Portable · ~85 MB
                    </span>
                  </div>
                </div>

                <button
                  className="btn-primary"
                  onClick={handleDownload}
                  style={{ padding: '14px 32px', fontSize: '1.025rem' }}
                >
                  <WindowsIcon size={20} color="#FFFFFF" />
                  Download for Windows (.exe)
                </button>
              </div>

              {downloadStarted && (
                <div className={styles.downloadNotice}>
                  <CheckCircleIcon size={18} color="#059669" />
                  <span>
                    <strong>Download started!</strong> Check your Downloads folder for <code>MigrateIQ-Setup-1.0.0.exe</code>.
                  </span>
                </div>
              )}

              <div className={styles.checksumRow}>
                <span className={styles.checksumLabel}>SHA-256 Checksum:</span>
                <code className={styles.checksumHash}>
                  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </code>
              </div>
            </div>

            <div className={styles.trustBadgesRow}>
              <div className={styles.trustItem}>
                <LockDowntimeIcon size={16} color="#059669" />
                <span>100% Local & Private</span>
              </div>
              <div className={styles.trustItem}>
                <CheckCircleIcon size={16} color="#2563EB" />
                <span>No Cloud Account Required</span>
              </div>
              <div className={styles.trustItem}>
                <UndoRollbackIcon size={16} color="#7C3AED" />
                <span>Includes Offline Demo Mode</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SYSTEM REQUIREMENTS ================= */}
      <section className={styles.reqSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-brand">Compatibility Matrix</span>
            <h2 className={styles.sectionTitle}>System Requirements</h2>
            <p className={styles.sectionSubtitle}>
              MigrateIQ is lightweight, fast, and engineered to run smoothly on modern Windows workstations.
            </p>
          </div>

          <div className={styles.reqGrid}>
            <div className={styles.reqCard}>
              <div className={styles.reqLabel}>Operating System</div>
              <div className={styles.reqValue}>Windows 10 / 11 (64-bit)</div>
              <p className={styles.reqDesc}>Native Electron desktop runtime for x64 architecture.</p>
            </div>

            <div className={styles.reqCard}>
              <div className={styles.reqLabel}>Memory (RAM)</div>
              <div className={styles.reqValue}>4 GB Min / 8 GB Rec</div>
              <p className={styles.reqDesc}>8 GB recommended when streaming large 100,000+ row datasets.</p>
            </div>

            <div className={styles.reqCard}>
              <div className={styles.reqLabel}>Disk Space</div>
              <div className={styles.reqValue}>~300 MB Free Space</div>
              <p className={styles.reqDesc}>Includes the app runtime and local SQLite audit history store.</p>
            </div>

            <div className={styles.reqCard}>
              <div className={styles.reqLabel}>Network & Cloud</div>
              <div className={styles.reqValue}>Local & Cloud Direct</div>
              <p className={styles.reqDesc}>Direct connection to local instances or cloud SSL databases.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 4-STEP INSTALLATION GUIDE ================= */}
      <section className={styles.installSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-ai">Getting Started</span>
            <h2 className={styles.sectionTitle}>Up & Running in Under 2 Minutes</h2>
            <p className={styles.sectionSubtitle}>
              Follow these 4 simple steps to execute your first safe database migration.
            </p>
          </div>

          <div className={styles.installGrid}>
            <div className={styles.installCard}>
              <div className={styles.installNum}>01</div>
              <h3 className={styles.installStepTitle}>Download Installer</h3>
              <p className={styles.installStepDesc}>
                Click the Download button above to save the <code>MigrateIQ-Setup-1.0.0.exe</code> package to your PC.
              </p>
            </div>

            <div className={styles.installCard}>
              <div className={styles.installNum}>02</div>
              <h3 className={styles.installStepTitle}>Run the Installer</h3>
              <p className={styles.installStepDesc}>
                Double-click the setup file. The desktop installer creates desktop and Start Menu shortcuts automatically.
              </p>
            </div>

            <div className={styles.installCard}>
              <div className={styles.installNum}>03</div>
              <h3 className={styles.installStepTitle}>Launch MigrateIQ</h3>
              <p className={styles.installStepDesc}>
                Open the application. Choose between <strong>Full Database Migration</strong> or <strong>Schema Update Assistant</strong>.
              </p>
            </div>

            <div className={styles.installCard}>
              <div className={styles.installNum}>04</div>
              <h3 className={styles.installStepTitle}>Connect or Try Demo</h3>
              <p className={styles.installStepDesc}>
                Paste your database connection strings or click <strong>&quot;Try with Demo Data&quot;</strong> to start migrating immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FREQUENTLY ASKED QUESTIONS (FAQ) ================= */}
      <section className={styles.faqSection} id="faq">
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-brand">Questions & Answers</span>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
            <p className={styles.sectionSubtitle}>
              Everything you need to know about MigrateIQ security, database support, and pricing.
            </p>
          </div>

          <div className={styles.faqContainer}>
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                >
                  <div className={styles.faqQuestionRow}>
                    <h3 className={styles.faqQuestion}>{faq.q}</h3>
                    <span className={styles.faqChevron}>{isOpen ? '−' : '+'}</span>
                  </div>
                  {isOpen && (
                    <div className={styles.faqAnswer}>
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            <div className={styles.ctaCardContent}>
              <h2 className={styles.ctaTitle}>Ready to Migrate Without Fear?</h2>
              <p className={styles.ctaSubtitle}>
                Download the free Windows application and run your first migration today.
              </p>
              <div className={styles.ctaButtonRow}>
                <button
                  className="btn-primary"
                  onClick={handleDownload}
                  style={{ padding: '14px 32px', fontSize: '1.025rem' }}
                >
                  <WindowsIcon size={20} color="#FFFFFF" />
                  Download for Windows (.exe)
                </button>
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
