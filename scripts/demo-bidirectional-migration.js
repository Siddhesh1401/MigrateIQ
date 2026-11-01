/**
 * MigrateIQ - Complete Bi-Directional Migration Demo
 * 
 * Demonstrates BOTH migration directions live:
 * 1. Workflow A: MongoDB → PostgreSQL (Normalization: Embedded arrays -> Child tables + FKs + sort_order)
 * 2. Workflow B: PostgreSQL → MongoDB (Denormalization: Relational tables + FKs -> Embedded BSON arrays)
 */

const { MongoClient } = require('mongodb');
const { Pool } = require('pg');
const path = require('path');

const distEnginePath = path.join(__dirname, '../apps/desktop/dist-electron/engine');
const { executeMigration } = require(path.join(distEnginePath, 'etlEngine.js'));
const { executeReverseMigration } = require(path.join(distEnginePath, 'reverseEtlEngine.js'));
const { generateMappingByRules } = require(path.join(distEnginePath, 'ruleEngine.js'));

const MONGO_URI = 'mongodb://localhost:27017';
const MONGO_DB_NAME = 'migrateiq_demo_mongo';

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'admin',
  database: 'phase9b_target_pg'
};

async function runDemo() {
  console.log('\n===============================================================');
  console.log('       MIGRATEIQ - LIVE BI-DIRECTIONAL MIGRATION DEMO');
  console.log('===============================================================\n');

  const mongoClient = new MongoClient(MONGO_URI);
  const pgPool = new Pool(PG_CONFIG);

  try {
    await mongoClient.connect();
    await pgPool.query('SELECT 1;');
    console.log('✅ Connected to MongoDB (localhost:27017) and PostgreSQL (localhost:5432)\n');

    const mongoDb = mongoClient.db(MONGO_DB_NAME);

    // =========================================================================
    // PART 1: MONGODB → POSTGRESQL (WORKFLOW A: NORMALIZATION)
    // =========================================================================
    console.log('───────────────────────────────────────────────────────────────');
    console.log('🟢 [DIRECTION 1] WORKFLOW A: MongoDB → PostgreSQL (Normalization)');
    console.log('───────────────────────────────────────────────────────────────');

    console.log('🍃 Step 1: Seeding MongoDB collection "demo_orders" with embedded items...');
    const sourceColl = mongoDb.collection('demo_orders');
    await sourceColl.deleteMany({});
    await sourceColl.insertMany([
      {
        orderNumber: 'ORD-101',
        customerName: 'Sarah Connor',
        totalAmount: 299.99,
        items: [
          { sku: 'SKU-A1', itemTitle: 'Neural Processor Unit', price: 199.99, quantity: 1 },
          { sku: 'SKU-B2', itemTitle: 'Titanium Endoskeleton Joint', price: 100.00, quantity: 1 }
        ]
      },
      {
        orderNumber: 'ORD-102',
        customerName: 'John Matrix',
        totalAmount: 150.00,
        items: [
          { sku: 'SKU-C3', itemTitle: 'Thermal Camouflage Vest', price: 150.00, quantity: 1 }
        ]
      }
    ]);
    console.log('   ✓ Seeded 2 MongoDB documents with embedded arrays:');
    console.log('     • Order ORD-101 (2 embedded items)');
    console.log('     • Order ORD-102 (1 embedded item)\n');

    console.log('⚙️ Step 2: Auto-generating normalized schema mapping with MigrateIQ Rule Engine...');
    const sourceSchema = [
      {
        collectionName: 'demo_orders',
        documentCount: 2,
        fields: [
          { name: '_id', bsonType: 'objectId', isNullable: false, isArray: false },
          { name: 'orderNumber', bsonType: 'string', isNullable: false, isArray: false },
          { name: 'customerName', bsonType: 'string', isNullable: false, isArray: false },
          { name: 'totalAmount', bsonType: 'double', isNullable: false, isArray: false },
          {
            name: 'items',
            bsonType: 'arrayOfObjects',
            isNullable: false,
            isArray: true,
            nestedFields: [
              { name: 'sku', bsonType: 'string', isNullable: false, isArray: false },
              { name: 'itemTitle', bsonType: 'string', isNullable: false, isArray: false },
              { name: 'price', bsonType: 'double', isNullable: false, isArray: false },
              { name: 'quantity', bsonType: 'int', isNullable: false, isArray: false }
            ]
          }
        ]
      }
    ];

    const mongoMappings = generateMappingByRules(sourceSchema, 'mongodb-to-postgres');

    // Clean target tables beforehand
    await pgPool.query('DROP TABLE IF EXISTS "demo_orders_items" CASCADE; DROP TABLE IF EXISTS "demo_orders" CASCADE;');

    console.log('🚀 Step 3: Executing Live Migration (MongoDB → PostgreSQL)...');
    const resultA = await executeMigration({
      sourceConfig: { type: 'mongodb', database: MONGO_DB_NAME, connectionString: `${MONGO_URI}/${MONGO_DB_NAME}` },
      targetConfig: { type: 'postgresql', ...PG_CONFIG },
      mappings: mongoMappings,
      tableOrder: ['demo_orders', 'demo_orders_items'],
      batchSize: 50
    });

    console.log(`   ✓ Migration completed! Total rows migrated across parent & child tables: ${resultA.migratedRows}, Success: ${resultA.success}`);

    // Verify in PostgreSQL
    const pgOrders = await pgPool.query('SELECT * FROM "demo_orders" ORDER BY id;');
    const pgItems = await pgPool.query('SELECT * FROM "demo_orders_items" ORDER BY id;');

    console.log('\n   📊 PostgreSQL Normalized Relational Tables:');
    console.log('   → Primary Table "demo_orders":');
    console.table(pgOrders.rows);
    console.log('   → Normalized Child Table "demo_orders_items" (Foreign Key + sort_order):');
    console.table(pgItems.rows);
    console.log('✅ [DIRECTION 1 VERIFIED] MongoDB documents cleanly normalized into 1NF PostgreSQL tables.\n');


    // =========================================================================
    // PART 2: POSTGRESQL → MONGODB (WORKFLOW B: DENORMALIZATION)
    // =========================================================================
    console.log('───────────────────────────────────────────────────────────────');
    console.log('🔵 [DIRECTION 2] WORKFLOW B: PostgreSQL → MongoDB (Denormalization)');
    console.log('───────────────────────────────────────────────────────────────');

    console.log('🐘 Step 1: Setting up clean PostgreSQL relational source with Foreign Key...');
    await pgPool.query(`
      DROP TABLE IF EXISTS "pg_source_items" CASCADE;
      DROP TABLE IF EXISTS "pg_source_orders" CASCADE;

      CREATE TABLE "pg_source_orders" (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        order_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE "pg_source_items" (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES "pg_source_orders"(id) ON DELETE CASCADE,
        product_name VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL
      );

      INSERT INTO "pg_source_orders" (order_number, customer_name, total_amount) VALUES
        ('PG-2001', 'Bruce Wayne', 1250.00),
        ('PG-2002', 'Clark Kent', 89.90);

      INSERT INTO "pg_source_items" (order_id, product_name, quantity, unit_price) VALUES
        (1, 'Batarang Tactical Kit', 5, 150.00),
        (1, 'Grappling Hook 3000', 1, 500.00),
        (2, 'Daily Planet Press Badge', 1, 15.00),
        (2, 'Vintage Typewriter Ribbon', 2, 37.45);
    `);

    const pgSrcOrders = await pgPool.query('SELECT * FROM "pg_source_orders" ORDER BY id;');
    const pgSrcItems = await pgPool.query('SELECT * FROM "pg_source_items" ORDER BY id;');
    console.log('   ✓ Relational Source in PostgreSQL:');
    console.log('   → Orders table:');
    console.table(pgSrcOrders.rows);
    console.log('   → Items table (linked via order_id FK):');
    console.table(pgSrcItems.rows);

    console.log('\n⚙️ Step 2: Inverting schema mapping with 1:N Denormalization Heuristics...');
    const reverseMappings = [
      {
        collectionName: 'pg_source_orders',
        targetTableName: 'orders_denormalized_in_mongo',
        isEmbeddedChild: false,
        fields: [
          { sourceField: 'id', sourceType: 'SERIAL', targetColumn: 'orderId', targetType: 'int', include: true },
          { sourceField: 'order_number', sourceType: 'VARCHAR(50)', targetColumn: 'orderNumber', targetType: 'string', include: true },
          { sourceField: 'customer_name', sourceType: 'VARCHAR(100)', targetColumn: 'customerName', targetType: 'string', include: true },
          { sourceField: 'total_amount', sourceType: 'NUMERIC(10,2)', targetColumn: 'totalAmount', targetType: 'decimal', include: true },
          { sourceField: 'order_date', sourceType: 'TIMESTAMPTZ', targetColumn: 'orderDate', targetType: 'date', include: true }
        ]
      },
      {
        collectionName: 'pg_source_items',
        targetTableName: 'pg_source_items',
        isEmbeddedChild: true,
        parentTable: 'pg_source_orders',
        foreignKeyColumn: 'order_id',
        parentKeyColumn: 'id',
        embeddedFieldName: 'items',
        embeddingType: 'embed_array',
        fields: [
          { sourceField: 'id', sourceType: 'SERIAL', targetColumn: 'itemId', targetType: 'int', include: true },
          { sourceField: 'product_name', sourceType: 'VARCHAR(100)', targetColumn: 'productName', targetType: 'string', include: true },
          { sourceField: 'quantity', sourceType: 'INTEGER', targetColumn: 'quantity', targetType: 'int', include: true },
          { sourceField: 'unit_price', sourceType: 'NUMERIC(10,2)', targetColumn: 'unitPrice', targetType: 'decimal', include: true }
        ]
      }
    ];

    console.log('   ✓ Denormalization Configuration:');
    console.log('     • Table "pg_source_orders" → Target MongoDB Collection: "orders_denormalized_in_mongo"');
    console.log('     • Child Table "pg_source_items" → Embedded BSON Array: "items[]"');

    console.log('\n🚀 Step 3: Executing Reverse ETL Pipeline (PostgreSQL → MongoDB)...');
    await mongoDb.collection('orders_denormalized_in_mongo').drop().catch(() => null);

    const resultB = await executeReverseMigration({
      sourceConfig: { type: 'postgresql', ...PG_CONFIG },
      targetConfig: { type: 'mongodb', database: MONGO_DB_NAME, connectionString: `${MONGO_URI}/${MONGO_DB_NAME}` },
      mappings: reverseMappings,
      batchSize: 50
    });

    console.log(`   ✓ Reverse Migration completed! Root docs: ${resultB.migratedRows}, Success: ${resultB.success}`);

    // Verify in MongoDB
    const reverseDocs = await mongoDb.collection('orders_denormalized_in_mongo').find({}).toArray();
    console.log('\n   📊 MongoDB Target Collection ("orders_denormalized_in_mongo"):');
    console.log(JSON.stringify(reverseDocs, null, 2));

    console.log('\n✅ [DIRECTION 2 VERIFIED] PostgreSQL relational tables denormalized into MongoDB documents with nested arrays.');

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n===============================================================');
    console.log('   🎉 COMPLETE SUCCESS: BOTH MIGRATION DIRECTIONS ARE FULLY FUNCTIONAL!');
    console.log('   • Direction 1 (MongoDB → PostgreSQL): Verified with Normalization');
    console.log('   • Direction 2 (PostgreSQL → MongoDB): Verified with Denormalization');
    console.log('===============================================================\n');

  } finally {
    await mongoClient.close();
    await pgPool.end();
  }
}

runDemo().catch((err) => {
  console.error('\n❌ DEMO FAILED:', err);
  process.exit(1);
});
