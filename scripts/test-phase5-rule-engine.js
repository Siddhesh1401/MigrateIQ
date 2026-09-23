/**
 * Phase 5 Unit Test Suite — Pure TypeScript Rule Engine & Schema Mapping
 * 
 * Validates:
 * 1. Identifier sanitization & reserved keyword collision prevention
 * 2. CamelCase and dot-notation path flattening to snake_case
 * 3. MongoDB BSON -> PostgreSQL type mapping rules
 * 4. AGENTS.md §4 Array -> Child Table Rule:
 *    - Detects arrayOfObjects
 *    - Injects sort_order INTEGER NOT NULL immediately after child-table row
 *    - Sets sortOrderColumn: true and transformationRule: 'sort_order'
 * 5. Reverse direction: PostgreSQL SQL types -> MongoDB BSON types
 * 6. Inferred index mapping (concurrent indexes, unique constraints)
 * 7. Rule summary documentation integrity
 */

const path = require('path');

console.log('🧪 Running Phase 5 Rule Engine Unit Tests...\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// Load compiled rule engine from dist-electron
const ruleEnginePath = path.join(__dirname, '../apps/desktop/dist-electron/engine/ruleEngine.js');
let ruleEngine;
try {
  ruleEngine = require(ruleEnginePath);
  assert(true, 'Loaded dist-electron/engine/ruleEngine.js successfully');
} catch (err) {
  console.error('Failed to load ruleEngine:', err);
  process.exit(1);
}

const {
  sanitizePostgresIdentifier,
  generateMappingByRules,
  getMappingRulesSummary,
  PG_RESERVED_WORDS,
} = ruleEngine;

// ── Test 1: Identifier Sanitization & Reserved Words ─────────────────────────
console.log('\n📋 Test 1: Identifier Sanitization & Keyword Collision');

assert(sanitizePostgresIdentifier('customerName') === 'customer_name', 'CamelCase converted to snake_case');
assert(sanitizePostgresIdentifier('address.city') === 'address_city', 'Dot notation converted to snake_case');
assert(sanitizePostgresIdentifier('order', false) === 'order_col', 'Reserved word "order" as column appends _col');
assert(sanitizePostgresIdentifier('user', true) === 'users', 'Reserved word "user" as table appends "s"');
assert(sanitizePostgresIdentifier('select', false) === 'select_col', 'Reserved word "select" as column appends _col');
assert(PG_RESERVED_WORDS.has('table'), 'PG_RESERVED_WORDS contains "table"');
assert(PG_RESERVED_WORDS.has('primary'), 'PG_RESERVED_WORDS contains "primary"');

// ── Test 2: BSON to PostgreSQL Type Mapping ─────────────────────────────────
console.log('\n📋 Test 2: BSON -> PostgreSQL Data Type Mapping');

const testMongoSchema = [
  {
    collectionName: 'orders',
    documentCount: 1500,
    fields: [
      { name: '_id', bsonType: 'objectId', isNullable: false, isArray: false },
      { name: 'orderNumber', bsonType: 'string', isNullable: false, isArray: false },
      { name: 'quantity', bsonType: 'int', isNullable: false, isArray: false },
      { name: 'totalAmount', bsonType: 'decimal', isNullable: false, isArray: false },
      { name: 'taxRate', bsonType: 'double', isNullable: true, isArray: false },
      { name: 'isShipped', bsonType: 'bool', isNullable: false, isArray: false },
      { name: 'placedAt', bsonType: 'date', isNullable: false, isArray: false },
      { name: 'trackingUuid', bsonType: 'uuid', isNullable: true, isArray: false },
      { name: 'shippingLabel', bsonType: 'binData', isNullable: true, isArray: false },
      { name: 'tags', bsonType: 'array', isNullable: true, isArray: true, nestedFields: [{ name: '0', bsonType: 'string', isNullable: false, isArray: false }] },
      { name: 'metadata', bsonType: 'object', isNullable: true, isArray: false },
    ],
  },
];

const mappedOrders = generateMappingByRules(testMongoSchema, 'mongodb-to-postgres');
assert(mappedOrders.length === 1, 'Generates 1 collection mapping');
const orderFields = mappedOrders[0].fields;

function findField(col, name) {
  return col.find((f) => f.sourceField === name);
}

assert(findField(orderFields, '_id').targetType === 'VARCHAR(24)', '_id maps to VARCHAR(24)');
assert(findField(orderFields, 'orderNumber').targetType === 'TEXT', 'string maps to TEXT');
assert(findField(orderFields, 'quantity').targetType === 'INTEGER', 'int maps to INTEGER');
assert(findField(orderFields, 'totalAmount').targetType === 'NUMERIC(18,4)', 'decimal maps to NUMERIC(18,4)');
assert(findField(orderFields, 'taxRate').targetType === 'DOUBLE PRECISION', 'double maps to DOUBLE PRECISION');
assert(findField(orderFields, 'isShipped').targetType === 'BOOLEAN', 'bool maps to BOOLEAN');
assert(findField(orderFields, 'placedAt').targetType === 'TIMESTAMPTZ', 'date maps to TIMESTAMPTZ');
assert(findField(orderFields, 'trackingUuid').targetType === 'UUID', 'uuid maps to UUID');
assert(findField(orderFields, 'shippingLabel').targetType === 'BYTEA', 'binData maps to BYTEA');
assert(findField(orderFields, 'tags').targetType === 'TEXT[]', 'array of strings maps to TEXT[]');
assert(findField(orderFields, 'metadata').targetType === 'JSONB', 'object maps to JSONB');

// ── Test 3: AGENTS.md §4 Array -> Child Table Rule & sort_order Injection ──
console.log('\n📋 Test 3: Array -> Child Table Rule & sort_order Auto-Injection');

const nestedArraySchema = [
  {
    collectionName: 'invoices',
    documentCount: 300,
    fields: [
      { name: '_id', bsonType: 'objectId', isNullable: false, isArray: false },
      { name: 'invoiceNum', bsonType: 'string', isNullable: false, isArray: false },
      {
        name: 'lineItems',
        bsonType: 'arrayOfObjects',
        isNullable: false,
        isArray: true,
        nestedFields: [
          { name: 'sku', bsonType: 'string', isNullable: false, isArray: false },
          { name: 'unitPrice', bsonType: 'decimal', isNullable: false, isArray: false },
          { name: 'qty', bsonType: 'int', isNullable: false, isArray: false },
        ],
      },
      { name: 'notes', bsonType: 'string', isNullable: true, isArray: false },
    ],
  },
];

const mappedInvoices = generateMappingByRules(nestedArraySchema, 'mongodb-to-postgres');
const invoiceFields = mappedInvoices[0].fields;

const lineItemsField = invoiceFields.find((f) => f.sourceField === 'lineItems');
assert(lineItemsField && lineItemsField.isChildTable === true, 'lineItems detected as child table');
assert(lineItemsField.childTableName === 'invoices_line_items', 'Child table name properly constructed');
assert(lineItemsField.foreignKeyToParent === 'invoices_id', 'Foreign key to parent populated');

// Find sort_order column immediately after lineItems
const lineItemsIdx = invoiceFields.findIndex((f) => f.sourceField === 'lineItems');
const sortOrderCol = invoiceFields[lineItemsIdx + 1];

assert(sortOrderCol !== undefined, 'sort_order column injected immediately after lineItems');
assert(sortOrderCol.targetColumn === 'sort_order', 'Injected column name is "sort_order"');
assert(sortOrderCol.targetType === 'INTEGER', 'sort_order column type is INTEGER');
assert(sortOrderCol.isNullable === false, 'sort_order column is NOT NULL (isNullable: false)');
assert(sortOrderCol.sortOrderColumn === true, 'sortOrderColumn flag is true');
assert(sortOrderCol.transformationRule === 'sort_order', 'transformationRule is "sort_order"');

// ── Test 4: Reverse Direction (PostgreSQL -> MongoDB BSON) ──────────────────
console.log('\n📋 Test 4: Reverse Mapping (PostgreSQL -> MongoDB)');

const testPgSchema = [
  {
    collectionName: 'products',
    documentCount: 500,
    fields: [
      { name: 'id', bsonType: 'BIGSERIAL', sqlType: 'BIGSERIAL', isNullable: false, isArray: false },
      { name: 'name', bsonType: 'VARCHAR(150)', sqlType: 'VARCHAR(150)', isNullable: false, isArray: false },
      { name: 'price', bsonType: 'NUMERIC(10,2)', sqlType: 'NUMERIC(10,2)', isNullable: false, isArray: false },
      { name: 'is_active', bsonType: 'BOOLEAN', sqlType: 'BOOLEAN', isNullable: false, isArray: false },
      { name: 'created_at', bsonType: 'TIMESTAMPTZ', sqlType: 'TIMESTAMPTZ', isNullable: false, isArray: false },
      { name: 'raw_payload', bsonType: 'JSONB', sqlType: 'JSONB', isNullable: true, isArray: false },
      { name: 'categories', bsonType: 'TEXT[]', sqlType: 'TEXT[]', isNullable: true, isArray: true },
    ],
  },
];

const mappedPg = generateMappingByRules(testPgSchema, 'postgres-to-mongo');
assert(mappedPg.length === 1, 'Generates 1 collection mapping for reverse direction');
const pgFields = mappedPg[0].fields;

assert(findField(pgFields, 'id').targetType === 'long', 'BIGSERIAL maps to long in MongoDB');
assert(findField(pgFields, 'name').targetType === 'string', 'VARCHAR maps to string in MongoDB');
assert(findField(pgFields, 'price').targetType === 'decimal', 'NUMERIC maps to decimal in MongoDB');
assert(findField(pgFields, 'is_active').targetType === 'bool', 'BOOLEAN maps to bool in MongoDB');
assert(findField(pgFields, 'created_at').targetType === 'date', 'TIMESTAMPTZ maps to date in MongoDB');
assert(findField(pgFields, 'raw_payload').targetType === 'object', 'JSONB maps to object in MongoDB');
assert(findField(pgFields, 'categories').targetType === 'array', 'TEXT[] maps to array in MongoDB');

// ── Test 5: Index Inference ─────────────────────────────────────────────────
console.log('\n📋 Test 5: Inferred Indexes Generation');

const schemaWithIndexes = [
  {
    collectionName: 'customers',
    documentCount: 200,
    fields: [{ name: '_id', bsonType: 'objectId', isNullable: false, isArray: false }],
    indexes: [
      { name: 'idx_customers_email', fields: { email: 1 }, unique: true },
      { name: 'idx_customers_status', fields: { status: 1 }, unique: false },
    ],
  },
];

const mappedIndexes = generateMappingByRules(schemaWithIndexes, 'mongodb-to-postgres')[0].indexes;
assert(mappedIndexes.length === 2, 'Maps 2 indexes from schema');
assert(mappedIndexes[0].targetSql.includes('UNIQUE'), 'Unique index maps to UNIQUE constraint/index');
assert(mappedIndexes[1].isConcurrently === true, 'Standard index has isConcurrently: true');
assert(mappedIndexes[1].targetSql.includes('CONCURRENTLY'), 'Standard index SQL contains CONCURRENTLY');

// ── Test 6: Rules Summary Integrity ─────────────────────────────────────────
console.log('\n📋 Test 6: Rules Summary Integrity');
const summary = getMappingRulesSummary();
assert(Array.isArray(summary) && summary.length >= 10, 'Rules summary returns at least 10 rule items');
assert(summary.some((r) => r.bson.includes('ObjectId')), 'Rules summary contains ObjectId mapping');
assert(summary.some((r) => r.postgres === 'TIMESTAMPTZ'), 'Rules summary contains TIMESTAMPTZ rule');
assert(summary.some((r) => r.bson.includes('Array of Objects')), 'Rules summary documents child table array rule');

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`Phase 5 Unit Tests: ${passedTests} passed, ${failedTests} failed`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
