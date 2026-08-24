/**
 * MigrateIQ - Local Sample Database Seeder
 * Creates sample MongoDB and PostgreSQL databases for quick testing
 */

const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');

// CLI Arguments fallback: node scripts/seed-sample-dbs.js [pg_password] [pg_user] [pg_database] [pg_port]
const args = process.argv.slice(2);
const cliPgPassword = args[0];
const cliPgUser = args[1];
const cliPgDatabase = args[2];
const cliPgPort = args[3];

// Configurations (defaults to standard local ports)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB || 'migrateiq_mongo_test';

const PG_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(cliPgPort || process.env.PG_PORT || '5432', 10),
  user: cliPgUser || process.env.PG_USER || 'postgres',
  password: cliPgPassword || process.env.PG_PASSWORD || 'postgres',
  database: cliPgDatabase || process.env.PG_DATABASE || 'postgres',
};

async function seedMongoDB() {
  console.log('\n🍃 [1/2] Connecting to MongoDB at', MONGO_URI, '...');
  let client;
  try {
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 4000 });
    await client.connect();
    const db = client.db(MONGO_DB_NAME);

    console.log(`🍃 Connected to MongoDB database: "${MONGO_DB_NAME}"`);

    // 1. Users collection
    const users = db.collection('users');
    await users.deleteMany({});
    await users.insertMany([
      { name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', age: 29, createdAt: new Date() },
      { name: 'Bob Smith', email: 'bob@example.com', role: 'customer', age: 34, createdAt: new Date() },
      { name: 'Charlie Brown', email: 'charlie@example.com', role: 'customer', age: null, createdAt: new Date() },
      { name: 'Diana Prince', email: 'diana@example.com', role: 'vendor', age: 27, createdAt: new Date() },
    ]);
    console.log('   ✓ Seeded collection: "users" (4 documents)');

    // 2. Products collection with polymorphic specs
    const products = db.collection('products');
    await products.deleteMany({});
    await products.insertMany([
      { name: 'Ergonomic Chair', category: 'Furniture', price: 249.99, inStock: true, specs: { color: 'Black', maxWeightKg: 150 } },
      { name: 'Wireless Mechanical Keyboard', category: 'Electronics', price: 129.50, inStock: true, specs: { switches: 'Cherry MX Blue', batteryMah: 4000 } },
      { name: 'USB-C Fast Charger', category: 'Electronics', price: 34.99, inStock: false, specs: { wattage: 65, ports: 3 } },
      { name: 'Organic Coffee Beans (1kg)', category: 'Grocery', price: 28.00, inStock: true, specs: { origin: 'Ethiopia', roast: 'Medium' } },
    ]);
    console.log('   ✓ Seeded collection: "products" (4 documents with dynamic specs)');

    // 3. Orders collection with embedded array (1-to-many relationship)
    const orders = db.collection('orders');
    await orders.deleteMany({});
    await orders.insertMany([
      {
        orderNumber: 'ORD-2026-001',
        customerName: 'Alice Johnson',
        totalAmount: 379.49,
        status: 'completed',
        items: [
          { productName: 'Ergonomic Chair', price: 249.99, qty: 1 },
          { productName: 'Wireless Mechanical Keyboard', price: 129.50, qty: 1 }
        ],
        orderDate: new Date('2026-08-01')
      },
      {
        orderNumber: 'ORD-2026-002',
        customerName: 'Bob Smith',
        totalAmount: 62.99,
        status: 'shipped',
        items: [
          { productName: 'USB-C Fast Charger', price: 34.99, qty: 1 },
          { productName: 'Organic Coffee Beans (1kg)', price: 28.00, qty: 1 }
        ],
        orderDate: new Date('2026-08-15')
      }
    ]);
    console.log('   ✓ Seeded collection: "orders" (2 documents with embedded items arrays)');

    console.log(`✅ MongoDB "${MONGO_DB_NAME}" is ready!`);
  } catch (err) {
    console.error('❌ MongoDB Seeding Error:', err.message);
    console.log('   (Make sure your local MongoDB service is running on port 27017)');
  } finally {
    if (client) await client.close();
  }
}

