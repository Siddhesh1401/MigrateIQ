# Phase 7: Bugs, Edge Cases & Industry-Level Improvements

## Overview
Detailed audit of **only Phase 7** code for bugs, missing edge cases, and improvements to make it production-grade.

---

## 🔴 CRITICAL BUGS (Fix These First)

### Bug #1: Race Condition on Rapid Risk Re-scans
**File:** `apps/desktop/renderer/src/screens/RiskReport.tsx`  
**Lines:** 250-280 (useEffect hook)  
**Severity:** 🔴 CRITICAL  
**Impact:** User sees stale/incorrect risk data if clicking "Re-scan" multiple times

**What happens:**
```
User clicks "Re-scan" → IPC call 1 sent (starts analysis)
User clicks "Re-scan" again → IPC call 2 sent (analysis runs in parallel)
Call 2 finishes first → setRiskAnalysis(result2)
Call 1 finishes later → setRiskAnalysis(result1) [OVERWRITES result2 with stale data]
User sees wrong analysis
```

**Root cause:** No request deduplication or cancellation token.

**Fix:**
```typescript
// RiskReport.tsx
export function RiskReport() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runLiveAnalysis = useCallback(async () => {
    // PREVENT: If already analyzing, don't start another
    if (isAnalyzing) {
      console.warn('Analysis already in progress');
      return;
    }

    setIsAnalyzing(true);
    
    // Cancel previous request if any
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const result = await window.electronAPI.invoke('risk:analyze', {
        // ... payload
      });
      
      // Only set state if not cancelled
      if (!abortControllerRef.current?.signal.aborted) {
        setRiskAnalysis(result);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, schemaMapping, sourceSchema]);

  return (
    <>
      {/* Disable button while analyzing */}
      <button onClick={runLiveAnalysis} disabled={isAnalyzing}>
        {isAnalyzing ? 'Analyzing...' : 'Re-scan Risks'}
      </button>
    </>
  );
}
```

**Time to fix:** 30 minutes

---

### Bug #2: DFS Cycle Detection Can Miss Complex Cycles
**File:** `apps/desktop/main/engine/riskAnalyzer.ts`  
**Lines:** 47-113 (`detectFkCycles` function)  
**Severity:** 🔴 CRITICAL  
**Impact:** Complex circular FK dependencies not detected → migration fails at runtime with constraint violations

**What happens:**
```
Schema: A → B → C → D, where D → A (4-node cycle)
DFS traversal if it goes: A → B → C [stack ends] 
                         visits D separately
D → A succeeds (no active recursion for A)
Cycle MISSED ❌

Should detect: A ↔ B ↔ C ↔ D (all part of same SCC)
```

**Root cause:** Simple DFS only detects cycles in active recursion stack. Doesn't find cycles across branches.

**Current code (problematic):**
```typescript
function detectFkCycles(mappings: CollectionMapping[]): string[][] {
  const graph = new Map<string, Set<string>>();
  // Build graph...

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (recursionStack.has(neighbor)) {  // ❌ Only checks active stack
        // Found cycle
      } else if (!visited.has(neighbor)) {
        dfs(neighbor, path);
      }
    }
    recursionStack.delete(node);
    path.pop();
  }
}
```

**Better fix: Use Tarjan's Strongly Connected Component Algorithm**

```typescript
import type { CollectionMapping } from '@migrateiq/shared';

interface GraphNode {
  index: number;
  lowLink: number;
  onStack: boolean;
}

export function detectFkCycles(mappings: CollectionMapping[]): string[][] {
  const graph = new Map<string, Set<string>>();

  // Build adjacency list from FK relationships
  for (const mapping of mappings) {
    if (!graph.has(mapping.collectionName)) {
      graph.set(mapping.collectionName, new Set());
    }

    for (const field of mapping.fields) {
      if (field.foreignKeyToParent) {
        const parentTable = field.foreignKeyToParent.split('.')[0];
        if (graph.has(parentTable)) {
          graph.get(mapping.collectionName)!.add(parentTable);
        }
      }
    }
  }

  const nodes = new Map<string, GraphNode>();
  const stack: string[] = [];
  const sccs: string[][] = []; // Strongly connected components (cycles)
  let index = 0;

  function strongconnect(v: string): void {
    // Set depth index for v to the smallest unused index
    nodes.set(v, { index, lowLink: index, onStack: true });
    index++;
    stack.push(v);

    // Consider successors of v
    const neighbors = graph.get(v) || new Set<string>();
    for (const w of neighbors) {
      if (!nodes.has(w)) {
        // Successor w has not yet been visited; recurse on it
        strongconnect(w);
        const nodeV = nodes.get(v)!;
        const nodeW = nodes.get(w)!;
        nodeV.lowLink = Math.min(nodeV.lowLink, nodeW.lowLink);
      } else {
        const nodeW = nodes.get(w)!;
        if (nodeW.onStack) {
          // Successor w is in stack, hence in the current SCC
          const nodeV = nodes.get(v)!;
          nodeV.lowLink = Math.min(nodeV.lowLink, nodeW.index);
        }
      }
    }

    // If v is a root node, pop the stack and output an SCC
    const nodeV = nodes.get(v)!;
    if (nodeV.lowLink === nodeV.index) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        const nodeW = nodes.get(w)!;
        nodeW.onStack = false;
        scc.push(w);
      } while (w !== v);

      // Only return SCCs with more than 1 node (actual cycles)
      if (scc.length > 1) {
        sccs.push(scc);
      }
    }
  }

  // Find all SCCs
  for (const v of graph.keys()) {
    if (!nodes.has(v)) {
      strongconnect(v);
    }
  }

  return sccs;
}
```

