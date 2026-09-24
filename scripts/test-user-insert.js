const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');

async function testInsert() {
  const m = new MongoClient('mongodb://localhost:27017');
  await m.connect();
  const doc = await m.db('phase9_source_mongo').collection('users').findOne();

  const pg = new PgClient({ host: 'localhost', port: 5432, user: 'postgres', password: 'admin', database: 'phase9_part1' });
  await pg.connect();

  // Try with array directly and 24-char id
  try {
    await pg.query(
      'INSERT INTO "users" ("id", "name", "email", "role", "age", "phone", "address_street", "address_city", "address_state", "address_zip", "tags", "is_active", "created_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
      [
        doc._id.toHexString(),
        doc.name,
        doc.email,
        doc.role,
        doc.age,
        doc.phone,
        doc.address?.street,
        doc.address?.city,
        doc.address?.state,
        doc.address?.zip,
        doc.tags,
        doc.isActive,
        doc.createdAt.toISOString()
      ]
    );
    console.log('doc.tags (Array) SUCCESS!');
  } catch (e) {
    console.error('doc.tags (Array) FAILED:', e.message);
  }

  await m.close();
  await pg.end();
}

testInsert();
