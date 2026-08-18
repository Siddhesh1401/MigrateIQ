import React from 'react';
import { MongoIcon, PostgresIcon, CheckCircleIcon } from './Icons';
import styles from './DatabaseEcosystem.module.css';

export const DatabaseEcosystem: React.FC = () => {
  const mongoProviders = [
    { name: 'MongoDB Atlas', tag: 'Cloud Cluster', note: 'mongodb+srv:// connection strings supported', active: true },
    { name: 'Local MongoDB', tag: 'v5.0 – v7.0+', note: 'mongodb://localhost:27017 native connection', active: true },
    { name: 'AWS DocumentDB', tag: 'VPC / SSL', note: 'TLS/SSL certificate bundle support', active: true },
  ];

  const pgProviders = [
    { name: 'Supabase', tag: 'Direct & Pooler', note: 'Port 5432 (Direct) & Port 6543 (Transaction Pooler)', active: true },
    { name: 'Neon Serverless', tag: 'Serverless Branching', note: 'Connection pooling with ?sslmode=require', active: true },
    { name: 'AWS RDS / Aurora', tag: 'Enterprise', note: 'Multi-AZ PostgreSQL instances', active: true },
    { name: 'Railway & Render', tag: 'Managed Cloud', note: 'One-click cloud database URLs', active: true },
    { name: 'Local PostgreSQL', tag: 'v12 – v16+', note: 'Standard postgres:// localhost instances', active: true },
  ];

  return (
    <div className={styles.ecosystemCard}>
      <div className={styles.ecosystemHeader}>
        <span className="badge badge-brand">Universal Compatibility</span>
        <h3 className={styles.ecosystemTitle}>Connect Any Local or Cloud Database</h3>
        <p className={styles.ecosystemSubtitle}>
          MigrateIQ connects directly using native drivers with TLS/SSL encryption and connection pooling.
          Zero proprietary cloud brokers — all connections stay 100% on your PC.
        </p>
      </div>

      <div className={styles.ecosystemGrid}>
        {/* Source Column: MongoDB */}
        <div className={styles.providerColumn}>
          <div className={styles.columnHeader}>
            <div className={styles.columnIconWrapper} style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
              <MongoIcon size={22} color="#10B981" />
            </div>
            <div className={styles.columnHeaderText}>
              <h4 className={styles.columnTitle}>MongoDB Engines</h4>
              <span className={styles.columnSub}>Source or Target</span>
            </div>
          </div>

          <div className={styles.providerList}>
            {mongoProviders.map((prov, idx) => (
              <div key={idx} className={styles.providerItem}>
                <div className={styles.providerItemTop}>
                  <span className={styles.providerName}>{prov.name}</span>
                  <span className={styles.providerTag}>{prov.tag}</span>
                </div>
                <p className={styles.providerNote}>{prov.note}</p>
                <div className={styles.verifiedRow}>
                  <CheckCircleIcon size={14} color="#10B981" />
                  <span>Tested & Verified</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center Transfer Arrow */}
        <div className={styles.centerFlow}>
          <div className={styles.flowPill}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"/>
            </svg>
            <span className={styles.flowText}>Bidirectional Streaming</span>
          </div>
        </div>

        {/* Target Column: PostgreSQL */}
        <div className={styles.providerColumn}>
          <div className={styles.columnHeader}>
            <div className={styles.columnIconWrapper} style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
              <PostgresIcon size={22} color="#2563EB" />
            </div>
            <div className={styles.columnHeaderText}>
              <h4 className={styles.columnTitle}>PostgreSQL Engines</h4>
              <span className={styles.columnSub}>Target or Source</span>
            </div>
          </div>

          <div className={styles.providerList}>
            {pgProviders.map((prov, idx) => (
              <div key={idx} className={styles.providerItem}>
                <div className={styles.providerItemTop}>
                  <span className={styles.providerName}>{prov.name}</span>
                  <span className={styles.providerTag}>{prov.tag}</span>
                </div>
                <p className={styles.providerNote}>{prov.note}</p>
                <div className={styles.verifiedRow}>
                  <CheckCircleIcon size={14} color="#10B981" />
                  <span>Tested & Verified</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
