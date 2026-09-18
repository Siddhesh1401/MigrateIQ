/**
 * MigrateIQ - Phase 8 Comprehensive Dry Run Simulation Testbed Seeder
 *
 * PURPOSE: Creates a professional, foolproof test environment that exercises
 * EVERY Phase 8 engine safeguard and edge case in BOTH migration directions:
 *   Direction A: MongoDB -> PostgreSQL (Workflow A)
 *   Direction B: PostgreSQL -> MongoDB (Workflow B)
 *
 * SAFEGUARDS & EDGE CASES TESTED:
 * [Safeguard 1]  Transaction Isolation & Guaranteed Rollback
 * [Safeguard 4]  UTF-8 Null-Byte Poison Pill Sanitization
 * [Safeguard 5]  63-Byte Identifier Truncation & Hash Collision Defense
 * [Safeguard 6]  Type-Aware Smart Default Imputation (Option A)
 * [Safeguard 7]  Child Table Normalization (sort_order INTEGER NOT NULL)
 * [Safeguard 8]  Real-Time Throughput Profiling (500 docs)
 * [Safeguard 11] Surrogate Key Sequence Preservation
 * [Safeguard 13] Isolated Single-Table Re-simulation
 * [Safeguard 15] Heterogeneous Casing Normalization (camelCase <-> snake_case)
 * [Edge Case A]  Polymorphic / Mixed Data Types (phone: String OR Integer)
 * [Edge Case B]  Deeply Nested Objects (specs.dimensions.widthCm)
 * [Edge Case C]  NOT NULL Failure Path (20-24% missing required field)
 * [Edge Case D]  Array of Scalars (tags: ['node','mongo','p8'])
 * [Edge Case E]  Date / Timestamp coercion (Date obj, ISO string, Unix ms)
 * [Edge Case F]  ObjectId -> VARCHAR(24) primary key handling
 *
 * USAGE:
 *   node scripts/seed-phase8-testbed.js [pg_password] [pg_user] [pg_database] [pg_port]
 *
 * ENV OVERRIDES:
 *   MONGO_URI, MONGO_DB, PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE
 */

'use strict';

