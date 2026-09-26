import type {
  SourceSchema,
  FieldDefinition,
  CollectionMapping,
  FieldMapping,
  IndexMapping,
} from '@migrateiq/shared';
import { randomUUID } from 'crypto';

/**
 * Converts a camelCase or dot-notation field name to PostgreSQL-idiomatic snake_case.
 * Examples:
 *   customerName  → customer_name
 *   orderDate     → order_date
 *   address.city  → address_city
 *   inStock       → in_stock
 */
function toSnakeCase(str: string): string {
  let s = str
    .replace(/\./g, '_')                    // dot notation → underscore
    .replace(/[-\s]+/g, '_')                 // hyphens & spaces → underscore
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // camelCase → snake_case
    .replace(/[^a-zA-Z0-9_]/g, '_')          // any other symbol → underscore
    .toLowerCase()
    .replace(/_+/g, '_')                     // collapse multiple underscores
    .replace(/^_|_$/g, '');                  // trim leading/trailing underscores

  if (/^[0-9]/.test(s)) {
    s = `col_${s}`;
  }
  return s || 'col';
}

/**
 * Official PostgreSQL reserved keywords that cause syntax errors when used unquoted.
 */
export const PG_RESERVED_WORDS = new Set([
  'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc', 'asymmetric',
  'both', 'case', 'cast', 'check', 'collate', 'column', 'constraint', 'create',
  'current_catalog', 'current_date', 'current_role', 'current_time', 'current_timestamp',
  'current_user', 'default', 'deferrable', 'desc', 'distinct', 'do', 'else', 'end',
  'except', 'false', 'fetch', 'for', 'foreign', 'from', 'grant', 'group', 'having',
  'in', 'initially', 'intersect', 'into', 'lateral', 'leading', 'limit', 'localtime',
  'localtimestamp', 'not', 'null', 'offset', 'on', 'only', 'or', 'order', 'placing',
  'primary', 'references', 'returning', 'select', 'session_user', 'some', 'symmetric',
  'table', 'then', 'to', 'trailing', 'true', 'union', 'unique', 'user', 'using',
  'variadic', 'when', 'where', 'window', 'with'
]);

/**
 * Sanitizes an identifier to prevent PostgreSQL reserved keyword collisions.
 * e.g., table 'user' → 'users', column 'order' → 'order_col'
 */
export function sanitizePostgresIdentifier(str: string, isTable = false): string {
  const snake = toSnakeCase(str);
  if (PG_RESERVED_WORDS.has(snake.toLowerCase())) {
    return isTable ? `${snake}s` : `${snake}_col`;
  }
  return snake;
}

/**
 * Rule Engine — Pure TypeScript Schema Mapping (No AI)
 * 
 * Maps MongoDB BSON types to PostgreSQL types using deterministic rules.
 * Used as fallback when AI is unavailable or API key is missing.
 */

/**
 * Generate schema mapping from MongoDB schema OR from PostgreSQL schema using predefined rules.
 * Auto-detects the mapping direction based on the field types in the schema.
 */
