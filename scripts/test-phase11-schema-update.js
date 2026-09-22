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
  sanitizeSqlType,
  formatSqlDefaultClause,
  formatMongoDefaultValue,
  formatSuccessMessage,
  parseRawScript,
  computeChangeImpactScorecard,
  generateEvolutionStrategy,
  generateMongoValidationCommand,
  generateCiCdWorkflowYaml,
  generateExecutiveAuditReportMarkdown,
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

// 4.1b Add column to <table> named <col>
const p1b = parseNaturalLanguageOffline('add column to customers named siddhesh');
assert(p1b !== null && p1b.operation === 'addColumn', 'Regex parsed "add column to customers named siddhesh"');
assert(p1b?.columnName === 'siddhesh' && p1b?.tableName === 'customers', 'Regex correctly extracted column siddhesh and table customers');

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


// ── Test Group 5: Security & Post-Implementation Audit Hardening ───────────────

console.log('\n--- Test Group 5: Security & Post-Implementation Audit Tests ---');

// 5.1 SQL Injection defense in DataType
const injectedType = sanitizeSqlType('VARCHAR(50); DROP TABLE users;--');
assert(!injectedType.includes(';') && !injectedType.includes('--'), 'sanitizeSqlType strips semicolons and comment dashes');
assert(injectedType === 'VARCHAR(50) USERS', 'sanitizeSqlType strips DROP and TABLE keywords leaving only safe type characters');

// 5.2 SQL Default Clause formatting
assert(formatSqlDefaultClause(undefined) === '', 'formatSqlDefaultClause returns empty for undefined');
assert(formatSqlDefaultClause('CURRENT_TIMESTAMP') === ' DEFAULT CURRENT_TIMESTAMP', 'formatSqlDefaultClause does not quote CURRENT_TIMESTAMP');
assert(formatSqlDefaultClause('NOW()') === ' DEFAULT NOW()', 'formatSqlDefaultClause does not quote NOW()');
assert(formatSqlDefaultClause('true') === ' DEFAULT true', 'formatSqlDefaultClause does not quote boolean true');
assert(formatSqlDefaultClause('100') === ' DEFAULT 100', 'formatSqlDefaultClause does not quote numeric 100');
assert(formatSqlDefaultClause('active') === " DEFAULT 'active'", 'formatSqlDefaultClause single-quotes unquoted string literal');
assert(formatSqlDefaultClause("O'Reilly") === " DEFAULT 'O''Reilly'", 'formatSqlDefaultClause escapes single-quotes in string literal');

// 5.3 MongoDB Default Value Formatting (No crash on non-JSON plain string)
const mongoStr = formatMongoDefaultValue('active');
assert(mongoStr.scriptValue === '"active"' && mongoStr.nativeValue === 'active', 'formatMongoDefaultValue parses plain unquoted string safely without JSON.parse exception');

const mongoNum = formatMongoDefaultValue('42');
assert(mongoNum.scriptValue === '42' && mongoNum.nativeValue === 42, 'formatMongoDefaultValue parses number');

const mongoBool = formatMongoDefaultValue('true');
assert(mongoBool.scriptValue === 'true' && mongoBool.nativeValue === true, 'formatMongoDefaultValue parses boolean true');

const mongoNull = formatMongoDefaultValue(null);
assert(mongoNull.scriptValue === 'null' && mongoNull.nativeValue === null, 'formatMongoDefaultValue parses null');

const mongoJson = formatMongoDefaultValue('{"tier":"gold","points":500}');
assert(typeof mongoJson.nativeValue === 'object' && mongoJson.nativeValue.tier === 'gold', 'formatMongoDefaultValue parses complex JSON object');

// 5.4 Rollback DataType Preservation in changeType
const changeTypeWithOrig = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'changeType',
  tableName: 'customers',
  columnName: 'age',
  dataType: 'BIGINT',
  originalDataType: 'SMALLINT',
});
assert(changeTypeWithOrig.rollbackScript.includes('TYPE SMALLINT'), 'changeType rollback uses originalDataType (SMALLINT) instead of default TEXT');
assert(changeTypeWithOrig.rollbackScript.includes('USING "age"::SMALLINT'), 'changeType rollback cast uses originalDataType');

