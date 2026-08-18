<div align="center">

# 🗄️ MigrateIQ

### Intelligent Database Migration Planner

**AI-powered, guided migrations between MongoDB and PostgreSQL — with risk analysis, dry-run simulation, and automatic rollback.**

</div>

---

## 🤔 The Problem

Database migrations are one of the most feared tasks in software development:

- 😰 **Risky** — One wrong data type mapping can silently corrupt thousands of rows
- 🧩 **Complex** — MongoDB documents with nested objects and arrays don't map cleanly to PostgreSQL tables
- 🔁 **Irreversible** — Most tools have no undo button once the migration runs
- 📚 **Expert-only** — Existing tools assume deep database knowledge most developers don't have

---

## ✅ The Solution — MigrateIQ

MigrateIQ is a **Windows desktop application** that walks you through a database migration step by step — using AI to do the hard thinking, and giving you a safety net at every stage.

```
Connect ──► AI Maps Schema ──► Review Risks ──► Dry Run ──► Migrate ──► Download Report
                                                               ↕
                                                    (Rollback anytime)
```

No scripts. No guesswork. No irreversible mistakes.

---

## ✨ Features

### 🔄 Migration Wizard (8 Steps)
| Step | Feature |
|------|---------|
| 1 | Choose migration direction: **MongoDB → PostgreSQL** or **PostgreSQL → MongoDB** |
| 2 | Connect source database with one-click schema reading |
| 3 | Connect target database with permission verification |
| 4 | **AI Schema Mapper** — Gemini AI auto-generates the field mapping (editable) |
| 5 | **Risk Report** — detects circular FKs, nullable violations, mixed types before migration |
| 6 | **Dry Run** — simulates the full migration inside a transaction, then rolls back safely |
| 7 | **Live Migration** — streams data in batches with real-time progress and ETA |
| 8 | **Completion Screen** — ERD diagram, audit PDF, rollback script, and refactoring kit |

### 🛠️ More Tools
- **✏️ Schema Update Assistant** — Add, rename, or drop columns using plain English (*"Add a phone number column to the users table"*)
- **🎮 Demo Mode** — Experience a full migration with zero setup — no database needed
- **🔍 Partial Migration** — Migrate only specific collections or a date range
- **📜 Schema Version History** — Full log of every schema change with undo scripts
- **🤖 AI Health Score** — 0–100 quality score for your source schema before you migrate

---

## 🖥️ Screenshots

> *Screenshots will be added as each phase of the app is completed.*

| Home Dashboard | Schema Mapper | Risk Report | Live Migration |
|:-:|:-:|:-:|:-:|
| *(Phase 3)* | *(Phase 5)* | *(Phase 7)* | *(Phase 9)* |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Landing Website | Next.js 14, Vanilla CSS |
| Desktop App | Electron 28, React 18, TypeScript, Vite |
| Database Drivers | `mongodb` (native), `pg` (node-postgres) |
| AI | Google Gemini API (`gemini-1.5-flash`) |
| App State | Zustand + `electron-store` |
| Desktop Build | `electron-builder` → `.exe` |

---

## 📁 Repository Structure

```
migrateiq/
├── apps/
│   ├── web/                 ← Landing website (Next.js)
│   ├── desktop/             ← Windows desktop app (Electron + React)
│   │   ├── main/            ← Node.js backend (IPC handlers + ETL engine)
│   │   └── renderer/        ← React UI
│   ├── testbed-mongo/       ← Sample MongoDB e-commerce app (migration source)
│   └── testbed-postgres/    ← Sample PostgreSQL e-commerce app (migration target)
├── packages/
│   └── shared/              ← Shared TypeScript types
├── documentation/           ← Phase-by-phase technical docs (auto-generated)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20+
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) — free tier)
- A PostgreSQL instance (local or [Supabase](https://supabase.com) / [Neon](https://neon.tech) — free tier)
- A [Google Gemini API key](https://aistudio.google.com) (free)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/migrateiq.git
cd migrateiq

# Install all dependencies (monorepo)
npm install

# Run the landing website
cd apps/web && npm run dev
# → http://localhost:3000

# Run the desktop app
cd apps/desktop && npm start
# → Opens the MigrateIQ Electron window
```

### Seed the Testbed Database (for demos)

```bash
cd apps/testbed-mongo
npm run seed
# → Creates ~20,000 documents across 7 collections with intentional edge cases
```

---

## 🗺️ How It Was Built

MigrateIQ was developed across **17 sequential phases**, each tested before the next began:

| Phase | What Was Built |
|-------|---------------|
| 0–2 | Project foundation, landing website, app shell |
| 3–4 | Home dashboard, database connectivity |
| 5–6 | AI schema mapper + rule engine fallback |
| 7–8 | Risk report + dry-run simulation |
| 9–10 | Live migration engine + completion downloads |
| 11–15 | Schema Update, PG→Mongo direction, Demo Mode, History screens, Partial Migration |
| 16–17 | Testbed apps, integration testing, final build |

---

## ⚠️ Known Limitations

| Limitation | Details |
|------------|---------|
| Windows only | `.exe` targets Windows 10/11 64-bit |
| Snapshot migration | New MongoDB data written *during* migration is not captured |
| MongoDB & PostgreSQL only | No MySQL, SQLite, or other databases |
| No zero-downtime CDC | Change Data Capture (Kafka/Debezium) is out of scope |
| Local credentials | Connection strings stored unencrypted in `electron-store` |

---

## 📄 Documentation

Phase-by-phase technical documentation is generated automatically after each phase is verified. See the [`documentation/`](./documentation/) folder.

---

## 👨‍💻 About

MigrateIQ was built as a **Final Year Project** by a team of four Information Technology students. The goal was to solve a real-world pain point — database migrations — by combining AI schema understanding, guided risk analysis, and automatic rollback into a single desktop tool.

> *"Every existing tool either requires you to be an expert, locks you into an ecosystem, or moves data without helping you understand what changed or how to undo it. MigrateIQ is the only tool that combines all of these in one guided wizard."*

---

<div align="center">

**Built with ❤️ as a Final Year Project**

</div>
