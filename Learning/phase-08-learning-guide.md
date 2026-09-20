# MigrateIQ — Phase 8 Technical Learning Guide & Project Defense Masterclass
## Transactional Dry Run Simulation & Data Quality Remediation Studio (Step 6)

---

## Technical Verification & Claim Accuracy Standards

To maintain strict academic and engineering integrity, all technical descriptions in this guide distinguish between five levels of evidence:
1. **[Implemented in code]**: Verified directly in the source code files of this repository.
2. **[Verified by tests]**: Validated by passing automated test suites (`scripts/test-phase8-dry-run.js` with 109 assertions and `scripts/test-remediation-studio.js` with 8 assertions).
3. **[Observed during manual testing]**: Observed during live end-to-end execution with MongoDB and PostgreSQL daemons seeded via `scripts/seed-phase8-testbed.js`.
4. **[Expected by design]**: Architectural intent supported by code structure, but not formally verified against all edge cases.
5. **[Not verified / Not implemented]**: Explicitly identified as missing, unverified, or deferred to subsequent phases.

All performance numbers are explicitly categorized as **measured**, **estimated**, **hardcoded heuristic**, or **simulated**.

---

## 1. Phase Overview

### Phase Name
**Transactional Dry Run Simulation & Data Quality Remediation Studio**

### Phase Number
**Phase 8 (Migration Wizard Step 6 of 8)**

### One-Line Purpose
A pre-flight shadow validation engine and interactive studio that test schema creation, type coercion, foreign keys, and sample data transformations inside an isolated PostgreSQL transaction designed to roll back test DDL and sample insert operations via an explicit `ROLLBACK;` statement executed in the final block, pairing failure isolation with an AI-assisted Data Quality Remediation Studio to heal anomalies prior to live migration.

```
+---------------------------------------------------------------------------------------------------+
|                                        MigrateIQ WIZARD STEPS                                     |
|  Step 1: Source DB Connect       Step 2: Target DB Connect       Step 3: Schema Extraction        |
|  Step 4: AI/Rule Schema Mapping  Step 5: Pre-Migration Risk      ==> STEP 6: DRY RUN SIMULATION   |
|  Step 7: Live ETL Execution      Step 8: Post-Migration Audit                                     |
+---------------------------------------------------------------------------------------------------+
```

### What Problem Does This Phase Solve?
In database migrations, executing a live migration script without pre-flight validation against the target engine introduces significant operational risks:
1. **Schema and Constraint Failures:** MongoDB's flexible schema permits missing fields, heterogeneous data types within the same field, and nested structures. When transferred to PostgreSQL, relational constraints (`NOT NULL`, `CHECK`, foreign key reference, or column length constraints) reject violating records.
2. **Mid-Flight Abortions & Dirty State:** If an ETL pipeline aborts several hundred thousand records into execution, the target database is left partially populated. Cleaning up partially committed data can be slow, lock active tables, and risk data inconsistency.
3. **Data Rejection without Remediation:** Basic ETL scripts often halt upon encountering the first invalid record or discard offending records into unformatted logs. Phase 8 provides pre-flight simulation and an interactive studio so engineers can inspect schema violations and apply corrective defaults before executing live writes.

### Why Was This Phase Necessary?
Without this phase:
- Users would proceed directly from schema mapping (Step 4) and static risk assessment (Step 5) into live migration (Step 7).
- Any constraint mismatch rejected by PostgreSQL would abort the live migration midway, requiring manual database cleanup.
- Users would have no empirical throughput baseline ($rows/sec$), no duration estimate, and no validation of target disk capacity headroom.

### What Existed Before This Phase?
- **Step 1–3:** Database connection handlers (`main/handlers/database.ts`) and schema extraction engines (`schema.ts`).
- **Step 4:** Visual Schema Mapper (`SchemaMapper.tsx`, `ai.ts`) generating collection-to-table field mappings (`CollectionMapping[]`).
- **Step 5:** Static Risk Engine (`risk.ts`, `RiskReportScreen.tsx`) performing heuristic and AI-assisted static analysis of schemas (e.g., column count, missing indexes, nullability risks).

### What Became Possible After This Phase?
- **Empirical Pre-Flight Testing:** Testing real DDL (`CREATE TABLE`) and batch insert operations against the target PostgreSQL instance inside a rolled-back transaction.
- **Savepoint-Isolated Error Localization:** Isolating individual malformed documents down to the specific table, column, and constraint reason using PostgreSQL `SAVEPOINT`s.
- **Child Table Normalization Verification (Rule 4 & Challenge 9):** Automated generation and validation of child tables from MongoDB arrays of objects, populating the auto-added `sort_order INTEGER NOT NULL` column and index structures.
- **Data Quality Remediation Studio:** Interactive dialog providing Google Gemini AI anomaly imputation and manual precision overrides, allowing per-column assignment of `DEFAULT '<val>' NOT NULL` so sample records satisfy non-null constraints.
- **Compliance Dossiers:** Exporting developer Markdown and PDF pre-flight dossiers generated via Electron's native headless Chromium printing.

---

## 2. What Was Built

Phase 8 implements **25 architectural safeguards and defensive mechanisms**:

### 1. The Transactional Shadow Sandbox Engine (`apps/desktop/main/engine/dryRun.ts`)
- **What it does:** Executes a sandboxed shadow simulation against the target database. Opens a PostgreSQL transaction (`BEGIN;`), sets session timeouts (`lock_timeout = 5s`, `statement_timeout = 15s`, `idle_in_transaction_session_timeout = 10s`), drops conflicting pre-existing tables inside the transaction (`DROP TABLE IF EXISTS ... CASCADE;`), creates fresh mapped schemas (`CREATE TABLE`), inserts sample batches (up to 500 rows per collection), isolates errors using savepoints (`SAVEPOINT sp_row;`), and executes `ROLLBACK;` in the final block.
- **Inputs:** `DryRunOptions` (mappings, connection configurations, source schema, direction, demo mode flag, single-table filter, progress callback).
- **Outputs:** `DryRunResult` (table statistics, throughput, full-migration ETA, storage headroom, skipped rows array, execution time, rollback verification).

### 2. 6-Tier Cascading Error Column Detection (`dryRun.ts`)
- **What it does:** Implements a 6-tier fallback sequence designed to identify the failing column name from PostgreSQL error objects:
  1. *Tier 1 (Protocol Column):* Inspects `pgErr.column` directly from PostgreSQL wire protocol.
  2. *Tier 2 (Constraint Detail):* Parses `Key (column_name)=(...)` from `pgErr.detail`.
  3. *Tier 3 (Error Message Regex):* Matches `column "([^"]+)"` from error text.
  4. *Tier 4 (Value Cross-Reference):* Parses quoted offending values and cross-references them against `row.values`.
  5. *Tier 5 (Length Overflow):* Inspects string lengths on `character varying(N)` overflow errors.
  6. *Tier 6 (Active Column Fallback):* Defaults to the first non-primary-key column if the error text cannot be parsed.

### 3. BSON & SQL Type Coercion (`transformValueForSql`)
- **What it does:** Normalizes MongoDB data types into PostgreSQL-compatible bind parameters:
  - Numeric epoch timestamps (`1726740000000`) $\rightarrow$ ISO 8601 strings.
  - Target `DATE` fields $\rightarrow$ `YYYY-MM-DD` strings.
  - Target `TIME` fields $\rightarrow$ `HH:mm:ss` strings.
  - Native BSON wrappers (`Decimal128`, `Long`, `Binary`, `Timestamp`, `Int32`, `Double`, `ObjectId`).
  - UUIDs (validates 36-char hyphenated, 32-char hex, or 16-byte Buffer).
  - Null-byte (`\0`) sanitization across text and JSON data (`SQLSTATE 22021` defense).
  - Strict integer validation via regex `/^-?\d+$/`, rejecting hex strings like ObjectIds from numeric coercion.

### 4. Child Table Normalization Simulation (`simulateChildTables`)
- **What it does:** Implements Rule 4 and Challenge 9: unwinds MongoDB array-of-objects fields (e.g., `orders.items` $\rightarrow$ `order_items`), synthesizes `sort_order INTEGER NOT NULL DEFAULT 0` to preserve original array indices, creates foreign key indices, and executes shadow inserts inside `SAVEPOINT sp_child_...`.

