'use client';

import React, { useState } from 'react';
import styles from './StudioMockup.module.css';

interface SourceField {
  name: string;
  type: string;
  desc: string;
  highlight?: boolean;
}

interface Column {
  name: string;
  type: string;
  tag: string;
  highlight?: boolean;
}

interface TargetTable {
  table: string;
  badge: string;
  highlight?: boolean;
  columns: Column[];
}

interface MappingData {
  title: string;
  badge: string;
  sourceType: string;
  targetType: string;
  sourceFields: SourceField[];
  targetTables: TargetTable[];
}

export const StudioMockup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'nl2ddl'>('orders');

  const mappings: Record<'orders' | 'products' | 'nl2ddl', MappingData> = {
    orders: {
      title: 'orders ➔ orders (Parent) + order_items (Child)',
      badge: 'Parent-Child Array Normalization',
      sourceType: 'MongoDB Document Array',
      targetType: 'PostgreSQL 3NF Normalized',
      sourceFields: [
        { name: '_id', type: 'ObjectId', desc: 'Primary document identifier' },
        { name: 'orderNumber', type: 'String', desc: 'ORD-2026-9812' },
        { name: 'userId', type: 'ObjectId', desc: 'Ref ➔ users._id' },
        { name: 'totalAmount', type: 'Double', desc: '$249.99' },
        { name: 'items', type: 'Array [Object]', desc: '2 embedded order line items', highlight: true },
        { name: 'createdAt', type: 'Date', desc: 'ISO 8601 Timestamp' },
      ],
      targetTables: [
        {
          table: 'orders',
          badge: 'Parent Table',
          columns: [
            { name: 'id', type: 'UUID', tag: 'PRIMARY KEY' },
            { name: 'order_number', type: 'VARCHAR(50)', tag: 'UNIQUE' },
            { name: 'user_id', type: 'UUID', tag: 'FK ➔ users(id)' },
            { name: 'total_amount', type: 'NUMERIC(10,2)', tag: 'NOT NULL' },
            { name: 'created_at', type: 'TIMESTAMPTZ', tag: 'DEFAULT NOW()' },
          ]
        },
        {
          table: 'order_items',
          badge: 'Child Table (Auto-Normalized)',
          highlight: true,
          columns: [
            { name: 'id', type: 'UUID', tag: 'PRIMARY KEY' },
            { name: 'order_id', type: 'UUID', tag: 'FK ➔ orders(id) CASCADE' },
            { name: 'product_id', type: 'UUID', tag: 'FK ➔ products(id)' },
            { name: 'price', type: 'NUMERIC(10,2)', tag: 'NOT NULL' },
            { name: 'quantity', type: 'INTEGER', tag: 'CHECK (> 0)' },
          ]
        }
      ]
    },
    products: {
      title: 'products ➔ products (Typed Columns + GIN JSONB)',
      badge: 'Polymorphic Specifications to Indexed JSONB',
      sourceType: 'Polymorphic Document',
      targetType: 'PostgreSQL Relational + JSONB',
      sourceFields: [
        { name: '_id', type: 'ObjectId', desc: 'Primary document identifier' },
        { name: 'name', type: 'String', desc: 'Sony WH-1000XM5' },
        { name: 'slug', type: 'String', desc: 'sony-wh-1000xm5' },
        { name: 'price', type: 'String / Float', desc: 'Messy string/number price', highlight: true },
        { name: 'specs', type: 'Object (Dynamic)', desc: 'Varying specs per category', highlight: true },
        { name: 'rating', type: 'Object {avg, count}', desc: 'Embedded rating metrics' },
      ],
      targetTables: [
        {
          table: 'products',
          badge: 'Target Table with GIN Index',
          columns: [
            { name: 'id', type: 'UUID', tag: 'PRIMARY KEY' },
            { name: 'name', type: 'VARCHAR(255)', tag: 'NOT NULL' },
            { name: 'price', type: 'NUMERIC(10,2)', tag: 'Auto-Coerced' },
            { name: 'specs', type: 'JSONB', tag: 'GIN Indexed', highlight: true },
            { name: 'rating_average', type: 'NUMERIC(3,2)', tag: 'Flattened' },
            { name: 'rating_count', type: 'INTEGER', tag: 'Flattened' },
          ]
        }
      ]
    },
    nl2ddl: {
      title: 'Natural Language ➔ Safe Executable DDL',
      badge: 'Workflow C: AI Schema Evolution',
      sourceType: 'Plain English Change Request',
      targetType: 'Production-Safe Atomic SQL',
      sourceFields: [
        { name: 'User Request', type: 'Natural Language', desc: '"Add an optional phone column to users with max 15 chars and create an index on it."' },
        { name: 'AI Operation', type: 'ADD_COLUMN', desc: 'Target: table `users`' },
        { name: 'Lock Safety', type: '5s Timeout', desc: 'SET lock_timeout = \'5s\'' },
        { name: 'Concurrency', type: 'Non-Blocking', desc: 'CREATE INDEX CONCURRENTLY' },
      ],
      targetTables: [
        {
          table: 'users (Alteration Preview)',
          badge: 'Safe Forward DDL + Auto Rollback',
          columns: [
            { name: 'phone', type: 'VARCHAR(15)', tag: 'NULLABLE (Safe)' },
            { name: 'idx_users_phone', type: 'INDEX', tag: 'CONCURRENT (Zero Lock)' },
            { name: 'Rollback Script', type: 'Auto-Generated', tag: 'ALTER TABLE users DROP COLUMN phone' },
          ]
        }
      ]
    }
  };

  const current = mappings[activeTab];

  return (
    <div className={styles.studioCard}>
      {/* Studio Top Window Bar */}
      <div className={styles.windowHeader}>
        <div className={styles.windowLeft}>
          <div className={styles.windowDots}>
            <span className={`${styles.dot} ${styles.dotRed}`}></span>
            <span className={`${styles.dot} ${styles.dotYellow}`}></span>
            <span className={`${styles.dot} ${styles.dotGreen}`}></span>
          </div>
          <div className={styles.windowBreadcrumb}>
            <span className={styles.appTitle}>MigrateIQ Studio</span>
            <span className={styles.breadcrumbDivider}>/</span>
            <span className={styles.workflowLabel}>Step 4: AI Schema Mapping</span>
          </div>
        </div>

        <div className={styles.windowRight}>
          <span className={styles.healthScorePill}>
            <span className={styles.healthDot}></span>
            AI Schema Health: <strong>94 / 100 · Clean</strong>
          </span>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className={styles.tabBar}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <span className={styles.tabIcon}>📦</span>
            <span>Orders (Array Normalization)</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'products' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <span className={styles.tabIcon}>⚡</span>
            <span>Products (Polymorphic JSONB)</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'nl2ddl' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('nl2ddl')}
          >
            <span className={styles.tabIcon}>💬</span>
            <span>AI Schema Updates (NL2DDL)</span>
          </button>
        </div>

        <div className={styles.modeBadge}>
          <span className="badge badge-ai">✨ {current.badge}</span>
        </div>
      </div>

      {/* Visual Split Schema Workspace */}
      <div className={styles.workspace}>
        {/* Source Schema Box */}
        <div className={styles.schemaBox}>
          <div className={styles.schemaBoxHeader}>
            <div className={styles.dbTag}>
              <span className={styles.mongoIcon}>🍃</span>
              <span className={styles.dbName}>MongoDB Source</span>
            </div>
            <span className={styles.typeBadge}>{current.sourceType}</span>
          </div>

          <div className={styles.fieldsList}>
            {current.sourceFields.map((field, idx) => (
              <div key={idx} className={`${styles.fieldRow} ${field.highlight ? styles.fieldHighlight : ''}`}>
                <div className={styles.fieldNameCol}>
                  <span className={styles.fieldName}>{field.name}</span>
                  <span className={styles.fieldType}>{field.type}</span>
                </div>
                <span className={styles.fieldDesc}>{field.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center Transformation Indicator */}
        <div className={styles.centerConnector}>
          <div className={styles.connectorPill}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
            <span className={styles.connectorText}>AI Mapping</span>
          </div>
        </div>

        {/* Target Schema Box */}
        <div className={styles.schemaBox}>
          <div className={styles.schemaBoxHeader}>
            <div className={styles.dbTag}>
              <span className={styles.pgIcon}>🐘</span>
              <span className={styles.dbName}>PostgreSQL Target</span>
            </div>
            <span className={styles.typeBadge}>{current.targetType}</span>
          </div>

          <div className={styles.tablesContainer}>
            {current.targetTables.map((t, tIdx) => (
              <div key={tIdx} className={`${styles.tableCard} ${t.highlight ? styles.tableCardHighlight : ''}`}>
                <div className={styles.tableCardHeader}>
                  <span className={styles.tableName}>table <strong>{t.table}</strong></span>
                  <span className={styles.tableBadge}>{t.badge}</span>
                </div>
                <div className={styles.columnsList}>
                  {t.columns.map((col, cIdx) => (
                    <div key={cIdx} className={styles.columnRow}>
                      <div className={styles.colNameType}>
                        <span className={styles.colName}>{col.name}</span>
                        <span className={styles.colType}>{col.type}</span>
                      </div>
                      <span className={styles.colTag}>{col.tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Studio Bottom Bar */}
      <div className={styles.studioBottomBar}>
        <div className={styles.bottomInfo}>
          <span className={styles.statusLiveDot}></span>
          <span>
            <strong>Zero Data Loss Guarantee:</strong> Embedded child arrays automatically normalize to relational tables with foreign keys and cascade rules.
          </span>
        </div>
        <div className={styles.bottomBadge}>
          <span className={styles.dryRunTag}>✓ Dry Run Simulation Passed (0 Errors)</span>
        </div>
      </div>
    </div>
  );
};
