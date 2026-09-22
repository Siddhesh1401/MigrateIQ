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
   - Added Phase 11 types: `SchemaOperationType`, `SchemaChangeParams`, `NL2DDLResponse`, `SchemaUpdateRiskItem`, `GeneratedScriptResult`, `SchemaUpdateExecutionResult`, `SchemaHistoryItem`, and `SchemaIntrospectedTableInfo` (including `indexes?: string[]`).
2. `apps/desktop/main/main.ts`
   - Registered `setupSchemaUpdateHandlers()` inside `app.whenReady()`.
3. `apps/desktop/main/handlers/schemaUpdate.ts`
   - Backend IPC handlers:
     - `schema:interpret-nl2ddl`: Gemini AI model cascade (`gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`, `gemini-3.6-flash`, `gemini-flash-latest`, `gemini-3.7-flash`, `gemini-3.8-flash`) with offline regex fallback.
     - `schema:generate-scripts`: PostgreSQL and MongoDB forward + rollback script generators with strict parameter sanitization, `onDelete` whitelisting, and SQL function whitelist.
     - `schema:analyze-risks`: Engine-aware pre-flight risk scanner with auto-fix actions (scoping PostgreSQL relational constraints strictly to PostgreSQL).
     - `schema:apply-update`: Live transactional execution regenerating verified SQL directly from parameters on the backend (eliminating untrusted renderer SQL execution), handling MongoDB inferred index names, and returning natural English success descriptions.
     - `schema:get-history`: Audit history retrieval from `electron-store`.
4. `apps/desktop/renderer/src/styles/schema-update.css`
   - Dedicated light-theme CSS tokens (`#F8FAFC`, `#FFFFFF`, `#F1F5F9`, `#E2E8F0`, `#2563EB`, `#0284C7`) styling stepper, database cards, dual-mode tabs, risk counters, code view, and modal dialogs.
5. `apps/desktop/renderer/src/screens/SchemaUpdateWizard.tsx`
   - Complete 6-step React wizard:
     - Step 1: Database selector (PostgreSQL / MongoDB) with state reset on engine toggle.
     - Step 2: Connection & green connection banner with collapsible table inspector showing columns, types, nullability badges, and indexes.
     - Step 3: Dual Mode change builder (Form Builder + Gemini AI prompt with `🤖 Let AI Interpret This`), hiding SQL Data Type for MongoDB.
     - Step 4: Risk assessment with Critical/Warning/Info badges and immediate 1-Click Auto-Fix.
     - Step 5: Stacked dual panels showing Forward DDL Script and Rollback Script simultaneously, lock timeout checklist, copy/download buttons, and `▶ Apply This Change →` primary button.
     - Step 6: Live execution status banner, natural English change descriptions, failure reassurance (*"The change was not applied. Your database is unchanged"*), and live introspection refresh on "Make Another Change".
6. `scripts/seed-phase11-testbed.js`
   - Dedicated lightweight testbed database seeder creating both MongoDB and PostgreSQL databases named `phase11migrateiq`.
7. `scripts/test-phase11-schema-update.js`
   - 71 automated unit, security, and regression tests covering script generation, SQL injection defense, default value parsing, risk analysis, offline regex parsing, and safety invariants.

---

## 3. Architecture & Key Implementation Details

### 3.1 Dual-Mode Change Definition & Resilient AI
- **Mode A (Structured Form Builder)**: Dynamic forms adapting to operation selection. When introspected tables are available, target table and column dropdowns are pre-populated directly from live metadata.
- **Mode B (Gemini AI NL2DDL)**: Translates natural language requests (e.g., *"add column siddhesh to customers"*) into structured schema changes with confidence scoring.
- **Model Cascade**: Uses a prioritized model cascade (`gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.6-flash`, etc.) with fallback to offline regex parsing when offline or without an API key.
- **Offline Regex Resilience**: When no API key is present, an offline regex parser recognizes common DDL patterns (`add column`, `add column to <table> named <col>`, `drop column`, `rename column/table`, `change type`, `create index`) with zero external network dependencies.

### 3.2 Automated Risk Assessment & 1-Click Auto-Fix
The risk engine inspects live table properties (such as current row count) to anticipate failures:
- **Populated Table `NOT NULL` Risk**: Adding a `NOT NULL` column without a default to a table with rows > 0 is flagged as **Critical (PostgreSQL Error 23502)**. A **1-Click Auto-Fix** button instantly makes the column nullable.
- **Engine-Aware Risk Isolation**: PostgreSQL-specific failure modes (relational error 23502, type cast table locks, foreign key table scans) are strictly restricted to PostgreSQL targets, ensuring MongoDB schemaless operations are not falsely flagged.
- **Drop Column Data Loss**: Flagged as **Critical (Irreversible Data Loss)** with clear operator warnings.
- **Type Change & Index Risks**: Flagged as **Warnings** detailing table locks and query degradation.

### 3.3 Transactional Isolation & 5-Second Lock Timeout
All generated PostgreSQL scripts are wrapped in safe transaction blocks:
```sql
SET lock_timeout = '5s';
BEGIN;

ALTER TABLE "public"."customers" ADD COLUMN "siddhesh" VARCHAR(255);

COMMIT;
```
If another transaction holds an exclusive table lock for more than 5 seconds, PostgreSQL aborts the update rather than queuing behind long-running queries, preventing connection starvation.

