# Deep Research Report: Feature 2 — Schema Update Assistant

---

## 1. Overview & Objective

The **Schema Update Assistant** allows developers to safely modify existing database schemas (PostgreSQL and MongoDB) directly within their live environments. 

Unlike blind migration scripts or manual `ALTER` statements that frequently cause production crashes, table locks, or data loss, this system combines:
1. **Live Schema Introspection** (reading tables, types, constraints, row counts, indexes).
2. **Dual-Input Mode:** Structured visual form + Natural Language to DDL (**NL2DDL** via Google Gemini).
3. **Automated Risk Assessment Engine** (derived from PostgreSQL lock internals, *Squawk*, *strong_migrations*, and *Bytebase* policies).
4. **Deterministic Forward & Rollback Script Generation** with `lock_timeout` safety guardrails.
5. **Safe Transactional Execution**.

---

## 2. Live Database Schema Introspection

To evaluate risk and generate valid DDL, the backend introspects the connected database in real-time.

### 2.1 PostgreSQL Schema Introspection
PostgreSQL system catalogs and `information_schema` views provide full visibility:
* **Tables & Row Counts:**
  ```sql
  SELECT relname AS table_name, n_live_tup AS estimated_rows
  FROM pg_stat_user_tables;
  ```
* **Columns, Types, Defaults, & Nullability:**
  ```sql
  SELECT table_name, column_name, data_type, character_maximum_length,
         is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position;
  ```
* **Foreign Keys & Constraints:**
  Query `pg_constraint` and `information_schema.table_constraints` to map inbound and outbound foreign key dependencies.
* **Indexes:**
  Query `pg_indexes` to inspect existing single-column and composite indexes.

### 2.2 MongoDB Schema Introspection
* **Collections & Document Counts:** `db.listCollections()` + `collection.estimatedDocumentCount()`.
* **Field Sampling & Type Profiling:** Sample $N$ documents using `$sample: { size: 500 }` to extract field names, data types, and presence ratios.
* **Validation Rules:** Read `collection.options.validator` (JSON Schema validation rules if configured).
* **Indexes:** `collection.indexes()` to identify single, compound, and unique indexes.

---

## 3. Natural Language to DDL (NL2DDL) Architecture

```
User Prompt ("Add an optional phone column to users with max 15 chars")
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Context Assembler                      │
│ - Current table structure: users (id, name, email, created) │
│ - Target DB: PostgreSQL                                     │
│ - Estimated rows: 1,240                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Gemini AI Engine (NL2DDL)                   │
│ - Prompt: Strict JSON schema output                         │
│ - Extracts: operation, table, column, type, nullable, etc.  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Form Auto-Fill / Preview                    │
│ { operation: "ADD_COLUMN", table: "users",                  │
│   columnName: "phone", dataType: "VARCHAR(15)",             │
│   isNullable: true, defaultValue: null }                    │
└─────────────────────────────────────────────────────────────┘
```

* **Constrained JSON Schema:** Gemini produces a strictly typed JSON output that populates the visual form, giving the user full visibility and manual override control before any script is previewed or executed.

---

## 4. Multi-Tier Risk Assessment Matrix

The risk engine applies deterministic rules combined with AI explanations across operations:

### 4.1 PostgreSQL Risk Rules

