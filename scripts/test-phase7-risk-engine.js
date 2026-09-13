/**
 * Automated Verification Test for MigrateIQ Phase 7 - Risk Analysis Engine
 */

const { analyzeRisks, detectFkCycles } = require('../apps/desktop/dist-electron/engine/riskAnalyzer');

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

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n====================================================');
console.log(`📊 Test Results: ${passedTests} of ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
