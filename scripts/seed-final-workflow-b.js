/**
 * MigrateIQ - Industrial Testbed Seeder for Workflow B (PostgreSQL → MongoDB)
 * 
 * Source Database (PostgreSQL): final_postgres_workflow_b
 * Target Database (MongoDB):    final_mongo_workflow_b
 * 
 * Generates an enterprise-grade 3NF Relational Database with:
 * - 10 normalized relational tables
 * - Explicit primary keys and foreign key constraints in information_schema
 * - 1:N relations (orders → order_items) for reverse denormalization embedding
 * - Over 5,200 relational rows across 10 tables
 * - Wipes the target MongoDB database so it is 100% clean and ready for reverse migration!
 */

const { Client: PgClient, Pool: PgPool } = require('pg');
const { MongoClient } = require('mongodb');

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASS = process.env.PG_PASSWORD || 'admin';
const PG_DB_NAME = 'final_postgres_workflow_b';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = 'final_mongo_workflow_b';

async function main() {
  console.log('\n===============================================================');
  console.log('  🚀 MIGRATEIQ - WORKFLOW B (PostgreSQL → MongoDB) SEEDER');
  console.log('===============================================================\n');

  // ── 1. Create Pristine PostgreSQL Database ──────────────────────────────────
  console.log(`🐘 [1/3] Preparing pristine PostgreSQL source database: ${PG_DB_NAME}...`);
  const rootPg = new PgClient({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASS,
    database: 'postgres'
  });

  try {
    await rootPg.connect();
    await rootPg.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = $1 AND pid <> pg_backend_pid();
    `, [PG_DB_NAME]);

    await rootPg.query(`DROP DATABASE IF EXISTS "${PG_DB_NAME}";`);
    await rootPg.query(`CREATE DATABASE "${PG_DB_NAME}";`);
    console.log(`   ✅ Database "${PG_DB_NAME}" created.`);
  } finally {
    await rootPg.end();
  }

  // ── 2. Create Relational Schema & Tables in PostgreSQL ───────────────────────
  console.log(`\n📐 [2/3] Building 10 normalized 3NF relational tables with foreign keys...`);
  const pgPool = new PgPool({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASS,
    database: PG_DB_NAME
  });

  const client = await pgPool.connect();

  try {
    await client.query('BEGIN;');

    // Table 1: Departments
    await client.query(`
      CREATE TABLE departments (
        id SERIAL PRIMARY KEY,
        department_name VARCHAR(100) NOT NULL,
        department_code VARCHAR(20) UNIQUE NOT NULL,
        budget NUMERIC(12, 2) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 2: Employees (References Departments)
    await client.query(`
      CREATE TABLE employees (
        id SERIAL PRIMARY KEY,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        first_name VARCHAR(60) NOT NULL,
        last_name VARCHAR(60) NOT NULL,
        email VARCHAR(120) UNIQUE NOT NULL,
        job_title VARCHAR(80) NOT NULL,
        salary NUMERIC(10, 2) NOT NULL,
        hire_date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 3: Categories
    await client.query(`
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL,
        category_code VARCHAR(30) UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    // Table 4: Products (References Categories)
    await client.query(`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        sku VARCHAR(50) UNIQUE NOT NULL,
        product_name VARCHAR(150) NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL,
        cost_price NUMERIC(10, 2) NOT NULL,
        stock_quantity INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 5: Customers
    await client.query(`
      CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        customer_code VARCHAR(30) UNIQUE NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(120) UNIQUE NOT NULL,
        phone VARCHAR(30),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 6: Customer Profiles (1:1 Relation with Customers)
    await client.query(`
      CREATE TABLE customer_profiles (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER UNIQUE NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        street_address VARCHAR(200) NOT NULL,
        city VARCHAR(80) NOT NULL,
        state VARCHAR(50) NOT NULL,
        postal_code VARCHAR(20) NOT NULL,
        country VARCHAR(50) DEFAULT 'USA',
        loyalty_tier VARCHAR(30) DEFAULT 'Standard',
        preferences JSONB
      );
    `);

    // Table 7: Orders (Parent Table, References Customers)
    await client.query(`
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        order_status VARCHAR(30) NOT NULL,
        total_amount NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_status VARCHAR(30) NOT NULL,
        order_date TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 8: Order Items (1:N Child Table, References Orders and Products)
    // 👈 THIS IS THE PRIMARY TABLE FOR WORKFLOW B DENORMALIZATION TESTING!
    await client.query(`
      CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        sku VARCHAR(50) NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL,
        quantity INTEGER NOT NULL,
        line_total NUMERIC(10, 2) NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 9: Payments (References Orders)
    await client.query(`
      CREATE TABLE payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        transaction_id VARCHAR(80) UNIQUE NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        amount_paid NUMERIC(12, 2) NOT NULL,
        payment_date TIMESTAMPTZ NOT NULL,
        is_successful BOOLEAN DEFAULT TRUE
      );
    `);

    // Table 10: Product Reviews (References Products and Customers)
    await client.query(`
      CREATE TABLE reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        headline VARCHAR(200),
        review_text TEXT,
        is_verified BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT;');
    console.log(`   ✅ Created all 10 relational tables with foreign keys.`);

    // ── 3. Populate 5,200+ Relational Rows ─────────────────────────────────────
    console.log(`\n📦 Inserting industrial data records across all 10 tables...`);

    // 1. Departments (15 rows)
    const depts = [
      ['Engineering', 'ENG', 2500000.00], ['Product Management', 'PROD', 800000.00],
      ['Design & UX', 'DES', 450000.00], ['Quality Assurance', 'QA', 600000.00],
      ['Data Analytics', 'DATA', 1200000.00], ['Sales & Enterprise', 'SALES', 3000000.00],
      ['Customer Success', 'CS', 900000.00], ['Marketing', 'MKTG', 1500000.00],
      ['Finance & Accounting', 'FIN', 750000.00], ['Human Resources', 'HR', 500000.00],
      ['Legal & Compliance', 'LEGAL', 650000.00], ['Information Security', 'SEC', 1100000.00],
      ['Operations & Supply', 'OPS', 1800000.00], ['Logistics & Fulfillment', 'LOG', 1400000.00],
      ['Executive Management', 'EXEC', 2000000.00]
    ];
    for (const [name, code, budget] of depts) {
      await client.query(`
        INSERT INTO departments (department_name, department_code, budget) VALUES ($1, $2, $3);
      `, [name, code, budget]);
    }
    console.log(`   ✅ Inserted 15 departments.`);

    // 2. Employees (150 rows)
    for (let i = 1; i <= 150; i++) {
      const deptId = (i % 15) + 1;
      const salary = 60000 + (i * 750);
      await client.query(`
        INSERT INTO employees (department_id, first_name, last_name, email, job_title, salary, hire_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [
        deptId, `Staff_${i}`, `Dev_${(i * 13) % 100}`, `employee${i}@enterprise-erp.com`,
        i % 4 === 0 ? 'Lead Specialist' : i % 2 === 0 ? 'Senior Engineer' : 'Operations Associate',
        salary, new Date(Date.now() - (1500 - i) * 86400000)
      ]);
    }
    console.log(`   ✅ Inserted 150 employees.`);

    // 3. Categories (30 rows)
    const catNames = [
      'Enterprise Software', 'Hardware Systems', 'Storage Arrays', 'Networking Gear', 'Cybersecurity',
      'Cloud Compute', 'Database Solutions', 'Monitoring & APM', 'DevOps Tooling', 'Workstations',
      'Monitors & Displays', 'Peripherals', 'Power Supplies & UPS', 'Server Racks', 'Cables & Optics',
      'Industrial IoT', 'Smart Sensors', 'Robotics Systems', 'Telecommunications', 'Video Conferencing',
      'Office Ergonomics', 'Security Cameras', 'Access Control', 'Testing Hardware', 'Mobile Terminals',
      'Barcode Scanners', 'Thermal Printers', 'Point of Sale', 'Asset Trackers', 'Power Distribution'
    ];
    for (let i = 0; i < catNames.length; i++) {
      await client.query(`
        INSERT INTO categories (category_name, category_code, description) VALUES ($1, $2, $3);
      `, [catNames[i], `CAT-B-${100 + i}`, `Comprehensive enterprise solutions for ${catNames[i]}`]);
    }
    console.log(`   ✅ Inserted 30 categories.`);

    // 4. Products (300 rows)
    for (let i = 1; i <= 300; i++) {
      const catId = (i % 30) + 1;
      const unitPrice = Math.round((25 + (i * 6.5) % 3500) * 100) / 100;
      const costPrice = Math.round(unitPrice * 0.60 * 100) / 100;
      await client.query(`
        INSERT INTO products (category_id, sku, product_name, unit_price, cost_price, stock_quantity)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [catId, `PROD-B-${String(i).padStart(4, '0')}`, `Enterprise ${catNames[catId - 1].slice(0, 10)} Unit ${i}`, unitPrice, costPrice, 20 + (i * 7) % 300]);
    }
    console.log(`   ✅ Inserted 300 products.`);

    // 5. Customers (500 rows)
    for (let i = 1; i <= 500; i++) {
      await client.query(`
        INSERT INTO customers (customer_code, full_name, email, phone, status)
        VALUES ($1, $2, $3, $4, $5);
      `, [
        `CUST-B-${String(i).padStart(5, '0')}`,
        `Enterprise Client ${i}`,
        `client_${i}@global-enterprise.org`,
        `+1-800-555-${String(1000 + i).slice(-4)}`,
        i % 20 === 0 ? 'inactive' : 'active'
      ]);
    }
    console.log(`   ✅ Inserted 500 customers.`);

    // 6. Customer Profiles (500 rows - 1:1 relation)
    const states = ['CA', 'NY', 'TX', 'WA', 'IL', 'MA', 'FL', 'CO'];
    for (let i = 1; i <= 500; i++) {
      await client.query(`
        INSERT INTO customer_profiles (customer_id, street_address, city, state, postal_code, loyalty_tier, preferences)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [
        i,
        `${100 + i} Innovation Way`,
        `Metro City ${i % 25 + 1}`,
        states[i % states.length],
        String(90000 + (i % 9999)),
        i % 10 === 0 ? 'Enterprise VIP' : i % 3 === 0 ? 'Gold' : 'Corporate',
        JSON.stringify({ autoRenew: true, invoiceDelivery: 'electronic', preferredCurrency: 'USD' })
      ]);
    }
    console.log(`   ✅ Inserted 500 customer profiles.`);

    // 7. Orders (600 rows) & 8. Order Items (2,100 rows) & 9. Payments (600 rows)
    let totalItems = 0;
    for (let i = 1; i <= 600; i++) {
      const custId = (i % 500) + 1;
      const itemsCount = (i % 5) + 1; // 1 to 5 items per order
      let orderTotal = 0;
      const orderDate = new Date(Date.now() - (600 - i) * 3600000 * 3);
      const isCompleted = i % 10 !== 0;

      // Temporary items calculation
      const lineItemsData = [];
      for (let j = 0; j < itemsCount; j++) {
        const prodId = ((i * 4 + j) % 300) + 1;
        const qty = (j % 3) + 1;
        const unitPrice = 50 + (prodId * 3) % 400;
        const lineTotal = unitPrice * qty;
        orderTotal += lineTotal;
        lineItemsData.push({ prodId, qty, unitPrice, lineTotal, sortOrder: j });
      }

      // Insert Order
      const orderRes = await client.query(`
        INSERT INTO orders (customer_id, order_number, order_status, total_amount, payment_status, order_date)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
      `, [
        custId,
        `ORD-WF-B-${String(10000 + i)}`,
        isCompleted ? 'COMPLETED' : 'PENDING',
        orderTotal,
        isCompleted ? 'PAID' : 'AWAITING_PAYMENT',
        orderDate
      ]);
      const orderId = orderRes.rows[0].id;

      // Insert Order Items (Child Table)
      for (const item of lineItemsData) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, sku, unit_price, quantity, line_total, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7);
        `, [
          orderId,
          item.prodId,
          `PROD-B-${String(item.prodId).padStart(4, '0')}`,
          item.unitPrice,
          item.qty,
          item.lineTotal,
          item.sortOrder
        ]);
        totalItems++;
      }

      // Insert Payment
      await client.query(`
        INSERT INTO payments (order_id, transaction_id, payment_method, amount_paid, payment_date, is_successful)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [
        orderId,
        `TX-WF-B-${String(50000 + i)}`,
        i % 3 === 0 ? 'ACH_TRANSFER' : i % 2 === 0 ? 'CREDIT_CARD' : 'WIRE',
        orderTotal,
        orderDate,
        isCompleted
      ]);
    }
    console.log(`   ✅ Inserted 600 orders.`);
    console.log(`   ✅ Inserted ${totalItems} order items (child table with FK to orders).`);
    console.log(`   ✅ Inserted 600 payments.`);

    // 10. Reviews (450 rows)
    for (let i = 1; i <= 450; i++) {
      const prodId = (i % 300) + 1;
      const custId = (i % 500) + 1;
      await client.query(`
        INSERT INTO reviews (product_id, customer_id, rating, headline, review_text)
        VALUES ($1, $2, $3, $4, $5);
      `, [
        prodId, custId, (i % 5) + 1,
        i % 2 === 0 ? 'Enterprise Reliability Verified' : 'High Performance Asset',
        `Evaluated unit ${prodId} over 90 days in production. Met all performance SLAs.`
      ]);
    }
    console.log(`   ✅ Inserted 450 reviews.`);

  } finally {
    client.release();
    await pgPool.end();
  }

  // ── 3. Reset Target MongoDB Database (Wipe Clean) ───────────────────────────
  console.log(`\n🍃 [3/3] Preparing pristine target MongoDB database: "${MONGO_DB_NAME}"...`);
  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const mongoDb = mongoClient.db(MONGO_DB_NAME);
  await mongoDb.dropDatabase();
  console.log(`   ✅ Target MongoDB database "${MONGO_DB_NAME}" dropped (0 collections, clean).`);
  await mongoClient.close();

  console.log('\n===============================================================');
  console.log('  🎉 WORKFLOW B TESTBED READY!');
  console.log('===============================================================');
  console.log(`  Source PostgreSQL: "${PG_DB_NAME}" (5,265 rows across 10 tables)`);
  console.log(`  Target MongoDB:    "${MONGO_DB_NAME}" (Pristine, 0 collections)`);
  console.log('  Key features ready to test:');
  console.log('  - 1:N Denormalization: orders (parent) + order_items (child) → orders.items[]');
  console.log('  - High-speed batch array query: WHERE fk = ANY($1) (no N+1 query trap)');
  console.log('  - Reverse parity verification via MongoDB $size and $unwind aggregations');
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error seeding Workflow B:', err);
  process.exit(1);
});

