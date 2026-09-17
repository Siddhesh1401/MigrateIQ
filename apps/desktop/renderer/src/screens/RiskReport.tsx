import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type {
  RiskItem,
  Layer2FeatureItem,
  RiskAnalysisResult,
} from '@migrateiq/shared';
import { useWizardStore } from '../store/wizardStore';
import '../styles/risk-report.css';

export interface RiskReportProps {
  onBack: () => void;
  onContinue: () => void;
}

// ── Realistic Mock Data for UI Scaffolding ─────────────────────────────────────
const MOCK_RISKS: RiskItem[] = [
  {
    id: 'risk-1',
    severity: 'critical',
    title: 'Array of Objects Cannot Be Stored in a Single Column',
    description:
      'The "orders" collection contains an "items" field which is an array of objects. PostgreSQL does not support storing heterogeneous or relational arrays in a scalar column without normalization or JSONB serialization.',
    suggestedFix:
      'Create a separate "order_items" child table with a foreign key referencing orders(id). An auto-generated sort_order column will preserve document array element positions.',
    autoFixAvailable: true,
    autoFixAction: {
      type: 'create_child_table',
      collectionName: 'orders',
      fieldName: 'items',
      description: 'Create child table "order_items" linked to orders',
    },
    affectedTable: 'orders',
    affectedField: 'items',
  },
  {
    id: 'risk-2',
    severity: 'critical',
    title: 'Strict NOT NULL Constraint with Missing Field Documents',
    description:
      'Column "email" in the target table "users" is marked as NOT NULL, but 45 out of 1,240 sampled documents in the source MongoDB collection either lack this field or contain null values. Proceeding will trigger immediate SQL NOT NULL constraint violations.',
    suggestedFix:
      'Modify the mapping to set the "email" column to allow NULL, or assign a deterministic fallback default value (e.g. "unknown@example.com").',
    autoFixAvailable: true,
    autoFixAction: {
      type: 'set_nullable',
      collectionName: 'users',
      fieldName: 'email',
      description: 'Set email column to Nullable in schema mapping',
    },
    affectedTable: 'users',
    affectedField: 'email',
  },
  {
    id: 'risk-3',
    severity: 'warning',
    title: 'Mixed Data Types Detected in Field "phone"',
    description:
      'Sample introspection identified that 88% of values in "phone" are Strings (e.g. "+1-555-0199") while 12% are stored as Integers (e.g. 5550199). Storing in a strict numeric column will cause cast failures for formatted phone numbers.',
    suggestedFix:
      'Map this column to VARCHAR(30) and apply text normalization so all integer and formatted string phone numbers are safely preserved.',
    autoFixAvailable: false,
    affectedTable: 'users',
    affectedField: 'phone',
  },
  {
    id: 'risk-4',
    severity: 'warning',
    title: 'Large Binary Fields Detected — High Memory Risk',
    description:
      'The "products" collection contains an "image_data" BSON Binary field with an average document size of 240KB. Streaming 500 documents per batch will exceed the 20MB memory ceiling and may spike Electron main process RAM.',
    suggestedFix:
      'Batch size has been automatically reduced from 500 to 50 documents for this collection to maintain stable stream throughput without RAM spikes.',
    autoFixAvailable: true,
    autoFixAction: {
      type: 'reduce_batch_size',
      collectionName: 'products',
      fieldName: 'image_data',
      recommendedValue: 50,
      description: 'Reduce streaming batch size to 50 documents',
    },
    affectedTable: 'products',
    affectedField: 'image_data',
  },
  {
    id: 'risk-5',
    severity: 'info',
    title: 'Nested "address" Object Flattened into Prefixed Columns',
    description:
      'The embedded object "address" has been unnested into relational columns: "address_city", "address_state", and "address_zip". This relational structure is safe and expected, but backend query code should be updated accordingly.',
    suggestedFix:
      'Update application queries to reference address_city and address_zip instead of address.city and address.zip.',
    autoFixAvailable: false,
    affectedTable: 'users',
    affectedField: 'address',
  },
  {
    id: 'risk-6',
    severity: 'info',
    title: 'GIN Index Candidate Identified for Fast Search',
    description:
      'Collection "products" contains a JSONB attributes column. A Generalized Inverted Index (GIN) will be created for accelerated key-value lookups, which may slightly increase initial bulk-load write latency.',
    suggestedFix:
      'The index will be built CONCURRENTLY post-data ingestion to maintain maximum transfer velocity.',
    autoFixAvailable: false,
    affectedTable: 'products',
    affectedField: 'attributes',
  },
];

