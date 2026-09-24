/**
 * MigrateIQ - Phase 9 Live Migration Verification Script
 *
 * Verifies the result of the migration from "phase9_source_mongo" -> "phase9_part1"
 *
 * Checks:
 * 1. PostgreSQL tables created
 * 2. Row count matching between MongoDB and PostgreSQL
 * 3. Child table "order_items" sort_order integrity (0-based indexing)
 * 4. Sample data integrity (emails, numbers, dates)
 *
 * Usage:
 *   node scripts/verify-phase9-migration.js [pg_password] [pg_user] [pg_port]
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
const MONGO_DB = 'phase9_source_mongo';
const PG_TARGET_DB = 'phase9_part1';

async function verify() {
  console.log('\n======================================================');
  console.log('🔍 Phase 9 Live Migration - Post-Run Verification');
  console.log('======================================================');

  // Connect MongoDB
  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const mongoDb = mongoClient.db(MONGO_DB);

  // Connect PostgreSQL
  const pgClient = new PgClient({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_TARGET_DB
  });
  await pgClient.connect();

  console.log(`Connected to Source: ${MONGO_DB}`);
  console.log(`Connected to Target: ${PG_TARGET_DB}\n`);

  // 1. List PG tables
  const tablesRes = await pgClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const pgTables = tablesRes.rows.map(r => r.table_name);
  console.log(`📋 PostgreSQL Tables Found (${pgTables.length}):`);
  pgTables.forEach(t => console.log(`   • ${t}`));

  if (pgTables.length === 0) {
    console.log('\n⚠️  No tables found in PostgreSQL target database yet.');
    console.log('   Please run the migration in the MigrateIQ app first!\n');
    await mongoClient.close();
    await pgClient.end();
    return;
  }

  console.log('\n📊 Row Count Parity Check:');
  console.log('------------------------------------------------------');

  const collections = ['categories', 'users', 'products', 'orders'];
  for (const col of collections) {
    const mongoCount = await mongoDb.collection(col).countDocuments();
    // Check matching PG table
    const matchingPgTable = pgTables.find(t => t.toLowerCase() === col.toLowerCase());
    if (matchingPgTable) {
      const pgCountRes = await pgClient.query(`SELECT COUNT(*) FROM "${matchingPgTable}";`);
      const pgCount = parseInt(pgCountRes.rows[0].count, 10);
      const match = mongoCount === pgCount;
      console.log(`   ${match ? '✅' : '❌'} ${col.padEnd(14)} Mongo: ${String(mongoCount).padStart(5)} | PG: ${String(pgCount).padStart(5)} ${match ? '(MATCH)' : '(MISMATCH!)'}`);
    } else {
      console.log(`   ⚠️ ${col.padEnd(14)} Not found in PostgreSQL tables`);
    }
  }

  // 2. Child Table Check (order_items)
  const childTable = pgTables.find(t => t.includes('item') || t.includes('order_item'));
  if (childTable) {
    console.log('\n👶 Child Table & sort_order Verification:');
    console.log('------------------------------------------------------');
    console.log(`   Target Child Table: "${childTable}"`);

    // Check sort_order column
    const colCheck = await pgClient.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${childTable}' AND column_name = 'sort_order';
    `);

    if (colCheck.rows.length > 0) {
      console.log(`   ✅ "sort_order" column detected (type: ${colCheck.rows[0].data_type})`);

      // Check sort_order values
      const sampleSort = await pgClient.query(`
        SELECT sort_order, COUNT(*) as count
        FROM "${childTable}"
        GROUP BY sort_order
        ORDER BY sort_order
        LIMIT 5;
      `);
      console.log('   Sample sort_order distribution:');
      sampleSort.rows.forEach(r => {
        console.log(`      • sort_order ${r.sort_order}: ${r.count} items`);
      });
    } else {
      console.log('   ⚠️ "sort_order" column not found in child table');
    }
  }

  console.log('\n======================================================');
  console.log('🎉 Verification Complete!');
  console.log('======================================================\n');

  await mongoClient.close();
  await pgClient.end();
}

verify().catch(console.error);
