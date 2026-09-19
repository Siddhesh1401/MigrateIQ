import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import type {
  SourceSchema,
  CollectionMapping,
  AIGenerateMappingResponse,
  AIHealthScoreResponse,
  IPCResponse,
  AnomalyFixRequest,
  AIAnomalyFixRecommendation,
} from '@migrateiq/shared';
import { generateMappingByRules } from '../engine/ruleEngine';
import { recordAIUsage } from './aiUsageStore';
import { getTypeAwareDefaultValue, formatSqlDefaultClause } from '../engine/dryRun';

/**
 * AI Handler — Google Gemini Integration for Schema Mapping
 * 
 * Sends MongoDB schema to Gemini AI and gets back PostgreSQL mapping suggestions.
 * Falls back to rule engine if AI fails for any reason (network, API key, rate limit).
 */

// Will be dynamically imported when needed
let GoogleGenerativeAI: any = null;

// ── Model Cascades by Task Type ──────────────────────────────────────────────
// bleed-edge thinking models (3.8 -> 3.7 -> 3.6 -> 3.5) when quota is available,
// with reliable production fallbacks (2.5-flash / 2.5-flash-lite) with 1,500 calls/day.
const SCHEMA_MAPPING_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

const COPILOT_CHAT_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const HEALTH_SCORE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

// ── Configuration Constants ──────────────────────────────────────────────────
const BATCH_TOKEN_THRESHOLD = 6000;
const BATCH_COLLECTION_SIZE = 5;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 50;
const CHARS_PER_TOKEN_ESTIMATE = 4;

// ── In-Memory Schema Mapping Cache with Automatic Eviction ──────────────────
interface CacheEntry {
  mappings: CollectionMapping[];
  badge: 'AI Suggested' | 'Auto Rule-Mapped';
  batchCount: number;
  cachedAt: number;
}

const mappingCache = new Map<string, CacheEntry>();

/**
 * Sweeps expired entries and caps maximum cache entries to prevent memory leaks.
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of mappingCache.entries()) {
    if (now - entry.cachedAt >= CACHE_TTL_MS) {
      mappingCache.delete(key);
    }
  }
  // If cache exceeds maximum entries, evict the oldest
  if (mappingCache.size > MAX_CACHE_ENTRIES) {
    const sorted = Array.from(mappingCache.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toRemove = mappingCache.size - MAX_CACHE_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      mappingCache.delete(sorted[i][0]);
    }
  }
}

function getMappingCacheKey(schemas: SourceSchema[], direction: 'mongodb-to-postgres' | 'postgres-to-mongo'): string {
  const signature = schemas.map((s) => ({
    col: s.collectionName,
    fields: s.fields.map((f) => `${f.name}:${f.bsonType}:${f.isNullable}:${(f.sampleValues || []).join(',')}`),
  }));
  return `${direction}::${JSON.stringify(signature)}`;
}

/**
 * Setup AI Schema Mapping Handler
 */
