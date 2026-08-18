# Deep Research Report: Intelligent Database Migration & Schema Evolution

---

## 1. Executive Summary & Research Scope

Database migration between heterogeneous data paradigms—specifically **Document-Oriented NoSQL (MongoDB)** and **Relational ACID (PostgreSQL)**—is one of the most critical and high-risk challenges in modern software engineering. While relational models prioritize strict integrity, normalization, and relational calculus, document models prioritize horizontal scalability, schema flexibility, and aggregate-oriented domain modeling.

This research report synthesizes findings from **academic literature, recent peer-reviewed papers (2022–2026), database internals, enterprise engineering blogs (GitLab, GitHub, Stripe, Bytebase), and AI schema matching frameworks (LLMatch, SchemaNet)** to establish the theoretical and practical foundation for building the **Intelligent Database Migration Planner**.

---

## 2. Academic Literature & Theoretical Foundations

### 2.1 Schema Inference & Structural Variance in NoSQL
Because MongoDB is schema-flexible (*schema-on-read*), different documents in the same collection may have disparate fields, divergent data types (type polymorphism), or missing keys.

* **Key Literature:**
  * *Klettke et al. (2015)*: *"Schema Extraction and Structural Outlier Detection for JSON-based NoSQL Data Stores"* — Introduced algorithms to compute the structural union of JSON documents and detect schema variance / outliers using structural frequency metrics.
  * *Frozza et al. (2018) & Baazizi et al. (2019)*: Parametric schema inference algorithms that construct a minimal common supertype schema for heterogeneous JSON document collections.
  * *Belefqih et al. (2024)*: *"Schema Extraction in NoSQL Databases: A Systematic Literature Review"* & *"Semantic Schema Extraction in NoSQL Databases using BERT/LLM Embeddings"*.

* **Practical Implementation Strategy:**
  1. **Stratified Sampling:** Sample either the first $N$ documents ($N \approx 500-1000$) or use `$sample` aggregation to capture schema diversity.
  2. **Type Disambiguation Matrix:** If a field has mixed types across documents (e.g., $95\%$ `string`, $5\%$ `number`), infer the most general type (or flag a 🟡 **Warning** and suggest `TEXT` or `JSONB`).
  3. **Nullability & Sparsity Calculation:** Compute field presence ratio:
     $$\text{Presence Ratio} = \frac{\text{Count of documents where field exists and is not null}}{\text{Total documents sampled}}$$
     If $\text{Presence Ratio} < 1.0$, the PostgreSQL column MUST default to `NULL` (cannot be `NOT NULL` without a default value).

---

### 2.2 Schema Transformation Algorithms: MongoDB ↔ PostgreSQL

#### A. MongoDB $\rightarrow$ PostgreSQL (Normalization vs. Hybrid JSONB)
* **Academic Reference:** *Karnitis & Arnicans (2015)*, *Rel2Doc / Doc2Rel frameworks*.
* **Transformation Patterns:**
  1. **Flat Primitive Fields:** Direct 1:1 mapping (e.g., `String` $\rightarrow$ `VARCHAR/TEXT`, `Number` $\rightarrow$ `INTEGER/DECIMAL/BIGINT`, `Boolean` $\rightarrow$ `BOOLEAN`, `Date` $\rightarrow$ `TIMESTAMPTZ`).
  2. **Nested Objects (1:1 Embedded Entities):**
     * *Strategy A (Flattening):* Convert `address: { city, pincode }` into columns `address_city`, `address_pincode`.
     * *Strategy B (PostgreSQL JSONB):* Retain complex unstructured nesting inside a `JSONB` column with GIN indexing.
  3. **Embedded Arrays of Objects (1:N Sub-entities):**
     * Example: `orders` collection containing `items: [{ productId, qty, price }]`.
     * *Relational Normalization:* Extract into a separate table `order_items` with a foreign key `order_id` referencing `orders.id`.
  4. **Arrays of Primitives:**
     * Map to native PostgreSQL arrays (`TEXT[]`, `INT[]`) or `JSONB`.
  5. **Identifier Mapping:**
     * Convert MongoDB `_id` (`ObjectId`, 12-byte hex) to PostgreSQL `VARCHAR(24)` or `UUID` (if valid UUID hex), or generate auto-incrementing `BIGSERIAL`/`IDENTITY` primary keys while retaining legacy IDs as indexed columns.