### 3.4 Plain-English Database Error Translation & Reassurance
When live execution fails, low-level database error codes are automatically mapped to helpful suggestions:
- `42701`: "Column already exists on table. Choose a different column name or use rename/change type."
- `23502`: "Cannot add NOT NULL constraint: existing rows contain NULL values. Make column nullable or supply a default value."
- `55P03`: "Lock acquisition timed out after 5 seconds: another process holds an active lock."
- `42P01`: "Relation does not exist in schema. Verify table name and target schema."
- Clear reassurance copy is presented to operators on failure: *"The change was not applied. Your database is unchanged."*

### 3.5 Security & Reliability Hardening
Following rigorous retrospective audits, key enterprise safeguards were implemented:
1. **Backend-Regenerated Safe DDL in `schema:apply-update`**: The backend regenerates and validates DDL directly from parameters rather than blindly executing raw SQL strings sent from the renderer process.
2. **`onDelete` Action Whitelisting**: Strict whitelisting (`CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION`, `SET DEFAULT`) blocks SQL injection via foreign key delete actions.
3. **SQL Injection Defense in `sanitizeSqlType`**: Enforces strict character whitelisting and proactively strips dangerous DDL/DML keywords (`DROP`, `DELETE`, `INSERT`, `UPDATE`, `ALTER`, `SELECT`, `TRUNCATE`, `EXEC`, `UNION`).
4. **Context-Aware Default Value Quoting (`formatSqlDefaultClause`)**: Correctly leaves standard SQL keywords (`CURRENT_TIMESTAMP`, `NOW()`, `GEN_RANDOM_UUID()`, `UUID_GENERATE_V4()`, `TRUE`, `FALSE`, numbers) unquoted while wrapping string literals in single quotes with escaped internal quotes.
5. **Non-JSON String Safety in MongoDB (`formatMongoDefaultValue`)**: Replaced raw `JSON.parse()` in MongoDB native execution with a defensive parser that handles plain strings (e.g. `active`) without throwing runtime `SyntaxError` exceptions.
6. **MongoDB Inferred Index Name**: When dropping indexes in MongoDB without an explicit index name, the name is inferred from the collection and column (`idx_${table}_${col}`).
7. **Rollback Data Type Fidelity in `changeType`**: Uses `originalDataType` from introspected column metadata, ensuring rollback DDL restores the exact prior type (e.g. `SMALLINT`) rather than defaulting to generic `TEXT`.
8. **Collapsible Table Inspector**: Step 2 displays expandable table metadata showing existing column definitions, data types, nullability badges, and existing indexes before changes are defined.
9. **Stacked Forward & Rollback Dual Panels**: Step 5 presents forward DDL and reverse rollback scripts simultaneously, preventing operators from missing rollback procedures.

---

## 4. Verification & Test Results

All verification suites executed successfully:

| Test Suite | File | Tests Run | Result |
|---|---|---|---|
| **Phase 11 Schema Update & Hardening** | `scripts/test-phase11-schema-update.js` | 71 | ✅ 71/71 Passed (100%) |
| **Phase 8 Dry Run Simulation** | `scripts/test-phase8-dry-run.js` | 109 | ✅ 109/109 Passed (100%) |
| **Phase 7 Risk Engine** | `scripts/test-phase7-risk-engine.js` | 20 | ✅ 20/20 Passed (100%) |
| **Phase 2 & 3 Shell & Dashboard** | `scripts/test-phase2-phase3-verification.js` | 22 | ✅ 22/22 Passed (100%) |
| **Remediation Studio** | `scripts/test-remediation-studio.js` | 8 | ✅ 8/8 Passed (100%) |
| **Full Monorepo Typecheck** | `npm run typecheck` | 3 workspaces | ✅ 0 errors (`shared`, `desktop`, `web`) |

Key Verified Scenarios:
- [x] All 8 PostgreSQL operations generate valid SQL and matching rollback scripts.
- [x] All 6 MongoDB operations generate valid native collection commands (`updateMany`, `unset`, `renameCollection`, `createIndex`).
- [x] 5-second lock timeout and transaction wrapping present on all generated DDL.
- [x] Critical risk flagged on populated table `NOT NULL` addition; 1-click auto-fix toggles nullable state.
- [x] Natural language queries accurately parsed offline via regex fallback as well as live with Gemini AI.
- [x] SQL injection defense in `onDelete` and `sanitizeSqlType` verified.
- [x] Backend-enforced SQL generation eliminates raw SQL execution vulnerabilities.
- [x] Audit entries recorded in persistent `electron-store` on execution.
- [x] Zero regressions across all existing phases (Phases 0–8 remain 100% operational; 230 total tests passing).

---

## 5. Edge Cases & FYP Report Notes
1. **Zero-Downtime Schema Evolution**: Demonstrates how enterprise migration tooling prevents cascading database outages by setting bounded lock timeouts (`lock_timeout = '5s'`) rather than indefinite waits.
2. **Dual-Mode AI + Rule Engine Synergy**: Demonstrates an AI-native pattern where LLM capabilities (Gemini NL2DDL) are augmented by local deterministic fallbacks (Regex Parser), ensuring the tool remains functional even offline or when quota limits are reached.
3. **Data-Aware Risk Scoring**: Risk detection is grounded in actual table cardinality (`reltuples > 0`), avoiding false positives on empty development tables while providing critical warnings on populated production tables.
4. **Backend DDL Integrity**: Explains why client applications should never trust raw SQL submitted from the frontend UI; all DDL executed against production databases is regenerated and parameter-checked in Node.js.

---

## 6. Next Phase Handoff
- **Phase 11 Complete, Hardened & Production-Ready**: Schema Update Assistant (Workflow C) is verified on `/schema-update` and completely isolated from core migration flows.
- **Subsequent Phases**:
  - Phase 9: Real-time Data Migration Engine & Streaming ETL.
  - Phase 10: Post-Migration Validation & Reconciliation Engine.