// 5.5 Defensive Script Generation on Missing Parameters
const missingRenameCol = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'renameColumn',
  tableName: 'customers',
  columnName: 'loyalty_tier',
  // newColumnName omitted
});
assert(missingRenameCol.forwardScript.includes('-- Error: Both current and new column names are required'), 'renameColumn with missing newColumnName generates safe error comment');

const missingRenameTable = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'renameTable',
  tableName: 'customers',
  // newTableName omitted
});
assert(missingRenameTable.forwardScript.includes('-- Error: New table name is required'), 'renameTable with missing newTableName generates safe error comment');

const missingFkTable = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'addForeignKey',
  tableName: 'orders',
  columnName: 'customer_id',
  // foreignTable omitted
});
assert(missingFkTable.forwardScript.includes('-- Error: Foreign target table is required'), 'addForeignKey with missing foreignTable generates safe error comment');

// 5.6 MongoDB dropIndex rollback safe handling
const mongoDropIdx = generateMongoDbScripts({
  databaseType: 'mongodb',
  operation: 'dropIndex',
  tableName: 'orders',
  indexName: 'idx_orders_custom',
  // columnName omitted
});
assert(!mongoDropIdx.rollbackScript.includes('createIndex({ "_id": 1 }, { name:'), 'MongoDB dropIndex rollback never creates illegal custom index on _id');

// 5.7 onDelete Whitelisting & SQL Injection Prevention
const injectedFk = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'addForeignKey',
  tableName: 'orders',
  columnName: 'customer_id',
  foreignTable: 'customers',
  foreignColumn: 'id',
  onDelete: 'CASCADE; DROP TABLE users;--',
});
assert(injectedFk.forwardScript.includes('ON DELETE NO ACTION;'), 'addForeignKey rejects injected onDelete and falls back to NO ACTION');

// 5.8 Engine-Aware Risk Detection (MongoDB ignores PostgreSQL 23502 NOT NULL check)
const mongoRisks = analyzeSchemaUpdateRisks(
  {
    databaseType: 'mongodb',
    operation: 'addColumn',
    tableName: 'orders',
    columnName: 'tracking_code',
    isNullable: false,
  },
  {
    tableName: 'orders',
    rowCount: 50000,
    columns: [],
  }
);
assert(!mongoRisks.some((r) => r.id === 'risk_not_null_no_default_populated'), 'MongoDB ignores PostgreSQL error 23502 NOT NULL populated table risk');

// 5.9 Natural English Success Message Formatting
const successMsg = formatSuccessMessage({
  databaseType: 'postgresql',
  operation: 'addColumn',
  tableName: 'users',
  columnName: 'loyalty_points',
  dataType: 'INTEGER',
  isNullable: true,
});
assert(successMsg.includes('loyalty_points') && successMsg.includes('users'), 'formatSuccessMessage formats natural English description');

// 5.10 MongoDB dropIndex with Inferred Index Name
const mongoDropInferred = generateMongoDbScripts({
  databaseType: 'mongodb',
  operation: 'dropIndex',
  tableName: 'orders',
  columnName: 'status',
});
assert(mongoDropInferred.forwardScript.includes('db.orders.dropIndex("idx_orders_status");'), 'MongoDB dropIndex generates inferred index name when indexName is omitted');

// ── Test Group 6: Enterprise 10/10 Upgrades (CONCURRENTLY & Policy Guard) ─────

console.log('\n--- Test Group 6: Enterprise 10/10 Upgrades ---');

// 6.1 PostgreSQL addIndex with CONCURRENTLY
const concurrentIdxRes = generatePostgreSqlScripts({
  databaseType: 'postgresql',
  operation: 'addIndex',
  tableName: 'users',
  columnName: 'email',
  concurrently: true,
});
assert(concurrentIdxRes.forwardScript.includes('CREATE INDEX CONCURRENTLY "idx_users_email"'), 'addIndex with concurrently=true generates CREATE INDEX CONCURRENTLY');
assert(!concurrentIdxRes.forwardScript.includes('BEGIN;') && !concurrentIdxRes.forwardScript.includes('COMMIT;'), 'CONCURRENTLY script executes outside transaction block (no BEGIN/COMMIT)');
assert(concurrentIdxRes.rollbackScript.includes('DROP INDEX CONCURRENTLY IF EXISTS'), 'CONCURRENTLY rollback uses DROP INDEX CONCURRENTLY IF EXISTS');

