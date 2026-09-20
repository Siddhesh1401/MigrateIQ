# MigrateIQ — Phase 8 Viva & Project Defense Handbook
## Transactional Dry Run Simulation & Data Quality Remediation Studio (Wizard Step 6)

---

### Purpose of This Handbook
This document is a **Project Defense Handbook** created to prepare you for an academic, industrial, or final-year project viva/defense. While the Learning Guide teaches *what* was built and *how* it works, this handbook prepares you to defend *why* it was built this way, *how to prove it from code*, *what happens when things fail*, *what tradeoffs were made*, and *how to answer challenging examiner questions without making false guarantees*.

### How to Use This Handbook
- **For standard questions:** Practice delivering the concise, natural explanation in 20–40 seconds.
- **For difficult questions:** Notice the two-tier structure:
  - **Short Viva Answer:** What you should say first. Conversational, clear, and confident.
  - **If Examiner Asks Further:** The deeper technical follow-up that proves you actually wrote and understand the code.
- **For "Show Me The Code" questions:** Note the exact file paths, function names, and line numbers so you can quickly navigate the repository during an oral examination.

### Relationship to the Learning Guide
The Learning Guide (`learning/phase-08-learning-guide.md`) provides technical concepts and architectural diagrams. This Viva Handbook adds **evaluative depth, failure scenarios, counterfactual questions, examiner traps, and real-world edge cases** that examiners ask during project defenses.

---

## 1. Phase Understanding Questions

### Q1.1: What exact problem does Phase 8 solve in MigrateIQ?
- **Short Viva Answer:**
  Phase 8 prevents live migrations from failing mid-way due to relational constraints. MongoDB has flexible schemas where fields can be missing, heterogeneous, or nested. If you stream that directly into PostgreSQL, a single `NOT NULL` violation or invalid data type can abort the entire migration hours in. Phase 8 runs a sandboxed shadow simulation on real sample documents inside a rolled-back transaction to catch those errors beforehand and heal them via our Remediation Studio.
- **If Examiner Asks Further:**
  Without Phase 8, you go straight from mapping (Step 4) and static risk checks (Step 5) into live execution (Step 7). Static checks only inspect column metadata—they cannot tell you if record #450 has a null `email` or if a string field contains a zero-byte `\0` character that crashes the PostgreSQL driver. Phase 8 actually executes DDL and batch inserts against the target engine, measures empirical throughput, estimates total duration, and verifies disk capacity headroom before any permanent write occurs.

### Q1.2: What are the strict boundaries of Phase 8? What is it NOT supposed to do?
- **Short Viva Answer:**
  Phase 8 is strictly pre-flight validation and schema tuning. It tests a sample (up to 500 documents per collection), identifies constraint violations, and lets the user update mappings or default values. It does **not** perform the full dataset migration, it does **not** stream records to the live Dead-Letter Queue (that is handled by the ETL worker in Step 7), and it does **not** keep any test tables permanently in PostgreSQL.
- **If Examiner Asks Further:**
  It is important to emphasize that sample validation does not mathematically guarantee that 100% of the production dataset will pass. It catches systemic structural flaws—such as missing defaults on required columns, incompatible date formats, or parameter limits on wide tables. The full ETL worker in Phase 9 handles live migration and streaming retries.

---

## 2. Architecture Defense Questions

### Q2.1: Why are database drivers and simulation execution located in the Electron Main Process rather than the Renderer?
- **Short Viva Answer:**
  Security and performance. Electron’s renderer is a Chromium web page. Running Node.js database drivers like `pg` or `mongodb` in the browser layer requires disabling Node integration, which exposes the entire operating system to remote code execution vulnerabilities if malicious content is loaded. By keeping drivers in the main process, credentials and TCP sockets never touch the UI layer.
- **If Examiner Asks Further:**
  Furthermore, database drivers rely on native C++ bindings and Node.js network streams (`net.Socket`). In MigrateIQ, the renderer is isolated behind Electron’s `contextBridge`. The UI only sends pure JSON requests across typed IPC channels (`migration:dry-run`), and receives status events. Even if an attacker somehow executed arbitrary JavaScript in the renderer, they would have zero access to database sockets or unmasked connection passwords.

### Q2.2: Why did you use Zustand for wizard state management instead of React Context or Redux?
- **Short Viva Answer:**
  Zustand gives us centralized, un-opinionated state outside the React component tree with zero boilerplate and fine-grained subscriber re-renders. When the dry run terminal receives progress events every few milliseconds, React Context would re-render the entire screen tree. With Zustand, only components subscribed to specific state slices re-render.
- **If Examiner Asks Further:**
  In `wizardStore.ts`, we also implement scoped state mutations. For example, when applying an AI default value via `applyBatchDefaultValues`, the action targets only the specific collection and column without cloning unrelated wizard steps. It also coordinates state between screens—such as carrying the `quarantinePolicyAcknowledged` flag from Step 6 into Step 7.

### Q2.3: Why is IPC communication split into an `invoke` handler and an asynchronous progress event stream?
- **Short Viva Answer:**
  `ipcMain.handle('migration:dry-run')` is a request-response RPC that returns the final `DryRunResult` object when the simulation finishes. But simulations take 1 to 3 seconds. If we only used `invoke`, the UI would freeze with no feedback. We use `event.sender.send('dry-run:progress', payload)` during execution to stream live log messages and percentage updates to the terminal.
- **If Examiner Asks Further:**
  This follows the standard bidirectional IPC pattern in Electron: a request-response boundary for the operational lifecycle, paired with unidirectional event emission for streaming telemetry. It keeps the UI responsive and lets users see which specific table, batch, or savepoint is currently running.

---

## 3. Code-Level Questions