const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB  = process.env.MONGO_DB  || 'migrateiq_phase8_test';
const PG_CONFIG = {
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(args[3] || process.env.PG_PORT || '5432', 10),
  user:     args[1] || process.env.PG_USER     || 'postgres',
  password: args[0] || process.env.PG_PASSWORD || 'admin',
  database: args[2] || process.env.PG_DATABASE || 'migrateiq_phase8_test',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: make a camelCase order document (Safeguard 15, 7, Edge Case B, D)
// ─────────────────────────────────────────────────────────────────────────────
function makeOrderDoc(i) {
  return {
    // camelCase field names -> snake_case in PG (Safeguard 15)
    orderNumber:    `ORD-2026-${String(i).padStart(4, '0')}`,
    customerName:   `Customer ${i}`,
    customerEmail:  `customer${i}@example.com`,
    totalAmount:    parseFloat((Math.random() * 1000 + 50).toFixed(2)),
    isPriority:     i % 3 === 0,
    orderDate:      new Date(Date.now() - i * 86400000),
    shipmentStatus: ['delivered', 'shipped', 'processing', 'pending'][i % 4],

    // Nested object - dot-notation navigation (Edge Case B)
    shippingAddress: {
      streetLine1: `${i * 7} Nehru Marg`,
      city:        ['Mumbai', 'Bengaluru', 'Hyderabad'][i % 3],
      stateCode:   'MH',
      postalCode:  `40000${String(i % 90).padStart(2, '0')}`,
      countryCode: 'IN',
    },

    // Array of objects -> child table (Safeguard 7: sort_order INTEGER NOT NULL)
    items: [
      {
        productId:   `PRD-${String(i * 10 + 1).padStart(5, '0')}`,
        productName: `Item Alpha-${i}`,
        unitPrice:   parseFloat((Math.random() * 200 + 10).toFixed(2)),
        quantity:    Math.ceil(Math.random() * 5),
        sku:         `SKU-A${i}`,
      },
      {
        productId:   `PRD-${String(i * 10 + 2).padStart(5, '0')}`,
        productName: `Item Beta-${i}`,
        unitPrice:   parseFloat((Math.random() * 150 + 5).toFixed(2)),
        quantity:    Math.ceil(Math.random() * 3),
        sku:         `SKU-B${i}`,
      },
      // Third item only for every 3rd order -> varying array length
      ...(i % 3 === 0 ? [{
        productId:   `PRD-${String(i * 10 + 3).padStart(5, '0')}`,
        productName: `Item Gamma-${i}`,
        unitPrice:   parseFloat((Math.random() * 80 + 8).toFixed(2)),
        quantity:    1,
        sku:         `SKU-G${i}`,
      }] : []),
    ],

    // Array of scalars (Edge Case D)
    tags: ['ecommerce', i % 2 === 0 ? 'express' : 'standard', `region-${i % 5}`],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: make a camelCase user document (Safeguard 15, Edge Case A, B, C)
// ─────────────────────────────────────────────────────────────────────────────
function makeUserDoc(i) {
  const isMissingEmail = i <= 12; // 24% missing email -> NOT NULL violation (Edge Case C)
  return {
    userId:      `USR-${2000 + i}`,
    fullName:    `User ${i} Phase8`,
    email:       isMissingEmail ? null : `user.p8.${i}@migrateiq.test`,
    // Mixed type: String on even, Integer on odd (Edge Case A)
    phoneNumber: i % 2 === 0 ? `+91-9820-${String(10000 + i).padStart(6, '0')}` : 9820000000 + i,
    isActive:    i % 3 !== 0,
    age:         20 + (i % 40),
    createdAt:   new Date(Date.now() - i * 3600000 * 24),

    // Nested address (Edge Case B / dot-notation)
    address: {
      houseNo:  `${i}`,
      street:   `MG Road, Sector ${i % 20 + 1}`,
      city:     ['Mumbai', 'Pune', 'Chennai', 'Delhi'][i % 4],
      zipCode:  `${400000 + i}`,
    },

    // Deep nested preferences (Edge Case B)
    preferences: {
      theme:    i % 2 === 0 ? 'light' : 'dark',
      language: 'en-IN',
      notifications: {
        email: i % 2 === 0,
        sms:   i % 3 === 0,
        push:  true,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: MongoDB Seeding  (Direction A source data)
// ─────────────────────────────────────────────────────────────────────────────
async function seedMongoDB() {
  console.log('\n\u{1F33F} ==========================================================');
  console.log('\u{1F33F}  [1/2] MongoDB Seeding - Phase 8 Testbed');
  console.log(`\u{1F33F}  URI: ${MONGO_URI}   DB: "${MONGO_DB}"`);
  console.log('\u{1F33F} ==========================================================');

  let client;
  try {
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db(MONGO_DB);
    console.log('\n\u{1F33F} Connected to MongoDB\n');

    // ── Collection 1: "orders" ─────────────────────────────────────────
    // Tests: Safeguard 7 (child table sort_order), Safeguard 15 (camelCase),
    //        Edge Case B (nested shippingAddress), Edge Case D (tags)
    const ordersCol = db.collection('orders');
    await ordersCol.deleteMany({});
    const orderDocs = [];
    for (let i = 1; i <= 50; i++) orderDocs.push(makeOrderDoc(i));
    await ordersCol.insertMany(orderDocs);
    console.log('   [OK] "orders": 50 docs');
    console.log('        camelCase: orderNumber, customerName, totalAmount, isPriority');
    console.log('        Nested: shippingAddress.{streetLine1,city,postalCode,countryCode}');
    console.log('        Array of objects: items[].{productId,productName,unitPrice,qty}');
    console.log('        -> Map items as Child Table -> order_items (Safeguard 7: sort_order)');

    // ── Collection 2: "users" ──────────────────────────────────────────
    // Tests: Safeguard 15, Edge Case A (mixed phone type), Edge Case C (24% null email)
    const usersCol = db.collection('users');
    await usersCol.deleteMany({});
    const userDocs = [];
    for (let i = 1; i <= 50; i++) userDocs.push(makeUserDoc(i));
    await usersCol.insertMany(userDocs);
    console.log('\n   [OK] "users": 50 docs');
    console.log('        camelCase: userId, fullName, phoneNumber, isActive, createdAt');
    console.log('        12 of 50 docs have null email (24% NOT NULL violation - Edge Case C)');
    console.log('        phoneNumber: String on even docs, Integer on odd docs (Edge Case A)');
    console.log('        Deep nested: address.city, preferences.notifications.email (Edge Case B)');

    // ── Collection 3: "products" ───────────────────────────────────────
    // Tests: Safeguard 15 (inStock, unitPrice, stockCount), Edge Case B (deep nesting),
    //        Edge Case F (ObjectId _id -> VARCHAR(24))
    const productsCol = db.collection('products');
    await productsCol.deleteMany({});
    await productsCol.insertMany([
      {
        productCode: 'LAPTOP-P8-001',
        productName: 'Developer Pro Laptop 16"',
        category:    'Electronics',
        inStock:     true,
        stockCount:  42,
        unitPrice:   89999.99,
        weightGrams: 1850,
        specs: {
          cpu:   'Intel Core i9-14900H',
          ramGb: 64,
          gpu:   'NVIDIA RTX 4080',
          dimensions: { widthCm: 35.6, depthCm: 24.1, heightCm: 1.9 },
          ports: ['USB-C', 'HDMI 2.1', 'USB-A x3'],
        },
        createdAt: new Date('2026-01-15T09:00:00Z'),
      },
      {
        productCode: 'CHAIR-P8-002',
        productName: 'Ergonomic Mesh Chair Pro',
        category:    'Furniture',
        inStock:     true,
        stockCount:  15,
        unitPrice:   24999.00,
        weightGrams: 12500,
        specs: {
          maxWeightKg:   150,
          lumbarSupport: true,
          material:      'Breathable 4D Mesh',
          dimensions:    { widthCm: 67, depthCm: 70, heightCm: 125 },
          ports:         [],
        },
        createdAt: new Date('2026-02-01T11:30:00Z'),
      },
      {
        productCode: 'HEADSET-P8-003',
        productName: 'Studio Pro Wireless Headset',
        category:    'Audio',
        inStock:     false,
        stockCount:  0,
        unitPrice:   12499.50,
        weightGrams: 285,
        specs: {
          driverMm:    40,
          batteryMah:  800,
          dimensions:  { widthCm: 19, depthCm: 8.5, heightCm: 22 },
          ports:       ['USB-C Charging', '3.5mm Jack'],
        },
        createdAt: new Date('2026-03-10T08:00:00Z'),
      },
    ]);
    console.log('\n   [OK] "products": 3 docs');
    console.log('        camelCase: productCode, inStock, stockCount, unitPrice (-> snake_case in PG)');
    console.log('        Deep nested: specs.dimensions.{widthCm,depthCm,heightCm} (Edge Case B)');
    console.log('        _id is MongoDB ObjectId -> VARCHAR(24) in PG (Edge Case F)');

    // ── Collection 4: "poison_pills" ──────────────────────────────────
    // Tests: Safeguard 4 - UTF-8 Null-Byte (\0) Poison Pill Sanitization
    const poisonCol = db.collection('poison_pills');
    await poisonCol.deleteMany({});
    await poisonCol.insertMany([
      {
        recordType:    'scraped_web',
        rawContent:    'Valid text\0 followed by null\0 poison',
        sourceUrl:     'https://example.com/scrape\0?q=test',
        binaryPayload: Buffer.from('Hello\x00World'),
        numericField:  42.7,
        isProcessed:   false,
        scrapedAt:     new Date(),
      },
      {
        recordType:    'telemetry_event',
        rawContent:    'SENSOR_READ\0\0VALUE=99.5',
        sourceUrl:     'sensor://device-001\x00channel=2',
        binaryPayload: Buffer.from('\x00\x00\x01\x02'),
        numericField:  99.5,
        isProcessed:   false,
        scrapedAt:     new Date(),
      },
      {
        recordType:    'clean_record',
        rawContent:    'This is a perfectly clean record with no poison bytes.',
        sourceUrl:     'https://example.com/clean',
        binaryPayload: Buffer.from('CleanPayload'),
        numericField:  0.0,
        isProcessed:   true,
        scrapedAt:     new Date(),
      },
    ]);
    console.log('\n   [OK] "poison_pills": 3 docs');
    console.log('        2 docs with \\0 null bytes in rawContent, sourceUrl, binaryPayload');
    console.log('        -> Safeguard 4: engine must strip \\0 -> 0 failed rows expected');

    // ── Collection 5: "long_identifiers" ──────────────────────────────
    // Tests: Safeguard 5 - 63-Byte Identifier Truncation + Hash Collision Defense
    const longIdCol = db.collection('long_identifiers');
    await longIdCol.deleteMany({});
    const sharedPrefix = 'international_shipping_billing_address_validation_status_co';
    const field1 = sharedPrefix + 'de_primary';
    const field2 = sharedPrefix + 'de_secondary';
    await longIdCol.insertMany([
      {
        recordId:  'LONGID-001',
        [field1]:  'PRIMARY_VALUE_ALPHA',
        [field2]:  'SECONDARY_VALUE_BETA',
        customer_primary_billing_address_international_postal_code_zone: 'A-ZONE-001',
        shortField: 'short',
        amount:     1234.56,
      },
      {
        recordId:  'LONGID-002',
        [field1]:  'PRIMARY_VALUE_GAMMA',
        [field2]:  'SECONDARY_VALUE_DELTA',
        customer_primary_billing_address_international_postal_code_zone: 'B-ZONE-002',
        shortField: 'short2',
        amount:     789.00,
      },
    ]);
    console.log('\n   [OK] "long_identifiers": 2 docs');
    console.log(`        Field "${field1}" (${field1.length} chars) -> triggers truncation`);
    console.log(`        Field "${field2}" (${field2.length} chars) -> same prefix, different hash`);
    console.log('        -> Safeguard 5: 63-byte truncation + deterministic hash collision defense');

    // ── Collection 6: "nullable_fields" ───────────────────────────────
    // Tests: Safeguard 6 - Type-Aware Smart Default Imputation (Option A)
    // Every doc has intentionally null values where target PG column is NOT NULL.
    // The mapping must carry defaultValue fallbacks to pass 100% rows.
    const nullableCol = db.collection('nullable_fields');
    await nullableCol.deleteMany({});
    const nullableDocs = [];
    for (let i = 1; i <= 20; i++) {
      nullableDocs.push({
        recordId:       `NUL-${String(i).padStart(3, '0')}`,
        integerField:   i % 4 === 0 ? null : i * 10,
        numericField:   i % 3 === 0 ? null : parseFloat((i * 3.14).toFixed(2)),
        booleanField:   i % 5 === 0 ? null : i % 2 === 0,
        timestampField: i % 6 === 0 ? null : new Date(),
        jsonbField:     i % 7 === 0 ? null : { key: `value_${i}` },
        textField:      i % 2 === 0 ? null : `text_value_${i}`,
        alwaysPresent:  `anchor_${i}`,
      });
    }
    await nullableCol.insertMany(nullableDocs);
    console.log('\n   [OK] "nullable_fields": 20 docs');
    console.log('        integerField null on 25% | numericField null on 33%');
    console.log('        booleanField null on 20% | timestampField null on 16%');
    console.log('        jsonbField null on 14%   | textField null on 50%');
    console.log('        -> Safeguard 6: set defaultValues in mapper to get 0 failed rows');

    // ── Collection 7: "throughput_bench" ──────────────────────────────
    // Tests: Safeguard 8 - Real-Time Throughput Profiling (500 docs)
    const benchCol = db.collection('throughput_bench');
    await benchCol.deleteMany({});
    const benchDocs = [];
    for (let i = 1; i <= 500; i++) {
      benchDocs.push({
        eventId:        `EVT-${String(i).padStart(5, '0')}`,
        sessionId:      `SES-${String(Math.ceil(i / 10)).padStart(3, '0')}`,
        userId:         `USR-${1000 + (i % 50)}`,
        eventType:      ['page_view', 'click', 'form_submit', 'purchase', 'logout'][i % 5],
        pageUrl:        `/page/${i % 20}?ref=phase8`,
        durationMs:     Math.floor(Math.random() * 5000 + 100),
        bytesTransfer:  Math.floor(Math.random() * 50000 + 1000),
        statusCode:     [200, 200, 200, 201, 304, 404, 500][i % 7],
        isAuthenticated: i % 3 !== 0,
        geo: {
          latitude:  parseFloat((12.9716 + i * 0.001).toFixed(6)),
          longitude: parseFloat((77.5946 + i * 0.001).toFixed(6)),
          city:      ['Mumbai', 'Bengaluru', 'Hyderabad', 'Pune', 'Chennai'][i % 5],
        },
        recordedAt: new Date(Date.now() - i * 60000),
      });
    }
    await benchCol.insertMany(benchDocs);
    console.log('\n   [OK] "throughput_bench": 500 docs');
    console.log('        -> Safeguard 8: 500 docs give measurable rows/sec throughput');
    console.log('        -> Telemetry bar should show rows/sec > 1000');

    // ── Collection 8: "events" ────────────────────────────────────────
    // Tests: Edge Case E - Date/Timestamp coercion
    const eventsCol = db.collection('events');
    await eventsCol.deleteMany({});
    await eventsCol.insertMany([
      {
        eventCode: 'CONF-LAUNCH-2026',
        title:     'MigrateIQ Platform Launch',
        startTime: new Date('2026-09-01T09:00:00.000Z'),         // Date object
        endTime:   '2026-09-01T18:00:00.000Z',                   // ISO string
        rsvpCount: 342,
        venue:     { name: 'Tech Hub Bengaluru', lat: 12.9353, lng: 77.6245 },
      },
      {
        eventCode: 'WORKSHOP-DB-2026',
        title:     'Database Migration Workshop Phase 8',
        startTime: '2026-10-15T10:00:00+05:30',                  // ISO with timezone
        endTime:   new Date('2026-10-15T17:00:00+05:30'),
        rsvpCount: 87,
        venue:     { name: 'IIT Mumbai Auditorium', lat: 19.0760, lng: 72.8777 },
      },
      {
        eventCode: 'WEBINAR-NOSQL-2026',
        title:     'MongoDB to PostgreSQL Zero-Downtime Migration',
        startTime: 1726740000000,                                 // Unix timestamp ms
        endTime:   1726758000000,
        rsvpCount: 1203,
        venue:     { name: 'Virtual (Zoom)', lat: 0, lng: 0 },
      },
    ]);
    console.log('\n   [OK] "events": 3 docs');
    console.log('        startTime mixes: Date object, ISO string, Unix ms integer');
    console.log('        -> Edge Case E: Timestamp coercion across all BSON date formats');

    // ── Collection 9: "incomplete_records" ────────────────────────────
    // Tests: Edge Case C - NOT NULL failure path, skipped-rows detection
    const incompleteCol = db.collection('incomplete_records');
    await incompleteCol.deleteMany({});
    const incompleteDocs = [];
    for (let i = 1; i <= 30; i++) {
      const isCorrupt = i % 5 === 0; // 20% corrupted
      incompleteDocs.push({
        recordId:      `INC-${String(i).padStart(3, '0')}`,
        requiredCode:  isCorrupt ? undefined : `CODE-${i * 100}`,
        optionalLabel: i % 3 === 0 ? null : `Label-${i}`,
        amount:        parseFloat((i * 12.99).toFixed(2)),
        isVerified:    i % 2 === 0,
        processedAt:   new Date(),
      });
    }
    await incompleteCol.insertMany(incompleteDocs);
    console.log('\n   [OK] "incomplete_records": 30 docs');
    console.log('        6 of 30 docs (20%) missing "requiredCode" (NOT NULL violation)');
    console.log('        -> Do NOT set defaultValue -> observe 6 rows in skipped-rows drawer');
    console.log('        -> Edge Case C: failure rate projection (20% -> DLQ Option C)');

    // ── Collection 10: "catalog_items" ────────────────────────────────
    // Tests: Edge Case F - ObjectId -> VARCHAR(24), Edge Case D (tags array)
    const catalogCol = db.collection('catalog_items');
    await catalogCol.deleteMany({});
    await catalogCol.insertMany([
      {
        sku:         'CAT-ALPHA-001',
        displayName: 'Enterprise Analytics Dashboard',
        category:    'Software',
        tags:        ['analytics', 'enterprise', 'dashboard'],
        pricing: { basePrice: 4999.00, currency: 'INR', billingCycle: 'monthly' },
        isPublished: true,
        publishedAt: new Date('2026-06-01'),
        metaVersion: 1,
      },
      {
        sku:         'CAT-BETA-002',
        displayName: 'Database Migration Suite Pro',
        category:    'Software',
        tags:        ['migration', 'database', 'etl', 'enterprise'],
        pricing: { basePrice: 12999.00, currency: 'INR', billingCycle: 'annual' },
        isPublished: true,
        publishedAt: new Date('2026-07-15'),
        metaVersion: 3,
      },
      {
        sku:         'CAT-GAMMA-003',
        displayName: 'Cloud Sync Connector',
        category:    'Integration',
        tags:        ['cloud', 'sync', 'connector'],
        pricing: { basePrice: 2499.00, currency: 'INR', billingCycle: 'monthly' },
        isPublished: false,
        publishedAt: null,
        metaVersion: 1,
      },
    ]);
    console.log('\n   [OK] "catalog_items": 3 docs');
    console.log('        _id is MongoDB ObjectId -> VARCHAR(24) in PG (Edge Case F)');
    console.log('        tags: array of scalars (Edge Case D)');
    console.log('        pricing.{basePrice,currency,billingCycle}: nested dot-notation');

    console.log(`\n\u{1F33F} MongoDB "${MONGO_DB}" seeding complete! (10 collections)\n`);

  } catch (err) {
    console.error('\n[ERROR] MongoDB Seeding:', err.message);
    console.log('   Verify: mongod is running on port 27017');
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: PostgreSQL Seeding  (Direction B source data)
// ─────────────────────────────────────────────────────────────────────────────
async function seedPostgreSQL() {
  console.log('\n\u{1F418} ==========================================================');
  console.log('\u{1F418}  [2/2] PostgreSQL Seeding - Phase 8 Testbed');
  console.log(`\u{1F418}  Host: ${PG_CONFIG.host}:${PG_CONFIG.port}  DB: "${PG_CONFIG.database}"`);
  console.log('\u{1F418} ==========================================================\n');

  // 1. Ensure target database exists and clean legacy tables from 'postgres'
  const adminClient = new PgClient({
    host: PG_CONFIG.host,
    port: PG_CONFIG.port,
    user: PG_CONFIG.user,
    password: PG_CONFIG.password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    await adminClient.connect();
    // Clean up any old p8_* tables in 'postgres' DB from previous run
    await adminClient.query(`
      DROP TABLE IF EXISTS p8_project_logs CASCADE;
      DROP TABLE IF EXISTS p8_sensor_readings CASCADE;
      DROP TABLE IF EXISTS p8_type_showcase CASCADE;
      DROP TABLE IF EXISTS p8_long_col_names CASCADE;
      DROP TABLE IF EXISTS p8_employees CASCADE;
      DROP TABLE IF EXISTS p8_departments CASCADE;
      DROP VIEW IF EXISTS p8_dept_summary CASCADE;
      DROP TYPE IF EXISTS p8_project_status CASCADE;
    `).catch(() => {});

    if (PG_CONFIG.database !== 'postgres') {
      const dbCheck = await adminClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [PG_CONFIG.database]
      );
      if (dbCheck.rows.length === 0) {
        await adminClient.query(`CREATE DATABASE "${PG_CONFIG.database}"`);
        console.log(`   [INIT] Created dedicated PostgreSQL database "${PG_CONFIG.database}"`);
      }
    }
  } catch (err) {
    console.warn('   [NOTE] Admin DB connection notice:', err.message);
  } finally {
    await adminClient.end().catch(() => {});
  }

  let client;
  try {
    client = new PgClient({ ...PG_CONFIG, connectionTimeoutMillis: 5000 });
    await client.connect();
    console.log(`🐘 Connected to PostgreSQL (Database: "${PG_CONFIG.database}")\n`);

    // CLEANUP from previous runs
    await client.query(`
      DROP TABLE IF EXISTS p8_project_logs    CASCADE;
      DROP TABLE IF EXISTS p8_sensor_readings CASCADE;
      DROP TABLE IF EXISTS p8_type_showcase   CASCADE;
      DROP TABLE IF EXISTS p8_long_col_names  CASCADE;
      DROP TABLE IF EXISTS p8_employees       CASCADE;
      DROP TABLE IF EXISTS p8_departments     CASCADE;
      DROP VIEW  IF EXISTS p8_dept_summary    CASCADE;
      DROP TYPE  IF EXISTS p8_project_status  CASCADE;
    `);
    console.log('   [CLEAN] Dropped previous Phase 8 tables/types');

    // ── Table 1: "p8_departments" (FK parent) ─────────────────────────
    await client.query(`
      CREATE TABLE p8_departments (
        id             SERIAL PRIMARY KEY,
        dept_code      VARCHAR(20)  UNIQUE NOT NULL,
        dept_name      VARCHAR(100) NOT NULL,
        floor_number   INT          DEFAULT 1,
        head_count     INT          DEFAULT 0,
        budget_inr     NUMERIC(14,2) DEFAULT 0.00,
        is_active      BOOLEAN      DEFAULT TRUE,
        established_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO p8_departments (dept_code, dept_name, floor_number, head_count, budget_inr) VALUES
        ('ENG',   'Engineering and R&D',              4, 120, 45000000.00),
        ('MKTG',  'Marketing and Brand',              2,  35,  8500000.00),
        ('OPS',   'Operations and Infrastructure',   3,  58, 12000000.00),
        ('HR',    'Human Resources',                  1,  20,  3200000.00),
        ('LEGAL', 'Legal and Compliance',             5,  12,  9800000.00),
        ('DATA',  'Data and Analytics Platform',      4,  45, 22000000.00),
        ('CX',    'Customer Experience',              2,  63,  6500000.00),
        ('SEC',   'Cybersecurity',                    5,  18, 15000000.00);
    `);
    console.log('   [OK] "p8_departments": 8 rows (FK parent table)');

    // ── Table 2: "p8_employees" (FK child, ENUM, BOOLEAN, NUMERIC, ARRAY, JSONB)
    await client.query(`
      CREATE TYPE p8_project_status AS ENUM (
        'active', 'on_hold', 'completed', 'cancelled', 'planning'
      );
      CREATE TABLE p8_employees (
        id                SERIAL PRIMARY KEY,
        employee_code     VARCHAR(20)   UNIQUE NOT NULL,
        full_name         VARCHAR(120)  NOT NULL,
        email             VARCHAR(100)  UNIQUE NOT NULL,
        dept_id           INT           REFERENCES p8_departments(id) ON DELETE SET NULL,
        job_title         VARCHAR(80)   NOT NULL,
        salary_inr        NUMERIC(12,2) NOT NULL,
        is_remote         BOOLEAN       DEFAULT FALSE,
        joined_at         TIMESTAMP     NOT NULL,
        contract_end      TIMESTAMP,
        performance_score NUMERIC(3,1)  DEFAULT 7.5,
        status            p8_project_status DEFAULT 'active',
        skills            TEXT[],
        meta              JSONB         DEFAULT '{}'
      );
      INSERT INTO p8_employees
        (employee_code, full_name, email, dept_id, job_title, salary_inr, is_remote,
         joined_at, contract_end, performance_score, status, skills, meta)
      VALUES
        ('EMP-001','Arjun Mehta',    'arjun@corp.test',    1,'Senior Backend Engineer', 1800000, FALSE, '2022-03-15 09:00:00', NULL,                   9.1, 'active',    ARRAY['Node.js','TypeScript','MongoDB'],    '{"team":"platform","level":"L4"}'),
        ('EMP-002','Priya Sharma',   'priya@corp.test',    6,'Data Engineer',           1600000, TRUE,  '2023-01-10 09:00:00', NULL,                   8.7, 'active',    ARRAY['Python','PostgreSQL','dbt','Spark'], '{"team":"data","level":"L3"}'),
        ('EMP-003','Rohan Iyer',     'rohan@corp.test',    8,'Security Analyst',        1400000, FALSE, '2021-07-20 09:00:00', NULL,                   8.2, 'active',    ARRAY['SIEM','Splunk','Pentest'],           '{"team":"blue","level":"L3"}'),
        ('EMP-004','Divya Nair',     'divya@corp.test',    2,'Brand Strategist',        1200000, TRUE,  '2024-02-01 09:00:00', '2026-01-31 18:00:00', 7.9, 'on_hold',   ARRAY['Figma','Adobe XD'],                 '{"team":"brand","level":"L2"}'),
        ('EMP-005','Siddharth Patel','siddharth@corp.test',1,'DevOps Engineer',         1550000, FALSE, '2022-11-05 09:00:00', NULL,                   9.4, 'active',    ARRAY['Kubernetes','Docker','Terraform'],   '{"team":"infra","level":"L4"}'),
        ('EMP-006','Ananya Singh',   'ananya@corp.test',   3,'Operations Manager',      1350000, FALSE, '2020-05-18 09:00:00', NULL,                   8.8, 'active',    ARRAY['ITSM','Incident Mgmt','JIRA'],       '{"team":"ops","level":"L5"}'),
        ('EMP-007','Kiran Reddy',    'kiran@corp.test',    6,'ML Engineer',             1750000, TRUE,  '2023-06-12 09:00:00', NULL,                   9.0, 'active',    ARRAY['Python','TensorFlow','PyTorch'],     '{"team":"ml","level":"L4"}'),
        ('EMP-008','Neha Bose',      'neha@corp.test',     4,'HR Business Partner',     1100000, FALSE, '2021-09-01 09:00:00', NULL,                   7.5, 'active',    ARRAY['Workday','OKR','Recruitment'],       '{"team":"hrbp","level":"L3"}'),
        ('EMP-009','Vikram Joshi',   'vikram@corp.test',   5,'Corporate Counsel',       2100000, FALSE, '2019-12-10 09:00:00', NULL,                   8.6, 'active',    ARRAY['Contract Law','GDPR','IP Rights'],   '{"team":"legal","level":"L5"}'),
        ('EMP-010','Tanvi Kulkarni', 'tanvi@corp.test',    7,'CX Lead',                 1300000, TRUE,  '2023-04-20 09:00:00', '2025-03-31 18:00:00', 8.1, 'completed', ARRAY['Zendesk','NPS','CJM'],               '{"team":"cx","level":"L3"}');
    `);
    console.log('   [OK] "p8_employees": 10 rows');
    console.log('        FK: dept_id -> p8_departments.id');
    console.log('        ENUM: status (p8_project_status) | TEXT[]: skills | JSONB: meta');

    // ── Table 3: "p8_project_logs" (SERIAL PK - Safeguard 11) ────────
    await client.query(`
      CREATE TABLE p8_project_logs (
        id          SERIAL PRIMARY KEY,
        project_ref VARCHAR(30) NOT NULL,
        log_level   VARCHAR(10) NOT NULL CHECK (log_level IN ('INFO','WARN','ERROR','DEBUG','FATAL')),
        message     TEXT NOT NULL,
        component   VARCHAR(60),
        trace_id    UUID DEFAULT gen_random_uuid(),
        duration_ms INT DEFAULT 0,
        logged_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO p8_project_logs (project_ref, log_level, message, component, duration_ms) VALUES
        ('PROJ-P8-001','INFO',  'Dry run simulation engine initialized.',         'dryRun.ts',          12),
        ('PROJ-P8-001','INFO',  'Connected to MongoDB source successfully.',      'dryRun.ts',          48),
        ('PROJ-P8-001','INFO',  'BEGIN transaction opened.',                      'pgClient',            2),
        ('PROJ-P8-001','WARN',  'Null byte detected in rawContent - sanitized.',  'transformer',         1),
        ('PROJ-P8-001','INFO',  'CREATE TABLE "orders" DDL validated.',           'ddlGenerator',        5),
        ('PROJ-P8-001','INFO',  'SAVEPOINT sp_tbl_0 created.',                   'pgClient',            1),
        ('PROJ-P8-001','INFO',  '500 sample docs tested: 497 passed, 3 failed.', 'sampleTester',      320),
        ('PROJ-P8-001','WARN',  'Identifier truncated: 65-char field -> 63-char.','sanitizeIdentifier', 0),
        ('PROJ-P8-001','INFO',  'ROLLBACK issued - zero permanent mutations.',    'pgClient',            3),
        ('PROJ-P8-001','INFO',  'Dry run simulation completed in 847ms.',         'dryRun.ts',         847),
        ('PROJ-P8-002','INFO',  'Phase 8 testbed seeder started.',               'seed-phase8',         0),
        ('PROJ-P8-002','INFO',  'MongoDB seeding complete: 10 collections.',      'seed-phase8',      2100),
        ('PROJ-P8-002','INFO',  'PostgreSQL seeding complete: 6 tables.',         'seed-phase8',      1800),
        ('PROJ-P8-002','ERROR', 'Test connection to invalid host failed.',        'connTest',           50),
        ('PROJ-P8-002','DEBUG', 'extractFieldValue: camelCase->snake_case OK.',  'extractFieldValue',   0);
    `);
    console.log('   [OK] "p8_project_logs": 15 rows');
    console.log('        SERIAL PRIMARY KEY -> Safeguard 11: sequence not burned on ROLLBACK');
    console.log('        UUID trace_id via gen_random_uuid() -> Edge Case F');

    // ── Table 4: "p8_sensor_readings" (200 rows - throughput bench) ───
    await client.query(`
      CREATE TABLE p8_sensor_readings (
        id             SERIAL PRIMARY KEY,
        device_id      VARCHAR(30) NOT NULL,
        sensor_type    VARCHAR(30) NOT NULL,
        reading_value  NUMERIC(12,4) NOT NULL,
        unit           VARCHAR(10) NOT NULL,
        latitude       NUMERIC(10,6),
        longitude      NUMERIC(10,6),
        altitude_m     INT DEFAULT 0,
        battery_pct    INT CHECK (battery_pct >= 0 AND battery_pct <= 100),
        is_calibrated  BOOLEAN DEFAULT TRUE,
        recorded_at    TIMESTAMP NOT NULL
      );
    `);
    // Insert 200 rows in 4 batches of 50 (parameterized)
    const sensorTypes = ['temperature','pressure','luminosity','wind_speed','co2_level'];
    const sensorUnits = ['celsius','hPa','lux','m/s','ppm'];
    for (let batch = 0; batch < 4; batch++) {
      const placeholders = [];
      const vals = [];
      for (let r = 0; r < 50; r++) {
        const i = batch * 50 + r + 1;
        const base = r * 10;
        placeholders.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10})`);
        vals.push(
          `DEVICE-${String(i % 20 + 1).padStart(3,'0')}`,
          sensorTypes[i % 5],
          parseFloat((Math.random() * 100 + 15).toFixed(4)),
          sensorUnits[i % 5],
          parseFloat((12.9716 + i * 0.001).toFixed(6)),
          parseFloat((77.5946 + i * 0.001).toFixed(6)),
          Math.floor(Math.random() * 200 + 800),
          Math.floor(Math.random() * 60 + 40),
          i % 10 !== 0,
          new Date(Date.now() - i * 30000).toISOString()
        );
      }
      await client.query(
        `INSERT INTO p8_sensor_readings (device_id,sensor_type,reading_value,unit,latitude,longitude,altitude_m,battery_pct,is_calibrated,recorded_at) VALUES ${placeholders.join(',')}`,
        vals
      );
    }
    console.log('   [OK] "p8_sensor_readings": 200 rows');
    console.log('        NUMERIC(12,4): high-precision values | CHECK: battery_pct 0-100');
    console.log('        -> Safeguard 8: 200 PG rows for throughput profiling in PG->Mongo direction');

    // ── Table 5: "p8_type_showcase" (ALL PG data types) ───────────────
    await client.query(`
      CREATE TABLE p8_type_showcase (
        id              SERIAL         PRIMARY KEY,
        col_smallint    SMALLINT       DEFAULT 0,
        col_int         INTEGER        DEFAULT 0,
        col_bigint      BIGINT         DEFAULT 0,
        col_numeric     NUMERIC(18,4)  DEFAULT 0.0000,
        col_real        REAL           DEFAULT 0.0,
        col_double      DOUBLE PRECISION DEFAULT 0.0,
        col_boolean     BOOLEAN        DEFAULT FALSE,
        col_char        CHAR(10)       DEFAULT '          ',
        col_varchar     VARCHAR(255)   DEFAULT '',
        col_text        TEXT,
        col_date        DATE           DEFAULT CURRENT_DATE,
        col_time        TIME           DEFAULT '00:00:00',
        col_timestamp   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
        col_uuid        UUID           DEFAULT gen_random_uuid(),
        col_jsonb       JSONB          DEFAULT '{}',
        col_text_array  TEXT[]         DEFAULT ARRAY[]::TEXT[],
        col_int_array   INT[]          DEFAULT ARRAY[]::INT[]
      );
      INSERT INTO p8_type_showcase
        (col_smallint, col_int, col_bigint, col_numeric, col_real, col_double,
         col_boolean, col_char, col_varchar, col_text, col_date, col_time,
         col_timestamp, col_jsonb, col_text_array, col_int_array)
      VALUES
        (32767, 2147483647, 9223372036854775807, 999999.9999, 3.14, 2.718281828,
         TRUE, 'CHAR10    ', 'Max boundary values', 'Full TEXT for Phase 8 type coercion test.',
         '2026-09-18', '23:59:59', '2026-09-18 23:59:59',
         '{"phase":8,"safeguard":"type_coercion","nested":{"a":1,"b":true}}',
         ARRAY['tag1','tag2','tag3'], ARRAY[1,2,3,42,100]),
        (-32768, -2147483648, -9223372036854775808, -999999.9999, -3.14, -2.718281828,
         FALSE, 'NEG_BOUND ', 'Min boundary values', NULL,
         '2000-01-01', '00:00:00', '2000-01-01 00:00:00',
         '{"phase":8,"boundary":"minimum","values":[-1,-2,null,false]}',
         ARRAY[]::TEXT[], ARRAY[]::INT[]),
        (0, 0, 0, 0.0000, 0.0, 0.0,
         TRUE, 'ZERO      ', 'Zero values', 'Zero test: int->0, numeric->0.00, real->0.0',
         CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP,
         '{}', ARRAY['zero'], ARRAY[0]);
    `);
    console.log('   [OK] "p8_type_showcase": 3 rows');
    console.log('        ALL PG types: SMALLINT, INT, BIGINT, NUMERIC, REAL, DOUBLE');
    console.log('        BOOLEAN, CHAR, VARCHAR, TEXT, DATE, TIME, TIMESTAMP');
    console.log('        UUID, JSONB, TEXT[], INT[] - complete BSON coercion coverage');

    // ── Table 6: "p8_long_col_names" (Safeguard 5 on PG side) ─────────
    await client.query(`
      CREATE TABLE p8_long_col_names (
        id             SERIAL PRIMARY KEY,
        record_code    VARCHAR(30) NOT NULL,
        short_field    VARCHAR(100),
        numeric_amount NUMERIC(14,2) DEFAULT 0.00,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO p8_long_col_names (record_code, short_field, numeric_amount) VALUES
        ('LONG-001', 'First long-name test record',  1234.56),
        ('LONG-002', 'Second long-name test record', 7890.12),
        ('LONG-003', 'Third long-name test record',  4567.89);
    `);
    console.log('   [OK] "p8_long_col_names": 3 rows');
    console.log('        -> Safeguard 5: 63-byte truncation tested via long_identifiers Mongo coll.');

    // ── View: "p8_dept_summary" (Layer 2 PG->Mongo test) ─────────────
    await client.query(`
      CREATE VIEW p8_dept_summary AS
      SELECT
        d.dept_code,
        d.dept_name,
        COUNT(e.id)                AS employee_count,
        ROUND(AVG(e.salary_inr),2) AS avg_salary_inr,
        ROUND(AVG(e.performance_score),2) AS avg_performance,
        SUM(CASE WHEN e.is_remote THEN 1 ELSE 0 END) AS remote_count,
        d.budget_inr
      FROM p8_departments d
      LEFT JOIN p8_employees e ON d.id = e.dept_id
      GROUP BY d.id, d.dept_code, d.dept_name, d.budget_inr
      ORDER BY employee_count DESC;
    `);
    console.log('   [OK] View "p8_dept_summary" created (PG->MongoDB Layer 2 test)');
    console.log(`\n\u{1F418} PostgreSQL seeding complete! (6 tables + 1 view)\n`);

  } catch (err) {
    console.error('\n[ERROR] PostgreSQL Seeding:', err.message);
    if (err.message.includes('password') || err.message.includes('authentication')) {
      console.log('   Fix: node scripts/seed-phase8-testbed.js <pg_password> <pg_user> <pg_database>');
    } else if (err.message.includes('ECONNREFUSED')) {
      console.log('   Verify: PostgreSQL service is running on port', PG_CONFIG.port);
    }
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n================================================================');
  console.log('  MigrateIQ - Phase 8 Comprehensive Dry Run Testbed Seeder');
  console.log('================================================================');
  console.log('  Safeguards: 1, 4, 5, 6, 7, 8, 11, 13, 15');
  console.log('  Edge Cases: A (polymorphic), B (nested), C (NOT NULL failure),');
  console.log('              D (scalar arrays), E (date coercion), F (ObjectId)');
  console.log('  Directions: A (MongoDB->PostgreSQL)   B (PostgreSQL->MongoDB)');
  console.log('================================================================\n');

  await seedMongoDB();
  await seedPostgreSQL();

  console.log('\n================================================================');
  console.log('  TESTBED READY - How to Test in MigrateIQ');
  console.log('================================================================');

  console.log(`
DIRECTION A: MongoDB -> PostgreSQL (Workflow A)
-----------------------------------------------
Source: MongoDB URI: mongodb://localhost:27017/${MONGO_DB}
Target: PostgreSQL: postgresql://${PG_CONFIG.user}:${PG_CONFIG.password}@${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_CONFIG.database}

Collections to map and what to verify:

  "orders" (50 docs)
    -> Map orderNumber->order_number, customerName->customer_name (camelCase: Sfgd 15)
    -> Map items as Child Table -> order_items (Safeguard 7: sort_order column)
    -> Verify: order_items created with sort_order INTEGER NOT NULL
    -> Verify: tags array of strings handled (Edge Case D)

  "users" (50 docs)
    -> 12/50 have null email -> set NOT NULL on email field:
       Option A: set defaultValue="unknown@placeholder.com" -> 0 failed rows (Sfgd 6)
       Option C: no default -> 12 rows in skipped-rows drawer (Edge Case C)
    -> phoneNumber mixes String/Integer -> polymorphic warning (Edge Case A)
    -> Map address.city, address.zipCode via dot-notation (Safeguard 15 / Edge Case B)

  "products" (3 docs)
    -> inStock->in_stock, unitPrice->unit_price, stockCount->stock_count (Sfgd 15)
    -> specs.dimensions.widthCm -> deep dot-notation (Edge Case B)
    -> _id ObjectId -> VARCHAR(24) (Edge Case F)

  "poison_pills" (3 docs)
    -> Engine strips \\0 null bytes from rawContent, sourceUrl (Safeguard 4)
    -> Expect: 0 failed rows after sanitization

  "nullable_fields" (20 docs)
    -> Set defaultValues in Schema Mapper:
         integerField -> 0       numericField -> 0.00
         booleanField -> false   timestampField -> CURRENT_TIMESTAMP
         jsonbField   -> {}      textField -> Unknown
    -> Expect: 0 failed rows (Safeguard 6: Type-Aware Default Imputation)

  "incomplete_records" (30 docs)
    -> Do NOT set defaultValue for requiredCode
    -> Expect: 6 rows (20%) in Skipped Rows drawer (Edge Case C / DLQ)

  "throughput_bench" (500 docs)
    -> Expect: rows/sec > 1000 shown in Telemetry Bar (Safeguard 8)
    -> Observe: Full Migration ETA calculator (Safeguard 9)

  "events" (3 docs)
    -> startTime: Date object, ISO string, Unix ms -> all coerced to TIMESTAMP
    -> Edge Case E: date/timestamp coercion across formats

  "long_identifiers" (2 docs)
    -> Field names > 63 chars -> truncated with deterministic hash (Safeguard 5)
    -> Two fields sharing same 58-char prefix -> must get different hashes

  "catalog_items" (3 docs)
    -> tags: array of scalars (Edge Case D)
    -> pricing.basePrice via dot-notation (Edge Case B)

After running Dry Run Simulation:
  [*] ROLLBACK confirmed in terminal log (Safeguard 1)
  [*] Telemetry bar shows throughput, ETA, storage headroom (Sfgd 8, 9, 10)
  [*] Export Dossier (download button) generates audit markdown (Safeguard 14)
  [*] Re-test one table individually -> sub-500ms (Safeguard 13)

DIRECTION B: PostgreSQL -> MongoDB (Workflow B)
------------------------------------------------
Source: postgresql://${PG_CONFIG.user}:${PG_CONFIG.password}@${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_CONFIG.database}
Target: mongodb://localhost:27017/${MONGO_DB}

Tables to map and what to verify:

  "p8_departments"     -> FK parent | BOOLEAN, NUMERIC, TIMESTAMP, SERIAL PK
  "p8_employees"       -> FK (dept_id) | ENUM p8_project_status | TEXT[] skills
                          JSONB meta | BOOLEAN is_remote | NUMERIC salary
  "p8_project_logs"    -> SERIAL PK (Safeguard 11: sequence not burned on rollback)
                          UUID trace_id via gen_random_uuid()
  "p8_sensor_readings" -> 200 rows for PG->Mongo throughput bench (Safeguard 8)
                          NUMERIC(12,4), CHECK constraint, BOOLEAN
  "p8_type_showcase"   -> ALL PG types: SMALLINT/INT/BIGINT, NUMERIC, REAL, DOUBLE
                          BOOLEAN, CHAR, VARCHAR, TEXT, DATE, TIME, TIMESTAMP,
                          UUID, JSONB, TEXT[], INT[] -> full BSON coercion coverage
  "p8_dept_summary"    -> SQL View: shows in Risk Report as Layer 2 card

After running Dry Run Simulation:
  [*] Direction shows "postgres-to-mongo" in result
  [*] BSON 16MB document bounds verified for all collections
  [*] p8_sensor_readings: 200 rows -> rows/sec throughput measured (Safeguard 8)
  [*] ENUM p8_project_status appears as Layer 2 card in Risk Report (Phase 7 link)
  [*] View p8_dept_summary appears as Layer 2 view card
`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\nFatal Seeder Error:', err);
  process.exit(1);
});
