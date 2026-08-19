# Phase 1 Documentation — MigrateIQ Landing Website

> **Phase Goal:** Build the complete, fully-styled public marketing website for **MigrateIQ** (`apps/web`) using **Next.js 14 (App Router)**, **TypeScript**, and **Vanilla CSS**.
> **Status:** In Progress (Pages 1, 2, 3, 4 Completed & Verified · Page 5 About Ready)

---

## 1. Phase Summary & Accomplishments

In this phase, we established the **production-grade Light Theme frontend design system** and delivered **Pages 1 through 4** with rich interactive architecture visualizers:

* **Design Language & Tokens:** Defined CSS custom properties in `apps/web/styles/globals.css` adhering strictly to Light Theme rules (`#FAFAFC` canvas, `#FFFFFF` surfaces, `#2563EB` Royal Tech Blue, `#0284C7` Sky Blue, Plus Jakarta Sans typography, and developer blueprint grid background).
* **Global Navigation & Layout:** Built sticky glassmorphism `<Navbar />` with active route highlights, `Download` navigation link, and responsive mobile menu, plus structured `<Footer />`.
* **Custom SVG Iconography:** Created a bespoke vector icon library in `apps/web/components/Icons.tsx` replacing all emojis with fine-line vector geometry.
* **Page 1: Master Home Page (`/`):**
  - Interactive Desktop Window Mockup (`<StudioMockup />`) featuring 3 live modes (Orders Array Split, Products JSONB, AI NL2DDL).
  - Interactive Architecture Pipeline (`<ArchitectureFlow />`) with 5 under-the-hood engine stages.
  - Universal Database Compatibility Ecosystem Grid (`<DatabaseEcosystem />`).
  - The 3 Core Database Hazards, 9-feature Bento Grid, and Live 1,000-Query Latency Benchmark card.
* **Page 2: How It Works (`/how-it-works`):**
  - Prominent 2-Card Workflow Selector (Workflow A/B Full Migration vs. Workflow C AI Schema Updates).
  - Single-View 8-Step Interactive Pipeline with custom per-step live engine simulation boxes.
  - 3-Way Data Modeling Paradigm Shift Visualizer (Array Normalization, Polymorphic JSONB, Reverse Denormalization).
* **Page 3: Features (`/features`):**
  - All 12 enterprise features with category filter pills (AI, Safety, ETL, Tooling).
  - 2-column feature cards with code previews and "Why It Matters" value points.
  - Comprehensive 8-dimension Competitive Comparison Matrix contrasting MigrateIQ with Flyway, Prisma, and AWS DMS.
* **Page 4: Download (`/download`):**
  - Centerpiece Windows `.exe` download card with cryptographic SHA-256 integrity checksum.
  - 4-card System Requirements matrix (OS, RAM, Disk, Network).
  - 4-step Quick Installation Guide (Download ➔ Install ➔ Launch ➔ Migrate).
  - Interactive 5-item collapsible FAQ accordion.

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
| `apps/web/app/about/page.tsx` | Route scaffold for Page 5 (About). |
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

## 3. Architecture & Key Implementation Details

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

1. **Strict Light Theme Adherence:** Eliminated dark theme blocks in favor of high-contrast, crisp white `#FFFFFF` surfaces with subtle `#E2E8F0` borders and `#2563EB` blue accents.
2. **Single-View Studio Wizard Layout:** Step explorer uses a compact horizontal step track and fitted simulator box so users never have to scroll back and forth.
3. **Zero TypeScript Errors:** Passed strict typecheck verification across all workspaces (`tsc --noEmit`).

---

## 4. Current Status & Remaining Roadmap for Phase 1

```
┌───────────────────────────────────────────────────┬──────────────┐
│ Page / Component                                  │ Status       │
├───────────────────────────────────────────────────┼──────────────┤
│ 1. Global Design System & Layout (Nav/Footer)     │ ✅ Completed │
│ 2. Page 1: Master Home Page (/)                   │ ✅ Completed │
│ 3. Page 2: How It Works (/how-it-works)           │ ✅ Completed │
│ 4. Page 3: All 12 Features (/features)            │ ✅ Completed │
│ 5. Page 4: Download & FAQ (/download)             │ ✅ Completed │
│ 6. Page 5: About & Team (/about)                  │ ⏳ Next Up   │
└───────────────────────────────────────────────────┴──────────────┘
```

---

## 5. Next Steps

1. **Step 6:** Build **Page 5: About (`/about`)** with project mission, team member cards (Windows App & ETL Engine, MongoDB Testbed, PostgreSQL Platform & Testing, Landing Website & Documentation), and core architectural philosophy.
