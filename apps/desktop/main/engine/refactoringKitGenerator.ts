/**
 * MigrateIQ - Refactoring Kit Generator Engine (Phase 10)
 * 
 * Generates a comprehensive developer migration toolkit (.zip):
 * 1. `schema.prisma` - Production-grade Prisma ORM schema for target PostgreSQL tables
 * 2. `mql-sql-cheatsheet.md` - Side-by-side MQL to SQL query conversion reference
 * 3. `layer2-migration-guide.md` - Application logic conversion guide (procedures, triggers, joins)
 * 4. `compatibility-report.md` - Detailed audit of mapped structures, type transformations & skipped rows
 */

import type { Archiver, ArchiverOptions } from 'archiver';
import { createWriteStream, promises as fs } from 'fs';
import * as path from 'path';
import type {
  CollectionMapping,
  RefactoringKitPayload,
  ERDTable,
  ERDRelation,
  SkippedRowRecord
} from '@migrateiq/shared';

function singularize(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (lower.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('ches') || lower.endsWith('shes')) return word.slice(0, -2);
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && !lower.endsWith('is')) return word.slice(0, -1);
  return word;
}

/**
 * Converts a snake_case or table name into PascalCase for Prisma model name (e.g. "order_items" -> "OrderItem")
 */
function toPascalCase(str: string): string {
  if (!str) return 'Model';
  const parts = str.replace(/[^a-zA-Z0-9_]/g, '_').split('_').filter(Boolean);
  if (parts.length === 0) return 'Model';

  // Singularize the last word according to Prisma conventions
  const lastIndex = parts.length - 1;
  parts[lastIndex] = singularize(parts[lastIndex]);

  return parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('') || 'Model';
}

/**
 * Converts snake_case column name into camelCase for Prisma field name
 */
function toCamelCase(str: string): string {
  if (!str) return 'field';
  const parts = str.replace(/[^a-zA-Z0-9_]/g, '_').split('_').filter(Boolean);
  if (parts.length === 0) return 'field';
  return parts[0].toLowerCase() + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
}

/**
 * Maps PostgreSQL data types to Prisma scalar types
 */
function sqlToPrismaType(sqlType: string): string {
  const lower = (sqlType || '').toLowerCase().trim();
  if (lower.startsWith('int') || lower.startsWith('serial')) return 'Int';
  if (lower.startsWith('bigint') || lower.startsWith('bigserial')) return 'BigInt';
  if (lower.startsWith('smallint')) return 'Int';
  if (lower.startsWith('bool')) return 'Boolean';
  if (lower.startsWith('numeric') || lower.startsWith('decimal')) return 'Decimal';
  if (lower.startsWith('float') || lower.startsWith('double') || lower.startsWith('real')) return 'Float';
  if (lower.startsWith('timestamp') || lower.startsWith('date')) return 'DateTime';
  if (lower.startsWith('json')) return 'Json';
  if (lower.startsWith('bytea')) return 'Bytes';
  if (lower.startsWith('uuid')) return 'String';
  return 'String';
}

/**
 * Generates ready-to-use Prisma schema
 */