**Why Tarjan's algorithm?**
- ✅ Finds ALL strongly connected components (cycles) in one pass
- ✅ O(V + E) complexity (optimal)
- ✅ Robust for complex multi-cycle graphs
- ✅ Industry-standard for cycle detection

**Time to fix:** 2-3 hours

---

### Bug #3: Integer Overflow Detection Uses Unsafe Number Conversion
**File:** `apps/desktop/main/engine/riskAnalyzer.ts` & `apps/desktop/main/handlers/risk.ts`  
**Lines:** 303-325 (riskAnalyzer.ts), 193-198 (risk.ts)  
**Severity:** 🔴 CRITICAL  
**Impact:** Large integers (> 2^53) get silently truncated → data corruption during migration

**What happens:**
```
BSON Long value: 9007199254740992 (2^53, at JavaScript Number limit)
toNumber() in JavaScript → 9007199254740992
Next value: 9007199254740993 (2^53 + 1)
toNumber() → 9007199254740992 [SAME VALUE! ❌ Precision lost]

Both values round to same Number, overflow NOT detected
```

**Root cause:** JavaScript's `Number` type loses precision for integers > 2^53-1.

**Current problematic code (risk.ts):**
```typescript
const overflowRisks = fieldOverflows[collection.collectionName] || [];
for (const field of overflowRisks) {
  const maxVal = Number(field.maxValue); // ❌ Precision loss for large values
  if (maxVal > 2147483647) {
    // Detected
  }
}
```

**Fix: Use BigInt for safe integer detection**

```typescript
// Add at top of risk.ts
const INT32_MAX = 2147483647n;      // 2^31 - 1
const INT64_MAX = 9223372036854775807n; // 2^63 - 1

function parseIntegerSafely(value: any): BigInt | null {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value)) {
        // Number is too large, convert to BigInt
        return BigInt(value.toFixed(0));
      }
      return BigInt(value);
    }
    if (typeof value === 'string') return BigInt(value);
  } catch {
    return null;
  }
  return null;
}

// In risk analysis (risk.ts):
ipcMain.handle('risk:analyze', async (_event, payload: RiskAnalyzePayload) => {
  try {
    const { sourceSchema, mapping, fieldMaxValues } = payload;
    const risks: RiskItem[] = [];

    // Rule 12: Integer Overflow Detection
    for (const [collectionName, fields] of Object.entries(fieldMaxValues || {})) {
      for (const [fieldName, maxValue] of Object.entries(fields as any)) {
        const bigIntValue = parseIntegerSafely(maxValue);
        
        if (bigIntValue && bigIntValue > INT32_MAX) {
          const fieldMapping = mapping
            .find((m) => m.collectionName === collectionName)
            ?.fields.find((f) => f.sourceField === fieldName);

          if (fieldMapping?.targetType === 'INTEGER' || fieldMapping?.targetType === 'INT4') {
            risks.push({
              id: `risk-overflow-${collectionName}-${fieldName}`,
              severity: 'critical',
              title: 'Integer Overflow: Column Too Small',
              description: `Field "${fieldName}" in collection "${collectionName}" has values up to ${bigIntValue.toString()}, exceeding 32-bit integer max (2,147,483,647). Mapping to INTEGER will cause data corruption.`,
              suggestedFix: 'Upgrade column type to BIGINT (64-bit, safe up to 9.22 quintillion).',
              autoFixAvailable: true,
              autoFixAction: {
                type: 'change_column_type',
                collectionName,
                fieldName,
                recommendedValue: 'BIGINT',
                description: `Upgrade "${fieldName}" from INTEGER to BIGINT`,
              },
              affectedTable: collectionName,
              affectedField: fieldName,
            });
          }
        }
      }
    }

    return { success: true, data: { risks, /* ... */ } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**Time to fix:** 1-2 hours

---

### Bug #4: Missing React Key Prop in Layer 2 Cards Loop
**File:** `apps/desktop/renderer/src/screens/RiskReport.tsx`  
**Lines:** 820+ (Layer 2 cards map)  
**Severity:** 🔴 CRITICAL  
**Impact:** React state corruption when expanding/collapsing Layer 2 feature cards

**What happens:**
```
Layer 2 features: [
  { id: 'l2-func-calculate_order_total', name: 'calculate_order_total' },
  { id: 'l2-proc-calculate_order_total', name: 'calculate_order_total' }, // DUPLICATE ID ❌
]

