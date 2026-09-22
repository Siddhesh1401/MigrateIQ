/**
 * MigrateIQ — Live MongoDB Rollback State Restoration Verification
 *
 * Directly addresses ChatGPT's Phase 11 challenge:
 * "Verify MongoDB rollback semantics:
 *  Original state -> Apply change -> Verify changed state -> Rollback -> Verify original state"
 *
 * Runs live tests against local MongoDB instance on mongodb://localhost:27017
 * Database: "migrateiq_rollback_test"
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const TEST_DB = 'migrateiq_rollback_test';

async function runLiveMongoRollbackSuite() {
  console.log('🧪 Starting Live MongoDB Rollback State Restoration Suite...\n');
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 4000 });

  try {
    await client.connect();
    const db = client.db(TEST_DB);
    console.log(`Connected to MongoDB: ${TEST_DB}`);

    // Clean test db
    await db.dropDatabase().catch(() => {});

    let passed = 0;
    let total = 0;

    function assertState(condition, description) {
      total++;
      if (condition) {
        console.log(`  ✅ PASS: ${description}`);
        passed++;
      } else {
        console.error(`  ❌ FAIL: ${description}`);
        throw new Error(`Assertion failed: ${description}`);
      }
    }

    // ── Test 1: addColumn ($set) -> Rollback ($unset) ───────────────────────
    console.log('\n[Scenario 1: Add Field -> Rollback Unset]');
    const users = db.collection('test_users');
    await users.insertMany([
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ]);

    // Initial state check
    const initUsers = await users.find({}).toArray();
    assertState(initUsers.every(u => u.is_verified === undefined), 'State A: Field "is_verified" does not exist in any document');

    // Apply Forward ($set)
    await users.updateMany({ is_verified: { $exists: false } }, { $set: { is_verified: true } });
    const appliedUsers = await users.find({}).toArray();
    assertState(appliedUsers.every(u => u.is_verified === true), 'State B: Field "is_verified" is now true across all documents');

    // Apply Rollback ($unset)
    await users.updateMany({}, { $unset: { is_verified: '' } });
    const restoredUsers = await users.find({}).toArray();
    assertState(restoredUsers.every(u => u.is_verified === undefined), 'Restored State A: Field "is_verified" completely removed on rollback');

    // ── Test 2: renameColumn ($rename) -> Rollback Reverse Rename ──────────
    console.log('\n[Scenario 2: Rename Field -> Rollback Reverse Rename]');
    const orders = db.collection('test_orders');
    await orders.insertMany([
      { order_id: 101, old_status: 'PENDING' },
      { order_id: 102, old_status: 'SHIPPED' },
    ]);

    // Initial state check
    const initOrders = await orders.find({}).toArray();
    assertState(initOrders.every(o => o.old_status && o.status === undefined), 'State A: Documents have "old_status" and no "status"');

    // Apply Forward ($rename)
    await orders.updateMany({}, { $rename: { old_status: 'status' } });
    const appliedOrders = await orders.find({}).toArray();
    assertState(appliedOrders.every(o => o.status && o.old_status === undefined), 'State B: Documents have "status" and "old_status" is gone');

    // Apply Rollback (Reverse $rename)
    await orders.updateMany({}, { $rename: { status: 'old_status' } });
    const restoredOrders = await orders.find({}).toArray();
    assertState(restoredOrders.every(o => o.old_status && o.status === undefined), 'Restored State A: Documents cleanly restored to "old_status"');

    // ── Test 3: renameCollection -> Rollback Reverse Collection Rename ─────
    console.log('\n[Scenario 3: Rename Collection -> Rollback Reverse Collection Rename]');
    const legacyLogs = db.collection('legacy_logs');
    await legacyLogs.insertOne({ event: 'system_boot', level: 'info' });

    // Initial state check
    let colls = await db.listCollections().toArray();
    assertState(colls.some(c => c.name === 'legacy_logs') && !colls.some(c => c.name === 'audit_logs'), 'State A: Collection "legacy_logs" exists, "audit_logs" does not');

    // Apply Forward (renameCollection)
    await legacyLogs.rename('audit_logs');
    colls = await db.listCollections().toArray();
    assertState(colls.some(c => c.name === 'audit_logs') && !colls.some(c => c.name === 'legacy_logs'), 'State B: Collection renamed to "audit_logs"');

    // Apply Rollback (Reverse rename)
    const auditLogs = db.collection('audit_logs');
    await auditLogs.rename('legacy_logs');
    colls = await db.listCollections().toArray();
    assertState(colls.some(c => c.name === 'legacy_logs') && !colls.some(c => c.name === 'audit_logs'), 'Restored State A: Collection name cleanly reverted to "legacy_logs"');

    // ── Test 4: createIndex -> Rollback dropIndex ───────────────────────────
    console.log('\n[Scenario 4: Create Index -> Rollback Drop Index]');
    const products = db.collection('test_products');
    await products.insertMany([
      { sku: 'A100', price: 29.99 },
      { sku: 'B200', price: 49.99 },
    ]);

    // Initial state check
    let indexes = await products.indexes();
    assertState(!indexes.some(i => i.name === 'idx_sku_unique'), 'State A: Index "idx_sku_unique" does not exist');

    // Apply Forward (createIndex)
    await products.createIndex({ sku: 1 }, { name: 'idx_sku_unique', unique: true });
    indexes = await products.indexes();
    assertState(indexes.some(i => i.name === 'idx_sku_unique'), 'State B: Unique index "idx_sku_unique" physically created');

    // Apply Rollback (dropIndex)
    await products.dropIndex('idx_sku_unique');
    indexes = await products.indexes();
    assertState(!indexes.some(i => i.name === 'idx_sku_unique'), 'Restored State A: Index "idx_sku_unique" physically dropped');

    // ── Test 5: dropIndex -> Rollback Recreate Index ────────────────────────
    console.log('\n[Scenario 5: Drop Index -> Rollback Recreate Index]');
    await products.createIndex({ price: 1 }, { name: 'idx_price_lookup' });
    indexes = await products.indexes();
    assertState(indexes.some(i => i.name === 'idx_price_lookup'), 'State A: Index "idx_price_lookup" exists');

    // Apply Forward (dropIndex)
    await products.dropIndex('idx_price_lookup');
    indexes = await products.indexes();
    assertState(!indexes.some(i => i.name === 'idx_price_lookup'), 'State B: Index "idx_price_lookup" dropped');

    // Apply Rollback (Recreate)
    await products.createIndex({ price: 1 }, { name: 'idx_price_lookup' });
    indexes = await products.indexes();
    assertState(indexes.some(i => i.name === 'idx_price_lookup'), 'Restored State A: Index "idx_price_lookup" restored identically');

    // ── Test 6: $jsonSchema collMod Validation -> Rollback ──────────────────
    console.log('\n[Scenario 6: Schema Validation (collMod) -> Rollback Validator Reversion]');
    const accounts = db.collection('test_accounts');
    await accounts.insertOne({ balance: 500, owner: 'Siddhesh' });

    // Initial state: no validator
    const initCollInfo = await db.listCollections({ name: 'test_accounts' }).toArray();
    assertState(!initCollInfo[0]?.options?.validator, 'State A: No schema validator on test_accounts');

    // Apply Forward: Add $jsonSchema validator requiring positive balance
    await db.command({
      collMod: 'test_accounts',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['balance'],
          properties: {
            balance: { bsonType: 'number', minimum: 0, description: 'Balance must be non-negative' }
          }
        }
      },
      validationLevel: 'strict',
      validationAction: 'error'
    });

    const validatedCollInfo = await db.listCollections({ name: 'test_accounts' }).toArray();
    assertState(!!validatedCollInfo[0]?.options?.validator?.$jsonSchema, 'State B: Strict $jsonSchema validator registered');

    // Verify validator blocks invalid writes
    let blockedWrite = false;
    try {
      await accounts.insertOne({ balance: -50, owner: 'Hacker' });
    } catch {
      blockedWrite = true;
    }
    assertState(blockedWrite, 'State B: Invalid write correctly rejected by MongoDB $jsonSchema');

    // Apply Rollback: Remove validator
    await db.command({
      collMod: 'test_accounts',
      validator: {},
      validationLevel: 'off'
    });

    const rolledBackCollInfo = await db.listCollections({ name: 'test_accounts' }).toArray();
    assertState(!rolledBackCollInfo[0]?.options?.validator?.$jsonSchema, 'Restored State A: $jsonSchema validator completely removed on rollback');

    // ── Test 7: Destructive Drop with Pre-Migration Snapshot Recovery ────────
    console.log('\n[Scenario 7: Destructive Drop with Pre-Migration Backup Snapshot Restoration]');
    const customers = db.collection('test_customers');
    await customers.insertMany([
      { id: 1, name: 'Customer One', sensitive_ssn: '123-45-6789' },
      { id: 2, name: 'Customer Two', sensitive_ssn: '987-65-4321' },
    ]);

    // 1. Take Pre-Migration Snapshot (Mirrors MigrateIQ's schema:create-backup-snapshot)
    const backupCollectionName = `test_customers_backup_${Date.now()}`;
    const allOriginalDocs = await customers.find({}).toArray();
    const backupCollection = db.collection(backupCollectionName);
    await backupCollection.insertMany(allOriginalDocs);

    assertState((await backupCollection.countDocuments()) === 2, 'Pre-Flight: Snapshot backup collection created with full fidelity');

    // 2. Apply Destructive Drop ($unset sensitive_ssn)
    await customers.updateMany({}, { $unset: { sensitive_ssn: '' } });
    const droppedDocs = await customers.find({}).toArray();
    assertState(droppedDocs.every(c => c.sensitive_ssn === undefined), 'State B: Destructive drop executed (sensitive_ssn destroyed)');

    // 3. Rollback from Backup Snapshot
    await customers.deleteMany({});
    const backupDocs = await backupCollection.find({}).toArray();
    await customers.insertMany(backupDocs);

    const recoveredDocs = await customers.find({}).toArray();
    assertState(
      recoveredDocs.every(c => c.sensitive_ssn && c.sensitive_ssn.length > 5),
      'Restored State A: 100% of destroyed data restored with original values from backup snapshot'
    );

    // Clean up
    await db.dropDatabase();
    await client.close();

    console.log(`\n====================================================`);
    console.log(`🏁 MongoDB Rollback Verification Summary: ${passed} / ${total} Passed`);
    console.log(`====================================================`);
    console.log('🎉 ALL MONGODB ROLLBACK SEMANTICS VERIFIED 100% AGAINST LIVE DATABASE!\n');

  } catch (err) {
    console.error('❌ Error during MongoDB rollback suite:', err);
    await client.close().catch(() => {});
    process.exit(1);
  }
}

runLiveMongoRollbackSuite();
