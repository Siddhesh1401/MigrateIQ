/**
 * MigrateIQ - Phase 9B Data Parity & Verification Testbed Seeder
 *
 * Sets up:
 * 1. MongoDB Source Database: "phase9b_source_mongo"
 *    - categories (10 documents)
 *    - users (50 documents with nested address, tags, dates, selective nulls)
 *    - products (50 documents with price, specs, stock)
 *    - orders (100 documents with embedded items array -> tests child table + sort_order + financial totalAmount)
 *    - payments (100 documents with decimal amounts, fees, net amounts -> tests Stripe financial proofs)
 *
 * 2. PostgreSQL Target Database: "phase9b_target_pg"
 *    - Clean, empty database ready for migration and verification testing
 *
 * Usage:
 *   node scripts/seed-phase9b-testbed.js [pg_password] [pg_user] [pg_port]
 */

'use strict';

const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');

const args = process.argv.slice(2);
const PG_PASSWORD = args[0] || process.env.PG_PASSWORD || 'admin';
const PG_USER = args[1] || process.env.PG_USER || 'postgres';
const PG_PORT = parseInt(args[2] || process.env.PG_PORT || '5432', 10);
const PG_HOST = process.env.PG_HOST || 'localhost';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = 'phase9b_source_mongo';
const PG_TARGET_DB = 'phase9b_target_pg';

async function seedMongo() {
  console.log('\n======================================================');
  console.log('🍃 [1/2] Seeding MongoDB Source: ' + MONGO_DB);
  console.log('======================================================');
  console.log(`Connecting to: ${MONGO_URI}`);
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(MONGO_DB);

  // Drop previous collections in this test db
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).drop();
  }
  console.log(`✓ Cleaned previous collections in "${MONGO_DB}"`);

  // 1. Categories (10 docs)
  const categoryNames = [
    'Electronics', 'Furniture', 'Clothing', 'Books', 'Home & Garden',
    'Sports', 'Toys', 'Groceries', 'Automotive', 'Beauty'
  ];
  const categoriesDocs = categoryNames.map((name, idx) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    description: `Enterprise-grade ${name} catalog items`,
    displayOrder: idx + 1,
    isActive: true,
    createdAt: new Date(Date.now() - (idx * 86400000 * 5))
  }));
  await db.collection('categories').insertMany(categoriesDocs);
  console.log(`✓ Seeded "categories": ${categoriesDocs.length} documents`);

  // 2. Users (50 docs with nested address, tags, dates, nulls)
  const roles = ['customer', 'vendor', 'support', 'manager', 'admin'];
  const cities = [
    { city: 'New York', state: 'NY', zip: '10001' },
    { city: 'San Francisco', state: 'CA', zip: '94105' },
    { city: 'Austin', state: 'TX', zip: '78701' },
    { city: 'Chicago', state: 'IL', zip: '60601' },
    { city: 'Seattle', state: 'WA', zip: '98101' },
    { city: 'Boston', state: 'MA', zip: '02108' }
  ];
  const usersDocs = [];
  for (let i = 1; i <= 50; i++) {
    const loc = cities[i % cities.length];
    usersDocs.push({
      name: `Customer ${i} Standard`,
      email: `customer${i}@migrateiq-test.org`,
      role: roles[i % roles.length],
      age: 21 + (i % 45),
      phone: i % 4 === 0 ? null : `+1-555-${String(2000 + i).slice(-4)}`, // 25% null for profiler
      address: {
        street: `${100 + i} Enterprise Way, Suite ${i}`,
        city: loc.city,
        state: loc.state,
        zip: loc.zip
      },
      tags: ['verified', i % 2 === 0 ? 'premium' : 'standard', `tier-${(i % 3) + 1}`],
      accountBalance: parseFloat((50.0 + (i * 12.35)).toFixed(2)),
      isActive: i % 10 !== 0,
      createdAt: new Date(Date.now() - (i * 86400000 * 3))
    });
  }
  await db.collection('users').insertMany(usersDocs);
  console.log(`✓ Seeded "users": ${usersDocs.length} documents (nested address, tags, 25% null phone)`);

  // 3. Products (50 docs with prices and specs)
  const productsDocs = [];
  for (let i = 1; i <= 50; i++) {
    const cat = categoryNames[i % categoryNames.length];
    productsDocs.push({
      name: `Pro Device ${i} Ultra`,
      sku: `SKU-${cat.slice(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`,
      category: cat,
      price: parseFloat((14.99 + (i * 3.85)).toFixed(2)),
      inStock: i % 7 !== 0,
      stockQuantity: i % 7 === 0 ? 0 : (20 + (i * 4)),
      specs: {
        color: ['Midnight Black', 'Platinum Silver', 'Deep Navy', 'Alpine White'][i % 4],
        weightKg: parseFloat((0.45 + (i * 0.08)).toFixed(2)),
        warrantyYears: (i % 3) + 1
      },
      createdAt: new Date(Date.now() - (i * 86400000 * 2))
    });
  }
  await db.collection('products').insertMany(productsDocs);
  console.log(`✓ Seeded "products": ${productsDocs.length} documents`);

  // 4. Orders (100 docs with embedded items array -> Child table order_items)
  const orderStatuses = ['completed', 'processing', 'shipped', 'delivered', 'pending'];
  const ordersDocs = [];
  let totalOrderItemsCount = 0;
  let totalOrdersFinancialSum = 0;

  for (let i = 1; i <= 100; i++) {
    const userIndex = (i % 50) + 1;
    const itemCount = (i % 4) + 1; // 1 to 4 items per order
    const items = [];
    let orderTotal = 0;

    for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
      const prodNum = ((i + itemIdx) % 50) + 1;
      const unitPrice = parseFloat((19.95 + (prodNum * 2.25)).toFixed(2));
      const qty = (itemIdx % 3) + 1;
      const itemSubtotal = parseFloat((unitPrice * qty).toFixed(2));
      orderTotal += itemSubtotal;

      items.push({
        itemCode: `ITEM-${String(prodNum).padStart(3, '0')}`,
        productName: `Pro Device ${prodNum} Ultra`,
        quantity: qty,
        unitPrice: unitPrice,
        subtotal: itemSubtotal
      });
      totalOrderItemsCount++;
    }

    const roundedOrderTotal = parseFloat(orderTotal.toFixed(2));
    totalOrdersFinancialSum += roundedOrderTotal;

    ordersDocs.push({
      orderNumber: `ORD-2026-${String(i).padStart(5, '0')}`,
      customerEmail: `customer${userIndex}@migrateiq-test.org`,
      status: orderStatuses[i % orderStatuses.length],
      totalAmount: roundedOrderTotal,
      itemCount: items.length,
      items: items, // Array of objects -> tests Array-to-Child Table & gapless sort_order!
      notes: i % 3 === 0 ? 'Urgent delivery requested' : null, // 66% null notes for profiler
      orderDate: new Date(Date.now() - (i * 3600000 * 8))
    });
  }
  await db.collection('orders').insertMany(ordersDocs);
  console.log(`✓ Seeded "orders": ${ordersDocs.length} documents`);
  console.log(`  └─ Total nested items: ${totalOrderItemsCount} (maps to child table "order_items")`);
  console.log(`  └─ Total financial sum: $${totalOrdersFinancialSum.toFixed(2)} (tests Stripe drift proof)`);

  // 5. Payments (100 docs with financial sums)
  const paymentMethods = ['credit_card', 'paypal', 'apple_pay', 'stripe'];
  const paymentsDocs = [];
  let totalPaymentsSum = 0;

  for (let i = 1; i <= 100; i++) {
    const orderDoc = ordersDocs[i - 1];
    const fee = parseFloat((orderDoc.totalAmount * 0.029 + 0.30).toFixed(2));
    const netAmount = parseFloat((orderDoc.totalAmount - fee).toFixed(2));
    totalPaymentsSum += orderDoc.totalAmount;

    paymentsDocs.push({
      transactionId: `TXN-${Date.now().toString(36).toUpperCase()}-${String(i).padStart(4, '0')}`,
      orderNumber: orderDoc.orderNumber,
      amount: orderDoc.totalAmount,
      currency: 'USD',
      fee: fee,
      netAmount: netAmount,
      paymentMethod: paymentMethods[i % paymentMethods.length],
      status: i % 15 === 0 ? 'refunded' : (i % 20 === 0 ? 'pending' : 'succeeded'),
      createdAt: new Date(orderDoc.orderDate.getTime() + 120000)
    });
  }
  await db.collection('payments').insertMany(paymentsDocs);
  console.log(`✓ Seeded "payments": ${paymentsDocs.length} documents`);
  console.log(`  └─ Total payments sum: $${totalPaymentsSum.toFixed(2)}`);

  await client.close();
  console.log(`🍃 MongoDB setup complete! Database: "${MONGO_DB}"`);
}