React key={feat.id}:
- First render: DOM node 1 = "func", DOM node 2 = "proc"
- User expands node 1: state stored in Component instance
- If reordering/filtering changes IDs...
- Second render: DOM node 1 = "proc" (different feature!)
- React reuses Component instance → state corrupted
```

**Root cause:** Function and procedure can have same name. ID needs to include type or sequence.

**Current (problematic):**
```typescript
{riskAnalysis?.layer2Features?.map((feat) => (
  <div key={feat.id}> {/* ❌ Not unique if duplicates */}
    {/* ... */}
  </div>
))}
```

**Fix: Use index + type or function signature**

```typescript
// In RiskReport.tsx, around line 820:
{riskAnalysis?.layer2Features?.map((feat, index) => {
  // Generate unique key combining type + index
  const uniqueKey = `layer2-${feat.type}-${feat.name}-${index}`;
  
  return (
    <div key={uniqueKey}>
      {/* Layer 2 card content */}
    </div>
  );
})}

// OR better: ensure IDs are unique in layer2Analyzer.ts
// Line 251 (layer2Analyzer.ts):
function buildLayer2FeatureItems(raw: PostgresLayer2Raw): Layer2FeatureItem[] {
  const items: Layer2FeatureItem[] = [];
  let procIndex = 0;
  let funcIndex = 0;
  let trigIndex = 0;

  // Procedures
  raw.procedures.forEach((p) => {
    items.push({
      id: `l2-proc-${procIndex}`, // ✅ Include sequence number
      type: 'procedure',
      name: p.name,
      // ...
    });
    procIndex++;
  });

  // Functions
  raw.functions.forEach((f) => {
    items.push({
      id: `l2-func-${funcIndex}`, // ✅ Include sequence number
      type: 'function',
      name: f.name,
      // ...
    });
    funcIndex++;
  });

  // Triggers
  raw.triggers.forEach((t) => {
    items.push({
      id: `l2-trigger-${trigIndex}`, // ✅ Include sequence number
      type: 'trigger',
      name: t.name,
      // ...
    });
    trigIndex++;
  });

  return items;
}
```

**Time to fix:** 30 minutes

---

## 🟠 HIGH-PRIORITY BUGS (Fix This Week)

### Bug #5: No Timeout Handling for DB Queries
**File:** `apps/desktop/main/handlers/risk.ts`  
**Lines:** 80-120  
**Severity:** 🟠 HIGH  
**Impact:** If PostgreSQL table is locked or has millions of rows, query hangs indefinitely, user thinks app froze

**Current code (problematic):**
```typescript
const pgClient = new Pool({
  connectionTimeoutMillis: 4000,
  // ❌ No query/statement timeout!
});

await pgClient.query(`
  SELECT tablename FROM information_schema.tables 
  WHERE table_schema = $1
`); // Can hang forever if schema is huge
```

**Fix: Add statement timeout**

```typescript
const pgClient = new Pool({
  connectionTimeoutMillis: 4000,
  idleTimeoutMillis: 30000,
  statementTimeoutMillis: 10000, // ✅ Add this
});

// Also set session timeout as backup
await pgClient.query('SET statement_timeout = 10000;');

// Wrap queries in timeout promise
function queryWithTimeout<T>(
  pool: Pool,
  query: string,
  values: any[],
  timeoutMs: number = 10000
): Promise<QueryResult<T>> {
  return Promise.race([
    pool.query<T>(query, values),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
    ),
  ]);
}

