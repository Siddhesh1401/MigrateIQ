# MigrateIQ — Phase 11 Viva & Project Defense Handbook
## Schema Update Assistant & Enterprise Schema Evolution Workbench (Workflow C)

---

### Purpose of This Handbook
This document is a **Project Defense Handbook** created to prepare you for an academic, industrial, or final-year project viva and technical defense. While the Learning Guide (`learning/phase-11-learning-guide.md`) teaches *what* was built and *how* it works, this handbook prepares you to defend *why* it was built this way, *how to prove it from code*, *what happens when things fail*, *what architectural tradeoffs were made*, and *how to answer challenging examiner questions without making false guarantees*.

### How to Use This Handbook
- **For standard questions:** Practice delivering the concise, natural explanation in 20–40 seconds.
- **For difficult questions:** Notice the two-tier structure:
  - **Short Viva Answer:** What you should say first. Conversational, clear, and confident.
  - **If Examiner Asks Further:** The deeper technical follow-up that proves you actually wrote and understand the code.
- **For "Show Me The Code" questions:** Note the exact file paths, function names, and line numbers so you can quickly navigate the repository during an oral examination.

### Relationship to the Learning Guide
The Learning Guide provides technical specifications, code listings, and architecture diagrams. This Viva Handbook adds **evaluative depth, failure scenarios, counterfactual questions, examiner traps, code-tracing breakdowns, and real-world edge cases** that examiners ask during project defenses.

---

## 1. Phase Understanding Questions

### Q1.1: What exact problem does Phase 11 solve in MigrateIQ?
- **Short Viva Answer:**
  Phase 11 (Workflow C) solves the challenge of safely altering an existing database schema on live production databases without application downtime, table-level lock freezes, or data loss. While Phases 1–10 handle one-time cross-database migration (MongoDB ➔ PostgreSQL), Phase 11 supports the day-to-day lifecycle of database schema evolution across both PostgreSQL and MongoDB.
- **If Examiner Asks Further:**
  In real production systems, changing a schema is hazardous: running `ALTER TABLE` can lock a table for minutes, exhausting connection pools; dropping or renaming columns immediately breaks running microservices; and in MongoDB, document mutations lack native DDL rollbacks. Phase 11 provides a formal 7-step workbench: live catalog introspection, out-of-band drift detection, triple-mode authoring (Form, AI, and Raw Script Tokenizer), automated impact scoring, zero-downtime Expand & Contract planning, pre-flight atomic simulation, and in-database audit ledgers.

### Q1.2: What are the strict boundaries of Phase 11? What is it NOT supposed to do?
- **Short Viva Answer:**
  Phase 11 is strictly an in-place database schema evolution engine for single database instances or primary-replica clusters. It does **not** perform cross-database ETL data migration (that is Workflow A/B in Phases 9 and 12), it does **not** automatically refactor application backend source code (that is Workflow D / Phase 18), and it does **not** provide distributed multi-region consensus across databases like CockroachDB or Spanner.
- **If Examiner Asks Further:**
  It is important to emphasize to examiners that Phase 11 focuses on DDL generation, risk assessment, atomic validation, concurrency protection, and ledger recording. For multi-million row historical backfills resulting from column splits or renames, MigrateIQ generates the phased Expand & Contract DDL roadmap, but running iterative, chunked background batch worker scripts remains an operational responsibility of the application engineering team.

### Q1.3: What existed in MigrateIQ before this phase, and what became possible after?
- **Short Viva Answer:**
  Before Phase 11, MigrateIQ was exclusively a one-way migration pipeline from MongoDB to PostgreSQL. Once data was migrated, the user had to use external CLI tools (psql, MongoDB Compass, or Flyway) to alter tables. After Phase 11, MigrateIQ became an end-to-end database lifecycle platform capable of safely updating schemas on both relational and document engines.
- **If Examiner Asks Further:**
  Specifically, Phase 11 introduced: (1) Out-of-band schema drift detection comparing physical tables against registered migration history; (2) Dual-engine native parity (PostgreSQL transactional DDL and advisory locks vs. MongoDB `$jsonSchema` and snapshot collections); (3) Pre-flight atomic simulation running inside rolled-back transactions with 5-second lock timeouts; (4) Cryptographic SHA-256 idempotency guards; and (5) The Production Shield authorization barrier.

---

## 2. Architecture Defense Questions

### Q2.1: Why are database drivers and DDL execution located in the Electron Main Process rather than the Renderer?
- **Short Viva Answer:**
  Security and process isolation. Electron’s renderer process is a Chromium browser page. Executing database drivers like `pg` or `mongodb` directly in the renderer would require disabling Node integration security flags (`nodeIntegration: true`, `contextIsolation: false`), which exposes the host operating system to remote code execution. By keeping drivers in the main process, raw credentials and TCP database sockets never touch the UI layer.
- **If Examiner Asks Further:**
  Furthermore, native database drivers rely on Node.js C++ bindings (`libuv` and network sockets). In our architecture, the renderer is isolated behind Electron’s `contextBridge`. The UI communicates strictly over typed IPC channels (`schema:apply-update`, `schema:dry-run`). Even if an attacker exploited a Cross-Site Scripting (XSS) vulnerability in the renderer, they would only be able to trigger pre-defined IPC messages—they would have zero access to database sockets, the local filesystem, or unmasked database passwords.

### Q2.2: Why is the backend handler designed to regenerate SQL from structured parameters rather than executing the raw SQL string sent from the frontend?
- **Short Viva Answer:**
  This is a critical defense-in-depth architectural pattern. If the backend blindly executed raw SQL strings sent from the renderer, a compromised renderer or malicious IPC injection could send arbitrary destructive commands like `DROP DATABASE`. Instead, `schema:apply-update` receives strongly-typed parameters (`SchemaChangeParams`), validates them, sanitizes all identifiers, and regenerates the SQL statements on the backend.
