# MigrateIQ — Final Master Improvement Report
## Phase-by-Phase Analysis | Blueprint + Phase Plan Cross-Reference

> **What is this document?**
> This is the ONE final reference document combining ALL findings from two separate audit passes:
> - Audit Pass 1 (`fyp-blueprint-audit-report.md`) — Deep cross-reference: gaps between `product_blueprint-v7.md` and `phase_plan-v2.md`
> - Audit Pass 2 (`f`) — Complete phase-by-phase deep analysis: what each phase has, what each phase is missing
>
> **How to use this:** Read phase by phase. Before starting each phase, read its section here.
> Each phase tells you: ✅ What's already specced, ❌ What's missing (with priority), 🔴 Cross-document bugs found.

---

## 🏆 Overall Assessment: 92 / 100

Both planning documents are significantly more detailed than 99% of FYP projects.
The dual-document approach (Phase Plan = "How to Build", Blueprint = "What User Sees") is itself industry-standard practice.

**What already makes this stand out:**
- 16 explicitly documented technical challenges — shows engineering maturity
- AI with deterministic rule engine fallback — zero single point of failure
- Chunk-level ETL error isolation — industry-standard resilience
- `CREATE INDEX CONCURRENTLY` everywhere — production-safe DDL
- `NOT VALID → VALIDATE CONSTRAINT` for circular FKs — correct PostgreSQL pattern
- Demo Mode with bundled in-memory dataset — zero examiner setup required
- Automated verification suite with MD5 checksum and FK integrity check

---

## 🗺️ Phase Completion Status (Quick Reference)

| Phase | Title | Status | Next Action |
|---|---|---|---|
| Phase 0 | Monorepo Foundation | ✅ Built & Verified | — |
| Phase 1 | Landing Website (5 pages) | ✅ Built & Verified | — |
| Phase 2 | Desktop App Shell | ✅ Built & Verified | — |
| Phase 3 | Home Dashboard | ✅ Built & Verified | — |
| Phase 4 | Database Connectivity (Steps 2 & 3) | ✅ Built & Verified | — |
| Phase 5 | Schema Mapper UI (Step 4) | ✅ Built & Verified | — |
| Phase 6 | AI Engine + Rule Engine + Security | ✅ Built + Bug Fixes Applied | — |
| Phase 7 | Risk Report (Step 5) | 🟡 Not Started | **Build Next** |
| Phase 8 | Dry Run (Step 6) | 🟡 Not Started | — |
| Phase 9 | Live ETL Engine (Step 7) | 🟡 Not Started | — |
| Phase 10 | Completion & Downloads (Step 8) | 🟡 Not Started | — |
| Phase 11 | Schema Update Assistant (Workflow C) | 🟡 Not Started | — |
| Phase 12 | PG → MongoDB Direction (Workflow B) | 🟡 Not Started | — |
| Phase 13 | Demo Mode | 🟡 Not Started | — |
| Phase 14 | Auxiliary Screens (History, Settings…) | 🟡 Not Started | — |
| Phase 15 | Partial Migration | 🟡 Not Started | — |
| Phase 16 | Testbed Applications | 🟡 Not Started | — |
| Phase 17 | Final Polish & .exe Build | 🟡 Not Started | — |

---

---

# PART A — COMPLETED PHASES (0–6)

---

## Phase 0 — Monorepo Foundation

**Blueprint Reference:** N/A (Infrastructure only)
**Phase Plan Reference:** Lines 43–95

### ✅ What Was Built:
- Root `package.json` with npm workspaces (`apps/*`, `packages/*`)
- `packages/shared/` with all TypeScript interfaces (`ConnectionConfig`, `SourceSchema`, `FieldMapping`, `RiskItem`, `ProgressEvent`, `MigrationResult`)
- `apps/web/` Next.js 14 scaffold
- `apps/desktop/` Electron + React + Vite scaffold
- `apps/testbed-mongo/` and `apps/testbed-postgres/` scaffolds

