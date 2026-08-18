'use client';

import React, { useState } from 'react';
import styles from './SchemaTransformPreview.module.css';

export const SchemaTransformPreview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mongoToPg' | 'pgToMongo' | 'schemaUpdate'>('mongoToPg');

  const samples = {
    mongoToPg: {
      title: 'MongoDB ➔ PostgreSQL Normalization',
      badge: 'Document Array ➔ Relational Foreign Keys',
      sourceLabel: '🍃 MongoDB Source (BSON)',
      targetLabel: '🐘 PostgreSQL Target (DDL)',
      sourceFormat: 'Unstructured Document',
      targetFormat: 'Normalized 3NF SQL',
      sourceCode: `// Source: MongoDB (orders collection)
{
  "_id": ObjectId("665a1b2c4e3f..."),
  "orderNumber": "ORD-2026-9812",
  "userId": ObjectId("665a109a1a2b..."),
  "totalAmount": 249.99,
  "status": "shipped",
  "items": [
    {
      "productId": ObjectId("665a0df8c91a..."),
      "productName": "Ergonomic Keyboard",
      "price": 149.99,
      "quantity": 1
    },
    {
      "productId": ObjectId("665a0e14d82b..."),
      "productName": "Wireless Mouse",
      "price": 100.00,
      "quantity": 1
    }
  ],
  "createdAt": ISODate("2026-08-15T10:45:00Z")
}`,
      targetCode: `-- Target: PostgreSQL (Generated Normalized Tables)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Child Table with Foreign Key
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);`,
      footerTip: 'Zero Data Loss: Automatically extracts embedded arrays into child tables with foreign keys and generates index optimization statements.'
    },
    pgToMongo: {
      title: 'PostgreSQL ➔ MongoDB Denormalization',
      badge: 'Relational JOINs ➔ Embedded Document Arrays',
      sourceLabel: '🐘 PostgreSQL Source (Relational)',
      targetLabel: '🍃 MongoDB Target (Document)',
      sourceFormat: 'Parent & Child Tables',
      targetFormat: 'Rich JSON Document',
      sourceCode: `-- Source: PostgreSQL (orders + order_items JOIN)
SELECT o.id, o.order_number, o.total_amount, o.status,
       json_agg(json_build_object(
         'productId', oi.product_id,
         'productName', oi.product_name,
         'price', oi.price,
         'quantity', oi.quantity
       )) AS items
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.order_number, o.total_amount, o.status;`,
      targetCode: `// Target: MongoDB (Auto-Embedded Collection)
{
  "_id": ObjectId("665a1b2c4e3f8a9101234567"),
  "orderNumber": "ORD-2026-9812",
  "totalAmount": 249.99,
  "status": "shipped",
  "items": [
    {
      "productId": ObjectId("665a0df8c91a..."),
      "productName": "Ergonomic Keyboard",
      "price": 149.99,
      "quantity": 1
    },
    {
      "productId": ObjectId("665a0e14d82b..."),
      "productName": "Wireless Mouse",
      "price": 100.00,
      "quantity": 1
    }
  ]
}`,
      footerTip: 'Reverse Denormalization: Automatically detects foreign key relationships and embeds high-cardinality child tables into native document arrays.'
    },
    schemaUpdate: {
      title: 'AI Schema Update Assistant (NL2DDL)',
      badge: 'Plain English ➔ Safe Zero-Downtime DDL',
      sourceLabel: '💬 Plain English Change Request',
      targetLabel: '🛡️ Safe Executable DDL + Rollback',
      sourceFormat: 'Natural Language Input',
      targetFormat: 'Atomic SQL with Timeout',
      sourceCode: `// User Input Prompt:
"Add an optional phone number column to the users table, 
 maximum 15 characters, and create an index on it."

// AI Interpretation Result:
{
  "operation": "ADD_COLUMN",
  "table": "users",
  "columnName": "phone",
  "dataType": "VARCHAR(15)",
  "allowNull": true,
  "createIndex": true,
  "riskLevel": "LOW (Reversible)"
}`,
      targetCode: `-- Forward Migration (Zero-Downtime Lock Protected)
SET lock_timeout = '5s';
BEGIN;

ALTER TABLE users 
ADD COLUMN phone VARCHAR(15) NULL;

CREATE INDEX CONCURRENTLY idx_users_phone 
ON users(phone);

COMMIT;

-- Auto-Generated Rollback Script
-- ALTER TABLE users DROP COLUMN IF EXISTS phone;`,
      footerTip: 'Safe Schema Evolution: Wraps changes in 5s lock timeouts, runs non-blocking CONCURRENT indexes, and auto-generates one-click rollback scripts.'
    }
  };

  const current = samples[activeTab];

  return (
    <div className={styles.previewWrapper}>
      {/* Top Header & Tab Controls */}
      <div className={styles.previewHeader}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'mongoToPg' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('mongoToPg')}
          >
            <span className={styles.tabDot}></span>
            MongoDB ➔ PostgreSQL
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'pgToMongo' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('pgToMongo')}
          >
            <span className={styles.tabDot}></span>
            PostgreSQL ➔ MongoDB
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'schemaUpdate' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('schemaUpdate')}
          >
            <span className={styles.tabDot}></span>
            AI Schema Update (NL2DDL)
          </button>
        </div>
        <div className={styles.previewBadge}>
          <span className="badge badge-ai">✨ {current.badge}</span>
        </div>
      </div>

      {/* Split Screen Code Viewer */}
      <div className={styles.splitViewer}>
        {/* Left Column: Source */}
        <div className={styles.codeColumn}>
          <div className={styles.codeColumnHeader}>
            <div className={styles.dbIcon}>
              <span className={styles.mongoTag}>{current.sourceLabel}</span>
            </div>
            <span className={styles.formatTag}>{current.sourceFormat}</span>
          </div>
          <pre className={styles.codeBlock}>
            <code>{current.sourceCode}</code>
          </pre>
        </div>

        {/* Center Divider / Transformation Arrow */}
        <div className={styles.transformCenter}>
          <div className={styles.arrowPill}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
            <span>Engine</span>
          </div>
        </div>

        {/* Right Column: Target */}
        <div className={styles.codeColumn}>
          <div className={styles.codeColumnHeader}>
            <div className={styles.dbIcon}>
              <span className={styles.pgTag}>{current.targetLabel}</span>
            </div>
            <span className={styles.formatTag}>{current.targetFormat}</span>
          </div>
          <pre className={styles.codeBlock}>
            <code>{current.targetCode}</code>
          </pre>
        </div>
      </div>

      {/* Bottom Insights Footer */}
      <div className={styles.previewFooter}>
        <div className={styles.footerTip}>
          <span className={styles.tipIcon}>💡</span>
          <span>
            <strong>{current.title}:</strong> {current.footerTip}
          </span>
        </div>
      </div>
    </div>
  );
};
