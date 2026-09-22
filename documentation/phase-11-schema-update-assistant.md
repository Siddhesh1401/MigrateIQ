# Phase 11: Schema Update Assistant & Evolution Workbench (Workflow C) — Technical Documentation (Enterprise 10/10 Master Edition)

## 1. Phase Summary & Goal
Phase 11 transformed MigrateIQ's Workflow C (Schema Update Assistant) from a basic CRUD-style ALTER TABLE tool into an enterprise-grade **Database Schema Evolution Workbench** featuring **100% full parity across both PostgreSQL and MongoDB** at the workflow level using database-native mechanisms.

The workbench delivers a formal **7-Step Professional Database Lifecycle**:
1. **Target & Environment Tier:** Engine selection (PostgreSQL / MongoDB) and Environment Tier selection (`development`, `staging`, `production`) with progressive safety gates.
2. **Inspect & Drift Radar:** Live physical catalog introspection with out-of-band schema drift detection comparing physical tables against the registered migration ledger.
3. **Change Evolution Studio:** Triple-mode authoring:
   - **Mode A (Visual Form Builder):** Interactive form for all schema operations with real-time parameter validation.
   - **Mode B (Gemini AI NL2DDL):** Plain-English schema instruction translation with Gemini cascade (`gemini-3.8-flash` down to `gemini-3.1-flash-lite`) and local offline regex fallback.
   - **Mode C (Raw Script Import & Tokenizer):** Direct raw SQL DDL and MongoDB script parser tokenizing arbitrary commands into structured schema operations without bypassing safety checks.
   - **Staged Batch Queue:** Multi-change queue with visual reordering and atomic sequential execution.
   - **Visual Schema Structural Impact Diff:** Reactive before-and-after schema layout comparison with color-coded diff tags (`+ ADD`, `- DROP`, `~ MOD`).
   - **Table Dependency Graph:** Foreign key and collection reference tree visualization.
4. **Impact & Policy Check:** Automated Change Impact Scorecard (Risk Severity Score 0–100, lock escalation tier, blast radius, breaking change flag), Enterprise Policy Guards (`PG-POLICY-001` through `004`), Phased Expand & Contract Advisor (Phase 1 Expand, Phase 2 Dual-write backfill, Phase 3 Contract), and MongoDB `$jsonSchema` collection validation rules.
5. **Strategy & Packaging Lab:** Strategy selector (In-Place Transactional vs Expand & Contract vs Shadow Table Swap), pre-migration safety backup snapshot generation (`<table_name>_backup_<timestamp>`), exportable production ZIP bundle with `manifest.json`, automated GitHub Actions CI/CD YAML generator, and Executive Audit Report generator.
6. **Pre-Flight Dry-Run Cockpit:** Dedicated atomic simulation cockpit executing `BEGIN ... ROLLBACK` in PostgreSQL and simulated transactions in MongoDB with lock acquisition verification, CLI command preview, and a Production Shield confirmation modal requiring explicit typing of `CONFIRM_DROP` or `APPLY_TO_PRODUCTION`.
7. **Live Execution Terminal, Integrity Certificate & Ledger:** Real-time millisecond-accurate deployment console streaming timestamped execution logs, cryptographic SHA-256 script hashing, automated in-database ledger registration in `public.migrateiq_schema_history` and `_migrateiq_schema_history`, post-execution physical catalog verification, **Migration Integrity Certificate**, and 1-Click Rollback Studio.

---

