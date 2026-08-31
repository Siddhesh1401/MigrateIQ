# 🎓 MigrateIQ — Teacher Presentation Guide
### Phases 0 → 4 | Complete Explanation, Demo Script & Viva Q&A

---

## 📌 How to Use This Document

1. **Section 1** — Elevator pitch (memorize this — say it first)
2. **Section 2** — What each phase built (walk through during demo)
3. **Section 3** — How the system works technically (for "how does it work" questions)
4. **Section 4** — Teacher Q&A (predicted hard questions + your answers)
5. **Section 5** — Smart talking points (things to say that impress)
6. **Section 6** — What to show on screen (demo order)

---

## 1. 🎯 Elevator Pitch (Say This First)

> **"MigrateIQ is a desktop application that automates database migration between MongoDB and PostgreSQL. It reads the source database schema, maps fields intelligently, identifies risks before anything is moved, and transfers the data — all without writing a single line of SQL manually. We built it as an Electron desktop app with a React frontend, a Node.js backend, and it works 100% offline. Currently we have completed the first 4 phases — the foundation, the marketing website, the app shell, the dashboard, and the database connection engine."**

---

## 2. 📦 What Each Phase Built — Walk-Through

### Phase 0 — Monorepo Foundation
**What it is:** The base project structure before any feature was written.

**What we did:**
- Set up a **monorepo** — one Git repository with 3 projects inside it:
  - `apps/web` — the marketing website (Next.js)
  - `apps/desktop` — the desktop app (Electron + React)
  - `packages/shared` — shared TypeScript types used by both

- Configured **TypeScript strictly** (no `any`, no `@ts-ignore` anywhere)
- Set up **npm workspaces** so all 3 apps share code from one `node_modules`
- Defined all shared data types (what a "ConnectionConfig" looks like, what a "FieldMapping" looks like, etc.)

**Why monorepo?**
> So the marketing website and desktop app share the same type definitions. If we change what a `ConnectionConfig` looks like, both apps update automatically. No copy-paste.

---

### Phase 1 — Landing Website (Public Marketing Portal)
**What it is:** The public-facing website at `localhost:3000` — 5 full pages built in Next.js 14.

**Pages built:**
| Page | What it shows |
|---|---|
| `/` (Home) | Interactive demo mockup, architecture diagram, database ecosystem grid |
| `/how-it-works` | 8-step migration pipeline with live simulator |
| `/features` | 12 feature cards, competitive comparison with Flyway, Prisma, AWS DMS |
| `/download` | Download button, system requirements, installation guide, FAQ |
| `/about` | Project mission, team cards, technology stack |

**Technology:** Next.js 14 App Router, Vanilla CSS, TypeScript — no Tailwind, no templates.

---

### Phase 2 — Desktop App Shell
**What it is:** The Electron app's outer "frame" — the shell that stays visible at all times.

