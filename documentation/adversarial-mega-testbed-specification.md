# MigrateIQ: Adversarial Mega-Testbed Specification & Execution Guide
## 1,046,000+ Entities (10.4 Lakh Records), 47 Tables, and 40 Enterprise Edge Cases

> **Document Type:** Production Stress-Test Benchmark & Adversarial Dataset Specification  
> **Source Database:** MongoDB `adversarial_mega_db` (`mongodb://localhost:27017/adversarial_mega_db`)  
> **Target Database:** PostgreSQL `adversarial_mega_db` (`postgresql://postgres:admin@localhost:5432/adversarial_mega_db`)  
> **Scope:** Tests the complete MigrateIQ pipeline (Phases 1 through 9A) and prepares the testbed for Phase 9B Verification Studio.

---

## 1. Executive Summary & Objective

In real-world enterprise database migrations (fintech, supply chain, healthcare, multinational conglomerates), migrations do not fail on clean, standardized, 5-column tables. They fail on **dirty data, circular relationships, 64-bit integer overflows, floating-point precision loss, multi-level array nesting, SQL reserved keyword collisions, case-folding identifier collisions, and unhandled null bytes**.

The **Adversarial Mega-Testbed** is designed to be the **most difficult database in the world to migrate**. It models a global enterprise: **`GlobalFinTechLogistics`** (a cross-border multi-tenant fintech, supply chain, and e-commerce platform).

### Key Metrics:
* **Primary Collections (MongoDB):** 31 Collections
* **Decomposed Child Tables (PostgreSQL):** 16 Child Tables
* **Total Relational Tables in Target:** **47 Tables**
* **Top-Level Documents:** ~296,000 Documents (~2.96 Lakhs)
* **Decomposed Child Rows:** ~750,000 Rows (~7.5 Lakhs)
* **Grand Total Entities to Migrate:** **~1,046,000+ Entities (10.4 Lakh Records)**
* **Edge Cases Embedded:** 40 Distinct Production Traps (EC-01 through EC-40)

---

## 2. The 30 Adversarial Edge Cases Cataloged

