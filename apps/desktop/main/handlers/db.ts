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

        sampleDocs.forEach((doc) => {
          Object.entries(doc).forEach(([key, value]) => {
            if (key === '_id') return; // Skip _id, we'll add it explicitly

            const bsonType = getBsonType(value);
            const isArray = Array.isArray(value);
            const isNullable = value === null || value === undefined;

            if (fieldsMap.has(key)) {
              const existing = fieldsMap.get(key)!;
              if (isNullable) existing.isNullable = true;
              if (existing.bsonType !== bsonType && !isNullable) {
                existing.bsonType = 'mixed'; // Mark as mixed if types vary
              }
            } else {
              fieldsMap.set(key, {
                name: key,
                bsonType,
                isNullable,
                isArray,
              });
            }
          });
        });

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
          error: `DNS SRV lookup failed. This happens on corporate/university networks. Try: (1) Using mobile hotspot, (2) Using direct connection instead of mongodb+srv:// format. Original error: ${errorMessage}`,
        };
      }

      return {
        success: false,
        error: `Could not connect to MongoDB: ${errorMessage}`,
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
    const targetSchema = config.schema?.trim() || 'public';

    // Proactive cloud provider detection (does not require a successful connection)
    const cloudInfo = detectCloudPooler(config);

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

      // Test connection and measure ping latency
      const startTime = Date.now();
      await client.connect();
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
          array_agg(column_name::text) as columns,
          array_agg(data_type::text) as column_types
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
          error: `Supabase/Neon Pooler Detected: For migrations, use the 'Direct Connection' URL instead of the pooler URL. Find it in: Settings → Database → Connection String → Direct. Original error: ${errorMessage}`,
        };
      }

      return {
        success: false,
        error: `Could not connect to PostgreSQL: ${errorMessage}`,
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
 * Helper function to detect BSON type from JavaScript value
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

  if (Array.isArray(value)) {
    if (value.length === 0) return 'array';
    const firstElement = value[0];
    if (typeof firstElement === 'object' && firstElement !== null) {
      return 'arrayOfObjects';
    }
    return 'array';
  }

  const type = typeof value;
  switch (type) {
    case 'boolean':
      return 'bool';
    case 'number':
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
          client = new PgClient({ connectionString: config.connectionString.trim(), connectionTimeoutMillis: 5000 });
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

        const targetSchema = config.schema?.trim() || 'public';

        // Get table count before clearing
        const countRes = await client.query(
          `SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
          [targetSchema]
        );
        const clearedCount = countRes.rows[0]?.count || 0;

        // Reset target schema cleanly (drops views, tables, triggers, types)
        await client.query(`
          DROP SCHEMA "${targetSchema}" CASCADE;
          CREATE SCHEMA "${targetSchema}";
          GRANT ALL ON SCHEMA "${targetSchema}" TO CURRENT_USER;
          GRANT ALL ON SCHEMA "${targetSchema}" TO public;
        `);

        return { success: true, data: { clearedCount } };
      } catch (err) {
        return { success: false, error: `Failed to clear PostgreSQL database: ${err instanceof Error ? err.message : String(err)}` };
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
        return { success: false, error: `Failed to clear MongoDB collections: ${err instanceof Error ? err.message : String(err)}` };
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

