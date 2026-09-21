/**
 * Automated Verification Suite for MigrateIQ Phase 11 — Schema Update Assistant (Workflow C)
 *
 * Tests:
 * 1. PostgreSQL Script Generation (8 Operations: addColumn, dropColumn, renameColumn, renameTable, changeType, addIndex, dropIndex, addForeignKey)
 * 2. 5s Lock Timeout & Transaction Wrapping (BEGIN/COMMIT + ROLLBACK)
 * 3. MongoDB Script Generation (Native commands: updateMany, unset, renameCollection, createIndex)
 * 4. Risk Evaluation Engine (NOT NULL violation on populated table, Data Loss, Cast Locks)
 * 5. 1-Click Auto-Fix Action Mapping
 * 6. Offline Regex NL2DDL Fallback Parser
 */

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

console.log('====================================================');
console.log('🧪 MigrateIQ Phase 11 — Schema Update Assistant Tests');
console.log('====================================================\n');

// Import handlers from compiled dist-electron
const {
  generatePostgreSqlScripts,
  generateMongoDbScripts,
  analyzeSchemaUpdateRisks,
  parseNaturalLanguageOffline,
} = require('../apps/desktop/dist-electron/handlers/schemaUpdate');

// ── Test Group 1: PostgreSQL Script Generation (8 Operations) ────────────────

console.log('--- Test Group 1: PostgreSQL Script Generation ---');

// 1.1 addColumn
const addColRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'addColumn',
  tableName: 'customers',
  columnName: 'loyalty_tier',
  dataType: 'VARCHAR(50)',
  isNullable: false,
  defaultValue: "'bronze'",
});
assert(addColRes.forwardScript.includes('SET lock_timeout = \'5s\';'), 'PostgreSQL includes 5s lock timeout');
assert(addColRes.forwardScript.includes('BEGIN;') && addColRes.forwardScript.includes('COMMIT;'), 'PostgreSQL wrapped in BEGIN ... COMMIT');
assert(addColRes.forwardScript.includes('ADD COLUMN "loyalty_tier" VARCHAR(50) NOT NULL DEFAULT \'bronze\';'), 'Forward SQL has correct ADD COLUMN clauses');
assert(addColRes.rollbackScript.includes('DROP COLUMN IF EXISTS "loyalty_tier";'), 'Rollback SQL has safe DROP COLUMN IF EXISTS');

// 1.2 dropColumn
const dropColRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'dropColumn',
  tableName: 'users',
  columnName: 'temp_secret',
  dataType: 'TEXT',
});
assert(dropColRes.forwardScript.includes('DROP COLUMN IF EXISTS "temp_secret";'), 'dropColumn generates safe DROP COLUMN IF EXISTS');
assert(dropColRes.rollbackScript.includes('ADD COLUMN "temp_secret" TEXT;'), 'dropColumn rollback recreates column definition');
assert(Boolean(dropColRes.riskNotice), 'dropColumn includes risk notice');

// 1.3 renameColumn
const renameColRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'renameColumn',
  tableName: 'orders',
  columnName: 'cust_id',
  newColumnName: 'customer_id',
});
assert(renameColRes.forwardScript.includes('RENAME COLUMN "cust_id" TO "customer_id";'), 'renameColumn generates RENAME COLUMN');
assert(renameColRes.rollbackScript.includes('RENAME COLUMN "customer_id" TO "cust_id";'), 'renameColumn generates reverse RENAME COLUMN');

// 1.4 renameTable
const renameTableRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'renameTable',
  tableName: 'order_items',
  newTableName: 'order_line_items',
});
assert(renameTableRes.forwardScript.includes('RENAME TO "order_line_items";'), 'renameTable generates RENAME TO');
assert(renameTableRes.rollbackScript.includes('RENAME TO "order_items";'), 'renameTable rollback reverses RENAME TO');

// 1.5 changeType
const changeTypeRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'changeType',
  tableName: 'products',
  columnName: 'price',
  dataType: 'NUMERIC(10,2)',
});
assert(changeTypeRes.forwardScript.includes('ALTER COLUMN "price" TYPE NUMERIC(10,2) USING "price"::NUMERIC(10,2);'), 'changeType uses TYPE and USING cast clause');

// 1.6 addIndex (Unique)
const addIdxRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'addIndex',
  tableName: 'users',
  columnName: 'email',
  indexName: 'idx_users_email_uniq',
  isUnique: true,
});
assert(addIdxRes.forwardScript.includes('CREATE UNIQUE INDEX "idx_users_email_uniq" ON "public"."users" ("email");'), 'addIndex generates UNIQUE index');
assert(addIdxRes.rollbackScript.includes('DROP INDEX IF EXISTS "public"."idx_users_email_uniq";'), 'addIndex rollback drops index');

