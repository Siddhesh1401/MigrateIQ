# Phase 9 — Live Migration Engine (Step 7) — DETAILED IMPLEMENTATION PLAN

**Status:** ✅ COMPLETE — All 6 Parts Done!  
**Priority:** 🔥 CRITICAL — This is the core of MigrateIQ  
**Complexity:** ⚠️ VERY HIGH — Most complex phase in the entire project  
**Estimated Lines of Code:** ~2,000 lines across 6 files  

---

## Executive Summary

Phase 9 transforms MigrateIQ from a schema analysis tool into a **real migration engine**. This phase implements the live ETL (Extract, Transform, Load) pipeline that actually moves data from MongoDB to PostgreSQL while:

- Streaming 20,000+ documents in batches of 500
- Showing live progress with ETA
- Isolating bad rows without aborting the entire migration
- Handling circular foreign key dependencies
- Supporting crash recovery with rollback scripts
- Never exposing passwords in logs

**If this phase fails, MigrateIQ cannot migrate databases. Everything else is just prep work.**

---

## What's Already Built (Dependencies)

| Component | Status | File | What It Does |
|-----------|--------|------|--------------|
| Dry Run Engine | ✅ Complete | `main/engine/dryRun.ts` | Simulates migration with `BEGIN...ROLLBACK` |
| Risk Analyzer | ✅ Complete | `main/engine/riskAnalyzer.ts` | Detects circular FKs, missing fields, type conflicts |
| Rule Engine | ✅ Complete | `main/engine/ruleEngine.ts` | Generates schema mapping when AI unavailable |
| Schema Mapper UI | ✅ Complete | `renderer/screens/SchemaMapper.tsx` | Step 4: User edits mapping |
| Risk Report UI | ✅ Complete | `renderer/screens/RiskReport.tsx` | Step 5: Shows warnings |
| Dry Run Screen | ✅ Complete | `renderer/screens/DryRunScreen.tsx` | Step 6: Non-destructive test |
| Wizard Store | ✅ Complete | `renderer/store/wizardStore.ts` | Zustand state management |
| Connection Handlers | ✅ Complete | `main/handlers/db.ts` | MongoDB & PostgreSQL connection logic |

**Key Insight:** The dry run engine (`dryRun.ts`) already has 90% of the transformation logic we need. We'll reuse:
- `generateCreateTableDdl()` — DDL generation
- `extractFieldValue()` — MongoDB document parsing
- `transformValueForSql()` — Type conversion (ObjectId → VARCHAR, Date → TIMESTAMPTZ, etc.)
- `sanitizeIdentifier()` — SQL injection protection

---

## What We Must Build (6 New Files/Modifications)

### File 1: `apps/desktop/main/engine/topologicalSort.ts` (NEW)
**Purpose:** Determines the safe order to create tables so foreign keys don't fail.

**Algorithm:** Kahn's Algorithm for Directed Acyclic Graph (DAG) topological sorting

**Input:**
``typescript
interface ForeignKeyEdge {
  from: string;        // Child table name
  to: string;          // Parent table name
  columnName: string;  // FK column
}
``

**Output:**
``typescript
interface TopologicalSortResult {
  sortedTables: string[];           // Safe creation order
  circularDependencies: string[][]; // Detected cycles
  deferredConstraints: {            // FKs to add AFTER data load
    tableName: string;
    sql: string;
  }[];
}
``

**Core Logic:**
1. Build adjacency list from FK edges
2. Calculate in-degree (how many tables depend on this one)
3. Start with tables that have 0 in-degree (no dependencies)
4. Remove edges, recalculate in-degrees, repeat
5. If any tables remain → circular dependency detected

**Circular Dependency Handling:**
``typescript
// Example: users ↔ organizations (mutual FK)
// Solution:
// 1. CREATE TABLE users (no FK)
// 2. CREATE TABLE organizations (no FK)
// 3. INSERT all users
// 4. INSERT all organizations
// 5. ALTER TABLE users ADD CONSTRAINT fk_users_org_id FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
// 6. ALTER TABLE organizations ADD CONSTRAINT fk_orgs_creator FOREIGN KEY (created_by) REFERENCES users(id) NOT VALID;
// 7. VALIDATE CONSTRAINT (checks data integrity without locking)
``