// 6.2 Policy Guard: Non-snake_case column name detection
const snakeCaseRisks = analyzeSchemaUpdateRisks({
  databaseType: 'postgresql',
  operation: 'addColumn',
  tableName: 'customers',
  columnName: 'firstName',
  dataType: 'VARCHAR(100)',
});
const snakePolicy = snakeCaseRisks.find((r) => r.id === 'policy_naming_column_snake_case');
assert(snakePolicy !== undefined, 'Policy Guard detects non-snake_case column name (firstName)');
assert(snakePolicy?.severity === 'policy', 'Naming policy violation has severity "policy"');
assert(snakePolicy?.ruleId === 'PG-POLICY-001', 'Naming policy violation has ruleId PG-POLICY-001');

// 6.3 Policy Guard: Reserved SQL keyword detection
const reservedRisks = analyzeSchemaUpdateRisks({
  databaseType: 'postgresql',
  operation: 'addColumn',
  tableName: 'accounts',
  columnName: 'user',
  dataType: 'VARCHAR(100)',
});
const reservedPolicy = reservedRisks.find((r) => r.id === 'policy_reserved_word_column');
assert(reservedPolicy !== undefined, 'Policy Guard detects reserved SQL keyword "user"');
assert(reservedPolicy?.severity === 'policy', 'Reserved keyword policy violation has severity "policy"');
assert(reservedPolicy?.ruleId === 'PG-POLICY-002', 'Reserved keyword policy violation has ruleId PG-POLICY-002');

// 6.4 Policy Guard: Large VARCHAR length detection
const largeVarcharRisks = analyzeSchemaUpdateRisks({
  databaseType: 'postgresql',
  operation: 'addColumn',
  tableName: 'posts',
  columnName: 'content_preview',
  dataType: 'VARCHAR(2500)',
});
const varcharPolicy = largeVarcharRisks.find((r) => r.id === 'policy_large_varchar');
assert(varcharPolicy !== undefined, 'Policy Guard detects overly large VARCHAR length (2500)');
assert(varcharPolicy?.severity === 'policy', 'Large VARCHAR policy violation has severity "policy"');
assert(varcharPolicy?.ruleId === 'PG-POLICY-003', 'Large VARCHAR policy violation has ruleId PG-POLICY-003');

// 6.5 Policy Guard: Unindexed Foreign Key on large table
const unindexedFkRisks = analyzeSchemaUpdateRisks(
  {
    databaseType: 'postgresql',
    operation: 'addForeignKey',
    tableName: 'order_items',
    columnName: 'product_id',
    foreignTable: 'products',
    foreignColumn: 'id',
  },
  {
    tableName: 'order_items',
    rowCount: 25000,
    columns: [],
  }
);
const fkPolicy = unindexedFkRisks.find((r) => r.id === 'policy_unindexed_foreign_key');
assert(fkPolicy !== undefined, 'Policy Guard detects unindexed foreign key column on populated table');
assert(fkPolicy?.severity === 'policy', 'Unindexed FK policy violation has severity "policy"');
assert(fkPolicy?.ruleId === 'PG-POLICY-004', 'Unindexed FK policy violation has ruleId PG-POLICY-004');

// ── Test Group 7: Script Tokenization & Evolution Strategy Engine ────────────

console.log('\n--- Test Group 7: Script Tokenization & Evolution Strategy Engine ---');

// 7.1 PostgreSQL Raw Script Parsing
const parsedPgAdd = parseRawScript(
  'ALTER TABLE customers ADD COLUMN vip_status VARCHAR(50) DEFAULT \'regular\';',
  'postgresql'
);
assert(parsedPgAdd.success === true, 'parseRawScript successfully parses PostgreSQL ADD COLUMN');
assert(parsedPgAdd.params?.operation === 'addColumn', 'parseRawScript identifies operation "addColumn"');
assert(parsedPgAdd.params?.tableName === 'customers', 'parseRawScript identifies tableName "customers"');
assert(parsedPgAdd.params?.columnName === 'vip_status', 'parseRawScript identifies columnName "vip_status"');