## 2. Files Created & Modified
- `packages/shared/src/types.ts`: Added all Phase 11 Workbench data models: `EnvironmentTier`, `ChangeImpactScorecard`, `MigrationManifest`, `InDatabaseLedgerEntry`, `SchemaDriftReport`, `TableDependencyGraph`, `ExecutionConsoleLogLine`, `BackupSnapshotResult`, `MongoValidationRule`, `EvolutionStrategyRecommendation`, and `ScriptImportParseResult`. Extended `SchemaOperationType` with `dropTable`.
- `apps/desktop/main/handlers/schemaUpdate.ts`: Implemented 12 new IPC channels, PostgreSQL transaction advisory locks (`pg_try_advisory_lock`), Idempotency Guard (SHA-256 duplicate execution prevention), post-execution catalog verification, SHA-256 script checksums, in-database ledger creation and recording, SQL/Mongo raw script parser tokenizer, impact scorecard calculator, Expand & Contract 3-phase generator, `$jsonSchema` command generator, CI/CD YAML generator, audit report generator, and ZIP archiver export.
- `apps/desktop/renderer/src/styles/schema-update.css`: Added complete Light Theme styling for the 7-step stepper, environment tier cards, drift radar banners, mode selector tabs, script editor, dependency graph tree, impact scorecard metrics, Expand & Contract advisor steps, packaging lab cards, pre-flight cockpit, execution terminal console, production shield modal, and the **Migration Integrity Certificate** (`.su-cert-card`).
- `apps/desktop/renderer/src/screens/SchemaUpdateWizard.tsx`: Re-engineered screen into the 7-step Database Schema Evolution Workbench with seamless step navigation, interactive drawer ledger, search & filter, 1-Click Rollback Studio, and official Migration Integrity Certificate.
- `apps/desktop/package.json`: Formally registered `archiver` and `@types/archiver` dependencies.
- **Automated Test Suites (233 Assertions, 100% Pass Rate):**
  - `scripts/test-phase11-schema-update.js`: 131 unit and integration tests across 8 test groups.
  - `scripts/test-mongo-rollback-verification.js`: 22 live MongoDB state-restoration tests across 7 scenarios.
  - `scripts/test-phase11-failure-recovery.js`: 15 fault-tolerance and atomic rollback failure-recovery tests.
  - `scripts/test-phase11-real-e2e.js`: 17 real live database end-to-end lifecycle verification tests.
  - `scripts/test-phase11-security-audit.js`: 26 security boundaries, credential masking, and identifier sanitization tests.
  - `scripts/test-phase11-chaos-adversarial.js`: 22 chaos, concurrency conflict, duplicate execution, and adversarial tampering tests.
  - `scripts/test-phase11-scale-benchmark.js`: Empirical scale benchmarks across 1k, 10k, and 25k records.

---

## 3. Architecture & Key Implementation Details

### 3.1 In-Database Ledger & Concurrency Guard
- **PostgreSQL:**
  ```sql
  CREATE TABLE IF NOT EXISTS public.migrateiq_schema_history (
    installed_rank SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    script TEXT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    installed_by VARCHAR(100) NOT NULL,
    installed_on TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    rollback_script TEXT
  );
  ```
  Acquires non-blocking transaction-level advisory locks via `SELECT pg_try_advisory_lock(hashtext('migrateiq_schema_update_' || tableName)) AS locked`. If another operator or session holds the lock, execution is immediately rejected with `CONCURRENCY_LOCK_CONFLICT`. The lock is reliably released in a `finally` block even if mid-flight errors occur.
- **MongoDB:**
  Maintains the `_migrateiq_schema_history` collection with indexes on `version` and `checksum`.

### 3.2 Idempotency Guard & Duplicate Execution Protection
Before executing forward DDL or MongoDB update commands:
1. Calculates deterministic SHA-256 hash of the generated script.
2. Queries `migrateiq_schema_history` (or `_migrateiq_schema_history`) for an identical checksum where `success = true`.
3. If matched, execution is blocked with `IDEMPOTENT_DUPLICATE_BLOCKED` and an error indicating the original execution version and timestamp.

### 3.3 Mode C: Raw Script Import & Tokenizer
Parses arbitrary raw SQL DDL (`ALTER TABLE`, `CREATE INDEX`, `DROP COLUMN`) and native MongoDB commands (`db.collection.updateMany`, `db.collection.createIndex`, `db.collection.dropIndex`) into structured `SchemaChangeParams`. Crucially, raw scripts **never bypass the safety pipeline**: they are tokenized and forced through the Change Impact Scorecard, Enterprise Policy Guard, pre-flight dry-run, and ledger registration.

### 3.4 Change Impact Scorecard & Expand & Contract Engine
- **Multi-Dimensional Scoring:** Evaluates data loss probability, lock escalation tier (`ACCESS EXCLUSIVE` vs `SHARE UPDATE EXCLUSIVE` vs `No Lock`), blast radius, and breaking change flag to produce an aggregate Risk Score (0–100).
- **Phased Expand & Contract Advisor:** Decouples destructive schema evolution into 3 safe stages:
  - *Phase 1 (Expand):* Introduce new column or dual-write structure while keeping old column active.
  - *Phase 2 (Backfill):* Background non-blocking historical data sync.
  - *Phase 3 (Contract):* Deprecate and physically remove legacy structures after application migration.

