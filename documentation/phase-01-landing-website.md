# Phase 1 Documentation — MigrateIQ Landing Website

> **Phase Goal:** Build the complete, fully-styled public marketing website for **MigrateIQ** (`apps/web`) using **Next.js 14 (App Router)**, **TypeScript**, and **Vanilla CSS**.
> **Status:** Complete & Verified (All 5 Pages Delivered in Pure Light Theme)

---

## 1. Phase Summary & Accomplishments

In this phase, we designed, built, and verified the complete **MigrateIQ Public Marketing Portal** (`apps/web`) across all 5 distinct routes with 100% adherence to our Light Theme design system:

* **Design System & Global Shell:**
  - Defined design tokens in `apps/web/styles/globals.css` (`#FAFAFC` canvas, `#FFFFFF` surfaces, `#2563EB` Royal Blue, `#0284C7` Sky Blue, Plus Jakarta Sans, and blueprint dot grid).
  - Built sticky glassmorphism `<Navbar />` with active route highlights, central `Download` link, and responsive mobile menu.
  - Built structured 3-column `<Footer />` with product links, architecture tags, and repository links.
  - Created a 100% custom vector SVG icon library (`apps/web/components/Icons.tsx`) with zero generic emojis.
* **Page 1: Master Home Page (`/`):**
  - Interactive Desktop Window Mockup (`<StudioMockup />`) featuring 3 live modes (Orders Array Normalization, Products Polymorphic JSONB, and AI NL2DDL Schema Updates).
  - Interactive 5-Stage Architecture Flow Inspector (`<ArchitectureFlow />`).
  - Universal Database Compatibility Grid (`<DatabaseEcosystem />`) covering Atlas, Local MongoDB, Supabase, Neon, AWS RDS, Railway, Render, and Local Postgres.
  - 3 Core Database Pain Points, 9-feature Bento Grid, and Live 1,000-Query Latency Benchmark card.
* **Page 2: How It Works (`/how-it-works`):**
  - High-impact 2-card Workflow Selector (Workflow A/B Full Database Migration vs Workflow C AI Schema Update Assistant).
  - Single-View 8-Step Interactive Pipeline with custom per-step live engine simulation boxes.
  - 3-Way Data Modeling Paradigm Shift Visualizer (Array Normalization, Polymorphic JSONB, Reverse Denormalization).
* **Page 3: Features (`/features`):**
  - All 12 enterprise features with interactive category filter pills (AI Intelligence, Safety, ETL, Tooling).
  - 2-column feature cards with code previews and "Why It Matters" bullet points.
  - Comprehensive 8-dimension Competitive Comparison Matrix contrasting MigrateIQ with Flyway, Prisma, and AWS DMS.
* **Page 4: Download (`/download`):**
  - Centerpiece Windows `.exe` download card with cryptographic SHA-256 integrity checksum.
  - 4-card System Requirements matrix (OS, RAM, Disk, Network).
  - 4-step Quick Installation Guide (Download ➔ Install ➔ Launch ➔ Migrate).
  - Interactive 5-item collapsible FAQ accordion.
* **Page 5: About (`/about`):**
  - Project mission statement and background as a Final Year Computer Science Capstone.
  - 4 Team Member profile cards with designated engineering roles and subsystem focus.
  - 4 Core Architectural Philosophy pillars (Deterministic Safety, Local-First Privacy, AI-Augmented Control, Empirical Verification).
  - Monorepo technology stack grid.

---

## 2. Files Created & Modified

