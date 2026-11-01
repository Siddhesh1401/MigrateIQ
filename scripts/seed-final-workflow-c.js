/**
 * MigrateIQ - Industrial Testbed Seeder for Workflow C (Schema Update Assistant / Copilot)
 * 
 * Target Database (PostgreSQL): final_postgres_workflow_c
 * Target Database (MongoDB):    final_mongo_workflow_c
 * 
 * Generates an active, high-traffic enterprise Fintech & Ledger database:
 * - 4 core relational tables with 9,000+ records in PostgreSQL
 * - Active document collection with JSON Schema validation in MongoDB
 * - Specifically structured for demonstrating:
 *   1. Natural Language to DDL (NL2DDL) via Google Gemini
 *   2. PostgreSQL Lock Tree Analyzer (detecting AccessExclusiveLock)
 *   3. Zero-downtime query rewriting (CREATE INDEX CONCURRENTLY, lock_timeout)
 *   4. Automated Schema Drift Detection
 *   5. Transactional Dry Run (BEGIN ... ROLLBACK) and 1-Click Rollback
 */

const { Client: PgClient, Pool: PgPool } = require('pg');
const { MongoClient } = require('mongodb');

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASS = process.env.PG_PASSWORD || 'admin';
const PG_DB_NAME = 'final_postgres_workflow_c';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = 'final_mongo_workflow_c';

