/**
 * Automatically injects the 6 Final Exam testbed connections into MigrateIQ's saved profiles.
 * This ensures that when the user opens the desktop app, all 6 connections appear in the
 * "Saved Connections" screen and connection dropdowns with zero manual typing required!
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const possibleStorePaths = [
  path.join(appData, 'MigrateIQ', 'migrateiq-data.json'),
  path.join(appData, '@migrateiq', 'desktop', 'migrateiq-data.json'),
  path.join(appData, 'migrateiq-desktop', 'migrateiq-data.json'),
  path.join(appData, 'electron', 'migrateiq-data.json')
];

const connectionsToInject = [
  {
    id: 'conn_wf_a_source_mongo',
    name: 'Workflow A — Source (MongoDB)',
    type: 'mongodb',
    config: {
      id: 'conn_wf_a_source_mongo',
      name: 'Workflow A — Source (MongoDB)',
      type: 'mongodb',
      connectionString: 'mongodb://localhost:27017/final_mongo_workflow_a',
      database: 'final_mongo_workflow_a',
      host: 'localhost',
      port: 27017
    },
    savedAt: new Date().toISOString()
  },
  {
    id: 'conn_wf_a_target_pg',
    name: 'Workflow A — Target (PostgreSQL)',
    type: 'postgresql',
    config: {
      id: 'conn_wf_a_target_pg',
      name: 'Workflow A — Target (PostgreSQL)',
      type: 'postgresql',
      connectionString: 'postgresql://postgres:admin@localhost:5432/final_postgres_workflow_a',
      database: 'final_postgres_workflow_a',
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'admin',
      schema: 'public'
    },
    savedAt: new Date().toISOString()
  },
  {
    id: 'conn_wf_b_source_pg',
    name: 'Workflow B — Source (PostgreSQL)',
    type: 'postgresql',
    config: {
      id: 'conn_wf_b_source_pg',
      name: 'Workflow B — Source (PostgreSQL)',
      type: 'postgresql',
      connectionString: 'postgresql://postgres:admin@localhost:5432/final_postgres_workflow_b',
      database: 'final_postgres_workflow_b',
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'admin',
      schema: 'public'
    },
    savedAt: new Date().toISOString()
  },
  {
    id: 'conn_wf_b_target_mongo',
    name: 'Workflow B — Target (MongoDB)',
    type: 'mongodb',
    config: {
      id: 'conn_wf_b_target_mongo',
      name: 'Workflow B — Target (MongoDB)',
      type: 'mongodb',
      connectionString: 'mongodb://localhost:27017/final_mongo_workflow_b',
      database: 'final_mongo_workflow_b',
      host: 'localhost',
      port: 27017
    },
    savedAt: new Date().toISOString()
  },
  {
    id: 'conn_wf_c_fintech_pg',
    name: 'Workflow C — Fintech Ledger (PostgreSQL)',
    type: 'postgresql',
    config: {
      id: 'conn_wf_c_fintech_pg',
      name: 'Workflow C — Fintech Ledger (PostgreSQL)',
      type: 'postgresql',
      connectionString: 'postgresql://postgres:admin@localhost:5432/final_postgres_workflow_c',
      database: 'final_postgres_workflow_c',
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'admin',
      schema: 'public'
    },
    savedAt: new Date().toISOString()
  },
  {
    id: 'conn_wf_c_profiles_mongo',
    name: 'Workflow C — User Profiles (MongoDB)',
    type: 'mongodb',
    config: {
      id: 'conn_wf_c_profiles_mongo',
      name: 'Workflow C — User Profiles (MongoDB)',
      type: 'mongodb',
      connectionString: 'mongodb://localhost:27017/final_mongo_workflow_c',
      database: 'final_mongo_workflow_c',
      host: 'localhost',
      port: 27017
    },
    savedAt: new Date().toISOString()
  }
];

function inject() {
  console.log('\n===============================================================');
  console.log('  🔌 INJECTING 6 FINAL EXAM TESTBED CONNECTIONS INTO APP');
  console.log('===============================================================\n');

  let updatedCount = 0;
  for (const storePath of possibleStorePaths) {
    try {
      const dir = path.dirname(storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let data = {};
      if (fs.existsSync(storePath)) {
        try {
          data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        } catch {
          data = {};
        }
      }

      const existingConns = Array.isArray(data.savedConnections) ? data.savedConnections : [];
      const newIds = new Set(connectionsToInject.map(c => c.id));
      const filtered = existingConns.filter(c => c && !newIds.has(c.id));

      data.savedConnections = [...filtered, ...connectionsToInject];
      fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ Injected 6 connections into: ${storePath}`);
      updatedCount++;
    } catch (err) {
      console.warn(`⚠️ Skipped ${storePath}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Successfully injected connections into ${updatedCount} app data locations.`);
  console.log('When you open the MigrateIQ desktop app, you will see all 6 connections ready in the UI!');
}

inject();