// Usage
const tables = await queryWithTimeout(
  pgClient,
  `SELECT tablename FROM information_schema.tables WHERE table_schema = $1`,
  [targetSchema],
  5000 // 5-second timeout
);
```

**Time to fix:** 1 hour

---

### Bug #6: Stale Risk Analysis When Returning to Step 5 After Schema Edits
**File:** `apps/desktop/renderer/src/store/wizardStore.ts` & `RiskReport.tsx`  
**Lines:** 88 (store), 257 (component)  
**Severity:** 🟠 HIGH  
**Impact:** User edits schema in Step 4, returns to Step 5, sees OLD risk analysis (not re-run with new mappings)

**What happens:**
```
Step 5: Run risk analysis → riskAnalysis = {...}
Step 4: User edits field mapping → setSchemaMapping() called
      → riskAnalysis reset to null ✅
Step 5: Return to Step 5
      → useEffect checks: if (!riskAnalysis && schemaMapping)
      → riskAnalysis IS null, so condition is TRUE
      → Re-run analysis ✅ Should work!

But wait... does the useEffect dependency array include schemaMapping fields?
useEffect(() => { ... }, [riskAnalysis, schemaMapping])
schemaMapping is object reference.
If fields inside object changed but reference same, useEffect doesn't re-run ❌
```

**Fix: Deep-compare schema or clear riskAnalysis explicitly**

```typescript
// Option 1: useEffect with deep dependency tracking
import { usePrevious } from 'react-use'; // or implement yourself

function RiskReport() {
  const [isStaleRisk, setIsStaleRisk] = useState(false);
  const previousSchemaRef = useRef(schemaMapping);
  const previousMapping = usePrevious(schemaMapping);

  useEffect(() => {
    // Check if schemaMapping fields have changed
    const hasFieldChanges = previousMapping &&
      JSON.stringify(previousMapping) !== JSON.stringify(schemaMapping);

    if (hasFieldChanges) {
      // Mark analysis as stale
      setIsStaleRisk(true);
      setRiskAnalysis(null);
    }
  }, [schemaMapping, previousMapping]);

  const runAnalysis = async () => {
    if (!riskAnalysis || isStaleRisk) {
      await analyzeRisks();
      setIsStaleRisk(false);
    }
  };

  return <button onClick={runAnalysis}>Analyze Risks</button>;
}

// Option 2: Create hash of schema mapping to detect changes
function hashSchemaMapping(mapping: CollectionMapping[]): string {
  return JSON.stringify(
    mapping.map((m) => ({
      collectionName: m.collectionName,
      fields: m.fields.map((f) => ({
        sourceField: f.sourceField,
        targetColumn: f.targetColumn,
        targetType: f.targetType,
        isNullable: f.isNullable,
      })),
    }))
  );
}

// In RiskReport.tsx useEffect:
useEffect(() => {
  const currentHash = hashSchemaMapping(schemaMapping || []);
  const previousHash = usePrevious(currentHash);

  if (previousHash && previousHash !== currentHash) {
    logger.info('Schema mapping changed, clearing risk analysis');
    setRiskAnalysis(null);
  }
}, [schemaMapping]);
```

**Time to fix:** 1-2 hours

---

## 🟡 MEDIUM-PRIORITY BUGS (Fix Before Release)

### Bug #7: Layer 2 Includes PostgreSQL System Functions
**File:** `apps/desktop/main/engine/layer2Analyzer.ts`  
**Line:** 96  
**Severity:** 🟡 MEDIUM  
**Impact:** UI shows useless system functions like `pg_ls_dir`, confusing user

**Current query (incomplete filtering):**
```typescript
WHERE p.proname NOT LIKE 'pg_%'  // Filters some but not all
```

**Better filtering:**
```typescript
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_temp%'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_pg%'
```

**Time to fix:** 30 minutes

---

## ⚠️ EDGE CASES NOT HANDLED

### Edge Case 1: Empty Collections (0 Documents)
**What if:** User has a collection with no documents yet (will receive data later).

**Current behavior:** Risk analysis skips because no samples available.

**Improvement:**
```typescript
if (collection.documentCount === 0) {
  risks.push({
    id: `risk-empty-${collection.collectionName}`,
    severity: 'info',
    title: 'Empty Collection (Schema-Only Analysis)',
    description: `Collection "${collection.collectionName}" has 0 documents. Risk analysis is based on schema only, not actual data sampling.`,
    affectedTable: collection.collectionName,
  });
}
```

---

### Edge Case 2: 1000+ Layer 2 Features (Browser UI Freezes)
**What if:** PostgreSQL database has 1000+ stored procedures.

**Current:** RiskReport renders all 1000 cards → browser becomes sluggish.

**Improvement:** Virtualize or paginate
```typescript
// Limit initial display to top 50
const LAYER2_DISPLAY_LIMIT = 50;
const visibleFeatures = layer2Features?.slice(0, LAYER2_DISPLAY_LIMIT) || [];
const hiddenCount = Math.max(0, (layer2Features?.length || 0) - LAYER2_DISPLAY_LIMIT);

