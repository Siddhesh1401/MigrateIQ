/**
 * MigrateIQ - Risk Analysis Engine (Step 5 Pre-Flight Verification)
 *
 * Implements deterministic static analysis, relational cycle detection,
 * nullability validation, and type conflict heuristics.
 *
 * References:
 * - phase_plan-v2.md Lines 507-519 (Section 7.1)
 * - product_blueprint-v7.md Lines 782-837 (Step 5 Risk Report)
 * - product_blueprint-v7.md Lines 1690-1712 (Challenge 4 - Circular FKs)
 * - product_blueprint-v7.md Lines 1785-1801 (Challenge 8 - Large Binary Data)
 */

import type {
  SourceSchema,
  CollectionMapping,
  RiskItem,
  AutoFixAction,
} from '@migrateiq/shared';

export interface RiskAnalysisInput {
  sourceSchema: SourceSchema[];
  mapping: CollectionMapping[];
  direction?: 'mongodb-to-postgres' | 'postgres-to-mongo';
  existingTargetTables?: string[];
  docSizeAverages?: Record<string, number>; // in bytes
  fieldMissingCounts?: Record<string, Record<string, number>>; // collection -> field -> missing count
}

export interface RiskAnalysisOutput {
  risks: RiskItem[];
  metrics: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    recommendedBatchSize: number;
    hasCircularFk: boolean;
  };
}

/**
 * Detect cycles in a directed foreign key graph using Depth-First Search.
 * Returns arrays of table names involved in circular references, if any.
 */
export function detectFkCycles(mappings: CollectionMapping[]): string[][] {
  // Build adjacency graph: parentTable -> childTable[]
  const graph = new Map<string, Set<string>>();

  for (const collection of mappings) {
    const table = collection.targetTableName || collection.collectionName;
    if (!graph.has(table)) graph.set(table, new Set());

    // Check fields for foreign keys or child tables
    for (const field of collection.fields) {
      if (field.foreignKeyToParent) {
        // field references another table
        const referencedTable = field.foreignKeyToParent.split('.')[0] || field.foreignKeyToParent;
        if (!graph.has(table)) graph.set(table, new Set());
        graph.get(table)!.add(referencedTable);
      }
      if (field.isChildTable && field.childTableName) {
        // Child table references parent table
        if (!graph.has(field.childTableName)) graph.set(field.childTableName, new Set());
        graph.get(field.childTableName)!.add(table);
      }
    }

    if (collection.childTables) {
      for (const child of collection.childTables) {
        const childTable = child.targetTableName || child.collectionName;
        if (!graph.has(childTable)) graph.set(childTable, new Set());
        graph.get(childTable)!.add(table);
      }
    }
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const currentPath: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected: slice from neighbor to end of currentPath
        const cycleStartIndex = currentPath.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          cycles.push(currentPath.slice(cycleStartIndex).concat(neighbor));
        }
      }
    }

    currentPath.pop();
    recursionStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Main Risk Analyzer function. Evaluates 9 deterministic rules against
 * the source schema and mapping configuration.
 */
