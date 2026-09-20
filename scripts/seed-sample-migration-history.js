/**
 * Seed Sample Migration History into active electron-store
 * Targets the active @migrateiq/desktop store path on Windows.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Application Support') : path.join(os.homedir(), '.config'));

// Active electron-store path used by @migrateiq/desktop
const targetFile = path.join(appData, '@migrateiq', 'desktop', 'migrateiq-data.json');

const sampleMigrations = [
  {
    id: 'mig_1726857600000',
    dateTime: '2026-09-20 14:30:22',
    direction: 'MongoDB → PostgreSQL',
    status: 'completed',
    sourceDb: 'ecommerce_prod_mongodb',
    targetDb: 'ecommerce_relational_pg',
    tablesCount: 7,
    rowsMigrated: 20650,
    duration: '1m 42s',
    reportSummary: 'All 7 collections successfully migrated to PostgreSQL tables with zero dropped rows.'
  },
  {
    id: 'mig_1726771200000',
    dateTime: '2026-09-19 11:15:05',
    direction: 'MongoDB → PostgreSQL',
    status: 'warning',
    sourceDb: 'analytics_logs_mongo',
    targetDb: 'analytics_warehouse_pg',
    tablesCount: 4,
    rowsMigrated: 8430,
    duration: '48s',
    reportSummary: 'Migration completed with 12 rows skipped due to missing required foreign keys.'
  },
  {
    id: 'mig_1726684800000',
    dateTime: '2026-09-18 09:02:18',
    direction: 'PostgreSQL → MongoDB',
    status: 'completed',
    sourceDb: 'legacy_crm_pg',
    targetDb: 'crm_document_store',
    tablesCount: 5,
    rowsMigrated: 14200,
    duration: '1m 15s',
    reportSummary: 'Reverse migration completed. Normalized tables embedded as JSON document arrays.'
  }
];

if (!fs.existsSync(path.dirname(targetFile))) {
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
}

let existingData = {};
try {
  if (fs.existsSync(targetFile)) {
    existingData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
  }
} catch (e) {
  existingData = {};
}

existingData.migrationHistory = sampleMigrations;

fs.writeFileSync(targetFile, JSON.stringify(existingData, null, '\t'), 'utf8');

console.log('✅ Successfully seeded 3 sample migrations into:');
console.log(`   ${targetFile}`);
console.log('\nNow in the MigrateIQ app, simply click "Home" again (or refresh with Ctrl+R) to see the table populated with the 3 rows!');