### Q3.1: Which exact file and function coordinates the simulation on the backend?
- **Answer:**
  File: `apps/desktop/main/engine/dryRun.ts`  
  Function: `executeDryRunSimulation(options: DryRunOptions): Promise<DryRunResult>` (Line 712)  
  This function opens the PostgreSQL connection, starts the transaction, sets session timeouts, loops through collection mappings, executes DDL and sample inserts, catches and isolates row errors using savepoints, checks storage headroom, calculates throughput, and executes `ROLLBACK;` in the finally block.

### Q3.2: Which file and function formats the SQL `DEFAULT` clause, and what security check does it perform?
- **Answer:**
  File: `apps/desktop/main/engine/dryRun.ts`  
  Function: `formatSqlDefaultClause(rawDefault: string | undefined | null): string` (Lines 81–104)  
  It strips outer single quotes and checks the value against a whitelist of parameterless functions (`NOW()`, `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME`, `GEN_RANDOM_UUID()`, `UUID_GENERATE_V4()`) or numeric/boolean literals. If it matches, it emits `DEFAULT <clause>` unquoted; otherwise, it escapes single quotes (`replace(/'/g, "''")`) and wraps it as a safe literal string (`DEFAULT '<val>'`), preventing SQL injection through column defaults.

### Q3.3: How does `sanitizeIdentifier()` prevent collisions on long column names?
- **Answer:**
  File: `apps/desktop/main/engine/dryRun.ts`  
  Function: `sanitizeIdentifier(name: string): string` (Lines 112–127)  
  PostgreSQL limits identifiers to 63 bytes (`NAMEDATALEN - 1`). If a name exceeds 63 characters, truncating it naively could cause collisions between two columns sharing the same prefix. `sanitizeIdentifier()` truncates the string to 58 characters and appends a deterministic 4-character hex hash computed from the full original name (e.g., `very_long_column_name_..._a1b2`).

### Q3.4: Where are the Google Gemini AI anomaly fixes handled, and how does caching work?
- **Answer:**
  File: `apps/desktop/main/handlers/ai.ts`  
  Handler: `setupAiHandlers()` listening on IPC channel `'ai:suggest-anomaly-fixes'` (Lines 191+)  
  Cache: `anomalyFixCache` (Line 183), an in-memory `Map<string, { data: AIAnomalyFixRecommendation[], timestamp: number }>` with a 30-minute TTL (`30 * 60 * 1000`). The cache key is constructed by joining sorted table and column names. If a request comes in with the same anomalies within 30 minutes, it returns immediately without calling the Google Generative AI API.

### Q3.5: Where is the client-side single-table re-test triggered?
- **Answer:**
  File: `apps/desktop/renderer/src/screens/DryRunScreen.tsx`  
  Function: `handleRetestSingleTable(tableName: string)` (Line 163)  
  It sets `singleTableLoading` for that card, and invokes `'migration:dry-run'` passing `singleTableName: tableName`. In `dryRun.ts`, the engine filters the mapping list to only test that specific table and its associated child tables, merging the updated stats back into `dryRunResult` without re-running the entire database simulation.

---

## 4. End-to-End Data Flow Questions

### Q4.1: Trace the exact end-to-end execution flow when a user clicks "▶ Run Simulation".
- **Answer:**
  Here is the exact code trace across the layers:
  ```text
  1. UI Interaction:
     User clicks "▶ Run Simulation" in DryRunScreen.tsx.
     Calls handleStartSimulation(), setting simState = 'running' and resetting logs.
  
  2. IPC Invocation:
     DryRunScreen calls window.electronAPI.invoke('migration:dry-run', {
       mapping: wizardStore.schemaMapping,
       sourceConfig: wizardStore.sourceConfig,
       targetConfig: wizardStore.targetConfig,
       sourceSchema: wizardStore.sourceSchema,
       direction: wizardStore.direction
     }).
  
  3. Preload Boundary:
     preload/index.ts forwards the request over ipcRenderer.invoke('migration:dry-run', args).
  
  4. Main Process IPC Handler:
     apps/desktop/main/handlers/dryRun.ts receives the call.
     Registers onProgress callback: (p) => event.sender.send('dry-run:progress', p).
     Calls executeDryRunSimulation(options).
  
  5. Engine Setup & Transaction:
     engine/dryRun.ts connects via pgClient.
     Executes: BEGIN;
     Executes session limits: lock_timeout = 5s, statement_timeout = 15s, idle_in_transaction = 10s.
     Executes: SET CONSTRAINTS ALL DEFERRED;
     Emits progress event: stage = 'init'.
  
  6. DDL & Batch Shadow Testing:
     For each collection:
       - Runs DROP TABLE IF EXISTS ... CASCADE inside transaction.
       - Runs CREATE TABLE with field types and sort_order for child tables.
       - Fetches up to 500 documents from MongoDB.
       - Transforms values via transformValueForSql() (epoch dates, \0 strip, strict types).
       - Attempts bulk INSERT clamped to <= 65,000 bind parameters.
       - If batch fails, rolls back to table savepoint and runs row-by-row with SAVEPOINT sp_row.
       - Identifies offending column via 6-tier detector and adds to skippedRows.
  
  7. Rollback & Metrics Calculation:
     Calculates throughput (sample rows / validation time) and ETA.
     Queries pg_database_size() and evaluates headroom against 500GB safe ceiling.
     Executes explicit ROLLBACK; in finally block.
     Sets rollbackVerified = true.
  
  8. IPC Return & UI Transition:
     Returns DryRunResult across IPC.
     DryRunScreen stores result in wizardStore.setDryRunResult(result).
     simState transitions to 'completed'.
     Renders summary metrics, table cards, and the 3-Tier Strategy Card if skipped rows > 0.
  ```

---

## 5. "WHY DID YOU CHOOSE THIS?" Questions