- **If Examiner Asks Further:**
  In `apps/desktop/main/handlers/schemaUpdate.ts` (lines 1741–1750), the code explicitly states: *"Security hardening: Regenerate SQL from params and target schema on backend instead of blindly executing arbitrary strings sent across IPC"*. Identifiers are passed through `sanitizeIdentifier()` which caps length at 63 bytes, strips semicolons, comment dashes (`--`), and null bytes (`\0`). Data types are sanitized through `sanitizeSqlType()`. The raw client string is completely discarded.

### Q2.3: Why does MigrateIQ maintain both local storage (`electron-store`) and an in-database ledger (`migrateiq_schema_history`)?
- **Short Viva Answer:**
  They serve two fundamentally different architectural purposes. `electron-store` stores workstation-level user preferences, UI wizard state, and client-side history caches. The in-database ledger (`public.migrateiq_schema_history`) lives inside the physical database itself, ensuring that all team members, automated CI/CD pipelines, and multiple DBA workstations share a single, immutable source of truth.
- **If Examiner Asks Further:**
  If migration tracking existed only in `electron-store`, Developer B's laptop would have no knowledge of a migration applied by Developer A. By maintaining an in-database ledger with cryptographic SHA-256 script checksums, MigrateIQ achieves team-wide consistency. Furthermore, this in-database ledger powers our Step 2 **Schema Drift Radar**: the radar compares physical tables in `information_schema` against scripts recorded in `migrateiq_schema_history` to instantly detect out-of-band changes applied manually through psql or external tools.

---

## 3. Code-Level Questions

### Q3.1: Which file, function, and IPC channel initiates live schema updates on the backend?
- **Answer:**
  - **File:** `apps/desktop/main/handlers/schemaUpdate.ts`
  - **Function:** `setupSchemaUpdateHandlers()` (starts line 1576)
  - **IPC Channel:** `'schema:apply-update'` (lines 1735–2217)
  - **Flow:** It validates incoming `ConnectionConfig` and `SchemaChangeParams`, regenerates sanitized DDL, acquires a PostgreSQL advisory lock (`pg_try_advisory_lock`), performs an idempotency check against `migrateiq_schema_history`, executes the DDL, runs post-execution catalog verification, records the migration in the ledger, and releases the advisory lock in a `finally` block.

### Q3.2: Where is the PostgreSQL 5-second lock timeout implemented, and why is it structured that way?
- **Answer:**
  - **File:** `apps/desktop/main/handlers/schemaUpdate.ts`
  - **Function:** `generatePostgreSqlScripts()` (lines 128–318)
  - **Implementation:**
    ```sql
    SET lock_timeout = '5s';
    BEGIN;
    ALTER TABLE "public"."customers" ADD COLUMN "loyalty_tier" VARCHAR(50);
    COMMIT;
    ```
  - **Why:** `SET lock_timeout = '5s'` is prepended at the session level before `BEGIN`. If existing long-running transactions hold a table lock, PostgreSQL will wait at most 5,000 milliseconds to acquire the lock before throwing error `55P03` (`lock_not_available`), aborting immediately and preventing server connection pool exhaustion.

### Q3.3: How does the engine handle `CREATE INDEX CONCURRENTLY` differently from standard DDL?
- **Answer:**
  - **File:** `apps/desktop/main/handlers/schemaUpdate.ts` (lines 274–291 and lines 2285–2288)
  - **Code Logic:**
    ```typescript
    if (params.operation === 'addIndex' && params.concurrently) {
      wrappedForward = `SET lock_timeout = '5s';\n\n${forward}`;
      wrappedRollback = `SET lock_timeout = '5s';\n\n${rollback}`;
    }
    ```
  - **Why:** PostgreSQL core engine prohibits `CREATE INDEX CONCURRENTLY` from running inside an explicit transaction block (`BEGIN ... COMMIT`) with error code `25001`. The engine detects `concurrently: true`, omits the `BEGIN ... COMMIT` wrapper, sets the lock timeout, and generates `DROP INDEX CONCURRENTLY IF EXISTS` for rollback.

### Q3.4: Where is the Gemini AI cascade implemented, and what happens if all AI models fail?
- **Answer:**
  - **File:** `apps/desktop/main/handlers/schemaUpdate.ts`
  - **Function:** `interpretNL2DDLWithGemini()` (lines 759–839) and `parseNaturalLanguageOffline()` (lines 605–730)
  - **Cascade Array:** Iterates through `NL2DDL_MODELS`: `['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.8-flash']`.
  - **Fallback:** If all Gemini API calls fail (e.g., invalid key, rate limit, or no internet), the handler drops down to `parseNaturalLanguageOffline(prompt, databaseType)`. This offline regex parser matches 6 common natural language patterns (e.g., "add column X to table Y as type Z", "drop column X from table Y", "create unique index on T(C)") and returns structured `NL2DDLResponse` with `isFallback: true` and 0 token usage.

### Q3.5: How is post-execution physical catalog verification implemented?
- **Answer:**
  - **File:** `apps/desktop/main/handlers/schemaUpdate.ts` (lines 1831–1887)
  - **Implementation:** Immediately after executing DDL, the engine queries the live catalog:
    - For `addColumn`: `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3;`
    - For `dropColumn`: Confirms column count equals 0.
    - For `addIndex`: Queries `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = $2 AND indexname = $3;`
  - If verified, it returns `verified: true` and a detailed verification string that is stamped onto the Migration Integrity Certificate.

---

## 4. End-to-End Data Flow Questions

