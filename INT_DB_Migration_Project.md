# Intelligent Database Migration Planner
### Final Year Project — Complete Document

---

# PART 1: PROJECT PLAN

---

## What Is This Project?

A website that helps developers safely migrate databases (MongoDB ↔ PostgreSQL)
and also safely update an existing database schema — without breaking things.

---

## Features — What to Add, What to Skip

### ✅ Keep These (Original Ideas)
- MongoDB → PostgreSQL migration
- PostgreSQL → MongoDB migration
- In-database schema update assistant (e.g. safely ALTER a table)

### ➕ Add These (Small but Impactful)
1. **Dry Run Mode** — Simulate the migration without actually touching the real DB.
   Shows what WOULD happen. Very useful, very impressive to teachers.

2. **Risk Report** — Before any migration/change runs, show a simple report:
   "3 warnings found, 1 critical issue" with plain English explanations.

3. **Rollback Script** — Auto-generate an UNDO script alongside every migration.
   If something breaks, user can reverse it. Super practical.

### ❌ Don't Add These (Too Complex for 3 Months)
- Supporting more than 2 DB types (e.g. MySQL, SQLite) — out of scope
- Real-time data migration (copying millions of live rows) — very hard
- User authentication/login system — not needed, keep it simple

---

## Final Feature List

| # | Feature | What It Does |
|---|---------|--------------|
| 1 | Cross-DB Migration | Migrate MongoDB ↔ PostgreSQL with AI-assisted mapping |
| 2 | Schema Update Assistant | Safely update an existing DB schema with warnings |
| 3 | Dry Run Mode | Preview what will happen before actually running |
| 4 | Risk Report | Plain English warnings before any operation |
| 5 | Script Download | Download the generated SQL/Mongo script to run manually |
| 6 | Rollback Script | Auto-generated undo script for every migration |

---

## Tech Stack

| Part | Technology | Why |
|------|-----------|-----|
| Frontend (UI) | Next.js (React) | You already know it from your other project |
| Backend (Server) | Node.js + Express OR Python FastAPI | Handles DB connections |
| PostgreSQL connection | `pg` library (Node) | Official driver |
| MongoDB connection | `mongoose` or `mongodb` library | Official driver |
| AI suggestions | Google Gemini API (free tier available) | Smart mapping & warnings |
| Styling | Tailwind CSS | Fast, clean UI |

---

## Who Does What (Team Split)

| Person | Responsibility |
|--------|---------------|
| Person 1 | Frontend — all pages, UI, forms |
| Person 2 | Backend — DB connections, schema reader, script runner |
| Person 3 | AI integration — Gemini API, mapping logic, risk analysis |
| Person 4 (if 4th) | Testing, documentation, Dry Run + Rollback features |

---

## 3-Month Timeline

| Month | What to Build |
|-------|--------------|
| Month 1 | Setup project, DB connection, schema reader, basic UI pages |
| Month 2 | AI mapping, script generator, risk report, schema update feature |
| Month 3 | Dry run, rollback, error handling, UI polish, testing, demo prep |

---

## What Makes This Project Stand Out

1. **AI-powered plain English warnings** — not just technical errors, real explanations
2. **Dry Run Mode** — see before you commit, very practical
3. **Rollback script** — safety net, shows you thought about real-world use
4. **Two directions** — both MongoDB→PostgreSQL and back, plus in-DB updates
5. **Covers a real pain point** — database migrations actually scare developers

---
---

# PART 2: FULL WEBSITE FLOW (Step by Step)

Think of it like this: the user opens your website and is guided step by step
like a wizard. They never have to figure things out themselves.

---
---

# 🔁 FEATURE 1: Cross-Database Migration
## (Example: Moving data from MongoDB to PostgreSQL)

---

## Step 1 — User Lands on the Home Page

The user opens your website and sees two big buttons:

> **"Migrate Database"** → for moving from one DB type to another
> **"Update My Database"** → for safely changing an existing DB

They click **"Migrate Database"**.

---

## Step 2 — Choose Migration Direction

User sees a simple screen asking:

> "What do you want to migrate FROM and TO?"

They see two dropdown menus:
- **FROM:** MongoDB ✅ (they select this)
- **TO:** PostgreSQL ✅ (they select this)

They click **"Next"**.

---

## Step 3 — Connect the Source Database (MongoDB)

User sees a form asking:

> "Enter your MongoDB connection details"

They fill in:
- Connection string (like: `mongodb://username:password@host:27017/mydb`)
- OR individual fields: Host, Port, Username, Password, Database name

They click **"Connect & Read Schema"**.