export function generateMappingByRules(schemas: SourceSchema[], direction?: 'mongodb-to-postgres' | 'postgres-to-mongo'): CollectionMapping[] {
  const mappings: CollectionMapping[] = schemas.map((schema) => {
    // If direction is not specified, guess based on whether the first field is BSON-like or SQL-like
    let mapFunc = mapFieldToPostgres;
    if (direction === 'postgres-to-mongo') {
      // For PostgreSQL → MongoDB, source fields are SQL types that should be mapped to BSON
      mapFunc = (field: FieldDefinition) => {
        // Use sqlType if available (PostgreSQL introspection path) or fall back to bsonType
        const rawSql = field.sqlType || field.bsonType;
        const bsonType = postgresTypeToBsonType(rawSql, field);
        return {
          id: field.name, // Use field name as ID (will be randomized by caller if needed)
          sourceField: field.name,
          sourceType: rawSql, // SQL type (e.g. SERIAL, VARCHAR(100), TIMESTAMP)
          targetColumn: field.name,
          targetType: bsonType, // BSON type (string, int, decimal, date, bool, etc.)
          isNullable: field.isNullable,
          include: true,
          isChildTable: false,
          childTableName: undefined,
          foreignKeyToParent: field.foreignKeyToParent || undefined,
          transformationRule: undefined,
        };
      };
    }

    // Map fields with intelligent subdocument flattening and sort_order injection
    const rawFields: FieldMapping[] = [];

    for (const field of schema.fields) {
      const fieldName = field.name || field.path || 'field';
      const effectiveBsonType = (field.bsonType || 'string').toLowerCase();

      // ── Intelligent Subdocument Flattening (Rule 12) ──
      // If the field is an embedded object with known scalar subfields (e.g. address: { street, city, zipCode, state }),
      // unroll into clean, 1NF relational columns (address_street, address_city, etc.).
      // If the object has dynamic/variable keys (like catalog.specs or dynamic metadata) or no nestedFields, keep as JSONB.
      const isDynamicDict =
        /(?:specs|metadata|attributes|properties|extra|settings|options|tags|payload)/i.test(fieldName) ||
        (field.nestedFields && field.nestedFields.length > 12);

      const hasScalarSubfields =
        field.nestedFields &&
        field.nestedFields.length > 0 &&
        field.nestedFields.every((nf) => {
          const t = (nf.bsonType || '').toLowerCase();
          return t !== 'arrayofobjects' && t !== 'object' && t !== 'array';
        });

      if (direction !== 'postgres-to-mongo' && effectiveBsonType === 'object' && hasScalarSubfields && !isDynamicDict) {
        for (const subField of field.nestedFields!) {
          const subSourceField = `${fieldName}.${subField.name}`;
          const subTargetColumn = sanitizePostgresIdentifier(`${fieldName}_${subField.name}`, false);
          const subTargetType = bsonTypeToPostgresType(subField.bsonType || 'string', subField);

          rawFields.push({
            id: randomUUID(),
            sourceField: subSourceField,
            sourceType: subField.bsonType || 'string',
            targetColumn: subTargetColumn,
            targetType: subTargetType,
            isNullable: (field.isNullable || subField.isNullable) ?? true,
            include: true,
            isChildTable: false,
            childTableName: undefined,
            foreignKeyToParent: undefined,
            transformationRule: 'flatten',
          });
        }
        continue;
      }

      // Standard field mapping
      const mapping = mapFunc(field, schema.collectionName);
      if (!mapping.id || mapping.id === field.name) {
        mapping.id = randomUUID();
      }
      rawFields.push(mapping);
    }

    // After mapping, inject sort_order column immediately after each child-table row (AGENTS.md §4)
    const fields: FieldMapping[] = [];
    for (const mapping of rawFields) {
      fields.push(mapping);
      if (mapping.isChildTable && mapping.childTableName) {
        // AGENTS.md §4 — Array → Child Table Rule:
        // Always add sort_order INTEGER NOT NULL to preserve original array element ordering.
        // Value is set to 0-based index during ETL. User may rename or exclude this column.
        fields.push({
          id: randomUUID(),
          sourceField: 'sort_order',
          sourceType: 'auto',
          targetColumn: 'sort_order',
          targetType: 'INTEGER',
          isNullable: false,
          include: true,
          isChildTable: false,
          childTableName: undefined,
          foreignKeyToParent: undefined,
          sortOrderColumn: true,
          transformationRule: 'sort_order',
        });
      }
    }
    const fieldsWithSortOrder = fields;

    // Auto-generate indexes (basic mappings only)
    const indexes: IndexMapping[] = [];
    if (schema.indexes) {
      schema.indexes.forEach((idx, i) => {
        const fieldNames = Object.keys(idx.fields);
        const targetIndexName = `idx_${schema.collectionName}_${fieldNames.join('_')}`.substring(0, 63);
        
        let sql = '';
        if (direction === 'postgres-to-mongo') {
          const keysJson = JSON.stringify(idx.fields && Object.keys(idx.fields).length > 0 ? idx.fields : { [fieldNames[0] || 'id']: 1 });
          sql = `db.${schema.collectionName}.createIndex(${keysJson}${idx.unique ? ', { unique: true }' : ''});`;
        } else if (idx.unique) {
          sql = `ALTER TABLE "${schema.collectionName}" ADD CONSTRAINT "${targetIndexName}" UNIQUE (${fieldNames.map(f => `"${f}"`).join(', ')});`;
        } else {
          sql = `CREATE INDEX CONCURRENTLY "${targetIndexName}" ON "${schema.collectionName}" (${fieldNames.map(f => `"${f}"`).join(', ')});`;
        }

        indexes.push({
          sourceIndexName: idx.name || `index_${i}`,
          targetIndexName,
          targetSql: sql,
          include: true,
          isConcurrently: !idx.unique,
          isGin: idx.isGinCandidate || false,
        });
      });
    }

    return {
      collectionName: schema.collectionName,
      targetTableName: sanitizePostgresIdentifier(schema.collectionName, true),
      fields: fieldsWithSortOrder,
      indexes,
      childTables: [], // Child tables for array-of-objects handled separately
    };
  });

  // ── Universal Cross-Collection Foreign Key Graph Discovery ──
  // If collection A has a field referencing collection B (e.g., customerId or customer_id in orders pointing to customers),
  // infer foreignKeyToParent: "customers.id"
  const collectionNames = new Set(mappings.map((m) => m.collectionName.toLowerCase()));
  const collectionTargetTableMap = new Map<string, string>();
  mappings.forEach((m) => collectionTargetTableMap.set(m.collectionName.toLowerCase(), m.targetTableName));

  for (const m of mappings) {
    const currentTableLower = m.collectionName.toLowerCase();
    for (const f of m.fields) {
      if (f.isChildTable || f.sortOrderColumn || f.sourceField === '_id' || f.foreignKeyToParent) {
        continue;
      }

      const match = f.sourceField.match(/^([a-zA-Z0-9]+?)(?:_id|Id)$/i);
      if (match) {
        const entityPrefix = match[1].toLowerCase();
        const candidate1 = entityPrefix + 's';
        const candidate2 = entityPrefix.endsWith('y') ? entityPrefix.slice(0, -1) + 'ies' : entityPrefix + 'es';
        const candidate3 = entityPrefix;

        let referencedCol: string | null = null;
        if (collectionNames.has(candidate1) && candidate1 !== currentTableLower) {
          referencedCol = candidate1;
        } else if (collectionNames.has(candidate2) && candidate2 !== currentTableLower) {
          referencedCol = candidate2;
        } else if (collectionNames.has(candidate3) && candidate3 !== currentTableLower) {
          referencedCol = candidate3;
        }

        if (referencedCol) {
          const targetTable = collectionTargetTableMap.get(referencedCol) || referencedCol;
          f.foreignKeyToParent = `${targetTable}.id`;
        }
      }
    }
  }

  return mappings;
}