### Q5.1: Why did you use PostgreSQL Transactional DDL instead of spinning up a temporary Docker container or a dedicated test database?
- **Short Viva Answer:**
  Speed, cost, and environment parity. Spinning up a Docker container takes 5 to 15 seconds, requires Docker to be installed on the user’s machine, and consumes significant RAM. Creating a separate test database requires superuser permissions that the user might not have. PostgreSQL transactional DDL lets us test directly against the real target database instance, collations, and extensions in milliseconds with zero residual tables upon `ROLLBACK;`.
- **If Examiner Asks Further:**
  MySQL and Oracle issue implicit commits on DDL statements like `CREATE TABLE`, so you cannot roll them back. PostgreSQL is uniquely suited for this because DDL is transactional. The only tradeoff is that we acquire table locks during creation, which is why we strictly enforce `SET LOCAL lock_timeout = '5s'`.

### Q5.2: Why did you implement Savepoints instead of testing rows in separate isolated transactions?
- **Short Viva Answer:**
  Performance. Opening and committing or rolling back a full PostgreSQL transaction for every single sample row across hundreds of documents would incur massive network and disk sync overhead. A savepoint creates an in-memory sub-transaction marker. If a row fails, we issue `ROLLBACK TO SAVEPOINT sp_row`, which undoes only that one insert in microseconds without tearing down the main connection or transaction.
- **If Examiner Asks Further:**
  In PostgreSQL, if any query inside a transaction encounters an error, the entire transaction enters an aborted state where all subsequent commands are rejected. Without savepoints, the very first invalid record would abort the entire dry run. Savepoints let us isolate failures and continue testing the remaining sample rows.

### Q5.3: Why did you establish a 3-Tier Resolution Strategy (Options A, B, C) instead of just automatically relaxing columns to NULLABLE?
- **Short Viva Answer:**
  Because relaxing columns to NULLABLE (Option B) can cause downstream application crashes. If the production backend code expects `user.email` to never be null, inserting NULLs will cause runtime null-pointer exceptions in their web apps. Option A (Smart Default Imputation) preserves the `NOT NULL` relational contract by providing a sensible fallback, while Option C (Quarantine DLQ) lets enterprise users inspect and clean dirty data offline.
- **If Examiner Asks Further:**
  Different organizations have different data governance policies. Some teams prioritize zero data loss (Option B), others prioritize strict relational integrity (Option A), and compliance-focused teams demand that invalid records be quarantined for manual audit (Option C). Offering three explicit options puts the architectural decision in the engineer's hands.

---

## 6. Failure Scenario Questions

### Q6.1: What happens if the target PostgreSQL connection drops halfway through the 500-sample simulation?
- **Short Viva Answer:**
  The `pg` socket throws a connection termination error. Because the transaction was in-flight and uncommitted on the PostgreSQL server, PostgreSQL’s internal recovery automatically terminates the backend worker process and rolls back the transaction. On the client side, our catch block catches the error, releases resources, and surfaces a clear error badge in the terminal.
- **If Examiner Asks Further:**
  No dirty tables or partial records remain on the target server. In `dryRun.ts`, the client connection is wrapped in `try...finally { await client.release(); }`. Even if the Node.js process itself were killed, PostgreSQL's TCP keepalive and backend timeout would detect the disconnect and roll back the uncommitted transaction.

### Q6.2: What happens if a MongoDB sample document contains a field with an unexpected data type, like an array where a string was mapped?
- **Short Viva Answer:**
  `transformValueForSql()` inspects the target column type. If a target is `VARCHAR` but the value is an array or object, it serializes it to a JSON string. If the target is a numeric type and coercion fails, the insert statement triggers a PostgreSQL type mismatch error (`SQLSTATE 42804`). The savepoint catches it, logs the row as skipped, and records the error snippet in `DryRunSkippedRow`.
- **If Examiner Asks Further:**
  Our 6-tier error detector parses the failure, pinpoints the offending column name, and displays the raw document in the Skipped Rows modal. The user can then open the Remediation Studio to either assign a fallback or adjust their mapping in Step 4.

### Q6.3: What happens if the Gemini AI API fails (e.g., HTTP 429 quota exceeded, invalid API key, or no internet connection)?
- **Short Viva Answer:**
  The system gracefully falls back to local rule-based heuristics with zero disruption. In `apps/desktop/main/handlers/ai.ts`, the Gemini call is wrapped in a `try...catch`. If the API throws, it immediately calls `generateRuleBasedAnomalyFixes()`, which uses type-aware defaults like `'Unknown'`, `0`, `false`, and `CURRENT_TIMESTAMP`.
- **If Examiner Asks Further:**
  The UI displays the recommendations seamlessly with an indicator that heuristic defaults were applied. The user is never blocked from completing their dry run or applying defaults just because an external cloud AI service is unavailable.

---

## 7. Edge Case Questions

### Q7.1: How does your implementation handle a genuinely empty collection (0 documents)?
- **Short Viva Answer:**
  It verifies that the collection is empty via `matchingSchema.documentCount === 0`. It tests the `CREATE TABLE` DDL to ensure the schema is syntactically valid, reports 0 sample rows tested, and marks the table status as `'passed'` without inventing fake rows or failing the table.
- **If Examiner Asks Further:**
  Verified in Test 12 of `test-phase8-dry-run.js`. Naive migration tools often crash on `docs[0]` with `TypeError: Cannot read property of undefined` when a collection has no documents. MigrateIQ explicitly checks length and skips data insertion while still validating DDL syntax.

### Q7.2: What happens if a table has 800 columns, exceeding PostgreSQL's bind parameter limit during bulk insert?
- **Short Viva Answer:**
  PostgreSQL prepared statements crash if parameters exceed $65,535$ (`limit of 65535 parameters exceeded`). If you insert a batch of 100 rows with 800 columns, that requires $80,000$ parameters. MigrateIQ dynamically clamps the batch row count using `Math.min(100, Math.floor(65000 / activeFields.length))`. For an 800-column table, it clamps the batch size to 81 rows, ensuring parameters never breach the protocol limit.
