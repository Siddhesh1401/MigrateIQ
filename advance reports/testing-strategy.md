# MigrateIQ — Testing & Quality Assurance Strategy

> **Purpose:** Documents exactly how MigrateIQ is tested at every layer.
> **Viva Answer:** "How did you test this?" → Point to this document.

---

## Testing Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TESTING PYRAMID                               │
│                        ▲                                         │
│                       ╱ ╲      E2E Tests (Phase 17)             │
│                      ╱   ╲     Full workflow with testbed DB     │
│                     ╱─────╲                                      │
│                    ╱       ╲   Integration Tests (Phase 16)     │
│                   ╱  Integ  ╲  6 scenarios, real DB connections  │
│                  ╱───────────╲                                   │
│                 ╱             ╲  Unit Tests (Phase 7+)           │
│                ╱     Unit      ╲ Rule Engine, Topo Sort,         │
│               ╱─────────────────╲ Risk Analyzer, ETL Transform   │
└─────────────────────────────────────────────────────────────────┘
```

**Run Commands:**
- Unit tests: `npm test` (from `apps/desktop/`)
- Smoke test: `node scripts/smoke-test.js`
- E2E: Manual checklist (Phase 17)

---

## Layer 1 — Unit Tests

**Tool:** Jest + ts-jest
**Location:** `apps/desktop/main/engine/__tests__/`
**Coverage Target:** ≥ 80% for all engine files

### Rule Engine Tests (`ruleEngine.test.ts`)

Tests all 14 BSON → PostgreSQL type mappings:

```typescript
describe('Rule Engine — Type Mapping', () => {
  test('ObjectId → VARCHAR(24)', () => {
    const r = generateMappingByRules([{ collectionName: 'test',
      fields: [{ name: '_id', bsonType: 'objectId', isNullable: false }] }]);
    expect(r[0].fields[0].targetType).toBe('VARCHAR(24)');
  });
  test('Date → TIMESTAMPTZ', () => { ... });
  test('Double → DOUBLE PRECISION', () => { ... });
  test('Decimal128 → NUMERIC(18,4)', () => { ... });
  test('Nested ≤2 levels → flattened columns', () => { ... });
  test('Nested >2 levels → JSONB', () => { ... });
  test('Array of Objects → child table flag', () => { ... });
  test('Child table auto-gets sort_order column', () => { ... });
  // ... 6 more type tests
});
```

### Topological Sort Tests (`topologicalSort.test.ts`)

```typescript
describe('Topological Sort', () => {
  test('Simple 3-table DAG: users → orders → order_items', () => {
    const sorted = topologicalSort([
      { name: 'order_items', fkDependencies: ['orders'] },
      { name: 'orders',      fkDependencies: ['users'] },
      { name: 'users',       fkDependencies: [] },
    ]);
    expect(sorted.indexOf('users')).toBeLessThan(sorted.indexOf('orders'));
    expect(sorted.indexOf('orders')).toBeLessThan(sorted.indexOf('order_items'));
  });
  test('Self-referencing FK (categories) detected as cycle', () => { ... });
  test('Mutual FK (users ↔ organizations) detected as cycle', () => { ... });
  test('Empty list returns empty array', () => { ... });
  test('Two independent table sets sorted correctly', () => { ... });
});
```

### Risk Analyzer Tests (`riskAnalyzer.test.ts`)

```typescript
describe('Risk Analyzer — Critical', () => {
  test('Detects Array-of-Objects NOT mapped to child table', () => { ... });
  test('Detects NOT NULL on sparse field (>5% missing)', () => { ... });
  test('Detects circular FK dependency', () => { ... });
});
describe('Risk Analyzer — Warnings', () => {
  test('Detects mixed types on phone field (String + Integer)', () => { ... });
  test('Detects existing tables in target PostgreSQL', () => { ... });
  test('Detects large binary field (avg doc >100KB)', () => { ... });
});
```

### ETL Transform Tests (`etlTransform.test.ts`)

```typescript
describe('ETL Transform', () => {
  test('Flattens nested object with underscore separator', () => { ... });
  test('Converts ObjectId to string', () => { ... });
  test('Converts ISODate to ISO string for PostgreSQL', () => { ... });
  test('Masks passwords in log output', () => {
    const log = maskSensitiveFields('postgresql://admin:secret@host:5432/db');
    expect(log).not.toContain('secret');
    expect(log).toContain('••••••••');
  });
  test('Null values written as NULL not empty string', () => { ... });
});
```

---

## Layer 2 — Integration Test Scenarios

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Happy Path (clean 5-collection schema, 20K docs) | All rows migrate, verify.js passes all 5 checks |
| 2 | Dirty Data (mixed phone types, null emails) | Migration completes, skipped rows logged |
| 3 | Circular FK (users ↔ organizations) | Risk Report flags it; deferred FK creation succeeds |
| 4 | Large Binary (products with 500KB images) | Batch auto-reduced to 50; memory < 300MB |
| 5 | Crash Recovery (kill app at 50% progress) | Restart shows "Clean Up" banner; rollback works |
| 6 | AI Fallback (invalid API key) | Rule engine activates; badge shows `[⚡ Auto Rule-Mapped]` |

---

## Layer 3 — E2E Checklist (Phase 17)

```
WORKFLOW A — Migration (MongoDB → PostgreSQL):
☐ Step 1: Choose direction — card highlights correctly
☐ Step 2: Connect MongoDB testbed — schema preview appears
☐ Step 3: Connect PostgreSQL testbed — permission check passes
☐ Step 4: AI mapping loads for all 7 collections
☐ Step 4: Manual column rename persists to Step 5
☐ Step 5: Risk Report shows ≥2 critical + ≥2 warnings
☐ Step 5: Auto-Fix updates mapping correctly
☐ Step 6: Dry Run completes — nothing written to DB
☐ Step 7: 20K docs migrate in under 5 minutes
☐ Step 7: verify.js — all 5 checks pass
☐ Step 8: All 5 downloads work (PDF, ERD, Prisma, Rollback, Layer2)

