/**
 * MigrateIQ - Risk Analysis Engine (Step 5 Pre-Flight Verification)
 *
 * Implements 20 deterministic static analysis rules, relational cycle detection,
 * nullability validation, character encoding checks, numeric boundary analysis,
 * case-folding collision detection, and zero-code in-card remediation metadata.
 *
 * References:
 * - phase_plan-v2.md Lines 507-550 (Section 7.1)
 * - product_blueprint-v7.md Lines 782-960 (Step 5 Risk Report)
 * - documentation/phase-07-risk-report.md
 * - Research: Baazizi et al. (VLDB 2019), Frozza et al. (2018), AWS DMS rules, Fivetran type promotion
 */

import type {
  SourceSchema,
  CollectionMapping,
  RiskItem,
  AutoFixAction,
  RiskAnalysisResult,
  RiskInteractiveOption,
  SampleOffendingValue,
  ExistingTableDetails,
  StorageFootprintEstimate,
  CollectionHealthSummary,
} from '@migrateiq/shared';
import { PG_RESERVED_WORDS } from './ruleEngine';

export interface RiskAnalysisInput {
  sourceSchema: SourceSchema[];
  mapping: CollectionMapping[];
  direction?: 'mongodb-to-postgres' | 'postgres-to-mongo';
  existingTargetTables?: string[];
  existingTargetTableDetails?: Record<string, ExistingTableDetails>;
  missingFkIndexes?: Record<string, { childTable: string; fkColumn: string; parentTable: string }[]>;
  stringLengthViolations?: Record<string, { field: string; maxLen: number; targetLimit: number }[]>;
  reservedWordWarnings?: Record<string, { field: string; word: string; category: 'table' | 'column' }[]>;
  sampleOffendingRecords?: Record<string, Record<string, SampleOffendingValue[]>>;
  storageStats?: { sourceSizeBytes: number; targetEstimatedBytes: number; multiplier: number };
  docSizeAverages?: Record<string, number>; // in bytes
  fieldMissingCounts?: Record<string, Record<string, number>>; // collection -> field -> missing count
  fieldOverflows?: Record<string, string[]>; // collection -> field names exceeding 2.14B int limit
  fieldNullBytes?: Record<string, string[]>; // collection -> field names containing raw \0 bytes
  fieldNumericSpecials?: Record<string, Record<string, string[]>>; // collection -> field -> ('NaN'|'Infinity'|'-Infinity')[]
  caseFoldingCollisions?: Record<string, { col1: string; col2: string; target: string }[]>; // collection -> pairs
  unorthodoxIdentifiers?: Record<string, { field: string; sanitized: string }[]>; // collection -> fields
  orphanForeignKeys?: Record<string, { field: string; foreignTable: string; missingCount: number }[]>; // collection -> orphan FK info
  deepNestingFields?: Record<string, { field: string; depth: number }[]>; // collection -> depth > 3
  sparseArrayFields?: Record<string, string[]>; // collection -> fields with nulls inside arrays
  nestedArrayOfArrays?: Record<string, string[]>; // collection -> fields with multi-dimensional arrays
  timezoneHazards?: Record<string, string[]>; // collection -> date fields mapped to timestamp without timezone
  jsonbAdvisories?: Record<string, string[]>; // collection -> fields mapped to plain JSON instead of JSONB
}

export type RiskAnalysisOutput = RiskAnalysisResult;

/**
 * Detect cycles in a directed foreign key graph using Tarjan's Strongly Connected Components (SCC).
 * Returns arrays of table names involved in circular references, if any.
 */