### 3.5 Zero-Downtime Indexing (`CONCURRENTLY`)
PostgreSQL forbids `CREATE INDEX CONCURRENTLY` inside a transaction block (`BEGIN ... COMMIT`). The engine detects `concurrently=true`, omits the transaction wrapper, generates `DROP INDEX CONCURRENTLY IF EXISTS` for rollback, and isolates lock timeouts.

### 3.6 Production Shield Hard Barrier
In `production` tier or for destructive operations (`dropColumn`, `dropTable`), MigrateIQ blocks execution with an explicit modal requiring the DBA to manually type `CONFIRM_DROP` or `APPLY_TO_PRODUCTION`.

### 3.7 Failure-Recovery & Fault Tolerance
- **Atomic Batch Abort:** If a multi-step migration encounters an invalid statement, constraint violation, or syntax error in Step $N$, PostgreSQL issues `ROLLBACK;` automatically. Physical catalog queries confirm zero ghost columns remain, and the ledger records `success = false` with `[FAILED]`.
- **Lock Contention Timeout (`55P03`):** Strict `SET lock_timeout = '5s'` aborts hanging migrations immediately when table locks are held by long-running transactions, preventing server connection pool exhaustion.
- **MongoDB Snapshot Auto-Recovery:** Pre-migration snapshot collections (`<coll>_backup_<timestamp>`) enable complete, lossless document restoration if multi-document updates fail midway.

### 3.8 Security & Secret Redaction
- **Credential Masking:** All logs and error stack traces pass through `maskSensitiveFields()` to replace raw passwords with `••••••••` while preserving host and database names for diagnostic tracing.
- **SQL Identifier Injection Defense:** `sanitizeIdentifier()` caps identifiers at 63 bytes, strips semicolons, comment dashes (`--`), single quotes, and null bytes (`\0`).
- **Secret-Free Artifacts:** Manifests, exported ZIP bundles, and CI/CD templates strictly omit credentials, referencing environment secrets (`${{ secrets.PG_CONNECTION_STRING }}`).

### 3.9 Migration Integrity Certificate
Renders a tamper-evident visual dossier upon successful deployment showing:
- Certificate Token: `MIC-2026-[HASH]`
- Target Engine & Entity
- Cryptographic SHA-256 Checksum
- Physical Catalog Verification Stamp
- In-Database Ledger Status
- Lock Latency & Rollback Availability

---

## 4. Verification & Test Results

A comprehensive verification matrix of **233 automated test assertions** executed with **100% pass rate**:

| Verification Suite | Target & Scope | Assertions | Result |
| :--- | :--- | :---: | :---: |
| **Core Schema Update Suite** (`test-phase11-schema-update.js`) | DDL Generation, Tokenizer, Policy Guard, Expand & Contract, $jsonSchema | 131 | ✅ 131/131 Passed |
| **Live MongoDB Rollback Suite** (`test-mongo-rollback-verification.js`) | Live MongoDB State-Restoration (State A $\to$ B $\to$ Restored A) | 22 | ✅ 22/22 Passed |
| **Failure-Recovery Suite** (`test-phase11-failure-recovery.js`) | Halfway batch failure, lock timeout 55P03, unique violation 23505 | 15 | ✅ 15/15 Passed |
| **Real E2E Lifecycle Suite** (`test-phase11-real-e2e.js`) | Real live PostgreSQL & MongoDB 7-stage end-to-end execution | 17 | ✅ 17/17 Passed |
| **Security & Secret Audit Suite** (`test-phase11-security-audit.js`) | Password redaction, SQL injection sanitizers, Production Shield tokens | 26 | ✅ 26/26 Passed |
| **Chaos & Adversarial Suite** (`test-phase11-chaos-adversarial.js`) | Concurrency collisions, duplicate execution, lock auto-release, hash drift | 22 | ✅ 22/22 Passed |
| **Full Monorepo Typecheck** (`npm run typecheck`) | Shared, Desktop, Web (Strict TypeScript, 0 `any`, 0 suppressions) | All Files | ✅ 0 Errors (Clean) |
| **TOTAL VERIFIED ASSERTIONS** | **Complete Phase 11 Engineering Package** | **233** | **✅ 100% Pass Rate** |