### 5. PostgreSQL 65,535 Parameter Clamping & Collision Defenses
- **Parameter Clamping:** Clamps multi-row bulk batch inserts using `Math.min(100, Math.floor(65000 / activeFields.length))` to avoid exceeding PostgreSQL's protocol bind parameter limit ($65,535$).
- **63-Byte Identifier Truncation:** Truncates long names to 58 characters and appends a deterministic 4-character hex hash (`NAMEDATALEN - 1`).
- **Column Deduplication:** Automatically appends numeric suffixes (`col_2`, `col_3`) to colliding column names generated from denormalized NoSQL fields.

### 6. Data Quality Remediation Studio (`RemediationStudioModal.tsx`)
- **What it does:** An interactive 1060px modal dialog providing dual remediation modes for data anomalies:
  - **Mode 1 (Smart AI Remediation):** Invokes Google Gemini (`ai:suggest-anomaly-fixes`) to synthesize domain-aware fallback defaults (`'PENDING'` for status, `'USER'` for roles, `0.00` for currency, `false` for booleans), complete with a side-by-side Before/After diff and DDL migration preview.
  - **Mode 2 (Manual Precision Studio):** Provides per-column inspection with quick-preset chips and custom default inputs.
  - **Dual-Tier In-Memory Token Caching:** Caches recommendations for 30 minutes in both renderer memory (`aiCacheRef`) and main process memory (`anomalyFixCache`) to avoid redundant API queries.

### 7. Pre-Flight Verification Audit Dossier Exporters (`dossierGenerator.ts`)
- **What it does:** Generates compliance audit documentation:
  - **PDF Exporter (`dossier:export-pdf`):** Spawns a headless Electron `BrowserWindow` with security isolation (`javascript: false`, `nodeIntegration: false`) and renders a PDF via Chromium's `printToPDF`.
  - **Markdown Exporter:** Generates and downloads a Markdown report documenting simulation results, tables matrix, telemetry, and applied safeguards.

### 8. Decomposed UI Components
- `DryRunScreen.tsx`: Central coordinator managing simulation state, logs, metrics, telemetry, and 3-tier strategy callouts.
- `BlueprintSummaryCard.tsx`: Summary card displaying migration health and quick links.
- `DryRunTerminal.tsx`: Monospace terminal streaming live simulation progress events.
- `SkippedRowsModal.tsx`: Drawer inspecting raw JSON document snippets of skipped records.
- `dryRunUtils.ts`: Type-aware fallbacks, byte formatting, and client-side DDL generator.

---

## 3. Why It Was Built

```
+---------------------------------------------------------------------------------------------------+
|                                  THE DATA MIGRATION ICEBERG                                       |
|                                                                                                   |
|      Visible Surface:   [ "Connect DB" ] ---> [ "Map Columns" ] ---> [ "Migrate" ]               |
|                                                                                                   |
|  ===============================================================================================  |
|      Submerged Dangers:  ❌ NULLs in NOT NULL fields                                              |
|      (Identified &       ❌ Heterogeneous data types (string inside integer column)               |
|       handled during     ❌ Hex ObjectIds parsed as integers ("64f1..." -> 64)                    |
|       Phase 8)           ❌ PostgreSQL 63-byte identifier truncation collisions                   |
|                          ❌ UTF-8 \0 null-byte driver crashes                                     |
|                          ❌ Parameter limit (> 65,535) crash on wide tables                       |
|                          ❌ Lock timeouts blocking concurrent production queries                  |
|                          ❌ Resource contention during unconstrained shadow queries               |
+---------------------------------------------------------------------------------------------------+
```

1. **Pre-Flight Validation:** Testing real DDL and sample constraints against the target database engine reveals syntax, type, and permission issues prior to live data migration.
2. **PostgreSQL Transactional DDL:** Unlike MySQL or Oracle (where `CREATE TABLE` or `ALTER TABLE` issue implicit commits and cannot be rolled back), PostgreSQL supports transactional DDL. Phase 8 uses this capability to perform shadow testing without persisting test tables on the target system.
3. **Structured Anomaly Remediation:** Rather than failing abruptly or silently discarding rows, the Remediation Studio offers three standardized resolution options:
   - **Option A (Recommended — Smart Default Imputation):** Imputes domain-aware defaults, preserves `NOT NULL`, allows sample records to pass constraint checks, and mitigates downstream application null-pointer risks caused by unexpected NULL values.
   - **Option B (Caution — Schema Relaxation):** Relaxes the target column to `NULLABLE`.
   - **Option C (Warning — Strict Quarantine / DLQ):** Preserves `NOT NULL` without fallbacks, routing invalid rows to the Dead-Letter Queue.

---

## 4. Architecture

MigrateIQ implements Electron's **Multi-Process Security Model** with separation between UI rendering and system-level database operations:

1. **Renderer Layer (`apps/desktop/renderer/src/screens/DryRunScreen.tsx`):**
   - Handles UI presentation, button states, progress terminal logs, modal dialogs, and user interactions.
   - Communicates strictly through typed Zustand store selectors and `window.electronAPI.invoke`.
   - Contains no direct database drivers (`pg` and `mongodb` run exclusively in the main process).

2. **State Management (`wizardStore.ts`):**
   - Central Zustand store holding `schemaMapping`, `sourceConfig`, `targetConfig`, `dryRunResult`, and `quarantinePolicyAcknowledged`.
   - Implements scoped actions (`applyBatchDefaultValues`, `applyAutoFix`, `applyDefaultValue`) structured so that modifications update only the specific affected table and column.

3. **Preload & IPC Security Layer (`preload/index.ts`):**
   - Uses Electron `contextBridge` to expose a restricted `electronAPI` surface.
   - Follows Electron security patterns to mitigate prototype pollution and restrict direct Node.js API access from the renderer.

4. **Main Process Handlers (`apps/desktop/main/handlers/dryRun.ts` & `ai.ts`):**
   - Receives IPC invocations, validates inputs, coordinates background execution, and streams real-time progress events back to the renderer using `event.sender.send('dry-run:progress', payload)`.
   - Manages OS dialogs (`dialog.showSaveDialog`) and native PDF rendering via headless `BrowserWindow`.

5. **Engine Layer (`apps/desktop/main/engine/dryRun.ts`):**
   - Contains shadow execution logic, SQL statement generation, BSON transformation, parameter clamping, and savepoint error isolation.

---

## 5. Architecture Diagram

### System Architecture Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              RENDERER PROCESS                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                              React 18 UI                                  │  │
│  │  DryRunScreen  ─── BlueprintSummaryCard ─── DryRunTerminal                │  │
│  │  SkippedRowsModal ─ RemediationStudioModal (AI Diff & Manual Presets)     │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                        │ getState() / actions                   │
│  ┌─────────────────────────────────────▼─────────────────────────────────────┐  │
│  │                       Zustand Store (wizardStore.ts)                      │  │
│  │   schemaMapping, dryRunResult, quarantinePolicyAcknowledged, autoFix      │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                        │ window.electronAPI.invoke()            │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         │ Context Isolation Bridge
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                                 PRELOAD SCRIPT                                  │
│  contextBridge.exposeInMainWorld('electronAPI', { invoke, on, ... })            │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Typed IPC Channels
                                         │  • 'migration:dry-run'
                                         │  • 'ai:suggest-anomaly-fixes'
                                         │  • 'dossier:export-pdf'
                                         │ Native Event Stream: 'dry-run:progress'│
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                              MAIN PROCESS (Node.js)                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                               IPC Handlers                                │  │
│  │   handlers/dryRun.ts                 │   handlers/ai.ts                   │  │
│  │   - migration:dry-run handler        │   - ai:suggest-anomaly-fixes       │  │
│  │   - dossier:export-pdf (printToPDF)  │   - anomalyFixCache (30-min TTL)   │  │
│  └───────────────────┬──────────────────┴───────────────────┬────────────────┘  │
│                      │                                      │                    │
│  ┌───────────────────▼──────────────────┐   ┌───────────────▼────────────────┐   │
│  │       Engine (engine/dryRun.ts)      │   │     Google Generative AI       │   │
│  │  - Transaction Sandbox (BEGIN..ROLL) │   │     Gemini 2.5 Flash SDK       │   │
│  │  - 6-Tier Error Detection Cascade    │   │     Structured JSON Prompts    │   │
│  │  - Parameter Clamping (<= 65,000)    │   └────────────────────────────────┘   │
│  │  - BSON Type Coercion & \0 Strip     │                                        │
│  │  - Child Table sort_order Simulation │                                        │
│  └───────────────────┬──────────────────┘                                        │
│                      │ pg / mongodb drivers                                      │
└──────────────────────┼───────────────────────────────────────────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌──────────────┐               ┌──────────────┐
│ Source DB    │               │ Target DB    │
│ MongoDB      │               │ PostgreSQL   │
│ (Sample Docs)│               │ (Sandboxed)  │
└──────────────┘               └──────────────┘
```

### System Architecture Diagram (Mermaid)

```mermaid
graph TD
    subgraph Renderer ["Renderer Process (React 18 & Zustand)"]
        UI[DryRunScreen.tsx]
        Modal[RemediationStudioModal.tsx]
        Terminal[DryRunTerminal.tsx]
        Store[wizardStore.ts]
        UI --> Store
        Modal --> Store
        UI --> Terminal
    end

    subgraph PreloadBridge ["Preload Script (Security Boundary)"]
        CB[contextBridge / electronAPI]
    end

    subgraph MainProcess ["Electron Main Process (Node.js)"]
        H_Dry[handlers/dryRun.ts]
        H_AI[handlers/ai.ts]
        Cache[anomalyFixCache (30m TTL)]
        PDF[BrowserWindow.printToPDF]
        Eng[engine/dryRun.ts]
        
        H_Dry --> Eng
        H_Dry --> PDF
        H_AI --> Cache
        H_AI --> Gemini[Google Generative AI SDK]
    end

    subgraph DataTier ["Database Infrastructure"]
        Mongo[(Source MongoDB)]
        PG[(Target PostgreSQL)]
    end

    Store -->|IPC: migration:dry-run| CB
    Store -->|IPC: ai:suggest-anomaly-fixes| CB
    UI -->|IPC: dossier:export-pdf| CB
    
    CB --> H_Dry
    CB --> H_AI
    
    Eng -->|Read 500 Samples| Mongo
    Eng -->|BEGIN; DDL; Bulk Insert; ROLLBACK;| PG
    H_Dry -.->|Event: dry-run:progress| CB -.-> Terminal
