# Phase 2 Documentation — Desktop App Shell

> **Phase Goal:** Build the persistent Electron app shell with sidebar navigation and placeholder screens for all routes.
> **Status:** Complete & Verified ✅

---

## 1. Phase Summary & Goal

In Phase 2, we built the foundational **Desktop App Shell** for MigrateIQ — the persistent outer frame that stays on screen at all times. This includes:

* **Left Sidebar Navigation** with 7 navigation items (Home, New Migration, New Schema Update, History, Schema History, Connections, Settings)
* **React Router v6** integration for in-app navigation
* **7 Placeholder Screen Components** (one for each route)
* **App Shell Layout** (two-column: Sidebar + Main Content Area)
* **LIGHT THEME styling** per AGENTS.md requirements (bright whites, light grays, Royal Blue `#2563EB` accents)

---

## 2. Files Created & Modified

### New Components Created:
| File Path | Description |
|---|---|
| `apps/desktop/renderer/src/components/AppShell.tsx` | Main layout wrapper — renders Sidebar + Outlet for route content |
| `apps/desktop/renderer/src/components/Sidebar.tsx` | Left navigation panel with 7 nav items, logo, and version badge |

### New Screen Components Created:
| File Path | Route | Description |
|---|---|---|
| `apps/desktop/renderer/src/screens/HomeDashboard.tsx` | `/` | Home Dashboard (to be built in Phase 3) |
| `apps/desktop/renderer/src/screens/MigrationWizard.tsx` | `/migrate` | 8-step migration wizard (Phases 4-10) |
| `apps/desktop/renderer/src/screens/SchemaUpdateWizard.tsx` | `/schema-update` | 6-step schema update assistant (Phase 11) |
| `apps/desktop/renderer/src/screens/HistoryScreen.tsx` | `/history` | Past migrations log (Phase 14) |
| `apps/desktop/renderer/src/screens/SchemaHistoryScreen.tsx` | `/schema-history` | Database schema change timeline (Phase 14) |
| `apps/desktop/renderer/src/screens/ConnectionsScreen.tsx` | `/connections` | Saved database connections manager (Phase 14) |
| `apps/desktop/renderer/src/screens/SettingsScreen.tsx` | `/settings` | AI config and app preferences (Phase 14) |

### Modified Files:
| File Path | Changes |
|---|---|
| `apps/desktop/renderer/src/App.tsx` | Replaced Phase 0 scaffold with React Router (`HashRouter`, `Routes`, `Route`) and integrated AppShell |
| `apps/desktop/package.json` | Added `react-router-dom@^6.22.0` dependency |

### Existing Files (Already Correct):
| File Path | Status |
|---|---|
| `apps/desktop/renderer/src/styles/app.css` | ✅ Already contains LIGHT THEME design tokens per AGENTS.md |
| `apps/desktop/renderer/index.html` | ✅ Already imports Inter font from Google Fonts |
| `apps/desktop/main/main.ts` | ✅ Already configured (Phase 0) |
| `apps/desktop/main/preload.ts` | ✅ Already configured (Phase 0) |

---

## 3. Architecture & Key Implementation Details

### 3.1 React Router Setup
- **Router Type:** `HashRouter` (Electron-compatible, uses `#` in URLs)
- **Routes Structure:** All routes are children of the `<AppShell />` layout route
- **Navigation:** `useNavigate()` hook used in Sidebar to handle clicks
- **Active State Detection:** `useLocation()` hook compares `pathname` to highlight active nav item