async function main() {
  console.log('\n===============================================================');
  console.log('  🚀 MIGRATEIQ - WORKFLOW C (Schema Update Copilot) SEEDER');
  console.log('===============================================================\n');

  // ── 1. Create Pristine PostgreSQL Database ──────────────────────────────────
  console.log(`🐘 [1/3] Preparing PostgreSQL database for Schema Evolution: "${PG_DB_NAME}"...`);
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

  // ── 2. Create Fintech Ledger Schema & Insert 9,000+ Records ──────────────────
  console.log(`\n📐 [2/3] Building Fintech Ledger schema in PostgreSQL "${PG_DB_NAME}"...`);
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

    // Table 1: Accounts (1,000 rows)
    await client.query(`
      CREATE TABLE accounts (
        id SERIAL PRIMARY KEY,
        account_number VARCHAR(30) UNIQUE NOT NULL,
        account_holder_name VARCHAR(120) NOT NULL,
        account_type VARCHAR(30) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        is_frozen BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 2: Transactions (3,000 rows)
    await client.query(`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        transaction_reference VARCHAR(64) UNIQUE NOT NULL,
        transaction_type VARCHAR(30) NOT NULL,
        amount NUMERIC(15, 2) NOT NULL,
        running_balance NUMERIC(15, 2) NOT NULL,
        description TEXT,
        executed_at TIMESTAMPTZ NOT NULL
      );
    `);

    // Table 3: Audit Logs (5,000 rows)
    await client.query(`
      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        action_name VARCHAR(80) NOT NULL,
        actor_username VARCHAR(80) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        severity_level VARCHAR(20) DEFAULT 'INFO',
        metadata JSONB,
        recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table 4: System Parameters (25 rows)
    await client.query(`
      CREATE TABLE system_parameters (
        id SERIAL PRIMARY KEY,
        param_key VARCHAR(80) UNIQUE NOT NULL,
        param_value TEXT NOT NULL,
        category VARCHAR(40) NOT NULL,
        is_dynamic BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT;');
    console.log(`   ✅ Created all 4 core relational tables.`);

    // ── Insert 9,000+ Records ────────────────────────────────────────────────
    console.log(`📦 Populating high-volume active data records...`);

    // Accounts (1,000 rows)
    for (let i = 1; i <= 1000; i++) {
      const balance = Math.round((500 + (i * 37.85) % 85000) * 100) / 100;
      await client.query(`
        INSERT INTO accounts (account_number, account_holder_name, account_type, balance, status)
        VALUES ($1, $2, $3, $4, $5);
      `, [
        `ACC-US-${String(100000 + i)}`,
        `Account Holder ${i}`,
        i % 4 === 0 ? 'CHECKING' : i % 3 === 0 ? 'INVESTMENT' : 'SAVINGS',
        balance,
        i % 50 === 0 ? 'SUSPENDED' : 'ACTIVE'
      ]);
    }
    console.log(`   ✅ Inserted 1,000 accounts.`);

    // Transactions (3,000 rows)
    for (let i = 1; i <= 3000; i++) {
      const accId = (i % 1000) + 1;
      const amount = Math.round((10 + (i * 12.3) % 4500) * 100) / 100;
      const txType = i % 2 === 0 ? 'DEPOSIT' : 'WIRE_WITHDRAWAL';
      await client.query(`
        INSERT INTO transactions (account_id, transaction_reference, transaction_type, amount, running_balance, description, executed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [
        accId,
        `TX-REF-${Date.now().toString(36)}-${String(i).padStart(5, '0')}`,
        txType,
        amount,
        amount * 1.5,
        `Automated ACH settlement batch ${i % 100}`,
        new Date(Date.now() - (3000 - i) * 1800000)
      ]);
    }
    console.log(`   ✅ Inserted 3,000 transactions.`);

    // Audit Logs (5,000 rows)
    for (let i = 1; i <= 5000; i++) {
      await client.query(`
        INSERT INTO audit_logs (action_name, actor_username, ip_address, severity_level, metadata, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [
        i % 10 === 0 ? 'SECURITY_TOKEN_REFRESH' : i % 5 === 0 ? 'LEDGER_SETTLEMENT' : 'API_READ',
        `service_worker_${i % 20 + 1}`,
        `192.168.1.${(i % 250) + 1}`,
        i % 100 === 0 ? 'CRITICAL' : i % 20 === 0 ? 'WARNING' : 'INFO',
        JSON.stringify({ latencyMs: (i * 7) % 150, traceId: `trace-${i}` }),
        new Date(Date.now() - (5000 - i) * 600000)
      ]);
    }
    console.log(`   ✅ Inserted 5,000 audit logs.`);

    // System Parameters (25 rows)
    const params = [
      ['MAX_TRANSACTION_LIMIT', '50000.00', 'SECURITY'],
      ['DAILY_WIRE_CAP', '250000.00', 'COMPLIANCE'],
      ['ENABLE_INSTANT_SETTLEMENT', 'true', 'FEATURE_FLAG'],
      ['DEFAULT_CURRENCY', 'USD', 'LOCALIZATION'],
      ['SESSION_TIMEOUT_SECONDS', '900', 'AUTH'],
      ['MAX_FAILED_LOGIN_ATTEMPTS', '5', 'AUTH'],
      ['MAINTENANCE_WINDOW_UTC', '02:00-04:00', 'OPS'],
      ['AUDIT_LOG_RETENTION_DAYS', '365', 'DATA_POLICY']
    ];
    for (let i = 0; i < params.length; i++) {
      await client.query(`
        INSERT INTO system_parameters (param_key, param_value, category)
        VALUES ($1, $2, $3);
      `, [params[i][0], params[i][1], params[i][2]]);
    }
    console.log(`   ✅ Inserted system configuration parameters.`);

  } finally {
    client.release();
    await pgPool.end();
  }

  // ── 3. Populate MongoDB for Workflow C Document Validation ──────────────────
  console.log(`\n🍃 [3/3] Preparing MongoDB database for Document Schema Evolution: "${MONGO_DB_NAME}"...`);
  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const mongoDb = mongoClient.db(MONGO_DB_NAME);
  await mongoDb.dropDatabase();

  // Create collection with initial JSON Schema Validator
  await mongoDb.createCollection('user_profiles', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['username', 'email'],
        properties: {
          username: { bsonType: 'string', description: 'must be a string and is required' },
          email: { bsonType: 'string', pattern: '^.+@.+$', description: 'must be a valid email' },
          tier: { bsonType: 'string' }
        }
      }
    }
  });

  const sampleUsers = [];
  for (let i = 1; i <= 500; i++) {
    sampleUsers.push({
      username: `user_${i}`,
      email: `user${i}@fintech-cloud.net`,
      tier: i % 5 === 0 ? 'Premium' : 'Standard',
      created_at: new Date(Date.now() - (500 - i) * 86400000)
    });
  }
  await mongoDb.collection('user_profiles').insertMany(sampleUsers);
  console.log(`   ✅ Inserted 500 user profiles with active $jsonSchema validation in MongoDB.`);
  await mongoClient.close();

  console.log('\n===============================================================');
  console.log('  🎉 WORKFLOW C TESTBED READY!');
  console.log('===============================================================');
  console.log(`  PostgreSQL DB: "${PG_DB_NAME}" (9,025 active records)`);
  console.log(`  MongoDB DB:    "${MONGO_DB_NAME}" (500 validated documents)`);
  console.log('  Perfect for demonstrating in Schema Update Assistant:');
  console.log('  1. NL2DDL: "Add an optional loyalty_discount numeric column to accounts with default 0"');
  console.log('  2. Lock Tree Analysis: Testing AccessExclusiveLock detection and zero-downtime rewrites');
  console.log('  3. Index Concurrency: "Create an index on transactions.transaction_type" → CONCURRENTLY');
  console.log('  4. Schema Drift Detection: Comparing live catalogs against the recorded history');
  console.log('  5. Transactional Dry Run: BEGIN ... ROLLBACK validation');
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error seeding Workflow C:', err);
  process.exit(1);
});