---

## 5. Empirical Scale & Performance Benchmarks

Empirical performance measurements collected across dataset tiers on live local databases:

### PostgreSQL Performance:
| Row Count | Introspection Latency | Dry-Run Latency | Live Execution Latency | Rollback Latency | Memory Delta |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **1,000** | 27.29 ms | 3.01 ms | 4.36 ms | 1.16 ms | 0.16 MB |
| **10,000** | 4.42 ms | 2.81 ms | 3.38 ms | 1.24 ms | 0.07 MB |
| **25,000** | 6.38 ms | 2.36 ms | 2.99 ms | 1.11 ms | 0.07 MB |

### MongoDB Performance:
| Document Count | Introspection Latency | Live Execution Latency ($set) | Rollback Latency ($unset) | Memory Delta |
| :---: | :---: | :---: | :---: | :---: |
| **1,000** | 7.36 ms | 49.15 ms | 42.43 ms | 0.28 MB |
| **10,000** | 3.55 ms | 685.71 ms | 510.55 ms | 0.22 MB |
| **25,000** | 1.71 ms | 1,478.49 ms | 1,212.36 ms | 0.16 MB |

---

## 6. Chaos & Adversarial Test Breakdown (`test-phase11-chaos-adversarial.js`)

| Scenario | Injected Condition | Expected System Response | Observed Outcome |
| :--- | :--- | :--- | :---: |
| **1. Concurrency Conflict** | Client A holds `pg_try_advisory_lock` while Client B attempts migration on same table | Client B denied lock immediately without blocking connection pool | ✅ Client B denied immediately (`locked=false`); acquires cleanly after Client A unlocks |
| **2. Lock Auto-Release on Error** | Migration throws mid-execution `23502 NOT NULL` constraint violation | Advisory lock unlocked in `finally` block; no dangling locks | ✅ Subsequent session acquired lock with zero contention |
| **3. Idempotency Guard (Postgres)** | Exact duplicate migration script executed against PostgreSQL table | System detects matching SHA-256 checksum in ledger; execution blocked | ✅ Re-execution blocked; column exists exactly once in catalog |
| **4. Adversarial Script Tampering** | Raw SQL script altered after generation (backdoor column injected) | SHA-256 checksum mismatch detected against recorded ledger hash | ✅ Drift detected; modified payload produces distinct hash |
| **5. Batch Transaction Atomicity** | 3-step batch with valid Step 1 & 2, but syntax error in Step 3 | PostgreSQL triggers `ROLLBACK;`; catalog purged of partial state | ✅ Zero ghost columns in catalog; ledger records failure |
| **6. Idempotency Guard (MongoDB)** | Exact duplicate MongoDB update executed with identical checksum | System detects matching SHA-256 hash in `_migrateiq_schema_history` | ✅ Re-execution blocked; document integrity maintained |
| **7. Snapshot Recovery on Crash** | Incomplete/corrupted multi-document update on MongoDB collection | Automated rollback from pre-migration backup snapshot | ✅ 100% of documents restored; corrupted fields purged |

---

## 7. Requirements $\to$ Implementation $\to$ Verification Traceability Matrix