**What happens behind the scenes:**
- Your backend server connects to their MongoDB database
- It reads all the collections (like: users, orders, products)
- It looks at a few sample documents in each collection to understand the structure
- It sends this info back to the website

**What the user sees:**
- A success message: ✅ "Connected! Found 3 collections: users, orders, products"
- A preview of the structure, e.g.:
  ```
  users  → { _id, name, email, address: { city, pincode }, createdAt }
  orders → { _id, userId, items: [...], totalAmount, status }
  ```

---

## Step 4 — Connect the Target Database (PostgreSQL)

Same thing but for PostgreSQL:

User sees a form:
> "Enter your PostgreSQL connection details"

They fill in their PostgreSQL credentials and click **"Connect"**.

**What happens:**
- Your backend connects to the PostgreSQL database
- Just checks if the connection works
- Reads if there are any existing tables (so it can warn about conflicts)

**What the user sees:**
- ✅ "Connected to PostgreSQL database successfully"

---

## Step 5 — AI Generates the Mapping

This is the smart part.

**What happens behind the scenes:**
- Your backend takes the MongoDB structure it read in Step 3
- It sends it to the Gemini AI API with a prompt like:
  *"Here is a MongoDB schema. Suggest how to convert it to PostgreSQL tables with proper data types."*
- Gemini responds with a suggested mapping

**What the user sees:**
A visual mapping screen, like a side-by-side comparison:

```
MONGODB (Source)              →    POSTGRESQL (Target)
─────────────────────────────────────────────────────────
Collection: users             →    Table: users
  _id (ObjectId)              →      id (SERIAL PRIMARY KEY)
  name (String)               →      name (VARCHAR 255)
  email (String)              →      email (VARCHAR 255)
  address.city (String)       →      city (VARCHAR 100)       ⚠️ was nested
  address.pincode (String)    →      pincode (VARCHAR 10)     ⚠️ was nested
  createdAt (Date)            →      created_at (TIMESTAMP)

Collection: orders            →    Table: orders
  _id (ObjectId)              →      id (SERIAL PRIMARY KEY)
  userId (ObjectId)           →      user_id (INT, FOREIGN KEY → users.id)
  totalAmount (Number)        →      total_amount (DECIMAL 10,2)
  status (String)             →      status (VARCHAR 50)
```

The user can:
- **Accept** the AI suggestion as-is
- **Edit** any mapping manually (e.g. change VARCHAR 255 to TEXT)
- **Reject** a field (skip migrating it)

They click **"Looks Good, Continue"**.

---

## Step 6 — Risk Report

Before anything runs, your website shows a Risk Report.

**What your code + AI checks:**
- Does MongoDB have fields with no value (null)? PostgreSQL might not allow that.
- Are there nested objects in MongoDB? Those need to be flattened into columns.
- Are there arrays in MongoDB? PostgreSQL needs special handling for those.
- Does the target DB already have a table with the same name?

**What the user sees:**

```
⚠️  RISK REPORT — 3 issues found

🔴 CRITICAL (1)
  - The "orders" collection has an "items" field which is an ARRAY of objects.
    Arrays cannot be stored directly in PostgreSQL columns.
    → Suggested fix: Create a separate "order_items" table.

🟡 WARNING (2)
  - 45 documents in "users" have no email value (null).
    Your new PostgreSQL table will have email as NOT NULL.
    → Suggested fix: Change email column to allow NULL, or add a default value.

  - The nested "address" object will be split into separate columns.
    Make sure your application code is updated to use the new column names.

ℹ️  INFO (0)
```

The user can decide:
- Fix and continue
- Ignore warnings and continue anyway
- Go back and change the mapping

---

## Step 7 — Dry Run (Preview Mode)

User clicks **"Do a Dry Run first"** (optional but recommended).

**What happens:**
- Your backend generates the full migration script
- But does NOT actually run it on the real database
- Instead it simulates and shows what WOULD happen

**What the user sees:**

```
DRY RUN RESULTS (Nothing was changed in your database)

✅ Would create table: users (5 columns)
✅ Would create table: orders (6 columns)
✅ Would create table: order_items (4 columns)
✅ Would insert 1,240 rows into users
✅ Would insert 3,891 rows into orders
✅ Would insert 9,102 rows into order_items
⚠️  12 rows in users skipped — missing required fields
```

User feels confident. They now click **"Run Actual Migration"**.

---

## Step 8 — Run the Migration

User clicks **"Run Migration"** and sees a live progress screen:

```
Migration in Progress...

[████████████░░░░░░░░] 60%

✅ Created table: users
✅ Created table: orders
✅ Created table: order_items
⏳ Inserting rows into users... (1240 rows)
```

Once done:

