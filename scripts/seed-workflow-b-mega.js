/**
 * MigrateIQ - Mega Testbed Generator for Workflow B (PostgreSQL -> MongoDB)
 * 
 * Features:
 * 1. Creates a pristine PostgreSQL database: `workflow_b_pg`
 * 2. Populates 8 enterprise relational tables (~3,525 rows total) with realistic data:
 *    - `categories` (25 rows)
 *    - `customers` (500 rows)
 *    - `customer_addresses` (600 rows, child of customers via 1:N FK)
 *    - `products` (200 rows, references categories via FK)
 *    - `orders` (350 rows, parent table, references customers via FK)
 *    - `order_items` (1,200 rows, child of orders via 1:N FK)
 *    - `payments` (350 rows, references orders via FK)
 *    - `reviews` (300 rows, references products & customers via FKs)
 * 3. Completely wipes and drops the target MongoDB database: `workflow_b_mongo`
 *    so it is guaranteed 100% EMPTY (0 collections, 0 documents).
 */

const { Client: PgClient, Pool: PgPool } = require('pg');
const { MongoClient } = require('mongodb');

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASS = process.env.PG_PASSWORD || 'admin';
const PG_TARGET_DB = 'workflow_b_pg';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_TARGET_DB = 'workflow_b_mongo';

