# Phase 11: Schema Update Assistant (Workflow C) — Technical Documentation

## 1. Phase Summary & Goal
Phase 11 introduces **Workflow C — Schema Update Assistant** into MigrateIQ, providing a specialized 6-step guided wizard (`/schema-update`) to safely modify live database schemas across PostgreSQL and MongoDB without risking data corruption, unhandled lock waits, or application downtime.

Key deliverables achieved:
- **Dual-Mode Change Specification**: Form Builder (Mode A) for 8 core operations (`addColumn`, `dropColumn`, `renameColumn`, `renameTable`, `changeType`, `addIndex`, `dropIndex`, `addForeignKey`) and Gemini AI NL2DDL (Mode B) with fallback offline regex pattern matching.
- **Pre-Flight Risk Assessment Engine**: Automatically flags critical risks (such as `NOT NULL` without default on populated tables, irreversible data loss from dropping columns, and table-rewrite exclusive locks) paired with **1-Click Auto-Fix** remediation.
- **Safe Transactional Wrapper**: PostgreSQL scripts wrapped in atomic `BEGIN ... COMMIT` blocks with `SET lock_timeout = '5s';` to guarantee queries never hang waiting for table locks.
- **Automated Rollback Scripts**: Generates matching reverse scripts for all operations with one-click copy and `.sql` file download.
- **Live Database Execution & History**: Safe execution with translated plain-English error messages and persistent audit trail saved to `electron-store`.

---

## 2. Files Created & Modified

### Modified Files:
1. `packages/shared/src/types.ts`
   - Added Phase 11 types: `SchemaOperationType`, `SchemaChangeParams`, `NL2DDLResponse`, `SchemaUpdateRiskItem`, `GeneratedScriptResult`, `SchemaUpdateExecutionResult`, `SchemaHistoryItem`, and `SchemaIntrospectedTableInfo`.
2. `apps/desktop/main/main.ts`
   - Registered `setupSchemaUpdateHandlers()` inside `app.whenReady()`.

### New Files Created:
3. `apps/desktop/main/handlers/schemaUpdate.ts`
   - Backend IPC handlers:
     - `schema:interpret-nl2ddl`: Gemini AI cascade with offline regex fallback.
     - `schema:generate-scripts`: PostgreSQL and MongoDB forward + rollback script generators.
     - `schema:analyze-risks`: Pre-flight risk scanner with auto-fix actions.
     - `schema:apply-update`: Live transactional execution with PostgreSQL error translation.
     - `schema:get-history`: Audit history retrieval from `electron-store`.
4. `apps/desktop/renderer/src/styles/schema-update.css`
   - Dedicated light-theme CSS tokens (`#F8FAFC`, `#FFFFFF`, `#F1F5F9`, `#E2E8F0`, `#2563EB`, `#0284C7`) styling stepper, database cards, dual-mode tabs, risk counters, code view, and modal dialogs.
5. `apps/desktop/renderer/src/screens/SchemaUpdateWizard.tsx`
   - Complete 6-step React wizard:
     - Step 1: Database selector (PostgreSQL / MongoDB).
     - Step 2: Connection & table introspection list with row counts.
     - Step 3: Dual Mode change builder (Form Builder + Gemini AI prompt with sample chips).
     - Step 4: Risk assessment with Critical/Warning/Info badges and 1-Click Auto-Fix.
     - Step 5: Forward & Rollback SQL preview, lock timeout checklist, copy/download buttons, and execution confirmation modal.
     - Step 6: Live execution status banner, duration metrics, and recent schema update history.
6. `scripts/test-phase11-schema-update.js`
   - 45 automated unit and regression tests covering script generation, risk analysis, offline regex parsing, and safety invariants.

---

## 3. Architecture & Key Implementation Details

### 3.1 Dual-Mode Change Definition
- **Mode A (Structured Form Builder)**: Dynamic forms adapting to operation selection. When introspected tables are available, target table and column dropdowns are pre-populated directly from live metadata.
- **Mode B (Gemini AI NL2DDL)**: Translates natural language requests (e.g., *"Add column status VARCHAR(50) with default 'active' to orders"*) into structured schema changes.
- **Offline Regex Resilience**: If the Gemini API key is missing or network connectivity is unavailable, an offline regex parser recognizes common DDL patterns (`add column`, `drop column`, `rename column/table`, `change type`, `create index`) with zero external dependencies.

