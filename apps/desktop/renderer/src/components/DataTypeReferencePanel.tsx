import React, { useState } from 'react';

export interface DataTypeReferencePanelProps {
  direction?: 'mongodb-to-postgres' | 'postgres-to-mongo';
}

const MONGO_TO_PG_MAPPINGS = [
  {
    source: 'ObjectId (12-byte)',
    target: 'VARCHAR(24)',
    notes: 'Stored as 24-character hex string. Use as primary key or foreign key.',
  },
  {
    source: 'String (UTF-8)',
    target: 'TEXT',
    notes: 'Default for all string fields. Use VARCHAR(N) if you know max length.',
  },
  {
    source: 'NumberInt (32-bit)',
    target: 'INTEGER',
    notes: 'Direct 1:1 mapping for 32-bit signed integers.',
  },
  {
    source: 'NumberLong (64-bit)',
    target: 'BIGINT',
    notes: 'Use BIGINT to avoid JavaScript precision loss on large numbers.',
  },
  {
    source: 'Double (float)',
    target: 'DOUBLE PRECISION',
    notes: 'IEEE 754 floating point. Never use for money.',
  },
  {
    source: 'Decimal128',
    target: 'NUMERIC(18,4)',
    notes: 'Preserves full precision. Always use for currency values.',
  },
  {
    source: 'ISODate / Date',
    target: 'TIMESTAMPTZ',
    notes: 'Always use TIMESTAMPTZ (timezone-aware). Never plain TIMESTAMP.',
  },
  {
    source: 'Boolean',
    target: 'BOOLEAN',
    notes: 'Direct TRUE/FALSE mapping.',
  },
  {
    source: 'Binary (UUID subtype)',
    target: 'UUID',
    notes: 'Converted to standard 36-char hyphenated UUID.',
  },
  {
    source: 'Binary (generic)',
    target: 'BYTEA',
    notes: 'Raw binary data stored as hex. Use for images, PDFs, etc.',
  },
  {
    source: 'Array of Strings/Ints',
    target: 'TEXT[] or INTEGER[]',
    notes: 'Native PostgreSQL array types.',
  },
  {
    source: 'Array of Objects',
    target: 'Separate child table + FK',
    notes: 'Cannot store as column. Creates a child table with foreign key.',
  },
  {
    source: 'Nested Object (1–2 levels)',
    target: 'Flattened columns',
    notes: 'e.g., address.city → address_city (separate columns).',
  },
  {
    source: 'Nested Object (3+ levels)',
    target: 'JSONB',
    notes: 'Too deep to flatten cleanly. Use JSONB with GIN index.',
  },
  {
    source: 'null / missing field',
    target: 'NULL column',
    notes: 'Column must allow NULL. Never use NOT NULL without a default.',
  },
  {
    source: 'GeoJSON Point',
    target: 'JSONB',
    notes: 'Store as JSON. Alternative: PostGIS geometry(Point,4326) if extension enabled.',
  },
];

const PG_TO_MONGO_MAPPINGS = [
  {
    source: 'VARCHAR(n), TEXT, CHAR',
    target: 'string',
    notes: 'Standard UTF-8 string in MongoDB. Preserves text data with no truncation.',
  },
  {
    source: 'SMALLINT, INTEGER, INT, SERIAL',
    target: 'int',
    notes: '32-bit signed integer (BSON int32). Direct 1:1 mapping.',
  },
  {
    source: 'BIGINT, BIGSERIAL',
    target: 'long',
    notes: '64-bit signed integer (BSON int64) to prevent precision loss.',
  },
  {
    source: 'NUMERIC(p,s), DECIMAL',
    target: 'decimal',
    notes: 'BSON Decimal128 for high-precision arithmetic (currency / financial data).',
  },
  {
    source: 'REAL, FLOAT4, DOUBLE PRECISION, FLOAT8',
    target: 'double',
    notes: '64-bit IEEE 754 floating-point number.',
  },
  {
    source: 'BOOLEAN, BOOL',
    target: 'bool',
    notes: 'Direct 1:1 true/false boolean.',
  },
  {
    source: 'TIMESTAMP, TIMESTAMPTZ, DATE, TIME',
    target: 'date',
    notes: 'Stored as BSON UTC datetime / ISO-8601.',
  },
  {
    source: 'BYTEA, BLOB',
    target: 'binData',
    notes: 'Raw binary data stored as BSON subtype 0.',
  },
  {
    source: 'UUID',
    target: 'objectId / string',
    notes: 'Stored as standard 36-char string or BSON UUID subtype 4.',
  },
  {
    source: 'JSONB, JSON',
    target: 'object',
    notes: 'Stored directly as native embedded BSON document/object.',
  },
  {
    source: '<type>[] (PostgreSQL Array)',
    target: 'array',
    notes: 'Stored directly as native BSON array.',
  },
  {
    source: 'Primary Key (id)',
    target: 'int / objectId',
    notes: 'Can remain integer ID or be mapped to standard MongoDB _id.',
  },
  {
    source: 'Foreign Key (1:N relations)',
    target: 'Embedded Array / Referenced ID',
    notes: 'Can be denormalized into embedded subdocument arrays or preserved as referenced ID.',
  },
];

export const DataTypeReferencePanel: React.FC<DataTypeReferencePanelProps> = ({
  direction = 'mongodb-to-postgres',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPgToMongo = direction === 'postgres-to-mongo';
  const mappings = isPgToMongo ? PG_TO_MONGO_MAPPINGS : MONGO_TO_PG_MAPPINGS;

  return (
    <div
      style={{
        marginTop: '2rem',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header (clickable toggle) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-sidebar)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          transition: 'background-color 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#E2E8F0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-sidebar)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary, #2563EB)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>
            {isPgToMongo
              ? 'Data Type Reference — PostgreSQL → MongoDB Mapping Rules'
              : 'Data Type Reference — MongoDB → PostgreSQL Mapping Rules'}
          </span>
        </div>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {isExpanded ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>

      {/* Content (collapsible) */}
      {isExpanded && (
        <div style={{ padding: '1.5rem' }}>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              margin: '0 0 1rem 0',
              lineHeight: 1.5,
            }}
          >
            {isPgToMongo
              ? 'Use this reference to understand how PostgreSQL SQL types are converted to MongoDB BSON types. You can override any data type in the mapper above by clicking the dropdown.'
              : 'Use this reference to understand how MongoDB BSON types are converted to PostgreSQL. You can override any data type in the mapper above by clicking the dropdown.'}
          </p>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {isPgToMongo ? 'PostgreSQL (SQL) Type' : 'MongoDB (BSON) Type'}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {isPgToMongo ? 'Maps To (MongoDB BSON)' : 'Maps To (PostgreSQL)'}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((row, i) => (
                <tr key={i}>
                  <td
                    style={{
                      padding: '0.625rem 0.75rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {row.source}
                  </td>
                  <td
                    style={{
                      padding: '0.625rem 0.75rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: '#2563EB',
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                    }}
                  >
                    {row.target}
                  </td>
                  <td
                    style={{
                      padding: '0.625rem 0.75rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '0.8125rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

