/**
 * MigrateIQ — Phase 9 Part 3 PostgreSQL Target Database Setup
 *
 * Creates an EMPTY 'phase9part3' database in PostgreSQL.
 * This is the target database for MigrateIQ to migrate into.
 * MigrateIQ will create all tables, columns, and foreign keys automatically.
 *
 * Usage: node scripts/setup-phase9-part3-postgres.js
 *
 * Prerequisites:
 *   npm install pg (in root or apps/desktop)
 *   PostgreSQL running on localhost:5432
 */

'use strict';

const { Client } = require('pg');

const PG_HOST     = process.env.PG_HOST     || 'localhost';
const PG_PORT     = parseInt(process.env.PG_PORT || '5432');
const PG_USER     = process.env.PG_USER     || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'admin';
const TARGET_DB   = 'phase9part3';

async function setup() {
  console.log('\n🐘 Phase 9 Part 3 — PostgreSQL Target Setup');
  console.log(`   Host: ${PG_HOST}:${PG_PORT} | User: ${PG_USER}\n`);

  // Connect to default 'postgres' DB to create our target
  const client = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: 'postgres',
  });

  await client.connect();
  console.log('✅ Connected to PostgreSQL.');

  // Drop existing if any (clean start)
  const existing = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [TARGET_DB]
  );

  if (existing.rowCount > 0) {
    console.log(`⚠️  Database '${TARGET_DB}' already exists. Dropping for clean start...`);
    // Terminate any active connections first
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [TARGET_DB]);
    await client.query(`DROP DATABASE "${TARGET_DB}"`);
    console.log(`   ✓ Dropped existing '${TARGET_DB}'.`);
  }

  // Create fresh empty database
  await client.query(`CREATE DATABASE "${TARGET_DB}" ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0`);
  console.log(`✅ Created empty database '${TARGET_DB}'.`);

  await client.end();

  // Verify by connecting to new DB
  const verifyClient = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: TARGET_DB,
  });
  await verifyClient.connect();
  const tables = await verifyClient.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'`);
  await verifyClient.end();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   🎯 PHASE 9 PART 3 — POSTGRESQL TARGET READY               ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Host:          ${PG_HOST}:${PG_PORT}${' '.repeat(Math.max(0, 43 - PG_HOST.length - String(PG_PORT).length))}║`);
  console.log(`║  Database:      ${TARGET_DB.padEnd(46)}║`);
  console.log(`║  Tables now:    ${tables.rows[0].count.padEnd(46)}║`);
  console.log(`║  Status:        Empty — ready for MigrateIQ ETL             ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  NEXT STEPS:                                                 ║');
  console.log('║  1. Run seed-phase9-part3-testbed.js to fill MongoDB         ║');
  console.log('║  2. In MigrateIQ: Source = phase9part3 (MongoDB)             ║');
  console.log('║                   Target = phase9part3 (PostgreSQL)          ║');
  console.log('║  3. Run the migration and watch it handle all 20 edge cases  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

setup().catch(err => {
  console.error('❌ Failed to set up PostgreSQL target:', err.message);
  if (err.message.includes('ECONNREFUSED')) {
    console.error('   → Is PostgreSQL running? Check pg service on port', PG_PORT);
  }
  if (err.message.includes('password authentication')) {
    console.error('   → Wrong password. Set PG_PASSWORD env var or update the script.');
  }
  process.exit(1);
});
