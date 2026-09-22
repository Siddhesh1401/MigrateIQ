# PHASE 11 — SCHEMA UPDATE ASSISTANT & EVOLUTION WORKBENCH
## Professional Manual QA Testing Checklist & Execution Manual

---

### 1. Document Information
- **Phase:** Phase 11 — Schema Update Assistant & Evolution Workbench (Workflow C)
- **Application:** MigrateIQ Desktop Application (Electron + React + TypeScript)
- **Test Target:** PostgreSQL & MongoDB Schema Evolution Lifecycle (Dual-Engine Parity)
- **Version:** v1.0.0
- **Date:** [ Type Date ]
- **Tester Name:** [ Type Tester Name ]
- **Environment:** Local Sandbox (`localhost`)
- **Build / Git Commit:** [ Type Git Commit Hash ]
- **Application Build:** MigrateIQ Desktop v1.0.0

---

### 2. Purpose of This QA Manual
This manual is an **executable, Microsoft Word (.docx) editable Quality Assurance document**. It is prepared for an independent tester who did not build this application and does not need to inspect the internal source code.

The tester will convert/open this document in Microsoft Word on their laptop, follow each step side-by-side with the application, type their results directly (`PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE`), record actual observations, paste screenshots directly into the document placeholders (`[>>> PASTE SCREENSHOT HERE IN WORD <<<]`), and return the completed Word document for review.

Phase 11 transforms MigrateIQ into an enterprise-grade **Database Schema Evolution Workbench** featuring **100% native workflow parity between PostgreSQL and MongoDB**. It enforces a strict **7-Step Professional Database Lifecycle**:
1. Target Engine (PostgreSQL / MongoDB) & Environment Tier Selection (`development`, `staging`, `production`)
2. Live Physical Catalog Introspection & Out-of-Band Schema Drift Radar
3. Change Evolution Studio (Mode A: Visual Form, Mode B: Gemini AI NL2DDL, Mode C: Raw Script Tokenizer, Staged Queue, Visual Schema Structural Diff)
4. Change Impact Scorecard (Risk 0–100, lock level, blast radius), Enterprise Policy Guards (`PG-POLICY-001` to `004`), 1-Click Auto-Fix, 3-Phase Expand-Contract Advisor & MongoDB `$jsonSchema` Validator
5. Strategy & Packaging Lab (ZIP Bundle Export with `manifest.json`, CI/CD Pipeline YAML, Executive Audit Report, Safety Snapshot)
6. Pre-Flight Dry-Run Cockpit (Non-destructive `BEGIN ... ROLLBACK` simulation) & Production Shield Hard Barrier Modal
7. Live Execution Terminal (Real-time log streaming, SHA-256 script hashing), In-Database History Ledger, Physical Catalog Post-Verification, Official Migration Integrity Certificate (`MIC-2026-[HASH]`), and 1-Click Rollback Studio

---

### 3. Tester Requirements

#### Required Software:
- **Node.js:** v18.0.0 or higher
- **PostgreSQL:** v14, v15, or v16 running locally on port `5432`
- **MongoDB:** v6.0 or v7.0 running locally on port `27017`
- **Database Client:** psql CLI, pgAdmin, or DBeaver (for PostgreSQL physical queries)
- **MongoDB Shell:** `mongosh` CLI or MongoDB Compass (for MongoDB physical queries)
- **MigrateIQ Desktop Application:** Active via `npm run desktop:dev`

#### Required Connection Credentials:
- **PostgreSQL Sandbox Database:**
  - Host: `localhost`
  - Port: `5432`
  - Database: `phase11migrateiq`
  - User: `postgres`
  - Password: `admin` (or your local Postgres superuser password)
- **MongoDB Sandbox Database:**
  - Connection URI: `mongodb://localhost:27017`
  - Database: `phase11migrateiq`

---

### 4. Rules of Testing for the Tester (Word Workflow)

Please review these rules before beginning:

1. **Work in Microsoft Word:** Open this document in Microsoft Word on your laptop side-by-side with MigrateIQ.
2. **Follow the checklist in strict order:** Do not jump ahead. Complete Test Cases sequentially as later steps depend on earlier states.
3. **Do not modify source code:** Never edit `.ts`, `.tsx`, or `.js` files to bypass an error or test case.
4. **Do not manually fix failures:** If an action errors or crashes, record the exact error message and mark `FAIL`.
5. **Do not change database data unless instructed:** Only interact with the databases through the app or through the explicit verification queries provided.
6. **Use only the test data/instructions provided:** Do not test against personal or real production databases; only use `phase11migrateiq`.
7. **Do not assume something works:** A green UI banner is not enough proof. Always execute the physical database verification query to confirm storage state.
8. **Type your results directly in Word:** For each test case, type `PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE` directly into the `Status:` field. No paper checkboxes.
9. **Record actual behavior:** Note unexpected behavior, lag, wording flaws, or visual clipping in the `Actual Result / Tester Notes:` field.
10. **Paste screenshots directly in Word:** Whenever you see `📸 SCREENSHOT REQUIRED`, capture your screen and paste it directly into the `[>>> PASTE SCREENSHOT HERE IN WORD <<<]` placeholder in Word (`Ctrl+V`).
11. **If a test fails, do not hide it:** Log the defect in the Defect Logging Table and continue only when the checklist indicates it is safe to proceed.
12. **Use the Reset Command:** If any test fails or leaves the database in an unknown state, run the reset procedure immediately (`node scripts/seed-phase11-testbed.js`).
13. **Save frequently:** Save your Word document (`Ctrl+S`) regularly while testing.

---

### 5. Test Environment Setup

Assume the tester has pulled the repository and opened it in their IDE. The only additional phase-specific setup actions required are:

#### SETUP ACTION 1: Verify PostgreSQL Service
- **ACTION:** Open terminal and run:
  ```bash
  # Windows PowerShell
  Test-NetConnection -ComputerName localhost -Port 5432
  ```
- **WHY:** MigrateIQ requires local PostgreSQL on port 5432 to execute relational DDL.
- **EXPECTED RESULT:** `TcpTestSucceeded : True`

#### SETUP ACTION 2: Verify MongoDB Service
- **ACTION:** Open terminal and run:
  ```bash
  # Windows PowerShell
  Test-NetConnection -ComputerName localhost -Port 27017
  ```
- **WHY:** MigrateIQ requires local MongoDB on port 27017 to execute native BSON collection updates.
- **EXPECTED RESULT:** `TcpTestSucceeded : True`

#### SETUP ACTION 3: Run the Automated Phase 11 Database Seeder
- **ACTION:** In the project root directory, run:
  ```bash
  node scripts/seed-phase11-testbed.js
  ```
- **WHY:** Creates and seeds fresh sandbox databases (`phase11migrateiq`) in both PostgreSQL and MongoDB.
- **EXPECTED RESULT:** Output ends with `🎉 Seeding Complete! Ready for Phase 11 Testing:`.

#### SETUP ACTION 4: Launch the Desktop Application
- **ACTION:** In terminal, run:
  ```bash
  npm run desktop:dev
  ```
