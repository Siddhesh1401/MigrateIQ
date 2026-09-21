# Phase 3 Documentation — Home Dashboard

> **Phase Goal:** Build the full Home Dashboard screen with entry cards, connected Recent Migrations table, resume unfinished migration banner, and report viewer modal.
> **Status:** Complete & Enterprise Verified ✅

---

## 1. Phase Summary & Goal

In Phase 3, we built and remediated the **Home Dashboard** — the central command hub of the MigrateIQ desktop application. This screen serves as the primary gateway for starting migrations, initiating schema updates, exploring the in-memory demo, and reviewing migration activity.

**Key Components & Capabilities:**
* ✅ **3 Primary Entry Cards** (Migrate My Database / Update My Database / Try with Sample Data)
* ✅ **Demo Mode Flag Handoff**: Card C explicitly synchronizes `isDemoMode: true` in `wizardStore` and passes router state for Phase 13
* ✅ **Clean State Guarantee**: Starting a new migration resets in-memory Zustand state, preventing state pollution from previous sessions
* ✅ **Connected Recent Migrations Table**: Wired to `electron-store` via `store:get-migration-history`, showing real history when present or a clean empty state
* ✅ **View Report Summary Modal**: Accessible dialog displaying key execution metadata per `phase_plan-v2.md` §3.2
* ✅ **Resume Unfinished Migration Banner**: Detects active snapshots, navigates to paused steps, and cleans up both memory and disk on discard
* ✅ **WCAG 2.1 AA Accessibility**: Eliminates nested interactive buttons; uses semantic HTML `<table>` elements with responsive CSS grid fallbacks

---

## 2. Files Created & Modified

| File Path | Type | Description |
|---|---|---|
| `packages/shared/src/types.ts` | Modified | Shared contracts: added canonical `MigrationHistoryItem` and `WizardStateSnapshot` |
| `apps/desktop/renderer/src/screens/HomeDashboard.tsx` | Modified | Switched to shared types; added safe-checkpoint resume; added Escape key & focus management to Report Modal |
| `apps/desktop/main/handlers/store.ts` | Modified | Switched to shared types; added `isValidMigrationRecord` validation in `store:save-migration-history` |
| `apps/desktop/renderer/src/store/wizardStore.ts` | Modified | Removed redundant IPC persistence calls on granular config mutations |
| `apps/desktop/renderer/src/screens/MigrationWizard.tsx` | Modified | Synchronizes `isDemoMode` from router location state on mount |
| `apps/desktop/renderer/src/styles/dashboard.css` | Modified | Styles for semantic table, report modal, and accessible card focus rings |
| `scripts/test-phase2-phase3-verification.js` | Created | Automated verification suite validating Phase 2 & 3 functionality |

---

## 3. Architecture & Key Implementation Details

### 3.1 Data Flow Architecture
```
┌────────────────────────────────────────────────────────┐
│                   HomeDashboard.tsx                    │
│                                                        │
│  [Resume Banner] ──> store:get-wizard-state            │
│  [Recent Table]  ──> store:get-migration-history       │
│  [Discard ×]     ──> store:clear-wizard-state + reset  │
│  [Card A]        ──> wizardStore.reset() ──> /migrate  │
│  [Card C]        ──> setIsDemoMode(true) ──> /migrate  │
└────────────────────────────────────────────────────────┘
                           │
                 IPC (contextBridge)
                           │
┌────────────────────────────────────────────────────────┐
│                   main/handlers/store.ts               │
│                                                        │
│  electron-store ('migrateiq-data')                     │
│  ├── savedConnections: SavedConnection[]               │
│  ├── wizardState: WizardStateSnapshot | null           │
│  └── migrationHistory: MigrationHistoryItem[]          │
└────────────────────────────────────────────────────────┘
```

### 3.2 Key Fixes & Improvements Applied
1. **Real Store Integration**: The migrations table is no longer an immutable fake array. It requests history via `store:get-migration-history`. On first launch, it displays the contextual empty state; once migrations complete in later phases, it displays history automatically.
2. **Accessible Entry Cards**: Replaced nested `<button>` inside `<div role="button">` with semantic `<span className="card-button" aria-hidden="true">`, making the card itself the accessible button.
3. **Demo Mode Contract**: Card C now reliably initializes `wizardStore.setIsDemoMode(true)` and sets default direction to `mongodb-to-postgres`, preparing the wizard for Phase 13 sample data execution.
4. **View Report Modal**: Clicking "View Report →" opens an accessible summary modal showing timestamp, direction, database names, rows transferred, and a note regarding full Phase 10 PDF/HTML exports.
5. **Shared Types Contract**: Canonical `MigrationHistoryItem` and `WizardStateSnapshot` types reside in `@migrateiq/shared`, eliminating duplicate declarations.
6. **Safe-Checkpoint Resume**: Resuming from steps past Step 2 safely resets step to Step 1 with a notification, preventing crashes due to unpersisted runtime schema mapping.
7. **Modal Keyboard & Focus Accessibility**: Supports Escape key closing and retains focus on the triggering button when dismissed.
8. **IPC Guard & Chatter Reduction**: `store:save-migration-history` validates required fields, and `persistWizardState` is called only at step boundaries.

### 3.3 Deep Audit Hardening Implementations