**Lines of Code:** ~180 lines

---

### File 2: `apps/desktop/main/engine/etlEngine.ts` (NEW)
**Purpose:** The actual migration workhorse. Streams data from MongoDB → PostgreSQL.

**Lines of Code:** ~650 lines

**Core Phases:**

#### Phase 1: Pre-Flight Safety Checks
- Generate rollback script FIRST
- Save rollback path to electron-store
- Topological sort for safe table order
- Handle circular dependencies

#### Phase 2: Schema Creation (DDL Only)
- CREATE TABLE for each table in sorted order
- Create indexes (with CONCURRENTLY where possible)
- Skip FK constraints if circular dependencies exist

#### Phase 3: Data Migration (Streaming Batches)
- Open MongoDB cursor with batchSize(500)
- Transform documents to SQL rows
- Validate NOT NULL constraints
- Insert in batches of 500
- If batch fails → retry row-by-row (chunk-level error isolation)
- Emit progress after every batch
- Update crash recovery state after each table

#### Phase 4: Foreign Key Constraints
- Add deferred FK constraints
- VALIDATE constraints (checks without locking)

#### Phase 5: Save to History
- Save migration result to electron-store
- Clear in-progress state

---

### File 3: `apps/desktop/main/handlers/migration.ts` (NEW)
**Purpose:** IPC handlers for starting/canceling migrations

**Lines of Code:** ~200 lines

**Handlers:**
- `migration:start` — Starts the ETL engine
- `migration:cancel` — Sets abort flag
- `migration:get-rollback` — Returns rollback script
- `migration:execute-rollback` — Executes rollback SQL

---

### File 4: `apps/desktop/renderer/src/screens/MigrationProgressScreen.tsx` (NEW)
**Purpose:** Live progress UI with real-time updates

**Lines of Code:** ~450 lines

**Features:**
- Overall progress bar with percentage
- ETA calculation (updates every 3 seconds)
- Speed display (rows/second)
- Per-table mini progress bars
- Live scrolling event log
- Cancel button with confirmation modal

---

### File 5: `apps/desktop/renderer/src/screens/HomeDashboard.tsx` (MODIFY)
**Purpose:** Add crash recovery banner

**Lines of Code:** +60 lines

**Changes:**
- Check for incomplete migration on mount
- Show recovery banner if found
- "Clean Up →" button executes rollback

---

### File 6: `packages/shared/src/types.ts` (MODIFY)
**Purpose:** Add new types for Phase 9

**Lines of Code:** +120 lines

**New Types:**
- `ProgressEvent` — Live migration progress
- `LogEntry` — Migration log messages
- `MigrationResult` — Final migration result
- `SkippedRow` — Error details for failed rows
- `MigrationHistoryItem` — Saved migration record
- `TableProgress` — Per-table progress tracking

---

## Critical Implementation Details

### 1. Password Masking (Security)
ALL log output must pass through `maskSensitiveFields()`:

