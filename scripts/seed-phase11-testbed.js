/**
 * MigrateIQ — Phase 11 Testbed Database Seeder
 *
 * Populates clean, lightweight MongoDB and PostgreSQL test databases specifically
 * designed to test Workflow C (Schema Update Assistant):
 *
 * Databases:
 * 🍃 MongoDB:    "phase11migrateiq"
 * 🐘 PostgreSQL: "phase11migrateiq"
 *
 * Scenarios Ready to Test in Phase 11 Wizard:
 * 1. Add Column (Safe Nullable vs NOT NULL populated-table violation)
 * 2. 1-Click Auto-Fix on Populated Table
 * 3. Drop Column (Permanent Data Loss Critical Risk)
 * 4. Rename Column (orders.order_status -> status)
 * 5. Rename Table (archived_logs -> system_audit_logs)
 * 6. Change Column Type (orders.total_amount -> NUMERIC(12,2))
 * 7. Create Index (Unique index on customers.email)
 * 8. Add Foreign Key (orders.customer_id -> customers.id)
 * 9. Gemini NL2DDL & Offline Regex Natural Language Interpretation
 */

const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');

// CLI Arguments: node scripts/seed-phase11-testbed.js [pg_password] [pg_user] [pg_database] [pg_port]
const args = process.argv.slice(2);
const cliPgPassword = args[0];
const cliPgUser = args[1];
const cliPgDatabase = args[2];
const cliPgPort = args[3];

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = 'phase11migrateiq';
const PG_DB_NAME = 'phase11migrateiq';

const PG_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(cliPgPort || process.env.PG_PORT || '5432', 10),
  user: cliPgUser || process.env.PG_USER || 'postgres',
  password: cliPgPassword || process.env.PG_PASSWORD || 'admin',
  database: cliPgDatabase || 'postgres', // Start connected to default db to create phase11migrateiq
};

// ── 1. MongoDB Seeder ────────────────────────────────────────────────────────
async function seedMongoDB() {
  console.log('\n🍃 [1/2] Connecting to MongoDB at', MONGO_URI, '...');
  let client;
  try {
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
    });
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    console.log(`🍃 Connected to MongoDB database: "${MONGO_DB_NAME}"`);

    // Clean old collections
    try {
      await db.collection('users').drop();
    } catch (_) {}
    try {
      await db.collection('products').drop();
    } catch (_) {}

    // 1. Users collection
    const users = db.collection('users');
    await users.insertMany([
      { name: 'Alice Cooper', email: 'alice@phase11.test', role: 'admin', age: 31, createdAt: new Date() },
      { name: 'Bob Vance', email: 'bob@phase11.test', role: 'member', age: 45, createdAt: new Date() },
      { name: 'Charlie Day', email: 'charlie@phase11.test', role: 'member', age: 28, createdAt: new Date() },
      { name: 'Diana Prince', email: 'diana@phase11.test', role: 'manager', age: 35, createdAt: new Date() },
    ]);
    console.log('   ✓ Seeded collection: "users" (4 documents)');

    // 2. Products collection
    const products = db.collection('products');
    await products.insertMany([
      { sku: 'PROD-001', name: 'Mechanical Keyboard', category: 'Electronics', price: 99.99, inStock: true },
      { sku: 'PROD-002', name: 'Ergonomic Desk Mat', category: 'Accessories', price: 29.50, inStock: true },
      { sku: 'PROD-003', name: 'USB-C Display Hub', category: 'Electronics', price: 49.00, inStock: false },
    ]);
    console.log('   ✓ Seeded collection: "products" (3 documents)');

    console.log(`✅ MongoDB database "${MONGO_DB_NAME}" is seeded and ready!`);
  } catch (err) {
    console.error('❌ MongoDB Seeding Error:', err.message);
    console.log('   (Make sure MongoDB is running on port 27017)');
  } finally {
    if (client) await client.close();
  }
}