| File Path | Description |
|---|---|
| `apps/web/styles/globals.css` | Global CSS variables, Plus Jakarta Sans typography, blueprint grid, and button classes. |
| `apps/web/app/layout.tsx` | Root layout embedding `<Navbar />` and `<Footer />` across all routes. |
| `apps/web/app/page.tsx` | Master Home page with Hero, Metrics bar, Architecture Flow, Ecosystem Grid, and Benchmark. |
| `apps/web/app/page.module.css` | Scoped CSS module for the Home page with multi-layered shadows and responsive bento grids. |
| `apps/web/app/how-it-works/page.tsx` | Interactive 8-step migration and 6-step schema update walkthrough with simulator. |
| `apps/web/app/how-it-works/page.module.css` | Scoped styles for the single-view How It Works studio container. |
| `apps/web/app/features/page.tsx` | 12 Feature deep-dive cards, category filters, and competitive comparison table. |
| `apps/web/app/features/page.module.css` | Scoped styles for the Features page and comparison matrix. |
| `apps/web/app/download/page.tsx` | Download centerpiece, system requirements, 4-step installation, and FAQ accordion. |
| `apps/web/app/download/page.module.css` | Scoped styles for the Download page. |
| `apps/web/app/about/page.tsx` | About page with project mission, 4 team cards, architecture pillars, and tech stack. |
| `apps/web/app/about/page.module.css` | Scoped styles for the About page. |
| `apps/web/components/Navbar.tsx` | Sticky navigation bar with active routes, central Download link, and mobile menu. |
| `apps/web/components/Navbar.module.css` | Scoped styles for the navigation header. |
| `apps/web/components/Footer.tsx` | Structured footer with product links, architecture tags, and GitHub repository links. |
| `apps/web/components/Footer.module.css` | Scoped styles for the footer. |
| `apps/web/components/Icons.tsx` | Custom SVG icon library (Windows, Mongo, Postgres, AI Sparkle, Shield Alert, Dry Run, etc.). |
| `apps/web/components/StudioMockup.tsx` | Interactive Light Theme desktop application window preview. |
| `apps/web/components/StudioMockup.module.css` | Scoped styles for the desktop studio window mockup. |
| `apps/web/components/ArchitectureFlow.tsx` | Interactive 5-stage migration engine pipeline inspector. |
| `apps/web/components/ArchitectureFlow.module.css` | Scoped styles for the architecture flow component. |
| `apps/web/components/DatabaseEcosystem.tsx` | Universal cloud and local database compatibility matrix. |
| `apps/web/components/DatabaseEcosystem.module.css` | Scoped styles for the database ecosystem component. |
| `packages/shared/package.json` | Direct source type resolution for clean monorepo cloning. |
| `package.json` | Root monorepo scripts with automated `postinstall` shared package build. |
| `SETUP.md` | Monorepo clone guide and shared build troubleshooting tips. |

---

## 3. Architecture & Verification Results

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    apps/web (Next.js 14)               │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
          ┌────────────────────────┬───────────────────────┼───────────────────────┬────────────────────────┐
          ▼                        ▼                       ▼                       ▼                        ▼
┌───────────────────┐    ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐    ┌───────────────────┐
│ Page 1: Home (/)  │    │ Page 2: How It    │   │ Page 3: Features  │   │ Page 4: Download  │    │ Page 5: About     │
│ • Hero Studio     │    │   Works           │   │ • 12 Capabilities │   │ • .exe Trigger    │    │ • Mission & Team  │
│ • Arch Flow       │    │ • 8-Step Pipeline │   │ • Category Filter │   │ • System Req      │    │   Profiles        │
│ • Ecosystem Grid  │    │ • 6-Step NL2DDL   │   │ • Comparison      │   │ • 4-Step Guide    │    │ • Architecture    │
│ • Latency Bench   │    │ • Paradigm Shift  │   │   Matrix          │   │ • FAQ Accordion   │    │   Philosophy      │
└───────────────────┘    └───────────────────┘   └───────────────────┘   └───────────────────┘    └───────────────────┘
```

### ✅ Verification Checklist:
- [x] All 5 pages render without any 404 errors or console exceptions.
- [x] Strict Light Theme adhered to across all screens (zero dark mode cards or dark canvases).
- [x] Mobile responsive navigation works seamlessly on narrow screens.
- [x] Monorepo TypeScript check (`npm run typecheck`) passed with 0 errors across `@migrateiq/shared`, `@migrateiq/desktop`, and `@migrateiq/web`.

---

## 4. Next Phase Handoff (Phase 2)

With the **Landing Website (Phase 1)** 100% complete and documented, we are ready to move to **Phase 2: Desktop App Foundation & Layout Shell** (`apps/desktop`):
- Setting up the persistent Electron desktop shell (Sidebar, Title bar, Router, Settings, IPC channels).