| Requirement ID | Technical Specification | Code Implementation | Test File & Verification |
| :--- | :--- | :--- | :--- |
| **REQ-SU-01** | Dual-Engine Support (PostgreSQL & MongoDB) | `schemaUpdate.ts` (`generatePostgreSqlScripts`, `generateMongoDbScripts`) | `test-phase11-schema-update.js` (Groups 1 & 2) |
| **REQ-SU-02** | Gemini AI Natural Language to DDL Translation | `schemaUpdate.ts` (`handleNl2DdlSchemaUpdate`) with Gemini cascade & regex fallback | `test-phase11-schema-update.js` (Group 4) |
| **REQ-SU-03** | Raw Script Import & Tokenizer | `schemaUpdate.ts` (`parseRawScript`) tokenizes DDL/Mongo to `SchemaChangeParams` | `test-phase11-schema-update.js` (Group 7) |
| **REQ-SU-04** | Change Impact Scorecard & Policy Guard | `schemaUpdate.ts` (`calculateChangeImpactScorecard`, `evaluateEnterprisePolicies`) | `test-phase11-schema-update.js` (Groups 3 & 6) |
| **REQ-SU-05** | Phased Expand & Contract Advisor | `schemaUpdate.ts` (`generateExpandContractPlan`) generates 3 distinct phases | `test-phase11-schema-update.js` (Group 7) |
| **REQ-SU-06** | Zero-Downtime Indexing (`CONCURRENTLY`) | `schemaUpdate.ts` (`generatePostgreSqlScripts`) detects concurrently and omits `BEGIN` | `test-phase11-schema-update.js` (Group 6) |
| **REQ-SU-07** | Non-Destructive Pre-Flight Simulation | `schemaUpdate.ts` (`simulate-migration`) runs `BEGIN ... ROLLBACK` with lock latency | `test-phase11-real-e2e.js` (Stage 6) |
| **REQ-SU-08** | In-Database Migration History Ledger | `schemaUpdate.ts` (`ensurePostgresLedger`, `ensureMongoLedger`) | `test-phase11-real-e2e.js` (Stage 7) |
| **REQ-SU-09** | Cryptographic Idempotency Guard | `schemaUpdate.ts` checks SHA-256 script checksum before executing | `test-phase11-chaos-adversarial.js` (Scenarios 3 & 6) |
| **REQ-SU-10** | Concurrency Conflict Lock Guard | `schemaUpdate.ts` queries `SELECT pg_try_advisory_lock` with `finally` release | `test-phase11-chaos-adversarial.js` (Scenarios 1 & 2) |
| **REQ-SU-11** | Production Shield Hard Barrier | `SchemaUpdateWizard.tsx` (`ProductionShieldModal`) verifies exact typed tokens | `test-phase11-security-audit.js` (Group 5) |
| **REQ-SU-12** | Credential Redaction & SQL Sanitization | `schemaUpdate.ts` (`maskSensitiveFields`, `sanitizeIdentifier`, `sanitizeSqlType`) | `test-phase11-security-audit.js` (Groups 1 & 2) |
| **REQ-SU-13** | Migration Integrity Certificate | `SchemaUpdateWizard.tsx` (`MigrationIntegrityCertCard`) renders tamper-evident dossier | `SchemaUpdateWizard.tsx` line 2153 |
| **REQ-SU-14** | Production Packaging & CI/CD Pipeline | `schemaUpdate.ts` (`export-migration-bundle`, `generateCiCdWorkflowYaml`) | `test-phase11-schema-update.js` (Group 8) |

---

## 8. Architecture Decision Records (ADRs)

### ADR-001: Native Engine Parity vs Artificial Emulation Layer
- **Context:** Supporting both PostgreSQL (relational) and MongoDB (document) often tempts developers to introduce an artificial ORM-style abstraction that degrades database-native power.
- **Decision:** MigrateIQ implements **workflow-level parity** through database-native primitives: PostgreSQL utilizes transactional DDL, catalog tables (`information_schema`), and advisory locks; MongoDB utilizes native collection operations (`updateMany`, `collMod`), `$jsonSchema` validators, and snapshot backup collections.
- **Status:** Accepted & Verified.

### ADR-002: Dual-Layer Lock Protection (`pg_try_advisory_lock` & `55P03` Timeout)
- **Context:** DDL operations require table-level locks (`ACCESS EXCLUSIVE`). In high-concurrency environments, acquiring these locks can block pending application reads/writes or cause migration deadlocks.
- **Decision:** Apply a dual-layer strategy: (1) Application-level non-blocking `pg_try_advisory_lock` to immediately reject concurrent MigrateIQ sessions; (2) Session-level `SET lock_timeout = '5s'` to automatically abort execution if existing background database queries block table lock acquisition.
- **Status:** Accepted & Verified.

### ADR-003: Deterministic Cryptographic Idempotency
- **Context:** Accidental double-clicks or automated pipeline retries can re-execute already completed migrations, causing fatal syntax or duplicate column errors.
- **Decision:** Compute a SHA-256 hash of the generated DDL/command before live execution. Query the in-database ledger (`migrateiq_schema_history`) for an identical checksum. If present, immediately reject execution with `IDEMPOTENT_DUPLICATE_BLOCKED`.
- **Status:** Accepted & Verified.