### 3.2 Automated Risk Assessment & 1-Click Auto-Fix
The risk engine inspects live table properties (such as current row count) to anticipate failures:
- **Populated Table `NOT NULL` Risk**: Adding a `NOT NULL` column without a default to a table with rows > 0 is flagged as **Critical (PostgreSQL Error 23502)**. A **1-Click Auto-Fix** button instantly makes the column nullable.
- **Drop Column Data Loss**: Flagged as **Critical (Irreversible Data Loss)** with clear operator warnings.
- **Type Change & Index Risks**: Flagged as **Warnings** detailing table locks and query degradation.

### 3.3 Transactional Isolation & 5-Second Lock Timeout
All generated PostgreSQL scripts are wrapped in safe transaction blocks:
```sql
SET lock_timeout = '5s';
BEGIN;

ALTER TABLE "public"."customers" ADD COLUMN "loyalty_tier" VARCHAR(50) NOT NULL DEFAULT 'bronze';

COMMIT;
```
If another transaction holds an exclusive table lock for more than 5 seconds, PostgreSQL aborts the update rather than queuing behind long-running queries, preventing connection starvation.

### 3.4 Plain-English Database Error Translation
When live execution fails, low-level database error codes are automatically mapped to helpful suggestions:
- `42701`: "Column already exists on table. Choose a different column name or use rename/change type."
- `23502`: "Cannot add NOT NULL constraint: existing rows contain NULL values. Make column nullable or supply a default value."
- `55P03`: "Lock acquisition timed out after 5 seconds: another process holds an active lock."
- `42P01`: "Relation does not exist in schema. Verify table name and target schema."

---

## 4. Verification & Test Results

All verification suites executed successfully:

| Test Suite | File | Tests Run | Result |
|---|---|---|---|
| **Phase 11 Schema Update** | `scripts/test-phase11-schema-update.js` | 45 | ✅ 45/45 Passed (100%) |
| **Phase 8 Dry Run Simulation** | `scripts/test-phase8-dry-run.js` | 109 | ✅ 109/109 Passed (100%) |
| **Phase 7 Risk Engine** | `scripts/test-phase7-risk-engine.js` | 20 | ✅ 20/20 Passed (100%) |
| **Full Monorepo Typecheck** | `npm run typecheck` | 3 workspaces | ✅ 0 errors (`shared`, `desktop`, `web`) |

Key Verified Scenarios:
- [x] All 8 PostgreSQL operations generate valid SQL and matching rollback scripts.
- [x] All 6 MongoDB operations generate valid native collection commands (`updateMany`, `unset`, `renameCollection`, `createIndex`).
- [x] 5-second lock timeout and transaction wrapping present on all generated DDL.
- [x] Critical risk flagged on populated table `NOT NULL` addition; 1-click auto-fix toggles nullable state.
- [x] Natural language queries accurately parsed offline via regex fallback.
- [x] Audit entries recorded in persistent `electron-store` on execution.

---

## 5. Edge Cases & FYP Report Notes
1. **Zero-Downtime Schema Evolution**: Demonstrates how enterprise migration tooling prevents cascading database outages by setting bounded lock timeouts (`lock_timeout = '5s'`) rather than indefinite waits.
2. **Dual-Mode AI + Rule Engine Synergy**: Demonstrates an AI-native pattern where LLM capabilities (Gemini NL2DDL) are augmented by local deterministic fallbacks (Regex Parser), ensuring the tool remains functional even offline or when quota limits are reached.
3. **Data-Aware Risk Scoring**: Risk detection is grounded in actual table cardinality (`rowCount > 0`), avoiding false positives on empty development tables while providing critical warnings on populated production tables.

---

## 6. Next Phase Handoff
- **Phase 11 Complete**: Schema Update Assistant (Workflow C) is operational on `/schema-update` and isolated from the core migration wizard.
- **Subsequent Phases**:
  - Phase 9: Real-time Data Migration Engine & Streaming ETL.
  - Phase 10: Post-Migration Validation & Reconciliation Engine.
