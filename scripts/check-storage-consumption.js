const { MongoClient } = require('mongodb');
const { Client } = require('pg');

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0.00 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB (${mb.toFixed(2)} MB)`;
  }
  return `${mb.toFixed(2)} MB`;
}

async function inspectMongo() {
  console.log('='.repeat(70));
  console.log('🍃 CONNECTING TO MONGODB (mongodb://localhost:27017)...');
  console.log('='.repeat(70));

  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const adminDb = client.db().admin();
    const dbsList = await adminDb.listDatabases();
    
    let totalMongoStorage = 0;
    let totalMongoData = 0;
    let totalMongoIndex = 0;
    let totalMongoDocs = 0;

    const dbDetails = [];

    for (const dbInfo of dbsList.databases) {
      const db = client.db(dbInfo.name);
      try {
        const stats = await db.stats();
        const storageSize = stats.storageSize || dbInfo.sizeOnDisk || 0;
        const dataSize = stats.dataSize || 0;
        const indexSize = stats.indexSize || 0;
        const objects = stats.objects || 0;

        totalMongoStorage += storageSize;
        totalMongoData += dataSize;
        totalMongoIndex += indexSize;
        totalMongoDocs += objects;

        dbDetails.push({
          name: dbInfo.name,
          objects,
          dataSize,
          storageSize,
          indexSize,
          totalOnDisk: storageSize + indexSize
        });
      } catch (err) {
        dbDetails.push({
          name: dbInfo.name,
          objects: 'N/A',
          dataSize: 0,
          storageSize: dbInfo.sizeOnDisk || 0,
          indexSize: 0,
          totalOnDisk: dbInfo.sizeOnDisk || 0
        });
        totalMongoStorage += (dbInfo.sizeOnDisk || 0);
      }
    }

    console.log('\n📊 MONGODB DATABASE-BY-DATABASE BREAKDOWN:');
    console.table(dbDetails.map(d => ({
      'Database Name': d.name,
      'Documents': typeof d.objects === 'number' ? d.objects.toLocaleString() : d.objects,
      'Data Size': formatBytes(d.dataSize),
      'Storage (WiredTiger)': formatBytes(d.storageSize),
      'Index Size': formatBytes(d.indexSize),
      'Total on Disk': formatBytes(d.totalOnDisk)
    })));

    console.log(`\n👉 TOTAL MONGODB DISK USAGE:`);
    console.log(`   - Total Storage (Compressed Data): ${formatBytes(totalMongoStorage)}`);
    console.log(`   - Total Index Size:                ${formatBytes(totalMongoIndex)}`);
    console.log(`   - Total Disk Space Consumed:       ${formatBytes(totalMongoStorage + totalMongoIndex)}`);
    console.log(`   - Total Uncompressed Document Data: ${formatBytes(totalMongoData)}`);
    console.log(`   - Total Documents Across All DBs:  ${totalMongoDocs.toLocaleString()}`);

    return {
      totalDisk: totalMongoStorage + totalMongoIndex,
      dataSize: totalMongoData,
      dbDetails
    };
  } catch (err) {
    console.error('❌ Could not connect to MongoDB:', err.message);
    return null;
  } finally {
    await client.close();
  }
}

async function inspectPostgres() {
  console.log('\n' + '='.repeat(70));
  console.log('🐘 CONNECTING TO POSTGRESQL (localhost:5432)...');
  console.log('='.repeat(70));

  let client = null;
  const passwordsToTry = ['admin', 'postgres', ''];
  let connectedPassword = null;

  for (const pw of passwordsToTry) {
    try {
      const testClient = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: pw,
        database: 'postgres',
        connectionTimeoutMillis: 3000
      });
      await testClient.connect();
      client = testClient;
      connectedPassword = pw;
      break;
    } catch (e) {
      // try next
    }
  }

  if (!client) {
    console.error('❌ Could not connect to PostgreSQL with tested credentials (admin / postgres).');
    return null;
  }

  try {
    // List all databases with their exact on-disk size
    const dbsRes = await client.query(`
      SELECT 
        datname AS db_name,
        pg_database_size(datname) AS size_bytes,
        pg_size_pretty(pg_database_size(datname)) AS size_pretty
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY pg_database_size(datname) DESC;
    `);

    let totalPgDisk = 0;
    const pgDbDetails = [];

    for (const row of dbsRes.rows) {
      const bytes = parseInt(row.size_bytes, 10);
      totalPgDisk += bytes;
      pgDbDetails.push({
        'Database Name': row.db_name,
        'Raw Bytes': bytes,
        'Size on Disk': formatBytes(bytes)
      });
    }

    console.log('\n📊 POSTGRESQL DATABASE-BY-DATABASE BREAKDOWN:');
    console.table(pgDbDetails.map(d => ({
      'Database Name': d['Database Name'],
      'Size on Disk': d['Size on Disk']
    })));

    console.log(`\n👉 TOTAL POSTGRESQL DISK USAGE:`);
    console.log(`   - Total Space Consumed Across All DBs: ${formatBytes(totalPgDisk)}`);

    // Let's inspect phase9part3 in detail if it exists
    const hasPhase9Part3 = dbsRes.rows.some(r => r.db_name === 'phase9part3');
    if (hasPhase9Part3) {
      console.log('\n🔍 DRILL-DOWN: Table-by-Table Storage in "phase9part3":');
      const pClient = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: connectedPassword,
        database: 'phase9part3'
      });
      await pClient.connect();
      
      const tablesRes = await pClient.query(`
        SELECT 
          c.relname AS table_name,
          COALESCE(s.n_live_tup, 0) AS estimated_rows,
          pg_total_relation_size(c.oid) AS total_bytes,
          pg_relation_size(c.oid) AS table_bytes,
          pg_indexes_size(c.oid) AS index_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC;
      `);

      console.table(tablesRes.rows.slice(0, 15).map(t => ({
        'Table Name': t.table_name,
        'Rows': parseInt(t.estimated_rows || 0, 10).toLocaleString(),
        'Table Data': formatBytes(parseInt(t.table_bytes, 10)),
        'Index Size': formatBytes(parseInt(t.index_bytes, 10)),
        'Total on Disk': formatBytes(parseInt(t.total_bytes, 10))
      })));

      await pClient.end();
    }

    return {
      totalDisk: totalPgDisk,
      dbDetails: pgDbDetails
    };
  } catch (err) {
    console.error('❌ Error inspecting PostgreSQL:', err.message);
    return null;
  } finally {
    await client.end();
  }
}

async function main() {
  const mongoStats = await inspectMongo();
  const pgStats = await inspectPostgres();

  console.log('\n' + '='.repeat(70));
  console.log('🏆 GRAND TOTAL SYSTEM STORAGE CONSUMPTION');
  console.log('='.repeat(70));
  if (mongoStats) {
    console.log(`🍃 MongoDB Total On Disk:    ${formatBytes(mongoStats.totalDisk)}`);
  }
  if (pgStats) {
    console.log(`🐘 PostgreSQL Total On Disk: ${formatBytes(pgStats.totalDisk)}`);
  }
  if (mongoStats && pgStats) {
    const combined = mongoStats.totalDisk + pgStats.totalDisk;
    console.log(`💾 COMBINED STORAGE USED:    ${formatBytes(combined)}`);
  }
  console.log('='.repeat(70) + '\n');
}

main().catch(err => {
  console.error('Fatal inspection error:', err);
  process.exit(1);
});