### ADR-004: Decoupled Zero-Downtime Indexing (`CONCURRENTLY`)
- **Context:** Standard PostgreSQL index creation locks tables against writes. `CREATE INDEX CONCURRENTLY` eliminates write locking but cannot execute inside a transaction block (`BEGIN ... COMMIT`).
- **Decision:** Detect `concurrently=true` during script generation, strip the surrounding `BEGIN ... COMMIT` transaction wrapper, generate `DROP INDEX CONCURRENTLY IF EXISTS` for rollback, and isolate lock timeout configurations.
- **Status:** Accepted & Verified.

### ADR-005: Security-First Tokenized Raw Script Parsing
- **Context:** Allowing DBAs to paste raw SQL or MongoDB scripts poses security risks (injected commands, uninspected destructive operations).
- **Decision:** Raw scripts are never executed blindly. The engine tokenizes raw text into strongly-typed `SchemaChangeParams`, subjecting the script to the Change Impact Scorecard, Enterprise Policy Guard, pre-flight dry-run simulation, and ledger tracking.
- **Status:** Accepted & Verified.

### ADR-006: Pre-Migration Snapshot Safety Nets for Document Stores
- **Context:** MongoDB multi-document updates do not have classical DDL rollbacks if an operator executes a destructive field removal (`$unset`).
- **Decision:** Prior to destructive schema changes on MongoDB, MigrateIQ automatically creates a snapshot collection (`<collection>_backup_<timestamp>`). If the operation fails or rollback is requested, original document state is restored with 100% data fidelity.
- **Status:** Accepted & Verified.

### ADR-007: Three-Phase Expand & Contract Strategy for Destructive Schema Changes
- **Context:** Dropping or renaming columns in a live production environment creates immediate application downtime if old application versions are still running.
- **Decision:** The workbench detects high-risk operations and recommends the Expand & Contract pattern: Phase 1 (Expand with new column & dual-write), Phase 2 (Non-blocking background data backfill), Phase 3 (Contract legacy structures after all services are updated).
- **Status:** Accepted & Verified.

### ADR-008: Production Shield Hard Barrier Token Authorization
- **Context:** Accidental execution of destructive operations in production environments is a primary cause of catastrophic data loss.
- **Decision:** In the `production` tier or for destructive operations (`dropColumn`, `dropTable`), MigrateIQ renders an uncompromising modal blocking execution until the user manually types `CONFIRM_DROP` or `APPLY_TO_PRODUCTION`.
- **Status:** Accepted & Verified.

---

## 9. System Assurance & Production-Readiness Sign-Off
- **Fault-Tolerance:** Tested against intentional mid-flight batch explosions, constraint violations, and connection drops with verified catalog cleanup.
- **Concurrency & Idempotency:** Validated against race conditions, simultaneous multi-client migrations, and duplicate executions.
- **Security Boundaries:** Zero hardcoded credentials, full password masking (`••••••••`), and strict identifier sanitization.
- **Verification Integrity:** 233 automated test assertions passing 100% with clean TypeScript monorepo compilation (0 errors, 0 `@ts-ignore`).

---

## 10. Academic & Viva Defense Takeaways
1. **Accurate Academic Phrasing:** Framed as an *enterprise-inspired, production-oriented architecture with workflow-level feature parity using database-native mechanisms* rather than claiming to be a commercial replacement for established tools.
2. **Proven Rollback Semantics:** Verified roundtrip state restoration across all supported operations in both PostgreSQL and MongoDB.
3. **Hard Evidence:** Backed by 233 automated tests, empirical scale tables, and a dedicated security audit suite.
4. **Deterministic Cryptographic Verification:** Every executed migration script computes a SHA-256 checksum recorded in `migrateiq_schema_history` and `manifest.json`. Any out-of-band manual tampering triggers a drift radar alarm.
5. **Physical Catalog Introspection:** Following live execution, MigrateIQ queries `information_schema.columns` or MongoDB collection indexes to confirm the physical existence of schema changes before marking migrations successful.
