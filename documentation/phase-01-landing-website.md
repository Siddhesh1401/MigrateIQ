# Phase 1 Documentation — MigrateIQ Landing Website

> **Phase Goal:** Build the complete, fully-styled public marketing website for **MigrateIQ** (`apps/web`) using **Next.js 14 (App Router)**, **TypeScript**, and **Vanilla CSS**.
> **Status:** In Progress (Page 1 Home Completed & Verified · Pages 2–5 Roadmap Active)

---

## 1. Phase Summary & Accomplishments

In this phase, we established the **production-grade Light Theme frontend design system** and built the **Master Home Page (`/`)** with rich interactive architecture visualizers:

* **Design Language & Tokens:** Defined CSS custom properties in `apps/web/styles/globals.css` adhering strictly to Light Theme rules (`#FAFAFC` canvas, `#FFFFFF` surfaces, `#2563EB` Royal Tech Blue, `#0284C7` Sky Blue, Plus Jakarta Sans typography, and developer blueprint grid background).
* **Global Navigation & Layout:** Built sticky glassmorphism `<Navbar />` with active route highlights and responsive mobile menu, plus structured `<Footer />`.
* **Custom SVG Iconography:** Created a bespoke vector icon library in `apps/web/components/Icons.tsx` replacing all emojis with fine-line vector geometry.
* **The "MigrateIQ Studio" Centerpiece:** Built an interactive desktop window mockup (`<StudioMockup />`) featuring live tab switching for:
  1. *Orders (Parent-Child Array Normalization)*
  2. *Products (Polymorphic Specifications to Indexed JSONB)*
  3. *AI NL2DDL Schema Updates (Plain English to 5s Lock-Timeout DDL)*
* **Architecture Flow Inspector:** Built `<ArchitectureFlow />` to visually explain the 5 under-the-hood engine stages (Introspect, Kahn's Topological Sort, AI Schema Engine, Chunk-Level ETL Isolation, Mathematical 5-Stage Audit).
* **Core Messaging & Pain Points:** Highlighted bidirectional migration (MongoDB ⇄ PostgreSQL), AI schema evolution, and the 3 core database hazards.

---

## 2. Files Created & Modified

| File Path | Description |
|---|---|
| `apps/web/styles/globals.css` | Global CSS variables, Plus Jakarta Sans typography, blueprint grid, and button classes. |
| `apps/web/app/layout.tsx` | Root layout embedding `<Navbar />` and `<Footer />` across all routes. |
| `apps/web/app/page.tsx` | Master Home page with Hero, Metrics bar, Architecture Flow, Pain points, Bento features, and CTA. |
| `apps/web/app/page.module.css` | Scoped CSS module for the Home page with multi-layered shadows and responsive bento grids. |
| `apps/web/components/Navbar.tsx` | Sticky navigation bar with mobile hamburger menu and Windows download trigger. |
| `apps/web/components/Navbar.module.css` | Scoped styles for the navigation header. |
| `apps/web/components/Footer.tsx` | Structured footer with product links, architecture tags, and GitHub repository links. |
| `apps/web/components/Footer.module.css` | Scoped styles for the footer. |
| `apps/web/components/Icons.tsx` | Custom SVG icon library (Windows, Mongo, Postgres, AI Sparkle, Shield Alert, Dry Run, etc.). |
| `apps/web/components/StudioMockup.tsx` | Interactive Light Theme desktop application window preview. |
| `apps/web/components/StudioMockup.module.css` | Scoped styles for the desktop studio window mockup. |
| `apps/web/components/ArchitectureFlow.tsx` | Interactive 5-stage migration engine pipeline inspector. |
| `apps/web/components/ArchitectureFlow.module.css` | Scoped styles for the architecture flow component. |
| `apps/web/app/how-it-works/page.tsx` | Route scaffold for Page 2 (How It Works). |
| `apps/web/app/features/page.tsx` | Route scaffold for Page 3 (Features). |
| `apps/web/app/download/page.tsx` | Route scaffold for Page 4 (Download). |
| `apps/web/app/about/page.tsx` | Route scaffold for Page 5 (About). |

---

## 3. Architecture & Key Implementation Details

```
                               ┌────────────────────────────────────────────────────────┐
                               │                    apps/web (Next.js 14)               │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                      ┌────────────────────────────────────┼────────────────────────────────────┐
                      ▼                                    ▼                                    ▼
          ┌────────────────────────┐           ┌────────────────────────┐           ┌────────────────────────┐
          │     Navigation/Core    │           │    Hero Studio Mockup  │           │   Architecture Flow    │
          │  • Navbar.tsx          │           │  • StudioMockup.tsx    │           │  • ArchitectureFlow.tsx│
          │  • Footer.tsx          │           │  • Field-by-field maps │           │  • Kahn's DAG Sorter   │
          │  • Icons.tsx           │           │  • 3 interactive modes │           │  • Chunk ETL Isolation │
          └────────────────────────┘           └────────────────────────┘           └────────────────────────┘
```

1. **Strict Light Theme Adherence:** Eliminated dark theme blocks in favor of high-contrast, crisp white `#FFFFFF` surfaces with subtle `#E2E8F0` borders and `#2563EB` blue accents.
2. **Interactive Visual Schema Transformation:** Replaced raw code scrollbars with structured field-by-field relational mapping rows with primary keys, foreign keys, and JSONB badges.

---

## 4. Current Status & Remaining Roadmap for Phase 1

```
┌───────────────────────────────────────────────────┬──────────────┐
│ Page / Component                                  │ Status       │
├───────────────────────────────────────────────────┼──────────────┤
│ 1. Global Design System & Layout (Nav/Footer)     │ ✅ Completed │
│ 2. Page 1: Master Home Page (/)                   │ ✅ Completed │
│ 3. Page 2: How It Works (/how-it-works)           │ ⏳ Next Up   │
│ 4. Page 3: All 12 Features (/features)            │ ⏳ Pending   │
│ 5. Page 4: Download & FAQ (/download)             │ ⏳ Pending   │
│ 6. Page 5: About & Team (/about)                  │ ⏳ Pending   │
└───────────────────────────────────────────────────┴──────────────┘
```

---

## 5. Next Steps

1. **Step 3:** Build **Page 2: How It Works (`/how-it-works`)** with the detailed 8-step visual walkthrough of Workflow A (MongoDB ➔ PostgreSQL), the Document vs Relational paradigm shift visualizer, and the Workflow C Schema Update Assistant deep dive.
2. **Step 4:** Build **Page 3: Features (`/features`)** with category filters for AI Intelligence, Safety Guardrails, ETL Performance, and Reporting.
3. **Step 5:** Build **Page 4: Download (`/download`)** with direct `.exe` trigger, system requirements matrix, and interactive FAQ accordion.
4. **Step 6:** Build **Page 5: About (`/about`)** with project mission, team cards, and architecture philosophy.