export function setupAIHandler(): void {
  ipcMain.handle(
    'ai:generate-mapping',
    async (
      _event,
      payload: { schemas: SourceSchema[]; apiKey?: string; direction?: 'mongodb-to-postgres' | 'postgres-to-mongo'; forceRefresh?: boolean }
    ): Promise<IPCResponse<AIGenerateMappingResponse>> => {
      const { schemas, apiKey, direction, forceRefresh } = payload;
      const startTime = Date.now();

      // Defensive Check: Validate direction strictly (prevents cross-direction cache corruption)
      if (!direction || (direction !== 'mongodb-to-postgres' && direction !== 'postgres-to-mongo')) {
        return {
          success: false,
          error: 'Migration direction is required and must be "mongodb-to-postgres" or "postgres-to-mongo".',
        };
      }

      // Check cache first (saves time & API quota if schema has not changed and not forced)
      cleanExpiredCache();
      const cacheKey = getMappingCacheKey(schemas, direction);
      const cached = mappingCache.get(cacheKey);
      if (!forceRefresh && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        console.log('[AI Cache] HIT — returning cached schema mapping immediately');
        recordAIUsage({
          timestamp: new Date().toISOString(),
          feature: 'Schema Inference',
          model: 'Local Cache',
          promptSnippet: `Cached Schema Mapping (${schemas.length} collections)`,
          promptTokens: 0,
          responseTokens: 0,
          totalTokens: 0,
          status: 'cached',
          durationMs: Date.now() - startTime,
        });
        return {
          success: true,
          data: {
            mappings: cached.mappings,
            badge: cached.badge,
            batchCount: cached.batchCount,
            processingTimeMs: Date.now() - startTime,
          },
        };
      }

      // If no API key provided, immediately use rule engine
      if (!apiKey || apiKey.trim().length === 0) {
        console.log('[AI] No API key provided — using rule engine');
        const ruleMappings = generateMappingByRules(schemas, direction);
        console.log('[AI] Rule engine generated', ruleMappings.length, 'collection mappings');
        if (ruleMappings.length > 0) {
          console.log('[AI] First collection:', ruleMappings[0].collectionName, 'with', ruleMappings[0].fields.length, 'fields');
        }
        recordAIUsage({
          timestamp: new Date().toISOString(),
          feature: 'Schema Inference',
          model: 'Rule Engine',
          promptSnippet: `Rule-Engine Mapping (${schemas.length} collections, no API key)`,
          promptTokens: 0,
          responseTokens: 0,
          totalTokens: 0,
          status: 'fallback',
          durationMs: Date.now() - startTime,
        });
        return {
          success: true,
          data: {
            mappings: ruleMappings,
            badge: 'Auto Rule-Mapped',
            batchCount: 1,
            processingTimeMs: Date.now() - startTime,
          },
        };
      }

      try {
        console.log('[AI Handler] API Key status:', apiKey ? 'Configured & Active' : 'Not Provided');
        
        // Lazy-load Google Generative AI SDK
        if (!GoogleGenerativeAI) {
          const { GoogleGenerativeAI: SDK } = await import('@google/generative-ai');
          GoogleGenerativeAI = SDK;
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Estimate token size
        const serializedSchema = JSON.stringify(schemas);
        const estimatedTokens = Math.ceil(serializedSchema.length / CHARS_PER_TOKEN_ESTIMATE);

        console.log(`[AI] Estimated tokens: ${estimatedTokens}`);

        let mappings: CollectionMapping[] = [];
        let batchCount = 1;
        let lastError: Error | null = null;
        let generated = false;
        let successfulModel = 'gemini-2.5-flash';

        for (const modelName of SCHEMA_MAPPING_MODELS) {
          try {
            console.log(`[AI] Attempting schema mapping with model: ${modelName}`);
            // Native JSON Mode (Improvement 2): Forces strictly valid JSON without markdown
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });

            // If payload is too large (>6000 tokens), batch into groups of 5 collections
            if (estimatedTokens > BATCH_TOKEN_THRESHOLD && schemas.length > BATCH_COLLECTION_SIZE) {
              console.log(`[AI] Large schema detected (${estimatedTokens} tokens) — batching into groups of ${BATCH_COLLECTION_SIZE}`);
              batchCount = Math.ceil(schemas.length / BATCH_COLLECTION_SIZE);
              const tempMappings: CollectionMapping[] = [];

              for (let i = 0; i < schemas.length; i += BATCH_COLLECTION_SIZE) {
                const batch = schemas.slice(i, i + BATCH_COLLECTION_SIZE);
                try {
                  const batchMappings = await generateMappingWithAI(model, batch, direction);
                  tempMappings.push(...batchMappings);
                } catch (batchErr) {
                  console.warn(
                    `[AI] Batch ${Math.floor(i / BATCH_COLLECTION_SIZE) + 1}/${batchCount} failed with ${modelName}, preserving progress with rule engine fallback for this batch:`,
                    (batchErr as Error).message
                  );
                  const ruleBatchMappings = generateMappingByRules(batch, direction);
                  tempMappings.push(...ruleBatchMappings);
                }
              }
              mappings = tempMappings;
            } else {
              // Send all at once
              mappings = await generateMappingWithAI(model, schemas, direction);
            }

            generated = true;
            successfulModel = modelName;
            console.log(`[AI] Successfully generated mapping with ${modelName}`);
            break;
          } catch (modelErr) {
            console.warn(`[AI] Model ${modelName} failed, trying fallback:`, (modelErr as Error).message);
            lastError = modelErr as Error;
          }
        }

        if (!generated) {
          throw lastError || new Error('All AI models failed');
        }

        console.log('[AI] Successfully generated', mappings.length, 'collection mappings with AI using', successfulModel);
        if (mappings.length > 0) {
          console.log('[AI] First collection:', mappings[0].collectionName, 'with', mappings[0].fields.length, 'fields');
        }

        // Cache the successful mapping with eviction safeguard
        mappingCache.set(cacheKey, {
          mappings,
          badge: 'AI Suggested',
          batchCount,
          cachedAt: Date.now(),
        });
        cleanExpiredCache();

        const totalFieldCount = mappings.reduce((acc, c) => acc + c.fields.length, 0);
        const respTokens = Math.ceil(JSON.stringify(mappings).length / CHARS_PER_TOKEN_ESTIMATE);
        recordAIUsage({
          timestamp: new Date().toISOString(),
          feature: 'Schema Inference',
          model: successfulModel,
          promptSnippet: `Generated Schema (${schemas.length} collections, ${totalFieldCount} fields)`,
          promptTokens: estimatedTokens,
          responseTokens: respTokens,
          totalTokens: estimatedTokens + respTokens,
          status: 'success',
          durationMs: Date.now() - startTime,
        });

        return {
          success: true,
          data: {
            mappings,
            badge: 'AI Suggested',
            batchCount,
            processingTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        // On ANY error (network, rate limit, invalid key), silently fall back to rule engine
        console.warn('[AI] Failed to generate mapping with AI:', error);
        console.log('[AI] Error details:', (error as Error).message);
        console.log('[AI] Falling back to rule engine');

        const ruleMappings = generateMappingByRules(schemas, direction);
        console.log('[AI] Rule engine fallback generated', ruleMappings.length, 'collection mappings');
        if (ruleMappings.length > 0) {
          console.log('[AI] First collection:', ruleMappings[0].collectionName, 'with', ruleMappings[0].fields.length, 'fields');
        }

        recordAIUsage({
          timestamp: new Date().toISOString(),
          feature: 'Schema Inference',
          model: 'Rule Engine Fallback',
          promptSnippet: `Fallback: ${(error as Error).message.slice(0, 80)}`,
          promptTokens: 0,
          responseTokens: 0,
          totalTokens: 0,
          status: (error as Error).message.includes('429') ? 'rate-limited' : 'fallback',
          durationMs: Date.now() - startTime,
        });

        return {
          success: true,
          data: {
            mappings: ruleMappings,
            badge: 'Auto Rule-Mapped',
            batchCount: 1,
            processingTimeMs: Date.now() - startTime,
          },
        };
      }
    }
  );

  /**
   * Health Score Handler (Async, non-blocking)
   */
  ipcMain.handle(
    'ai:health-score',
    async (
      _event,
      payload: { schemas: SourceSchema[]; apiKey?: string; direction?: 'mongodb-to-postgres' | 'postgres-to-mongo' }
    ): Promise<IPCResponse<AIHealthScoreResponse | null>> => {
      const { schemas, apiKey } = payload;
      
      // If no API key, return null silently (no error shown to user)
      if (!apiKey || apiKey.trim().length === 0) {
        return { success: true, data: null };
      }

      try {
        // Lazy-load SDK
        if (!GoogleGenerativeAI) {
          const { GoogleGenerativeAI: SDK } = await import('@google/generative-ai');
          GoogleGenerativeAI = SDK;
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        const prompt = `
You are a database schema quality analyst. Analyze this MongoDB schema and identify data quality issues.

MongoDB Schema (JSON):
${JSON.stringify(schemas, null, 2)}

Return a JSON object with this exact structure:
{
  "score": <number 0-100>,
  "deductions": [
    { "reason": "<issue description>", "points": <number>, "severity": "high" | "medium" | "low" }
  ],
  "summaryTip": "<one-line summary of overall health>"
}

Focus on:
- Type inconsistencies (mixed types in same field)
- Missing fields in documents
- No indexes on frequently queried fields
- Deeply nested objects (>3 levels)
- Large binary fields
- Null/missing values in critical fields

Return ONLY valid JSON. No markdown, no explanations.
`;

        let healthScore: AIHealthScoreResponse | null = null;

        for (const modelName of HEALTH_SCORE_MODELS) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });
            const result = await model.generateContent(prompt);
            const response = result.response.text();

            // Robust JSON extraction (handles leading/trailing commentary or markdown code blocks)
            let jsonStr = response.trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[0];
            } else {
              jsonStr = jsonStr.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
            }
            healthScore = JSON.parse(jsonStr);
            console.log(`[AI] Health score generated with ${modelName}:`, healthScore?.score);
            const pTok = Math.ceil(prompt.length / 4);
            const rTok = Math.ceil(response.length / 4);
            recordAIUsage({
              timestamp: new Date().toISOString(),
              feature: 'Health Score',
              model: modelName,
              promptSnippet: `Data Quality Scan (${schemas.length} collections) → ${healthScore?.score}/100`,
              promptTokens: pTok,
              responseTokens: rTok,
              totalTokens: pTok + rTok,
              status: 'success',
              durationMs: Date.now() - (payload as any).startTime || 800,
            });
            break;
          } catch (err) {
            console.warn(`[AI] Health score model ${modelName} failed, trying fallback:`, (err as Error).message);
          }
        }

        return {
          success: true,
          data: healthScore,
        };
      } catch (error) {
        // Silent failure — return null
        console.warn('[AI] Health score generation failed:', error);
        return {
          success: true,
          data: null,
        };
      }
    }
  );

  /**
   * Natural Language Schema Tweaker Handler (Improvement 4)
   * Refines an existing mapping based on a user natural language prompt.
   * Natural Language Schema Tweaker & Copilot Handler (Improvement 5)
   * Supports multi-target column constraints, full conversation Q&A, and precise rollbacks
   */
  ipcMain.handle(
    'ai:refine-mapping',
    async (
      _event,
      payload: {
        mappings: CollectionMapping[];
        instruction: string;
        apiKey?: string;
        targetField?: {
          collectionName: string;
          fieldId?: string;
          sourceField?: string;
          targetColumn?: string;
          rowNumber?: number;
        };
        targetFields?: Array<{
          collectionName: string;
          fieldId?: string;
          sourceField?: string;
          targetColumn?: string;
          rowNumber?: number;
        }>;
        direction?: 'mongodb-to-postgres' | 'postgres-to-mongo';
      }
    ): Promise<IPCResponse<{ mappings: CollectionMapping[]; isGreeting?: boolean; isQuestion?: boolean; message?: string; changeCount?: number }>> => {
      const { mappings, instruction, apiKey, direction } = payload;
      const isPgToMongo = direction === 'postgres-to-mongo';
      const startTime = Date.now();
      if (!instruction || instruction.trim().length === 0) {
        return { success: false, error: 'Instruction cannot be empty.' };
      }

      // Friendly Guidance for Greetings & Conversational Inputs
      const GREETING_REGEX = /^(hi+|hello+|hey+|howdy|sup|good\s*(morning|afternoon|evening)|what'?s\s*up|who\s*are\s*you|what\s*can\s*you\s*do)[\s!?.~]*$/i;
      if (GREETING_REGEX.test(instruction.trim())) {
        recordAIUsage({
          timestamp: new Date().toISOString(),
          feature: 'Database Q&A',
          model: 'Local Copilot',
          promptSnippet: instruction.trim(),
          promptTokens: 0,
          responseTokens: 0,
          totalTokens: 0,
          status: 'cached',
          durationMs: 12,
        });
        return {
          success: true,
          data: {
            mappings,
            isGreeting: true,
            isQuestion: true,
            message: "👋 Hi! I'm your MigrateIQ AI Schema Copilot. You can ask me database architecture questions, or tell me how to adjust column types, names, or nullability across your tables.",
            changeCount: 0,
          },
        };
      }

      if (!apiKey || apiKey.trim().length === 0) {
        return { success: false, error: 'Gemini API key is required to use the Natural Language Schema Tweaker.' };
      }

      // Normalize targeted columns (single or multi-select array)
      const targets = payload.targetFields && payload.targetFields.length > 0
        ? payload.targetFields
        : payload.targetField
        ? [payload.targetField]
        : [];

      try {
        if (!GoogleGenerativeAI) {
          const { GoogleGenerativeAI: SDK } = await import('@google/generative-ai');
          GoogleGenerativeAI = SDK;
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        let targetDirective = '';
        if (targets.length > 0) {
          targetDirective = `
CRITICAL TARGET CONSTRAINTS:
The user has specifically targeted the following ${targets.length} column(s):
${targets
  .map(
    (t, i) =>
      `${i + 1}. Collection: "${t.collectionName}" → Column: "${t.targetColumn || t.sourceField}" (Source Field: "${t.sourceField || t.targetColumn}", Row #${t.rowNumber || i + 1})`
  )
  .join('\n')}

RULES FOR TARGETED EDITING:
1. When modifying schema, apply modifications ONLY to the targeted columns listed above.
2. Do NOT alter any un-targeted column, and do NOT modify any un-targeted collection.
3. If the user gives a generalized request (e.g., "change to VARCHAR(100)", "change to string", or "make nullable"), apply it across ALL targeted columns.
`;
        }

        const roleAndExpertise = isPgToMongo
          ? `You are an expert MongoDB Document Database Architect and Schema Migration Copilot. The user is migrating PostgreSQL relational tables into MongoDB document collections.`
          : `You are an expert PostgreSQL Database Architect and Schema Migration Copilot. The user is migrating MongoDB collections into a PostgreSQL relational schema.`;

        const typeGuidance = isPgToMongo
          ? `NOTE ON PHONETICS, SPEECH-TO-TEXT, TYPOS & BSON TYPES:
The target database is MongoDB. Target types MUST be valid BSON types:
- "worker 100", "varchaer", "string", "text", "varchar", "char" mean string
- "int", "integer", "number", "serial", "int32" mean int
- "big int", "bigint", "long", "int64" mean long
- "double", "float", "numberdouble", "real" mean double
- "decimal", "numeric", "money", "currency" mean decimal
- "bool", "boolean" mean bool
- "time", "date", "timestamp", "timestamptz" mean date
- "uuid", "uid", "objectid", "object id" mean objectId
- "object", "json", "jsonb", "document" mean object
- "array", "list" mean array
- "binary", "bytea" mean binData
Always interpret user intent accurately and apply the corresponding BSON type to targetType.`
          : `NOTE ON PHONETICS, SPEECH-TO-TEXT & TYPOS:
The user might use voice-to-text or have typos in their input. For example:
- "worker 100", "varchaer 100", "var char 100", "var100" all mean VARCHAR(100)
- "uuid", "uid" mean UUID
- "int", "integer", "number" mean INTEGER
- "big int", "bigint", "long" mean BIGINT
- "bool", "boolean" mean BOOLEAN
- "time", "date", "timestamp" mean TIMESTAMPTZ
- "numeric", "decimal" mean NUMERIC
Always interpret user intent accurately and apply the corresponding PostgreSQL type.`;

        const prompt = `
${roleAndExpertise}
The user has sent this prompt:
"${instruction.trim()}"

${targetDirective}

${typeGuidance}

Here is the CURRENT mapping (JSON array of CollectionMapping):
${JSON.stringify(mappings, null, 2)}

TASK INSTRUCTIONS:
1. CLASSIFY USER INTENT:
   - Determine whether this is:
     A) A DATABASE QUESTION / EXPLANATION / ADVISORY REQUEST (e.g., asking why a column is JSONB, difference between VARCHAR and TEXT, best practices for indexing, performance implications, how foreign keys work, or general guidance).
     B) A SCHEMA MODIFICATION INSTRUCTION explicitly asking to change, rename, retype, nullify, exclude/include, or alter columns or tables.

2. IF INTENT IS A QUESTION / ADVISORY REQUEST (Option A):
   - Set "isQuestion": true.
   - Do NOT modify any mappings. Keep all columns and tables untouched.
   - In "explanation", provide a comprehensive, clear, polite, and professional DBA answer with formatted bullet points or explanations.
   - In "mappings", return null (do NOT echo the schema back, as this saves token bandwidth).

3. IF INTENT IS A SCHEMA MODIFICATION (Option B):
   - Set "isQuestion": false.
   - Apply the user's requested modifications accurately.
   - If targeted column(s) were specified above, constrain your changes strictly to those targeted columns.
   - In "explanation", write a clear, friendly, and structured summary of what was updated (e.g. "✨ Successfully updated 2 columns: products.id (VARCHAR(24) → VARCHAR(100)), products.name (VARCHAR(100)). All other tables and columns remain untouched."). Never return a bland one-line string like "Applied tweak: ...".
   - In "mappings", return the updated CollectionMapping array.

Return ONLY a valid JSON object matching this structure:
{
  "isQuestion": <boolean>,
  "explanation": "<detailed, structured explanation or change summary>",
  "mappings": <CollectionMapping array if isQuestion is false, or null if isQuestion is true>
}
`;

        for (const modelName of COPILOT_CHAT_MODELS) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });
            const result = await model.generateContent(prompt);
            const response = result.response.text();

            let jsonStr = response.trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];

            let parsed: { isQuestion?: boolean; explanation?: string; mappings?: CollectionMapping[] };
            try {
              parsed = JSON.parse(jsonStr);
            } catch {
              // Fallback if model returned array directly
              const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
              if (arrayMatch) {
                parsed = { isQuestion: false, explanation: 'Updated schema mapping.', mappings: JSON.parse(arrayMatch[0]) };
              } else {
                throw new Error('Could not parse AI response.');
              }
            }

            // Case A: User asked a question / inquiry
            if (parsed.isQuestion) {
              const pTok = Math.ceil(prompt.length / 4);
              const rTok = Math.ceil(response.length / 4);
              recordAIUsage({
                timestamp: new Date().toISOString(),
                feature: 'Database Q&A',
                model: modelName,
                promptSnippet: instruction.trim().slice(0, 100),
                promptTokens: pTok,
                responseTokens: rTok,
                totalTokens: pTok + rTok,
                status: 'success',
                durationMs: Date.now() - startTime,
              });

              return {
                success: true,
                data: {
                  mappings, // Untouched original schema
                  isQuestion: true,
                  message: parsed.explanation || 'Here is the requested schema guidance.',
                  changeCount: 0,
                },
              };
            }

            // Case B: Schema modification
            const updatedMappings = parsed.mappings || mappings;

            // Re-assign IDs if missing and preserve previous isAiModified flags
            updatedMappings.forEach((col) => {
              const origCol = mappings.find((m) => m.collectionName === col.collectionName);
              col.fields.forEach((f) => {
                if (!f.id) f.id = randomUUID();
                const origF = origCol?.fields.find((of) => of.id === f.id || of.sourceField === f.sourceField);
                if (origF?.isAiModified) {
                  f.isAiModified = true;
                }
              });
            });

            // Calculate exact differences between old and new mappings
            let changeCount = 0;
            const changedSummaries: string[] = [];
            for (const updatedCol of updatedMappings) {
              const origCol = mappings.find((m) => m.collectionName === updatedCol.collectionName);
              if (!origCol) continue;
              for (const updatedField of updatedCol.fields) {
                const origField = origCol.fields.find(
                  (f) => f.id === updatedField.id || f.sourceField === updatedField.sourceField
                );
                if (origField) {
                  const hasChanged =
                    origField.targetType !== updatedField.targetType ||
                    origField.targetColumn !== updatedField.targetColumn ||
                    origField.isNullable !== updatedField.isNullable ||
                    origField.include !== updatedField.include;

                  if (hasChanged) {
                    changeCount++;
                    updatedField.isAiModified = true;

                    if (origField.targetType !== updatedField.targetType) {
                      changedSummaries.push(
                        `${updatedCol.targetTableName}.${updatedField.targetColumn} (${origField.targetType} → ${updatedField.targetType})`
                      );
                    } else if (origField.targetColumn !== updatedField.targetColumn) {
                      changedSummaries.push(`${origField.targetColumn} → ${updatedField.targetColumn}`);
                    } else if (origField.isNullable !== updatedField.isNullable) {
                      changedSummaries.push(`${updatedField.targetColumn} (nullable: ${updatedField.isNullable})`);
                    } else if (origField.include !== updatedField.include) {
                      changedSummaries.push(`${updatedField.targetColumn} (${updatedField.include ? 'included' : 'excluded'})`);
                    }
                  }
                }
              }
            }

            // Guaranteed Deterministic Fallback if model missed targeted type change
            if (changeCount === 0 && targets.length > 0) {
              let targetTypeOverride: string | null = null;
              if (isPgToMongo) {
                if (/(?:varchaer|worker|varchar|var\s*char|string|text)/i.test(instruction)) {
                  targetTypeOverride = 'string';
                } else if (/object\s*id|uuid|uid/i.test(instruction)) {
                  targetTypeOverride = 'objectId';
                } else if (/big\s*int|bigint|long/i.test(instruction)) {
                  targetTypeOverride = 'long';
                } else if (/\b(int|integer|numberint|serial)\b/i.test(instruction)) {
                  targetTypeOverride = 'int';
                } else if (/\b(double|float|real)\b/i.test(instruction)) {
                  targetTypeOverride = 'double';
                } else if (/\b(decimal|numeric|money)\b/i.test(instruction)) {
                  targetTypeOverride = 'decimal';
                } else if (/\b(bool|boolean)\b/i.test(instruction)) {
                  targetTypeOverride = 'bool';
                } else if (/timestamp|timestamptz|date|time/i.test(instruction)) {
                  targetTypeOverride = 'date';
                } else if (/\b(object|jsonb?)\b/i.test(instruction)) {
                  targetTypeOverride = 'object';
                } else if (/\b(array|list)\b/i.test(instruction)) {
                  targetTypeOverride = 'array';
                } else if (/\b(binary|bytea|bindata)\b/i.test(instruction)) {
                  targetTypeOverride = 'binData';
                }
              } else {
                const varcharMatch = instruction.match(/(?:varchaer|worker|varchar|var\s*char)\s*\(?(\d+)?\)?/i);
                if (varcharMatch) {
                  const len = varcharMatch[1] || '100';
                  targetTypeOverride = `VARCHAR(${len})`;
                } else if (/uuid/i.test(instruction)) {
                  targetTypeOverride = 'UUID';
                } else if (/big\s*int|bigint|long/i.test(instruction)) {
                  targetTypeOverride = 'BIGINT';
                } else if (/\b(int|integer|numberint)\b/i.test(instruction)) {
                  targetTypeOverride = 'INTEGER';
                } else if (/\b(bool|boolean)\b/i.test(instruction)) {
                  targetTypeOverride = 'BOOLEAN';
                } else if (/timestamp|timestamptz|date/i.test(instruction)) {
                  targetTypeOverride = 'TIMESTAMPTZ';
                } else if (/numeric|decimal/i.test(instruction)) {
                  const numMatch = instruction.match(/numeric\s*\((\d+,\s*\d+)\)/i);
                  targetTypeOverride = numMatch ? `NUMERIC(${numMatch[1]})` : 'NUMERIC(18,4)';
                } else if (/\btext\b/i.test(instruction)) {
                  targetTypeOverride = 'TEXT';
                } else if (/\bjsonb?\b/i.test(instruction)) {
                  targetTypeOverride = 'JSONB';
                }
              }

              if (targetTypeOverride) {
                for (const tgt of targets) {
                  const col = updatedMappings.find((c) => c.collectionName === tgt.collectionName);
                  if (col) {
                    const f = col.fields.find(
                      (field) =>
                        field.id === tgt.fieldId ||
                        field.sourceField === tgt.sourceField ||
                        field.targetColumn === tgt.targetColumn
                    );
                    if (f && f.targetType !== targetTypeOverride) {
                      const oldType = f.targetType;
                      f.targetType = targetTypeOverride;
                      f.isAiModified = true;
                      changeCount++;
                      changedSummaries.push(
                        `${col.targetTableName}.${f.targetColumn} (${oldType} → ${targetTypeOverride})`
                      );
                    }
                  }
                }
              }
            }

            let message = parsed.explanation;
            if (changeCount > 0) {
              message = `✨ Successfully updated ${changeCount} column${changeCount > 1 ? 's' : ''}:\n${changedSummaries.map((s) => `• ${s}`).join('\n')}\n\nAll other collections and columns remain safely preserved.`;
            } else if (changeCount === 0 && !message) {
              message = targets.length > 0
                ? `No changes needed for the targeted column(s).`
                : 'No schema columns needed changing for this instruction.';
            }

            const pTok = Math.ceil(prompt.length / 4);
            const rTok = Math.ceil(response.length / 4);
            recordAIUsage({
              timestamp: new Date().toISOString(),
              feature: 'Copilot Tweak',
              model: modelName,
              promptSnippet: instruction.trim().slice(0, 100),
              promptTokens: pTok,
              responseTokens: rTok,
              totalTokens: pTok + rTok,
              status: 'success',
              durationMs: Date.now() - startTime,
            });

            return {
              success: true,
              data: {
                mappings: updatedMappings,
                isQuestion: false,
                changeCount,
                message: message || `Applied instruction: "${instruction.trim()}"`,
              },
            };
          } catch (modelErr) {
            console.warn(`[AI Refine] Model ${modelName} failed:`, (modelErr as Error).message);
          }
        }

        return { success: false, error: 'All AI models failed to refine the mapping.' };
      } catch (err) {
        return { success: false, error: `Failed to refine mapping: ${(err as Error).message}` };
      }
    }
  );

  // In-memory cache for anomaly fixes to save tokens across repeat clicks
  const anomalyFixCache = new Map<string, { data: AIAnomalyFixRecommendation[]; cachedAt: number }>();

  // ── AI Anomaly Fix Recommendations (Step 6 / Option A Remediation Studio) ─
  ipcMain.handle(
    'ai:suggest-anomaly-fixes',
    async (
      _event,
      payload: { anomalies: AnomalyFixRequest[]; apiKey?: string; forceRefresh?: boolean }
    ): Promise<IPCResponse<AIAnomalyFixRecommendation[]>> => {
      const { anomalies, apiKey, forceRefresh } = payload;
      if (!anomalies || anomalies.length === 0) {
        return { success: true, data: [] };
      }

      // Check cache to avoid wasting Gemini tokens if identical anomalies were queried recently
      const cacheKey = anomalies
        .map((a) => `${a.tableName || a.targetTable || ''}:${a.columnName || a.targetColumn || ''}:${a.failureReason || ''}`)
        .sort()
        .join('|');

      if (!forceRefresh && anomalyFixCache.has(cacheKey)) {
        const cached = anomalyFixCache.get(cacheKey)!;
        if (Date.now() - cached.cachedAt < CACHE_TTL_MS) {
          console.log('[AI Anomaly Fix] Cache HIT: returning saved recommendations without consuming tokens.');
          return { success: true, data: cached.data };
        }
      }

      let key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) {
        try {
          const Store = require('electron-store');
          const store = new Store();
          key = store.get('geminiApiKey') || store.get('apiKey');
        } catch {}
      }

      if (!key) {
        const ruleData = generateRuleBasedAnomalyFixes(anomalies);
        anomalyFixCache.set(cacheKey, { data: ruleData, cachedAt: Date.now() });
        return {
          success: true,
          data: ruleData,
        };
      }

      try {
        if (!GoogleGenerativeAI) {
          const imported = await import('@google/generative-ai');
          GoogleGenerativeAI = imported.GoogleGenerativeAI;
        }

        const genAI = new GoogleGenerativeAI(key);

        const prompt = `You are a Principal Database Administrator & Migration Engineer analyzing data quality anomalies when migrating MongoDB to PostgreSQL.
The transactional dry run detected missing or null values in non-nullable columns.
Your task is to recommend the single most semantically accurate, domain-aware DEFAULT fallback value for each affected column, so that 100% of records can be migrated into PostgreSQL under a "DEFAULT '<val>' NOT NULL" constraint without downstream application crashes.

For each anomaly below:
${anomalies
  .map(
    (a, i) => `
Anomaly #${i + 1}:
- Table: "${a.tableName}"
- Column: "${a.columnName}"
- Target PostgreSQL Type: "${a.targetType}"
- Failure Reason: "${a.failureReason}"
- Sample valid values in other records: ${JSON.stringify(a.sampleValues || [])}
- Raw MongoDB offending snippet: ${a.rawSnippet || 'N/A'}
`
  )
  .join('\n')}

Rules for your recommendations:
1. "suggestedValue":
   - For status/lifecycle columns (e.g. status, state): recommend standard default like 'PENDING', 'ACTIVE', or 'DRAFT'.
   - For role/tier columns (e.g. role, tier): recommend baseline user role like 'USER' or 'FREE'.
   - For currency/numeric amounts (e.g. price, total, balance, count): recommend numeric string like '0' or '0.00'.
   - For booleans (e.g. is_active, verified): recommend 'false' (safer default).
   - For dates/timestamps: recommend 'CURRENT_TIMESTAMP' or 'NOW()'.
   - For UUIDs: recommend '00000000-0000-0000-0000-000000000000'.
   - For JSON/JSONB: recommend '{}'.
   - For general free text: recommend a clean, informative string like 'Unknown' or 'N/A'.
2. "rationale": Exactly 1 clear, professional sentence explaining why this default was selected.
3. "sqlClause": The exact PostgreSQL clause, e.g. "DEFAULT 'PENDING' NOT NULL" or "DEFAULT 0 NOT NULL".

Return ONLY a valid JSON array of objects with these exact keys:
[
  {
    "targetTable": string,
    "field": string,
    "targetType": string,
    "suggestedValue": string,
    "rationale": string,
    "sqlClause": string
  }
]`;

        let rawResponseText = '';
        for (const modelName of COPILOT_CHAT_MODELS) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });
            const result = await model.generateContent(prompt);
            rawResponseText = result.response.text();
            if (rawResponseText) break;
          } catch (modelErr) {
            console.warn(`[AI Anomaly Fix] Model ${modelName} failed:`, (modelErr as Error).message);
          }
        }

        if (!rawResponseText) {
          const ruleData = generateRuleBasedAnomalyFixes(anomalies);
          anomalyFixCache.set(cacheKey, { data: ruleData, cachedAt: Date.now() });
          return { success: true, data: ruleData };
        }

        let jsonStr = rawResponseText.trim();
        const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (arrayMatch) jsonStr = arrayMatch[0];

        const parsed = JSON.parse(jsonStr) as AIAnomalyFixRecommendation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((rec) => {
            const orig = anomalies.find(
              (a) =>
                (a.tableName || a.targetTable || '').toLowerCase() === rec.targetTable.toLowerCase() &&
                (a.columnName || a.targetColumn || '').toLowerCase() === rec.field.toLowerCase()
            );
            if (orig?.rawSnippet || orig?.sampleOffendingSnippet) {
              rec.beforeSnippet = orig.rawSnippet || orig.sampleOffendingSnippet;
            }
          });
          anomalyFixCache.set(cacheKey, { data: parsed, cachedAt: Date.now() });
          return { success: true, data: parsed };
        }

        const ruleData = generateRuleBasedAnomalyFixes(anomalies);
        anomalyFixCache.set(cacheKey, { data: ruleData, cachedAt: Date.now() });
        return { success: true, data: ruleData };
      } catch (err) {
        console.warn('[AI Anomaly Fix] Gemini error, using rule-based fallback:', (err as Error).message);
        const ruleData = generateRuleBasedAnomalyFixes(anomalies);
        anomalyFixCache.set(cacheKey, { data: ruleData, cachedAt: Date.now() });
        return { success: true, data: ruleData };
      }
    }
  );
}

function generateRuleBasedAnomalyFixes(anomalies: AnomalyFixRequest[]): AIAnomalyFixRecommendation[] {
  return anomalies.map((a) => {
    const val = getTypeAwareDefaultValue(a.targetType);
    let rationale = `Inferred type-safe default for ${a.targetType.toUpperCase()}`;
    const lowerCol = a.columnName.toLowerCase();
    if (lowerCol.includes('status') || lowerCol.includes('state')) {
      rationale = 'Recommended lifecycle baseline for status fields';
    } else if (lowerCol.includes('role') || lowerCol.includes('tier')) {
      rationale = 'Baseline unprivileged role to prevent privilege escalation';
    } else if (lowerCol.includes('email')) {
      rationale = 'Placeholder contact format to satisfy non-null constraint';
    }
    const sqlClause = formatSqlDefaultClause(val);
    return {
      targetTable: a.tableName,
      field: a.columnName,
      targetType: a.targetType,
      suggestedValue: val,
      rationale,
      sqlClause: `${sqlClause} NOT NULL`,
      beforeSnippet: a.rawSnippet,
    };
  });
}

/**
 * Generate mapping using AI for a batch of schemas
 */
async function generateMappingWithAI(
  model: any,
  schemas: SourceSchema[],
  direction?: 'mongodb-to-postgres' | 'postgres-to-mongo'
): Promise<CollectionMapping[]> {
  const isPgToMongo = direction === 'postgres-to-mongo';

  let prompt = '';
  if (isPgToMongo) {
    prompt = `
You are a principal database architect and migration expert. Convert this PostgreSQL relational schema into a high-performance MongoDB document schema mapping.

Target Database: MongoDB (BSON document model)
Source Database: PostgreSQL (Relational schema)

Rules:
1. Target data types MUST be valid MongoDB BSON types:
   - "string" (for VARCHAR, CHAR, TEXT)
   - "int" (for SERIAL, INT, INTEGER, SMALLINT)
   - "long" (for BIGSERIAL, BIGINT)
   - "decimal" (for NUMERIC, DECIMAL - preserves exact monetary precision)
   - "double" (for FLOAT, REAL, DOUBLE PRECISION)
   - "bool" (for BOOLEAN, BOOL)
   - "date" (for TIMESTAMP, TIMESTAMPTZ, DATE, TIME)
   - "objectId" (for primary keys if converting to standard MongoDB ObjectIds)
   - "object" (for JSON, JSONB)
   - "array" (for PostgreSQL array types)
   - "binData" (for BYTEA, binary data)
2. Primary Key Mapping:
   - Map "id" or primary key column to "id" (type "int" or "long") or "_id".
   - Keep isNullable: false.
3. Foreign Keys and Relationships:
   - If a table has a foreign key (e.g. "customer_id" pointing to "test_customers.id"), retain the field as "customer_id" (type: "int" or "objectId") with foreignKeyToParent set (e.g. "test_customers.id").
4. Target Collection Names:
   - Keep collection names clean, lowercased, and snake_case matching the source table name.
5. All target fields MUST include:
   - "id": unique string identifier
   - "sourceField": source PostgreSQL column name
   - "sourceType": source SQL data type
   - "targetColumn": target MongoDB field name
   - "targetType": target BSON type (string, int, long, double, decimal, bool, date, objectId, object, array, binData)
   - "isNullable": boolean
   - "include": true

---
### Few-Shot Example (PostgreSQL → MongoDB):
Example Input Schema:
[
  {
    "collectionName": "test_customers",
    "fields": [
      { "name": "id", "bsonType": "int", "sqlType": "SERIAL" },
      { "name": "full_name", "bsonType": "string", "sqlType": "VARCHAR(100)" },
      { "name": "email", "bsonType": "string", "sqlType": "VARCHAR(100)" },
      { "name": "is_active", "bsonType": "bool", "sqlType": "BOOLEAN" },
      { "name": "created_at", "bsonType": "date", "sqlType": "TIMESTAMP" }
    ]
  },
  {
    "collectionName": "test_sales",
    "fields": [
      { "name": "id", "bsonType": "int", "sqlType": "SERIAL" },
      { "name": "customer_id", "bsonType": "int", "sqlType": "INTEGER" },
      { "name": "total_amount", "bsonType": "decimal", "sqlType": "NUMERIC(10,2)" },
      { "name": "payment_method", "bsonType": "string", "sqlType": "VARCHAR(30)" },
      { "name": "sale_date", "bsonType": "date", "sqlType": "TIMESTAMP" }
    ]
  }
]

Example Expected JSON Output:
[
  {
    "collectionName": "test_customers",
    "targetTableName": "test_customers",
    "fields": [
      { "id": "f1", "sourceField": "id", "sourceType": "SERIAL", "targetColumn": "id", "targetType": "int", "isNullable": false, "include": true },
      { "id": "f2", "sourceField": "full_name", "sourceType": "VARCHAR(100)", "targetColumn": "full_name", "targetType": "string", "isNullable": false, "include": true },
      { "id": "f3", "sourceField": "email", "sourceType": "VARCHAR(100)", "targetColumn": "email", "targetType": "string", "isNullable": false, "include": true },
      { "id": "f4", "sourceField": "is_active", "sourceType": "BOOLEAN", "targetColumn": "is_active", "targetType": "bool", "isNullable": true, "include": true },
      { "id": "f5", "sourceField": "created_at", "sourceType": "TIMESTAMP", "targetColumn": "created_at", "targetType": "date", "isNullable": true, "include": true }
    ],
    "indexes": [],
    "childTables": []
  },
  {
    "collectionName": "test_sales",
    "targetTableName": "test_sales",
    "fields": [
      { "id": "f6", "sourceField": "id", "sourceType": "SERIAL", "targetColumn": "id", "targetType": "int", "isNullable": false, "include": true },
      { "id": "f7", "sourceField": "customer_id", "sourceType": "INTEGER", "targetColumn": "customer_id", "targetType": "int", "isNullable": false, "include": true, "foreignKeyToParent": "test_customers.id" },
      { "id": "f8", "sourceField": "total_amount", "sourceType": "NUMERIC(10,2)", "targetColumn": "total_amount", "targetType": "decimal", "isNullable": false, "include": true },
      { "id": "f9", "sourceField": "payment_method", "sourceType": "VARCHAR(30)", "targetColumn": "payment_method", "targetType": "string", "isNullable": true, "include": true },
      { "id": "f10", "sourceField": "sale_date", "sourceType": "TIMESTAMP", "targetColumn": "sale_date", "targetType": "date", "isNullable": true, "include": true }
    ],
    "indexes": [],
    "childTables": []
  }
]
---

Now, convert this actual PostgreSQL Schema (JSON):
${JSON.stringify(schemas, null, 2)}

Return ONLY the JSON array matching the structure above. No markdown, no conversational text.
`;
  } else {
    prompt = `
You are a principal database architect and migration expert. Convert this MongoDB schema to a high-performance PostgreSQL schema mapping.

Rules:
1. ObjectId → VARCHAR(24) (store as hex string)
2. String → TEXT (default) or VARCHAR(N) if known length
3. NumberInt → INTEGER
4. NumberLong → BIGINT
5. Double → DOUBLE PRECISION (never for money)
6. Decimal128 → NUMERIC(18,4) (always for money/currency)
7. ISODate/Date → TIMESTAMPTZ (always timezone-aware)
8. Boolean → BOOLEAN
9. Binary / UUID → UUID or BYTEA
10. Array of primitives (strings/ints) → TEXT[] or INTEGER[]
11. Array of objects → Create separate child table with foreign key (set isChildTable: true, childTableName, foreignKeyToParent)
12. Nested object (1-2 levels) → Flatten with underscore (e.g., address.city → address_city)
13. Nested object (3+ levels or polymorphic) → JSONB
14. Null/missing → Column must be NULLABLE (isNullable: true)
15. Cross-Collection Relationships & Foreign Keys (Improvement 3):
    Analyze all collections together. If a collection has a field referencing another collection's primary key (e.g., 'userId' or 'customerId' in orders pointing to 'users._id', or 'productId' pointing to 'products._id'):
    - Set foreignKeyToParent to the referenced table (e.g. "users.id")
    - Ensure targetColumn uses snake_case (e.g. "user_id")
    - Set targetType to match the referenced key (VARCHAR(24))
16. Value-Aware Sizing from sampleValues (Improvement 1):
    If sampleValues are provided, use them to optimize column types:
    - Email addresses → VARCHAR(255)
    - Short status/codes → VARCHAR(20) or VARCHAR(50)
    - Phone numbers → VARCHAR(20)
    - Price/money values → NUMERIC(18,4) or DOUBLE PRECISION
17. PostgreSQL Reserved Words Protection (Improvement 2):
    Do NOT name columns or tables with unquoted PostgreSQL reserved keywords (such as 'order', 'user', 'group', 'table', 'check', 'limit', 'offset', 'primary', 'references').
    Rename them safely to prevent syntax errors (e.g. 'order' → 'orders' or 'order_record', 'user' → 'users' or 'app_user', 'limit' → 'item_limit', 'check' → 'check_status').

---
### Few-Shot Example (Improvement 4):
Example Input Schema:
[
  {
    "collectionName": "users",
    "fields": [
      { "name": "_id", "bsonType": "ObjectId", "sampleValues": ["60d5ec49f1b24b0015f8e001"] },
      { "name": "email", "bsonType": "string", "sampleValues": ["alice@example.com"] }
    ]
  },
  {
    "collectionName": "orders",
    "fields": [
      { "name": "_id", "bsonType": "ObjectId" },
      { "name": "userId", "bsonType": "ObjectId", "sampleValues": ["60d5ec49f1b24b0015f8e001"] },
      { "name": "status", "bsonType": "string", "sampleValues": ["completed", "pending"] },
      { "name": "items", "bsonType": "arrayOfObjects" }
    ]
  }
]

Example Expected JSON Output:
[
  {
    "collectionName": "users",
    "targetTableName": "users",
    "fields": [
      { "id": "f1", "sourceField": "_id", "sourceType": "ObjectId", "targetColumn": "id", "targetType": "VARCHAR(24)", "isNullable": false, "include": true },
      { "id": "f2", "sourceField": "email", "sourceType": "string", "targetColumn": "email", "targetType": "VARCHAR(255)", "isNullable": false, "include": true }
    ],
    "indexes": [
      { "sourceIndexName": "idx_users_email", "targetIndexName": "idx_users_email", "targetSql": "CREATE INDEX CONCURRENTLY \"idx_users_email\" ON \"users\" (\"email\");", "include": true, "isConcurrently": true, "isGin": false }
    ],
    "childTables": []
  },
  {
    "collectionName": "orders",
    "targetTableName": "orders",
    "fields": [
      { "id": "f3", "sourceField": "_id", "sourceType": "ObjectId", "targetColumn": "id", "targetType": "VARCHAR(24)", "isNullable": false, "include": true },
      { "id": "f4", "sourceField": "userId", "sourceType": "ObjectId", "targetColumn": "user_id", "targetType": "VARCHAR(24)", "isNullable": false, "include": true, "foreignKeyToParent": "users.id" },
      { "id": "f5", "sourceField": "status", "sourceType": "string", "targetColumn": "status", "targetType": "VARCHAR(20)", "isNullable": false, "include": true },
      { "id": "f6", "sourceField": "items", "sourceType": "arrayOfObjects", "targetColumn": "items", "targetType": "JSONB", "isNullable": true, "include": true, "isChildTable": true, "childTableName": "orders_items", "foreignKeyToParent": "orders_id" }
    ],
    "indexes": [],
    "childTables": []
  }
]
---

Now, convert this actual MongoDB Schema (JSON):
${JSON.stringify(schemas, null, 2)}

Return ONLY the JSON array matching the structure above. No markdown, no conversational text.
`;
  }

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  // Robust JSON extraction (handles leading/trailing commentary or markdown code blocks)
  let jsonStr = response.trim();
  const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  } else {
    jsonStr = jsonStr.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  }

  // Parse JSON with defensive structure validation
  let rawMappings: unknown;
  try {
    rawMappings = JSON.parse(jsonStr);
  } catch (parseErr) {
    throw new Error(`Failed to parse AI response as JSON: ${(parseErr as Error).message}`);
  }

  if (!Array.isArray(rawMappings) || rawMappings.length === 0) {
    throw new Error('AI returned invalid schema response: expected non-empty array of collection mappings.');
  }

  for (const item of rawMappings) {
    if (!item || typeof item !== 'object') {
      throw new Error('AI returned invalid collection mapping item: expected object.');
    }
    const mappingObj = item as Record<string, unknown>;
    if (typeof mappingObj.collectionName !== 'string' || typeof mappingObj.targetTableName !== 'string') {
      throw new Error('AI returned collection mapping missing collectionName or targetTableName.');
    }
    if (!Array.isArray(mappingObj.fields)) {
      throw new Error(`AI returned collection mapping "${mappingObj.collectionName}" without a valid fields array.`);
    }
  }

  const mappings: CollectionMapping[] = rawMappings as CollectionMapping[];

  // Validate and add UUIDs if missing, and ensure indexes are properly populated
  mappings.forEach((mapping) => {
    mapping.fields.forEach((field) => {
      if (!field.id) {
        field.id = randomUUID();
      }
    });

    const srcSchema = schemas.find((s) => s.collectionName === mapping.collectionName);
    if (srcSchema && srcSchema.indexes && srcSchema.indexes.length > 0) {
      const validAiIndexes = (mapping.indexes || []).filter(
        (idx) => idx && idx.sourceIndexName && idx.targetSql
      );
      if (validAiIndexes.length === 0) {
        mapping.indexes = srcSchema.indexes.map((idx) => {
          const fieldNames = Object.keys(idx.fields || {});
          const keyField = fieldNames[0] || (idx.name.includes('pkey') ? 'id' : 'field');
          const isUnique = Boolean(idx.unique || idx.name.includes('pkey') || idx.name.includes('key'));
          const targetSql = isPgToMongo
            ? `db.${mapping.targetTableName}.createIndex({ "${keyField}": 1 }${isUnique ? ', { unique: true }' : ''});`
            : isUnique
            ? `ALTER TABLE "${mapping.targetTableName}" ADD CONSTRAINT "idx_${mapping.targetTableName}_${keyField}" UNIQUE ("${keyField}");`
            : `CREATE INDEX CONCURRENTLY "idx_${mapping.targetTableName}_${keyField}" ON "${mapping.targetTableName}" ("${keyField}");`;

          return {
            sourceIndexName: idx.name || `idx_${mapping.targetTableName}_${keyField}`,
            targetIndexName: `idx_${mapping.targetTableName}_${keyField}`,
            targetSql,
            include: true,
            isConcurrently: !isUnique,
            isGin: false,
          };
        });
      }
    }
  });

  return mappings;
}

/**
 * Register all AI handlers
 */
export function setupAIHandlers(): void {
  setupAIHandler();
}
