/**
 * MigrateIQ - Discrepancy Simulation Script
 * Modifies 1 payment row in PostgreSQL to trigger financial drift and activate
 * the Discrepancy Remediation Shield in Step 8.
 */

const { Client: PgClient } = require('pg');

async function simulate() {
  const pClient = new PgClient({ connectionString: 'postgresql://postgres:admin@localhost:5432/phase9b_target_pg' });
  await pClient.connect();

  console.log('Simulating data discrepancy on PostgreSQL table "payments"...');
  
  // Update 1 payment from $77.85 to $999.00
  await pClient.query(`
    UPDATE payments 
    SET amount = 999.00 
    WHERE id = '6aba7ff9d401bf99e1aef171';
  `);

  console.log('✅ Successfully modified payment row "6aba7ff9d401bf99e1aef171" to amount: $999.00');
  console.log('Financial sum now has a ~2.8% drift against MongoDB ($32,778.75).');

  await pClient.end();
}

simulate().catch(console.error);
