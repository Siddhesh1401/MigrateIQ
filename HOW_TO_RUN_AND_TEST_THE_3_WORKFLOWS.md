# 🧪 How to Run & Test the 3 Industrial Database Workflows
## Complete Team Guide for Seeding, Connecting, and Testing MigrateIQ

---

## 📌 To the Team: What is this guide for?
We have built **3 enterprise-grade database seeding scripts** — one for each core workflow of MigrateIQ. 
This guide explains:
1. **The exact names of the 3 script files** and what they create.
2. **How to run them with a single terminal command**.
3. **The exact connection URLs** for MongoDB and PostgreSQL.
4. **How to test each workflow inside the desktop app step-by-step** so you know what to expect during tomorrow's viva.

---

# TABLE OF CONTENTS
1. [Overview of the 3 Scripts & Database Names](#1-overview-of-the-3-scripts--database-names)
2. [How to Run the Scripts in Terminal](#2-how-to-run-the-scripts-in-terminal)
3. [Connection URLs & Parameters (Copy-Paste Reference)](#3-connection-urls--parameters-copy-paste-reference)
4. [How to Test Workflow A in the App (MongoDB → PostgreSQL)](#4-how-to-test-workflow-a-in-the-app-mongodb--postgresql)
5. [How to Test Workflow B in the App (PostgreSQL → MongoDB Reverse)](#5-how-to-test-workflow-b-in-the-app-postgresql--mongodb-reverse)
6. [How to Test Workflow C in the App (Schema Update Assistant)](#6-how-to-test-workflow-c-in-the-app-schema-update-assistant)
7. [What to Verify ("Did it work?" Checklist)](#7-what-to-verify-did-it-work-checklist)
8. [Troubleshooting & Quick Fixes](#8-troubleshooting--quick-fixes)

---

# 1. Overview of the 3 Scripts & Database Names

We have created 3 dedicated seeder scripts located in the `scripts/` directory:

| Script File Name | Target Workflow | Source Database | Target Database | What It Seeds |
| :--- | :--- | :--- | :--- | :--- |
| **`scripts/seed-final-workflow-a.js`** | **Workflow A**<br>(MongoDB $\to$ PostgreSQL) | **MongoDB:**<br>`final_mongo_workflow_a` | **PostgreSQL:**<br>`final_postgres_workflow_a` | **2,985 documents** across 7 collections (`categories`, `customers`, `products`, `orders`, `shipments`, `invoices`, `reviews`). Contains **1,800 nested order items** and high-precision `Decimal128` financial values. Cleans target PostgreSQL DB so it has 0 tables ready for migration. |
| **`scripts/seed-final-workflow-b.js`** | **Workflow B**<br>(PostgreSQL $\to$ MongoDB Reverse) | **PostgreSQL:**<br>`final_postgres_workflow_b` | **MongoDB:**<br>`final_mongo_workflow_b` | **5,265 relational rows** across 10 strictly normalized 3NF SQL tables (`departments`, `employees`, `categories`, `products`, `customers`, `customer_profiles`, `orders`, `order_items`, `payments`, `reviews`). Cleans target MongoDB DB so it has 0 collections ready for reverse ETL. |
| **`scripts/seed-final-workflow-c.js`** | **Workflow C**<br>(Schema Update Copilot) | **PostgreSQL:**<br>`final_postgres_workflow_c` | **MongoDB:**<br>`final_mongo_workflow_c` | **9,025 active records** in a PostgreSQL Fintech Ledger (`accounts`, `transactions`, `audit_logs`, `system_parameters`) + **500 user profiles** in MongoDB with active `$jsonSchema` document validation. |

---

# 2. How to Run the Scripts in Terminal

Make sure local MongoDB and PostgreSQL are running on your computer.

### 🚀 Option 1: Seed ALL 3 Workflows at Once (Recommended)
Open your terminal (PowerShell or Git Bash) in the project root and run:

```bash
npm run seed:final-all
```
*What happens:* It sequentially creates and seeds all 3 databases in PostgreSQL and MongoDB in under 10 seconds!

---

### 🎯 Option 2: Seed Workflows Individually

```bash
# Seed Workflow A (MongoDB → PostgreSQL):
npm run seed:final-a

# Seed Workflow B (PostgreSQL → MongoDB Reverse):
npm run seed:final-b

# Seed Workflow C (Fintech Ledger for Schema Update Assistant):
npm run seed:final-c
```

---

### 🎁 Automatic Pre-Configuration into the Desktop App!
We also created an automated profile injector:
```bash
node scripts/seed-saved-connections.js
```
*(This automatically adds all 6 connection cards directly into your desktop app's persistent storage so you don't even have to type them!)*

---

# 3. Connection URLs & Parameters (Copy-Paste Reference)

If you ever need to enter or check the connection details manually in the app, here are the exact URLs:

### 📦 Workflow A
- **Source (MongoDB):**
  - URL: `mongodb://localhost:27017/final_mongo_workflow_a`
  - *Or fields:* Host: `localhost` | Port: `27017` | Database: `final_mongo_workflow_a`
- **Target (PostgreSQL):**
  - URL: `postgresql://postgres:admin@localhost:5432/final_postgres_workflow_a`
  - *Or fields:* Host: `localhost` | Port: `5432` | Database: `final_postgres_workflow_a` | User: `postgres` | Password: `admin`

---

### 🔄 Workflow B
- **Source (PostgreSQL):**
  - URL: `postgresql://postgres:admin@localhost:5432/final_postgres_workflow_b`
  - *Or fields:* Host: `localhost` | Port: `5432` | Database: `final_postgres_workflow_b` | User: `postgres` | Password: `admin`
- **Target (MongoDB):**
  - URL: `mongodb://localhost:27017/final_mongo_workflow_b`
  - *Or fields:* Host: `localhost` | Port: `27017` | Database: `final_mongo_workflow_b`

---

### ⚡ Workflow C
- **PostgreSQL Database (Fintech Ledger):**
  - URL: `postgresql://postgres:admin@localhost:5432/final_postgres_workflow_c`
  - *Or fields:* Host: `localhost` | Port: `5432` | Database: `final_postgres_workflow_c` | User: `postgres` | Password: `admin`
- **MongoDB Database (Document Validation):**
  - URL: `mongodb://localhost:27017/final_mongo_workflow_c`
  - *Or fields:* Host: `localhost` | Port: `27017` | Database: `final_mongo_workflow_c`

---

# 4. How to Test Workflow A in the App (MongoDB → PostgreSQL)

Follow these steps to run a live test of Workflow A on your laptop:

### Step 1: Launch the Desktop App
```bash
npm run desktop:dev
```

### Step 2: Verify Connections in the App
1. In the left sidebar, click **Connections**.
2. Find the card: **`Workflow A — Source (MongoDB)`** and click **`[⚡ Test Connection]`**.
   - You should see: `✅ Connected (Xms)`.
3. Find the card: **`Workflow A — Target (PostgreSQL)`** and click **`[⚡ Test Connection]`**.
   - You should see: `✅ Connected (Xms)`.

### Step 3: Run the Migration Wizard
1. In the sidebar, click **New Migration**.
2. **Step 1 (Mode):**
   - Direction: Select **MongoDB to PostgreSQL**.
   - Mode: **Full Migration**. Click **Next**.
3. **Step 2 (Source):**
   - Pick `Workflow A — Source (MongoDB)` from the saved connections dropdown (or enter `mongodb://localhost:27017/final_mongo_workflow_a`). Click **Connect & Continue**.
4. **Step 3 (Target):**
   - Pick `Workflow A — Target (PostgreSQL)` from the dropdown (or enter `postgresql://postgres:admin@localhost:5432/final_postgres_workflow_a`). Click **Connect & Continue**.
5. **Step 4 (Schema Mapper):**
   - Notice that MigrateIQ automatically discovered:
     - `customers` (with 1NF flattened address columns)
     - `orders` (with a child table **`order_items`** and injected `sort_order` column)
     - `shipments` (with child table **`shipment_tracking_events`**)
     - `invoices` (with `Decimal128` mapped to `NUMERIC`)
   - Click **`[⚡ Use Rule Engine (Offline)]`** or **`[✨ Map with Gemini AI]`**.
   - Click **Next: Risk Analysis**.
6. **Step 5 (Risk Report):**
   - View the Safety Score (e.g. `85/100`).
   - Click **`[Apply Auto-Fix]`** on any warnings, check the quarantine policy, and click **Next: Dry Run**.
7. **Step 6 (Dry Run):**
   - Click **`[Run Dry Run Simulation]`**.
   - Watch the simulated `BEGIN; ... ROLLBACK;` pass with 0 errors. Click **Next: Live Migration**.
8. **Step 7 (Live Migration):**
   - Click **`[Start Live Migration]`**.
   - Watch the progress bars move, streaming all 2,985 documents and child rows in 500-document batches!
9. **Step 8 (Verification Studio):**
   - Check the **Reconciliation Overview**: 0% volumetric discrepancy.
   - Look at the financial sum proof: $0.00 drift. Click **Next: Completion**.
10. **Step 9 (Complete & Export):**
    - Enjoy the confetti! 🎉
    - Inspect the interactive **Mermaid ERD**.
    - Click **`[📦 Download Refactoring Kit (.zip)]`** and **`[📄 Download Audit Report (PDF)]`** to verify downloads.

---

# 5. How to Test Workflow B in the App (PostgreSQL → MongoDB Reverse)

This tests migrating from PostgreSQL back to MongoDB with automated **denormalization**.

1. In the sidebar, click **New Migration**.
2. **Step 1 (Mode):**
   - Direction: Select **PostgreSQL to MongoDB**. Click **Next**.
3. **Step 2 (Source PG):**
   - Select `Workflow B — Source (PostgreSQL)` (database: `final_postgres_workflow_b`). Click **Connect & Continue**.
4. **Step 3 (Target Mongo):**
   - Select `Workflow B — Target (MongoDB)` (database: `final_mongo_workflow_b`). Click **Connect & Continue**.
5. **Step 4 (Schema Mapper - Reverse Mode):**
   - Notice the **Embedding Mode Selector**!
   - On table `order_items`, ensure it is set to **`Embed as Array (Parent)`** (Parent: `orders`, Embedded field: `items`).
   - Notice that core entities (`customers`, `products`, `orders`) remain as top-level collections.
   - Click **Next**.
6. **Steps 5 & 6 (Risk & Dry Run):**
   - Verify safety score and run dry-run simulation. Click **Next**.
7. **Step 7 (Live Reverse Migration):**
   - Click **`[Start Live Migration]`**.
   - Watch the progress screen: under the hood, `reverseEtlEngine.ts` streams 5,265 rows, executes `WHERE fk = ANY($1)` to avoid $N+1$ queries, and bulk-inserts nested BSON documents into MongoDB!
8. **Step 8 (Verification):**
   - Notice the table stats: embedded child counts are verified using MongoDB `$size` aggregation!

---

# 6. How to Test Workflow C in the App (Schema Update Assistant)

This tests modifying an active live database using natural language.

1. In the sidebar, click **New Schema Update** (`/schema-update`).
2. **Step 1 (Target DB):**
   - Select database engine: **PostgreSQL**.
   - Connection: Select `Workflow C — Fintech Ledger (PostgreSQL)` (database: `final_postgres_workflow_c`).
   - Environment Tier: **Development**. Click **Connect & Next**.
3. **Step 2 (Schema Introspection & Drift):**
   - The app introspects all 4 tables (`accounts`, `transactions`, `audit_logs`, `system_parameters`) and confirms 0 schema drift. Click **Next**.
4. **Step 3 (Define Change):**
   - Choose **Natural Language Prompt**.
   - Type this exact prompt:
     > *"Add an optional loyalty_discount numeric column to accounts with default 0"*
   - Click **Interpret Request**.
5. **Step 4 (Impact Scorecard & Lock Analysis):**
   - Inspect the Lock Analysis: notice it shows lock evaluation and downtime risk. Click **Next**.
6. **Step 5 (Generated Scripts):**
   - Inspect the **Forward DDL**: `ALTER TABLE "accounts" ADD COLUMN "loyalty_discount" NUMERIC DEFAULT 0;`
   - Inspect the **Rollback DDL**: `ALTER TABLE "accounts" DROP COLUMN "loyalty_discount";`
   - Click **Next: Dry Run**.
7. **Step 6 (Dry Run):**
   - Click **`[Execute Dry Run Simulation]`**.
   - Confirms the query executes and rolls back cleanly with a 5-second lock timeout. Click **Next: Apply**.
8. **Step 7 (Live Execution):**
   - Click **`[Apply Schema Update Now]`**.
   - Watch the live execution terminal succeed!
9. In the sidebar, click **Schema History** to verify that your change was permanently recorded in the Git-like changelog!

---

# 7. What to Verify ("Did it work?" Checklist)

When you run your tests, verify these checkpoints:

- [ ] **Workflow A:** `final_postgres_workflow_a` should now have `orders` and `order_items` tables with identical rows and matching total amounts.
- [ ] **Workflow B:** `final_mongo_workflow_b` should now have an `orders` collection where each document contains an array of embedded `items: [{ sku, unit_price, quantity... }]`.
- [ ] **Workflow C:** In `final_postgres_workflow_c`, table `accounts` should now have the newly added column `loyalty_discount`.
- [ ] **History:** In the sidebar, click **History** and **Schema History** to verify that all completed runs appear in the audit ledger.

---

# 8. Troubleshooting & Quick Fixes

### 1. "PostgreSQL password authentication failed"
- Our seeder scripts default to user `postgres` and password `admin`.
- If your local PostgreSQL password is `postgres`, `root`, or something else, pass it as an environment variable in terminal:
  ```powershell
  # In PowerShell:
  $env:PG_PASSWORD="your_password"; npm run seed:final-all
  ```

### 2. "Cannot connect to MongoDB"
- Ensure your local MongoDB service is running:
  - Windows: Open Services (`services.msc`) $\to$ check that **MongoDB Server** is "Running".
  - Or run `mongod` in a terminal window.

### 3. "Cannot find module @migrateiq/shared"
- Run this one-time command in the root folder:
  ```bash
  npm run shared:build
  ```

---

**You and your team are ready! Run `npm run seed:final-all`, launch the app with `npm run desktop:dev`, and test all three workflows with total confidence! 🚀**