- **WHY:** Starts the Vite dev server and launches Electron app shell.
- **EXPECTED RESULT:** Desktop window opens. Navigate to **"Schema Update Assistant"** (or **"Schema Evolution Workbench"**). The 7-Step Stepper is visible.

---

### 6. Test Data Setup & Reset Procedure

The database seeder `node scripts/seed-phase11-testbed.js` populates:

#### 🐘 PostgreSQL (`phase11migrateiq`):
- Table `customers` (5 rows: `id`, `full_name`, `email`, `city`, `created_at`)
- Table `orders` (5 rows: `id`, `customer_id`, `order_number`, `total_amount`, `order_status`, `order_date`)
- Table `archived_logs` (2 rows: `id`, `log_message`, `severity`, `logged_at`)

#### 🍃 MongoDB (`phase11migrateiq`):
- Collection `users` (4 documents: `name`, `email`, `role`, `age`, `createdAt`)
- Collection `products` (3 documents: `sku`, `name`, `category`, `price`, `inStock`)

#### 🔄 RESET PROCEDURE:
Whenever you complete destructive tests or need to return the environment to a 100% clean state, open terminal and run:
```bash
node scripts/seed-phase11-testbed.js
```
*(Executes in < 2 seconds).*

---

## 🟢 PART 1: POSTGRESQL FUNCTIONAL WORKFLOWS (HAPPY PATH)

---

### TC-PG-01 — PostgreSQL Connection, Tier Selection & Catalog Introspection

**Objective:**  
Verify that MigrateIQ connects to PostgreSQL `phase11migrateiq`, recognizes the `development` tier, and accurately introspects physical tables, column data types, and nullability.

**Preconditions:**  
`node scripts/seed-phase11-testbed.js` executed. App open at Step 1.

**Steps:**
1. Click the **🐘 PostgreSQL Database** card.
2. Click the **Development** tier card (green badge).
3. Verify connection form fields:
   - Host: `localhost`
   - Port: `5432`
   - Database: `phase11migrateiq`
   - User: `postgres`
   - Password: `admin` (or your local Postgres password)
4. Click button: **"Connect & Introspect Catalog"**.
5. Observe connection status banner.
6. Click button: **"Continue to Inspect & Drift →"**.
7. On Step 2, observe the Schema Drift Radar banner.
8. Click on table card: `customers` to expand its column list.

**Expected Result:**
- Step 1 displays: `✅ Connected to DEVELOPMENT Database phase11migrateiq (3 relations introspected)`.
- Step 2 top banner displays: `✓ Schema Drift Radar: Live database catalog is 100% in sync with ledger history.`.
- Table list displays 3 tables: `customers` (5 rows), `orders` (5 rows), `archived_logs` (2 rows).
- Expanding `customers` shows columns `id` (integer), `full_name` (character varying), `email` (character varying), `city` (character varying), and `created_at` (timestamp without time zone).

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-01: Capture Step 1 connection success banner and Step 2 table list with expanded `customers` columns.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-PG-02 — PostgreSQL Add Column (Happy Path, Visual Diff & DDL Generation)

**Objective:**  
Verify that adding a nullable column with a default value renders the reactive visual diff, generates valid PostgreSQL forward/rollback DDL, and correctly stages the operation.

**Preconditions:**  
TC-PG-01 completed; currently on Step 2.

**Steps:**
1. On Step 2, ensure table `customers` is selected.
2. Click button: **"Continue to Evolution Studio →"**.
3. Ensure tab is **"Mode A: Visual Form"**.
4. Set **Operation Type:** `Add Column / Field`.
5. Set **Target Table:** `customers`.
6. Enter **Column / Field Name:** `loyalty_tier`.
7. Select **Data Type:** `VARCHAR(255)`.
8. Enter **Default Value:** `'BRONZE'`.
9. Leave **Nullable** checkbox checked.
10. Observe the Visual Schema Structural Diff below the form.
11. Observe the Generated SQL DDL boxes below the diff.

**Expected Result:**
- Visual Diff displays existing columns plus a highlighted green badge: `+ ADD loyalty_tier VARCHAR(255)`.
- Forward Script displays:  
  `ALTER TABLE public.customers ADD COLUMN loyalty_tier VARCHAR(255) DEFAULT 'BRONZE';`
- Rollback Script displays:  
  `ALTER TABLE public.customers DROP COLUMN IF EXISTS loyalty_tier;`
- Step navigation button **"Continue to Impact & Policy Check →"** becomes active.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-02: Capture Step 3 showing the completed form, Visual Diff card with `+ ADD`, and forward/rollback SQL boxes.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-PG-03 — PostgreSQL Change Impact Scorecard & Policy Guard Verification

**Objective:**  
Verify that the Change Impact Scorecard calculates a low-risk score for a safe nullable column and verifies policy guard rules.

**Preconditions:**  
TC-PG-02 completed; currently on Step 3.

**Steps:**
1. Click button: **"Continue to Impact & Policy Check →"**.
2. Review the Change Impact Scorecard metrics:
   - Overall Risk Score
   - Lock Escalation Tier
   - Blast Radius
   - Rollback Feasibility
3. Review the Enterprise Policy Guard section.
4. Review the Phased Expand & Contract Advisor card.

**Expected Result:**
- Risk Score shows green low risk: `10 / 100 — LOW RISK`.
- Lock Escalation Tier displays: `ACCESS EXCLUSIVE` or `SHARE UPDATE EXCLUSIVE` with low hold time estimate (< 50ms).
- Policy Guard shows: `✓ No enterprise policy violations detected.`
- Expand & Contract Advisor details 3 distinct zero-downtime phases.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-03: Capture Step 4 Impact Scorecard with Risk Score, lock tier, and Expand & Contract Advisor.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-PG-04 — PostgreSQL Strategy Selection, Packaging Lab & CI/CD Export

**Objective:**  
Verify that Step 5 supports strategy selection, snapshot backup configuration, CI/CD pipeline generation, and executive audit report creation.

**Preconditions:**  
TC-PG-03 completed; currently on Step 4.

**Steps:**
1. Click button: **"Continue to Packaging Lab →"**.
2. Ensure strategy selected is: **In-Place Transactional**.
3. Verify checkbox: `Create snapshot backup table prior to execution` is checked.
4. Click button: **"Generate CI/CD Pipeline"**.
5. Inspect the generated GitHub Actions YAML.
6. Click button: **"Generate Audit Report"**.
7. Inspect the Markdown executive audit report.
8. Click button: **"Download Production Package (ZIP)"**.

**Expected Result:**
- Strategy card `In-Place Transactional` is actively highlighted.
- CI/CD YAML renders with step `Run Database Migration` using `${{ secrets.PG_CONNECTION_STRING }}` (no raw passwords).
- Audit Report renders markdown with executive summary, risk scorecard, and forward/rollback code blocks.
- ZIP export prompt appears or downloads migration bundle containing `manifest.json`.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-04: Capture Step 5 with generated CI/CD YAML and Audit Report preview.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-PG-05 — PostgreSQL Non-Destructive Pre-Flight Dry-Run Simulation