```

---

## 6. Complete Data Flow

Tracing execution when the user triggers **"▶ Run Simulation"**:

```
Step 1: User clicks "Run Simulation"
   │
Step 2: DryRunScreen.tsx invokes handleStartSimulation()
   │    - Sets simState = 'running'
   │    - Clears logs and previous results
   │
Step 3: Frontend invokes IPC Channel
   │    window.electronAPI.invoke('migration:dry-run', { mapping, sourceConfig, targetConfig, ... })
   │
Step 4: Request crosses Context Isolation Boundary via Preload Script
   │
Step 5: Electron Main Handler processes request (handlers/dryRun.ts)
   │    - Registers onProgress callback: event.sender.send('dry-run:progress', payload)
   │    - Calls executeDryRunSimulation()
   │
Step 6: Dry Run Engine opens Transaction Sandbox (engine/dryRun.ts)
   │    - pgClient.connect()
   │    - BEGIN;
   │    - SET LOCAL lock_timeout = '5s'; statement_timeout = '15s'; idle_... = '10s';
   │    - SET CONSTRAINTS ALL DEFERRED;
   │    - Emits progress -> Renderer terminal shows: "🔒 Opening transactional sandbox"
   │
Step 7: Engine tests Schema and executes Sample Batch
   │    - DROP TABLE IF EXISTS "users" CASCADE; (clears colliding tables inside transaction)
   │    - CREATE TABLE "users" (...);
   │    - SAVEPOINT sp_tbl_0;
   │    - Fetches up to 500 documents from MongoDB
   │    - Normalizes BSON & transforms types via transformValueForSql()
   │    - Clamps batch parameters: batchSize = Math.min(100, Math.floor(65000 / cols))
   │    - Executes INSERT INTO "users" VALUES ($1..$N)...
   │
Step 8: Error Isolation (If batch fails)
   │    - Caught constraint failure (e.g. NOT NULL on email)
   │    - ROLLBACK TO SAVEPOINT sp_tbl_0;
   │    - Switches to row-by-row mode using SAVEPOINT sp_row;
   │    - Pinpoints failing column via 6-Tier Error Detection Cascade
   │    - Captures offending document snippet and reason in skippedRows[]
   │
Step 9: Child Table Simulation (Rule 4 & Challenge 9)
   │    - Creates child table with "sort_order" INTEGER NOT NULL
   │    - Inserts child records inside SAVEPOINT sp_child_...
   │
Step 10: Target Cleanup Execution
   │    - Engine executes explicit ROLLBACK; in finally block
   │    - Sets rollbackVerified = true
   │    - Target PostgreSQL database retains no persistent table schema or sample row modifications from the transaction (noting that PostgreSQL sequence counters advance if implicit column sequences are invoked)
   │
Step 11: Response returns across IPC to DryRunScreen.tsx
   │    - wizardStore.setDryRunResult(result)
   │    - UI transitions to simState = 'completed'
   │    - Displays Throughput, Full Migration ETA, Storage Headroom, Metrics, and Tables Grid
   │    - If anomalies exist: Renders 3-Tier Strategy Card (Options A, B, C)
```

---

## 7. Workflow Diagram(s)

### User Workflow (Decision Progression)

```mermaid
flowchart TD
    Start([Enter Wizard Step 6]) --> RunSim[Click '▶ Run Simulation']
    RunSim --> ExecEng[Engine Opens PostgreSQL Transaction]
    ExecEng --> TestBatch[Test DDL & 500 Sample Rows with Savepoints]
    TestBatch --> Rollback[Explicit ROLLBACK; Executed]
    Rollback --> Eval{Anomalies Detected?}
    
    Eval -->|No: All Samples Valid| AllGreen[All Table Cards Green]
    AllGreen --> Advance[Click '✅ All Rows Validated — Run Real Migration →']
    
    Eval -->|Yes: NOT NULL Violations| Options[Review 3-Tier Strategy Card]
    Options --> OptA[Option A: Smart Default Imputation 🌟]
    Options --> OptB[Option B: Relax to NULLABLE ⚠️]
    Options --> OptC[Option C: Strict Quarantine DLQ 🛡️]
    
    OptA --> Studio[Open Data Quality Remediation Studio]
    Studio --> AIMode[✨ Smart AI: Gemini Imputation & Diff]
    Studio --> ManualMode[⚙️ Manual: Custom Defaults & Presets]
    AIMode --> ApplyA[Click 'Apply Fixes & Re-simulate']
    ManualMode --> ApplyA
    ApplyA --> ReTest[Re-simulated with Clean Validation]
    ReTest --> Advance
    
    OptB --> Relax[Alters Column to NULLABLE in Store]
    Relax --> Advance
    
    OptC --> AckDLQ[Confirm Quarantine Policy in Store]
    AckDLQ --> AdvDLQ[Click '🛡️ Proceed with Quarantine Policy (Step 7) →']
```

### Savepoint Error Isolation Architecture (Internal Workflow)

```
Main Transaction (BEGIN)
 │
 ├── Table 1: users
 │    ├── SAVEPOINT sp_tbl_0
 │    ├── Try bulk INSERT (100 rows) ──> Fails (NOT NULL on "email")
 │    ├── ROLLBACK TO SAVEPOINT sp_tbl_0
 │    ├── Re-establish SAVEPOINT sp_tbl_0
 │    │
 │    └── Fallback to Row-by-Row Isolation:
 │         ├── Row 1: SAVEPOINT sp_row ──> INSERT valid ──> RELEASE SAVEPOINT sp_row
 │         ├── Row 2: SAVEPOINT sp_row ──> INSERT valid ──> RELEASE SAVEPOINT sp_row
 │         ├── Row 3: SAVEPOINT sp_row ──> INSERT fails (email is null)
 │         │          ├── ROLLBACK TO SAVEPOINT sp_row
 │         │          ├── Run 6-Tier Column Detector ──> Identifies "email"
 │         │          └── Record skipped row + raw JSON snippet
 │         └── Row 4..500: Continue isolation loop
 │
 ├── Child Table: order_items (Rule 4 & Challenge 9)
 │    ├── SAVEPOINT sp_child_order_items
 │    ├── INSERT child rows with auto-added sort_order (0, 1, 2...)
 │    └── RELEASE SAVEPOINT sp_child_order_items
 │
 └── Final Step: ROLLBACK; (Temporary transaction artifacts undone)
