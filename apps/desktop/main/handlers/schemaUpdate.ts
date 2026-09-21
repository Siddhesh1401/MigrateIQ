import { ipcMain } from 'electron';
import { Client as PgClient } from 'pg';
import { MongoClient } from 'mongodb';
import ElectronStore from 'electron-store';
import { randomUUID } from 'crypto';
import type {
  ConnectionConfig,
  DatabaseType,
  IPCResponse,
  SchemaChangeParams,
  NL2DDLResponse,
  SchemaUpdateRiskItem,
  GeneratedScriptResult,
  SchemaUpdateExecutionResult,
  SchemaHistoryItem,
  SchemaIntrospectedTableInfo,
} from '@migrateiq/shared';
import { maskSensitiveFields, sanitizeIdentifier } from '../utils';
import { recordAIUsage } from './aiUsageStore';

// Will be dynamically imported when needed
let GoogleGenerativeAI: typeof import('@google/generative-ai').GoogleGenerativeAI | null = null;

const NL2DDL_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

interface SchemaStoreData {
  schemaHistory: SchemaHistoryItem[];
}

const schemaStore = new ElectronStore<SchemaStoreData>({
  name: 'migrateiq-schema-updates',
  defaults: {
    schemaHistory: [],
  },
});

// ── SQL / Script Generation ──────────────────────────────────────────────────

