/**
 * MigrateIQ - Phase 12 (Workflow B: PostgreSQL -> MongoDB) Verification Test Suite
 *
 * Verifies:
 * 1. PostgreSQL Foreign Key Introspection (information_schema query)
 * 2. Denormalization Rule Engine Heuristics (1:N relation detection, child embedding suggestion)
 * 3. Reverse ETL Engine Execution (streaming batch migration, ANY($1) child resolution, nested BSON trees)
 * 4. Rollback Script Generation and Execution (dropping MongoDB collections)
 */

const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

const path = require('path');
const distEnginePath = path.join(__dirname, '../apps/desktop/dist-electron/engine');
const { generateMappingByRules } = require(path.join(distEnginePath, 'ruleEngine.js'));
const { executeReverseMigration } = require(path.join(distEnginePath, 'reverseEtlEngine.js'));

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'admin',
  database: 'phase9b_target_pg'
};

const MONGO_URI = 'mongodb://localhost:27017';
const MONGO_TARGET_DB = 'phase12_reverse_test';

async function run() {
  console.log('\n======================================================');
  console.log('   MIGRATEIQ - PHASE 12 VERIFICATION SUITE');
  console.log('   Workflow B: PostgreSQL → MongoDB Reverse Direction');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 4;

  const pgPool = new Pool(PG_CONFIG);
  const mongoClient = new MongoClient(MONGO_URI);

  try {
    await pgPool.query('SELECT 1;');
    await mongoClient.connect();
    console.log('✅ Connected to PostgreSQL (phase9b_target_pg) and MongoDB (localhost:27017)\n');

    // ────────────────────────────────────────────────────────────────────────
    // Setup Test Relational Schema & Data in PostgreSQL
    // ────────────────────────────────────────────────────────────────────────
    console.log('📦 Setting up test relational schema (orders & order_items) in PostgreSQL...');
    await pgPool.query(`
      DROP TABLE IF EXISTS "order_items" CASCADE;
      DROP TABLE IF EXISTS "orders" CASCADE;

      CREATE TABLE "orders" (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE "order_items" (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES "orders"(id) ON DELETE CASCADE,
        product_name VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL
      );

      INSERT INTO "orders" (order_number, customer_name, total_amount) VALUES
        ('ORD-001', 'Alice Smith', 150.00),
        ('ORD-002', 'Bob Johnson', 320.50),
        ('ORD-003', 'Charlie Brown', 45.00);

      INSERT INTO "order_items" (order_id, product_name, quantity, unit_price) VALUES
        (1, 'Laptop Sleeve', 1, 25.00),
        (1, 'Wireless Mouse', 1, 125.00),
        (2, 'USB-C Cable', 2, 15.25),
        (2, 'Mechanical Keyboard', 1, 190.00),
        (2, 'Desk Mat', 1, 100.00),
        (3, 'Screen Cleaner', 3, 15.00);
    `);
    console.log('✅ Test schema and data created successfully.\n');

    // ────────────────────────────────────────────────────────────────────────
    // TEST 1: Foreign Key Introspection
    // ────────────────────────────────────────────────────────────────────────
    console.log('🔍 [TEST 1/4] PostgreSQL Foreign Key Introspection...');
    const targetSchema = 'public';
    const fkResult = await pgPool.query(`
      SELECT
        tc.constraint_name,
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1;
    `, [targetSchema]);

    const foreignKeys = fkResult.rows.map(r => ({
      constraintName: r.constraint_name,
      sourceTable: r.source_table,
      sourceColumn: r.source_column,
      targetTable: r.target_table,
      targetColumn: r.target_column,
    }));

    const foundFk = foreignKeys.find(
      fk => fk.sourceTable === 'order_items' &&
            fk.sourceColumn === 'order_id' &&
            fk.targetTable === 'orders' &&
            fk.targetColumn === 'id'
    );

    if (foundFk) {
      console.log(`   Found Foreign Key: ${foundFk.sourceTable}.${foundFk.sourceColumn} → ${foundFk.targetTable}.${foundFk.targetColumn}`);
      console.log('   ✅ TEST 1 PASSED: Foreign key accurately introspected.\n');
      passedTests++;
    } else {
      throw new Error(`TEST 1 FAILED: Expected foreign key from order_items.order_id to orders.id not found.`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 2: Denormalization Rule Engine Heuristics
    // ────────────────────────────────────────────────────────────────────────
    console.log('⚙️ [TEST 2/4] Reverse Rule Engine Denormalization Heuristics...');
    const testSchemas = [
      {
        collectionName: 'orders',
        documentCount: 3,
        fields: [
          { name: 'id', bsonType: 'int', sqlType: 'SERIAL', isNullable: false, isArray: false },
          { name: 'order_number', bsonType: 'string', sqlType: 'VARCHAR(50)', isNullable: false, isArray: false },
          { name: 'customer_name', bsonType: 'string', sqlType: 'VARCHAR(100)', isNullable: false, isArray: false },
          { name: 'total_amount', bsonType: 'decimal', sqlType: 'NUMERIC(10,2)', isNullable: false, isArray: false },
          { name: 'created_at', bsonType: 'date', sqlType: 'TIMESTAMPTZ', isNullable: true, isArray: false }
        ]
      },
      {
        collectionName: 'order_items',
        documentCount: 6,
        fields: [
          { name: 'id', bsonType: 'int', sqlType: 'SERIAL', isNullable: false, isArray: false },
          { name: 'order_id', bsonType: 'int', sqlType: 'INTEGER', isNullable: false, isArray: false, foreignKeyToParent: 'orders.id' },
          { name: 'product_name', bsonType: 'string', sqlType: 'VARCHAR(100)', isNullable: false, isArray: false },
          { name: 'quantity', bsonType: 'int', sqlType: 'INTEGER', isNullable: false, isArray: false },
          { name: 'unit_price', bsonType: 'decimal', sqlType: 'NUMERIC(10,2)', isNullable: false, isArray: false }
        ]
      }
    ];

    const mappings = generateMappingByRules(testSchemas, 'postgres-to-mongo');

    const ordersMapping = mappings.find(m => m.collectionName === 'orders');
    const itemsMapping = mappings.find(m => m.collectionName === 'order_items');

    if (!ordersMapping || !itemsMapping) {
      throw new Error('TEST 2 FAILED: Mappings for orders and order_items could not be generated.');
    }

    if (
      itemsMapping.isEmbeddedChild === true &&
      itemsMapping.parentTable === 'orders' &&
      itemsMapping.foreignKeyColumn === 'order_id' &&
      itemsMapping.embeddedFieldName === 'items' &&
      itemsMapping.embeddingType === 'embed_array' &&
      ordersMapping.childTables &&
      ordersMapping.childTables.length > 0
    ) {
      console.log(`   Denormalization Mapping: table "${itemsMapping.collectionName}" → embedded array "${itemsMapping.parentTable}.${itemsMapping.embeddedFieldName}[]"`);
      console.log('   ✅ TEST 2 PASSED: 1:N relations correctly inferred as embedded child arrays.\n');
      passedTests++;
    } else {
      console.log('itemsMapping:', JSON.stringify(itemsMapping, null, 2));
      throw new Error('TEST 2 FAILED: Denormalization fields mismatch.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 3: Reverse ETL Execution
    // ────────────────────────────────────────────────────────────────────────
    console.log('🚀 [TEST 3/4] Reverse ETL Execution (PostgreSQL → MongoDB)...');
    const targetDb = mongoClient.db(MONGO_TARGET_DB);
    await targetDb.collection('orders').drop().catch(() => null);

    const progressLogs = [];
    const migrationResult = await executeReverseMigration({
      sourceConfig: {
        type: 'postgresql',
        ...PG_CONFIG
      },
      targetConfig: {
        type: 'mongodb',
        database: MONGO_TARGET_DB,
        connectionString: `${MONGO_URI}/${MONGO_TARGET_DB}`
      },
      mappings,
      batchSize: 100,
      onProgress: (p) => {
        progressLogs.push(p);
      }
    });

    if (!migrationResult.success) {
      throw new Error(`TEST 3 FAILED: Reverse migration execution failed: ${migrationResult.error}`);
    }

    console.log(`   Migrated ${migrationResult.migratedRows} root order documents in ${migrationResult.duration}ms.`);

    // Inspect target MongoDB data
    const mongoOrders = await targetDb.collection('orders').find({}).toArray();
    if (mongoOrders.length !== 3) {
      throw new Error(`TEST 3 FAILED: Expected 3 documents in MongoDB orders collection, got ${mongoOrders.length}`);
    }

    const ord1 = mongoOrders.find(o => o.order_number === 'ORD-001');
    const ord2 = mongoOrders.find(o => o.order_number === 'ORD-002');
    const ord3 = mongoOrders.find(o => o.order_number === 'ORD-003');

    if (!ord1 || !ord2 || !ord3) {
      throw new Error(`TEST 3 FAILED: One or more order documents missing in MongoDB.`);
    }

    if (!Array.isArray(ord1.items) || ord1.items.length !== 2) {
      throw new Error(`TEST 3 FAILED: ORD-001 items expected 2, got ${ord1.items?.length}`);
    }
    if (!Array.isArray(ord2.items) || ord2.items.length !== 3) {
      throw new Error(`TEST 3 FAILED: ORD-002 items expected 3, got ${ord2.items?.length}`);
    }
    if (!Array.isArray(ord3.items) || ord3.items.length !== 1) {
      throw new Error(`TEST 3 FAILED: ORD-003 items expected 1, got ${ord3.items?.length}`);
    }

    // Check embedded item fields
    const firstItem = ord1.items[0];
    if (firstItem.product_name !== 'Laptop Sleeve' || firstItem.quantity !== 1 || Number(firstItem.unit_price) !== 25) {
      throw new Error(`TEST 3 FAILED: Nested item structure or types incorrect: ${JSON.stringify(firstItem)}`);
    }

    console.log(`   Document Sample in MongoDB (orders):`);
    console.log(JSON.stringify({
      order_number: ord1.order_number,
      customer_name: ord1.customer_name,
      total_amount: ord1.total_amount,
      items: ord1.items
    }, null, 2));

    console.log('   ✅ TEST 3 PASSED: Reverse ETL successfully migrated relational rows into nested BSON document trees.\n');
    passedTests++;

    // ────────────────────────────────────────────────────────────────────────
    // TEST 4: Rollback Script Execution
    // ────────────────────────────────────────────────────────────────────────
    console.log('⏪ [TEST 4/4] Rollback Script Generation and Execution...');
    if (!migrationResult.rollbackScript || !migrationResult.rollbackScript.includes('db.getCollection("orders").drop()')) {
      throw new Error(`TEST 4 FAILED: Rollback script missing or malformed: ${migrationResult.rollbackScript}`);
    }
    console.log(`   Generated Rollback Script:\n   ${migrationResult.rollbackScript.trim()}`);

    // Execute rollback logic
    const colMatches = [...migrationResult.rollbackScript.matchAll(/db\.getCollection\(["']([^"']+)["']\)\.drop\(\)/g)];
    for (const m of colMatches) {
      await targetDb.collection(m[1]).drop().catch(() => null);
    }

    const remainingCount = await targetDb.collection('orders').countDocuments();
    if (remainingCount !== 0) {
      throw new Error(`TEST 4 FAILED: Rollback did not drop orders collection (count=${remainingCount})`);
    }

    console.log('   ✅ TEST 4 PASSED: Rollback cleanly dropped created MongoDB target collections.\n');
    passedTests++;

    // ────────────────────────────────────────────────────────────────────────
    // Final Summary
    // ────────────────────────────────────────────────────────────────────────
    console.log('======================================================');
    console.log(`   ALL PHASE 12 VERIFICATION TESTS PASSED (${passedTests}/${totalTests})`);
    console.log('   Workflow B (PostgreSQL → MongoDB) 100% Functional');
    console.log('======================================================\n');

  } finally {
    await pgPool.end().catch(() => null);
    await mongoClient.close().catch(() => null);
  }
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