### ❌ What's Missing (Add During Phase 17):
- `LICENSE` file (MIT or Apache 2.0)
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`

### 🔴 No Cross-Document Bugs Found

---

## Phase 1 — Landing Website (All 5 Pages)

**Blueprint Reference:** Lines 1–371 (Part 1 — Landing Website)
**Phase Plan Reference:** Lines 97–165

### ✅ What Was Built:
- All 5 pages: Home `/`, How It Works `/how-it-works`, Features `/features`, Download `/download`, About `/about`
- Navbar (logo + links + Download CTA button)
- Footer (product name + links + "Built with" note)
- Design system (CSS custom properties, Inter font, responsive grid)
- 12-feature card grid, comparison table (vs Flyway, Prisma, Liquibase, Bytebase, AWS DMS)
- 8-step How It Works cards, FAQ accordion
- SEO meta tags on all pages

### 🔴 Cross-Document Bugs Found (From Audit Pass 1):

**BUG 1 — Feature count discrepancy on Home page:**
- Blueprint heading says "12 feature cards" but the table (lines 94–107) has **11 entries**
- Feature 12 ("Estimated Time Remaining") is on the Features page but **missing from the Home page grid**
- ➡️ **Fix:** Add "⏱️ Estimated Time Remaining" as the 12th card to Home page Section 1.3

**BUG 2 — Step numbering mismatch between How It Works page and actual wizard:**

| How It Works Page | Actual Wizard | Match? |
|---|---|---|
| Step 5: "You Review the Mapping" | Step 5: "Risk Report" | ❌ MISMATCH |
| Step 6: "Risk Report" | Step 6: "Dry Run" | ❌ MISMATCH |
| Step 7: "Dry Run" | Step 7: "Run Migration" | ❌ MISMATCH |

- ➡️ **Fix:** Update the How It Works page step titles to exactly match the wizard: (1) Choose Direction, (2) Connect Source, (3) Connect Target, (4) AI Schema Mapping, (5) Review & Edit Mapping, (6) Risk Report, (7) Dry Run, (8) Migrate & Download

### ❌ What's Missing (Nice-to-Have, FYP-Level Optional):

| Item | Priority | Time |
|---|---|---|
| GitHub stars / social proof counter on Hero section | Low | 1h |
| `/roadmap` page showing v1.0 released, v1.1 planned features | Low | 2h |
| WCAG AA accessibility audit (alt text, ARIA labels, keyboard nav) | Medium | 3h |
| Testimonials section with mock developer quotes | Low | 1h |
| Accessibility note in blueprint: "All pages tested with axe DevTools" | Low | 30min |

---

## Phase 2 — Desktop App Shell

**Blueprint Reference:** Lines 373–430 (App Shell)
**Phase Plan Reference:** Lines 169–234

### ✅ What Was Built:
- Electron `BrowserWindow` (1280×800)
- `preload.ts` with `contextBridge` (`window.electronAPI`)
- React Router for 8 in-app routes
- `AppShell.tsx` with `Sidebar.tsx` + `MainContent.tsx`
- All 7 sidebar nav items with icons, active highlight, `v1.0.0` at bottom
- Global CSS design system (light theme, Inter font, CSS tokens)

### ❌ What's Missing (High-Impact Additions):

| Item | Priority | Time |
|---|---|---|
| **React Error Boundary** — catches renderer crashes, shows friendly error screen instead of blank white | 🔴 High | 2h |
| **Keyboard shortcuts** (Ctrl+N new migration, Ctrl+H home, F11 fullscreen) | 🟡 Medium | 2h |
| **First-run onboarding tour** — shows sidebar, explains 3 main actions, dismissable | 🟡 Medium | 3h |
| System tray icon with right-click context menu | Low | 2h |
| Auto-update checker (polls GitHub releases API on app start) | Low | 2h |

---

## Phase 3 — Home Dashboard

**Blueprint Reference:** Lines 430–530 (Screen 1 — Home Dashboard)
**Phase Plan Reference:** Lines 238–285

### ✅ What Was Built:
- Three entry cards (Migrate, Schema Update, Demo Mode) with correct icons, descriptions, buttons
- Recent Migrations table with status badges (✅ Completed / ⚠️ With Warnings / ❌ Failed)
- Empty state message
- Resume Banner (blue info bar when an in-progress wizard state exists in `electron-store`)

### ❌ What's Missing:
| Item | Priority | Time |
|---|---|---|
| Dashboard stats cards at top (Total migrations, rows migrated, uptime this week) | 🟡 Medium | 2h |
| "View Last Migration Report" quick link | 🟡 Medium | 30min |

---

## Phase 4 — Database Connectivity (Steps 2 & 3)

**Blueprint Reference:** Lines 530–720 (Steps 2 & 3)
**Phase Plan Reference:** Lines 287–371

### ✅ What Was Built:
- MongoDB IPC handler: `db:connect-mongodb` — samples 100 docs per collection, infers BSON types
- PostgreSQL IPC handler: `db:connect-postgresql` — reads `information_schema`, checks permissions with `HAS_TABLE_PRIVILEGE`
- Layer 2 scan: stored procedures, triggers, views, check constraints, enum types, composite PKs
- Step 1 (Choose Direction) with 2 clickable cards, progress bar
- Step 2 (Connect Source) with dual tabs (connection string / individual fields), eye toggle, saved connections dropdown, success/error states
- Step 3 (Connect Target) with permission check results, Supabase/Neon detection banner
- AI Health Score (silently loaded after Step 2 connection succeeds)
- Wizard state persistence to `electron-store`

### 🔴 Cross-Document Bug Found (From Audit Pass 1):

**BUG 3 — ERD button exists in Step 2 but ERD generator is not built until Phase 10:**
- Blueprint (line 536): `"🗺️ View ERD Diagram"` button shown immediately after MongoDB connection succeeds
- Phase Plan Phase 10 (Section 10.2): ERD is only built much later
- ➡️ **Fix Options (pick one):**
  - Option A: Build a lightweight Mermaid.js text ERD preview as early as Phase 4 (low effort)
  - Option B: Disable the ERD button with a tooltip "Available after completing migration" until Step 8
  - Option C: Keep the button, clicking it shows a simple `<pre>` Mermaid source code which the user can paste at mermaid.live

### ❌ What's Missing (High-Impact Additions):

| Item | Priority | Time |
|---|---|---|
| **Connection string real-time validator** — red underline as user types with tooltip for invalid segments | 🔴 High | 2h |
| **Collapsible "Advanced Options"** — connection timeout (30s), query timeout (60s), retry attempts (3) | 🟡 Medium | 1h |
| **Recent connections quick-access buttons** above the form (click → auto-fills) | 🟡 Medium | 1h |
| Connection pooling in `db.ts` (max 5 connections, reuse across schema reads) | 🟡 Medium | 2h |
| SSL/TLS certificate upload for MongoDB Atlas custom CA cert | Low | 3h |
| SSH tunnel support for DBs behind firewalls | Low | 5h |

---

## Phase 5 — Schema Mapper UI (Step 4)

**Blueprint Reference:** Lines 720–800 (Step 4 Schema Mapping)
**Phase Plan Reference:** Lines 374–450

### ✅ What Was Built:
- `SchemaMapperTable.tsx` — per-collection table with: MongoDB Field | Type | → | PostgreSQL Column | Data Type ▼ | Nullable | Include?
- Editable column names (click to edit inline)
- 16-type PostgreSQL data type dropdown
- Field badges: `⚠️ Was Nested`, `🔗 Foreign Key`, `📋 Creates child table`
- Child table expansion for arrays of objects
- Data Type Reference Panel (16-row reference table)
- Index Translation Section
- `AI Suggested` vs `Rule Engine` badge on each row

### 🔴 Cross-Document Bug Found (From Audit Pass 1):

**BUG 4 — `sort_order` column for array-derived child tables not mentioned in Phase Plan:**
- Blueprint Challenge 9 (lines 1810–1822): Auto-add `sort_order INTEGER NOT NULL` when arrays of objects become child tables to preserve original array order
- Phase Plan Phase 5 and Phase 6: Never mention `sort_order`
- ➡️ **Fix:** When a field is mapped as `Array of Objects → child table`, auto-add a `sort_order INTEGER NOT NULL` column to the child table. ETL sets it to the 0-based array index during insert.

### ❌ What's Missing (High-Impact Additions):

| Item | Priority | Time |
|---|---|---|
| **Mapping Export/Import as JSON** — "💾 Save Mapping" / "📁 Load Mapping" buttons for version control | 🔴 High | 3h |
| **PII Data Masking column** — "Transform" dropdown per field: `Copy As-Is | Mask Email | Hash SHA-256 | Redact (NULL)` | 🔴 High | 4h |
| **Undo/Redo** (Ctrl+Z / Ctrl+Y) for column renames, type changes, include toggles | 🟡 Medium | 3h |
| **Bulk operations toolbar**: Select All, Deselect All, Reset to AI, Rename All to snake_case | 🟡 Medium | 2h |
| **Search/filter** for large schemas (100+ fields): filter by nested, array, unmapped | 🟡 Medium | 2h |
| AI confidence score per row (🟢 98% / 🟡 72% / 🔴 45%) | Low | 2h |
| "Why this mapping?" tooltip explaining AI's reasoning | Low | 1h |
| "AI vs Rule Engine" comparison view side-by-side | Low | 2h |

---

## Phase 6 — AI Engine + Rule Engine + Security

**Blueprint Reference:** Lines 800–955 (AI Integration)
**Phase Plan Reference:** Lines 450–560

### ✅ What Was Built:
- Gemini API integration with model cascade (`gemini-1.5-pro` → `gemini-1.5-flash` → Rule Engine)
- Deterministic Rule Engine fallback covering all 14 BSON → PostgreSQL type mappings
- Nested object flattening (≤2 levels → underscore columns, >2 levels → JSONB)
- Array of objects → child table generation
- AI Schema Health Score (0–100 scoring with deduction list)
- API key stored via `electron-store` (never hardcoded)
- `.env` removed from Git history, `.gitignore` updated

### 🔴 Cross-Document Bug Found (From Audit Pass 1):

**BUG 5 — OpenRouter listed in Blueprint Settings but missing from Phase Plan:**
- Blueprint Settings screen (line 1477): Lists "OpenRouter" as AI provider option
- Phase Plan Section 14.4: Only lists "Gemini / Groq / Rule Engine Only" — no OpenRouter
- ➡️ **Fix in Phase 14:** Add OpenRouter to the Settings AI provider dropdown (proxies GPT-4, Claude, Llama under one API key)

### ❌ What's Missing (Additions for Phase 6 or Future):

| Item | Priority | Time |
|---|---|---|
| **Show fallback reason to user** — "ℹ️ AI unavailable (network timeout). Using rule-based mapping." | 🔴 High | 30min |
| AI usage dashboard in Settings — calls this month, tokens used, estimated cost | 🟡 Medium | 2h |
| Custom system prompt editor in Settings → AI (for power users) | Low | 1h |

---

---

# PART B — PHASES TO BUILD (7–17)

---

## Phase 7 — Risk Report (Step 5 of Wizard) ← BUILD NEXT

**Blueprint Reference:** Lines 955–1100 (Risk Report Screen)
**Phase Plan Reference:** Lines 501–560

### What Phase 7 Builds (Per Specs):
- `riskAnalyzer.ts` engine — analyzes `fieldMappings` + `sourceSchema` → produces `RiskItem[]`
- Risk items with 3 tiers: 🔴 Critical (blocks migration), 🟡 Warning (may cause issues), ℹ️ Info (safe but worth knowing)
- Expandable accordion cards per risk item
- Auto-Fix buttons on applicable warnings
- Layer 2 PostgreSQL risks section (stored procedures, triggers, views detected in Phase 4)
- "Proceed with Warnings" and "Fix Issues First" decision buttons

### ❌ What's Missing (Recommend Adding While Building Phase 7):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **"Auto-Fix All Non-Breaking Warnings"** single batch button | 🔴 High | 2h | Fixes all nullability and type mismatch warnings in one click |
| **"What if I ignore this?" simulator** — shows which rows would be skipped, which FK constraints might fail | 🔴 High | 2h | Per-risk impact preview |
| **"Ignore All of Type" button** — when 50+ identical warnings, one click hides them all | 🟡 Medium | 1h | Reduces noise for large schemas |
| **Estimated fix time per risk** — "⏱️ Auto-fix will take: <1 second" | 🟡 Medium | 30min | Builds confidence |
| **Risk prioritization sort** — within each tier, sort by impact (data loss first, then performance, then manual work) | 🟡 Medium | 1h | Makes critical list more actionable |
| Risk Trends card — "This migration: 3 critical vs Last migration: 5 critical — Improving ✅" | Low | 1h | Nice viva talking point |

### 🎓 Viva Question This Phase Unlocks:
> *"What happens if there are circular foreign key dependencies between tables?"*
> **Answer:** "We run cycle detection on the Directed Acyclic Graph using Kahn's algorithm. When detected, it's flagged as a 🔴 Critical Risk. During migration, tables are created without FKs first, all data is inserted, then FKs are added using `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID` followed by `VALIDATE CONSTRAINT`."

---

## Phase 8 — Dry Run (Step 6 of Wizard)

**Blueprint Reference:** Lines 1100–1180 (Dry Run Screen)
**Phase Plan Reference:** Lines 560–620

### What Phase 8 Builds (Per Specs):
- PostgreSQL `BEGIN ... ROLLBACK` transaction wrapping all DDL for validation
- Sample 500 rows from each collection, insert into PostgreSQL (rolled back immediately)
- Per-table results: rows passed / rows skipped / errors
- Error details per failed row
- "Looks good — Proceed to Migration" and "Go Back and Fix Issues" buttons

### ❌ What's Missing (Recommend Adding While Building Phase 8):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **VARCHAR(N) Truncation Boundary Check** — before dry run, detect if any source values exceed target column width | 🔴 High | 2h | Prevents silent data truncation in live run |
| **Schema Drift Detection** — before dry run, compare current source collections to what was introspected in Step 2 | 🔴 High | 2h | Catches concurrent schema changes by other developers |
| **Performance Estimate after dry run** — "📊 Estimated full speed: 2,340 rows/sec → Full migration ETA: ~8 min" | 🟡 Medium | 1h | Great viva talking point |
| Adjustable sample size slider (100 – 5,000 rows) | 🟡 Medium | 1h | Speed vs accuracy tradeoff |
| Dry Run History (last 5 runs with pass/fail counts) | Low | 1h | Shows iteration tracking |
| "Test specific document IDs" input | Low | 1h | Debugging specific problem rows |

### 🔴 Schema Drift Detection — Implementation Pattern:
```typescript
// At start of Phase 8 (before BEGIN):
const currentCollections = await db.listCollections().toArray().map(c => c.name);
const storedCollections = wizardState.sourceSchema.map(c => c.collectionName);
const added = currentCollections.filter(c => !storedCollections.includes(c));
const removed = storedCollections.filter(c => !currentCollections.includes(c));
if (added.length > 0 || removed.length > 0) {
  showDriftWarning({ added, removed }); // show non-blocking modal
}
```

---

## Phase 9 — Live ETL Engine (Step 7 of Wizard)

**Blueprint Reference:** Lines 1180–1320 (Migration Execution Screen)
**Phase Plan Reference:** Lines 620–720

### What Phase 9 Builds (Per Specs):
- Generate full rollback SQL before anything runs
- Topological sort of tables by FK dependencies (Kahn's algorithm)
- Chunk-level ETL streaming (batch size 500 rows default)
- Chunk-level error isolation (bad rows logged, not crash)
- Live IPC progress events → `ProgressEvent` stream to renderer
- Live progress bar with ETA (rows/sec calculation)
- Password masking in all log output
- Crash recovery: detect orphaned tables on next app launch, offer rollback

### ❌ What's Missing (Recommend Adding While Building Phase 9):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **Resumable Checkpoint from last batch** — store `lastProcessedId` per table, offer "Resume from Row 15,000" on crash | 🔴 High | 4h | Industry-standard AWS DMS pattern. Major viva differentiator. |
| **Dynamic Batch Auto-Tuning** — increase batch to 1,000 if avg latency <30ms; reduce to 100 if memory >200MB | 🔴 High | 2h | Self-optimizing ETL |
| **⏸️ Pause / ▶️ Resume button** — finishes current batch, saves checkpoint, waits for user | 🟡 Medium | 2h | Practical for long migrations |
| **Live throughput chart** — animated rows/sec graph over time | 🟡 Medium | 2h | Visual impact for demos |
| Migration Playbook export — `migration-playbook.md` with exact steps, settings, errors, rerunnable instructions | Low | 1h | Useful for teams |
| Parallel table processing (tables with no FK dependencies migrate simultaneously) | Low | 4h | Complex, low priority for FYP |

### 🔴 Resumable Checkpoint — Implementation Pattern:
```typescript
// After each batch completes successfully:
store.set(`checkpoint.${tableName}.lastId`, lastProcessedId);
store.set(`checkpoint.${tableName}.rowCount`, totalProcessed);