async function seedPostgreSQL() {
  console.log('\n🐘 [2/2] Connecting to PostgreSQL at', `${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_CONFIG.database}`, '...');
  let client;
  try {
    client = new PgClient({
      ...PG_CONFIG,
      connectionTimeoutMillis: 4000,
    });
    await client.connect();

    console.log(`🐘 Connected to PostgreSQL database: "${PG_CONFIG.database}"`);

    // Drop and recreate sample tables
    await client.query(`
      DROP TABLE IF EXISTS test_sales CASCADE;
      DROP TABLE IF EXISTS test_inventory CASCADE;
      DROP TABLE IF EXISTS test_customers CASCADE;
      DROP VIEW IF EXISTS view_sales_summary;

      -- 1. Customers Table
      CREATE TABLE test_customers (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        city VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Inventory Table
      CREATE TABLE test_inventory (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(120) NOT NULL,
        category VARCHAR(50) NOT NULL,
        quantity INT DEFAULT 0,
        unit_price NUMERIC(10,2) NOT NULL
      );

      -- 3. Sales Table with Foreign Key
      CREATE TABLE test_sales (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES test_customers(id) ON DELETE CASCADE,
        total_amount NUMERIC(10,2) NOT NULL,
        payment_method VARCHAR(30) DEFAULT 'Card',
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 4. Sample View (Layer 2 Feature)
      CREATE VIEW view_sales_summary AS
      SELECT 
        c.full_name,
        c.email,
        COUNT(s.id) AS total_orders,
        COALESCE(SUM(s.total_amount), 0) AS total_spent
      FROM test_customers c
      LEFT JOIN test_sales s ON c.id = s.customer_id
      GROUP BY c.id, c.full_name, c.email;

      -- Insert Sample Data
      INSERT INTO test_customers (full_name, email, city) VALUES
        ('David Miller', 'david@example.com', 'Mumbai'),
        ('Emma Watson', 'emma@example.com', 'Pune'),
        ('Frank Castle', 'frank@example.com', 'Bengaluru');

      INSERT INTO test_inventory (item_name, category, quantity, unit_price) VALUES
        ('4K IPS Monitor 27"', 'Displays', 15, 349.99),
        ('USB Condenser Microphone', 'Audio', 40, 89.99),
        ('Ergonomic Mousepad XL', 'Accessories', 120, 19.50);

      INSERT INTO test_sales (customer_id, total_amount, payment_method) VALUES
        (1, 439.98, 'Credit Card'),
        (2, 89.99, 'UPI'),
        (1, 19.50, 'UPI');
    `);

    console.log('   ✓ Created & seeded table: "test_customers" (3 rows)');
    console.log('   ✓ Created & seeded table: "test_inventory" (3 rows)');
    console.log('   ✓ Created & seeded table: "test_sales" (3 rows with FK relation)');
    console.log('   ✓ Created Layer 2 view: "view_sales_summary"');

    console.log(`✅ PostgreSQL database "${PG_CONFIG.database}" is ready!`);
  } catch (err) {
    console.error('❌ PostgreSQL Seeding Error:', err.message);
    console.log('   (Make sure your local PostgreSQL service is running on port 5432, with user "postgres" and password "postgres")');
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

async function main() {
  console.log('==============================================');
  console.log('🚀 MigrateIQ - Local Sample Database Seeder');
  console.log('==============================================');

  await seedMongoDB();
  await seedPostgreSQL();

  console.log('\n==============================================');
  console.log('🎉 Seeding process completed!');
  console.log('You can now open MigrateIQ and connect:');
  console.log('  🍃 MongoDB Source: mongodb://localhost:27017/migrateiq_mongo_test');
  console.log('  🐘 PostgreSQL Target: postgresql://postgres:postgres@localhost:5432/postgres');
  console.log('==============================================\n');
}

main();