// ── 2. PostgreSQL Seeder ─────────────────────────────────────────────────────
async function seedPostgreSQL() {
  console.log('\n🐘 [2/2] Connecting to PostgreSQL at', `${PG_CONFIG.host}:${PG_CONFIG.port}...`);
  let rootClient;
  let targetClient;

  try {
    // Step A: Connect to default postgres DB and ensure phase11migrateiq exists
    rootClient = new PgClient({
      ...PG_CONFIG,
      database: 'postgres',
      connectionTimeoutMillis: 5000,
    });
    await rootClient.connect();

    const dbCheck = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [PG_DB_NAME]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`   Creating PostgreSQL database "${PG_DB_NAME}"...`);
      await rootClient.query(`CREATE DATABASE "${PG_DB_NAME}"`);
      console.log(`   ✓ Created database: "${PG_DB_NAME}"`);
    } else {
      console.log(`   Database "${PG_DB_NAME}" already exists.`);
    }
    await rootClient.end();
    rootClient = null;

    // Step B: Connect directly to phase11migrateiq and create tables
    targetClient = new PgClient({
      ...PG_CONFIG,
      database: PG_DB_NAME,
      connectionTimeoutMillis: 5000,
    });
    await targetClient.connect();

    console.log(`🐘 Connected to PostgreSQL database: "${PG_DB_NAME}"`);

    await targetClient.query(`
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS archived_logs CASCADE;

      -- 1. Customers Table (Populated with 5 rows)
      -- Perfect for testing NOT NULL violation risk & 1-Click Auto-Fix
      CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(120) NOT NULL,
        city VARCHAR(60) DEFAULT 'Mumbai',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO customers (full_name, email, city) VALUES
        ('Sarah Connor', 'sarah@phase11.test', 'Los Angeles'),
        ('John Doe', 'john@phase11.test', 'New York'),
        ('Priya Sharma', 'priya@phase11.test', 'Delhi'),
        ('Amit Verma', 'amit@phase11.test', 'Bengaluru'),
        ('Carlos Santana', 'carlos@phase11.test', 'Madrid');

      -- 2. Orders Table
      -- Perfect for testing renameColumn, changeType, addIndex, and foreign key
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        customer_id INT,
        order_number VARCHAR(50) NOT NULL,
        total_amount NUMERIC(10,2) NOT NULL,
        order_status VARCHAR(30) DEFAULT 'pending',
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO orders (customer_id, order_number, total_amount, order_status) VALUES
        (1, 'ORD-2026-101', 149.99, 'completed'),
        (2, 'ORD-2026-102', 89.50, 'processing'),
        (3, 'ORD-2026-103', 29.99, 'shipped'),
        (1, 'ORD-2026-104', 320.00, 'completed'),
        (4, 'ORD-2026-105', 75.25, 'pending');

      -- 3. Archived Logs Table
      -- Perfect for testing renameTable or dropColumn
      CREATE TABLE archived_logs (
        id SERIAL PRIMARY KEY,
        log_message TEXT NOT NULL,
        severity VARCHAR(20) DEFAULT 'info',
        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO archived_logs (log_message, severity) VALUES
        ('System initialized successfully', 'info'),
        ('Daily scheduled backup completed', 'info');
    `);

    console.log('   ✓ Created & seeded table: "customers" (5 rows)');
    console.log('   ✓ Created & seeded table: "orders" (5 rows)');
    console.log('   ✓ Created & seeded table: "archived_logs" (2 rows)');

    console.log(`✅ PostgreSQL database "${PG_DB_NAME}" is ready!`);
  } catch (err) {
    console.error('❌ PostgreSQL Seeding Error:', err.message);
    console.log('   (Tip: pass your postgres password: node scripts/seed-phase11-testbed.js [password])');
  } finally {
    if (rootClient) await rootClient.end().catch(() => {});
    if (targetClient) await targetClient.end().catch(() => {});
  }
}

async function main() {
  console.log('======================================================');
  console.log('🚀 MigrateIQ — Phase 11 Testbed Database Seeder');
  console.log('======================================================');

  await seedMongoDB();
  await seedPostgreSQL();

  console.log('\n======================================================');
  console.log('🎉 Seeding Complete! Ready for Phase 11 Testing:');
  console.log('======================================================');
  console.log('In MigrateIQ (http://localhost:5173/#/schema-update):');
  console.log('');
  console.log('🐘 PostgreSQL Connection:');
  console.log(`  • Host: ${PG_CONFIG.host}`);
  console.log(`  • Port: ${PG_CONFIG.port}`);
  console.log(`  • Database: ${PG_DB_NAME}`);
  console.log(`  • User: ${PG_CONFIG.user}`);
  console.log(`  • URL: postgresql://${PG_CONFIG.user}:${PG_CONFIG.password}@${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_DB_NAME}`);
  console.log('');
  console.log('🍃 MongoDB Connection:');
  console.log(`  • URL: ${MONGO_URI}/${MONGO_DB_NAME}`);
  console.log(`  • Database: ${MONGO_DB_NAME}`);
  console.log('======================================================\n');
}

main();
