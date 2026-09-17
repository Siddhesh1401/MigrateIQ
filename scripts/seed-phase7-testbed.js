/**
 * MigrateIQ - Phase 7 Comprehensive Risk & Layer 2 Testbed Seeder
 *
 * Populates MongoDB and PostgreSQL with realistic edge cases designed specifically
 * to trigger and test every rule in the Phase 7 Pre-Migration Risk Report:
 *
 * ── MongoDB ("migrateiq_phase7_test"):
 * 1. Array of Objects (Rule 1, Critical):
 *    - "orders.items" contains nested product objects -> Tests "create_child_table" Auto-Fix.
 * 2. Strict NOT NULL with Missing Documents (Rule 2, Critical):
 *    - "users.email" is missing or null in 15 of 50 documents (30%) -> Tests "set_nullable" Auto-Fix.
 * 3. Mixed Polymorphic Data Types (Rule 5, Warning):
 *    - "customers.phone" contains formatted strings in some docs, integers in others.
 * 4. Large Binary Data & Memory Ceiling (Rule 7, Warning, Challenge 8):
 *    - "product_assets.binary_payload" has 150KB average doc size -> Tests "reduce_batch_size" Auto-Fix.
 * 5. Flattened Nested Objects (Rule 8, Info):
 *    - "users.address" contains embedded street/city/zip subdocuments.
 * 6. Polymorphic Specs for GIN Index (Rule 9, Info):
 *    - "catalog.specs" contains dynamic key-value attributes.
 *
 * ── PostgreSQL ("postgres"):
 * 1. Target Table Collision (Rule 6, Warning):
 *    - Pre-creates an existing "orders" table to test destination collision warning.
 * 2. Circular Foreign Key Graph (Rule 3, Critical, Challenge 4):
 *    - "pg_companies" and "pg_managers" have mutual cross-referencing foreign keys.
 * 3. Complete Layer 2 Application Logic Suite (Postgres -> Mongo):
 *    - Stored Procedure: "proc_apply_bulk_discount(category_filter, discount_pct)"
 *    - SQL Function: "fn_calculate_tax(subtotal, tax_rate)"
 *    - Database Trigger: "trg_check_inventory_stock" on "test_inventory"
 *    - SQL View: "view_customer_orders_detailed"
 *    - ENUM Type: "order_fulfillment_status" ('pending','processing','packed','shipped','delivered','returned')
 *    - Composite Primary Key: "test_product_supplier_map" on (product_id, supplier_id)
 */

const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');
const crypto = require('crypto');

// CLI Arguments: node scripts/seed-phase7-testbed.js [pg_password] [pg_user] [pg_database] [pg_port]
const args = process.argv.slice(2);
const cliPgPassword = args[0];
const cliPgUser = args[1];
const cliPgDatabase = args[2];
const cliPgPort = args[3];

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB || 'migrateiq_phase7_test';

