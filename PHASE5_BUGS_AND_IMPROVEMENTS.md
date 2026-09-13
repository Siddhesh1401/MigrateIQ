# Phase 5: Bugs, Issues & Improvements Guide

## 🚨 CRITICAL ISSUES (Fix Before Production)

### **ISSUE #1: API KEY EXPOSED IN GIT (CRITICAL)**
**Severity:** 🔴 CRITICAL  
**Location:** `apps/desktop/.env`  
**Problem:** Your real Google Gemini API key is committed to Git:
```
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

**Action Required (URGENT):**
1. **Immediately rotate the API key** in Google Cloud Console
2. Add `.env` to `.gitignore`:
   ```bash
   echo "apps/desktop/.env" >> .gitignore
   ```
3. Create `.env.example`:
   ```
   VITE_GEMINI_API_KEY=your_api_key_here
   ```
4. Remove from Git history:
   ```bash
   git rm --cached apps/desktop/.env
   git commit -m "fix: remove .env with exposed API key from git history"
   ```

---

### **ISSUE #2: In-Memory Cache Never Cleaned (HIGH)**
**Severity:** 🟠 HIGH  
**Location:** `apps/desktop/main/handlers/ai.ts`, lines 56-62  
**Problem:** Cache grows unbounded. After 1000 schemas, memory usage ~50-100MB.
```typescript
const mappingCache = new Map<string, CacheEntry>();  // Never purged
```

**Fix (15 minutes):**
```typescript
// Add automatic cleanup every 1 hour
setInterval(() => {
  const now = Date.now();
  const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  
  for (const [key, entry] of mappingCache.entries()) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      mappingCache.delete(key);
      console.log(`[AI Cache] Expired entry: ${key.substring(0, 50)}...`);
    }
  }
  
  console.log(`[AI Cache] Cleanup complete. Current size: ${mappingCache.size} entries`);
}, 60 * 60 * 1000); // Every hour
```

---

### **ISSUE #3: Batch Processing Loses Data on Partial Failure (CRITICAL)**
**Severity:** 🔴 CRITICAL  
**Location:** `apps/desktop/main/handlers/ai.ts`, lines 171-186  
**Problem:** If batch 2 of 3 fails, ALL 3 batches fall back to rule engine, losing batch 1's AI work.

**Current Code (BROKEN):**
```typescript
for (let i = 0; i < schemas.length; i += 5) {
  const batch = schemas.slice(i, i + 5);
  const batchMappings = await generateMappingWithAI(model, batch);
  tempMappings.push(...batchMappings);
  // ↑ If this throws, entire operation fails
}
```

**Fix (1 hour):**
```typescript
const tempMappings: CollectionMapping[] = [];
let allSucceeded = true;

for (let i = 0; i < schemas.length; i += 5) {
  const batch = schemas.slice(i, i + 5);
  const batchIndex = Math.floor(i / 5) + 1;
  const totalBatches = Math.ceil(schemas.length / 5);
  
  try {
    console.log(`[AI] Processing batch ${batchIndex}/${totalBatches} (${batch.length} collections)`);
    const batchMappings = await generateMappingWithAI(model, batch, payload.direction);
    tempMappings.push(...batchMappings);
    console.log(`[AI] Batch ${batchIndex} succeeded`);
  } catch (batchErr) {
    // Fall back to rule engine for THIS BATCH ONLY
    console.warn(`[AI] Batch ${batchIndex} failed: ${(batchErr as Error).message}`);
    console.log(`[AI] Using rule engine for batch ${batchIndex}`);
    
    const ruleBatch = generateMappingByRules(batch, payload.direction);
    tempMappings.push(...ruleBatch);
    allSucceeded = false; // Mark that we had to use fallback
  }
}