**Objective:**  
Verify that Step 6 executes an atomic simulation (`BEGIN ... ROLLBACK`) in PostgreSQL, verifies lock acquisition latency, and leaves zero persistent changes in the physical catalog.

**Preconditions:**  
TC-PG-04 completed; currently on Step 5.

**Steps:**
1. Click button: **"Continue to Dry-Run Cockpit →"**.
2. Review the CLI Command Preview box.
3. Click button: **"⚡ Run Pre-Flight Dry-Run Simulation"**.
4. Observe the simulation result card.
5. Verify physical database state using psql / pgAdmin:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'customers' AND column_name = 'loyalty_tier';
   ```

**Expected Result:**
- Result card turns green: `Simulation Succeeded: 0 persistent changes committed (Catalog 100% clean)`.
- Lock acquisition duration is displayed in milliseconds (e.g. `Lock acquired in 3 ms`).
- Physical database query returns `0 rows` (proving the dry-run rolled back completely).

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-05: Capture Step 6 green dry-run simulation receipt showing lock acquisition latency.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-PG-06 — PostgreSQL Live Deployment, Terminal Streaming & Integrity Certificate

**Objective:**  
Execute live schema change on PostgreSQL, verify real-time terminal logs, in-database ledger write, physical catalog verification, and Migration Integrity Certificate generation.

**Preconditions:**  
TC-PG-05 completed; currently on Step 6.

**Steps:**
1. On Step 6, click button: **"▶ Deploy Schema Changes →"**.
2. Step 7 opens. Observe the real-time execution log terminal.
3. Observe the Post-Execution Verification Receipt.
4. Observe the Migration Integrity Certificate card (`.su-cert-card`).
5. Click button: **"📋 Copy Integrity Certificate"**.
6. Verify physical database state in PostgreSQL:
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'customers' AND column_name = 'loyalty_tier';
   ```
7. Verify in-database history ledger table:
   ```sql
   SELECT version, description, checksum, success 
   FROM public.migrateiq_schema_history 
   ORDER BY installed_rank DESC LIMIT 1;
   ```

**Expected Result:**
- Terminal streams: Lock Acquisition $\to$ Execution $\to$ Checksum SHA-256 $\to$ Ledger Write $\to$ Catalog Verification.
- Verification receipt shows: `Migration Verified & Committed!` with duration in ms.
- Migration Integrity Certificate renders with:
  - Watermark: `VERIFIED`
  - Certificate Token: `MIC-2026-[HASH]`
  - Target Entity: `🐘 PostgreSQL — customers`
  - Physical Catalog: `✓ Confirmed Active in Metadata`
  - In-Database Ledger: `✓ Recorded in History Ledger`
- Physical query 1 returns `1 row`: `loyalty_tier | character varying | 'BRONZE'::character varying`.
- Physical query 2 returns `success = true` with exact SHA-256 checksum matching the certificate.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-06: Capture Step 7 live execution console, Migration Integrity Certificate card, and physical SQL query result in terminal/pgAdmin.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-PG-07 — PostgreSQL 1-Click Rollback & Complete State Restoration

**Objective:**  
Verify that opening the In-Database Schema Ledger drawer and clicking "Rollback" drops the column physically and updates the ledger record.

**Preconditions:**  
TC-PG-06 completed; migration is applied.

**Steps:**
1. In the top navigation header, click button: **"📋 Schema Ledger"**.
2. A slide-down drawer appears showing schema history.
3. Find the newly applied entry: `addColumn on customers`.
4. Click the red button: **"↺ Rollback"**.
5. Observe the status badge change from `applied` to `[ROLLED_BACK]`.
6. Run physical database verification query:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'customers' AND column_name = 'loyalty_tier';
   ```
7. Query the ledger:
   ```sql
   SELECT version, description, success, rollback_script 
   FROM public.migrateiq_schema_history 
   ORDER BY installed_rank DESC LIMIT 1;
   ```

**Expected Result:**
- Rollback executes cleanly without error.
- Physical database query returns `0 rows` (column `loyalty_tier` is completely removed).
- Database state has returned 100% to initial state before TC-PG-02.
- In-database ledger records the rollback audit event.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-07: Capture Schema Ledger drawer showing `[ROLLED_BACK]` badge and physical SQL query returning 0 rows.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

## 🍃 PART 2: MONGODB FUNCTIONAL WORKFLOWS (HAPPY PATH)

---

### TC-MO-01 — MongoDB Connection, BSON Sampling & Collection Introspection

**Objective:**  
Verify that MigrateIQ connects to MongoDB `phase11migrateiq` and accurately introspects collections, document counts, and BSON field types.

**Preconditions:**  
`node scripts/seed-phase11-testbed.js` executed. In MigrateIQ, navigate to Step 1.

**Steps:**
1. Click the **🍃 MongoDB Database** card.
2. Select **Development** tier.
3. Verify credentials:
   - Connection URL: `mongodb://localhost:27017`
   - Database: `phase11migrateiq`
4. Click button: **"Connect & Introspect Catalog"**.
5. Click button: **"Continue to Inspect & Drift →"**.
6. On Step 2, observe the introspected collections list.
7. Expand collection: `users`.

**Expected Result:**
- Step 1 displays: `✅ Connected to DEVELOPMENT Database phase11migrateiq (2 relations introspected)`.
- Step 2 lists collections: `users` (4 documents) and `products` (3 documents).
- Expanding `users` reveals sampled BSON field types (`name: string`, `email: string`, `role: string`, `age: int`, `createdAt: date`).

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-08: Capture Step 2 showing MongoDB collections and expanded `users` field list.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-MO-02 — MongoDB Add Field Script Generation ($updateMany & $exists)

**Objective:**  
Verify that adding a field to a MongoDB collection generates native MongoDB driver scripts using `$exists: false` filter and `$set` operator, alongside reverse `$unset` rollback scripts.

**Preconditions:**  
TC-MO-01 completed; currently on Step 2.

**Steps:**
1. Select collection: `users`.
2. Click button: **"Continue to Evolution Studio →"**.
3. Set **Operation Type:** `Add Column / Field`.
4. Set **Target Collection:** `users`.
5. Enter **Column / Field Name:** `loyaltyPoints`.
6. Enter **Default Value:** `100`.
7. Inspect the generated Forward and Rollback scripts below the form.

**Expected Result:**
- Forward Script displays:  
  `db.users.updateMany({ loyaltyPoints: { $exists: false } }, { $set: { loyaltyPoints: 100 } });`
- Rollback Script displays:  
  `db.users.updateMany({}, { $unset: { loyaltyPoints: "" } });`
- Step navigation button **"Continue to Impact & Policy Check →"** becomes active.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-09: Capture Step 3 showing MongoDB form fields and generated native BSON update scripts.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-MO-03 — MongoDB $jsonSchema Collection Validation Rule Generation

**Objective:**  
Verify that Step 4 renders the generated MongoDB `$jsonSchema` command (`collMod`) for collection-level schema enforcement.

**Preconditions:**  
TC-MO-02 completed; currently on Step 3.

