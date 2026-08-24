import React, { useState, useEffect } from 'react';
import type {
  ConnectionConfig,
  SourceSchema,
  PostgresIntrospectionResult
} from '@migrateiq/shared';
import { useWizardStore } from '../store/wizardStore';
import { StepProgressBar } from '../components/StepProgressBar';
import { ConnectionForm } from '../components/ConnectionForm';
import '../styles/wizard.css';

export interface MigrationWizardProps {}

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
  const wizardStore = useWizardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceMongoPreview, setSourceMongoPreview] = useState<SourceSchema[] | null>(
    wizardStore.sourceSchema
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

  const handleDirectionSelect = (direction: 'mongodb-to-postgres' | 'postgres-to-mongo') => {
    wizardStore.setDirection(direction);
    setError(null);
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

  const handleSourceConnect = async (config: ConnectionConfig) => {
    setIsLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      if (sourceDbType === 'mongodb') {
        const response = await window.electronAPI.invoke<SourceSchema[]>('db:connect-mongodb', config);
        const elapsed = Math.round(performance.now() - startTime);

        if (!response.success || !response.data) {
          setError(response.error || 'Connection failed');
          return;
        }

        setSourceLatencyMs(elapsed);
        wizardStore.setSourceConfig(config);
        wizardStore.setSourceSchema(response.data);
        setSourceMongoPreview(response.data);
      } else {
        const response = await window.electronAPI.invoke<PostgresIntrospectionResult>('db:connect-postgresql', config);
        const elapsed = Math.round(performance.now() - startTime);

        if (!response.success || !response.data) {
          setError(response.error || 'Connection failed');
          return;
        }

        setSourceLatencyMs(elapsed);
        wizardStore.setSourceConfig(config);
        setSourcePgPreview(response.data);

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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTargetConnect = async (config: ConnectionConfig) => {
    setIsLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      if (targetDbType === 'postgresql') {
        const response = await window.electronAPI.invoke<PostgresIntrospectionResult>('db:connect-postgresql', config);
        const elapsed = Math.round(performance.now() - startTime);

        if (!response.success || !response.data) {
          setError(response.error || 'Connection failed');
          return;
        }

        setTargetLatencyMs(elapsed);
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
      } else {
        const response = await window.electronAPI.invoke<SourceSchema[]>('db:connect-mongodb', config);
        const elapsed = Math.round(performance.now() - startTime);

        if (!response.success) {
          setError(response.error || 'Connection failed');
          return;
        }

        setTargetLatencyMs(elapsed);
        wizardStore.setTargetConfig(config);
        setTargetMongoPreview(response.data || []);
        const count = response.data?.length || 0;
        setTargetTableCount(count);
        setTargetSuccessMessage(
          `Connected successfully to MongoDB (${count} existing collection${count > 1 ? 's' : ''}). Ready to receive data!`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
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
    ? !!(sourceMongoPreview && sourceMongoPreview.length > 0) || !!wizardStore.sourceSchema
    : !!sourcePgPreview;
  const isTargetConnected = !!targetSuccessMessage || !!wizardStore.targetConfig;

  return (
    <div className="wizard-container">
      {/* ── Active Migration Controls / Reset Header ── */}
      {wizardStore.wizardStep > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.625rem 1.25rem',
          backgroundColor: '#F1F5F9',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.875rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Active Migration:</span>
            <span>
              {wizardStore.direction === 'mongodb-to-postgres' ? 'MongoDB ➔ PostgreSQL' : 'PostgreSQL ➔ MongoDB'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>(Step {wizardStore.wizardStep} of 8)</span>
          </div>

          <button
            onClick={() => setShowConfirmResetModal(true)}
            style={{
              background: 'none',
              border: '1px solid var(--border-subtle)',
              padding: '0.375rem 0.75rem',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontFamily: 'inherit',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#DC2626';
              e.currentTarget.style.color = '#DC2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            Start Fresh Migration 🔄
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
        {/* ── Step 1: Choose Direction ── */}
        {wizardStore.wizardStep === 1 && (
          <div className="wizard-step">
            <h1 className="step-heading">Step 1 of 8 — Choose Direction</h1>
            <p className="step-prompt">What do you want to do?</p>

            <div className="direction-cards">
              <button
                onClick={() => handleDirectionSelect('mongodb-to-postgres')}
                className={`direction-card ${wizardStore.direction === 'mongodb-to-postgres' ? 'selected' : ''}`}
              >
                <div className="direction-icon">🍃 → 🐘</div>
                <h3>Migrate from MongoDB to PostgreSQL</h3>
                <p>Move your MongoDB data to PostgreSQL with AI-powered schema mapping</p>
              </button>

              <button
                onClick={() => handleDirectionSelect('postgres-to-mongo')}
                className={`direction-card ${wizardStore.direction === 'postgres-to-mongo' ? 'selected' : ''}`}
              >
                <div className="direction-icon">🐘 → 🍃</div>
                <h3>Migrate from PostgreSQL to MongoDB</h3>
                <p>Move your PostgreSQL data to MongoDB with denormalization</p>
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
              dbType={sourceDbType}
              isLoading={isLoading}
              initialConfig={wizardStore.sourceConfig}
              buttonText="Test Connection & Read Schema"
              onConnect={handleSourceConnect}
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
            {(sourceMongoPreview || wizardStore.sourceSchema) && (
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
                  </div>
                  <p>Found {(sourceMongoPreview || wizardStore.sourceSchema)?.length || 0} collections with schema ready for mapping</p>
                  <CollapsibleMongoPreview
                    schemas={(sourceMongoPreview || wizardStore.sourceSchema) ?? []}
                  />
                </div>
              </div>
            )}

            {/* PostgreSQL success card with collapsible schema + Layer 2 banner */}
            {sourcePgPreview && (
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
              dbType={targetDbType}
              isLoading={isLoading}
              initialConfig={wizardStore.targetConfig}
              buttonText="Test Connection"
              onConnect={handleTargetConnect}
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
                  {targetPgPreview && targetPgPreview.tables.length > 0 && (
                    <div style={{ marginTop: '0.875rem' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                        Existing Tables in Target Database ({targetPgPreview.tables.length}):
                      </div>
                      <CollapsiblePgPreview result={targetPgPreview} />
                    </div>
                  )}

                  {targetMongoPreview && targetMongoPreview.length > 0 && (
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

        {/* ── Steps 4+ (Placeholder for future phases) ── */}
        {wizardStore.wizardStep > 3 && (
          <div className="wizard-step">
            <h2 className="step-heading">Step {wizardStore.wizardStep} of 8</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
              This step will be built in future phases (Phase 5+: Schema Mapping, Risk Detection, ETL Migration).
            </p>
            <div className="wizard-buttons">
              <button className="btn-secondary" onClick={handleBackStep}>
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
