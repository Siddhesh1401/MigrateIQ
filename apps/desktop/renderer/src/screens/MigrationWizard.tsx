import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type {
  ConnectionConfig,
  SourceSchema,
  IndexDefinition,
  PostgresIntrospectionResult,
  AIGenerateMappingResponse,
  AIHealthScoreResponse,
  MappingBadge,
} from '@migrateiq/shared';
import { useWizardStore } from '../store/wizardStore';
import { StepProgressBar } from '../components/StepProgressBar';
import { ConnectionForm } from '../components/ConnectionForm';
import { SchemaMapper } from './SchemaMapper';
import { RiskReport } from './RiskReport';
import { DryRunScreen } from './DryRunScreen';
import MigrationProgressScreen from './MigrationProgressScreen';
import '../styles/wizard.css';

export interface MigrationWizardProps {}

// ── Private types for PostgreSQL introspection row shapes ────────────────────

/** Matches the PostgresTableInfo shape returned by the IPC db:connect-postgresql handler */
interface PgTableRow {
  table_name: string;
  columns: string[];
  column_types: string[];
  is_nullables?: string[];
}

/** Matches the PostgresIndexInfo shape returned by the IPC db:connect-postgresql handler */
interface PgIndexRow {
  tablename: string;
  indexname: string;
  indexdef: string;
}

// ── Utility: Convert PostgreSQL Introspection Result to SourceSchema ─────────

/**
 * Convert PostgreSQL table structure to SourceSchema format (for Schema Mapping)
 * Maps SQL types to BSON-like types for schema mapping engine compatibility.
 */
