/**
 * MigrateIQ - Entity Relationship Diagram (ERD) Generator Engine
 * 
 * Inspects target PostgreSQL schema tables, columns, primary keys, and foreign keys,
 * or derives them from migration mappings, and compiles valid Mermaid.js `erDiagram` syntax
 * and structured graph models for interactive inline rendering and high-res export.
 */

import { Pool } from 'pg';
import type { 
  ConnectionConfig, 
  CollectionMapping, 
  ERDData, 
  ERDTable, 
  ERDColumn, 
  ERDRelation 
} from '@migrateiq/shared';
import { normalizeConnectionConfig } from '../utils';

/**
 * Clean data types for Mermaid ERD syntax (e.g. "VARCHAR(255)" -> "varchar", "NUMERIC(10,2)" -> "numeric")
 */
function sanitizeMermaidType(rawType: string): string {
  if (!rawType) return 'string';
  const cleaned = rawType.replace(/\([^)]*\)/g, '').trim().toLowerCase();
  return cleaned.replace(/[^a-z0-9_]/g, '_') || 'string';
}

/**
 * Clean table/column names to prevent Mermaid syntax breakdown
 */
function sanitizeMermaidIdentifier(id: string): string {
  if (!id) return 'unnamed';
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Introspects live PostgreSQL target database to discover real tables, columns, PKs, and FKs.
 */
export async function introspectPostgresERD(
  targetConfig: ConnectionConfig,
  targetTables?: string[]
): Promise<ERDData> {
  const normalized = normalizeConnectionConfig(targetConfig);
  const poolConfig = normalized.connectionString
    ? { connectionString: normalized.connectionString }
    : {
        host: normalized.host || 'localhost',
        port: normalized.port || 5432,
        user: normalized.user || 'postgres',
        password: normalized.password || '',
        database: normalized.database,
        ssl: normalized.ssl ? { rejectUnauthorized: false } : false
      };

  const pool = new Pool({
    ...poolConfig,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000
  });

  const client = await pool.connect();
  try {
    const schemaName = normalized.schema || 'public';

    // 1. Fetch tables & columns
    const columnsQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1
      ORDER BY table_name, ordinal_position;
    `;
    const colsRes = await client.query(columnsQuery, [schemaName]);

    // 2. Fetch primary keys
    const pkQuery = `
      SELECT
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1;
    `;
    const pkRes = await client.query(pkQuery, [schemaName]);
    const pkSet = new Set<string>();
    for (const row of pkRes.rows) {
      pkSet.add(`${row.table_name}.${row.column_name}`);
    }

    // 3. Fetch foreign keys
    const fkQuery = `
      SELECT
        tc.table_name AS child_table,
        kcu.column_name AS child_column,
        ccu.table_name AS parent_table,
        ccu.column_name AS parent_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1;
    `;
    const fkRes = await client.query(fkQuery, [schemaName]);

    const relations: ERDRelation[] = [];
    const fkMap = new Map<string, { parentTable: string; parentColumn: string }>();

    for (const row of fkRes.rows) {
      const childTable = row.child_table as string;
      const childCol = row.child_column as string;
      const parentTable = row.parent_table as string;
      const parentCol = row.parent_column as string;

      fkMap.set(`${childTable}.${childCol}`, { parentTable, parentColumn: parentCol });

      relations.push({
        parentTable,
        childTable,
        parentColumn: parentCol,
        childColumn: childCol,
        relationType: 'one-to-many',
        label: `${childCol}`
      });
    }

    // Filter by tables if specified
    const tableFilter = targetTables && targetTables.length > 0
      ? new Set(targetTables.map(t => t.toLowerCase()))
      : null;

    const tableMap = new Map<string, ERDColumn[]>();
    for (const row of colsRes.rows) {
      const tName = row.table_name as string;
      if (tableFilter && !tableFilter.has(tName.toLowerCase())) {
        continue;
      }

      const colName = row.column_name as string;
      const isPk = pkSet.has(`${tName}.${colName}`);
      const fkInfo = fkMap.get(`${tName}.${colName}`);
      const typeStr = sanitizeMermaidType(row.udt_name || row.data_type || 'string');

      if (!tableMap.has(tName)) {
        tableMap.set(tName, []);
      }
      tableMap.get(tName)!.push({
        name: colName,
        type: typeStr,
        isPrimary: isPk,
        isForeign: !!fkInfo,
        foreignTable: fkInfo?.parentTable
      });
    }

    const tables: ERDTable[] = [];
    for (const [name, columns] of tableMap.entries()) {
      tables.push({ name, columns });
    }

    // Filter relations where both parent and child table are present in tables list
    const activeTableSet = new Set(tables.map(t => t.name));
    const filteredRelations = relations.filter(
      r => activeTableSet.has(r.parentTable) && activeTableSet.has(r.childTable)
    );

    const mermaidCode = generateMermaidCode(tables, filteredRelations);

    return {
      tables,
      relations: filteredRelations,
      mermaidCode
    };
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Builds an ERD from in-memory schema mappings if live DB query is skipped or offline.
 */
export function buildERDFromMappings(
  mappings: CollectionMapping[]
): ERDData {
  const tables: ERDTable[] = [];
  const relations: ERDRelation[] = [];

  for (const m of mappings) {
    const parentTable = sanitizeMermaidIdentifier(m.targetTableName || m.collectionName);
    const parentCols: ERDColumn[] = [];

    // Parent primary key
    parentCols.push({
      name: 'id',
      type: 'integer',
      isPrimary: true,
      isForeign: false
    });

    for (const f of m.fields) {
      if (!f.include || f.isChildTable) continue;
      const colName = sanitizeMermaidIdentifier(f.targetColumn || f.sourceField);
      if (colName.toLowerCase() === 'id') continue;

      parentCols.push({
        name: colName,
        type: sanitizeMermaidType(f.targetType || 'varchar'),
        isPrimary: false,
        isForeign: false
      });
    }

    tables.push({ name: parentTable, columns: parentCols });

    // Child tables
    if (m.childTables && m.childTables.length > 0) {
      for (const ct of m.childTables) {
        const childTableName = sanitizeMermaidIdentifier(ct.targetTableName);
        const childCols: ERDColumn[] = [];

        childCols.push({
          name: 'id',
          type: 'integer',
          isPrimary: true,
          isForeign: false
        });

        // FK back to parent
        const fkName = sanitizeMermaidIdentifier(
          ct.fields.find(cf => cf.foreignKeyToParent)?.targetColumn || `${parentTable}_id`
        );
        childCols.push({
          name: fkName,
          type: 'integer',
          isPrimary: false,
          isForeign: true,
          foreignTable: parentTable
        });

        // Auto sort_order column (Mandatory Rule #4)
        childCols.push({
          name: 'sort_order',
          type: 'integer',
          isPrimary: false,
          isForeign: false
        });

        for (const cf of ct.fields) {
          if (!cf.include) continue;
          const cColName = sanitizeMermaidIdentifier(cf.targetColumn || cf.sourceField);
          if (cColName.toLowerCase() === 'id' || cColName === fkName || cColName === 'sort_order') {
            continue;
          }

          childCols.push({
            name: cColName,
            type: sanitizeMermaidType(cf.targetType || 'varchar'),
            isPrimary: false,
            isForeign: false
          });
        }

        tables.push({ name: childTableName, columns: childCols });

        relations.push({
          parentTable,
          childTable: childTableName,
          parentColumn: 'id',
          childColumn: fkName,
          relationType: 'one-to-many',
          label: `${parentTable}_id`
        });
      }
    }
  }

  const mermaidCode = generateMermaidCode(tables, relations);
  return { tables, relations, mermaidCode };
}

/**
 * Compiles ERD tables and relations into Mermaid.js `erDiagram` syntax.
 */
export function generateMermaidCode(tables: ERDTable[], relations: ERDRelation[]): string {
  const lines: string[] = ['erDiagram'];

  // 1. Table Definitions
  for (const table of tables) {
    const safeTableName = sanitizeMermaidIdentifier(table.name);
    lines.push(`  ${safeTableName} {`);
    for (const col of table.columns) {
      const safeColName = sanitizeMermaidIdentifier(col.name);
      const safeType = sanitizeMermaidType(col.type);
      let flag = '';
      if (col.isPrimary) flag = ' PK';
      else if (col.isForeign) flag = ' FK';
      lines.push(`    ${safeType} ${safeColName}${flag}`);
    }
    lines.push(`  }`);
  }

  // 2. Relationship lines
  const dedupeRelations = new Set<string>();
  for (const rel of relations) {
    const parent = sanitizeMermaidIdentifier(rel.parentTable);
    const child = sanitizeMermaidIdentifier(rel.childTable);
    const key = `${parent}->${child}:${rel.childColumn}`;
    if (dedupeRelations.has(key)) continue;
    dedupeRelations.add(key);

    const label = rel.label ? sanitizeMermaidIdentifier(rel.label) : 'has';
    // Mermaid syntax: parent ||--o{ child : "label"
    lines.push(`  ${parent} ||--o{ ${child} : "${label}"`);
  }

  return lines.join('\n');
}

