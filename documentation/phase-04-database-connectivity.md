# Phase 4: Database Connectivity (Steps 1–3)

## Phase Summary & Goal

Phase 4 implements the core database connectivity infrastructure for MigrateIQ. It introduces:
- **Backend IPC handlers** for MongoDB and PostgreSQL connections with schema introspection
- **3 wizard steps** (Direction selection, Source connection, Target connection) with validation and error handling
- **Zustand state management** for wizard state persistence across steps
- **Plain-English error guidance** for common network/permission issues (SRV errors, Supabase/Neon pooler detection)
- **Light theme UI** with step progress indicators, connection forms, and schema previews

This phase spans Phase Plan v2 (4.1–4.7) and Product Blueprint v7 (Steps 1–3, ~482–745).

---

## Files Created & Modified

### Created Files

| File Path | Purpose |
|-----------|---------|
| `apps/desktop/renderer/src/store/wizardStore.ts` | Zustand store for wizard state (direction, configs, schema, step number) |
| `apps/desktop/main/handlers/db.ts` | IPC handlers for MongoDB & PostgreSQL connections, schema introspection, permission checks |
| `apps/desktop/renderer/src/components/StepProgressBar.tsx` | Visual progress indicator (8 dots, current step highlighted) |
| `apps/desktop/renderer/src/components/ConnectionForm.tsx` | Reusable connection form with two tabs (string \| individual fields), password toggle, save checkbox |
| `apps/desktop/renderer/src/screens/MigrationWizard.tsx` | Main wizard component (Steps 1–3 rendered conditionally based on state) |
| `apps/desktop/renderer/src/styles/wizard.css` | Styling for wizard (cards, buttons, direction selector, error/success states, responsive design) |
| `apps/desktop/renderer/src/global.d.ts` | TypeScript declarations for `window.electronAPI` interface |

### Modified Files

| File Path | Change |
|-----------|--------|
| `packages/shared/src/types.ts` | Added `PostgresTableInfo`, `PostgresIndexInfo`, `Layer2Summary`, and `PostgresIntrospectionResult` types |
| `apps/desktop/main/main.ts` | Added import of `setupDatabaseHandlers()` and call on `app.whenReady()` to register IPC handlers |
| `apps/desktop/renderer/src/screens/MigrationWizard.tsx` | Enhanced with bidirectional connection routing for both MongoDB and PostgreSQL source/target modes |
| `apps/desktop/renderer/src/App.tsx` | (No changes — route `/migrate` already mapped to `MigrationWizard` component) |
| `apps/desktop/package.json` | (No changes — dependencies already installed: `mongodb`, `pg`, `zustand`) |

---

## Architecture & Key Implementation Details

### 1. Zustand State Store (`wizardStore.ts`)

**State Shape:**
```typescript
{
  direction: 'mongodb-to-postgres' | 'postgres-to-mongo' | null,
  sourceConfig: ConnectionConfig | null,
  sourceSchema: SourceSchema[] | null,
  targetConfig: ConnectionConfig | null,
  layer2Features: Layer2Features | null,
  wizardStep: 1-8,
  isDemoMode: boolean,
}
```

**Key Actions:**
- `setDirection()` → Auto-advances step to 2
- `setSourceConfig()` → Stores source DB connection details
- `setSourceSchema()` → Stores introspected schema (collections/fields)
- `setTargetConfig()` → Stores target DB connection, auto-advances step to 4
- `setWizardStep()` → Manual step advancement
- `reset()` → Resets all state to initial values

**Future Integration:** Will auto-save to `electron-store` for session recovery (Phase 5).

---

### 2. IPC Handlers (`main/handlers/db.ts`)

#### MongoDB Handler: `db:connect-mongodb`

**Input:** `ConnectionConfig` (connectionString OR individual fields)

**Output:** `IPCResponse<SourceSchema[]>`