#### B. PostgreSQL $\rightarrow$ MongoDB (Selective Denormalization)
* **Academic Reference:** *Graph Transformation with Selective Denormalization (GTSD)*.
* **Transformation Patterns:**
  1. **1:1 Relationships & Strong Composition (Parent-Child):** Embed child table as a nested document within the parent collection.
  2. **1:N Relationships (bounded size, e.g. Order Items):** Embed as an array of subdocuments.
  3. **1:N Relationships (unbounded size, e.g. User Logs, Comments):** Use referencing (Foreign Key / ObjectId reference) to prevent MongoDB 16MB BSON document limit violations.
  4. **M:N Relationships (Junction Tables):** Embed array of IDs or dual-referencing depending on query access patterns.

---

### 2.3 LLM-Assisted Schema Matching & Prompt Engineering
Recent 2024–2025 research (*LLMatch, Schema Matching with LLMs, Matchmaker*) shows that general-purpose LLMs excel at understanding business semantics and abbreviations that rigid rule engines miss (e.g., matching `cust_addr_ln1` $\leftrightarrow$ `customer_street_address`).

* **3-Stage LLM Mapping Pipeline:**
  1. **Schema Context Preparation:** Extract structural metadata (field name, sampled types, presence ratio, sample values).
  2. **Constrained JSON Generation:** Enforce strict JSON schema output from Gemini (e.g., mapping source collection/fields to target table/columns with explicit SQL types and transformation rules).
  3. **Deterministic Post-Validation:** Run rule-based validators on the LLM output to ensure SQL syntax validity, type safety, and constraint legality.

---

## 3. Database Internals & Safety Rules (PostgreSQL & MongoDB)

### 3.1 PostgreSQL DDL Lock Hazards & Zero-Downtime Rules
In PostgreSQL, many `ALTER TABLE` commands acquire an **`ACCESS EXCLUSIVE` lock**, which blocks all concurrent reads and writes (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). If a long query is running, the `ALTER` queues up, blocking all incoming application traffic and exhausting connection pools.

* **Industry Safety Matrix for Schema Updates:**

| Operation | Lock Level Acquired | Risk Level | Safe Zero-Downtime Pattern |
| :--- | :--- | :--- | :--- |
| `ADD COLUMN (NULL)` | `ACCESS EXCLUSIVE` (brief metadata update) | 🟢 Low | Safe. |
| `ADD COLUMN (NOT NULL without DEFAULT)` | Fails if table has existing rows | 🔴 Critical | Add as `NULL`, backfill rows, then set `NOT NULL` with constraint. |
| `ADD COLUMN (with DEFAULT)` | PostgreSQL 11+ is metadata-only (fast); older versions rewrite table | 🟡 Medium | In Postgres 11+, constant defaults are safe. |
| `DROP COLUMN` | `ACCESS EXCLUSIVE` | 🔴 High | Breaking change. Application must be updated first (Expand/Contract). |
| `CHANGE DATA TYPE` | `ACCESS EXCLUSIVE` (Full table rewrite + validation) | 🔴 Critical | Add new column, dual-write/backfill, swap columns. |
| `CREATE INDEX` | `SHARE` (blocks all writes) | 🔴 High | Always use **`CREATE INDEX CONCURRENTLY`** (cannot run in transaction). |
| `ADD CONSTRAINT (FOREIGN KEY / CHECK)` | `ACCESS EXCLUSIVE` (table scan validation) | 🟡 Medium | Use `ADD CONSTRAINT ... NOT VALID;` followed by `VALIDATE CONSTRAINT;`. |
| `RENAME COLUMN / TABLE` | `ACCESS EXCLUSIVE` | 🔴 High | Breaks running application queries immediately. Requires aliased views or code deployment synchronization. |

* **Mandatory Safety Defaults:**
  * Prepend `SET lock_timeout = '5s';` to all generated scripts to prevent cascading connection pool exhaustion.
  * Wrap compatible DDLs inside `BEGIN ... COMMIT;` blocks (PostgreSQL supports transactional DDL).

---

## 4. Architecture of Core System Components