```
🎉 Migration Complete!

✅ 3 tables created
✅ 14,233 rows migrated
⚠️  12 rows skipped (see error log)

[Download Migration Report]  [Download Rollback Script]
```

---

## Step 9 — Rollback Script (Safety Net)

The user gets a **rollback script** they can download.

This script will UNDO the migration if something goes wrong later:
```sql
-- ROLLBACK SCRIPT
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;
```

This is just a safety net. If their app breaks after migration, they run this
and go back to their original MongoDB data.

---
---

# ✏️ FEATURE 2: Schema Update Assistant
## (Example: Safely updating an existing PostgreSQL database)

---

## Step 1 — User Clicks "Update My Database"

User is on the home page and clicks **"Update My Database"**.

They see a screen:
> "What type of database do you want to update?"
- PostgreSQL ✅
- MongoDB

They select PostgreSQL and click Next.

---

## Step 2 — Connect to the Database

User fills in their PostgreSQL connection details.

**What happens behind the scenes:**
- Your backend connects and reads the full current schema
- Every table, every column, every data type, every foreign key, every index

**What the user sees:**
```
✅ Connected! Here is your current database structure:

📋 Table: users
  - id (INT, PRIMARY KEY)
  - name (VARCHAR 255, NOT NULL)
  - email (VARCHAR 255, UNIQUE, NOT NULL)
  - created_at (TIMESTAMP)

📋 Table: orders
  - id (INT, PRIMARY KEY)
  - user_id (INT, FOREIGN KEY → users.id)
  - total_amount (DECIMAL)
  - status (VARCHAR 50)
```

---

## Step 3 — Describe the Change

User sees a form with two options:

**Option A — Pick from a list (easier):**
```
What do you want to do?
○ Add a new column
○ Delete a column
○ Rename a column or table
○ Change a column's data type
○ Add an index
○ Remove an index
```

They select **"Add a new column"** and fill in:
- Table: `users`
- Column Name: `phone`
- Data Type: `VARCHAR(15)`
- Allow NULL: Yes

**Option B — Type in plain English:**
> "I want to add a phone number field to the users table"

→ AI reads this and fills in the form automatically.

---

## Step 4 — Risk Report

Before showing the script, your system checks for risks.

**What your code checks:**
- Does this table have existing rows? (If adding NOT NULL column without default = 💥 error)
- Does a column with this name already exist?
- If deleting a column — does any other table reference it?
- If changing data type — could existing data be lost? (e.g. VARCHAR → INT when values like "hello" exist)

**What the user sees:**

```
⚠️  RISK REPORT for: Add column "phone" to "users"

✅ No critical issues found.

🟡 WARNING (1)
  - The users table currently has 1,240 rows.
    Since you are adding the column as NULL-allowed, existing rows
    will just have NULL for phone. This is safe.
    → If you wanted NOT NULL, you'd need to provide a default value.

ℹ️  INFO
  - This change is reversible. A rollback script will be provided.
```

---

## Step 5 — Preview the Script

User sees the exact script that will run:

```sql
-- CHANGE: Add column "phone" to table "users"
ALTER TABLE users ADD COLUMN phone VARCHAR(15) DEFAULT NULL;

-- ROLLBACK (run this to undo the change):
ALTER TABLE users DROP COLUMN phone;
```

User can copy this and run it manually, or click Run.

---

## Step 6 — Apply the Change

User clicks **"Apply Change"**.

**What happens:**
- Your backend runs the ALTER TABLE command on the real database
- Returns success or error

**What the user sees:**

```
✅ Change Applied Successfully!

Column "phone" has been added to the "users" table.

Your rollback script:
ALTER TABLE users DROP COLUMN phone;
[Copy Rollback Script]
```

Done. The user's database is safely updated.

---
---

# 🗺️ Quick Overview: Full User Journey

```
HOME PAGE
   │
   ├──→ MIGRATE DATABASE
   │         │
   │         ├── Choose direction (e.g. MongoDB → PostgreSQL)
   │         ├── Connect source DB → backend reads schema
   │         ├── Connect target DB → backend checks connection
   │         ├── AI generates field mapping → user reviews/edits
   │         ├── Risk report shown (critical, warnings, info)
   │         ├── Dry run (optional) → preview without running
   │         ├── Run migration → live progress bar
   │         └── Done → download report + rollback script
   │
   └──→ UPDATE MY DATABASE
             │
             ├── Connect DB → backend reads current schema
             ├── Describe the change (form or plain English)
             ├── AI interprets plain text → fills the form
             ├── Risk report shown
             ├── Preview the generated ALTER script + rollback
             ├── Run the change → success/failure shown
             └── Done → rollback script provided
```