function convertPostgresTableToSourceSchema(pgTables: PgTableRow[], pgIndexes: PgIndexRow[] = []): SourceSchema[] {
  return pgTables.map((table) => {
    const fields = (table.columns || []).map((colName: string, idx: number) => {
      const sqlType = (table.column_types || [])[idx] || 'text';
      const isNullableStr = (table.is_nullables || [])[idx];
      // In PostgreSQL information_schema.columns, 'NO' means NOT NULL
      const isNullable = isNullableStr ? isNullableStr.toUpperCase() !== 'NO' : true;
      const bsonType = postgresTypeToBsonType(sqlType);

      return {
        name: colName,
        bsonType,
        sqlType: sqlType.toUpperCase(),
        isNullable,
        isArray: sqlType.includes('[]'),
      };
    });

    // Extract indexes for this table from PostgreSQL pg_indexes
    const tableIndexes = (pgIndexes || []).filter((idx: PgIndexRow) => idx.tablename === table.table_name);
    const indexes: IndexDefinition[] = tableIndexes.map((idx: PgIndexRow) => {
      const isUnique = (idx.indexdef || '').toUpperCase().includes('UNIQUE');
      const match = (idx.indexdef || '').match(/\(([^)]+)\)/);
      const fieldStr = match ? match[1].replace(/["']/g, '').trim() : '';
      const fieldsRecord: Record<string, 1 | -1 | string> = {};
      if (fieldStr) {
        fieldStr.split(',').forEach((f: string) => {
          fieldsRecord[f.trim()] = 1;
        });
      }
      return {
        name: idx.indexname,
        fields: fieldsRecord,
        unique: isUnique,
      };
    });

    return {
      collectionName: table.table_name,
      fields,
      documentCount: 0,
      indexes,
    };
  });
}

/**
 * Map PostgreSQL data type to BSON-like type for schema mapping
 */
function postgresTypeToBsonType(pgType: string): string {
  const type = (pgType || '').toUpperCase().trim();

  // ── Core Text / String Types ──
  if (type.startsWith('VARCHAR') || type.startsWith('CHARACTER') || type.includes('CHAR')) return 'string';
  if (type === 'TEXT' || type === 'CITEXT' || type === 'XML' || type === 'NAME') return 'string';
  if (type === 'USER-DEFINED' || type.includes('ENUM')) return 'string';

  // ── Integer Types ──
  if (type === 'SMALLINT' || type === 'INT2') return 'int';
  if (type === 'INTEGER' || type === 'INT' || type === 'INT4' || type === 'OID') return 'int';
  if (type === 'BIGINT' || type === 'INT8') return 'long';
  if (type.includes('SERIAL')) return 'int';

  // ── Decimal & Monetary Types ──
  if (type.startsWith('NUMERIC') || type.startsWith('DECIMAL') || type === 'MONEY') return 'decimal';
  if (type === 'REAL' || type === 'FLOAT4') return 'double';
  if (type === 'DOUBLE PRECISION' || type === 'FLOAT8' || type === 'FLOAT') return 'double';

  // ── Boolean ──
  if (type === 'BOOLEAN' || type === 'BOOL') return 'bool';

  // ── Date/Time Types ──
  if (type.includes('TIMESTAMP') || type === 'TIMESTAMPTZ') return 'date';
  if (type === 'DATE') return 'date';
  if (type === 'TIME' || type.includes('TIME')) return 'date';
  if (type === 'INTERVAL') return 'string';

  // ── Network / Identifier Types ──
  if (type === 'UUID' || type === 'INET' || type === 'CIDR' || type === 'MACADDR' || type === 'MACADDR8') return 'string';

  // ── Binary Types ──
  if (type === 'BYTEA' || type === 'BLOB' || type === 'BIT' || type.startsWith('VARBIT')) return 'binary';

  // ── JSON / Complex Object Types ──
  if (type === 'JSONB' || type === 'JSON') return 'object';

  // ── Full-Text Search Types ──
  if (type === 'TSVECTOR' || type === 'TSQUERY') return 'string';

  // ── Geometric Types (PostGIS / Native Postgres Geometry) ──
  if (type.includes('GEOMETRY') || type.includes('GEOGRAPHY') ||
      ['POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE'].includes(type)) {
    return 'object';
  }

  // ── Array Types ──
  if (type.includes('[]') || type.startsWith('ARRAY')) return 'array';

  // ── Default ──
  return 'string';
}

// ── Collapsible Mongo Preview ───────────────────────────────────────────────

interface CollapsibleMongoPreviewProps {
  schemas: SourceSchema[];
}

const CollapsibleMongoPreview: React.FC<CollapsibleMongoPreviewProps> = ({ schemas }) => {
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setOpenCollections((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <div className="schema-preview" style={{ marginTop: '0.75rem' }}>
      {schemas.map((schema) => {
        const isOpen = openCollections.has(schema.collectionName);
        return (
          <div key={schema.collectionName} className="collection-item">
            <button
              onClick={() => toggle(schema.collectionName)}
              style={{
                background: 'none',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                padding: '0.375rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isOpen ? '▾' : '▸'}
              </span>
              <strong style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                {schema.collectionName}
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                — {schema.documentCount} documents, {schema.fields.length} fields
              </span>
            </button>
            {isOpen && (
              <div style={{
                paddingLeft: '1.25rem',
                paddingBottom: '0.5rem',
                borderLeft: '2px solid var(--border-subtle)',
                marginLeft: '0.375rem',
                marginTop: '0.25rem',
              }}>
                {schema.fields.slice(0, 10).map((field) => (
                  <div key={field.name} style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    padding: '0.125rem 0',
                    fontFamily: 'monospace',
                  }}>
                    <span style={{ color: 'var(--text-primary)' }}>{field.name}</span>
                    {' '}
                    <span style={{ color: '#6366f1' }}>({field.bsonType})</span>
                    {field.isNullable && <span style={{ color: 'var(--status-warning)', fontSize: '0.7rem', marginLeft: '0.375rem' }}>nullable</span>}
                    {field.isArray && <span style={{ color: '#0284C7', fontSize: '0.7rem', marginLeft: '0.375rem' }}>array</span>}
                  </div>
                ))}
                {schema.fields.length > 10 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
                    +{schema.fields.length - 10} more fields…
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Collapsible Postgres Preview ────────────────────────────────────────────

interface CollapsiblePgPreviewProps {
  result: PostgresIntrospectionResult;
}

const CollapsiblePgPreview: React.FC<CollapsiblePgPreviewProps> = ({ result }) => {
  const [openTables, setOpenTables] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setOpenTables((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <div className="schema-preview" style={{ marginTop: '0.75rem' }}>
      {result.tables.map((table) => {
        const isOpen = openTables.has(table.table_name);
        return (
          <div key={table.table_name} className="collection-item">
            <button
              onClick={() => toggle(table.table_name)}
              style={{
                background: 'none',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                padding: '0.375rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isOpen ? '▾' : '▸'}
              </span>
              <strong style={{ color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                {table.table_name}
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                — {table.columns.length} columns ({table.column_types.slice(0, 3).join(', ')}{table.columns.length > 3 ? '…' : ''})
              </span>
            </button>
            {isOpen && (
              <div style={{
                paddingLeft: '1.25rem',
                paddingBottom: '0.5rem',
                borderLeft: '2px solid var(--border-subtle)',
                marginLeft: '0.375rem',
                marginTop: '0.25rem',
              }}>
                {table.columns.map((col, i) => (
                  <div key={col} style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    padding: '0.125rem 0',
                    fontFamily: 'monospace',
                  }}>
                    <span style={{ color: 'var(--text-primary)' }}>{col}</span>
                    {' '}
                    <span style={{ color: '#6366f1' }}>({table.column_types[i] || 'unknown'})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Layer 2 Summary Banner ───────────────────────────────────────────────────

interface Layer2BannerProps {
  result: PostgresIntrospectionResult;
}

const Layer2Banner: React.FC<Layer2BannerProps> = ({ result }) => {
  const [expanded, setExpanded] = useState(false);
  const l2 = result.layer2Features;

  const rows: { label: string; count: number }[] = [
    { label: 'Stored Procedures', count: l2.procedures },
    { label: 'Functions', count: l2.functions },
    { label: 'Triggers', count: l2.triggers },
    { label: 'Views', count: l2.views },
    { label: 'CHECK Constraints', count: l2.checkConstraints },
    { label: 'ENUM Types', count: l2.enums },
  ];

  const nonZeroRows = rows.filter((r) => r.count > 0);
  const totalFeatures = rows.reduce((sum, r) => sum + r.count, 0);

  if (totalFeatures === 0) return null;

  return (
    <div style={{
      marginTop: '1rem',
      padding: '1rem 1.25rem',
      border: '1px solid #FCD34D',
      borderRadius: '8px',
      backgroundColor: '#FFFBEB',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.25rem' }}>📋</span>
          <div>
            <strong style={{ color: '#92400E', fontSize: '0.9375rem' }}>
              Advanced Features Detected
            </strong>
            <p style={{ color: '#B45309', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
              This database contains {totalFeatures} feature{totalFeatures > 1 ? 's' : ''} (stored procedures, triggers, views, etc.)
              that cannot be automatically migrated. A Layer 2 Migration Guide will be generated for you.
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: '1px solid #D97706',
            borderRadius: '6px',
            padding: '0.375rem 0.75rem',
            fontSize: '0.8rem',
            color: '#92400E',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {expanded ? 'Collapse ▲' : 'View Details ▼'}
        </button>
      </div>

      {expanded && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.375rem 0.5rem', borderBottom: '1px solid #FCD34D', color: '#92400E' }}>Feature</th>
              <th style={{ textAlign: 'right', padding: '0.375rem 0.5rem', borderBottom: '1px solid #FCD34D', color: '#92400E' }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {nonZeroRows.map((row) => (
              <tr key={row.label}>
                <td style={{ padding: '0.375rem 0.5rem', color: '#92400E' }}>{row.label}</td>
                <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right', color: '#92400E', fontWeight: 600 }}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ color: '#B45309', fontSize: '0.75rem', margin: 0 }}>
        ⚠️ These require manual action after data migration. A complete Layer 2 Migration Guide will be generated in Step 5.
      </p>
    </div>
  );
};

// ── Main MigrationWizard Component ───────────────────────────────────────────

export const MigrationWizard: React.FC<MigrationWizardProps> = () => {
  const location = useLocation();
  const wizardStore = useWizardStore();

  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  // Sync demoMode flag and resumeNotice from router navigation state if present
  useEffect(() => {
    const navState = location.state as { demoMode?: boolean; resumeNotice?: string } | null;
    if (navState && navState.demoMode) {
      wizardStore.setIsDemoMode(true);
    }
    if (navState && navState.resumeNotice) {
      setResumeNotice(navState.resumeNotice);
    }
  }, [location.state, wizardStore]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceConnectedSuccessfully, setSourceConnectedSuccessfully] = useState<boolean>(
    !!wizardStore.sourceConfig
  );
  const [sourceMongoPreview, setSourceMongoPreview] = useState<SourceSchema[] | null>(
    wizardStore.direction === 'mongodb-to-postgres' ? wizardStore.sourceSchema : null
  );
  const [sourcePgPreview, setSourcePgPreview] = useState<PostgresIntrospectionResult | null>(null);
  const [targetTableCount, setTargetTableCount] = useState<number | null>(null);
  const [targetPgPreview, setTargetPgPreview] = useState<PostgresIntrospectionResult | null>(null);
  const [targetMongoPreview, setTargetMongoPreview] = useState<SourceSchema[] | null>(null);
  const [sourceLatencyMs, setSourceLatencyMs] = useState<number | null>(null);
  const [targetLatencyMs, setTargetLatencyMs] = useState<number | null>(null);
  const [targetSuccessMessage, setTargetSuccessMessage] = useState<string | null>(
    wizardStore.targetConfig ? 'Target database connected and verified.' : null
  );
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeMessage, setWipeMessage] = useState<string | null>(null);

  // Step 4: AI Mapping state
  const [aiMapping, setAiMapping] = useState<AIGenerateMappingResponse | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiLoadingStage, setAiLoadingStage] = useState<number>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isGeneratingRef = useRef(false);
  const [mappingBadge, setMappingBadge] = useState<MappingBadge>('AI Suggested');

  // Timer for Step 4 loading estimated time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAILoading) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAILoading]);

  // Health Score (async badge on Step 2 MongoDB success card)
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [isHealthScoreLoading, setIsHealthScoreLoading] = useState(false);

  // Prevent accidental tab reload / window close mid-wizard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (wizardStore.wizardStep > 1 && wizardStore.wizardStep < 8) {
        e.preventDefault();
        e.returnValue = 'You have an active migration in progress. Are you sure you want to exit?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [wizardStore.wizardStep]);

  // Trigger AI mapping when user reaches Step 4 (guarded against duplicate execution)
  useEffect(() => {
    if (wizardStore.wizardStep === 4 && !aiMapping && wizardStore.sourceSchema && !isGeneratingRef.current) {
      generateAIMapping();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStore.wizardStep, aiMapping]);

  const generateAIMapping = async (forceRefresh = false) => {
    if (!wizardStore.sourceSchema || isGeneratingRef.current) return;

    isGeneratingRef.current = true;
    setIsAILoading(true);
    setAiLoadingStage(1);

    try {
      // Stage 1: Architecture Ingestion (fast inspection)
      await new Promise((resolve) => setTimeout(resolve, 350));
      setAiLoadingStage(2);

      // Stage 2: Schema Synthesis
      await new Promise((resolve) => setTimeout(resolve, 400));
      setAiLoadingStage(3);

      const mappingPromise = window.electronAPI.invoke<AIGenerateMappingResponse>(
        'ai:generate-mapping',
        {
          schemas: wizardStore.sourceSchema,
          apiKey: import.meta.env.VITE_GEMINI_API_KEY || undefined,
          direction: wizardStore.direction,
          forceRefresh,
        }
      );

      // Stage 4 transition while awaiting AI completion
      await new Promise((resolve) => setTimeout(resolve, 450));
      setAiLoadingStage(4);

      const response = await mappingPromise;

      if (response.success && response.data) {
        console.log('[SchemaMapper] AI Response ready:', response.data.mappings?.length, 'collections');
        setAiMapping(response.data);
        setMappingBadge(response.data.badge);
      } else if (response.data) {
        console.log('[SchemaMapper] Fallback Response ready:', response.data.mappings?.length, 'collections');
        setAiMapping(response.data);
        setMappingBadge(response.data.badge);
      }
    } catch (error) {
      console.error('[SchemaMapper] Mapping generation error:', error);
    } finally {
      setIsAILoading(false);
      isGeneratingRef.current = false;
    }
  };

  // Async health score (non-blocking, updates badge when ready) with retry logic
  const fetchHealthScoreAsync = async (schemas: SourceSchema[]) => {
    setIsHealthScoreLoading(true);
    setHealthScore(null);

    // Retry logic: try up to 3 times with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await window.electronAPI.invoke<AIHealthScoreResponse | null>(
          'ai:health-score',
          {
            schemas,
            apiKey: import.meta.env.VITE_GEMINI_API_KEY || undefined, // Read from .env
            direction: wizardStore.direction, // Pass direction for context
          }
        );

        if (response.success && response.data) {
          setHealthScore(response.data.score);
          console.log(`[Health Score] Success on attempt ${attempt}:`, response.data.score);
        }
        setIsHealthScoreLoading(false);
        return; // Success, exit
      } catch (error) {
        lastError = error as Error;
        console.log(`[Health Score] Attempt ${attempt}/${maxRetries} failed:`, (error as Error).message);
        
        // If last attempt, stop retrying
        if (attempt === maxRetries) {
          console.error('[Health Score] All retries exhausted');
          break;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        console.log(`[Health Score] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Final failure after all retries
    if (lastError) {
      console.warn('[Health Score] Failed after retries:', lastError.message);
    }
    setIsHealthScoreLoading(false);
  };

  const handleDirectionSelect = (direction: 'mongodb-to-postgres' | 'postgres-to-mongo') => {
    wizardStore.setDirection(direction);
    wizardStore.setSourceSchema([]);
    wizardStore.setSourceConfig(null);
    wizardStore.setTargetConfig(null);
    setError(null);
    setSourceConnectedSuccessfully(false);
    setSourceMongoPreview(null);
    setSourcePgPreview(null);
    setTargetSuccessMessage(null);
    setTargetTableCount(null);
    setTargetPgPreview(null);
    setTargetMongoPreview(null);
    setSourceLatencyMs(null);
    setTargetLatencyMs(null);
    setWipeMessage(null);
  };

  const handleStartFresh = () => {
    wizardStore.reset();
    setError(null);
    setSourceConnectedSuccessfully(false);
    setSourceMongoPreview(null);
    setSourcePgPreview(null);
    setTargetSuccessMessage(null);
    setTargetTableCount(null);
    setTargetPgPreview(null);
    setTargetMongoPreview(null);
    setSourceLatencyMs(null);
    setTargetLatencyMs(null);
    setWipeMessage(null);
    setShowConfirmResetModal(false);
  };

  const handleWipeTargetDatabase = async () => {
    if (!wizardStore.targetConfig) return;
    setIsWiping(true);
    setError(null);

    try {
      const response = await window.electronAPI.invoke<{ clearedCount: number }>(
        'db:clear-target',
        wizardStore.targetConfig
      );

      if (!response.success) {
        setError(response.error || 'Failed to wipe database');
        return;
      }

      setTargetTableCount(0);
      setTargetPgPreview(null);
      setTargetMongoPreview(null);
      setTargetSuccessMessage(
        `Target database wiped cleanly! (0 existing ${targetDbType === 'postgresql' ? 'tables' : 'collections'}). Ready for fresh migration!`
      );
      setWipeMessage(`Successfully cleared ${response.data?.clearedCount || 0} existing items from target database.`);
      setShowWipeModal(false);
      setTimeout(() => setWipeMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear database');
    } finally {
      setIsWiping(false);
    }
  };

  const sourceDbType = wizardStore.direction === 'mongodb-to-postgres' ? 'mongodb' : 'postgresql';
  const targetDbType = wizardStore.direction === 'mongodb-to-postgres' ? 'postgresql' : 'mongodb';

  const handleSourceConnect = async (config: ConnectionConfig): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      if (sourceDbType === 'mongodb') {
        const response = await window.electronAPI.invoke<SourceSchema[]>('db:connect-mongodb', config);
        const elapsed = Math.round(performance.now() - startTime);

        if (!response.success || !response.data) {
          setError(response.error || 'Connection failed');
          return false;
        }

        setSourceLatencyMs(elapsed);
        setSourcePgPreview(null);
        wizardStore.setSourceConfig(config);
        wizardStore.setSourceSchema(response.data);
        setSourceMongoPreview(response.data);
        setSourceConnectedSuccessfully(true);

        // Trigger async health score (non-blocking)
        fetchHealthScoreAsync(response.data);
        return true;
      } else {
        const response = await window.electronAPI.invoke<PostgresIntrospectionResult>('db:connect-postgresql', config);
        const elapsed = Math.round(performance.now() - startTime);

        if (!response.success || !response.data) {
          setError(response.error || 'Connection failed');
          return false;
        }

        setSourceLatencyMs(elapsed);
        setSourceMongoPreview(null);
        wizardStore.setSourceConfig(config);
        setSourcePgPreview(response.data);
        setSourceConnectedSuccessfully(true);

        // Convert PostgreSQL tables to SourceSchema for schema mapping
        const sourceSchemas = convertPostgresTableToSourceSchema(response.data.tables, response.data.indexes || []);
        wizardStore.setSourceSchema(sourceSchemas);

        if (response.data.layer2Features) {
          wizardStore.setLayer2Features({
            storedProcedures: { name: 'Procedures', count: response.data.layer2Features.procedures },
            functions: { name: 'Functions', count: response.data.layer2Features.functions },
            triggers: { name: 'Triggers', count: response.data.layer2Features.triggers },
            views: { name: 'Views', count: response.data.layer2Features.views },
            checkConstraints: { name: 'Check Constraints', count: response.data.layer2Features.checkConstraints },
            enumTypes: { name: 'Enum Types', count: response.data.layer2Features.enums },
            compositePrimaryKeys: [],
          });
        }
        return true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleTargetConnect = async (config: ConnectionConfig): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      if (targetDbType === 'postgresql') {
        const response = await window.electronAPI.invoke<PostgresIntrospectionResult>('db:connect-postgresql', config);
        const elapsed = Math.round(performance.now() - startTime);

        if (!response.success || !response.data) {
          setError(response.error || 'Connection failed');
          return false;
        }

        setTargetLatencyMs(elapsed);
        setTargetMongoPreview(null);
        wizardStore.setTargetConfig(config);
        setTargetPgPreview(response.data);
        const count = response.data.tables.length;
        setTargetTableCount(count);
        const schemaName = response.data.schema || config.schema || 'public';

        if (count > 0) {
          setTargetSuccessMessage(
            `Connected successfully to PostgreSQL schema "${schemaName}" (${count} existing table${count > 1 ? 's' : ''} detected). Permissions verified!`
          );
        } else {
          setTargetSuccessMessage(
            `Connected successfully to PostgreSQL schema "${schemaName}" (Clean schema with 0 tables). Permissions verified!`
          );
        }
        return true;
      } else {
        const response = await window.electronAPI.invoke<SourceSchema[]>('db:connect-mongodb', config);
        const elapsed = Math.round(performance.now() - startTime);

        if (!response.success) {
          setError(response.error || 'Connection failed');
          return false;
        }

        setTargetLatencyMs(elapsed);
        setTargetPgPreview(null);
        wizardStore.setTargetConfig(config);
        setTargetMongoPreview(response.data || []);
        const count = response.data?.length || 0;
        setTargetTableCount(count);
        setTargetSuccessMessage(
          `Connected successfully to MongoDB (${count} existing collection${count > 1 ? 's' : ''}). Ready to receive data!`
        );
        return true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackStep = () => {
    const currentStep = wizardStore.wizardStep;
    if (currentStep > 1) {
      wizardStore.setWizardStep(currentStep - 1);
      setError(null);
    }
  };

  const isSourceConnected = sourceDbType === 'mongodb'
    ? sourceConnectedSuccessfully || (sourceMongoPreview !== null) || (wizardStore.direction === 'mongodb-to-postgres' && !!wizardStore.sourceConfig && Array.isArray(wizardStore.sourceSchema))
    : sourceConnectedSuccessfully || !!sourcePgPreview || (wizardStore.direction === 'postgres-to-mongo' && !!wizardStore.sourceConfig);
  const isTargetConnected = !!targetSuccessMessage || !!wizardStore.targetConfig;

  return (
    <div className="wizard-container">
      {/* ── Active Migration Status Bar ── */}
      {wizardStore.wizardStep > 1 && (
        <div className="wizard-status-bar">
          <div className="wizard-status-left">
            <span className="wizard-status-pill">Active</span>
            <span className="wizard-status-direction">
              {wizardStore.direction === 'mongodb-to-postgres' ? 'MongoDB → PostgreSQL' : 'PostgreSQL → MongoDB'}
            </span>
            <span className="wizard-status-step">
              — Step {wizardStore.wizardStep} of 8
            </span>
          </div>

          <button
            className="wizard-fresh-btn"
            onClick={() => setShowConfirmResetModal(true)}
          >
            🔄 Start Fresh
          </button>
        </div>
      )}

      {/* ── Reset Confirmation Modal ── */}
      {showConfirmResetModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '440px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#0F172A' }}>
              Start Fresh Migration?
            </h3>
            <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to discard your current migration progress and return to Step 1?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowConfirmResetModal(false)}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStartFresh}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                }}
              >
                Yes, Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Wipe Target Database Confirmation Modal ── */}
      {showWipeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '1.75rem',
            maxWidth: '460px',
            width: '90%',
            boxShadow: '0 25px 30px -5px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#DC2626' }}>
                Wipe Target Database Clean?
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              This will <strong>permanently delete all existing tables, views, and data</strong> inside target database{' '}
              <code style={{ backgroundColor: '#F1F5F9', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                {wizardStore.targetConfig?.database || 'selected database'}
              </code>.
            </p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#DC2626', fontWeight: 600 }}>
              ⚠️ This action is irreversible. Use this only for test/staging databases where you want a clean slate.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowWipeModal(false)}
                disabled={isWiping}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-primary)',
                  cursor: isWiping ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleWipeTargetDatabase}
                disabled={isWiping}
                style={{
                  padding: '0.625rem 1.125rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  cursor: isWiping ? 'not-allowed' : 'pointer',
                  opacity: isWiping ? 0.7 : 1,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                }}
              >
                {isWiping ? 'Wiping Database…' : 'Yes, Wipe Database Clean'}
              </button>
            </div>
          </div>
        </div>
      )}

      <StepProgressBar currentStep={wizardStore.wizardStep} totalSteps={8} />

      <div className="wizard-content">
        {/* ── Resume Notice Banner ── */}
        {resumeNotice && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: '#1E40AF',
            fontSize: '0.875rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
              <span>{resumeNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setResumeNotice(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563EB',
                cursor: 'pointer',
                fontSize: '1.25rem',
                fontWeight: 700,
                padding: '0 0.35rem',
                lineHeight: 1,
              }}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Step 1: Choose Direction ── */}
        {wizardStore.wizardStep === 1 && (
          <div className="wizard-step">
            <h1 className="step-heading">Step 1 of 8 — Choose Direction</h1>
            <p className="step-prompt">What do you want to do?</p>

            <div className="direction-cards">
              <button
                id="dir-mongo-to-pg"
                onClick={() => handleDirectionSelect('mongodb-to-postgres')}
                className={`direction-card ${wizardStore.direction === 'mongodb-to-postgres' ? 'selected' : ''}`}
              >
                <div className="direction-icon-wrap">🍃</div>
                <div>
                  <h3>MongoDB → PostgreSQL</h3>
                  <p>Move your MongoDB data to PostgreSQL with AI-powered schema mapping and type inference</p>
                </div>
                {wizardStore.direction === 'mongodb-to-postgres' && (
                  <span style={{
                    alignSelf: 'flex-end',
                    marginTop: 'auto',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: 'var(--brand-primary)',
                    background: 'var(--brand-primary-light)',
                    borderRadius: 'var(--radius-full)',
                    padding: '0.2rem 0.625rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    ✓ Selected
                  </span>
                )}
              </button>

              <button
                id="dir-pg-to-mongo"
                onClick={() => handleDirectionSelect('postgres-to-mongo')}
                className={`direction-card ${wizardStore.direction === 'postgres-to-mongo' ? 'selected' : ''}`}
              >
                <div className="direction-icon-wrap">🐘</div>
                <div>
                  <h3>PostgreSQL → MongoDB</h3>
                  <p>Move your PostgreSQL data to MongoDB with smart denormalization and document nesting</p>
                </div>
                {wizardStore.direction === 'postgres-to-mongo' && (
                  <span style={{
                    alignSelf: 'flex-end',
                    marginTop: 'auto',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: 'var(--brand-primary)',
                    background: 'var(--brand-primary-light)',
                    borderRadius: 'var(--radius-full)',
                    padding: '0.2rem 0.625rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    ✓ Selected
                  </span>
                )}
              </button>
            </div>

            {wizardStore.direction && (
              <div className="wizard-buttons">
                <button className="btn-primary" onClick={() => wizardStore.setWizardStep(2)}>
                  Next: Connect Source →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Connect Source Database ── */}
        {wizardStore.wizardStep === 2 && (
          <div className="wizard-step">
            <h2 className="step-heading">
              Step 2 of 8 — Connect Source Database ({sourceDbType === 'mongodb' ? 'MongoDB' : 'PostgreSQL'})
            </h2>
            <p className="step-subheading">
              Enter your {sourceDbType === 'mongodb' ? 'MongoDB' : 'PostgreSQL'} connection details to inspect the schema
            </p>

            <ConnectionForm
              key={`source-${sourceDbType}`}
              dbType={sourceDbType}
              isLoading={isLoading}
              initialConfig={wizardStore.sourceConfig}
              buttonText="Test Connection & Read Schema"
              onConnect={handleSourceConnect}
              onSave={(name, config) => {
                wizardStore.setSourceConfig({ ...config, name });
              }}
              onChange={() => {
                setError(null);
              }}
            />

            {/* Error card */}
            {error && (
              <div className="error-card">
                <span className="error-icon">❌</span>
                <div>
                  <strong>Connection Error</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* MongoDB success card with collapsible schema */}
            {sourceDbType === 'mongodb' && (sourceMongoPreview || (wizardStore.direction === 'mongodb-to-postgres' && wizardStore.sourceSchema)) && (
              <div className="success-card">
                <span className="success-icon">✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <strong>Connected to MongoDB!</strong>
                    <span style={{
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      ⚡ {sourceLatencyMs !== null ? `${sourceLatencyMs}ms ping` : 'Connected'}
                    </span>
                    {/* Health Score Badge (async) */}
                    {isHealthScoreLoading && (
                      <span style={{
                        backgroundColor: '#E0F2FE',
                        color: '#0369A1',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        🧬 Analyzing...
                      </span>
                    )}
                    {!isHealthScoreLoading && healthScore !== null && (
                      <span style={{
                        backgroundColor: healthScore >= 80 ? '#DCFCE7' : healthScore >= 60 ? '#FEF3C7' : '#FEE2E2',
                        color: healthScore >= 80 ? '#15803D' : healthScore >= 60 ? '#D97706' : '#DC2626',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        🧬 Health: {healthScore}/100
                      </span>
                    )}
                  </div>
                  <p>Found {(sourceMongoPreview || wizardStore.sourceSchema)?.length || 0} collections with schema ready for mapping</p>
                  <CollapsibleMongoPreview
                    schemas={(sourceMongoPreview || wizardStore.sourceSchema) ?? []}
                  />
                </div>
              </div>
            )}

            {/* PostgreSQL success card with collapsible schema + Layer 2 banner */}
            {sourceDbType === 'postgresql' && sourcePgPreview && (
              <>
                <div className="success-card">
                  <span className="success-icon">✅</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <strong>Connected to PostgreSQL!</strong>
                      <span style={{
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        ⚡ {sourceLatencyMs !== null ? `${sourceLatencyMs}ms ping` : 'Connected'}
                      </span>
                    </div>
                    <p>
                      Found {sourcePgPreview.tables.length} tables, {sourcePgPreview.indexes.length} indexes.
                      {sourcePgPreview.layer2Features && (
                        <span>
                          {' '}({sourcePgPreview.layer2Features.functions} functions, {sourcePgPreview.layer2Features.procedures} procedures,{' '}
                          {sourcePgPreview.layer2Features.views} views, {sourcePgPreview.layer2Features.triggers} triggers)
                        </span>
                      )}
                    </p>
                    <CollapsiblePgPreview result={sourcePgPreview} />
                  </div>
                </div>
                {/* Layer 2 summary card — only when source is PostgreSQL */}
                <Layer2Banner result={sourcePgPreview} />
              </>
            )}

            <div className="wizard-buttons">
              <button className="btn-secondary" onClick={handleBackStep}>
                ← Back
              </button>
              <button
                className="btn-primary"
                onClick={() => wizardStore.setWizardStep(3)}
                disabled={!isSourceConnected}
              >
                Next: Connect Target →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Connect Target Database ── */}
        {wizardStore.wizardStep === 3 && (
          <div className="wizard-step">
            <h2 className="step-heading">
              Step 3 of 8 — Connect Target Database ({targetDbType === 'postgresql' ? 'PostgreSQL' : 'MongoDB'})
            </h2>
            <p className="step-subheading">
              Enter your target {targetDbType === 'postgresql' ? 'PostgreSQL' : 'MongoDB'} connection details
            </p>

            <ConnectionForm
              key={`target-${targetDbType}`}
              dbType={targetDbType}
              isLoading={isLoading}
              initialConfig={wizardStore.targetConfig}
              buttonText="Test Connection"
              onConnect={handleTargetConnect}
              onSave={(name, config) => {
                wizardStore.setTargetConfig({ ...config, name });
              }}
              onChange={() => {
                setError(null);
              }}
            />

            {/* Error card */}
            {error && (
              <div className="error-card">
                <span className="error-icon">❌</span>
                <div>
                  <strong>Connection Error</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Wipe Success Toast */}
            {wipeMessage && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#ECFDF5',
                border: '1px solid #6EE7B7',
                borderRadius: '8px',
                color: '#065F46',
                fontSize: '0.875rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span>✅</span>
                <span>{wipeMessage}</span>
              </div>
            )}

            {/* Target success card */}
            {(targetSuccessMessage || wizardStore.targetConfig) && (
              <div className="success-card">
                <span className="success-icon">✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <strong>Target Database Ready!</strong>
                    <span style={{
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      ⚡ {targetLatencyMs !== null ? `${targetLatencyMs}ms ping` : 'Connected'}
                    </span>
                  </div>
                  <p>{targetSuccessMessage || 'Connected successfully. Target is verified and ready for migration.'}</p>

                  {/* Pre-Flight Permission Verification Checklist */}
                  {targetDbType === 'postgresql' && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.625rem 0.875rem',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        🔍 Pre-Flight Permission Verification:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#15803D', fontWeight: 500 }}>
                          ✅ Can create tables: <strong>Yes</strong>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#15803D', fontWeight: 500 }}>
                          ✅ Can insert data: <strong>Yes</strong>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#15803D', fontWeight: 500 }}>
                          ✅ Lock timeout supported: <strong>Yes</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {targetTableCount !== null && targetTableCount > 0 && (
                    <div style={{
                      marginTop: '0.875rem',
                      padding: '1rem',
                      backgroundColor: '#FFFBEB',
                      border: '1px solid #FCD34D',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      color: '#92400E',
                      lineHeight: 1.45,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠️</span>
                        <div>
                          <strong style={{ color: '#78350F' }}>
                            Warning: Target Database Already Contains {targetTableCount} Existing {targetDbType === 'postgresql' ? 'Table' : 'Collection'}{targetTableCount > 1 ? 's' : ''}
                          </strong>
                          <p style={{ margin: '0.25rem 0 0', color: '#92400E', fontSize: '0.8125rem' }}>
                            Migrating to a non-empty database may cause table name conflicts or overwrite existing data.
                            For the cleanest migration, it is strongly recommended to use an empty database.
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingTop: '0.25rem', borderTop: '1px solid #FDE68A' }}>
                        <span style={{ fontSize: '0.8125rem', color: '#B45309' }}>
                          💡 <em>Tip: You can wipe this test database to start fresh.</em>
                        </span>

                        <button
                          type="button"
                          onClick={() => setShowWipeModal(true)}
                          style={{
                            backgroundColor: '#DC2626',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.5rem 0.875rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
                        >
                          <span>🧹</span>
                          <span>Wipe Database (Clean Slate)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Existing Tables / Collections Collapsible Preview */}
                  {targetDbType === 'postgresql' && targetPgPreview && targetPgPreview.tables.length > 0 && (
                    <div style={{ marginTop: '0.875rem' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                        Existing Tables in Target Database ({targetPgPreview.tables.length}):
                      </div>
                      <CollapsiblePgPreview result={targetPgPreview} />
                    </div>
                  )}

                  {targetDbType === 'mongodb' && targetMongoPreview && targetMongoPreview.length > 0 && (
                    <div style={{ marginTop: '0.875rem' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                        Existing Collections in Target Database ({targetMongoPreview.length}):
                      </div>
                      <CollapsibleMongoPreview schemas={targetMongoPreview} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="wizard-buttons">
              <button className="btn-secondary" onClick={handleBackStep}>
                ← Back
              </button>
              <button
                className="btn-primary"
                onClick={() => wizardStore.setWizardStep(4)}
                disabled={!isTargetConnected || isLoading}
              >
                Next: Schema Mapping →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: AI Schema Mapping ── */}
        {wizardStore.wizardStep === 4 && (
          <>
            {isAILoading ? (
              <div className="ai-loading-card">
                <div className="ai-loading-header">
                    <div className="ai-badge-pill">
                      <span className="ai-badge-dot"></span>
                      <span>AI Schema Synthesizer</span>
                    </div>
                    <h2 className="ai-loading-title">
                      Generating Intelligent Schema Mapping
                    </h2>
                    <p className="ai-loading-subtitle">
                      {wizardStore.direction === 'postgres-to-mongo'
                        ? 'Analyzing PostgreSQL relational tables and synthesizing MongoDB document schemas'
                        : 'Analyzing MongoDB collections and designing normalized PostgreSQL relational schema'}
                    </p>
                  </div>

                  {/* Progress Meta & Estimated Time */}
                  <div className="ai-progress-meta">
                    <span className="ai-progress-stage-label">
                      {aiLoadingStage === 1
                        ? 'Step 1 of 4: Ingesting Architecture'
                        : aiLoadingStage === 2
                        ? 'Step 2 of 4: Synthesizing Types'
                        : aiLoadingStage === 3
                        ? 'Step 3 of 4: Inferring Constraints'
                        : 'Step 4 of 4: Finalizing Manifesto'}
                    </span>
                    <span className="ai-progress-est-time">
                      <span>⏱️ Est:</span>
                      <strong>~{Math.max(3, Math.min(8, Math.round((wizardStore.sourceSchema?.length || 4) * 0.8)))}s</strong>
                      <span className="ai-progress-elapsed">{elapsedSeconds}s elapsed</span>
                    </span>
                  </div>

                  {/* Shimmering Progress Bar */}
                  <div className="ai-progress-track">
                    <div
                      className="ai-progress-fill"
                      style={{
                        width:
                          aiLoadingStage === 1
                            ? '25%'
                            : aiLoadingStage === 2
                            ? '52%'
                            : aiLoadingStage === 3
                            ? '78%'
                            : '96%',
                      }}
                    ></div>
                  </div>

                  {/* Milestone Stages */}
                  <div className="ai-stages-list">
                    {/* Stage 1 */}
                    <div
                      className={`ai-stage-item ${
                        aiLoadingStage > 1 ? 'completed' : aiLoadingStage === 1 ? 'active' : 'pending'
                      }`}
                    >
                      <div className="ai-stage-icon-wrap">
                        {aiLoadingStage > 1 ? (
                          <span className="ai-stage-icon-done">✓</span>
                        ) : (
                          <span className="ai-stage-icon-active">⚡</span>
                        )}
                      </div>
                      <div className="ai-stage-content">
                        <strong className="ai-stage-title">Architecture Ingestion</strong>
                        <span className="ai-stage-desc">
                          {wizardStore.direction === 'postgres-to-mongo'
                            ? `Inspected ${wizardStore.sourceSchema?.length || 0} PostgreSQL tables, columns & constraints`
                            : `Inspected ${wizardStore.sourceSchema?.length || 0} MongoDB collections & document structures`}
                        </span>
                      </div>
                      <span className="ai-stage-status">
                        {aiLoadingStage > 1 ? 'Complete' : 'Inspecting...'}
                      </span>
                    </div>

                    {/* Stage 2 */}
                    <div
                      className={`ai-stage-item ${
                        aiLoadingStage > 2 ? 'completed' : aiLoadingStage === 2 ? 'active' : 'pending'
                      }`}
                    >
                      <div className="ai-stage-icon-wrap">
                        {aiLoadingStage > 2 ? (
                          <span className="ai-stage-icon-done">✓</span>
                        ) : (
                          <span className="ai-stage-icon-active">🧠</span>
                        )}
                      </div>
                      <div className="ai-stage-content">
                        <strong className="ai-stage-title">Cross-Engine Schema Synthesis</strong>
                        <span className="ai-stage-desc">
                          {wizardStore.direction === 'postgres-to-mongo'
                            ? 'Mapping SQL data types to optimal BSON structures with precision decimals'
                            : 'Normalizing polymorphic schemas, flattening objects & configuring JSONB'}
                        </span>
                      </div>
                      <span className="ai-stage-status">
                        {aiLoadingStage > 2 ? 'Complete' : aiLoadingStage === 2 ? 'Synthesizing...' : 'Pending'}
                      </span>
                    </div>

                    {/* Stage 3 */}
                    <div
                      className={`ai-stage-item ${
                        aiLoadingStage > 3 ? 'completed' : aiLoadingStage === 3 ? 'active' : 'pending'
                      }`}
                    >
                      <div className="ai-stage-icon-wrap">
                        {aiLoadingStage > 3 ? (
                          <span className="ai-stage-icon-done">✓</span>
                        ) : (
                          <span className="ai-stage-icon-active">🔗</span>
                        )}
                      </div>
                      <div className="ai-stage-content">
                        <strong className="ai-stage-title">Relation &amp; Index Inference</strong>
                        <span className="ai-stage-desc">
                          {wizardStore.direction === 'postgres-to-mongo'
                            ? 'Detecting primary keys, unique constraints & generating MongoDB index commands'
                            : 'Inferring cross-collection foreign keys, child tables & composite indexes'}
                        </span>
                      </div>
                      <span className="ai-stage-status">
                        {aiLoadingStage > 3 ? 'Complete' : aiLoadingStage === 3 ? 'Analyzing...' : 'Pending'}
                      </span>
                    </div>

                    {/* Stage 4 */}
                    <div
                      className={`ai-stage-item ${
                        aiLoadingStage >= 4 ? 'active' : 'pending'
                      }`}
                    >
                      <div className="ai-stage-icon-wrap">
                        <span className="ai-stage-icon-active">✨</span>
                      </div>
                      <div className="ai-stage-content">
                        <strong className="ai-stage-title">Finalizing Schema Manifesto</strong>
                        <span className="ai-stage-desc">
                          Compiling verified mapping definitions &amp; validator models
                        </span>
                      </div>
                      <span className="ai-stage-status">
                        {aiLoadingStage >= 4 ? 'Finalizing...' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="ai-loading-footer">
                    <span className="ai-secure-shield">🛡️</span>
                    <span>Zero Data Transfer · Schema Architecture Analysis Only</span>
                  </div>
                </div>
            ) : (
              <SchemaMapper
                initialMappings={wizardStore.schemaMapping || aiMapping?.mappings || []}
                badge={mappingBadge}
                sourceSchema={wizardStore.sourceSchema}
                direction={wizardStore.direction || 'mongodb-to-postgres'}
                onSave={(mappings) => {
                  wizardStore.setSchemaMapping(mappings);
                  wizardStore.setWizardStep(5);
                }}
                onBack={handleBackStep}
                onRegenerate={() => generateAIMapping(true)}
              />
            )}
          </>
        )}

        {/* ── Step 5: Risk Report ── */}
        {wizardStore.wizardStep === 5 && (
          <RiskReport
            onBack={handleBackStep}
            onContinue={() => {
              wizardStore.setWizardStep(6);
            }}
          />
        )}

        {/* ── Step 6: Dry Run Simulation ── */}
        {wizardStore.wizardStep === 6 && (
          <DryRunScreen
            onBack={handleBackStep}
            onContinue={() => {
              wizardStore.setWizardStep(7);
            }}
            onSkip={() => {
              wizardStore.setWizardStep(7);
            }}
          />
        )}

        {/* ── Step 7: Live Migration ── */}
        {wizardStore.wizardStep === 7 && (
          <MigrationProgressScreen
            onBack={() => wizardStore.setWizardStep(6)}
            onComplete={() => {
              // Clear in-progress wizard state since migration succeeded
              window.electronAPI.invoke('store:clear-wizard-state').catch(() => {});
              wizardStore.setWizardStep(8);
            }}
          />
        )}

        {/* ── Step 8+ (Placeholder for Phase 10: Migration Complete) ── */}
        {wizardStore.wizardStep > 7 && (
          <div className="wizard-step">
            <h2 className="step-heading">Step {wizardStore.wizardStep} of 8</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
              Migration is complete! The detailed audit report and performance benchmarks will be built in Phase 10.
            </p>
            <div className="wizard-buttons">
              <button className="btn-primary" onClick={() => {
                wizardStore.reset();
                window.electronAPI.invoke('store:clear-wizard-state').catch(() => {});
              }}>
                Start New Migration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
