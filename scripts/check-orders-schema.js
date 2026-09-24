const { Client } = require('pg');
async function run() {
  const client = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'admin', database: 'phase9_part1' });
  await client.connect();
  const cols = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'orders'");
  console.log('Columns of orders table:');
  console.table(cols.rows);
  await client.end();
}
run();
