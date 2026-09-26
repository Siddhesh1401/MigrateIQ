const { MongoClient } = require('mongodb');
const { generateMappingByRules } = require('../apps/desktop/dist-electron/engine/ruleEngine');
const { analyzeRisks } = require('../apps/desktop/dist-electron/engine/riskAnalyzer');

async function run() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('migrateiq_phase7_test');
  const colList = ['customers', 'catalog', 'orders', 'users', 'product_assets', 'analytics'];

  const schemas = [];

  for (const colName of colList) {
    const col = db.collection(colName);
    const docs = await col.find({}).limit(50).toArray();
    const fieldsMap = new Map();

    docs.forEach(doc => {
      Object.entries(doc).forEach(([k, v]) => {
        let bsonType = typeof v;
        let isArray = false;
        if (v === null || v === undefined) bsonType = 'null';
        else if (v._bsontype === 'ObjectId') bsonType = 'ObjectId';
        else if (v instanceof Date) bsonType = 'date';
        else if (Buffer.isBuffer(v) || (v && v._bsontype === 'Binary')) bsonType = 'binary';
        else if (Array.isArray(v)) {
          isArray = true;
          if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
            bsonType = 'arrayOfObjects';
          } else {
            bsonType = 'array';
          }
        } else if (typeof v === 'number') {
          bsonType = Number.isInteger(v) ? 'int' : 'double';
        } else if (typeof v === 'object') {
          bsonType = 'object';
        }

        if (!fieldsMap.has(k)) {
          fieldsMap.set(k, {
            name: k,
            bsonType,
            isArray,
            isNullable: false,
            sampleValues: [v],
            nestedFields: []
          });
        }
        // capture nested fields
        if (bsonType === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
          const entry = fieldsMap.get(k);
          const nMap = new Map((entry.nestedFields || []).map(f => [f.name, f]));
          Object.entries(v).forEach(([nk, nv]) => {
            if (!nMap.has(nk)) {
              nMap.set(nk, {
                name: nk,
                bsonType: typeof nv === 'number' ? (Number.isInteger(nv) ? 'int' : 'double') : typeof nv,
                isNullable: nv === null,
                isArray: Array.isArray(nv),
                sampleValues: [nv]
              });
            }
          });
          entry.nestedFields = Array.from(nMap.values());
        }
      });
    });

    schemas.push({
      collectionName: colName,
      documentCount: docs.length,
      fields: Array.from(fieldsMap.values()),
      indexes: []
    });
  }

  const ruleMappings = generateMappingByRules(schemas, 'mongodb-to-postgres');
  
  console.log('====================================================');
  console.log('🤖 LOCAL RULE ENGINE (UPGRADED 20/20) MAPPING OUTPUT:');
  console.log('====================================================');
  ruleMappings.forEach(m => {
    console.log(`\n📦 Collection: "${m.collectionName}" ➔ PostgreSQL Table: "${m.targetTableName}"`);
    console.log('----------------------------------------------------');
    m.fields.forEach(f => {
      const extra = [];
      if (f.isChildTable) extra.push(`CHILD_TABLE: ${f.childTableName}`);
      if (f.foreignKeyToParent) extra.push(`FK -> ${f.foreignKeyToParent}`);
      if (f.transformationRule) extra.push(`Rule: ${f.transformationRule}`);
      console.log(`  • ${f.sourceField.padEnd(20)} ➔ ${f.targetColumn.padEnd(24)} | ${f.targetType.padEnd(16)} | Nullable: ${String(f.isNullable).padEnd(5)} ${extra.join(' | ')}`);
    });
  });

  const riskResult = analyzeRisks({
    sourceSchema: schemas,
    mapping: ruleMappings,
    direction: 'mongodb-to-postgres'
  });

  console.log('\n====================================================');
  console.log('🛡️ PRE-MIGRATION RISK EVALUATION:');
  console.log('====================================================');
  console.log('Overall Safety Score:', riskResult.metrics.safetyScore, '/ 100');
  console.log('Critical Risks:', riskResult.risks.filter(r => r.severity === 'critical').length);
  console.log('Warnings:', riskResult.risks.filter(r => r.severity === 'warning').length);
  console.log('Info Items:', riskResult.risks.filter(r => r.severity === 'info').length);
  riskResult.risks.forEach(r => {
    console.log(`  [${r.severity.toUpperCase()}] ${r.affectedTable}.${r.affectedField || ''}: ${r.title}`);
  });

  await client.close();
}

run().catch(console.error);
