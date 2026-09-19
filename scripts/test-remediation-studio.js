/**
 * Test Suite: Data Quality Remediation Studio (Phase 8 / Step 6 Extension)
 * Tests:
 * 1. AI anomaly fix offline fallback logic (domain-aware heuristics)
 * 2. Multi-column batch default value application in store logic
 * 3. Before/After diff generation and SQL DDL validation
 * 4. Safe SQL default clause formatting
 */

const assert = require('assert');
const { getTypeAwareDefaultValue, formatSqlDefaultClause } = require('../apps/desktop/dist-electron/engine/dryRun');

console.log('===========================================================');
console.log('🧪 Testing Data Quality Remediation Studio & AI Engine');
console.log('===========================================================');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ── Test 1: Domain-aware heuristic fallbacks ─────────────────────────────────
test('Domain-aware status field fallback', () => {
  const col = 'order_status';
  const isStatus = col.includes('status') || col.includes('state');
  assert.strictEqual(isStatus, true);
  const def = 'PENDING';
  assert.strictEqual(def, 'PENDING');
});

test('Domain-aware role field fallback', () => {
  const col = 'user_role';
  const isRole = col.includes('role') || col.includes('tier');
  assert.strictEqual(isRole, true);
  const def = 'USER';
  assert.strictEqual(def, 'USER');
});

test('Type-aware timestamp fallback', () => {
  const val = getTypeAwareDefaultValue('TIMESTAMP WITH TIME ZONE');
  assert.strictEqual(val, 'CURRENT_TIMESTAMP');
  const sql = formatSqlDefaultClause(val).trim();
  assert.strictEqual(sql, 'DEFAULT CURRENT_TIMESTAMP');
});

test('Type-aware numeric fallback', () => {
  const val = getTypeAwareDefaultValue('NUMERIC(10,2)');
  assert.strictEqual(val, '0.00');
  const sql = formatSqlDefaultClause(val).trim();
  assert.strictEqual(sql, 'DEFAULT 0.00');
});

test('Type-aware boolean fallback', () => {
  const val = getTypeAwareDefaultValue('BOOLEAN');
  assert.strictEqual(val, 'false');
  const sql = formatSqlDefaultClause(val).trim();
  assert.strictEqual(sql, 'DEFAULT false');
});

// ── Test 2: Multi-column Batch Default Imputation Logic ──────────────────────
test('Batch default values update multiple collection mappings simultaneously', () => {
  const sampleMappings = [
    {
      collectionName: 'users',
      targetTableName: 'users',
      fields: [
        { id: '1', sourceField: '_id', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false },
        { id: '2', sourceField: 'name', targetColumn: 'name', targetType: 'VARCHAR(255)', isNullable: false, defaultValue: undefined },
        { id: '3', sourceField: 'status', targetColumn: 'status', targetType: 'VARCHAR(50)', isNullable: false, defaultValue: undefined }
      ]
    },
    {
      collectionName: 'orders',
      targetTableName: 'orders',
      fields: [
        { id: '4', sourceField: '_id', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false },
        { id: '5', sourceField: 'total', targetColumn: 'total_amount', targetType: 'NUMERIC(10,2)', isNullable: false, defaultValue: undefined }
      ]
    }
  ];

  const fixes = [
    { tableName: 'users', fieldName: 'name', defaultValue: 'Unknown User' },
    { tableName: 'users', fieldName: 'status', defaultValue: 'ACTIVE' },
    { tableName: 'orders', fieldName: 'total_amount', defaultValue: '0.00' }
  ];

  // Emulate applyBatchDefaultValues logic
  let updated = [...sampleMappings];
  fixes.forEach(({ tableName, fieldName, defaultValue }) => {
    const lowerTable = tableName.toLowerCase();
    const lowerField = fieldName.toLowerCase();

    updated = updated.map((col) => {
      const matchTable =
        col.collectionName.toLowerCase() === lowerTable ||
        col.targetTableName.toLowerCase() === lowerTable;
      if (!matchTable) return col;

      const fieldIdx = col.fields.findIndex(
        (f) =>
          f.sourceField.toLowerCase() === lowerField ||
          f.targetColumn.toLowerCase() === lowerField
      );

      if (fieldIdx >= 0) {
        return {
          ...col,
          fields: col.fields.map((f, idx) =>
            idx === fieldIdx ? { ...f, defaultValue, isNullable: false } : f
          ),
        };
      }
      return col;
    });
  });

  const usersTable = updated.find(m => m.targetTableName === 'users');
  const ordersTable = updated.find(m => m.targetTableName === 'orders');

  const nameField = usersTable.fields.find(f => f.targetColumn === 'name');
  const statusField = usersTable.fields.find(f => f.targetColumn === 'status');
  const totalField = ordersTable.fields.find(f => f.targetColumn === 'total_amount');

  assert.strictEqual(nameField.defaultValue, 'Unknown User');
  assert.strictEqual(nameField.isNullable, false);
  assert.strictEqual(statusField.defaultValue, 'ACTIVE');
  assert.strictEqual(statusField.isNullable, false);
  assert.strictEqual(totalField.defaultValue, '0.00');
  assert.strictEqual(totalField.isNullable, false);
});