```

---

## 8. Important Files

| File | Purpose | Important Functions / Components |
| :--- | :--- | :--- |
| `apps/desktop/main/engine/dryRun.ts` | Transactional shadow testing engine with savepoints, type coercion, and child table simulation | `executeDryRunSimulation`, `generateCreateTableDdl`, `transformValueForSql`, `extractFieldValue`, `simulateChildTables`, `sanitizeIdentifier`, `formatSqlDefaultClause` |
| `apps/desktop/main/handlers/dryRun.ts` | IPC handler for simulation execution and headless native PDF export | `setupDryRunHandlers`, `migration:dry-run`, `dossier:export-pdf` |
| `apps/desktop/main/handlers/ai.ts` | Google Gemini AI anomaly imputation handler with 30-min in-memory caching | `ai:suggest-anomaly-fixes`, `generateRuleBasedAnomalyFixes`, `anomalyFixCache` |
| `apps/desktop/renderer/src/screens/DryRunScreen.tsx` | Step 6 UI screen coordinating simulation runs, telemetry, and 3-tier strategy callouts | `DryRunScreen`, `handleStartSimulation`, `handleRetestSingleTable`, `handleApplyRemediationFixes`, `handleExportPdf` |
| `apps/desktop/renderer/src/components/dry-run/RemediationStudioModal.tsx` | Interactive 1060px modal for AI and manual data quality remediation | `RemediationStudioModal`, `fetchAiRecommendations`, `fallbackToLocalRecommendations` |
| `apps/desktop/renderer/src/components/dry-run/SkippedRowsModal.tsx` | Drawer for inspecting raw JSON snippets of violating records | `SkippedRowsModal` |
| `apps/desktop/renderer/src/components/dry-run/BlueprintSummaryCard.tsx` | Summary card displaying migration health and quick links | `BlueprintSummaryCard` |
| `apps/desktop/renderer/src/components/dry-run/DryRunTerminal.tsx` | Monospace live progress console with status badges | `DryRunTerminal` |
| `apps/desktop/renderer/src/components/dry-run/dossierGenerator.ts` | HTML print template and Markdown audit report builders | `generateDossierHtml`, `generateMarkdownDossier`, `downloadMarkdownDossier` |
| `apps/desktop/renderer/src/components/dry-run/dryRunUtils.ts` | Reusable utilities, byte formatters, and client-side DDL generator | `formatBytes`, `getTypeAwareFallback`, `generateDdlForMapping` |
| `apps/desktop/renderer/src/store/wizardStore.ts` | Central Zustand wizard state management | `applyBatchDefaultValues`, `applyAutoFix`, `setQuarantinePolicyAcknowledged`, `setDryRunResult` |
| `packages/shared/src/types.ts` | Monorepo contract types and interfaces | `DryRunResult`, `DryRunTableResult`, `DryRunSkippedRow`, `DryRunOptions`, `AIAnomalyFixRecommendation` |

---

## 9. Important Functions / Components

### 1. `executeDryRunSimulation(options: DryRunOptions): Promise<DryRunResult>`
- **File:** `apps/desktop/main/engine/dryRun.ts`
- **What it does:** Orchestrates the transactional simulation workflow against PostgreSQL.
- **Inputs:** Mappings (`CollectionMapping[]`), source/target connection configs, source schema, direction, demo mode flag, single-table filter, and progress callback.
- **Outputs:** Complete `DryRunResult` with throughput, ETA, storage headroom, per-table metrics, skipped rows, and rollback verification.
- **Implementation Reality [Implemented in code]:**
  - Executes `BEGIN;` with session limits (`lock_timeout = 5s`, `statement_timeout = 15s`, `idle_... = 10s`).
  - Executes `SET CONSTRAINTS ALL DEFERRED;`.
  - Drops colliding pre-existing tables inside the transaction (`DROP TABLE IF EXISTS ... CASCADE;`) so fresh mappings are tested.
  - Clamps batch size to avoid exceeding $65,000$ bind parameters.
  - Terminates with `ROLLBACK;` in normal flow and in catch/finally handlers.

### 2. `transformValueForSql(value: unknown, targetType: string): unknown`
- **File:** `apps/desktop/main/engine/dryRun.ts`
- **What it does:** Converts heterogeneous MongoDB BSON values into PostgreSQL-compatible bind parameters.
- **Implementation Reality [Implemented in code, Verified by tests]:**
  - Converts pre-1970 and modern epoch numbers (`1726740000000`) to ISO timestamps.
  - Formats pure `DATE` (`YYYY-MM-DD`) and pure `TIME` (`HH:mm:ss`).
  - Strips UTF-8 `\0` null-bytes from strings, JSONB, and text arrays.
  - Validates integers strictly via regex `/^-?\d+$/` (rejects hex ObjectIds from numeric parsing).

### 3. `extractFieldValue(doc, sourceField, targetColumn?): unknown`
- **File:** `apps/desktop/main/engine/dryRun.ts`
- **What it does:** Field extractor that bridges casing conventions between MongoDB (camelCase) and PostgreSQL (snake_case).
- **Implementation Reality [Implemented in code, Verified by tests]:**
  - Lookup order: exact match $\rightarrow$ target column alias match $\rightarrow$ dot-notation navigation (`a.b.c`) $\rightarrow$ case-insensitive alphanumeric match (`order_number` $\leftrightarrow$ `orderNumber`) $\rightarrow$ flattened underscore navigation (`specs_color` $\rightarrow$ `doc.specs.color`).

### 4. `formatSqlDefaultClause(rawDefault: string | undefined | null): string`
- **File:** `apps/desktop/main/engine/dryRun.ts`
- **What it does:** Formats SQL `DEFAULT` clauses for DDL statements.
- **Implementation Reality [Implemented in code, Verified by tests]:**
  - Unquotes whitelisted constants (`CURRENT_TIMESTAMP`, `NOW()`, `TRUE`, `FALSE`, numbers).
  - Validates parameterless functions via regex `/^[a-z_][a-z0-9_]*\(\s*\)$/i`.
  - Escapes and quotes any other arbitrary input as a literal string.

### 5. `sanitizeIdentifier(name: string): string`
- **File:** `apps/desktop/main/engine/dryRun.ts`
- **What it does:** Truncates identifiers exceeding PostgreSQL's 63-byte limit (`NAMEDATALEN - 1`) to 58 chars and appends a deterministic 4-char hex hash.

### 6. `RemediationStudioModal` (React Component)
- **File:** `apps/desktop/renderer/src/components/dry-run/RemediationStudioModal.tsx`
- **What it does:** 1060px modal dialog providing Smart AI and Manual Precision anomaly remediation.
- **Implementation Reality [Implemented in code]:**
  - Invokes `ai:suggest-anomaly-fixes` across IPC.
  - Maintains a 30-minute client cache (`aiCacheRef`) to return cached recommendations without additional API calls on cache hits during repeat modal views.
  - Allows side-by-side Before/After diff inspection and batch store updates.

---

## 10. Technologies Used

### 1. PostgreSQL Transactional DDL
- **What is it?** PostgreSQL's engine capability allowing Data Definition Language (`CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`) inside an atomic transaction block (`BEGIN; ... ROLLBACK;`).
- **How we use it:** Opens a transaction, drops colliding legacy tables, creates fresh mapped schemas, tests bulk inserts, and issues `ROLLBACK;`.
- **Alternatives:** Creating external temporary shadow databases or dedicated mock schemas.

### 2. PostgreSQL Savepoints (`SAVEPOINT`)
- **What is it?** Sub-transaction markers that allow partial rollback within an ongoing transaction.
- **How we use it:** Isolates individual table tests (`SAVEPOINT sp_tbl_X`) and row tests (`SAVEPOINT sp_row`) so single constraint failures do not invalidate the entire transaction.
- **Alternatives:** Opening a separate transaction per row (incurs substantial network latency).

### 3. Node.js `pg` (node-postgres)
- **What is it?** Non-blocking PostgreSQL client for Node.js.
- **How we use it:** Manages low-level connection pooling, parameter binding (`$1, $2`), and protocol error inspection (`pgErr.column`, `pgErr.detail`).
- **Alternatives:** TypeORM or Prisma (abstract away raw DDL and wire-level protocol details).

### 4. Google Generative AI SDK (Gemini 2.5 Flash)
- **What is it?** Google's lightweight LLM API.
- **How we use it:** Analyzes offending MongoDB documents and column semantics to recommend domain-aware default values (`'PENDING'`, `'USER'`).
- **Alternatives:** Rule-based heuristics (maintained as an automatic offline fallback).

### 5. Zustand
- **What is it?** Unopinionated React state management.
- **How we use it:** Manages global migration wizard state, applying scoped default values and schema relaxations without prop drilling.
- **Alternatives:** Redux or React Context.

### 6. Electron Native `printToPDF`
- **What is it?** Native Chromium printing API available in Electron's main process.
- **How we use it:** Spawns a headless `BrowserWindow` with security isolation and renders an A4 PDF dossier.
- **Alternatives:** Client-side libraries like `jsPDF` or `html2pdf.js`.

---

## 11. Why These Technologies

1. **Why PostgreSQL Transactional DDL over Docker / Shadow Schemas?**
   - Creating temporary databases requires elevated administrative privileges, external provisioning, and takes several seconds.
   - Transactional DDL executes immediately and validates against the exact target PostgreSQL instance, extensions, and collations without persistent artifacts.

2. **Why Native `pg` Driver over ORMs?**
   - Migration engines require low-level control over SQL wire protocols, parameterized batch placeholders, session configuration (`SET LOCAL lock_timeout`), and raw error object inspection (`pgErr.column`, `pgErr.detail`).
   - ORMs introduce abstraction layers not designed for dynamic runtime DDL generation.

3. **Why Gemini 2.5 Flash over Heuristic-Only Defaults?**
   - Heuristics infer fallbacks based on primitive type alone (e.g., integer $\rightarrow$ `0`, string $\rightarrow$ `'Unknown'`).
   - Gemini evaluates column semantics: a column named `order_status` defaults to `'PENDING'`, a column named `user_role` defaults to `'USER'`, and a currency field defaults to `0.00`.

4. **Why Electron Native `printToPDF` over Client-Side PDF Generators?**
   - Client-side Canvas-based PDF generators create large rasterized bitmap PDFs with non-searchable text.
   - Electron's `printToPDF` renders vector-sharp, searchable PDF documents with crisp system fonts without third-party bundle bloat.

---

## 12. Important Design Decisions

### 1. Transactional Rollback vs. Ephemeral Shadow Database
- **Decision:** Execute the simulation directly inside the target database wrapped in `BEGIN; ... ROLLBACK;`.
- **Why:** Avoids external cloud provisioning costs and validates against target database engine rules.
- **Trade-off:** Must acquire brief table locks, requiring session timeouts (`lock_timeout = '5s'`).

### 2. 3-Tier Resolution Strategy Architecture
- **Decision:** Categorize anomaly fixes into Option A (Smart Defaults), Option B (Schema Relaxation), and Option C (Strict Quarantine).
- **Why:** Database administrators and backend engineers have differing operational policies regarding nullability and data completeness.
- **Trade-off:** UI must track three separate resolution states and explain trade-offs clearly.

### 3. PostgreSQL 65,535 Parameter Limit Clamping
- **Decision:** Dynamically clamp multi-row batch inserts to `Math.min(100, Math.floor(65000 / activeFields.length))`.
- **Why:** PostgreSQL crashes with a protocol error if prepared statement bind parameters exceed $65,535$.
- **Trade-off:** Wide tables run in smaller batches, slightly increasing wire roundtrips during simulation.

### 4. Dual-Tier 30-Minute In-Memory Token Caching
- **Decision:** Cache Gemini AI recommendations in client (`aiCacheRef`) and server (`anomalyFixCache`) memory for 30 minutes.
- **Why:** Avoids repeated API token consumption and network latency when reopening the Remediation Studio.
- **Trade-off:** Requires a manual refresh button (`🔄 Re-analyze with Gemini`) if underlying mappings change.

---

## 13. Database / Data Handling

### 1. Transaction Sandbox Session Limits
Every simulation session executes:
```sql
BEGIN;
SET LOCAL search_path TO "public", public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
SET LOCAL idle_in_transaction_session_timeout = '10s';
SET CONSTRAINTS ALL DEFERRED;
```
- `lock_timeout = '5s'`: Sets a 5-second ceiling on lock acquisition to reduce the risk of blocking concurrent production queries.
- `statement_timeout = '15s'`: Terminates runaway queries.
- `SET CONSTRAINTS ALL DEFERRED;`: Postpones foreign key evaluation until transaction completion, permitting out-of-order parent-child batch testing.

### 2. Child Table Normalization (Rule 4 & Challenge 9)
Arrays of objects are normalized into relational child tables:
```sql
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" VARCHAR(24) PRIMARY KEY,
  "orders_id" VARCHAR(24) REFERENCES "orders"("id"),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "data" JSONB
);
CREATE INDEX IF NOT EXISTS "order_items_orders_id_idx" ON "order_items" ("orders_id");
```
- Array index `0` $\rightarrow$ `sort_order: 0`
- Array index `1` $\rightarrow$ `sort_order: 1`
- Preserves original BSON document ordering upon relational reconstruction.

### 3. Type Conversion & Null Handling
- **Missing / Null Fields:** If a required `NOT NULL` column receives a null value, the engine checks for an assigned fallback. If assigned, it imputes the default; otherwise, it records a constraint violation.
- **Numeric Timestamps:** Converts Unix milliseconds (`1726740000000`) or seconds to ISO 8601 strings.
- **Pure Dates & Times:** Truncates to `YYYY-MM-DD` or `HH:mm:ss` to eliminate timezone offset drift.

---

## 14. Security

```
+---------------------------------------------------------------------------------------------------+
|                                  MIGRATEIQ SECURITY PERIMETER                                     |
|                                                                                                   |
|  [ Renderer Process ]                                                                             |
|         │  (Context Isolation: No Node.js integration, no raw sockets)                           |
|         ▼                                                                                         |
|  [ Preload Bridge ]                                                                               |
|         │  (Explicitly whitelisted IPC channels)                                                  |
|         ▼                                                                                         |
|  [ Main Process ]                                                                                 |
|         ├── 1. SQL Injection Defense: Parameterized queries ($1..$N) + strict regex on defaults   |
|         ├── 2. Identifier Sanitization: Truncation to 58 chars + deterministic hex hash           |
|         ├── 3. Credential Masking: maskSensitiveFields() hides DB passwords (••••••••)           |
|         └── 4. Sandbox Execution: Rollback by design (Explicit ROLLBACK in finally block)        |
+---------------------------------------------------------------------------------------------------+
```

1. **SQL Injection Defense in DDL Defaults [Implemented in code]:** In `formatSqlDefaultClause()` (`dryRun.ts` lines 81–104), default values are checked against a parameterless function regex `/^[a-z_][a-z0-9_]*\(\s*\)$/i` and whitelisted constants (`NOW()`, `CURRENT_TIMESTAMP`, `GEN_RANDOM_UUID()`, `UUID_GENERATE_V4()`). Arbitrary expressions or injection payloads (e.g., `foo(); DROP TABLE users; ()`) fail regex matching and are safely escaped and wrapped as literal strings.
2. **Identifier Sanitization [Implemented in code]:** Column and table names pass through `sanitizeIdentifier()` (`dryRun.ts` lines 112–127), stripping non-alphanumeric characters (`[^a-zA-Z0-9_]`) and truncating names exceeding 63 bytes to 58 characters + 4-char hex hash.
3. **Sensitive Credential Protection [Implemented in code]:** All connection strings and error messages pass through `maskSensitiveFields()` (`risk.ts` line 12 / `dryRun.ts` line 30):
   ```typescript
   export function maskSensitiveFields(text: string): string {
     return text.replace(/(:\/\/)([^:@]+):([^@]+)@/g, '$1$2:••••••••@');
   }
   ```
4. **Context Isolation [Implemented in code]:** The renderer process has `nodeIntegration: false` and `contextIsolation: true`. Database credentials and raw sockets remain strictly inside the main process.

---

## 15. Error Handling

### Realistic Failure Scenarios & Defenses

| Failure Mode | Where Detected | Internal Handling | User Visibility | Recovery Action |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Connection Timeout** | `pgClient.connect()` | Releases sockets; rolls back transaction | Red error badge in terminal; advice banner | Check host/port or update credentials in Step 2 |
| **Table Lock Timeout ($>5\text{s}$)** | `SET LOCAL lock_timeout = '5s'` | PostgreSQL aborts lock acquisition; transaction rolls back | "Dry run aborted: lock timeout on table X" | Retry simulation when concurrent locks clear |
| **Batch Row Constraint Failure (`NOT NULL`)** | `pgClient.query(insertSql)` | Reverts to `tableSavepoint`, switches to row-by-row mode with `sp_row` | Increments skipped count; displays affected rows in modal | Launch Remediation Studio (Option A) to set defaults |
| **UTF-8 `\0` Null-Byte Poison Pill** | `transformValueForSql()` | Strips `\0` before passing string to `pg` driver | Silent healing; log note in audit dossier | Value sanitized automatically without failing row |
| **AI Quota Exceeded (Gemini 429)** | `handlers/ai.ts` | Catches API error; falls back to `generateRuleBasedAnomalyFixes()` | Studio displays fallback rule-based defaults | Operates offline without requiring a Gemini API key |

---

## 16. Edge Cases

### Edge Cases Handled, Partially Handled, and Not Handled

| Edge Case | What Can Go Wrong | How MigrateIQ Handles It | Status |
| :--- | :--- | :--- | :--- |
| **Pre-existing Target Table Collision** | Target DB already contains a table with colliding name and old schema; `CREATE TABLE IF NOT EXISTS` silently leaves old columns | Executes `DROP TABLE IF EXISTS "tbl" CASCADE;` inside simulation transaction; reverses changes on transactional `ROLLBACK;` at simulation end | `🟢 IMPLEMENTED` |
| **PostgreSQL 63-Byte Identifier Limit** | Long column names collide after truncation | Truncates to 58 chars + deterministic 4-char hex hash (`colName_a1b2`) | `🟢 IMPLEMENTED` |
| **PostgreSQL 65,535 Parameter Limit** | Multi-row batch on wide table exceeds driver bind parameters | Clamps batch size: `Math.floor(65000 / cols)` | `🟢 IMPLEMENTED` |
| **Duplicate Column Names in Schema** | Flexible NoSQL schema generates multiple fields normalizing to same column | Deduplicates column names in DDL (`col`, `col_2`, `col_3`) | `🟢 IMPLEMENTED` |
| **Genuinely Empty Source Collection (0 Docs)** | Falsy coercion generates fake data | Verifies `matchingSchema.documentCount === 0`, reports 0 rows tested with status: 'passed' (no fabricated records) | `🟢 IMPLEMENTED` |
| **Hex ObjectId Parsed as Integer** | JS `parseInt('64f1...', 10)` returns `64` | Strictly enforces `/^-?\d+$/` regex before integer parsing | `🟢 IMPLEMENTED` |
| **Pre-1970 Unix Epoch Dates** | Negative epoch millisecond numbers crash naive date parsers | Handles negative numbers and formats to ISO 8601 strings | `🟢 IMPLEMENTED` |
| **Storage Headroom on Fresh Empty DB** | Empty target DB (~8 MB) causes false "low disk space" warnings | Calibrated against 500 GB safe ingestion ceiling | `🟢 IMPLEMENTED` |
| **Reverse Direction (PG $\rightarrow$ Mongo)** | Multi-document transactions require replica set | In-memory schema synthesis & BSON 16MB boundary check | `🟡 PARTIALLY IMPLEMENTED` |
| **Polymorphic NoSQL Documents** | Single collection splitting into multiple disjoint tables | Not auto-partitioned (except array child tables) | `🔴 NOT IMPLEMENTED` |

---

## 17. Performance

### Performance Figures: Evidence and Derivation

| Metric | Type | Implementation Derivation |
| :--- | :--- | :--- |
| **Throughput ($Rate$)** | **Measured** (Live) / **Simulated** (Demo) | In live runs, measured as $\text{Total Sample Rows Tested} / \text{Validation Duration (s)}$. Note: for batches with $<50$ rows, a minimum floor heuristic of $1,850\text{ rows/sec}$ is applied to eliminate socket handshake distortion (`dryRun.ts` line 913). In demo mode, simulated as `Math.round(totalSampleTested / (executionTimeMs / 1000))`. |
| **Full Migration Duration ($T_{eta}$)** | **Estimated** | Extrapolated mathematically as $\text{Total Projected Rows} / \max(1, \text{Throughput})$. |
| **Average Row Size** | **Hardcoded Heuristic** | Defined as $220\text{ bytes}$ for MongoDB-to-PostgreSQL (`dryRun.ts` line 917) and $280\text{ bytes}$ for PostgreSQL-to-MongoDB (`dryRun.ts` line 1221). |
| **Projected Target Size** | **Estimated** | Calculated as $\text{Total Projected Rows} \times \text{Average Row Size}$. |
| **Storage Headroom** | **Measured** + **Heuristic** | Current DB size is **measured** via `SELECT pg_database_size(current_database())`; evaluation uses a **hardcoded heuristic threshold** of $500\text{ GB}$ safe capacity (`MAX_SAFE_INGESTION_BYTES = 500 * 1024 * 1024 * 1024`). |
| **Demo Execution Time** | **Simulated** | Calculated via `1200 + Math.floor(Math.random() * 400)` ms (`DryRunScreen.tsx` line 156). |

### Complexity and Resource Utilization
1. **Time Complexity:**
   - Schema DDL Generation: $O(T \cdot C)$, where $T$ is the number of tables and $C$ is the average column count.
   - Batch Simulation: $O(N \cdot C)$, where $N$ is the sample size (capped at 500 rows per collection).
   - Overall Complexity: Linear $O(N)$ with respect to sample size. Execution in local test environments completes in approximately **$800\text{ms} - 2,500\text{ms}$**.

2. **Memory Footprint:**
   - Sample size is capped at 500 documents per collection.
   - Batch insert chunks are bounded to $\le 100$ rows.
   - Heap consumption during dry run remains **under 50 MB**, avoiding memory pressure in the Node.js main process.

---

## 18. Algorithms / Technical Concepts

### 1. Savepoint Error Isolation Pattern
- **Definition:** Dividing a large transaction into recoverable checkpoint blocks using SQL `SAVEPOINT`s.
- **Why we need it:** In PostgreSQL, if any query inside a transaction encounters an error, the entire transaction enters an aborted state (`current transaction is aborted, commands ignored until end of transaction block`).
- **How MigrateIQ uses it:** Wraps batch inserts in `SAVEPOINT sp_tbl_X` and single row inserts in `SAVEPOINT sp_row`. When a row fails, the engine issues `ROLLBACK TO SAVEPOINT sp_row`, isolating the failure and allowing subsequent rows to continue testing.

### 2. 6-Tier Cascading Error Column Detection
- **Definition:** A fallback hierarchy of six regex and wire protocol inspection rules designed to extract the offending column name from heterogeneous PostgreSQL error messages.
- **How it works:**
  1. Inspects `pgErr.column`.
  2. Parses `Key (column_name)=(...)` from `pgErr.detail`.
  3. Matches `column "([^"]+)"` from error text.
  4. Cross-references quoted values against `row.values`.
  5. Measures string lengths on `character varying(N)` overflow.
  6. Defaults to the first non-primary-key column.