### Q4.1: Trace the exact execution path when a user submits a raw SQL script in Mode C until it is safely applied.
- **Answer:**
  ```text
  1. User Action:
     In Step 3 (Change Evolution Studio), user selects "Mode C: Raw Script",
     pastes "ALTER TABLE orders ADD COLUMN shipping_status VARCHAR(20) DEFAULT 'pending';",
     and clicks "Parse & Stage Change".

  2. UI Dispatches Tokenizer Request:
     SchemaUpdateWizard.tsx calls:
     window.electronAPI.invoke('schema:parse-script', { script: rawScriptInput, dialectHint: 'postgresql' })

  3. Main Process Tokenization (schemaUpdate.ts):
     Handler invokes parseRawScript(). Regex detects PostgreSQL ALTER TABLE ADD COLUMN.
     Returns structured SchemaChangeParams:
     { operation: 'addColumn', tableName: 'orders', columnName: 'shipping_status', dataType: 'VARCHAR(20)', defaultValue: "'pending'", isNullable: true }

  4. Staged in Queue:
     UI receives parsed parameters and adds them to stagedChanges array.
     Raw text is converted into typed parameters.

  5. Step 4 Impact & Policy Evaluation:
     UI invokes 'schema:evaluate-scorecard'. computeChangeImpactScorecard() evaluates:
     - Table 'orders' has 50,000 rows.
     - Operation is addColumn with default -> dataRisk: 'low', lockRisk: 'low'.
     - Policy Guard checks PG-POLICY-001..4: passes all checks.
     - Recommended strategy: 'direct'.

  6. Step 6 Pre-Flight Simulation:
     UI invokes 'schema:dry-run'. Backend connects to PostgreSQL:
     SET lock_timeout = '5s'; BEGIN;
     ALTER TABLE "public"."orders" ADD COLUMN "shipping_status" VARCHAR(20) DEFAULT 'pending';
     ROLLBACK;
     Simulation confirms syntax and lock acquisition in 2.81ms. Zero persistent state written.

  7. Step 7 Live Execution:
     User clicks "Deploy Changes". UI invokes 'schema:apply-update':
     - Backend regenerates SQL from parameters.
     - Computes SHA-256 hash.
     - Acquires advisory lock: SELECT pg_try_advisory_lock(hashtext('migrateiq_schema_update_orders'));
     - Checks ledger: SELECT version FROM public.migrateiq_schema_history WHERE checksum = $1; (0 rows).
     - Executes DDL live.
     - Verifies column in information_schema.columns.
     - Inserts record into public.migrateiq_schema_history.
     - Releases advisory lock in finally block.

  8. UI Renders Migration Integrity Certificate:
     Terminal streams completed log lines.
     UI renders certificate card displaying Token MIC-2026-[HASH], verified badges, and execution time.
  ```

---

## 5. "WHY DID YOU CHOOSE THIS?" Questions

### Q5.1: Why did you choose non-blocking `pg_try_advisory_lock` instead of standard SQL `LOCK TABLE`?
- **Short Viva Answer:**
  `LOCK TABLE` blocks the executing connection until the lock becomes available. If another transaction holds a conflicting lock, MigrateIQ hangs indefinitely, tying up a database connection and risking deadlocks. `pg_try_advisory_lock` is an application-level lock that returns `false` immediately if another session holds it, allowing us to abort cleanly with a user-friendly error.
- **If Examiner Asks Further:**
  Furthermore, `LOCK TABLE` requires an open transaction block and conflicts directly with client reads and writes. Advisory locks do not block normal application SELECT or INSERT queries; they only conflict with other MigrateIQ migration workers. The lock key is derived deterministically via `hashtext('migrateiq_schema_update_' || tableName)`. And crucially, we release the lock in a `finally` block, ensuring that even if an unhandled error occurs, the lock is never left dangling.

### Q5.2: Why did you use deterministic SHA-256 script hashing for idempotency instead of simple sequential version numbers?
- **Short Viva Answer:**
  Sequential version numbers only tell you *when* a script was scheduled; they do not guarantee *what* was executed. If an engineer renames a migration file or re-runs a script after modifying its contents, version numbers fail to detect the tampering. A cryptographic SHA-256 hash uniquely fingerprints the exact text of the statements being executed.
- **If Examiner Asks Further:**
  Before executing DDL, MigrateIQ computes `createHash('sha256').update(sql).digest('hex')` and queries `public.migrateiq_schema_history` for `checksum = $1 AND success = true`. If found, execution is blocked with `IDEMPOTENT_DUPLICATE_BLOCKED`. Furthermore, this hash is recorded in the exported `manifest.json` and Migration Integrity Certificate. If an out-of-band edit occurs on the target database, the SHA-256 hash mismatch immediately alerts the DBA.

### Q5.3: Why did you implement the Expand & Contract pattern as a 3-phase advisor rather than attempting an automatic one-step table swap?
- **Short Viva Answer:**
  A one-step table rename or column drop is an irreversible breaking change for running microservices. No database tool can magically rewrite running microservice code in memory. The Expand & Contract pattern decouples database schema changes from application deployment into three zero-downtime phases: Expand, Backfill, and Contract.
- **If Examiner Asks Further:**
  In `schemaUpdate.ts` (`generateEvolutionStrategy`), when a user attempts a `renameColumn`, MigrateIQ advises:
  1. *Phase 1 (Expand):* Add the new column alongside the old one. Microservices begin dual-writing to both.
  2. *Phase 2 (Backfill):* MigrateIQ generates the background backfill statement (`UPDATE table SET new_col = old_col WHERE new_col IS NULL;`) to synchronize historical records without table locks.
  3. *Phase 3 (Contract):* Once microservices have been redeployed to read exclusively from the new column, the legacy column is physically dropped.
  This teaches DBAs cloud-native, zero-downtime evolution principles rather than relying on dangerous monolithic locks.

---

## 6. Failure Scenario Questions

### Q6.1: What happens if a database connection drops halfway through a live multi-statement batch?
- **Short Viva Answer:**
  In PostgreSQL, because multi-statement batches execute inside an explicit transaction block (`BEGIN ... COMMIT`), a dropped connection causes the PostgreSQL server to detect an aborted socket and issue an automatic `ROLLBACK;`. The database is left completely clean with zero partial changes. In MongoDB, our pre-migration snapshot collection preserves the original state for 1-click restoration.