// On resume:
const lastId = store.get(`checkpoint.${tableName}.lastId`);
const cursor = collection.find({ _id: { $gt: new ObjectId(lastId) } });
// PostgreSQL: idempotent insert
await client.query(`INSERT INTO ${table} (...) ON CONFLICT (id) DO NOTHING`);
```

---

## Phase 10 — Completion & Downloads (Step 8 of Wizard)

**Blueprint Reference:** Lines 1320–1480 (Completion Screen)
**Phase Plan Reference:** Lines 720–820

### What Phase 10 Builds (Per Specs):
- Summary card: tables created, rows migrated, rows skipped, duration, rows/sec
- Confetti animation on success
- Completion screen downloads:
  1. Rollback SQL script
  2. Audit Report (PDF/HTML)
  3. ERD Diagram (PNG)
  4. Prisma Schema (`.prisma`)
  5. Refactoring Kit (`compatibility-report.md`)
- Live benchmark (1,000 queries MongoDB vs PostgreSQL)

### ❌ What's Missing (Recommend Adding While Building Phase 10):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **SHA-256 Data Integrity Certificate** on completion screen + embedded in Audit PDF | 🔴 High | 3h | The single most powerful FYP differentiator. Proof of zero corruption. |
| **Post-Migration Checklist** — collapsible action items (update connection strings, test app flows, monitor PG, keep Mongo 7 days) | 🔴 High | 1h | Extremely professional. Shows lifecycle thinking. |
| **Interactive "Re-run Benchmark" button** — examiner can click live during viva to run the 1,000 query test | 🔴 High | 1h | Must be prominently placed and visually impressive |
| Visual diff between source schema and target schema (side by side) on completion | 🟡 Medium | 2h | Good for viva presentations |
| "🏆 Export Migration Certificate" — downloadable formal document with date, row counts, duration, integrity badge | 🟡 Medium | 2h | Visual impact for FYP demo |
| ERD button in Step 2 fix — basic Mermaid preview earlier, full PNG here | 🟡 Medium | 2h | Resolves BUG 3 found in Phase 4 |
| "Commit to Git" button — auto-generates a commit message from the migration metadata | Low | 1h | — |

### 🔴 SHA-256 Integrity Certificate — Implementation Pattern:
```typescript
// Node.js crypto (no extra packages needed):
import { createHash } from 'crypto';