### 3.2 Sidebar Navigation Component
**Features:**
- 7 navigation items with emoji icons
- Active item highlighted with `var(--brand-primary)` background (#2563EB Royal Blue)
- Hover states for non-active items (light gray background)
- Logo at top (MigrateIQ branding)
- Version badge at bottom (`v1.0.0`)
- Light theme colors: sidebar background `#F1F5F9` (Slate-100)

**Navigation Items:**
1. 🏠 Home → `/`
2. 🔄 New Migration → `/migrate`
3. ✏️ New Schema Update → `/schema-update`
4. 📋 History → `/history`
5. 📜 Schema History → `/schema-history`
6. 🔌 Connections → `/connections`
7. ⚙️ Settings → `/settings`

### 3.3 App Shell Layout
**Structure:**
```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (240px)         │ Main Content Area (flex: 1)   │
│ • Logo                  │                                │
│ • 7 Nav Items           │  <Outlet /> (route content)    │
│ • Version Badge         │                                │
└──────────────────────────────────────────────────────────┘
```

**CSS Layout:**
- Display: `flex` (horizontal)
- Sidebar: Fixed width `240px`, full height `100vh`
- Main Content: `flex: 1`, scrollable (`overflowY: auto`)
- Background: `var(--bg-canvas)` (#F8FAFC — light gray canvas)

### 3.4 Design Token Compliance (AGENTS.md)
All colors strictly follow the LIGHT THEME specification:

| Token | Value | Usage |
|---|---|---|
| `--bg-canvas` | `#F8FAFC` | App canvas background |
| `--bg-surface` | `#FFFFFF` | Cards and elevated surfaces |
| `--bg-sidebar` | `#F1F5F9` | Sidebar background |
| `--border-subtle` | `#E2E8F0` | 1px borders |
| `--text-primary` | `#0F172A` | Headings and body text |
| `--text-muted` | `#64748B` | Labels and descriptions |
| `--brand-primary` | `#2563EB` | Primary action blue (active nav) |
| `--brand-primary-hover` | `#1D4ED8` | Hover state |

---

## 4. Verification & Test Results

| Checklist Item | Result |
|---|---|
| `npm run dev` starts Electron app without errors | ✅ Passed |
| Sidebar visible on the left with 7 nav items | ✅ Passed |
| Clicking "Home" navigates to HomeDashboard placeholder | ✅ Passed |
| Clicking "New Migration" navigates to MigrationWizard placeholder | ✅ Passed |
| Clicking "Settings" navigates to SettingsScreen placeholder | ✅ Passed |
| Active nav item highlighted in Royal Blue (`#2563EB`) | ✅ Passed |
| Hover states work on non-active nav items | ✅ Passed |
| Logo and version badge render correctly | ✅ Passed |
| App uses LIGHT THEME (bright, not dark) | ✅ Passed |
| TypeScript check (`npx tsc --noEmit`) passes with 0 errors | ✅ Passed (Verified: 0 errors) |
| Vite dev server starts on `http://localhost:5173` | ✅ Passed |
| No console errors in Electron DevTools | ✅ Passed |

---

## 5. Edge Cases & FYP Report Notes

**Key Technical Highlights:**

1. **HashRouter for Electron Compatibility:**
   - Used `HashRouter` instead of `BrowserRouter` because Electron apps use the `file://` protocol. Hash-based routing (`#/migrate`) works correctly without a web server.

2. **Outlet Pattern for Nested Routes:**
   - The `<AppShell />` component uses `<Outlet />` from React Router, allowing all child routes to render inside the main content area while keeping the sidebar persistent.

3. **CSS-Only Hover States:**
   - Implemented hover effects using inline React style objects with `onMouseEnter`/`onMouseLeave` handlers (no external CSS dependencies). This keeps the component self-contained.

4. **No TypeScript `any` Usage:**
   - All components have explicit `Props` interfaces (even if empty). This maintains strict typing standards per AGENTS.md.

5. **Light Theme Compliance:**
   - Sidebar background is `#F1F5F9` (light silver-gray), NOT dark. Active nav items use Royal Blue (`#2563EB`) as an ACCENT, not as a large background.

---

## 6. Next Phase Handoff (Phase 3)

**Prerequisites Established:**
- ✅ Full navigation shell is operational
- ✅ All 7 routes are accessible via sidebar
- ✅ Placeholder screens are in place
- ✅ LIGHT THEME design system is applied

**Upcoming Milestone:** **Phase 3 — Home Dashboard**

Build the first real screen the user sees:
- 3 large entry cards (Migrate My Database, Update My Database, Try with Sample Data)
- Recent Migrations table (with empty state)
- Resume migration banner (if unfinished migration exists in `electron-store`)

---

## 7. Git Commit Command

✅ Phase 2 is complete and documented.

Run this in your terminal to save your progress:

```bash
git add .
git commit -m "feat: phase-02 — desktop app shell with sidebar navigation and 7 routes"
```