- **If Examiner Asks Further:**
  In `schemaUpdate.ts` (lines 2523–2545), if any statement in a batch fails, the loop breaks immediately, records the failure, and triggers `ROLLBACK;`. The in-database ledger marks the migration with `success: false` and appends `[FAILED]` to the description. When the user reconnects, our Schema Drift Radar queries the physical catalog to confirm that no orphaned columns remain.

### Q6.2: What happens if a DBA attempts to add a `NOT NULL` column to a table with 50,000 existing rows without specifying a default value?
- **Short Viva Answer:**
  In Step 4 (Risk & Policy Check), our engine flags this as a **Critical Risk** (`risk_not_null_no_default_populated`), warning that PostgreSQL will throw error `23502` because existing rows would receive NULL. It provides a 1-click auto-fix button to supply a default value or make the column nullable.
- **If Examiner Asks Further:**
  If the user ignores the warning and attempts to deploy, the Step 6 Pre-Flight Dry Run will execute the statement inside `BEGIN ... ROLLBACK`. PostgreSQL immediately rejects the query with:
  `ERROR: column "loyalty_tier" of relation "customers" contains null values (SQLSTATE 23502)`.
  The dry run fails cleanly, displaying a plain-English explanation and preventing the user from ever applying the broken DDL to live production.

### Q6.3: What happens if two DBAs click "Deploy Changes" on the same table at the exact same millisecond?
- **Short Viva Answer:**
  One worker acquires the non-blocking PostgreSQL advisory lock (`pg_try_advisory_lock`). The second worker is immediately denied the lock (`locked: false`). MigrateIQ aborts the second worker's execution instantly with error code `CONCURRENCY_LOCK_CONFLICT` and displays: *"Table is currently locked by another concurrent migration session."*
- **If Examiner Asks Further:**
  We verified this exact scenario in `scripts/test-phase11-chaos-adversarial.js` (Scenario 1 & 2). Two independent client sessions connected simultaneously. Session A acquired the lock. Session B's attempt returned `locked: false` in under 1 millisecond without blocking the connection pool. When Session A completed and released the lock in its `finally` block, Session B was able to acquire it cleanly.

---

## 7. Edge Case Questions

### Q7.1: Why does PostgreSQL fail if you put `CREATE INDEX CONCURRENTLY` inside a transaction, and how does MigrateIQ handle this?
- **Short Viva Answer:**
  `CREATE INDEX CONCURRENTLY` requires two table scans across multiple internal transactions to build the index without write-locking the table. Because it manages its own transactions, PostgreSQL forbids `CONCURRENTLY` inside an explicit `BEGIN ... COMMIT` block (`SQLSTATE 25001`). MigrateIQ automatically detects `concurrently: true` and strips the transaction wrapper.
- **If Examiner Asks Further:**
  In `generatePostgreSqlScripts()`, if `operation === 'addIndex'` and `concurrently === true`, the script is emitted as a standalone statement with `SET lock_timeout = '5s'`. In the dry run simulation (`schema:dry-run`), because PostgreSQL prohibits concurrent index creation in a rollback block, the engine validates the syntax and confirms non-blocking semantics without executing a failing transactional block.

### Q7.2: What happens if a user inputs a column name that matches a PostgreSQL reserved keyword like `user` or `order`?
- **Short Viva Answer:**
  Our Enterprise Policy Guard flags the keyword under rule `PG-POLICY-002` ("Reserved SQL Keyword"). Furthermore, our SQL generator automatically quotes all identifiers in double quotes (`"user"`, `"order"`), preventing syntax errors in the generated DDL.
- **If Examiner Asks Further:**
  PostgreSQL has strict reserved keywords that cannot be used as unquoted column names without syntax errors. `schemaUpdate.ts` maintains an active `POSTGRES_RESERVED_WORDS` set (lines 429–440). When a keyword is detected, Step 4 renders an amber policy warning explaining that while double quotes allow creation, future raw SQL queries or ORMs without quotes may fail.

### Q7.3: What happens if a table name exceeds PostgreSQL’s 63-byte identifier limit?
- **Short Viva Answer:**
  PostgreSQL truncates identifiers longer than 63 bytes (`NAMEDATALEN - 1`). Naive truncation can cause collisions if two long table names share the first 63 characters. MigrateIQ passes all names through `sanitizeIdentifier()`, which truncates names to 58 characters and appends a deterministic 4-character hex hash computed from the full name.
- **If Examiner Asks Further:**
  Tested in `scripts/test-phase11-security-audit.js` (Group 2), an identifier like `a_very_long_table_name_that_exceeds_the_standard_postgresql_limit_of_63_characters` is safely normalized to `a_very_long_table_name_that_exceeds_the_standard_post_a1b2`, guaranteeing identifier uniqueness in the catalog.

---

## 8. Database & Data Integrity Questions

### Q8.1: Does rolling back a DDL transaction in PostgreSQL undo everything? What side effects persist?
- **Short Viva Answer:**
  In PostgreSQL, DDL is transactional, so `ROLLBACK;` undoes table creations, column alterations, and constraint additions completely. However, non-transactional side effects—such as sequence value increments (`nextval`), system catalog OID consumption, and advisory locks—are **not** rolled back.
- **If Examiner Asks Further:**
  This is a classic database examiner trap. If a table has an auto-incrementing `SERIAL` or `BIGSERIAL` primary key and a dry-run insert executes `nextval()`, the sequence counter increments in memory and does **not** revert when the transaction rolls back. This is by design in PostgreSQL to prevent sequence locks across concurrent transactions. We explain this honestly: table structure is 100% restored, but sequence gaps are a natural consequence of database MVCC.

### Q8.2: How does MigrateIQ guarantee rollback integrity in MongoDB if MongoDB does not have transactional DDL?
- **Short Viva Answer:**
  MongoDB document field mutations (like `$unset` to drop a field) cannot be rolled back with a simple `ROLLBACK` statement. To guarantee data integrity, MigrateIQ creates a pre-migration snapshot backup collection (`<collection>_backup_<timestamp>`) before executing destructive changes, enabling 1-click physical state restoration.