export function generatePostgreSqlScripts(
  params: SchemaChangeParams,
  schema = 'public'
): GeneratedScriptResult {
  const safeSchema = sanitizeIdentifier(schema, 'public');
  const safeTable = sanitizeIdentifier(params.tableName);
  const safeColumn = params.columnName ? sanitizeIdentifier(params.columnName) : '';
  const safeNewColumn = params.newColumnName ? sanitizeIdentifier(params.newColumnName) : '';
  const safeNewTable = params.newTableName ? sanitizeIdentifier(params.newTableName) : '';
  const dataType = (params.dataType || 'VARCHAR(255)').toUpperCase();

  let forward = '';
  let rollback = '';
  let summary = '';
  let riskNotice: string | undefined;

  switch (params.operation) {
    case 'addColumn': {
      const nullClause = params.isNullable === false ? ' NOT NULL' : '';
      const defaultClause =
        params.defaultValue !== undefined && params.defaultValue.trim() !== ''
          ? ` DEFAULT ${params.defaultValue.trim()}`
          : '';
      forward = `ALTER TABLE "${safeSchema}"."${safeTable}" ADD COLUMN "${safeColumn}" ${dataType}${nullClause}${defaultClause};`;
      rollback = `ALTER TABLE "${safeSchema}"."${safeTable}" DROP COLUMN IF EXISTS "${safeColumn}";`;
      summary = `Add column "${safeColumn}" (${dataType}) to "${safeTable}"`;
      if (params.isNullable === false && !defaultClause) {
        riskNotice = 'Adding a NOT NULL column without a default value will fail if the table already contains rows.';
      }
      break;
    }
    case 'dropColumn': {
      forward = `ALTER TABLE "${safeSchema}"."${safeTable}" DROP COLUMN IF EXISTS "${safeColumn}";`;
      rollback = `-- Warning: Dropped column data cannot be restored from DDL.\nALTER TABLE "${safeSchema}"."${safeTable}" ADD COLUMN "${safeColumn}" ${dataType};`;
      summary = `Drop column "${safeColumn}" from "${safeTable}"`;
      riskNotice = 'Permanent data loss: all data stored in this column will be erased.';
      break;
    }
    case 'renameColumn': {
      forward = `ALTER TABLE "${safeSchema}"."${safeTable}" RENAME COLUMN "${safeColumn}" TO "${safeNewColumn}";`;
      rollback = `ALTER TABLE "${safeSchema}"."${safeTable}" RENAME COLUMN "${safeNewColumn}" TO "${safeColumn}";`;
      summary = `Rename column "${safeColumn}" to "${safeNewColumn}" in "${safeTable}"`;
      break;
    }
    case 'renameTable': {
      forward = `ALTER TABLE "${safeSchema}"."${safeTable}" RENAME TO "${safeNewTable}";`;
      rollback = `ALTER TABLE "${safeSchema}"."${safeNewTable}" RENAME TO "${safeTable}";`;
      summary = `Rename table "${safeTable}" to "${safeNewTable}"`;
      break;
    }
    case 'changeType': {
      forward = `ALTER TABLE "${safeSchema}"."${safeTable}" ALTER COLUMN "${safeColumn}" TYPE ${dataType} USING "${safeColumn}"::${dataType};`;
      rollback = `ALTER TABLE "${safeSchema}"."${safeTable}" ALTER COLUMN "${safeColumn}" TYPE TEXT USING "${safeColumn}"::TEXT;`;
      summary = `Change type of "${safeColumn}" in "${safeTable}" to ${dataType}`;
      riskNotice = 'Table rewrite and exclusive lock required. Any value incompatible with conversion will cause failure.';
      break;
    }
    case 'addIndex': {
      const idxName = sanitizeIdentifier(
        params.indexName || `idx_${safeTable}_${safeColumn}`
      );
      const unique = params.isUnique ? 'UNIQUE ' : '';
      forward = `CREATE ${unique}INDEX "${idxName}" ON "${safeSchema}"."${safeTable}" ("${safeColumn}");`;
      rollback = `DROP INDEX IF EXISTS "${safeSchema}"."${idxName}";`;
      summary = `Create ${unique}index "${idxName}" on "${safeTable}"("${safeColumn}")`;
      break;
    }
    case 'dropIndex': {
      const idxName = sanitizeIdentifier(params.indexName || `idx_${safeTable}_${safeColumn}`);
      forward = `DROP INDEX IF EXISTS "${safeSchema}"."${idxName}";`;
      rollback = `CREATE INDEX "${idxName}" ON "${safeSchema}"."${safeTable}" ("${safeColumn || 'id'}");`;
      summary = `Drop index "${idxName}" from "${safeTable}"`;
      riskNotice = 'Queries relying on this index may degrade to sequential table scans.';
      break;
    }
    case 'addForeignKey': {
      const safeForeignTable = sanitizeIdentifier(params.foreignTable || '');
      const safeForeignCol = sanitizeIdentifier(params.foreignColumn || 'id');
      const fkName = sanitizeIdentifier(
        `fk_${safeTable}_${safeColumn}_${safeForeignTable}`
      );
      const onDelete = params.onDelete || 'NO ACTION';
      forward = `ALTER TABLE "${safeSchema}"."${safeTable}" ADD CONSTRAINT "${fkName}" FOREIGN KEY ("${safeColumn}") REFERENCES "${safeSchema}"."${safeForeignTable}" ("${safeForeignCol}") ON DELETE ${onDelete};`;
      rollback = `ALTER TABLE "${safeSchema}"."${safeTable}" DROP CONSTRAINT IF EXISTS "${fkName}";`;
      summary = `Add foreign key from "${safeTable}"."${safeColumn}" to "${safeForeignTable}"."${safeForeignCol}"`;
      riskNotice = 'PostgreSQL will scan the entire table to validate existing rows. Any orphaned records will cause an abort.';
      break;
    }
    default:
      forward = `-- Unsupported operation`;
      rollback = `-- Unsupported rollback`;
      summary = `Unknown operation`;
  }

  // Wrap in safe transactional block with lock timeout
  const wrappedForward = `-- MigrateIQ Safe Schema Evolution Script
-- Database: PostgreSQL | Schema: ${safeSchema}
SET lock_timeout = '5s';
BEGIN;

${forward}

COMMIT;`;

  const wrappedRollback = `-- MigrateIQ Automatic Rollback Script
-- Database: PostgreSQL | Schema: ${safeSchema}
SET lock_timeout = '5s';
BEGIN;

${rollback}

COMMIT;`;

  return {
    forwardScript: wrappedForward,
    rollbackScript: wrappedRollback,
    operationSummary: summary,
    riskNotice,
  };
}

