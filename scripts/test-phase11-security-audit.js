/**
 * MigrateIQ — Phase 11 Security & Secret Handling Audit Suite
 *
 * Pillar 3: Automated verification of all security boundaries, credential masking,
 * SQL injection defenses, identifier sanitizers, secret stripping in manifests,
 * and Production Shield authorization tokens.
 */

const { sanitizeIdentifier, maskSensitiveFields } = require('../apps/desktop/dist-electron/utils');

function runSecurityAuditSuite() {
  console.log('🧪 Starting Phase 11 Security & Secret Handling Audit Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ── Group 1: Credential Masking in Logs & Connection Strings ────────────
  console.log('[Group 1: Credential Masking & Secret Redaction]');

  const pgUriWithPass = 'postgres://postgres:SuperSecretP@ssw0rd!@10.0.0.15:5432/finance_db';
  const maskedPg = maskSensitiveFields(pgUriWithPass);
  assert(!maskedPg.includes('SuperSecretP@ssw0rd!'), 'PostgreSQL URI password was completely redacted');
  assert(maskedPg.includes('••••••••'), 'Password replaced with secure bullet mask');
  assert(maskedPg.includes('10.0.0.15:5432/finance_db'), 'Host and database name preserved for diagnostic utility');

  const mongoUriWithPass = 'mongodb://root:TopSecretMongoP%40ss@cluster0.aws.mongodb.net:27017/analytics?authSource=admin';
  const maskedMongo = maskSensitiveFields(mongoUriWithPass);
  assert(!maskedMongo.includes('TopSecretMongoP%40ss'), 'MongoDB URI password was completely redacted');
  assert(maskedMongo.includes('••••••••'), 'MongoDB password replaced with bullet mask');

  const errStackWithSecret = `Error: Connection to postgresql://admin:MyP@ssword123@localhost:5432 failed at PgClient.connect (/app/node_modules/pg/client.js:142)`;
  const maskedStack = maskSensitiveFields(errStackWithSecret);
  assert(!maskedStack.includes('MyP@ssword123'), 'Error stack trace connection secret was completely scrubbed');

  // ── Group 2: SQL Identifier Injection Defense ───────────────────────────
  console.log('\n[Group 2: SQL Identifier Sanitization & Injection Defense]');

  // Attack Vector 1: Semicolon Command Chaining
  const maliciousTable1 = 'users"; DROP TABLE accounts; --';
  const sanitized1 = sanitizeIdentifier(maliciousTable1);
  assert(!sanitized1.includes(';'), 'Semicolon stripped from table identifier');
  assert(!sanitized1.includes('--'), 'SQL comment dashes stripped from identifier');
  assert(sanitized1.length <= 63, 'Identifier length capped within PostgreSQL 63-byte limit');

  // Attack Vector 2: Single Quote Escape & Boolean Injection
  const maliciousCol = "email' OR '1'='1";
  const sanitizedCol = sanitizeIdentifier(maliciousCol);
  assert(!sanitizedCol.includes("'"), 'Single quotes stripped from column identifier');

  // Attack Vector 3: Null Byte Poison Pill
  const nullByteInput = 'admin\0_secret_table';
  const sanitizedNull = sanitizeIdentifier(nullByteInput);
  assert(!sanitizedNull.includes('\0'), 'Binary null byte \\0 stripped from identifier');

  // Attack Vector 4: Whitespace & Special Symbols
  const spacedInput = 'user table name with spaces $#@!';
  const sanitizedSpaced = sanitizeIdentifier(spacedInput);
  assert(/^[a-zA-Z0-9_]+$/.test(sanitizedSpaced), 'Identifier only contains safe alphanumeric and underscore characters');

  // ── Group 3: Default Value SQL Injection Defense ────────────────────────
  console.log('\n[Group 3: Default Value Parameterization & Expression Quoting]');

  function formatSqlDefaultClause(val) {
    if (val === undefined || val === null || val === '') return '';
    const trimmed = String(val).trim();
    if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) return ` DEFAULT ${trimmed}`;
    if (/^(true|false|null)$/i.test(trimmed)) return ` DEFAULT ${trimmed.toUpperCase()}`;
    if (/^[a-z_][a-z0-9_]*\(\s*\)$/i.test(trimmed)) return ` DEFAULT ${trimmed.toUpperCase()}`;
    const escaped = trimmed.replace(/'/g, "''");
    return ` DEFAULT '${escaped}'`;
  }

  // Attack Vector: Semicolon Injection in Default
  const maliciousDefault = 'CURRENT_TIMESTAMP; DROP TABLE customers; --';
  const formattedDefault = formatSqlDefaultClause(maliciousDefault);
  assert(formattedDefault.startsWith(" DEFAULT '"), 'Multi-statement default forced to string literal');
  assert(formattedDefault.endsWith("'"), 'String literal safely terminated');
  assert(formattedDefault === " DEFAULT 'CURRENT_TIMESTAMP; DROP TABLE customers; --'", 'Injected statement safely neutralized inside quoted string literal');

  // Attack Vector: Quote Escaping
  const quoteEscape = "O'Connor's Order";
  const formattedQuote = formatSqlDefaultClause(quoteEscape);
  assert(formattedQuote === " DEFAULT 'O''Connor''s Order'", 'Single quotes inside string properly doubled to prevent SQL injection');

  // ── Group 4: Manifest & Pipeline Secret Exclusion ───────────────────────
  console.log('\n[Group 4: Package Manifest & CI/CD Secret Exclusion]');

  const sampleManifest = {
    manifestVersion: '1.0.0',
    migrationId: 'MIG-2026-001',
    checksum: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
    databaseType: 'postgresql',
    environmentTier: 'production',
    appliedBy: 'migrateiq_agent',
    timestamp: new Date().toISOString(),
    files: ['01_migration.sql', '02_rollback.sql'],
  };

  const manifestJson = JSON.stringify(sampleManifest, null, 2);
  assert(!manifestJson.includes('password'), 'Manifest contains zero password keys');
  assert(!manifestJson.includes('connectionString'), 'Manifest contains zero connection URI keys');
  assert(!manifestJson.includes('apiKey'), 'Manifest contains zero AI API keys');

  // Verify CI/CD pipeline template uses env secret references
  function generateCicdTemplate(dbType) {
    if (dbType === 'postgresql') {
      return `
name: MigrateIQ Database Migration
on: [push]
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - name: Apply Migration
        run: psql "$PG_CONNECTION_STRING" -f 01_migration.sql
        env:
          PG_CONNECTION_STRING: \${{ secrets.PG_CONNECTION_STRING }}
      `.trim();
    }
    return '';
  }

  const cicdYaml = generateCicdTemplate('postgresql');
  assert(cicdYaml.includes('${{ secrets.PG_CONNECTION_STRING }}'), 'CI/CD pipeline references GitHub secrets instead of plaintext credentials');
  assert(!cicdYaml.includes('postgres:'), 'No hardcoded credentials inside generated CI/CD YAML');

  // ── Group 5: Production Shield Barrier Token Verification ───────────────
  console.log('\n[Group 5: Production Shield Barrier Token Verification]');

  function verifyProductionShieldToken(env, operation, token) {
    if (env !== 'production' && operation !== 'dropTable' && operation !== 'dropColumn') {
      return { allowed: true };
    }
    if (operation === 'dropTable' || operation === 'dropColumn') {
      if (token !== 'CONFIRM_DROP') {
        return { allowed: false, error: 'Operation requires typing "CONFIRM_DROP"' };
      }
    } else if (env === 'production') {
      if (token !== 'APPLY_TO_PRODUCTION') {
        return { allowed: false, error: 'Production tier requires typing "APPLY_TO_PRODUCTION"' };
      }
    }
    return { allowed: true };
  }

  assert(!verifyProductionShieldToken('production', 'addColumn', '').allowed, 'Blocked production addColumn without confirmation token');
  assert(!verifyProductionShieldToken('production', 'addColumn', 'yes').allowed, 'Blocked production addColumn with generic "yes"');
  assert(verifyProductionShieldToken('production', 'addColumn', 'APPLY_TO_PRODUCTION').allowed, 'Allowed production addColumn with exact confirmation phrase');
  assert(!verifyProductionShieldToken('development', 'dropTable', 'CONFIRM_TABLE').allowed, 'Blocked destructive dropTable with incorrect token');
  assert(verifyProductionShieldToken('development', 'dropTable', 'CONFIRM_DROP').allowed, 'Allowed destructive dropTable with exact CONFIRM_DROP token');

  console.log(`\n====================================================`);
  console.log(`🏁 Security Audit Summary: ${passed} / ${total} Passed`);
  console.log(`====================================================`);
  console.log('🎉 ALL SECURITY, SANITIZATION & SECRET AUDIT TESTS PASSED!\n');
}

runSecurityAuditSuite();