export function detectFkCycles(mappings: CollectionMapping[]): string[][] {
  const graph = new Map<string, Set<string>>();

  for (const collection of mappings) {
    const table = collection.targetTableName || collection.collectionName;
    if (!graph.has(table)) graph.set(table, new Set());

    // Check fields for foreign keys or child tables
    for (const field of collection.fields) {
      if (field.foreignKeyToParent) {
        const referencedTable = field.foreignKeyToParent.split('.')[0] || field.foreignKeyToParent;
        if (!graph.has(table)) graph.set(table, new Set());
        graph.get(table)!.add(referencedTable);
      }
      if (field.isChildTable && field.childTableName) {
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

  interface GraphNode {
    index: number;
    lowLink: number;
    onStack: boolean;
  }

  const nodes = new Map<string, GraphNode>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let index = 0;

  function strongconnect(v: string) {
    nodes.set(v, { index, lowLink: index, onStack: true });
    index++;
    stack.push(v);

    const neighbors = graph.get(v) || new Set<string>();
    for (const w of neighbors) {
      if (!nodes.has(w)) {
        strongconnect(w);
        const nodeV = nodes.get(v)!;
        const nodeW = nodes.get(w)!;
        nodeV.lowLink = Math.min(nodeV.lowLink, nodeW.lowLink);
      } else {
        const nodeW = nodes.get(w)!;
        if (nodeW.onStack) {
          const nodeV = nodes.get(v)!;
          nodeV.lowLink = Math.min(nodeV.lowLink, nodeW.index);
        }
      }
    }

    const nodeV = nodes.get(v)!;
    if (nodeV.lowLink === nodeV.index) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        const nodeW = nodes.get(w)!;
        nodeW.onStack = false;
        scc.push(w);
      } while (w !== v);

      if (scc.length > 1) {
        sccs.push(scc);
      } else if (graph.get(v)?.has(v)) {
        sccs.push([v, v]);
      }
    }
  }

  for (const node of graph.keys()) {
    if (!nodes.has(node)) {
      strongconnect(node);
    }
  }

  return sccs;
}

/**
 * Main Risk Analyzer function. Evaluates 20 deterministic rules against
 * the source schema, sampling telemetry, and mapping configuration.
 */
export function analyzeRisks(input: RiskAnalysisInput): RiskAnalysisOutput {
  const {
    sourceSchema,
    mapping,
    direction = 'mongodb-to-postgres',
    existingTargetTables = [],
    existingTargetTableDetails = {},
    missingFkIndexes = {},
    stringLengthViolations = {},
    reservedWordWarnings = {},
    sampleOffendingRecords = {},
    storageStats,
    docSizeAverages = {},
    fieldMissingCounts = {},
    fieldOverflows = {},
    fieldNullBytes = {},
    fieldNumericSpecials = {},
    caseFoldingCollisions = {},
    unorthodoxIdentifiers = {},
    orphanForeignKeys = {},
    deepNestingFields = {},
    sparseArrayFields = {},
    nestedArrayOfArrays = {},
    timezoneHazards = {},
    jsonbAdvisories = {},
  } = input;

  const risks: RiskItem[] = [];
  let recommendedBatchSize = 500;
  let hasCircularFk = false;

  const schemaMap = new Map<string, SourceSchema>();
  for (const s of sourceSchema) {
    schemaMap.set(s.collectionName, s);
  }

  // ── RULE 1 (🔴 Critical): Unmapped Array-of-Objects ───────────────────────
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
            description: `Split "${field.sourceField}" into a relational child table with sort_order`,
          };

          const options: RiskInteractiveOption[] = [
            {
              label: 'Create Relational Child Table (Recommended)',
              value: 'create_child_table',
              description: `Creates "${colMapping.collectionName}_${field.sourceField}" with foreign key and index.`,
              tradeoff: 'Normalizes into relational child table with foreign key; maintains 1NF.',
              actionType: 'create_child_table',
            },
            {
              label: 'Store as JSONB Column',
              value: 'change_column_type',
              description: 'Preserves the raw array as a JSON document column inside the parent table.',
              tradeoff: 'Stores array in parent table; preserves raw structure, faster writes, slightly slower complex joins.',
              actionType: 'change_column_type',
            },
          ];

          risks.push({
            id: `risk-unmapped-array-${colMapping.collectionName}-${field.sourceField}`,
            severity: 'critical',
            category: 'relational',
            decisionTier: 'decision',
            actionCategory: 'schema_choice',
            title: `Array of Objects Cannot Be Stored in Scalar Column: ${colMapping.collectionName}.${field.sourceField}`,
            description: `The "${colMapping.collectionName}" collection has an "${field.sourceField}" field containing an array of objects. PostgreSQL cannot store object arrays in a relational table without normalization into a child table or JSONB serialization.`,
            suggestedFix: `Create a separate "${colMapping.collectionName}_${field.sourceField}" child table with foreign key and sort_order column, or store as JSONB.`,
            autoFixAvailable: true,
            autoFixAction: autoFix,
            affectedTable: colMapping.targetTableName || colMapping.collectionName,
            affectedField: field.targetColumn || field.sourceField,
            inputType: 'radio',
            options,
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

      if (!field.isNullable) {
        const srcField = srcSchema?.fields.find((f) => f.name === field.sourceField);
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

          const suggestedFallback = field.targetType.toUpperCase().includes('INT') || field.targetType.toUpperCase().includes('NUMERIC')
            ? '0'
            : field.targetType.toUpperCase().includes('BOOL')
            ? 'false'
            : 'N/A';

          const options: RiskInteractiveOption[] = [
            {
              label: 'Make Column Nullable (Allow NULL values)',
              value: 'nullable',
              description: 'Allows documents with missing values to be saved with NULL.',
              tradeoff: 'Allows documents with missing values to be saved as NULL; zero data lost.',
              actionType: 'set_nullable',
            },
            {
              label: `Assign Fallback Default Value (Keep NOT NULL)`,
              value: 'default_value',
              description: `Fills missing values with a default value (e.g. "${suggestedFallback}").`,
              tradeoff: 'Preserves strict NOT NULL column constraint by injecting fallback string or number.',
              actionType: 'set_default_value',
            },
          ];

          if (missingPct >= 5 || missingCount > 10) {
            risks.push({
              id: `risk-notnull-critical-${colMapping.collectionName}-${field.sourceField}`,
              severity: 'critical',
              category: 'data_integrity',
              decisionTier: 'decision',
              actionCategory: 'schema_choice',
              title: `Strict NOT NULL Column with Missing Field Documents: ${field.targetColumn || field.sourceField}`,
              description: `Approximately ${missingCount} out of ${totalDocs} documents in "${colMapping.collectionName}" have no value or are null for "${field.sourceField}". Target mapping marks this column as NOT NULL, which will cause immediate insertion failures.`,
              suggestedFix: `Change column to allow NULL, or assign a default fallback value.`,
              autoFixAvailable: true,
              autoFixAction: autoFix,
              affectedTable: colMapping.targetTableName || colMapping.collectionName,
              affectedField: field.targetColumn || field.sourceField,
              inputType: 'radio',
              options,
              defaultInputValue: suggestedFallback,
              inputPlaceholder: 'Enter default value...',
              sampleOffendingValues: sampleOffendingRecords[colMapping.collectionName]?.[field.sourceField] || [
                { docId: 'sample-doc-missing', value: null, label: 'Field missing or null in document' }
              ],
              transformationPreview: {
                before: `{ "_id": "...", "${field.sourceField}": undefined }`,
                after: `INSERT INTO "${colMapping.targetTableName || colMapping.collectionName}" ("${field.targetColumn || field.sourceField}") VALUES (NULL);`,
                explanation: 'Allows documents with missing values to be saved with NULL; zero data lost.',
              },
            });
          } else {
            risks.push({
              id: `risk-notnull-warn-${colMapping.collectionName}-${field.sourceField}`,
              severity: 'warning',
              category: 'data_integrity',
              decisionTier: 'decision',
              actionCategory: 'schema_choice',
              title: `Possible Null Values in NOT NULL Column: ${field.targetColumn || field.sourceField}`,
              description: `A small number of documents (~${missingCount}) in "${colMapping.collectionName}" may have missing values for "${field.sourceField}".`,
              suggestedFix: `Consider making column nullable or assigning a default fallback.`,
              autoFixAvailable: true,
              autoFixAction: autoFix,
              affectedTable: colMapping.targetTableName || colMapping.collectionName,
              affectedField: field.targetColumn || field.sourceField,
              inputType: 'radio',
              options,
              defaultInputValue: suggestedFallback,
              inputPlaceholder: 'Enter default value...',
              sampleOffendingValues: sampleOffendingRecords[colMapping.collectionName]?.[field.sourceField] || [
                { docId: 'sample-doc-missing', value: null, label: 'Field missing or null in document' }
              ],
              transformationPreview: {
                before: `{ "_id": "...", "${field.sourceField}": undefined }`,
                after: `INSERT INTO "${colMapping.targetTableName || colMapping.collectionName}" ("${field.targetColumn || field.sourceField}") VALUES (NULL);`,
                explanation: 'Allows documents with missing values to be saved with NULL; zero data lost.',
              },
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
        description: 'Defer all foreign key constraints until after data rows are inserted',
      };

      risks.push({
        id: `risk-circular-fk-${cycle.slice(0, 2).join('-')}`,
        severity: 'critical',
        category: 'relational',
        decisionTier: 'safe',
        actionCategory: 'remediation',
        title: `Circular Foreign Key Dependency Detected: ${cycle.slice(0, 2).join(' ↔ ')}`,
        description: `Tables have a circular relationship (${cyclePath}). Neither table can be populated before the other while foreign key constraints are enforced immediately.`,
        suggestedFix: `The migration engine will create tables without FK constraints first, insert all data rows, and add constraints post-data using ALTER TABLE ... ADD CONSTRAINT ... DEFERRABLE.`,
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
        const autoFix: AutoFixAction = {
          type: 'change_column_type',
          collectionName: colMapping.collectionName,
          fieldName: field.sourceField,
          recommendedValue: 'TEXT',
          description: `Map column to TEXT to preserve both string and numeric representations`,
        };

        const options: RiskInteractiveOption[] = [
          {
            label: 'Coerce all values to TEXT (Safe string representation)',
            value: 'TEXT',
            description: 'Preserves formatting like phone numbers (+1-555) without cast errors.',
            tradeoff: 'Converts all values to strings; guaranteed zero cast errors.',
            actionType: 'change_column_type',
          },
          {
            label: 'Preserve as JSONB (Full structural variety)',
            value: 'JSONB',
            description: 'Stores exact raw JSON representation of objects, numbers, and strings.',
            tradeoff: 'Preserves exact BSON/JSON types; requires JSONB query operators.',
            actionType: 'change_column_type',
          },
        ];

        risks.push({
          id: `risk-mixed-type-${colMapping.collectionName}-${field.sourceField}`,
          severity: 'warning',
          category: 'data_integrity',
          decisionTier: 'decision',
          actionCategory: 'schema_choice',
          title: `Mixed Data Types Detected in Field "${field.sourceField}"`,
          description: `Field "${field.sourceField}" in "${colMapping.collectionName}" contains mixed polymorphic data types across sample documents (e.g. string and integer).`,
          suggestedFix: `Select target column type (TEXT or JSONB) to prevent SQL cast errors during insertion.`,
          autoFixAvailable: true,
          autoFixAction: autoFix,
          affectedTable: colMapping.targetTableName || colMapping.collectionName,
          affectedField: field.targetColumn || field.sourceField,
          inputType: 'select',
          options,
          sampleOffendingValues: sampleOffendingRecords[colMapping.collectionName]?.[field.sourceField] || [
            { docId: 'sample-doc-1', value: 9820010013, label: 'Type: number' },
            { docId: 'sample-doc-2', value: '+1-9820010013', label: 'Type: string' }
          ],
          transformationPreview: {
            before: `Mixed: 9820010013 (number) vs "+1-9820010013" (string)`,
            after: `INSERT INTO ... ("${field.targetColumn || field.sourceField}") VALUES ('9820010013');`,
            explanation: 'Coerces all values to TEXT strings; guaranteed zero cast errors during insertion.',
          },
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

        const suggestedName = `${targetEntity}_migrated`;

        const options: RiskInteractiveOption[] = [
          {
            label: `Append Rows (Insert new rows into existing ${entityLabel.toLowerCase()})`,
            value: 'append',
            description: 'Existing data is kept; new records are appended.',
            tradeoff: 'Retains existing target records; appends imported rows.',
            actionType: 'set_table_action',
          },
          {
            label: `Drop & Recreate (Truncate existing ${entityLabel.toLowerCase()} before import)`,
            value: 'drop',
            description: `Wipes existing table "${targetEntity}" and loads fresh data.`,
            tradeoff: '⚠️ Destructive: Drops existing table and purges all previous records.',
            actionType: 'set_table_action',
          },
          {
            label: `Rename Target ${entityLabel} (Avoid conflict entirely)`,
            value: 'rename',
            description: `Renames target to "${suggestedName}".`,
            tradeoff: 'Zero conflict: Directs import to a newly named destination table.',
            actionType: 'rename_target_table',
          },
        ];

        const tblDetails = existingTargetTableDetails[targetEntity.toLowerCase()];
        const rowCountNote = tblDetails && tblDetails.rowCount > 0
          ? ` (contains ${tblDetails.rowCount.toLocaleString()} existing rows)`
          : '';

        risks.push({
          id: `risk-table-collision-${targetEntity.toLowerCase()}`,
          severity: 'warning',
          category: 'schema',
          decisionTier: 'destructive',
          actionCategory: 'destructive',
          title: `Target ${dbLabel} Already Contains ${entityLabel} "${targetEntity}"`,
          description: `The destination ${dbLabel} database already contains an existing ${entityLabel.toLowerCase()} named "${targetEntity}"${rowCountNote}. Choose how to handle this collision.`,
          suggestedFix: `Select whether to append data, overwrite/recreate the table, or rename the destination table.`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'set_table_action',
            collectionName: colMapping.collectionName,
            recommendedValue: 'append',
            description: `Set table collision handling for "${targetEntity}"`,
          },
          affectedTable: targetEntity,
          inputType: 'radio',
          options,
          defaultInputValue: suggestedName,
          inputPlaceholder: `Enter new ${entityLabel.toLowerCase()} name...`,
          existingTableDetails: tblDetails,
        });
      }
    }
  }

  // ── RULE 7 (🟡 Warning): Large Binary Data / Doc Size > 100KB ─────────────
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
        category: 'performance',
        decisionTier: 'safe',
        actionCategory: 'remediation',
        title: `Large Binary Fields Detected (${sizeStr} avg doc size): ${colMapping.collectionName}`,
        description: `Collection "${colMapping.collectionName}" contains large binary data or documents exceeding 100KB average size. Streaming 500 documents simultaneously will spike Electron process memory.`,
        suggestedFix: `Batch size is recommended to be 50 documents for this collection to maintain steady streaming throughput without RAM exhaustion.`,
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
            category: 'schema',
            decisionTier: 'safe',
            actionCategory: 'schema_choice',
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
          category: 'performance',
          decisionTier: 'safe',
          actionCategory: 'remediation',
          title: `GIN Index Candidate: ${idx.targetIndexName}`,
          description: `A Generalized Inverted Index (GIN) will be created for accelerated JSONB search on table "${colMapping.targetTableName || colMapping.collectionName}". Note: GIN indexes are slower to update on high-frequency write tables.`,
          suggestedFix: `Index will be created post-data load to avoid bulk insert speed degradation.`,
          autoFixAvailable: false,
          affectedTable: colMapping.targetTableName || colMapping.collectionName,
        });
      }
    }
  }

  // ── RULE 10 (ℹ️ Info for PostgreSQL -> MongoDB): Relational FK Reference ───
  if (direction === 'postgres-to-mongo') {
    for (const colMapping of mapping) {
      for (const field of colMapping.fields) {
        if (field.foreignKeyToParent) {
          risks.push({
            id: `risk-pg-fk-${colMapping.collectionName}-${field.sourceField}`,
            severity: 'info',
            category: 'relational',
            decisionTier: 'safe',
            actionCategory: 'schema_choice',
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

  // ── RULE 11 (🟡 Warning): Reserved SQL Words & Identifier Length (>63 bytes)
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const targetTable = (colMapping.targetTableName || colMapping.collectionName).trim();
      if (PG_RESERVED_WORDS.has(targetTable.toLowerCase())) {
        risks.push({
          id: `risk-reserved-table-${targetTable.toLowerCase()}`,
          severity: 'warning',
          category: 'schema',
          decisionTier: 'safe',
          actionCategory: 'remediation',
          title: `Target Table "${targetTable}" is a PostgreSQL Reserved Keyword`,
          description: `The table name "${targetTable}" is a reserved SQL keyword. Using unquoted "${targetTable}" in SQL queries will trigger syntax errors.`,
          suggestedFix: `Rename target table to "${targetTable}s" or enter custom name below.`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'rename_target_table',
            collectionName: colMapping.collectionName,
            recommendedValue: `${targetTable}s`,
            description: `Rename table to "${targetTable}s"`,
          },
          affectedTable: targetTable,
          inputType: 'text',
          defaultInputValue: `${targetTable}s`,
          inputPlaceholder: 'Enter sanitized table name...',
        });
      }

      if (targetTable.length > 63) {
        const shortened = targetTable.slice(0, 60) + '_t';
        risks.push({
          id: `risk-table-len-${targetTable.slice(0, 20)}`,
          severity: 'warning',
          category: 'schema',
          decisionTier: 'safe',
          actionCategory: 'remediation',
          title: `Target Table Name Exceeds 63-Byte Limit: "${targetTable}"`,
          description: `PostgreSQL identifiers are capped at 63 bytes (NAMEDATALEN - 1). Names longer than 63 bytes are silently truncated to "${targetTable.slice(0, 63)}", risking collisions.`,
          suggestedFix: `Shorten the table name to under 63 characters.`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'rename_target_table',
            collectionName: colMapping.collectionName,
            recommendedValue: shortened,
            description: `Auto-shorten table name to "${shortened}"`,
          },
          affectedTable: targetTable,
          inputType: 'text',
          defaultInputValue: shortened,
          inputPlaceholder: 'Enter shortened table name...',
        });
      }

      for (const field of colMapping.fields) {
        if (!field.include) continue;
        const targetCol = (field.targetColumn || field.sourceField).trim();
        if (PG_RESERVED_WORDS.has(targetCol.toLowerCase())) {
          risks.push({
            id: `risk-reserved-col-${colMapping.collectionName}-${targetCol.toLowerCase()}`,
            severity: 'warning',
            category: 'schema',
            decisionTier: 'safe',
            actionCategory: 'remediation',
            title: `Target Column "${targetCol}" is a PostgreSQL Reserved Keyword`,
            description: `Column "${targetCol}" in table "${targetTable}" is a reserved SQL word. Unquoted queries referencing "${targetCol}" will fail with syntax errors.`,
            suggestedFix: `Rename column to "${targetCol}_col" or enter custom name below.`,
            autoFixAvailable: true,
            autoFixAction: {
              type: 'rename_target_column',
              collectionName: colMapping.collectionName,
              fieldName: field.sourceField,
              recommendedValue: `${targetCol}_col`,
              description: `Rename column to "${targetCol}_col"`,
            },
            affectedTable: targetTable,
            affectedField: targetCol,
            inputType: 'text',
            defaultInputValue: `${targetCol}_col`,
            inputPlaceholder: 'Enter sanitized column name...',
          });
        }

        if (targetCol.length > 63) {
          const shortenedCol = targetCol.slice(0, 60) + '_c';
          risks.push({
            id: `risk-col-len-${colMapping.collectionName}-${targetCol.slice(0, 20)}`,
            severity: 'warning',
            category: 'schema',
            decisionTier: 'safe',
            actionCategory: 'remediation',
            title: `Target Column Name Exceeds 63-Byte Limit: "${targetCol}"`,
            description: `PostgreSQL silently truncates column names exceeding 63 bytes to "${targetCol.slice(0, 63)}".`,
            suggestedFix: `Shorten the column name to under 63 characters.`,
            autoFixAvailable: true,
            autoFixAction: {
              type: 'rename_target_column',
              collectionName: colMapping.collectionName,
              fieldName: field.sourceField,
              recommendedValue: shortenedCol,
              description: `Auto-shorten column name to "${shortenedCol}"`,
            },
            affectedTable: targetTable,
            affectedField: targetCol,
            inputType: 'text',
            defaultInputValue: shortenedCol,
            inputPlaceholder: 'Enter shortened column name...',
          });
        }
      }
    }
  }

  // ── RULE 12 (🔴 Critical): Integer Overflow Risk (Int32 vs BigInt) ────────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const overflowCols = fieldOverflows[colMapping.collectionName] || [];
      for (const field of colMapping.fields) {
        if (!field.include || field.isChildTable) continue;
        const targetTypeUpper = (field.targetType || '').toUpperCase().trim();
        const isStandardInt = ['INTEGER', 'INT', 'INT4', 'SMALLINT', 'INT2'].includes(targetTypeUpper);

        if (overflowCols.includes(field.sourceField) && isStandardInt) {
          risks.push({
            id: `risk-overflow-${colMapping.collectionName}-${field.sourceField}`,
            severity: 'critical',
            category: 'data_integrity',
            decisionTier: 'safe',
            actionCategory: 'remediation',
            title: `Integer Overflow Hazard in Column "${field.targetColumn || field.sourceField}"`,
            description: `Sample documents in "${colMapping.collectionName}.${field.sourceField}" contain numeric values exceeding the 32-bit integer ceiling (2,147,483,647). Mapping to ${targetTypeUpper} will cause immediate PostgreSQL runtime error: "ERROR: integer out of range".`,
            suggestedFix: `Upgrade target column type from ${targetTypeUpper} to BIGINT (64-bit integer, safe up to 9.22 quintillion).`,
            autoFixAvailable: true,
            autoFixAction: {
              type: 'change_column_type',
              collectionName: colMapping.collectionName,
              fieldName: field.sourceField,
              recommendedValue: 'BIGINT',
              description: `Change "${field.targetColumn || field.sourceField}" to BIGINT`,
            },
            affectedTable: colMapping.targetTableName || colMapping.collectionName,
            affectedField: field.targetColumn || field.sourceField,
            sampleOffendingValues: sampleOffendingRecords[colMapping.collectionName]?.[field.sourceField] || [
              { docId: 'sample-doc-overflow', value: 1716301289123, label: 'Exceeds 32-bit ceiling (2,147,483,647)' }
            ],
            transformationPreview: {
              before: `"${field.sourceField}": 1716301289123 (Number exceeding 2.14B)`,
              after: `"${field.targetColumn || field.sourceField}" BIGINT -> 1716301289123`,
              explanation: 'Upgrades column to 64-bit integer. Safe up to 9.22 quintillion; zero precision loss.',
            },
          });
        }
      }
    }
  }

  // ── RULE 13 (🔴 Critical): UTF-8 Raw Null Bytes (\0) in Strings ───────────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const nullCols = fieldNullBytes[colMapping.collectionName] || [];
      for (const colName of nullCols) {
        const field = colMapping.fields.find((f) => f.sourceField === colName);
        if (field && field.include) {
          risks.push({
            id: `risk-nullbyte-${colMapping.collectionName}-${colName}`,
            severity: 'critical',
            category: 'data_integrity',
            decisionTier: 'safe',
            actionCategory: 'remediation',
            title: `Fatal UTF-8 Null Byte (\\0) Detected in String Column: ${colName}`,
            description: `Sample documents in "${colMapping.collectionName}.${colName}" contain raw null characters (0x00). PostgreSQL's internal C-string parser terminates on \\0 and will immediately crash with "ERROR: invalid byte sequence for encoding UTF8: 0x00".`,
            suggestedFix: `Sanitize text values during ETL by stripping or replacing 0x00 null bytes before PostgreSQL insertion.`,
            autoFixAvailable: true,
            autoFixAction: {
              type: 'sanitize_null_bytes',
              collectionName: colMapping.collectionName,
              fieldName: colName,
              description: `Sanitize column "${colName}" by stripping raw \\0 null bytes`,
            },
            affectedTable: colMapping.targetTableName || colMapping.collectionName,
            affectedField: field.targetColumn || colName,
            sampleOffendingValues: sampleOffendingRecords[colMapping.collectionName]?.[colName] || [
              { docId: 'sample-doc-nullbyte', value: 'Cart\\0transaction approved', label: 'Contains 0x00 null byte' }
            ],
            transformationPreview: {
              before: '"Cart\\0transaction approved" (Terminates PostgreSQL C-string parser)',
              after: '"Carttransaction approved"',
              explanation: 'Strips raw 0x00 bytes before PostgreSQL insertion. Prevents UTF-8 crash.',
            },
          });
        }
      }
    }
  }

  // ── RULE 14 (🔴 Critical): NaN / ±Infinity in Numeric Fields ───────────────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const colSpecials = fieldNumericSpecials[colMapping.collectionName] || {};
      for (const [colName, specials] of Object.entries(colSpecials)) {
        const field = colMapping.fields.find((f) => f.sourceField === colName);
        if (field && field.include) {
          const hasInfinity = specials.includes('Infinity') || specials.includes('-Infinity');
          const isNumeric = field.targetType.toUpperCase().includes('NUMERIC') || field.targetType.toUpperCase().includes('DECIMAL');

          if (hasInfinity && isNumeric) {
            const options: RiskInteractiveOption[] = [
              {
                label: 'Upgrade Column to DOUBLE PRECISION (Preserves Infinity)',
                value: 'DOUBLE PRECISION',
                description: 'PostgreSQL DOUBLE PRECISION natively supports Infinity and -Infinity.',
                tradeoff: 'Natively stores Infinity without rejection; 8-byte floating point representation.',
                actionType: 'change_column_type',
              },
              {
                label: 'Coerce Infinity to NULL during ETL',
                value: 'nullify',
                description: 'Keeps NUMERIC precision and converts infinite values to SQL NULL.',
                tradeoff: 'Retains NUMERIC precision; converts unbounded infinity to SQL NULL.',
                actionType: 'resolve_numeric_special',
              },
            ];

            risks.push({
              id: `risk-infinity-${colMapping.collectionName}-${colName}`,
              severity: 'critical',
              category: 'data_integrity',
              decisionTier: 'decision',
              actionCategory: 'safety_strategy',
              title: `PostgreSQL NUMERIC Incompatible with Infinity in "${colName}"`,
              description: `Field "${colMapping.collectionName}.${colName}" contains infinite values (${specials.join(', ')}). While PostgreSQL NUMERIC supports NaN, it strictly rejects Infinity and will abort insertion.`,
              suggestedFix: `Upgrade target column type to DOUBLE PRECISION or coerce Infinity values to NULL.`,
              autoFixAvailable: true,
              autoFixAction: {
                type: 'change_column_type',
                collectionName: colMapping.collectionName,
                fieldName: colName,
                recommendedValue: 'DOUBLE PRECISION',
                description: `Upgrade "${colName}" to DOUBLE PRECISION`,
              },
              affectedTable: colMapping.targetTableName || colMapping.collectionName,
              affectedField: field.targetColumn || colName,
              inputType: 'radio',
              options,
            });
          }
        }
      }
    }
  }

  // ── RULE 15 (🔴 Critical): PostgreSQL Case-Folding Column Collisions ──────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const collisions = caseFoldingCollisions[colMapping.collectionName] || [];
      for (const item of collisions) {
        const targetCol = item.col2;
        const proposedAlt = `${targetCol}_alt`;

        risks.push({
          id: `risk-casefold-${colMapping.collectionName}-${item.target}`,
          severity: 'critical',
          category: 'schema',
          decisionTier: 'decision',
          actionCategory: 'schema_choice',
          title: `Case-Folding Identifier Collision: "${item.col1}" vs "${item.col2}"`,
          description: `MongoDB allows fields that differ only by case ("${item.col1}" and "${item.col2}"). PostgreSQL folds unquoted column names to lowercase ("${item.target}"), causing a duplicate column creation failure.`,
          suggestedFix: `Rename one of the colliding columns to a unique name like "${proposedAlt}".`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'rename_target_column',
            collectionName: colMapping.collectionName,
            fieldName: item.col2,
            recommendedValue: proposedAlt,
            description: `Rename duplicate column to "${proposedAlt}"`,
          },
          affectedTable: colMapping.targetTableName || colMapping.collectionName,
          affectedField: item.col2,
          inputType: 'text',
          defaultInputValue: proposedAlt,
          inputPlaceholder: 'Enter unique column name...',
        });
      }
    }
  }

  // ── RULE 16 (🟡 Warning): Unorthodox Identifier Names ─────────────────────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const items = unorthodoxIdentifiers[colMapping.collectionName] || [];
      for (const item of items) {
        risks.push({
          id: `risk-unorthodox-${colMapping.collectionName}-${item.field}`,
          severity: 'warning',
          category: 'schema',
          decisionTier: 'safe',
          actionCategory: 'remediation',
          title: `Special Characters in Column Name: "${item.field}"`,
          description: `Field name "${item.field}" contains hyphens, dots, leading numbers, or symbols. In PostgreSQL, this requires constant double-quoting in SQL queries.`,
          suggestedFix: `Sanitize column name to standard snake_case: "${item.sanitized}".`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'rename_target_column',
            collectionName: colMapping.collectionName,
            fieldName: item.field,
            recommendedValue: item.sanitized,
            description: `Sanitize column name to "${item.sanitized}"`,
          },
          affectedTable: colMapping.targetTableName || colMapping.collectionName,
          affectedField: item.field,
          inputType: 'text',
          defaultInputValue: item.sanitized,
          inputPlaceholder: 'Enter sanitized column name...',
        });
      }
    }
  }

  // ── RULE 17 (🔴 Critical): Orphan Foreign Key References in Sample ────────
  for (const colMapping of mapping) {
    const orphans = orphanForeignKeys[colMapping.collectionName] || [];
    for (const item of orphans) {
      const options: RiskInteractiveOption[] = [
        {
          label: 'Configure Foreign Key with ON DELETE SET NULL',
          value: 'set_null',
          description: 'Nullifies broken reference links without blocking valid rows.',
          tradeoff: 'Validates relational constraints; sets unlinked foreign keys to NULL.',
          actionType: 'resolve_orphan_fk',
        },
        {
          label: 'Keep Column as Indexed Reference without Strict Constraint',
          value: 'remove_constraint',
          description: 'Allows historical records to persist without relational constraint violation.',
          tradeoff: 'Stores raw parent ID without constraint enforcement; zero records blocked.',
          actionType: 'resolve_orphan_fk',
        },
      ];

      risks.push({
        id: `risk-orphan-${colMapping.collectionName}-${item.field}`,
        severity: 'critical',
        category: 'relational',
        decisionTier: 'decision',
        actionCategory: 'safety_strategy',
        title: `Orphan Foreign References in Column: ${colMapping.collectionName}.${item.field}`,
        description: `Sample documents contain reference values for "${item.field}" pointing to "${item.foreignTable}", but ~${item.missingCount} parent IDs do not exist in the destination. Strict PostgreSQL foreign keys will reject these rows.`,
        suggestedFix: `Configure FK with ON DELETE SET NULL or keep as an unconstrained indexed column.`,
        autoFixAvailable: true,
        autoFixAction: {
          type: 'resolve_orphan_fk',
          collectionName: colMapping.collectionName,
          fieldName: item.field,
          recommendedValue: 'set_null',
          description: `Add ON DELETE SET NULL for foreign key on "${item.field}"`,
        },
        affectedTable: colMapping.targetTableName || colMapping.collectionName,
        affectedField: item.field,
        inputType: 'radio',
        options,
        sampleOffendingValues: [
          { docId: 'sample-child-doc', value: `Parent ID missing in "${item.foreignTable}"`, label: 'Unresolvable Foreign Reference' }
        ],
        transformationPreview: {
          before: `{ "${item.field}": "unmatched_parent_id" }`,
          after: `INSERT INTO ... ("${item.field}") VALUES (NULL);`,
          explanation: 'Foreign key set to NULL with ON DELETE SET NULL: preserves record without constraint failure.',
        },
      });
    }
  }

  // ── RULE 18 (ℹ️ Info): Deep Nesting Hierarchy (>3 Levels) ──────────────────
  for (const colMapping of mapping) {
    const deepFields = deepNestingFields[colMapping.collectionName] || [];
    for (const item of deepFields) {
      const options: RiskInteractiveOption[] = [
        {
          label: 'Preserve as JSONB with GIN Index (Recommended)',
          value: 'jsonb',
          description: 'Keeps entire subtree intact with fast nested query capability.',
          tradeoff: 'Keeps entire hierarchy intact without creating 20+ columns; queryable with GIN.',
          actionType: 'change_column_type',
        },
        {
          label: 'Flatten into Relational Columns',
          value: 'flatten',
          description: 'Unwinds sub-properties into prefixed columns.',
          tradeoff: 'Unnests every property into prefixed columns (e.g. meta_user_agent_os_ver).',
          actionType: 'set_nullable',
        },
      ];

      risks.push({
        id: `risk-deep-nesting-${colMapping.collectionName}-${item.field}`,
        severity: 'info',
        category: 'schema',
        decisionTier: 'decision',
        actionCategory: 'schema_choice',
        title: `Deeply Nested Object (${item.depth} Levels): "${item.field}"`,
        description: `Object hierarchy exceeds 3 levels of nesting. Relational flattening can cause wide tables and long column names.`,
        suggestedFix: `Preserve as a JSONB column with GIN index or continue with relational flattening.`,
        autoFixAvailable: true,
        autoFixAction: {
          type: 'change_column_type',
          collectionName: colMapping.collectionName,
          fieldName: item.field,
          recommendedValue: 'JSONB',
          description: `Store deeply nested "${item.field}" as JSONB`,
        },
        affectedTable: colMapping.targetTableName || colMapping.collectionName,
        affectedField: item.field,
        inputType: 'radio',
        options,
      });
    }
  }

  // ── RULE 19 (🟡 Warning): Sparse Arrays with Embedded Nulls ───────────────
  for (const colMapping of mapping) {
    const sparseCols = sparseArrayFields[colMapping.collectionName] || [];
    for (const colName of sparseCols) {
      const options: RiskInteractiveOption[] = [
        {
          label: 'Filter Null Elements during ETL (Recommended)',
          value: 'filter_nulls',
          description: 'Strips out null elements from array before populating child table.',
          tradeoff: 'Omits null items during array unwinding; clean relational child table.',
          actionType: 'sanitize_sparse_array',
        },
        {
          label: 'Allow Null Elements with Sort Order',
          value: 'allow_nulls',
          description: 'Inserts null rows in child table preserving original array index.',
          tradeoff: 'Inserts null rows in child table to preserve strict index sort_order.',
          actionType: 'sanitize_sparse_array',
        },
      ];

      risks.push({
        id: `risk-sparse-array-${colMapping.collectionName}-${colName}`,
        severity: 'warning',
        category: 'data_integrity',
        decisionTier: 'decision',
        actionCategory: 'schema_choice',
        title: `Sparse Array with Null Elements in Field: "${colName}"`,
        description: `Array field "${colName}" in "${colMapping.collectionName}" contains null elements (e.g. [10, null, 25]). In relational child tables, null values can trigger NOT NULL errors if value column is constrained.`,
        suggestedFix: `Choose whether to filter out null elements or permit null rows with sort_order preserved.`,
        autoFixAvailable: true,
        autoFixAction: {
          type: 'sanitize_sparse_array',
          collectionName: colMapping.collectionName,
          fieldName: colName,
          recommendedValue: 'filter_nulls',
          description: `Filter null array elements from "${colName}"`,
        },
        affectedTable: colMapping.targetTableName || colMapping.collectionName,
        affectedField: colName,
        inputType: 'radio',
        options,
      });
    }
  }

  // ── RULE 20 (🔴 Critical): Missing Primary Key in Collection Mapping ──────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const hasPk = colMapping.fields.some(
        (f) =>
          f.include &&
          (f.sourceField === '_id' ||
            f.targetColumn === 'id' ||
            f.targetColumn === '_id' ||
            f.transformationRule === 'primary_key')
      );

      if (!hasPk) {
        risks.push({
          id: `risk-missing-pk-${colMapping.collectionName}`,
          severity: 'critical',
          category: 'relational',
          decisionTier: 'safe',
          actionCategory: 'remediation',
          title: `No Primary Key Defined for Target Table "${colMapping.targetTableName || colMapping.collectionName}"`,
          description: `The mapped table does not have an explicit primary key column. PostgreSQL tables require a primary key for deterministic replication, row updates, and index performance.`,
          suggestedFix: `Assign a synthetic UUID primary key or designate a unique column.`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'assign_primary_key',
            collectionName: colMapping.collectionName,
            recommendedValue: 'id',
            description: `Auto-create synthetic UUID primary key "id"`,
          },
          affectedTable: colMapping.targetTableName || colMapping.collectionName,
        });
      }
    }
  }

  // ── RULE 21 (🔴 Critical / 🟡 Warning): Target Schema Column Drift ──────────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const targetEntity = (colMapping.targetTableName || colMapping.collectionName).toLowerCase();
      const tblDetails = existingTargetTableDetails[targetEntity];
      if (tblDetails && tblDetails.columns && tblDetails.columns.length > 0) {
        const existingColNames = new Set(tblDetails.columns.map((c) => c.name.toLowerCase()));
        const mappedColNames = colMapping.fields
          .filter((f) => f.include && !f.isChildTable)
          .map((f) => (f.targetColumn || f.sourceField).toLowerCase());

        const missingInTarget = mappedColNames.filter((c) => !existingColNames.has(c));
        const extraInTarget = Array.from(existingColNames).filter((c) => !mappedColNames.includes(c));

        tblDetails.matchedColumns = mappedColNames.filter((c) => existingColNames.has(c));
        tblDetails.missingInTarget = missingInTarget;
        tblDetails.extraInTarget = extraInTarget;

        if (missingInTarget.length > 0) {
          risks.push({
            id: `risk-drift-missing-${targetEntity}`,
            severity: 'critical',
            category: 'schema',
            decisionTier: 'decision',
            actionCategory: 'schema_choice',
            title: `Target Table Schema Drift: ${missingInTarget.length} Missing Column(s) in "${targetEntity}"`,
            description: `The existing PostgreSQL table "${targetEntity}" is missing columns expected by your mapping: [${missingInTarget.join(', ')}]. Appending rows to this table will immediately fail with column does not exist errors.`,
            suggestedFix: `Choose whether to auto-generate ALTER TABLE statements, drop and recreate the table, or exclude the missing columns.`,
            autoFixAvailable: true,
            autoFixAction: {
              type: 'resolve_schema_drift',
              collectionName: colMapping.collectionName,
              recommendedValue: 'alter_add_columns',
              description: `Generate ALTER TABLE ADD COLUMN for missing fields`,
            },
            affectedTable: targetEntity,
            existingTableDetails: tblDetails,
            options: [
              {
                label: `Auto-Add Missing Columns (ALTER TABLE ADD COLUMN)`,
                value: 'alter_add_columns',
                description: `Executes ALTER TABLE ADD COLUMN for [${missingInTarget.join(', ')}] before data insertion.`,
                tradeoff: 'Preserves existing rows; expands table schema to accommodate source fields.',
                actionType: 'resolve_schema_drift',
              },
              {
                label: `Drop and Recreate Clean Table`,
                value: 'drop',
                description: `Purges existing table "${targetEntity}" and creates clean target schema.`,
                tradeoff: '⚠️ Destructive: Drops existing table and purges all previous records.',
                actionType: 'set_table_action',
              },
            ],
            transformationPreview: {
              before: `Existing Table "${targetEntity}": [${Array.from(existingColNames).join(', ')}]`,
              after: `ALTER TABLE "${targetEntity}" ADD COLUMN ...`,
              explanation: 'Expands existing target table schema so all incoming columns map 1:1.',
            },
          });
        }
      }
    }
  }

  // ── RULE 22 (🟡 Warning): Missing Foreign Key Index Advisor ────────────────
  if (direction === 'mongodb-to-postgres') {
    for (const [colName, fkList] of Object.entries(missingFkIndexes)) {
      for (const fkInfo of fkList) {
        const idxName = `idx_${fkInfo.childTable}_${fkInfo.fkColumn}`;
        risks.push({
          id: `risk-missing-fk-idx-${fkInfo.childTable}-${fkInfo.fkColumn}`,
          severity: 'warning',
          category: 'performance',
          decisionTier: 'safe',
          actionCategory: 'remediation',
          title: `Missing Performance Index on Child Table Foreign Key: ${fkInfo.childTable}.${fkInfo.fkColumn}`,
          description: `PostgreSQL does NOT automatically index foreign key columns. Any DELETE or UPDATE on parent table "${fkInfo.parentTable}" will trigger a slow FULL TABLE SCAN and lock child table "${fkInfo.childTable}".`,
          suggestedFix: `Create a B-Tree index on "${fkInfo.childTable}(${fkInfo.fkColumn})".`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'create_foreign_key_index',
            collectionName: colName,
            fieldName: fkInfo.fkColumn,
            recommendedValue: idxName,
            description: `Auto-create index "${idxName}" on foreign key`,
          },
          affectedTable: fkInfo.childTable,
          affectedField: fkInfo.fkColumn,
          transformationPreview: {
            before: `-- Missing index on FK column: ${fkInfo.fkColumn}`,
            after: `CREATE INDEX CONCURRENTLY "${idxName}" ON "${fkInfo.childTable}" ("${fkInfo.fkColumn}");`,
            explanation: 'Guarantees O(log N) indexed lookups and prevents table locks during parent updates.',
          },
        });
      }
    }
  }

  // ── RULE 23 (🔴 Critical): String Length Exceeds Target VARCHAR Limit ───────
  if (direction === 'mongodb-to-postgres') {
    for (const [colName, violations] of Object.entries(stringLengthViolations)) {
      for (const v of violations) {
        risks.push({
          id: `risk-varchar-len-${colName}-${v.field}`,
          severity: 'critical',
          category: 'data_integrity',
          decisionTier: 'safe',
          actionCategory: 'remediation',
          title: `String Length Exceeds VARCHAR Limit: ${v.field} (${v.maxLen} > ${v.targetLimit})`,
          description: `Sample documents contain string values with length ${v.maxLen}, exceeding mapped target type VARCHAR(${v.targetLimit}). PostgreSQL will abort insertion with "ERROR: value too long for type character varying(${v.targetLimit})".`,
          suggestedFix: `Promote column from VARCHAR(${v.targetLimit}) to TEXT (unbounded safe string).`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'promote_varchar_length',
            collectionName: colName,
            fieldName: v.field,
            recommendedValue: 'TEXT',
            description: `Promote "${v.field}" to TEXT to prevent truncation errors`,
          },
          affectedTable: colName,
          affectedField: v.field,
          sampleOffendingValues: [
            { docId: 'sample-doc-len', value: `String length: ${v.maxLen} characters`, label: `Exceeds VARCHAR(${v.targetLimit})` }
          ],
          transformationPreview: {
            before: `Type: VARCHAR(${v.targetLimit}) with string of length ${v.maxLen}`,
            after: `Type: TEXT (safe unbounded)`,
            explanation: 'Promoting to TEXT prevents string truncation without performance penalty in PostgreSQL.',
          },
        });
      }
    }
  }

  // ── RULE 24 (🟡 Warning): PostgreSQL Reserved Keyword in Identifier ─────────
  if (direction === 'mongodb-to-postgres') {
    for (const [colName, list] of Object.entries(reservedWordWarnings)) {
      for (const item of list) {
        const safeAlias = item.category === 'table' ? `${item.field}_records` : `${item.field}_val`;
        risks.push({
          id: `risk-reserved-word-${colName}-${item.field}`,
          severity: 'warning',
          category: 'schema',
          decisionTier: 'safe',
          actionCategory: 'remediation',
          title: `PostgreSQL Reserved Keyword in ${item.category === 'table' ? 'Table' : 'Column'} Name: "${item.field}"`,
          description: `"${item.field}" is a reserved SQL keyword in PostgreSQL. Queries will fail with syntax errors unless constantly wrapped in double quotes ("${item.field}"). This frequently causes ORM (Prisma, TypeORM, Drizzle) query compilation breakage.`,
          suggestedFix: `Sanitize to standard non-reserved alias "${safeAlias}" or ensure quotes are enforced.`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'sanitize_reserved_keyword',
            collectionName: colName,
            fieldName: item.field,
            recommendedValue: safeAlias,
            description: `Rename reserved identifier "${item.field}" to "${safeAlias}"`,
          },
          affectedTable: colName,
          affectedField: item.field,
          transformationPreview: {
            before: `"${item.field}" (Requires constant quoting; ORMs may fail)`,
            after: `"${safeAlias}" (Safe, standard identifier)`,
            explanation: 'Renaming reserved keywords ensures standard SQL compatibility across all clients.',
          },
        });
      }
    }
  }

  // ── RULE 25 (🟡 Warning): Multi-Dimensional Nested Arrays in Field ──────────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      const detectedFields = new Set<string>();
      if (nestedArrayOfArrays[colMapping.collectionName]) {
        nestedArrayOfArrays[colMapping.collectionName].forEach((f) => detectedFields.add(f));
      }
      for (const field of colMapping.fields) {
        if (!field.include) continue;
        if (field.sourceType === 'array_of_arrays' || (field.sourceType === 'array' && field.transformationRule === 'jsonb_array')) {
          detectedFields.add(field.sourceField);
        }
      }

      for (const fieldName of detectedFields) {
        risks.push({
          id: `risk-nested-array-${colMapping.collectionName}-${fieldName}`,
          severity: 'warning',
          category: 'schema',
          decisionTier: 'decision',
          actionCategory: 'schema_choice',
          title: `Multi-Dimensional Array in Field: "${fieldName}"`,
          description: `Field "${fieldName}" contains multi-dimensional nested arrays (e.g. [[1, 2], [3, 4]]). Relational tables cannot naturally model nested arrays without recursive child tables or storing as structured JSONB.`,
          suggestedFix: `Store as JSONB to preserve multi-dimensional array structure, or flatten into a 1D array.`,
          autoFixAvailable: true,
          autoFixAction: {
            type: 'change_column_type',
            collectionName: colMapping.collectionName,
            fieldName,
            recommendedValue: 'JSONB',
            description: `Store multi-dimensional array "${fieldName}" as JSONB`,
          },
          affectedTable: colMapping.targetTableName || colMapping.collectionName,
          affectedField: fieldName,
          inputType: 'radio',
          options: [
            {
              label: 'Store as JSONB (Preserves Matrix Structure)',
              value: 'JSONB',
              description: 'Preserves exact multi-dimensional array structure in binary JSON.',
              tradeoff: 'Preserves exact dimensions; queries use PostgreSQL JSON operators (->).',
              actionType: 'change_column_type',
            },
            {
              label: 'Flatten to 1D Array (TEXT[])',
              value: 'TEXT[]',
              description: 'Flattens sub-arrays into a single one-dimensional PostgreSQL array.',
              tradeoff: 'Enables native SQL array operations (ANY, unnest); loses inner grouping.',
              actionType: 'change_column_type',
            },
          ],
          transformationPreview: {
            before: `${fieldName}: [[1, 2], [3, 4]] (Multi-dimensional array)`,
            after: `ALTER TABLE "${colMapping.targetTableName || colMapping.collectionName}" ALTER COLUMN "${fieldName}" TYPE JSONB;`,
            explanation: 'Stores nested arrays safely without schema normalization crashes.',
          },
        });
      }
    }
  }

  // ── RULE 26 (🟡 Warning): Timezone & UTC Consistency Hazard ────────────────
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      for (const field of colMapping.fields) {
        if (!field.include) continue;
        const srcType = (field.sourceType || '').toLowerCase();
        const tgtType = (field.targetType || '').toUpperCase();
        const isDateField = srcType.includes('date') || srcType.includes('time') || field.sourceField.toLowerCase().endsWith('at') || field.sourceField.toLowerCase().endsWith('date');
        const isPlainTimestamp = tgtType === 'TIMESTAMP' || tgtType === 'TIMESTAMP WITHOUT TIME ZONE';
        const isExplicitHazard = timezoneHazards[colMapping.collectionName]?.includes(field.sourceField);

        if ((isDateField && isPlainTimestamp) || isExplicitHazard) {
          risks.push({
            id: `risk-timezone-hazard-${colMapping.collectionName}-${field.sourceField}`,
            severity: 'warning',
            category: 'data_integrity',
            decisionTier: 'safe',
            actionCategory: 'remediation',
            title: `Timezone Offset Loss on Date Field: "${field.sourceField}"`,
            description: `MongoDB BSON dates are strictly 64-bit UTC timestamps. Mapping to PostgreSQL "TIMESTAMP WITHOUT TIME ZONE" strips UTC offset and assumes PostgreSQL server local time, causing silent timestamp shifts.`,
            suggestedFix: `Upgrade target type to "TIMESTAMPTZ" (TIMESTAMP WITH TIME ZONE) to preserve exact UTC time across all timezones.`,
            autoFixAvailable: true,
            autoFixAction: {
              type: 'change_column_type',
              collectionName: colMapping.collectionName,
              fieldName: field.sourceField,
              recommendedValue: 'TIMESTAMPTZ',
              description: `Upgrade "${field.sourceField}" to TIMESTAMPTZ`,
            },
            affectedTable: colMapping.targetTableName || colMapping.collectionName,
            affectedField: field.sourceField,
            sampleOffendingValues: [
              { docId: 'sample-date-utc', value: '2026-09-26T10:00:00.000Z', label: 'MongoDB UTC Date' },
            ],
            transformationPreview: {
              before: `"${field.sourceField}" TIMESTAMP (Assumes server local time, loses UTC precision)`,
              after: `"${field.sourceField}" TIMESTAMPTZ (Guarantees exact UTC offset preservation)`,
              explanation: 'Preserves absolute point in time regardless of database server timezone configuration.',
            },
          });
        }
      }
    }
  }

  // ── RULE 27 (ℹ️ Info): PostgreSQL JSON vs JSONB Indexing Performance Advisor ──
  if (direction === 'mongodb-to-postgres') {
    for (const colMapping of mapping) {
      for (const field of colMapping.fields) {
        if (!field.include) continue;
        const tgtType = (field.targetType || '').trim().toUpperCase();
        const isExplicitJson = jsonbAdvisories[colMapping.collectionName]?.includes(field.sourceField);

        if (tgtType === 'JSON' || isExplicitJson) {
          risks.push({
            id: `risk-json-advisor-${colMapping.collectionName}-${field.sourceField}`,
            severity: 'info',
            category: 'performance',
            decisionTier: 'safe',
            actionCategory: 'remediation',
            title: `Sub-Optimal JSON Column Type: "${field.sourceField}" (Advise JSONB)`,
            description: `Column "${field.sourceField}" is mapped to PostgreSQL "JSON" which stores raw text and requires re-parsing on every query. "JSONB" stores parsed binary format and supports GIN indexing, sub-key lookups, and existential operators (@>, ?).`,
            suggestedFix: `Convert column type to "JSONB" for up to 10x faster query performance and GIN index support.`,
            autoFixAvailable: true,
            autoFixAction: {
              type: 'change_column_type',
              collectionName: colMapping.collectionName,
              fieldName: field.sourceField,
              recommendedValue: 'JSONB',
              description: `Convert "${field.sourceField}" to JSONB`,
            },
            affectedTable: colMapping.targetTableName || colMapping.collectionName,
            affectedField: field.sourceField,
            transformationPreview: {
              before: `"${field.sourceField}" JSON (Plain text, slow key lookups, no GIN indexes)`,
              after: `"${field.sourceField}" JSONB (Decomposed binary format, GIN index enabled)`,
              explanation: 'Enables high-performance GIN indexes and fast sub-document queries in PostgreSQL.',
            },
          });
        }
      }
    }
  }

  // Tally severities and compute Safety Score
  const criticalCount = risks.filter((r) => r.severity === 'critical' && !r.fixed && !r.acknowledged).length;
  const warningCount = risks.filter((r) => r.severity === 'warning' && !r.fixed).length;
  const infoCount = risks.filter((r) => r.severity === 'info').length;

  const safeRemediationCount = risks.filter((r) => r.decisionTier === 'safe' && !r.fixed).length;
  const pendingDecisionCount = risks.filter((r) => r.decisionTier === 'decision' && !r.fixed && !r.acknowledged).length;
  const destructiveCount = risks.filter((r) => r.decisionTier === 'destructive' && !r.fixed).length;

  // Category counts
  const categoryBreakdown = {
    dataIntegrity: risks.filter((r) => r.category === 'data_integrity').length,
    relational: risks.filter((r) => r.category === 'relational').length,
    schema: risks.filter((r) => r.category === 'schema').length,
    performance: risks.filter((r) => r.category === 'performance').length,
  };

  // Safety Score: 100 max, -15 per unresolved critical, -4 per unresolved warning
  const deductions = criticalCount * 15 + warningCount * 4;
  const safetyScore = Math.max(0, Math.min(100, 100 - deductions));

  const storageEstimate: StorageFootprintEstimate = storageStats
    ? {
        sourceSizeBytes: storageStats.sourceSizeBytes,
        targetEstimatedBytes: storageStats.targetEstimatedBytes,
        multiplier: storageStats.multiplier,
        explanation: `PostgreSQL tuples have 23-byte headers, MVCC tracking, and index trees. MongoDB WiredTiger compressed data expands by ~${Math.round((storageStats.multiplier - 1) * 100)}% on target disk.`,
      }
    : {
        sourceSizeBytes: 240000,
        targetEstimatedBytes: 331200,
        multiplier: 1.38,
        explanation: `PostgreSQL tuples have 23-byte headers, MVCC tracking, and index trees. Data expands by ~38% on target disk.`,
      };

  // Calculate collection health list
  const collectionHealth: CollectionHealthSummary[] = mapping.map((colMapping) => {
    const colName = colMapping.collectionName;
    const targetTableName = colMapping.targetTableName || colName;
    const srcSchema = schemaMap.get(colName);
    const documentCount = srcSchema?.documentCount ?? 100;
    const avgDocSizeBytes = docSizeAverages[colName] ?? 450;

    const colRisks = risks.filter((r) => (r.affectedTable === colName || r.affectedTable === targetTableName));
    const crit = colRisks.filter((r) => r.severity === 'critical' && !r.fixed && !r.acknowledged).length;
    const warn = colRisks.filter((r) => r.severity === 'warning' && !r.fixed).length;

    return {
      collectionName: colName,
      targetTableName,
      documentCount,
      avgDocSizeBytes,
      totalRisks: colRisks.length,
      criticalCount: crit,
      warningCount: warn,
      isReady: crit === 0 && warn === 0,
    };
  });

  // Calculate at-risk rows count across all collections
  let atRiskRowCount = 0;
  for (const r of risks) {
    if (r.severity === 'critical' && !r.fixed && !r.acknowledged) {
      if (r.id.includes('risk-not-null') && r.metadata?.missingCount) {
        atRiskRowCount += Number(r.metadata.missingCount);
      } else if (r.affectedTable) {
        const docCount = schemaMap.get(r.affectedTable)?.documentCount ?? 10;
        atRiskRowCount += Math.min(docCount, 15);
      }
    }
  }

  return {
    risks,
    layer2Features: [],
    metrics: {
      criticalCount,
      warningCount,
      infoCount,
      recommendedBatchSize,
      hasCircularFk,
      safetyScore,
      categoryBreakdown,
      storageEstimate,
      safeRemediationCount,
      pendingDecisionCount,
      destructiveCount,
      atRiskRowCount,
      collectionHealth,
    },
  };
}
