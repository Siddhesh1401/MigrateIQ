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
  /** Original SQL data type from PostgreSQL introspection (e.g. "VARCHAR(100)", "SERIAL", "TIMESTAMPTZ") */
  sqlType?: string;
  /** Dot-notation field path for deeply nested fields (e.g. "address.city") */
  path?: string;
  /** Pre-resolved FK reference from PostgreSQL introspection (e.g. "users.id") */
  foreignKeyToParent?: string;
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

/** @deprecated Use MigrationResult (Phase 9) instead. Kept for reference only. */
export interface LegacyMigrationHistoryResult {
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
  estimated_rows?: number;
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

// â”€â”€ AI Usage & Token Tracking Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Dry Run Simulation Types (Phase 8 / Step 6) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ AI Remediation Studio Types (Step 6 / Phase 8) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Migration History & Wizard State Snapshot Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Phase 11: Schema Update Assistant (Workflow C) Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type SchemaOperationType =
  | 'addColumn'
  | 'dropColumn'
  | 'renameColumn'
  | 'renameTable'
  | 'changeType'
  | 'addIndex'
  | 'dropIndex'
  | 'addForeignKey'
  | 'dropTable';

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
  concurrently?: boolean;
  foreignTable?: string;
  foreignColumn?: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  sparse?: boolean;
  originalDataType?: string;
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
  severity: 'critical' | 'warning' | 'info' | 'policy';
  title: string;
  description: string;
  policyCategory?: 'naming' | 'performance' | 'security' | 'anti-pattern';
  ruleId?: string;
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
  checksum?: string;
  verified?: boolean;
  verificationDetails?: string;
  ledgerRecorded?: boolean;
}

export interface StagedChange {
  id: string;
  summary: string;
  params: SchemaChangeParams;
  scripts?: GeneratedScriptResult;
  risks?: SchemaUpdateRiskItem[];
}

export interface DryRunExecutionResult {
  success: boolean;
  executionTimeMs: number;
  message: string;
  sqlExecuted?: string;
  lockTimeoutMs?: number;
  error?: string;
  errorCode?: string;
  suggestion?: string;
  simulatedOnly: boolean;
}

export interface BatchExecutionResult {
  success: boolean;
  totalTimeMs: number;
  results: SchemaUpdateExecutionResult[];
  appliedCount: number;
  failedCount: number;
  errorMessage?: string;
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
  indexes?: string[];
}

// â”€â”€ Masterpiece Schema Evolution Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type EnvironmentTier = 'development' | 'staging' | 'production';

export interface ChangeImpactScorecard {
  dataRisk: 'low' | 'medium' | 'high';
  lockRisk: 'low' | 'medium' | 'high';
  dependencyRisk: 'low' | 'medium' | 'high';
  compatibility: 'low' | 'medium' | 'high';
  rollbackFeasibility: 'fully_reversible' | 'reversible_with_data_loss' | 'destructive';
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  recommendedStrategy: 'direct' | 'expand_contract';
  summaryMessage: string;
}

export interface MigrationManifest {
  id: string;
  version: string;
  description: string;
  databaseType: DatabaseType;
  databaseName: string;
  environment: EnvironmentTier;
  author: string;
  checksum: string;
  createdAt: string;
  operations: SchemaOperationType[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lockImpact: string;
}

export interface InDatabaseLedgerEntry {
  installedRank: number;
  version: string;
  description: string;
  type: string;
  script: string;
  checksum: string;
  installedBy: string;
  installedOn: string;
  executionTimeMs: number;
  success: boolean;
  rollbackScript?: string;
}

export interface SchemaDriftReport {
  hasDrift: boolean;
  driftCount: number;
  unmanagedObjects: Array<{
    type: 'table' | 'column' | 'index';
    name: string;
    parentTable?: string;
    details: string;
  }>;
  lastRecordedVersion?: string;
}

export interface TableDependencyGraph {
  referencingForeignKeys: Array<{
    constraintName: string;
    referencingTable: string;
    referencingColumn: string;
    onDelete: string;
  }>;
  dependentViews: string[];
  associatedIndexes: Array<{
    indexName: string;
    isUnique: boolean;
    columns: string[];
  }>;
}

export interface ExecutionConsoleLogLine {
  timestamp: string;
  stage: string;
  message: string;
  status: 'running' | 'success' | 'warn' | 'failed';
}

export interface BackupSnapshotResult {
  success: boolean;
  backupTableName: string;
  rowCount: number;
  createdAt: string;
  error?: string;
}

export interface MongoValidationRule {
  collection: string;
  validatorCommand: string;
  jsonSchema: Record<string, unknown>;
}

export interface EvolutionStrategyRecommendation {
  type: 'direct' | 'expand_contract';
  title: string;
  reason: string;
  phases?: Array<{
    phaseNumber: number;
    phaseTitle: string;
    description: string;
    script: string;
  }>;
}

export interface ScriptImportParseResult {
  success: boolean;
  params?: SchemaChangeParams;
  detectedDialect?: 'postgresql' | 'mongodb';
  error?: string;
  warning?: string;
}


// ============================================
// Phase 9: Live Migration Engine Types
// ============================================

// Skipped row during live migration
export interface SkippedRow {
  documentId: string;
  reason: string;
  sourceDocument?: string;
}

export interface MigrationProgressEvent {
  type: 'start' | 'table_start' | 'table_progress' | 'table_complete' | 'complete' | 'error' | 'cancel';
  
  // Overall migration stats
  totalTables?: number;
  completedTables?: number;
  
  // Current table stats
  currentTable?: string;
  currentTableRows?: number;
  currentTableRowsCompleted?: number;
  currentTableProgress?: number; // 0-100
  
  // Current batch stats
  currentBatch?: number;
  totalBatches?: number;
  
  // Performance metrics
  rowsPerSecond?: number;
  estimatedTimeRemainingMs?: number;
  
  // Error handling
  error?: string;
  skippedRows?: SkippedRow[];
  
  // Timestamps
  startTime?: string;
  endTime?: string;
}

export interface MigrationLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  table?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface TableMigrationProgress {
  tableName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  totalRows: number;
  rowsCompleted: number;
  percentComplete: number;
  startTime?: string;
  endTime?: string;
  error?: string;
  skippedRows: SkippedRow[];
}

export interface MigrationResult {
  success: boolean;
  totalTables: number;
  completedTables: number;
  failedTables: number;
  totalRows: number;
  migratedRows: number;
  skippedRows: number;
  duration: number; // milliseconds
  startTime: string;
  endTime: string;
  error?: string;
  tableResults: TableMigrationProgress[];
  rollbackScript?: string;
}

export interface MigrationRollbackInfo {
  available: boolean;
  tables: string[];
  rowCount: number;
  createdAt: string;
  script?: string;
}

export interface TopologicalSortResult {
  success: boolean;
  orderedTables: string[];
  cycles?: Array<{
    tables: string[];
    foreignKeys: string[];
  }>;
  error?: string;
}

export interface ETLBatchResult {
  success: boolean;
  rowsProcessed: number;
  rowsSkipped: number;
  skippedRows: SkippedRow[];
  error?: string;
}

// Enhanced SkippedRow type for Phase 9
export interface EnhancedSkippedRow extends SkippedRow {
  batchNumber?: number;
  retryAttempt?: number;
  stackTrace?: string;
}
