# Phase 11: Schema Update Assistant (Workflow C) — Technical Documentation (Enterprise 10/10 Edition)

## 1. Phase Summary & Goal
Phase 11 introduces **Workflow C — Schema Update Assistant** into MigrateIQ, providing a specialized 6-step guided wizard (`/schema-update`) to safely modify live database schemas across PostgreSQL and MongoDB without risking data corruption, unhandled lock waits, or application downtime.

Following the Enterprise 10/10 Upgrade, the assistant features five high-value enhancements:
- **Visual Schema Structural Impact Diff**: Reactive side-by-side comparison showing before and after column layouts with color-coded badges (`+ ADD`, `- DROP`, `~ MOD`).
- **Multi-Change Staging Queue (Batch Evolution)**: Queue multiple schema modifications into an atomic batch with sequential preview, removal, and batch execution over IPC (`schema:execute-batch`).
- **Speculative Dry-Run Simulation**: Zero-downtime test execution via `schema:dry-run` that executes inside a strict `lock_timeout = '5s'` transaction block and unconditionally rolls back (`ROLLBACK;`) to verify syntax and lock acquisition without modifying persistent data.
- **Zero-Downtime Indexing (`CONCURRENTLY` Toggle)**: Supports PostgreSQL `CREATE INDEX CONCURRENTLY` without transaction block wrapping, preventing exclusive table write locks.
- **Enterprise Schema Policy Guard**: Automated rule engine checks (`PG-POLICY-001` snake_case naming, `PG-POLICY-002` reserved SQL keywords, `PG-POLICY-003` large VARCHAR lengths, and `PG-POLICY-004` unindexed foreign keys).

---

## 2. Files Created & Modified

### Modified Files:
1. `packages/shared/src/types.ts`
   - Added Phase 11 types: `SchemaOperationType`, `SchemaChangeParams` (with `concurrently?: boolean`), `NL2DDLResponse`, `SchemaUpdateRiskItem` (with `'policy'` severity and `policyCategory`/`ruleId`), `GeneratedScriptResult`, `SchemaUpdateExecutionResult`, `SchemaHistoryItem`, `SchemaIntrospectedTableInfo`, `StagedChange`, `DryRunExecutionResult`, and `BatchExecutionResult`.
2. `apps/desktop/main/main.ts`
   - Registered `setupSchemaUpdateHandlers()` inside `app.whenReady()`.
3. `apps/desktop/main/handlers/schemaUpdate.ts`
   - Backend IPC handlers:
     - `schema:interpret-nl2ddl`: Gemini AI model cascade (`gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`, `gemini-3.6-flash`, `gemini-flash-latest`, `gemini-3.7-flash`, `gemini-3.8-flash`) with offline regex fallback.
     - `schema:generate-scripts`: PostgreSQL and MongoDB forward + rollback script generators with `CONCURRENTLY` support (skipping `BEGIN/COMMIT` blocks when `concurrently: true`).
     - `schema:analyze-risks`: Pre-flight risk scanner augmented with Enterprise Policy Guard (`snake_case`, reserved words, large VARCHAR, unindexed FKs).
     - `schema:dry-run`: Zero-risk speculative DDL execution (`BEGIN; ... ROLLBACK;`).
     - `schema:execute-batch`: Atomic multi-change batch executor running staged changes sequentially with rollback on error.
     - `schema:apply-update`: Live transactional execution regenerating verified SQL directly from parameters on the backend.
     - `schema:get-history`: Audit history retrieval from `electron-store`.
4. `apps/desktop/renderer/src/styles/schema-update.css`
   - Dedicated light-theme CSS styling (`#F8FAFC`, `#FFFFFF`, `#F1F5F9`, `#E2E8F0`, `#2563EB`, `#0284C7`) styling stepper, database cards, dual-mode tabs, risk counters, code view, Visual Diff panel (`.su-diff-card`), Staging Queue tray (`.su-staging-tray`), Dry-Run banner (`.su-dryrun-box`), CONCURRENTLY switch (`.su-concurrent-box`), and policy badges (`.su-policy-chip`).
5. `apps/desktop/renderer/src/screens/SchemaUpdateWizard.tsx`
   - Complete 6-step React wizard:
     - Step 1: Database selector (PostgreSQL / MongoDB) with state reset on engine toggle.
     - Step 2: Connection & green connection banner with collapsible table inspector showing columns, types, nullability badges, and indexes.
     - Step 3: Dual Mode change builder with `CONCURRENTLY` toggle, `Stage This Change (+ Add to Batch)` button, Staging Queue Tray, and real-time Visual Schema Diff.
     - Step 4: Risk assessment with Critical, Warning, Enterprise Policy, and Safe Check counters and immediate 1-Click Auto-Fix.
     - Step 5: Dual script preview panels, lock timeout checklist, `Execute Dry-Run (Zero-Downtime Test)` button, Dry-Run pass/fail banner, and batch-aware `Apply` button.
     - Step 6: Live execution status banner, natural English change descriptions, failure reassurance, and live introspection refresh.