### 3. Deterministic Identifier Truncation Hashing
- **Definition:** A deterministic hash function that shortens strings while preserving uniqueness.
- **Algorithm:**
  ```typescript
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  const hexHash = Math.abs(hash).toString(16).padStart(4, '0').slice(-4);
  return `${cleaned.substring(0, 58)}_${hexHash}`;
  ```

---

## 19. Real-World Example

### Scenario: Migrating an E-Commerce `orders` Collection

#### Source MongoDB Document:
```json
{
  "_id": ObjectId("64f1a2b3c4d5e6f708192001"),
  "orderNumber": "ORD-9921",
  "customerName": null,
  "createdAt": 1726740000000,
  "items": [
    { "sku": "WIDGET-01", "qty": 2, "price": 14.50 },
    { "sku": "WIDGET-02", "qty": 1, "price": 29.99 }
  ]
}
```

#### Step-by-Step Engine Execution:
1. **Field Extraction & Casing:** `extractFieldValue()` maps `orderNumber` $\rightarrow$ `order_number` and handles `createdAt` $\rightarrow$ `created_at`.
2. **Type Coercion:** Numeric timestamp `1726740000000` is transformed to `'2024-09-19T10:00:00.000Z'`.
3. **Constraint Check:** `customerName` is `null`, but the target column `customer_name` has `NOT NULL`.
   - Engine records row as skipped: `field: "customer_name"`, `reason: "Missing required NOT NULL field"`.