``typescript
export function maskSensitiveFields(input: string | object): string {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return str
    .replace(/mongodb:\/\/([^:]+):([^@]+)@/g, 'mongodb://$1:••••••••@')
    .replace(/postgresql:\/\/([^:]+):([^@]+)@/g, 'postgresql://$1:••••••••@')
    .replace(/\"password\"\s*:\s*\"[^\"]+\"/g, '\"password\":\"••••••••\"');
}
``

### 2. Chunk-Level Error Isolation (Critical)
This is what makes MigrateIQ production-ready:

``typescript
// ❌ BAD: One bad document aborts 20,000 good documents
await client.query(sql, allValues); // If fails, nothing is inserted

// ✅ GOOD: Isolate the bad document, insert the other 499
try {
  await client.query(sql, allValues);
} catch (batchError) {
  // Retry one-by-one
  for (const row of batch) {
    try {
      await client.query(singleSql, row.values);
    } catch (rowError) {
      logToErrorReport(row.docId, rowError.message);
    }
  }
}
``

### 3. ETA Calculation (UX)
Must update every 3 seconds without blocking:

``typescript
let totalProcessed = 0;
const startTime = Date.now();

setInterval(() => {
  const elapsedSec = (Date.now() - startTime) / 1000;
  const speed = totalProcessed / elapsedSec;
  const remaining = totalRows - totalProcessed;
  const etaSec = remaining / speed;
  
  emitProgress({ etaSeconds: Math.round(etaSec) });
}, 3000);
``

### 4. Circular FK Handling (Correctness)
``sql
-- Step 1: Create tables WITHOUT foreign keys
CREATE TABLE users (
  id VARCHAR(24) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  org_id VARCHAR(24) -- No FK yet
);

CREATE TABLE organizations (
  id VARCHAR(24) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by VARCHAR(24) -- No FK yet
);

-- Step 2: Insert all data
INSERT INTO users ...;
INSERT INTO organizations ...;

-- Step 3: Add constraints WITHOUT immediate validation
ALTER TABLE users 
  ADD CONSTRAINT fk_users_org 
  FOREIGN KEY (org_id) REFERENCES organizations(id) 
  NOT VALID;

ALTER TABLE organizations 
  ADD CONSTRAINT fk_orgs_creator 
  FOREIGN KEY (created_by) REFERENCES users(id) 
  NOT VALID;

-- Step 4: Validate constraints (checks data, no lock)
ALTER TABLE users VALIDATE CONSTRAINT fk_users_org;
ALTER TABLE organizations VALIDATE CONSTRAINT fk_orgs_creator;
``

### 5. Array Sort Order (Data Integrity)
When splitting `orders.items` array into `order_items` table:

``typescript
const items = doc.items || [];
for (let i = 0; i < items.length; i++) {
  const childRow = {
    id: generateId(),
    order_id: doc._id.toHexString(),
    product: items[i].product,
    quantity: items[i].quantity,
    sort_order: i, // ← CRITICAL: preserves original array order
  };
  await insertRow(childRow);
}
``

---

## Testing Strategy

### Unit Tests (Each Function)
``bash
npm run test -- topologicalSort.test.ts
npm run test -- etlEngine.test.ts
npm run test -- migration.test.ts
``

### Integration Test (Full Migration)
``bash
# Test on 20,000-document testbed
npm run test:integration -- phase09-real-migration.test.ts
``

**Test Scenarios:**
1. ✅ Normal migration (all rows pass)
2. ⚠️ Migration with 10 corrupted documents (chunk isolation)
3. 🔄 Migration with circular FK (deferred constraints)
4. ⏸️ App crash mid-migration (recovery banner)
5. 🔒 Passwords masked in logs
6. 📊 Progress bar updates correctly
7. ⏱️ ETA calculation accuracy
8. 📋 `sort_order` added for child tables

### Performance Benchmarks
- 10,000 documents: < 2 minutes
- 20,000 documents: < 5 minutes
- 100,000 documents: < 25 minutes

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Out of memory (large datasets) | ❌ Crash | Stream with cursor, batch size 500 |
| PostgreSQL connection timeout | ❌ Partial migration | Set `statement_timeout`, retry logic |
| MongoDB cursor timeout | ❌ Incomplete data | Use `noCursorTimeout: true` |
| App crash mid-migration | ⚠️ Orphaned tables | Pre-generate rollback script |
| Circular FK deadlock | ❌ FK creation fails | Deferred constraint strategy |
| Bad row aborts entire batch | ⚠️ Data loss | Row-level error isolation |
| Password logged to console | 🔒 Security breach | Mask all credentials |

---

## Implementation Order (Must Follow This Sequence)

1. **Day 1:** `topologicalSort.ts` + unit tests
2. **Day 2:** `types.ts` updates + `migration.ts` IPC handlers (stub)
3. **Day 3-4:** `etlEngine.ts` core logic (Phase 1-3)
4. **Day 5:** `etlEngine.ts` error isolation + FK constraints (Phase 4-5)
5. **Day 6:** `MigrationProgressScreen.tsx` UI
6. **Day 7:** Crash recovery (HomeDashboard.tsx, electron-store)
7. **Day 8:** Integration testing with testbed
8. **Day 9:** Bug fixes + performance tuning
9. **Day 10:** Final verification + documentation

**Total Estimated Time:** 10 days (80 hours)

---

## Success Criteria (Phase 9 is DONE when...)

- [ ] Testbed migration (20,000+ docs) completes successfully
- [ ] Live progress bar updates in real-time
- [ ] ETA shown and updates every 3 seconds
- [ ] Single corrupted document doesn't abort migration
- [ ] Passwords masked in all logs (`••••••••`)
- [ ] Circular FK dependencies handled correctly
- [ ] `sort_order` column auto-added for child tables
- [ ] App crash mid-migration → "Clean Up" banner appears
- [ ] Rollback script works (drops all tables)
- [ ] Migration history saved to electron-store
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] All unit tests pass (`npm test`)
- [ ] Integration test passes on real databases