// Update badge based on success
const badge = allSucceeded ? 'AI Suggested' : 'Mixed Mapping (AI + Rules)';
```

---

### **ISSUE #4: Direction Parameter Can Be Undefined (CRITICAL)**
**Severity:** 🔴 CRITICAL  
**Location:** `apps/desktop/main/handlers/ai.ts`, lines 58-62  
**Problem:** If direction is undefined, cache key defaults to `'mongodb-to-postgres'`, causing wrong mappings for PostgreSQL→MongoDB.

**Test Case (FAILS):**
1. Step 1: Select "PostgreSQL → MongoDB"
2. Step 4: Request mapping (direction passed but could be undefined)
3. Cache key becomes `mongodb-to-postgres` instead of `postgres-to-mongo`
4. User gets wrong mapping

**Fix (30 minutes):**
```typescript
function getMappingCacheKey(schemas: SourceSchema[], direction?: string): string {
  // VALIDATE direction is set
  if (!direction || (direction !== 'mongodb-to-postgres' && direction !== 'postgres-to-mongo')) {
    console.error('[AI Cache] Invalid direction:', direction);
    throw new Error('Direction must be "mongodb-to-postgres" or "postgres-to-mongo"');
  }
  
  const signature = schemas.map((s) => ({
    col: s.collectionName,
    fields: s.fields.map((f) => `${f.name}:${f.bsonType}:${f.isNullable}`), // Exclude sampleValues
  }));
  return `${direction}::${JSON.stringify(signature)}`;
}
```

And in `MigrationWizard.tsx`, ensure direction is always set before Step 4:
```typescript
if (!wizardStore.direction) {
  return <div>Error: No direction selected. Please go back to Step 1.</div>;
}
```

---

### **ISSUE #5: JSON Response Validation Missing (MEDIUM)**
**Severity:** 🟠 MEDIUM  
**Location:** `apps/desktop/main/handlers/ai.ts`, lines 340-350  
**Problem:** AI response isn't validated. If AI returns `{foo: "bar"}`, code accepts it as `CollectionMapping[]`.

**Fix (1 hour):**
```typescript
function validateCollectionMappings(data: unknown): CollectionMapping[] {
  if (!Array.isArray(data)) {
    throw new Error('Expected array of CollectionMapping, got: ' + typeof data);
  }
  
  for (let i = 0; i < data.length; i++) {
    const mapping = data[i];
    
    // Required fields
    if (!mapping.collectionName || typeof mapping.collectionName !== 'string') {
      throw new Error(`Mapping[${i}].collectionName is required and must be string`);
    }
    if (!mapping.targetTableName || typeof mapping.targetTableName !== 'string') {
      throw new Error(`Mapping[${i}].targetTableName is required`);
    }
    if (!Array.isArray(mapping.fields)) {
      throw new Error(`Mapping[${i}].fields must be array`);
    }
    
    // Validate fields
    for (let j = 0; j < mapping.fields.length; j++) {
      const field = mapping.fields[j];
      if (!field.sourceField || !field.targetColumn || !field.targetType) {
        throw new Error(`Mapping[${i}].fields[${j}] missing sourceField, targetColumn, or targetType`);
      }
      if (typeof field.isNullable !== 'boolean') {
        throw new Error(`Mapping[${i}].fields[${j}].isNullable must be boolean`);
      }
    }
  }
  
  return data as CollectionMapping[];
}