**What we built:**
- **Electron window** opens and loads React (using Vite for fast dev)
- **Left Sidebar** with 7 navigation items (Home, New Migration, Schema Update, History, etc.)
- **React Router v6** handles navigation between screens (no page reload — it's an SPA inside Electron)
- **Security layer:** `contextBridge` with `contextIsolation: true` — the React frontend cannot directly call Node.js. It must go through a typed `electronAPI` bridge.

**Why Electron?**
> It runs as a real desktop application (.exe on Windows). It can connect directly to local databases (localhost), which a web app can't do because of browser security restrictions.

---

### Phase 3 — Home Dashboard
**What it is:** The landing screen inside the app — the first thing users see.

**What we built:**
- 3 action cards (Migrate, Schema Update, Demo Mode)
- Resume banner that appears if the user had an unfinished migration saved
- Recent migrations history table (currently shows empty state)
- **Session persistence** using `electron-store` — if you close and reopen the app mid-migration, it remembers where you were

---

### Phase 4 — Database Connectivity (Steps 1–3 of 8)
**This is the most technically complex phase. Spend the most time here.**

**What we built:**
- **Step 1:** User picks migration direction (MongoDB → PostgreSQL OR PostgreSQL → MongoDB)
- **Step 2:** User enters their Source database connection details → MigrateIQ connects and reads the schema
- **Step 3:** User enters their Target database details → MigrateIQ connects and inspects what's already there

**Technical depth:**
- The Electron Main Process runs real Node.js code using the official `mongodb` and `pg` (node-postgres) drivers
- Schema introspection: MigrateIQ samples 100 documents per collection to **infer** field types
- PostgreSQL introspection: queries `information_schema.tables` and `information_schema.columns` for existing schema
- All DB calls go through IPC (Inter-Process Communication) — the UI talks to the backend via named channels

---

## 3. ⚙️ How It Works — Technical Explanation

### The Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON APP                          │
│                                                          │
│  ┌─────────────────┐         ┌─────────────────────┐   │
│  │  RENDERER        │  IPC   │  MAIN PROCESS        │   │
│  │  (React + Vite)  │ ◄────► │  (Node.js)           │   │
│  │                  │        │                       │   │
│  │  • UI Screens    │        │  • MongoDB Driver     │   │
│  │  • Zustand Store │        │  • PostgreSQL Driver  │   │
│  │  • Forms         │        │  • electron-store     │   │
│  └─────────────────┘        └─────────────────────┘   │
│                                                          │
│           contextBridge (Security Layer)                 │
└─────────────────────────────────────────────────────────┘
         │                         │
    ─────▼─────             ───────▼──────
    MongoDB Server           PostgreSQL Server
    (source)                 (target)
```

### Step by Step — What Happens When User Clicks "Test Connection"

1. User fills in the connection form (host, port, database name, username, password)
2. React calls `window.electronAPI.invoke('db:connect-mongodb', config)`
3. This is **intercepted by the preload script** — it's a secure bridge
4. The IPC message travels from Renderer → Main Process
5. Main Process runs: `MongoClient.connect(connectionString, { serverSelectionTimeoutMS: 5000 })`
6. For each collection found, it samples 100 documents and **infers** field types from the data
7. Result is packaged as `{ success: true, data: [...SourceSchema] }` and sent back
8. React receives it, stores it in Zustand, and shows the schema preview

### Schema Inference Algorithm (MongoDB)

```
For each document in the 100-sample:
  For each key in the document:
    - What BSON type is this value? (string, int, bool, date, array, object, null)
    - Was it ever null? → mark as nullable
    - Is it an array? → mark as isArray
    - Is it an object/subdocument? → mark as nested
```

This is critical — MongoDB has **no fixed schema**. Different documents in the same collection can have different fields. MigrateIQ handles this by taking the **union of all fields** across the sample.

### Why IPC? Why Not Just Import Node.js in React?

> Electron has two separate processes:
> - **Renderer Process:** runs Chrome/V8 — it's a web browser. For security, it has no access to Node.js APIs (filesystem, network drivers, etc.)
> - **Main Process:** runs Node.js — it can do everything but has no UI
>
> IPC (Inter-Process Communication) is the bridge. The preload script acts as a gatekeeper — it only exposes exactly the functions we allow. This is the same security model as a web app calling a REST API.

---

## 4. ❓ Predicted Teacher Questions — With Your Answers

---

### Q1: "Why did you choose Electron? Why not a web app?"

**Answer:**
> "A web app runs in a browser and cannot make direct TCP connections to databases. Our tool needs to connect to `localhost:27017` (MongoDB) or `localhost:5432` (PostgreSQL) on the user's machine. Only a desktop app (Electron) can do this. Also, users want to migrate sensitive production databases — they don't want to upload their database credentials to a cloud server. Electron runs 100% locally."

---

### Q2: "What is IPC and why do you use it?"

**Answer:**
> "Electron has two separate JavaScript runtimes — Renderer (Chrome, handles UI) and Main (Node.js, handles system operations). They run in isolation for security. IPC (Inter-Process Communication) is how they talk to each other. We call `ipcMain.handle('db:connect-mongodb', handler)` in Main and `window.electronAPI.invoke('db:connect-mongodb', config)` in the Renderer. The preload script creates this typed bridge using `contextBridge.exposeInMainWorld`."

---

### Q3: "How does MongoDB schema inference work if MongoDB has no schema?"

**Answer:**
> "That's the exact problem we solve. MongoDB is schema-less — every document can have different fields. We sample the first 100 documents from each collection and take the union of all field names seen. For each field, we check what BSON type the value is (string, integer, boolean, date, array, nested object, null). If a field appears as null in any document, we mark it as 'nullable'. This gives us a probabilistic schema — it's not guaranteed to cover 100% of edge cases, but for a migration tool this is the industry standard approach. AWS DMS and Studio 3T do the same thing."

---

### Q4: "What happens if two users have different schemas in the same MongoDB collection?"

**Answer:**
> "That's a real-world scenario called 'polymorphic documents'. For example, a `products` collection might have documents with different fields for electronics vs clothing. Our inference marks all fields as optional/nullable since they don't appear in every document. In Phase 5 (Schema Mapper) we will flag these to the user and let them decide: do you want separate PostgreSQL tables for each type, or one wide table with nullable columns? This is actually listed as a known challenge in our `documentation/migration-challenges-and-solutions.md` file."

---

### Q5: "Is the migration safe? What if something goes wrong halfway?"

**Answer:**
> "Safety is a core design principle. We haven't built the actual migration engine yet (Phase 8), but the architecture is designed with safety in mind:
> - **Phase 5 (Schema Mapper):** User reviews and approves every field mapping
> - **Phase 6 (Risk Report):** We flag name collisions, data type mismatches, non-migratable features (triggers, stored procedures)
> - **Phase 7 (Dry Run):** We test-migrate a small batch first with zero permanent writes
> - Only after the user confirms the dry run do we do the full migration
>
> The source database is **never modified**. We only write to the target."

---

### Q6: "What is Zustand? Why not Redux?"

**Answer:**
> "Zustand is a lightweight React state management library. Redux is powerful but adds a lot of boilerplate — actions, reducers, selectors. For our wizard which has a linear 8-step flow, Zustand gives us a simple store with direct setters. We use it to share the connection configs, schema data, and current step number between all 8 screens without prop drilling. Redux would be overkill for this pattern."

---

### Q7: "What if the user enters wrong credentials?"

**Answer:**
> "We have a 5-second timeout on all connection attempts (`serverSelectionTimeoutMS: 5000`). If the connection fails, the IPC handler returns `{ success: false, error: 'error message' }`. We parse common errors and show plain-English guidance:
> - `SRV error` or `ENOTFOUND` → 'Your corporate network may be blocking DNS SRV records. Try switching to a direct connection string.'
> - `Authentication failed` → 'Check your username and password'
> - `ECONNREFUSED` → 'Database server is not running at that host:port'
>
> We never show raw stack traces to the user."

---

### Q8: "What is a monorepo? Why use it?"

**Answer:**
> "A monorepo is a single Git repository that contains multiple projects — in our case, the website, the desktop app, and a shared types package. The advantage is that all three share the same TypeScript type definitions. If `ConnectionConfig` needs a new field, we add it once in `packages/shared/src/types.ts` and it automatically applies to both the website and the desktop app. There's no risk of the two apps having different versions of the same type. We use npm workspaces to link them."

---

### Q9: "How do you handle password security?"

**Answer:**
> "Passwords entered in the connection form are:
> 1. Never stored in the React state longer than necessary
> 2. Passed over IPC only to the Main Process where the DB driver needs them
> 3. If the user checks 'Save Connection', stored using `electron-store` which writes to a JSON file on the user's machine — never sent to any server
>
> In production, we would add OS-level credential storage using the system keychain. This is a known future improvement."

---

### Q10: "What's the difference between your tool and just using pg_dump or mongodump?"

**Answer:**
> "`pg_dump` and `mongodump` only backup data in the **same format** — MongoDB to MongoDB, or PostgreSQL to PostgreSQL. They can't cross the boundary. MigrateIQ migrates **across database systems** — it reads MongoDB's document format, converts it to relational rows, creates the PostgreSQL tables, and inserts the data. This is called **heterogeneous database migration**. Tools like AWS Database Migration Service (DMS) do this commercially but cost thousands of dollars and require cloud access. MigrateIQ is a free, local, offline alternative."

---

### Q11: "Why Next.js for the website? Why not just plain HTML?"

**Answer:**
> "Next.js 14 with App Router gives us:
> - **Server-side rendering** for fast first paint and SEO
> - **File-based routing** — each folder in `app/` is a route
> - **TypeScript** out of the box
> - Shared type imports from `@migrateiq/shared`
>
> Plain HTML would work but Next.js is what real companies use and the website structure benefits from SSR. It also allows us to eventually serve the `.exe` installer file from the `/download` page."

---

### Q12: "What's the most challenging technical problem you solved?"

**Answer:**
> "The hardest problem was handling Supabase/Neon cloud PostgreSQL connections. These services use a **connection pooler** (PgBouncer) which has different behavior from direct PostgreSQL. PgBouncer doesn't support certain commands and has a 'transaction mode' that breaks session-level settings. We detect cloud pooler URLs by checking if the hostname contains `supabase.com`, `neon.tech`, `railway.app`, or `render.com`, and show a specific warning about pooler limitations. We also pass SSL parameters correctly for each provider."

---

### Q13: "Why TypeScript? Why not plain JavaScript?"

**Answer:**
> "TypeScript gives us compile-time type safety. In a project where data flows from a MongoDB driver → IPC → Zustand → React UI, a single wrong property name causes a silent bug that's very hard to debug at runtime. With TypeScript, if we rename a field in `ConnectionConfig`, the compiler immediately tells us every place that breaks. We enforce strict mode — no `any` types allowed anywhere. This is especially important for IPC handlers because mismatched types between Main and Renderer are a common source of Electron bugs."

---

### Q14: "What if MongoDB has 10 million documents? Won't sampling 100 be too small?"

**Answer:**
> "That's a valid concern and we document it as a known trade-off. 100 documents gives us a fast preview — if the collection has consistent schema (which most production databases do after a few months of use), 100 is plenty. For very inconsistent schemas, we plan to add an option to increase the sample size in Phase 5 settings. The alternative — scanning all 10 million documents — would take minutes or hours just for the preview step, which is unacceptable UX. The industry benchmark (MongoDB Compass uses the same approach) validates our choice."

---

## 5. 🌟 Smart Talking Points (Say These to Impress)

1. **"We enforce strict TypeScript throughout — no `any` types, no `@ts-ignore` comments anywhere in the codebase."**

2. **"Every IPC handler follows a contract: it always returns `{ success: boolean, data?: T, error?: string }`. The UI never has to handle raw exceptions — it always gets a structured response."**

3. **"The source database is read-only. We never write to it, never modify it. All changes go to the target only."**

4. **"Schema inference is not perfect — we document this as a known limitation. 100-document sampling is the same approach used by MongoDB Compass and AWS DMS."**

5. **"We used `electron-store` for session persistence. If the app is closed mid-setup, the user's connection configuration is still there when they reopen."**

6. **"The desktop app works fully offline. No API keys, no cloud dependency, no data ever leaves the user's machine."**

7. **"We have a `migration-challenges-and-solutions.md` file that documents 10+ real-world migration problems — polymorphic documents, BSON-to-SQL type mismatch, arrays to junction tables, data loss risks."**

8. **"The 8-step wizard is designed so that at every step, the user has full visibility and control. We never do anything automatically without user approval."**

---

## 6. 🖥️ What to Show on Screen (Demo Order)

Follow this exact order for a 10-minute demo:

| # | What to Show | What to Say |
|---|---|---|
| 1 | **Marketing Website** (`localhost:3000`) | "This is our public-facing portal explaining the product" |
| 2 | **Homepage Interactive Mockup** | "This shows a live preview of the 3 migration modes the engine will support" |
| 3 | **Features Page → Comparison Table** | "Here we compare ourselves with AWS DMS, Flyway, and Prisma" |
| 4 | **Launch Desktop App** | "This is the actual tool — an Electron desktop application, runs locally" |
| 5 | **Home Dashboard** | "Three entry points — migrate, schema update, or demo mode" |
| 6 | **Click 'New Migration'** | "The 8-step wizard begins" |
| 7 | **Step 1: Choose Direction** | "User picks MongoDB → PostgreSQL or reverse" |
| 8 | **Step 2: Source DB (MongoDB)** | "Enter connection string, click Test Connection — watch it connect" |
| 9 | **Show schema preview (expand a collection)** | "It sampled documents and inferred the schema — fields, types, nullable flags" |
| 10 | **Step 3: Target DB (PostgreSQL)** | "Connect to the target, shows existing tables and their structure" |
| 11 | **Point to Step Progress Bar** | "8 steps total — labeled Direction, Source DB, Target DB, Map Schema, Risk, Dry Run, Migrate, Complete" |
| 12 | **Mention next phases** | "Phase 5 is Schema Mapper — the visual field mapping UI" |

---

## 7. 📊 What Is Done vs What Is Coming

| Phase | What | Status |
|---|---|---|
| Phase 0 | Monorepo setup, TypeScript, shared types | ✅ Done |
| Phase 1 | Marketing website (5 pages, Next.js) | ✅ Done |
| Phase 2 | Electron desktop app shell, sidebar, navigation | ✅ Done |
| Phase 3 | Home dashboard, session persistence | ✅ Done |
| Phase 4 | Database connectivity (Steps 1–3), schema introspection | ✅ Done |
| Phase 5 | Schema Mapper (field-by-field visual mapping UI) | 🔜 Next |
| Phase 6 | Risk Report (collisions, warnings, score card) | 🔜 Upcoming |
| Phase 7 | Dry Run (test migration, row counts, no commit) | 🔜 Upcoming |
| Phase 8 | Live Migration Engine (batched ETL, progress bar) | 🔜 Upcoming |
| Phase 9 | Layer 2 Guide (stored procedures, triggers — manual guide) | 🔜 Upcoming |
| Phase 10+ | History, saved connections, settings, packaging | 🔜 Upcoming |

---

## 8. ⚠️ Honest Limitations to Acknowledge (Shows Maturity)

> Teachers respect students who know what their project **can't** do yet. Saying these proactively is a sign of engineering maturity.

1. **"Currently no actual data migration yet** — that's Phase 8. Right now we handle connectivity and schema reading."

2. **"Schema inference from 100 documents may miss rare field types** — this is a documented trade-off. It works for consistent production schemas."

3. **"No OS keychain integration yet** — credentials saved to `electron-store` JSON file, not the Windows Credential Manager."

4. **"Polymorphic MongoDB documents** (where different records have different shapes) need manual user decisions in Phase 5."

5. **"The Windows .exe installer is not yet packaged** — we run in dev mode (`npm run desktop:dev`) during this phase."

---

*Document prepared for: MigrateIQ — Phase 0 to Phase 4 Teacher Review*
*Project: Final Year Project | Desktop App: Electron + React + Vite | Website: Next.js 14 | Language: TypeScript Strict Mode*
