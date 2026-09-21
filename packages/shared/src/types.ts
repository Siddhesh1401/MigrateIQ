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
  sqlType?: string;
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
  defaultValue?: string;
  isChildTable?: boolean;
  childTableName?: string;
  foreignKeyToParent?: string;
  sortOrderColumn?: boolean;
  transformationRule?: string;
  isAiModified?: boolean;
}

export interface CollectionMapping {
  collectionName: string;
  targetTableName: string;
  fields: FieldMapping[];
  indexes?: IndexMapping[];
  childTables?: CollectionMapping[];
}

export interface TargetIndexPlan {
  indexName: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isConcurrently: boolean;
  isGin?: boolean;
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

export type AutoFixActionType = 
  | 'set_nullable' 
  | 'set_default_value'
  | 'create_child_table' 
  | 'reduce_batch_size' 
  | 'defer_foreign_keys'
  | 'change_column_type'
  | 'rename_target_column'
  | 'rename_target_table';

export interface AutoFixAction {
  type: AutoFixActionType;
  collectionName: string;
  fieldName?: string;
  recommendedValue?: unknown;
  description: string;
}

export interface RiskItem {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  suggestedFix?: string;
  autoFixAvailable?: boolean;
  autoFixAction?: AutoFixAction;
  affectedTable?: string;
  affectedField?: string;
  acknowledged?: boolean;
  fixed?: boolean;
  metadata?: Record<string, unknown>;
}

export type Layer2FeatureType = 'procedure' | 'function' | 'trigger' | 'view' | 'enum' | 'composite_pk';

export interface Layer2FeatureItem {
  id: string;
  type: Layer2FeatureType;
  name: string;
  targetObject?: string;
  signature?: string;
  description: string;
  whyNotMigrated: string;
  replacementGuide: string;
  codeSnippet: string;
  isAutoApplied?: boolean;
  acknowledged?: boolean;
}

export interface RiskAnalysisResult {
  risks: RiskItem[];
  layer2Features: Layer2FeatureItem[];
  metrics: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    recommendedBatchSize: number;
    hasCircularFk: boolean;
  };
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
  is_nullables?: string[];
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

// AI Schema Mapping Types
export type MappingBadge = 'AI Suggested' | 'Auto Rule-Mapped';

export interface AIGenerateMappingResponse {
  mappings: CollectionMapping[];
  badge: MappingBadge;
  batchCount?: number;
  processingTimeMs?: number;
}

export interface AIHealthScoreResponse {
  score: number; // 0-100
  deductions: Array<{
    reason: string;
    points: number;
    severity: 'high' | 'medium' | 'low';
  }>;
  summaryTip: string;
}

// ── AI Usage & Token Tracking Types ──────────────────────────────────────────
export interface AIUsageLogEntry {
  id: string;
  timestamp: string;      // ISO string
  feature: 'Schema Inference' | 'Health Score' | 'Copilot Tweak' | 'Database Q&A' | 'Risk Analysis';
  model: string;          // e.g. 'gemini-1.5-flash'
  promptSnippet: string;  // First 100 chars of instruction or operation
  promptTokens: number;   // estimated input tokens
  responseTokens: number; // estimated output tokens
  totalTokens: number;    // combined tokens
  status: 'success' | 'cached' | 'fallback' | 'rate-limited' | 'error';
  durationMs: number;     // execution time
}

export interface AIUsageStats {
  requestsToday: number;
  dailyLimit: number;     // 1,500 requests for Gemini Flash free tier
  tokensToday: number;
  lifetimeRequests: number;
  lifetimeTokens: number;
  lastUsedTimestamp: string | null;
}

// ── Dry Run Simulation Types (Phase 8 / Step 6) ───────────────────────────
export type DryRunStatus = 'passed' | 'warning' | 'failed';

export interface DryRunSkippedRow {
  documentId: string;
  collection: string;
  targetTable: string;
  field?: string;
  reason: string;
  sampleValue?: unknown;
  rawSampleSnippet?: string;
}

export interface DryRunTableResult {
  collectionName: string;
  targetTableName: string;
  columnsCount: number;
  isChildTable?: boolean;
  parentTable?: string;
  schemaValid: boolean;
  sampleTested: number;
  samplePassed: number;
  sampleFailed: number;
  totalEstimatedRows: number;
  projectedMigrateCount: number;
  projectedSkipCount: number;
  status: DryRunStatus;
  skippedRows: DryRunSkippedRow[];
  durationMs: number;
  ddlPreview?: string;
}

export interface StorageHeadroomInfo {
  currentDbSizeBytes: number;
  projectedSizeBytes: number;
  sufficientSpace: boolean;
  formattedCurrentDbSize: string;
  formattedProjectedSize: string;
}

export interface DryRunResult {
  simulationId: string;
  timestamp: string;
  direction: 'mongodb-to-postgres' | 'postgres-to-mongo';
  tables: DryRunTableResult[];
  totalTables: number;
  totalSampleTested: number;
  totalSamplePassed: number;
  totalSampleFailed: number;
  totalProjectedMigrate: number;
  totalProjectedSkip: number;
  overallStatus: DryRunStatus;
  allSkippedRows: DryRunSkippedRow[];
  executionTimeMs: number;
  rollbackVerified: boolean;
  isDemoMode?: boolean;
  // Enterprise Telemetry & Capacity Checks
  throughputRowsPerSec?: number;
  projectedDurationSec?: number;
  projectedTotalSizeBytes?: number;
  storageHeadroom?: StorageHeadroomInfo;
}

export interface DryRunProgressPayload {
  stage: 'init' | 'schema' | 'sample_data' | 'rollback' | 'complete' | 'error';
  tableName?: string;
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export interface DryRunOptions {
  mapping: CollectionMapping[];
  sourceConfig: ConnectionConfig | null;
  targetConfig: ConnectionConfig | null;
  sourceSchema: SourceSchema[] | null;
  direction?: 'mongodb-to-postgres' | 'postgres-to-mongo';
  isDemoMode?: boolean;
  singleTableName?: string;
  onProgress?: (progress: DryRunProgressPayload) => void;
}

// ── AI Remediation Studio Types (Step 6 / Phase 8) ────────────────────────
export interface AnomalyFixRequest {
  tableName: string;
  columnName: string;
  targetType: string;
  failureReason: string;
  sampleValues?: string[];
  rawSnippet?: string;
  // UI & Studio convenience aliases:
  targetTable?: string;
  targetColumn?: string;
  isNullable?: boolean;
  currentDefaultValue?: string;
  affectedRowCount?: number;
  sampleOffendingSnippet?: string;
}

export interface AIAnomalyFixRecommendation {
  targetTable: string;
  field: string;
  targetType: string;
  suggestedValue: string;
  rationale: string;
  sqlClause: string;
  beforeSnippet?: string;
  // UI & Studio convenience aliases:
  targetColumn?: string;
  recommendedDefaultValue?: string;
  suggestedDdl?: string;
  confidence?: number;
  isAiGenerated?: boolean;
}

// ── Migration History & Wizard State Snapshot Types ─────────────────────────
export interface MigrationHistoryItem {
  id: string;
  dateTime: string;
  direction: string;
  status: 'completed' | 'warning' | 'failed';
  sourceDb?: string;
  targetDb?: string;
  tablesCount?: number;
  rowsMigrated?: number;
  duration?: string;
  reportSummary?: string;
}

export interface WizardStateSnapshot {
  direction: 'mongodb-to-postgres' | 'postgres-to-mongo' | null;
  wizardStep: number;
  sourceConfig: ConnectionConfig | null;
  targetConfig: ConnectionConfig | null;
  status: 'in-progress' | 'completed' | 'cancelled';
  savedAt: string;
}

// ── Phase 11: Schema Update Assistant (Workflow C) Types ─────────────────────
export type SchemaOperationType =
  | 'addColumn'
  | 'dropColumn'
  | 'renameColumn'
  | 'renameTable'
  | 'changeType'
  | 'addIndex'
  | 'dropIndex'
  | 'addForeignKey';

export interface SchemaChangeParams {
  databaseType: DatabaseType;
  operation: SchemaOperationType;
  tableName: string;
  columnName?: string;
  newColumnName?: string;
  newTableName?: string;
  dataType?: string;
  isNullable?: boolean;
  defaultValue?: string;
  indexName?: string;
  isUnique?: boolean;
  foreignTable?: string;
  foreignColumn?: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  sparse?: boolean;
}

export interface NL2DDLResponse {
  operation: SchemaOperationType;
  tableName: string;
  columnName?: string;
  newColumnName?: string;
  newTableName?: string;
  dataType?: string;
  isNullable?: boolean;
  defaultValue?: string;
  indexName?: string;
  isUnique?: boolean;
  foreignTable?: string;
  foreignColumn?: string;
  confidence: number;
  explanation: string;
  rawInput: string;
  isFallback?: boolean;
}

export interface SchemaUpdateRiskItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  autoFixAvailable?: boolean;
  autoFixAction?: {
    type: 'make_nullable' | 'set_default';
    recommendedValue?: string;
    description: string;
  };
}

export interface GeneratedScriptResult {
  forwardScript: string;
  rollbackScript: string;
  operationSummary: string;
  riskNotice?: string;
}

export interface SchemaUpdateExecutionResult {
  success: boolean;
  executionTimeMs: number;
  message: string;
  sqlExecuted?: string;
  error?: string;
  errorCode?: string;
  suggestion?: string;
}

export interface SchemaHistoryItem {
  id: string;
  timestamp: string;
  databaseType: DatabaseType;
  databaseName: string;
  operation: SchemaOperationType;
  tableName: string;
  forwardScript: string;
  rollbackScript: string;
  status: 'applied' | 'failed' | 'rolled_back';
  durationMs: number;
  errorMessage?: string;
  author?: string;
}

export interface SchemaIntrospectedTableInfo {
  tableName: string;
  rowCount: number;
  columns: Array<{
    columnName: string;
    dataType: string;
    isNullable: boolean;
  }>;
}

