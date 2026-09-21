import { ipcMain } from 'electron';
import { MongoClient } from 'mongodb';
import { Client as PgClient } from 'pg';
import type { 
  ConnectionConfig, 
  SourceSchema, 
  FieldDefinition, 
  IPCResponse,
  PostgresIntrospectionResult 
} from '@migrateiq/shared';
import { maskSensitiveFields, sanitizeIdentifier } from '../utils';

/**
 * MongoDB Connection Handler
 * Tests connection, reads schema, and infers field types from sample documents
 */
export function setupMongoDBHandler(): void {
  ipcMain.handle('db:connect-mongodb', async (_event, config: ConnectionConfig): Promise<IPCResponse<SourceSchema[]>> => {
    let client: MongoClient | null = null;

    try {
      // Construct connection string from config
      let connectionString = config.connectionString;
      
      if (!connectionString) {
        // Build from individual fields if connectionString not provided
        const auth = config.user ? `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password || '')}@` : '';
        const host = config.host || 'localhost';
        const port = config.port || 27017;
        connectionString = `mongodb://${auth}${host}:${port}`;
      }

      client = new MongoClient(connectionString, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      // Test connection and measure latency
      const startTime = Date.now();
      await client.connect();
      const latencyMs = Date.now() - startTime;

      const db = (config.database && config.database.trim().length > 0 && config.database !== 'default')
        ? client.db(config.database.trim())
        : client.db();

      // List all collections
      const collections = await db.listCollections().toArray();

      // Read schema for each collection
      const schemas: SourceSchema[] = [];

      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;
        // Skip internal system collections
        if (collectionName.startsWith('system.')) continue;

        const collection = db.collection(collectionName);

        // Get document count
        const documentCount = await collection.countDocuments();

        // Sample 100 documents to infer field types
        const sampleDocs = await collection.find({}).limit(100).toArray();

        // Infer field types from samples
        const fieldsMap = new Map<string, FieldDefinition>();
        // Track nested field schemas for arrayOfObjects and object types
        const nestedFieldsMaps = new Map<string, Map<string, FieldDefinition>>();

        sampleDocs.forEach((doc) => {
          Object.entries(doc).forEach(([key, value]) => {
            if (key === '_id') return; // Skip _id, we'll add it explicitly

            const bsonType = getBsonType(value);
            const isArray = Array.isArray(value);
            const isNullable = value === null || value === undefined;
            const sampleVal = extractSampleValue(key, value);

            if (fieldsMap.has(key)) {
              const existing = fieldsMap.get(key)!;
              if (isNullable) existing.isNullable = true;
              if (sampleVal !== null && existing.sampleValues && existing.sampleValues.length < 3) {
                if (!existing.sampleValues.includes(sampleVal)) {
                  existing.sampleValues.push(sampleVal);
                }
              }
              if (existing.bsonType !== bsonType && !isNullable) {
                // Numeric widening: int + double conflict → widen to double, not mixed.
                // e.g. price: 28.00 (int) and price: 249.99 (double) → DOUBLE PRECISION, not JSONB.
                const numericTypes = new Set(['int', 'double']);
                if (numericTypes.has(existing.bsonType) && numericTypes.has(bsonType)) {
                  existing.bsonType = 'double';
                } else {
                  existing.bsonType = 'mixed'; // Truly incompatible types (e.g. string + object)
                }
              }
            } else {
              fieldsMap.set(key, {
                name: key,
                bsonType,
                isNullable,
                isArray,
                sampleValues: sampleVal !== null ? [sampleVal] : [],
              });
            }

            // ── Populate nestedFields for arrayOfObjects ────────────────────────
            // Inspects inner array elements across all sample docs to build a
            // merged schema of the child object's fields (used for child table creation).
            if (bsonType === 'arrayOfObjects' && Array.isArray(value)) {
              if (!nestedFieldsMaps.has(key)) nestedFieldsMaps.set(key, new Map());
              const nestedMap = nestedFieldsMaps.get(key)!;
              (value as unknown[]).forEach((element) => {
                if (!element || typeof element !== 'object' || Array.isArray(element)) return;
                Object.entries(element as Record<string, unknown>).forEach(([nk, nv]) => {
                  const nType = getBsonType(nv);
                  const nSample = extractSampleValue(nk, nv);
                  if (nestedMap.has(nk)) {
                    const nExisting = nestedMap.get(nk)!;
                    if (nv === null || nv === undefined) nExisting.isNullable = true;
                    if (nSample !== null && nExisting.sampleValues && nExisting.sampleValues.length < 3) {
                      if (!nExisting.sampleValues.includes(nSample)) {
                        nExisting.sampleValues.push(nSample);
                      }
                    }
                  } else {
                    nestedMap.set(nk, {
                      name: nk,
                      bsonType: nType,
                      isNullable: nv === null || nv === undefined,
                      isArray: Array.isArray(nv),
                      sampleValues: nSample !== null ? [nSample] : [],
                    });
                  }
                });
              });
            }

            // ── Populate nestedFields for nested objects ────────────────────────
            // Captures object property names/types so the ETL engine can choose
            // between flattening (address.city → address_city) or keeping as JSONB.
            if (bsonType === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
              if (!nestedFieldsMaps.has(key)) nestedFieldsMaps.set(key, new Map());
              const nestedMap = nestedFieldsMaps.get(key)!;
              Object.entries(value as Record<string, unknown>).forEach(([nk, nv]) => {
                const nSample = extractSampleValue(nk, nv);
                if (nestedMap.has(nk)) {
                  const nExisting = nestedMap.get(nk)!;
                  if (nv === null || nv === undefined) nExisting.isNullable = true;
                  if (nSample !== null && nExisting.sampleValues && nExisting.sampleValues.length < 3) {
                    if (!nExisting.sampleValues.includes(nSample)) {
                      nExisting.sampleValues.push(nSample);
                    }
                  }
                } else {
                  nestedMap.set(nk, {
                    name: nk,
                    bsonType: getBsonType(nv),
                    isNullable: nv === null || nv === undefined,
                    isArray: Array.isArray(nv),
                    sampleValues: nSample !== null ? [nSample] : [],
                  });
                }
              });
            }
          });
        });

        // Attach accumulated nestedFields to the corresponding FieldDefinitions
        for (const [key, nestedMap] of nestedFieldsMaps) {
          const field = fieldsMap.get(key);
          if (field) field.nestedFields = Array.from(nestedMap.values());
        }

        // Add _id field explicitly
        const fields: FieldDefinition[] = [
          {
            name: '_id',
            bsonType: 'ObjectId',
            isNullable: false,
            isArray: false,
          },
          ...Array.from(fieldsMap.values()),
        ];

        schemas.push({
          collectionName,
          documentCount,
          fields,
        });
      }

      // Attach latencyMs metadata to result array
      (schemas as unknown as { latencyMs: number }).latencyMs = latencyMs;

      return {
        success: true,
        data: schemas,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Detect SRV errors
      if (errorMessage.includes('SRV') || errorMessage.includes('ENOTFOUND')) {
        return {
          success: false,
          error: maskSensitiveFields(`DNS SRV lookup failed. This happens on corporate/university networks. Try: (1) Using mobile hotspot, (2) Using direct connection instead of mongodb+srv:// format. Original error: ${errorMessage}`),
        };
      }

      return {
        success: false,
        error: maskSensitiveFields(`Could not connect to MongoDB: ${errorMessage}`),
      };
    } finally {
      if (client) {
        await client.close().catch(() => {
          // Ignore close errors
        });
      }
    }
  });
}

/**
 * Detects if a PostgreSQL connection string or host targets a known cloud pooler.
 * Returns null if not a cloud host, or the provider name if detected.
 */
function detectCloudPooler(
  config: ConnectionConfig
): { provider: 'supabase' | 'neon' | 'railway' | 'render' | 'other'; isPooler: boolean } | null {
  const connStr = (config.connectionString || '').toLowerCase();
  const host = (config.host || '').toLowerCase();
  const target = connStr || host;

  if (target.includes('supabase.co')) {
    // Pooler mode uses port 6543; direct uses 5432
    const isPooler = target.includes(':6543') || target.includes('pooler.supabase');
    return { provider: 'supabase', isPooler };
  }
  if (target.includes('neon.tech')) {
    // Neon pooled connections include '-pooler' in the hostname
    const isPooler = target.includes('-pooler.');
    return { provider: 'neon', isPooler };
  }
  if (target.includes('railway.app')) {
    return { provider: 'railway', isPooler: false };
  }
  if (target.includes('render.com') || target.includes('onrender.com')) {
    return { provider: 'render', isPooler: false };
  }
  return null;
}

/**
 * PostgreSQL Connection Handler
 * Tests connection, reads schema, checks permissions, and scans Layer 2 features (PostgreSQL only)
 */
export function setupPostgresqlHandler(): void {
  ipcMain.handle('db:connect-postgresql', async (_event, config: ConnectionConfig): Promise<IPCResponse<PostgresIntrospectionResult>> => {
    let client: PgClient | null = null;
    const targetSchema = sanitizeIdentifier(config.schema, 'public');

    // Proactive cloud provider detection (does not require a successful connection)
    const cloudInfo = detectCloudPooler(config);

    try {
      if (config.connectionString && config.connectionString.trim().length > 0) {
        client = new PgClient({
          connectionString: config.connectionString.trim(),
          connectionTimeoutMillis: 5000,
          statement_timeout: 10000,
        });
      } else {
        client = new PgClient({
          host: config.host || 'localhost',
          port: config.port || 5432,
          user: config.user,
          password: config.password,
          database: config.database,
          connectionTimeoutMillis: 5000,
          statement_timeout: 10000,
        });
      }

      // Test connection and measure ping latency
      const startTime = Date.now();
      await client.connect();
      await client.query('SET statement_timeout = 10000;');
      const latencyMs = Date.now() - startTime;

      // Check permissions on target schema
      const permissionCheck = await client.query(`
        SELECT 
          has_schema_privilege(current_user, $1, 'CREATE') as can_create,
          has_schema_privilege(current_user, $1, 'USAGE') as can_use
      `, [targetSchema]);

      const permissions = permissionCheck.rows[0];

      if (!permissions || !permissions.can_create) {
        return {
          success: false,
          error: `Permission Error: The connected PostgreSQL user does not have CREATE TABLE permission on schema '${targetSchema}'. Migration cannot proceed. Ask your database administrator to run: GRANT CREATE ON SCHEMA "${targetSchema}" TO "${config.user || 'current_user'}";`,
        };
      }

      // Read schema from information_schema for target schema
      const tablesResult = await client.query(`
        SELECT 
          table_name,
          array_agg(column_name::text ORDER BY ordinal_position) as columns,
          array_agg(data_type::text ORDER BY ordinal_position) as column_types,
          array_agg(is_nullable::text ORDER BY ordinal_position) as is_nullables
        FROM information_schema.columns
        WHERE table_schema = $1
        GROUP BY table_name
      `, [targetSchema]);

      // Read indexes for target schema
      const indexesResult = await client.query(`
        SELECT 
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = $1
      `, [targetSchema]);

      // Scan for Layer 2 features (stored procedures, functions, triggers, views, etc.) in target schema
      const layer2Result = await client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM pg_proc WHERE pg_proc.prokind = 'f' AND pg_proc.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)) as function_count,
          (SELECT COUNT(*)::int FROM pg_proc WHERE pg_proc.prokind = 'p' AND pg_proc.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)) as procedure_count,
          (SELECT COUNT(*)::int FROM pg_trigger WHERE pg_trigger.tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1))) as trigger_count,
          (SELECT COUNT(*)::int FROM pg_views WHERE schemaname = $1) as view_count,
          (SELECT COUNT(*)::int FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1) AND contype = 'c') as check_constraint_count,
          (SELECT COUNT(*)::int FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)) as enum_count
      `, [targetSchema]);

      const layer2 = layer2Result.rows[0] || {};

      return {
        success: true,
        data: {
          tables: tablesResult.rows.map(r => ({
            table_name: r.table_name,
            columns: Array.isArray(r.columns) ? r.columns : [],
            column_types: Array.isArray(r.column_types) ? r.column_types : [],
            is_nullables: Array.isArray(r.is_nullables) ? r.is_nullables : [],
          })),
          indexes: indexesResult.rows.map(r => ({
            tablename: r.tablename,
            indexname: r.indexname,
            indexdef: r.indexdef,
          })),
          layer2Features: {
            functions: Number(layer2.function_count) || 0,
            procedures: Number(layer2.procedure_count) || 0,
            triggers: Number(layer2.trigger_count) || 0,
            views: Number(layer2.view_count) || 0,
            checkConstraints: Number(layer2.check_constraint_count) || 0,
            enums: Number(layer2.enum_count) || 0,
          },
          isCloudPooler: cloudInfo?.isPooler ?? false,
          cloudProvider: cloudInfo?.provider,
          latencyMs,
          schema: targetSchema,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Detect Supabase/Neon pooler errors
      if (errorMessage.includes('pooler') || 
          (errorMessage.includes('db.supabase.co') || errorMessage.includes('neon.tech'))) {
        return {
          success: false,
          error: maskSensitiveFields(`Supabase/Neon Pooler Detected: For migrations, use the 'Direct Connection' URL instead of the pooler URL. Find it in: Settings → Database → Connection String → Direct. Original error: ${errorMessage}`),
        };
      }

      return {
        success: false,
        error: maskSensitiveFields(`Could not connect to PostgreSQL: ${errorMessage}`),
      };
    } finally {
      if (client) {
        await client.end().catch(() => {
          // Ignore close error
        });
      }
    }
  });
}

/**
 * Helper function to detect BSON type from a JavaScript value.
 *
 * Must detect MongoDB driver BSON objects (ObjectId, Decimal128, Long, Binary, UUID)
 * BEFORE falling through to the generic typeof === 'object' check, because the
 * MongoDB Node.js driver returns these as plain JS objects whose constructor name
 * identifies their real BSON type.
 */
function getBsonType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (value instanceof Date) {
    return 'date';
  }

  if (Buffer.isBuffer(value)) {
    return 'binary';
  }

  // ── MongoDB BSON type detection ─────────────────────────────────────────────
  // Must come before Array.isArray() and generic typeof checks.
  if (typeof value === 'object' && value !== null) {
    const ctorName = (value as Record<string, unknown>).constructor?.name as string | undefined;

    // ObjectId: 12-byte identifier returned by the driver as an object with toHexString()
    if (ctorName === 'ObjectId' || typeof (value as Record<string, unknown>).toHexString === 'function') {
      return 'objectid';
    }
    // Decimal128: arbitrary-precision decimal (money, scientific)
    if (ctorName === 'Decimal128' || ctorName === 'BSONDecimal128') {
      return 'decimal';
    }
    // Long: 64-bit signed integer (avoids JS number precision loss)
    if (ctorName === 'Long' || ctorName === 'BSONLong') {
      return 'long';
    }
    // Binary / UUID subtypes
    if (ctorName === 'UUID') return 'uuid';
    if (ctorName === 'Binary' || ctorName === 'BSONBinary') return 'binary';
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (Array.isArray(value)) {
    if (value.length === 0) return 'array';
    // Check multiple elements to avoid mis-classifying a mixed array
    const hasObjectElement = (value as unknown[]).some(
      (el) => el !== null && typeof el === 'object' && !Array.isArray(el)
    );
    return hasObjectElement ? 'arrayOfObjects' : 'array';
  }

  const type = typeof value;
  switch (type) {
    case 'boolean':
      return 'bool';
    case 'number':
      // Return 'int' for whole numbers, 'double' for decimals.
      // Numeric widening in the schema merge handles int+double conflicts correctly.
      return Number.isInteger(value) ? 'int' : 'double';
    case 'string':
      return 'string';
    case 'object':
      return 'object';
    default:
      return 'unknown';
  }
}

/**
 * Regular expression detecting sensitive credential, authentication, and PII keys.
 */
const SENSITIVE_KEY_REGEX = /(password|passwd|secret|token|auth|bearer|jwt|api[_-]?key|credit[_-]?card|card[_-]?num|cvv|cvc|ssn|social[_-]?sec|pin|access[_-]?key)/i;

/**
 * Extracts a safe scalar representation of a sample value for AI type inference.
 * Sanitizes sensitive credentials/PII, masks long strings, and formats dates / ObjectIds nicely.
 */
function extractSampleValue(key: string, value: unknown): unknown | null {
  if (value === null || value === undefined) return null;
  // Redact any sensitive field values to protect credentials and customer PII
  if (SENSITIVE_KEY_REGEX.test(key)) {
    return '[REDACTED: SENSITIVE]';
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    // Redact Bearer tokens, JWTs, or suspicious hashes
    if (/^(Bearer\s+|eyJ[a-zA-Z0-9_-]{10,})/i.test(value)) {
      return '[REDACTED: TOKEN]';
    }
    return value.length > 60 ? value.substring(0, 57) + '...' : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const ctor = (value as Record<string, unknown>).constructor?.name;
    if (ctor === 'ObjectId' && typeof (value as { toHexString?: () => string }).toHexString === 'function') {
      return (value as { toHexString: () => string }).toHexString();
    }
  }
  return null;
}

/**
 * Target Database Clean / Wipe Handler
 * Safely drops tables in public schema (PostgreSQL) or user collections (MongoDB)
 * when requested by user for a clean migration slate.
 */
export function setupClearTargetHandler(): void {
  ipcMain.handle('db:clear-target', async (_event, config: ConnectionConfig): Promise<IPCResponse<{ clearedCount: number }>> => {
    if (config.type === 'postgresql') {
      let client: PgClient | null = null;
      try {
        if (config.connectionString && config.connectionString.trim().length > 0) {
          client = new PgClient({ connectionString: config.connectionString.trim(), connectionTimeoutMillis: 5000, statement_timeout: 10000 });
        } else {
          client = new PgClient({
            host: config.host || 'localhost',
            port: config.port || 5432,
            user: config.user,
            password: config.password,
            database: config.database,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
          });
        }
        await client.connect();
        await client.query('SET statement_timeout = 10000;');

        const targetSchema = sanitizeIdentifier(config.schema, 'public');

        // Get table count before clearing
        const countRes = await client.query(
          `SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
          [targetSchema]
        );
        const clearedCount = countRes.rows[0]?.count || 0;

        // Reset target schema cleanly in a transaction (drops views, tables, triggers, types)
        try {
          await client.query('BEGIN;');
          await client.query(`DROP SCHEMA IF EXISTS "${targetSchema}" CASCADE;`);
          await client.query(`CREATE SCHEMA "${targetSchema}";`);
          await client.query(`GRANT ALL ON SCHEMA "${targetSchema}" TO CURRENT_USER;`);
          await client.query(`GRANT ALL ON SCHEMA "${targetSchema}" TO public;`);
          await client.query('COMMIT;');
        } catch (txErr) {
          await client.query('ROLLBACK;').catch(() => {});
          throw txErr;
        }

        return { success: true, data: { clearedCount } };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: maskSensitiveFields(`Failed to clear PostgreSQL database: ${errorMsg}`) };
      } finally {
        if (client) await client.end().catch(() => {});
      }
    } else {
      let client: MongoClient | null = null;
      try {
        let connectionString = config.connectionString;
        if (!connectionString) {
          const auth = config.user ? `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password || '')}@` : '';
          connectionString = `mongodb://${auth}${config.host || 'localhost'}:${config.port || 27017}`;
        }
        client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const db = (config.database && config.database.trim().length > 0 && config.database !== 'default')
          ? client.db(config.database.trim())
          : client.db();

        const collections = await db.listCollections().toArray();
        let clearedCount = 0;
        for (const col of collections) {
          if (!col.name.startsWith('system.')) {
            await db.collection(col.name).drop();
            clearedCount++;
          }
        }
        return { success: true, data: { clearedCount } };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: maskSensitiveFields(`Failed to clear MongoDB collections: ${errorMsg}`) };
      } finally {
        if (client) await client.close().catch(() => {});
      }
    }
  });
}

/**
 * Register all database handlers
 */
export function setupDatabaseHandlers(): void {
  setupMongoDBHandler();
  setupPostgresqlHandler();
  setupClearTargetHandler();
}

