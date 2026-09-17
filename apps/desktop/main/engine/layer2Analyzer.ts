/**
 * MigrateIQ - Layer 2 Analyzer & Migration Code Generator
 *
 * Scans PostgreSQL schema catalogs for database-level business logic
 * (stored procedures, functions, triggers, views, enums, composite PKs)
 * and generates drop-in replacement Node.js/Mongoose code guides.
 *
 * References:
 * - phase_plan-v2.md Lines 531-547 (Section 7.3)
 * - product_blueprint-v7.md Lines 839-956 (Layer 2 Application Features)
 * - product_blueprint-v7.md Lines 1860-1864 (Challenge 16 - Zero Data Corruption)
 */

import { Client as PgClient } from 'pg';
import type { ConnectionConfig, Layer2FeatureItem } from '@migrateiq/shared';

export interface PostgresLayer2Raw {
  procedures: Array<{ name: string; args: string }>;
  functions: Array<{ name: string; args: string; ret: string }>;
  triggers: Array<{ name: string; table: string; event: string }>;
  views: Array<{ name: string; definition: string }>;
  enums: Array<{ name: string; values: string[] }>;
  compositePks: Array<{ table: string; columns: string[] }>;
}

/**
 * Introspect PostgreSQL catalogs for deep Layer 2 application features.
 * Parameterized queries protect against SQL injection and respect target schema.
 */
export async function introspectLayer2Catalogs(
  config: ConnectionConfig
): Promise<PostgresLayer2Raw> {
  const targetSchema = config.schema?.trim() || 'public';
  let client: PgClient | null = null;

  try {
    if (config.connectionString && config.connectionString.trim().length > 0) {
      client = new PgClient({
        connectionString: config.connectionString.trim(),
        connectionTimeoutMillis: 5000,
      });
    } else {
      client = new PgClient({
        host: config.host || 'localhost',
        port: config.port || 5432,
        user: config.user,
        password: config.password,
        database: config.database,
        connectionTimeoutMillis: 5000,
      });
    }

    await client.connect();

    // 1. Stored Procedures (prokind = 'p')
    const procResult = await client.query(
      `
      SELECT 
        p.proname as name,
        pg_get_function_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = $1 AND p.prokind = 'p'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_temp%'
        AND p.proname NOT LIKE 'pg_%'
        AND p.proname NOT LIKE '_pg%'
      ORDER BY p.proname;
      `,
      [targetSchema]
    );

    // 2. Functions (prokind = 'f' and not system functions)
    const funcResult = await client.query(
      `
      SELECT 
        p.proname as name,
        pg_get_function_arguments(p.oid) as args,
        pg_get_function_result(p.oid) as ret
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = $1 AND p.prokind = 'f'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_temp%'
        AND p.proname NOT LIKE 'pg_%'
        AND p.proname NOT LIKE '_pg%'
      ORDER BY p.proname;
      `,
      [targetSchema]
    );

    // 3. Triggers (non-internal)
    const trigResult = await client.query(
      `
      SELECT 
        t.tgname as name,
        c.relname as table,
        CASE 
          WHEN (t.tgtype::int & 2) != 0 THEN 'BEFORE'
          WHEN (t.tgtype::int & 64) != 0 THEN 'INSTEAD OF'
          ELSE 'AFTER'
        END || ' ' ||
        CASE 
          WHEN (t.tgtype::int & 4) != 0 THEN 'INSERT'
          WHEN (t.tgtype::int & 8) != 0 THEN 'DELETE'
          WHEN (t.tgtype::int & 16) != 0 THEN 'UPDATE'
          ELSE 'EVENT'
        END as event
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = $1 AND NOT t.tgisinternal
      ORDER BY t.tgname;
      `,
      [targetSchema]
    );

    // 4. Views
    const viewResult = await client.query(
      `
      SELECT 
        viewname as name,
        COALESCE(definition, '') as definition
      FROM pg_views
      WHERE schemaname = $1
      ORDER BY viewname;
      `,
      [targetSchema]
    );

    // 5. ENUM Types
    const enumResult = await client.query(
      `
      SELECT 
        t.typname as name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_namespace n ON t.typnamespace = n.oid
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE n.nspname = $1 AND t.typtype = 'e'
      GROUP BY t.typname;
      `,
      [targetSchema]
    );

    // 6. Composite Primary Keys (multi-column PKs)
    const pkResult = await client.query(
      `
      SELECT 
        c.relname as table,
        array_agg(a.attname ORDER BY u.pos) as columns
      FROM pg_constraint con
      JOIN pg_class c ON con.conrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, pos)
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = u.attnum
      WHERE n.nspname = $1 AND con.contype = 'p'
      GROUP BY c.relname
      HAVING count(*) > 1;
      `,
      [targetSchema]
    );

    return {
      procedures: procResult.rows.map((r) => ({
        name: r.name,
        args: r.args || '',
      })),
      functions: funcResult.rows.map((r) => ({
        name: r.name,
        args: r.args || '',
        ret: r.ret || 'text',
      })),
      triggers: trigResult.rows.map((r) => ({
        name: r.name,
        table: r.table,
        event: r.event || 'AFTER INSERT',
      })),
      views: viewResult.rows.map((r) => ({
        name: r.name,
        definition: r.definition,
      })),
      enums: enumResult.rows.map((r) => ({
        name: r.name,
        values: Array.isArray(r.values) ? r.values : [],
      })),
      compositePks: pkResult.rows.map((r) => ({
        table: r.table,
        columns: Array.isArray(r.columns) ? r.columns : [],
      })),
    };
  } catch (error) {
    console.error('Layer 2 introspection warning (non-fatal):', error instanceof Error ? error.message : error);
    return {
      procedures: [],
      functions: [],
      triggers: [],
      views: [],
      enums: [],
      compositePks: [],
    };
  } finally {
    if (client) {
      await client.end().catch(() => {});
    }
  }
}