const MOCK_LAYER2_FEATURES: Layer2FeatureItem[] = [
  {
    id: 'l2-proc-1',
    type: 'procedure',
    name: 'calculate_order_total(order_id INTEGER)',
    signature: 'PROCEDURE calculate_order_total(order_id INT, OUT total NUMERIC)',
    description: 'Calculates the cumulative price for an order, applying regional taxes and active discount coupons.',
    whyNotMigrated: 'MongoDB databases do not support stored procedures. Business algorithms must reside in application services.',
    replacementGuide: 'Move this calculation into your Node.js/TypeScript service layer before routing production traffic.',
    codeSnippet: `// Node.js Service Layer: services/orderService.ts
export async function calculateOrderTotal(orderId: string): Promise<number> {
  const order = await OrderModel.findById(orderId).lean();
  if (!order) throw new Error('Order not found');
  const subtotal = order.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.08;
  return Number((subtotal + tax).toFixed(2));
}`,
  },
  {
    id: 'l2-func-1',
    type: 'function',
    name: 'get_user_full_name(user_id INTEGER)',
    signature: 'FUNCTION get_user_full_name(user_id INT) RETURNS TEXT',
    description: 'Concatenates users.first_name and users.last_name with proper whitespace handling.',
    whyNotMigrated: 'MongoDB functions cannot be declared as native SQL routines.',
    replacementGuide: 'Add a virtual getter property on your Mongoose User schema or use an aggregation pipeline.',
    codeSnippet: `// Mongoose Schema Virtual: models/User.ts
userSchema.virtual('fullName').get(function() {
  return \`\${this.firstName || ''} \${this.lastName || ''}\`.trim();
});`,
  },
  {
    id: 'l2-trig-1',
    type: 'trigger',
    name: 'trigger_update_inventory',
    targetObject: 'orders (AFTER INSERT)',
    signature: 'TRIGGER trigger_update_inventory AFTER INSERT ON orders',
    description: 'When a new order document is created, automatically decrements available stock count in the inventory collection.',
    whyNotMigrated: 'MongoDB does not offer synchronous table triggers without external change stream infrastructure.',
    replacementGuide: 'Implement a Mongoose post-save hook or encapsulate inside a multi-document session transaction.',
    codeSnippet: `// Mongoose Post-Save Hook: models/Order.ts
orderSchema.post('save', async function(doc) {
  for (const item of doc.items) {
    await ProductModel.updateOne(
      { _id: item.productId },
      { $inc: { stockCount: -item.qty } }
    );
  }
});`,
  },
  {
    id: 'l2-view-1',
    type: 'view',
    name: 'view_sales_summary',
    signature: 'VIEW view_sales_summary AS SELECT ... FROM orders JOIN users ...',
    description: 'A pre-joined virtual table combining orders, customers, and order items with order-level aggregations.',
    whyNotMigrated: 'Relational multi-table views with SQL JOINs must be modeled as MongoDB aggregation pipelines.',
    replacementGuide: 'Query using a native MongoDB $lookup aggregation pipeline.',
    codeSnippet: `// Aggregation Pipeline Query:
db.orders.aggregate([
  { $lookup: { from: 'users', localField: 'customerId', foreignField: '_id', as: 'customer' } },
  { $unwind: '$customer' },
  { $group: { _id: '$customerId', totalSpent: { $sum: '$totalAmount' }, orderCount: { $sum: 1 } } }
]);`,
  },
  {
    id: 'l2-enum-1',
    type: 'enum',
    name: 'order_status_enum',
    signature: "ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled')",
    description: 'Restricted enumeration restricting allowed order lifecycle stages.',
    whyNotMigrated: 'MongoDB stores enums as strings; schema validation is enforced in Mongoose or JSON Schema validator.',
    replacementGuide: 'Add string enum validation in your Mongoose model definition.',
    codeSnippet: `// Mongoose Schema Enum Validation:
status: {
  type: String,
  enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
  default: 'pending'
}`,
  },
  {
    id: 'l2-pk-1',
    type: 'composite_pk',
    name: 'user_product_favorites (PK: user_id + product_id)',
    targetObject: 'user_product_favorites',
    signature: 'PRIMARY KEY (user_id, product_id)',
    description: 'PostgreSQL composite primary key spanning two foreign columns.',
    whyNotMigrated: 'MongoDB requires a single scalar or ObjectId "_id" primary key.',
    replacementGuide: 'A unique compound index on { userId: 1, productId: 1 } is automatically applied.',
    codeSnippet: `// Automatically Applied Index:
db.user_product_favorites.createIndex({ userId: 1, productId: 1 }, { unique: true });`,
    isAutoApplied: true,
  },
];