/**
 * Map a single MongoDB field to a PostgreSQL column
 */
function mapFieldToPostgres(field: FieldDefinition, collectionName: string): FieldMapping {
  // Use path (dot-notation) if available, otherwise name; fall back to 'field'
  const fieldName = field.name || field.path || 'field';
  // Use bsonType directly; sqlType is only present on PostgreSQL-sourced fields
  const effectiveBsonType = field.bsonType || 'string';
  const targetType = bsonTypeToPostgresType(effectiveBsonType, field);
  
  // Flatten nested field names and guard against PostgreSQL reserved words
  const targetColumn = sanitizePostgresIdentifier(fieldName, false);

  // Detect if this is an array of objects (requires child table)
  const isChildTable = effectiveBsonType === 'arrayOfObjects';

  return {
    id: randomUUID(),
    sourceField: fieldName,
    sourceType: effectiveBsonType,
    targetColumn,
    targetType,
    isNullable: field.isNullable ?? true,
    include: true,
    isChildTable,
    childTableName: isChildTable ? `${collectionName}_${targetColumn}` : undefined,
    foreignKeyToParent: isChildTable ? `${collectionName}_id` : undefined,
    transformationRule: effectiveBsonType === 'object' ? 'jsonb' : undefined,
  };
}

/**
 * Map a single PostgreSQL field to a MongoDB field
 * (Reserved for future Phase 6 implementation)
 */
