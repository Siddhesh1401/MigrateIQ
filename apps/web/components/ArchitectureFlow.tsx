'use client';

import React, { useState } from 'react';
import styles from './ArchitectureFlow.module.css';

export const ArchitectureFlow: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<number>(2);

  const nodes = [
    {
      id: 0,
      title: '1. Introspect & Sample',
      badge: 'BSON Parser',
      desc: 'Connects to MongoDB with native driver, samples 1,000 documents per collection, extracts polymorphic data patterns, and calculates the 0–100 Schema Health Score.',
      metric: '7 Collections · 20,750 Docs'
    },
    {
      id: 1,
      title: '2. Kahn’s Topological Sort',
      badge: 'Graph Sorter',
      desc: 'Builds a Directed Acyclic Graph (DAG) of foreign key constraints to compute the exact execution order: categories ➔ users ➔ products ➔ orders ➔ order_items.',
      metric: '0 Circular FK Deadlocks'
    },
    {
      id: 2,
      title: '3. AI Schema Engine',
      badge: 'Gemini + Rules',
      desc: 'Translates document arrays to normalized 3NF tables with foreign keys, converts polymorphic specs to JSONB GIN indexes, and generates clean DDL with rollbacks.',
      metric: '100% Automated Mapping'
    },
    {
      id: 3,
      title: '4. Chunk-Level ETL',
      badge: 'Row-by-Row Isolation',
      desc: 'Streams data in 500-record batches. If a single dirty document fails type validation, it automatically isolates the bad record without crashing the remaining 499 rows.',
      metric: '20,000+ Rows / Second'
    },
    {
      id: 4,
      title: '5. Mathematical Audit',
      badge: '5-Stage Verification',
      desc: 'Executes row count reconciliation, penny-accurate revenue decimal sums, 500-record MD5 checksum spot-checks, and generates the downloadable Executive PDF report.',
      metric: '0.00% Data Loss Verified'
    }
  ];

  return (
    <div className={styles.flowWrapper}>
      <div className={styles.flowHeader}>
        <span className="badge badge-ai">Under the Hood</span>
        <h3 className={styles.flowMainTitle}>The High-Throughput Migration Engine</h3>
        <p className={styles.flowMainSubtitle}>
          Click on any architectural pipeline stage to inspect its data processing guarantees.
        </p>
      </div>

      {/* Pipeline Navigation Bar */}
      <div className={styles.nodeTrack}>
        {nodes.map((node) => (
          <button
            key={node.id}
            className={`${styles.nodeBtn} ${selectedNode === node.id ? styles.nodeBtnActive : ''}`}
            onClick={() => setSelectedNode(node.id)}
          >
            <span className={styles.nodeStepNum}>0{node.id + 1}</span>
            <div className={styles.nodeBtnText}>
              <span className={styles.nodeBtnTitle}>{node.title.split('. ')[1]}</span>
              <span className={styles.nodeBtnBadge}>{node.badge}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Active Stage Inspector Card */}
      <div className={styles.inspectorCard}>
        <div className={styles.inspectorTop}>
          <div className={styles.inspectorHeaderLeft}>
            <span className="badge badge-brand">{nodes[selectedNode].badge}</span>
            <h4 className={styles.inspectorTitle}>{nodes[selectedNode].title}</h4>
          </div>
          <div className={styles.metricBadge}>
            <span className={styles.metricLabel}>Guarantee:</span>
            <span className={styles.metricValue}>{nodes[selectedNode].metric}</span>
          </div>
        </div>
        <p className={styles.inspectorDesc}>{nodes[selectedNode].desc}</p>
      </div>
    </div>
  );
};
