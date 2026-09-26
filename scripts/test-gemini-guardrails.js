const assert = require('assert');
const { sanitizePostgresIdentifier } = require('../apps/desktop/dist-electron/engine/ruleEngine');
const { analyzeRisks } = require('../apps/desktop/dist-electron/engine/riskAnalyzer');

// Simulate the exact post-processing guardrails implemented in ai.ts
function runAiGuardrails(rawMappings, schemas) {
  const isPgToMongo = false;
  const mappings = JSON.parse(JSON.stringify(rawMappings));

  const allKnownTables = new Set();
  for (const m of mappings) {
    if (!m.collectionName) continue;
    m.targetTableName = sanitizePostgresIdentifier(m.targetTableName || m.collectionName, true);
    allKnownTables.add(m.targetTableName.toLowerCase());
    allKnownTables.add(m.collectionName.toLowerCase());
  }

  for (const mapping of mappings) {
    const srcSchema = schemas.find((s) => s.collectionName === mapping.collectionName);
    const srcFieldsMap = new Map();
    if (srcSchema?.fields) {
      for (const sf of srcSchema.fields) {
        srcFieldsMap.set(sf.name, sf);
        if (sf.path) srcFieldsMap.set(sf.path, sf);
      }
    }

    // Guardrail 1: Sparse Dynamic Object Consolidation
    const dynamicPrefixes = ['specs', 'metadata', 'attributes', 'properties', 'custom_fields'];
    for (const prefix of dynamicPrefixes) {
      const srcHasDict = srcFieldsMap.has(prefix);
      if (srcHasDict) {
        const flattenedCols = mapping.fields.filter(
          (f) => f.sourceField.startsWith(`${prefix}.`) || f.targetColumn.startsWith(`${prefix}_`)
        );
        if (flattenedCols.length >= 3 && !mapping.fields.some((f) => f.targetColumn === prefix || f.sourceField === prefix)) {
          mapping.fields = mapping.fields.filter((f) => !flattenedCols.includes(f));
          mapping.fields.push({
            id: 'mock-id-' + prefix,
            sourceField: prefix,
            sourceType: 'object',
            targetColumn: prefix,
            targetType: 'JSONB',
            isNullable: true,
            include: true,
            isChildTable: false,
            transformationRule: 'jsonb',
          });
        }
      }
    }

    // Guardrail 2: Per-Field Sanitization & Constraint Safety
    for (const field of mapping.fields) {
      if (field.sourceField === '_id') {
        field.targetColumn = 'id';
        field.isNullable = false;
        if (!isPgToMongo && field.targetType.toUpperCase() !== 'UUID') {
          field.targetType = 'VARCHAR(24)';
        }
      } else {
        field.targetColumn = sanitizePostgresIdentifier(field.targetColumn || field.sourceField, false);
      }

      // Guardrail 2B: Strip Circular and Self-Referencing Foreign Keys
      if (field.isChildTable) {
        field.foreignKeyToParent = undefined;
        if (!field.childTableName) {
          field.childTableName = `${mapping.targetTableName}_${field.targetColumn}`;
        } else {
          field.childTableName = sanitizePostgresIdentifier(field.childTableName, true);
        }
      }

      if (field.foreignKeyToParent) {
        const refParts = field.foreignKeyToParent.split('.');
        const refTable = refParts[0].toLowerCase();
        const currentTable = mapping.targetTableName.toLowerCase();
        const currentCollection = mapping.collectionName.toLowerCase();

        if (
          refTable === currentTable ||
          refTable === currentCollection ||
          refTable === `${currentTable}_id` ||
          refTable === `${currentCollection}_id` ||
          refTable === 'id' ||
          refTable === field.targetColumn.toLowerCase()
        ) {
          field.foreignKeyToParent = undefined;
        } else if (!allKnownTables.has(refTable) && !allKnownTables.has(`${refTable}s`) && !allKnownTables.has(refTable.replace(/s$/, ''))) {
          field.foreignKeyToParent = undefined;
        }
      }

      // Guardrail 2C: Polymorphic Scalar Coercion (mixed -> TEXT)
      const srcField = srcFieldsMap.get(field.sourceField);
      if (srcField && (srcField.bsonType === 'mixed' || field.sourceType === 'mixed')) {
        const isScalarName = /(?:phone|mobile|contact|code|id|ref|status|zip|pin)/i.test(field.sourceField);
        const hasScalarSamples = srcField.sampleValues && srcField.sampleValues.every((v) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
        if (isScalarName || hasScalarSamples) {
          field.targetType = 'TEXT';
        }
      }

      // Guardrail 2D: Unix Epoch / Timestamp_ms Elevation to BIGINT
      if (
        (field.targetType === 'INTEGER' || field.targetType === 'INT') &&
        /(?:timestamp|epoch|_ms|_bytes|filesize)/i.test(field.sourceField)
      ) {
        field.targetType = 'BIGINT';
      }

      if (srcField && srcField.isNullable === false) {
        field.isNullable = false;
      }
    }

    // AGENTS.md §4: sort_order injection
    const enrichedFields = [];
    mapping.fields.forEach((field) => {
      enrichedFields.push(field);
      if (field.isChildTable && field.childTableName) {
        const alreadyHasSortOrder = mapping.fields.some(
          (f) => f.sortOrderColumn || f.targetColumn === 'sort_order'
        );
        if (!alreadyHasSortOrder) {
          enrichedFields.push({
            id: 'mock-sort-order',
            sourceField: 'sort_order',
            sourceType: 'auto',
            targetColumn: 'sort_order',
            targetType: 'INTEGER',
            isNullable: false,
            include: true,
            isChildTable: false,
            sortOrderColumn: true,
            transformationRule: 'sort_order',
          });
        }
      }
    });
    mapping.fields = enrichedFields;

    // Guardrail 3: Child Tables Normalization
    if (mapping.childTables && Array.isArray(mapping.childTables)) {
      mapping.childTables = mapping.childTables.map((ct) => {
        const sanitizedTableName = sanitizePostgresIdentifier(ct.targetTableName || ct.collectionName || `${mapping.targetTableName}_items`, true);
        return {
          ...ct,
          collectionName: ct.collectionName || mapping.collectionName,
          targetTableName: sanitizedTableName,
          fields: Array.isArray(ct.fields) ? ct.fields : [],
          indexes: Array.isArray(ct.indexes) ? ct.indexes : [],
        };
      });
    } else {
      mapping.childTables = [];
    }
  }

  return mappings;
}

console.log('🧪 Testing Gemini AI Guardrails...');

// Test 1: Circular Foreign Key Stripping (orders -> orders)
const mockRawGeminiWithCircularFk = [
  {
    collectionName: 'orders',
    targetTableName: 'orders',
    fields: [
      { sourceField: '_id', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false },
      { sourceField: 'customerId', targetColumn: 'customer_id', targetType: 'VARCHAR(24)', foreignKeyToParent: 'customers.id', isNullable: false },
      { sourceField: 'items', targetColumn: 'items', targetType: 'JSONB', isChildTable: true, childTableName: 'orders_items', foreignKeyToParent: 'orders_id', isNullable: true }
    ],
    childTables: []
  },
  {
    collectionName: 'customers',
    targetTableName: 'customers',
    fields: [
      { sourceField: '_id', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false },
      { sourceField: 'name', targetColumn: 'name', targetType: 'TEXT', isNullable: false }
    ],
    childTables: []
  }
];

const cleanedMappings = runAiGuardrails(mockRawGeminiWithCircularFk, [
  { collectionName: 'orders', fields: [{ name: '_id' }, { name: 'customerId' }, { name: 'items' }] },
  { collectionName: 'customers', fields: [{ name: '_id' }, { name: 'name' }] }
]);

const ordersCleaned = cleanedMappings.find(m => m.collectionName === 'orders');
const itemsField = ordersCleaned.fields.find(f => f.sourceField === 'items');
assert.strictEqual(itemsField.foreignKeyToParent, undefined, 'Circular FK on isChildTable was cleanly stripped');
console.log('✅ Test 1 Passed: Circular foreign key stripped on items field');

// Test 2: Sort order automatically injected
const sortOrderField = ordersCleaned.fields.find(f => f.targetColumn === 'sort_order');
assert.ok(sortOrderField, 'sort_order column was injected');
assert.strictEqual(sortOrderField.isNullable, false, 'sort_order is NOT NULL');
console.log('✅ Test 2 Passed: sort_order INTEGER NOT NULL injected for child table');

// Test 3: Sparse dictionary consolidation (catalog.specs unrolled into 9 cols)
const mockRawGeminiWithSparseSpecs = [
  {
    collectionName: 'catalog',
    targetTableName: 'catalog',
    fields: [
      { sourceField: '_id', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false },
      { sourceField: 'specs.cpu', targetColumn: 'specs_cpu', targetType: 'TEXT', isNullable: true },
      { sourceField: 'specs.gpu', targetColumn: 'specs_gpu', targetType: 'TEXT', isNullable: true },
      { sourceField: 'specs.ram', targetColumn: 'specs_ram', targetType: 'TEXT', isNullable: true },
      { sourceField: 'specs.roast_level', targetColumn: 'specs_roast_level', targetType: 'TEXT', isNullable: true }
    ],
    childTables: []
  }
];

const cleanedCatalog = runAiGuardrails(mockRawGeminiWithSparseSpecs, [
  { collectionName: 'catalog', fields: [{ name: '_id' }, { name: 'specs', bsonType: 'object' }] }
]);

const catalogCleaned = cleanedCatalog.find(m => m.collectionName === 'catalog');
assert.strictEqual(catalogCleaned.fields.some(f => f.targetColumn === 'specs_cpu'), false, 'Sparse columns removed');
const consolidatedSpecs = catalogCleaned.fields.find(f => f.targetColumn === 'specs');
assert.ok(consolidatedSpecs, 'Consolidated specs column created');
assert.strictEqual(consolidatedSpecs.targetType, 'JSONB', 'Consolidated specs is JSONB');
console.log('✅ Test 3 Passed: Sparse specs dictionary consolidated back to JSONB');

// Test 4: Identifier sanitization (event-code -> event_code)
const mockRawWithHyphen = [
  {
    collectionName: 'analytics',
    targetTableName: 'analytics',
    fields: [
      { sourceField: '_id', targetColumn: 'id', targetType: 'VARCHAR(24)', isNullable: false },
      { sourceField: 'event-code', targetColumn: 'event-code', targetType: 'TEXT', isNullable: false }
    ],
    childTables: []
  }
];

const cleanedAnalytics = runAiGuardrails(mockRawWithHyphen, [
  { collectionName: 'analytics', fields: [{ name: '_id' }, { name: 'event-code' }] }
]);

const eventCodeField = cleanedAnalytics[0].fields.find(f => f.sourceField === 'event-code');
assert.strictEqual(eventCodeField.targetColumn, 'event_code', 'Hyphens sanitized to underscores');
console.log('✅ Test 4 Passed: Hyphenated identifier sanitized to event_code');

console.log('\n🎉 ALL 4 AI GUARDRAIL TESTS PASSED 100%!');