#### A. Unified Shared Types (`@migrateiq/shared`)
Previously, `store.ts` and `HomeDashboard.tsx` each defined separate local copies of `MigrationHistoryItem` and `WizardStateSnapshot`. These are now anchored in `@migrateiq/shared`:
```typescript
export interface MigrationHistoryItem {
  id: string;
  dateTime: string;
  direction: string;
  status: 'completed' | 'warning' | 'failed';
  sourceDb?: string;
  targetDb?: string;
  tablesCount?: number;
  rowsMigrated?: number;
  duration?: string;
  reportSummary?: string;
}

export interface WizardStateSnapshot {
  direction: 'mongodb-to-postgres' | 'postgres-to-mongo' | null;
  wizardStep: number;
  sourceConfig: ConnectionConfig | null;
  targetConfig: ConnectionConfig | null;
  status: 'in-progress' | 'completed' | 'cancelled';
  savedAt: string;
}
```

#### B. IPC Payload Validation Guard (`apps/desktop/main/handlers/store.ts`)
To prevent invalid or partial records from polluting `electron-store`:
```typescript
function isValidMigrationRecord(record: unknown): record is MigrationHistoryItem {
  if (!record || typeof record !== 'object') return false;
  const r = record as Partial<MigrationHistoryItem>;
  if (typeof r.id !== 'string' || !r.id.trim() || r.id.length > 100) return false;
  if (typeof r.dateTime !== 'string' || !r.dateTime.trim()) return false;
  if (typeof r.direction !== 'string' || !r.direction.trim()) return false;
  if (!r.status || !['completed', 'warning', 'failed'].includes(r.status)) return false;
  return true;
}
```

#### C. Safe-Checkpoint Resume Logic (`apps/desktop/renderer/src/screens/HomeDashboard.tsx`)
In `wizardStore`, runtime schema mappings (`schemaMapping`, `sourceSchema`) exist only in memory and are not persisted to disk. When resuming from a paused step beyond Step 2:
```typescript
const isPastConnection = (inProgressState.wizardStep ?? 1) > 2;
const targetStep = isPastConnection ? 1 : (inProgressState.wizardStep || 1);
wizardStore.setWizardStep(targetStep);
navigate('/migrate', {
  state: isPastConnection
    ? { resumeNotice: 'Your connection settings were saved. Please reconnect to regenerate your schema mapping.' }
    : undefined,
});
```

#### D. Modal Keyboard & Focus Trap (`apps/desktop/renderer/src/screens/HomeDashboard.tsx`)
1. On open, focus is shifted to the modal container (`tabIndex={-1}`).
2. An event listener catches `Escape` to close the modal.
3. On close, focus returns to the triggering button via `lastActiveElementRef`.

#### E. IPC Throttling (`apps/desktop/renderer/src/store/wizardStore.ts`)
Removed calls to `persistWizardState()` from `setSourceConfig` and `setTargetConfig`. State is now persisted strictly at wizard step transitions (`setWizardStep`), preventing excessive disk I/O during form typing.

---

## 4. Verification & Test Results

| Checklist Item | Result |
|---|---|
| `npm run typecheck` across all monorepo workspaces | ✅ Passed (0 errors) |
| `npm run build --workspace=@migrateiq/desktop` production build | ✅ Passed (0 errors, 0 CSS warnings) |
| `node scripts/test-phase2-phase3-verification.js` automated test suite | ✅ Passed (22/22 checks passed) |
| Card A resets wizardStore and navigates to `/migrate` | ✅ Verified |
| Card B navigates to `/schema-update` placeholder | ✅ Verified |
| Card C sets `isDemoMode: true` and navigates with demo state | ✅ Verified |
| Recent Migrations reads from `electron-store` | ✅ Verified |
| "View Report" opens summary modal and responds to Escape key | ✅ Verified |
| Resume banner "Discard ×" clears disk store and resets Zustand memory | ✅ Verified |
| Safe resume resets to Step 1 when resuming from Step > 2 | ✅ Verified |
| IPC input validation rejects malformed migration records | ✅ Verified |

---

## 5. How to View & Test in the Running Application

### 5.1 Seeing the Empty State (Default)
1. Launch the application:
   ```bash
   npm run desktop:dev
   ```
2. On initial launch with no migrations recorded, the Recent Migrations section displays the clean empty state:
   - Icon: 📭
   - Title: "No migrations yet"
   - Description: "Start your first migration above to see your history here."

### 5.2 Seeing the Populated Table & "View Report →" Modal
To immediately view realistic migration activity on the Home Dashboard and test the report modal:
1. Run the sample seeder in a terminal:
   ```bash
   node scripts/seed-sample-migration-history.js
   ```
2. Switch back to the MigrateIQ app (or navigate to any sidebar tab and back to **Home**):
   - The Recent Migrations table now displays 3 realistic historical migrations (MongoDB → PostgreSQL completed, with warnings, and PostgreSQL → MongoDB).
   - Click the blue **"View Report →"** button on any row.
   - The **Migration Report Summary** modal appears, displaying execution time, direction, status badge, database names, rows transferred, and duration.
   - Click **"Close Summary"** or the **"×"** button to dismiss the modal.

---

## 6. Next Phase Handoff (Phase 4)

With the App Shell (Phase 2) and Home Dashboard (Phase 3) completely remediated and tested, the application is primed for:
* **Phase 4 — Database Connectivity (Steps 2 & 3)**: Connecting live MongoDB and PostgreSQL instances and performing schema introspection.