- **If Examiner Asks Further:**
  In `scripts/test-mongo-rollback-verification.js`, we proved this across 22 automated assertions:
  1. Collection initialized with 500 documents.
  2. Snapshot backup created via `schema:create-backup`.
  3. Destructive `$unset` executed (field removed across all 500 documents).
  4. 1-Click Rollback invoked: documents restored from snapshot.
  5. Post-rollback audit confirmed 100% document count parity and field value restoration down to 0% data drift.

---

## 9. Security Defense Questions

### Q9.1: Why can SQL values be parameterized using `$1, $2`, but SQL identifiers (table and column names) cannot? How does MigrateIQ secure identifiers?
- **Short Viva Answer:**
  SQL protocols (like PostgreSQL wire protocol) only support parameterization for literal data values in the query plan. Object identifiers—such as table names, column names, and data types—define the query plan itself and cannot be parameterized. MigrateIQ secures identifiers through strict sanitization (`sanitizeIdentifier`) and double-quoting.
- **If Examiner Asks Further:**
  `sanitizeIdentifier()` in `utils.ts`:
  1. Strips semicolons (preventing command chaining: `table"; DROP TABLE users; --`).
  2. Strips comment dashes (`--`).
  3. Strips single quotes and null bytes (`\0`).
  4. Enforces a 63-byte length cap.
  5. Wraps the result in double quotes: `"public"."customers"`.
  Verified in `scripts/test-phase11-security-audit.js` (Group 2) against multiple SQL injection vectors.

### Q9.2: How does MigrateIQ prevent sensitive database credentials from leaking into error logs and audit reports?
- **Short Viva Answer:**
  All error messages, console logs, stack traces, and audit reports pass through a centralized `maskSensitiveFields()` redaction function that regex-replaces passwords in connection strings with `••••••••` while preserving host and database names for diagnostic tracing.
- **If Examiner Asks Further:**
  Tested in `scripts/test-phase11-security-audit.js` (Group 1):
  - `postgres://postgres:SuperSecretP@ssw0rd!@10.0.0.15:5432/finance_db` -> `postgres://postgres:••••••••@10.0.0.15:5432/finance_db`.
  - MongoDB URIs with URL-encoded passwords (`TopSecretMongoP%40ss`) are similarly scrubbed.
  - Exported CI/CD workflows and ZIP manifests strictly reference environment secrets (`${{ secrets.DATABASE_URL }}`).

---

## 10. Performance & Scalability Questions

### Q10.1: How does schema update performance differ between PostgreSQL and MongoDB as dataset size scales from 1,000 to 25,000 records?
- **Short Viva Answer:**
  In PostgreSQL, adding a nullable column or a column with a constant default is a metadata-only catalog update; latency is virtually constant (~2.99 ms at 25,000 rows). In MongoDB, adding a field with a default requires physically updating every document on disk via `updateMany`; latency scales linearly (O(N)), taking ~49 ms for 1,000 docs and ~1,478 ms for 25,000 docs.
- **If Examiner Asks Further:**
  These numbers are backed by empirical scale benchmarks collected in `scripts/test-phase11-scale-benchmark.js`:
  - **PostgreSQL Execution:** 1k rows = 4.36 ms; 10k rows = 3.38 ms; 25k rows = 2.99 ms (Memory delta: < 0.1 MB).
  - **MongoDB Execution:** 1k docs = 49.15 ms; 10k docs = 685.71 ms; 25k docs = 1,478.49 ms (Memory delta: ~0.2 MB).
  This highlights a fundamental architectural distinction: relational engines optimize DDL through system catalog metadata, whereas document stores treat schema mutations as batch data writes.

---

## 11. Security, Reliability & Production Scenarios

### Q11.1: What safeguards prevent an engineer from accidentally dropping a production database table?
- **Short Viva Answer:**
  Three interlocking safeguards:
  1. *Risk Scorecard (Step 4):* Flags `dropTable` / `dropColumn` as **Critical Risk** with an irreversible data loss warning.
  2. *Pre-Migration Snapshot (Step 5):* Prompts creation of an automated backup snapshot table.
  3. *Production Shield Hard Barrier (Step 6):* Blocks the deploy button behind an uncompromising modal requiring the user to manually type the exact token `CONFIRM_DROP`.
- **If Examiner Asks Further:**
  In `SchemaUpdateWizard.tsx` (lines 2463–2518), `ProductionShieldModal` verifies:
  `shieldConfirmationInput.trim() !== 'CONFIRM_DROP'`. The "Authorize & Deploy" button is physically disabled until the exact token matches. This prevents casual misclicks, accidental enters, or automated script triggers from executing destructive operations.

---

## 12. Examiner Trap Questions

### Q12.1: Trap: "You said your Pre-Flight Dry Run guarantees that the migration will succeed in production. Does it really?"
- **How to Answer Honestly:**
  "No, sir. We do **not** claim a 100% guarantee, and it would be technically incorrect to do so. The pre-flight dry run proves that the DDL statements are syntactically valid against the *current* catalog state and that table locks could be acquired at that specific moment. However, it cannot guarantee against future concurrency conditions—such as another long-running transaction acquiring an exclusive lock immediately before live execution, or network partitions occurring between simulation and deployment. That is precisely why our live execution step retains the 5-second lock timeout and advisory lock guards."

### Q12.2: Trap: "Your Gemini AI converts plain English to DDL. Can an attacker perform prompt injection through the natural language box to execute malicious commands?"
- **How to Answer Honestly:**
  "We considered prompt injection carefully. The Gemini AI output is **never** executed directly as raw SQL. The AI prompt instructs the model to return strictly structured JSON matching the `NL2DDLResponse` schema (operation, table, column, data type). That JSON is then parsed and fed into the exact same parameter sanitization pipeline as the visual form. Even if an attacker tricked the AI into returning `table: 'users; DROP DATABASE;'`, our backend `sanitizeIdentifier()` strips the semicolon and quotes, preventing the injection. Furthermore, the user must review the populated form and pass through the dry-run cockpit before anything executes."

