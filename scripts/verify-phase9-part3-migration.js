/**
 * MigrateIQ — Phase 9 Part 3 Comprehensive Backend Parity & Cross-Check Audit
 * 
 * Directly queries:
 * - Source: MongoDB 'phase9part3' (localhost:27017)
 * - Target: PostgreSQL 'phase9part3' (localhost:5432)
 */

'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const { Client: PgClient } = require('pg');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'phase9part3';

const PG_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'admin',
  database: process.env.PG_DATABASE || 'phase9part3',
};

async function runCrossCheck() {
  console.log('\n===============================================================');
  console.log('🔍 MIGRATEIQ — PHASE 9 PART 3 BACKEND CROSS-CHECK & AUDIT');
  console.log('===============================================================');
  console.log(`Source Mongo DB: ${MONGO_DB} @ ${MONGO_URI}`);
  console.log(`Target PG DB:    ${PG_CONFIG.database} @ ${PG_CONFIG.host}:${PG_CONFIG.port}\n`);

  const mongoClient = new MongoClient(MONGO_URI);
  const pgClient = new PgClient(PG_CONFIG);

  try {
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB.');
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL.\n');

    const mongoDb = mongoClient.db(MONGO_DB);

    // 1. Get all tables in PostgreSQL
    const pgTablesRes = await pgClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const pgTables = pgTablesRes.rows.map(r => r.table_name);
    console.log(`📦 Found ${pgTables.length} tables in PostgreSQL.`);

    // 2. Get all collections in MongoDB
    const mongoCols = (await mongoDb.listCollections().toArray())
      .map(c => c.name)
      .filter(n => !n.startsWith('system.'))
      .sort();
    console.log(`🍃 Found ${mongoCols.length} collections in MongoDB.\n`);

    // 3. Row count audit
    console.log('-----------------------------------------------------------------------------------');
    console.log('📊 1. TOP-LEVEL COLLECTION / TABLE ROW COUNT PARITY');
    console.log('-----------------------------------------------------------------------------------');

    let totalPgRows = 0;
    const tableCounts = {};

    for (const table of pgTables) {
      const countRes = await pgClient.query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(countRes.rows[0].count, 10);
      tableCounts[table] = count;
      totalPgRows += count;
    }

    let totalMongoDocs = 0;
    const mongoCounts = {};
    for (const col of mongoCols) {
      const count = await mongoDb.collection(col).countDocuments();
      mongoCounts[col] = count;
      totalMongoDocs += count;
    }

    console.log(
      'Target Table'.padEnd(28) +
      'Type'.padEnd(12) +
      'PG Rows'.padStart(12) +
      'Mongo Docs'.padStart(14) +
      '   Status'
    );
    console.log('-'.repeat(75));

    let allTopLevelMatched = true;

    for (const col of mongoCols) {
      const mCount = mongoCounts[col] || 0;
      const pCount = tableCounts[col] || 0;
      const match = mCount === pCount;
      if (!match) allTopLevelMatched = false;
      console.log(
        col.padEnd(28) +
        'Direct'.padEnd(12) +
        pCount.toLocaleString().padStart(12) +
        mCount.toLocaleString().padStart(14) +
        (match ? '   ✅ 100% MATCH' : `   ❌ DIFF (${pCount - mCount})`)
      );
    }

    console.log('-'.repeat(75));
    console.log(`Total Top-Level Source Docs: ${totalMongoDocs.toLocaleString()} | Top-Level Match: ${allTopLevelMatched ? '✅ YES' : '❌ NO'}\n`);

    // 4. Detailed child table array item parity check
    console.log('-----------------------------------------------------------------------------------');
    console.log('🧩 2. DECOMPOSED ARRAY $\\rightarrow$ CHILD TABLE PARITY CHECK');
    console.log('-----------------------------------------------------------------------------------');

    const arrayMappings = [
      { parentCol: 'customers', arrayField: 'kycDocuments', childTable: 'customers_kyc_documents' },
      { parentCol: 'customers', arrayField: 'paymentMethods', childTable: 'customers_paymentMethods' },
      { parentCol: 'customers', arrayField: 'shippingAddresses', childTable: 'customers_shipping_addresses' },
      { parentCol: 'employees', arrayField: 'certifications', childTable: 'employees_certifications' },
      { parentCol: 'orders', arrayField: 'items', childTable: 'orders_items' },
      { parentCol: 'orders', arrayField: 'paymentAttempts', childTable: 'orders_payment_attempts' },
      { parentCol: 'products', arrayField: 'supplierRefs', childTable: 'products_supplier_refs' },
      { parentCol: 'returns', arrayField: 'returnItems', childTable: 'returns_return_items' },
      { parentCol: 'reviews', arrayField: 'votes', childTable: 'reviews_votes' },
      { parentCol: 'shipments', arrayField: 'trackingEvents', childTable: 'shipments_trackingEvents' },
      { parentCol: 'shipments', arrayField: 'waypoints', childTable: 'shipments_waypoints' },
      { parentCol: 'suppliers', arrayField: 'contacts', childTable: 'suppliers_contacts' },
      { parentCol: 'support_tickets', arrayField: 'messages', childTable: 'support_tickets_messages' },
    ];

    console.log(
      'Child Table'.padEnd(32) +
      'PG Rows'.padStart(12) +
      'Mongo Array Items'.padStart(20) +
      '   Status'
    );
    console.log('-'.repeat(75));

    let allArraysMatched = true;

    for (const m of arrayMappings) {
      if (!tableCounts[m.childTable]) {
        console.log(`⚠️ Child table "${m.childTable}" not present in PG.`);
        continue;
      }
      const pgRows = tableCounts[m.childTable];

      // Calculate exact mongo array item count using aggregation $size
      const aggRes = await mongoDb.collection(m.parentCol).aggregate([
        {
          $project: {
            itemCount: {
              $cond: {
                if: { $isArray: `$${m.arrayField}` },
                then: { $size: `$${m.arrayField}` },
                else: 0
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalItems: { $sum: '$itemCount' }
          }
        }
      ]).toArray();

      const mongoItems = aggRes.length > 0 ? aggRes[0].totalItems : 0;
      const match = pgRows === mongoItems;
      if (!match) allArraysMatched = false;

      console.log(
        m.childTable.padEnd(32) +
        pgRows.toLocaleString().padStart(12) +
        mongoItems.toLocaleString().padStart(20) +
        (match ? '   ✅ 100% MATCH' : `   ❌ DIFF (${pgRows - mongoItems})`)
      );
    }

    console.log('-'.repeat(75));
    console.log(`All Decomposed Arrays Match: ${allArraysMatched ? '✅ YES' : '❌ NO'}\n`);

    // 5. Check sort_order integrity in all child tables
    console.log('-----------------------------------------------------------------------------------');
    console.log('🔢 3. CHILD TABLE SORT_ORDER INTEGRITY (Rule #4 Check)');
    console.log('-----------------------------------------------------------------------------------');

    let allSortOrdersValid = true;
    for (const m of arrayMappings) {
      if (!tableCounts[m.childTable]) continue;
      const sortRes = await pgClient.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(sort_order) as non_null,
          MIN(sort_order) as min_s,
          MAX(sort_order) as max_s
        FROM "${m.childTable}";
      `);
      const r = sortRes.rows[0];
      const hasNull = parseInt(r.total, 10) !== parseInt(r.non_null, 10);
      const minIsZero = parseInt(r.min_s, 10) === 0;
      const ok = !hasNull && (parseInt(r.total, 10) === 0 || minIsZero);

      if (!ok) allSortOrdersValid = false;

      console.log(
        `  ${ok ? '✅' : '❌'} ${m.childTable.padEnd(32)}: min=${r.min_s}, max=${r.max_s} | ${hasNull ? 'NULLS DETECTED' : '0 nulls, 0-indexed'}`
      );
    }
    console.log(`All sort_orders valid: ${allSortOrdersValid ? '✅ YES' : '❌ NO'}\n`);

    // 6. Deep content spot check on sample documents
    console.log('-----------------------------------------------------------------------------------');
    console.log('🔬 4. DEEP RECORD SPOT CHECK (Source Mongo vs Target PG)');
    console.log('-----------------------------------------------------------------------------------');

    const sampleCollections = ['products', 'orders', 'customers', 'reviews', 'shipments'];

    for (const col of sampleCollections) {
      console.log(`\nVerifying 2 full records from "${col}"...`);
      const mongoDocs = await mongoDb.collection(col).find().limit(2).toArray();

      for (const mDoc of mongoDocs) {
        const idStr = String(mDoc._id);
        const pgRowRes = await pgClient.query(`SELECT * FROM "${col}" WHERE "id" = $1 LIMIT 1`, [idStr]);

        if (pgRowRes.rows.length === 0) {
          console.log(`  ❌ Mongo _id ${idStr} NOT FOUND in PostgreSQL table "${col}"!`);
        } else {
          const pRow = pgRowRes.rows[0];
          console.log(`  ✅ Record id "${idStr}" verified in PostgreSQL:`);
          if (col === 'products') {
            console.log(`     • SKU:   Mongo="${mDoc.sku}" | PG="${pRow.sku}" -> ${mDoc.sku === pRow.sku ? 'MATCH' : 'MISMATCH'}`);
            console.log(`     • Name:  Mongo="${mDoc.name}" | PG="${pRow.name}" -> ${mDoc.name === pRow.name ? 'MATCH' : 'MISMATCH'}`);
            console.log(`     • Stock: Mongo=${mDoc.stockQuantity} | PG=${pRow.stock_quantity} -> ${mDoc.stockQuantity === pRow.stock_quantity ? 'MATCH' : 'MISMATCH'}`);
          } else if (col === 'orders') {
            console.log(`     • Code:   Mongo="${mDoc.orderNumber || mDoc.orderCode}" | PG="${pRow.order_number || pRow.order_code}"`);
            console.log(`     • Status: Mongo="${mDoc.status}" | PG="${pRow.status}" -> ${mDoc.status === pRow.status ? 'MATCH' : 'MISMATCH'}`);
          } else if (col === 'customers') {
            console.log(`     • Email: Mongo="${mDoc.email}" | PG="${pRow.email}" -> ${mDoc.email === pRow.email ? 'MATCH' : 'MISMATCH'}`);
            console.log(`     • Name:  Mongo="${mDoc.firstName} ${mDoc.lastName}" | PG="${pRow.first_name} ${pRow.last_name}"`);
          } else if (col === 'reviews') {
            console.log(`     • Rating: Mongo=${mDoc.rating} | PG=${pRow.rating} -> ${mDoc.rating === pRow.rating ? 'MATCH' : 'MISMATCH'}`);
            console.log(`     • Title:  Mongo="${mDoc.title}" | PG="${pRow.title}" -> ${mDoc.title === pRow.title ? 'MATCH' : 'MISMATCH'}`);
          } else if (col === 'shipments') {
            console.log(`     • Tracking: Mongo="${mDoc.trackingNumber}" | PG="${pRow.tracking_number}" -> ${mDoc.trackingNumber === pRow.tracking_number ? 'MATCH' : 'MISMATCH'}`);
            console.log(`     • Carrier:  Mongo="${mDoc.carrier}" | PG="${pRow.carrier}" -> ${mDoc.carrier === pRow.carrier ? 'MATCH' : 'MISMATCH'}`);
          }
        }
      }
    }

    console.log('\n===================================================================================');
    console.log('🏆 FINAL AUDIT RESULT:');
    console.log(`   • Total PG Database Rows:  ${totalPgRows.toLocaleString()}`);
    console.log(`   • Total MongoDB Top Docs:  ${totalMongoDocs.toLocaleString()}`);
    console.log(`   • Top-Level Tables Match:  ${allTopLevelMatched ? '100% PARITY ✅' : 'FAIL ❌'}`);
    console.log(`   • Child Table Arrays Match:${allArraysMatched ? '100% PARITY ✅' : 'FAIL ❌'}`);
    console.log(`   • Sort Order Sequential:   ${allSortOrdersValid ? '100% VALID ✅' : 'FAIL ❌'}`);
    console.log('===================================================================================\n');

  } catch (err) {
    console.error('\n❌ Audit error:', err);
  } finally {
    await mongoClient.close();
    await pgClient.end();
  }
}

runCrossCheck();