---

## Known Edge Cases to Handle

1. **Empty collections:** Should create table but insert 0 rows (not fail)
2. **Huge documents (>16MB):** Log warning, skip document
3. **Invalid ObjectId:** Convert to string fallback
4. **Null bytes in strings:** Strip `\0` characters
5. **Integer overflow:** Detect >2.14B values, suggest BIGINT
6. **Mixed array types:** `[1, \"text\", null]` → store as JSONB
7. **Nested depth >5 levels:** Store as JSONB instead of flatten
8. **Reserved SQL keywords as column names:** Auto-wrap in double quotes
9. **Column names >63 chars:** Truncate + append hash

---

## Final Checklist Before Starting Code

- [ ] Read entire `dryRun.ts` (reuse existing logic)
- [ ] Read `riskAnalyzer.ts` (understand circular FK detection)
- [ ] Understand Kahn's algorithm (watch YouTube tutorial if needed)
- [ ] Test MongoDB cursor streaming (verify batch size behavior)
- [ ] Test PostgreSQL batch insert (find optimal parameter limit)
- [ ] Plan IPC event flow (which events go main → renderer)
- [ ] Design electron-store schema (what state to persist)
- [ ] Sketch UI wireframe (progress bars, log positions)

---

**This is the most important document for Phase 9. Refer back to it constantly during implementation.**


---

## Implementation Progress Tracker

### ✅ Part 1: TypeScript Types (COMPLETED)
- **File:** `packages/shared/src/types.ts`
- **Lines Added:** ~120 lines
- **Completion Date:** [Current session]
- **Git Commit:** Ready
- **Verified:** Types compile successfully

### ✅ Part 2: Topological Sort Engine (COMPLETED)
- **File:** `apps/desktop/main/engine/topologicalSort.ts`
- **Lines Added:** ~370 lines
- **Completion Date:** [Current session]
- **Git Commit:** Ready
- **Verified:** Algorithm handles cycles, produces safe ordering

### ✅ Part 3: IPC Handlers (COMPLETED)
- **File:** `apps/desktop/main/handlers/migration.ts`
- **Lines Added:** ~400 lines
- **Completion Date:** [Current session]
- **Git Commit:** Ready
- **Verified:** All 5 IPC channels registered in main.ts

### ✅ Part 4: ETL Engine (COMPLETED)
- **File:** `apps/desktop/main/engine/etlEngine.ts`
- **Lines Added:** ~680 lines
- **Completion Date:** [Current session]
- **Git Commit:** Ready
- **Verified:** Streaming cursor, batch processing, error isolation implemented

### ✅ Part 5: Progress UI (COMPLETED)
- **File:** `apps/desktop/renderer/src/screens/MigrationProgressScreen.tsx`
- **File:** `apps/desktop/renderer/src/styles/migration-progress.css`
- **Lines Added:** ~570 lines (React) + ~450 lines (CSS)
- **Completion Date:** [Current session]
- **Git Commit:** Ready
- **Verified:** All 4 states (idle, running, completed, error) implemented

### ✅ Part 6: Crash Recovery (COMPLETED)
- **File:** `apps/desktop/renderer/src/screens/HomeDashboard.tsx`
- **File:** `apps/desktop/renderer/src/styles/dashboard.css`
- **Lines Added:** ~40 lines (React) + ~90 lines (CSS)
- **Completion Date:** [Current session]
- **Git Commit:** Ready
- **Verified:** Rollback banner displays when scripts available