### Q12.3: Trap: "You claim 100% parity between PostgreSQL and MongoDB. But MongoDB doesn't have DDL, tables, or foreign keys. Isn't that claim misleading?"
- **How to Answer Honestly:**
  "That is an important distinction. We claim **workflow-level parity**, not structural emulation. We do not attempt to force relational abstractions onto MongoDB. Instead, we map evolution concepts to engine-native primitives: in PostgreSQL, an operation translates to transactional DDL (`ALTER TABLE`) and `information_schema` queries; in MongoDB, that same operational intent translates to collection mutations (`updateMany`), `$jsonSchema` validation rules (`collMod`), and snapshot backup collections. Both engines undergo the same 7-step safety pipeline, but execute using their native database mechanisms."

---

## 13. Counterfactual / "What If We Changed It?" Questions

### Q13.1: What if we removed the session-level `SET lock_timeout = '5s'`?
- **Answer:**
  If `lock_timeout` were omitted, PostgreSQL would default to waiting indefinitely (`lock_timeout = 0`). In a production system under heavy load, an `ALTER TABLE` command waiting for an `ACCESS EXCLUSIVE` lock queues behind active read queries, while all subsequent read/write queries queue behind the `ALTER TABLE`. Within seconds, the database connection pool exhausts, causing a catastrophic application-wide outage. The 5-second timeout ensures MigrateIQ fails fast rather than taking down the production system.

### Q13.2: What if we executed raw SQL scripts directly in Mode C instead of tokenizing them into `SchemaChangeParams`?
- **Answer:**
  Executing raw scripts directly would completely bypass MigrateIQ's safety pipeline. The script would evade the Enterprise Policy Guards (`PG-POLICY-001..4`), skip the Change Impact Scorecard, bypass identifier sanitization, and execute without pre-flight simulation or ledger tracking. Tokenizing raw scripts into structured parameters ensures that even imported legacy scripts are subject to the same rigorous safety standards as visual form changes.

---

## 14. Cross-Phase Questions

### Q14.1: How does Phase 11 connect to Phase 14 (Schema Version History) and Phase 18 (Code Assistant)?
- **Answer:**
  - **Connection to Phase 14:** Every successful or failed schema update in Phase 11 is recorded in `electron-store` and `public.migrateiq_schema_history`. Phase 14's Schema Version History screen reads this ledger, rendering an interactive visual timeline where DBAs can view historical forward scripts and download 1-click rollback SQL files.
  - **Connection to Phase 18:** Phase 18 provides an AST-driven Code Migration Studio that refactors application backend code (Mongoose ➔ Prisma). When Phase 11 updates a schema (e.g., adding a column or changing a type), Phase 18 uses the updated schema definition to generate accurate Prisma models and refactor backend controllers without manual schema re-entry.

---

## 15. Real-World Scenario Questions

### Scenario A: A production PostgreSQL table with 10 million rows needs a new `status` column with default `'active'` and `NOT NULL`. How does MigrateIQ handle this without downtime?
- **Answer:**
  1. *Version Awareness:* In PostgreSQL 11+, adding a column with a constant default does not rewrite the table; it updates catalog metadata in O(1) time.
  2. *Lock Guard:* MigrateIQ prepends `SET lock_timeout = '5s';`. If the table is busy, it aborts rather than freezing the connection pool.
  3. *Dry Run:* In Step 6, the pre-flight cockpit verifies that PostgreSQL applies the metadata update without rewriting rows.
  4. *Live Apply:* Advisory lock acquired, statement applied in ~3 ms, and recorded in `migrateiq_schema_history`.

---

## 16. "SHOW ME THE CODE" Questions

| Examiner Request | File Path | Function / Identifier | Line Numbers |
| :--- | :--- | :--- | :--- |
| *"Show me where PostgreSQL advisory locks are acquired."* | `apps/desktop/main/handlers/schemaUpdate.ts` | `SELECT pg_try_advisory_lock` in `schema:apply-update` | Lines 1776-1795 |
| *"Show me where the lock timeout is prepended to SQL."* | `apps/desktop/main/handlers/schemaUpdate.ts` | `generatePostgreSqlScripts()` | Lines 283, 295 |
| *"Show me where SHA-256 script hashing prevents duplicate runs."* | `apps/desktop/main/handlers/schemaUpdate.ts` | `createHash('sha256')` check in `schema:apply-update` | Lines 1797-1824 |
| *"Show me the offline regex fallback parser for NL2DDL."* | `apps/desktop/main/handlers/schemaUpdate.ts` | `parseNaturalLanguageOffline()` | Lines 605-730 |
| *"Show me where raw SQL scripts are tokenized in Mode C."* | `apps/desktop/main/handlers/schemaUpdate.ts` | `parseRawScript()` | Lines 843-1154 |
| *"Show me the Production Shield authorization modal."* | `apps/desktop/renderer/src/screens/SchemaUpdateWizard.tsx` | `ProductionShieldModal` JSX | Lines 2463-2518 |
| *"Show me the in-database ledger table creation statement."* | `apps/desktop/main/handlers/schemaUpdate.ts` | `ensurePostgresLedger()` | Lines 1546-1562 |
| *"Show me the post-execution physical catalog verification."* | `apps/desktop/main/handlers/schemaUpdate.ts` | Catalog check in `schema:apply-update` | Lines 1831-1887 |

---

## 17. Rapid-Fire Questions

- **Q: What is `pg_try_advisory_lock`?**  
  **A:** A non-blocking PostgreSQL application lock used by MigrateIQ to prevent concurrent migrations on the same table.