WORKFLOW C — Schema Update:
☐ NL2DDL: "Add a phone number column to users" → correct SQL
☐ Dry Run validates SQL before applying
☐ Version history entry created

DEMO MODE:
☐ Launches without real DB connection
☐ All 8 steps complete successfully
```

---

## Layer 4 — Smoke Test (No Database Needed)

**Location:** `scripts/smoke-test.js` | **Run:** `node scripts/smoke-test.js`

```javascript
// scripts/smoke-test.js
const assert = require('assert');
const { generateMappingByRules } = require('./apps/desktop/dist/main/engine/ruleEngine');
const { topologicalSort, detectCycles } = require('./apps/desktop/dist/main/engine/topologicalSort');

const tests = [
  { name: 'Rule Engine: ObjectId → VARCHAR(24)',
    fn: () => {
      const r = generateMappingByRules([{ collectionName: 'test',
        fields: [{ name: '_id', bsonType: 'objectId', isNullable: false }] }]);
      assert.strictEqual(r[0].fields[0].targetType, 'VARCHAR(24)');
    }
  },
  { name: 'Topological Sort: 3-table linear DAG',
    fn: () => {
      const result = topologicalSort([
        { name: 'order_items', fkDependencies: ['orders'] },
        { name: 'orders',      fkDependencies: ['users'] },
        { name: 'users',       fkDependencies: [] },
      ]);
      assert(result.indexOf('users') < result.indexOf('orders'));
    }
  },
  { name: 'Cycle Detection: self-referencing FK (categories)',
    fn: () => {
      const cycles = detectCycles([{ name: 'categories', fkDependencies: ['categories'] }]);
      assert(cycles.length > 0);
    }
  },
  { name: 'Cycle Detection: mutual FK (users ↔ organizations)',
    fn: () => {
      const cycles = detectCycles([
        { name: 'users', fkDependencies: ['organizations'] },
        { name: 'organizations', fkDependencies: ['users'] },
      ]);
      assert(cycles.length > 0);
    }
  },
];

console.log('\n🧪 MigrateIQ Smoke Test\n══════════════════════');
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); passed++; }
  catch (e) { console.error(`  ❌ ${t.name}: ${e.message}`); failed++; }
}
console.log(`\n══════════════════════`);
console.log(`  ${passed} passed | ${failed} failed`);
if (failed > 0) process.exit(1);
```

---

## Layer 5 — Performance Benchmarks

**Target Hardware:** Intel i5, 8GB RAM (average developer laptop)

| Dataset | Target Time | Memory Peak | Status |
|---|---|---|---|
| 1K rows | < 10 seconds | < 50 MB | TBD Phase 17 |
| 10K rows | < 60 seconds | < 120 MB | TBD Phase 17 |
| 100K rows | < 10 minutes | < 250 MB | TBD Phase 17 |

---

## User Acceptance Testing (UAT)

**When:** Phase 17 | **Who:** 3–5 CS students NOT on the team

**Protocol:**
1. Give tester: installer `.exe` + 1-page quick start + testbed connection strings
2. No help from team during session
3. Tasks: Full migration → Schema Update → Demo Mode
4. Collect SUS (System Usability Scale) questionnaire
5. **Target SUS score: > 70** (industry "Good" threshold)
6. Fix top 5 UX issues before final submission

---

## Jest Config (Add to `apps/desktop/package.json`)

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/main/engine/__tests__/**/*.test.ts"],
    "coverageThreshold": { "global": { "lines": 80 } }
  }
}
```

---

*End of Testing & QA Strategy | MigrateIQ FYP | September 2026*
