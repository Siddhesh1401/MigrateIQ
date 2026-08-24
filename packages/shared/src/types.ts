/**
 * MigrateIQ - Shared TypeScript Types
 */

export type DatabaseType = 'mongodb' | 'postgresql';

export interface ConnectionConfig {
  id?: string;
  name?: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  schema?: string; // PostgreSQL schema (default: 'public')
  user?: string;
  password?: string;
  connectionString?: string;
  ssl?: boolean;
}

export interface FieldDefinition {
  name: string;
  bsonType: string;
  isNullable: boolean;
  isArray: boolean;
  sampleValues?: unknown[];
  nestedFields?: FieldDefinition[];
}

export interface SourceSchema {
  collectionName: string;
  documentCount: number;
  fields: FieldDefinition[];
  indexes?: IndexDefinition[];
}

export interface IndexDefinition {
  name: string;
  fields: Record<string, 1 | -1 | string>;
  unique?: boolean;
  isCompound?: boolean;
  isGinCandidate?: boolean;
}

export interface FieldMapping {
  id: string;
  sourceField: string;
  sourceType: string;
  targetColumn: string;
  targetType: string;
  isNullable: boolean;
  include: boolean;
  isChildTable?: boolean;
  childTableName?: string;
  foreignKeyToParent?: string;
  sortOrderColumn?: boolean;
  transformationRule?: string;
}

export interface CollectionMapping {
  collectionName: string;
  targetTableName: string;
  fields: FieldMapping[];
  indexes: IndexMapping[];
  childTables?: CollectionMapping[];
}

export interface IndexMapping {
  sourceIndexName: string;
  targetIndexName: string;
  targetSql: string;
  include: boolean;
  isConcurrently: boolean;
  isGin?: boolean;
}

export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface RiskItem {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  suggestedFix?: string;
  autoFixAvailable?: boolean;
  affectedTable?: string;
  affectedField?: string;
  acknowledged?: boolean;
}

export interface ProgressEvent {
  phase: 'schema_creation' | 'data_transfer' | 'index_creation' | 'constraint_validation' | 'complete' | 'failed';
  currentTable: string;
  tableIndex: number;
  totalTables: number;
  rowsMigrated: number;
  rowsTotal: number;
  rowsSkipped: number;
  rowsPerSec: number;
  etaSeconds: number;
  percent: number;
  logMessage?: string;
  timestamp: number;
}

export interface SkippedRowLog {
  documentId: string;
  collection: string;
  reason: string;
  rawSample?: string;
}

export interface MigrationResult {
  migrationId: string;
  direction: 'mongo_to_postgres' | 'postgres_to_mongo';
  sourceDatabase: string;
  targetDatabase: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  tablesCreated: number;
  rowsMigrated: number;
  rowsSkipped: number;
  skippedDetails: SkippedRowLog[];
  status: 'success' | 'partial' | 'failed' | 'rolled_back';
  rollbackScriptPath?: string;
}

export interface SchemaHealthScore {
  score: number; // 0-100
  deductions: Array<{
    reason: string;
    points: number;
    severity: 'high' | 'medium' | 'low';
  }>;
  summaryTip: string;
}

export interface PostgresTableInfo {
  table_name: string;
  columns: string[];
  column_types: string[];
}

export interface PostgresIndexInfo {
  tablename: string;
  indexname: string;
  indexdef: string;
}

export interface Layer2Summary {
  functions: number;
  procedures: number;
  triggers: number;
  views: number;
  checkConstraints: number;
  enums: number;
}

export interface PostgresIntrospectionResult {
  tables: PostgresTableInfo[];
  indexes: PostgresIndexInfo[];
  layer2Features: Layer2Summary;
  /** True when the connection string looks like a Supabase/Neon/Railway pooler URL */
  isCloudPooler?: boolean;
  /** Identifies the cloud provider when isCloudPooler is true */
  cloudProvider?: 'supabase' | 'neon' | 'railway' | 'render' | 'other';
  /** Ping round-trip latency in milliseconds */
  latencyMs?: number;
  /** The target PostgreSQL schema inspected (e.g. 'public') */
  schema?: string;
}

export interface MongoIntrospectionResult {
  schemas: SourceSchema[];
  latencyMs?: number;
}

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