- **Q: What is SQLSTATE `55P03`?**  
  **A:** PostgreSQL error code for `lock_not_available`, thrown when lock acquisition exceeds our 5-second timeout.
- **Q: What is SQLSTATE `23502`?**  
  **A:** `not_null_violation`, thrown when inserting NULL into a NOT NULL column.
- **Q: What is SQLSTATE `25001`?**  
  **A:** `active_sql_transaction`, thrown if `CREATE INDEX CONCURRENTLY` runs inside `BEGIN ... COMMIT`.
- **Q: What is the Production Shield token for destructive changes?**  
  **A:** `CONFIRM_DROP`.
- **Q: What is the name of the PostgreSQL ledger table?**  
  **A:** `public.migrateiq_schema_history`.
- **Q: What is the name of the MongoDB ledger collection?**  
  **A:** `_migrateiq_schema_history`.
- **Q: What algorithm hashes migration scripts?**  
  **A:** Cryptographic SHA-256 (`crypto.createHash('sha256')`).
- **Q: What are the three phases of Expand & Contract?**  
  **A:** Phase 1: Expand (add column & dual-write), Phase 2: Backfill (copy historical data), Phase 3: Contract (drop legacy column).
- **Q: What library exports the production ZIP package?**  
  **A:** `archiver` in Node.js.

---

## 18. Difficult Examiner Questions

### Q18.1: "How does your advisory lock behave in a connection pool with Transaction Pooling (like PgBouncer in transaction mode)?"
- **Short Viva Answer:**
  Session-level advisory locks (`pg_advisory_lock`) can leak if connections are pooled at the transaction level. For this reason, MigrateIQ maintains dedicated, direct client connections for migration sessions, sets strict statement timeouts, and explicitly executes `SELECT pg_advisory_unlock(...)` in a guaranteed `finally` block before closing the client socket.
- **If Examiner Asks Further:**
  When connecting through tools like PgBouncer in `transaction` or `statement` pooling mode, session-level locks belong to the pooled server connection, not the client session. If a client disconnected without releasing the lock, the pooled connection would hold it. In MigrateIQ, we avoid this by bypassing transaction poolers for administrative DDL, connecting directly to the primary database instance on port 5432 with explicit connection lifecycle control.

### Q18.2: "In Mode C, your raw script parser uses regular expressions. What happens if a DBA submits complex PL/pgSQL procedures, dollar-quoted strings (`$$`), or nested triggers?"
- **Short Viva Answer:**
  Our Mode C regex tokenizer is explicitly scoped to standard single-statement DDL operations: `ALTER TABLE` (add, drop, rename, alter type), `CREATE/DROP INDEX`, and MongoDB `updateMany`/`createIndex`. It does **not** attempt to parse complex procedural blocks or triggers. If an unparseable procedural block is entered, `parseRawScript()` returns `success: false` with a clear message explaining that procedural blocks should be deployed via external migration pipelines.
- **If Examiner Asks Further:**
  Parsing arbitrary procedural SQL requires a full SQL AST compiler (like `pg-query-native` or Tree-sitter). Attempting to parse arbitrary PL/pgSQL with regex is an anti-pattern. We explicitly designed `parseRawScript()` to fail safe: if it cannot deterministically match a known schema mutation pattern, it rejects the input rather than guessing or executing uninspected SQL.

---

## 19. Ideal Answer Style (Applied Throughout)
Every answer in this handbook uses our two-tier structure:
1. **Short Viva Answer (20–40 seconds):** Clear, confident, direct. Avoids defensive stalling or buzzwords.
2. **If Examiner Asks Further (Technical Depth):** Line numbers, database error codes, architectural trade-offs, and empirical benchmark evidence.

---

## 20. Things I Absolutely Must Know

1. **Phase Purpose:** 7-step Database Schema Evolution Workbench (Workflow C) providing dual-engine parity for PostgreSQL and MongoDB.
2. **Core Backend File:** `apps/desktop/main/handlers/schemaUpdate.ts` (3,399 lines, 19 IPC channels).
3. **Core Frontend File:** `apps/desktop/renderer/src/screens/SchemaUpdateWizard.tsx` (2,522 lines).
4. **Triple-Mode Authoring:** Mode A (Visual Form), Mode B (Gemini AI NL2DDL with offline regex fallback), Mode C (Raw Script Tokenizer).
5. **Lock Timeout Defense:** `SET lock_timeout = '5s';` prepended to all PostgreSQL scripts prevents freezing production connection pools.
6. **Concurrency Guard:** `SELECT pg_try_advisory_lock(hashtext('migrateiq_schema_update_' || tableName))` prevents simultaneous migrations on the same table.
7. **Idempotency Guard:** Deterministic SHA-256 script hashing checked against `migrateiq_schema_history` blocks duplicate runs.
8. **Dry-Run Mechanism:** Pre-flight simulation runs inside `SET lock_timeout = '5s'; BEGIN; ... ROLLBACK;`. Zero persistent changes are written.
9. **Zero-Downtime Indexing:** `CREATE INDEX CONCURRENTLY` is stripped of transaction wrappers because PostgreSQL forbids `CONCURRENTLY` in `BEGIN ... COMMIT`.
10. **MongoDB Snapshot Safety:** Clones collection to `<name>_backup_<timestamp>` before destructive mutations to enable true rollback.
11. **Expand & Contract Pattern:** Decouples destructive changes into Expand (dual-write), Backfill (historical sync), and Contract (physical drop).
12. **Production Shield:** Modal requires typing `CONFIRM_DROP` or `APPLY_TO_PRODUCTION` before sensitive operations execute.
13. **In-Database Ledger:** Shared tracking in `public.migrateiq_schema_history` and `_migrateiq_schema_history`.
14. **Catalog Verification:** Confirms physical presence in `information_schema.columns` or `pg_indexes` following execution.
15. **Verified Integrity:** Backed by 233 automated test assertions passing 100% across 6 test suites.

---

## 21. Top 20 Questions To Practice

