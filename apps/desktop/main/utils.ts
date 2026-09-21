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
  const sanitized = name.trim().replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 63);
  return sanitized.length > 0 ? sanitized : fallback;
}