async function setupPostgres() {
  console.log('\n======================================================');
  console.log('🐘 [2/2] Setting up Clean Empty PostgreSQL: ' + PG_TARGET_DB);
  console.log('======================================================');
  console.log(`Connecting to PostgreSQL as "${PG_USER}" on ${PG_HOST}:${PG_PORT}...`);

  const adminClient = new PgClient({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: 'postgres'
  });

  await adminClient.connect();

  // Terminate any active connections to target db
  await adminClient.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '${PG_TARGET_DB}'
      AND pid <> pg_backend_pid();
  `);

  // Drop target database if exists to ensure 100% clean state
  await adminClient.query(`DROP DATABASE IF EXISTS "${PG_TARGET_DB}";`);
  console.log(`✓ Dropped previous target database "${PG_TARGET_DB}"`);

  // Create clean database
  await adminClient.query(`CREATE DATABASE "${PG_TARGET_DB}";`);
  console.log(`✓ Created clean empty database: "${PG_TARGET_DB}"`);
  await adminClient.end();

  // Verify target is 100% empty
  const targetClient = new PgClient({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_TARGET_DB
  });
  await targetClient.connect();
  const res = await targetClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  console.log(`✓ Verified target database tables: ${res.rows.length} (clean & empty)`);
  await targetClient.end();

  console.log(`🐘 PostgreSQL setup complete! Database: "${PG_TARGET_DB}"`);
}

async function run() {
  try {
    await seedMongo();
    await setupPostgres();

    console.log('\n======================================================');
    console.log('🎉 PHASE 9B TESTBED IS READY!');
    console.log('======================================================');
    console.log('\nCredentials to use in MigrateIQ Desktop:');
    console.log('------------------------------------------------------');
    console.log('🍃 Source (MongoDB):');
    console.log('   URI:      mongodb://localhost:27017');
    console.log('   Database: phase9b_source_mongo');
    console.log('   Collections: categories (10), users (50), products (50), orders (100), payments (100)');
    console.log('------------------------------------------------------');
    console.log('🐘 Target (PostgreSQL):');
    console.log('   Host:     localhost');
    console.log('   Port:     5432');
    console.log(`   User:     ${PG_USER}`);
    console.log(`   Password: ${PG_PASSWORD}`);
    console.log(`   Database: ${PG_TARGET_DB} (clean & empty)`);
    console.log('------------------------------------------------------');
    console.log('Next step:');
    console.log('Run `npm run desktop:dev` to launch MigrateIQ and run the migration & verification!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during testbed setup:', err);
    process.exit(1);
  }
}

run();
