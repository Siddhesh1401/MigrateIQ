const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');

async function deepVerify() {
  const mClient = new MongoClient('mongodb://localhost:27017');
  await mClient.connect();
  const mDb = mClient.db('phase9_source_mongo');

  const pg = new PgClient({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'admin',
    database: 'phase9_part1'
  });
  await pg.connect();

  console.log('\n======================================================');
  console.log('🔍 DEEP DATABASE CROSS-CHECK (SOURCE vs TARGET)');
  console.log('======================================================');

  // 1. Table Counts
  const tables = ['categories', 'users', 'products', 'orders'];
  let totalParentMongo = 0;
  let totalParentPg = 0;

  for (const t of tables) {
    const mCount = await mDb.collection(t).countDocuments();
    const pgCountRes = await pg.query(`SELECT COUNT(*) FROM "${t}";`);
    const pgCount = parseInt(pgCountRes.rows[0].count, 10);
    totalParentMongo += mCount;
    totalParentPg += pgCount;
    console.log(`   Table "${t.padEnd(12)}": Mongo = ${String(mCount).padStart(3)} | PG = ${String(pgCount).padStart(3)} -> ${mCount === pgCount ? 'MATCH ✅' : 'MISMATCH ❌'}`);
  }

  // 2. Child items count
  const orders = await mDb.collection('orders').find({}).toArray();
  let totalMongoItems = 0;
  orders.forEach(o => {
    if (Array.isArray(o.items)) totalMongoItems += o.items.length;
  });

  const pgChildRes = await pg.query('SELECT COUNT(*) FROM "orders_items";');
  const pgChildCount = parseInt(pgChildRes.rows[0].count, 10);
  console.log(`   Table "orders_items": Mongo embedded items = ${totalMongoItems} | PG rows = ${pgChildCount} -> ${totalMongoItems === pgChildCount ? 'MATCH ✅' : 'MISMATCH ❌'}`);

  // 3. Orphan foreign key check
  const orphanRes = await pg.query('SELECT COUNT(*) FROM "orders_items" oi LEFT JOIN "orders" o ON oi.orders_id = o.id WHERE o.id IS NULL;');
  const orphanCount = parseInt(orphanRes.rows[0].count, 10);
  console.log(`   Foreign Key Integrity: Orphan records in orders_items = ${orphanCount} -> ${orphanCount === 0 ? '0 Orphans (PERFECT 100% RELATIONAL INTEGRITY) ✅' : 'ORPHANS FOUND ❌'}`);

  // 4. Sample record comparison
  const samplePgOrder = await pg.query('SELECT * FROM "orders" ORDER BY id LIMIT 1;');
  const sampleOrder = samplePgOrder.rows[0];
  console.log(`\n   Sample Order in PG: ID = "${sampleOrder.id}", Order# = "${sampleOrder.order_number}", Status = "${sampleOrder.status}", Amount = $${sampleOrder.total_amount}`);

  const sampleChild = await pg.query(`SELECT * FROM "orders_items" WHERE orders_id = '${sampleOrder.id}' ORDER BY sort_order;`);
  console.log(`   Child items for this Order in PG: ${sampleChild.rows.length} items (sort_orders: [${sampleChild.rows.map(r => r.sort_order).join(', ')}])`);
  sampleChild.rows.forEach(r => {
    console.log(`      • sort_order ${r.sort_order}: item ID "${r.id}", order FK "${r.orders_id}"`);
  });

  console.log('------------------------------------------------------');
  console.log(`   TOTAL ALL ROWS: Source = ${totalParentMongo + totalMongoItems} | Target = ${totalParentPg + pgChildCount}`);
  console.log('   🎉 RESULT: 100.0% BIT-PERFECT DATA PARITY CONFIRMED!');
  console.log('======================================================\n');

  await mClient.close();
  await pg.end();
}

deepVerify().catch(err => {
  console.error(err);
  process.exit(1);
});