**Steps:**
1. Click button: **"Continue to Impact & Policy Check →"**.
2. Review the Change Impact Scorecard for MongoDB.
3. Scroll to the **MongoDB $jsonSchema Collection Validation** card.
4. Inspect the generated command.

**Expected Result:**
- Lock Escalation Tier displays: `Document / Intent-Exclusive (IX) Lock`.
- Validation card shows generated command:
  ```javascript
  db.runCommand({
    collMod: "users",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        properties: {
          loyaltyPoints: { bsonType: "int", description: "loyaltyPoints must be a int" }
        }
      }
    }
  });
  ```

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-10: Capture Step 4 showing MongoDB $jsonSchema validation card.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-MO-04 — MongoDB Pre-Migration Safety Snapshot Backup Creation

**Objective:**  
Verify that clicking "Create Safety Backup Snapshot" in Step 5 creates a physical snapshot collection preserving 100% of documents.

**Preconditions:**  
TC-MO-03 completed; currently on Step 4.

**Steps:**
1. Click button: **"Continue to Packaging Lab →"**.
2. Click button: **"Create Safety Backup Snapshot"**.
3. Observe the snapshot feedback message.
4. Verify in MongoDB shell:
   ```bash
   mongosh phase11migrateiq --eval "db.getCollectionNames()"
   ```

**Expected Result:**
- UI displays: `✓ Snapshot collection "users_backup_[TIMESTAMP]" created (4 documents preserved).`.
- MongoDB shell lists the new backup collection: `users_backup_[TIMESTAMP]`.
- Counting documents in backup confirms 4 documents:  
  `db.users_backup_[TIMESTAMP].countDocuments() === 4`.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-11: Capture Step 5 snapshot backup confirmation and MongoDB shell showing the backup collection.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-MO-05 — MongoDB Live Execution, Physical Verification & Rollback

**Objective:**  
Deploy field update to MongoDB, verify native document mutation, verify ledger registration in `_migrateiq_schema_history`, and execute clean rollback.

**Preconditions:**  
TC-MO-04 completed; currently on Step 5.

**Steps:**
1. Click **"Continue to Dry-Run Cockpit →"**.
2. Click **"⚡ Run Pre-Flight Dry-Run Simulation"** $\to$ confirms simulation pass.
3. Click **"▶ Deploy Schema Changes →"**.
4. Observe Step 7 terminal output and Migration Integrity Certificate.
5. Verify physical MongoDB documents:
   ```bash
   mongosh phase11migrateiq --eval "db.users.find({}, { name: 1, loyaltyPoints: 1 }).toArray()"
   ```
6. Verify in-database history collection:
   ```bash
   mongosh phase11migrateiq --eval "db._migrateiq_schema_history.find().sort({ _id: -1 }).limit(1).toArray()"
   ```
7. Click top **"📋 Schema Ledger"** button $\to$ click **"↺ Rollback"** on the MongoDB migration.
8. Re-verify MongoDB documents:
   ```bash
   mongosh phase11migrateiq --eval "db.users.find({}, { name: 1, loyaltyPoints: 1 }).toArray()"
   ```

**Expected Result:**
- Terminal logs confirm native BSON execution and ledger write to `_migrateiq_schema_history`.
- Migration Integrity Certificate renders for `🍃 MongoDB — users`.
- Step 5 query confirms all 4 documents now have `"loyaltyPoints": 100`.
- Step 6 query returns ledger document with `success: true` and SHA-256 checksum.
- Step 8 query confirms `"loyaltyPoints"` is completely `$unset` from all documents after rollback!

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-12: Capture MongoDB Migration Integrity Certificate and mongosh output showing documents before and after rollback.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

## ⚡ PART 3: ADVANCED SCHEMA OPERATIONS MATRIX

---

### TC-OP-01 — PostgreSQL: Rename Column (`orders.order_status` → `status`)

**Objective:**  
Verify renaming a column in PostgreSQL, checking catalog verification and reverse rollback DDL.

**Preconditions:**  
PostgreSQL `phase11migrateiq` connected.

**Steps:**
1. Open Step 3.
2. Select **Operation Type:** `Rename Column`.
3. Select **Target Table:** `orders`.
4. Enter **Column Name:** `order_status`.
5. Enter **New Column Name:** `status`.
6. Verify Forward SQL: `ALTER TABLE public.orders RENAME COLUMN order_status TO status;`.
7. Verify Rollback SQL: `ALTER TABLE public.orders RENAME COLUMN status TO order_status;`.
8. Advance to Step 6 and click Deploy.
9. Verify physical database:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'orders' AND column_name = 'status';
   ```

**Expected Result:**
- Deployment succeeds.
- Physical query returns `status`. `order_status` no longer exists.
- Rollback restores `order_status`.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-13: Capture Step 7 certificate for column rename and SQL query confirming `status` exists.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-OP-02 — PostgreSQL: Change Column Type with Cast (`orders.total_amount` → `NUMERIC(12,2)`)

**Objective:**  
Verify altering column type with explicit PostgreSQL `USING ...::type` casting clause.

**Preconditions:**  
PostgreSQL `phase11migrateiq` connected.

**Steps:**
1. Select **Operation Type:** `Change Column Type`.
2. Select **Target Table:** `orders`.
3. Enter **Column Name:** `total_amount`.
4. Enter **Data Type:** `NUMERIC(12,2)`.
5. Verify Forward SQL contains:  
   `ALTER TABLE public.orders ALTER COLUMN total_amount TYPE NUMERIC(12,2) USING total_amount::NUMERIC(12,2);`.
6. Advance to Step 4 and note lock warning.
7. Deploy in Step 6.
8. Physical verification query:
   ```sql
   SELECT data_type, numeric_precision, numeric_scale 
   FROM information_schema.columns 
   WHERE table_name = 'orders' AND column_name = 'total_amount';
   ```

**Expected Result:**
- Query returns precision `12` and scale `2`. Existing row values (e.g. `149.99`) are completely preserved.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-14: Capture physical SQL query showing precision 12 and scale 2 on `orders.total_amount`.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-OP-03 — PostgreSQL: Zero-Downtime Unique Index (`CONCURRENTLY`)

**Objective:**  
Verify zero-downtime non-blocking index creation without transaction block wrappers.

**Preconditions:**  
PostgreSQL `phase11migrateiq` connected.

**Steps:**
1. Select **Operation Type:** `Add Index`.
2. Select **Target Table:** `customers`.
3. Enter **Column Name:** `email`.
4. Check checkbox: **isUnique** (Unique Index).
5. Check checkbox: **CREATE INDEX CONCURRENTLY (Zero-Downtime Non-Blocking)**.
6. Verify Forward SQL:  
   `CREATE UNIQUE INDEX CONCURRENTLY idx_customers_email ON public.customers (email);`.
7. Verify Rollback SQL:  
   `DROP INDEX CONCURRENTLY IF EXISTS idx_customers_email;`.
8. Deploy in Step 6.
9. Physical verification query:
   ```sql
   SELECT indexname, indexdef FROM pg_indexes 
   WHERE tablename = 'customers' AND indexname = 'idx_customers_email';
   ```

**Expected Result:**
- Index created cleanly without `BEGIN / COMMIT` error.
- Physical query confirms `idx_customers_email` exists with `UNIQUE` definition.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-15: Capture pg_indexes query result showing `idx_customers_email`.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-OP-04 — PostgreSQL: Foreign Key Constraint with Cascade (`orders.customer_id` → `customers.id`)

**Objective:**  
Verify foreign key relationship creation with relational constraint verification.

**Preconditions:**  
PostgreSQL `phase11migrateiq` connected.

**Steps:**
1. Select **Operation Type:** `Add Foreign Key`.
2. Select **Target Table:** `orders`.
3. Enter **Column Name:** `customer_id`.
4. Enter **Foreign Table:** `customers`.
5. Enter **Foreign Column:** `id`.
6. Select **On Delete Action:** `CASCADE`.
7. Deploy in Step 6.
8. Physical verification query:
   ```sql
   SELECT constraint_name, table_name 
   FROM information_schema.table_constraints 
   WHERE table_name = 'orders' AND constraint_type = 'FOREIGN KEY';
   ```

**Expected Result:**
- Foreign key constraint `fk_orders_customer_id` created and active in catalog.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-16: Capture `table_constraints` query showing `FOREIGN KEY` active.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-OP-05 — PostgreSQL: Rename Table (`archived_logs` → `system_audit_logs`)

**Objective:**  
Verify renaming a physical relation and confirming catalog reflects the new table name.

**Preconditions:**  
PostgreSQL `phase11migrateiq` connected.

**Steps:**
1. Select **Operation Type:** `Rename Table / Collection`.
2. Select **Target Table:** `archived_logs`.
3. Enter **New Table Name:** `system_audit_logs`.
4. Deploy in Step 6.
5. Physical verification query:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'system_audit_logs';
   ```

