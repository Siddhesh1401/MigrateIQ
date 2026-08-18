# MigrateIQ - AI Rules & Agent Directives

These rules apply automatically to every AI session in this workspace.

## 1. Project Identity & Source of Truth
- **Project Name:** MigrateIQ
- **App Title (displayed in UI):** "MigrateIQ" — use this name consistently across all UI screens, window titles, sidebar headers, and the landing website.
- **Read the Blueprints First:** Before starting any new phase or writing any code, you MUST cross-reference `phase_plan-v2.md` and `product_blueprint-v7.md`.
- **Strict Phase Scope:** Do not jump ahead. Build only the features specified in the current phase/task.
- **Do Not Guess:** If the blueprint or requirements lack detail for an edge case, ask the user before writing code.

## 2. Technology Stack & Constraints
- **Web Frontend:** Next.js 14 (App Router), React, Vanilla CSS (No Tailwind CSS unless explicitly requested).
- **Desktop App:** Electron 28+, React 18, TypeScript, Vite.
- **Backend/ETL Engine:** Node.js (inside Electron Main Process), `mongodb` native driver, `pg` (node-postgres).
- **State Management & Storage:** Zustand and `electron-store`.
- **Typing Standard:** Strictly TypeScript. Never use `any`, `@ts-ignore`, or `@ts-nocheck`.

## 3. UI/UX & Design Guidelines
- **Theme & Mode:** Strictly **LIGHT THEME** — a clean, bright, white-and-blue interface. Do NOT use dark backgrounds, dark sidebars, or dark cards.
- **Design Tokens & Palette:**
  - **Canvas Background:** `#F8FAFC` (Slate-50, very light gray — not white, not dark)
  - **Card / Surface Background:** `#FFFFFF` (Pure White)
  - **Sidebar / Header Surface:** `#F1F5F9` (Slate-100, light silver-gray)
  - **Borders & Dividers:** `#E2E8F0` (Slate-200, crisp 1px borders)
  - **Primary Text:** `#0F172A` / `#1E293B` (Deep Navy Slate — for headings and body text)
  - **Muted Text:** `#64748B` (Slate-500 — for labels, descriptions, placeholders)
  - **Primary Brand / Action:** `#2563EB` (Royal Tech Blue — buttons, active sidebar items, links. Hover: `#1D4ED8`)
  - **AI & Secondary Accent:** `#0284C7` (Sky Blue — AI badges, health score, NL2DDL elements)
  - **Status Badges:** Success `#16A34A` (Green), Warning `#D97706` (Amber), Critical Error `#DC2626` (Crimson)
  - **⚠️ Important:** The blue (`#2563EB`) is used as an ACCENT on white/light-gray surfaces. Never use dark blue as a background color for large sections.
- **Typography & Details:** Use the **Inter** font (import from Google Fonts). Use generous whitespace, clean card layouts, subtle 1px borders, and smooth transitions (200–300ms ease).
- **Micro-interactions:** All buttons must have hover states. Cards must have subtle hover shadow lift. Sidebar nav items must have active/hover highlight. Use loading skeletons (not spinners) where data loads.
- **UI First, Logic Later:** When building a screen, scaffold the UI with mock/hardcoded data first. Connect backend database logic only after the user approves the look and feel.

## 4. Engineering Standards & Code Hygiene
- **Root-Cause Problem Solving:** Never apply band-aid fixes or suppress errors with empty `catch {}` blocks. Always identify and resolve the underlying issue.
- **IPC Pattern:** All Electron IPC handlers must use `ipcMain.handle` (not `ipcMain.on`) and always return a typed object: `{ success: boolean, data?: T, error?: string }`. Never throw unhandled errors across IPC channels.
- **Verification Loop:** After making modifications, run type checks (`npx tsc --noEmit`) or verify that the app builds without errors before reporting completion.
- **Preserve Existing Logic:** Do not overwrite, delete, or break working code or comments unrelated to the current task.
- **Component Architecture:** Use explicit named exports, clean file organization, and self-contained reusable components. Define a `Props` TypeScript interface above every React component.
- **File Naming:** React components use PascalCase (e.g., `SchemaMapper.tsx`). Utility files use camelCase (e.g., `ruleEngine.ts`). IPC handler files go in `main/handlers/`. Engine logic goes in `main/engine/`.

## 5. Work Process & Pre-execution Protocol
- **Technical Specification First:** When instructed to start a phase, your VERY FIRST response must be a concise "Technical Implementation Specification" outlining file paths, npm packages, and planned architecture. Wait for user approval before coding.
- **Terminal Execution:** You are authorized to run terminal commands (`npm install`, `npm run dev`, test commands) to scaffold and verify code.
- **Git Discipline:** After the phase documentation file has been written to the `documentation/` folder, your FINAL step is to display the git commit command for the user to run manually. Do not run git commands yourself.

## 6. Post-Phase Documentation Protocol (`documentation/` Folder)
- **Trigger:** When a phase is completed AND the user has tested and verified that everything works properly, you MUST automatically generate a comprehensive documentation file for that phase.
- **Location:** All phase documentation must be saved in the `documentation/` folder (e.g., `documentation/phase-00-monorepo-foundation.md`, `documentation/phase-01-landing-website.md`, etc.).
- **Document Structure:** Each phase documentation file must follow this standardized template:
  1. **Phase Summary & Goal:** Concise summary of what was accomplished in this phase.
  2. **Files Created & Modified:** Full list of relative file paths with a brief 1-line description of their purpose.
  3. **Architecture & Key Implementation Details:** IPC channels introduced, state management models, algorithms (e.g., topological sort, batching logic), or UI components built.
  4. **Verification & Test Results:** Explicit record of the "Done when" checklist items that were verified and passed.
  5. **Edge Cases & FYP Report Notes:** Any edge cases handled, lessons learned, or key technical highlights suitable for the final project report/viva.
  6. **Next Phase Handoff:** Prerequisites and state established for the upcoming phase.
- **Git Step (always last):** After the documentation file is saved, display this message to the user:
  ```
  ✅ Phase XX is complete and documented.
  Run this in your terminal to save your progress:

  git add .
  git commit -m "feat: phase-XX — [one-line description of what was built]"
  ```
