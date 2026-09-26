/**
 * Automated Verification Test for MigrateIQ Phase 7 - Risk Analysis Engine
 */

const { analyzeRisks, detectFkCycles } = require('../apps/desktop/dist-electron/engine/riskAnalyzer');
const { getDocumentFieldValue } = require('../apps/desktop/dist-electron/handlers/risk');

console.log('====================================================');
console.log('🧪 MigrateIQ Phase 7 - Risk Engine Verification Suite');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${message}`);
  }
}

// ── Test 1: Unmapped Array of Objects (🔴 Critical) ──────────────────────────
console.log('--- Test 1: Unmapped Array of Objects Detection ---');
const sampleSchema1 = [
  {
    collectionName: 'orders',
    documentCount: 50,
    fields: [
      { name: '_id', bsonType: 'ObjectId', isNullable: false, isArray: false },
      { name: 'orderNumber', bsonType: 'string', isNullable: false, isArray: false },
      { name: 'items', bsonType: 'arrayOfObjects', isNullable: false, isArray: true },
    ],
  },
];

const sampleMapping1 = [
  {
    collectionName: 'orders',
    targetTableName: 'orders',
    fields: [
      { id: '1', sourceField: 'orderNumber', sourceType: 'string', targetColumn: 'order_number', targetType: 'VARCHAR(50)', isNullable: false, include: true },
      { id: '2', sourceField: 'items', sourceType: 'arrayOfObjects', targetColumn: 'items', targetType: 'TEXT', isNullable: false, include: true, isChildTable: false },
    ],
    indexes: [],
  },
];

const result1 = analyzeRisks({
  sourceSchema: sampleSchema1,
  mapping: sampleMapping1,
  direction: 'mongodb-to-postgres',
});

const unmappedArrayRisk = result1.risks.find((r) => r.id.includes('risk-unmapped-array-orders-items'));
assert(unmappedArrayRisk !== undefined, 'Detected unmapped array-of-objects as risk');
assert(unmappedArrayRisk?.severity === 'critical', 'Unmapped array severity is CRITICAL');
assert(unmappedArrayRisk?.autoFixAction?.type === 'create_child_table', 'Auto-fix action is create_child_table');

// ── Test 2: NOT NULL with Missing/Null Documents (🔴 Critical) ───────────────
console.log('\n--- Test 2: Strict NOT NULL with Missing Documents ---');
const sampleSchema2 = [
  {
    collectionName: 'users',
    documentCount: 1240,
    fields: [
      { name: '_id', bsonType: 'ObjectId', isNullable: false, isArray: false },
      { name: 'email', bsonType: 'string', isNullable: true, isArray: false },
    ],
  },
];

const sampleMapping2 = [
  {
    collectionName: 'users',
    targetTableName: 'users',
    fields: [
      { id: 'u1', sourceField: 'email', sourceType: 'string', targetColumn: 'email', targetType: 'VARCHAR(255)', isNullable: false, include: true },
    ],
    indexes: [],
  },
];

const result2 = analyzeRisks({
  sourceSchema: sampleSchema2,
  mapping: sampleMapping2,
  direction: 'mongodb-to-postgres',
  fieldMissingCounts: {
    users: { email: 45 },
  },
});

const notNullRisk = result2.risks.find((r) => r.id.includes('risk-notnull-critical-users-email'));
assert(notNullRisk !== undefined, 'Detected NOT NULL column with 45 missing docs');
assert(notNullRisk?.severity === 'critical', 'NOT NULL violation is CRITICAL');
assert(notNullRisk?.autoFixAction?.type === 'set_nullable', 'Auto-fix action is set_nullable');

// ── Test 3: Circular Foreign Key Cycle Detection (🔴 Critical) ───────────────
console.log('\n--- Test 3: Circular Foreign Key Dependency Detection ---');
const sampleMapping3 = [
  {
    collectionName: 'users',
    targetTableName: 'users',
    fields: [
      { id: '1', sourceField: 'org_id', sourceType: 'string', targetColumn: 'org_id', targetType: 'INT', isNullable: true, include: true, foreignKeyToParent: 'organizations.id' },
    ],
    indexes: [],
  },
  {
    collectionName: 'organizations',
    targetTableName: 'organizations',
    fields: [
      { id: '2', sourceField: 'created_by', sourceType: 'string', targetColumn: 'created_by', targetType: 'INT', isNullable: true, include: true, foreignKeyToParent: 'users.id' },
    ],
    indexes: [],
  },
];

const cycles = detectFkCycles(sampleMapping3);
assert(cycles.length > 0, `Detected circular dependency cycle: ${cycles[0]?.join(' -> ')}`);

const result3 = analyzeRisks({
  sourceSchema: [],
  mapping: sampleMapping3,
});
const circularRisk = result3.risks.find((r) => r.severity === 'critical' && r.id.includes('risk-circular-fk'));
assert(circularRisk !== undefined, 'Circular FK flagged in risk analysis output');
assert(result3.metrics.hasCircularFk === true, 'Metrics hasCircularFk flag set to true');

// ── Test 4: Large Binary Data & Auto Batch Size Reduction (🟡 Warning) ────────
console.log('\n--- Test 4: Large Binary Data & Batch Size Reduction ---');
const sampleSchema4 = [
  {
    collectionName: 'product_catalog',
    documentCount: 500,
    fields: [
      { name: 'photo', bsonType: 'binary', isNullable: true, isArray: false },
    ],
  },
];

const sampleMapping4 = [
  {
    collectionName: 'product_catalog',
    targetTableName: 'product_catalog',
    fields: [
      { id: 'p1', sourceField: 'photo', sourceType: 'binary', targetColumn: 'photo_data', targetType: 'BYTEA', isNullable: true, include: true },
    ],
    indexes: [],
  },
];

const result4 = analyzeRisks({
  sourceSchema: sampleSchema4,
  mapping: sampleMapping4,
  docSizeAverages: {
    product_catalog: 245760, // 240 KB
  },
});

const binaryRisk = result4.risks.find((r) => r.id.includes('risk-large-binary-product_catalog'));
assert(binaryRisk !== undefined, 'Large binary data flagged as warning');
assert(binaryRisk?.severity === 'warning', 'Binary risk severity is WARNING');
assert(result4.metrics.recommendedBatchSize === 50, 'Recommended batch size auto-reduced to 50');

// ── Test 5: Target Table Collision (🟡 Warning) ──────────────────────────────
console.log('\n--- Test 5: Target Database Table Collision ---');
const result5 = analyzeRisks({
  sourceSchema: sampleSchema2,
  mapping: sampleMapping2,
  existingTargetTables: ['users', 'logs'],
});

const collisionRisk = result5.risks.find((r) => r.id.includes('risk-table-collision-users'));
assert(collisionRisk !== undefined, 'Existing target table collision detected');
assert(collisionRisk?.severity === 'warning', 'Table collision severity is WARNING');

// ── Test 6: Reserved Word Collision (🟡 Warning) ───────────────────────────
console.log('\n--- Test 6: PostgreSQL Reserved Word Collision ---');
const sampleSchema6 = [
  {
    collectionName: 'orders',
    documentCount: 10,
    fields: [{ name: '_id', bsonType: 'ObjectId', isNullable: false, isArray: false }],
  },
];
const sampleMapping6 = [
  {
    collectionName: 'orders',
    targetTableName: 'order', // reserved word!
    fields: [
      { id: 'f1', sourceField: 'user', sourceType: 'string', targetColumn: 'user', targetType: 'VARCHAR(50)', isNullable: true, include: true },
    ],
    indexes: [],
  },
];
const result6 = analyzeRisks({
  sourceSchema: sampleSchema6,
  mapping: sampleMapping6,
  direction: 'mongodb-to-postgres',
});
const reservedTableRisk = result6.risks.find((r) => r.id.includes('risk-reserved-table-order'));
const reservedColRisk = result6.risks.find((r) => r.id.includes('risk-reserved-col-orders-user'));
assert(reservedTableRisk !== undefined, 'Detected PostgreSQL reserved word table name');
assert(reservedTableRisk?.autoFixAction?.type === 'rename_target_table', 'Auto-fix action is rename_target_table');
assert(reservedColRisk !== undefined, 'Detected PostgreSQL reserved word column name');

// ── Test 7: Integer Overflow Hazard (🔴 Critical) ───────────────────────────
console.log('\n--- Test 7: Integer Overflow Hazard (>2.14 Billion) ---');
const sampleSchema7 = [
  {
    collectionName: 'metrics',
    documentCount: 100,
    fields: [{ name: '_id', bsonType: 'ObjectId', isNullable: false, isArray: false }],
  },
];
const sampleMapping7 = [
  {
    collectionName: 'metrics',
    targetTableName: 'metrics',
    fields: [
      { id: 'm1', sourceField: 'timestamp_ms', sourceType: 'int', targetColumn: 'timestamp_ms', targetType: 'INTEGER', isNullable: false, include: true },
    ],
    indexes: [],
  },
];
const result7 = analyzeRisks({
  sourceSchema: sampleSchema7,
  mapping: sampleMapping7,
  direction: 'mongodb-to-postgres',
  fieldOverflows: {
    metrics: ['timestamp_ms'],
  },
});
const overflowRisk = result7.risks.find((r) => r.id.includes('risk-overflow-metrics-timestamp_ms'));
assert(overflowRisk !== undefined, 'Detected integer overflow risk for timestamp_ms');
assert(overflowRisk?.severity === 'critical', 'Integer overflow severity is CRITICAL');
assert(overflowRisk?.autoFixAction?.type === 'change_column_type', 'Auto-fix action is change_column_type to BIGINT');

// ── Test 8: UTF-8 Raw Null Bytes in Strings (🔴 Critical) ────────────────────
console.log('\n--- Test 8: UTF-8 Raw Null Bytes Detection ---');
const result8 = analyzeRisks({
  sourceSchema: [{ collectionName: 'payloads', documentCount: 10, fields: [] }],
  mapping: [{
    collectionName: 'payloads',
    targetTableName: 'payloads',
    fields: [{ id: 'p1', sourceField: 'raw_text', sourceType: 'string', targetColumn: 'raw_text', targetType: 'TEXT', isNullable: false, include: true }],
  }],
  direction: 'mongodb-to-postgres',
  fieldNullBytes: {
    payloads: ['raw_text'],
  },
});
const nullByteRisk = result8.risks.find((r) => r.id.includes('risk-nullbyte-payloads-raw_text'));
assert(nullByteRisk !== undefined, 'Detected UTF-8 raw null byte risk in raw_text');
assert(nullByteRisk?.severity === 'critical', 'Null byte hazard severity is CRITICAL');
assert(nullByteRisk?.autoFixAction?.type === 'sanitize_null_bytes', 'Auto-fix action is sanitize_null_bytes');

// ── Test 9: NaN / Infinity in Numeric Fields (🔴 Critical) ───────────────────
console.log('\n--- Test 9: NaN / Infinity in Numeric Fields ---');
const result9 = analyzeRisks({
  sourceSchema: [{ collectionName: 'telemetry', documentCount: 50, fields: [] }],
  mapping: [{
    collectionName: 'telemetry',
    targetTableName: 'telemetry',
    fields: [{ id: 't1', sourceField: 'reading', sourceType: 'number', targetColumn: 'reading', targetType: 'NUMERIC(10,2)', isNullable: false, include: true }],
  }],
  direction: 'mongodb-to-postgres',
  fieldNumericSpecials: {
    telemetry: { reading: ['Infinity', 'NaN'] },
  },
});
const infinityRisk = result9.risks.find((r) => r.id.includes('risk-infinity-telemetry-reading'));
assert(infinityRisk !== undefined, 'Detected Infinity in NUMERIC column');
assert(infinityRisk?.severity === 'critical', 'Infinity hazard severity is CRITICAL');
assert(infinityRisk?.autoFixAction?.recommendedValue === 'DOUBLE PRECISION', 'Recommended type upgrade is DOUBLE PRECISION');

// ── Test 10: Case-Folding Identifier Collision (🔴 Critical) ─────────────────
console.log('\n--- Test 10: Case-Folding Identifier Collision ---');
const result10 = analyzeRisks({
  sourceSchema: [{ collectionName: 'accounts', documentCount: 20, fields: [] }],
  mapping: [{
    collectionName: 'accounts',
    targetTableName: 'accounts',
    fields: [
      { id: 'a1', sourceField: 'userName', sourceType: 'string', targetColumn: 'userName', targetType: 'TEXT', isNullable: false, include: true },
      { id: 'a2', sourceField: 'username', sourceType: 'string', targetColumn: 'username', targetType: 'TEXT', isNullable: false, include: true },
    ],
  }],
  direction: 'mongodb-to-postgres',
  caseFoldingCollisions: {
    accounts: [{ col1: 'userName', col2: 'username', target: 'username' }],
  },
});
const caseFoldRisk = result10.risks.find((r) => r.id.includes('risk-casefold-accounts-username'));
assert(caseFoldRisk !== undefined, 'Detected case-folding identifier collision');
assert(caseFoldRisk?.severity === 'critical', 'Case-folding collision severity is CRITICAL');
assert(caseFoldRisk?.autoFixAction?.recommendedValue === 'username_alt', 'Proposed unique column name is username_alt');

// ── Test 11: Unorthodox Identifier Names (🟡 Warning) ────────────────────────
console.log('\n--- Test 11: Unorthodox Identifier Names ---');
const result11 = analyzeRisks({
  sourceSchema: [{ collectionName: 'sales', documentCount: 10, fields: [] }],
  mapping: [{
    collectionName: 'sales',
    targetTableName: 'sales',
    fields: [{ id: 's1', sourceField: 'item-code', sourceType: 'string', targetColumn: 'item-code', targetType: 'TEXT', isNullable: false, include: true }],
  }],
  direction: 'mongodb-to-postgres',
  unorthodoxIdentifiers: {
    sales: [{ field: 'item-code', sanitized: 'item_code' }],
  },
});
const unorthodoxRisk = result11.risks.find((r) => r.id.includes('risk-unorthodox-sales-item-code'));
assert(unorthodoxRisk !== undefined, 'Detected special characters in column name');
assert(unorthodoxRisk?.autoFixAction?.recommendedValue === 'item_code', 'Sanitized name is snake_case item_code');

// ── Test 12: Orphan Foreign Key References (🔴 Critical) ─────────────────────
console.log('\n--- Test 12: Orphan Foreign Key References ---');
const result12 = analyzeRisks({
  sourceSchema: [{ collectionName: 'order_items', documentCount: 10, fields: [] }],
  mapping: [{
    collectionName: 'order_items',
    targetTableName: 'order_items',
    fields: [{ id: 'oi1', sourceField: 'order_id', sourceType: 'string', targetColumn: 'order_id', targetType: 'VARCHAR(64)', isNullable: false, include: true, foreignKeyToParent: 'orders.id' }],
  }],
  direction: 'mongodb-to-postgres',
  orphanForeignKeys: {
    order_items: [{ field: 'order_id', foreignTable: 'orders', missingCount: 4 }],
  },
});
const orphanRisk = result12.risks.find((r) => r.id.includes('risk-orphan-order_items-order_id'));
assert(orphanRisk !== undefined, 'Detected orphan foreign references');
assert(orphanRisk?.severity === 'critical', 'Orphan reference severity is CRITICAL');

// ── Test 13: Sparse Arrays with Null Elements (🟡 Warning) ───────────────────
console.log('\n--- Test 13: Sparse Arrays with Embedded Nulls ---');
const result13 = analyzeRisks({
  sourceSchema: [{ collectionName: 'sensors', documentCount: 10, fields: [] }],
  mapping: [{
    collectionName: 'sensors',
    targetTableName: 'sensors',
    fields: [{ id: 'sn1', sourceField: 'readings', sourceType: 'array', targetColumn: 'readings', targetType: 'INT[]', isNullable: false, include: true }],
  }],
  direction: 'mongodb-to-postgres',
  sparseArrayFields: {
    sensors: ['readings'],
  },
});
const sparseRisk = result13.risks.find((r) => r.id.includes('risk-sparse-array-sensors-readings'));
assert(sparseRisk !== undefined, 'Detected sparse array with embedded nulls');
assert(sparseRisk?.severity === 'warning', 'Sparse array severity is WARNING');

// ── Test 14: Safety Scorecard Metric Calculation ─────────────────────────────
console.log('\n--- Test 14: Safety Scorecard Calculation ---');
assert(typeof result8.metrics.safetyScore === 'number', 'Result includes numerical safetyScore');
assert(result8.metrics.safetyScore < 100, 'Safety score decreases when critical issues exist');
const cleanResult = analyzeRisks({
  sourceSchema: [{ collectionName: 'clean_table', documentCount: 10, fields: [] }],
  mapping: [{
    collectionName: 'clean_table',
    targetTableName: 'clean_table',
    fields: [{ id: 'c1', sourceField: '_id', sourceType: 'ObjectId', targetColumn: 'id', targetType: 'VARCHAR(64)', isNullable: false, include: true }],
  }],
  direction: 'mongodb-to-postgres',
});
assert(cleanResult.metrics.safetyScore === 100, 'Safety score is 100% when schema is completely clean');

// ── Test 15: Decision Tiers, Action Categories & Tradeoff Consequence Matrix ────
console.log('\n--- Test 15: Decision Tiers, Action Categories & Tradeoffs ---');
assert(unmappedArrayRisk?.decisionTier === 'decision', 'Unmapped array is tagged with decisionTier="decision"');
assert(unmappedArrayRisk?.actionCategory === 'schema_choice', 'Unmapped array is tagged with actionCategory="schema_choice"');
assert(
  unmappedArrayRisk?.options?.every((opt) => typeof opt.tradeoff === 'string' && opt.tradeoff.length > 0),
  'Unmapped array interactive options contain trade-off explanations'
);

assert(notNullRisk?.decisionTier === 'decision', 'NOT NULL conflict is tagged with decisionTier="decision"');
assert(notNullRisk?.actionCategory === 'schema_choice', 'NOT NULL conflict is tagged with actionCategory="schema_choice"');
assert(
  notNullRisk?.options?.every((opt) => typeof opt.tradeoff === 'string' && opt.tradeoff.length > 0),
  'NOT NULL conflict options contain trade-off explanations'
);

assert(unorthodoxRisk?.decisionTier === 'safe', 'Identifier sanitization is tagged with decisionTier="safe"');
assert(unorthodoxRisk?.actionCategory === 'remediation', 'Identifier sanitization is tagged with actionCategory="remediation"');

assert(orphanRisk?.decisionTier === 'decision', 'Orphan FK risk is tagged with decisionTier="decision"');
assert(orphanRisk?.actionCategory === 'safety_strategy', 'Orphan FK risk is tagged with actionCategory="safety_strategy"');

assert(collisionRisk?.decisionTier === 'destructive', 'Target table collision is tagged with decisionTier="destructive"');
assert(collisionRisk?.actionCategory === 'destructive', 'Target table collision is tagged with actionCategory="destructive"');
assert(
  collisionRisk?.options?.some((o) => o.value === 'drop' && typeof o.tradeoff === 'string'),
  'Destructive "drop" option includes clear trade-off warning'
);

// ── Test 16: Target Schema Column Drift (Rule 21) ────────────────────────────
console.log('\n--- Test 16: Target Schema Column Drift Detection (Rule 21) ---');
const result16 = analyzeRisks({
  sourceSchema: [{ collectionName: 'orders', documentCount: 10, fields: [] }],
  mapping: [{ collectionName: 'orders', targetTableName: 'orders', fields: [{ id: 'f1', sourceField: 'discount', sourceType: 'string', targetColumn: 'discount', targetType: 'TEXT', isNullable: true, include: true }] }],
  direction: 'mongodb-to-postgres',
  existingTargetTables: ['orders'],
  existingTargetTableDetails: {
    orders: {
      rowCount: 500,
      columns: [{ name: 'id', type: 'text', nullable: false }],
      missingInTarget: ['discount'],
    },
  },
});
const driftRisk = result16.risks.find((r) => r.id.includes('risk-drift-missing-orders'));
assert(driftRisk !== undefined, 'Target schema column drift flagged as risk');
assert(driftRisk?.severity === 'critical', 'Schema drift severity is CRITICAL');
assert(driftRisk?.autoFixAction?.type === 'resolve_schema_drift', 'Auto-fix action is resolve_schema_drift');

// ── Test 17: Missing Foreign Key Index Detection (Rule 22) ───────────────────
console.log('\n--- Test 17: Missing Foreign Key Index Detection (Rule 22) ---');
const result17 = analyzeRisks({
  sourceSchema: [{ collectionName: 'orders_items', documentCount: 50, fields: [] }],
  mapping: [{ collectionName: 'orders_items', targetTableName: 'orders_items', fields: [] }],
  direction: 'mongodb-to-postgres',
  missingFkIndexes: {
    orders_items: [{ childTable: 'orders_items', fkColumn: 'order_id', parentTable: 'orders' }],
  },
});
const missingFkRisk = result17.risks.find((r) => r.id.includes('risk-missing-fk-idx-orders_items-order_id'));
assert(missingFkRisk !== undefined, 'Missing foreign key index flagged as risk');
assert(missingFkRisk?.decisionTier === 'safe', 'Missing FK index is tagged as safe');
assert(missingFkRisk?.autoFixAction?.type === 'create_foreign_key_index', 'Auto-fix action is create_foreign_key_index');

// ── Test 18: Varchar Length Exceeded Detection (Rule 23) ─────────────────────
console.log('\n--- Test 18: Varchar Length Exceeded Detection (Rule 23) ---');
const result18 = analyzeRisks({
  sourceSchema: [{ collectionName: 'customers', documentCount: 30, fields: [] }],
  mapping: [{ collectionName: 'customers', targetTableName: 'customers', fields: [] }],
  direction: 'mongodb-to-postgres',
  stringLengthViolations: {
    customers: [{ field: 'company', maxLen: 78, targetLimit: 50 }],
  },
});
const varcharRisk = result18.risks.find((r) => r.id.includes('risk-varchar-len-customers-company'));
assert(varcharRisk !== undefined, 'VARCHAR limit violation flagged as risk');
assert(varcharRisk?.decisionTier === 'safe', 'VARCHAR promotion is tagged as safe');
assert(varcharRisk?.autoFixAction?.type === 'promote_varchar_length', 'Auto-fix action is promote_varchar_length');

// ── Test 19: Reserved Keyword Hazard Detection (Rule 24) ────────────────────
console.log('\n--- Test 19: PostgreSQL Reserved Keyword Hazard (Rule 24) ---');
const result19 = analyzeRisks({
  sourceSchema: [{ collectionName: 'orders', documentCount: 10, fields: [] }],
  mapping: [{ collectionName: 'orders', targetTableName: 'orders', fields: [] }],
  direction: 'mongodb-to-postgres',
  reservedWordWarnings: {
    orders: [{ field: 'order', word: 'order', category: 'column' }],
  },
});
const keywordRisk = result19.risks.find((r) => r.id.includes('risk-reserved-word-orders-order'));
assert(keywordRisk !== undefined, 'Reserved keyword hazard flagged as risk');
assert(keywordRisk?.decisionTier === 'safe', 'Reserved keyword aliasing is tagged as safe');
assert(keywordRisk?.autoFixAction?.type === 'sanitize_reserved_keyword', 'Auto-fix action is sanitize_reserved_keyword');

// ── Test 20: Enterprise Metrics & Capacity Planner Telemetry ────────────────
console.log('\n--- Test 20: Enterprise Metrics & Capacity Planner Telemetry ---');
const result20 = analyzeRisks({
  sourceSchema: [{ collectionName: 'customers', documentCount: 30, fields: [] }],
  mapping: [{ collectionName: 'customers', targetTableName: 'customers', fields: [] }],
  direction: 'mongodb-to-postgres',
  storageStats: { sourceSizeBytes: 1048576, targetEstimatedBytes: 1447034, multiplier: 1.38 },
  stringLengthViolations: {
    customers: [{ field: 'company', maxLen: 78, targetLimit: 50 }],
  },
  existingTargetTables: ['customers'],
});
assert(result20.metrics.storageEstimate !== undefined, 'Result includes storage footprint estimate');
assert(result20.metrics.storageEstimate?.multiplier === 1.38, 'Storage multiplier matches calculation');
assert(typeof result20.metrics.safeRemediationCount === 'number', 'Result includes safeRemediationCount');
assert(typeof result20.metrics.pendingDecisionCount === 'number', 'Result includes pendingDecisionCount');
assert(typeof result20.metrics.destructiveCount === 'number', 'Result includes destructiveCount');

// ── Test 21: Multi-Dimensional Nested Array Detection (Rule 25) ─────────────
console.log('\n--- Test 21: Multi-Dimensional Nested Array Detection (Rule 25) ---');
const result21 = analyzeRisks({
  sourceSchema: [{ collectionName: 'sensors', documentCount: 100, fields: [] }],
  mapping: [{
    collectionName: 'sensors',
    targetTableName: 'sensors',
    fields: [{ id: 'f1', sourceField: 'matrix', sourceType: 'array', targetColumn: 'matrix', targetType: 'TEXT[]', isNullable: true, include: true }],
  }],
  direction: 'mongodb-to-postgres',
  nestedArrayOfArrays: {
    sensors: ['matrix'],
  },
});
const matrixRisk = result21.risks.find((r) => r.id.includes('risk-nested-array-sensors-matrix'));
assert(matrixRisk !== undefined, 'Detected multi-dimensional nested array as risk');
assert(matrixRisk?.severity === 'warning', 'Multi-dimensional array severity is WARNING');
assert(matrixRisk?.autoFixAction?.type === 'change_column_type', 'Auto-fix action is change_column_type');
assert(matrixRisk?.autoFixAction?.recommendedValue === 'JSONB', 'Recommended type is JSONB');

// ── Test 22: Timezone & UTC Consistency Hazard (Rule 26) ─────────────────────
console.log('\n--- Test 22: Timezone & UTC Consistency Hazard (Rule 26) ---');
const result22 = analyzeRisks({
  sourceSchema: [{ collectionName: 'audit_logs', documentCount: 50, fields: [] }],
  mapping: [{
    collectionName: 'audit_logs',
    targetTableName: 'audit_logs',
    fields: [{ id: 'f1', sourceField: 'created_at', sourceType: 'Date', targetColumn: 'created_at', targetType: 'TIMESTAMP', isNullable: false, include: true }],
  }],
  direction: 'mongodb-to-postgres',
});
const tzRisk = result22.risks.find((r) => r.id.includes('risk-timezone-hazard-audit_logs-created_at'));
assert(tzRisk !== undefined, 'Detected timezone offset hazard on TIMESTAMP');
assert(tzRisk?.severity === 'warning', 'Timezone hazard severity is WARNING');
assert(tzRisk?.autoFixAction?.recommendedValue === 'TIMESTAMPTZ', 'Recommended type is TIMESTAMPTZ');

// ── Test 23: PostgreSQL JSON vs JSONB Performance Advisor (Rule 27) ──────────
console.log('\n--- Test 23: PostgreSQL JSON vs JSONB Performance Advisor (Rule 27) ---');
const result23 = analyzeRisks({
  sourceSchema: [{ collectionName: 'catalog', documentCount: 200, fields: [] }],
  mapping: [{
    collectionName: 'catalog',
    targetTableName: 'catalog',
    fields: [{ id: 'f1', sourceField: 'specs', sourceType: 'object', targetColumn: 'specs', targetType: 'JSON', isNullable: true, include: true }],
  }],
  direction: 'mongodb-to-postgres',
});
const jsonbRisk = result23.risks.find((r) => r.id.includes('risk-json-advisor-catalog-specs'));
assert(jsonbRisk !== undefined, 'Detected plain JSON column for indexing advice');
assert(jsonbRisk?.severity === 'info', 'JSON advisor severity is INFO');
assert(jsonbRisk?.autoFixAction?.recommendedValue === 'JSONB', 'Recommended type is JSONB');

// ── Test 25: Universal Nested Dot-Notation Value Extraction ─────────────────
console.log('\n--- Test 25: Universal Nested Dot-Notation Value Extraction ---');
const sampleNestedDoc = {
  customerId: 'CUST-101',
  'literal.dot.key': 'Literal Dot Value',
  address: {
    street: '12 MG Road',
    city: 'Bengaluru',
    geo: {
      coordinates: {
        lat: 12.9716,
        lng: 77.5946,
      },
    },
  },
  items: [
    { name: 'Mechanical Keyboard', qty: 2 },
    { name: 'Mousepad', qty: 1 },
  ],
  brokenParent: null,
};

assert(getDocumentFieldValue(sampleNestedDoc, 'customerId') === 'CUST-101', 'Direct scalar field retrieved');
assert(getDocumentFieldValue(sampleNestedDoc, 'literal.dot.key') === 'Literal Dot Value', 'Literal dot in key takes priority');
assert(getDocumentFieldValue(sampleNestedDoc, 'address.street') === '12 MG Road', '1-level nested dot path retrieved');
assert(getDocumentFieldValue(sampleNestedDoc, 'address.city') === 'Bengaluru', 'Sibling nested dot path retrieved');
assert(getDocumentFieldValue(sampleNestedDoc, 'address.geo.coordinates.lat') === 12.9716, 'Deep 4-level nested dot path retrieved');
assert(getDocumentFieldValue(sampleNestedDoc, 'brokenParent.child.field') === undefined, 'Null intermediate path returns undefined without throwing');
assert(getDocumentFieldValue(sampleNestedDoc, 'nonexistent.path') === undefined, 'Non-existent path returns undefined');
assert(getDocumentFieldValue(sampleNestedDoc, 'items.0.name') === 'Mechanical Keyboard', 'Array index dot navigation retrieved');

// ── Test 26: Synthetic Auto-Generated Columns Exemption (Rule 4) ────────────
console.log('\n--- Test 26: Synthetic Auto-Generated Columns Exemption ---');
const childTableMapping = [
  {
    collectionName: 'orders_items',
    targetTableName: 'orders_items',
    fields: [
      { id: 'f1', sourceField: 'productId', sourceType: 'string', targetColumn: 'product_id', targetType: 'VARCHAR(50)', isNullable: false, include: true },
      { id: 'f2', sourceField: 'sort_order', sourceType: 'auto', targetColumn: 'sort_order', targetType: 'INTEGER', isNullable: false, include: true, sortOrderColumn: true },
      { id: 'f3', sourceField: 'orders_id', sourceType: 'auto', targetColumn: 'orders_id', targetType: 'VARCHAR(24)', isNullable: false, include: true, foreignKeyToParent: 'orders.id' },
    ],
  },
];

const result26 = analyzeRisks({
  sourceSchema: [{ collectionName: 'orders_items', documentCount: 50, fields: [] }],
  mapping: childTableMapping,
  direction: 'mongodb-to-postgres',
  fieldMissingCounts: {
    orders_items: {
      // In MongoDB, sort_order does not exist, so missing count was reported as 50
      sort_order: 50,
      orders_id: 50,
      productId: 0,
    },
  },
});

const sortOrderRisk = result26.risks.find((r) => r.affectedField === 'sort_order' || r.id.includes('sort_order'));
assert(sortOrderRisk === undefined, 'Synthetic sort_order column is exempt from NOT NULL missing risks');

const fkAutoRisk = result26.risks.find((r) => r.affectedField === 'orders_id' && r.id.includes('missing'));
assert(fkAutoRisk === undefined, 'Synthetic orders_id foreign key is exempt from NOT NULL missing risks');

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n====================================================');
console.log(`📊 Test Results: ${passedTests} of ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

