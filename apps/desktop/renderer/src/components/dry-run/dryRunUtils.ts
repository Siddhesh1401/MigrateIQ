import type { CollectionMapping } from '@migrateiq/shared';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getTypeAwareFallback(targetType?: string): string {
  const t = (targetType || 'TEXT').toUpperCase();
  if (t.includes('INT') || t === 'BIGINT' || t === 'SMALLINT') return '0';
  if (t.includes('NUMERIC') || t.includes('DECIMAL') || t.includes('DOUBLE') || t.includes('REAL')) return '0.00';
  if (t.includes('BOOL')) return 'false';
  if (t.includes('TIMESTAMP') || t.includes('DATE') || t.includes('TIME')) return 'CURRENT_TIMESTAMP';
  if (t.includes('UUID')) return '00000000-0000-0000-0000-000000000000';
  if (t.includes('JSON')) return '{}';
  return 'Unknown';
}

export function generateDdlForMapping(col: CollectionMapping): string {
  const ddlColumns = col.fields
    .filter((f) => f.include)
    .map((f) => {
      let colDef = `  "${f.targetColumn}" ${f.targetType}`;
      if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '') {
        let trimmed = String(f.defaultValue).trim();
        if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
          trimmed = trimmed.slice(1, -1).trim();
        }
        const upper = trimmed.toUpperCase();
        if (
          upper === 'CURRENT_TIMESTAMP' ||
          upper === 'CURRENT_DATE' ||
          upper === 'CURRENT_TIME' ||
          upper === 'NOW()' ||
          upper === 'TRUE' ||
          upper === 'FALSE' ||
          upper === 'NULL' ||
          /^-?\d+(\.\d+)?$/.test(trimmed) ||
          /^[a-z_][a-z0-9_]*\(\s*\)$/i.test(trimmed)
        ) {
          colDef += ` DEFAULT ${trimmed}`;
        } else {
          colDef += ` DEFAULT '${trimmed.replace(/'/g, "''")}'`;
        }
      }
      if (!f.isNullable) {
        colDef += ' NOT NULL';
      }
      return colDef;
    })
    .join(',\n');

  return `CREATE TABLE IF NOT EXISTS "${col.targetTableName}" (\n${ddlColumns}\n);`;
}
