import type { ConnectionConfig } from '@migrateiq/shared';

/**
 * Shared utility functions for Electron main process
 */

/**
 * Replaces credentials and passwords in connection strings, error messages, and logs with bullet masks.
 */
export function maskSensitiveFields(text: string): string {
  if (!text) return text;
  return text
    .replace(/(:\/\/[^:]+:)([^@]+)(@)/g, '$1••••••••$3')
    .replace(/(password['":\s]+)([^"',\s]+)/gi, '$1••••••••');
}

/**
 * Sanitizes an SQL identifier (e.g., schema name, table name, or column name).
 * Replaces non-alphanumeric/underscore characters with '_', enforces a 63-character limit (PostgreSQL max),
 * and falls back to a safe default if blank.
 */
export function sanitizeIdentifier(name: string | undefined | null, fallback = 'public'): string {
  if (!name || typeof name !== 'string') return fallback;
  const sanitized = name.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0, 63);
  return sanitized.length > 0 ? sanitized : fallback;
}

/**
 * Injects or updates the target database name inside a connection string URI.
 * Guarantees that PostgreSQL and MongoDB drivers always connect to the intended database.
 */
export function updateDatabaseInConnectionString(uri: string, newDb: string): string {
  if (!uri || !newDb || typeof uri !== 'string') return uri;
  try {
    const isMongoSrv = uri.startsWith('mongodb+srv://');
    const isMongo = uri.startsWith('mongodb://');
    
    let prefix = '';
    if (isMongoSrv) { prefix = 'mongodb+srv://'; }
    else if (isMongo) { prefix = 'mongodb://'; }
    else if (uri.startsWith('postgresql://')) { prefix = 'postgresql://'; }
    else if (uri.startsWith('postgres://')) { prefix = 'postgres://'; }
    else return uri;

    const dummyUrl = uri.replace(/^[a-z0-9+]+:\/\//i, 'http://');
    const parsed = new URL(dummyUrl);
    parsed.pathname = '/' + encodeURIComponent(newDb.trim());
    
    return parsed.toString().replace(/^http:\/\//, prefix);
  } catch {
    return uri;
  }
}

/**
 * Normalizes a connection config ensuring connectionString and database are synchronized.
 */
export function normalizeConnectionConfig(config: ConnectionConfig): ConnectionConfig {
  if (!config) return config;
  const db = (config.database || '').trim();
  if (config.connectionString && db) {
    const updatedUri = updateDatabaseInConnectionString(config.connectionString, db);
    return {
      ...config,
      database: db,
      connectionString: updatedUri,
    };
  }
  return {
    ...config,
    database: db,
  };
}