// 1.7 dropIndex
const dropIdxRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'dropIndex',
  tableName: 'users',
  columnName: 'email',
  indexName: 'idx_users_email_uniq',
});
assert(dropIdxRes.forwardScript.includes('DROP INDEX IF EXISTS "public"."idx_users_email_uniq";'), 'dropIndex drops index safely');
assert(dropIdxRes.rollbackScript.includes('CREATE INDEX "idx_users_email_uniq" ON "public"."users"'), 'dropIndex rollback recreates index');

// 1.8 addForeignKey
const addFkRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'addForeignKey',
  tableName: 'orders',
  columnName: 'customer_id',
  foreignTable: 'customers',
  foreignColumn: 'id',
  onDelete: 'CASCADE',
});
assert(addFkRes.forwardScript.includes('ADD CONSTRAINT "fk_orders_customer_id_customers" FOREIGN KEY ("customer_id") REFERENCES "public"."customers" ("id") ON DELETE CASCADE;'), 'addForeignKey generates foreign key with ON DELETE action');
assert(addFkRes.rollbackScript.includes('DROP CONSTRAINT IF EXISTS "fk_orders_customer_id_customers";'), 'addForeignKey rollback drops constraint');


// ── Test Group 2: MongoDB Script Generation ──────────────────────────────────

console.log('\n--- Test Group 2: MongoDB Script Generation ---');

// 2.1 addColumn
const mongoAddRes = generateMongoDbScripts({
  databaseType: 'mongodb',
  operation: 'addColumn',
  tableName: 'users',
  columnName: 'verified',
  defaultValue: 'false',
});
assert(mongoAddRes.forwardScript.includes('db.users.updateMany({ "verified": { $exists: false } }, { $set: { "verified": false } });'), 'MongoDB addColumn uses updateMany with $exists check and $set');
assert(mongoAddRes.rollbackScript.includes('db.users.updateMany({}, { $unset: { "verified": "" } });'), 'MongoDB addColumn rollback unsets field');

// 2.2 dropColumn
const mongoDropRes = generateMongoDbScripts({
  databaseType: 'mongodb',
  operation: 'dropColumn',
  tableName: 'users',
  columnName: 'temp_token',
});
assert(mongoDropRes.forwardScript.includes('db.users.updateMany({}, { $unset: { "temp_token": "" } });'), 'MongoDB dropColumn uses $unset');

// 2.3 renameColumn
const mongoRenameColRes = generateMongoDbScripts({
  databaseType: 'mongodb',
  operation: 'renameColumn',
  tableName: 'orders',
  columnName: 'oldStatus',
  newColumnName: 'status',
});
assert(mongoRenameColRes.forwardScript.includes('db.orders.updateMany({}, { $rename: { "oldStatus": "status" } });'), 'MongoDB renameColumn uses $rename');

// 2.4 renameTable
const mongoRenameTableRes = generateMongoDbScripts({
  databaseType: 'mongodb',
  operation: 'renameTable',
  tableName: 'old_coll',
  newTableName: 'new_coll',
});
assert(mongoRenameTableRes.forwardScript.includes('db.old_coll.renameCollection("new_coll");'), 'MongoDB renameCollection is generated');

// 2.5 addIndex
const mongoIdxRes = generateMongoDbScripts({
  databaseType: 'mongodb',
  operation: 'addIndex',
  tableName: 'products',
  columnName: 'sku',
  indexName: 'idx_sku_uniq',
  isUnique: true,
  sparse: true,
});
assert(mongoIdxRes.forwardScript.includes('db.products.createIndex({ "sku": 1 }, {"name":"idx_sku_uniq","unique":true,"sparse":true});'), 'MongoDB createIndex supports unique and sparse flags');


// ── Test Group 3: Automated Risk Evaluation Engine ───────────────────────────

console.log('\n--- Test Group 3: Risk Evaluation Engine ---');