**Expected Result:**
- Table renamed. Query confirms `system_audit_logs` exists with 2 rows.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-17: Capture physical query showing `system_audit_logs`.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-OP-06 — MongoDB: Rename Field (`users.role` → `userRole`)

**Objective:**  
Verify atomic field renaming in MongoDB using native `$rename` operator.

**Preconditions:**  
MongoDB `phase11migrateiq` connected.

**Steps:**
1. Switch to MongoDB (`phase11migrateiq`).
2. Select **Operation Type:** `Rename Column`.
3. Select **Target Collection:** `users`.
4. Enter **Column Name:** `role`.
5. Enter **New Column Name:** `userRole`.
6. Verify Forward Script: `db.users.updateMany({}, { $rename: { 'role': 'userRole' } });`.
7. Deploy in Step 6.
8. Physical MongoDB check:
   ```bash
   mongosh phase11migrateiq --eval "db.users.findOne({}, { userRole: 1, role: 1 })"
   ```

**Expected Result:**
- Document returns `userRole: "admin"` (or "member"). Field `role` no longer exists.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-18: Capture mongosh output showing `userRole` in document.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-OP-07 — MongoDB: Secondary Unique Index (`products.sku`)

**Objective:**  
Verify creating a unique secondary index on a MongoDB collection.

**Preconditions:**  
MongoDB `phase11migrateiq` connected.

**Steps:**
1. Select **Operation Type:** `Add Index`.
2. Select **Target Collection:** `products`.
3. Enter **Column / Field Name:** `sku`.
4. Check: **isUnique**.
5. Verify Forward Script: `db.products.createIndex({ sku: 1 }, { unique: true });`.
6. Deploy in Step 6.
7. Physical MongoDB check:
   ```bash
   mongosh phase11migrateiq --eval "db.products.getIndexes()"
   ```

**Expected Result:**
- Index list includes `{ key: { sku: 1 }, name: "sku_1", unique: true }`.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-19: Capture `db.products.getIndexes()` showing `sku_1`.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-OP-08 — MongoDB: Rename Collection (`products` → `inventory_items`)

**Objective:**  
Verify atomic collection renaming in MongoDB.

**Preconditions:**  
MongoDB `phase11migrateiq` connected.

**Steps:**
1. Select **Operation Type:** `Rename Table / Collection`.
2. Select **Target Collection:** `products`.
3. Enter **New Table Name:** `inventory_items`.
4. Deploy in Step 6.
5. Physical MongoDB check:
   ```bash
   mongosh phase11migrateiq --eval "db.getCollectionNames()"
   ```

**Expected Result:**
- Collection list contains `inventory_items`. `products` is gone. Documents preserved.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-20: Capture collection names output showing `inventory_items`.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

## 🛡️ PART 4: DEFENSIVE, NEGATIVE & SECURITY TESTS

---

### TC-SEC-01 — Enterprise Policy Guard: Reserved SQL Keyword Interception (`User`)

**Objective:**  
Verify that naming a column after a reserved SQL keyword triggers policy rule `PG-POLICY-002`.

**Preconditions:**  
PostgreSQL connected at Step 3.

**Steps:**
1. In Step 3 (PostgreSQL), set **Operation Type:** `Add Column`.
2. Set **Target Table:** `customers`.
3. Enter **Column Name:** `User`.
4. Click **"Continue to Impact & Policy Check →"**.
5. Inspect the Policy Guard section.

**Expected Result:**
- Purple banner appears:  
  `⚠️ PG-POLICY-002: Identifier "user" is a reserved SQL keyword.`
- Recommendation warns against using reserved keywords.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-21: Capture Step 4 showing purple `PG-POLICY-002` reserved keyword violation banner.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-SEC-02 — Enterprise Policy Guard: Naming Convention Enforcement (`firstName`)

**Objective:**  
Verify that entering camelCase column names triggers policy rule `PG-POLICY-001`.

**Preconditions:**  
PostgreSQL connected at Step 3.

**Steps:**
1. Set **Column Name:** `firstName`.
2. Advance to Step 4.
3. Inspect the Policy Guard section.

**Expected Result:**
- Purple banner appears:  
  `⚠️ PG-POLICY-001: Column name "firstName" must follow snake_case naming convention (e.g. first_name).`

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-22: Capture Step 4 showing purple `PG-POLICY-001` naming violation banner.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-SEC-03 — Populated Table NOT NULL Risk Interception & 1-Click Auto-Fix

**Objective:**  
Verify that attempting to add a NOT NULL column without a default to a populated table is flagged as CRITICAL and provides an instant Auto-Fix.

**Preconditions:**  
PostgreSQL connected at Step 3.

**Steps:**
1. In Step 3: Table `customers` (5 rows).
2. Column Name: `ssn_number`.
3. Uncheck: `Nullable`.
4. Leave `Default Value` completely empty.
5. Advance to Step 4.
6. Inspect the Risk Evaluation banner.
7. Click the blue button: **"Auto-Fix: Make Nullable"** (or Supply Default).

**Expected Result:**
- Step 4 displays Red **CRITICAL RISK** banner:  
  `Cannot add NOT NULL constraint to populated table "customers" (5 rows) without default value.`
- Auto-Fix button instantly updates the parameter to nullable or injects a safe default, resolving the critical violation.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-23: Capture Red Critical Risk banner and the Auto-Fix resolution.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-SEC-04 — Gemini AI NL2DDL Translation (Simple, Complex & Ambiguous Prompts)

