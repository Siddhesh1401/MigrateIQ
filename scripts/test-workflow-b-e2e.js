const path = require('path');
const { Pool: PgPool } = require('pg');
const { MongoClient } = require('mongodb');

async function testWorkflowBE2E() {
  const distEnginePath = path.join(__dirname, '../apps/desktop/dist-electron/engine');
  const { generateMappingByRules } = require(path.join(distEnginePath, 'ruleEngine.js'));
  const { executeReverseMigration } = require(path.join(distEnginePath, 'reverseEtlEngine.js'));
  const { runReconciliationAudit } = require(path.join(distEnginePath, 'verificationEngine.js'));

  const pgConfig = {
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'admin',
    database: 'workflow_b_pg'
  };

  const mongoConfig = {
    type: 'mongodb',
    connectionString: 'mongodb://localhost:27017/workflow_b_mongo',
    database: 'workflow_b_mongo'
  };

  console.log('1. Introspecting PostgreSQL source tables and foreign keys...');
  const pool = new PgPool(pgConfig);
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const fkRes = await pool.query(`
    SELECT
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS target_table,
      ccu.column_name AS target_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public';
  `);

  const fkMap = new Map();
  for (const fk of fkRes.rows) {
    fkMap.set(`${fk.source_table}.${fk.source_column}`, `${fk.target_table}.${fk.target_column}`);
  }

  const sourceSchema = [];
  for (const row of tablesRes.rows) {
    const tName = row.table_name;
    const colsRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tName]);

    const fields = colsRes.rows.map(col => {
      const fk = fkMap.get(`${tName}.${col.column_name}`);
      return {
        name: col.column_name,
        path: col.column_name,
        bsonType: 'string',
        sqlType: col.data_type,
        isNullable: col.is_nullable === 'YES',
        isArray: false,
        foreignKeyToParent: fk
      };
    });

    sourceSchema.push({
      collectionName: tName,
      documentCount: 100,
      fields
    });
  }
  await pool.end();

  console.log('2. Generating mapping using Rule Engine (direction: postgres-to-mongo)...');
  const mappings = generateMappingByRules(sourceSchema, 'postgres-to-mongo');
  console.log('\nGenerated Mappings:');
  for (const m of mappings) {
    if (m.isEmbeddedChild) {
      console.log(`  📦 [EMBEDDED CHILD] ${m.collectionName} -> embedded in ${m.parentTable}.${m.embeddedFieldName}[]`);
    } else {
      console.log(`  📁 [ROOT COLLECTION] ${m.collectionName} -> target collection: ${m.targetTableName}`);
    }
  }

  console.log('\n3. Resetting MongoDB target database...');
  const mClient = new MongoClient('mongodb://localhost:27017');
  await mClient.connect();
  await mClient.db('workflow_b_mongo').dropDatabase();
  await mClient.close();

  console.log('4. Executing Reverse ETL Migration...');
  const res = await executeReverseMigration({
    sourceConfig: pgConfig,
    targetConfig: mongoConfig,
    mappings,
    batchSize: 500
  });

  console.log(`   ✓ Migration finished! Success: ${res.success}, Total root docs migrated: ${res.migratedRows}`);
  console.log('   Table Results:');
  console.table(res.tableResults.map(t => ({ table: t.tableName, total: t.totalRows, done: t.rowsCompleted, status: t.status })));

  console.log('\n5. Running Data Parity & Reconciliation Audit (Step 8)...');
  const auditRes = await runReconciliationAudit(pgConfig, mongoConfig, mappings);
  console.log(`   Readiness Score: ${auditRes.readinessScore}/100 (${auditRes.scorecard.status})`);
  console.log('   Breakdown:', JSON.stringify(auditRes.scorecard.breakdown, null, 2));
  console.log('   Aggregates:', JSON.stringify(auditRes.aggregates, null, 2));
  console.log('   Orphans:', JSON.stringify(auditRes.orphans, null, 2));
  console.log('   Volumetric Parity Table:');
  console.table(auditRes.tables.map(t => ({ table: t.tableName, type: t.sourceType, source: t.sourceCount, target: t.targetCount, delta: t.delta, match: t.isMatch })));

  const allMatched = auditRes.tables.every(t => t.isMatch);
  console.log('\n🎉 ALL TABLES BIT-PERFECT MATCH:', allMatched);
  if (!allMatched) {
    process.exit(1);
  }
}

testWorkflowBE2E().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