// 3.1 NOT NULL without default on populated table (Critical Risk)
const populatedTableRisks = analyzeSchemaUpdateRisks(
  {
    databaseType: 'postgresql',
    operation: 'addColumn',
    tableName: 'orders',
    columnName: 'tracking_code',
    dataType: 'VARCHAR(100)',
    isNullable: false,
    defaultValue: '',
  },
  {
    tableName: 'orders',
    rowCount: 25000,
    columns: [],
  }
);
const notNullPopulatedRisk = populatedTableRisks.find((r) => r.id === 'risk_not_null_no_default_populated');
assert(notNullPopulatedRisk !== undefined, 'Detected NOT NULL constraint risk on populated table');
assert(notNullPopulatedRisk?.severity === 'critical', 'Populated NOT NULL risk is CRITICAL severity');
assert(notNullPopulatedRisk?.autoFixAvailable === true, 'Auto-fix is available for NOT NULL populated risk');
assert(notNullPopulatedRisk?.autoFixAction?.type === 'make_nullable', 'Auto-fix action type is make_nullable');

// 3.2 Dropping column (Critical Risk)
const dropColRisks = analyzeSchemaUpdateRisks({
  databaseType: 'postgresql',
  operation: 'dropColumn',
  tableName: 'users',
  columnName: 'password_hash',
});
const dropLossRisk = dropColRisks.find((r) => r.id === 'risk_drop_column_loss');
assert(dropLossRisk !== undefined, 'Detected permanent data loss risk on dropColumn');
assert(dropLossRisk?.severity === 'critical', 'dropColumn risk is CRITICAL');

// 3.3 changeType (Warning)
const changeTypeRisks = analyzeSchemaUpdateRisks({
  databaseType: 'postgresql',
  operation: 'changeType',
  tableName: 'events',
  columnName: 'payload',
  dataType: 'JSONB',
});
const typeLockRisk = changeTypeRisks.find((r) => r.id === 'risk_change_type_lock');
assert(typeLockRisk !== undefined, 'Detected lock & conversion risk on changeType');
assert(typeLockRisk?.severity === 'warning', 'changeType risk is WARNING');

// 3.4 Safe Operation (Info check)
const safeRisks = analyzeSchemaUpdateRisks({
  databaseType: 'postgresql',
  operation: 'addColumn',
  tableName: 'users',
  columnName: 'middle_name',
  dataType: 'VARCHAR(50)',
  isNullable: true,
});
assert(safeRisks.some((r) => r.severity === 'info'), 'Safe nullable column receives green info check');


// ── Test Group 4: Offline Regex NL2DDL Fallback Parser ───────────────────────

console.log('\n--- Test Group 4: Offline Regex NL2DDL Parser ---');

// 4.1 Add column
const p1 = parseNaturalLanguageOffline('Add column status VARCHAR(50) to orders');
assert(p1 !== null && p1.operation === 'addColumn', 'Regex parsed "Add column ... to orders"');
assert(p1?.columnName === 'status' && p1?.tableName === 'orders', 'Regex correctly extracted column status and table orders');

// 4.2 Drop column
const p2 = parseNaturalLanguageOffline('Drop column temp_notes from orders');
assert(p2 !== null && p2.operation === 'dropColumn', 'Regex parsed "Drop column ... from orders"');
assert(p2?.columnName === 'temp_notes' && p2?.tableName === 'orders', 'Regex correctly extracted drop column temp_notes from orders');

// 4.3 Rename column
const p3 = parseNaturalLanguageOffline('Rename column is_active to active in users');
assert(p3 !== null && p3.operation === 'renameColumn', 'Regex parsed "Rename column ... in users"');
assert(p3?.columnName === 'is_active' && p3?.newColumnName === 'active' && p3?.tableName === 'users', 'Regex correctly extracted old and new column names');

// 4.4 Rename table
const p4 = parseNaturalLanguageOffline('Rename table legacy_logs to archive_logs');
assert(p4 !== null && p4.operation === 'renameTable', 'Regex parsed "Rename table legacy_logs to archive_logs"');
assert(p4?.tableName === 'legacy_logs' && p4?.newTableName === 'archive_logs', 'Regex correctly extracted old and new table names');

// 4.5 Change type
const p5 = parseNaturalLanguageOffline('Change type of age in users to INTEGER');
assert(p5 !== null && p5.operation === 'changeType', 'Regex parsed "Change type of age in users to INTEGER"');
assert(p5?.columnName === 'age' && p5?.dataType === 'INTEGER', 'Regex correctly extracted column age and data type INTEGER');

// 4.6 Create unique index
const p6 = parseNaturalLanguageOffline('Create unique index on users(email)');
assert(p6 !== null && p6.operation === 'addIndex', 'Regex parsed "Create unique index on users(email)"');
assert(p6?.isUnique === true && p6?.columnName === 'email', 'Regex correctly extracted unique flag and column email');


// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n====================================================');
console.log(`🏁 Phase 11 Test Summary: ${passedTests} / ${totalTests} Passed`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL PHASE 11 TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
