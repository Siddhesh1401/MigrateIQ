/**
 * MigrateIQ - Phase 9 Live Migration Testbed Seeder
 *
 * Creates:
 * 1. MongoDB Source Database: "phase9_source_mongo"
 *    - users (~50 documents with nested address, tags, dates)
 *    - categories (~10 documents)
 *    - products (~50 documents with polymorphic specs)
 *    - orders (~100 documents with embedded items array -> tests child table + sort_order)
 * 2. PostgreSQL Target Database: "phase9_part1"
 *    - Clean, empty database ready for live migration
 *
 * Usage:
 *   node scripts/seed-phase9-testbed.js [pg_password] [pg_user] [pg_port]
 */

'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const { Client: PgClient } = require('pg');

const args = process.argv.slice(2);
const PG_PASSWORD = args[0] || process.env.PG_PASSWORD || 'admin';
const PG_USER = args[1] || process.env.PG_USER || 'postgres';
const PG_PORT = parseInt(args[2] || process.env.PG_PORT || '5432', 10);
const PG_HOST = process.env.PG_HOST || 'localhost';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = 'phase9_source_mongo';
const PG_TARGET_DB = 'phase9_part1';

async function seedMongo() {
  console.log('\n======================================================');
  console.log('🍃 [1/2] Setting up MongoDB Source Database');
  console.log('======================================================');
  console.log(`Connecting to: ${MONGO_URI}`);
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(MONGO_DB);

  // Drop previous collections
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).drop();
  }
  console.log(`✓ Cleaned previous data in "${MONGO_DB}"`);

  // 1. Categories
  const categoryNames = ['Electronics', 'Furniture', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Toys', 'Groceries', 'Automotive', 'Beauty'];
  const categoriesDocs = categoryNames.map((name, idx) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    description: `High-quality ${name} products for every lifestyle`,
    displayOrder: idx + 1,
    createdAt: new Date(Date.now() - (idx * 86400000 * 5))
  }));
  await db.collection('categories').insertMany(categoriesDocs);
  console.log(`✓ Seeded "categories": ${categoriesDocs.length} documents`);

  // 2. Users
  const roles = ['admin', 'manager', 'customer', 'vendor'];
  const cities = [
    { city: 'New York', state: 'NY', zip: '10001' },
    { city: 'San Francisco', state: 'CA', zip: '94105' },
    { city: 'Austin', state: 'TX', zip: '78701' },
    { city: 'Chicago', state: 'IL', zip: '60601' },
    { city: 'Seattle', state: 'WA', zip: '98101' }
  ];
  const usersDocs = [];
  for (let i = 1; i <= 50; i++) {
    const loc = cities[i % cities.length];
    usersDocs.push({
      name: `User ${i} Example`,
      email: `user${i}@migrateiq.test`,
      role: roles[i % roles.length],
      age: 20 + (i % 45),
      phone: i % 5 === 0 ? null : `+1-555-${String(1000 + i).slice(-4)}`,
      address: {
        street: `${100 + i} Main Boulevard, Suite ${i}`,
        city: loc.city,
        state: loc.state,
        zip: loc.zip
      },
      tags: ['verified', i % 2 === 0 ? 'premium' : 'standard', `tier-${(i % 3) + 1}`],
      isActive: i % 10 !== 0,
      createdAt: new Date(Date.now() - (i * 86400000 * 3))
    });
  }
  await db.collection('users').insertMany(usersDocs);
  console.log(`✓ Seeded "users": ${usersDocs.length} documents (with nested address & tags)`);

  // 3. Products
  const productsDocs = [];
  for (let i = 1; i <= 50; i++) {
    const cat = categoryNames[i % categoryNames.length];
    productsDocs.push({
      name: `Product ${i} Premium Edition`,
      sku: `SKU-${cat.slice(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`,
      category: cat,
      price: parseFloat((15.99 + (i * 4.75)).toFixed(2)),
      inStock: i % 8 !== 0,
      stockQuantity: i % 8 === 0 ? 0 : (10 + (i * 3)),
      specs: {
        color: ['Black', 'Silver', 'Blue', 'White'][i % 4],
        weightKg: parseFloat((0.5 + (i * 0.1)).toFixed(2)),
        warrantyYears: (i % 3) + 1
      },
      createdAt: new Date(Date.now() - (i * 86400000 * 2))
    });
  }
  await db.collection('products').insertMany(productsDocs);
  console.log(`✓ Seeded "products": ${productsDocs.length} documents (with dynamic specs)`);

  // 4. Orders (with embedded items array -> Child Table split with sort_order)
  const orderStatuses = ['completed', 'processing', 'shipped', 'delivered', 'pending'];
  const ordersDocs = [];
  for (let i = 1; i <= 100; i++) {
    const userIndex = (i % 50) + 1;
    const itemCount = (i % 4) + 1; // 1 to 4 items per order
    const items = [];
    let orderTotal = 0;

    for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
      const prodNum = ((i + itemIdx) % 50) + 1;
      const unitPrice = parseFloat((19.99 + (prodNum * 2.5)).toFixed(2));
      const qty = (itemIdx % 3) + 1;
      const itemSubtotal = parseFloat((unitPrice * qty).toFixed(2));
      orderTotal += itemSubtotal;

      items.push({
        itemCode: `ITEM-${String(prodNum).padStart(3, '0')}`,
        productName: `Product ${prodNum} Premium Edition`,
        quantity: qty,
        unitPrice: unitPrice,
        subtotal: itemSubtotal
      });
    }

    ordersDocs.push({
      orderNumber: `ORD-2026-${String(i).padStart(5, '0')}`,
      customerEmail: `user${userIndex}@migrateiq.test`,
      status: orderStatuses[i % orderStatuses.length],
      totalAmount: parseFloat(orderTotal.toFixed(2)),
      itemCount: items.length,
      items: items, // Array of objects -> tests Array-to-Child Table and sort_order!
      notes: i % 4 === 0 ? 'Expedited courier requested' : null,
      orderDate: new Date(Date.now() - (i * 3600000 * 12))
    });
  }
  await db.collection('orders').insertMany(ordersDocs);
  console.log(`✓ Seeded "orders": ${ordersDocs.length} documents with embedded items array`);
  console.log(`  (Total embedded items across orders: ${ordersDocs.reduce((acc, o) => acc + o.items.length, 0)})`);

  await client.close();
  console.log(`🍃 MongoDB setup complete! Database: "${MONGO_DB}"`);
}

