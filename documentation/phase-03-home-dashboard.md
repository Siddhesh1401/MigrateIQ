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
| `apps/desktop/renderer/src/screens/HomeDashboard.tsx` | Modified | Fully wired dashboard with store integration, clean navigation handlers, and report modal |
| `apps/desktop/main/handlers/store.ts` | Modified | Added `migrationHistory` to `StoreSchema`, plus `store:get-migration-history` and `store:save-migration-history` IPC handlers |
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
| "View Report" opens summary modal | ✅ Verified |
| Resume banner "Discard ×" clears disk store and resets Zustand memory | ✅ Verified |

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