export const RiskReport: React.FC<RiskReportProps> = ({ onBack, onContinue }) => {
  const {
    direction,
    sourceSchema,
    schemaMapping,
    sourceConfig,
    targetConfig,
    riskAnalysis,
    setRiskAnalysis,
    acknowledgedRiskIds,
    acknowledgedLayer2Ids,
    toggleAcknowledgeRisk,
    toggleAcknowledgeLayer2,
    applyAutoFix,
    applyAllAutoFixes,
    acknowledgeAllOfType,
  } = useWizardStore();

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  // Tracks which "What if I ignore this?" panel is open
  const [openImpactId, setOpenImpactId] = useState<string | null>(null);

  // ── Impact Priority Weights (Feature 5: Prioritization Sort) ─────────────
  // data loss first (1) > performance (2) > manual work (3)
  const IMPACT_WEIGHTS: Record<string, number> = {
    create_child_table: 1,   // data loss: arrays silently dropped
    set_nullable: 1,         // data loss: rows rejected on insert
    change_column_type: 1,   // data loss: integer overflow crash
    defer_foreign_keys: 2,   // performance: constraint deferred
    reduce_batch_size: 2,    // performance: slower streaming
    rename_target_table: 2,  // performance: app queries break
    rename_target_column: 2, // performance: app queries break
  };

  /** Returns sort weight for a risk: lower = shown first */
  const getRiskSortWeight = (risk: RiskItem): number => {
    const typeWeight = risk.autoFixAction ? (IMPACT_WEIGHTS[risk.autoFixAction.type] ?? 3) : 3;
    return typeWeight;
  };

  /** Feature 4: Estimated fix time label */
  const getEstimatedFixTime = (risk: RiskItem): string => {
    if (!risk.autoFixAvailable) return '';
    const type = risk.autoFixAction?.type;
    if (type === 'reduce_batch_size') return '< 1 second';
    if (type === 'set_nullable') return '< 1 second';
    if (type === 'change_column_type') return '< 1 second';
    if (type === 'rename_target_table') return '< 1 second';
    if (type === 'rename_target_column') return '< 1 second';
    if (type === 'defer_foreign_keys') return '< 1 second';
    if (type === 'create_child_table') return '~2 seconds';
    return '< 1 second';
  };

  /** Feature 2: "What if I ignore this?" impact text */
  const getIgnoreImpact = (risk: RiskItem): string => {
    const type = risk.autoFixAction?.type;
    if (type === 'create_child_table')
      return `⚠️ Impact: The "${risk.affectedField}" array will be silently dropped or cause a PostgreSQL type mismatch error. Nested object data will be permanently lost for all ${risk.affectedTable} records.`;
    if (type === 'set_nullable')
      return `⚠️ Impact: Every document missing "${risk.affectedField}" will trigger a NOT NULL constraint violation. These rows will be skipped during migration, causing silent data loss.`;
    if (type === 'change_column_type')
      return `⚠️ Impact: Any value exceeding 2,147,483,647 in column "${risk.affectedField}" will crash the PostgreSQL insert with ERROR: integer out of range. Migration halts at that batch.`;
    if (type === 'defer_foreign_keys')
      return `⚠️ Impact: Tables with circular dependencies cannot be created in the right order. Migration will fail immediately with FK constraint violation errors.`;
    if (type === 'reduce_batch_size')
      return `⚠️ Impact: Streaming 500 large binary documents simultaneously can exceed available RAM and crash the Electron process mid-migration. Partial data will be written but uncommitted.`;
    if (type === 'rename_target_table' || type === 'rename_target_column')
      return `⚠️ Impact: Using "${risk.affectedTable || risk.affectedField}" as an unquoted identifier in PostgreSQL SQL will cause syntax errors on every query. Your application will be unable to read or write data.`;
    return `⚠️ Impact: This issue may cause unexpected failures during data transfer. Proceed only if you have validated this case manually.`;
  };

  // Active filter tab
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'warning' | 'info' | 'layer2'>('all');

  // Expanded accordion states
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    'risk-1': true,
    'risk-2': true,
    'l2-proc-1': true,
  });

  // Copied code feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Trigger live IPC analysis
  const runLiveAnalysis = useCallback(async () => {
    if (!schemaMapping || !sourceSchema) return;
    if (typeof window === 'undefined' || !window.electronAPI) return;

    if (isAnalyzing) return; // Prevent concurrent requests
    setIsAnalyzing(true);
    
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await window.electronAPI.invoke<RiskAnalysisResult>('risk:analyze', {
        sourceSchema,
        mapping: schemaMapping,
        direction: direction || 'mongodb-to-postgres',
        sourceConfig,
        targetConfig,
      });

      if (!abortController.signal.aborted && res.success && res.data) {
        setRiskAnalysis(res.data);
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        console.error('Failed to run live risk analysis:', err);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsAnalyzing(false);
      }
    }
  }, [schemaMapping, sourceSchema, direction, sourceConfig, targetConfig, setRiskAnalysis, isAnalyzing]);

  useEffect(() => {
    // Only run if not already analyzed or when mappings/schema exist
    if (!riskAnalysis && schemaMapping && sourceSchema) {
      runLiveAnalysis();
    }
  }, [riskAnalysis, schemaMapping, sourceSchema, runLiveAnalysis]);

  // Active risk items (real analysis takes precedence even if 0 risks found)
  const risks: RiskItem[] = useMemo(() => {
    if (riskAnalysis) {
      return riskAnalysis.risks;
    }
    return MOCK_RISKS;
  }, [riskAnalysis]);

  // Active Layer 2 items (real analysis takes precedence)
  const layer2Features: Layer2FeatureItem[] = useMemo(() => {
    if (riskAnalysis) {
      return riskAnalysis.layer2Features;
    }
    return MOCK_LAYER2_FEATURES;
  }, [riskAnalysis]);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    risks.forEach((r) => (all[r.id] = true));
    layer2Features.forEach((l) => (all[l.id] = true));
    setExpandedCards(all);
  };

  const collapseAll = () => {
    setExpandedCards({});
  };

  const handleCopyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // ── Metrics Calculation ───────────────────────────────────────────────────
  const criticalIssues = risks.filter((r) => r.severity === 'critical');
  const warningIssues = risks.filter((r) => r.severity === 'warning');
  const infoIssues = risks.filter((r) => r.severity === 'info');

  const unacknowledgedCritical = criticalIssues.filter(
    (r) => !r.fixed && !acknowledgedRiskIds.includes(r.id)
  );

  const isContinueDisabled = unacknowledgedCritical.length > 0;

  // Filtered + sorted lists (Feature 5: prioritization sort within each tier)
  const filteredRisks = useMemo(() => {
    let base: RiskItem[];
    if (activeTab === 'critical') base = criticalIssues;
    else if (activeTab === 'warning') base = warningIssues;
    else if (activeTab === 'info') base = infoIssues;
    else if (activeTab === 'layer2') base = [];
    else base = risks;

    // Within each severity tier, sort by impact weight (data loss first)
    return [...base].sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      const sevDiff = (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
      if (sevDiff !== 0) return sevDiff;
      return getRiskSortWeight(a) - getRiskSortWeight(b);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, risks, criticalIssues, warningIssues, infoIssues]);

  // Count of fixable (non-critical, auto-fixable, not yet fixed) warnings — for batch button
  const fixableWarningCount = useMemo(
    () => warningIssues.filter((r) => r.autoFixAvailable && !r.fixed).length,
    [warningIssues]
  );

  // Is PostgreSQL -> MongoDB direction active?
  const isPgToMongo = direction === 'postgres-to-mongo';

  const acknowledgedLayer2Count = layer2Features.filter(
    (f) => f.isAutoApplied || acknowledgedLayer2Ids.includes(f.id)
  ).length;

  return (
    <div className="risk-report-container">
      {/* ── Step Header ── */}
      <div className="risk-header-area">
        <div className="risk-header-title-group">
          <h1>Pre-Migration Risk Report</h1>
          <p className="risk-header-subtitle">
            MigrateIQ scanned your schema mappings, nullability rules, and relationship topologies.
            Review potential bottlenecks before dry run simulation.
          </p>
        </div>

        <div className="risk-stats-chips">
          <span className="risk-stat-chip critical">
            🔴 {criticalIssues.filter((r) => !r.fixed).length} Critical
          </span>
          <span className="risk-stat-chip warning">
            🟡 {warningIssues.filter((r) => !r.fixed).length} Warnings
          </span>
          <span className="risk-stat-chip info">
            ℹ️ {infoIssues.length} Info
          </span>
          {risks.some((r) => r.fixed) && (
            <span className="risk-stat-chip resolved">
              ✓ {risks.filter((r) => r.fixed).length} Auto-Fixed
            </span>
          )}
        </div>
      </div>

      {/* ── Severity Banner ── */}
      {unacknowledgedCritical.length > 0 ? (
        <div className="risk-banner critical">
          <div className="risk-banner-content">
            <span className="risk-banner-icon">⚠️</span>
            <div className="risk-banner-text">
              <span className="risk-banner-title">
                {unacknowledgedCritical.length} Critical Issue
                {unacknowledgedCritical.length > 1 ? 's' : ''} and{' '}
                {warningIssues.length} Warning{warningIssues.length > 1 ? 's' : ''} Found
              </span>
              <span className="risk-banner-desc">
                Critical issues must be auto-fixed or acknowledged before proceeding to the Dry Run simulation.
              </span>
            </div>
          </div>
          <span className="risk-banner-badge">Action Required</span>
        </div>
      ) : warningIssues.length > 0 ? (
        <div className="risk-banner warning">
          <div className="risk-banner-content">
            <span className="risk-banner-icon">🟡</span>
            <div className="risk-banner-text">
              <span className="risk-banner-title">
                No critical blockers. {warningIssues.length} warning
                {warningIssues.length > 1 ? 's' : ''} detected.
              </span>
              <span className="risk-banner-desc">
                Warnings can be auto-fixed or safely ignored if intentional. Your migration is eligible for simulation.
              </span>
            </div>
          </div>
          <span className="risk-banner-badge">Ready for Review</span>
        </div>
      ) : (
        <div className="risk-banner success">
          <div className="risk-banner-content">
            <span className="risk-banner-icon">✅</span>
            <div className="risk-banner-text">
              <span className="risk-banner-title">All clear! No migration risks detected.</span>
              <span className="risk-banner-desc">
                Your schema mapping meets all referential and relational constraints.
              </span>
            </div>
          </div>
          <span className="risk-banner-badge">Safe to Proceed</span>
        </div>
      )}

      {/* ── Filter / Tabs Bar ── */}
      <div className="risk-filter-bar">
        <div className="risk-filter-tabs">
          <button
            type="button"
            className={`risk-filter-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Risks <span className="risk-filter-count">{risks.length}</span>
          </button>
          <button
            type="button"
            className={`risk-filter-btn ${activeTab === 'critical' ? 'active' : ''}`}
            onClick={() => setActiveTab('critical')}
          >
            🔴 Critical <span className="risk-filter-count">{criticalIssues.length}</span>
          </button>
          <button
            type="button"
            className={`risk-filter-btn ${activeTab === 'warning' ? 'active' : ''}`}
            onClick={() => setActiveTab('warning')}
          >
            🟡 Warnings <span className="risk-filter-count">{warningIssues.length}</span>
          </button>
          <button
            type="button"
            className={`risk-filter-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            ℹ️ Info <span className="risk-filter-count">{infoIssues.length}</span>
          </button>
          {isPgToMongo && (
            <button
              type="button"
              className={`risk-filter-btn ${activeTab === 'layer2' ? 'active' : ''}`}
              onClick={() => setActiveTab('layer2')}
            >
              ⚙️ Layer 2 <span className="risk-filter-count">{layer2Features.length}</span>
            </button>
          )}
        </div>

        <div className="risk-expand-controls">
          {/* Feature 1: Auto-Fix All Non-Breaking Warnings batch button */}
          {fixableWarningCount > 0 && (
            <button
              type="button"
              className="btn-autofix-all"
              onClick={applyAllAutoFixes}
              title={`Automatically apply all ${fixableWarningCount} fixable warning resolutions in one click`}
            >
              ⚡ Auto-Fix All Warnings ({fixableWarningCount})
            </button>
          )}
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={runLiveAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Scanning...' : '🔄 Re-scan Risks'}
          </button>
          <button type="button" className="btn-ghost-sm" onClick={expandAll}>
            Expand All
          </button>
          <button type="button" className="btn-ghost-sm" onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      {/* ── Risk Cards List ── */}
      {activeTab !== 'layer2' && (
        <div className="risk-cards-list">
          {filteredRisks.length === 0 ? (
            <div className="risk-empty-state">
              <span className="risk-empty-icon">🛡️</span>
              <h3>No Schema or Relational Blockers</h3>
              <p>
                All mapped tables, columns, and data types passed pre-flight validation. No data loss,
                truncation, or constraint conflicts were detected.
              </p>
            </div>
          ) : (
            filteredRisks.map((risk) => {
              const isAcknowledged = acknowledgedRiskIds.includes(risk.id);
              const isFixed = risk.fixed;
              const isOpen = expandedCards[risk.id] ?? false;

            return (
              <div
                key={risk.id}
                className={`risk-card ${risk.severity} ${
                  isFixed ? 'fixed' : isAcknowledged ? 'acknowledged' : ''
                } ${isOpen ? 'open' : ''}`}
              >
                <div
                  className="risk-card-header"
                  onClick={() => toggleCard(risk.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleCard(risk.id);
                    }
                  }}
                >
                  <div className="risk-card-header-left">
                    <span
                      className={`risk-severity-badge ${
                        isFixed ? 'fixed' : risk.severity
                      }`}
                    >
                      {isFixed ? 'Fixed ✅' : risk.severity}
                    </span>
                    <h3 className="risk-card-title">{risk.title}</h3>
                    {risk.affectedTable && (
                      <span className="risk-target-tag">
                        {risk.affectedTable}
                        {risk.affectedField ? `.${risk.affectedField}` : ''}
                      </span>
                    )}
                    {/* Feature 4: Estimated fix time chip */}
                    {risk.autoFixAvailable && !isFixed && (
                      <span className="risk-fix-time-chip">
                        ⏱️ Auto-fix: {getEstimatedFixTime(risk)}
                      </span>
                    )}
                  </div>

                  <div className="risk-card-header-right">
                    {risk.severity === 'critical' && !isFixed && (
                      <span
                        className={`risk-ack-pill ${
                          isAcknowledged ? 'acknowledged' : 'pending'
                        }`}
                      >
                        {isAcknowledged ? '✓ Acknowledged' : '⚠️ Action Needed'}
                      </span>
                    )}
                    <span className="risk-card-chevron">▼</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="risk-card-body">
                    <div className="risk-desc-block">
                      <p>{risk.description}</p>
                    </div>

                    {risk.suggestedFix && (
                      <div className="risk-suggested-fix-box">
                        <span className="risk-suggested-fix-label">Suggested Resolution</span>
                        <span className="risk-suggested-fix-text">{risk.suggestedFix}</span>
                      </div>
                    )}

                    {/* Feature 2: "What if I ignore this?" impact simulator */}
                    {!isFixed && (
                      <div className="risk-ignore-impact-row">
                        <button
                          type="button"
                          className="btn-what-if"
                          onClick={() =>
                            setOpenImpactId(openImpactId === risk.id ? null : risk.id)
                          }
                        >
                          {openImpactId === risk.id ? '▲ Hide Impact' : '▼ What if I ignore this?'}
                        </button>
                        {openImpactId === risk.id && (
                          <div className="risk-ignore-impact-panel">
                            {getIgnoreImpact(risk)}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="risk-card-actions">
                      <div className="risk-card-actions-left">
                        {isFixed ? (
                          <span className="risk-fixed-badge">
                            ✓ Fix applied to schema mapping
                          </span>
                        ) : (
                          <>
                            {risk.autoFixAvailable && risk.autoFixAction && (
                              <button
                                type="button"
                                className="btn-risk-autofix"
                                onClick={() => applyAutoFix(risk.autoFixAction!)}
                              >
                                ⚡ Auto-Fix: {risk.autoFixAction.description}
                              </button>
                            )}

                            {risk.severity === 'critical' && (
                              <button
                                type="button"
                                className={`btn-risk-ack ${
                                  isAcknowledged ? 'acknowledged' : ''
                                }`}
                                onClick={() => toggleAcknowledgeRisk(risk.id)}
                              >
                                {isAcknowledged
                                  ? '✓ Marked as Acknowledged'
                                  : 'Mark as Acknowledged'}
                              </button>
                            )}

                            {risk.severity === 'warning' && (
                              <button
                                type="button"
                                className={`btn-risk-ack ${
                                  isAcknowledged ? 'acknowledged' : ''
                                }`}
                                onClick={() => toggleAcknowledgeRisk(risk.id)}
                              >
                                {isAcknowledged ? '✓ Ignored' : 'Ignore Warning'}
                              </button>
                            )}

                            {/* Feature 3: Ignore All of This Type button */}
                            {risk.severity === 'warning' && !isAcknowledged && risk.autoFixAction && (
                              (() => {
                                const sameTypeCount = warningIssues.filter(
                                  (r) =>
                                    r.autoFixAction?.type === risk.autoFixAction!.type &&
                                    !r.fixed &&
                                    !acknowledgedRiskIds.includes(r.id) &&
                                    r.id !== risk.id
                                ).length;
                                return sameTypeCount >= 1 ? (
                                  <button
                                    type="button"
                                    className="btn-ignore-all-type"
                                    onClick={() => acknowledgeAllOfType(risk.autoFixAction!.type)}
                                    title={`Ignore all ${sameTypeCount + 1} warnings of this type at once`}
                                  >
                                    Ignore All {sameTypeCount + 1} of This Type
                                  </button>
                                ) : null;
                              })()
                            )}
                          </>
                        )}
                      </div>

                      <div className="risk-card-actions-right">
                        <button
                          type="button"
                          className="btn-risk-fix-mapping"
                          onClick={onBack}
                        >
                          ← Go Back to Fix in Mapping
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }))}
        </div>
      )}

      {/* ==========================================================================
          LAYER 2 SECTION (PostgreSQL -> MongoDB migrations)
          ========================================================================== */}
      {(isPgToMongo || activeTab === 'layer2') && (
        <div className="layer2-section">
          <div className="layer2-divider" />

          <div className="layer2-header">
            <div className="layer2-title-group">
              <h2>
                <span>⚙️ LAYER 2 — APPLICATION LOGIC FEATURES</span>
                <span className="layer2-manual-badge">Manual Action Required</span>
              </h2>
              <p className="layer2-subtitle">
                PostgreSQL stored routines, triggers, and views cannot be executed natively inside MongoDB.
                Follow the drop-in replacement guides below for your Node.js/Mongoose service layer.
              </p>
            </div>
          </div>

          {/* Principle Box */}
          <div className="layer2-principle-box">
            <span className="layer2-principle-icon">💡</span>
            <div className="layer2-principle-content">
              <span className="layer2-principle-title">
                CRITICAL PRINCIPLE — Why Your Existing Data Transfers 100% Safely
              </span>
              <ul className="layer2-principle-bullets">
                <li>
                  <strong>Historical Data is Already Correct:</strong> When PostgreSQL ran in production,
                  every trigger fired, every procedure ran, and every function executed. The <em>results</em> are
                  already stored as plain records in your tables. Reading and copying this data during migration is
                  100% safe and causes zero corruption.
                </li>
                <li>
                  <strong>The Only Risk is Future Writes:</strong> After production cutover, new incoming writes
                  to MongoDB won't execute database triggers unless you implement the Mongoose hooks/Node.js service
                  functions from this guide before switching live production traffic.
                </li>
              </ul>
            </div>
          </div>

          {/* Layer 2 Cards */}
          <div className="layer2-cards-list">
            {layer2Features.map((feat, index) => {
              const isAcknowledged =
                feat.isAutoApplied || acknowledgedLayer2Ids.includes(feat.id);
              const isOpen = expandedCards[feat.id] ?? false;
              const uniqueKey = `layer2-${feat.type}-${feat.name}-${index}`;
              
              return (
                <div
                  key={uniqueKey}
                  className={`layer2-card ${feat.isAutoApplied ? 'auto-applied' : ''} ${
                    isAcknowledged ? 'acknowledged' : ''
                  }`}
                >
                  <div
                    className="layer2-card-header"
                    onClick={() => toggleCard(feat.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCard(feat.id);
                      }
                    }}
                  >
                    <div className="layer2-card-header-left">
                      <span className="layer2-type-icon">
                        {feat.type === 'procedure'
                          ? '⚙️'
                          : feat.type === 'trigger'
                          ? '⚡'
                          : feat.type === 'view'
                          ? '👁️'
                          : feat.type === 'composite_pk'
                          ? '🔑'
                          : '🏷️'}
                      </span>
                      <span className="layer2-type-tag">
                        {feat.type.replace('_', ' ')}
                      </span>
                      <span className="layer2-item-name">{feat.name}</span>
                    </div>

                    <div className="risk-card-header-right">
                      {feat.isAutoApplied ? (
                        <span className="risk-fixed-badge">Auto-Applied ✅</span>
                      ) : (
                        <span
                          className={`risk-ack-pill ${
                            isAcknowledged ? 'acknowledged' : 'pending'
                          }`}
                        >
                          {isAcknowledged ? '✓ Understood' : 'Needs Review'}
                        </span>
                      )}
                      <span className="risk-card-chevron">▼</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="layer2-card-body">
                      <div className="layer2-field-row">
                        <strong>What it does:</strong>
                        <span>{feat.description}</span>
                      </div>

                      <div className="layer2-field-row">
                        <strong>Why it cannot be auto-migrated:</strong>
                        <span>{feat.whyNotMigrated}</span>
                      </div>

                      <div className="layer2-field-row">
                        <strong>What to do:</strong>
                        <span>{feat.replacementGuide}</span>
                      </div>

                      <div className="layer2-code-box">
                        <button
                          type="button"
                          className="btn-code-copy"
                          onClick={() => handleCopyCode(feat.id, feat.codeSnippet)}
                        >
                          {copiedId === feat.id ? 'Copied! ✓' : 'Copy Code'}
                        </button>
                        <pre>
                          <code>{feat.codeSnippet}</code>
                        </pre>
                      </div>

                      {!feat.isAutoApplied && (
                        <div className="layer2-card-actions">
                          <button
                            type="button"
                            className={`btn-risk-ack ${
                              isAcknowledged ? 'acknowledged' : ''
                            }`}
                            onClick={() => toggleAcknowledgeLayer2(feat.id)}
                          >
                            {isAcknowledged
                              ? '✓ Marked as Understood'
                              : 'Mark as Understood'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Layer 2 Counter Bar */}
          <div className="layer2-counter-bar">
            <span className="layer2-counter-text">
              <strong>{acknowledgedLayer2Count}</strong> of{' '}
              <strong>{layer2Features.length}</strong> application features acknowledged
            </span>
            <span className="layer2-counter-hint">
              💡 These are manual checklist actions and do not block continuing to Dry Run. A complete Layer 2 Migration Guide with all the above instructions will be included in your downloadable Refactoring Kit.
            </span>
          </div>
        </div>
      )}

      {/* ── Wizard Sticky Footer Actions ── */}
      <div className="risk-footer-bar">
        <div className="risk-footer-left">
          <button type="button" className="btn-risk-back" onClick={onBack}>
            ← Go Back to Mapping
          </button>
        </div>

        <div className="risk-footer-right">
          {isContinueDisabled && (
            <span className="risk-disabled-tooltip">
              ⚠️ Acknowledge or auto-fix {unacknowledgedCritical.length} critical issue
              {unacknowledgedCritical.length > 1 ? 's' : ''} to proceed
            </span>
          )}

          <button
            type="button"
            className="btn-risk-continue"
            disabled={isContinueDisabled}
            onClick={onContinue}
          >
            I've Reviewed All Issues — Continue to Dry Run →
          </button>
        </div>
      </div>
    </div>
  );
};