**Objective:**  
Verify that Mode B AI handles natural language input, populates structured form fields, and refuses to guess on ambiguous input.

**Preconditions:**  
App at Step 3.

**Steps:**
1. In Step 3, switch to **"Mode B: Gemini AI NL2DDL"**.
2. Test Prompt 1 (Simple):  
   `Add an optional phone_number VARCHAR(20) column to customers`  
   Click **"Translate with Gemini AI"**.
   - Form populates: `addColumn`, `customers`, `phone_number`, `VARCHAR(20)`.
3. Test Prompt 2 (Complex Unique):  
   `Create a unique index on customers email`  
   Click **"Translate with Gemini AI"**.
   - Form populates: `addIndex`, `customers`, `email`, unique checked.
4. Test Prompt 3 (Ambiguous):  
   `Make customers better for phone numbers`  
   Click **"Translate with Gemini AI"**.

**Expected Result:**
- Prompts 1 and 2 translate cleanly into structured operations.
- Prompt 3 returns an explanatory notice or requests clarification rather than generating random destructive DDL.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-24: Capture Mode B AI translation result for Prompt 1 or 2.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-SEC-05 — Mode C Raw Script Import & Injection Defense

**Objective:**  
Verify that pasting a malicious multi-statement payload into Mode C isolates safe DDL and prevents uninspected `DROP TABLE` execution.

**Preconditions:**  
App at Step 3.

**Steps:**
1. Switch to **"Mode C: Raw Script Import"**.
2. Paste the following adversarial input:
   ```sql
   ALTER TABLE customers ADD COLUMN notes TEXT; DROP TABLE orders;
   ```
3. Click button: **"Tokenize & Import Script"**.
4. Review the tokenized operation and generated script preview.

**Expected Result:**
- The parser tokenizes only the `addColumn` statement for `notes`.
- The injected `DROP TABLE orders;` is rejected / stripped and is **NEVER** executed or added to the execution plan without explicit safety approval.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-25: Capture Mode C tokenized output showing safe single-statement isolation.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-SEC-06 — Cryptographic Idempotency Guard (Duplicate Execution Rejection)

**Objective:**  
Verify that attempting to execute an already executed migration with an identical SHA-256 script checksum is blocked before DDL execution.

**Preconditions:**  
A migration was applied in TC-PG-06 or any earlier step.

**Steps:**
1. In Step 7, execute any valid schema update (e.g. `addColumn status_code`).
2. Confirm deployment succeeds and certificate appears.
3. Click button: **"+ Apply Another Change"**.
4. In Step 3, re-enter the exact same change with the exact same parameters on the same table.
5. Advance to Step 6 and click Deploy.

**Expected Result:**
- Execution is rejected with an explicit error:
  `Idempotency Guard: Migration already executed with identical SHA-256 checksum (...). Duplicate execution blocked.`
- Zero duplicate statements are executed against the database.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-26: Capture the Idempotency Guard duplicate execution rejection message.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-SEC-07 — Production Shield Hard-Confirmation Barrier Modal

**Objective:**  
Verify that running any migration in `production` tier or performing destructive drops opens the Production Shield modal requiring exact typed authorization.

**Preconditions:**  
App at Step 1.

**Steps:**
1. Navigate to Step 1.
2. Click **Production** tier card (Red badge: `Strict Shield`).
3. Connect to `phase11migrateiq`.
4. Advance to Step 3 and configure any change (e.g. `addColumn test_prod`).
5. Advance to Step 6. Note button styling.
6. Click button: **"🚨 Deploy to PRODUCTION (Shield Active) →"**.
7. Modal appears: **"PRODUCTION SHIELD ACTIVATED"**.
8. Type `yes` into the input box and observe the "Authorize & Deploy" button.
9. Type `APPLY_TO_PRODUCTION` exactly.
10. Observe the button.

**Expected Result:**
- Typing `yes` or incorrect text keeps the "Authorize & Deploy" button **disabled**.
- Typing exact required string `APPLY_TO_PRODUCTION` enables the button.
- For `dropColumn` or `dropTable`, typing exact string `CONFIRM_DROP` is required.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-27: Capture the Production Shield Modal with disabled button on `yes` and enabled on `APPLY_TO_PRODUCTION`.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

## 💥 PART 5: FAILURE, RECOVERY & ATOMICITY TESTS

---

### TC-FAIL-01 — Intentional Mid-Flight Failure & Clean Rollback Verification

**Objective:**  
Intentionally execute an invalid SQL statement, confirm the transaction rolls back cleanly, confirm zero ghost columns exist, and verify the ledger records `[FAILED]`.

**Preconditions:**  
PostgreSQL `phase11migrateiq` connected.

**Steps:**
1. In psql or pgAdmin, add a row to `customers` with a duplicate email:
   ```sql
   INSERT INTO customers (full_name, email, city) VALUES ('Duplicate User', 'john@phase11.test', 'Boston');
   ```
2. In MigrateIQ, go to Step 3:
   - Target Table: `customers`
   - Operation: `Add Index`
   - Column: `email`
   - Check: `isUnique` (Unique Index on non-unique data!)
3. Advance to Step 6 and click Deploy.
4. Observe the error message in Step 7.
5. Check the ledger in psql:
   ```sql
   SELECT description, success, error_message 
   FROM public.migrateiq_schema_history 
   ORDER BY installed_rank DESC LIMIT 1;
   ```
