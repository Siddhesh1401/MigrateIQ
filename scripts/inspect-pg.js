const { Client } = require('pg');

async function checkPg() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' });
  try {
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Public tables in PostgreSQL postgres:', res.rows.map(r => r.table_name));
    if (res.rows.some(r => r.table_name === 'orders')) {
      const ordersCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='orders'");
      console.log('Columns in existing orders table:', ordersCols.rows);
      const ordersRows = await client.query('SELECT * FROM "orders" LIMIT 5');
      console.log('Existing rows in orders:', ordersRows.rows);
    }
  } catch (err) {
    console.log('PG Error:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

checkPg();