| Operation | Scenario / Trigger | Severity | Plain English Risk Explanation | Recommended Safe Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Add Column** | `NOT NULL` on table with $>0$ rows and NO `DEFAULT` | 🔴 **CRITICAL** | PostgreSQL will reject this command immediately because existing rows cannot satisfy the `NOT NULL` constraint without a default value. | Add column as `NULL`, backfill existing rows, then alter to `NOT NULL`, or specify a `DEFAULT` value. |
| **Add Column** | Column name already exists in target table | 🔴 **CRITICAL** | A column named `{column_name}` already exists in `{table_name}`. Migration will fail with a duplicate column error. | Choose a unique column name or edit existing column. |
| **Drop Column** | Target column is referenced by a Foreign Key | 🔴 **CRITICAL** | Cannot drop column `{column_name}` because table `{ref_table}` references it via foreign key `{fk_name}`. | Drop dependent foreign key constraints first. |
| **Drop Column** | Table contains $>0$ rows | 🔴 **HIGH RISK** | ⚠️ **Irreversible Data Loss**: Dropping this column will permanently delete all stored data in `{table_name}.{column_name}`. | Verify application code no longer uses this field. Download database snapshot before applying. |
| **Change Type** | Incompatible type casting (e.g. `VARCHAR` $\rightarrow$ `INTEGER`) | 🔴 **CRITICAL** | Existing textual data may not convert into numbers, causing the query to abort or corrupt data. | Use `USING` expression with explicit casting or create new column and migrate data in batches. |
| **Change Type** | Shortening length (e.g. `VARCHAR(255)` $\rightarrow$ `VARCHAR(50)`) | 🟡 **WARNING** | If any existing row has length $>50$, the command will fail and abort the transaction. | Run a length check query first: `SELECT MAX(LENGTH(col)) FROM table;`. |
| **Create Index** | `CREATE INDEX` without `CONCURRENTLY` on table with $>1000$ rows | 🟡 **WARNING** | A standard index creation acquires a `SHARE` lock, blocking all concurrent `INSERT`, `UPDATE`, and `DELETE` queries until completed. | System automatically generates **`CREATE INDEX CONCURRENTLY`** outside a transaction block. |
| **Rename Col/Table** | Renaming column or table | 🟡 **WARNING** | Active application code and ORM models querying `{old_name}` will fail immediately upon renaming. | Follow Expand/Contract pattern: add new column, duplicate writes, update app code, drop old column. |
| **Add Foreign Key** | Adding foreign key to large table | 🟡 **WARNING** | Validating all existing rows holds an exclusive lock that can block queries on high-traffic tables. | Use `ADD CONSTRAINT ... NOT VALID;` followed by `VALIDATE CONSTRAINT;`. |

---

### 4.2 MongoDB Schema Update Safety
* **Adding Fields:** In MongoDB, adding a field to new documents is instant; adding defaults to existing documents requires `db.collection.updateMany({}, { $set: { newField: defaultVal } })`.
* **Field Renaming:** Uses `db.collection.updateMany({}, { $rename: { "oldName": "newName" } })`. System warns about application downtime during update on large collections.
* **Removing Fields:** `$unset` across all documents is irreversible and permanently deletes data.

---

## 5. Deterministic DDL & Rollback Script Engine

Every generated schema change script includes:
1. **Safety Header:** `SET lock_timeout = '5s';` (PostgreSQL)
2. **Forward Migration:** Clean, formatted DDL / Shell command.
3. **Inverse Rollback Script:** Precise compensating statement.

### Example Pairs:

#### 1. Add Column (PostgreSQL)
```sql
-- FORWARD SCRIPT
SET lock_timeout = '5s';
ALTER TABLE users ADD COLUMN phone VARCHAR(15) DEFAULT NULL;

-- ROLLBACK SCRIPT
ALTER TABLE users DROP COLUMN IF EXISTS phone;
```

#### 2. Create Index (PostgreSQL)
```sql
-- FORWARD SCRIPT (Runs outside transaction for non-blocking build)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);

-- ROLLBACK SCRIPT
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;
```

#### 3. Add Foreign Key (PostgreSQL Safe Pattern)
```sql
-- FORWARD SCRIPT
SET lock_timeout = '5s';
ALTER TABLE orders ADD CONSTRAINT fk_orders_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user_id;

-- ROLLBACK SCRIPT
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_user_id;
```

#### 4. Drop Column (PostgreSQL - Irreversible Data Warning)
```sql
-- FORWARD SCRIPT
SET lock_timeout = '5s';
ALTER TABLE users DROP COLUMN phone;

-- ROLLBACK SCRIPT (Restores schema structure ONLY; cannot restore lost data)
-- ⚠️ NOTE: Restores column structure as NULL, but historical row values cannot be recovered without a database backup!
ALTER TABLE users ADD COLUMN phone VARCHAR(15) DEFAULT NULL;
```

---

## 6. Safe Execution Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User reviews Risk Report & Generated SQL / Rollback DDL │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend connects to target database                      │
│    - Sets session lock_timeout = 5000ms                     │
│    - Starts Transaction: BEGIN; (for transactional DDL)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Executes DDL statement                                   │
│    - Success: COMMIT; -> Return success + rollback script   │
│    - Failure: ROLLBACK; -> Return friendly error diagnosis  │
└─────────────────────────────────────────────────────────────┘
```