**Algorithm:**
1. Parse/build connection string
2. Connect to MongoDB with 5-second timeout
3. List all collections via `db.listCollections()`
4. For each collection:
   - Count total documents
   - Sample first 100 documents
   - Infer field types (bool, int, double, string, object, array, date, etc.) from samples
   - Mark field as nullable if any sample is null
5. Return array of `SourceSchema` objects

**Error Handling:**
- **SRV Error Detection:** `error.includes('SRV')` or `ENOTFOUND` → Returns plain-English guidance about corporate networks + mongodb+srv fallback
- **Generic Error:** Returns wrapped error message

**Example Response (Success):**
```json
{
  "success": true,
  "data": [
    {
      "collectionName": "users",
      "documentCount": 5000,
      "fields": [
        { "name": "_id", "bsonType": "ObjectId", "isNullable": false, "isArray": false },
        { "name": "email", "bsonType": "string", "isNullable": false, "isArray": false },
        { "name": "tags", "bsonType": "array", "isNullable": true, "isArray": true }
      ]
    }
  ]
}
```

---

#### PostgreSQL Handler: `db:connect-postgresql`

**Input:** `ConnectionConfig` (connectionString OR individual fields)

**Output:** `IPCResponse<PostgresIntrospectionResult>`

**Algorithm:**
1. Parse/build connection string (supports direct connection strings from Supabase/Neon/Render/AWS RDS or individual host/port/user/password fields)
2. Connect to PostgreSQL with 5-second connection timeout (`connectionTimeoutMillis: 5000`)
3. **Permission Check:**
   - Query `has_schema_privilege(current_user, 'public', 'CREATE')`
   - If missing: Return error with exact `GRANT CREATE ON SCHEMA public TO user;` SQL
4. **Schema Introspection:**
   - Query `information_schema.columns` to list tables and column types
   - Query `pg_indexes` for all indexes
5. **Layer 2 Features (PostgreSQL-specific):**
   - Count stored functions, procedures, triggers, views, check constraints, enum types
6. Return schema + indexes + layer2 counts

**Error Handling:**
- **SRV/ENOTFOUND:** Not applicable to PostgreSQL
- **Supabase/Neon Pooler Detection:** If error contains "pooler" OR domain matches `db.supabase.co` or `*.neon.tech` → Return guidance about Direct URL
- **Permission Missing:** Returns exact GRANT SQL
- **Generic Error:** Wrapped error message

**Example Response (Success):**
```json
{
  "success": true,
  "data": {
    "tables": [
      { "table_name": "users", "columns": ["id", "email", "created_at"], "column_types": ["bigint", "text", "timestamp"] }
    ],
    "indexes": [
      { "tablename": "users", "indexname": "users_pkey", "indexdef": "CREATE UNIQUE INDEX users_pkey..." }
    ],
    "layer2Features": {
      "functions": 12,
      "procedures": 3,
      "triggers": 5,
      "views": 8,
      "checkConstraints": 4,
      "enums": 2
    }
  }
}
```

---

### 3. React Components

#### StepProgressBar (`StepProgressBar.tsx`)

- Visual representation of wizard progress (8 dots)
- Current step highlighted in blue (`#2563EB`)
- Completed steps show blue line connectors
- Fully responsive (mobile, tablet, desktop)

#### ConnectionForm (`ConnectionForm.tsx`)

**Props:**
- `dbType: 'mongodb' | 'postgresql'`
- `isLoading?: boolean`
- `onConnect: (config) => Promise<void>`
- `onSave?: (name, config) => void`

**Features:**
1. **Tab 1 — Connection String:**
   - Single text input with eye toggle for password visibility
   - Placeholder shows example connection string
   - DB-specific note (MongoDB Atlas support, Supabase/Neon support)

2. **Tab 2 — Individual Fields:**
   - Host, Port, Username, Password, Database Name inputs
   - Pre-filled with sensible defaults (localhost, 27017/5432)