async function setupPostgres() {
  console.log('\n======================================================');
  console.log('🐘 [2/2] Setting up PostgreSQL Target Database');
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

  // Terminate any existing connections to phase9_part1 and drop it
  console.log(`Checking if database "${PG_TARGET_DB}" exists...`);
  await adminClient.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '${PG_TARGET_DB}'
      AND pid <> pg_backend_pid();
  `);

  await adminClient.query(`DROP DATABASE IF EXISTS "${PG_TARGET_DB}";`);
  console.log(`✓ Cleaned previous target database "${PG_TARGET_DB}"`);

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
    console.log('🎉 TESTBED READY FOR PHASE 9 APP TEST!');
    console.log('======================================================');
    console.log('\nUse these credentials in MigrateIQ:');
    console.log('------------------------------------------------------');
    console.log('🍃 Source (MongoDB):');
    console.log('   URI: mongodb://localhost:27017');
    console.log('   Database: phase9_source_mongo');
    console.log('------------------------------------------------------');
    console.log('🐘 Target (PostgreSQL):');
    console.log('   Host: localhost');
    console.log('   Port: 5432');
    console.log(`   User: ${PG_USER}`);
    console.log(`   Password: ${PG_PASSWORD}`);
    console.log(`   Database: ${PG_TARGET_DB} (100% empty)`);
    console.log('------------------------------------------------------');
    console.log('Now open MigrateIQ and walk through Steps 1 to 7!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during setup:', err);
    process.exit(1);
  }
}

run();
