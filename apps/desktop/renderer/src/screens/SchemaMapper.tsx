import React, { useState, useRef, useEffect } from 'react';
import type { CollectionMapping, FieldMapping, IndexMapping, MappingBadge, SourceSchema } from '@migrateiq/shared';
import { DataTypeReferencePanel } from '../components/DataTypeReferencePanel';
import '../styles/schema-mapper.css';

export interface SchemaMapperProps {
  initialMappings: CollectionMapping[];
  badge: MappingBadge;
  sourceSchema?: SourceSchema[] | null;
  direction?: 'mongodb-to-postgres' | 'postgres-to-mongo';
  onSave: (mappings: CollectionMapping[]) => void;
  onBack: () => void;
  onRegenerate?: () => void;
}

export const POSTGRES_TYPES = [
  'TEXT',
  'VARCHAR(24)',
  'VARCHAR(50)',
  'VARCHAR(100)',
  'VARCHAR(255)',
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'DOUBLE PRECISION',
  'NUMERIC(18,4)',
  'BOOLEAN',
  'TIMESTAMPTZ',
  'DATE',
  'TIME',
  'BYTEA',
  'UUID',
  'JSONB',
  'TEXT[]',
  'INTEGER[]',
];

export const BSON_TYPES = [
  'string',
  'int',
  'long',
  'double',
  'decimal',
  'bool',
  'date',
  'objectId',
  'object',
  'array',
  'binData',
];

/**
 * Generates MongoDB $jsonSchema validation script and Mongoose models for PostgreSQL -> MongoDB direction.
 */