return (
  <>
    {visibleFeatures.map((f) => (...))}
    {hiddenCount > 0 && (
      <div>
        <button>Show {hiddenCount} more features</button>
      </div>
    )}
  </>
);
```

---

### Edge Case 3: BSON Document Exactly 16MB (Engine Limit)
**What if:** Single document is exactly 16MB (BSON max).

**Current:** Batch size is calculated by average. One 16MB doc in batch of 500 might exceed limit.

**Improvement:**
```typescript
// Check for individual document outliers
const maxDocSize = Math.max(...docSizes);
if (maxDocSize > 14 * 1024 * 1024) { // 14MB threshold
  risks.push({
    severity: 'warning',
    title: 'Very Large Document Detected',
    description: `Largest document is ${(maxDocSize / 1024 / 1024).toFixed(1)}MB. BSON limit is 16MB. If batched with other large docs, batch may exceed limit.`,
  });
}
```

---

## 💎 INDUSTRY-LEVEL IMPROVEMENTS

### Improvement 1: Progressive Risk Analysis (Stream Risks as Found)
**Current:** Wait for all analysis, then show all risks.  
**Better:** Show risks as each rule completes.

```typescript
// risk.ts - emit progress events
const progressCallback = (message: string, risksFound: RiskItem[]) => {
  mainWindow?.webContents.send('risk:progress', {
    message,
    risksFound,
    percentComplete: (risksFound.length / expectedRisksCount) * 100,
  });
};

// RiskReport.tsx - listen for progress
useEffect(() => {
  window.electronAPI.on('risk:progress', (progress) => {
    // Accumulate risks as they arrive
    setRiskAnalysis((prev) => ({
      ...prev,
      risks: [...(prev?.risks || []), ...progress.risksFound],
    }));
  });
}, []);
```

---

### Improvement 2: Risk Impact Estimation
**Current:** "45 missing docs" — but how many rows affected during migration?  
**Better:** Calculate percentage impact.

```typescript
const affectedRowsPercent = (missingDocCount / totalDocCount) * 100;
risk.description += `\n\nEstimated impact: ${affectedRowsPercent.toFixed(1)}% of rows (${missingDocCount} of ${totalDocCount})`;
```

---

### Improvement 3: Better Visualization of Circular FK Cycles
**Current:** Text like "A → B → C → A"  
**Better:** ASCII diagram or small SVG

```typescript
// Generate ASCII cycle visualization
function visualizeCycle(cycle: string[]): string {
  const arrows = cycle.map((table, i) => {
    const next = cycle[(i + 1) % cycle.length];
    return `${table} ──> ${next}`;
  });
  return arrows.join('\n        ↓\n        ');
}

// Output:
// users ──> organizations
//     ↓
//     └──> users
```

---

## ✅ SUMMARY: Priority Fixes

| Priority | Bug | Time | Impact |
|----------|-----|------|--------|
| 🔴 NOW | Race condition (Re-scan) | 30 min | Stale data |
| 🔴 NOW | DFS cycle detection | 2-3 hours | Missing cycles |
| 🔴 NOW | Integer overflow detection | 1-2 hours | Data corruption |
| 🔴 NOW | React key missing | 30 min | State corruption |
| 🟠 THIS WEEK | DB query timeout | 1 hour | App freeze |
| 🟠 THIS WEEK | Stale risk caching | 1-2 hours | Wrong analysis |
| 🟡 BEFORE RELEASE | System functions filter | 30 min | UI confusion |
| 💎 NICE-TO-HAVE | Progressive analysis | 2 hours | Better UX |

**Total time to fix all critical bugs: ~6-8 hours**

---

## 🔒 Security Notes

1. **Layer 2 introspection leaks database structure** — Consider showing warning before enabling
2. **Credentials not consistently masked in logs** — Wrap all logs through masking utility
3. **No rate limiting on risk:analyze handler** — Add deduplication for concurrent requests

---

## 📝 Conclusion

Your Phase 7 code is **excellent** but has **7 bugs** (1 critical in algorithm, 4 critical in race conditions/state, 2 high-priority) that should be fixed before production. With these fixes, Phase 7 will be truly **100/100** bulletproof.

**Recommended action:**
1. Fix the 4 race condition/state bugs today (2-3 hours)
2. Fix the Tarjan's algorithm upgrade tomorrow (2-3 hours)
3. Add edge case handling this week (3-4 hours)
4. Test with large schemas (1000+ collections)
