# ShopBridge — Unified Product Blueprint & Step-by-Step Build Plan v1.0

> **The Official Master Specification for `Siddhesh1401/MigrateIQ-Testbed`**
>
> ShopBridge is a fully-functional multi-vendor e-commerce platform built in two database versions — MongoDB and PostgreSQL. It serves as a realistic, production-like test environment for the MigrateIQ Database Migration Planner.
>
> **How to use this document:** This blueprint is organized sequentially from Phase 1 to Phase 9. Work through the file from **top to bottom**. Complete every task and verify each "Done When" checklist before moving to the next section.

---

# TABLE OF CONTENTS

1. [PHASE 1: Project Overview & Workspace Foundation](#phase-1-project-overview--workspace-foundation)
   - [In Simple Terms — What is ShopBridge?](#in-simple-terms--what-is-shopbridge)
   - [The Dual-App Architecture](#the-dual-app-architecture)
   - [How the Apps Connect to MigrateIQ](#how-the-apps-connect-to-migrateiq)
   - [Tech Stack Overview](#tech-stack-overview)
   - [Repository Folder Structure & Environment Setup](#repository-folder-structure--environment-setup)
   - [📋 Phase 1 Tasks & "Done When" Checklist](#-phase-1-tasks--done-when-checklist)
2. [PHASE 2: Shared Storefront UI & Design System (Next.js 14)](#phase-2-shared-storefront-ui--design-system-nextjs-14)
   - [In Simple Terms — The Storefront UI](#in-simple-terms--the-storefront-ui)
   - [UI/UX Design Tokens (Strict Light Theme)](#uiux-design-tokens-strict-light-theme)
   - [Pages & Navigation Routes](#pages--navigation-routes)
   - [Reusable Component Architecture & Props](#reusable-component-architecture--props)
   - [Global Cart State Management (Zustand)](#global-cart-state-management-zustand)
   - [Mock Checkout Flow](#mock-checkout-flow)
   - [📋 Phase 2 Tasks & "Done When" Checklist](#-phase-2-tasks--done-when-checklist)
3. [PHASE 3: App A (MongoDB) Backend & Schemas](#phase-3-app-a-mongodb-backend--schemas)
   - [In Simple Terms — The Source Backend](#in-simple-terms--the-source-backend)
   - [All 7 MongoDB Collection Models & Indexes](#all-7-mongodb-collection-models--indexes)
   - [Express Server & JWT Auth Middleware](#express-server--jwt-auth-middleware)
   - [Complete REST API Request/Response JSON Contracts](#complete-rest-api-requestresponse-json-contracts)
   - [📋 Phase 3 Tasks & "Done When" Checklist](#-phase-3-tasks--done-when-checklist)
4. [PHASE 4: MongoDB Seeding Engine (20,750 Documents & 10 Edge Cases)](#phase-4-mongodb-seeding-engine-20750-documents--10-edge-cases)
   - [In Simple Terms — The Messy Data Generator](#in-simple-terms--the-messy-data-generator)
   - [The 10 Intentional Edge Cases Explained](#the-10-intentional-edge-cases-explained)
   - [Faker.js Seeding Algorithms & Distribution Logic](#fakerjs-seeding-algorithms--distribution-logic)
   - [Master Seed Runner (`npm run seed`)](#master-seed-runner-npm-run-seed)
   - [📋 Phase 4 Tasks & "Done When" Checklist](#-phase-4-tasks--done-when-checklist)
5. [PHASE 5: App B (PostgreSQL) Database & SQL Backend](#phase-5-app-b-postgresql-database--sql-backend)
   - [In Simple Terms — The Target Backend](#in-simple-terms--the-target-backend)
   - [All 8 PostgreSQL Table Schemas & Foreign Keys](#all-8-postgresql-table-schemas--foreign-keys)
   - [Relational Normalization (`order_items` Split)](#relational-normalization-order_items-split)
   - [PostgreSQL Query Modules (`pg.Pool`) & Route Handlers](#postgresql-query-modules-pgpool--route-handlers)
   - [📋 Phase 5 Tasks & "Done When" Checklist](#-phase-5-tasks--done-when-checklist)
6. [PHASE 6: PostgreSQL Direct Seeding Engine (For PG → Mongo Demos)](#phase-6-postgresql-direct-seeding-engine-for-pg--mongo-demos)
   - [In Simple Terms — Direct PostgreSQL Seeding](#in-simple-terms--direct-postgresql-seeding)
   - [Foreign Key Dependency Order Insertion](#foreign-key-dependency-order-insertion)
   - [PostgreSQL Seed Scripts](#postgresql-seed-scripts)
   - [📋 Phase 6 Tasks & "Done When" Checklist](#-phase-6-tasks--done-when-checklist)
7. [PHASE 7: Automated 5-Test Verification Suite](#phase-7-automated-5-test-verification-suite)
   - [In Simple Terms — The Verification Suite](#in-simple-terms--the-verification-suite)
   - [The 5 Automated Tests & Exact Query Logic](#the-5-automated-tests--exact-query-logic)
   - [Verification Report Generation (JSON + Markdown)](#verification-report-generation-json--markdown)
   - [📋 Phase 7 Tasks & "Done When" Checklist](#-phase-7-tasks--done-when-checklist)
8. [PHASE 8: MigrateIQ Live Integration & Cloud Verification](#phase-8-migrateiq-live-integration--cloud-verification)
   - [In Simple Terms — Running Live Migrations](#in-simple-terms--running-live-migrations)
   - [Workflow A Demo Flow: MongoDB → PostgreSQL](#workflow-a-demo-flow-mongodb--postgresql)
   - [Workflow B Demo Flow: PostgreSQL → MongoDB](#workflow-b-demo-flow-postgresql--mongodb)
   - [Cloud Database Testing (MongoDB Atlas, Supabase, Neon)](#cloud-database-testing-mongodb-atlas-supabase-neon)
   - [Expected Risk Report Warning Matrix](#expected-risk-report-warning-matrix)
   - [📋 Phase 8 Tasks & "Done When" Checklist](#-phase-8-tasks--done-when-checklist)
9. [PHASE 9: Final FYP Demo Readiness & Presentation Guide](#phase-9-final-fyp-demo-readiness--presentation-guide)
   - [In Simple Terms — How to Present the Project](#in-simple-terms--how-to-present-the-project)
   - [Terminal Commands Cheat Sheet](#terminal-commands-cheat-sheet)
   - [Evaluator Q&A Preparation](#evaluator-qa-preparation)
   - [📋 Phase 9 Tasks & "Done When" Checklist](#-phase-9-tasks--done-when-checklist)

---
---

# PHASE 1: Project Overview & Workspace Foundation

---

## In Simple Terms — What is ShopBridge?

Think of ShopBridge as a **crash test dummy** for MigrateIQ.

Just like car manufacturers test seatbelts and airbags on crash test dummies before putting real humans in cars, we test MigrateIQ on ShopBridge before migrating real enterprise databases.

ShopBridge is a **complete, working e-commerce store** (like a mini Amazon) built in **two versions**:
- **App A:** Talks to MongoDB (contains ~20,750 documents of messy, real-world data).
- **App B:** Talks to PostgreSQL (the target database).

It is built as an **independent project** in its own GitHub repository (`Siddhesh1401/MigrateIQ-Testbed`) so your team can build it in parallel without merge conflicts with the main MigrateIQ desktop app.

---

## The Dual-App Architecture

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│       App A (ShopBridge Mongo)       │       │      App B (ShopBridge Postgres)     │
│   Next.js 14 Frontend (localhost:3001)│       │  Next.js 14 Frontend (localhost:3002)│
│   Express Backend (Mongoose ODM)     │       │   Express Backend (pg / SQL Pool)    │
│   Database: MongoDB 7.0 (20,750 docs)│       │   Database: PostgreSQL 15 (Blank DB) │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
```

Both apps share the **exact same UI and pages**. The only difference is the backend database driver.

---

## How the Apps Connect to MigrateIQ

```
WORKFLOW A (MongoDB → PostgreSQL):
App A (MongoDB Source) ──[MigrateIQ Tool]──▶ App B (PostgreSQL Target)
- App A has 20,750 messy documents.
- Target PostgreSQL database starts completely blank.
- MigrateIQ generates tables, migrates data, and populates App B.

WORKFLOW B (PostgreSQL → MongoDB):
App B (PostgreSQL Source) ──[MigrateIQ Tool]──▶ App A (MongoDB Target)
- App B has 20,750 relational rows.
- Target MongoDB database starts completely blank.
- MigrateIQ re-embeds child records and populates App A.
```

---

## Tech Stack Overview

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), Vanilla CSS | Fast, server-rendered storefront UI |
| **State Management** | Zustand (`persist` middleware) | Cart state across pages |
| **App A Backend** | Node.js + Express + Mongoose | MongoDB ODM REST API |
| **App B Backend** | Node.js + Express + `pg` | PostgreSQL raw SQL connection pool |
| **Auth** | JWT (`jsonwebtoken`) + `bcryptjs` | User login and admin access control |
| **Seeding** | `@faker-js/faker` | Generates 20,750 realistic messy records |
| **Verification** | Node.js + `crypto` + `axios` | 5 automated data integrity tests |

---

## Repository Folder Structure & Environment Setup

```
MigrateIQ-Testbed/
├── testbed-mongo/                 ← App A: MongoDB e-commerce store
│   ├── package.json
│   ├── .env.example              ← MONGODB_URI=mongodb://localhost:27017/shopbridge
│   ├── app/                      ← Next.js 14 App Router UI
│   ├── server/                   ← Express API + Mongoose models
│   └── scripts/                  ← Seed scripts (20,750 MongoDB docs)
│
├── testbed-postgres/              ← App B: PostgreSQL e-commerce store
│   ├── package.json
│   ├── .env.example              ← DATABASE_URL=postgresql://postgres:password@localhost:5432/shopbridge
│   ├── app/                      ← Identical Next.js 14 UI
│   ├── server/                   ← Express API + SQL query modules
│   └── scripts/                  ← Direct PostgreSQL seed scripts
│
├── verify/                        ← Automated verification suite
│   ├── package.json
│   ├── verify.js                 ← Master test runner
│   ├── tests/                    ← 5 individual test scripts
│   └── reports/                  ← Generated verification reports
│
├── README.md
└── SETUP.md
```

---

## 📋 Phase 1 Tasks & "Done When" Checklist

### Tasks:
1. Initialize repository: `git init` in `MigrateIQ-Testbed`.
2. Create directories `testbed-mongo/`, `testbed-postgres/`, and `verify/`.
3. Create `.env.example` in `testbed-mongo/` and `testbed-postgres/`.
4. Setup `package.json` files and install dependencies:
   - `testbed-mongo`: `npm install express mongoose jsonwebtoken bcryptjs cors dotenv @faker-js/faker`
   - `testbed-postgres`: `npm install express pg jsonwebtoken bcryptjs cors dotenv @faker-js/faker`
   - `verify`: `npm install pg mongodb axios crypto`

### Done When:
- [ ] Root directory structure matches the folder tree above.
- [ ] Running `npm run dev` in `testbed-mongo` boots on `http://localhost:3001`.
- [ ] Running `npm run dev` in `testbed-postgres` boots on `http://localhost:3002`.

---
---

# PHASE 2: Shared Storefront UI & Design System (Next.js 14)

---

## In Simple Terms — The Storefront UI

ShopBridge needs to look like a modern, clean, real-world shopping website. When professors or evaluators look at the screen, they see product cards, star ratings, category filters, a slide-out cart drawer, and an admin inventory management table.

---

## UI/UX Design Tokens (Strict Light Theme)

Both apps follow the exact **Light Theme design system** of MigrateIQ:
- **Canvas Background:** `#F8FAFC` (Slate-50)
- **Cards & Surfaces:** `#FFFFFF` (Pure White) with 1px border `#E2E8F0`
- **Primary Brand / Action:** `#2563EB` (Royal Tech Blue, hover: `#1D4ED8`)
- **Secondary Accent:** `#0284C7` (Sky Blue)
- **Primary Text:** `#0F172A` (Deep Navy Slate)
- **Muted Text:** `#64748B` (Slate-500)
- **Typography:** **Inter** font family
- **Styling Method:** Pure **Vanilla CSS** with CSS Modules (`*.module.css`) or `globals.css`. (No Tailwind CSS).

---

## Pages & Navigation Routes

| Route | Page Name | Key Features |
| :--- | :--- | :--- |
| `/` | Storefront | Product grid, category filter sidebar, search bar, sort dropdown |
| `/products/[id]` | Product Detail | Image gallery, price, polymorphic specs table, customer reviews, Add to Cart |
| `/cart` | Shopping Cart | Line items list, quantity editor, coupon code input, subtotal summary |
| `/checkout` | Checkout | Delivery address form, mock payment method radio group, Place Order button |
| `/orders` | My Orders | Order history list, status timeline badges, item breakdown |
| `/profile` | My Profile | User details, shipping & billing address forms |
| `/admin` | Admin Dashboard | Real-time product inventory table, stock increment/decrement, low-stock warnings |

---

## Reusable Component Architecture & Props

Build these reusable components in `app/components/`:

### 1. `<Navbar>` (`components/Navbar.tsx`)
```typescript
interface NavbarProps {
  cartCount: number;
  userName?: string;
  onSearch: (query: string) => void;
}
```
Displays logo, search input, category dropdown, user avatar/login, and cart badge with live count.

### 2. `<ProductCard>` (`components/ProductCard.tsx`)
```typescript
interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    images: string[];
    rating: { average: number; count: number };
    stock: number;
    tags: string[];
  };
  onAddToCart: (productId: string) => void;
}
```

### 3. `<SpecsViewer>` (`components/SpecsViewer.tsx`)
```typescript
interface SpecsViewerProps {
  specs: Record<string, any>; // Polymorphic JSON (handles RAM/CPU or Size/Color)
}
```
Renders polymorphic key-value pairs in a crisp, 2-column clean specification table.

### 4. `<CartDrawer>` (`components/CartDrawer.tsx`)
Slide-over right drawer opening on cart button click. Allows instant quantity modifications and coupon code validation.

### 5. `<AdminStockTable>` (`components/AdminStockTable.tsx`)
Displays product SKU, current inventory count, category tag, and `+` / `-` stock adjustment buttons that trigger `PATCH /api/admin/products/:id/stock`.

---

## Global Cart State Management (Zustand)

Create `app/store/useCartStore.ts`:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  sku: string;
}

interface CartStore {
  items: CartItem[];
  couponCode: string | null;
  discountPercent: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  applyCoupon: (code: string, percent: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      discountPercent: 0,
      addItem: (item) => set((state) => {
        const existing = state.items.find(i => i.productId === item.productId);
        if (existing) {
          return { items: state.items.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i) };
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.productId !== id) })),
      updateQuantity: (id, qty) => set((state) => ({ items: state.items.map(i => i.productId === id ? { ...i, quantity: qty } : i) })),
      applyCoupon: (code, percent) => set({ couponCode: code, discountPercent: percent }),
      clearCart: () => set({ items: [], couponCode: null, discountPercent: 0 }),
      getSubtotal: () => get().items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
      getTotal: () => {
        const sub = get().getSubtotal();
        const discount = sub * (get().discountPercent / 100);
        const tax = (sub - discount) * 0.08;
        return parseFloat((sub - discount + tax).toFixed(2));
      }
    }),
    { name: 'shopbridge-cart' }
  )
);
```

---

## Mock Checkout Flow

In `app/checkout/page.tsx`:
1. Collects shipping address fields.
2. Provides mock payment selector (Card / UPI / COD).
3. On submit, sends `POST /api/orders`, clears Zustand cart, and redirects to `/orders`.

---

## 📋 Phase 2 Tasks & "Done When" Checklist

### Tasks:
1. Build `app/globals.css` with MigrateIQ design tokens.
2. Build reusable UI components in `app/components/`.
3. Implement `app/store/useCartStore.ts` with Zustand.
4. Implement storefront `/`, product detail `/products/[id]`, cart `/cart`, checkout `/checkout`, orders `/orders`, and admin `/admin`.
5. Mirror the `app/` folder to `testbed-postgres/app/`.

### Done When:
- [ ] Storefront displays product cards with working category filtering and price sorting.
- [ ] Clicking "Add to Cart" updates the cart drawer live with badge counter.
- [ ] Product page dynamically renders polymorphic specs (Electronics vs Clothing).
- [ ] Mock checkout submits order successfully and clears cart.

---
---

# PHASE 3: App A (MongoDB) Backend & Schemas

---

## In Simple Terms — The Source Backend

App A represents an existing e-commerce company that has been using MongoDB for years. Its backend is built with Express and Mongoose, containing 7 collections with realistic, messy data structures.

---

## All 7 MongoDB Collection Models & Indexes

Build these Mongoose models in `testbed-mongo/server/models/`:

### 1. `User.js` (~2,000 documents)
```javascript
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  phone: { type: mongoose.Schema.Types.Mixed }, // ⚠️ Edge Case: String | Number | null
  avatar: { type: String },
  address: {
    shipping: {
      street: String, city: String, state: String, zip: String, country: String
    },
    billing: {
      street: String, city: String, state: String, zip: String, country: String,
      coordinates: { lat: Number, lng: Number } // ⚠️ Edge Case: 3-level deep nesting
    }
  },
  isVerified: { type: Boolean, default: false },
  lastLogin: { type: mongoose.Schema.Types.Mixed }, // ⚠️ Edge Case: ISODate | Unix timestamp
  createdAt: { type: Date, default: Date.now }
});

UserSchema.index({ email: 1 }, { unique: true });
module.exports = mongoose.model('User', UserSchema);
```

### 2. `Category.js` (~50 documents)
```javascript
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // ⚠️ Edge Case: Self-reference
  level: { type: Number, default: 0 },
  image: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parent_id: 1 });
module.exports = mongoose.model('Category', CategorySchema);
```

### 3. `Product.js` (~500 documents)
```javascript
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String }, // ⚠️ Edge Case: Up to 50KB text blobs
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  vendor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  price: { type: mongoose.Schema.Types.Mixed, required: true }, // ⚠️ Edge Case: Number | String ("29.99")
  compareAtPrice: { type: Number },
  currency: { type: String, default: 'USD' },
  stock: { type: Number, default: 0 },
  sku: { type: String },
  tags: [{ type: String }], // ⚠️ Edge Case: Primitive string array
  images: [{ type: String }],
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  specs: { type: mongoose.Schema.Types.Mixed }, // ⚠️ Edge Case: Polymorphic JSON (RAM/CPU vs Size/Color)
  isActive: { type: Boolean, default: true },
  discount: { type: mongoose.Schema.Types.Mixed, default: null }, // ⚠️ Edge Case: Number | null | undefined
  createdAt: { type: Date, default: Date.now }
});

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ category_id: 1, price: -1 });
ProductSchema.index({ name: 'text', description: 'text' });
module.exports = mongoose.model('Product', ProductSchema);
```

### 4. `Order.js` (~5,000 documents)
```javascript
const OrderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [ // ⚠️ Edge Case: Embedded array of 1-20 line items
    {
      product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      product_name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      sku: { type: String }
    }
  ],
  coupon_code: { type: String, default: null },
  discount_amount: { type: Number, default: 0 },
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  total_amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  paymentMethod: { type: String, default: 'card' },
  paymentStatus: { type: String, enum: ['paid', 'pending', 'failed'], default: 'pending' },
  shippingAddress: {
    street: String, city: String, state: String, zip: String, country: String
  },
  notes: { type: String },
  placedAt: { type: mongoose.Schema.Types.Mixed, default: Date.now }, // ⚠️ Edge Case: Date vs Unix Timestamp
  updatedAt: { type: Date, default: Date.now }
});

OrderSchema.index({ user_id: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ placedAt: -1 });
module.exports = mongoose.model('Order', OrderSchema);
```

### 5. `Review.js` (~3,000 documents)
```javascript
const ReviewSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String },
  body: { type: String },
  verified_purchase: { type: Boolean, default: false },
  helpful_count: { type: Number, default: 0 },
  images: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

ReviewSchema.index({ product_id: 1, rating: -1 });
ReviewSchema.index({ user_id: 1 });
module.exports = mongoose.model('Review', ReviewSchema);
```

### 6. `InventoryLog.js` (~10,000 documents)
```javascript
const InventoryLogSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  change_type: { type: String, enum: ['sale', 'restock', 'adjustment', 'return'], required: true },
  quantity_before: { type: Number, required: true },
  quantity_change: { type: Number, required: true },
  quantity_after: { type: Number, required: true },
  reference_id: { type: mongoose.Schema.Types.ObjectId },
  note: { type: String },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: mongoose.Schema.Types.Mixed, default: Date.now } // ⚠️ Edge Case: Mixed Date / Number
});

InventoryLogSchema.index({ product_id: 1 });
InventoryLogSchema.index({ timestamp: -1 });
module.exports = mongoose.model('InventoryLog', InventoryLogSchema);
```

### 7. `Coupon.js` (~100 documents)
```javascript
const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  discount_type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  discount_value: { type: Number, required: true },
  min_order_amount: { type: Number },
  max_uses: { type: Number },
  used_count: { type: Number, default: 0 },
  valid_from: { type: mongoose.Schema.Types.Mixed }, // ⚠️ Edge Case: String vs Date
  valid_until: { type: mongoose.Schema.Types.Mixed },
  applicable_categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

CouponSchema.index({ code: 1 }, { unique: true });
module.exports = mongoose.model('Coupon', CouponSchema);
```

---

## Express Server & JWT Auth Middleware

In `testbed-mongo/server/middleware/auth.js`:
```javascript
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'testbed-secret-key-123');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
}

module.exports = authMiddleware;
```

---

## Complete REST API Request/Response JSON Contracts

Both App A (MongoDB) and App B (PostgreSQL) must return this exact JSON schema:

#### 1. `GET /api/products`
```json
{
  "success": true,
  "data": [
    {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Wireless Noise-Canceling Headphones",
      "slug": "wireless-noise-canceling-headphones",
      "description": "High fidelity audio...",
      "price": 199.99,
      "compareAtPrice": 249.99,
      "currency": "USD",
      "stock": 45,
      "sku": "AUD-WNC-001",
      "tags": ["audio", "wireless"],
      "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e"],
      "rating": { "average": 4.7, "count": 128 },
      "specs": { "battery": "30 hours", "bluetooth": "5.3" },
      "isActive": true,
      "discount": 20.0,
      "category": { "id": "64f1a2b3c4d5e6f7a8b9c001", "name": "Audio", "slug": "audio" }
    }
  ],
  "pagination": { "total": 500, "page": 1, "limit": 20, "totalPages": 25 }
}
```

#### 2. `POST /api/orders`
* **Request:** `{ "items": [{ "productId": "...", "quantity": 2 }], "couponCode": "SAVE10", "shippingAddress": {...} }`
* **Response (201 Created):** `{ "success": true, "order": { "id": "...", "totalAmount": 388.78, "status": "pending" } }`

---

## 📋 Phase 3 Tasks & "Done When" Checklist

### Tasks:
1. Create all 7 Mongoose models in `testbed-mongo/server/models/`.
2. Implement Express route handlers in `testbed-mongo/server/routes/`.
3. Implement JWT auth middleware.
4. Mount routes on Express app in `testbed-mongo/server/index.js`.

### Done When:
- [ ] `GET /api/products`, `GET /api/categories`, and `POST /api/orders` return verified status codes and JSON formats.
- [ ] Models enforce all index constraints in MongoDB.

---
---

# PHASE 4: MongoDB Seeding Engine (20,750 Documents & 10 Edge Cases)

---

## In Simple Terms — The Messy Data Generator

Real databases have messy, inconsistent data after years of production usage. The seed engine intentionally creates 10 edge cases across 20,750 documents so MigrateIQ is tested against real-world chaos.

---

## The 10 Intentional Edge Cases Explained

| # | Edge Case | Problem Description | Seed Ratio |
| :--- | :--- | :--- | :--- |
| **1** | **Mixed Phone Types** | `users.phone` stored as String, Integer, or missing | 60% String, 30% Number, 10% null |
| **2** | **Mixed Price Types** | `products.price` stored as Number or string `"29.99"` | 95% Number, 5% String |
| **3** | **Mixed Date Formats** | `orders.placedAt` stored as `ISODate`, Unix timestamp, or ISO string | 50% ISODate, 50% Timestamp |
| **4** | **Embedded Object Arrays** | `orders.items` array with 1–20 embedded line items | 100% of orders |
| **5** | **Polymorphic Specs** | Electronics have `{ram, cpu}`, Clothing have `{size, color}` | 60% Electronics, 40% Clothing |
| **6** | **3-Level Deep Nesting** | `users.address.billing.coordinates.lat` (3 levels deep) | 100% of billing addresses |
| **7** | **Nullable Discounts** | `products.discount` is null, 0, or omitted | 40% with discount, 60% null |
| **8** | **Self-Referencing FK** | `categories.parent_id` references parent category `_id` | 3-level hierarchy |
| **9** | **Primitive String Arrays** | `products.tags` is an array of strings `["sale", "tech"]` | 100% of products |
| **10**| **Large Text Blobs** | `products.description` has 50KB+ lorem ipsum text | 10% of products |

---

## Faker.js Seeding Algorithms & Distribution Logic

Build `testbed-mongo/scripts/`:

```javascript
// Example: testbed-mongo/scripts/seedProducts.js
const { faker } = require('@faker-js/faker');

function generateProducts(categories, count = 500) {
  const products = [];
  for (let i = 0; i < count; i++) {
    const isElectronics = i < 300;
    const category = isElectronics ? categories[1] : categories[2];

    // Edge Case 2: String vs Number price
    const rawPrice = parseFloat(faker.commerce.price({ min: 10, max: 1500 }));
    const price = Math.random() < 0.05 ? rawPrice.toFixed(2) : rawPrice;

    // Edge Case 5: Polymorphic specs
    const specs = isElectronics ? {
      ram: `${faker.helpers.arrayElement([8, 16, 32, 64])}GB`,
      cpu: faker.helpers.arrayElement(['Intel i7', 'Intel i9', 'AMD Ryzen 7', 'Apple M3']),
      storage: `${faker.helpers.arrayElement([256, 512, 1024])}GB SSD`
    } : {
      size: faker.helpers.arrayElement(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
      color: faker.color.human(),
      fabric: faker.helpers.arrayElement(['100% Cotton', 'Polyester Blend', 'Silk', 'Wool'])
    };

    // Edge Case 10: 50KB text blob
    const description = Math.random() < 0.10 
      ? faker.lorem.paragraphs(80) // ~50KB
      : faker.commerce.productDescription();

    products.push({
      name: faker.commerce.productName(),
      slug: `${faker.helpers.slugify(faker.commerce.productName()).toLowerCase()}-${i}`,
      description,
      category_id: category._id,
      price,
      compareAtPrice: rawPrice * 1.25,
      currency: 'USD',
      stock: faker.number.int({ min: 0, max: 250 }),
      sku: faker.string.alphanumeric({ length: 8, casing: 'upper' }),
      tags: [faker.commerce.department(), 'featured', 'shopbridge'],
      images: [faker.image.urlLoremFlickr({ category: 'technics' })],
      rating: {
        average: parseFloat((Math.random() * 2 + 3).toFixed(1)),
        count: faker.number.int({ min: 5, max: 500 })
      },
      specs,
      isActive: true,
      discount: Math.random() < 0.4 ? faker.number.int({ min: 5, max: 50 }) : null,
      createdAt: faker.date.past({ years: 2 })
    });
  }
  return products;
}
```

---

## Master Seed Runner (`npm run seed`)

In `testbed-mongo/scripts/index.js`:
Executes all seed modules in dependency order:
1. `Categories` (50) → 2. `Users` (2,000) → 3. `Products` (500) → 4. `Orders` (5,000) → 5. `Reviews` (3,000) → 6. `InventoryLogs` (10,000) → 7. `Coupons` (100).
**Total: ~20,750 documents.**

---

## 📋 Phase 4 Tasks & "Done When" Checklist

### Tasks:
1. Implement seed scripts in `testbed-mongo/scripts/`.
2. Implement master runner `testbed-mongo/scripts/index.js`.
3. Add `"seed": "node scripts/index.js"` to `testbed-mongo/package.json`.

### Done When:
- [ ] Running `npm run seed` in `testbed-mongo` seeds all 20,750 documents in under 45 seconds.
- [ ] Database contains verified mixed phone types, polymorphic specs, and date variants.

---
---

# PHASE 5: App B (PostgreSQL) Database & SQL Backend

---

## In Simple Terms — The Target Backend

App B is the exact same e-commerce website rebuilt for PostgreSQL. The target database **starts 100% blank** before migration. When MigrateIQ runs, it creates all 8 relational tables and fills them with data.

---

## All 8 PostgreSQL Table Schemas & Foreign Keys

Build `testbed-postgres/server/db/schema.sql` (Reference schema for development):

```sql
-- 1. Users table
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id      VARCHAR(24) UNIQUE,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'customer',
  phone         VARCHAR(30),
  avatar        TEXT,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ship_street   VARCHAR(255), ship_city VARCHAR(100), ship_state VARCHAR(100), ship_zip VARCHAR(20), ship_country VARCHAR(100),
  bill_street   VARCHAR(255), bill_city VARCHAR(100), bill_state VARCHAR(100), bill_zip VARCHAR(20), bill_country VARCHAR(100),
  bill_lat      NUMERIC(10, 7), bill_lng NUMERIC(10, 7)
);

-- 2. Categories table
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id    VARCHAR(24) UNIQUE,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  parent_id   UUID REFERENCES categories(id),
  level       INTEGER NOT NULL DEFAULT 0,
  image       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Products table
CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id         VARCHAR(24) UNIQUE,
  name             VARCHAR(500) NOT NULL,
  slug             VARCHAR(500) NOT NULL UNIQUE,
  description      TEXT,
  category_id      UUID REFERENCES categories(id),
  vendor_id        UUID REFERENCES users(id),
  price            NUMERIC(12, 2) NOT NULL,
  compare_at_price NUMERIC(12, 2),
  currency         VARCHAR(10) NOT NULL DEFAULT 'USD',
  stock            INTEGER NOT NULL DEFAULT 0,
  sku              VARCHAR(100),
  tags             TEXT[],
  images           TEXT[],
  rating_average   NUMERIC(3, 2),
  rating_count     INTEGER NOT NULL DEFAULT 0,
  specs            JSONB,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  discount         NUMERIC(5, 2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON products (category_id, price DESC);
CREATE INDEX ON products USING GIN (tags);
CREATE INDEX ON products USING GIN (specs);

-- 4. Orders table
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id         VARCHAR(24) UNIQUE,
  user_id          UUID NOT NULL REFERENCES users(id),
  coupon_code      VARCHAR(50),
  discount_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal         NUMERIC(12, 2) NOT NULL,
  tax              NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12, 2) NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending',
  payment_method   VARCHAR(30),
  payment_status   VARCHAR(30) NOT NULL DEFAULT 'pending',
  notes            TEXT,
  ship_street VARCHAR(255), ship_city VARCHAR(100), ship_state VARCHAR(100), ship_zip VARCHAR(20), ship_country VARCHAR(100),
  placed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON orders (user_id);
CREATE INDEX ON orders (placed_at DESC);

-- 5. Order Items table (Exploded child table)
CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  product_name  VARCHAR(500) NOT NULL,
  price         NUMERIC(12, 2) NOT NULL,
  quantity      INTEGER NOT NULL,
  subtotal      NUMERIC(12, 2) NOT NULL,
  sku           VARCHAR(100),
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ON order_items (order_id);

-- 6. Reviews table
CREATE TABLE reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id          VARCHAR(24) UNIQUE,
  product_id        UUID NOT NULL REFERENCES products(id),
  user_id           UUID NOT NULL REFERENCES users(id),
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title             VARCHAR(255),
  body              TEXT,
  verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count     INTEGER NOT NULL DEFAULT 0,
  images            TEXT[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Inventory Logs table
CREATE TABLE inventory_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id         VARCHAR(24) UNIQUE,
  product_id       UUID NOT NULL REFERENCES products(id),
  change_type      VARCHAR(30) NOT NULL,
  quantity_before  INTEGER NOT NULL,
  quantity_change  INTEGER NOT NULL,
  quantity_after   INTEGER NOT NULL,
  reference_id     UUID,
  note             TEXT,
  created_by       UUID REFERENCES users(id),
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Coupons table
CREATE TABLE coupons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id              VARCHAR(24) UNIQUE,
  code                  VARCHAR(100) NOT NULL UNIQUE,
  discount_type         VARCHAR(20) NOT NULL,
  discount_value        NUMERIC(10, 2) NOT NULL,
  min_order_amount      NUMERIC(12, 2),
  max_uses              INTEGER,
  used_count            INTEGER NOT NULL DEFAULT 0,
  valid_from            TIMESTAMPTZ,
  valid_until           TIMESTAMPTZ,
  applicable_categories UUID[],
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## PostgreSQL Query Modules (`pg.Pool`) & Route Handlers

Create `testbed-postgres/server/queries/products.js`:
```javascript
const pool = require('../db/pool');

async function getProducts({ page = 1, limit = 20, category, search, sort }) {
  const offset = (page - 1) * limit;
  let query = `
    SELECT p.id, p.name, p.slug, p.description, p.price, p.compare_at_price AS "compareAtPrice",
           p.currency, p.stock, p.sku, p.tags, p.images, p.specs, p.is_active AS "isActive",
           p.discount, json_build_object('average', p.rating_average, 'count', p.rating_count) AS rating,
           json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) AS category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = TRUE
  `;
  const params = [];
  if (category) {
    params.push(category);
    query += ` AND c.slug = $${params.length}`;
  }
  query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const res = await pool.query(query, params);
  const countRes = await pool.query('SELECT COUNT(*) FROM products WHERE is_active = TRUE');
  return {
    data: res.rows,
    pagination: { total: parseInt(countRes.rows[0].count, 10), page, limit, totalPages: Math.ceil(countRes.rows[0].count / limit) }
  };
}

module.exports = { getProducts };
```

---

## 📋 Phase 5 Tasks & "Done When" Checklist

### Tasks:
1. Create `testbed-postgres/server/db/schema.sql`.
2. Setup connection pool in `testbed-postgres/server/db/pool.js`.
3. Implement SQL query modules in `testbed-postgres/server/queries/`.
4. Connect Express route controllers in `testbed-postgres/server/routes/`.

### Done When:
- [ ] `npm run init-schema` creates all 8 tables in PostgreSQL during development.
- [ ] API endpoints on App B return identical JSON payloads to App A.

---
---

# PHASE 6: PostgreSQL Direct Seeding Engine (For PG → Mongo Demos)

---

## In Simple Terms — Direct PostgreSQL Seeding

If an evaluator asks: *"Show me PostgreSQL to MongoDB first"*, we need to pre-seed the PostgreSQL database directly so App B has data before migration.

---

## Foreign Key Dependency Order Insertion

Build `testbed-postgres/scripts/`:
1. `seedUsers.js` (2,000 rows)
2. `seedCategories.js` (50 rows in parent-child hierarchy)
3. `seedProducts.js` (500 rows)
4. `seedOrders.js` (5,000 orders + 32,000+ `order_items` exploded)
5. `seedReviews.js` (3,000 rows)
6. `seedInventoryLogs.js` (10,000 rows)
7. `seedCoupons.js` (100 rows)
8. `seedAll.js` (Master runner)

---

## 📋 Phase 6 Tasks & "Done When" Checklist

### Tasks:
1. Implement direct PostgreSQL seed scripts in `testbed-postgres/scripts/`.
2. Add `"seed": "node scripts/seedAll.js"` to `testbed-postgres/package.json`.

### Done When:
- [ ] Running `npm run seed` in `testbed-postgres` populates PostgreSQL with 20,750 rows directly in under 45 seconds.

---
---

# PHASE 7: Automated 5-Test Verification Suite

---

## In Simple Terms — The Verification Suite

After MigrateIQ finishes migrating data, the verification suite runs 5 automated tests to prove 100% data integrity with zero data loss.

---

## The 5 Automated Tests & Exact Query Logic

Build `verify/tests/`:

### Test 1: Row Count Audit (`verify/tests/rowCountAudit.js`)
Asserts exact row counts for all 7 collections vs tables:
- `users`: 2,000
- `categories`: 50
- `products`: 500
- `orders`: 5,000 (and `order_items` >= 15,000)
- `reviews`: 3,000
- `inventory_logs`: 10,000
- `coupons`: 100

### Test 2: Revenue Sum Reconciliation (`verify/tests/revenueSumReconciliation.js`)
- **MongoDB:** `db.orders.aggregate([{ $group: { _id: null, total: { $sum: "$total_amount" } } }])`
- **PostgreSQL:** `SELECT ROUND(SUM(total_amount), 2) AS total FROM orders;`
- **Pass:** Exact decimal match down to the penny.

### Test 3: MD5 Checksum Spot Check (`verify/tests/md5ChecksumSpotCheck.js`)
- Samples 500 random user records by email.
- Generates MD5 hash of normalized field values.
- **Pass:** 500/500 hashes match identically (100%).

### Test 4: Foreign Key Integrity Check (`verify/tests/foreignKeyIntegrity.js`)
```sql
SELECT COUNT(*) AS orphans FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id WHERE o.id IS NULL;
SELECT COUNT(*) AS orphans FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE u.id IS NULL;
SELECT COUNT(*) AS orphans FROM reviews r LEFT JOIN products p ON r.product_id = p.id WHERE p.id IS NULL;
```
- **Pass:** 0 orphan rows across all relationships.

### Test 5: API Response Parity (`verify/tests/apiResponseParity.js`)
- Sends 100 identical HTTP GET requests to `localhost:3001` (App A) and `localhost:3002` (App B).
- **Pass:** Identical HTTP status code and matching payload structures.

### Performance Benchmark Module (`verify/tests/performanceBenchmark.js`)
- Executes 1,000 parallel test queries (PK lookup, category filter, join/aggregation) against both MongoDB and PostgreSQL.
- Measures average latency (ms), p95 latency, and throughput (queries/sec).
- Outputs comparative performance data for inclusion in the final Executive Audit Report.

---

## Verification Report Generation (JSON + Markdown)

In `verify/verify.js`:
Outputs terminal summary and generates `verify/reports/verification-report.json` and `verify/reports/verification-report.md`.

---

## 📋 Phase 7 Tasks & "Done When" Checklist

### Tasks:
1. Build all 5 test modules in `verify/tests/`.
2. Build master runner `verify/verify.js`.
3. Add `"verify": "node verify.js"` to `verify/package.json`.

### Done When:
- [ ] Running `npm run verify` runs all 5 tests and outputs a green `PASS` summary report.

---
---

# PHASE 8: MigrateIQ Live Integration & Cloud Verification

---

## In Simple Terms — Running Live Migrations

This phase brings MigrateIQ and ShopBridge together for the live demonstration.

---

## Workflow A Demo Flow: MongoDB → PostgreSQL

1. Seed MongoDB: `npm run seed` in `testbed-mongo`.
2. Ensure PostgreSQL database is **100% blank** (no tables).
3. Open MigrateIQ desktop app → Select "MongoDB → PostgreSQL".
4. Enter source & target connection strings.
5. Review AI schema mapping and Risk Report warnings.
6. Run Dry Run (simulates inside transaction → rollbacks).
7. Run Live Migration (creates tables, streams 20,750 documents).
8. Run `npm run verify` in `verify/` (all 5 tests pass).
9. Open `localhost:3002` (App B) in browser → Shop is 100% operational on PostgreSQL!

---

## Workflow B Demo Flow: PostgreSQL → MongoDB

1. Ensure PostgreSQL is populated (`npm run seed` in `testbed-postgres`).
2. Ensure MongoDB database is **100% blank**.
3. Open MigrateIQ → Select "PostgreSQL → MongoDB".
4. MigrateIQ re-embeds `order_items` child rows into `orders.items` arrays.
5. Run migration → Open `localhost:3001` (App A) → Shop is operational on MongoDB!

---

## Cloud Database Testing (MongoDB Atlas, Supabase, Neon)

Test all 4 matrix scenarios:
1. **Local → Local:** `localhost:27017` → `localhost:5432`
2. **Cloud → Local:** MongoDB Atlas (`mongodb+srv://...`) → `localhost:5432`
3. **Local → Cloud:** `localhost:27017` → Supabase (`postgresql://postgres:...@db...supabase.co:5432/postgres`)
4. **Cloud → Cloud:** MongoDB Atlas → Supabase (Best for live evaluation demo!).

---

## Expected Risk Report Warning Matrix

| Risk Level | Warning Detected by MigrateIQ | Resolution |
| :--- | :--- | :--- |
| 🔴 Critical | Embedded `orders.items` array | Normalized into `order_items` table |
| 🔴 Critical | Polymorphic `products.specs` | Stored as PostgreSQL `JSONB` |
| 🟡 Warning | Mixed `users.phone` types | Normalized to `VARCHAR(30)` |
| 🟡 Warning | String prices in `products.price` | Parsed to `NUMERIC(12,2)` |
| 🟡 Warning | Mixed date formats in `orders.placedAt` | Converted to `TIMESTAMPTZ` |
| 🟡 Warning | Self-referencing `categories.parent_id` | Sorted in topological order |

---

## 📋 Phase 8 Tasks & "Done When" Checklist

### Tasks:
1. Create free MongoDB Atlas cluster and Supabase instance.
2. Run MigrateIQ end-to-end migration using cloud connection strings.
3. Run verification suite against cloud instances.

### Done When:
- [ ] Cloud migration succeeds and all 5 verification tests pass.

---
---

# PHASE 9: Final FYP Demo Readiness & Presentation Guide

---

## In Simple Terms — How to Present the Project

During your final year presentation, you demonstrate MigrateIQ as the professional tool and ShopBridge as the live verification proof.

---

## Terminal Commands Cheat Sheet

```powershell
# 1. Start App A (MongoDB)
cd testbed-mongo
npm run dev

# 2. Seed MongoDB Data
npm run seed

# 3. (Run Migration in MigrateIQ Desktop App)

# 4. Start App B (PostgreSQL)
cd ../testbed-postgres
npm run dev

# 5. Run Automated Verification
cd ../verify
npm run verify
```

---

## Evaluator Q&A Preparation

* **Q: Did you manually write SQL tables before migrating?**
  * *A: No! The PostgreSQL database starts 100% blank. MigrateIQ read MongoDB schemas, inferred column types, created all tables and indexes, and migrated the data.*
* **Q: How do you prove no data was lost?**
  * *A: We run our 5-stage automated verification suite which performs row count audits, penny-accurate revenue sum checks, MD5 checksum spot tests on 500 users, foreign key integrity checks, and 100 API response parity assertions.*

---

## 📋 Phase 9 Tasks & "Done When" Checklist

### Done When:
- [ ] Team has rehearsed the live demo flow from start to finish.
- [ ] All verification test results are green.
- [ ] Final project presentation is ready!

---
---

*ShopBridge Master Blueprint & Sequential Phase Plan v1.0 — Ready for Implementation*