// function mapFieldToMongoDB(field: FieldDefinition, collectionName: string): FieldMapping {
//   const targetType = postgresTypeToBsonType(field.bsonType, field);
//   return {
//     id: randomUUID(),
//     sourceField: field.name,
//     sourceType: field.bsonType,
//     targetColumn: field.name,
//     targetType,
//     isNullable: field.isNullable,
//     include: true,
//     isChildTable: false,
//     childTableName: undefined,
//     foreignKeyToParent: undefined,
//     transformationRule: field.bsonType === 'JSONB' ? 'embedded' : undefined,
//   };
// }

/**
 * Core BSON → PostgreSQL type mapping rules
 */
function bsonTypeToPostgresType(bsonType: string, field: FieldDefinition): string {
  const typeStr = (bsonType || field.bsonType || 'string').toLowerCase();
  const lowerName = (field.name || '').toLowerCase();

  switch (typeStr) {
    // ── Core Types ──
    case 'objectid':
      return 'VARCHAR(24)'; // 12-byte ObjectId as hex string

    case 'string':
      if (lowerName.includes('email')) return 'VARCHAR(255)';
      if (lowerName === 'status' || lowerName.endsWith('_status') || lowerName.endsWith('tier') || lowerName.endsWith('type')) {
        return 'VARCHAR(50)';
      }
      return 'TEXT'; // Default for strings

    case 'int':
    case 'int32':
    case 'numberint':
      // Detect Unix epoch timestamps, millisecond counters, and large byte sizes
      if (
        lowerName.includes('timestamp') ||
        lowerName.includes('epoch') ||
        lowerName.endsWith('_ms') ||
        lowerName.endsWith('_bytes') ||
        lowerName.includes('filesize')
      ) {
        return 'BIGINT';
      }
      // Check sampled values for 32-bit integer overflow ceiling
      if (
        field.sampleValues &&
        field.sampleValues.some((v) => typeof v === 'number' && (v > 2147483647 || v < -2147483648))
      ) {
        return 'BIGINT';
      }
      return 'INTEGER'; // 32-bit signed integer

    case 'long':
    case 'int64':
    case 'numberlong':
      return 'BIGINT'; // 64-bit signed integer

    case 'double':
    case 'numberdouble':
      // Financial precision: amounts, prices, fees must use exact NUMERIC to prevent IEEE-754 rounding drift
      if (/(?:amount|price|cost|balance|total|fee|revenue|salary)/i.test(lowerName)) {
        return 'NUMERIC(14,2)';
      }
      return 'DOUBLE PRECISION'; // IEEE 754 floating point

    case 'decimal':
    case 'decimal128':
    case 'numberdecimal':
      return 'NUMERIC(18,4)'; // High-precision decimal (suitable for money)

    case 'bool':
    case 'boolean':
      return 'BOOLEAN'; // True/False

    case 'date':
    case 'timestamp':
    case 'isodate':
      return 'TIMESTAMPTZ'; // Always use timezone-aware timestamps

    // ── Binary Types ──
    case 'binary':
    case 'bindata':
      return 'BYTEA'; // Raw binary data as hex

    case 'uuid':
      return 'UUID'; // Native PostgreSQL UUID type

    // ── Array Types ──
    case 'array':
      // Infer array element type from nestedFields (first element's bsonType)
      if (field.nestedFields && field.nestedFields.length > 0) {
        const innerType = field.nestedFields[0]?.bsonType?.toLowerCase();
        if (innerType === 'string') return 'TEXT[]';
        if (innerType === 'int' || innerType === 'int32' || innerType === 'numberint') return 'INTEGER[]';
      }
      return 'JSONB'; // Default: store array as JSON

    case 'arrayofobjects':
      return 'CHILD_TABLE'; // Signal that this needs a separate table

    // ── Complex Types ──
    case 'object':
    case 'embedded':
      // Embedded objects not eligible for scalar flattening default to JSONB with GIN index
      return 'JSONB';

    case 'mixed':
      // Polymorphic scalar handling: if field name or sample values indicate scalar data (phone, codes, IDs),
      // map to TEXT with automatic string coercion rather than awkward JSONB.
      if (
        /(?:phone|mobile|contact|code|id|ref|status|zip|pin)/i.test(lowerName) ||
        (field.sampleValues && field.sampleValues.every((v) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'))
      ) {
        return 'TEXT';
      }
      return 'JSONB'; // Complex polymorphic structures stored as JSON

    case 'null':
      return 'TEXT'; // NULL defaults to TEXT (nullable)

    // ── Geospatial ──
    case 'geojson':
    case 'point':
      return 'JSONB'; // Store GeoJSON as JSON (PostGIS alternative: geometry(Point,4326))

    // ── Fallback ──
    default:
      console.warn(`Unknown BSON type "${bsonType}" for field "${field.name}" — defaulting to JSONB`);
      return 'JSONB';
  }
}

/**
 * Core PostgreSQL → MongoDB (BSON) type mapping rules (reverse direction)
 */
function postgresTypeToBsonType(postgresType: string, field: FieldDefinition): string {
  const type = (postgresType || '').toUpperCase().trim();

  // ── Core Text / String Types ──
  if (type.startsWith('VARCHAR') || type.startsWith('CHARACTER') || type.includes('CHAR')) return 'string';
  if (type === 'TEXT' || type === 'CITEXT' || type === 'XML' || type === 'NAME') return 'string';
  if (type === 'USER-DEFINED' || type.includes('ENUM')) return 'string';
  
  // ── Integer Types ──
  if (type === 'SMALLINT' || type === 'INT2') return 'int';
  if (type === 'INTEGER' || type === 'INT' || type === 'INT4' || type === 'OID') return 'int';
  if (type === 'BIGINT' || type === 'INT8') return 'long';
  if (type === 'SERIAL' || type === 'SERIAL2' || type === 'SERIAL4') return 'int';
  if (type === 'BIGSERIAL' || type === 'SERIAL8') return 'long';
  
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
  
  // ── Array Types ──
  if (type.includes('[]') || type.startsWith('ARRAY')) return 'array';
  
  // ── JSON / Complex Object Types ──
  if (type === 'JSONB' || type === 'JSON') return 'object';
  
  // ── Full-Text Search Types ──
  if (type === 'TSVECTOR' || type === 'TSQUERY') return 'string';
  
  // ── Geometric Types (PostGIS / Native Postgres Geometry) ──
  if (type.includes('GEOMETRY') || type.includes('GEOGRAPHY') || 
      ['POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE'].includes(type)) {
    return 'object';
  }
  
  // ── Universal Fallback ──
  console.warn(`PostgreSQL type "${postgresType}" mapped with default string for field "${field.name}"`);
  return 'string';
}

/**
 * Generate a human-readable summary of the mapping rules
 * (Used for the Data Type Reference Panel in the UI)
 */
export function getMappingRulesSummary(): Array<{
  bson: string;
  postgres: string;
  notes: string;
}> {
  return [
    {
      bson: 'ObjectId (12-byte)',
      postgres: 'VARCHAR(24)',
      notes: 'Stored as 24-character hex string. Use as primary key or foreign key.',
    },
    {
      bson: 'String (UTF-8)',
      postgres: 'TEXT',
      notes: 'Default for all string fields. Use VARCHAR(N) if you know max length.',
    },
    {
      bson: 'NumberInt (32-bit)',
      postgres: 'INTEGER',
      notes: 'Direct 1:1 mapping for 32-bit signed integers.',
    },
    {
      bson: 'NumberLong (64-bit)',
      postgres: 'BIGINT',
      notes: 'Use BIGINT to avoid JavaScript precision loss on large numbers.',
    },
    {
      bson: 'Double (float)',
      postgres: 'DOUBLE PRECISION',
      notes: 'IEEE 754 floating point. Never use for money.',
    },
    {
      bson: 'Decimal128',
      postgres: 'NUMERIC(18,4)',
      notes: 'Preserves full precision. Always use for currency values.',
    },
    {
      bson: 'ISODate / Date',
      postgres: 'TIMESTAMPTZ',
      notes: 'Always use TIMESTAMPTZ (timezone-aware). Never plain TIMESTAMP.',
    },
    {
      bson: 'Boolean',
      postgres: 'BOOLEAN',
      notes: 'Direct TRUE/FALSE mapping.',
    },
    {
      bson: 'Binary (UUID subtype)',
      postgres: 'UUID',
      notes: 'Converted to standard 36-char hyphenated UUID.',
    },
    {
      bson: 'Binary (generic)',
      postgres: 'BYTEA',
      notes: 'Raw binary data stored as hex. Use for images, PDFs, etc.',
    },
    {
      bson: 'Array of Strings/Ints',
      postgres: 'TEXT[] or INTEGER[]',
      notes: 'Native PostgreSQL array types.',
    },
    {
      bson: 'Array of Objects',
      postgres: 'Separate child table + FK',
      notes: 'Cannot store as column. Creates a child table with foreign key.',
    },
    {
      bson: 'Nested Object (1–2 levels)',
      postgres: 'Flattened columns',
      notes: 'e.g., address.city → address_city (separate columns).',
    },
    {
      bson: 'Nested Object (3+ levels)',
      postgres: 'JSONB',
      notes: 'Too deep to flatten cleanly. Use JSONB with GIN index.',
    },
    {
      bson: 'null / missing field',
      postgres: 'NULL column',
      notes: 'Column must allow NULL. Never use NOT NULL without a default.',
    },
    {
      bson: 'GeoJSON Point',
      postgres: 'JSONB',
      notes: 'Store as JSON. Alternative: PostGIS geometry(Point,4326) if extension enabled.',
    },
  ];
}

/**
 * Generate human-readable summary of PostgreSQL → MongoDB mapping rules
 */
export function getPostgresToMongoRulesSummary(): Array<{
  postgres: string;
  bson: string;
  notes: string;
}> {
  return [
    {
      postgres: 'VARCHAR(n), TEXT, CHAR',
      bson: 'string',
      notes: 'Standard UTF-8 string. Preserves text data with no length limits.',
    },
    {
      postgres: 'SMALLINT, INTEGER, INT, SERIAL',
      bson: 'int',
      notes: '32-bit signed integer (BSON int32).',
    },
    {
      postgres: 'BIGINT, BIGSERIAL',
      bson: 'long',
      notes: '64-bit signed integer (BSON int64) to prevent JavaScript precision loss.',
    },
    {
      postgres: 'NUMERIC(p,s), DECIMAL',
      bson: 'decimal',
      notes: 'BSON Decimal128 for high-precision arithmetic (currency / financial data).',
    },
    {
      postgres: 'REAL, DOUBLE PRECISION, FLOAT',
      bson: 'double',
      notes: '64-bit IEEE 754 floating-point number.',
    },
    {
      postgres: 'BOOLEAN, BOOL',
      bson: 'bool',
      notes: 'Direct 1:1 true/false boolean.',
    },
    {
      postgres: 'TIMESTAMP, TIMESTAMPTZ, DATE, TIME',
      bson: 'date',
      notes: 'BSON UTC datetime / ISO-8601.',
    },
    {
      postgres: 'BYTEA, BLOB',
      bson: 'binData',
      notes: 'Raw binary data (BSON subtype 0).',
    },
    {
      postgres: 'UUID',
      bson: 'objectId / string',
      notes: 'Stored as BSON UUID or standard 36-char string.',
    },
    {
      postgres: 'JSONB, JSON',
      bson: 'object',
      notes: 'Stored directly as native embedded BSON document/object.',
    },
    {
      postgres: '<type>[] (PostgreSQL Array)',
      bson: 'array',
      notes: 'Stored directly as native BSON array.',
    },
    {
      postgres: 'Primary Key (id)',
      bson: 'int / objectId',
      notes: 'Can remain integer ID or be mapped to standard MongoDB _id.',
    },
    {
      postgres: 'Foreign Key (1:N relations)',
      bson: 'Embedded Array / Referenced ID',
      notes: 'Can be embedded as an array of subdocuments or preserved as referenced ID.',
    },
  ];
}