1. **What is Phase 11?** -> In-place Database Schema Evolution Workbench (Workflow C) for PostgreSQL and MongoDB across a 7-step lifecycle.
2. **Why not just use psql or MongoDB Compass?** -> Manual tools lack out-of-band drift detection, AI translation, automated policy checks, pre-flight dry-runs, and in-database ledger tracking.
3. **How does MigrateIQ prevent DDL lock freezes?** -> Enforces session-level `SET lock_timeout = '5s';` on every generated PostgreSQL script.
4. **How do advisory locks work in MigrateIQ?** -> Uses non-blocking `pg_try_advisory_lock(hashtext(...))`; returns `false` immediately if another migration session is active.
5. **Why can't `CREATE INDEX CONCURRENTLY` run in a transaction?** -> PostgreSQL core engine forbids `CONCURRENTLY` in `BEGIN ... COMMIT` (`SQLSTATE 25001`) because it manages its own internal transactions.
6. **How does the idempotency guard work?** -> Computes SHA-256 hash of script text and blocks execution if `checksum` already exists in `migrateiq_schema_history`.
7. **What is the Schema Drift Radar?** -> Introspects physical database catalog tables and compares them against scripts in the ledger to flag unmanaged out-of-band tables.
8. **What does the Pre-Flight Dry Run do?** -> Executes statements inside `BEGIN ... ROLLBACK` with lock latency measurement; zero persistent state written.
9. **How do you rollback destructive changes in MongoDB?** -> Restores documents from pre-migration backup snapshot collections (`<name>_backup_<timestamp>`).
10. **What is the Production Shield?** -> An authorization modal requiring DBAs to manually type `CONFIRM_DROP` or `APPLY_TO_PRODUCTION`.
11. **How do you prevent SQL identifier injection in DDL?** -> `sanitizeIdentifier()` strips semicolons, dashes, quotes, null bytes, caps at 63 bytes, and double-quotes identifiers.
12. **Why regenerate SQL on the backend instead of running client strings?** -> Defense-in-depth: prevents a compromised renderer or IPC injection from executing arbitrary commands.
13. **How does Gemini AI NL2DDL fallback work?** -> Tries a cascade of Gemini models; if network or API fails, drops down to local offline regex parser (`parseNaturalLanguageOffline`).
14. **What does Mode C do?** -> Tokenizes raw SQL/MongoDB scripts into strongly-typed `SchemaChangeParams` so they pass through all safety and policy checks.
15. **What are the 4 Enterprise Policies (`PG-POLICY-001..4`)?** -> Snake_case naming, reserved SQL keywords, large VARCHAR (>1000), and unindexed foreign keys on populated tables.
16. **What is the Expand & Contract pattern?** -> Splitting breaking schema changes into Phase 1 (Expand), Phase 2 (Backfill), and Phase 3 (Contract) to achieve zero downtime.
17. **What is the Migration Integrity Certificate?** -> A tamper-evident visual dossier displaying certificate token `MIC-2026-[HASH]`, SHA-256 hash, and catalog verification stamp.
18. **Why does MongoDB scale linearly while PostgreSQL DDL is constant time?** -> PostgreSQL DDL is a catalog metadata update; MongoDB `$set`/`$unset` mutates physical documents on disk.
19. **What persists after a PostgreSQL DDL transaction rolls back?** -> Sequence counter increments (`nextval`) and advisory locks; table structures roll back 100%.
20. **How many automated tests verify Phase 11?** -> 233 automated test assertions passing 100% across 6 test suites.

---

## 22. 5-Minute Viva Revision Sheet

```
+---------------------------------------------------------------------------------------------------+
|                                 PHASE 11 FIVE-MINUTE VIVA REVISION                                |
+---------------------------------------------------------------------------------------------------+
| • WORKFLOW: Workflow C — Database Schema Evolution Workbench (PostgreSQL & MongoDB).              |
| • 7 STEPS: Target/Tier ➔ Drift Radar ➔ Studio ➔ Impact/Policy ➔ Strategy ➔ Dry-Run ➔ Execution.   |
| • CORE FILE: apps/desktop/main/handlers/schemaUpdate.ts (3,399 lines, 19 IPC channels).           |
| • 3 MODES: Mode A (Form), Mode B (Gemini AI NL2DDL + Regex Fallback), Mode C (Raw Script Parser). |
| • LOCK TIMEOUT: SET lock_timeout = '5s'; aborts waiting DDL before connection pools freeze.       |
| • CONCURRENCY: SELECT pg_try_advisory_lock(...) non-blocking table lock; auto-unlock in finally.  |
| • IDEMPOTENCY: createHash('sha256') checked against migrateiq_schema_history blocks re-runs.     |
| • SIMULATION: SET lock_timeout = '5s'; BEGIN; ... ROLLBACK; measures latency with zero changes.   |
| • INDEX EXCEPTION: CREATE INDEX CONCURRENTLY runs outside transaction blocks (SQLSTATE 25001).    |
| • MONGO SAFETY: Clones collection to <name>_backup_<timestamp> before destructive mutations.      |
| • EXPAND & CONTRACT: Decouples breaking changes into Expand ➔ Backfill ➔ Contract.                |
| • PRODUCTION SHIELD: Requires typing CONFIRM_DROP or APPLY_TO_PRODUCTION in production tier.      |
| • LEDGER: In-database tracking in public.migrateiq_schema_history and _migrateiq_schema_history.  |
| • CATALOG VERIFICATION: Confirms column physically exists in information_schema.columns.          |
| • SECURITY: sanitizeIdentifier() caps at 63 bytes, strips ; -- \0; maskSensitiveFields() hides PW. |
| • PERFORMANCE: Postgres DDL = ~3ms (metadata); Mongo updateMany = ~1.4s at 25k docs (O(N) data).   |
| • TEST SUITE: 233 assertions across 6 test suites (100% pass rate).                               |
+---------------------------------------------------------------------------------------------------+
```