```
┌──────┬─────────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ CODE │ EDGE CASE NAME                                  │ WHY IT CRASHES TRADITIONAL TOOLS / HOW MIGRATEIQ WINS  │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-01│ True Circular Foreign Keys                      │ companies.ceo_id <-> executives.company_id. Kahn's DAG │
│      │                                                 │ detects cycle and safely defers FK constraint creation.│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-02│ 5-Level Self-Referencing Tree                   │ departments.parent_dept_id references own table. Tests │
│      │                                                 │ hierarchical dependency ordering without stack overflow│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-03│ Triple-Embedded Array Decomposition             │ orders_master contains items[], coupons[], and         │
│      │                                                 │ checkpoints[]. Decomposes into 3 separate child tables.│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-04│ High-Precision Decimal128 (0.0000% Drift)       │ ledger_entries.amount stored as Decimal128. Tests that │
│      │                                                 │ PostgreSQL NUMERIC(18,4) has zero floating-point drift.│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-05│ 64-Bit BigInt Overflow (>2.14B Integer limit)   │ telemetry_logs packet counters > 5,000,000,000. Prevents│
│      │                                                 │ 32-bit INTEGER overflow crashes by selecting BIGINT.   │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-06│ Polymorphic / Shape-Shifting Documents          │ polymorphic_catalog contains 4 completely disjoint     │
│      │                                                 │ schemas (electronics, apparel, chemicals, books).      │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-07│ Dirty / Mixed Types in Same Field               │ user_profiles.phone is 60% Int, 35% String, 5% Null.   │
│      │                                                 │ Tests chunk isolation and quarantine dead-letter queue.│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-08│ UTF-8 Null-Byte (\0) Poison Pills               │ customer_kyc text fields contain raw 0x00 bytes. Auto- │
│      │                                                 │ stripped to prevent fatal SQLSTATE 22021 aborts.       │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-09│ Multi-Lingual Unicode & Multi-Byte Emojis       │ Text in Hindi, Chinese, Arabic, Cyrillic, and emojis.  │
│      │                                                 │ Verifies multi-byte UTF-8 encoding integrity.          │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-10│ SQL Reserved Keyword Collisions                 │ Tables & fields named "select", "order", "table",      │
│      │                                                 │ "where", "limit". Tests automated identifier quoting.  │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-11│ 63-Byte Identifiers & 65-Field Parameter Clamping│ Table/columns >60 chars. Tests 63-byte truncation + hex │
│      │                                                 │ deduplication and PostgreSQL 65,535 parameter clamping.│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-12│ Arrays of Primitives                            │ tags[], error_codes[]. Stored as native PostgreSQL     │
│      │                                                 │ arrays or JSONB without generating empty child tables. │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-13│ Deeply Nested Hierarchies (>4 levels)           │ devices.hardware.sensor.calibration.unit. Flattens     │
│      │                                                 │ levels <=2; encapsulates levels >2 into JSONB.         │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-14│ BSON Binary Blobs (BYTEA)                       │ customer_kyc document thumbnails stored as Binary.     │
│      │                                                 │ Tests memory-bounded streaming without heap spikes.    │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-15│ Empty Arrays & Null Arrays                      │ Documents with items: [] or items: null. Tests zero-   │
│      │                                                 │ pollution guarantee (0 child records generated).       │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-16│ High-Sparsity Attributes (0.01% Occurrence)     │ Rare compliance fields in 0.05% of rows. Tests nullability│
│      │                                                 │ inference and statistical profiler sensitivity.        │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-17│ Genuinely Empty Collection (0 Docs)             │ staging_sync_buffer has 0 documents. Verifies zero-doc │
│      │                                                 │ handling without division-by-zero errors.              │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-18│ Date Heterogeneity                              │ Dates stored as Date objects, ISO strings, and Unix ms.│
│      │                                                 │ Coerced into PostgreSQL TIMESTAMPTZ with UTC epoch ms. │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-19│ Negative Financial Numbers                      │ Negative chargebacks (-$4,500.50) and temperatures.   │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-20│ High-Volume Streaming Cursor (40k logs)         │ audit_event_stream tests cursor backpressure and ETA.  │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-21│ Rule #4 sort_order Sequence Guarantee           │ All 16 child tables have sort_order 0..N-1 matching    │
│      │                                                 │ original BSON array indexing with 0 nulls.             │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-22│ Referential Foreign Key Integrity               │ 0 orphaned records across all 745,000 child records.   │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-23│ Case-Insensitive Column Collision               │ Identifiers with differing casing deduplicated cleanly.│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-24│ Soft-Deleted Document Flags                     │ Documents with is_deleted: true and deleted_at timestamps│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-25│ Multi-Tenant Schema Partitioning                │ tenant_id isolation across enterprise collections.     │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-26│ Cross-Collection Foreign Key Arrays             │ Array of ObjectIds pointing to promotions collection.  │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-27│ Leading & Trailing Whitespace Strings           │ Unsanitized user strings with spaces and tab characters│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-28│ Stringified JSON within String Fields           │ Embedded JSON strings: "{\"status\": \"active\"}".     │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-29│ PII Masking Enforcement                         │ Password hashes and tokens masked in logs as ••••••••. │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-30│ Auto-Increment Sequence Synchronization         │ Target PostgreSQL SERIAL sequences synced to MAX(id).  │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-31│ Floating-Point Sentinels (NaN, ±Infinity)       │ scientific_measurements tests IEEE 754 sentinels.      │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-32│ Unorthodox Field Identifiers                    │ unorthodox_identifiers tests hyphens, dots, leading 1st│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-33│ Heterogeneous Mixed-Type Arrays & Matrices      │ heterogeneous_matrices tests 2D arrays & mixed primitives│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-34│ Pre-1970 Dates, 15k Char Text, MinKey/MaxKey    │ historical_archives tests negative epoch & BSON sentinels│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-35│ BSON Timestamp CDC & Oplog Replication Tokens   │ oplog_cdc_events tests 64-bit BSON Timestamp (t, i).   │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-36│ 12-Level Deep Document Nesting Tree             │ deep_nested_hierarchies tests recursion & TOAST limits │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-37│ Case-Folding Identifier Collision Trap (PG)     │ case_collision_records tests customerCode vs customercode│
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-38│ BSON Regular Expressions & BSON Code Objects    │ code_and_rules tests BSONRegExp & Code object ETL.     │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-39│ Arrays with Null Elements & Empty Arrays        │ sparse_array_records tests [10, null, 25] array rules. │
├──────┼─────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ EC-40│ Boundary Epoch Dates (Leap Days, 9999, 0001)    │ extreme_temporal_events tests 2024-02-29, 9999-12-31.  │
└──────┴─────────────────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 3. The 47 Target Relational Tables Map

### 31 Top-Level Parent Tables:
1. `companies` (500 rows)
2. `executives` (2,500 rows)
3. `departments` (300 rows)
4. `ledger_entries` (40,000 rows)
5. `telemetry_logs` (30,000 rows)
6. `polymorphic_catalog` (10,000 rows)
7. `user_profiles` (20,000 rows)
8. `orders_master` (25,000 rows)
9. `customer_kyc` (8,000 rows)
10. `system_reserved_words` (3,000 rows)
11. `ultra_wide_dimensions` (3,000 rows)
12. `sparse_attributes` (15,000 rows)
13. `staging_sync_buffer` (0 rows)
14. `suppliers` (800 rows)
15. `warehouses` (150 rows)
16. `shipments` (15,000 rows)
17. `returns` (6,000 rows)
18. `reviews` (20,000 rows)
19. `support_tickets` (10,000 rows)
20. `audit_event_stream` (40,000 rows)
21. `app_promotions` (2,000 rows)
22. `scientific_measurements` (5,000 rows)
23. `unorthodox_identifiers` (4,000 rows)
24. `heterogeneous_matrices` (5,000 rows)
25. `historical_archives` (4,000 rows)
26. `oplog_cdc_events` (5,000 rows)
27. `deep_nested_hierarchies` (4,000 rows)
28. `case_collision_records` (4,000 rows)
29. `code_and_rules` (4,000 rows)
30. `sparse_array_records` (5,000 rows)
31. `extreme_temporal_events` (4,000 rows)

### 16 Decomposed Relational Child Tables:
1. `user_profiles_login_sessions` (~50,000 rows)
2. `user_profiles_linked_devices` (~30,000 rows)
3. `orders_master_items` (~120,000 rows)
4. `orders_master_discount_coupons` (~40,000 rows)
5. `orders_master_shipping_checkpoints` (~60,000 rows)
6. `customer_kyc_kyc_documents` (~15,000 rows)
7. `customer_kyc_audit_trails` (~20,000 rows)
8. `suppliers_contacts` (~2,500 rows)
9. `suppliers_certifications` (~2,000 rows)
10. `warehouses_aisles` (~1,500 rows)
11. `shipments_waypoints` (~60,000 rows)
12. `shipments_events` (~75,000 rows)
13. `returns_return_items` (~18,000 rows)
14. `reviews_votes` (~150,000 rows)
15. `reviews_feedback_tags` (~40,000 rows)
16. `support_tickets_messages` (~60,000 rows)

---

## 4. Step-by-Step Execution Guide (For You & Your Friend)

Follow these exact steps in your terminal. **No guesswork required.**

### Step 1: Provision Clean Empty PostgreSQL Database
In your terminal, run:
```bash
node scripts/setup-adversarial-postgres.js
```
*What this does:* Connects to PostgreSQL, drops any previous `adversarial_mega_db`, and creates a brand-new, 100% empty database with UTF-8 encoding. Takes ~1 second.

---

### Step 2: Seed the 1,046,000+ Entity MongoDB Database
In your terminal, run:
```bash
node scripts/seed-adversarial-mega-testbed.js
```
*What this does:* Connects to MongoDB `localhost:27017`, creates `adversarial_mega_db`, and generates ~296,000 top-level documents and ~750,000 embedded items across all 40 edge cases. Uses fast batching and takes ~60–90 seconds.

---

### Step 3: Run the Migration inside MigrateIQ Desktop App
1. Open the running MigrateIQ desktop application window.
2. Click **`[Start Migration →]`** on the Home Dashboard.
3. **Step 1:** Select **MongoDB ➔ PostgreSQL**.
4. **Step 2 (Source):** Enter `mongodb://localhost:27017/adversarial_mega_db`. Click **Test Connection**.
   * *Notice:* It detects all 31 collections and calculates the AI Schema Health Score.