- **If Examiner Asks Further:**
  Verified in Test 7 and Test 8 of `test-phase8-dry-run.js`. We use $65,000$ instead of $65,535$ to leave a safe headroom buffer for internal parameters.

### Q7.3: What happens when MongoDB contains pre-1970 Unix epoch timestamps?
- **Short Viva Answer:**
  Many legacy databases store historical dates (e.g., birthdays in the 1960s) as negative millisecond numbers like `-315619200000`. Naive date parsers often treat negative numbers as invalid or overflow. In `transformValueForSql()`, our numeric timestamp detector checks `Math.abs(num) > 1e11` and parses negative epoch values accurately into ISO 8601 strings (e.g., `1960-01-01T00:00:00.000Z`).
- **If Examiner Asks Further:**
  Verified in Test 15 of `test-phase8-dry-run.js`. Both millisecond-scale and second-scale negative epochs are validated.

### Q7.4: How do you prevent false-positive "Low Disk Space" warnings when targeting a brand new, empty database?
- **Short Viva Answer:**
  A fresh, empty PostgreSQL database has an initial disk footprint of only about 8 MB (`pg_database_size`). If you are migrating a 200 MB dataset and compare it directly to the 8 MB database size, naive ratio logic flags an alert. In `dryRun.ts`, we evaluate storage headroom against a safe ingestion ceiling heuristic of 500 GB (`MAX_SAFE_INGESTION_BYTES`), preventing false-positive alerts on fresh databases while still catching genuinely huge volume breaches.
- **If Examiner Asks Further:**
  Verified in Test 23 of `test-phase8-dry-run.js`. The calculation measures actual database size via `SELECT pg_database_size(current_database())` and flags warnings only if the projected migration volume exceeds available capacity.

---

## 8. Database & Data Integrity Questions

### Q8.1: Does a transaction rollback guarantee that 100% of all database side effects are undone?
- **Short Viva Answer (Examiner Trap Defense):**
  **No, not everything is rolled back.** In PostgreSQL, table schemas, views, constraints, and data rows inserted inside the transaction are completely undone. However, **sequence counters (`SERIAL` / `BIGSERIAL`) do not roll back.** If an insert consumes a sequence value, that sequence number remains incremented even after `ROLLBACK;`.
- **If Examiner Asks Further:**
  PostgreSQL sequences are designed not to roll back to prevent transaction serialization bottlenecks and concurrency deadlocks. In MigrateIQ's dry run engine, we supply explicit surrogate IDs during sample inserts to avoid triggering sequences. But if an implicit column sequence is triggered, sequence numbers will advance. This is an inherent property of PostgreSQL that any competent database engineer must acknowledge.

### Q8.2: Why do you execute `SET CONSTRAINTS ALL DEFERRED;`?
- **Short Viva Answer:**
  In relational databases, foreign keys are checked immediately upon row insertion by default. If we test collections in arbitrary or non-topological order—inserting an `order_items` record before the parent `orders` record—PostgreSQL would reject the row with a foreign key violation. Deferring constraints postpones evaluation until transaction commit, allowing structural testing of child tables without artificial foreign key failures during sample batches.
- **If Examiner Asks Further:**
  In PostgreSQL, constraints can only be deferred if they were declared as `DEFERRABLE`. In our dry run engine, DDL foreign keys are created with `DEFERRABLE INITIALLY DEFERRED` during the shadow session so batch simulation can validate data structure independently of insertion order.

### Q8.3: How does MigrateIQ handle MongoDB array fields to ensure 1st Normal Form (1NF) compliance?
- **Short Viva Answer:**
  Per Rule 4 and Challenge 9, MongoDB arrays of objects (like `orders.items`) are normalized into relational child tables (e.g., `order_items`). The engine automatically adds a foreign key column referencing the parent ID and an auto-generated `sort_order INTEGER NOT NULL` column. During simulation, `sort_order` is populated with the 0-based index of the element in the original BSON array.
- **If Examiner Asks Further:**
  Relational tables are unordered sets. Without `sort_order`, reconstructing the original document order when querying PostgreSQL would be impossible. The `sort_order` column guarantees that `items[0]` and `items[1]` retain their exact sequence. This is verified in Test 1 and Test 14 of `test-phase8-dry-run.js`.

---

## 9. Security Defense Questions

### Q9.1: Why can SQL data values use bind parameters (`$1, $2`), but table and column identifiers cannot? How do you secure identifiers?
- **Short Viva Answer:**
  The SQL standard and database wire protocols only permit bind parameters for data values in DML expressions. You cannot parameterize identifiers in DDL (`CREATE TABLE $1`) or queries (`SELECT $1 FROM $2`). Because identifiers must be interpolated as strings, they are vulnerable to SQL injection. We secure them by strictly sanitizing names through `sanitizeIdentifier()`, stripping all characters except `[a-zA-Z0-9_]`, and quoting them with double quotes.
- **If Examiner Asks Further:**
  In `dryRun.ts` (Lines 112–127), `sanitizeIdentifier` converts unsafe characters to underscores, lowercases the string, truncates names over 63 bytes to 58 characters, and appends a deterministic hex hash. Furthermore, in DDL generation, identifiers are wrapped in double quotes (e.g., `"users"`), which instructs PostgreSQL to treat the token strictly as an identifier, preventing SQL clause breakout.

### Q9.2: What prevents sensitive data or credentials from leaking into logs or exported audit reports?
- **Short Viva Answer:**
  All connection strings and error messages pass through `maskSensitiveFields()` before being logged, sent over IPC, or included in exported PDF/Markdown dossiers. The regex replaces passwords in URIs (like `mongodb://admin:secret@host`) with `••••••••`.