3. **Save Connection:**
   - Checkbox to enable saving for future use
   - Name input appears on check

4. **Connect Button:**
   - Disabled while loading
   - Shows "Connecting…" text during loading
   - Calls `onConnect()` with built `ConnectionConfig`

#### MigrationWizard (`MigrationWizard.tsx`)

**Step 1 — Direction Selection:**
- Two clickable cards (MongoDB→PostgreSQL | PostgreSQL→MongoDB)
- Selected card highlighted with blue border + hover shadow
- Next button only enabled after selection
- Calls `wizardStore.setDirection()` → auto-advances to Step 2

**Step 2 — Source Connection (MongoDB/PostgreSQL):**
- Sub-heading shows source DB type
- ConnectionForm component (full UI)
- Loading state shows spinner
- Error state: Red card with exact error message (includes SRV/pooler guidance)
- Success state: Green card with collection count + schema preview
- Schema preview: Collapsible list of collections with document counts and field info
- Next button disabled until schema loaded
- Back button always available

**Step 3 — Target Connection (PostgreSQL/MongoDB):**
- Mirror of Step 2 UI
- Sub-heading shows target DB type
- Error/success states identical to Step 2
- Next button disabled until connected
- Back button available

**Steps 4+:**
- Placeholder message (future phases)
- Back button available

---

### 4. CSS Styling (`wizard.css`)

**Light Theme Colors:**
- Canvas: `#F8FAFC` (Slate-50)
- Surface/Card: `#FFFFFF` (Pure White)
- Sidebar/Header: `#F1F5F9` (Slate-100)
- Border: `#E2E8F0` (Slate-200)
- Primary Text: `#0F172A` (Deep Navy Slate)
- Muted Text: `#64748B` (Slate-500)
- Primary Brand: `#2563EB` (Royal Tech Blue)
- Success: `#16A34A` (Green)
- Error: `#DC2626` (Crimson)

**Key Styles:**
- Direction cards: Grid layout, 2 columns (responsive), hover lift + shadow, blue border on select
- Error/success cards: Red/green backgrounds with icon + text, good contrast
- Schema preview: Monospace font, scrollable list, subtle background
- Buttons: Primary (blue) + Secondary (light gray), hover states, disabled states
- Progress bar: 8 circles with connecting lines, smooth transitions
- Responsive breakpoints: 768px (tablet), 480px (mobile)

---

## Verification & Test Results

### Done Checklist (From Phase Plan 4 & Product Blueprint Steps 1–3)

✅ **Backend Infrastructure:**
- [x] MongoDB connection handler returns schema or error
- [x] PostgreSQL connection handler returns schema + Layer 2 features + permission check
- [x] SRV error detection with plain-English guidance
- [x] Supabase/Neon/Railway/Render proactive cloud pooler detection (before connection attempt)
- [x] `isCloudPooler` + `cloudProvider` fields returned in `PostgresIntrospectionResult`
- [x] Permission check returns exact GRANT SQL if needed
- [x] All IPC handlers follow `{ success, data?, error? }` response format
- [x] `electron-store` IPC handlers: `store:save-connection`, `store:get-connections`, `store:delete-connection`, `store:save-wizard-state`, `store:get-wizard-state`, `store:clear-wizard-state`

✅ **Frontend UI — Step 1 (Direction):**
- [x] Two clickable direction cards with icons
- [x] Selected state shows blue border + highlight
- [x] Next button appears after selection
- [x] Back button available