export function generateMongoDbScripts(params: SchemaChangeParams): GeneratedScriptResult {
  const safeTable = sanitizeIdentifier(params.tableName);
  const safeColumn = params.columnName ? sanitizeIdentifier(params.columnName) : '';
  const safeNewColumn = params.newColumnName ? sanitizeIdentifier(params.newColumnName) : '';
  const safeNewTable = params.newTableName ? sanitizeIdentifier(params.newTableName) : '';

  let forward = '';
  let rollback = '';
  let summary = '';
  let riskNotice: string | undefined;

  switch (params.operation) {
    case 'addColumn': {
      const rawVal = params.defaultValue !== undefined && params.defaultValue !== '' ? params.defaultValue : 'null';
      forward = `db.${safeTable}.updateMany({ "${safeColumn}": { $exists: false } }, { $set: { "${safeColumn}": ${rawVal} } });`;
      rollback = `db.${safeTable}.updateMany({}, { $unset: { "${safeColumn}": "" } });`;
      summary = `Add field "${safeColumn}" to collection "${safeTable}"`;
      break;
    }
    case 'dropColumn': {
      forward = `db.${safeTable}.updateMany({}, { $unset: { "${safeColumn}": "" } });`;
      rollback = `db.${safeTable}.updateMany({ "${safeColumn}": { $exists: false } }, { $set: { "${safeColumn}": null } });`;
      summary = `Drop field "${safeColumn}" from collection "${safeTable}"`;
      riskNotice = 'Unsetting this field deletes data from all matching documents.';
      break;
    }
    case 'renameColumn': {
      forward = `db.${safeTable}.updateMany({}, { $rename: { "${safeColumn}": "${safeNewColumn}" } });`;
      rollback = `db.${safeTable}.updateMany({}, { $rename: { "${safeNewColumn}": "${safeColumn}" } });`;
      summary = `Rename field "${safeColumn}" to "${safeNewColumn}" in "${safeTable}"`;
      break;
    }
    case 'renameTable': {
      forward = `db.${safeTable}.renameCollection("${safeNewTable}");`;
      rollback = `db.${safeNewTable}.renameCollection("${safeTable}");`;
      summary = `Rename collection "${safeTable}" to "${safeNewTable}"`;
      break;
    }
    case 'addIndex': {
      const idxName = sanitizeIdentifier(
        params.indexName || `idx_${safeTable}_${safeColumn}`
      );
      const opts: Record<string, unknown> = { name: idxName };
      if (params.isUnique) opts.unique = true;
      if (params.sparse) opts.sparse = true;
      forward = `db.${safeTable}.createIndex({ "${safeColumn}": 1 }, ${JSON.stringify(opts)});`;
      rollback = `db.${safeTable}.dropIndex("${idxName}");`;
      summary = `Create index "${idxName}" on collection "${safeTable}"`;
      break;
    }
    case 'dropIndex': {
      const idxName = sanitizeIdentifier(params.indexName || `idx_${safeTable}_${safeColumn}`);
      forward = `db.${safeTable}.dropIndex("${idxName}");`;
      rollback = `db.${safeTable}.createIndex({ "${safeColumn || '_id'}": 1 }, { name: "${idxName}" });`;
      summary = `Drop index "${idxName}" from collection "${safeTable}"`;
      break;
    }
    default:
      forward = `// MongoDB operation`;
      rollback = `// MongoDB rollback`;
      summary = `MongoDB operation`;
  }

  return {
    forwardScript: forward,
    rollbackScript: rollback,
    operationSummary: summary,
    riskNotice,
  };
}

// ── Risk Evaluation Engine ───────────────────────────────────────────────────