```
┌────────────────────────────────────────────────────────────────────────┐
│                   INTELLIGENT MIGRATION ARCHITECTURE                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌─────────────────────┐             ┌────────────────────────────┐   │
│   │   MongoDB Source    │             │   PostgreSQL Target        │   │
│   │  (Sampling & Types) │             │ (Introspection & Catalogs) │   │
│   └──────────┬──────────┘             └─────────────┬──────────────┘   │
│              │                                      │                  │
│              ▼                                      ▼                  │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │           Unified Intermediate Schema Representation           │   │
│   │              (Collections, Fields, Variance, Stats)            │   │
│   └──────────────────────────────┬─────────────────────────────────┘   │
│                                  │                                     │
│             ┌────────────────────┴────────────────────┐                │
│             ▼                                         ▼                │
│   ┌─────────────────────┐                   ┌──────────────────────┐   │
│   │ Deterministic Rule  │                   │ Gemini AI Engine     │   │
│   │   Engine (AST)      │                   │ (Semantic Mapping    │   │
│   │ (Constraints/Types) │                   │ & Risk Reasoning)    │   │
│   └─────────┬───────────┘                   └──────────┬───────────┘   │
│             │                                          │               │
│             └────────────────────┬─────────────────────┘               │
│                                  ▼                                     │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │     Risk Analyzer (🔴 Critical / 🟡 Warning / ℹ️ Info)          │   │
│   ├────────────────────────────────────────────────────────────────┤   │
│   │     Migration Plan Generator + Rollback Generator (Reversible) │   │
│   ├────────────────────────────────────────────────────────────────┤   │
│   │     Dry Run Simulator (Simulated Streaming & Conflict Checks)  │   │
│   ├────────────────────────────────────────────────────────────────┤   │
│   │     Execution Engine (Batch Chunking, ETL Stream, Progress)    │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Dry-Run & Rollback Engineering

### 5.1 Dry Run Simulation Mechanics
A reliable dry run must simulate without risking production corruption:
1. **Schema DDL Simulation:** Test DDL inside a PostgreSQL transaction that is automatically rolled back (`BEGIN; [DDL]; ROLLBACK;`). This validates syntax, type conflicts, and foreign key references without persisting changes.
2. **Data Transformation & Row Validation:** Stream a sample batch ($100-500$ documents/rows) through the transformation logic in memory:
   * Count documents that pass conversion cleanly.
   * Count documents that fail type conversion, exceed string length limits, or contain null values for required columns.
3. **Collision & Conflict Detection:** Check if destination table/collection already exists or contains colliding primary keys.

### 5.2 Deterministic Rollback Script Generation
Every forward migration step must generate an explicit inverse operation:

| Forward Action | Rollback Action | Risk / Data Preservation Note |
| :--- | :--- | :--- |
| `CREATE TABLE foo (...)` | `DROP TABLE IF EXISTS foo CASCADE;` | Cleanly reversible if created by migration. |
| `ALTER TABLE t ADD COLUMN c T` | `ALTER TABLE t DROP COLUMN IF EXISTS c;` | Fully reversible. |
| `ALTER TABLE t DROP COLUMN c` | `ALTER TABLE t ADD COLUMN c T;` | ⚠️ **IRREVERSIBLE DATA LOSS**: Column data cannot be restored from DDL alone (requires snapshot/backup). System must warn user! |
| `ALTER TABLE t ALTER COLUMN c TYPE T2` | `ALTER TABLE t ALTER COLUMN c TYPE T1;` | May fail if new values cannot cast back to old type. |
| `INSERT INTO table (Batch)` | `DELETE FROM table WHERE id IN (...);` | Rollback deletes newly inserted rows. |

---

## 6. Key Research Takeaways for Implementation

1. **Hybrid Architecture is King:** Provide clean relational normalization for standard arrays/objects, but offer `JSONB` as a safe fallback option when schemas are highly irregular.
2. **Dual-Layer Intelligence (Rules + AI):**
   * *Rule Engine:* Handles rigid constraints, SQL syntax, data type bounds, connection pooling, and transactional execution.
   * *Gemini AI:* Handles semantic mapping, column name normalization (`camelCase` $\leftrightarrow$ `snake_case`), relationship inference from unstructured fields, and human-readable risk explanations.
3. **Safety First:** Always output lock timeouts, transaction wrappers, dry-run previews, and explicit rollback scripts.