function canonicalizeRow(row: Record<string, unknown>): string {
  // Sort keys, normalize dates to ISO 8601
  return JSON.stringify(row, Object.keys(row).sort(),
    (_, v) => v instanceof Date ? v.toISOString() : v
  );
}

async function generateTableHash(rows: unknown[]): Promise<string> {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(canonicalizeRow(row as Record<string, unknown>));
  return hash.digest('hex');
}
```

### 🎓 Recommended Benchmark UI Layout:
```
⚡ LIVE QUERY PERFORMANCE BENCHMARK
═══════════════════════════════════════════════════════════
[ ▶ Run 1,000 Query Benchmark ]  ← Examiner clicks this LIVE

                    MongoDB Source    PostgreSQL Target    Gain
PK Lookup:          4.1 ms avg        1.2 ms avg          🚀 3.4x faster
Category Filter:    14.8 ms avg       5.9 ms avg          🚀 2.5x faster
Aggregation/JOIN:   36.2 ms avg       11.4 ms avg         🚀 3.2x faster
───────────────────────────────────────────────────────────
Average:            18.4 ms avg       6.2 ms avg          🚀 2.9x faster
═══════════════════════════════════════════════════════════
```

---

## Phase 11 — Schema Update Assistant (Workflow C)

**Blueprint Reference:** Lines 1480–1620 (Schema Update Wizard, 6 steps)
**Phase Plan Reference:** Lines 820–920

### What Phase 11 Builds (Per Specs):
- 6-step schema update wizard
- Input modes: form (pick from list) AND natural language (NL2DDL via AI)
- AI generates SQL from plain English: "Add a phone number column to users"
- Risk report specific to schema changes (NOT NULL on populated table, type mismatch)
- SQL preview with syntax highlighting + rollback SQL
- Apply button with `SET lock_timeout = '5s'` + `CREATE INDEX CONCURRENTLY`
- Version history entry created after each change

### ❌ What's Missing (Recommend Adding While Building Phase 11):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **Before/After Visual Schema Diff** — side-by-side table showing what changed (green added, red removed, grey unchanged) | 🔴 High | 3h | How DBeaver/DataGrip show schema changes |
| **Schema Dry Run** — Test the schema change in `BEGIN ... ROLLBACK` before applying | 🔴 High | 1h | Already done for migration in Phase 8, replicate for schema update |
| Batch Mode — apply multiple changes in one transaction (Add column + Add index + Rename column) | 🟡 Medium | 2h | Real-world teams do this |
| "Require confirmation for DROP/NOT NULL/type conversions" setting | 🟡 Medium | 1h | Safety rail |
| Scheduled changes (run at 02:00 AM) | Low | 3h | Complex, low priority |

### 🎓 Recommended Visual Diff Layout:
```
BEFORE (Current Schema)              AFTER (Proposed Change)
─────────────────────────────────    ─────────────────────────────────
Table: users                         Table: users
  id          VARCHAR(24) PK    →      id          VARCHAR(24) PK
  name        VARCHAR(255)       →      name        VARCHAR(255)
  email       VARCHAR(255)       →      email       VARCHAR(255)
                                 +      phone       VARCHAR(15) NULL   ← ADDED (green)
  created_at  TIMESTAMPTZ        →      created_at  TIMESTAMPTZ