6. Verify that no partial index exists:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'customers' AND indexname LIKE '%email%';
   ```

**Expected Result:**
- Step 7 displays user-friendly error explaining unique constraint violation (error code `23505`).
- Suggestion advises cleaning duplicate rows.
- Ledger records `success = false` with `[FAILED]`.
- Physical query confirms zero ghost indexes exist in PostgreSQL.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-28: Capture Step 7 failure receipt and SQL ledger query showing `success = false`.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

### TC-FAIL-02 — Application Restart Persistence Verification

**Objective:**  
Verify that ledger history and drift radar states survive completely closing and reopening the desktop application.

**Preconditions:**  
At least 1 migration executed previously.

**Steps:**
1. Ensure at least 1 migration has been executed in PostgreSQL or MongoDB.
2. Completely close the MigrateIQ desktop window.
3. Reopen the desktop application (`npm run desktop:dev`).
4. Navigate to **Schema Update Assistant**.
5. Click button: **"📋 Schema Ledger"**.
6. Connect to `phase11migrateiq` and advance to Step 2.

**Expected Result:**
- Schema Ledger drawer displays all previously executed migrations, timestamps, and checksums intact.
- Step 2 Drift Radar accurately reflects the current state without errors.

**Actual Result / Tester Notes:**  
[ Type actual result / observations here in Word ]

**Status:** [ Type PASS / FAIL / BLOCKED / NOT APPLICABLE ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-29: Capture Schema Ledger drawer immediately after application restart showing persisted entries.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

## 🧪 PART 6: AUTOMATED TEST VERIFICATION (6 SUITES)

Run each automated test command in your terminal from the project root (`Int_DB_Migration`) and record results:

### TC-AUTO-01: Core Schema Update Test Suite
- **COMMAND:** `node scripts/test-phase11-schema-update.js`
- **WHY:** Verifies DDL generators, tokenizer, policy guard, expand & contract, and $jsonSchema.
- **EXPECTED:** `131 / 131 Passed` (Exit Code 0).
- **Status:** [ Type PASS / FAIL ]
- **Actual Result / Terminal Output:**  
  [ Type or paste terminal summary here in Word ]
- **Evidence:**  
  📸 SCREENSHOT REQUIRED — Evidence E-30: Capture terminal summary showing `131 / 131 Passed`.  
  Screenshot:  
  [>>> PASTE SCREENSHOT HERE IN WORD <<<]

### TC-AUTO-02: Live MongoDB Rollback State Restoration Suite
- **COMMAND:** `node scripts/test-mongo-rollback-verification.js`
- **WHY:** Verifies live MongoDB roundtrip state restoration across 7 distinct scenarios.
- **EXPECTED:** `22 / 22 Passed` (Exit Code 0).
- **Status:** [ Type PASS / FAIL ]
- **Actual Result / Terminal Output:**  
  [ Type or paste terminal summary here in Word ]
- **Evidence:**  
  📸 SCREENSHOT REQUIRED — Evidence E-31: Capture terminal summary showing `22 / 22 Passed`.  
  Screenshot:  
  [>>> PASTE SCREENSHOT HERE IN WORD <<<]

### TC-AUTO-03: Failure-Recovery & Fault Tolerance Suite
- **COMMAND:** `node scripts/test-phase11-failure-recovery.js`
- **WHY:** Verifies halfway batch failure, lock timeout 55P03, and constraint violation atomicity.
- **EXPECTED:** `15 / 15 Passed` (Exit Code 0).
- **Status:** [ Type PASS / FAIL ]
- **Actual Result / Terminal Output:**  
  [ Type or paste terminal summary here in Word ]
- **Evidence:**  
  📸 SCREENSHOT REQUIRED — Evidence E-32: Capture terminal summary showing `15 / 15 Passed`.  
  Screenshot:  
  [>>> PASTE SCREENSHOT HERE IN WORD <<<]

### TC-AUTO-04: Real End-to-End Database Lifecycle Suite
- **COMMAND:** `node scripts/test-phase11-real-e2e.js`
- **WHY:** Verifies real live PostgreSQL and MongoDB 7-stage evolution lifecycles.
- **EXPECTED:** `17 / 17 Passed` (Exit Code 0).
- **Status:** [ Type PASS / FAIL ]
- **Actual Result / Terminal Output:**  
  [ Type or paste terminal summary here in Word ]
- **Evidence:**  
  📸 SCREENSHOT REQUIRED — Evidence E-33: Capture terminal summary showing `17 / 17 Passed`.  
  Screenshot:  
  [>>> PASTE SCREENSHOT HERE IN WORD <<<]

### TC-AUTO-05: Security, Redaction & Identifier Sanitization Suite
- **COMMAND:** `node scripts/test-phase11-security-audit.js`
- **WHY:** Verifies password masking (`••••••••`), SQL injection sanitizers, and Production Shield tokens.
- **EXPECTED:** `26 / 26 Passed` (Exit Code 0).
- **Status:** [ Type PASS / FAIL ]
- **Actual Result / Terminal Output:**  
  [ Type or paste terminal summary here in Word ]
- **Evidence:**  
  📸 SCREENSHOT REQUIRED — Evidence E-34: Capture terminal summary showing `26 / 26 Passed`.  
  Screenshot:  
  [>>> PASTE SCREENSHOT HERE IN WORD <<<]

### TC-AUTO-06: Chaos & Adversarial Test Suite
- **COMMAND:** `node scripts/test-phase11-chaos-adversarial.js`
- **WHY:** Verifies concurrency conflict detection (`pg_try_advisory_lock`), lock auto-release on failure, duplicate execution blocks, and tamper hash drift.
- **EXPECTED:** `22 / 22 Passed` (Exit Code 0).
- **Status:** [ Type PASS / FAIL ]
- **Actual Result / Terminal Output:**  
  [ Type or paste terminal summary here in Word ]
- **Evidence:**  
  📸 SCREENSHOT REQUIRED — Evidence E-35: Capture terminal summary showing `22 / 22 Passed`.  
  Screenshot:  
  [>>> PASTE SCREENSHOT HERE IN WORD <<<]

### TC-AUTO-07: Monorepo Strict TypeScript Typecheck
- **COMMAND:** `npm run typecheck`
- **WHY:** Verifies 0 TypeScript errors across shared, desktop, and web packages.
- **EXPECTED:** Exits with code 0; 0 type errors.
- **Status:** [ Type PASS / FAIL ]
- **Actual Result / Terminal Output:**  
  [ Type or paste terminal summary here in Word ]
- **Evidence:**  
  📸 SCREENSHOT REQUIRED — Evidence E-36: Capture terminal output showing clean typecheck completion.  
  Screenshot:  
  [>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

## 🎨 PART 7: UI / UX & VISUAL CONSISTENCY CHECKLIST

Inspect the application UI for visual excellence and standard compliance:

| Check ID | Inspection Item | Expected Behavior | Status |
| :--- | :--- | :--- | :---: |
| **UX-01** | Light Theme Strictness | Background `#F8FAFC`, cards pure white `#FFFFFF`, borders `#E2E8F0`. No dark backgrounds. | [ Type PASS / FAIL ] |
| **UX-02** | Typography & Spacing | Font is Inter (Google Fonts), consistent line heights, generous padding. | [ Type PASS / FAIL ] |
| **UX-03** | 7-Step Navigation Stepper | Active step is highlighted in royal blue (`#2563EB`), completed steps show checkmarks `✓`. | [ Type PASS / FAIL ] |
| **UX-04** | Responsive Layout | Stepper and cards do not overlap or wrap awkwardly at 1280x800 resolution. | [ Type PASS / FAIL ] |
| **UX-05** | Button Hover States | Buttons have smooth hover transition (e.g. Blue `#2563EB` $\to$ Dark Blue `#1D4ED8`). | [ Type PASS / FAIL ] |
| **UX-06** | Card Hover Lift | Cards have subtle box-shadow lift on mouseover. | [ Type PASS / FAIL ] |
| **UX-07** | Copy Feedback | "Copy Forward", "Copy Rollback", and "Copy Integrity Certificate" change to `✓ Copied` for 2 seconds. | [ Type PASS / FAIL ] |
| **UX-08** | No Console Errors | Opening DevTools (`Ctrl + Shift + I`) shows zero unhandled red exceptions during standard flows. | [ Type PASS / FAIL ] |

**Tester UI Notes:**  
[ Type UI observations, visual bugs, or layout findings here in Word ]

**Evidence:**  
📸 SCREENSHOT REQUIRED — Evidence E-37: Capture desktop window showing UI theme, stepper, and active step styling.  
Screenshot:  
[>>> PASTE SCREENSHOT HERE IN WORD <<<]

---

