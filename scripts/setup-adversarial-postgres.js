/**
 * MigrateIQ — Adversarial Mega-Testbed PostgreSQL Target Setup
 *
 * Creates an EMPTY 'adversarial_mega_db' database in PostgreSQL.
 * This is the clean target database for MigrateIQ to migrate into.
 * MigrateIQ will automatically create all 36 tables, columns, indexes, and foreign keys.
 *
 * Usage: node scripts/setup-adversarial-postgres.js
 *
 * Environment Variables (Optional):
 *   PG_HOST     (default: 'localhost')
 *   PG_PORT     (default: 5432)
 *   PG_USER     (default: 'postgres')
 *   PG_PASSWORD (default: 'admin')
 */

'use strict';

const { Client } = require('pg');

const PG_HOST     = process.env.PG_HOST     || 'localhost';
const PG_PORT     = parseInt(process.env.PG_PORT || '5432', 10);
const PG_USER     = process.env.PG_USER     || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'admin';
const TARGET_DB   = 'adversarial_mega_db';

async function setup() {
  console.log('\n==============================================================');
  console.log('🐘 ADVERSARIAL MEGA-TESTBED: POSTGRESQL TARGET DATABASE SETUP');
  console.log('==============================================================');
  console.log(`   Host:     ${PG_HOST}:${PG_PORT}`);
  console.log(`   User:     ${PG_USER}`);
  console.log(`   Database: ${TARGET_DB}\n`);

  // Connect to default 'postgres' database to issue administrative commands
  const client = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL maintenance engine.');

    // Check if target database already exists
    const existing = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [TARGET_DB]
    );

    if (existing.rowCount > 0) {
      console.log(`⚠️  Database '${TARGET_DB}' already exists. Terminating active sessions and dropping...`);
      // Disconnect all other clients before dropping
      await client.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [TARGET_DB]);
      await client.query(`DROP DATABASE "${TARGET_DB}"`);
      console.log(`   ✓ Successfully dropped old '${TARGET_DB}'.`);
    }

    // Create fresh empty database with explicit UTF8 encoding
    await client.query(`CREATE DATABASE "${TARGET_DB}" ENCODING 'UTF8'`);
    console.log(`✅ Created fresh, empty database '${TARGET_DB}'.`);
  } finally {
    await client.end();
  }

  // Connect directly to the newly created database to verify clean state
  const verifyClient = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: TARGET_DB,
  });

  try {
    await verifyClient.connect();
    const tables = await verifyClient.query(`
      SELECT count(*) AS table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableCount = parseInt(tables.rows[0].table_count, 10);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   🎯 ADVERSARIAL POSTGRESQL TARGET IS READY                  ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Database:      ${TARGET_DB.padEnd(46)}║`);
    console.log(`║  Tables now:    ${String(tableCount).padEnd(46)}║`);
    console.log('║  Status:        100% Empty — Ready for MigrateIQ ETL         ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  NEXT STEP:                                                  ║');
    console.log('║  Run: node scripts/seed-adversarial-mega-testbed.js          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
  } finally {
    await verifyClient.end();
  }
}

setup().catch(err => {
  console.error('\n❌ Failed to setup PostgreSQL target:', err.message);
  if (err.message.includes('ECONNREFUSED')) {
    console.error('   → Could not connect to PostgreSQL. Is PostgreSQL service running on port', PG_PORT, '?');
  } else if (err.message.includes('password authentication')) {
    console.error('   → Authentication failed. Please verify PG_PASSWORD (default is "admin" or your local password).');
  }
  process.exit(1);
});