async function main() {
  console.log('\n===============================================================');
  console.log('  🚀 MIGRATEIQ - WORKFLOW B (PostgreSQL → MongoDB) MEGA SEEDER');
  console.log('===============================================================\n');

  // ── STEP 1: Create fresh PostgreSQL Database ───────────────────────────────
  console.log('🐘 [1/3] Preparing pristine PostgreSQL database:', PG_TARGET_DB);
  const rootPg = new PgClient({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASS,
    database: 'postgres'
  });

  try {
    await rootPg.connect();
    // Terminate existing connections to allow drop
    await rootPg.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = $1 AND pid <> pg_backend_pid();
    `, [PG_TARGET_DB]);

    await rootPg.query(`DROP DATABASE IF EXISTS "${PG_TARGET_DB}";`);
    await rootPg.query(`CREATE DATABASE "${PG_TARGET_DB}";`);
    console.log(`   ✓ Database "${PG_TARGET_DB}" successfully created!\n`);
  } finally {
    await rootPg.end();
  }

  // ── STEP 2: Connect to workflow_b_pg and build schemas & data ──────────────
  console.log('🐘 [2/3] Seeding rich relational data with foreign keys into PostgreSQL...');
  const pool = new PgPool({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASS,
    database: PG_TARGET_DB,
    max: 10
  });

  try {
    // 2.1 Create Tables
    await pool.query(`
      -- Categories Table
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        display_order INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Customers Table
      CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(60) NOT NULL,
        last_name VARCHAR(60) NOT NULL,
        email VARCHAR(120) UNIQUE NOT NULL,
        phone VARCHAR(30),
        tier VARCHAR(20) DEFAULT 'Standard',
        account_balance NUMERIC(10,2) DEFAULT 0.00,
        is_verified BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Customer Addresses (1:N Child of Customers)
      CREATE TABLE customer_addresses (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        street VARCHAR(150) NOT NULL,
        city VARCHAR(60) NOT NULL,
        state VARCHAR(50) NOT NULL,
        postal_code VARCHAR(20) NOT NULL,
        country VARCHAR(50) DEFAULT 'USA',
        is_primary BOOLEAN DEFAULT false
      );

      -- Products Table
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        sku VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        price NUMERIC(10,2) NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 50,
        is_in_stock BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Orders Table (Parent Table)
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        order_date TIMESTAMPTZ DEFAULT NOW(),
        total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 5.99,
        tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        order_status VARCHAR(30) DEFAULT 'Completed'
      );

      -- Order Items (1:N Child of Orders with FK)
      CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_name VARCHAR(150) NOT NULL,
        sku VARCHAR(50) NOT NULL,
        unit_price NUMERIC(10,2) NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal NUMERIC(10,2) NOT NULL
      );

      -- Payments Table (FK to Orders)
      CREATE TABLE payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        transaction_reference VARCHAR(80) UNIQUE NOT NULL,
        amount NUMERIC(10,2) NOT NULL,
        payment_method VARCHAR(40) DEFAULT 'Credit Card',
        status VARCHAR(30) DEFAULT 'Settled',
        processed_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Reviews Table (FKs to Products & Customers)
      CREATE TABLE reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_headline VARCHAR(150),
        review_text TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✓ Relational DDL created (8 tables with foreign key constraints)');

    // 2.2 Seed Categories (25 rows)
    const categoryNames = [
      'Laptops & Notebooks', 'Smartphones', 'Tablets & E-Readers', 'Audio & Headphones',
      'Computer Monitors', 'Mechanical Keyboards', 'Gaming Mice', 'Smart Home & IoT',
      'Wearables & Smartwatches', 'Cameras & Drones', 'Storage & Hard Drives', 'Power & Chargers',
      'Office Chairs', 'Standing Desks', 'Lighting & Lamps', 'Desk Organizers',
      'Backpacks & Sleeves', 'Cables & Adapters', 'VR Headsets', 'Printers & Ink',
      'Networking & Routers', 'Graphic Tablets', 'Microphones & Podcasting', 'Webcams & Streaming',
      'Software & Digital'
    ];
    for (let i = 0; i < categoryNames.length; i++) {
      const name = categoryNames[i];
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await pool.query(
        `INSERT INTO categories (name, slug, description, display_order) VALUES ($1, $2, $3, $4);`,
        [name, slug, `Top quality ${name} for professionals and enthusiasts.`, i + 1]
      );
    }
    console.log('   ✓ Seeded 25 categories');

    // 2.3 Seed Customers (500 rows)
    const firstNames = ['James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'Benjamin', 'Isabella', 'Lucas', 'Mia', 'Henry', 'Charlotte', 'Alexander', 'Amelia', 'Sebastian', 'Harper', 'Jack', 'Evelyn'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    const tiers = ['Standard', 'Silver', 'Gold', 'Platinum'];

    const customerValues = [];
    for (let i = 1; i <= 500; i++) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[(i * 7) % lastNames.length];
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@example.com`;
      const phone = `+1-555-01${String(i).padStart(3, '0')}`;
      const tier = tiers[i % tiers.length];
      const balance = Number((Math.random() * 450 + 20).toFixed(2));
      customerValues.push(`('${fn}', '${ln}', '${email}', '${phone}', '${tier}', ${balance})`);
    }
    await pool.query(`
      INSERT INTO customers (first_name, last_name, email, phone, tier, account_balance)
      VALUES ${customerValues.join(',\n')};
    `);
    console.log('   ✓ Seeded 500 customers');

    // 2.4 Seed Customer Addresses (600 rows - Child 1:N)
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Seattle'];
    const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA', 'TX', 'WA'];
    const addressValues = [];
    for (let i = 1; i <= 600; i++) {
      const customerId = (i % 500) + 1;
      const street = `${(i * 123) % 9000 + 100} Industrial Parkway Suite ${i % 50 + 1}`;
      const cityIdx = i % cities.length;
      const city = cities[cityIdx];
      const state = states[cityIdx];
      const zip = `90${String(i % 900 + 100)}`;
      const isPrimary = i <= 500;
      addressValues.push(`(${customerId}, '${street}', '${city}', '${state}', '${zip}', 'USA', ${isPrimary})`);
    }
    await pool.query(`
      INSERT INTO customer_addresses (customer_id, street, city, state, postal_code, country, is_primary)
      VALUES ${addressValues.join(',\n')};
    `);
    console.log('   ✓ Seeded 600 customer addresses (1:N foreign key to customers)');

    // 2.5 Seed Products (200 rows)
    const productPrefixes = ['Pro', 'Ultra', 'Apex', 'Titan', 'Quantum', 'Nexus', 'Pulse', 'Vertex', 'Core', 'Vanguard'];
    const productNouns = ['Monitor', 'Keyboard', 'Mouse', 'Hub', 'Headset', 'Charger', 'Cable', 'Webcam', 'Stand', 'Drive'];
    const productValues = [];
    for (let i = 1; i <= 200; i++) {
      const catId = (i % 25) + 1;
      const pfx = productPrefixes[i % productPrefixes.length];
      const noun = productNouns[(i * 3) % productNouns.length];
      const title = `${pfx} ${noun} Edition ${i}`;
      const sku = `SKU-${pfx.substring(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`;
      const price = Number((Math.random() * 280 + 19.99).toFixed(2));
      const stock = (i * 17) % 200 + 15;
      productValues.push(`(${catId}, '${sku}', '${title}', 'High-performance hardware component with enterprise warranty.', ${price}, ${stock})`);
    }
    await pool.query(`
      INSERT INTO products (category_id, sku, title, description, price, stock_quantity)
      VALUES ${productValues.join(',\n')};
    `);
    console.log('   ✓ Seeded 200 products (with category FK)');

    // 2.6 Seed Orders & Order Items (350 parent orders & 1,200 child items)
    const statuses = ['Completed', 'Completed', 'Completed', 'Processing', 'Shipped'];
    const orderValues = [];
    const itemValues = [];
    const paymentValues = [];
    let currentItemId = 1;

    for (let orderId = 1; orderId <= 350; orderId++) {
      const customerId = (orderId * 3) % 500 + 1;
      const orderNum = `ORD-2026-${String(orderId).padStart(5, '0')}`;
      const status = statuses[orderId % statuses.length];
      const itemCount = (orderId % 4) + 2; // 2 to 5 items per order

      let orderTotal = 0;
      for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
        const prodId = ((orderId + itemIdx * 7) % 200) + 1;
        const prodName = `Hardware Item Component #${prodId}`;
        const prodSku = `SKU-ITEM-${String(prodId).padStart(4, '0')}`;
        const unitPrice = Number(((prodId * 3.75) % 150 + 15).toFixed(2));
        const qty = (itemIdx % 3) + 1;
        const subtotal = Number((unitPrice * qty).toFixed(2));
        orderTotal += subtotal;

        itemValues.push(`(${orderId}, ${prodId}, '${prodName}', '${prodSku}', ${unitPrice}, ${qty}, ${subtotal})`);
        currentItemId++;
      }

      const shipping = 5.99;
      const tax = Number((orderTotal * 0.08).toFixed(2));
      const grandTotal = Number((orderTotal + shipping + tax).toFixed(2));

      orderValues.push(`(${customerId}, '${orderNum}', ${grandTotal}, ${shipping}, ${tax}, '${status}')`);

      // Payment for order
      const txRef = `TX-${String(orderId).padStart(5, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      paymentValues.push(`(${orderId}, '${txRef}', ${grandTotal}, 'Credit Card', 'Settled')`);
    }

    await pool.query(`
      INSERT INTO orders (customer_id, order_number, total_amount, shipping_fee, tax_amount, order_status)
      VALUES ${orderValues.join(',\n')};
    `);
    console.log('   ✓ Seeded 350 parent orders');

    await pool.query(`
      INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price, quantity, subtotal)
      VALUES ${itemValues.join(',\n')};
    `);
    console.log(`   ✓ Seeded ${itemValues.length} order items (1:N foreign key to orders)`);

    await pool.query(`
      INSERT INTO payments (order_id, transaction_reference, amount, payment_method, status)
      VALUES ${paymentValues.join(',\n')};
    `);
    console.log('   ✓ Seeded 350 order payments (FK to orders)');

    // 2.7 Seed Reviews (300 rows)
    const reviewHeadlines = ['Superb quality!', 'Exceeded expectations', 'Solid daily driver', 'Works great with my setup', 'Excellent value', 'Five stars all around'];
    const reviewValues = [];
    for (let i = 1; i <= 300; i++) {
      const prodId = (i % 200) + 1;
      const custId = (i * 2 % 500) + 1;
      const rating = (i % 3) + 3; // 3, 4, or 5 stars
      const headline = reviewHeadlines[i % reviewHeadlines.length];
      reviewValues.push(`(${prodId}, ${custId}, ${rating}, '${headline}', 'Verified purchase tested extensively under high workloads.')`);
    }
    await pool.query(`
      INSERT INTO reviews (product_id, customer_id, rating, review_headline, review_text)
      VALUES ${reviewValues.join(',\n')};
    `);
    console.log('   ✓ Seeded 300 product reviews');

    // Print summary counts
    const countsRes = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM customers) AS customers,
        (SELECT COUNT(*) FROM customer_addresses) AS customer_addresses,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COUNT(*) FROM order_items) AS order_items,
        (SELECT COUNT(*) FROM payments) AS payments,
        (SELECT COUNT(*) FROM reviews) AS reviews;
    `);
    const c = countsRes.rows[0];
    const totalRows = Object.values(c).reduce((acc, v) => acc + parseInt(v, 10), 0);

    console.log('\n📊 PostgreSQL Source Database Summary:');
    console.table([
      { Table: 'categories', Rows: c.categories, Type: 'Dimension' },
      { Table: 'customers', Rows: c.customers, Type: 'Parent Table' },
      { Table: 'customer_addresses', Rows: c.customer_addresses, Type: 'Child (1:N FK -> customers)' },
      { Table: 'products', Rows: c.products, Type: 'Dimension (FK -> categories)' },
      { Table: 'orders', Rows: c.orders, Type: 'Parent Table (FK -> customers)' },
      { Table: 'order_items', Rows: c.order_items, Type: 'Child (1:N FK -> orders)' },
      { Table: 'payments', Rows: c.payments, Type: 'Fact (FK -> orders)' },
      { Table: 'reviews', Rows: c.reviews, Type: 'Fact (FKs -> products, customers)' },
    ]);
    console.log(`   Total Rows in PostgreSQL: ${totalRows.toLocaleString()} rows\n`);
  } finally {
    await pool.end();
  }

  // ── STEP 3: Ensure MongoDB Target Database is 100% EMPTY ───────────────────
  console.log('🍃 [3/3] Preparing MongoDB Target Database:', MONGO_TARGET_DB);
  const mongoClient = new MongoClient(MONGO_URI);
  try {
    await mongoClient.connect();
    const mongoDb = mongoClient.db(MONGO_TARGET_DB);
    await mongoDb.dropDatabase();
    const remainingCols = await mongoDb.listCollections().toArray();
    console.log(`   ✓ Target database "${MONGO_TARGET_DB}" completely dropped and reset.`);
    console.log(`   ✓ Collections in MongoDB: ${remainingCols.length} (100% EMPTY)\n`);
  } finally {
    await mongoClient.close();
  }

  console.log('===============================================================');
  console.log('🎉 SETUP COMPLETE! READY FOR WORKFLOW B TEST (9 STEPS)');
  console.log('===============================================================');
  console.log('🔗 Step 2 Source URL (PostgreSQL):');
  console.log(`   postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_TARGET_DB}\n`);
  console.log('🔗 Step 3 Target URL (MongoDB):');
  console.log(`   ${MONGO_URI}/${MONGO_TARGET_DB}\n`);
}

main().catch(err => {
  console.error('\n❌ Seeding Error:', err.message);
  process.exit(1);
});