## 🚨 PART 8: WHAT TO DO IF SOMETHING GOES WRONG (TROUBLESHOOTING)

#### PROBLEM 1: Database Connection Refused (`ECONNREFUSED 127.0.0.1:5432`)
- **CHECK:** Verify if PostgreSQL service is running in Windows Services (`services.msc` $\to$ postgresql-x64-XX).
- **ACTION:** Start PostgreSQL service or start Docker container if using containerized database.
- **EXPECTED:** `Test-NetConnection -Port 5432` returns `TcpTestSucceeded: True`.

#### PROBLEM 2: MongoDB Connection Timeout (`ServerSelectionTimeoutError`)
- **CHECK:** Verify MongoDB service is running on port 27017.
- **ACTION:** Run `mongod --dbpath <data_dir>` or start MongoDB Windows service.
- **EXPECTED:** `mongosh mongodb://localhost:27017` connects successfully.

#### PROBLEM 3: Accidental Schema Corruption or Test Table Dropped
- **CHECK:** Did a destructive test drop a required table (`customers` or `orders`)?
- **ACTION:** Run `node scripts/seed-phase11-testbed.js` in terminal.
- **EXPECTED:** Both databases are cleanly reset in 2 seconds.

#### PROBLEM 4: Button is Disabled or Form Does Not Submit
- **CHECK:** Look for red field labels or missing required inputs (e.g. missing column name).
- **ACTION:** In Step 3, ensure both Target Table and Column Name are filled.
- **EXPECTED:** Bottom navigation button lights up royal blue.

#### ⚠️ WHEN TO STOP AND CONTACT THE DEVELOPER:
1. If PostgreSQL crashes or hangs indefinitely on advisory locks.
2. If `npm run typecheck` produces compilation errors.
3. If an unhandled red error appears in the Electron console (`Ctrl + Shift + I`) that prevents navigation.

---

## 📊 PART 9: TEST RESULT SUMMARY TABLE

| Category | Total Cases | Passed (Type Count) | Failed (Type Count) | Blocked (Type Count) | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **1. PostgreSQL Happy Path** | 7 | [ Count ] | [ Count ] | [ Count ] | TC-PG-01 to TC-PG-07 |
| **2. MongoDB Happy Path** | 5 | [ Count ] | [ Count ] | [ Count ] | TC-MO-01 to TC-MO-05 |
| **3. Advanced Operations Matrix** | 8 | [ Count ] | [ Count ] | [ Count ] | TC-OP-01 to TC-OP-08 |
| **4. Defensive & Security** | 7 | [ Count ] | [ Count ] | [ Count ] | TC-SEC-01 to TC-SEC-07 |
| **5. Failure, Recovery & Persistence** | 2 | [ Count ] | [ Count ] | [ Count ] | TC-FAIL-01 & TC-FAIL-02 |
| **6. Automated Test Suites** | 7 | [ Count ] | [ Count ] | [ Count ] | TC-AUTO-01 to TC-AUTO-07 |
| **7. UI / UX Quality** | 8 | [ Count ] | [ Count ] | [ Count ] | UX-01 to UX-08 |
| **TOTALS** | **44** | [ Total ] | [ Total ] | [ Total ] | |

---

## 🐛 PART 10: DEFECT LOGGING TABLE (FOR TESTER)

Use this table to log any defects found during testing directly in Word:

| Defect ID | Test Case Ref | Severity (Critical / Major / Minor) | Description of Issue | Steps to Reproduce | Expected vs Actual Result | Status (Open / Investigating) |
|---|---|---|---|---|---|---|
| DEF-01 | TC-____ | [ Type Severity ] | [ Type Description ] | 1. ... 2. ... | Expected: ... Actual: ... | Open |
| DEF-02 | | | | | | |
| DEF-03 | | | | | | |

---

### Detailed Defect Form (For Critical/Complex Issues)

If a complex defect requires detailed logging, fill out this section:

```text
DEFECT ID: DEF-PHASE11-001
TEST CASE REF: [ Type TC-ID, e.g. TC-PG-03 ]
TITLE: [ Short 1-line descriptive summary ]
SEVERITY: [ Critical / Major / Minor / Cosmetic ]
PRIORITY: [ High / Medium / Low ]

ENVIRONMENT:
- Engine: [ PostgreSQL / MongoDB ]
- Tier: [ Development / Staging / Production ]
- OS: Windows 11
- Node: v18+

STEPS TO REPRODUCE:
1. [ Step 1 ]
2. [ Step 2 ]
3. [ Step 3 ]

EXPECTED RESULT:
[ What the checklist says should happen ]

ACTUAL RESULT:
[ What actually happened ]

EVIDENCE / SCREENSHOT:
[ Evidence # or paste screenshot ]

DEVTOOLS CONSOLE LOG:
[ Paste error from Ctrl+Shift+I Console ]

DATABASE PHYSICAL STATE:
[ Output of verification SQL query or mongosh command ]

REPRODUCIBLE: [ Type Yes / No / Intermittent ]
```

---

## ✍️ PART 11: FINAL QA SIGN-OFF (WORD FORMAT)

### Overall Result:
**Overall Verdict:** [ Type PASS / PASS WITH MINOR ISSUES / FAIL / BLOCKED ]

*(Options: PASS — Phase 11 fully verified | PASS WITH MINOR ISSUES — Minor cosmetic notes | FAIL — Blocking defects | BLOCKED — Testing halted)*

### Tester Information:
- **Tester Name:** [ Type Tester Name ]
- **Date Completed:** [ Type Date ]
- **Project Version / Git Commit:** [ Type Git Commit Hash ]
- **Environment Tested:** [ Type OS, Node Version, DB Versions ]

### Final Tester Comments & Summary:
[ Type overall testing summary, key highlights, or release recommendations here in Word ]

---

- **Tester Signature / Initials:** [ Type Name / Initials ] &nbsp;&nbsp;&nbsp;&nbsp; **Date:** [ Type Date ]  
- **Lead Reviewer Signature:** [ Type Name / Initials ] &nbsp;&nbsp;&nbsp;&nbsp; **Date:** [ Type Date ]

---

## 📋 PART 12: TESTING COMPLETION CHECKLIST (WORD WORKFLOW)

Before saving and returning this Word document to the developer, verify that you have completed:

1. Every test case has a status typed in (`PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE`).
2. Actual results and notes are filled in for any unexpected behavior or failed tests.
3. Screenshots are pasted directly into all required `[>>> PASTE SCREENSHOT HERE IN WORD <<<]` placeholders.
4. Physical database queries were executed and verified in psql/pgAdmin and mongosh.
5. The Reset Procedure was verified at least once (`node scripts/seed-phase11-testbed.js`).
6. The Summary Table in Part 9 is completed with accurate counts.
7. Any discovered defects are logged in the Defect Logging Table in Part 10.
8. The Final QA Sign-Off section in Part 11 is completed with Overall Verdict and Tester Information.
9. The Microsoft Word (.docx) file is saved and ready to send back for review.

---
*End of QA Manual — MigrateIQ Phase 11 Schema Update Assistant & Evolution Workbench.*