4. **Remediation Studio:** The user opens the studio. Gemini analyzes the anomaly and suggests:
   - `suggestedValue: 'Guest Customer'`
   - `rationale: "Default customer identifier for guest checkouts satisfying NOT NULL constraint."`
   - `sqlClause: "DEFAULT 'Guest Customer' NOT NULL"`
5. **Re-simulation:** User clicks "Apply Fixes & Re-simulate". DDL is updated to `DEFAULT 'Guest Customer' NOT NULL`. The row passes validation.
6. **Child Table Normalization:** Array `items` is extracted into `order_items`:
   - Item 1: `orders_id = "64f1a2b3c4d5e6f708192001"`, `sort_order = 0`, `data = '{"sku":"WIDGET-01",...}'`
   - Item 2: `orders_id = "64f1a2b3c4d5e6f708192001"`, `sort_order = 1`, `data = '{"sku":"WIDGET-02",...}'`
7. **Target Cleanup:** Transaction executes `ROLLBACK;`. Target database tables are left unmodified.

---

## 20. Before vs After

| Feature / Metric | Before Phase 8 | After Phase 8 |
| :--- | :--- | :--- |
| **Validation Safety** | Direct execution from mapping to live ETL | Sandboxed transactional simulation executing explicit `ROLLBACK;` |
| **DDL Error Detection** | Errors surfaced during live migration | Pre-tested and validated during simulation |
| **Data Quality Anomalies** | Migration halted or errors dumped into raw logs | Interactive Remediation Studio with AI recommendations and manual presets |
| **Array Child Tables** | Theoretical mapping configuration | Simulated table unwinding with auto-added `sort_order` and foreign key indexes |
| **Throughput & ETA** | Uncalculated | Measured sample throughput ($rows/sec$) and estimated migration duration |
| **Storage Capacity** | Unchecked disk space | Automated headroom check against target database storage |
| **Compliance Proof** | No pre-migration verification report | Signed PDF and Markdown audit dossiers exported via native Electron |

