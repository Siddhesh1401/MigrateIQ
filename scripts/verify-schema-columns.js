const { Client } = require('pg');

async function checkSchema() {
  const pg = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'admin', database: 'phase9part3' });
  await pg.connect();

  const tablesRes = await pg.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('Total Tables in PostgreSQL:', tablesRes.rows.length);
  for (const t of tablesRes.rows) {
    const colRes = await pg.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t.table_name]);

    const pkRes = await pg.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1;
    `, [t.table_name]);

    const pks = pkRes.rows.map(r => r.column_name).join(', ') || 'NONE';
    console.log(`  - ${t.table_name.padEnd(32)}: ${colRes.rows.length} cols | PK: [${pks}]`);
  }

  await pg.end();
}

checkSchema();
