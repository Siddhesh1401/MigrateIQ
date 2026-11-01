# Phase 12: PostgreSQL → MongoDB Reverse Direction (Workflow B)
## Reverse Introspection, 1:N Denormalization Heuristics, Reverse ETL Streaming, and Bidirectional Verification Parity

> **Phase:** 12 (Workflow B: PostgreSQL → MongoDB)  
> **Source Specifications:** [`phase_plan-v2.md` Lines 881–925](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/phase_plan-v2.md#L881-L925) | [`product_blueprint-v7.md` Lines 1298–1327](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/product_blueprint-v7.md#L1298-L1327) | [Blueprint Challenge 13 Line 1954](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/product_blueprint-v7.md#L1954)  
> **Status:** ✅ Completed, Verified & Documented  

---

## 1. Phase Summary & Goal

Phase 12 delivers **Workflow B: PostgreSQL → MongoDB Reverse Migration**, enabling complete bi-directional database migration capability in MigrateIQ. When PostgreSQL is selected as the source and MongoDB as the target, the application transitions seamlessly from relational normalization to document-oriented denormalization:

1. **PostgreSQL Foreign Key Introspection:** Enhanced the PostgreSQL connection and introspection engine to query `information_schema.table_constraints`, `key_column_usage`, and `constraint_column_usage` to extract all foreign key relationships (constraint name, source table, source column, target table, target column).
2. **Reverse Rule Engine & Denormalization Heuristics:** Automated 1:N relation detection. When a dependent child table references a parent table (e.g. `order_items` referencing `orders`), the rule engine marks the child table with `isEmbeddedChild: true`, assigns the parent table, infers a clean embedded array field name (e.g. `items`), and links the child table to the parent's mapping. Independent domain entities (`orders`, `products`, `customers`, `categories`, `users`, `payments`, `reviews`) are preserved as top-level root collections.
3. **Reverse Mapper UI (Embed vs Separate Collection):** In the Schema Mapper screen (`SchemaMapper.tsx`), when `direction === 'postgres-to-mongo'`, each collection displays a mapping mode selector allowing the user to toggle between `Embed as Array (Parent)` and `Separate Collection`, as well as customize the target embedded array property name.
4. **Streaming Reverse ETL Engine:** Developed `reverseEtlEngine.ts` inside Electron's Main Process. The engine reads root tables in paginated batches (`SELECT * FROM ... ORDER BY 1 LIMIT $1 OFFSET $2`), fetches child rows matching the parent IDs via parameterized array queries (`WHERE fk = ANY($1)`), converts SQL data types to BSON types (integers, doubles, ISO dates, booleans, and JSONB objects), builds nested document trees, and bulk inserts them into MongoDB using `insertMany({ ordered: false })`.
5. **Bidirectional Data Parity & Verification Engine (Step 8):** Fully upgraded `verificationEngine.ts` to support reverse direction auditing. Queries PostgreSQL tables as source and MongoDB collections/embedded arrays as target. Embedded child tables are audited against parent documents via MongoDB `$size` and `$unwind` aggregations. Excluded non-financial surrogate foreign keys from numeric sum checks to guarantee bit-perfect financial proofs ($0.00\%$ drift).
6. **Collection-Level Rollback Engine:** Tracks all MongoDB collections created during reverse migration and generates an automated rollback script (`db.getCollection("...").drop()`). The `migration:execute-rollback` handler was upgraded to support MongoDB target rollbacks safely.

---

## 2. Files Created & Modified

### Modified Files:
- [`packages/shared/src/types.ts`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/packages/shared/src/types.ts): Added `PostgresForeignKeyInfo` interface, updated `PostgresIntrospectionResult` with `foreignKeys?: PostgresForeignKeyInfo[]`, and updated `CollectionMapping` with reverse embedding contracts (`isEmbeddedChild`, `parentTable`, `foreignKeyColumn`, `parentKeyColumn`, `embeddedFieldName`, `embeddingType`).
- [`apps/desktop/main/handlers/db.ts`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/main/handlers/db.ts): Updated `db:connect-postgresql` IPC handler to query `information_schema` for foreign keys in the target schema.
- [`apps/desktop/main/engine/ruleEngine.ts`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/main/engine/ruleEngine.ts): Added denormalization suggestion heuristics to `generateMappingByRules` when `direction === 'postgres-to-mongo'`, with domain entity protection to keep primary tables top-level.
- [`apps/desktop/main/engine/verificationEngine.ts`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/main/engine/verificationEngine.ts): Implemented `resolveDbConfigs()` routing across all 7 verification services, embedded array document counting via MongoDB aggregation, and hardened financial sum proofs.
- [`apps/desktop/main/handlers/migration.ts`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/main/handlers/migration.ts): Added Workflow B routing in `migration:start` to execute `executeReverseMigration()`, set crash-recovery checkpoints, persist reverse rollback scripts, and extended `migration:execute-rollback` to execute MongoDB collection drops.
- [`apps/desktop/renderer/src/screens/MigrationWizard.tsx`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/renderer/src/screens/MigrationWizard.tsx): Updated `convertPostgresTableToSourceSchema` to map foreign key relationships into `FieldDefinition.foreignKeyToParent`.
- [`apps/desktop/renderer/src/screens/MigrationProgressScreen.tsx`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/renderer/src/screens/MigrationProgressScreen.tsx): Dynamic telemetry banners and table statistics adjusting column headers and metrics (`Source Rows`, `Target Docs`) for Workflow B.
- [`apps/desktop/renderer/src/screens/SchemaMapper.tsx`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/renderer/src/screens/SchemaMapper.tsx): Added embedding mode dropdown (`Embed as Array` vs `Separate Collection`), embedded field name input, and visual badges in collection headers for Workflow B.
- [`apps/desktop/renderer/src/components/verification/ReconciliationOverview.tsx`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/renderer/src/components/verification/ReconciliationOverview.tsx): Dynamic volumetric audit table with `TARGET COLLECTION`, `SOURCE (POSTGRES)`, and `TARGET (MONGO)` headers.

### Created Files:
- [`apps/desktop/main/engine/reverseEtlEngine.ts`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/apps/desktop/main/engine/reverseEtlEngine.ts): Core reverse ETL streaming migration engine reading PostgreSQL rows in batches, resolving embedded child rows via parameterized `ANY($1)` queries, mapping to BSON, and bulk-inserting into MongoDB.
- [`scripts/seed-workflow-b-mega.js`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/scripts/seed-workflow-b-mega.js): Generates 3,550 relational records across 8 tables with foreign keys in PostgreSQL (`workflow_b_pg`) and cleans the target MongoDB database (`workflow_b_mongo`).
- [`scripts/test-workflow-b-e2e.js`](file:///c:/Users/SIDDHESH/Desktop/Int_DB_Migration/scripts/test-workflow-b-e2e.js): End-to-end test validating the complete 9-step pipeline (introspection, mapping, ETL, and Step 8 data parity verification).

---

## 3. Architecture & Key Implementation Details

### 3.1 Data Flow: PostgreSQL to MongoDB Reverse Migration

```mermaid
flowchart TD
    subgraph PostgreSQL ["PostgreSQL (Source Database)"]
        T1["orders (Parent Table)"]
        T2["order_items (Child Table with FK)"]
    end

    subgraph Introspection ["Introspection & Rule Engine"]
        FK["information_schema Introspection\n(source_table, fk_column, target_table)"]
        Rules["Denormalization Suggestion Engine\n(1:N Detection -> Embed as Array)"]
    end

    subgraph UI ["Schema Mapper (Workflow B)"]
        Mapper["SchemaMapper.tsx\n[Embed as Array | Separate Collection]\nEmbedded Field: 'items'"]
    end

    subgraph ReverseETL ["Reverse ETL Engine (reverseEtlEngine.ts)"]
        Batch["Batch Parent Rows (LIMIT $1 OFFSET $2)"]
        ChildFetch["Batch Child Rows (WHERE fk = ANY($1))"]
        BsonConvert["SQL to BSON Type Conversion\n(NUMERIC -> number, TIMESTAMPTZ -> Date)"]
        Tree["Assemble Nested Document Tree\norders.items = [ { ... }, { ... } ]"]
    end

    subgraph MongoDB ["MongoDB (Target Database)"]
        MColl["Collection: orders\nDocument: { order_number, total_amount, items: [...] }"]
    end

    subgraph VerificationEngine ["Step 8: Verification Engine (verificationEngine.ts)"]
        Volumetric["Volumetric Aggregation\n($project size of $items)"]
        Financial["Financial Proofs\n(COALESCE(SUM(total_amount), 0) vs $sum total_amount)"]
    end

    T1 --> FK
    T2 --> FK
    FK --> Rules
    Rules --> Mapper
    Mapper --> ReverseETL
    T1 --> Batch
    Batch --> ChildFetch
    T2 --> ChildFetch
    ChildFetch --> BsonConvert
    BsonConvert --> Tree
    Tree -->|insertMany| MColl
    MColl --> VerificationEngine
    T1 --> VerificationEngine
```

### 3.2 SQL Parameterization & Memory Safety
- **Cursor/Batch Streaming:** Queries root parent tables with parameterized `LIMIT $1 OFFSET $2` queries, preventing Node.js process out-of-memory errors on large datasets.
- **Child Row Resolution:** Instead of $N$ queries for $N$ parent rows ($N+1$ query hazard), the engine collects all parent IDs in the current batch and issues a single parameterized query with PostgreSQL's array operator:
  ```sql
  SELECT * FROM "order_items" WHERE "order_id" = ANY($1) ORDER BY 1;
  ```
- **Type Conversions:** Numeric/Decimal SQL values are parsed to standard numbers (or Mongo Decimals), date/timestamps are parsed into native JavaScript `Date` objects, and JSON/JSONB strings are safely parsed into objects before inserting.

---

## 4. Verification & Test Results

Executed `node scripts/test-workflow-b-e2e.js` against PostgreSQL (`workflow_b_pg`) and MongoDB (`workflow_b_mongo`):

```
1. Introspecting PostgreSQL source tables and foreign keys...
2. Generating mapping using Rule Engine (direction: postgres-to-mongo)...

Generated Mappings:
  📁 [ROOT COLLECTION] categories -> target collection: categories
  📦 [EMBEDDED CHILD] customer_addresses -> embedded in customers.addresses[]
  📁 [ROOT COLLECTION] customers -> target collection: customers
  📦 [EMBEDDED CHILD] order_items -> embedded in orders.items[]
  📁 [ROOT COLLECTION] orders -> target collection: orders
  📁 [ROOT COLLECTION] payments -> target collection: payments
  📁 [ROOT COLLECTION] products -> target collection: products
  📁 [ROOT COLLECTION] reviews -> target collection: reviews

3. Resetting MongoDB target database...
4. Executing Reverse ETL Migration...
   ✓ Migration finished! Success: true, Total root docs migrated: 1725

5. Running Data Parity & Reconciliation Audit (Step 8)...
   Readiness Score: 100/100 (PRODUCTION_READY)
   Breakdown: {
     "volumetricScore": 100,
     "financialScore": 100,
     "referentialScore": 100,
     "statisticalScore": 100,
     "latencyScore": 100
   }

Volumetric Parity Table:
┌─────────┬──────────────────────┬──────────────────────┬────────┬────────┬───────┬───────┐
│ (index) │ table                │ type                 │ source │ target │ delta │ match │
├─────────┼──────────────────────┼──────────────────────┼────────┼────────┼───────┼───────┤
│ 0       │ 'categories'         │ 'primary_collection' │ 25     │ 25     │ 0     │ true  │
│ 1       │ 'customer_addresses' │ 'child_table'        │ 600    │ 600    │ 0     │ true  │
│ 2       │ 'customers'          │ 'primary_collection' │ 500    │ 500    │ 0     │ true  │
│ 3       │ 'order_items'        │ 'child_table'        │ 1225   │ 1225   │ 0     │ true  │
│ 4       │ 'orders'             │ 'primary_collection' │ 350    │ 350    │ 0     │ true  │
│ 5       │ 'payments'           │ 'primary_collection' │ 350    │ 350    │ 0     │ true  │
│ 6       │ 'products'           │ 'primary_collection' │ 200    │ 200    │ 0     │ true  │
│ 7       │ 'reviews'            │ 'primary_collection' │ 300    │ 300    │ 0     │ true  │
└─────────┴──────────────────────┴──────────────────────┴────────┴────────┴───────┴───────┘

🎉 ALL TABLES BIT-PERFECT MATCH: true
```

### Full Regression Suite Results:
- `npm run typecheck --workspace=@migrateiq/desktop`: **0 errors**.
- `npm run build:main --workspace=@migrateiq/desktop`: **0 errors**.

---

## 5. Edge Cases & FYP Report Notes

1. **Denormalization vs 1NF Relational Separation:** In relational databases, storing repeating groups violates First Normal Form (1NF). However, in document databases like MongoDB, embedding related subdocuments (e.g. order line items) eliminates expensive application-side joins and provides atomic ACID document updates.
2. **Surrogate Foreign Key Stripping in Embedded Docs:** When embedding 1:N relational child records into MongoDB parent arrays, redundant foreign keys (`order_id`, `customer_id`) are stripped to prevent document bloating and schema pollution. The verification engine excludes these stripped columns from sum checks to eliminate false-positive financial drift.
3. **N+1 Avoidance via Vectorized SQL:** Child items for an entire batch of parent rows are fetched in a single round-trip using PostgreSQL's native `ANY($1)` array parameter, avoiding thousands of round-trips.
4. **Bi-directional Rollback Parity:** While Workflow A rollback executes transaction-wrapped `DROP TABLE IF EXISTS "..." CASCADE;`, Workflow B rollback cleanly invokes `db.getCollection("...").drop()` across all target collections created during the ETL run.

---

## 6. Next Phase Handoff

- **Direction Parity:** MigrateIQ now officially supports **Workflow A (MongoDB → PostgreSQL)**, **Workflow B (PostgreSQL → MongoDB)**, and **Workflow C (Schema Update Assistant with Multi-Model AI Routing)**.
- **State Integrity:** All store states, crash-recovery checkpoints, IPC channels, and verification suites are fully synchronized and production-ready.
