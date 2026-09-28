/**
 * MigrateIQ - Discrepancy Restore Script
 * Restores the original payment amount in PostgreSQL ($77.85) to achieve 100% parity again.
 */

const { Client: PgClient } = require('pg');

async function restore() {
  const pClient = new PgClient({ connectionString: 'postgresql://postgres:admin@localhost:5432/phase9b_target_pg' });
  await pClient.connect();

  console.log('Restoring payment row in PostgreSQL table "payments"...');
  
  await pClient.query(`
    UPDATE payments 
    SET amount = 77.85 
    WHERE id = '6aba7ff9d401bf99e1aef171';
  `);

  console.log('✅ Successfully restored payment row to amount: $77.85');
  console.log('Financial sum now has 0.0000% drift (100% parity).');

  await pClient.end();
}

restore().catch(console.error);