✅ **Frontend UI — Step 2 (Source Connection):**
- [x] Sub-heading shows "Step 2 of 8 — Connect Source Database (MongoDB/PostgreSQL)"
- [x] Two-tab connection form (String | Fields) works
- [x] **Custom PostgreSQL Schema Support:** Optional custom schema configuration input (defaults to `public`)
- [x] Eye toggle for password visibility
- [x] "Use a Saved Connection" dropdown loads from electron-store
- [x] **Delete Saved Connection (`🗑️ Delete`):** Option to delete any saved connection with confirmation
- [x] "Test Connection & Read Schema" button with loading state
- [x] Error card shows exact error message + guidance
- [x] Success card shows collection count + collapsible per-collection schema preview (click ▸ to expand)
- [x] **Ping Latency Badge (`⚡ Xms ping`):** Live round-trip database ping latency displayed on successful connection
- [x] **Explicit Save Button:** Checkbox reveals name input and `[Save Connection]` button for instant reliable saving
- [x] Save success/error toast after saving
- [x] Layer 2 Advanced Features Detected banner (PostgreSQL source only) — shows collapsible table of feature counts
- [x] **Real-time Cloud Pooler Detection:** Banner displays proactively as user types/loads Supabase/Neon/Railway/Render URLs
- [x] Next button disabled until schema loaded
- [x] Back button available

✅ **Frontend UI — Step 3 (Target Connection):**
- [x] Sub-heading shows "Step 3 of 8 — Connect Target Database (PostgreSQL/MongoDB)"
- [x] Identical form layout to Step 2 including saved connections dropdown, custom schema input, and delete option
- [x] Button text specifically configured to "Test Connection"
- [x] Error/success states working
- [x] **Ping Latency Badge (`⚡ Xms ping`):** Live latency badge displayed next to target connection success banner
- [x] **Existing Tables Warning Banner:** Prominent warning card when target contains existing tables/collections
- [x] **Target Existing Schema Inspection:** Collapsible list showing all detected existing tables/collections, columns, and data types directly in Step 3
- [x] **Target Wipe Action (`🧹 Wipe Database (Clean Slate)`):** Button with dedicated confirmation modal that calls `db:clear-target` IPC to provide a completely clean database slate
- [x] Permission check results displayed
- [x] Real-time Supabase/Neon/Railway/Render detection banner on target as well
- [x] Next button disabled until connected
- [x] Back button available

✅ **State Management & Navigation Safety:**
- [x] Zustand store created with all required state
- [x] `setDirection()` auto-advances to Step 2 AND auto-persists to electron-store
- [x] `setWizardStep()` auto-persists to electron-store after every step change
- [x] `reset()` clears electron-store wizard state on migration cancel
- [x] `setTargetConfig()` stores target configuration (manual step progression via Next button)
- [x] Form inputs and schema previews preserved across back/forward navigation
- [x] **Active Migration Header Bar:** Displays current direction and step with a `[Start Fresh Migration 🔄]` button
- [x] **Reset Confirmation Modal:** Guards against accidental state discard when starting a fresh migration
- [x] **Window Reload Protection (`beforeunload`):** Warns user before accidental refresh or exit during an active migration
- [x] Store actions fully typed (TypeScript)

✅ **Home Dashboard:**
- [x] `useEffect` loads wizard state from electron-store on mount
- [x] Resume banner appears when `status === 'in-progress'` with direction label and step number
- [x] "Resume →" button restores Zustand state to the correct step and navigates to /migrate
- [x] "Discard ×" button clears electron-store state and dismisses banner

✅ **Code Quality:**
- [x] TypeScript 0 errors across all 3 workspaces (`npm run typecheck`)
- [x] All components use explicit `Props` interfaces
- [x] IPC handlers return proper `IPCResponse<T>` types
- [x] No `any`, `@ts-ignore`, or `@ts-nocheck`
- [x] Light theme colors applied correctly
- [x] Responsive design (mobile, tablet, desktop)

---

## Edge Cases & FYP Report Notes

### Edge Cases Handled

1. **Missing Database Name in Connection String:**
   - MongoDB handler: Uses `config.database` field; if not provided, defaults to 'default'
   - PostgreSQL handler: Requires `database` field (per ConnectionConfig spec)

2. **Network Timeouts:**
   - Both handlers: 5-second connection timeout to prevent hanging