const PG_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(cliPgPort || process.env.PG_PORT || '5432', 10),
  user: cliPgUser || process.env.PG_USER || 'postgres',
  password: cliPgPassword || process.env.PG_PASSWORD || 'admin',
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

    // ──────────────────────────────────────────────────────────────────────────
    // 1. "users" Collection:
    //    - 15 of 50 docs have NULL or missing email (Rule 2: Strict NOT NULL Critical)
    //    - Has nested "address" object (Rule 8: Flattened info)
    // ──────────────────────────────────────────────────────────────────────────
    const usersCol = db.collection('users');
    await usersCol.deleteMany({});
    const userDocs = [];
    for (let i = 1; i <= 50; i++) {
      const isMissingEmail = i <= 15; // 30% missing
      userDocs.push({
        userId: `USR-${1000 + i}`,
        fullName: `User ${i} Test`,
        email: isMissingEmail ? null : `user${i}@example.com`,
        isActive: i % 2 === 0,
        address: {
          street: `${i * 12} MG Road`,
          city: i % 3 === 0 ? 'Mumbai' : i % 3 === 1 ? 'Pune' : 'Bengaluru',
          zipCode: `4000${String(i).padStart(2, '0')}`,
          state: 'Maharashtra',
        },
        createdAt: new Date(),
      });
    }
    await usersCol.insertMany(userDocs);
    console.log('   ✓ Seeded "users": 50 docs (15 missing email -> triggers 🔴 NOT NULL Critical)');

    // ──────────────────────────────────────────────────────────────────────────
    // 2. "orders" Collection:
    //    - Contains nested array of item objects (Rule 1: Unmapped Array Critical)
    // ──────────────────────────────────────────────────────────────────────────
    const ordersCol = db.collection('orders');
    await ordersCol.deleteMany({});
    const orderDocs = [];
    for (let i = 1; i <= 10; i++) {
      orderDocs.push({
        orderNumber: `ORD-2026-${String(i).padStart(3, '0')}`,
        customerName: `Customer ${i}`,
        totalAmount: Number((i * 49.99 + 15).toFixed(2)),
        status: i % 2 === 0 ? 'completed' : 'pending',
        items: [
          { productId: `PRD-${i}01`, productName: `Product Alpha ${i}`, price: 29.99, qty: 1 },
          { productId: `PRD-${i}02`, productName: `Product Beta ${i}`, price: 19.99, qty: 2 },
          { productId: `PRD-${i}03`, productName: `Product Gamma ${i}`, price: 14.50, qty: 1 },
        ],
        orderDate: new Date(),
      });
    }
    await ordersCol.insertMany(orderDocs);
    console.log('   ✓ Seeded "orders": 10 docs with nested "items" arrays (triggers 🔴 Array Critical)');

    // ──────────────────────────────────────────────────────────────────────────
    // 3. "customers" Collection:
    //    - Mixed polymorphic data types in "phone" (Rule 5: Mixed Type Warning)
    // ──────────────────────────────────────────────────────────────────────────
    const customersCol = db.collection('customers');
    await customersCol.deleteMany({});
    const customerDocs = [];
    for (let i = 1; i <= 30; i++) {
      customerDocs.push({
        customerId: `CUST-${100 + i}`,
        company: `Enterprise ${i} Ltd`,
        // 50% String ("+91-98200-xxxxx"), 50% Number (98200xxxxx)
        phone: i % 2 === 0 ? `+91-98200-${10000 + i}` : 9820010000 + i,
        accountTier: i % 3 === 0 ? 'Enterprise' : 'Standard',
      });
    }
    await customersCol.insertMany(customerDocs);
    console.log('   ✓ Seeded "customers": 30 docs with mixed String/Integer "phone" (triggers 🟡 Mixed Warning)');

    // ──────────────────────────────────────────────────────────────────────────
    // 4. "product_assets" Collection:
    //    - Documents > 150KB average size (Rule 7: Large Binary Warning, Challenge 8)
    // ──────────────────────────────────────────────────────────────────────────
    const assetsCol = db.collection('product_assets');
    await assetsCol.deleteMany({});
    const assetDocs = [];
    for (let i = 1; i <= 5; i++) {
      // 140KB random binary buffer per document
      const randomBinary = crypto.randomBytes(140 * 1024);
      assetDocs.push({
        assetId: `ASSET-HD-${i}`,
        assetName: `High-Resolution Product Manual PDF ${i}`,
        mimeType: 'application/pdf',
        binary_payload: randomBinary,
        fileSizeBytes: randomBinary.length,
        uploadedAt: new Date(),
      });
    }
    await assetsCol.insertMany(assetDocs);
    console.log('   ✓ Seeded "product_assets": 5 docs (>140KB each -> triggers 🟡 Large Binary Warning & Batch Throttle)');

    // ──────────────────────────────────────────────────────────────────────────
    // 5. "catalog" Collection:
    //    - Polymorphic schema specs (Rule 9: GIN Index Info)
    // ──────────────────────────────────────────────────────────────────────────
    const catalogCol = db.collection('catalog');
    await catalogCol.deleteMany({});
    await catalogCol.insertMany([
      { sku: 'LAPTOP-01', name: 'Developer Pro Laptop', specs: { cpu: 'i9-14900H', ramGb: 64, gpu: 'RTX 4080' } },
      { sku: 'CHAIR-01', name: 'Ergonomic Mesh Chair', specs: { maxWeightKg: 150, lumbarSupport: true, material: 'Breathable Mesh' } },
      { sku: 'COFFEE-01', name: 'Dark Roast Arabica', specs: { grindType: 'Whole Bean', weightGrams: 1000, roastLevel: 'Dark' } },
    ]);
    console.log('   ✓ Seeded "catalog": 3 docs with polymorphic JSONB specs (triggers ℹ️ GIN Index Info)');

    console.log(`\n✅ MongoDB "${MONGO_DB_NAME}" seeding complete!`);
  } catch (err) {
    console.error('❌ MongoDB Seeding Error:', err.message);
    console.log('   (Verify local MongoDB service is running on port 27017)');
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

    // Clean up existing tables and dependencies
    await client.query(`
      -- Clean up previous runs
      DROP TABLE IF EXISTS test_product_supplier_map CASCADE;
      DROP TABLE IF EXISTS pg_companies CASCADE;
      DROP TABLE IF EXISTS pg_managers CASCADE;
      DROP TABLE IF EXISTS test_sales CASCADE;
      DROP TABLE IF EXISTS test_inventory CASCADE;
      DROP TABLE IF EXISTS test_customers CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP VIEW IF EXISTS view_customer_orders_detailed CASCADE;
      DROP VIEW IF EXISTS view_sales_summary CASCADE;
      DROP PROCEDURE IF EXISTS proc_apply_bulk_discount CASCADE;
      DROP FUNCTION IF EXISTS fn_calculate_tax CASCADE;
      DROP FUNCTION IF EXISTS trg_audit_inventory_update CASCADE;
      DROP TYPE IF EXISTS order_fulfillment_status CASCADE;

      -- ────────────────────────────────────────────────────────────────────────
      -- 1. Target Collision Table (Rule 6: Warning)
      -- Pre-create table named "orders" so migrating Mongo "orders" detects collision
      -- ────────────────────────────────────────────────────────────────────────
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        legacy_order_ref VARCHAR(50),
        existing_notes TEXT
      );
      INSERT INTO orders (legacy_order_ref, existing_notes) VALUES ('LEGACY-001', 'Pre-existing record in Postgres');

      -- ────────────────────────────────────────────────────────────────────────
      -- 2. Circular Foreign Key Dependency (Rule 3: Critical, Challenge 4)
      -- pg_companies references pg_managers AND pg_managers references pg_companies
      -- ────────────────────────────────────────────────────────────────────────
      CREATE TABLE pg_companies (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(100) NOT NULL,
        lead_manager_id INT
      );

      CREATE TABLE pg_managers (
        id SERIAL PRIMARY KEY,
        manager_name VARCHAR(100) NOT NULL,
        company_id INT REFERENCES pg_companies(id) ON DELETE SET NULL
      );

      ALTER TABLE pg_companies 
        ADD CONSTRAINT fk_company_lead_manager 
        FOREIGN KEY (lead_manager_id) REFERENCES pg_managers(id) ON DELETE SET NULL;

      INSERT INTO pg_companies (company_name) VALUES ('Acme Corp');
      INSERT INTO pg_managers (manager_name, company_id) VALUES ('John Doe', 1);
      UPDATE pg_companies SET lead_manager_id = 1 WHERE id = 1;

      -- ────────────────────────────────────────────────────────────────────────
      -- 3. Base Relational Tables for Layer 2 Features
      -- ────────────────────────────────────────────────────────────────────────
      CREATE TABLE test_customers (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        city VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE test_inventory (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(120) NOT NULL,
        category VARCHAR(50) NOT NULL,
        quantity INT DEFAULT 10,
        unit_price NUMERIC(10,2) NOT NULL
      );

      -- ENUM Type (Layer 2 Feature: ENUM)
      CREATE TYPE order_fulfillment_status AS ENUM (
        'pending', 'processing', 'packed', 'shipped', 'delivered', 'returned'
      );

      CREATE TABLE test_sales (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES test_customers(id) ON DELETE CASCADE,
        total_amount NUMERIC(10,2) NOT NULL,
        status order_fulfillment_status DEFAULT 'pending',
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- ────────────────────────────────────────────────────────────────────────
      -- 4. Composite Primary Key (Layer 2 Feature: Composite PK)
      -- Multi-column primary key on (product_id, supplier_id)
      -- ────────────────────────────────────────────────────────────────────────
      CREATE TABLE test_product_supplier_map (
        product_id INT NOT NULL,
        supplier_id INT NOT NULL,
        lead_time_days INT DEFAULT 7,
        unit_cost NUMERIC(10,2) NOT NULL,
        PRIMARY KEY (product_id, supplier_id)
      );

      -- ────────────────────────────────────────────────────────────────────────
      -- 5. SQL View (Layer 2 Feature: View)
      -- ────────────────────────────────────────────────────────────────────────
      CREATE VIEW view_customer_orders_detailed AS
      SELECT 
        c.id AS customer_id,
        c.full_name,
        c.email,
        COUNT(s.id) AS total_purchases,
        COALESCE(SUM(s.total_amount), 0) AS lifetime_value
      FROM test_customers c
      LEFT JOIN test_sales s ON c.id = s.customer_id
      GROUP BY c.id, c.full_name, c.email;

      -- ────────────────────────────────────────────────────────────────────────
      -- 6. Stored Procedure (Layer 2 Feature: Stored Procedure, prokind = 'p')
      -- ────────────────────────────────────────────────────────────────────────
      CREATE OR REPLACE PROCEDURE proc_apply_bulk_discount(category_filter VARCHAR, discount_pct NUMERIC)
      LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE test_inventory 
        SET unit_price = ROUND(unit_price * (1.0 - (discount_pct / 100.0)), 2)
        WHERE category = category_filter;
      END;
      $$;

      -- ────────────────────────────────────────────────────────────────────────
      -- 7. SQL Function (Layer 2 Feature: Function, prokind = 'f')
      -- ────────────────────────────────────────────────────────────────────────
      CREATE OR REPLACE FUNCTION fn_calculate_tax(subtotal NUMERIC, tax_rate NUMERIC DEFAULT 0.18)
      RETURNS NUMERIC LANGUAGE plpgsql AS $$
      BEGIN
        RETURN ROUND(subtotal * tax_rate, 2);
      END;
      $$;

      -- ────────────────────────────────────────────────────────────────────────
      -- 8. Database Trigger (Layer 2 Feature: Trigger)
      -- ────────────────────────────────────────────────────────────────────────
      CREATE OR REPLACE FUNCTION trg_audit_inventory_update()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.quantity = GREATEST(0, NEW.quantity);
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_check_inventory_stock
      BEFORE UPDATE ON test_inventory
      FOR EACH ROW
      EXECUTE FUNCTION trg_audit_inventory_update();

      -- ────────────────────────────────────────────────────────────────────────
      -- Insert Base Sample Rows
      -- ────────────────────────────────────────────────────────────────────────
      INSERT INTO test_customers (full_name, email, city) VALUES
        ('Rohan Sharma', 'rohan@example.com', 'Mumbai'),
        ('Ananya Iyer', 'ananya@example.com', 'Chennai'),
        ('Vikram Mehta', 'vikram@example.com', 'Delhi');

      INSERT INTO test_inventory (item_name, category, quantity, unit_price) VALUES
        ('Mechanical Gaming Keyboard', 'Electronics', 25, 120.00),
        ('UltraWide 34" Curved Monitor', 'Electronics', 10, 499.99),
        ('Ergonomic Memory Foam Cushion', 'Furniture', 50, 45.50);

      INSERT INTO test_sales (customer_id, total_amount, status) VALUES
        (1, 120.00, 'shipped'),
        (2, 499.99, 'processing'),
        (1, 45.50, 'delivered');

      INSERT INTO test_product_supplier_map (product_id, supplier_id, lead_time_days, unit_cost) VALUES
        (101, 501, 5, 85.00),
        (101, 502, 7, 82.50),
        (102, 501, 14, 320.00);
    `);

    console.log('   ✓ Seeded target collision table: "orders" (triggers 🟡 Target Collision Warning)');
    console.log('   ✓ Seeded circular FK tables: "pg_companies ↔ pg_managers" (triggers 🔴 Circular FK Critical)');
    console.log('   ✓ Seeded base tables: "test_customers", "test_inventory", "test_sales"');
    console.log('   ✓ Created Composite PK table: "test_product_supplier_map" (triggers Layer 2 Composite PK ✅)');
    console.log('   ✓ Created SQL View: "view_customer_orders_detailed" (triggers Layer 2 View)');
    console.log('   ✓ Created Stored Procedure: "proc_apply_bulk_discount" (triggers Layer 2 Procedure)');
    console.log('   ✓ Created SQL Function: "fn_calculate_tax" (triggers Layer 2 Function)');
    console.log('   ✓ Created Database Trigger: "trg_check_inventory_stock" (triggers Layer 2 Trigger)');
    console.log('   ✓ Created ENUM Type: "order_fulfillment_status" (triggers Layer 2 ENUM)');

    console.log(`\n✅ PostgreSQL "${PG_CONFIG.database}" seeding complete!`);
  } catch (err) {
    console.error('❌ PostgreSQL Seeding Error:', err.message);
    console.log('   (Verify local PostgreSQL service is running on port 5432, user: postgres, password: postgres)');
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

async function main() {
  console.log('================================================================');
  console.log('🚀 MigrateIQ - Phase 7 Comprehensive Testbed Seeder');
  console.log('================================================================');

  await seedMongoDB();
  await seedPostgreSQL();

  console.log('\n================================================================');
  console.log('🎉 Phase 7 Testbed Ready! Here is how to test in MigrateIQ:');
  console.log('================================================================');
  console.log('\n▶️ TEST 1: MongoDB ➔ PostgreSQL (Risk Analysis & Auto-Fixes)');
  console.log('   1. Select Source: MongoDB');
  console.log(`      Connection: mongodb://localhost:27017/${MONGO_DB_NAME}`);
  console.log('   2. Select Target: PostgreSQL');
  console.log('      Connection: postgresql://postgres:postgres@localhost:5432/postgres');
  console.log('   3. Advance to Step 4 (Schema Mapper) and review mappings.');
  console.log('   4. Advance to Step 5 (Risk Report):');
  console.log('      🔴 Critical: "Array of Objects" in orders.items -> Click [⚡ Auto-Fix]');
  console.log('      🔴 Critical: "NOT NULL with Missing Docs" in users.email (15 missing) -> Click [⚡ Auto-Fix]');
  console.log('      🟡 Warning: "Large Binary Fields" in product_assets (>140KB) -> Click [⚡ Auto-Fix]');
  console.log('      🟡 Warning: "Mixed Data Types" in customers.phone (String + Integer)');
  console.log('      🟡 Warning: "Target Collision" for existing "orders" table in Postgres');
  console.log('      ℹ️ Info: "Nested Object Flattened" for users.address');
  console.log('      🔒 Verify: "Continue to Dry Run" stays disabled until Criticals are fixed/acknowledged!');
  console.log('\n▶️ TEST 2: PostgreSQL ➔ MongoDB (Layer 2 Application Features)');
  console.log('   1. Select Source: PostgreSQL');
  console.log('      Connection: postgresql://postgres:postgres@localhost:5432/postgres');
  console.log('   2. Select Target: MongoDB');
  console.log(`      Connection: mongodb://localhost:27017/${MONGO_DB_NAME}`);
  console.log('   3. Advance to Step 5 (Risk Report) and scroll to Layer 2 Section:');
  console.log('      ⚙️ Stored Procedure: proc_apply_bulk_discount (with Node.js service code)');
  console.log('      ⚙️ Function: fn_calculate_tax (with TypeScript helper code)');
  console.log('      ⚙️ Trigger: trg_check_inventory_stock ON test_inventory (with Mongoose hook)');
  console.log('      ⚙️ View: view_customer_orders_detailed (with $lookup aggregation pipeline)');
  console.log('      ⚙️ ENUM: order_fulfillment_status (with Mongoose enum validator)');
  console.log('      ⚙️ Composite PK: test_product_supplier_map (Auto-Applied compound index ✅)');
  console.log('      📋 Click "Mark as Understood" on each card -> watch the counter update!');
  console.log('      📋 Click "Copy Code" to verify snippet clipboard copy.');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Fatal Seeder Error:', err);
  process.exit(1);
});