5. **Step 3 (Target):** Enter `postgresql://postgres:admin@localhost:5432/adversarial_mega_db`. Click **Test Connection**.
   * *Notice:* It confirms the database is empty and verified.
6. **Step 4 (Schema Mapping):** Review the mapping.
   * *Notice:* All 16 embedded arrays are automatically mapped to child tables with foreign keys and `sort_order INTEGER NOT NULL`.
7. **Step 5 (Risk Report):** Review detected risks.
   * *Notice:* Tarjan's cycle detector flags the `companies <-> executives` circular key and defers it safely. Click **`[Apply Auto-Fixes]`** and acknowledge critical items.
8. **Step 6 (Dry Run):** Click **`[▶ Run Simulation]`**.
   * *Notice:* Simulates 500 rows per table with `BEGIN ... ROLLBACK` without mutating the database.
9. **Step 7 (Live Migration):** Click **`[Yes, Start Migration]`**.
   * *Notice:* Watch the high-throughput streaming progress bars, Kahn topological ordering, and chunk error isolation in action as ~1,046,000 entities stream into PostgreSQL!

---

### Step 4: Run the Automated 47-Table Parity Audit
Once MigrateIQ finishes Step 7, run:
```bash
node scripts/verify-adversarial-migration.js
```
*What this does:*
* Directly queries MongoDB and PostgreSQL across all 47 tables (31 parent tables + 16 child tables).
* Audits 1:1 row counts, verifies 0 orphaned foreign keys, checks sequential `sort_order`, checks financial sum precision (0.0000% drift), and verifies zero unhandled null bytes.
* Prints an official verification certificate in your terminal!