3. **Empty Schema:**
   - MongoDB: Returns empty array if no collections found
   - PostgreSQL: Returns empty array if no tables found

4. **SRV DNS Resolution Failures:**
   - Detected by checking for 'SRV' or 'ENOTFOUND' in error message
   - User gets actionable guidance: corporate network → try hotspot or direct URL

5. **Supabase/Neon Pooler Connection Issues:**
   - Real-time frontend detection + backend pooler check
   - Actionable direct-connection instructions provided

6. **PostgreSQL Permission Missing:**
   - Exact GRANT SQL returned to user
   - Next button disabled until resolved

7. **Target DB Existing Tables Collision Risk:**
   - If target PostgreSQL DB has existing tables (e.g. from prior tests), Step 3 warns the user and clarifies that Step 5 (Risk Report) will evaluate table collisions.

8. **Accidental Refresh / Abandonment:**
   - `beforeunload` browser hook prevents accidental page refresh during an active migration.
   - `Start Fresh Migration` modal prevents accidental erasure of entered credentials.

### Technical Highlights for Project Report/Viva

1. **Dual-Document Protocol:**
   - Phase Plan (technical) + Product Blueprint (UX) consulted in parallel
   - Ensures technical implementation matches user-facing design
   - Documented in AGENTS.md Section 1

2. **Type Safety:**
   - All IPC handlers strictly typed with `IPCResponse<T>`
   - React components use explicit `Props` interfaces
   - Zustand store fully typed (no `any`)
   - TypeScript 0 errors across all 3 workspaces

3. **Error Handling Strategy:**
   - Root-cause detection (SRV vs. pooler vs. permission vs. generic)
   - Plain-English error messages (not raw DB errors)
   - Actionable guidance for each error type

4. **Component Reusability:**
   - Single `ConnectionForm` component handles both MongoDB & PostgreSQL
   - Dynamic placeholders, notes, and button labels based on `dbType` / `buttonText` props
   - ~90% code reuse between database types

5. **Crash Recovery via electron-store:**
   - Wizard state auto-serialized to disk on every step change via `persistWizardState()`
   - Failure is swallowed silently so persistence errors never crash the wizard
   - Home Dashboard reads and shows a contextual "Resume →" banner on next app launch
   - "Discard ×" clears the saved state from disk

6. **Saved Connections Management:**
   - `store:save-connection` IPC writes named connection to electron-store JSON
   - `store:delete-connection` IPC removes saved connections on user demand
   - `store:get-connections` filters by `dbType` so MongoDB and PG connections are kept separate
   - `ConnectionForm` renders saved connections dropdown and allows deletion right from the form

7. **Proactive Cloud Provider Detection:**
   - Matches Supabase, Neon, Railway, Render hostnames in real-time as user types
   - Supabase pooler specifically identified by port 6543 or `pooler.supabase` in URL
   - Neon pooler identified by `-pooler.` in hostname
   - UI renders a provider-specific guidance banner

8. **Layer 2 Advanced Features Banner:**
   - After connecting PostgreSQL as source, counts of procedures/functions/triggers/views/constraints/enums shown in a collapsible amber info card
   - Non-blocking — user can still proceed
   - Prepares user for the Layer 2 Guide generated in Phase 7

---

## Next Phase Handoff

### Prerequisites Established for Phase 5+

1. **Wizard State Persistence:** ✅ Fully implemented
   - `store:save-wizard-state` / `store:get-wizard-state` / `store:clear-wizard-state` IPC channels live
   - Home Dashboard Resume banner reads from electron-store on every mount
   - `wizardStore` auto-saves on direction change and every step advance

2. **Saved Connections:** ✅ Fully implemented
   - `store:save-connection` / `store:get-connections` / `store:delete-connection` IPC channels live
   - ConnectionForm loads saved connections dropdown and supports instant save / delete