export function analyzeRisks(input: RiskAnalysisInput): RiskAnalysisOutput {
  const {
    sourceSchema,
    mapping,
    direction = 'mongodb-to-postgres',
    existingTargetTables = [],
    docSizeAverages = {},
    fieldMissingCounts = {},
  } = input;

  const risks: RiskItem[] = [];
  let recommendedBatchSize = 500;
  let hasCircularFk = false;

  // Build lookup map for source schemas
  const schemaMap = new Map<string, SourceSchema>();
  for (const s of sourceSchema) {
    schemaMap.set(s.collectionName, s);
  }

  // ── RULE 1 (🔴 Critical): Unmapped Array-of-Objects ───────────────────────
  // In MongoDB -> PostgreSQL: Array of objects must be split into a child table.
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const srcSchema = schemaMap.get(colMapping.collectionName);
      if (!srcSchema) continue;

      for (const field of colMapping.fields) {
        if (!field.include) continue;

        const srcField = srcSchema.fields.find((f) => f.name === field.sourceField);
        const isArrayOfObjects =
          srcField?.bsonType === 'arrayOfObjects' ||
          (srcField?.isArray && srcField.nestedFields && srcField.nestedFields.length > 0) ||
          field.sourceType === 'arrayOfObjects';

        if (isArrayOfObjects && !field.isChildTable) {
          const autoFix: AutoFixAction = {
            type: 'create_child_table',
            collectionName: colMapping.collectionName,
            fieldName: field.sourceField,
            description: `Split "${field.sourceField}" into a separate child table with sort_order`,
          };

          risks.push({
            id: `risk-unmapped-array-${colMapping.collectionName}-${field.sourceField}`,
            severity: 'critical',
            title: `Array of Objects Cannot Be Stored in a Single Column: ${colMapping.collectionName}.${field.sourceField}`,
            description: `The "${colMapping.collectionName}" collection has an "${field.sourceField}" field which contains an array of objects. PostgreSQL cannot store relational object arrays directly in a relational table without normalization or JSONB serialization.`,
            suggestedFix: `Create a separate "${colMapping.collectionName}_${field.sourceField}" child table with a foreign key referencing ${colMapping.targetTableName || colMapping.collectionName}.id. An automatic sort_order column will preserve element index order.`,
            autoFixAvailable: true,
            autoFixAction: autoFix,
            affectedTable: colMapping.targetTableName || colMapping.collectionName,
            affectedField: field.targetColumn || field.sourceField,
          });
        }
      }
    }
  }

  // ── RULE 2 & 4 (🔴 Critical & 🟡 Warning): NOT NULL with Missing/Null Docs ─
  for (const colMapping of mapping) {
    const srcSchema = schemaMap.get(colMapping.collectionName);
    const totalDocs = srcSchema?.documentCount || 1000;
    const colMissingStats = fieldMissingCounts[colMapping.collectionName] || {};

    for (const field of colMapping.fields) {
      if (!field.include || field.isChildTable) continue;

      // Check if target column is marked NOT NULL
      if (!field.isNullable) {
        const srcField = srcSchema?.fields.find((f) => f.name === field.sourceField);
        // Missing count from live stats, or inferred from schema isNullable flag
        const knownMissingCount = colMissingStats[field.sourceField];
        const isPotentiallyMissing = knownMissingCount !== undefined ? knownMissingCount > 0 : srcField?.isNullable;

        if (isPotentiallyMissing) {
          const missingCount = knownMissingCount ?? Math.max(1, Math.round(totalDocs * 0.05));
          const missingPct = Math.round((missingCount / Math.max(1, totalDocs)) * 100);

          const autoFix: AutoFixAction = {
            type: 'set_nullable',
            collectionName: colMapping.collectionName,
            fieldName: field.sourceField,
            description: `Set column "${field.targetColumn || field.sourceField}" to allow NULL`,
          };

          if (missingPct >= 5 || missingCount > 10) {
            risks.push({
              id: `risk-notnull-critical-${colMapping.collectionName}-${field.sourceField}`,
              severity: 'critical',
              title: `Strict NOT NULL Column with Missing Field Documents: ${field.targetColumn || field.sourceField}`,
              description: `Approximately ${missingCount} out of ${totalDocs} documents in "${colMapping.collectionName}" have no value or are null for "${field.sourceField}". Target mapping marks this column as NOT NULL, which will cause immediate insertion failures.`,
              suggestedFix: `Change the "${field.targetColumn || field.sourceField}" column to allow NULL, or assign a default fallback value.`,
              autoFixAvailable: true,
              autoFixAction: autoFix,
              affectedTable: colMapping.targetTableName || colMapping.collectionName,
              affectedField: field.targetColumn || field.sourceField,
            });
          } else {
            risks.push({
              id: `risk-notnull-warn-${colMapping.collectionName}-${field.sourceField}`,
              severity: 'warning',
              title: `Possible Null Values in NOT NULL Column: ${field.targetColumn || field.sourceField}`,
              description: `A small number of documents (~${missingCount}) in "${colMapping.collectionName}" may have missing values for "${field.sourceField}".`,
              suggestedFix: `Consider making "${field.targetColumn || field.sourceField}" nullable to avoid skipped rows.`,
              autoFixAvailable: true,
              autoFixAction: autoFix,
              affectedTable: colMapping.targetTableName || colMapping.collectionName,
              affectedField: field.targetColumn || field.sourceField,
            });
          }
        }
      }
    }
  }

  // ── RULE 3 (🔴 Critical): Circular Foreign Key Dependency Detection ──────
  const cycles = detectFkCycles(mapping);
  if (cycles.length > 0) {
    hasCircularFk = true;
    for (const cycle of cycles) {
      const cyclePath = cycle.join(' → ');
      const startTable = cycle[0];

      const autoFix: AutoFixAction = {
        type: 'defer_foreign_keys',
        collectionName: startTable,
        description: 'Defer all foreign key creation until after data rows are inserted',
      };

      risks.push({
        id: `risk-circular-fk-${cycle.slice(0, 2).join('-')}`,
        severity: 'critical',
        title: `Circular Foreign Key Dependency Detected: ${cycle.slice(0, 2).join(' ↔ ')}`,
        description: `Tables have a circular relationship (${cyclePath}). Neither table can be populated before the other while foreign key constraints are enforced immediately.`,
        suggestedFix: `The migration engine will create both tables WITHOUT foreign key constraints first, insert all data rows, and add constraints post-data using ALTER TABLE ... ADD CONSTRAINT ... NOT VALID; VALIDATE CONSTRAINT ...;`,
        autoFixAvailable: true,
        autoFixAction: autoFix,
        affectedTable: startTable,
      });
    }
  }

  // ── RULE 5 (🟡 Warning): Mixed Data Types Detected ────────────────────────
  for (const colMapping of mapping) {
    const srcSchema = schemaMap.get(colMapping.collectionName);
    if (!srcSchema) continue;

    for (const field of colMapping.fields) {
      if (!field.include) continue;
      const srcField = srcSchema.fields.find((f) => f.name === field.sourceField);

      if (srcField?.bsonType === 'mixed' || field.sourceType === 'mixed') {
        risks.push({
          id: `risk-mixed-type-${colMapping.collectionName}-${field.sourceField}`,
          severity: 'warning',
          title: `Mixed Data Types Detected in Field "${field.sourceField}"`,
          description: `Field "${field.sourceField}" in "${colMapping.collectionName}" contains mixed polymorphic data types across sample documents (e.g. string and integer).`,
          suggestedFix: `Target type is mapped to ${field.targetType || 'TEXT'}. Ensure all values can be safely coerced or keep as JSONB to preserve structural variants.`,
          autoFixAvailable: false,
          affectedTable: colMapping.targetTableName || colMapping.collectionName,
          affectedField: field.targetColumn || field.sourceField,
        });
      }
    }
  }

  // ── RULE 6 (🟡 Warning): Target Table / Collection Collision ───────────────
  if (existingTargetTables.length > 0) {
    for (const colMapping of mapping) {
      const targetEntity = colMapping.targetTableName || colMapping.collectionName;
      if (existingTargetTables.includes(targetEntity.toLowerCase())) {
        const isMongoTarget = direction === 'postgres-to-mongo';
        const entityLabel = isMongoTarget ? 'Collection' : 'Table';
        const dbLabel = isMongoTarget ? 'MongoDB' : 'PostgreSQL';

        risks.push({
          id: `risk-table-collision-${targetEntity}`,
          severity: 'warning',
          title: `Target ${dbLabel} Already Contains ${entityLabel} "${targetEntity}"`,
          description: `The destination ${dbLabel} database already contains an existing ${entityLabel.toLowerCase()} named "${targetEntity}". Running this migration will alter or append to existing data.`,
          suggestedFix: `Verify that target data can be safely overwritten or rename the target ${entityLabel.toLowerCase()} in Step 4 Schema Mapper.`,
          autoFixAvailable: false,
          affectedTable: targetEntity,
        });
      }
    }
  }

  // ── RULE 10 (ℹ️ Info for PostgreSQL -> MongoDB): Relational FK to Reference ID
  if (direction === 'postgres-to-mongo') {
    for (const colMapping of mapping) {
      for (const field of colMapping.fields) {
        if (field.foreignKeyToParent) {
          risks.push({
            id: `risk-pg-fk-${colMapping.collectionName}-${field.sourceField}`,
            severity: 'info',
            title: `Relational Foreign Key Mapped as Reference Field: ${colMapping.collectionName}.${field.sourceField}`,
            description: `PostgreSQL relational constraint referencing "${field.foreignKeyToParent}" will be stored as an ID reference field in MongoDB. Referential integrity can be maintained via Mongoose populate or $lookup pipelines.`,
            suggestedFix: `Reference field "${field.targetColumn}" can be indexed for accelerated $lookup joins.`,
            autoFixAvailable: false,
            affectedTable: colMapping.targetTableName || colMapping.collectionName,
            affectedField: field.targetColumn || field.sourceField,
          });
        }
      }
    }
  }

  // ── RULE 7 (🟡 Warning): Large Binary Data / Doc Size > 100KB (Challenge 8)
  for (const colMapping of mapping) {
    const srcSchema = schemaMap.get(colMapping.collectionName);
    const avgDocSizeBytes = docSizeAverages[colMapping.collectionName] || 0;
    const avgDocSizeKb = Math.round(avgDocSizeBytes / 1024);

    const hasBinaryField = colMapping.fields.some((f) => {
      const srcField = srcSchema?.fields.find((sf) => sf.name === f.sourceField);
      return (
        f.sourceType.toLowerCase() === 'binary' ||
        f.targetType.toUpperCase().includes('BYTEA') ||
        srcField?.bsonType.toLowerCase() === 'binary'
      );
    });

    if (hasBinaryField || avgDocSizeKb > 100) {
      recommendedBatchSize = 50;
      const sizeStr = avgDocSizeKb > 0 ? `${avgDocSizeKb}KB` : '>100KB';

      const autoFix: AutoFixAction = {
        type: 'reduce_batch_size',
        collectionName: colMapping.collectionName,
        recommendedValue: 50,
        description: 'Auto-reduce streaming batch size to 50 documents',
      };

      risks.push({
        id: `risk-large-binary-${colMapping.collectionName}`,
        severity: 'warning',
        title: `Large Binary Fields Detected (${sizeStr} avg doc size): ${colMapping.collectionName}`,
        description: `Collection "${colMapping.collectionName}" contains large binary data or documents exceeding 100KB average size. Streaming 500 documents simultaneously will spike Electron process memory.`,
        suggestedFix: `Recommended batch size is automatically reduced to 50 for this collection to maintain steady streaming throughput without RAM exhaustion.`,
        autoFixAvailable: true,
        autoFixAction: autoFix,
        affectedTable: colMapping.targetTableName || colMapping.collectionName,
      });
    }
  }

  // ── RULE 8 (ℹ️ Info): Flattened Nested Objects ────────────────────────────
  for (const colMapping of mapping) {
    for (const field of colMapping.fields) {
      if (field.sourceField.includes('.') || field.targetColumn.includes('_')) {
        const parts = field.sourceField.split('.');
        if (parts.length > 1) {
          risks.push({
            id: `risk-flattened-${colMapping.collectionName}-${field.sourceField}`,
            severity: 'info',
            title: `Nested Object Field Flattened: "${field.sourceField}" → "${field.targetColumn}"`,
            description: `The embedded object path "${field.sourceField}" was flattened into column "${field.targetColumn}". This relational structure is safe and expected.`,
            suggestedFix: `Update your application queries to reference "${field.targetColumn}" instead of "${field.sourceField}".`,
            autoFixAvailable: false,
            affectedTable: colMapping.targetTableName || colMapping.collectionName,
            affectedField: field.targetColumn,
          });
        }
      }
    }
  }

  // ── RULE 9 (ℹ️ Info): GIN Index Creation Candidate ────────────────────────
  for (const colMapping of mapping) {
    for (const idx of colMapping.indexes || []) {
      if (idx.isGin || idx.targetSql?.toUpperCase().includes('USING GIN')) {
        risks.push({
          id: `risk-gin-index-${colMapping.collectionName}-${idx.targetIndexName}`,
          severity: 'info',
          title: `GIN Index Candidate: ${idx.targetIndexName}`,
          description: `A Generalized Inverted Index (GIN) will be created for accelerated JSONB search on table "${colMapping.targetTableName || colMapping.collectionName}". Note: GIN indexes are slower to update on high-frequency write tables.`,
          suggestedFix: `Index will be created post-data load to avoid bulk insert speed degradation.`,
          autoFixAvailable: false,
          affectedTable: colMapping.targetTableName || colMapping.collectionName,
        });
      }
    }
  }

  // Tally severities
  const criticalCount = risks.filter((r) => r.severity === 'critical' && !r.fixed && !r.acknowledged).length;
  const warningCount = risks.filter((r) => r.severity === 'warning' && !r.fixed).length;
  const infoCount = risks.filter((r) => r.severity === 'info').length;

  return {
    risks,
    metrics: {
      criticalCount,
      warningCount,
      infoCount,
      recommendedBatchSize,
      hasCircularFk,
    },
  };
}
