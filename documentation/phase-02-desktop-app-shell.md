# Phase 2 Documentation — Desktop App Shell & Navigation Foundation

> **Phase Goal:** Build the persistent Electron app shell with hardened security, React Error Boundary protection, sidebar navigation, and placeholder screens for all routes.
> **Status:** Complete & Enterprise Verified ✅

---

## 1. Phase Summary & Goal

In Phase 2, we built and hardened the foundational **Desktop App Shell** for MigrateIQ — the persistent outer frame that stays on screen at all times. This includes:

* **Persistent Left Sidebar Navigation** with 8 navigation items (Home, New Migration, New Schema Update, History, Schema History, Connections, AI Usage & Tokens, Settings)
* **React Router v6** integration (`HashRouter`) for Electron-native in-app navigation
* **Crash-Resilient React Error Boundary** wrapping the router outlet to isolate view-level errors without blank-screening the desktop app
* **Hardened Electron Main Process**: Disabled Chromium application menus on Windows, enforced standard Chromium sandbox (`sandbox: true`), and guarded external URLs with `setWindowOpenHandler` and `will-navigate`
* **LIGHT THEME styling** strictly following `AGENTS.md` (Canvas `#F8FAFC`, Surfaces `#FFFFFF`, Royal Blue `#2563EB` accents)

---

## 2. Files Created & Modified

### Components:
| File Path | Description |
|---|---|
| `apps/desktop/renderer/src/components/AppShell.tsx` | Main layout wrapper — renders Sidebar and protected `<Outlet />` using CSS layout classes |
| `apps/desktop/renderer/src/components/ErrorBoundary.tsx` | Enterprise React Error Boundary catching render exceptions with graceful dashboard recovery |
| `apps/desktop/renderer/src/components/Sidebar.tsx` | Left navigation panel with brand header, section dividers, active highlight, and version badge |

### Screen Components:
| File Path | Route | Description |
|---|---|---|
| `apps/desktop/renderer/src/screens/HomeDashboard.tsx` | `/` | Home Dashboard screen |
| `apps/desktop/renderer/src/screens/MigrationWizard.tsx` | `/migrate` | 8-step migration wizard |
| `apps/desktop/renderer/src/screens/SchemaUpdateWizard.tsx` | `/schema-update` | 6-step schema update assistant |
| `apps/desktop/renderer/src/screens/HistoryScreen.tsx` | `/history` | Past migrations log (Phase 14) |
| `apps/desktop/renderer/src/screens/SchemaHistoryScreen.tsx` | `/schema-history` | Database schema change timeline (Phase 14) |
| `apps/desktop/renderer/src/screens/ConnectionsScreen.tsx` | `/connections` | Saved database connections manager (Phase 14) |
| `apps/desktop/renderer/src/screens/AIUsageScreen.tsx` | `/ai-usage` | AI token tracking & telemetry screen |
| `apps/desktop/renderer/src/screens/SettingsScreen.tsx` | `/settings` | AI config and app preferences (Phase 14) |

### Main & Infrastructure Files:
| File Path | Description |
|---|---|
| `apps/desktop/main/main.ts` | Main process window lifecycle with sandbox, window open guards, and menu suppression |
| `apps/desktop/main/preload.ts` | Context bridge exposing `window.electronAPI.invoke` and `window.electronAPI.on` |
| `apps/desktop/renderer/src/styles/app.css` | Global design tokens, scrollbar styling, and `.app-shell-*` layout utilities |
| `scripts/test-phase2-phase3-verification.js` | Automated verification suite validating Phase 2 & 3 contracts |

---

## 3. Architecture & Key Implementation Details

### 3.1 Fault-Tolerant Shell Architecture
```
┌──────────────────────────────────────────────────────────┐
│  BrowserWindow (1280×800, Sandbox: true, Light Theme)    │
│  ┌────────────────────────┬────────────────────────────┐ │
│  │ Sidebar (220px)        │ Main Content Area          │ │
│  │ • Brand Header         │                            │ │
│  │ • Main Section         │  <ErrorBoundary>           │ │
│  │ • Data Section         │    <Outlet /> (Routes)     │ │
│  │ • System Section       │  </ErrorBoundary>          │ │
│  │ • Version Badge        │                            │ │
│  └────────────────────────┴────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Security Hardening
1. **Disabled Application Menu:** `Menu.setApplicationMenu(null)` eliminates default Windows Chromium menu bars, preventing accidental devtools or reload shortcuts in production.
2. **Popup & Window Isolation:** `mainWindow.webContents.setWindowOpenHandler` intercepts all external links and routes them to `shell.openExternal(url)` in the user's default browser, returning `{ action: 'deny' }` to Electron.
3. **Navigation Lockdown:** The `will-navigate` event prevents malicious or unexpected links from taking over the local Electron renderer window.
4. **Context Isolation & Sandboxing:** `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.

---

## 4. Verification & Test Results

| Checklist Item | Result |
|---|---|
| `npm run typecheck` across all monorepo workspaces | ✅ Passed (0 errors) |
| `npm run build --workspace=@migrateiq/desktop` production bundle | ✅ Passed (0 errors) |
| `node scripts/test-phase2-phase3-verification.js` test suite | ✅ Passed (22/22 checks passed) |
| ErrorBoundary catches child errors and renders recovery UI | ✅ Verified |
| AppShell uses CSS layout classes instead of inline styles | ✅ Verified |
| Default Chromium application menu bar is suppressed | ✅ Verified |
| Sidebar routes cleanly across all 8 navigation targets | ✅ Verified |

---

## 5. Next Phase Handoff (Phase 3)

The persistent desktop shell is fortified with robust security, error isolation, and design token compliance, providing an unshakeable foundation for the Home Dashboard (Phase 3) and downstream migration wizards.