export function analyzeSchemaUpdateRisks(
  params: SchemaChangeParams,
  tableInfo?: SchemaIntrospectedTableInfo
): SchemaUpdateRiskItem[] {
  const risks: SchemaUpdateRiskItem[] = [];
  const rowCount = tableInfo?.rowCount ?? 0;
  const tableName = params.tableName;
  const colName = params.columnName || 'column';

  // Rule 1: NOT NULL constraint without default on populated table
  if (
    params.operation === 'addColumn' &&
    params.isNullable === false &&
    (!params.defaultValue || params.defaultValue.trim() === '')
  ) {
    if (rowCount > 0) {
      risks.push({
        id: 'risk_not_null_no_default_populated',
        severity: 'critical',
        title: 'NOT NULL Constraint Violation Risk',
        description: `Table "${tableName}" contains ${rowCount.toLocaleString()} existing row(s). Adding a NOT NULL column without a default value will fail immediately (PostgreSQL Error 23502) because existing rows would receive NULL values.`,
        autoFixAvailable: true,
        autoFixAction: {
          type: 'make_nullable',
          description: 'Make column nullable (allow NULL for existing rows)',
        },
      });
    } else {
      risks.push({
        id: 'risk_not_null_no_default_empty',
        severity: 'warning',
        title: 'NOT NULL Constraint without Default',
        description: `Adding a NOT NULL column without a default value will require every future INSERT to explicitly supply a value for "${colName}".`,
      });
    }
  }

  // Rule 2: Dropping column (Irreversible data loss)
  if (params.operation === 'dropColumn') {
    risks.push({
      id: 'risk_drop_column_loss',
      severity: 'critical',
      title: 'Irreversible Data Loss Risk',
      description: `Dropping column "${colName}" will permanently destroy all data stored in this column across all ${rowCount.toLocaleString()} rows. This operation is IRREVERSIBLE once committed.`,
    });
  }

  // Rule 3: Changing column type
  if (params.operation === 'changeType') {
    risks.push({
      id: 'risk_change_type_lock',
      severity: 'warning',
      title: 'Table Rewrite & Type Conversion Lock',
      description: `Changing the type of "${colName}" to ${params.dataType} requires an ACCESS EXCLUSIVE lock on "${tableName}". If any existing value cannot be safely cast, the entire transaction will abort.`,
    });
  }

  // Rule 4: Dropping index
  if (params.operation === 'dropIndex') {
    risks.push({
      id: 'risk_drop_index_perf',
      severity: 'warning',
      title: 'Query Performance Degradation',
      description: `Dropping index "${params.indexName || colName}" may cause existing queries filtering on this column to perform sequential table scans.`,
    });
  }

  // Rule 5: Adding Foreign Key
  if (params.operation === 'addForeignKey') {
    risks.push({
      id: 'risk_add_fk_validation',
      severity: 'warning',
      title: 'Foreign Key Referential Validation Scan',
      description: `PostgreSQL will scan the entire "${tableName}" table to verify that every value in "${colName}" exists in "${params.foreignTable}"("${params.foreignColumn}"). Any orphaned rows will cause the operation to fail.`,
    });
  }

  // If no high or medium risks, add green info badge
  if (risks.length === 0) {
    risks.push({
      id: 'risk_safe_operation',
      severity: 'info',
      title: 'Safe Schema Evolution',
      description: `This operation is non-destructive and backward compatible with existing queries.`,
    });
  }

  return risks;
}

// ── Offline Regex Fallback Parser for Natural Language ───────────────────────

