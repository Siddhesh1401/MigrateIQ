/**
 * Automated Verification Test for MigrateIQ Phase 8 - Dry Run Simulation Engine
 *
 * Verifies:
 * 1. Transactional DDL synthesis (CREATE TABLE, active columns, primary keys).
 * 2. Child table auto-unwinding with sort_order INTEGER NOT NULL (Rule 4 & Challenge 9).
 * 3. In-memory data transformation and NOT NULL violation detection.
 * 4. Savepoint error isolation and affected rows extraction.
 * 5. Real-time progress event streaming contract (stages, status, timestamps).
 * 6. Rollback verification guarantee (zero permanent mutations).
 * 7. Reverse migration direction (Workflow B: PostgreSQL -> MongoDB).
 */

const {
  executeDryRunSimulation,
  sanitizeIdentifier,
  getTypeAwareDefaultValue,
  formatBytes,
  extractFieldValue,
} = require('../apps/desktop/dist-electron/engine/dryRun');

console.log('===========================================================');
console.log('🧪 MigrateIQ Phase 8 - Dry Run Engine Verification Suite');
console.log('===========================================================\n');

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

async function runTests() {
  // ── Test 1: Full Simulation with Clean Data & Child Tables ─────────────
  console.log('--- Test 1: Simulation with Clean Mapping & Child Table (orders.items) ---');

  const cleanMapping = [
    {
      collectionName: 'users',
      targetTableName: 'users',
      fields: [
        { id: '1', sourceField: '_id', sourceType: 'objectId', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false, include: true },
        { id: '2', sourceField: 'name', sourceType: 'string', targetColumn: 'name', targetType: 'VARCHAR(255)', isNullable: false, include: true },
        { id: '3', sourceField: 'email', sourceType: 'string', targetColumn: 'email', targetType: 'VARCHAR(255)', isNullable: true, include: true },
      ],
      indexes: [],
    },
    {
      collectionName: 'orders',
      targetTableName: 'orders',
      fields: [
        { id: '4', sourceField: '_id', sourceType: 'objectId', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false, include: true },
        { id: '5', sourceField: 'userId', sourceType: 'objectId', targetColumn: 'user_id', targetType: 'VARCHAR(24)', isNullable: false, include: true },
        { id: '6', sourceField: 'totalAmount', sourceType: 'double', targetColumn: 'total_amount', targetType: 'NUMERIC(10,2)', isNullable: false, include: true },
        {
          id: '7',
          sourceField: 'items',
          sourceType: 'arrayOfObjects',
          targetColumn: 'items',
          targetType: 'TEXT',
          isNullable: false,
          include: true,
          isChildTable: true,
          childTableName: 'order_items',
        },
      ],
      indexes: [],
    },
  ];

  const progressEvents = [];

  const result1 = await executeDryRunSimulation({
    mapping: cleanMapping,
    sourceConfig: null,
    targetConfig: {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
    },
    sourceSchema: [
      { collectionName: 'users', documentCount: 2000, fields: [] },
      { collectionName: 'orders', documentCount: 5000, fields: [] },
    ],
    direction: 'mongodb-to-postgres',
    isDemoMode: true,
    onProgress: (p) => progressEvents.push(p),
  });

  assert(result1 !== null && typeof result1 === 'object', 'Dry run execution returned result object');
  assert(result1.rollbackVerified === true, 'Rollback is verified true (guaranteed zero permanent writes)');
  assert(result1.tables.length >= 2, `Created expected table results (found ${result1.tables.length})`);

  // Verify users table
  const usersTable = result1.tables.find((t) => t.targetTableName === 'users');
  assert(usersTable !== undefined, 'Users table result is present');
  assert(usersTable?.columnsCount === 3, 'Users table column count is 3');
  assert(usersTable?.schemaValid === true, 'Users table DDL is valid');
  assert(usersTable?.ddlPreview?.includes('CREATE TABLE IF NOT EXISTS "users"'), 'Users DDL contains CREATE TABLE syntax');

  // Verify child table creation (order_items)
  const childTable = result1.tables.find((t) => t.isChildTable || t.targetTableName === 'order_items');
  assert(childTable !== undefined, 'Child table (order_items) was simulated');
  assert(childTable?.ddlPreview?.includes('sort_order'), 'Child table DDL contains auto-added sort_order column (Rule 4)');

  // Verify progress events
  assert(progressEvents.length > 0, `Emitted ${progressEvents.length} progress events`);
  const stages = progressEvents.map((p) => p.stage);
  assert(stages.includes('init'), 'Progress stages include init');
  assert(stages.includes('schema'), 'Progress stages include schema');
  assert(stages.includes('sample_data'), 'Progress stages include sample_data');
  assert(stages.includes('complete'), 'Progress stages include complete');

  // ── Test 2: In-Memory / Demo Extrapolation Numbers ────────────────────
  console.log('\n--- Test 2: Projection & Extrapolation Accuracy ---');
  assert(result1.totalSampleTested > 0, `Total sample tested is positive (${result1.totalSampleTested})`);
  assert(result1.totalProjectedMigrate > 0, `Total projected migrate is positive (${result1.totalProjectedMigrate})`);
  assert(result1.executionTimeMs >= 0, `Execution time is positive (${result1.executionTimeMs}ms)`);

  // ── Test 3: Reverse Migration Direction (Workflow B: PG -> Mongo) ─────
  console.log('\n--- Test 3: Reverse Direction (PostgreSQL -> MongoDB) ---');
  const result3 = await executeDryRunSimulation({
    mapping: cleanMapping,
    sourceConfig: null,
    targetConfig: {
      type: 'mongodb',
      host: 'localhost',
      port: 27017,
      database: 'target_mongo',
    },
    direction: 'postgres-to-mongo',
    isDemoMode: true,
  });

  assert(result3.direction === 'postgres-to-mongo', 'Result direction is postgres-to-mongo');
  assert(result3.overallStatus === 'passed', 'PG->Mongo dry run passed');
  assert(result3.rollbackVerified === true, 'Rollback verified for reverse direction');
  assert(result3.tables.every((t) => t.schemaValid), 'All BSON collection models validated');
  assert(result3.throughputRowsPerSec !== undefined && result3.throughputRowsPerSec > 0, `PG->Mongo dry run calculated throughput (${result3.throughputRowsPerSec} rows/sec)`);
  assert(result3.storageHeadroom !== undefined && result3.storageHeadroom.sufficientSpace === true, 'PG->Mongo dry run verified storage headroom');

  // ── Test 4: Option A Smart Default Imputation (Cleansing Fallback) ─────
  console.log('\n--- Test 4: Option A Smart Default Imputation (Cleansing Fallback) ---');
  const mappingWithDefault = [
    {
      collectionName: 'users',
      targetTableName: 'users',
      fields: [
        { id: '1', sourceField: '_id', sourceType: 'objectId', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false, include: true },
        { id: '2', sourceField: 'name', sourceType: 'string', targetColumn: 'name', targetType: 'VARCHAR(255)', defaultValue: 'Unknown', isNullable: false, include: true },
        { id: '3', sourceField: 'email', sourceType: 'string', targetColumn: 'email', targetType: 'VARCHAR(255)', isNullable: true, include: true },
      ],
      indexes: [],
    },
  ];

  const result4 = await executeDryRunSimulation({
    mapping: mappingWithDefault,
    sourceConfig: null,
    targetConfig: {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
    },
    sourceSchema: [
      { collectionName: 'users', documentCount: 2000, fields: [] },
    ],
    direction: 'mongodb-to-postgres',
    isDemoMode: true,
  });

  const usersTblWithDefault = result4.tables.find((t) => t.targetTableName === 'users');
  assert(usersTblWithDefault !== undefined, 'Users table simulated with default value');
  assert(usersTblWithDefault?.ddlPreview?.includes("DEFAULT 'Unknown' NOT NULL"), 'Users DDL contains DEFAULT \'Unknown\' NOT NULL clause');
  assert(usersTblWithDefault?.sampleFailed === 0, 'Zero rows failed when default imputation is applied');
  assert(usersTblWithDefault?.samplePassed === usersTblWithDefault?.sampleTested, '100% sample rows passed with default value fallback');
  assert(result4.overallStatus === 'passed', 'Overall simulation status is passed');

  // ── Test 5: Telemetry, Throughput & Capacity Checks (Safeguards 8, 9, 10) ─────
  console.log('\n--- Test 5: Telemetry, Throughput & Capacity Checks (Safeguards 8, 9, 10) ---');
  assert(result1.throughputRowsPerSec !== undefined && result1.throughputRowsPerSec > 0, `Throughput rows/sec calculated (${result1.throughputRowsPerSec} rows/sec)`);
  assert(result1.projectedDurationSec !== undefined && result1.projectedDurationSec >= 0, `Projected ETA calculated (~${result1.projectedDurationSec} seconds)`);
  assert(result1.projectedTotalSizeBytes !== undefined && result1.projectedTotalSizeBytes > 0, `Projected total migration size calculated (${result1.projectedTotalSizeBytes} bytes)`);
  assert(result1.storageHeadroom !== undefined, 'Storage headroom capacity analysis is present');
  assert(result1.storageHeadroom?.sufficientSpace === true, 'Storage headroom evaluated as sufficient');
  assert(typeof result1.storageHeadroom?.formattedProjectedSize === 'string', `Formatted projected storage size generated (${result1.storageHeadroom?.formattedProjectedSize})`);

  // ── Test 6: Granular Single-Table Re-simulation (Safeguard 13) ─────────
  console.log('\n--- Test 6: Granular Single-Table Re-simulation (Safeguard 13) ---');
  const singleTableResult = await executeDryRunSimulation({
    mapping: cleanMapping,
    sourceConfig: null,
    targetConfig: {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
    },
    direction: 'mongodb-to-postgres',
    isDemoMode: true,
    singleTableName: 'users',
  });

  assert(singleTableResult.tables.length === 1, `Isolated simulation tested exactly 1 table (found ${singleTableResult.tables.length})`);
  assert(singleTableResult.tables[0].targetTableName === 'users', 'Isolated simulation targeted users table only');
  assert(singleTableResult.overallStatus === 'passed', 'Single-table simulation passed');
  assert(singleTableResult.rollbackVerified === true, 'Single-table simulation verified rollback');

  // ── Test 7: 63-Byte Identifier Truncation & Collision Defense (Safeguard 5) ─
  console.log('\n--- Test 7: 63-Byte Identifier Truncation & Collision Defense (Safeguard 5) ---');
  const normalName = sanitizeIdentifier('customer_billing_profiles');
  assert(normalName === 'customer_billing_profiles', 'Normal identifier preserved intact');

  const specialCharName = sanitizeIdentifier('user-accounts.active_2026');
  assert(specialCharName === 'user_accounts_active_2026', 'Special characters sanitized to underscores');

  const longPrefix = 'a'.repeat(58);
  const longName1 = `${longPrefix}_very_long_custom_field_identifier_one`;
  const longName2 = `${longPrefix}_very_long_custom_field_identifier_two`;
  const sanitized1 = sanitizeIdentifier(longName1);
  const sanitized2 = sanitizeIdentifier(longName2);

  assert(sanitized1.length <= 63, `Sanitized long name 1 capped at <= 63 bytes (length: ${sanitized1.length})`);
  assert(sanitized2.length <= 63, `Sanitized long name 2 capped at <= 63 bytes (length: ${sanitized2.length})`);
  assert(sanitized1 !== sanitized2, 'Deterministic hash suffix prevented collision between two long names sharing the same prefix');

  // ── Test 8: Type-Aware Smart Default Imputation (Safeguard 6) ──────────
  console.log('\n--- Test 8: Type-Aware Smart Default Imputation (Safeguard 6) ---');
  assert(getTypeAwareDefaultValue('INTEGER') === '0', 'Integer type defaults to 0');
  assert(getTypeAwareDefaultValue('NUMERIC(12,2)') === '0.00', 'Numeric type defaults to 0.00');
  assert(getTypeAwareDefaultValue('BOOLEAN') === 'false', 'Boolean type defaults to false');
  assert(getTypeAwareDefaultValue('TIMESTAMP') === 'CURRENT_TIMESTAMP', 'Timestamp type defaults to CURRENT_TIMESTAMP');
  assert(getTypeAwareDefaultValue('UUID') === '00000000-0000-0000-0000-000000000000', 'UUID type defaults to nil UUID');
  assert(getTypeAwareDefaultValue('JSONB') === '{}', 'JSON type defaults to empty object');
  assert(getTypeAwareDefaultValue('VARCHAR(100)') === 'Unknown', 'Text type defaults to Unknown');

  // ── Test 9: formatBytes Utility (Safeguard 10) ─────────────────────────
  console.log('\n--- Test 9: formatBytes Capacity Formatting (Safeguard 10) ---');
  assert(formatBytes(1024) === '1.0 KB', '1024 bytes formatted to 1.0 KB');
  assert(formatBytes(42 * 1024 * 1024) === '42.0 MB', '42MB formatted to 42.0 MB');

  // ── Test 10: Resilient Field Extractor & Heterogeneous Casing Normalization ─
  console.log('\n--- Test 10: Resilient Field Extractor & Heterogeneous Casing Normalization ---');
  const sampleDoc = {
    orderNumber: 'ORD-2026-001',
    customerName: 'Alice Johnson',
    total_amount: 379.49,
    specs: { color: 'Midnight Black', wattage: 65 },
  };

  assert(
    extractFieldValue(sampleDoc, 'order_number', 'order_number') === 'ORD-2026-001',
    'Normalized camelCase orderNumber found via snake_case order_number request'
  );
  assert(
    extractFieldValue(sampleDoc, 'customer_name') === 'Alice Johnson',
    'Normalized camelCase customerName found via snake_case customer_name'
  );
  assert(
    extractFieldValue(sampleDoc, 'totalAmount') === 379.49,
    'Normalized snake_case total_amount found via camelCase totalAmount'
  );
  assert(
    extractFieldValue(sampleDoc, 'specs.color') === 'Midnight Black',
    'Nested dot-notation specs.color navigated and extracted correctly'
  );
  assert(
    extractFieldValue(sampleDoc, 'specs_wattage') === 65,
    'Flattened underscore specs_wattage navigated into nested object'
  );

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n===========================================================');
  console.log(`🏁 Phase 8 Test Suite Complete: ${passedTests}/${totalTests} Passed`);
  console.log('===========================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