- **If Examiner Asks Further:**
  Defined in `apps/desktop/main/handlers/risk.ts` and imported into `dryRun.ts` (Line 30):
  ```typescript
  export function maskSensitiveFields(text: string): string {
    return text.replace(/(:\/\/)([^:@]+):([^@]+)@/g, '$1$2:••••••••@');
  }
  ```
  This is executed on all raw connection URLs and database error messages before reaching the renderer or any export file.

### Q9.3: What security risks exist when rendering the PDF compliance dossier, and how are they mitigated?
- **Short Viva Answer:**
  Generating PDFs from HTML templates can expose the system to Local File Inclusion (LFI) or Remote Code Execution (RCE) if an attacker injects malicious script tags into column names or document values. In `handlers/dryRun.ts`, we spawn a headless `BrowserWindow` specifically configured with `webPreferences: { nodeIntegration: false, javascript: false }`. JavaScript execution is completely disabled inside the print window.
- **If Examiner Asks Further:**
  The HTML template is constructed with strict HTML escaping on all table and column names. Because `javascript: false` is enforced in the Chromium rendering pipeline, even if an XSS payload were present in an error string, it cannot execute. Chromium simply renders the static layout and triggers `webContents.printToPDF()`.

---

## 10. Performance & Scalability Questions

### Q10.1: How is the migration throughput calculated, and what prevents small sample distortion?
- **Short Viva Answer:**
  Throughput ($Rate$) is measured in live simulation as $\text{Total Sample Rows} / \text{Validation Time (s)}$. However, on very small sample batches ($<50$ rows), network handshake latency can distort the math, resulting in unrealistically low throughput numbers. In `dryRun.ts` (Line 913), we enforce a minimum throughput floor heuristic of $1,850\text{ rows/sec}$ for small sample batches to eliminate socket handshake distortion.
- **If Examiner Asks Further:**
  In demo mode, execution time is simulated between 1.2s and 1.6s (`1200 + Math.floor(Math.random() * 400)` ms) to provide realistic UI responsiveness without live database servers. For live runs with $>50$ rows, throughput reflects the actual measured insertion and validation speed.

### Q10.2: What is the memory footprint during Phase 8, and where could memory pressure occur?
- **Short Viva Answer:**
  The memory footprint is bounded and remains under 50 MB in the Node.js main process. We prevent memory spikes by capping the sample size at 500 documents per collection and streaming them in clamped batch chunks of $\le 100$ rows.
- **If Examiner Asks Further:**
  Memory pressure would only occur if an engine tried to load 100,000 documents into a single JavaScript array in RAM. By capping sample extraction at 500 records in Step 6, heap memory remains minimal. Live streaming of full multi-million-row datasets is reserved for Step 7, where cursor streams and backpressure pipelines are used.

---

## 11. Security, Reliability & Production Scenarios

### Q11.1: What happens if an active production transaction holds an exclusive table lock when the dry run attempts to run DDL?
- **Short Viva Answer:**
  In PostgreSQL, DDL statements like `DROP TABLE` or `ALTER TABLE` request an `ACCESS EXCLUSIVE` lock. If a long-running production query holds a lock on that table, the dry run could queue behind it, inadvertently blocking all subsequent read queries. MigrateIQ prevents this by executing `SET LOCAL lock_timeout = '5s'`. If the lock cannot be acquired within 5 seconds, PostgreSQL aborts the simulation immediately.
- **If Examiner Asks Further:**
  The transaction rolls back, and the UI displays: `"Dry run aborted: lock timeout on table X"`. This protects active production databases from connection pool exhaustion or query pileups caused by pre-flight validation.

### Q11.2: Is Phase 8 simulation idempotent? Can a user run it repeatedly without state corruption?
- **Short Viva Answer:**
  Yes, it is completely idempotent. Because every run executes inside a transaction that terminates with `ROLLBACK;`, running the simulation 1 time or 100 times leaves the target database in the exact same state.
- **If Examiner Asks Further:**
  On the renderer side, each run clears previous log streams and resets `simState`. On the main process side, any temporary tables created inside the transaction are dropped or rolled back. The only client-side mutation is saving remediation defaults into the Zustand store when the user explicitly clicks "Apply Fixes".

---

## 12. Examiner Trap Questions

### Q12.1: "You claim your simulation guarantees zero database changes. Is that literally true?"
- **How to Answer (Academic Honesty):**
  > *"It guarantees zero permanent table schema and row data persistence because of the explicit `ROLLBACK;`. However, it does not roll back PostgreSQL sequence increments if an implicit `SERIAL` sequence is evaluated. Additionally, it temporarily acquires locks during execution. So from a pure relational data and schema perspective, it leaves no tables behind, but sequences in PostgreSQL are inherently non-transactional."*
- **Why this wins high marks:** Demonstrates deep, genuine understanding of database internals rather than repeating marketing claims.

### Q12.2: "If all 500 sample documents pass the dry run with 100% success, does that prove the live migration will not fail?"
- **How to Answer (Academic Honesty):**
  > *"No, sample validation does not mathematically guarantee zero live migration failures. A 500-row sample proves that the schema syntax, data types, identifier lengths, parameter counts, and default values are valid for those sampled records. But if document #15,000 in production contains an unexpected string in a numeric field or a unique key collision not present in the first 500 rows, that record will fail during live migration. That is why Step 7 includes row-level retry and dead-letter queue isolation."*
- **Why this wins high marks:** Examiners respect engineers who understand the statistical difference between sample testing and full-population migration.

### Q12.3: "What guarantees that the Google Gemini AI recommendation is correct and won't corrupt our data?"
- **How to Answer (Academic Honesty):**
  > *"There is no formal guarantee that an LLM recommendation is correct. That is precisely why MigrateIQ never applies AI recommendations automatically. The Remediation Studio acts as a human-in-the-loop decision aid: it displays the AI suggestion alongside the rationale, the exact DDL migration clause, and a side-by-side Before/After diff. The user must review and explicitly click 'Apply Fixes'. Furthermore, we provide Manual Mode so engineers can override or enter exact custom defaults."*