```

---

## Phase 12 — PG → MongoDB Direction (Workflow B)

**Blueprint Reference:** Lines 1620–1740 (Reverse Migration)
**Phase Plan Reference:** Lines 920–1000

### What Phase 12 Builds (Per Specs):
- Reverse direction wizard (same 8 steps but PG is source, MongoDB is target)
- FK-based denormalization suggestions: 1:N → embedded arrays, 1:1 → nested objects
- M:M junction tables → referenced collections (NOT embedded)
- Layer 2 guide: what to do with views, stored procedures, triggers (cannot migrate to MongoDB)
- `mongoose` Refactoring Kit generation

### ❌ What's Missing (Recommend Adding While Building Phase 12):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **Embedding depth limit warning** — alert when proposed embedding is >2 levels deep | 🟡 Medium | 1h | MongoDB recommends max 2 levels |
| **Index Conversion Quality Check** — verify B-Tree compound index direction maps correctly to MongoDB `{field: 1}` / `{field: -1}` | 🟡 Medium | 2h | Shows attention to detail |
| **M:M handling note** — explicitly state in the UI why junction tables become referenced collections (not embedded) | 🟡 Medium | 30min | Prevents common mistakes |

---

## Phase 13 — Demo Mode

**Blueprint Reference:** Lines 1740–1820 (Demo Mode)
**Phase Plan Reference:** Lines 1000–1060

### What Phase 13 Builds (Per Specs):
- "Try with Sample Data" card on Home Dashboard
- Bundled in-memory e-commerce dataset (no external DB needed)
- Full 8-step wizard flow using in-memory data
- Demo banner shown on every step (cannot edit connection fields)
- Steps 2 & 3 shown pre-filled and locked (not skipped)

### 🔴 Cross-Document Bug Found (From Audit Pass 1):

**BUG 6 — Demo Mode contradiction in Blueprint:**
- Blueprint line 445: "Step 2 (Connect Source) is skipped"
- Blueprint line 454: "Steps 2 and 3 show pre-filled, locked connection fields"
- ➡️ **Fix:** Use "shown with pre-filled and locked fields" (richer UX, user sees what a real connection step looks like). Phase Plan Section 13.2 already uses the demo banner approach — follow that.

### ❌ What's Missing (Recommend Adding While Building Phase 13):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **"Simulate Real Issues" toggle** — inject 5–10 corrupt/missing rows into demo data | 🔴 High | 2h | Lets examiner see chunk-level error isolation live — major viva impact |
| **"Export Demo Data as SQL"** button — downloads the seed script | 🟡 Medium | 1h | Useful for testers |
| Multiple demo scenarios dropdown (E-Commerce, SaaS, Blog/CMS) | Low | 4h | Nice but not essential |

---

## Phase 14 — Auxiliary Screens (History, Schema History, Connections, Settings)

**Blueprint Reference:** Lines 1820–1891 (Auxiliary Screens)
**Phase Plan Reference:** Lines 1060–1120

### What Phase 14 Builds (Per Specs):
- Migration History screen (table with all past migrations, "View Report" link)
- Schema Version History screen (all schema changes with timestamps, rollback per change)
- Saved Connections screen (CRUD for saved connection configs)
- Settings screen: AI Provider (Gemini/Groq/Rule Engine Only), API key entry, Theme, Clear Data

### 🔴 Cross-Document Bug Found (From Audit Pass 1):

**BUG 7 — OpenRouter missing from Phase Plan Settings:**
- Blueprint Settings (line 1477): Lists OpenRouter as AI provider
- Phase Plan 14.4: Only lists Gemini/Groq/Rule Engine
- ➡️ **Fix:** Add "OpenRouter" as 4th AI provider option in Settings (allows using GPT-4, Claude, Llama under one key)

### ❌ What's Missing (Recommend Adding While Building Phase 14):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **Export All History as CSV** — date, type, source, target, status, duration, rows | 🟡 Medium | 1h | Compliance records, examiner data |
| **Global Search bar** in top header — searches across migrations, connections, schema changes, errors | 🟡 Medium | 2h | Professional UX |
| AI Usage Analytics in Settings — calls this month, tokens used | 🟡 Medium | 1h | Shows API stewardship |
| Quick Actions floating button (+) — New Migration, New Schema Update, Test Saved Connection | Low | 1h | Convenience |

---

## Phase 15 — Partial Migration

**Blueprint Reference:** Lines 1350–1400 (Partial Migration filter)
**Phase Plan Reference:** Lines 1120–1145

### What Phase 15 Builds (Per Specs):
- Collection selection checkboxes (select which collections to migrate)
- Date range filter (migrate only documents from a specific date range)
- Toggle to switch between "Full Migration" and "Partial Migration" mode
- Updates wizard to only process selected collections

### ❌ What's Missing (Recommend Adding While Building Phase 15):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **"Filter by Field Value" preset** — e.g., only migrate `orders` where `status = 'COMPLETED'` | 🟡 Medium | 2h | Real-world use case (archiving) |
| **Size estimate** — show estimated rows and data size for the selected partial scope | 🟡 Medium | 1h | User can plan before committing |

---

## Phase 16 — Testbed Applications

**Blueprint Reference:** Lines 1891–end (Testbed Apps Part 3)
**Phase Plan Reference:** Lines 1145–1182

### What Phase 16 Builds (Per Specs):
- `apps/testbed-mongo/` — Next.js + Express e-commerce app with MongoDB (20K documents)
- `apps/testbed-postgres/` — Equivalent PostgreSQL e-commerce app
- Seed scripts with intentional edge cases: mixed phone types, 3-level nesting, circular FK (categories), polymorphic specs, null variants
- Verification suite (5 automated tests: table count, row count, FK integrity, MD5 sample check, JSON field check)

### ❌ What's Missing (Recommend Adding While Building Phase 16):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **Fixed random seed** in seed script — `faker.seed(42)` — ensures identical data on every machine | 🔴 High | 10min | Essential for reproducible exams/demos |
| **REST API endpoints** on both testbeds — `GET /api/products`, `GET /api/orders/:id` — shows real app querying DB | 🟡 Medium | 2h | Demonstrates before/after app behaviour |
| **Load test script** — `load-test.js` runs 1,000 concurrent queries (500 reads, 300 writes, 200 JOINs) — generates performance numbers | 🟡 Medium | 2h | Powers the benchmark card in Phase 10 |
| **Rollback verification test** — `revert-test.js` (migrate → rollback → verify PG empty, verify Mongo untouched) | 🟡 Medium | 2h | Proves rollback works end-to-end |

---

## Phase 17 — Final Polish & .exe Build

**Blueprint Reference:** Part 2 — Final Notes
**Phase Plan Reference:** Lines 1150–1182

### What Phase 17 Builds (Per Specs):
- Full end-to-end manual test (all 8 steps with real testbed databases)
- Bug fix pass (5 known fix categories)
- Performance check (memory < 300MB, no leaks)
- `electron-builder` → Windows `.exe`
- SmartScreen documentation for installers

### ❌ What's Missing (Recommend Adding While Building Phase 17):

| Item | Priority | Time | Notes |
|---|---|---|---|
| **Smoke Test script** — `scripts/smoke-test.js` — validates rule engine, risk analyzer, topological sort without real DB | 🔴 High | 3h | Automated baseline validation. Massively more professional. |
| **`BENCHMARKS.md`** — official performance numbers: 10K rows in X sec, 100K rows in Y min, peak memory | 🟡 Medium | 1h | Data for viva questions about performance |
| **User Acceptance Testing (UAT)** — 3–5 CS students (not on team), observe usage, collect feedback, fix top 5 UX issues | 🟡 Medium | 1 day | Genuine user feedback |
| **`LICENSE` file** (MIT) | Low | 5min | Open-source readiness |
| **`CONTRIBUTING.md`** | Low | 30min | — |

### 🔴 Smoke Test — Example Structure:
```javascript
// scripts/smoke-test.js
const tests = [
  { name: 'Rule Engine: ObjectId → VARCHAR(24)',
    fn: () => assert(ruleEngine([{bsonType:'objectId', name:'_id'}])[0].targetType === 'VARCHAR(24)') },
  { name: 'Risk Analyzer: detects NOT NULL on sparse field',
    fn: testNotNullDetection },
  { name: 'Topological Sort: handles self-referencing FK (categories)',
    fn: testSelfRef },
  { name: 'ETL: masks email field correctly',
    fn: testEmailMasking },
  { name: 'Integrity: SHA-256 hash is deterministic',
    fn: testHashDeterminism },
];
```

---

---

# PART C — CROSS-CUTTING IMPROVEMENTS

---

## Enterprise Feature 1 — CDC Architecture Documentation

**NOT to build.** To document only. In `compatibility-report.md` (generated in Phase 10 Refactoring Kit):

```markdown
## From Snapshot Migration to Zero-Downtime CDC