/**
 * Transforms raw catalog records into user-facing Layer 2 guide items
 * with executable Mongoose and Node.js code snippets.
 */
export function buildLayer2FeatureItems(raw: PostgresLayer2Raw): Layer2FeatureItem[] {
  const items: Layer2FeatureItem[] = [];

  // 1. Procedures
  for (const p of raw.procedures) {
    items.push({
      id: `l2-proc-${p.name}`,
      type: 'procedure',
      name: `${p.name}(${p.args})`,
      signature: `PROCEDURE ${p.name}(${p.args})`,
      description: `PostgreSQL stored procedure "${p.name}". Executes transactional business routines inside the database server.`,
      whyNotMigrated: 'MongoDB databases do not have stored procedures. Business execution logic must reside in your backend application services.',
      replacementGuide: `Migrate logic into a TypeScript/Node.js service function (e.g. services/${p.name}.ts) called before document updates.`,
      codeSnippet: `// Node.js Backend Service Replacement: services/${p.name}.ts
export async function ${p.name}(${p.args ? 'params: Record<string, unknown>' : ''}): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 💡 Implement original procedural steps here using Mongoose models
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}`,
    });
  }

  // 2. Functions
  for (const f of raw.functions) {
    items.push({
      id: `l2-func-${f.name}`,
      type: 'function',
      name: `${f.name}(${f.args})`,
      signature: `FUNCTION ${f.name}(${f.args}) RETURNS ${f.ret}`,
      description: `PostgreSQL SQL function "${f.name}". Computes or concatenates fields and returns ${f.ret}.`,
      whyNotMigrated: 'MongoDB does not support persistent custom SQL functions.',
      replacementGuide: `Implement as an inlined helper function or a Mongoose schema virtual getter.`,
      codeSnippet: `// Application Helper Function:
export function ${f.name}(${f.args || 'record: any'}): ${f.ret.toLowerCase().includes('int') ? 'number' : 'string'} {
  // Replace with computation logic
  return ${f.ret.toLowerCase().includes('int') ? '0' : "''"};
}`,
    });
  }

  // 3. Triggers
  for (const t of raw.triggers) {
    items.push({
      id: `l2-trig-${t.name}`,
      type: 'trigger',
      name: t.name,
      targetObject: `${t.table} (${t.event})`,
      signature: `TRIGGER ${t.name} ${t.event} ON ${t.table}`,
      description: `Fires on table "${t.table}" upon "${t.event}". Enforces cascaded modifications or audits.`,
      whyNotMigrated: 'MongoDB does not support synchronous triggers without external CDC/Change Stream listeners.',
      replacementGuide: `Add a Mongoose post-save or pre-save middleware hook on the ${t.table} model.`,
      codeSnippet: `// Mongoose Middleware Hook: models/${t.table}.ts
${t.table}Schema.post('save', async function(doc) {
  // 💡 Replicate trigger logic triggered upon ${t.event}
  console.log('Trigger executed for doc:', doc._id);
});`,
    });
  }

  // 4. Views
  for (const v of raw.views) {
    items.push({
      id: `l2-view-${v.name}`,
      type: 'view',
      name: v.name,
      signature: `VIEW ${v.name} AS ...`,
      description: `Virtual table combining relational joins and calculations.`,
      whyNotMigrated: 'MongoDB collections are document stores. Relational joins must be queried using aggregation pipelines.',
      replacementGuide: `Replicate this view using a MongoDB $lookup aggregation pipeline or Mongoose populate.`,
      codeSnippet: `// Native MongoDB Aggregation Pipeline:
db.${v.name}.aggregate([
  { $lookup: { from: 'relatedCollection', localField: 'refId', foreignField: '_id', as: 'joinedData' } },
  { $project: { /* define projected output fields */ } }
]);`,
    });
  }

  // 5. ENUMs
  for (const e of raw.enums) {
    const valuesStr = e.values.map((v) => `'${v}'`).join(', ');
    items.push({
      id: `l2-enum-${e.name}`,
      type: 'enum',
      name: e.name,
      signature: `ENUM ${e.name} (${valuesStr})`,
      description: `PostgreSQL enum type restricting values to: [${valuesStr}].`,
      whyNotMigrated: 'MongoDB stores values as native BSON Strings. Enum enforcement moves to the application validator layer.',
      replacementGuide: 'Configure string enum validation in your Mongoose schema definition.',
      codeSnippet: `// Mongoose Schema Enum Definition:
statusField: {
  type: String,
  enum: [${valuesStr}],
  required: true,
}`,
    });
  }

  // 6. Composite Primary Keys
  for (const pk of raw.compositePks) {
    const colList = pk.columns.join(', ');
    const indexFields = pk.columns.reduce<Record<string, number>>((acc, col) => {
      acc[col] = 1;
      return acc;
    }, {});

    items.push({
      id: `l2-pk-${pk.table}`,
      type: 'composite_pk',
      name: `${pk.table} (PK: ${colList})`,
      targetObject: pk.table,
      signature: `PRIMARY KEY (${colList})`,
      description: `PostgreSQL composite primary key spanning columns [${colList}].`,
      whyNotMigrated: 'MongoDB documents strictly require a single scalar or ObjectId "_id" primary key.',
      replacementGuide: `A compound unique index on { ${colList} } is automatically applied. An auto-generated ObjectId is assigned to "_id".`,
      codeSnippet: `// Automatically Applied Compound Unique Index:
db.${pk.table}.createIndex(${JSON.stringify(indexFields)}, { unique: true });`,
      isAutoApplied: true,
    });
  }

  return items;
}