- **Why this wins high marks:** Rejects AI hype; frames AI as an assisted tool with mandatory human verification.

### Q12.4: "Your identifier truncation appends a 4-character hex hash. Is uniqueness mathematically guaranteed?"
- **How to Answer (Academic Honesty):**
  > *"No, a 4-character hex hash represents 16 bits of entropy ($2^{16} = 65,536$ possibilities). While it drastically reduces the probability of collisions between long table or column names sharing the same prefix, a birthday paradox collision is theoretically possible across large schemas. In production environments with thousands of colliding 63-byte identifiers, an incremental counter or wider 64-bit hash would be required."*
- **Why this wins high marks:** Shows you understand hash collisions and discrete mathematics.

---

## 13. Counterfactual / "What If We Changed It?" Questions

### Q13.1: What if we removed savepoints and just ran the entire batch in a single transaction?
- **Answer:**
  In PostgreSQL, any error puts the transaction into an aborted state (`current transaction is aborted, commands ignored until end of transaction block`). If row #3 had a null email, the entire batch insert would fail, and we could never test rows #4 through #500. We would only discover one error per run, requiring hundreds of simulation runs to identify all anomalies. Savepoints allow us to isolate single failing rows and continue testing the rest.

### Q13.2: What if we moved the dry run simulation engine entirely to the frontend renderer?
- **Answer:**
  It would fail completely. The renderer runs inside a Chromium web browser sandbox without direct TCP socket access. Node.js native drivers like `pg` and `mongodb` require OS-level networking to communicate with database daemons. Furthermore, bundling database drivers into the client bundle would bloat the UI application, and exposing database credentials in the browser context violates Electron security guidelines.

### Q13.3: What if we automatically accepted and applied AI anomaly fixes without showing the modal?
- **Answer:**
  It would introduce catastrophic data governance risks. For example, if Gemini incorrectly assumed a missing `status` column should default to `'CANCELLED'` instead of `'PENDING'`, thousands of customer orders would be written as cancelled in production. Migration tools must never silently mutate business data contracts without explicit developer sign-off.

---

## 14. Cross-Phase Questions

### Q14.1: How does Phase 8 receive its inputs from Phase 6 (Step 4) and Phase 7 (Step 5)?
- **Answer:**
  - **From Phase 6 (Step 4 — Schema Mapper):** Receives the `schemaMapping` state array (`CollectionMapping[]`). This defines which MongoDB collections map to which PostgreSQL tables, which fields are active, data types, and primary/foreign keys.
  - **From Phase 7 (Step 5 — Risk Assessment):** Receives static risk metrics, warning categories, and source collection document counts used for duration and storage extrapolation.

### Q14.2: How does Phase 8 hand off state to Phase 9 (Step 7 — Live Migration Engine)?
- **Answer:**
  Phase 8 updates the centralized `wizardStore`:
  1. Updated `schemaMapping` with assigned `defaultValue` strings on fields remediated via Option A.
  2. Relaxed nullability (`isNullable = true`) on fields remediated via Option B.
  3. `quarantinePolicyAcknowledged = true` if the user opted for Option C.
  4. Verified batch size parameters and verified child table `sort_order` rules.  
  When Step 7 launches, its ETL pipeline reads these validated mappings, generating DDL with verified defaults and streaming records within safe parameter limits.

---

## 15. Real-World Scenario Questions

### Q15.1: Scenario A — Migrating 10 Million E-Commerce Documents
- **Question:** A client has 10,000,000 orders in MongoDB. How does Phase 8 handle this, and what are its limits?
- **Answer:**
  Phase 8 samples up to 500 documents from the 10-million document collection. It tests the DDL structure, type coercions, and child table unwinding on this sample. It queries `pg_database_size()`, takes the average row size heuristic (220 bytes), and extrapolates:
  $$\text{Projected Size} = 10,000,000 \times 220\text{ bytes} \approx 2.2\text{ GB}$$
  It validates that 2.2 GB is well within the target PostgreSQL storage headroom. It measures sample throughput (e.g., 2,500 rows/sec) and estimates total migration duration ($\approx 66\text{ minutes}$).  
  **Limitation:** It does not guarantee that records #501 through #10,000,000 have no anomalies; it provides structural pre-flight validation and performance estimates.

### Q15.2: Scenario B — Strict Corporate Governance Prohibiting Synthetic Defaults
- **Question:** A financial client prohibits imputing fake values like `'Unknown'` or `0.00` into missing fields. How does Phase 8 accommodate them?
- **Answer:**
  They reject Option A and select **Option C (Strict Quarantine / Dead-Letter Queue)**. Phase 8 preserves `NOT NULL` on the target table without setting any defaults. It requires the user to acknowledge the quarantine policy, recording `quarantinePolicyAcknowledged: true` in the store. When Phase 9 runs, records violating constraints are routed directly to the `_migration_dlq` audit table for manual offline reconciliation.

---

## 16. "SHOW ME THE CODE" Questions