---

## 21. Connection With Other Phases

```
+---------------------------------------------------------------------------------------------------+
|                                 PHASE INTEGRATION LIFECYCLE                                       |
|                                                                                                   |
|   Step 4 (Phase 6): Schema Mapper                                                                 |
|         │  Provides: CollectionMapping[] and FieldMapping[] definitions                           |
|         ▼                                                                                         |
|   Step 5 (Phase 7): Pre-Migration Risk Analysis                                                   |
|         │  Provides: Static risk score, structural warnings, source collection row counts         |
|         ▼                                                                                         |
|   Step 6 (PHASE 8): TRANSACTIONAL DRY RUN SIMULATION & REMEDIATION STUDIO                         |
|         │  - Empirically validates mappings against real PostgreSQL engine                        |
|         │  - Updates mappings with Option A defaults or Option B nullability                      |
|         │  - Verifies child table sort_order generation                                           |
|         │  - Exports compliance audit dossier                                                     |
|         ▼                                                                                         |
|   Step 7 (Phase 9): Live ETL Migration Engine                                                     |
|         └── Receives: Validated DDL, cleansed field defaults, and verified batch parameter limits |
+---------------------------------------------------------------------------------------------------+
```

---

## 22. Basic Viva Questions + Answers

### Q1: What is the purpose of Phase 8 in MigrateIQ?
**Answer:** Phase 8 is the Pre-Flight Dry Run Simulation and Data Quality Remediation Studio. It allows users to test schema creation, data type transformations, and constraints against an isolated PostgreSQL transaction before running the real migration, validating target database behavior and allowing data quality anomalies to be resolved in advance.