const parsedPgDrop = parseRawScript(
  'ALTER TABLE orders DROP COLUMN internal_memo;',
  'postgresql'
);
assert(parsedPgDrop.success === true, 'parseRawScript successfully parses PostgreSQL DROP COLUMN');
assert(parsedPgDrop.params?.operation === 'dropColumn', 'parseRawScript identifies operation "dropColumn"');
assert(parsedPgDrop.params?.tableName === 'orders', 'parseRawScript identifies tableName "orders"');

const parsedPgIndex = parseRawScript(
  'CREATE INDEX idx_users_created_at ON users (created_at);',
  'postgresql'
);
assert(parsedPgIndex.success === true, 'parseRawScript successfully parses PostgreSQL CREATE INDEX');
assert(parsedPgIndex.params?.operation === 'addIndex', 'parseRawScript identifies operation "addIndex"');
assert(parsedPgIndex.params?.tableName === 'users', 'parseRawScript identifies tableName "users"');

// 7.2 MongoDB Script Parsing
const parsedMongoAdd = parseRawScript(
  'db.accounts.updateMany({}, { $set: { is_active: true } });',
  'mongodb'
);
assert(parsedMongoAdd.success === true, 'parseRawScript successfully parses MongoDB updateMany $set');
assert(parsedMongoAdd.params?.operation === 'addColumn', 'parseRawScript maps $set to "addColumn"');
assert(parsedMongoAdd.params?.tableName === 'accounts', 'parseRawScript identifies collection "accounts"');
assert(parsedMongoAdd.params?.columnName === 'is_active', 'parseRawScript identifies field "is_active"');

const parsedMongoDrop = parseRawScript(
  'db.audit_logs.dropIndex("idx_audit_actor");',
  'mongodb'
);
assert(parsedMongoDrop.success === true, 'parseRawScript successfully parses MongoDB dropIndex');
assert(parsedMongoDrop.params?.operation === 'dropIndex', 'parseRawScript maps dropIndex correctly');
assert(parsedMongoDrop.params?.tableName === 'audit_logs', 'parseRawScript identifies collection "audit_logs"');

// 7.3 Change Impact Scorecard Evaluation
const safeScorecard = computeChangeImpactScorecard(
  {
    databaseType: 'postgresql',
    operation: 'addColumn',
    tableName: 'events',
    columnName: 'tags',
    isNullable: true,
  },
  { tableName: 'events', rowCount: 100, columns: [] }
);
assert(safeScorecard.overallRisk === 'low', 'Nullable column on small table evaluated as low risk');
assert(safeScorecard.recommendedStrategy === 'direct', 'Low risk change recommends direct strategy');
assert(safeScorecard.lockRisk === 'low', 'Nullable add column evaluated with low lock risk');

const criticalScorecard = computeChangeImpactScorecard(
  {
    databaseType: 'postgresql',
    operation: 'dropColumn',
    tableName: 'financial_records',
    columnName: 'amount',
  },
  { tableName: 'financial_records', rowCount: 500000, columns: [] }
);
assert(criticalScorecard.overallRisk === 'critical', 'dropColumn on large table evaluated as critical risk');
assert(criticalScorecard.rollbackFeasibility === 'destructive', 'dropColumn rollback feasibility marked destructive');
assert(criticalScorecard.recommendedStrategy === 'expand_contract', 'Destructive change recommends expand_contract strategy');

// 7.4 Expand & Contract Phased Strategy Generation
const strategy = generateEvolutionStrategy({
  databaseType: 'postgresql',
  operation: 'dropColumn',
  tableName: 'payments',
  columnName: 'legacy_auth_token',
});
assert(strategy.type === 'expand_contract', 'dropColumn generates expand_contract phased strategy');
assert(Array.isArray(strategy.phases) && strategy.phases.length === 3, 'Expand & Contract strategy includes exactly 3 distinct phases');
assert(strategy.phases[0].phaseTitle.includes('Deprecate') || strategy.phases[0].phaseTitle.includes('Expand'), 'Phase 1 addresses deprecation or expansion');
assert(strategy.phases[2].phaseTitle.includes('Contract'), 'Phase 3 addresses contraction and drop');