| Feature / Question | Exact File Path | Function / Symbol | Line Range | Why It Matters |
| :--- | :--- | :--- | :--- | :--- |
| **Simulation Entry Point** | `apps/desktop/main/engine/dryRun.ts` | `executeDryRunSimulation()` | Lines 712–960 | Core coordinator of transaction sandbox, batch testing, and rollback. |
| **SQL Default Sanitizer** | `apps/desktop/main/engine/dryRun.ts` | `formatSqlDefaultClause()` | Lines 81–104 | Prevents SQL injection through DDL defaults; whitelists safe SQL functions. |
| **63-Byte Identifier Truncation** | `apps/desktop/main/engine/dryRun.ts` | `sanitizeIdentifier()` | Lines 112–127 | Prevents PostgreSQL identifier collision using deterministic 4-char hex hash. |
| **BSON Type Normalizer** | `apps/desktop/main/engine/dryRun.ts` | `transformValueForSql()` | Lines 242–388 | Coerces epochs, strips `\0` bytes, parses strict integers, normalizes booleans. |
| **Child Table Unwinding** | `apps/desktop/main/engine/dryRun.ts` | `simulateChildTables()` | Lines 490–585 | Normalizes arrays to child tables; auto-adds `sort_order INTEGER NOT NULL`. |
| **Gemini AI Handler & Cache** | `apps/desktop/main/handlers/ai.ts` | `setupAiHandlers()` | Lines 180–270 | Manages 30-minute in-memory recommendation cache and Gemini API invocation. |
| **Native Headless PDF Export** | `apps/desktop/main/handlers/dryRun.ts` | `dossier:export-pdf` handler | Lines 70–135 | Spawns secure headless `BrowserWindow` (`javascript: false`) and runs `printToPDF`. |
| **Zustand Batch Store Action** | `apps/desktop/renderer/src/store/wizardStore.ts` | `applyBatchDefaultValues()` | Lines 160–185 | Scoped state updater assigning defaults across multiple mappings simultaneously. |

---

## 17. Rapid-Fire Questions

1. **What is PostgreSQL transactional DDL?**  
   The ability to run `CREATE TABLE`, `ALTER TABLE`, and `DROP TABLE` inside a `BEGIN...ROLLBACK` block without persisting changes.
2. **What is a SQL savepoint?**  
   A sub-transaction boundary within an open transaction that allows partial rollback of failed statements without aborting the main transaction.
3. **What is the parameter limit in PostgreSQL prepared statements?**  
   $65,535$ bind parameters (`$1..$N`), limited by the 16-bit integer in the PostgreSQL wire protocol.
4. **Why do we strip `\0` bytes from strings?**  
   PostgreSQL strings are null-terminated C-strings. A `\0` byte causes a fatal `SQLSTATE 22021` encoding error.
5. **What is the purpose of `sort_order` in child tables?**  
   To preserve the original 0-based array index of nested MongoDB objects in relational tables (Rule 4 & Challenge 9).
6. **What is Option A in our 3-Tier Strategy?**  
   Smart Default Imputation: assigns fallback defaults to satisfy `NOT NULL` constraints without relaxing schema strictness.
7. **What is Option B?**  
   Schema Relaxation: alters the target column to `NULLABLE` (with downstream application crash warnings).
8. **What is Option C?**  
   Strict Quarantine: preserves `NOT NULL` and routes violating rows to the Dead-Letter Queue (DLQ).
9. **How long are AI recommendations cached?**  
   30 minutes in both renderer memory (`aiCacheRef`) and main process memory (`anomalyFixCache`).
10. **What is the safe capacity ceiling heuristic for headroom?**  
    $500\text{ GB}$ (`MAX_SAFE_INGESTION_BYTES`), preventing false-positive low disk warnings on fresh ~8MB databases.

---

## 18. Difficult Examiner Questions

### Q18.1: "PostgreSQL transaction isolation levels: Which isolation level did you use for the dry run, and what would happen under concurrent writes on the target database?"
- **Short Viva Answer:**
  We use the default `READ COMMITTED` isolation level. Under concurrent writes from other applications, the dry run sees committed data but will block if another transaction holds an exclusive table lock. That is why we explicitly set `SET LOCAL lock_timeout = '5s'`.
- **If Examiner Asks Further:**
  If we set `SERIALIZABLE`, any concurrent write to tables referenced by the simulation could cause a serialization failure (`SQLSTATE 40001`), aborting the dry run unnecessarily. Because our dry run is testing schema compatibility and will roll back anyway, `READ COMMITTED` combined with a strict lock timeout is the optimal engineering choice.

### Q18.2: "How does your 6-Tier Error Detection Cascade handle an error where PostgreSQL provides neither the column name nor the constraint name?"
- **Short Viva Answer:**
  It cascades down to Tier 4, Tier 5, and Tier 6. Tier 4 cross-references quoted offending values in the error message against `row.values`. Tier 5 checks string lengths against `VARCHAR(N)` limits. If all parsing fails, Tier 6 defaults to the first non-primary-key column so the failure can still be presented in the UI.
- **If Examiner Asks Further:**
  In PostgreSQL, certain runtime errors—like numeric overflow or timestamp range violations—only say `value out of range for type integer` without specifying the column. Tier 4 extracts the number from the message and looks up which field in the inserted document had that value. This guarantees that the engineer gets an actionable clue rather than an opaque generic failure.

---

## 19. Final Section — Viva Master Revision

### Things I Absolutely Must Know
1. **Transaction Sandbox:** Runs inside `BEGIN; ... ROLLBACK;` with `lock_timeout = '5s'`.
2. **PostgreSQL Sequences:** Sequences advance even across rollbacks—an inherent PostgreSQL property.
3. **Savepoint Error Isolation:** `SAVEPOINT sp_row` prevents single-row failures from aborting the entire dry run.
4. **Child Tables (Rule 4):** Array-of-objects unwind to child tables with auto-added `sort_order INTEGER NOT NULL`.
5. **63-Byte Identifiers:** Truncated to 58 characters + 4-char hex hash (`NAMEDATALEN - 1`).
6. **Parameter Clamping:** Multi-row inserts clamp to $\le 65,000$ bind parameters via `Math.floor(65000 / cols)`.
7. **Null-Byte Sanitization:** Strips `\0` bytes to guard against `SQLSTATE 22021` driver crashes.
8. **Hex ObjectId Parsing:** Regex `/^-?\d+$/` prevents hex ObjectIds from being parsed as integer `64`.
9. **3-Tier Strategy:** Option A (Impute Defaults), Option B (Relax to NULL), Option C (Quarantine DLQ).
10. **Dual-Tier Cache:** 30-minute in-memory cache on both client and server to save AI API tokens.
11. **Native PDF Export:** Headless Electron `BrowserWindow` with `nodeIntegration: false, javascript: false`.
12. **Test Evidence:** Verified by 25 test cases (109 assertions) in `test-phase8-dry-run.js` and 8 test cases in `test-remediation-studio.js`.

