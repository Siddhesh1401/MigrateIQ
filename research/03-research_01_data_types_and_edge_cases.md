# Deep Research: Area 1 — Data Types, Edge Cases & Conversion Safety

---

## 1. The Comprehensive Data Type Mapping Matrix

### 1.1 MongoDB (BSON) $\rightarrow$ PostgreSQL

| BSON Type | PostgreSQL Type | Edge Case Risk | Best Practice / Resolution |
| :--- | :--- | :--- | :--- |
| **ObjectId** (12-byte hex) | `VARCHAR(24)` or `UUID` | String length / index performance | Map to `VARCHAR(24)` for simplicity, or format as 32-char UUID string (`uuid` type) for fast b-tree indexing. |
| **String (UTF-8)** | `VARCHAR(N)` or `TEXT` | Text exceeding length bounds | Use `TEXT` by default, or `VARCHAR(N)` if maximum string length is validated during sampling. |
| **NumberInt** (32-bit int) | `INTEGER` | None | Direct 1:1 mapping ($-2^{31}$ to $2^{31}-1$). |
| **NumberLong** (64-bit int) | `BIGINT` | JavaScript 53-bit float precision loss | In Node.js backend, parse as `BigInt` or string to prevent JS number rounding ($> 9 \times 10^{15}$). |
| **Double** (64-bit float) | `DOUBLE PRECISION` | Minor floating-point rounding | Direct 1:1 IEEE 754 float mapping. |
| **Decimal128** (34 digits) | `NUMERIC(p, s)` | Precision truncation | Use PostgreSQL `NUMERIC` (arbitrary precision); never convert to `DOUBLE`. |
| **ISODate / Timestamp** | `TIMESTAMPTZ` | Timezone shifts | Always map to `TIMESTAMPTZ` (UTC-aware timestamp) to avoid timezone discrepancies. |
| **Boolean** | `BOOLEAN` | `true`/`false`/`null` | Direct 1:1 mapping; allow `NULL` if field is sparse. |
| **Binary (Subtype 4: UUID)** | `UUID` | Binary byte-order mismatch | Convert BSON binary buffer to standard 36-character hyphenated UUID string. |
| **Binary (Generic Buffer)** | `BYTEA` | Large memory footprint | Stream as hex or base64 into PostgreSQL `BYTEA`. |
| **Array of Primitives** (`[string]`, `[int]`) | `TEXT[]` or `INT[]` | Multidimensional arrays | Native PostgreSQL arrays, or fallback to `JSONB`. |
| **Array of Objects** (`[{...}]`) | Separate Child Table (with FK) or `JSONB` | Relational 1:N vs schema drift | If structured/uniform $\rightarrow$ Normalize into child table. If unstructured/dynamic $\rightarrow$ Store as `JSONB`. |
| **Nested Object** (`{ a: 1, b: 2 }`) | Flattened columns (`addr_city`, `addr_zip`) or `JSONB` | Deep nesting ($>3$ levels) | Flatten 1–2 levels; use `JSONB` for deeply nested or unpredictable shapes. |
| **Null / Missing field** | `NULL` (Column must not be `NOT NULL`) | Insertion failure if column is `NOT NULL` | Default all sparse MongoDB fields to nullable columns. |
| **GeoJSON Point** | `JSONB` or `geometry(Point, 4326)` | PostGIS extension dependency | Map to `JSONB` by default (or PostGIS if extension is enabled). |

---

### 1.2 PostgreSQL $\rightarrow$ MongoDB (BSON)

| PostgreSQL Type | MongoDB BSON Type | Conversion Strategy |
| :--- | :--- | :--- |
| `SERIAL` / `BIGSERIAL` / `INT` | `NumberInt` or `NumberLong` | Preserved as numeric ID or mapped to `_id`. |
| `UUID` | `UUID` (Binary Subtype 4) | Direct native BSON UUID. |
| `VARCHAR` / `TEXT` / `CHAR` | `String` | Direct string mapping. |
| `NUMERIC` / `DECIMAL` | `Decimal128` | Use `new mongoose.Types.Decimal128(val)`. |
| `BOOLEAN` | `Boolean` | Direct boolean mapping. |
| `TIMESTAMPTZ` / `TIMESTAMP` | `Date` (ISODate) | Convert to standard UTC Date object. |
| `JSON` / `JSONB` | `Object` / Embedded Document | Direct native BSON document embedding. |
| `ARRAY` (`TEXT[]`, `INT[]`) | BSON Array | Direct native array mapping. |
| `BYTEA` | `Binary` (Subtype 0) | Converted to BSON Binary buffer. |
| `ENUM` | `String` | Stored as string with optional `$jsonSchema` enum validator. |

---

## 2. Advanced Handling of Complex Edge Cases

### 2.1 Type Polymorphism (Mixed Types in Same Field)
* **Problem:** In MongoDB, `document_1` has `{ price: 100 }` (number), `document_2` has `{ price: "100.50" }` (string), and `document_3` has `{ price: null }`.
* **Solution Strategy:**
  1. **Detection:** During collection sampling, compute a frequency histogram of types for every field:
     $$\text{Types}(\text{price}) = \{ \text{Double}: 85\%, \text{String}: 10\%, \text{Null}: 5\% \}$$
  2. **Resolution Decision Tree:**
     * If all non-null types can safely cast to a common type (e.g. numeric strings $\rightarrow$ `NUMERIC`), apply a sanitizing cast during ETL.
     * If incompatible (e.g., $50\%$ `string`, $50\%$ `object`), flag a **Critical Warning** and map the column to PostgreSQL **`JSONB`** as an escape hatch to prevent data loss.

### 2.2 Deep Nesting Threshold & Normalization vs. JSONB
* **Rule of Thumb:**
  * **Level 1–2 Nesting (e.g., `user.address.city`):** Flatten into `address_city`, `address_pincode`. Very clean in SQL.
  * **Level 3+ Nesting (e.g., `user.meta.preferences.notifications.email.digest`):** Flattening creates 20+ cluttered columns with sparse data $\rightarrow$ Store `meta` as a native PostgreSQL **`JSONB`** column. PostgreSQL provides fast GIN indexing and JSON operators (`->`, `->>`, `@>`) on JSONB.

### 2.3 Arrays: 1-to-N Child Table vs. Native Postgres Array
* **Array of Primitives** (e.g. `tags: ["tech", "nodejs", "react"]`):
  * Map to `TEXT[]`. Clean, native, and supports Postgres `ANY()` queries.
* **Array of Structured Objects** (e.g. `orders.items: [{ productId, qty, price }]`):
  * **Relational Normalization:** Create table `order_items` with columns `(id, order_id, product_id, qty, price)` where `order_id` is a Foreign Key referencing `orders.id`.
  * **Data Insertion:** Generate UUID/serial IDs during insertion and maintain an in-memory parent-child mapping table.