3. **Schema Health Score (Phase 6):**
   - Success card in Step 2 has room to show health score badge below schema preview
   - `ai:health-score` IPC handler to be added in Phase 6

4. **Steps 4–8:**
   - All future steps use same wizard component conditional rendering
   - StepProgressBar scales to 8 steps (already implemented)
   - Wizard state (direction, sourceConfig, sourceSchema, targetConfig, layer2Features) fully populated and persisted

5. **Layer 2 Risk Report (Phase 7):**
   - `wizardStore.layer2Features` fully populated after PostgreSQL source connection
   - Phase 7 Risk Report will read and render this data in the Layer 2 section

---

## 7. Retrospective Deep Audit & Enterprise Hardening (September 2026)

Following a comprehensive retrospective audit against production engineering, database security, and UX standards, the following 8 targeted improvements and hardening fixes were implemented across Phase 4:

### 1. SQL Identifier Sanitization for Target Schema (`db:connect-postgresql`, `db:clear-target`)
- **Issue:** PostgreSQL schema names passed from user inputs were interpolated directly into DDL strings (`DROP SCHEMA "${targetSchema}" CASCADE; CREATE SCHEMA "${targetSchema}";`).
- **Resolution:** Centralized `sanitizeIdentifier(name, fallback)` in `apps/desktop/main/utils.ts`. Strips all characters except `[a-zA-Z0-9_]`, truncates to PostgreSQL's 63-byte max identifier length, and falls back to `'public'`. Applied to both introspection and schema wipe queries.

### 2. Transactional Schema Wipe with Rollback Protection (`db:clear-target`)
- **Issue:** The PostgreSQL clear target operation previously executed `DROP SCHEMA` followed by `CREATE SCHEMA` without explicit transaction boundaries. If schema creation or grant queries failed midway, the database was left in an empty, broken state.
- **Resolution:** Wrapped in explicit `BEGIN ... COMMIT` block with automatic `ROLLBACK` on any thrown error, guaranteeing atomic execution.

### 3. Password and Credential Masking in Database Error Messages (`db.ts`, `risk.ts`)
- **Issue:** Database connection errors (e.g., DNS SRV lookup failures, pooler rejections, authentication crashes) could echo connection strings containing raw passwords into user-visible error cards and IPC responses.
- **Resolution:** Exported `maskSensitiveFields()` from `apps/desktop/main/utils.ts` and wrapped all IPC error messages in `setupMongoDBHandler()`, `setupPostgresqlHandler()`, and `setupClearTargetHandler()`. Re-exported in `risk.ts` to maintain full downstream compatibility with Phase 7 and Phase 8.

### 4. Empty MongoDB Collection Unblocking (`MigrationWizard.tsx`)
- **Issue:** `isSourceConnected` required `sourceMongoPreview.length > 0`. If a user connected to an empty MongoDB database (e.g., new testbed with 0 collections), the UI showed "Connected to MongoDB!" but permanently disabled the "Next: Connect Target →" button.
- **Resolution:** Introduced a dedicated `sourceConnectedSuccessfully` state tracker that sets to `true` on any verified connection response, allowing users to progress cleanly even with zero initial collections.

### 5. Function Scoping Hygiene in Store Handlers (`store.ts`)
- **Issue:** `isValidMigrationRecord` was declared inside the execution body of `setupStoreHandlers()` between two handler registrations.
- **Resolution:** Moved to top-level module scope above `setupStoreHandlers()`, improving readability and testability.

### 6. Debug API Key Log Removal (`MigrationWizard.tsx`)
- **Issue:** A development `console.log('[Health Score] API Key: ...')` was leaking key availability state to the browser dev tools.
- **Resolution:** Removed the redundant debug statement.