export function generatePrismaSchema(
  tables: ERDTable[],
  relations: ERDRelation[] = []
): string {
  const lines: string[] = [];

  lines.push(`// ============================================================================`);
  lines.push(`// MigrateIQ - Generated Prisma ORM Schema`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(`// Target Database: PostgreSQL`);
  lines.push(`// ============================================================================`);
  lines.push(``);
  lines.push(`generator client {`);
  lines.push(`  provider = "prisma-client-js"`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`datasource db {`);
  lines.push(`  provider = "postgresql"`);
  lines.push(`  url      = env("DATABASE_URL")`);
  lines.push(`}`);
  lines.push(``);

  const relationsByChild = new Map<string, ERDRelation[]>();
  const relationsByParent = new Map<string, ERDRelation[]>();

  for (const rel of relations) {
    if (!relationsByChild.has(rel.childTable)) relationsByChild.set(rel.childTable, []);
    relationsByChild.get(rel.childTable)!.push(rel);

    if (!relationsByParent.has(rel.parentTable)) relationsByParent.set(rel.parentTable, []);
    relationsByParent.get(rel.parentTable)!.push(rel);
  }

  for (const table of tables) {
    const modelName = toPascalCase(table.name);
    lines.push(`model ${modelName} {`);

    const fieldsRendered = new Set<string>();

    for (const col of table.columns) {
      const fieldName = toCamelCase(col.name);
      fieldsRendered.add(fieldName);
      const prismaType = sqlToPrismaType(col.type);

      let attributes = '';
      if (col.name.toLowerCase() !== fieldName) {
        attributes += ` @map("${col.name}")`;
      }

      if (col.isPrimary) {
        attributes = ` @id @default(autoincrement())` + attributes;
      }

      lines.push(`  ${fieldName.padEnd(16)} ${prismaType}${attributes}`);
    }

    // 1. Child -> Parent Relation (BelongsTo)
    const childRels = relationsByChild.get(table.name) || [];
    for (const rel of childRels) {
      const parentModel = toPascalCase(rel.parentTable);
      const relFieldName = toCamelCase(singularize(rel.parentTable));
      const fkFieldName = toCamelCase(rel.childColumn);

      lines.push(`  ${relFieldName.padEnd(16)} ${parentModel} @relation(fields: [${fkFieldName}], references: [${toCamelCase(rel.parentColumn)}])`);
    }

    // 2. Parent -> Child Relations (HasMany)
    const parentRels = relationsByParent.get(table.name) || [];
    for (const rel of parentRels) {
      const childModel = toPascalCase(rel.childTable);
      const rawChild = toCamelCase(rel.childTable);
      const hasManyFieldName = rawChild.endsWith('s') ? rawChild : `${rawChild}s`;

      lines.push(`  ${hasManyFieldName.padEnd(16)} ${childModel}[]`);
    }

    lines.push(``);
    lines.push(`  @@map("${table.name}")`);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join('\n');
}

/**
 * Generates side-by-side MQL to SQL cheatsheet
 */
export function generateMqlSqlCheatsheet(): string {
  return `# 🚀 MigrateIQ — MongoDB (MQL) to PostgreSQL (SQL) Cheatsheet

This reference provides production-tested translations from MongoDB Query Language (MQL) to standard PostgreSQL SQL.

---

## 1. Basic CRUD Operations

| Operation | MongoDB Query Language (MQL) | PostgreSQL (SQL) |
| :--- | :--- | :--- |
| **Find All** | \`db.users.find({})\` | \`SELECT * FROM users;\` |
| **Find by ID** | \`db.users.findOne({ _id: ObjectId("...") })\` | \`SELECT * FROM users WHERE id = $1;\` |
| **Find with Limit** | \`db.users.find({}).limit(10)\` | \`SELECT * FROM users LIMIT 10;\` |
| **Find with Pagination** | \`db.users.find({}).skip(20).limit(10)\` | \`SELECT * FROM users LIMIT 10 OFFSET 20;\` |
| **Sorting** | \`db.users.find({}).sort({ created_at: -1 })\` | \`SELECT * FROM users ORDER BY created_at DESC;\` |
| **Insert One** | \`db.users.insertOne({ name: "Alice", email: "a@test.com" })\` | \`INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *;\` |
| **Update One** | \`db.users.updateOne({ _id: id }, { $set: { name: "Bob" } })\` | \`UPDATE users SET name = $1 WHERE id = $2 RETURNING *;\` |
| **Delete One** | \`db.users.deleteOne({ _id: id })\` | \`DELETE FROM users WHERE id = $1;\` |

---

## 2. Comparison & Logical Operators

| Operation | MongoDB (MQL) | PostgreSQL (SQL) |
| :--- | :--- | :--- |
| **Equality** | \`{ status: "active" }\` | \`WHERE status = 'active'\` |
| **Not Equal** | \`{ status: { $ne: "banned" } }\` | \`WHERE status <> 'banned'\` |
| **Greater Than** | \`{ age: { $gt: 18 } }\` | \`WHERE age > 18\` |
| **In Set** | \`{ role: { $in: ["admin", "editor"] } }\` | \`WHERE role IN ('admin', 'editor')\` |
| **Not In Set** | \`{ role: { $nin: ["guest"] } }\` | \`WHERE role NOT IN ('guest')\` |
| **Logical AND** | \`{ $and: [{ active: true }, { age: { $gte: 21 } }] }\` | \`WHERE active = true AND age >= 21\` |
| **Logical OR** | \`{ $or: [{ role: "admin" }, { verified: true }] }\` | \`WHERE role = 'admin' OR verified = true\` |
| **Field Exists** | \`{ phone: { $exists: true, $ne: null } }\` | \`WHERE phone IS NOT NULL\` |
| **Regex Match** | \`{ email: { $regex: "@gmail\\.com$", $options: "i" } }\` | \`WHERE email ILIKE '%@gmail.com'\` |

---

## 3. Aggregations & Joins

### Count & Average
**MongoDB:**
\`\`\`javascript
db.orders.aggregate([
  { $group: { _id: "$user_id", totalOrders: { $sum: 1 }, avgAmount: { $avg: "$amount" } } }
])
\`\`\`
**PostgreSQL:**
\`\`\`sql
SELECT user_id, COUNT(*) AS total_orders, AVG(amount) AS avg_amount
FROM orders
GROUP BY user_id;
\`\`\`

### $lookup vs SQL JOIN
**MongoDB:**
\`\`\`javascript
db.orders.aggregate([
  {
    $lookup: {
      from: "users",
      localField: "user_id",
      foreignField: "_id",
      as: "user"
    }
  },
  { $unwind: "$user" },
  { $project: { "user.name": 1, amount: 1 } }
])
\`\`\`
**PostgreSQL:**
\`\`\`sql
SELECT u.name, o.amount
FROM orders o
JOIN users u ON o.user_id = u.id;
\`\`\`

---

## 4. Querying JSON / JSONB Columns

PostgreSQL provides first-class JSONB querying:

| Pattern | SQL Example |
| :--- | :--- |
| **Extract Text Value** | \`SELECT metadata->>'tier' FROM users;\` |
| **Extract Nested Object** | \`SELECT settings->'theme'->>'mode' FROM accounts;\` |
| **Filter by JSON Key** | \`WHERE metadata->>'status' = 'verified'\` |
| **JSON Array Contains** | \`WHERE tags @> '["featured"]'::jsonb\` |
| **Key Exists in JSON** | \`WHERE metadata ? 'referral_code'\` |

---

## 5. Transactions & Concurrency

| Pattern | MongoDB (MQL) | PostgreSQL (SQL) |
| :--- | :--- | :--- |
| **Begin Transaction** | \`session.startTransaction()\` | \`BEGIN;\` |
| **Commit** | \`session.commitTransaction()\` | \`COMMIT;\` |
| **Rollback** | \`session.abortTransaction()\` | \`ROLLBACK;\` |
| **Savepoint** | *Not natively supported* | \`SAVEPOINT sp1; / ROLLBACK TO sp1;\` |
`;
}

/**
 * Generates Layer 2 Migration Guide
 */
export function generateLayer2MigrationGuide(direction?: string): string {
  const isPgToMongo = direction === 'postgres-to-mongo';

  if (isPgToMongo) {
    return `# 📋 Layer 2 Application Logic Migration Guide (PostgreSQL → MongoDB)

When migrating from PostgreSQL to MongoDB, relational database triggers, stored procedures, and complex foreign key constraints must be migrated into application services or Mongoose hooks.

---

## 1. Stored Procedures → Node.js Services

### Example: Calculate Order Total with Tax
**Original PostgreSQL Procedure:**
\`\`\`sql
CREATE OR REPLACE FUNCTION calculate_order_total(p_order_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  v_subtotal NUMERIC;
BEGIN
  SELECT SUM(price * quantity) INTO v_subtotal FROM order_items WHERE order_id = p_order_id;
  RETURN v_subtotal * 1.08;
END;
$$ LANGUAGE plpgsql;
\`\`\`

**Rewrite as Node.js / Mongoose Service:**
\`\`\`javascript
async function calculateOrderTotal(orderId) {
  const order = await Order.findById(orderId).populate('items');
  if (!order) throw new Error('Order not found');
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return Math.round(subtotal * 1.08 * 100) / 100;
}
\`\`\`

---

## 2. Triggers → Mongoose Lifecycle Hooks

### Example: Auto-Update Inventory on Order Placement
**Original PostgreSQL Trigger:**
\`\`\`sql
CREATE TRIGGER update_stock AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION deduct_product_inventory();
\`\`\`

**Rewrite as Mongoose \`post('save')\` Hook:**
\`\`\`javascript
orderSchema.post('save', async function(doc) {
  for (const item of doc.items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: -item.quantity }
    });
  }
});
\`\`\`

---

## 3. SQL Views → MongoDB Aggregation Pipelines

**Original View:**
\`\`\`sql
CREATE VIEW vw_customer_lifetime_value AS
SELECT u.id, u.email, SUM(o.total_amount) AS ltv
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.email;
\`\`\`

**MongoDB Aggregate Equivalent:**
\`\`\`javascript
const ltvPipeline = [
  {
    $lookup: {
      from: 'orders',
      localField: '_id',
      foreignField: 'userId',
      as: 'orders'
    }
  },
  {
    $project: {
      email: 1,
      ltv: { $sum: '$orders.totalAmount' }
    }
  }
];
\`\`\`
`;
  }

  // MongoDB -> PostgreSQL Guide
  return `# 📋 Layer 2 Application Logic Migration Guide (MongoDB → PostgreSQL)

When migrating from MongoDB to PostgreSQL, application-level schema enforcement and client-side joins are replaced by native SQL constraints, indexes, and transactional boundaries.

---

## 1. Connecting Node.js Applications with Prisma

To connect your existing Node.js or TypeScript application to PostgreSQL:

1. Copy the generated \`schema.prisma\` file to your project root under \`prisma/schema.prisma\`.
2. Configure your \`.env\` file with your PostgreSQL connection URL:
   \`\`\`env
   DATABASE_URL="postgresql://user:password@localhost:5432/my_database?schema=public"
   \`\`\`
3. Generate the Prisma Client:
   \`\`\`bash
   npx prisma generate
   \`\`\`
4. Query with full type safety:
   \`\`\`typescript
   import { PrismaClient } from '@prisma/client';
   const prisma = new PrismaClient();

   // Query with relational joins
   const users = await prisma.user.findMany({
     include: { orders: true }
   });
   \`\`\`

---

## 2. Real-Time Change Events: Change Streams → LISTEN / NOTIFY

In MongoDB, applications watch collection mutations using \`watch()\`. In PostgreSQL, utilize native transactional \`LISTEN\` and \`NOTIFY\`:

\`\`\`sql
-- Trigger notification on order changes
CREATE OR REPLACE FUNCTION notify_order_event()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('order_events', json_build_object(
    'operation', TG_OP,
    'id', NEW.id,
    'user_id', NEW.user_id
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_notify
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_order_event();
\`\`\`

---

## 3. Denormalized Arrays vs Relational Foreign Keys

MongoDB embedded document arrays have been normalized into relational child tables.
* Every child record contains an auto-generated \`sort_order INTEGER NOT NULL\` column guaranteeing exact preservation of original element indexing.
* When querying child records in order, always append \`ORDER BY sort_order ASC\`.
`;
}

/**
 * Generates the compatibility audit report
 */
export function generateCompatibilityReport(
  mappings: CollectionMapping[] = [],
  skippedRows: SkippedRowRecord[] = []
): string {
  const lines: string[] = [];

  lines.push(`# 🛡️ MigrateIQ — Migration Compatibility & Fidelity Report`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Total Collections / Tables Mapped:** ${mappings.length}`);
  lines.push(`**Skipped Records:** ${skippedRows.length}`);
  lines.push(``);

  lines.push(`## 1. Structural Transformations`);
  lines.push(``);
  lines.push(`| Source Collection | Target Table | Fields Mapped | Child Tables Normalized |`);
  lines.push(`| :--- | :--- | :--- | :--- |`);

  for (const m of mappings) {
    const includedFields = m.fields.filter(f => f.include && !f.isChildTable).length;
    const childTableCount = m.childTables ? m.childTables.length : 0;
    lines.push(`| \`${m.collectionName}\` | \`${m.targetTableName}\` | ${includedFields} | ${childTableCount} |`);
  }
  lines.push(``);

  lines.push(`## 2. Architectural Invariants Applied`);
  lines.push(`- **Primary Key Alignment:** MongoDB \`_id\` mapped to PostgreSQL sequence \`id SERIAL PRIMARY KEY\` or indexed identity.`);
  lines.push(`- **Child Table Ordering:** All embedded arrays normalized to child tables feature an auto-generated \`sort_order INTEGER NOT NULL\` index.`);
  lines.push(`- **Numeric Precision:** High-precision decimals converted to PostgreSQL \`NUMERIC\` preserving lossless precision.`);
  lines.push(`- **SQL Injection Defense:** All queries parameterized with sanitizeIdentifier safeguards.`);
  lines.push(``);

  if (skippedRows.length > 0) {
    lines.push(`## 3. Skipped Records Audit (${skippedRows.length} Rows)`);
    lines.push(``);
    lines.push(`| Document ID | Collection | Reason |`);
    lines.push(`| :--- | :--- | :--- |`);
    for (const sr of skippedRows.slice(0, 100)) {
      lines.push(`| \`${sr.documentId}\` | \`${sr.collection}\` | ${sr.reason.replace(/\|/g, '\\|')} |`);
    }
    if (skippedRows.length > 100) {
      lines.push(`| *... and ${skippedRows.length - 100} more records* | | |`);
    }
  } else {
    lines.push(`## 3. Skipped Records Audit`);
    lines.push(`✅ **Zero records skipped.** 100% data fidelity preserved across all tables.`);
  }

  return lines.join('\n');
}

/**
 * Packages the Refactoring Kit into a ZIP archive and writes to destination
 */
export async function createRefactoringKitZip(
  payload: RefactoringKitPayload,
  outputPath: string
): Promise<{ success: boolean; filePath: string; byteCount: number; error?: string }> {
  try {
    const {
      collectionMappings = [],
      direction = 'mongodb-to-postgres',
      skippedRows = [],
      targetTables = [],
      targetRelations = []
    } = payload;

    // Generate in-memory files
    const prismaContent = generatePrismaSchema(targetTables, targetRelations);
    const cheatsheetContent = generateMqlSqlCheatsheet();
    const layer2Content = generateLayer2MigrationGuide(direction);
    const compatibilityContent = generateCompatibilityReport(collectionMappings, skippedRows);

    // Create write stream & archiver
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const outputStream = createWriteStream(outputPath);
    const archiverFactory = require('archiver') as (format: string, options?: ArchiverOptions) => Archiver;
    const archive = archiverFactory('zip', { zlib: { level: 9 } });

    const zipPromise = new Promise<{ success: boolean; filePath: string; byteCount: number }>((resolve, reject) => {
      outputStream.on('close', () => {
        resolve({
          success: true,
          filePath: outputPath,
          byteCount: archive.pointer()
        });
      });

      archive.on('error', (err: Error) => {
        reject(err);
      });
    });

    archive.pipe(outputStream);

    // Append 4 required files
    archive.append(prismaContent, { name: 'schema.prisma' });
    archive.append(cheatsheetContent, { name: 'mql-sql-cheatsheet.md' });
    archive.append(layer2Content, { name: 'layer2-migration-guide.md' });
    archive.append(compatibilityContent, { name: 'compatibility-report.md' });

    await archive.finalize();
    const result = await zipPromise;
    return result;
  } catch (err) {
    return {
      success: false,
      filePath: outputPath,
      byteCount: 0,
      error: (err as Error).message || 'Failed to generate Refactoring Kit ZIP'
    };
  }
}