function generateMongoValidationScript(mappings: CollectionMapping[]): string {
  const lines: string[] = [
    '// ─────────────────────────────────────────────────────────────',
    '// MigrateIQ - Generated MongoDB Schema & Collection Validators',
    `// Generated on: ${new Date().toLocaleString()}`,
    '// Direction: PostgreSQL → MongoDB (Workflow B)',
    '// ─────────────────────────────────────────────────────────────',
    '',
    '// 1. Mongoose Model Definitions',
    "const mongoose = require('mongoose');",
    '',
  ];

  for (const col of mappings) {
    const modelName = col.targetTableName.charAt(0).toUpperCase() + col.targetTableName.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    lines.push(`// Model: ${modelName} (Source table: "${col.collectionName}")`);
    lines.push(`const ${modelName}Schema = new mongoose.Schema({`);

    for (const f of col.fields) {
      if (!f.include) continue;
      let mType = 'String';
      if (f.targetType === 'int' || f.targetType === 'long') mType = 'Number';
      else if (f.targetType === 'double') mType = 'Number';
      else if (f.targetType === 'decimal') mType = 'mongoose.Schema.Types.Decimal128';
      else if (f.targetType === 'bool') mType = 'Boolean';
      else if (f.targetType === 'date') mType = 'Date';
      else if (f.targetType === 'objectId') mType = 'mongoose.Schema.Types.ObjectId';
      else if (f.targetType === 'object') mType = 'Object';
      else if (f.targetType === 'array') mType = '[String]';
      else if (f.targetType === 'binData') mType = 'Buffer';

      const req = !f.isNullable ? ', required: true' : '';
      const ref = f.foreignKeyToParent ? `, ref: '${f.foreignKeyToParent.split('.')[0]}'` : '';
      lines.push(`  ${f.targetColumn}: { type: ${mType}${req}${ref} },`);
    }
    lines.push('}, { timestamps: true });');
    lines.push(`const ${modelName} = mongoose.model('${modelName}', ${modelName}Schema);`);
    lines.push('');
  }

  lines.push('// ─────────────────────────────────────────────────────────────');
  lines.push('// 2. MongoDB Native $jsonSchema Collection Validation Script');
  lines.push('// ─────────────────────────────────────────────────────────────');
  lines.push('');

  for (const col of mappings) {
    lines.push(`// Collection: "${col.targetTableName}"`);
    lines.push(`db.createCollection("${col.targetTableName}", {`);
    lines.push('  validator: {');
    lines.push('    $jsonSchema: {');
    lines.push("      bsonType: 'object',");

    const requiredFields = col.fields
      .filter((f) => f.include && !f.isNullable && f.targetColumn !== 'id')
      .map((f) => `"${f.targetColumn}"`);

    if (requiredFields.length > 0) {
      lines.push(`      required: [${requiredFields.join(', ')}],`);
    }

    lines.push('      properties: {');
    for (const f of col.fields) {
      if (!f.include) continue;
      const bType = f.targetType === 'objectId' ? 'objectId' : f.targetType || 'string';
      lines.push(`        "${f.targetColumn}": {`);
      lines.push(`          bsonType: "${bType}",`);
      lines.push(`          description: "Mapped from PostgreSQL ${col.collectionName}.${f.sourceField} (${f.sourceType})"`);
      lines.push('        },');
    }
    lines.push('      }');
    lines.push('    }');
    lines.push('  }');
    lines.push('});');
    lines.push('');
  }

  // 3. MongoDB Collection Indexes (if any)
  const allIndexes = mappings.flatMap((col) =>
    (col.indexes || []).filter((idx) => idx.include).map((idx) => ({ col, idx }))
  );

  if (allIndexes.length > 0) {
    lines.push('// ─────────────────────────────────────────────────────────────');
    lines.push('// 3. MongoDB Collection Indexes');
    lines.push('// ─────────────────────────────────────────────────────────────');
    lines.push('');
    for (const { col, idx } of allIndexes) {
      if (idx.targetSql && idx.targetSql.startsWith('db.')) {
        lines.push(idx.targetSql);
      } else {
        const fieldName = idx.sourceIndexName.replace(/^idx_[^_]+_/, '') || 'id';
        lines.push(`db.${col.targetTableName}.createIndex({ "${fieldName}": 1 });`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates clean PostgreSQL DDL SQL script from the current mapping configuration.
 */
function generatePostgresDdl(mappings: CollectionMapping[], schemas?: SourceSchema[] | null): string {
  const lines: string[] = [
    '--',
    '-- MigrateIQ - Generated PostgreSQL Migration DDL Script',
    `-- Generated on: ${new Date().toLocaleString()}`,
    '--',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    '',
  ];

  for (const col of mappings) {
    lines.push(`-- ─────────────────────────────────────────────────────────────`);
    lines.push(`-- Table: "${col.targetTableName}" (Source: "${col.collectionName}")`);
    lines.push(`-- ─────────────────────────────────────────────────────────────`);
    lines.push(`CREATE TABLE IF NOT EXISTS "${col.targetTableName}" (`);

    const colDefs: string[] = [];
    for (const f of col.fields) {
      if (!f.include) continue;
      if (f.isChildTable) continue; // child tables are created as separate tables below

      const safeColName = f.targetColumn.trim().replace(/\s+/g, '_');
      let def = `  "${safeColName}" ${f.targetType}`;
      if (safeColName === 'id' || f.sourceField === '_id') {
        def += ' PRIMARY KEY';
      } else {
        if (!f.isNullable) def += ' NOT NULL';
        if (f.foreignKeyToParent) {
          const parts = f.foreignKeyToParent.split('.');
          const refTable = parts[0] || 'users';
          const refCol = parts[1] || 'id';
          def += ` REFERENCES "${refTable}"("${refCol}") ON DELETE CASCADE`;
        }
      }
      colDefs.push(def);
    }
    lines.push(colDefs.join(',\n'));
    lines.push(');');
    lines.push('');

    // Child Tables (created for array of objects)
    for (const f of col.fields) {
      if (!f.include || !f.isChildTable || !f.childTableName) continue;
      lines.push(`-- Child Table: "${f.childTableName}" (from ${col.collectionName}.${f.sourceField})`);
      lines.push(`CREATE TABLE IF NOT EXISTS "${f.childTableName}" (`);
      const childDefs: string[] = [
        '  "id" BIGSERIAL PRIMARY KEY',
        `  "${f.foreignKeyToParent || `${col.targetTableName}_id`}" VARCHAR(24) NOT NULL REFERENCES "${col.targetTableName}"("id") ON DELETE CASCADE`,
      ];

      const srcCol = schemas?.find((s) => s.collectionName === col.collectionName);
      const srcField = srcCol?.fields.find((sf) => sf.name === f.sourceField);
      if (srcField?.nestedFields && srcField.nestedFields.length > 0) {
        for (const nf of srcField.nestedFields) {
          const colName = nf.name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
          const pType = nf.bsonType === 'int' ? 'INTEGER' : nf.bsonType === 'double' ? 'DOUBLE PRECISION' : nf.bsonType === 'date' ? 'TIMESTAMPTZ' : 'TEXT';
          childDefs.push(`  "${colName}" ${pType}${nf.isNullable ? '' : ' NOT NULL'}`);
        }
      } else {
        childDefs.push('  "data" JSONB NOT NULL');
      }

      lines.push(childDefs.join(',\n'));
      lines.push(');');
      lines.push('');
    }

    // Indexes
    if (col.indexes && col.indexes.length > 0) {
      for (const idx of col.indexes) {
        if (idx.include && idx.targetSql) {
          lines.push(idx.targetSql);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export const SchemaMapper: React.FC<SchemaMapperProps> = ({
  initialMappings,
  badge,
  sourceSchema,
  direction = 'mongodb-to-postgres',
  onSave,
  onBack,
  onRegenerate,
}) => {
  const isPgToMongo = direction === 'postgres-to-mongo';
  const [mappings, setMappings] = useState<CollectionMapping[]>(initialMappings);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set(initialMappings.map((m) => m.collectionName))
  );

  // Synchronize when initialMappings is updated externally (e.g. from Auto-Fix)
  useEffect(() => {
    if (initialMappings && initialMappings.length > 0) {
      setMappings(initialMappings);
    }
  }, [initialMappings]);

  // Search / Filter and Child Table Expansion State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedChildTables, setExpandedChildTables] = useState<Set<string>>(new Set());
  const [showDdlModal, setShowDdlModal] = useState(false);
  const [copiedDdl, setCopiedDdl] = useState(false);

  // AI Schema Copilot State & History Tracking
  interface TargetField {
    collectionName: string;
    fieldId: string;
    fieldName: string;
    targetColumn: string;
    rowNum: number;
  }

  interface CopilotMessage {
    id: string;
    role: 'user' | 'assistant';
    timestamp: string;
    text: string;
    targets?: TargetField[];
    isQuestion?: boolean;
    changeCount?: number;
    snapshotBefore?: CollectionMapping[];
  }

  const [showCopilotModal, setShowCopilotModal] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<TargetField[]>([]);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [targetSearchQuery, setTargetSearchQuery] = useState('');

  const [tweakPrompt, setTweakPrompt] = useState('');
  const [isTweaking, setIsTweaking] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: "👋 Welcome to your MigrateIQ AI Schema Copilot! You can ask me any questions about your schema design, or instruct me to adjust column types, names, and nullability. Click the 🎯 icon on any row to select targets for simultaneous editing!",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showCopilotModal) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [copilotMessages, isTweaking, showCopilotModal]);

  const aiModifiedCount = mappings.reduce(
    (acc, col) => acc + col.fields.filter((f) => f.isAiModified).length,
    0
  );

  const toggleTargetField = (
    collectionName: string,
    field: FieldMapping,
    rowNum: number
  ) => {
    setSelectedTargets((prev) => {
      const exists = prev.some((t) => t.fieldId === field.id);
      if (exists) {
        return prev.filter((t) => t.fieldId !== field.id);
      } else {
        return [
          ...prev,
          {
            collectionName,
            fieldId: field.id,
            fieldName: field.sourceField,
            targetColumn: field.targetColumn,
            rowNum,
          },
        ];
      }
    });
  };

  const removeTarget = (fieldId: string) => {
    setSelectedTargets((prev) => prev.filter((t) => t.fieldId !== fieldId));
  };

  const clearAllTargets = () => {
    setSelectedTargets([]);
  };

  const handleSendCopilotMessage = async (customPrompt?: string) => {
    const promptText = (customPrompt || tweakPrompt).trim();
    if (!promptText || isTweaking) return;

    // Detect greeting
    const isGreeting = /^(hi+|hello+|hey+|howdy|sup|good\s*(morning|afternoon|evening)|what'?s\s*up|who\s*are\s*you)[\s!?.~]*$/i.test(promptText);

    // Phonetic & voice-to-text typo matching (e.g. 'worker 100', 'varchaer 100')
    let clientTypeOverride: string | null = null;
    if (isPgToMongo) {
      if (/(?:varchaer|worker|varchar|var\s*char|var\s*cher|string|text)/i.test(promptText)) {
        clientTypeOverride = 'string';
      } else if (/\b(object\s*id|uuid|uid)\b/i.test(promptText)) {
        clientTypeOverride = 'objectId';
      } else if (/\b(big\s*int|bigint|long)\b/i.test(promptText)) {
        clientTypeOverride = 'long';
      } else if (/\b(int|integer|numberint|serial)\b/i.test(promptText)) {
        clientTypeOverride = 'int';
      } else if (/\b(double|float|real)\b/i.test(promptText)) {
        clientTypeOverride = 'double';
      } else if (/\b(decimal|numeric|money)\b/i.test(promptText)) {
        clientTypeOverride = 'decimal';
      } else if (/\b(bool|boolean)\b/i.test(promptText)) {
        clientTypeOverride = 'bool';
      } else if (/timestamp|timestamptz|date|time/i.test(promptText)) {
        clientTypeOverride = 'date';
      } else if (/\b(object|jsonb?)\b/i.test(promptText)) {
        clientTypeOverride = 'object';
      } else if (/\b(array|list)\b/i.test(promptText)) {
        clientTypeOverride = 'array';
      } else if (/\b(binary|bytea|bindata)\b/i.test(promptText)) {
        clientTypeOverride = 'binData';
      }
    } else {
      const varcharMatch = promptText.match(/(?:varchaer|worker|varchar|var\s*char|var\s*cher)\s*\(?(\d+)?\)?/i);
      if (varcharMatch) {
        clientTypeOverride = `VARCHAR(${varcharMatch[1] || '100'})`;
      } else if (/\buuid\b/i.test(promptText)) {
        clientTypeOverride = 'UUID';
      } else if (/big\s*int|bigint|long/i.test(promptText)) {
        clientTypeOverride = 'BIGINT';
      } else if (/\b(int|integer|numberint)\b/i.test(promptText)) {
        clientTypeOverride = 'INTEGER';
      } else if (/\b(bool|boolean)\b/i.test(promptText)) {
        clientTypeOverride = 'BOOLEAN';
      } else if (/timestamp|timestamptz|date/i.test(promptText)) {
        clientTypeOverride = 'TIMESTAMPTZ';
      } else if (/numeric|decimal/i.test(promptText)) {
        const numM = promptText.match(/numeric\s*\((\d+,\s*\d+)\)/i);
        clientTypeOverride = numM ? `NUMERIC(${numM[1]})` : 'NUMERIC(18,4)';
      } else if (/\btext\b/i.test(promptText)) {
        clientTypeOverride = 'TEXT';
      } else if (/\bjsonb?\b/i.test(promptText)) {
        clientTypeOverride = 'JSONB';
      }
    }

    let clientNullableOverride: boolean | null = null;
    if (/\b(not\s*null|non-nullable|disallow\s*null|required)\b/i.test(promptText)) {
      clientNullableOverride = false;
    } else if (/\b(nullable|allow\s*null|can\s*be\s*null|optional)\b/i.test(promptText)) {
      clientNullableOverride = true;
    }

    let clientIncludeOverride: boolean | null = null;
    if (/\b(exclude|remove|drop|skip|omit|uncheck)\b/i.test(promptText)) {
      clientIncludeOverride = false;
    } else if (/\b(include|keep|add\s*back|restore)\b/i.test(promptText)) {
      clientIncludeOverride = true;
    }

    const userMsgId = 'msg-' + Date.now();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const snapshotBefore = JSON.parse(JSON.stringify(mappings));

    const userMessage: CopilotMessage = {
      id: userMsgId,
      role: 'user',
      timestamp,
      text: promptText,
      targets: selectedTargets.length > 0 ? [...selectedTargets] : undefined,
    };

    setCopilotMessages((prev) => [...prev, userMessage]);
    setTweakPrompt('');
    setIsTweaking(true);

    try {
      const res = await window.electronAPI.invoke<{
        mappings: CollectionMapping[];
        isGreeting?: boolean;
        isQuestion?: boolean;
        message?: string;
        changeCount?: number;
      }>('ai:refine-mapping', {
        mappings,
        instruction: promptText,
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || undefined,
        direction,
        targetField: selectedTargets[0]
          ? {
              collectionName: selectedTargets[0].collectionName,
              fieldId: selectedTargets[0].fieldId,
              sourceField: selectedTargets[0].fieldName,
              targetColumn: selectedTargets[0].targetColumn,
              rowNumber: selectedTargets[0].rowNum,
            }
          : undefined,
        targetFields: selectedTargets.map((t) => ({
          collectionName: t.collectionName,
          fieldId: t.fieldId,
          sourceField: t.fieldName,
          targetColumn: t.targetColumn,
          rowNumber: t.rowNum,
        })),
      });

      const replyTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (res.success && res.data) {
        const resultData = res.data;
        if (resultData.isGreeting || isGreeting) {
          setCopilotMessages((prev) => [
            ...prev,
            {
              id: 'ai-' + Date.now(),
              role: 'assistant',
              timestamp: replyTimestamp,
              text: "👋 Hello! I'm your MigrateIQ AI Schema Copilot. I can answer questions about your database architecture, or you can select columns with 🎯 to adjust types, names, or nullability simultaneously. How can I assist your migration today?",
              isQuestion: true,
              changeCount: 0,
            },
          ]);
        } else if (resultData.isQuestion) {
          setCopilotMessages((prev) => [
            ...prev,
            {
              id: 'ai-' + Date.now(),
              role: 'assistant',
              timestamp: replyTimestamp,
              text: resultData.message || "Here is the schema guidance you requested.",
              isQuestion: true,
              changeCount: 0,
            },
          ]);
        } else {
          let updated = resultData.mappings || mappings;
          let changes = resultData.changeCount ?? 0;
          const summaries: string[] = [];

          // Guaranteed client-side application for ALL targeted columns (handles typos, hot-reload, & voice inputs)
          if (selectedTargets.length > 0) {
            updated = updated.map((col) => {
              const targetedInCol = selectedTargets.filter((t) => t.collectionName === col.collectionName);
              if (targetedInCol.length === 0) return col;
              return {
                ...col,
                fields: col.fields.map((f) => {
                  const isTarget = targetedInCol.some(
                    (t) => t.fieldId === f.id || t.fieldName === f.sourceField || t.targetColumn === f.targetColumn
                  );
                  if (isTarget) {
                    let fieldChanged = false;
                    let nextType = f.targetType;
                    let nextNullable = f.isNullable;
                    let nextInclude = f.include;

                    if (clientTypeOverride && f.targetType !== clientTypeOverride) {
                      fieldChanged = true;
                      summaries.push(`${col.targetTableName}.${f.targetColumn}: ${f.targetType} → ${clientTypeOverride}`);
                      nextType = clientTypeOverride;
                    }

                    if (clientNullableOverride !== null && f.isNullable !== clientNullableOverride) {
                      fieldChanged = true;
                      summaries.push(`${col.targetTableName}.${f.targetColumn}: nullable → ${clientNullableOverride}`);
                      nextNullable = clientNullableOverride;
                    }

                    if (clientIncludeOverride !== null && f.include !== clientIncludeOverride) {
                      fieldChanged = true;
                      summaries.push(`${col.targetTableName}.${f.targetColumn}: ${clientIncludeOverride ? 'included' : 'excluded'}`);
                      nextInclude = clientIncludeOverride;
                    }

                    if (fieldChanged) {
                      changes++;
                      return {
                        ...f,
                        targetType: nextType,
                        isNullable: nextNullable,
                        include: nextInclude,
                        isAiModified: true,
                      };
                    }
                    return { ...f, isAiModified: true };
                  }
                  return f;
                }),
              };
            });
          }

          // Mark any changed fields across all collections as isAiModified = true
          updated = updated.map((col) => {
            const origCol = snapshotBefore.find((m: CollectionMapping) => m.collectionName === col.collectionName);
            return {
              ...col,
              fields: col.fields.map((f) => {
                const origF = origCol?.fields.find((of: FieldMapping) => of.id === f.id || of.sourceField === f.sourceField);
                if (
                  origF &&
                  (origF.targetType !== f.targetType ||
                    origF.targetColumn !== f.targetColumn ||
                    origF.isNullable !== f.isNullable ||
                    origF.include !== f.include)
                ) {
                  return { ...f, isAiModified: true };
                }
                return f;
              }),
            };
          });

          setMappings(updated);

          // Build rich, polite, and detailed response
          let richMessage = resultData.message;
          if (!richMessage || richMessage.startsWith('Applied tweak') || richMessage.includes('No changes needed') || richMessage.trim().length === 0) {
            if (changes > 0 || summaries.length > 0) {
              const details = summaries.length > 0
                ? summaries
                : selectedTargets.map((t) => `${t.collectionName}.${t.targetColumn} → ${clientTypeOverride || 'updated'}`);
              richMessage = `✨ **Schema Modifications Applied Successfully!**\n\nI have updated the selected column(s) according to your instruction:\n\n${details.map((d) => `• **${d}**`).join('\n')}\n\n⭐ **Notice:** In the mapping table, each modified column is marked with a star (**⭐**) indicator and highlighted in the data type selector. The targets have been automatically deselected.`;
            } else {
              richMessage = `ℹ️ No schema modifications were needed for this instruction. All targeted columns already match the requested specification.`;
            }
          }

          // Auto-deselect targets once task is completed as requested by user
          setSelectedTargets([]);
          setShowTargetPicker(false);

          setCopilotMessages((prev) => [
            ...prev,
            {
              id: 'ai-' + Date.now(),
              role: 'assistant',
              timestamp: replyTimestamp,
              text: richMessage,
              changeCount: changes,
              isQuestion: false,
              snapshotBefore: changes > 0 ? snapshotBefore : undefined,
            },
          ]);
        }
      } else {
        setCopilotMessages((prev) => [
          ...prev,
          {
            id: 'err-' + Date.now(),
            role: 'assistant',
            timestamp: replyTimestamp,
            text: `⚠️ ${res.error || 'Failed to process request.'}`,
          },
        ]);
      }
    } catch (err) {
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `⚠️ Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setIsTweaking(false);
    }
  };

  const handleRevertCopilotMessage = (msg: CopilotMessage) => {
    if (!msg.snapshotBefore) return;
    setMappings(msg.snapshotBefore);
    setCopilotMessages((prev) => [
      ...prev,
      {
        id: 'revert-' + Date.now(),
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `↩ Reverted schema changes back to state before: "${msg.text}"`,
      },
    ]);
  };

  const toggleCollection = (collectionName: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionName)) {
        next.delete(collectionName);
      } else {
        next.add(collectionName);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedCollections(new Set(mappings.map((m) => m.collectionName)));
  };

  const handleCollapseAll = () => {
    setExpandedCollections(new Set());
  };

  const toggleChildTable = (fieldId: string) => {
    setExpandedChildTables((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  const getChildColumns = (collectionName: string, sourceFieldName: string) => {
    const srcCol = sourceSchema?.find((s) => s.collectionName === collectionName);
    const field = srcCol?.fields.find((f) => f.name === sourceFieldName);
    if (field?.nestedFields && field.nestedFields.length > 0) {
      return field.nestedFields.map((nf) => ({
        name: nf.name,
        postgresType: nf.bsonType === 'int' ? 'INTEGER' : nf.bsonType === 'double' ? 'DOUBLE PRECISION' : nf.bsonType === 'date' ? 'TIMESTAMPTZ' : 'TEXT',
        isNullable: nf.isNullable ?? true,
      }));
    }
    return [];
  };

  const handleCopyDdl = async () => {
    const ddl = isPgToMongo
      ? generateMongoValidationScript(mappings)
      : generatePostgresDdl(mappings, sourceSchema);
    await navigator.clipboard.writeText(ddl);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2500);
  };

  const handleDownloadDdl = () => {
    const ddl = isPgToMongo
      ? generateMongoValidationScript(mappings)
      : generatePostgresDdl(mappings, sourceSchema);
    const mimeType = isPgToMongo ? 'application/javascript' : 'text/sql';
    const ext = isPgToMongo ? 'js' : 'sql';
    const blob = new Blob([ddl], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migrateiq_schema_${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateField = (
    collectionName: string,
    fieldId: string,
    updates: Partial<FieldMapping>
  ) => {
    setMappings((prev) =>
      prev.map((collection) =>
        collection.collectionName === collectionName
          ? {
              ...collection,
              fields: collection.fields.map((field) =>
                field.id === fieldId ? { ...field, ...updates } : field
              ),
            }
          : collection
      )
    );
  };

  const updateIndex = (
    collectionName: string,
    indexName: string,
    updates: Partial<IndexMapping>
  ) => {
    setMappings((prev) =>
      prev.map((collection) =>
        collection.collectionName === collectionName
          ? {
              ...collection,
              indexes: (collection.indexes || []).map((idx, i) =>
                (idx.sourceIndexName === indexName || idx.targetIndexName === indexName || `index_${i + 1}` === indexName)
                  ? { ...idx, ...updates }
                  : idx
              ),
            }
          : collection
      )
    );
  };

  const handleSave = () => {
    onSave(mappings);
  };

  // Filter collections based on search query
  const filteredMappings = mappings.filter((col) =>
    col.collectionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    col.targetTableName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="schema-mapper-container">
      {/* Professional Status Banner */}
      <div className={`mapper-banner ${badge === 'AI Suggested' ? 'ai-banner' : 'rule-banner'}`}>
        <div className="mapper-banner-icon">
          {badge === 'AI Suggested' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          )}
        </div>
        <div className="mapper-banner-content">
          <div className="mapper-banner-header">
            <span className="mapper-banner-title">
              {badge === 'AI Suggested' ? 'Automated Schema Mapping' : 'Rule-Engine Schema Mapping'}
            </span>
            <span className={`mapper-source-tag ${badge === 'AI Suggested' ? 'ai-tag' : 'rule-tag'}`}>
              {badge === 'AI Suggested' ? 'AI Optimized' : 'Rule-Based Fallback'}
            </span>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="btn-regenerate-cache"
                title="Bypasses memory cache and re-analyzes schema with Gemini"
              >
                🔄 Re-analyze with AI
              </button>
            )}
          </div>
          <p className="mapper-banner-subtitle">
            Review the inferred PostgreSQL table structure and column mappings below. You can customize column names, modify data types, or exclude fields before proceeding.
          </p>
        </div>
      </div>

      {/* Natural Language Schema Tweaker with Beginner Guide & Quick Action Chips */}
      {/* AI Schema Copilot Launcher Card */}
      <div className="mapper-copilot-card">
        <div className="copilot-card-left">
          <div className="copilot-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
              <rect x="4" y="8" width="16" height="12" rx="2"></rect>
              <circle cx="9" cy="13" r="1"></circle>
              <circle cx="15" cy="13" r="1"></circle>
              <line x1="8" y1="17" x2="16" y2="17"></line>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              <span className="copilot-card-title">AI Schema Copilot</span>
              <span className="copilot-status-tag">Active</span>
              {aiModifiedCount > 0 && (
                <span className="copilot-modified-counter">
                  ✨ {aiModifiedCount} column{aiModifiedCount > 1 ? 's' : ''} modified by AI
                </span>
              )}
            </div>
            <p className="copilot-card-subtitle">
              Dual-mode AI Copilot: Ask database design questions or multi-select columns (click 🎯 on table rows) to apply simultaneous modifications.
            </p>
          </div>
        </div>
        <div className="copilot-card-actions">
          {selectedTargets.length > 0 && (
            <div className="active-target-pill">
              <span>🎯 <strong>{selectedTargets.length}</strong> column{selectedTargets.length > 1 ? 's' : ''} selected</span>
              <button
                type="button"
                className="btn-clear-target-mini"
                onClick={clearAllTargets}
                title="Clear all selected targets"
              >
                ✕
              </button>
            </div>
          )}
          <button
            type="button"
            className="btn-open-copilot"
            onClick={() => setShowCopilotModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Open Copilot Workspace {selectedTargets.length > 0 ? `(${selectedTargets.length} Selected)` : ''}
          </button>
        </div>
      </div>

      {/* Collection Filter & Action Toolbar (Improvement 1 & 4) */}
      <div className="mapper-toolbar">
        <div className="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Filter collections or tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchQuery('')}
              title="Clear filter"
            >
              ✕
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          <span className="collection-count-text">
            {filteredMappings.length === mappings.length
              ? `${mappings.length} collections`
              : `Showing ${filteredMappings.length} of ${mappings.length}`}
          </span>
          <button
            type="button"
            className="btn-toolbar"
            onClick={handleExpandAll}
            title="Expand all collection tables"
          >
            Expand All
          </button>
          <button
            type="button"
            className="btn-toolbar"
            onClick={handleCollapseAll}
            title="Collapse all collection tables"
          >
            Collapse All
          </button>
          <button
            type="button"
            className="btn-toolbar btn-toolbar-ddl"
            onClick={() => setShowDdlModal(true)}
            title={isPgToMongo ? "View generated MongoDB collection creation & validation script" : "View full generated PostgreSQL CREATE TABLE and CREATE INDEX DDL script"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            {isPgToMongo ? 'Preview Schema (MongoDB)' : 'Preview DDL (SQL)'}
          </button>
        </div>
      </div>

      {/* Per-Collection Mapping Tables */}
      {filteredMappings.length === 0 ? (
        <div className="empty-search-state">
          <p>No collections or tables match &ldquo;{searchQuery}&rdquo;</p>
          <button type="button" className="btn-secondary" onClick={() => setSearchQuery('')}>
            Clear Filter
          </button>
        </div>
      ) : (
        filteredMappings.map((collection) => {
          const isExpanded = expandedCollections.has(collection.collectionName);

          return (
            <div key={collection.collectionName} className="collection-section">
              {/* Collection Header */}
              <button
                onClick={() => toggleCollection(collection.collectionName)}
                className="collection-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span className="expand-icon">{isExpanded ? '▾' : '▸'}</span>
                  <strong style={{ fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {collection.collectionName}
                  </strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>→</span>
                  <strong style={{ fontFamily: 'monospace', fontSize: '1rem', color: 'var(--brand-primary, #2563EB)' }}>
                    {collection.targetTableName}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginLeft: '0.5rem',
                      backgroundColor: 'var(--bg-card, #FFFFFF)',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle, #E2E8F0)',
                    }}
                  >
                    {collection.fields.length} fields · {(collection.indexes || []).length} indexes
                  </span>
                </div>
              </button>

              {/* Field Mapping Table (collapsible) */}
              {isExpanded && (
                <div className="collection-content">
                  {collection.fields.some((f) => f.isAiModified) && (
                    <div className="collection-ai-alert">
                      <div className="ai-alert-left">
                        <span className="ai-alert-star">⭐</span>
                        <div className="ai-alert-content">
                          <span className="ai-alert-title">
                            Modified Columns in Table &ldquo;{collection.targetTableName}&rdquo;
                          </span>
                          <span className="ai-alert-desc">
                            <strong>{collection.fields.filter((f) => f.isAiModified).length} column(s)</strong> have been customized by user instruction via AI Copilot (marked with ⭐). Please review data types and nullability before migrating.
                          </span>
                        </div>
                      </div>
                      <div className="ai-alert-right">
                        <button
                          type="button"
                          className="btn-ai-alert-open"
                          onClick={() => setShowCopilotModal(true)}
                          title="Open AI Copilot to review or tweak"
                        >
                          Open Copilot History ↗
                        </button>
                      </div>
                    </div>
                  )}

                  <table className="mapper-table">
                    <thead>
                      <tr>
                        <th style={{ width: '64px', textAlign: 'center' }}>#</th>
                        <th>{isPgToMongo ? 'PostgreSQL Column' : 'MongoDB Field'}</th>
                        <th>{isPgToMongo ? 'SQL Type' : 'Type'}</th>
                        <th></th>
                        <th>{isPgToMongo ? 'MongoDB Field' : 'PostgreSQL Column'}</th>
                        <th>{isPgToMongo ? 'BSON Data Type' : 'Data Type'}</th>
                        <th>Nullable</th>
                        <th>Include?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collection.fields.map((field, fieldIdx) => {
                        const rowNum = fieldIdx + 1;
                        const isTargeted = selectedTargets.some((t) => t.fieldId === field.id);

                        return (
                        <React.Fragment key={field.id}>
                          <tr
                            className={`${!field.include ? 'excluded-row' : ''} ${field.isAiModified ? 'ai-modified-row' : ''} ${isTargeted ? 'active-targeted-row' : ''}`}
                          >
                            <td className="row-num-cell">
                              <div className="row-num-wrap">
                                <span className="row-number">{rowNum}</span>
                                {field.isAiModified && (
                                  <span className="row-star-indicator" title="Modified by user instruction via AI Copilot">
                                    ⭐
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className={`btn-row-target ${isTargeted ? 'active' : ''}`}
                                  onClick={() => toggleTargetField(collection.collectionName, field, rowNum)}
                                  title={
                                    isTargeted
                                      ? `Click to de-select Row #${rowNum} (${collection.collectionName}.${field.targetColumn})`
                                      : `Click to select Row #${rowNum} (${collection.collectionName}.${field.targetColumn}) for AI Copilot`
                                  }
                                >
                                  🎯
                                </button>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 500 }}>
                                    {field.sourceField}
                                  </span>
                                  {field.isAiModified && (
                                    <span className="badge-ai-star" title="This column was modified by AI Schema Copilot according to user instruction">
                                      ⭐ AI Modified
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                                  {field.transformationRule === 'jsonb' && (
                                    <span className="field-badge jsonb-badge">
                                      <span className="badge-dot"></span>
                                      JSONB Document
                                    </span>
                                  )}
                                  {(field.sourceField.includes('.') || field.transformationRule === 'flatten') && (
                                    <span className="field-badge nested-badge" title="Flattened from nested MongoDB document">
                                      ⚡ Was Nested
                                    </span>
                                  )}
                                  {(field.foreignKeyToParent || (field.sourceField !== '_id' && (field.sourceField.endsWith('_id') || field.sourceField.endsWith('Id')))) && (
                                    <span className="field-badge fk-badge" title="Inferred Foreign Key relationship">
                                      🔗 FK → {field.foreignKeyToParent || field.sourceField.replace(/_?id$/i, '') + 's'}
                                    </span>
                                  )}
                                  {field.isChildTable && (
                                    <span className="field-badge child-table-badge">
                                      <span className="badge-dot"></span>
                                      Child Table: {field.childTableName}
                                    </span>
                                  )}
                                  {field.isChildTable && (
                                    <button
                                      type="button"
                                      className="btn-toggle-child-details"
                                      onClick={() => toggleChildTable(field.id)}
                                      title="View/hide normalized relational columns for this child table"
                                    >
                                      {expandedChildTables.has(field.id) ? 'Hide Columns ▴' : 'View Columns ▾'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {field.sourceType}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>→</td>
                            <td>
                              <input
                                type="text"
                                value={field.targetColumn}
                                onChange={(e) =>
                                  updateField(collection.collectionName, field.id, {
                                    targetColumn: e.target.value,
                                  })
                                }
                                className="column-name-input"
                                disabled={!field.include}
                              />
                            </td>
                            <td>
                              {field.isChildTable ? (
                                <div className="child-table-type-pill" title={`Normalized to ${field.childTableName} table with foreign key`}>
                                  <span>Separate Table</span>
                                </div>
                              ) : (
                                <select
                                  value={field.targetType}
                                  onChange={(e) =>
                                    updateField(collection.collectionName, field.id, {
                                      targetType: e.target.value,
                                    })
                                  }
                                  className={`type-select ${field.isAiModified ? 'type-select-ai-modified' : ''}`}
                                  disabled={!field.include}
                                >
                                  {!(isPgToMongo ? BSON_TYPES : POSTGRES_TYPES).includes(field.targetType) && (
                                    <option key={field.targetType} value={field.targetType}>
                                      {field.targetType}
                                    </option>
                                  )}
                                  {(isPgToMongo ? BSON_TYPES : POSTGRES_TYPES).map((type) => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={field.isNullable}
                                onChange={(e) =>
                                  updateField(collection.collectionName, field.id, {
                                    isNullable: e.target.checked,
                                  })
                                }
                                disabled={!field.include}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={field.include}
                                onChange={(e) =>
                                  updateField(collection.collectionName, field.id, {
                                    include: e.target.checked,
                                  })
                                }
                              />
                            </td>
                          </tr>

                          {/* Child Table Details Sub-Table (Improvement 2) */}
                          {field.isChildTable && expandedChildTables.has(field.id) && (
                            <tr className="child-table-details-row">
                              <td colSpan={8}>
                                <div className="child-table-details-panel">
                                  <div className="child-details-header">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary, #2563EB)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                      <line x1="3" y1="9" x2="21" y2="9"></line>
                                      <line x1="9" y1="21" x2="9" y2="9"></line>
                                    </svg>
                                    <strong>Table Structure: <code>{field.childTableName}</code></strong>
                                    <span className="child-details-hint">
                                      (Normalized from MongoDB array <code>{collection.collectionName}.{field.sourceField}</code>)
                                    </span>
                                  </div>
                                  <table className="child-nested-table">
                                    <thead>
                                      <tr>
                                        <th>Column Name</th>
                                        <th>PostgreSQL Data Type</th>
                                        <th>Constraint / Role</th>
                                        <th>Nullable</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td><code>id</code></td>
                                        <td><code>BIGSERIAL</code></td>
                                        <td><span className="role-tag pk">PRIMARY KEY</span></td>
                                        <td>No</td>
                                      </tr>
                                      <tr>
                                        <td><code>{field.foreignKeyToParent || `${collection.targetTableName}_id`}</code></td>
                                        <td><code>VARCHAR(24)</code></td>
                                        <td><span className="role-tag fk">FOREIGN KEY → {collection.targetTableName}(id) ON DELETE CASCADE</span></td>
                                        <td>No</td>
                                      </tr>
                                      <tr>
                                        <td><code>_array_index</code></td>
                                        <td><code>INTEGER</code></td>
                                        <td><span className="role-tag index">Array Position Order</span></td>
                                        <td>No</td>
                                      </tr>
                                      {getChildColumns(collection.collectionName, field.sourceField).map((col) => (
                                        <tr key={col.name}>
                                          <td><code>{col.name}</code></td>
                                          <td><code>{col.postgresType}</code></td>
                                          <td><span className="role-tag attr">Extracted Attribute</span></td>
                                          <td>{col.isNullable ? 'Yes' : 'No'}</td>
                                        </tr>
                                      ))}
                                      {getChildColumns(collection.collectionName, field.sourceField).length === 0 && (
                                        <tr>
                                          <td><code>data</code></td>
                                          <td><code>JSONB</code></td>
                                          <td><span className="role-tag attr">Raw Document Storage</span></td>
                                          <td>No</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Index Section */}
                  {collection.indexes && collection.indexes.length > 0 && (
                    <div className="indexes-section">
                      <div className="indexes-header">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                        </svg>
                        <span>Inferred Indexes &amp; Constraints</span>
                      </div>
                      <table className="indexes-table">
                        <thead>
                          <tr>
                            <th>{isPgToMongo ? 'Source Index (PostgreSQL)' : 'Source Index'}</th>
                            <th>{isPgToMongo ? 'Target MongoDB Index Command' : 'Target SQL'}</th>
                            <th>{isPgToMongo ? 'Type' : 'Concurrency'}</th>
                            <th>Include?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(collection.indexes || []).map((idx, i) => {
                            let targetFieldName = 'id';
                            const pkField = collection.fields.find((f) => f.sourceField === 'id' || f.targetColumn === 'id');
                            const uniqueCandidate = collection.fields.find((f) => f.sourceField === 'email' || f.targetColumn === 'email');

                            if (idx.sourceIndexName && !idx.sourceIndexName.startsWith('index_')) {
                              const match = idx.sourceIndexName.match(/(?:.*_)?([a-zA-Z0-9_]+?)(?:_key|_idx|_pkey|$)/i);
                              targetFieldName = match && match[1] && match[1] !== 'test' && match[1] !== collection.collectionName ? match[1] : idx.sourceIndexName;
                            } else if (i === 1 && uniqueCandidate) {
                              targetFieldName = uniqueCandidate.targetColumn;
                            } else if (pkField) {
                              targetFieldName = pkField.targetColumn;
                            }

                            const isUnique = Boolean(
                              idx.targetSql?.toLowerCase().includes('unique') ||
                              idx.sourceIndexName?.toLowerCase().includes('unique') ||
                              idx.sourceIndexName?.toLowerCase().includes('key') ||
                              idx.sourceIndexName?.toLowerCase().includes('pkey') ||
                              targetFieldName === 'email' ||
                              targetFieldName === 'id'
                            );

                            const indexDisplayName = (idx.sourceIndexName && !idx.sourceIndexName.startsWith('index_'))
                              ? idx.sourceIndexName
                              : `${collection.collectionName}_${targetFieldName}_${isUnique ? 'key' : 'idx'}`;

                            const indexCommand = (idx.targetSql && !idx.targetSql.includes('index_1') && !idx.targetSql.includes('index_2'))
                              ? idx.targetSql
                              : (isPgToMongo
                                ? `db.${collection.targetTableName}.createIndex({ "${targetFieldName}": 1 }${isUnique ? ', { unique: true }' : ''});`
                                : `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX "${indexDisplayName}" ON "${collection.targetTableName}" ("${targetFieldName}");`);

                            return (
                              <tr key={indexDisplayName + i}>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                    {indexDisplayName}
                                  </span>
                                </td>
                                <td>
                                  <code
                                    style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--brand-primary, #2563EB)',
                                      display: 'block',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '520px',
                                    }}
                                    title={indexCommand}
                                  >
                                    {indexCommand}
                                  </code>
                                  {idx.isGin && (
                                    <span className="field-badge warning" style={{ marginTop: '0.25rem' }}>
                                      GIN index (optimized for high-performance lookups)
                                    </span>
                                  )}
                                  {isPgToMongo && isUnique && (
                                    <span className="field-badge info" style={{ marginTop: '0.25rem' }}>
                                      Unique Constraint
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span
                                    style={{
                                      fontSize: '0.8125rem',
                                      color: isPgToMongo
                                        ? (isUnique ? '#2563EB' : '#64748B')
                                        : (idx.isConcurrently ? '#16A34A' : '#64748B'),
                                      fontWeight: 500,
                                    }}
                                  >
                                    {isPgToMongo
                                      ? (isUnique ? 'UNIQUE' : 'STANDARD')
                                      : (idx.isConcurrently ? 'CONCURRENT' : 'STANDARD')}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={idx.include}
                                    onChange={(e) =>
                                      updateIndex(collection.collectionName, idx.sourceIndexName, {
                                        include: e.target.checked,
                                      })
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Data Type Reference Panel */}
      <DataTypeReferencePanel direction={direction} />

      {/* Action Buttons */}
      <div className="mapper-buttons">
        <button onClick={onBack} className="btn-secondary">
          ← Back to Connection
        </button>
        <button onClick={handleSave} className="btn-primary">
          Confirm Mapping &amp; Continue →
        </button>
      </div>

      {/* SQL / MongoDB Schema Preview Modal */}
      {showDdlModal && (
        <div className="ddl-modal-overlay" onClick={() => setShowDdlModal(false)}>
          <div className="ddl-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ddl-modal-header">
              <div className="ddl-modal-title-group">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary, #2563EB)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
                <h3 className="ddl-modal-title">
                  {isPgToMongo ? 'MongoDB Schema & Validation Preview' : 'PostgreSQL DDL Preview'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowDdlModal(false)}
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
            <p className="ddl-modal-desc">
              {isPgToMongo
                ? 'This is the exact MongoDB shell script ($jsonSchema collection validators) and Mongoose models synthesized by MigrateIQ from your PostgreSQL tables.'
                : 'This is the exact SQL script that MigrateIQ will execute on your PostgreSQL database to create tables, primary keys, foreign key constraints, and indexes.'}
            </p>
            <div className="ddl-code-container">
              <pre className="ddl-code-block">
                <code>
                  {isPgToMongo
                    ? generateMongoValidationScript(mappings)
                    : generatePostgresDdl(mappings, sourceSchema)}
                </code>
              </pre>
            </div>
            <div className="ddl-modal-footer">
              <div className="ddl-modal-actions-left">
                <span className="ddl-modal-stats">
                  {mappings.length} {isPgToMongo ? 'collections' : 'tables'} · {mappings.reduce((acc, c) => acc + c.fields.filter(f => f.include).length, 0)} {isPgToMongo ? 'fields' : 'columns'}
                </span>
              </div>
              <div className="ddl-modal-actions-right">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCopyDdl}
                >
                  {copiedDdl ? (isPgToMongo ? '✓ Copied Schema!' : '✓ Copied SQL!') : '📋 Copy to Clipboard'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDownloadDdl}
                >
                  {isPgToMongo ? '💾 Download .js File' : '💾 Download .sql File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated AI Schema Copilot Workspace Modal */}
      {showCopilotModal && (
        <div className="copilot-modal-overlay" onClick={() => setShowCopilotModal(false)}>
          <div className="copilot-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="copilot-modal-header">
              <div className="copilot-modal-title-group">
                <div className="copilot-modal-avatar">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
                    <rect x="4" y="8" width="16" height="12" rx="2"></rect>
                    <circle cx="9" cy="13" r="1"></circle>
                    <circle cx="15" cy="13" r="1"></circle>
                    <line x1="8" y1="17" x2="16" y2="17"></line>
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 className="copilot-modal-title">AI Schema Copilot Workspace</h3>
                    <span className="copilot-live-pill">● Online</span>
                    {aiModifiedCount > 0 && (
                      <span className="copilot-modified-counter">
                        ✨ {aiModifiedCount} column{aiModifiedCount > 1 ? 's' : ''} modified
                      </span>
                    )}
                  </div>
                  <p className="copilot-modal-subtitle">
                    Dual-mode: Ask questions about your schema design or instruct simultaneous changes across selected columns.
                  </p>
                </div>
              </div>
              <div className="copilot-header-right">
                <button
                  type="button"
                  className={`btn-copilot-guide-toggle ${showGuide ? 'active' : ''}`}
                  onClick={() => setShowGuide(!showGuide)}
                  title="How to use this AI Copilot"
                >
                  💡 {showGuide ? 'Hide Guide' : 'How does this work?'}
                </button>
                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => {
                    setShowCopilotModal(false);
                    setShowTargetPicker(false);
                  }}
                  aria-label="Close Copilot Workspace"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Beginner Quick Guide Panel (Collapsible) */}
            {showGuide && (
              <div className="copilot-guide-box">
                <div className="copilot-guide-item">
                  <div className="guide-step-num">1</div>
                  <div>
                    <strong>Multi-Target Selection (🎯)</strong>
                    <p>Select multiple columns by clicking the 🎯 icon on table rows or clicking <strong>&ldquo;+ Add / Manage Columns&rdquo;</strong> in this workspace.</p>
                  </div>
                </div>
                <div className="copilot-guide-item">
                  <div className="guide-step-num">2</div>
                  <div>
                    <strong>Simultaneous Modifications</strong>
                    <p>Type commands like: <em>&ldquo;Change to VARCHAR(100)&rdquo;</em> or <em>&ldquo;Make nullable&rdquo;</em> to apply changes to all selected columns simultaneously.</p>
                  </div>
                </div>
                <div className="copilot-guide-item">
                  <div className="guide-step-num">3</div>
                  <div>
                    <strong>Ask Database Questions</strong>
                    <p>Ask anything about database design, such as: <em>&ldquo;Why was address converted to JSONB?&rdquo;</em> or <em>&ldquo;What is the difference between TEXT and VARCHAR?&rdquo;</em> without altering any schema!</p>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-Target Scope Indicator Bar & Target Manager */}
            <div className={`copilot-scope-banner ${selectedTargets.length > 0 ? 'is-targeted' : 'is-global'}`}>
              <div className="scope-banner-top">
                <div className="scope-badge-group">
                  {selectedTargets.length > 0 ? (
                    <span className="scope-badge">🎯 {selectedTargets.length} COLUMN{selectedTargets.length > 1 ? 'S' : ''} TARGETED</span>
                  ) : (
                    <span className="scope-badge global">🌐 GLOBAL SCHEMA SCOPE</span>
                  )}
                  <span className="scope-text">
                    {selectedTargets.length > 0
                      ? `Modifications will apply simultaneously across the ${selectedTargets.length} selected column${selectedTargets.length > 1 ? 's' : ''}.`
                      : 'Modifications apply across all collections. Click 🎯 on table rows or "+ Add / Manage Columns" to scope changes.'}
                  </span>
                </div>
                <div className="scope-actions-right">
                  <button
                    type="button"
                    className={`btn-add-target-toggle ${showTargetPicker ? 'active' : ''}`}
                    onClick={() => setShowTargetPicker(!showTargetPicker)}
                    title="Pick columns to add or remove from targets"
                  >
                    {showTargetPicker ? '✕ Close Column Picker' : '+ Add / Manage Columns'}
                  </button>
                  {selectedTargets.length > 0 && (
                    <button
                      type="button"
                      className="btn-scope-clear"
                      onClick={clearAllTargets}
                      title="Remove all target constraints to switch back to global mode"
                    >
                      Clear All (Global Mode)
                    </button>
                  )}
                </div>
              </div>

              {/* Target Chips */}
              {selectedTargets.length > 0 && (
                <div className="copilot-target-chips">
                  {selectedTargets.map((t) => (
                    <div key={t.fieldId} className="target-chip">
                      <span className="target-chip-name">
                        <span className="target-chip-col">{t.collectionName}.</span>
                        <strong>{t.targetColumn}</strong>
                      </span>
                      <span className="target-chip-row">#{t.rowNum}</span>
                      <button
                        type="button"
                        className="btn-remove-chip"
                        onClick={() => removeTarget(t.fieldId)}
                        title={`Remove ${t.collectionName}.${t.targetColumn} from targets`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* In-Modal Column Picker Dropdown */}
              {showTargetPicker && (
                <div className="target-picker-dropdown">
                  <div className="target-picker-header">
                    <span className="picker-title">Select Columns to Target</span>
                    <input
                      type="text"
                      className="target-picker-search-input"
                      placeholder="Search column or collection name..."
                      value={targetSearchQuery}
                      onChange={(e) => setTargetSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="target-picker-list">
                    {mappings
                      .flatMap((col) =>
                        col.fields.map((f, idx) => ({
                          colName: col.collectionName,
                          field: f,
                          rowNum: idx + 1,
                        }))
                      )
                      .filter(
                        (item) =>
                          item.field.targetColumn.toLowerCase().includes(targetSearchQuery.toLowerCase()) ||
                          item.field.sourceField.toLowerCase().includes(targetSearchQuery.toLowerCase()) ||
                          item.colName.toLowerCase().includes(targetSearchQuery.toLowerCase())
                      )
                      .slice(0, 16)
                      .map((item) => {
                        const isSelected = selectedTargets.some((t) => t.fieldId === item.field.id);
                        return (
                          <button
                            key={item.field.id}
                            type="button"
                            className={`target-picker-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleTargetField(item.colName, item.field, item.rowNum)}
                          >
                            <div className="picker-item-left">
                              <span className="picker-item-col">{item.colName}.</span>
                              <span className="picker-item-field">{item.field.targetColumn}</span>
                              <span className="picker-item-type">({item.field.targetType})</span>
                            </div>
                            <div className="picker-item-right">
                              <span className="picker-item-row">#{item.rowNum}</span>
                              <span className={`picker-item-action ${isSelected ? 'action-remove' : 'action-add'}`}>
                                {isSelected ? '✓ Selected (Click to remove)' : '+ Add Target'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Chat Thread */}
            <div className="copilot-chat-thread">
              {copilotMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`copilot-message-bubble ${msg.role === 'user' ? 'msg-user' : msg.isQuestion ? 'msg-assistant msg-qa' : 'msg-assistant'}`}
                >
                  <div className="msg-meta">
                    <div className="msg-sender">
                      {msg.role === 'user' ? (
                        <>
                          <span className="sender-avatar user-av">👤</span>
                          <strong>You</strong>
                        </>
                      ) : msg.isQuestion ? (
                        <>
                          <span className="sender-avatar ai-av">💡</span>
                          <strong>MigrateIQ Copilot · Database Advisor</strong>
                        </>
                      ) : (
                        <>
                          <span className="sender-avatar ai-av">✨</span>
                          <strong>MigrateIQ Copilot</strong>
                        </>
                      )}
                    </div>
                    <div className="msg-meta-right">
                      {msg.targets && msg.targets.length > 0 && (
                        <div className="msg-targets-group">
                          <span className="msg-targets-count">🎯 {msg.targets.length} Target{msg.targets.length > 1 ? 's' : ''}:</span>
                          {msg.targets.slice(0, 2).map((t) => (
                            <span key={t.fieldId} className="msg-target-badge">
                              {t.collectionName}.{t.targetColumn} (#{t.rowNum})
                            </span>
                          ))}
                          {msg.targets.length > 2 && (
                            <span className="msg-targets-more">+{msg.targets.length - 2} more</span>
                          )}
                        </div>
                      )}
                      <span className="msg-time">{msg.timestamp}</span>
                    </div>
                  </div>
                  <div className="msg-body">
                    <p>{msg.text}</p>
                  </div>
                  {msg.changeCount !== undefined && msg.changeCount > 0 && (
                    <div className="msg-feedback-bar">
                      <span className="badge-change-count">
                        ✓ {msg.changeCount} column{msg.changeCount > 1 ? 's' : ''} updated
                      </span>
                      {msg.snapshotBefore && (
                        <button
                          type="button"
                          className="btn-revert-change"
                          onClick={() => handleRevertCopilotMessage(msg)}
                          title="Rollback schema back to state before this change"
                        >
                          ↩ Revert this change
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isTweaking && (
                <div className="copilot-message-bubble msg-assistant thinking">
                  <div className="thinking-indicator">
                    <div className="spinner-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <span className="thinking-text">
                      {selectedTargets.length > 0
                        ? `Analyzing request across ${selectedTargets.length} targeted column${selectedTargets.length > 1 ? 's' : ''}...`
                        : 'AI Copilot is analyzing your message...'}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="copilot-input-container">
              <form
                className="copilot-input-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCopilotMessage();
                }}
              >
                <input
                  type="text"
                  className="copilot-input-field"
                  placeholder={
                    selectedTargets.length > 0
                      ? isPgToMongo
                        ? `Instruct AI for ${selectedTargets.length} selected field${selectedTargets.length > 1 ? 's' : ''} (e.g. "change to double", "make objectId", "change to string")...`
                        : `Instruct AI for ${selectedTargets.length} selected column${selectedTargets.length > 1 ? 's' : ''} (or ask any question)...`
                      : isPgToMongo
                      ? `Ask database architecture questions or instruct BSON changes across collections...`
                      : `Ask any schema/database question or instruct changes across collections...`
                  }
                  value={tweakPrompt}
                  onChange={(e) => setTweakPrompt(e.target.value)}
                  disabled={isTweaking}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-copilot-send"
                  disabled={isTweaking || !tweakPrompt.trim()}
                >
                  {isTweaking ? (
                    <span className="spinner-mini"></span>
                  ) : (
                    <>
                      <span>Send</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    </>
                  )}
                </button>
              </form>
              <div className="copilot-input-hint">
                <span>
                  Tip: {isPgToMongo
                    ? 'Ask questions (e.g. \u201cWhat BSON type should I use for currency?\u201d) or instruct edits for selected fields. Press Enter to send.'
                    : 'Ask questions (e.g. \u201cWhy is field JSONB?\u201d) or instruct edits for selected columns. Press Enter to send.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Selection Floating Action Bar */}
      {selectedTargets.length > 0 && !showCopilotModal && (
        <div className="target-selection-floatbar">
          <div className="floatbar-content">
            <div className="floatbar-left">
              <span className="floatbar-badge">
                🎯 {selectedTargets.length} Column{selectedTargets.length > 1 ? 's' : ''} Selected
              </span>
              <div className="floatbar-chips">
                {selectedTargets.slice(0, 3).map((t) => (
                  <span key={t.fieldId} className="floatbar-chip">
                    {t.collectionName}.<strong>{t.targetColumn}</strong> (#{t.rowNum})
                  </span>
                ))}
                {selectedTargets.length > 3 && (
                  <span className="floatbar-chip-more">+{selectedTargets.length - 3} more</span>
                )}
              </div>
            </div>
            <div className="floatbar-actions">
              <button
                type="button"
                className="btn-floatbar-clear"
                onClick={clearAllTargets}
              >
                Clear Selection
              </button>
              <button
                type="button"
                className="btn-floatbar-open"
                onClick={() => setShowCopilotModal(true)}
              >
                Open Copilot with {selectedTargets.length} Target{selectedTargets.length > 1 ? 's' : ''} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