### 7. Resume Notice Banner Integration (`MigrationWizard.tsx`)
- **Issue:** `HomeDashboard.tsx` navigated to `/migrate` passing `{ resumeNotice: 'Your connection settings were saved. Please reconnect to regenerate your schema mapping.' }`, but `MigrationWizard.tsx` did not read or display this state.
- **Resolution:** Added `resumeNotice` state reader from `location.state` and rendered a dismissible, light-theme compliant blue informational banner on Step 1.

### 8. Accurate Cloud Pooler vs. Direct Connection Detection (`ConnectionForm.tsx`)
- **Issue:** The previous cloud detection flagged any connection containing `supabase.co` with an advisory to use the direct URL on port 5432, even if the user was *already* using port 5432.
- **Resolution:** Added port and hostname inspection:
  - **Port 6543 / `pooler.supabase`:** Displays an amber warning banner advising switch to direct port 5432 for DDL operations.
  - **Port 5432 / Direct connection:** Displays a blue confirmation banner indicating verified direct connection, optimal for schema creation and ETL batch operations.
  - Similarly distinguished for Neon (`-pooler.` hostname detection).

### 10. Dynamic `_id` BSON Type Inference (`db.ts`)
- **Issue:** Previously, `_id` was hardcoded to `bsonType: 'ObjectId'`. In enterprise databases where collections use custom String UUIDs or numerical primary keys, downstream schema mapping (Phase 5) would mistakenly restrict `_id` to `VARCHAR(24)`.
- **Resolution:** Inspected sample documents dynamically for `_id` values via `getBsonType(doc._id)`. Sets `detectedIdBsonType` accurately (supporting `'string'`, `'uuid'`, `'int'`, `'long'`, etc.) while defaulting cleanly to `'ObjectId'`.

### 11. Resilient Cloud Database Target Wipe Fallback (`db.ts`)
- **Issue:** On managed cloud providers (e.g. AWS RDS or Supabase non-superuser roles), users often lack the `DROP SCHEMA` privilege for `public`. Running `DROP SCHEMA` failed the wipe operation entirely.
- **Resolution:** Added a transaction fallback: if `DROP SCHEMA ... CASCADE` throws a permission error, it rolls back and executes a table-by-table drop (`DROP TABLE IF EXISTS "schema"."table" CASCADE;`) inside a clean transaction.

### 12. Pre-Flight Permission Verification Checklist UX (`MigrationWizard.tsx`)
- **Issue:** Step 3 target connection showed a single summary line for permissions rather than the 3-point checklist specified in Product Blueprint §Step 3.
- **Resolution:** Rendered the clean 3-item checklist card:
  - `✅ Can create tables: Yes`
  - `✅ Can insert data: Yes`
  - `✅ Lock timeout supported: Yes`

### 13. Automated Test Suite (`scripts/test-phase4-verification.js`)
- **Addition:** Built an automated 53-assertion verification suite covering MongoDB schema sampling, dynamic `_id` inference, numeric widening, credential masking, identifier sanitization, pooler detection, wipe resilience, and wizard state persistence.

---

## 8. Verification & Build Integrity

- **Automated Phase 4 Suite:** Passed with 53/53 tests (`node scripts/test-phase4-verification.js`).
- **Automated Phase 2 & 3 Suite:** Passed with 22/22 tests (`node scripts/test-phase2-phase3-verification.js`).
- **TypeScript Compilation:** Passed with exit code 0 across all workspaces (`npm run typecheck`).
- **Light Theme Compliance:** All banners and modals strictly use light surface tokens (`#F8FAFC`, `#EFF6FF`, `#FFFBEB`, `#15803D`, `#92400E`).
- **Downstream Compatibility:** 0 breaking changes to Phases 5, 6, 7, and 8.

---

## Git Commit Command

After reviewing and testing Phase 4, run:

```bash
git add .
git commit -m "feat: phase-04 — dynamic _id inference, cloud wipe fallback, permission checklist, and automated test suite"
```

---

**Phase 4 Complete & Hardened.** ✅ Production-grade connectivity with zero type errors.

