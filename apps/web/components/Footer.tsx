import React from 'react';
import Link from 'next/link';
import styles from './Footer.module.css';

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerContainer}`}>
        <div className={styles.topSection}>
          {/* Brand Info */}
          <div className={styles.brandCol}>
            <Link href="/" className={styles.logo}>
              <div className={styles.logoIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M3 5V12C3 13.6569 7.02944 15 12 15C16.9706 15 21 13.6569 21 12V5" stroke="currentColor" strokeWidth="2"/>
                  <path d="M3 12V19C3 20.6569 7.02944 22 12 22C16.9706 22 21 20.6569 21 19V12" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 9L15 12L12 15" stroke="#2563EB" strokeWidth="2"/>
                </svg>
              </div>
              <span className={styles.logoText}>Migrate<span className={styles.logoAccent}>IQ</span></span>
            </Link>
            <p className={styles.brandDescription}>
              The intelligent, visual database migration planner engineered for zero data loss, AI schema translation, and mathematical verification.
            </p>
            <div className={styles.badgeRow}>
              <span className="badge badge-brand">Desktop Native (Electron)</span>
              <span className="badge badge-success">Zero Data Loss Verified</span>
            </div>
          </div>

          {/* Links Grid */}
          <div className={styles.linksGrid}>
            <div className={styles.linkGroup}>
              <h4 className={styles.linkGroupTitle}>Product</h4>
              <ul className={styles.linkList}>
                <li><Link href="/how-it-works">How It Works</Link></li>
                <li><Link href="/features">All 12 Features</Link></li>
                <li><Link href="/download">Download for Windows</Link></li>
                <li><Link href="/download#faq">FAQ & Requirements</Link></li>
              </ul>
            </div>

            <div className={styles.linkGroup}>
              <h4 className={styles.linkGroupTitle}>Architecture</h4>
              <ul className={styles.linkList}>
                <li><span className={styles.staticLink}>MongoDB (BSON)</span></li>
                <li><span className={styles.staticLink}>PostgreSQL (Relational/JSONB)</span></li>
                <li><span className={styles.staticLink}>Kahn's Topological Sort</span></li>
                <li><span className={styles.staticLink}>Chunk-Level Isolation</span></li>
              </ul>
            </div>

            <div className={styles.linkGroup}>
              <h4 className={styles.linkGroupTitle}>Project</h4>
              <ul className={styles.linkList}>
                <li><Link href="/about">About the Team</Link></li>
                <li><a href="https://github.com/Siddhesh1401/MigrateIQ" target="_blank" rel="noopener noreferrer">GitHub Repository ↗</a></li>
                <li><a href="https://github.com/Siddhesh1401/MigrateIQ-Testbed" target="_blank" rel="noopener noreferrer">Testbed Suite (ShopBridge) ↗</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomSection}>
          <p className={styles.copyright}>
            © 2026 MigrateIQ. Built as a Final Year Computer Science Project. Local-first & Open Source.
          </p>
          <div className={styles.bottomMeta}>
            <span>Strict Light Theme System</span>
            <span className={styles.dot}>•</span>
            <span>Version 1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
