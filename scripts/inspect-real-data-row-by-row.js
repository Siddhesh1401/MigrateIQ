const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');

async function test() {
  const mClient = new MongoClient('mongodb://localhost:27017/phase9b_source_mongo');
  await mClient.connect();
  const mDb = mClient.db();
  
  const pClient = new PgClient({ connectionString: 'postgresql://postgres:admin@localhost:5432/phase9b_target_pg' });
  await pClient.connect();

  console.log('======================================================================');
  console.log(' RAW LIVE COMPARISON: USER #1');
  console.log('======================================================================');
  const mUser = await mDb.collection('users').findOne();
  console.log('SOURCE (MongoDB document):');
  console.log(mUser);

  const pUserRes = await pClient.query('SELECT * FROM users WHERE id = $1', [mUser._id.toString()]);
  console.log('\nTARGET (PostgreSQL row):');
  console.log(pUserRes.rows[0]);

  console.log('\n======================================================================');
  console.log(' RAW LIVE COMPARISON: PAYMENT #1');
  console.log('======================================================================');
  const mPayment = await mDb.collection('payments').findOne();
  console.log('SOURCE (MongoDB document):');
  console.log(mPayment);

  const pPaymentRes = await pClient.query('SELECT * FROM payments WHERE id = $1', [mPayment._id.toString()]);
  console.log('\nTARGET (PostgreSQL row):');
  console.log(pPaymentRes.rows[0]);

  console.log('\n======================================================================');
  console.log(' RAW LIVE COMPARISON: ORDER #1 & ITS CHILD ITEMS');
  console.log('======================================================================');
  const mOrder = await mDb.collection('orders').findOne();
  console.log('SOURCE (MongoDB document):');
  console.log(mOrder);

  const pOrderRes = await pClient.query('SELECT * FROM orders WHERE id = $1', [mOrder._id.toString()]);
  console.log('\nTARGET (PostgreSQL parent order row):');
  console.log(pOrderRes.rows[0]);

  const pItemsRes = await pClient.query('SELECT * FROM orders_items WHERE orders_id = $1 ORDER BY sort_order ASC', [mOrder._id.toString()]);
  console.log('\nTARGET (PostgreSQL child order_items rows):');
  console.log(pItemsRes.rows);

  await mClient.close();
  await pClient.end();
}

test().catch(console.error);
