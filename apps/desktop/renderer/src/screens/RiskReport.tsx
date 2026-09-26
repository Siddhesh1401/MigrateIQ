import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type {
  RiskItem,
  Layer2FeatureItem,
  RiskAnalysisResult,
  RiskInteractiveOption,
  CollectionMapping,
  AutoFixAction,
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
    category: 'relational',
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
    decisionTier: 'decision',
    actionCategory: 'schema_choice',
    inputType: 'radio',
    sampleOffendingValues: [
      { docId: '65b1c900e1234a001', value: [{ sku: 'PROD-1', qty: 2 }, { sku: 'PROD-9', qty: 1 }], label: 'Array length: 2' },
      { docId: '65b1c900e1234a002', value: [{ sku: 'PROD-3', qty: 5 }], label: 'Array length: 1' },
    ],
    transformationPreview: {
      before: 'db.orders.insertOne({ _id: "ORD-1", items: [{ sku: "A", qty: 2 }, { sku: "B", qty: 3 }] })',
      after: "INSERT INTO orders (id) VALUES ('ORD-1');\\nINSERT INTO order_items (order_id, sort_order, sku, qty) VALUES ('ORD-1', 0, 'A', 2), ('ORD-1', 1, 'B', 3);",
      explanation: 'Preserves relational integrity and original array element order with auto-generated sort_order.',
    },
    options: [
      {
        label: 'Create Relational Child Table (Recommended)',
        value: 'create_child_table',
        description: 'Creates "orders_items" with foreign key and sort_order.',
        tradeoff: 'Enables indexed SQL joins and referential integrity; requires child table schema.',
        actionType: 'create_child_table',
      },
      {
        label: 'Store as JSONB Column',
        value: 'change_column_type',
        description: 'Preserves the raw array as a JSON document column inside the parent table.',
        tradeoff: 'Preserves exact raw nested document; queries require JSON operators (->>).',
        actionType: 'change_column_type',
      },
    ],
  },
  {
    id: 'risk-2',
    severity: 'critical',
    category: 'data_integrity',
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
    decisionTier: 'decision',
    actionCategory: 'schema_choice',
    inputType: 'radio',
    defaultInputValue: 'unknown@example.com',
    inputPlaceholder: 'Enter fallback default email...',
    sampleOffendingValues: [
      { docId: '64e8a1f29b12a3001', value: null, label: 'Explicit null value' },
      { docId: '64e8a1f29b12a3002', value: 'undefined (field omitted)', label: 'Field missing in document' },
      { docId: '64e8a1f29b12a3045', value: '', label: 'Empty string value' },
    ],
    transformationPreview: {
      before: 'db.users.insertOne({ _id: ObjectId("..."), name: "John Doe" /* email missing */ })',
      after: "INSERT INTO users (id, name, email) VALUES ('64e8...', 'John Doe', NULL);",
      explanation: 'With nullable option, missing fields convert to SQL NULL without aborting ETL.',
    },
    options: [
      {
        label: 'Make Column Nullable (Allow NULL values)',
        value: 'nullable',
        description: 'Allows documents with missing values to be saved with NULL.',
        tradeoff: 'Safely stores missing records; queries must handle NULL checks.',
        actionType: 'set_nullable',
      },
      {
        label: 'Assign Fallback Default Value (Keep NOT NULL)',
        value: 'default_value',
        description: 'Fills missing values with a default value.',
        tradeoff: 'Guarantees column is always populated; injects placeholder strings.',
        actionType: 'set_default_value',
      },
    ],
  },
  {
    id: 'risk-target-table-conflict',
    severity: 'critical',
    category: 'data_integrity',
    title: 'Target Table "users" Already Exists with Existing Records',
    description:
      'The destination PostgreSQL database already contains table "users". You must choose whether to Drop & Recreate (destructive), Truncate, or Append imported records.',
    suggestedFix:
      'Choose "Append" to retain historical data, or explicitly confirm "Drop & Recreate" if rebuilding from scratch.',
    autoFixAvailable: true,
    autoFixAction: {
      type: 'set_table_action',
      collectionName: 'users',
      recommendedValue: 'append',
      description: 'Set table write action to Append',
    },
    affectedTable: 'users',
    decisionTier: 'destructive',
    actionCategory: 'destructive',
    inputType: 'radio',
    existingTableDetails: {
      rowCount: 1250,
      columns: [
        { name: 'id', type: 'text', nullable: false },
        { name: 'email', type: 'varchar(255)', nullable: true },
        { name: 'full_name', type: 'text', nullable: false },
        { name: 'created_at', type: 'timestamptz', nullable: false },
      ],
      missingInTarget: ['company_role', 'preferences'],
      sampleExistingRows: [
        { id: 'usr_001', email: 'alice@corp.internal', full_name: 'Alice Cooper', created_at: '2024-01-15T08:30:00Z' },
        { id: 'usr_002', email: 'bob@corp.internal', full_name: 'Bob Marley', created_at: '2024-02-10T11:45:00Z' },
      ],
    },
    options: [
      {
        label: 'Append to Existing Table (Safe default)',
        value: 'append',
        description: 'Appends imported rows without deleting existing PostgreSQL records.',
        tradeoff: 'Retains all historical data; requires that primary keys do not collide.',
        actionType: 'set_table_action',
      },
      {
        label: 'Truncate Table Before Import',
        value: 'truncate',
        description: 'Clears all rows from target table while preserving schema and indexes.',
        tradeoff: 'Fast clean slate; all existing rows in target table will be permanently deleted.',
        actionType: 'set_table_action',
      },
      {
        label: 'Drop & Recreate Table (Destructive)',
        value: 'drop',
        description: 'Completely drops existing table, constraints, and triggers, then creates fresh table.',
        tradeoff: 'Guarantees 100% clean schema match; permanently deletes existing table and data.',
        actionType: 'set_table_action',
      },
    ],
  },
  {
    id: 'risk-3',
    severity: 'warning',
    category: 'data_integrity',
    title: 'Mixed Data Types Detected in Field "phone"',
    description:
      'Sample introspection identified that 88% of values in "phone" are Strings (e.g. "+1-555-0199") while 12% are stored as Integers (e.g. 5550199). Storing in a strict numeric column will cause cast failures for formatted phone numbers.',
    suggestedFix:
      'Map this column to TEXT or JSONB so all integer and formatted string phone numbers are safely preserved.',
    autoFixAvailable: true,
    autoFixAction: {
      type: 'change_column_type',
      collectionName: 'users',
      fieldName: 'phone',
      recommendedValue: 'TEXT',
      description: 'Map column to TEXT',
    },
    affectedTable: 'users',
    affectedField: 'phone',
    decisionTier: 'decision',
    actionCategory: 'schema_choice',
    inputType: 'select',
    sampleOffendingValues: [
      { docId: '64e8a1f29b12a3010', value: '+1 (800) 555-0199', label: 'String format' },
      { docId: '64e8a1f29b12a3011', value: 9820010013, label: 'Numeric format' },
    ],
    transformationPreview: {
      before: 'phone: 9820010013 (Int64) vs "+1 (800) 555-0199" (String)',
      after: "phone TEXT: '9820010013' and '+1 (800) 555-0199' safely stored",
      explanation: 'Promoting to TEXT avoids Postgres int overflow and format casting errors.',
    },
    options: [
      {
        label: 'Coerce all values to TEXT (Safe string representation)',
        value: 'TEXT',
        tradeoff: 'Preserves both numbers and formatted phone strings; loses numeric sorting.',
      },
      {
        label: 'Preserve as JSONB (Full structural variety)',
        value: 'JSONB',
        tradeoff: 'Preserves exact JSON data types; requires JSON operators for querying.',
      },
    ],
  },
  {
    id: 'risk-varchar-len',
    severity: 'warning',
    category: 'data_integrity',
    title: 'String Length Exceeds Target VARCHAR(50) Column Limit',
    description:
      'Target column "company" is configured as VARCHAR(50), but 12 source records exceed this limit (up to 78 characters). Direct insert will cause "ERROR: value too long for type character varying(50)".',
    suggestedFix: 'Auto-promote target column to TEXT to prevent truncation without data loss.',
    autoFixAvailable: true,
    autoFixAction: {
      type: 'promote_varchar_length',
      collectionName: 'customers',
      fieldName: 'company',
      description: 'Auto-promote company column to TEXT',
    },
    affectedTable: 'customers',
    affectedField: 'company',
    decisionTier: 'safe',
    actionCategory: 'remediation',
    sampleOffendingValues: [
      { docId: '6ab655e7f48be2bf555ec1c3', value: 'Enterprise International Logistics and Freight Solutions Limited', label: 'Length: 68 chars' },
    ],
    transformationPreview: {
      before: 'company: "Enterprise International Logistics and Freight Solutions Limited" (68 chars)',
      after: 'ALTER TABLE customers ALTER COLUMN company TYPE TEXT;',
      explanation: 'Promotes column type to TEXT so no strings are truncated.',
    },
  },
  {
    id: 'risk-missing-fk-idx',
    severity: 'warning',
    category: 'performance',
    title: 'Missing Foreign Key Index on Target Child Table "orders_items"',
    description:
      'PostgreSQL does not automatically index foreign key columns. Deleting or updating parent "orders" records will cause a slow full table scan and table lock on "orders_items".',
    suggestedFix: 'Auto-create an index on foreign key column orders_items(order_id).',
    autoFixAvailable: true,
    autoFixAction: {
      type: 'create_foreign_key_index',
      collectionName: 'orders_items',
      fieldName: 'order_id',
      description: 'Create index on orders_items(order_id)',
    },
    affectedTable: 'orders_items',
    affectedField: 'order_id',
    decisionTier: 'safe',
    actionCategory: 'remediation',
    transformationPreview: {
      before: 'Unindexed FOREIGN KEY (order_id) REFERENCES orders(id)',
      after: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_items_order_id ON orders_items (order_id);',
      explanation: 'Prevents PostgreSQL table locking on parent order updates and deletes.',
    },
  },
  {
    id: 'risk-4',
    severity: 'warning',
    category: 'performance',
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
    decisionTier: 'safe',
    actionCategory: 'safety_strategy',
  },
  {
    id: 'risk-5',
    severity: 'info',
    category: 'schema',
    title: 'Nested "address" Object Flattened into Prefixed Columns',
    description:
      'The embedded object "address" has been unnested into relational columns: "address_city", "address_state", and "address_zip". This relational structure is safe and expected, but backend query code should be updated accordingly.',
    suggestedFix:
      'Update application queries to reference address_city and address_zip instead of address.city and address.zip.',
    autoFixAvailable: false,
    affectedTable: 'users',
    affectedField: 'address',
    decisionTier: 'safe',
    actionCategory: 'schema_choice',
  },
  {
    id: 'risk-6',
    severity: 'info',
    category: 'performance',
    title: 'GIN Index Candidate Identified for Fast Search',
    description:
      'Collection "products" contains a JSONB attributes column. A Generalized Inverted Index (GIN) will be created for accelerated key-value lookups, which may slightly increase initial bulk-load write latency.',
    suggestedFix:
      'The index will be built CONCURRENTLY post-data ingestion to maintain maximum transfer velocity.',
    autoFixAvailable: false,
    affectedTable: 'products',
    affectedField: 'attributes',
    decisionTier: 'safe',
    actionCategory: 'safety_strategy',
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
    applyAutoFix: storeApplyAutoFix,
    applyAllSafeRemediations: storeApplyAllSafeRemediations,
  } = useWizardStore();

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [openImpactId, setOpenImpactId] = useState<string | null>(null);

  // In-Card Interactive States
  const [cardInputValues, setCardInputValues] = useState<Record<string, string>>({});
  const [cardSelectedOptions, setCardSelectedOptions] = useState<Record<string, string>>({});
  const [destructiveConfirmed, setDestructiveConfirmed] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [collapsedCollections, setCollapsedCollections] = useState<Record<string, boolean>>({});
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Impact Priority Weights (Prioritization Sort) ─────────────────────────
  const IMPACT_WEIGHTS: Record<string, number> = {
    create_child_table: 1,
    set_nullable: 1,
    set_default_value: 1,
    change_column_type: 1,
    sanitize_null_bytes: 1,
    resolve_numeric_special: 1,
    resolve_case_collision: 1,
    assign_primary_key: 1,
    resolve_orphan_fk: 1,
    defer_foreign_keys: 2,
    reduce_batch_size: 2,
    rename_target_table: 2,
    rename_target_column: 2,
    sanitize_identifier: 2,
    set_table_action: 2,
    sanitize_sparse_array: 2,
  };

  const getRiskSortWeight = (risk: RiskItem): number => {
    const typeWeight = risk.autoFixAction ? (IMPACT_WEIGHTS[risk.autoFixAction.type] ?? 3) : 3;
    return typeWeight;
  };

  const getEstimatedFixTime = (risk: RiskItem): string => {
    if (!risk.autoFixAvailable) return '';
    const type = risk.autoFixAction?.type;
    if (type === 'create_child_table') return '~2 seconds';
    return '< 1 second';
  };

  const getIgnoreImpact = (risk: RiskItem): string => {
    const type = risk.autoFixAction?.type;
    if (type === 'create_child_table')
      return `⚠️ Impact: The "${risk.affectedField}" array will be silently dropped or cause a PostgreSQL type mismatch error. Nested object data will be permanently lost for all ${risk.affectedTable} records.`;
    if (type === 'set_nullable' || type === 'set_default_value')
      return `⚠️ Impact: Every document missing "${risk.affectedField}" will trigger a NOT NULL constraint violation. These rows will be skipped during migration, causing silent data loss.`;
    if (type === 'change_column_type')
      return `⚠️ Impact: Any value exceeding numeric bounds in column "${risk.affectedField}" will crash PostgreSQL inserts with "ERROR: integer out of range" or type conversion failure.`;
    if (type === 'sanitize_null_bytes')
      return `⚠️ Impact: Raw 0x00 null bytes terminate PostgreSQL internal C-strings. Inserting this field will immediately abort migration with "ERROR: invalid byte sequence for encoding UTF8: 0x00".`;
    if (type === 'resolve_numeric_special')
      return `⚠️ Impact: PostgreSQL NUMERIC strictly rejects Infinity and -Infinity. Any document containing Infinity will crash ETL execution.`;
    if (type === 'resolve_case_collision')
      return `⚠️ Impact: PostgreSQL unquoted columns fold to lowercase. Duplicate column names will prevent table creation.`;
    if (type === 'resolve_orphan_fk')
      return `⚠️ Impact: Child documents referencing missing parent records will fail strict foreign key constraint checks.`;
    if (type === 'defer_foreign_keys')
      return `⚠️ Impact: Tables with circular dependencies cannot be created in sequential order. Migration will fail immediately with FK constraint violation errors.`;
    if (type === 'reduce_batch_size')
      return `⚠️ Impact: Streaming 500 large binary documents simultaneously can exceed available RAM and crash the Electron process mid-migration.`;
    if (type === 'rename_target_table' || type === 'rename_target_column' || type === 'sanitize_identifier')
      return `⚠️ Impact: Using reserved keywords or invalid characters will cause SQL syntax errors on every query.`;
    if (type === 'assign_primary_key')
      return `⚠️ Impact: Tables without primary keys cannot support reliable updates, relational constraints, or replication.`;
    return `⚠️ Impact: This issue may cause unexpected failures during data transfer. Proceed only if you have validated this case manually.`;
  };

  const [activeTab, setActiveTab] = useState<'all' | 'decision' | 'safe' | 'destructive' | 'info' | 'layer2'>('all');

  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    'risk-1': true,
    'risk-2': true,
    'l2-proc-1': true,
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runLiveAnalysis = useCallback(async (customMapping?: CollectionMapping[]) => {
    const mappingToUse = customMapping || schemaMapping;
    if (!mappingToUse || !sourceSchema) return;
    if (typeof window === 'undefined' || !window.electronAPI) return;

    if (isAnalyzing) return;
    setIsAnalyzing(true);
    
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await window.electronAPI.invoke<RiskAnalysisResult>('risk:analyze', {
        sourceSchema,
        mapping: mappingToUse,
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
    if (!riskAnalysis && schemaMapping && sourceSchema) {
      runLiveAnalysis();
    }
  }, [riskAnalysis, schemaMapping, sourceSchema, runLiveAnalysis]);

  const applyAutoFix = useCallback(
    (action: AutoFixAction) => {
      storeApplyAutoFix(action);
      setToastMessage(`✓ Applied fix: ${action.description || action.type}`);
      setTimeout(() => setToastMessage(null), 3000);

      // Auto-rescan / refresh immediately in background with the updated schema mapping
      setTimeout(() => {
        const currentMapping = useWizardStore.getState().schemaMapping;
        if (currentMapping) {
          runLiveAnalysis(currentMapping);
        }
      }, 150);
    },
    [storeApplyAutoFix, runLiveAnalysis]
  );

  const applyAllSafeRemediations = useCallback(() => {
    storeApplyAllSafeRemediations();
    setToastMessage('✓ Applied all safe remediations');
    setTimeout(() => setToastMessage(null), 3000);

    setTimeout(() => {
      const currentMapping = useWizardStore.getState().schemaMapping;
      if (currentMapping) {
        runLiveAnalysis(currentMapping);
      }
    }, 150);
  }, [storeApplyAllSafeRemediations, runLiveAnalysis]);

  const risks: RiskItem[] = useMemo(() => {
    if (riskAnalysis) {
      return riskAnalysis.risks;
    }
    return MOCK_RISKS;
  }, [riskAnalysis]);

  const layer2Features: Layer2FeatureItem[] = useMemo(() => {
    if (riskAnalysis) {
      return riskAnalysis.layer2Features;
    }
    return MOCK_LAYER2_FEATURES;
  }, [riskAnalysis]);

  const toggleCard = (id: string) => {
    setExpandedCards((prev: Record<string, boolean>) => ({
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

  // ── Metrics & Decision Tiers Calculation ──────────────────────────────────
  const criticalIssues = risks.filter((r) => r.severity === 'critical');
  const warningIssues = risks.filter((r) => r.severity === 'warning');
  const infoIssues = risks.filter((r) => r.severity === 'info');

  const decisionRisks = useMemo(() => {
    return risks.filter(
      (r) =>
        r.decisionTier === 'decision' ||
        (!r.decisionTier && r.severity === 'critical' && r.actionCategory !== 'destructive')
    );
  }, [risks]);

  const safeRisks = useMemo(() => {
    return risks.filter(
      (r) =>
        r.decisionTier === 'safe' ||
        (!r.decisionTier && r.autoFixAvailable && r.severity !== 'critical')
    );
  }, [risks]);

  const destructiveRisks = useMemo(() => {
    return risks.filter(
      (r) =>
        r.decisionTier === 'destructive' ||
        r.actionCategory === 'destructive' ||
        r.options?.some((o) => o.value === 'drop')
    );
  }, [risks]);

  const unacknowledgedCritical = criticalIssues.filter(
    (r) => !r.fixed && !acknowledgedRiskIds.includes(r.id)
  );

  const pendingDecisionsCount = useMemo(() => {
    return decisionRisks.filter((r) => !r.fixed && !acknowledgedRiskIds.includes(r.id)).length;
  }, [decisionRisks, acknowledgedRiskIds]);

  const safeFixesReadyCount = useMemo(() => {
    return safeRisks.filter((r) => r.autoFixAvailable && !r.fixed).length;
  }, [safeRisks]);

  const destructiveCount = useMemo(() => {
    return destructiveRisks.filter((r) => !r.fixed).length;
  }, [destructiveRisks]);

  const sampleRecordsProtected = useMemo(() => {
    let total = 0;
    for (const r of risks) {
      if (r.metadata && typeof r.metadata.missingCount === 'number') {
        total += r.metadata.missingCount;
      } else if (r.metadata && typeof r.metadata.sampleCount === 'number') {
        total += r.metadata.sampleCount;
      } else if (r.metadata && typeof r.metadata.rowCount === 'number') {
        total += r.metadata.rowCount;
      } else if (r.id.includes('risk-1') || r.id.includes('array')) {
        total += 50;
      } else if (r.id.includes('risk-2') || r.id.includes('notnull')) {
        total += 45;
      }
    }
    return total > 0 ? total : 0;
  }, [risks]);

  const isContinueDisabled = unacknowledgedCritical.length > 0;

  // ── Pre-Flight Clearance Statuses ─────────────────────────────────────────
  const criticalDataIssues = risks.filter(
    (r) => r.category === 'data_integrity' && r.severity === 'critical' && !r.fixed && !acknowledgedRiskIds.includes(r.id)
  );
  const isDataIntegrityPassed = criticalDataIssues.length === 0;

  const criticalRelationalIssues = risks.filter(
    (r) => r.category === 'relational' && r.severity === 'critical' && !r.fixed && !acknowledgedRiskIds.includes(r.id)
  );
  const isTopologyPassed =
    criticalRelationalIssues.length === 0 &&
    (!riskAnalysis?.metrics?.hasCircularFk || acknowledgedRiskIds.some((id) => id.includes('circular')));

  const criticalSchemaIssues = risks.filter(
    (r) => r.category === 'schema' && r.severity === 'critical' && !r.fixed && !acknowledgedRiskIds.includes(r.id)
  );
  const isSchemaPassed = criticalSchemaIssues.length === 0;

  const criticalPerformanceIssues = risks.filter(
    (r) => r.category === 'performance' && r.severity === 'critical' && !r.fixed && !acknowledgedRiskIds.includes(r.id)
  );
  const isPerformancePassed = criticalPerformanceIssues.length === 0;

  const isPreflightCleared =
    isDataIntegrityPassed && isTopologyPassed && isSchemaPassed && isPerformancePassed && unacknowledgedCritical.length === 0;

  // ── Collection Health Matrix Data ──────────────────────────────────────────
  const collectionHealthList = useMemo(() => {
    if (riskAnalysis?.metrics?.collectionHealth && riskAnalysis.metrics.collectionHealth.length > 0) {
      return riskAnalysis.metrics.collectionHealth;
    }
    const cols = schemaMapping || [];
    return cols.map((c) => {
      const colName = c.collectionName;
      const targetTable = c.targetTableName || colName;
      const sSchema = sourceSchema?.find((s) => s.collectionName === colName);
      const docCount = sSchema?.documentCount || 50;
      const colRisks = risks.filter((r) => r.affectedTable === colName || r.affectedTable === targetTable);
      const crit = colRisks.filter((r) => r.severity === 'critical' && !r.fixed && !acknowledgedRiskIds.includes(r.id)).length;
      const warn = colRisks.filter((r) => r.severity === 'warning' && !r.fixed).length;
      return {
        collectionName: colName,
        targetTableName: targetTable,
        documentCount: docCount,
        avgDocSizeBytes: docCount > 0 ? 450 : 300,
        totalRisks: colRisks.length,
        criticalCount: crit,
        warningCount: warn,
        isReady: crit === 0 && warn === 0,
      };
    });
  }, [riskAnalysis, schemaMapping, sourceSchema, risks, acknowledgedRiskIds]);

  // ── Zero Data Loss Live Calculation ────────────────────────────────────────
  const zeroDataLossStats = useMemo(() => {
    let atRiskCount = 0;
    const atRiskColls = new Set<string>();

    for (const r of risks) {
      if (r.severity === 'critical' && !r.fixed && !acknowledgedRiskIds.includes(r.id)) {
        if (r.affectedTable) atRiskColls.add(r.affectedTable);
        if (r.metadata?.missingCount && typeof r.metadata.missingCount === 'number') {
          atRiskCount += r.metadata.missingCount;
        } else if (r.affectedTable) {
          const s = sourceSchema?.find((sc) => sc.collectionName === r.affectedTable);
          atRiskCount += Math.min(s?.documentCount ?? 15, 15);
        } else {
          atRiskCount += 10;
        }
      }
    }

    const totalDocs = sourceSchema?.reduce((acc, cur) => acc + (cur.documentCount || 0), 0) || 120;
    const isShieldActive = atRiskCount === 0;

    return {
      atRiskCount,
      atRiskCollections: Array.from(atRiskColls),
      totalDocs,
      isShieldActive,
    };
  }, [risks, acknowledgedRiskIds, sourceSchema]);

  // ── Live Memory & Speed Telemetry ──────────────────────────────────────────
  const memoryAndSpeedStats = useMemo(() => {
    const totalDocs = zeroDataLossStats.totalDocs;
    const batchSize = riskAnalysis?.metrics?.recommendedBatchSize || 500;
    const isThrottled = batchSize < 100;
    const estSeconds = Math.max(0.4, Number((totalDocs / 450).toFixed(1)));
    const estimatedRamMb = (12.4 + (batchSize * 0.008)).toFixed(1);

    return {
      totalDocs,
      batchSize,
      isThrottled,
      estSeconds,
      estimatedRamMb,
    };
  }, [zeroDataLossStats.totalDocs, riskAnalysis]);

  // ── Segmented Risk Distribution ────────────────────────────────────────────
  const riskDistribution = useMemo(() => {
    const total = risks.length || 1;
    const fixedOrAck = risks.filter((r) => r.fixed || acknowledgedRiskIds.includes(r.id)).length;
    const safeFixable = risks.filter((r) => r.decisionTier === 'safe' && !r.fixed).length;
    const decision = risks.filter((r) => r.decisionTier === 'decision' && !r.fixed && !acknowledgedRiskIds.includes(r.id)).length;
    const destructive = risks.filter((r) => r.decisionTier === 'destructive' && !r.fixed).length;

    return {
      fixedPct: Math.round((fixedOrAck / total) * 100),
      safePct: Math.round((safeFixable / total) * 100),
      decisionPct: Math.round((decision / total) * 100),
      destructivePct: Math.round((destructive / total) * 100),
      total,
      fixedOrAck,
      safeFixable,
      decision,
      destructive,
    };
  }, [risks, acknowledgedRiskIds]);

  // ── Audit Report Exporter ─────────────────────────────────────────────────
  const handleExportAuditReport = () => {
    const dbName = sourceConfig?.database || 'source_db';
    const targetDbName = targetConfig?.database || 'target_db';
    const timestamp = new Date().toISOString();

    let md = '# 🛡️ MigrateIQ — Migration Readiness & Risk Audit Report\n\n';
    md += `**Generated:** ${timestamp}\n`;
    md += `**Direction:** ${direction || 'mongodb-to-postgres'}\n`;
    md += `**Source Database:** \`${dbName}\` (${direction === 'postgres-to-mongo' ? 'PostgreSQL' : 'MongoDB'})\n`;
    md += `**Target Database:** \`${targetDbName}\` (${direction === 'postgres-to-mongo' ? 'MongoDB' : 'PostgreSQL'})\n`;
    md += `**Pre-Flight Safety Score:** **${safetyScore}%**\n\n`;
    md += '---\n\n';

    md += '## 1. Executive Summary & Flight Clearance\n\n';
    md += `- **Pending Decisions:** ${pendingDecisionsCount}\n`;
    md += `- **Safe Remediations Ready:** ${safeFixesReadyCount}\n`;
    md += `- **Destructive Warnings:** ${destructiveCount}\n`;
    md += `- **Records Protected from Silent Loss:** ${sampleRecordsProtected.toLocaleString()}\n`;
    md += `- **Flight Clearance Status:** ${isPreflightCleared ? '✅ PASSED — Cleared for Simulation' : '🔴 HOLD — Blockers Require Action'}\n\n`;

    md += '## 2. Pre-Flight Checklist Verification\n\n';
    md += '| Pillar | Check Description | Status |\n';
    md += '| :--- | :--- | :--- |\n';
    md += `| 🛡️ **Data Integrity** | Strict NOT NULL, type bounds, and null bytes | ${isDataIntegrityPassed ? '✅ PASSED' : '❌ BLOCKED'} |\n`;
    md += `| 🔗 **Relational Topology** | DAG dependency graph, acyclic ordering | ${isTopologyPassed ? '✅ PASSED' : '❌ BLOCKED'} |\n`;
    md += `| 📐 **Schema & Drift** | Destination table collisions and column drift | ${isSchemaPassed ? '✅ PASSED' : '❌ BLOCKED'} |\n`;
    md += `| ⚡ **Buffer & Performance** | Streaming batch size and foreign key indexes | ${isPerformancePassed ? '✅ PASSED' : '❌ BLOCKED'} |\n\n`;

    md += '## 3. Storage & Capacity Planning\n\n';
    const storageEst = riskAnalysis?.metrics?.storageEstimate;
    if (storageEst) {
      md += `- **Source Data Size:** ${(storageEst.sourceSizeBytes / (1024 * 1024)).toFixed(2)} MB\n`;
      md += `- **Estimated Target Size:** ${(storageEst.targetEstimatedBytes / (1024 * 1024)).toFixed(2)} MB (~${storageEst.multiplier}x multiplier)\n`;
      md += `- **Storage Rationale:** ${storageEst.explanation}\n\n`;
    }

    md += '## 4. Migration Decision Ledger & Risk Item Inventory\n\n';
    md += '| Severity | Collection / Table | Field | Issue Title | Decision Tier | Resolution Status |\n';
    md += '| :--- | :--- | :--- | :--- | :--- | :--- |\n';
    for (const r of risks) {
      const status = r.fixed ? 'Fixed ✅' : acknowledgedRiskIds.includes(r.id) ? 'Acknowledged ✓' : 'Pending ⚠️';
      md += `| ${r.severity.toUpperCase()} | \`${r.affectedTable || 'Global'}\` | \`${r.affectedField || '—'}\` | ${r.title} | ${r.decisionTier || 'safe'} | ${status} |\n`;
    }
    md += '\n---\n\n';

    md += '## 5. Formal Sign-Off Authorization\n\n';
    md += '| Role | Name | Signature | Date |\n';
    md += '| :--- | :--- | :--- | :--- |\n';
    md += '| **Lead Database Administrator (DBA)** | ___________________________ | ___________________________ | ____________ |\n';
    md += '| **DevOps / Migration Engineer** | ___________________________ | ___________________________ | ____________ |\n\n';

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MigrateIQ-Readiness-Audit-${dbName}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage('✓ Audit Report downloaded as Markdown');
    setTimeout(() => setToastMessage(null), 3500);
  };


  // Safety Score Calculation
  const safetyScore = useMemo(() => {
    if (riskAnalysis?.metrics?.safetyScore !== undefined) {
      return riskAnalysis.metrics.safetyScore;
    }
    const deductions = unacknowledgedCritical.length * 15 + warningIssues.filter((w) => !w.fixed).length * 4;
    return Math.max(0, Math.min(100, 100 - deductions));
  }, [riskAnalysis, unacknowledgedCritical, warningIssues]);

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      dataIntegrity: risks.filter((r) => r.category === 'data_integrity').length,
      relational: risks.filter((r) => r.category === 'relational').length,
      schema: risks.filter((r) => r.category === 'schema').length,
      performance: risks.filter((r) => r.category === 'performance').length,
    };
  }, [risks]);

  const filteredRisks = useMemo(() => {
    let base: RiskItem[];
    if (activeTab === 'decision') {
      base = decisionRisks;
    } else if (activeTab === 'safe') {
      base = safeRisks;
    } else if (activeTab === 'destructive') {
      base = destructiveRisks;
    } else if (activeTab === 'info') {
      base = infoIssues;
    } else if (activeTab === 'layer2') {
      base = [];
    } else {
      base = risks;
    }

    return [...base].sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      const sevDiff = (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
      if (sevDiff !== 0) return sevDiff;
      return getRiskSortWeight(a) - getRiskSortWeight(b);
    });
  }, [activeTab, risks, decisionRisks, safeRisks, destructiveRisks, infoIssues]);

  const searchedRisks = useMemo(() => {
    let result = filteredRisks;
    if (selectedCollectionFilter) {
      result = result.filter(
        (r) =>
          r.affectedTable?.toLowerCase() === selectedCollectionFilter.toLowerCase() ||
          r.id.toLowerCase().includes(selectedCollectionFilter.toLowerCase())
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        return (
          (r.affectedTable && r.affectedTable.toLowerCase().includes(q)) ||
          (r.affectedField && r.affectedField.toLowerCase().includes(q)) ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.suggestedFix && r.suggestedFix.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }, [filteredRisks, searchQuery, selectedCollectionFilter]);

  const groupedRisks = useMemo(() => {
    const groups: Record<string, RiskItem[]> = {};
    for (const risk of searchedRisks) {
      const key = risk.affectedTable || 'Global / Common';
      if (!groups[key]) groups[key] = [];
      groups[key].push(risk);
    }
    return groups;
  }, [searchedRisks]);

  const toggleCollectionGroup = (groupKey: string) => {
    setCollapsedCollections((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };


  const isPgToMongo = direction === 'postgres-to-mongo';

  const acknowledgedLayer2Count = layer2Features.filter(
    (f) => f.isAutoApplied || acknowledgedLayer2Ids.includes(f.id)
  ).length;

    const renderRiskCard = (risk: RiskItem) => {
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
                      {risk.actionCategory && (
                        <span className={`risk-category-badge ${risk.actionCategory.replace('_', '-')}`}>
                          {risk.actionCategory === 'remediation' && '🔧 Safe Fix'}
                          {risk.actionCategory === 'schema_choice' && '🧩 Schema Choice'}
                          {risk.actionCategory === 'safety_strategy' && '🛡️ Strategy'}
                          {risk.actionCategory === 'destructive' && '⚠️ Destructive'}
                        </span>
                      )}
                      <h3 className="risk-card-title">{risk.title}</h3>
                      {risk.affectedTable && (
                        <span className="risk-target-tag">
                          {risk.affectedTable}
                          {risk.affectedField ? `.${risk.affectedField}` : ''}
                        </span>
                      )}
                      {risk.autoFixAvailable && !isFixed && (
                        <span className="risk-fix-time-chip">
                          ⏱️ Fix: {getEstimatedFixTime(risk)}
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

                      {/* Existing Target Table Telemetry & Schema Drift Analysis */}
                      {risk.existingTableDetails && (
                        <div className="risk-existing-table-box">
                          <div className="existing-table-header">
                            <span className="existing-table-icon">📊</span>
                            <div className="existing-table-meta">
                              <span className="existing-table-title">
                                Target Table Telemetry: "{risk.affectedTable}"
                              </span>
                              <span className="existing-table-sub">
                                Live PostgreSQL table contains <strong>{risk.existingTableDetails.rowCount.toLocaleString()}</strong> existing records across {risk.existingTableDetails.columns.length} columns.
                              </span>
                            </div>
                          </div>

                          {/* Schema Drift Warning if target is missing source fields */}
                          {risk.existingTableDetails.missingInTarget && risk.existingTableDetails.missingInTarget.length > 0 && (
                            <div className="schema-drift-warning">
                              <span className="drift-badge">⚠️ Schema Drift Alert</span>
                              <span className="drift-text">
                                Source fields not found in target table: <strong>{risk.existingTableDetails.missingInTarget.join(', ')}</strong>. Appending rows will cause columns to be ignored or trigger missing column errors.
                              </span>
                            </div>
                          )}

                          {/* Columns List */}
                          <div className="existing-columns-list">
                            <span className="existing-cols-label">Target Columns:</span>
                            {risk.existingTableDetails.columns.map((col) => (
                              <span key={col.name} className="existing-col-tag">
                                {col.name} <span className="col-type">({col.type}{col.nullable ? '' : ' NOT NULL'})</span>
                              </span>
                            ))}
                          </div>

                          {/* Sample Existing Rows */}
                          {risk.existingTableDetails.sampleExistingRows && risk.existingTableDetails.sampleExistingRows.length > 0 && (
                            <div className="existing-sample-rows">
                              <span className="existing-sample-label">Sample Existing Target Records:</span>
                              <pre className="existing-sample-code">
                                <code>{JSON.stringify(risk.existingTableDetails.sampleExistingRows, null, 2)}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Collapsible Sample Offending Records Inspector */}
                      {risk.sampleOffendingValues && risk.sampleOffendingValues.length > 0 && (
                        <div className="risk-sample-offending-box">
                          <div className="risk-sample-offending-header">
                            <span className="risk-sample-icon">🔍</span>
                            <span className="risk-sample-title">
                              Sample Offending Records Detected in Source ({risk.sampleOffendingValues.length} sampled)
                            </span>
                          </div>
                          <div className="risk-sample-table-wrap">
                            <table className="risk-sample-table">
                              <thead>
                                <tr>
                                  <th>Source Document _id</th>
                                  <th>Offending Value / State</th>
                                  {risk.sampleOffendingValues.some((s) => s.label) && <th>Diagnostic Reason</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {risk.sampleOffendingValues.map((sample, sIdx) => (
                                  <tr key={sIdx}>
                                    <td className="doc-id-cell">
                                      <code>{sample.docId || 'N/A'}</code>
                                    </td>
                                    <td className="value-cell">
                                      <code>
                                        {typeof sample.value === 'object'
                                          ? JSON.stringify(sample.value)
                                          : String(sample.value)}
                                      </code>
                                    </td>
                                    {risk.sampleOffendingValues?.some((s) => s.label) && (
                                      <td className="label-cell">{sample.label || '—'}</td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Live Before -> After Transformation Preview */}
                      {risk.transformationPreview && (
                        <div className="risk-preview-box">
                          <div className="risk-preview-header">
                            <span className="risk-preview-icon">🔄</span>
                            <div className="risk-preview-title-wrap">
                              <span className="risk-preview-title">Transformation Diff Preview</span>
                              {risk.transformationPreview.explanation && (
                                <span className="risk-preview-sub">({risk.transformationPreview.explanation})</span>
                              )}
                            </div>
                          </div>
                          <div className="risk-preview-grid">
                            <div className="risk-preview-pane before">
                              <span className="risk-preview-pane-label">Source Document (Before)</span>
                              <pre className="risk-preview-code"><code>{risk.transformationPreview.before}</code></pre>
                            </div>
                            <div className="risk-preview-pane-arrow">➔</div>
                            <div className="risk-preview-pane after">
                              <span className="risk-preview-pane-label">PostgreSQL Insert (After)</span>
                              <pre className="risk-preview-code"><code>{risk.transformationPreview.after}</code></pre>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* In-Card Interactive Remediation Box */}
                      {!isFixed && risk.inputType && risk.inputType !== 'none' && (
                        <div className="risk-card-interactive-box">
                          <span className="risk-interactive-label">⚡ Direct Resolution Options:</span>

                          {/* TEXT INPUT TYPE */}
                          {risk.inputType === 'text' && (
                            <div className="risk-input-text-row">
                              <input
                                type="text"
                                className="risk-text-input"
                                value={cardInputValues[risk.id] ?? (risk.defaultInputValue || '')}
                                onChange={(e) =>
                                  setCardInputValues({ ...cardInputValues, [risk.id]: e.target.value })
                                }
                                placeholder={risk.inputPlaceholder || 'Enter value...'}
                              />
                              <button
                                type="button"
                                className="btn-apply-interactive"
                                onClick={() => {
                                  const val = cardInputValues[risk.id] ?? (risk.defaultInputValue || '');
                                  if (risk.autoFixAction) {
                                    applyAutoFix({
                                      ...risk.autoFixAction,
                                      recommendedValue: val,
                                    });
                                  }
                                }}
                              >
                                ⚡ Apply
                              </button>
                            </div>
                          )}

                          {/* RADIO GROUP TYPE */}
                          {risk.inputType === 'radio' && risk.options && (
                            <div className="risk-radio-group">
                              {risk.options.map((opt: RiskInteractiveOption) => {
                                const selected =
                                  (cardSelectedOptions[risk.id] ?? risk.options![0].value) === opt.value;
                                return (
                                  <label
                                    key={opt.value}
                                    className={`risk-radio-item ${selected ? 'selected' : ''}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`radio-${risk.id}`}
                                      checked={selected}
                                      onChange={() =>
                                        setCardSelectedOptions({
                                          ...cardSelectedOptions,
                                          [risk.id]: opt.value,
                                        })
                                      }
                                    />
                                    <div className="risk-radio-text-wrap">
                                      <div className="risk-radio-label-row">
                                        <span className="risk-radio-item-label">{opt.label}</span>
                                        {opt.value === 'drop' && (
                                          <span className="risk-destructive-tag">Destructive</span>
                                        )}
                                      </div>
                                      {opt.description && (
                                        <span className="risk-radio-item-desc">{opt.description}</span>
                                      )}
                                      {opt.tradeoff && (
                                        <div className="risk-option-tradeoff">
                                          <span className="risk-tradeoff-tag">⚖️ Trade-off</span>
                                          <span className="risk-tradeoff-text">{opt.tradeoff}</span>
                                        </div>
                                      )}

                                      {/* Sub-inputs for default_value or rename */}
                                      {selected &&
                                        (opt.value === 'default_value' || opt.value === 'rename') && (
                                          <div className="risk-nested-input-row">
                                            <input
                                              type="text"
                                              className="risk-text-input-sm"
                                              value={
                                                cardInputValues[risk.id] ??
                                                (risk.defaultInputValue || '')
                                              }
                                              onChange={(e) =>
                                                setCardInputValues({
                                                  ...cardInputValues,
                                                  [risk.id]: e.target.value,
                                                })
                                              }
                                              placeholder={
                                                risk.inputPlaceholder || 'Enter custom value...'
                                              }
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </div>
                                        )}
                                    </div>
                                  </label>
                                );
                              })}

                              {/* Destructive Confirmation Checkbox */}
                              {(() => {
                                const chosenValue =
                                  cardSelectedOptions[risk.id] ?? risk.options![0].value;
                                const isDestructive =
                                  chosenValue === 'drop' ||
                                  risk.decisionTier === 'destructive' ||
                                  risk.actionCategory === 'destructive';
                                const isApplyDisabled =
                                  isDestructive && !destructiveConfirmed[risk.id];

                                return (
                                  <>
                                    {isDestructive && (
                                      <div className="risk-destructive-confirm-box">
                                        <label className="risk-destructive-checkbox-label">
                                          <input
                                            type="checkbox"
                                            checked={destructiveConfirmed[risk.id] ?? false}
                                            onChange={(e) =>
                                              setDestructiveConfirmed({
                                                ...destructiveConfirmed,
                                                [risk.id]: e.target.checked,
                                              })
                                            }
                                          />
                                          <span className="risk-destructive-text">
                                            <strong>⚠️ Destructive Action Confirmation:</strong> I understand that selecting <em>Drop & Recreate</em> will permanently drop the target table and purge all existing records in PostgreSQL.
                                          </span>
                                        </label>
                                      </div>
                                    )}

                                    <div className="risk-radio-apply-row">
                                      <button
                                        type="button"
                                        className={`btn-apply-interactive ${isDestructive ? 'destructive' : ''}`}
                                        disabled={isApplyDisabled}
                                        onClick={() => {
                                          const chosenOpt = risk.options!.find(
                                            (o: RiskInteractiveOption) => o.value === chosenValue
                                          );
                                          const customVal =
                                            cardInputValues[risk.id] ?? (risk.defaultInputValue || '');

                                          if (chosenOpt?.actionType === 'set_default_value') {
                                            applyAutoFix({
                                              type: 'set_default_value',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              recommendedValue: customVal || 'Unknown',
                                              description: `Set default value "${customVal}"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'set_nullable') {
                                            applyAutoFix({
                                              type: 'set_nullable',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              description: `Allow NULL in "${risk.affectedField}"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'set_table_action') {
                                            applyAutoFix({
                                              type: 'set_table_action',
                                              collectionName: risk.affectedTable || '',
                                              recommendedValue: chosenValue,
                                              description: `Set table action "${chosenValue}"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'rename_target_table') {
                                            applyAutoFix({
                                              type: 'rename_target_table',
                                              collectionName: risk.affectedTable || '',
                                              recommendedValue:
                                                customVal || `${risk.affectedTable}_migrated`,
                                              description: `Rename table to "${customVal || `${risk.affectedTable}_migrated`}"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'change_column_type') {
                                            applyAutoFix({
                                              type: 'change_column_type',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              recommendedValue: chosenValue,
                                              description: `Change type to "${chosenValue}"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'resolve_numeric_special') {
                                            applyAutoFix({
                                              type: 'resolve_numeric_special',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              recommendedValue: chosenValue,
                                              description: `Handle numeric specials with "${chosenValue}"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'resolve_orphan_fk') {
                                            applyAutoFix({
                                              type: 'resolve_orphan_fk',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              recommendedValue: chosenValue,
                                              description: `Resolve orphan FK with "${chosenValue}"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'sanitize_sparse_array') {
                                            applyAutoFix({
                                              type: 'sanitize_sparse_array',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              recommendedValue: chosenValue,
                                              description: `Handle sparse array with "${chosenValue}"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'promote_varchar_length') {
                                            applyAutoFix({
                                              type: 'promote_varchar_length',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              description: `Promote column "${risk.affectedField}" to TEXT`,
                                            });
                                          } else if (chosenOpt?.actionType === 'create_foreign_key_index') {
                                            applyAutoFix({
                                              type: 'create_foreign_key_index',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              description: `Create FK index on ${risk.affectedTable}(${risk.affectedField})`,
                                            });
                                          } else if (chosenOpt?.actionType === 'sanitize_reserved_keyword') {
                                            applyAutoFix({
                                              type: 'sanitize_reserved_keyword',
                                              collectionName: risk.affectedTable || '',
                                              fieldName: risk.affectedField || '',
                                              recommendedValue: `${risk.affectedField}_col`,
                                              description: `Alias reserved keyword to "${risk.affectedField}_col"`,
                                            });
                                          } else if (chosenOpt?.actionType === 'resolve_schema_drift') {
                                            applyAutoFix({
                                              type: 'resolve_schema_drift',
                                              collectionName: risk.affectedTable || '',
                                              recommendedValue: chosenValue,
                                              description: `Resolve schema drift with "${chosenValue}"`,
                                            });
                                          } else if (risk.autoFixAction) {
                                            applyAutoFix(risk.autoFixAction);
                                          }
                                        }}
                                      >
                                        {isDestructive
                                          ? isApplyDisabled
                                            ? '⚠️ Check Confirmation Box Above'
                                            : '⚠️ Confirm & Apply Drop'
                                          : '⚡ Apply Selected Resolution'}
                                      </button>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {/* SELECT DROPDOWN TYPE */}
                          {risk.inputType === 'select' && risk.options && (
                            <div className="risk-select-wrapper">
                              <div className="risk-select-row">
                                <select
                                  className="risk-select-input"
                                  value={cardSelectedOptions[risk.id] ?? risk.options[0].value}
                                  onChange={(e) =>
                                    setCardSelectedOptions({
                                      ...cardSelectedOptions,
                                      [risk.id]: e.target.value,
                                    })
                                  }
                                >
                                  {risk.options.map((opt: RiskInteractiveOption) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn-apply-interactive"
                                  onClick={() => {
                                    const chosenValue =
                                      cardSelectedOptions[risk.id] ?? risk.options![0].value;
                                    applyAutoFix({
                                      type: 'change_column_type',
                                      collectionName: risk.affectedTable || '',
                                      fieldName: risk.affectedField || '',
                                      recommendedValue: chosenValue,
                                      description: `Change column type to "${chosenValue}"`,
                                    });
                                  }}
                                >
                                  ⚡ Apply Type
                                </button>
                              </div>

                              {/* Show Tradeoff of Chosen Select Option */}
                              {(() => {
                                const chosen =
                                  risk.options.find(
                                    (o) =>
                                      o.value ===
                                      (cardSelectedOptions[risk.id] ?? risk.options![0].value)
                                  );
                                if (chosen?.tradeoff) {
                                  return (
                                    <div className="risk-option-tradeoff select-tradeoff">
                                      <span className="risk-tradeoff-tag">⚖️ Trade-off</span>
                                      <span className="risk-tradeoff-text">{chosen.tradeoff}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* "What if I ignore this?" impact simulator */}
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
                              {/* 1-Click Auto Fix for simple actions or actions without inputType */}
                              {risk.autoFixAvailable &&
                                risk.autoFixAction &&
                                (!risk.inputType || risk.inputType === 'none') && (
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
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
};

  return (
    <div className="risk-report-container">
      {/* ── Step Header ── */}
      <div className="risk-header-area">
        <div className="risk-header-title-group">
          <h1>Migration Decision & Recovery Center</h1>
          <p className="risk-header-subtitle">
            MigrateIQ scanned schemas, constraints, and sample data. Confirm architectural choices,
            apply safe 1-click remediations, and review destructive actions before simulation.
          </p>
        </div>

        <div className="risk-header-actions-area">
          <button
            type="button"
            className="btn-export-audit"
            onClick={handleExportAuditReport}
            title="Download formal DBA audit sign-off report with decisions ledger"
          >
            📥 Export Audit Report
          </button>

          <button
            type="button"
            className="btn-export-audit"
            onClick={() => runLiveAnalysis()}
            disabled={isAnalyzing}
            title="Re-scan database against current schema mapping to verify your fixes"
            style={{
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              borderColor: '#BFDBFE',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{isAnalyzing ? '⏳' : '🔄'}</span>
            <span>{isAnalyzing ? 'Re-scanning...' : 'Re-scan & Verify Fixes'}</span>
          </button>

          <div className="risk-stats-chips">
          <span className="risk-stat-chip decision">
            🟡 {pendingDecisionsCount} Decisions
          </span>
          <span className="risk-stat-chip safe">
            🟢 {safeFixesReadyCount} Safe Fixes
          </span>
          {destructiveCount > 0 && (
            <span className="risk-stat-chip destructive">
              ⚠️ {destructiveCount} Destructive
            </span>
          )}
          {risks.some((r) => r.fixed) && (
            <span className="risk-stat-chip resolved">
              ✓ {risks.filter((r) => r.fixed).length} Fixed
            </span>
          )}
        </div>
        </div>
      </div>

      {toastMessage && (
        <div className="risk-toast-notice">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Migration Decision & Recovery Summary (4 Pillars) ── */}
      <div className="migration-decision-summary">
        <div className="decision-summary-top">
          <div className="decision-summary-heading">
            <span className="decision-summary-title">Readiness & Decision Matrix</span>
            <span className="decision-summary-subtitle">
              {unacknowledgedCritical.length > 0
                ? `${unacknowledgedCritical.length} critical blocker(s) must be resolved or acknowledged before continuing.`
                : pendingDecisionsCount > 0
                ? `${pendingDecisionsCount} recommended decision(s) pending review.`
                : 'All decisions configured and safe remediations prepared. Ready for dry run simulation.'}
            </span>
          </div>

          <div className="decision-summary-actions-wrap">
            {safeFixesReadyCount > 0 && (
              <button
                type="button"
                className="btn-auto-remediate-all"
                onClick={() => applyAllSafeRemediations()}
                title="Automatically apply all non-destructive, bounded fixes (e.g. promoting types, sanitizing null bytes, index generation)"
              >
                ⚡ Auto-Remediate All Safe Issues ({safeFixesReadyCount})
              </button>
            )}

            <div className="decision-summary-status-wrap">
              {unacknowledgedCritical.length > 0 ? (
                <span className="decision-status-pill blocked">
                  🔴 Migration Blocked
                </span>
              ) : pendingDecisionsCount > 0 ? (
                <span className="decision-status-pill review">
                  ⚠️ Review Required
                </span>
              ) : (
                <span className="decision-status-pill ready">
                  🟢 Safe to Proceed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4-Pillar Grid */}
        <div className="decision-summary-grid">
          <div
            className={`decision-tile decisions ${activeTab === 'decision' ? 'selected' : ''}`}
            onClick={() => setActiveTab(activeTab === 'decision' ? 'all' : 'decision')}
            role="button"
            tabIndex={0}
          >
            <div className="decision-tile-header">
              <span className="decision-tile-icon">🟡</span>
              <span className="decision-tile-label">Pending Decisions</span>
            </div>
            <div className="decision-tile-val">{pendingDecisionsCount}</div>
            <div className="decision-tile-sub">
              {pendingDecisionsCount === 1 ? '1 choice with trade-offs' : `${pendingDecisionsCount} choices with trade-offs`}
            </div>
          </div>

          <div
            className={`decision-tile safe ${activeTab === 'safe' ? 'selected' : ''}`}
            onClick={() => setActiveTab(activeTab === 'safe' ? 'all' : 'safe')}
            role="button"
            tabIndex={0}
          >
            <div className="decision-tile-header">
              <span className="decision-tile-icon">🟢</span>
              <span className="decision-tile-label">Safe Remediations</span>
            </div>
            <div className="decision-tile-val">{safeFixesReadyCount}</div>
            <div className="decision-tile-sub">
              {safeFixesReadyCount === 1 ? '1 bounded remediation ready' : `${safeFixesReadyCount} bounded remediations ready`}
            </div>
          </div>

          <div
            className={`decision-tile destructive ${activeTab === 'destructive' ? 'selected' : ''}`}
            onClick={() => setActiveTab(activeTab === 'destructive' ? 'all' : 'destructive')}
            role="button"
            tabIndex={0}
          >
            <div className="decision-tile-header">
              <span className="decision-tile-icon">⚠️</span>
              <span className="decision-tile-label">Destructive Warnings</span>
            </div>
            <div className="decision-tile-val">{destructiveCount}</div>
            <div className="decision-tile-sub">
              {destructiveCount === 1 ? '1 requires explicit confirm' : `${destructiveCount} require explicit confirm`}
            </div>
          </div>

          <div className="decision-tile records">
            <div className="decision-tile-header">
              <span className="decision-tile-icon">🛡️</span>
              <span className="decision-tile-label">Records Protected</span>
            </div>
            <div className="decision-tile-val">
              {sampleRecordsProtected > 0 ? sampleRecordsProtected.toLocaleString() : '100%'}
            </div>
            <div className="decision-tile-sub">Shielded from data loss</div>
          </div>
        </div>

        {/* ── Visual Command Center: Radial Gauge & Risk Distribution Bar ── */}
        <div className="decision-readiness-command-center">
          {/* Radial Safety Gauge */}
          <div className="safety-radial-gauge-card">
            <div className="radial-gauge-svg-wrap">
              <svg className="radial-gauge-svg" viewBox="0 0 100 100" width="86" height="86">
                <circle
                  className="radial-gauge-bg"
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#E2E8F0"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  className="radial-gauge-fill"
                  cx="50"
                  cy="50"
                  r="38"
                  stroke={safetyScore >= 85 ? '#16A34A' : safetyScore >= 70 ? '#0284C7' : safetyScore >= 40 ? '#D97706' : '#DC2626'}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 - (safetyScore / 100) * 238.76}
                  style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="radial-gauge-text">
                <span className="radial-gauge-percent">{safetyScore}%</span>
                <span className="radial-gauge-label">SAFETY</span>
              </div>
            </div>
            <div className="radial-gauge-info">
              <span className="radial-gauge-title">Pre-Flight Safety Score</span>
              <span className="radial-gauge-subtitle">
                {safetyScore >= 85 ? 'Shielded & Ready for Simulation' : safetyScore >= 60 ? 'Review Safe Remediations' : 'Critical Constraints Blocked'}
              </span>
            </div>
          </div>

          {/* Segmented Risk Distribution Bar */}
          <div className="risk-distribution-card">
            <div className="distribution-header">
              <span className="distribution-title">Database Risk Distribution</span>
              <span className="distribution-meta">{risks.length} total verification points</span>
            </div>

            <div className="distribution-segmented-bar">
              <div
                className="segment clean"
                style={{ width: `${Math.max(riskDistribution.fixedPct, 4)}%` }}
                title={`${riskDistribution.fixedOrAck} Clean / Remediated (${riskDistribution.fixedPct}%)`}
              />
              <div
                className="segment safe"
                style={{ width: `${Math.max(riskDistribution.safePct, 4)}%` }}
                title={`${riskDistribution.safeFixable} Safe Fixes Ready (${riskDistribution.safePct}%)`}
              />
              <div
                className="segment decision"
                style={{ width: `${Math.max(riskDistribution.decisionPct, 4)}%` }}
                title={`${riskDistribution.decision} Decisions Required (${riskDistribution.decisionPct}%)`}
              />
              {riskDistribution.destructive > 0 && (
                <div
                  className="segment destructive"
                  style={{ width: `${Math.max(riskDistribution.destructivePct, 4)}%` }}
                  title={`${riskDistribution.destructive} Destructive Actions (${riskDistribution.destructivePct}%)`}
                />
              )}
            </div>

            <div className="distribution-legend">
              <span className="legend-item"><span className="legend-dot clean" /> {riskDistribution.fixedOrAck} Clean</span>
              <span className="legend-item"><span className="legend-dot safe" /> {riskDistribution.safeFixable} Safe Fixes</span>
              <span className="legend-item"><span className="legend-dot decision" /> {riskDistribution.decision} Choices</span>
              {riskDistribution.destructive > 0 && (
                <span className="legend-item"><span className="legend-dot destructive" /> {riskDistribution.destructive} Destructive</span>
              )}
            </div>

            <div className="risk-safety-categories">
              <span className="risk-category-chip">🛡️ Data Integrity ({categoryCounts.dataIntegrity})</span>
              <span className="risk-category-chip">🔗 Relational ({categoryCounts.relational})</span>
              <span className="risk-category-chip">📐 Schema ({categoryCounts.schema})</span>
              <span className="risk-category-chip">⚡ Buffer & Memory ({categoryCounts.performance})</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Zero Data Loss Live Counter Banner ── */}
      <div className={`zero-data-loss-banner ${zeroDataLossStats.isShieldActive ? 'shield-active' : 'shield-warning'}`}>
        <div className="zero-loss-left">
          <span className="zero-loss-icon">{zeroDataLossStats.isShieldActive ? '🛡️' : '⚠️'}</span>
          <div className="zero-loss-text-wrap">
            <div className="zero-loss-title-row">
              <span className="zero-loss-title">
                {zeroDataLossStats.isShieldActive
                  ? 'Zero Data Loss Shield Active'
                  : 'Data Preservation Alert: Action Required'}
              </span>
              <span className={`zero-loss-badge ${zeroDataLossStats.isShieldActive ? 'active' : 'warning'}`}>
                {zeroDataLossStats.isShieldActive
                  ? '✓ 100% Data Preservation Guaranteed'
                  : `${zeroDataLossStats.atRiskCount} Records At Risk of Insert Failure`}
              </span>
            </div>
            <p className="zero-loss-desc">
              {zeroDataLossStats.isShieldActive
                ? `All ${zeroDataLossStats.totalDocs.toLocaleString()} source records across all collections are safely mapped. 0 records will fail or be dropped during PostgreSQL ETL.`
                : `Estimated ${zeroDataLossStats.atRiskCount} source records across collections [${zeroDataLossStats.atRiskCollections.join(', ')}] will trigger SQL constraint violations unless remediated.`}
            </p>
          </div>
        </div>
        {!zeroDataLossStats.isShieldActive && safeFixesReadyCount > 0 && (
          <button
            type="button"
            className="btn-quick-shield-fix"
            onClick={() => applyAllSafeRemediations()}
          >
            ⚡ Auto-Remediate Safe Issues
          </button>
        )}
      </div>

      {/* ── Live Memory & Speed Telemetry Strip ── */}
      <div className="risk-telemetry-strip">
        <div className="telemetry-item">
          <span className="telemetry-icon">🧠</span>
          <div className="telemetry-info">
            <span className="telemetry-label">Peak RAM Projection</span>
            <span className="telemetry-val">~{memoryAndSpeedStats.estimatedRamMb} MB <span className="telemetry-subval">/ 20 MB ceiling</span></span>
          </div>
          <span className="telemetry-status-tag safe">Safe Streaming</span>
        </div>

        <div className="telemetry-divider" />

        <div className="telemetry-item">
          <span className="telemetry-icon">📦</span>
          <div className="telemetry-info">
            <span className="telemetry-label">Auto-Calibrated Batch</span>
            <span className="telemetry-val">{memoryAndSpeedStats.batchSize} docs/batch</span>
          </div>
          <span className={`telemetry-status-tag ${memoryAndSpeedStats.isThrottled ? 'warning' : 'safe'}`}>
            {memoryAndSpeedStats.isThrottled ? 'Throttled for >100KB Docs' : 'Optimal Throughput'}
          </span>
        </div>

        <div className="telemetry-divider" />

        <div className="telemetry-item">
          <span className="telemetry-icon">⚡</span>
          <div className="telemetry-info">
            <span className="telemetry-label">Projected Transfer Duration</span>
            <span className="telemetry-val">~{memoryAndSpeedStats.estSeconds}s <span className="telemetry-subval">({memoryAndSpeedStats.totalDocs.toLocaleString()} docs)</span></span>
          </div>
          <span className="telemetry-status-tag safe">~450 rows/sec</span>
        </div>
      </div>

      {/* ── Source Collections Health Matrix ── */}
      <div className="collection-health-matrix-section">
        <div className="health-matrix-header">
          <div className="health-matrix-title-row">
            <span className="health-matrix-title">📁 Source Collections Health Matrix</span>
            <span className="health-matrix-subtitle">
              Bird's-eye topology of all {collectionHealthList.length} collections. Click any card to filter hazards.
            </span>
          </div>
          {selectedCollectionFilter && (
            <button
              type="button"
              className="btn-clear-collection-filter"
              onClick={() => setSelectedCollectionFilter(null)}
            >
              ✕ Clear Collection Filter ({selectedCollectionFilter})
            </button>
          )}
        </div>

        <div className="collection-health-grid">
          {collectionHealthList.map((col) => {
            const isSelected = selectedCollectionFilter?.toLowerCase() === col.collectionName.toLowerCase();
            return (
              <div
                key={col.collectionName}
                className={`collection-health-card ${isSelected ? 'selected' : ''} ${col.isReady ? 'ready' : col.criticalCount > 0 ? 'blocked' : 'warning'}`}
                onClick={() =>
                  setSelectedCollectionFilter(
                    selectedCollectionFilter?.toLowerCase() === col.collectionName.toLowerCase()
                      ? null
                      : col.collectionName
                  )
                }
                role="button"
                tabIndex={0}
              >
                <div className="col-health-card-top">
                  <span className="col-health-icon">📁</span>
                  <span className="col-health-name" title={col.collectionName}>{col.collectionName}</span>
                  {isSelected && <span className="col-health-active-dot">● Active</span>}
                </div>

                <div className="col-health-stats">
                  <span>{col.documentCount.toLocaleString()} docs</span>
                  <span className="col-health-dot">•</span>
                  <span>~{col.avgDocSizeBytes > 1024 ? `${(col.avgDocSizeBytes / 1024).toFixed(0)} KB` : `${col.avgDocSizeBytes} B`}</span>
                </div>

                <div className="col-health-badge-row">
                  {col.isReady ? (
                    <span className="col-badge clean">✅ 100% Ready</span>
                  ) : col.criticalCount > 0 ? (
                    <span className="col-badge critical">🔴 {col.criticalCount} Blocker{col.criticalCount > 1 ? 's' : ''}</span>
                  ) : (
                    <span className="col-badge warning">🟡 {col.warningCount} Warning{col.warningCount > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Target Storage Capacity & Footprint Planner ── */}
      {(() => {
        const storageEst = riskAnalysis?.metrics?.storageEstimate || {
          sourceSizeBytes: 1845000,
          targetEstimatedBytes: 2546100,
          multiplier: 1.38,
          explanation:
            'PostgreSQL row overhead (23 bytes/tuple header), 8-byte alignment padding, and B-Tree indexes expand storage beyond compressed MongoDB WiredTiger data.',
        };
        return (
          <div className="risk-storage-capacity-banner">
            <div className="storage-capacity-header">
              <span className="storage-capacity-icon">💾</span>
              <div className="storage-capacity-title-wrap">
                <span className="storage-capacity-title">Target Storage Capacity & Footprint Planning</span>
                <span className="storage-capacity-sub">
                  PostgreSQL requires tuple alignment, MVCC transaction headers (23 bytes/row), and B-Tree indexes.
                </span>
              </div>
              <span className="storage-multiplier-badge">
                ~{storageEst.multiplier}x Storage Expansion
              </span>
            </div>
            <div className="storage-capacity-stats-row">
              <div className="storage-stat-item">
                <span className="storage-stat-label">Source MongoDB Data</span>
                <span className="storage-stat-val">
                  {(storageEst.sourceSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="storage-stat-arrow">➔</div>
              <div className="storage-stat-item">
                <span className="storage-stat-label">Estimated PostgreSQL Footprint</span>
                <span className="storage-stat-val highlight">
                  {(storageEst.targetEstimatedBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="storage-stat-detail">
                {storageEst.explanation}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Filter / Tabs Bar ── */}
      <div className="risk-filter-bar">
        <div className="risk-filter-tabs">
          <button
            type="button"
            className={`risk-filter-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Issues <span className="risk-filter-count">{risks.length}</span>
          </button>
          <button
            type="button"
            className={`risk-filter-btn ${activeTab === 'decision' ? 'active' : ''}`}
            onClick={() => setActiveTab('decision')}
          >
            🟡 Decisions Required <span className="risk-filter-count">{decisionRisks.length}</span>
          </button>
          <button
            type="button"
            className={`risk-filter-btn ${activeTab === 'safe' ? 'active' : ''}`}
            onClick={() => setActiveTab('safe')}
          >
            🟢 Safe Remediations <span className="risk-filter-count">{safeRisks.length}</span>
          </button>
          {destructiveRisks.length > 0 && (
            <button
              type="button"
              className={`risk-filter-btn ${activeTab === 'destructive' ? 'active' : ''}`}
              onClick={() => setActiveTab('destructive')}
            >
              ⚠️ Destructive <span className="risk-filter-count">{destructiveRisks.length}</span>
            </button>
          )}
          <button
            type="button"
            className={`risk-filter-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            ℹ️ Info & Notes <span className="risk-filter-count">{infoIssues.length}</span>
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
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => runLiveAnalysis()}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Scanning...' : '🔄 Re-scan Telemetry'}
          </button>
          <button type="button" className="btn-ghost-sm" onClick={expandAll}>
            Expand All
          </button>
          <button type="button" className="btn-ghost-sm" onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      {/* ── Toolbar: Search & View Mode Toggle ── */}
      {activeTab !== 'layer2' && (
        <div className="risk-toolbar-row">
          <div className="risk-search-box">
            <span className="risk-search-icon">🔍</span>
            <input
              type="text"
              className="risk-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by collection, field, title, or error text..."
            />
            {searchQuery && (
              <button
                type="button"
                className="risk-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="risk-view-mode-toggle">
            <span className="view-mode-label">View:</span>
            <button
              type="button"
              className={`btn-view-toggle ${viewMode === 'flat' ? 'active' : ''}`}
              onClick={() => setViewMode('flat')}
            >
              Severity List
            </button>
            <button
              type="button"
              className={`btn-view-toggle ${viewMode === 'grouped' ? 'active' : ''}`}
              onClick={() => setViewMode('grouped')}
            >
              📁 By Collection
            </button>
          </div>
        </div>
      )}

      {/* ── Risk Cards List ── */}
      {activeTab !== 'layer2' && (
        <div className="risk-cards-list">
          {searchedRisks.length === 0 ? (
            <div className="risk-empty-state">
              <span className="risk-empty-icon">{searchQuery ? '🔍' : '🛡️'}</span>
              <h3>{searchQuery ? `No Issues Matching "${searchQuery}"` : 'No Schema or Relational Blockers'}</h3>
              <p>
                {searchQuery
                  ? 'No schema, constraint, or collision hazards matched your search term.'
                  : 'All mapped tables, columns, and data types passed pre-flight validation. No data loss, truncation, or constraint conflicts were detected.'}
              </p>
              {searchQuery && (
                <button type="button" className="btn-ghost-sm" onClick={() => setSearchQuery('')}>
                  Clear Search
                </button>
              )}
            </div>
          ) : viewMode === 'flat' ? (
            searchedRisks.map((risk: RiskItem) => renderRiskCard(risk))
          ) : (
            Object.entries(groupedRisks).map(([colName, colRisks]) => {
              const isColCollapsed = collapsedCollections[colName] ?? false;
              const colCritCount = colRisks.filter((r) => r.severity === 'critical' && !r.fixed).length;
              const colWarnCount = colRisks.filter((r) => r.severity === 'warning' && !r.fixed).length;

              return (
                <div key={colName} className="risk-collection-group">
                  <div
                    className="risk-collection-group-header"
                    onClick={() => toggleCollectionGroup(colName)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="collection-header-left">
                      <span className="collection-icon">📁</span>
                      <span className="collection-title">{colName}</span>
                      <span className="collection-total-badge">
                        {colRisks.length} {colRisks.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <div className="collection-header-right">
                      {colCritCount > 0 && (
                        <span className="collection-pill critical">
                          🔴 {colCritCount} Critical
                        </span>
                      )}
                      {colWarnCount > 0 && (
                        <span className="collection-pill warning">
                          🟡 {colWarnCount} Warning
                        </span>
                      )}
                      {colCritCount === 0 && colWarnCount === 0 && (
                        <span className="collection-pill clean">
                          🟢 All Clear
                        </span>
                      )}
                      <span className="collection-chevron">{isColCollapsed ? '▶' : '▼'}</span>
                    </div>
                  </div>

                  {!isColCollapsed && (
                    <div className="risk-collection-group-cards">
                      {colRisks.map((risk) => renderRiskCard(risk))}
                    </div>
                  )}
                </div>
              );
            })
          )}
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

      {/* ── Pre-Flight Clearance Checklist Bar ── */}
      <div className={`preflight-clearance-bar ${isPreflightCleared ? 'cleared' : 'hold'}`}>
        <div className="preflight-clearance-header">
          <div className="preflight-status-indicator">
            <span className="preflight-beacon" />
            <span className="preflight-status-title">
              {isPreflightCleared
                ? '🟢 Pre-Flight Flight Clearance: PASSED — System Cleared for Simulation'
                : '🔴 Pre-Flight Flight Clearance: HOLD — Action Required Before Simulation'}
            </span>
          </div>
          <span className="preflight-status-sub">
            {isPreflightCleared
              ? 'All 4 critical safety pillars have passed verification. Schema mapping is mathematically sound and safe for dry run.'
              : `${unacknowledgedCritical.length} critical blocker(s) must be reviewed or resolved to unlock the simulation runner.`}
          </span>
        </div>

        <div className="preflight-checklist-grid">
          <div
            className={`preflight-check-item ${isDataIntegrityPassed ? 'pass' : 'fail'}`}
            onClick={() => {
              if (!isDataIntegrityPassed) {
                setActiveTab('all');
                setSearchQuery('');
              }
            }}
          >
            <span className="check-icon">{isDataIntegrityPassed ? '✅' : '❌'}</span>
            <div className="check-text-group">
              <span className="check-name">1. Data Integrity & Nullability</span>
              <span className="check-sub">
                {isDataIntegrityPassed
                  ? 'Zero NOT NULL or integer overflow violations'
                  : `${criticalDataIssues.length} unresolved integrity hazard(s)`}
              </span>
            </div>
          </div>

          <div
            className={`preflight-check-item ${isTopologyPassed ? 'pass' : 'fail'}`}
            onClick={() => {
              if (!isTopologyPassed) {
                setActiveTab('all');
                setSearchQuery('');
              }
            }}
          >
            <span className="check-icon">{isTopologyPassed ? '✅' : '❌'}</span>
            <div className="check-text-group">
              <span className="check-name">2. Relational Topology & DAG</span>
              <span className="check-sub">
                {isTopologyPassed
                  ? 'Acyclic insertion ordering; circular FKs deferred'
                  : 'Circular FK dependency deadlock detected'}
              </span>
            </div>
          </div>

          <div
            className={`preflight-check-item ${isSchemaPassed ? 'pass' : 'fail'}`}
            onClick={() => {
              if (!isSchemaPassed) {
                setActiveTab('all');
                setSearchQuery('');
              }
            }}
          >
            <span className="check-icon">{isSchemaPassed ? '✅' : '❌'}</span>
            <div className="check-text-group">
              <span className="check-name">3. Target Schema & Drift Alignment</span>
              <span className="check-sub">
                {isSchemaPassed
                  ? 'Table actions and schema drift resolved'
                  : `${criticalSchemaIssues.length} schema drift / collision issue(s)`}
              </span>
            </div>
          </div>

          <div
            className={`preflight-check-item ${isPerformancePassed ? 'pass' : 'fail'}`}
            onClick={() => {
              if (!isPerformancePassed) {
                setActiveTab('all');
                setSearchQuery('');
              }
            }}
          >
            <span className="check-icon">{isPerformancePassed ? '✅' : '❌'}</span>
            <div className="check-text-group">
              <span className="check-name">4. Performance & Memory Buffer</span>
              <span className="check-sub">
                {isPerformancePassed
                  ? `Batch size: ${riskAnalysis?.metrics?.recommendedBatchSize || 500} docs (< 20MB RAM)`
                  : 'High memory risk detected'}
              </span>
            </div>
          </div>
        </div>
      </div>

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
              ⚠️ Please resolve or review all {unacknowledgedCritical.length} critical issue
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