MigrateIQ performs a point-in-time snapshot migration. For production systems
requiring zero downtime, the next architectural step is Change Data Capture (CDC).

Architecture for zero-downtime cutover AFTER running MigrateIQ:
1. MigrateIQ migrates all historical data (baseline snapshot complete)
2. Enable MongoDB Change Streams for dual-write:
   const stream = db.collection('users').watch();
   stream.on('change', async (change) => {
     await applyToPostgres(change); // parallel write during cutover window
   });
3. When change stream lag = 0ms (real-time caught up), atomically switch
   your application's connection string from MongoDB to PostgreSQL
4. Stop the Change Stream

Enterprise CDC tooling: Debezium + Kafka, AWS DMS, Striim, Fivetran
```

**Why this matters for viva:** Shows you understand enterprise-grade migration lifecycle and are honest about your tool's scope.

---

## Scope Guard — What NOT to Add

> Time is finite. Read this before adding any feature.

| ❌ Do NOT Add | Reason |
|---|---|
| Full real-time CDC pipeline | Requires Apache Kafka + Debezium + distributed infra. Out of FYP scope. Document it (above). |
| MySQL, SQLite, MSSQL, Oracle support | Dilutes quality. MongoDB ↔ PostgreSQL is the complete, coherent story. Half-built MySQL is worse. |
| Cloud SaaS / user accounts / subscriptions | Breaks "100% local, no account" core value proposition. |
| In-app SQL query editor (pgAdmin-style) | MigrateIQ is a migration planner, not a DB management GUI. Would take a full extra semester. |
| Mobile app | Database migrations happen on developer workstations. No use case. |
| Kubernetes / Docker packaging | App is a local Windows .exe. Containerization adds complexity with zero user benefit. |

---

## Viva Defense Cheatsheet (7 Must-Know Answers)

**Q1: "Why a desktop app and not a web or SaaS tool?"**
> Data privacy and network architecture. Real production databases sit inside private VPCs, behind corporate firewalls, or on localhost. A cloud SaaS migration tool requires engineers to expose their database credentials and all customer data to an external server. MigrateIQ executes entirely on the engineer's Windows PC. Connection strings are typed locally, ETL runs locally, zero credentials or data bytes traverse the public internet. This is a fundamental architectural advantage over AWS DMS.

**Q2: "MongoDB is schema-less. How can you reliably infer a schema?"**
> MigrateIQ uses probabilistic schema inference by sampling up to 100 documents per collection and performing field-level type frequency analysis. A field that is 95% String and 5% Integer is flagged as a type inconsistency in both the AI Health Score and the Risk Report. This is the same technique used by MongoDB Compass, Studio 3T, and AWS DMS for schema discovery.

**Q3: "What if the Gemini AI is unavailable — rate limited, bad key, or no internet?"**
> MigrateIQ has a deterministic fallback rule engine that activates automatically and silently if any AI call fails. The rule engine covers all 14 BSON-to-PostgreSQL type mappings, handles nested object flattening, and auto-generates child tables for arrays of objects. The UI shows `[⚡ Auto Rule-Mapped]` instead of `[🤖 AI Suggested]`. The migration never fails due to AI unavailability.

**Q4: "How do you prevent production PostgreSQL from locking up?"**
> Three layers: (1) `SET lock_timeout = '5s'` on every DDL statement — locks expire rather than block indefinitely. (2) All index creation uses `CREATE INDEX CONCURRENTLY` — tables remain readable and writable during index creation. (3) Dry Run validates the full schema inside `BEGIN...ROLLBACK` — no permanent objects created during validation.

**Q5: "What about circular foreign key dependencies?"**
> Kahn's algorithm on a dependency DAG detects cycles. If found (e.g., `users.organization_id → organizations` and `organizations.created_by → users`), it's flagged as 🔴 Critical. During migration: tables created without FK constraints first, all data inserted, then FKs added using `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID`, followed by `VALIDATE CONSTRAINT`. This is PostgreSQL's recommended deferred constraint pattern.

**Q6: "What if new data is written to MongoDB while migration runs?"**
> Yes, it's missed — by design, and we're transparent about it. The confirmation dialog before Step 7 warns: "New data written after you click Start will NOT be included." The Audit Report records exact start and end timestamps. This is the same limitation AWS DMS calls "full load mode." The Refactoring Kit documents how to extend to zero-downtime CDC using MongoDB Change Streams for teams who need it.

**Q7: "How do you handle 3-level deep nested objects?"**
> Depth-based strategy: objects at ≤2 levels are flattened with underscore separators (`address.city` → `address_city` column). Objects at 3+ levels are mapped to `JSONB` with a GIN index for efficient key-level queries. This threshold is shown in the Data Type Reference Panel in Step 4 and visible via the `⚠️ Was Nested (JSONB)` badge.

---

## Priority Matrix — All Recommended Additions

| Priority | Feature | Phase | Time |
|---|---|---|---|
| 🔴 Must Add | SHA-256 Integrity Certificate on Completion Screen | Phase 10 | 3h |
| 🔴 Must Add | Show AI fallback reason in UI | Phase 6 (retrofit) | 30min |
| 🔴 Must Add | VARCHAR(N) Truncation Check in Dry Run | Phase 8 | 2h |
| 🔴 Must Add | Schema Drift Detection before Dry Run | Phase 8 | 2h |
| 🔴 Must Add | "Auto-Fix All Non-Breaking Warnings" button | Phase 7 | 2h |
| 🔴 Must Add | "Simulate Real Issues" toggle in Demo Mode | Phase 13 | 2h |
| 🔴 Must Add | Before/After Visual Schema Diff in Schema Update | Phase 11 | 3h |
| 🔴 Must Add | Mapping Export/Import as JSON | Phase 5 (retrofit) | 3h |
| 🔴 Must Add | PII Masking column in Schema Mapper | Phase 5 (retrofit) | 4h |
| 🔴 Must Add | Fixed random seed in testbed (`faker.seed(42)`) | Phase 16 | 10min |
| 🔴 Must Add | Smoke Test script (`scripts/smoke-test.js`) | Phase 17 | 3h |
| 🔴 Must Add | Post-Migration Checklist on Completion Screen | Phase 10 | 1h |
| 🔴 Must Add | Fix: 12th feature card on Home page | Phase 1 (fix) | 30min |
| 🔴 Must Add | Fix: How It Works step labels match wizard | Phase 1 (fix) | 1h |
| 🔴 Must Add | Fix: `sort_order` column for array→child tables | Phase 5/6 (fix) | 1h |
| 🟡 Should Add | Resumable Checkpoint from last batch | Phase 9 | 4h |
| 🟡 Should Add | Dynamic Batch Auto-Tuning | Phase 9 | 2h |
| 🟡 Should Add | Interactive Re-run Benchmark button | Phase 10 | 1h |
| 🟡 Should Add | OpenRouter as 4th AI provider in Settings | Phase 14 | 2h |
| 🟡 Should Add | "What if I ignore this?" risk simulator | Phase 7 | 2h |
| 🟡 Should Add | Pause / Resume button during migration | Phase 9 | 2h |
| 🟡 Should Add | Schema Dry Run in Schema Update Assistant | Phase 11 | 1h |
| 🟡 Should Add | Real-Time throughput chart during migration | Phase 9 | 2h |
| 🟡 Should Add | Performance Estimate after Dry Run | Phase 8 | 1h |
| 🟡 Should Add | `BENCHMARKS.md` with official performance numbers | Phase 17 | 1h |
| 🟡 Should Add | REST API on testbed apps | Phase 16 | 2h |
| 🟡 Should Add | Load test script + Rollback verification test | Phase 16 | 4h |
| 🟡 Should Add | React Error Boundary in desktop shell | Phase 2 (retrofit) | 2h |
| 🟡 Should Add | Connection string real-time validator | Phase 4 (retrofit) | 2h |
| 🟡 Should Add | Export All History as CSV | Phase 14 | 1h |
| 🟢 Optional | Keyboard shortcuts panel | Phase 2 | 2h |
| 🟢 Optional | Onboarding tour (first run) | Phase 3 | 3h |
| 🟢 Optional | "Migration Certificate" download | Phase 10 | 2h |
| 🟢 Optional | UAT with 5 external testers | Phase 17 | 1 day |
| 🟢 Optional | AI confidence scores per mapping row | Phase 6 | 2h |
| 🟢 Optional | Bulk operations toolbar in Schema Mapper | Phase 5 | 2h |
| 🟢 Optional | Field search/filter in Schema Mapper | Phase 5 | 2h |

---

*End of Final Master Improvement Report*
*Compiled: September 2026 | MigrateIQ FYP Project*
*Source: Audit Pass 1 (`fyp-blueprint-audit-report.md`) + Audit Pass 2 (`f`) + Fresh re-read of both planning documents*