6. `scripts/seed-phase11-testbed.js`
   - Dedicated lightweight testbed database seeder creating both MongoDB and PostgreSQL databases named `phase11migrateiq`.
7. `scripts/test-phase11-schema-update.js`
   - 86 automated unit, security, and regression tests covering script generation, SQL injection defense, default value parsing, risk analysis, offline regex parsing, CONCURRENTLY index generation, and Enterprise Policy Guard rules.

---

## 3. Architecture & Key Implementation Details

### 3.1 Visual Schema Structural Impact Diff
- Dynamically compares the table's introspected schema against the predicted target schema after applying pending operations.
- Renders added columns in light green (`#F0FDF4`), dropped columns in strikethrough light red (`#FEF2F2`), and modified columns/types in soft blue (`#EFF6FF`).
- Supports multi-change layering: all staged changes queued for the table are previewed together.

### 3.2 Multi-Change Staging Queue & Batch Execution
- Operators can define a change, click `Stage This Change`, and define another without losing wizard state.
- The staging tray lists all queued operations with sequential numbering and individual delete controls.
- The `schema:execute-batch` IPC handler runs each staged change sequentially through a single database connection and rolls back on failure.

### 3.3 Speculative Dry-Run Simulation
- Connects to the database and sets `SET lock_timeout = '5s';`.
- Enters `BEGIN;`, runs the generated DDL statements, and unconditionally calls `ROLLBACK;`.
- Reports lock acquisition duration and syntax validation with zero persistent changes.

### 3.4 Zero-Downtime Indexing (`CONCURRENTLY`)
- Toggling `CONCURRENTLY` on PostgreSQL emits `CREATE INDEX CONCURRENTLY` and ensures no `BEGIN ... COMMIT` wrapper is added, avoiding lock queues on production tables.

### 3.5 Enterprise Schema Policy Guard
- Rules implemented:
  - `PG-POLICY-001`: Checks for `camelCase` / `PascalCase` identifiers and suggests `snake_case`.
  - `PG-POLICY-002`: Checks for PostgreSQL reserved keywords.
  - `PG-POLICY-003`: Flags `VARCHAR(N)` where N > 1,000.
  - `PG-POLICY-004`: Warns on unindexed foreign keys on populated tables (>1,000 rows).

---

## 4. Verification & Test Results

All verification suites executed successfully:

| Test Suite | File | Tests Run | Result |
|---|---|---|---|
| **Phase 11 Schema Update & 10/10 Upgrades** | `scripts/test-phase11-schema-update.js` | 86 | ✅ 86/86 Passed (100%) |
| **Phase 8 Dry Run Simulation** | `scripts/test-phase8-dry-run.js` | 109 | ✅ 109/109 Passed (100%) |
| **Phase 7 Risk Engine** | `scripts/test-phase7-risk-engine.js` | 20 | ✅ 20/20 Passed (100%) |
| **Phase 2 & 3 Shell & Dashboard** | `scripts/test-phase2-phase3-verification.js` | 22 | ✅ 22/22 Passed (100%) |
| **Remediation Studio** | `scripts/test-remediation-studio.js` | 8 | ✅ 8/8 Passed (100%) |
| **Full Desktop Typecheck** | `npm run typecheck` | `apps/desktop` | ✅ 0 errors (clean build) |

Key Verified Scenarios:
- [x] All 8 PostgreSQL operations generate valid SQL and matching rollback scripts.
- [x] `addIndex` with `concurrently=true` generates `CREATE INDEX CONCURRENTLY` without `BEGIN/COMMIT`.
- [x] All 4 Enterprise Policy Guard rules (`PG-POLICY-001` through `004`) detect naming, keyword, length, and indexing issues.
- [x] Multi-change staging queue batches changes and handles atomic sequential execution.
- [x] Speculative dry run performs `BEGIN ... ROLLBACK` simulation.
- [x] Visual schema diff accurately computes before vs predicted target schema.
- [x] Zero regressions across existing tests (86/86 Phase 11 tests passing; 245+ total repository tests passing).

---

## 5. Edge Cases & FYP Report Notes
1. **Zero-Downtime Indexing Invariant**: In PostgreSQL, `CREATE INDEX CONCURRENTLY` cannot run inside a multi-statement transaction (`ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`). The generator dynamically adjusts transactional wrappers based on operation flags.
2. **Speculative Rollback Simulation**: Proves schema changes can be verified under live locking conditions without modifying data by utilizing PostgreSQL's transactional DDL capabilities (`BEGIN; ... DDL ... ROLLBACK;`).
3. **Multi-Change Batch Staging**: Demonstrates how desktop migration assistants can consolidate multiple atomic modifications into an ordered execution batch.

---

## 6. Next Phase Handoff
- **Phase 11 10/10 Complete & Fully Documented**: Schema Update Assistant (Workflow C) is verified on `/schema-update` and completely production-ready.
- **Subsequent Phases**:
  - Phase 9: Real-time Data Migration Engine & Streaming ETL.
  - Phase 10: Post-Migration Validation & Reconciliation Engine.

