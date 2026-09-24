const { Client } = require('pg');

async function setupPostgresTarget() {
  // Connect to postgres maintenance DB to check/create phase9_part2
  const adminClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'admin',
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    console.log('[Postgres] Connected to default admin database.');

    const checkDb = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'phase9_part2'"
    );

    if (checkDb.rows.length === 0) {
      console.log("[Postgres] Creating database 'phase9_part2'...");
      await adminClient.query('CREATE DATABASE phase9_part2');
      console.log("[Postgres] Database 'phase9_part2' created successfully.");
    } else {
      console.log("[Postgres] Database 'phase9_part2' already exists.");
    }
  } catch (err) {
    console.error('[Postgres] Error in admin setup:', err.message);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // Connect to phase9_part2 and wipe any existing tables to guarantee 100% empty state
  const targetClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'admin',
    database: 'phase9_part2'
  });

  try {
    await targetClient.connect();
    console.log("[Postgres] Connected to 'phase9_part2'. Resetting public schema to ensure 0 tables...");
    await targetClient.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await targetClient.query('CREATE SCHEMA public;');
    await targetClient.query('GRANT ALL ON SCHEMA public TO postgres;');
    await targetClient.query('GRANT ALL ON SCHEMA public TO public;');

    const tableCheck = await targetClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    console.log(`[Postgres] Verification: 'phase9_part2' public schema table count = ${tableCheck.rows.length}`);
    if (tableCheck.rows.length === 0) {
      console.log("✅ Target PostgreSQL database 'phase9_part2' is ready and 100% EMPTY.");
    } else {
      console.error("❌ Target PostgreSQL database 'phase9_part2' still has tables!");
      process.exit(1);
    }
  } catch (err) {
    console.error('[Postgres] Error resetting target database:', err.message);
    process.exit(1);
  } finally {
    await targetClient.end();
  }
}

setupPostgresTarget();