// Usage in generateMappingWithAI:
const mappings = validateCollectionMappings(JSON.parse(cleanedResponse));
```

---

## 🟠 HIGH PRIORITY IMPROVEMENTS

### **IMPROVEMENT #1: Add Jitter to Health Score Retries**
**Location:** `apps/desktop/renderer/src/screens/MigrationWizard.tsx`, lines 545-546  
**Problem:** Exponential backoff with no jitter can trigger rate limiter again.

**Fix (5 minutes):**
```typescript
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    const response = await window.electronAPI.invoke<AIHealthScoreResponse | null>(
      'ai:health-score',
      {
        schemas,
        apiKey: import.meta.env.VITE_GEMINI_API_KEY,
        direction: wizardStore.direction,
      }
    );
    // ... rest of code

  } catch (error) {
    if (attempt < maxRetries) {
      const baseWait = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * 0.1 * baseWait; // ±10%
      const waitTime = baseWait + jitter;
      
      console.log(`[Health Score] Attempt ${attempt}/${maxRetries} failed. Retrying in ${Math.round(waitTime)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}
```

---

### **IMPROVEMENT #2: Remove API Key from Logs**
**Location:** `apps/desktop/main/handlers/ai.ts`, line 137  
**Problem:** Even truncated API keys shouldn't be logged in production.

**Fix (2 minutes):**
```typescript
// OLD
console.log('[AI Handler] API Key received:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT PROVIDED');

// NEW
console.log('[AI Handler] Attempting schema mapping with provided API key');
```

---

### **IMPROVEMENT #3: Warn About PostgreSQL Reserved Words in MongoDB→PostgreSQL Prompt**
**Location:** `apps/desktop/main/handlers/ai.ts`, lines 795-880  
**Problem:** AI might map `order`, `user`, `group` fields directly, causing SQL errors.

**Fix (10 minutes):** Add to the MongoDB→PostgreSQL prompt:
```typescript
const prompt = `
You are a database migration expert. Convert this MongoDB schema to PostgreSQL schema mapping.

⚠️ IMPORTANT: PostgreSQL Reserved Words
The following words are PostgreSQL reserved keywords and must be quoted:
order, user, group, table, select, where, from, join, limit, offset, primary, references,
check, constraint, foreign, key, index, view, trigger, procedure, function, window

If a MongoDB field is named with a reserved keyword (e.g., 'order', 'user'), include the name as-is
in the mapping, and quote it with double quotes in the generated SQL. Do NOT rename the field.

MongoDB Schema (JSON):
...
`;
```

---

### **IMPROVEMENT #4: Add Loading Indicator for Health Score Badge**
**Location:** `apps/desktop/renderer/src/screens/MigrationWizard.tsx`  
**Problem:** User sees empty badge, then suddenly score appears. Confusing.

**Fix (30 minutes):**
```typescript
{/* Health Score Badge (async) */}
{isHealthScoreLoading && (
  <span style={{
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    padding: '0.375rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
  }}>
    <span className="spinner-small"></span>
    🧬 Analyzing Schema...
  </span>
)}
{!isHealthScoreLoading && healthScore !== null && (
  <span style={{
    backgroundColor: healthScore >= 80 ? '#DCFCE7' : healthScore >= 60 ? '#FEF3C7' : '#FEE2E2',
    color: healthScore >= 80 ? '#15803D' : healthScore >= 60 ? '#D97706' : '#DC2626',
    padding: '0.375rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    fontWeight: 500,
  }}>
    🧬 Health: {healthScore}/100
  </span>
)}
```

---

### **IMPROVEMENT #5: Extract Magic Numbers to Constants**
**Location:** Multiple files  
**Problem:** Constants like `6000`, `5`, `30 * 60 * 1000` are magic numbers scattered throughout.

**Fix (30 minutes):** Create `apps/desktop/main/config/constants.ts`:
```typescript
// AI Configuration
export const AI_CONFIG = {
  // Cache settings
  CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes
  CACHE_CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  
  // Batch processing
  TOKEN_THRESHOLD_FOR_BATCHING: 6000,
  BATCH_SIZE: 5,
  TOKENS_PER_CHARACTER: 4,
  
  // Model cascades
  SCHEMA_MAPPING_MODELS: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ],
  
  HEALTH_SCORE_MODELS: [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ],
  
  // Health score retry
  HEALTH_SCORE_MAX_RETRIES: 3,
  HEALTH_SCORE_RETRY_BASE_DELAY_MS: 1000,
};
```

Then use: `if (estimatedTokens > AI_CONFIG.TOKEN_THRESHOLD_FOR_BATCHING)`

---

## 💡 FEATURE SUGGESTIONS (Nice-to-Haves)

### **FEATURE #1: Dry-Run SQL Preview**
**Effort:** 2 hours | **Impact:** HIGH

Allow user to preview the actual SQL that will be generated BEFORE clicking Continue:
- Button: "Preview SQL"
- Modal shows: `CREATE TABLE` statements for each mapped collection
- User can copy SQL to clipboard
- Shows warnings for reserved keywords

**Files to Modify:**
- `SchemaMapper.tsx` - Add "Preview SQL" button
- `ruleEngine.ts` - Extract DDL generation logic
- `schema-mapper.css` - Add modal styling

---

### **FEATURE #2: Export/Import Mappings**
**Effort:** 1.5 hours | **Impact:** MEDIUM

Save mapping as JSON file and import in future migrations:
- Button: "Export as JSON"
- Button: "Import from File"
- Useful for reusing mappings across similar schemas

**Files:**
- Add export handler in `handlers/`
- Add import in `SchemaMapper.tsx`

---

### **FEATURE #3: Comparison View (AI vs Rule Engine)**
**Effort:** 2 hours | **Impact:** MEDIUM

Show side-by-side comparison:
- Column 1: AI-suggested mapping
- Column 2: Rule engine mapping
- Column 3: Differences highlighted

**Files:**
- Create `ComparisonView.tsx`
- Add toggle in `SchemaMapper.tsx`

---

### **FEATURE #4: Field-Level Explanations**
**Effort:** 2.5 hours | **Impact:** MEDIUM

Hover over a type mapping to see why it was chosen:
- `VARCHAR(255)` → "Common size for names, emails"
- `NUMERIC(18,4)` → "Preserves decimal precision for currency"
- `JSONB` → "Deeply nested object (3+ levels)"

**Implementation:**
- Add `explanation` field to `FieldMapping` type
- Include explanations in AI prompt
- Add tooltip UI in `SchemaMapper`

---

### **FEATURE #5: AI Confidence Scores**
**Effort:** 1.5 hours | **Impact:** MEDIUM

Each field shows confidence (0-100):
- 95%+ = High confidence (green)
- 70-94% = Medium confidence (yellow)
- <70% = Low confidence (red) — requires user review

**Implementation:**
- Add to AI prompt: `"confidence": 85`
- Add to `FieldMapping` type
- Color-code rows in `SchemaMapper` by confidence

---

### **FEATURE #6: Undo/Redo in SchemaMapper**
**Effort:** 2 hours | **Impact:** MEDIUM

Standard undo/redo stack:
- Ctrl+Z to undo
- Ctrl+Shift+Z to redo
- "Revert to AI" button

**Implementation:**
- Use `useReducer` instead of `useState`
- Track action history
- Add keyboard listeners

---

### **FEATURE #7: Bulk Field Rename (camelCase ↔ snake_case)**
**Effort:** 1 hour | **Impact:** LOW

Quick action: "Convert all to snake_case" or "Convert all to camelCase"

**Implementation:**
- Add buttons in `SchemaMapper`
- Apply transformation to all field names at once

---

### **FEATURE #8: Data Sample Preview**
**Effort:** 2 hours | **Impact:** MEDIUM

Show first 5 sample values for each field:
- Button: "Show Sample"
- Modal: Displays actual data values
- Helps user validate mapping decisions

**Implementation:**
- Pass `sampleValues` from introspection
- Create `SamplePreviewModal.tsx`

---

## 📋 IMPLEMENTATION ROADMAP

### **Phase 5.1 (Bug Fixes) — 1-2 Days**
- [x] Rotate API key
- [x] Add `.env` to `.gitignore`
- [ ] Implement cache cleanup
- [ ] Fix direction parameter validation
- [ ] Add batch-level error recovery
- [ ] Remove API key from logs
- [ ] Add JSON response validation

**Estimated Effort:** 6-8 hours

### **Phase 5.2 (UX Improvements) — 1 Day**
- [ ] Add health score loading indicator
- [ ] Add PostgreSQL reserved words warning
- [ ] Extract magic numbers to constants
- [ ] Add jitter to retry backoff

**Estimated Effort:** 2-3 hours

### **Phase 6 (New Features) — After Phase 6 Risk Report**
- [ ] Dry-run SQL preview
- [ ] Export/import mappings
- [ ] Comparison view
- [ ] Field explanations
- [ ] Confidence scores
- [ ] Undo/redo

**Estimated Effort:** 10-12 hours

---

## ✅ VERIFICATION CHECKLIST AFTER FIXES

- [ ] Run `npm run desktop:dev` — builds without errors
- [ ] Verify cache cleaning works (check console logs after 1 hour)
- [ ] Test batch processing with 15+ collections
- [ ] Test PostgreSQL→MongoDB direction (verify direction param is set)
- [ ] Test AI failure → rule engine fallback (with partial batch recovery)
- [ ] Verify API key NOT in logs or Git
- [ ] Verify health score loading indicator appears
- [ ] Test with malformed AI response (verify validation catches it)

---

## 🎯 FINAL SUMMARY

**Current State:** ✅ **Functional but needs hardening**

**Blockers:** 5 (all fixable in 1-2 days)

**Nice-to-Haves:** 8 (can be added in Phase 6+)

**Recommendation:** Fix all 5 critical issues before Phase 6, then add features as bandwidth allows.