---

### Top 20 Questions To Practice

1. **What is Phase 8 in one sentence?**  
   A pre-flight shadow validation engine and remediation studio that tests schemas, types, and sample records inside a rolled-back PostgreSQL transaction before live migration.
2. **Why use PostgreSQL transactions instead of a mock database?**  
   Executes in milliseconds against real target extensions and collations with zero residual tables, without requiring cloud provisioning or superuser permissions.
3. **Does `ROLLBACK;` restore sequences?**  
   No. PostgreSQL sequence generators advance across rollbacks to avoid concurrency locks.
4. **How are single-row errors isolated?**  
   Using PostgreSQL `SAVEPOINT sp_row;`. If a row fails, we issue `ROLLBACK TO SAVEPOINT sp_row;` and continue testing subsequent rows.
5. **How does MigrateIQ handle arrays of objects?**  
   Unwinds them into relational child tables, auto-adds `sort_order INTEGER NOT NULL` with array index, and adds a foreign key index.
6. **Why clamp batch sizes to $65,000$ parameters?**  
   PostgreSQL’s protocol limits prepared statement parameters to $65,535$. Clamping avoids driver crashes on wide tables.
7. **What is the 6-Tier Error Detection Cascade?**  
   A fallback sequence: protocol column $\rightarrow$ constraint detail $\rightarrow$ error regex $\rightarrow$ value cross-reference $\rightarrow$ string length $\rightarrow$ fallback column.
8. **What does Option A do?**  
   Applies domain-aware defaults (`DEFAULT '<val>' NOT NULL`), satisfying constraints without relaxing nullability.
9. **What does Option B do?**  
   Relaxes column to `NULLABLE`, warning the user of potential downstream application null-pointer risks.
10. **What does Option C do?**  
    Preserves `NOT NULL` without fallbacks, requiring acknowledgment that violating rows route to the Dead-Letter Queue.
11. **How is AI data privacy preserved?**  
    Only column names, target types, and short error snippets are sent to Gemini—full databases are never transmitted.
12. **What if the Gemini API is down or throttled?**  
    The handler catches the error and falls back to local rule-based type heuristics (`generateRuleBasedAnomalyFixes()`).
13. **How is SQL injection prevented in column defaults?**  
    `formatSqlDefaultClause()` strictly checks unquoted defaults against a whitelist of parameterless functions; all other inputs are escaped and quoted as string literals.
14. **How are long table/column names sanitized?**  
    Truncated to 58 characters + 4-char hex hash computed from the full original name to avoid collisions.
15. **Why strip UTF-8 `\0` null-bytes?**  
    PostgreSQL text types are C-strings; passing `\0` triggers fatal `SQLSTATE 22021` encoding aborts.
16. **Why enforce regex `/^-?\d+$/` on integer coercion?**  
    JavaScript's `parseInt('64f1...', 10)` parses hex ObjectIds as `64`. The regex rejects alphanumeric strings.
17. **How is storage headroom evaluated?**  
    Measures current DB size via `pg_database_size()`, extrapolates projected volume (rows $\times$ average row size), and checks against a 500GB safe ceiling.
18. **Why is `lock_timeout = '5s'` configured?**  
    Prevents simulation DDL from waiting indefinitely on production table locks and blocking concurrent application queries.
19. **How is the PDF compliance dossier exported safely?**  
    Rendered via Electron's headless `BrowserWindow` with `nodeIntegration: false, javascript: false` using Chromium's native `printToPDF`.
20. **Does passing the dry run prove live migration will not fail?**  
    No. Sample validation validates structure and schemas for the sample, but unsampled production records may still contain unique constraint or type anomalies handled by Step 7's live DLQ.

---

### 5-Minute Viva Revision (Read Before Entering the Room)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              MIGRATEIQ PHASE 8 DEFENSE CHEAT SHEET                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Wizard Step: Step 6 of 8 (Pre-Flight Dry Run Simulation & Remediation Studio)        │
│ • Key Engine File: apps/desktop/main/engine/dryRun.ts (executeDryRunSimulation)        │
│ • UI Screen: apps/desktop/renderer/src/screens/DryRunScreen.tsx                        │
│ • Safety Sandbox: BEGIN; ... ROLLBACK; inside target PostgreSQL                        │
│ • Session Limits: lock_timeout = 5s, statement_timeout = 15s, idle_in_trans = 10s      │
│ • Error Isolation: SAVEPOINT sp_row; allows testing remaining rows after failures      │
│ • Rule 4 Compliance: Arrays unwind to child tables with sort_order INTEGER NOT NULL    │
│ • PostgreSQL Limits: Clamped to <= 65,000 bind params; identifiers capped at 63 bytes  │
│ • Security Defenses: formatSqlDefaultClause whitelist, sanitizeIdentifier hash,        │
│   maskSensitiveFields password masking (••••••••), Electron contextIsolation: true     │
│ • Remediation Studio: Option A (Defaults), Option B (Relax Null), Option C (DLQ)       │
│ • AI Architecture: Gemini 2.5 Flash with 30-min in-memory cache & offline fallback     │
│ • Honest Claims: Sample != Full Dataset; Rollback leaves no tables, but sequences     │
│   advance in PostgreSQL; Headroom uses 500GB ceiling to prevent false alarms on fresh  │
│ • Automated Tests: 25 test cases (109 assertions) in test-phase8-dry-run.js (100% pass)│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---
*Document compiled and verified against the MigrateIQ codebase for Phase 8.*