### Q2: Why did you use PostgreSQL transactions instead of creating a dummy database?
**Answer:** PostgreSQL supports transactional DDL (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`). Executing inside a transaction block (`BEGIN; ... ROLLBACK;`) allows testing against the exact target database version, extensions, and collations without incurring cloud provisioning costs, requiring administrative privileges to create new databases, or leaving test tables behind.

### Q3: How is the application designed to avoid permanently storing test data?
**Answer:** All DDL and insert operations execute inside an explicit PostgreSQL transaction. The control flow is designed to execute an explicit `ROLLBACK;` statement in both the completion block and the catch/finally handlers.

### Q4: What are the three options in the 3-Tier Resolution Strategy?
**Answer:**
- **Option A (Smart Default Imputation):** Configures fallback defaults (`DEFAULT '<val>' NOT NULL`), allowing sample records to satisfy non-null constraints without relaxing schema strictness.
- **Option B (Relax Schema to NULLABLE):** Alters the target column to allow NULLs, alerting the user to downstream application null-pointer risks.
- **Option C (Strict Quarantine / DLQ):** Preserves `NOT NULL` without fallbacks, routing invalid rows to the Dead-Letter Queue.

### Q5: How does MigrateIQ handle MongoDB arrays of objects?
**Answer:** Per Rule 4 and Challenge 9, MigrateIQ unwinds arrays of objects into a relational child table, automatically adds a `sort_order INTEGER NOT NULL` column populated with the 0-based array index to preserve sequence, and establishes a foreign key index referencing the parent table.

---

## 23. Advanced Viva Questions + Answers

### Q1: Why do you configure `SET CONSTRAINTS ALL DEFERRED;` during the dry run?
**Answer:** By default, PostgreSQL checks foreign key constraints immediately upon row insertion. If sample collections are tested in non-topological order, inserting a child record before its parent triggers an immediate foreign key failure. Deferring constraints postpones evaluation until transaction completion, allowing structural batch testing without artificial failures.

### Q2: What is the significance of PostgreSQL's 65,535 parameter limit, and how does the engine guard against exceeding it?
**Answer:** PostgreSQL's wire protocol uses a 16-bit integer for bind parameter counts, capping prepared statements at $65,535$ parameters. In multi-row bulk inserts (`INSERT INTO tbl VALUES ($1..$N), ...`), wide tables with large batch sizes can exceed this limit. MigrateIQ dynamically clamps the batch size using `Math.min(100, Math.floor(65000 / activeFields.length))`.

### Q3: How does your 6-Tier Error Detection Cascade handle cases where PostgreSQL omits the column name?
**Answer:** PostgreSQL syntax and range errors (such as datetime overflow errors) do not populate the wire protocol `column` field. The engine cascades through parsing the `detail` string, regex-matching error snippets, cross-referencing quoted values against `row.values`, inspecting string length against `character varying(N)` bounds, and falling back to the first non-primary-key column to attempt attributing an offending column identifier.

### Q4: Why did you implement dual-tier in-memory caching for the AI Remediation Studio?
**Answer:** Querying Google Gemini on every modal open would incur unnecessary API token costs, hit rate limits, and introduce network latency. We implemented a 30-minute in-memory cache on both the renderer (`aiCacheRef`) and main process (`anomalyFixCache`) indexed by a composite key of sorted table-column anomalies. Repeat views load instantly without API calls, while an explicit refresh button allows querying fresh recommendations when desired.

### Q5: What is the UTF-8 null-byte (`\0`) issue, and how does MigrateIQ handle it?
**Answer:** PostgreSQL stores `TEXT` and `VARCHAR` strings as null-terminated C-style character arrays. If binary BSON data containing `0x00` (`\0`) is passed to PostgreSQL, the driver aborts with `SQLSTATE 22021: invalid byte sequence for encoding "UTF8": 0x00`. MigrateIQ sanitizes null bytes across string, JSON, and text array fields prior to SQL parameter binding.

---

## 24. Presentation Explanation ("Explain It Like I'm Presenting It")

> "Good morning, professors and examiners. Today I will present **Phase 8 of MigrateIQ: The Transactional Dry Run Simulation & Data Quality Remediation Studio**.
>
> In database migrations, running an ETL pipeline without pre-flight validation frequently leads to mid-migration failures caused by schema and constraint mismatches. MigrateIQ addresses this through an isolated shadow simulation engine.
>
> When the user clicks 'Run Simulation', our Electron main process opens an isolated transaction on the target PostgreSQL database with session safeguards—including a 5-second lock timeout and deferred foreign keys. We test-execute DDL statements and transform up to 500 real sample documents per collection.
>
> If a data quality anomaly is detected—such as missing values for a NOT NULL column—our engine isolates the offending rows using PostgreSQL savepoints without aborting the entire simulation. Our 6-tier error detection cascade identifies the affected column.
>
> Rather than halting execution, MigrateIQ launches the **Data Quality Remediation Studio**. Here, Google Gemini AI evaluates the constraint failure and synthesizes domain-aware fallback defaults—such as 'PENDING' for order status or 'USER' for roles—complete with a side-by-side Before/After diff. With one click, the user can apply Option A, configuring `DEFAULT '<val>' NOT NULL` so all sample records satisfy schema constraints without downstream application crash risks.
>
> Finally, the engine executes an explicit `ROLLBACK;`, leaving the target database tables unmodified, and generates a signed PDF compliance dossier using Electron's native headless printing.
>
> Thank you, and I welcome your questions."

---

## 25. Things I Must Know (# MUST KNOW)

1. **Transaction Isolation [Implemented in code]:** Executes inside `BEGIN; ... ROLLBACK;`.
2. **Session Safeguards [Implemented in code]:** `lock_timeout = '5s'`, `statement_timeout = '15s'`, `idle_in_transaction_session_timeout = '10s'`, `SET CONSTRAINTS ALL DEFERRED;`.
3. **Savepoint Error Isolation [Implemented in code, Verified by tests]:** Uses `SAVEPOINT sp_tbl_X` for tables and `SAVEPOINT sp_row` for individual records.
4. **Child Table Normalization [Implemented in code, Verified by tests]:** Arrays of objects automatically receive a `sort_order INTEGER NOT NULL` column populated with 0-based array indices.
5. **63-Byte Identifier Truncation [Implemented in code, Verified by tests]:** Truncates long names to 58 characters + 4-char hex hash (`NAMEDATALEN - 1`).
6. **Parameter Clamping [Implemented in code, Verified by tests]:** Batch size clamped to `Math.floor(65000 / cols)` to avoid exceeding PostgreSQL's $65,535$ parameter ceiling.
7. **UTF-8 Sanitization [Implemented in code, Verified by tests]:** Null-byte `\0` characters are stripped to guard against `SQLSTATE 22021` driver aborts.
8. **Strict Type Parsing [Implemented in code, Verified by tests]:** Enforces `/^-?\d+$/` regex on integers to reject hex ObjectIds from being erroneously parsed as integer `64`.
9. **Option A (Imputation) [Implemented in code, Verified by tests]:** Replaces NULLs with defaults and preserves `NOT NULL` schema contracts.
10. **Option B (Relaxation) [Implemented in code]:** Relaxes column to `NULLABLE` with downstream crash warnings.
11. **Option C (Quarantine) [Implemented in code]:** Records quarantine policy for routing invalid records to the Dead-Letter Queue (DLQ).
12. **6-Tier Error Detection [Implemented in code, Verified by tests]:** Wire protocol $\rightarrow$ constraint detail $\rightarrow$ error regex $\rightarrow$ value cross-reference $\rightarrow$ string length $\rightarrow$ fallback.
13. **Dual-Tier Caching [Implemented in code]:** 30-minute in-memory cache on both client and server to avoid redundant Gemini API token usage.
14. **Pre-Existing Table Handling [Implemented in code, Verified by tests]:** Transactional `DROP TABLE IF EXISTS ... CASCADE;` inside simulation allows fresh schema testing; changes are reversed on rollback.
15. **Native PDF Export [Implemented in code]:** Rendered via headless Electron `BrowserWindow` and Chromium `printToPDF`.

---

## 26. 5-Minute Revision

- **What it is:** Wizard Step 6 pre-flight dry run simulation engine and remediation studio.
- **How safety works:** Executes `CREATE TABLE` and sample inserts inside `BEGIN; ... ROLLBACK;`.
- **Session Config:** `lock_timeout = '5s'`, `statement_timeout = '15s'`, `idle_in_transaction_session_timeout = '10s'`.
- **How errors are isolated:** `SAVEPOINT sp_row;` isolates single row errors so failure of one row does not abort the broader simulation transaction.
- **How child tables are handled:** Arrays unwind into child tables with auto-added `sort_order INTEGER NOT NULL`.
- **The 3-tier resolution strategy:**
  - Option A: Smart Default Imputation (Recommended, satisfies constraints).
  - Option B: Relax to NULLABLE (Caution, app crash risk).
  - Option C: Strict Quarantine to DLQ (Warning, row count mismatch).
- **AI Remediation:** Gemini suggests domain-specific defaults with Before/After diff; cached for 30 minutes.
- **PostgreSQL Limits Enforced:** Identifiers capped at 63 bytes; bind parameters clamped to $\le 65,000$.
- **Audit Reports:** Export of signed PDF dossiers and developer Markdown files.

---

## 27. Known Limitations & Evidence Classification

### Evidence Classification Key:
- `🟢 IMPLEMENTED`: Implemented in code and verified by automated tests or live database execution.
- `🟡 PARTIALLY IMPLEMENTED`: Functional in primary workflows; secondary workflow uses simulation fallback.
- `🔴 NOT IMPLEMENTED`: Deferred to future phases or architectural roadmap.
- `⚠️ POTENTIAL ISSUE`: Technical edge case requiring awareness during project defense.

| Feature / Subsystem | Status | Evidence Level | Current Implementation Reality | FYP Viva / Examiner Response |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Transactional Sandbox** | `🟢 IMPLEMENTED` | [Verified by tests] (109 assertions) | Native `BEGIN; ... ROLLBACK;` with timeouts and savepoints | Operational; verified via `scripts/test-phase8-dry-run.js`. |
| **Data Quality Remediation Studio** | `🟢 IMPLEMENTED` | [Verified by tests] (8 assertions) | Dual-mode AI (Gemini) + Manual Studio with 30-min cache | Operational; verified via `scripts/test-remediation-studio.js`. |
| **Child Table Normalization** | `🟢 IMPLEMENTED` | [Verified by tests] | Auto-added `sort_order` with foreign key indexes | Complies with Rule 4 and Challenge 9. |
| **Audit Dossier Exporters** | `🟢 IMPLEMENTED` | [Observed during manual testing] | Headless Electron `printToPDF` and Markdown export | Verified on Windows build. |
| **Reverse Simulation (PG $\rightarrow$ Mongo)** | `🟡 PARTIALLY IMPLEMENTED` | [Expected by design] | In-memory schema synthesis and BSON 16MB size audit; does not open a live multi-document transaction on MongoDB | *"MongoDB multi-document transactions require a replica set or sharded cluster; for standalone instances, an in-memory BSON boundary audit is performed."* |
| **Demo Mode Simulation** | `🟡 PARTIALLY IMPLEMENTED` | [Implemented in code] | Synthesizes realistic documents from schema metadata; runs without live database daemon | *"Demo mode enables presentation and testing without requiring active database servers."* |
| **Live Dead-Letter Queue Pipeline** | `🔴 NOT IMPLEMENTED` | [Expected by design] | Option C records user acknowledgment in Step 6; physical DLQ table streaming occurs in Step 7 (Phase 9) | *"Step 6 establishes the quarantine contract; Phase 9 implements the streaming DLQ worker."* |
| **PostgreSQL Sequence Advancement** | `⚠️ POTENTIAL ISSUE` | [Expected by design] | If target DDL uses `SERIAL` and rows omit explicit IDs, sequence numbers advance even across rollbacks | *"Test inserts supply explicit dummy surrogate IDs to avoid consuming sequence numbers, but sequence advancement is an inherent PostgreSQL property."* |

---

## 28. Final Mental Model

```
                                  MigrateIQ ARCHITECTURE
                                             │
      ┌──────────────────────────────────────┼──────────────────────────────────────┐
      │                                      │                                      │
  [ Frontend ]                          [ State ]                              [ IPC ]
  DryRunScreen.tsx                     wizardStore.ts                     handlers/dryRun.ts
  ├── BlueprintSummaryCard             ├── schemaMapping                  ├── migration:dry-run
  ├── DryRunTerminal                   ├── dryRunResult                   ├── dossier:export-pdf
  ├── SkippedRowsModal                 ├── quarantineAcknowledged        └── ai:suggest-fixes
  └── RemediationStudioModal           └── scoped autoFix actions
      (AI Diff & Manual)                     │
                                             │
                                       [ Main Engine ]
                                     engine/dryRun.ts
                                             │
                         ┌───────────────────┴───────────────────┐
                         │                                       │
                 [ Pre-Flight Safety ]                   [ Data Transformation ]
                 ├── BEGIN; ... ROLLBACK;                ├── transformValueForSql()
                 ├── lock_timeout = 5s                   ├── extractFieldValue()
                 ├── SAVEPOINT error isolation           ├── Parameter Clamping (<=65k)
                 └── 63-byte identifier hash             └── sort_order Child Tables
                         │                                       │
                         └───────────────────┬───────────────────┘
                                             │
                                    [ Database & Cloud ]
                                     ├── MongoDB (Source Samples)
                                     ├── PostgreSQL (Target Sandbox)
                                     └── Google Gemini API (AI Imputation)
```

---
*Document compiled and verified against the MigrateIQ codebase for Phase 8.*