// 7.5 MongoDB $jsonSchema Validation Generation
const mongoVal = generateMongoValidationCommand('customers', [
  { name: 'membership_level', type: 'string', required: true }
]);
assert(mongoVal.collection === 'customers', 'generateMongoValidationCommand targets correct collection');
assert(mongoVal.validatorCommand.includes('collMod: "customers"'), 'Validation command contains collMod directive');
assert(mongoVal.validatorCommand.includes('$jsonSchema'), 'Validation command contains $jsonSchema specification');
assert(mongoVal.jsonSchema.properties?.membership_level !== undefined, 'Generated jsonSchema contains field property');

// ── Test Group 8: Packaging, CI/CD, Audit Report & Ledger Integrity ──────────

console.log('\n--- Test Group 8: Packaging, CI/CD, Audit Report & Ledger Integrity ---');

// 8.1 CI/CD Workflow Generation
const githubWorkflow = generateCiCdWorkflowYaml('postgresql', 'retail_db');
assert(githubWorkflow.includes('MigrateIQ Automated CI/CD Database Migration Pipeline'), 'Workflow includes standard header');
assert(githubWorkflow.includes('POSTGRESQL'), 'Workflow reflects PostgreSQL engine');
assert(githubWorkflow.includes('psql'), 'PostgreSQL workflow invokes psql command');

const mongoWorkflow = generateCiCdWorkflowYaml('mongodb', 'inventory_db');
assert(mongoWorkflow.includes('MONGODB'), 'Workflow reflects MongoDB engine');
assert(mongoWorkflow.includes('mongosh'), 'MongoDB workflow invokes mongosh command');

// 8.2 Executive Audit Report Generation
const auditReport = generateExecutiveAuditReportMarkdown(
  {
    id: 'test_mig_123',
    version: 'v_20260922',
    description: 'Add column loyalty_tier on customers',
    databaseType: 'postgresql',
    databaseName: 'retail_db',
    environment: 'production',
    author: 'Chief DBA',
    checksum: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
    createdAt: new Date().toISOString(),
    operations: ['addColumn'],
    riskLevel: 'low',
    lockImpact: 'ACCESS EXCLUSIVE on customers (5s lock timeout)',
  },
  'ALTER TABLE customers ADD COLUMN loyalty_tier VARCHAR(50);',
  'ALTER TABLE customers DROP COLUMN IF EXISTS loyalty_tier;',
  safeScorecard
);
assert(auditReport.includes('# MigrateIQ — Executive Database Schema Audit Report'), 'Audit report contains executive header');
assert(auditReport.includes('**Environment Tier:** `PRODUCTION`'), 'Audit report reflects environment tier');
assert(auditReport.includes('SHA-256 Integrity Checksum'), 'Audit report records cryptographic checksum');
assert(auditReport.includes('## 1. Executive Impact & Safety Assessment'), 'Audit report contains Risk Assessment section');
assert(auditReport.includes('```sql') && auditReport.includes('ALTER TABLE customers ADD COLUMN'), 'Audit report contains forward SQL code block');
assert(auditReport.includes('## 4. Rollback Recovery Script'), 'Audit report contains rollback recovery script');

// 8.3 Cryptographic Checksum Integrity
const crypto = require('crypto');
const sampleScript = 'ALTER TABLE orders ADD COLUMN delivery_slot TIMESTAMP;';
const checksum1 = crypto.createHash('sha256').update(sampleScript).digest('hex');
const checksum2 = crypto.createHash('sha256').update(sampleScript).digest('hex');
const modifiedChecksum = crypto.createHash('sha256').update(sampleScript + ' ').digest('hex');
assert(checksum1.length === 64, 'SHA-256 produces 64-character hex hash');
assert(checksum1 === checksum2, 'Identical script produces deterministic identical checksum');
assert(checksum1 !== modifiedChecksum, 'Script alteration produces completely distinct checksum');

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