export function parseNaturalLanguageOffline(
  text: string,
  _dbType: DatabaseType = 'postgresql'
): NL2DDLResponse | null {
  const t = text.trim();

  // Pattern 1: Add column to <table> named/called <col>
  const addNamedMatch =
    t.match(/add\s+(?:a\s+)?column\s+(?:to|in)\s+([a-zA-Z0-9_]+)\s+(?:named|called)\s+([a-zA-Z0-9_]+)(?:\s+(?:as\s+|type\s+)?([a-zA-Z0-9_()]+))?/i) ||
    t.match(/add\s+(?:a\s+)?column\s+(?:named|called)\s+([a-zA-Z0-9_]+)\s+(?:to|in)\s+([a-zA-Z0-9_]+)(?:\s+(?:as\s+|type\s+)?([a-zA-Z0-9_()]+))?/i);
  if (addNamedMatch) {
    const isNamedFirst = /named|called/i.test(t.split(/to|in/i)[0]);
    const tbl = isNamedFirst ? addNamedMatch[2] : addNamedMatch[1];
    const col = isNamedFirst ? addNamedMatch[1] : addNamedMatch[2];
    const isNullable = !/not\s+null/i.test(t);
    const defaultMatch = t.match(/default\s+([^,;]+)/i);
    return {
      operation: 'addColumn',
      tableName: tbl,
      columnName: col,
      dataType: (addNamedMatch[3] || 'VARCHAR(255)').toUpperCase(),
      isNullable,
      defaultValue: defaultMatch ? defaultMatch[1].trim() : undefined,
      confidence: 0.95,
      explanation: `Offline regex identified adding column "${col}" to table "${tbl}"`,
      rawInput: text,
      isFallback: true,
    };
  }

  // Pattern 2: Add column <col> (<type>) to <table>
  const addMatch =
    t.match(/add\s+(?:a\s+)?(?:column\s+)?(?!column\b)([a-zA-Z0-9_]+)\s+(?:as\s+|type\s+)?([a-zA-Z0-9_()]+)?\s*(?:to|in)\s+([a-zA-Z0-9_]+)/i) ||
    t.match(/add\s+([a-zA-Z0-9_]+)\s+(varchar\b.*|text|int|integer|boolean|timestamp|jsonb|uuid|numeric)\s+(?:to|in)\s+([a-zA-Z0-9_]+)/i);
  if (addMatch) {
    const isNullable = !/not\s+null/i.test(t);
    const defaultMatch = t.match(/default\s+([^,;]+)/i);
    return {
      operation: 'addColumn',
      tableName: addMatch[3],
      columnName: addMatch[1],
      dataType: (addMatch[2] || 'VARCHAR(255)').toUpperCase(),
      isNullable,
      defaultValue: defaultMatch ? defaultMatch[1].trim() : undefined,
      confidence: 0.9,
      explanation: `Offline regex identified adding column "${addMatch[1]}" to table "${addMatch[3]}"`,
      rawInput: text,
      isFallback: true,
    };
  }

  // Pattern: Drop column <col> from <table>
  const dropColMatch = t.match(/(?:drop|remove|delete)\s+(?:column\s+)?([a-zA-Z0-9_]+)\s+from\s+([a-zA-Z0-9_]+)/i);
  if (dropColMatch) {
    return {
      operation: 'dropColumn',
      tableName: dropColMatch[2],
      columnName: dropColMatch[1],
      confidence: 0.95,
      explanation: `Offline regex identified dropping column "${dropColMatch[1]}" from "${dropColMatch[2]}"`,
      rawInput: text,
      isFallback: true,
    };
  }

  // Pattern: Rename column <old> to <new> in <table>
  const renameColMatch = t.match(/rename\s+(?:column\s+)?([a-zA-Z0-9_]+)\s+to\s+([a-zA-Z0-9_]+)\s+in\s+([a-zA-Z0-9_]+)/i);
  if (renameColMatch) {
    return {
      operation: 'renameColumn',
      tableName: renameColMatch[3],
      columnName: renameColMatch[1],
      newColumnName: renameColMatch[2],
      confidence: 0.95,
      explanation: `Offline regex identified renaming column "${renameColMatch[1]}" to "${renameColMatch[2]}" in "${renameColMatch[3]}"`,
      rawInput: text,
      isFallback: true,
    };
  }

  // Pattern: Rename table <old> to <new>
  const renameTableMatch = t.match(/rename\s+(?:table|collection)\s+([a-zA-Z0-9_]+)\s+to\s+([a-zA-Z0-9_]+)/i);
  if (renameTableMatch) {
    return {
      operation: 'renameTable',
      tableName: renameTableMatch[1],
      newTableName: renameTableMatch[2],
      confidence: 0.95,
      explanation: `Offline regex identified renaming table "${renameTableMatch[1]}" to "${renameTableMatch[2]}"`,
      rawInput: text,
      isFallback: true,
    };
  }

  // Pattern: Change type of <col> in <table> to <type>
  const changeTypeMatch = t.match(/change\s+(?:type\s+of\s+)?([a-zA-Z0-9_]+)\s+in\s+([a-zA-Z0-9_]+)\s+to\s+([a-zA-Z0-9_()]+)/i);
  if (changeTypeMatch) {
    return {
      operation: 'changeType',
      tableName: changeTypeMatch[2],
      columnName: changeTypeMatch[1],
      dataType: changeTypeMatch[3].toUpperCase(),
      confidence: 0.9,
      explanation: `Offline regex identified changing type of "${changeTypeMatch[1]}" to ${changeTypeMatch[3]} in "${changeTypeMatch[2]}"`,
      rawInput: text,
      isFallback: true,
    };
  }

  // Pattern: Add index on <table> (<col>) / Create index on <table>(<col>)
  const addIndexMatch = t.match(/(?:add|create)\s+(?:(unique)\s+)?index\s+(?:on\s+)?([a-zA-Z0-9_]+)\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
  if (addIndexMatch) {
    return {
      operation: 'addIndex',
      tableName: addIndexMatch[2],
      columnName: addIndexMatch[3],
      isUnique: Boolean(addIndexMatch[1]),
      confidence: 0.92,
      explanation: `Offline regex identified creating ${addIndexMatch[1] ? 'unique ' : ''}index on "${addIndexMatch[2]}"("${addIndexMatch[3]}")`,
      rawInput: text,
      isFallback: true,
    };
  }

  return null;
}

// ── Gemini NL2DDL Interpretation ─────────────────────────────────────────────

async function interpretNL2DDLWithGemini(
  prompt: string,
  dbType: DatabaseType,
  apiKey: string,
  existingTables?: string[]
): Promise<NL2DDLResponse> {
  const startTime = Date.now();

  // Lazy load SDK
  if (!GoogleGenerativeAI) {
    const { GoogleGenerativeAI: SDK } = await import('@google/generative-ai');
    GoogleGenerativeAI = SDK;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const systemInstruction = `You are MigrateIQ's expert Database DDL AI assistant.
Your job is to translate a user's natural language request into a structured database schema update specification.
Database target: ${dbType === 'mongodb' ? 'MongoDB' : 'PostgreSQL'}.
Available tables/collections in target database: ${existingTables && existingTables.length > 0 ? existingTables.join(', ') : 'unknown'}.

You must return ONLY a strictly valid JSON object matching this schema:
{
  "operation": "addColumn" | "dropColumn" | "renameColumn" | "renameTable" | "changeType" | "addIndex" | "dropIndex" | "addForeignKey",
  "tableName": "string (name of the table/collection)",
  "columnName": "string (name of the column/field to add, drop, rename, or index)",
  "newColumnName": "string (required only if operation is renameColumn)",
  "newTableName": "string (required only if operation is renameTable)",
  "dataType": "string (e.g. VARCHAR(255), INTEGER, BOOLEAN, TEXT, TIMESTAMP, JSONB - use SQL types for PostgreSQL)",
  "isNullable": boolean (true if nullable, false if NOT NULL, default true),
  "defaultValue": "string or undefined (e.g. '0', 'true', 'CURRENT_TIMESTAMP', 'active')",
  "indexName": "string (name of index, e.g. idx_users_email)",
  "isUnique": boolean (true if unique constraint or unique index),
  "foreignTable": "string (target table if operation is addForeignKey)",
  "foreignColumn": "string (target column if operation is addForeignKey, default 'id')",
  "confidence": number between 0.0 and 1.0,
  "explanation": "string briefly explaining the interpreted operation in clear English"
}`;

  let lastError: Error | null = null;

  for (const modelName of NL2DDL_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const fullPrompt = `${systemInstruction}\n\nUser natural language input: "${prompt}"`;
      const response = await model.generateContent(fullPrompt);
      const rawText = response.response.text();
      const parsed = JSON.parse(rawText) as NL2DDLResponse;

      recordAIUsage({
        timestamp: new Date().toISOString(),
        feature: 'Copilot Tweak',
        model: modelName,
        promptSnippet: `NL2DDL: ${prompt.slice(0, 80)}`,
        promptTokens: Math.ceil(fullPrompt.length / 4),
        responseTokens: Math.ceil(rawText.length / 4),
        totalTokens: Math.ceil((fullPrompt.length + rawText.length) / 4),
        status: 'success',
        durationMs: Date.now() - startTime,
      });

      return {
        ...parsed,
        rawInput: prompt,
        isFallback: false,
      };
    } catch (err) {
      console.warn(`[NL2DDL] Model ${modelName} failed:`, (err as Error).message);
      lastError = err as Error;
    }
  }

  throw lastError || new Error('All AI models failed to interpret prompt');
}

// ── Main IPC Setup ───────────────────────────────────────────────────────────

export function setupSchemaUpdateHandlers(): void {
  // 1. Natural Language to DDL Interpreter
  ipcMain.handle(
    'schema:interpret-nl2ddl',
    async (
      _event,
      payload: {
        prompt: string;
        databaseType: DatabaseType;
        apiKey?: string;
        existingTables?: string[];
      }
    ): Promise<IPCResponse<NL2DDLResponse>> => {
      try {
        const { prompt, databaseType, apiKey, existingTables } = payload;
        if (!prompt || !prompt.trim()) {
          return { success: false, error: 'Prompt cannot be empty.' };
        }

        // Check if API key is available
        const key = apiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (key && key.trim()) {
          try {
            const aiResult = await interpretNL2DDLWithGemini(
              prompt,
              databaseType,
              key.trim(),
              existingTables
            );
            return { success: true, data: aiResult };
          } catch (aiErr) {
            console.warn('[NL2DDL] AI parsing failed, attempting offline regex parser:', aiErr);
          }
        }

        // Offline Regex fallback
        const offlineResult = parseNaturalLanguageOffline(prompt, databaseType);
        if (offlineResult) {
          recordAIUsage({
            timestamp: new Date().toISOString(),
            feature: 'Copilot Tweak',
            model: 'Offline Regex Parser',
            promptSnippet: `Offline NL2DDL: ${prompt.slice(0, 80)}`,
            promptTokens: 0,
            responseTokens: 0,
            totalTokens: 0,
            status: 'fallback',
            durationMs: 5,
          });
          return { success: true, data: offlineResult };
        }

        return {
          success: false,
          error:
            'Could not interpret database operation from your text. Please provide an active Gemini API key in Settings, or rephrase with a clearer pattern like "Add column status VARCHAR(50) to orders".',
        };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to interpret prompt',
        };
      }
    }
  );

  // 2. Script Generation
  ipcMain.handle(
    'schema:generate-scripts',
    async (
      _event,
      payload: { params: SchemaChangeParams; schema?: string }
    ): Promise<IPCResponse<GeneratedScriptResult>> => {
      try {
        const { params, schema = 'public' } = payload;
        if (!params || !params.tableName) {
          return { success: false, error: 'Table name is required.' };
        }

        const result =
          params.databaseType === 'mongodb'
            ? generateMongoDbScripts(params)
            : generatePostgreSqlScripts(params, schema);

        return { success: true, data: result };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to generate schema update scripts',
        };
      }
    }
  );

  // 3. Risk Analysis
  ipcMain.handle(
    'schema:analyze-risks',
    async (
      _event,
      payload: {
        params: SchemaChangeParams;
        tableInfo?: SchemaIntrospectedTableInfo;
      }
    ): Promise<IPCResponse<SchemaUpdateRiskItem[]>> => {
      try {
        const risks = analyzeSchemaUpdateRisks(payload.params, payload.tableInfo);
        return { success: true, data: risks };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to analyze schema update risks',
        };
      }
    }
  );

  // 4. Live Execution of Schema Update
  ipcMain.handle(
    'schema:apply-update',
    async (
      _event,
      payload: {
        config: ConnectionConfig;
        forwardScript: string;
        rollbackScript: string;
        params: SchemaChangeParams;
      }
    ): Promise<IPCResponse<SchemaUpdateExecutionResult>> => {
      const startTime = Date.now();
      const { config, forwardScript, rollbackScript, params } = payload;

      if (!config) {
        return { success: false, error: 'Database connection configuration is missing.' };
      }

      if (params.databaseType === 'postgresql') {
        let pgClient: PgClient | null = null;
        try {
          const pgConfig = config.connectionString
            ? {
                connectionString: config.connectionString,
                ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
                statement_timeout: 10000,
              }
            : {
                host: config.host || 'localhost',
                port: config.port || 5432,
                database: config.database,
                user: config.user,
                password: config.password,
                ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
                statement_timeout: 10000,
              };

          pgClient = new PgClient(pgConfig);
          await pgClient.connect();

          // Execute script inside PostgreSQL
          await pgClient.query(forwardScript);
          const duration = Date.now() - startTime;

          // Record history
          const historyItem: SchemaHistoryItem = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            databaseType: 'postgresql',
            databaseName: config.database,
            operation: params.operation,
            tableName: params.tableName,
            forwardScript,
            rollbackScript,
            status: 'applied',
            durationMs: duration,
          };
          const history = schemaStore.get('schemaHistory', []);
          schemaStore.set('schemaHistory', [historyItem, ...history.slice(0, 99)]);

          return {
            success: true,
            data: {
              success: true,
              executionTimeMs: duration,
              message: `Schema update applied successfully in ${duration}ms!`,
              sqlExecuted: forwardScript,
            },
          };
        } catch (err: unknown) {
          const errorObj = err as Record<string, unknown>;
          const code = (errorObj.code as string) || '';
          const rawMessage = (errorObj.message as string) || 'Database query error';
          let userFriendlyMessage = maskSensitiveFields(rawMessage);
          let suggestion = 'Check your table names and column definitions.';

          if (code === '42701') {
            userFriendlyMessage = `Column "${params.columnName}" already exists on table "${params.tableName}".`;
            suggestion = 'Choose a different column name, or use rename/change type instead.';
          } else if (code === '23502') {
            userFriendlyMessage = `Cannot add NOT NULL constraint: existing rows in "${params.tableName}" contain NULL values.`;
            suggestion = 'Make the column nullable, or supply a default value for existing rows.';
          } else if (code === '55P03') {
            userFriendlyMessage = `Lock acquisition timed out after 5 seconds: another process or query holds an active lock on "${params.tableName}".`;
            suggestion = 'Retry during low traffic or after long-running queries have finished.';
          } else if (code === '42P01') {
            userFriendlyMessage = `Relation "${params.tableName}" does not exist in schema.`;
            suggestion = 'Verify the table name and target schema.';
          } else if (code === '42703') {
            userFriendlyMessage = `Column "${params.columnName}" does not exist in "${params.tableName}".`;
            suggestion = 'Verify the column name against the table structure.';
          }

          // Record failed history
          const historyItem: SchemaHistoryItem = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            databaseType: 'postgresql',
            databaseName: config.database,
            operation: params.operation,
            tableName: params.tableName,
            forwardScript,
            rollbackScript,
            status: 'failed',
            durationMs: Date.now() - startTime,
            errorMessage: userFriendlyMessage,
          };
          const history = schemaStore.get('schemaHistory', []);
          schemaStore.set('schemaHistory', [historyItem, ...history.slice(0, 99)]);

          return {
            success: false,
            data: {
              success: false,
              executionTimeMs: Date.now() - startTime,
              message: userFriendlyMessage,
              errorCode: code,
              error: userFriendlyMessage,
              suggestion,
              sqlExecuted: forwardScript,
            },
            error: userFriendlyMessage,
          };
        } finally {
          if (pgClient) {
            await pgClient.end().catch(() => {});
          }
        }
      } else {
        // MongoDB execution
        let mongoClient: MongoClient | null = null;
        try {
          const uri =
            config.connectionString ||
            `mongodb://${config.user ? `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password || '')}@` : ''}${config.host || 'localhost'}:${config.port || 27017}`;

          mongoClient = new MongoClient(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
          });
          await mongoClient.connect();
          const db = config.database ? mongoClient.db(config.database) : mongoClient.db();

          // Execute corresponding native MongoDB command
          const collection = db.collection(params.tableName);
          if (params.operation === 'addColumn' && params.columnName) {
            const defVal = params.defaultValue !== undefined && params.defaultValue !== '' ? JSON.parse(params.defaultValue) : null;
            await collection.updateMany(
              { [params.columnName]: { $exists: false } },
              { $set: { [params.columnName]: defVal } }
            );
          } else if (params.operation === 'dropColumn' && params.columnName) {
            await collection.updateMany({}, { $unset: { [params.columnName]: '' } });
          } else if (params.operation === 'renameColumn' && params.columnName && params.newColumnName) {
            await collection.updateMany({}, { $rename: { [params.columnName]: params.newColumnName } });
          } else if (params.operation === 'renameTable' && params.newTableName) {
            await collection.rename(params.newTableName);
          } else if (params.operation === 'addIndex' && params.columnName) {
            const idxOpts: Record<string, unknown> = {};
            if (params.indexName) idxOpts.name = params.indexName;
            if (params.isUnique) idxOpts.unique = true;
            if (params.sparse) idxOpts.sparse = true;
            await collection.createIndex({ [params.columnName]: 1 }, idxOpts);
          } else if (params.operation === 'dropIndex' && params.indexName) {
            await collection.dropIndex(params.indexName);
          }

          const duration = Date.now() - startTime;

          // Record history
          const historyItem: SchemaHistoryItem = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            databaseType: 'mongodb',
            databaseName: config.database,
            operation: params.operation,
            tableName: params.tableName,
            forwardScript,
            rollbackScript,
            status: 'applied',
            durationMs: duration,
          };
          const history = schemaStore.get('schemaHistory', []);
          schemaStore.set('schemaHistory', [historyItem, ...history.slice(0, 99)]);

          return {
            success: true,
            data: {
              success: true,
              executionTimeMs: duration,
              message: `MongoDB collection update executed successfully in ${duration}ms!`,
              sqlExecuted: forwardScript,
            },
          };
        } catch (err: unknown) {
          const msg = maskSensitiveFields((err as Error).message || 'MongoDB update failed');
          return {
            success: false,
            data: {
              success: false,
              executionTimeMs: Date.now() - startTime,
              message: msg,
              error: msg,
              sqlExecuted: forwardScript,
            },
            error: msg,
          };
        } finally {
          if (mongoClient) {
            await mongoClient.close().catch(() => {});
          }
        }
      }
    }
  );

  // 5. Schema History Read
  ipcMain.handle(
    'schema:get-history',
    async (_event): Promise<IPCResponse<SchemaHistoryItem[]>> => {
      try {
        const history = schemaStore.get('schemaHistory', []);
        return { success: true, data: history };
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to retrieve schema update history',
        };
      }
    }
  );
}