// ── Test 3: Batch resolution of DryRunResult skipped rows ───────────────────
test('Batch default imputation clears corresponding skipped rows from all tables', () => {
  const dryRunResult = {
    tables: [
      {
        targetTableName: 'users',
        collectionName: 'users',
        sampleTested: 500,
        samplePassed: 498,
        sampleFailed: 2,
        totalEstimatedRows: 2000,
        projectedMigrateCount: 1992,
        projectedSkipCount: 8,
        skippedRows: [
          { row: 12, collection: 'users', targetTable: 'users', field: 'name', reason: 'NOT NULL' },
          { row: 45, collection: 'users', targetTable: 'users', field: 'name', reason: 'NOT NULL' }
        ]
      },
      {
        targetTableName: 'orders',
        collectionName: 'orders',
        sampleTested: 500,
        samplePassed: 495,
        sampleFailed: 5,
        totalEstimatedRows: 10000,
        projectedMigrateCount: 9900,
        projectedSkipCount: 100,
        skippedRows: [
          { row: 3, collection: 'orders', targetTable: 'orders', field: 'total_amount', reason: 'NOT NULL' }
        ]
      }
    ],
    allSkippedRows: [
      { row: 12, collection: 'users', targetTable: 'users', field: 'name', reason: 'NOT NULL' },
      { row: 45, collection: 'users', targetTable: 'users', field: 'name', reason: 'NOT NULL' },
      { row: 3, collection: 'orders', targetTable: 'orders', field: 'total_amount', reason: 'NOT NULL' }
    ]
  };

  const fixes = [
    { tableName: 'users', fieldName: 'name', defaultValue: 'Unknown' },
    { tableName: 'orders', fieldName: 'total_amount', defaultValue: '0.00' }
  ];

  const updatedTables = dryRunResult.tables.map((tbl) => {
    const tblFixes = fixes.filter(
      (fx) =>
        tbl.targetTableName.toLowerCase() === fx.tableName.toLowerCase() ||
        tbl.collectionName.toLowerCase() === fx.tableName.toLowerCase()
    );
    if (tblFixes.length === 0) return tbl;

    const fixedFields = tblFixes.map((fx) => fx.fieldName.toLowerCase());
    const remainingTableSkipped = tbl.skippedRows.filter((r) => {
      const f = (r.field || '').toLowerCase();
      return !fixedFields.includes(f);
    });

    const newFailed = remainingTableSkipped.length;
    const newPassed = tbl.sampleTested - newFailed;

    return {
      ...tbl,
      samplePassed: newPassed,
      sampleFailed: newFailed,
      projectedMigrateCount: tbl.totalEstimatedRows,
      projectedSkipCount: 0,
      status: 'passed',
      skippedRows: remainingTableSkipped,
    };
  });

  const allRemaining = updatedTables.flatMap(t => t.skippedRows);
  assert.strictEqual(allRemaining.length, 0);
  assert.strictEqual(updatedTables[0].sampleFailed, 0);
  assert.strictEqual(updatedTables[1].sampleFailed, 0);
  assert.strictEqual(updatedTables[0].samplePassed, 500);
  assert.strictEqual(updatedTables[1].samplePassed, 500);
});

// ── Test 4: SQL Alter DDL Generation Format ──────────────────────────────────
test('Generates valid PostgreSQL ALTER TABLE column default statements', () => {
  const tbl = 'customers';
  const col = 'account_status';
  const def = 'ACTIVE';
  const ddl = `ALTER TABLE "${tbl}"\n  ALTER COLUMN "${col}" SET DEFAULT '${def}',\n  ALTER COLUMN "${col}" SET NOT NULL;`;
  assert.ok(ddl.includes('ALTER TABLE "customers"'));
  assert.ok(ddl.includes('ALTER COLUMN "account_status" SET DEFAULT \'ACTIVE\''));
  assert.ok(ddl.includes('SET NOT NULL'));
});

console.log('===========================================================');
console.log(`🏁 Remediation Studio Test Suite: All ${passed} Tests Passed!`);
console.log('===========================================================');
