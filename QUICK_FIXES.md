# MigrateIQ Quick Fixes — Priority Action Plan

## 🚨 CRITICAL FIXES (Do These Today — 1 Hour Total)

### Fix #1: Add Missing `ipcMain` Import (2 minutes)

**File:** `apps/desktop/main/handlers/db.ts`  
**Line:** Top of file, before any exports

**Current Code:** (Missing import)

**Fix:**
```typescript
// Add this at the very top (line 1)
import { ipcMain, app, BrowserWindow } from 'electron';
import type { ConnectionConfig } from '@migrateiq/shared';
```

**Verify:** Run `npm run build:main` — should compile with 0 errors.

---

### Fix #2: Register Missing Handler (2 minutes)

**File:** `apps/desktop/main/handlers/db.ts`  
**Function:** `setupDatabaseHandlers()` at line ~579

**Current Code:**
```typescript
export function setupDatabaseHandlers(): void {
  setupMongoDBHandler();
  setupPostgresqlHandler();
}
```

**Fix:**
```typescript
export function setupDatabaseHandlers(): void {
  setupMongoDBHandler();
  setupPostgresqlHandler();
  setupClearTargetHandler(); // ADD THIS LINE
}
```

**Verify:** Handler now registers on app startup.

---

### Fix #3: Fix Unmounted Component State Mutations (30 minutes)

**Files to Update:**
1. `apps/desktop/renderer/src/screens/RiskReport.tsx` — Line 261-280
2. `apps/desktop/renderer/src/screens/SchemaMapper.tsx` — Line 45+ (if it has async effects)

**Pattern to Fix:**

**Current (Bad):**
```typescript
useEffect(() => {
  if (!riskAnalysis && schemaMapping && sourceSchema) {
    (async () => {
      const result = await window.electronAPI.invoke('risk:analyze', {...});
      setRiskAnalysis(result); // ❌ Warning if component unmounts
    })();
  }
}, [riskAnalysis, schemaMapping, sourceSchema]);
```

**Better:**
```typescript
useEffect(() => {
  let isMounted = true;
  
  const analyze = async () => {
    try {
      const result = await window.electronAPI.invoke('risk:analyze', {...});
      if (isMounted) {
        setRiskAnalysis(result);
      }
    } catch (error) {
      if (isMounted) {
        console.error('Failed to analyze risks:', error);
      }
    }
  };
  
  if (!riskAnalysis && schemaMapping && sourceSchema) {
    analyze();
  }
  
  return () => { isMounted = false; }; // Cleanup function
}, [riskAnalysis, schemaMapping, sourceSchema]);
```

**Verify:** No React warnings in console when navigating between screens.

---

### Fix #4: Add Input Validation to IPC Payloads (1 hour)

**Install Zod first:**
```bash
npm install zod
```

**File:** `apps/desktop/main/handlers/db.ts`  
**Add at top (after imports):**

```typescript
import { z } from 'zod';

// Define validation schemas
const ConnectionConfigSchema = z.object({
  type: z.enum(['mongodb', 'postgresql']),
  host: z.string().min(1, 'Host cannot be empty').optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  dbName: z.string().optional(),
  authSource: z.string().optional(),
});

const targetSchema = z.string().min(1).max(63); // PostgreSQL identifier limit
```

**Update handlers:**

```typescript
ipcMain.handle('db:connect-mongodb', async (_event, rawConfig) => {
  try {
    // Validate input
    const config = ConnectionConfigSchema.parse(rawConfig);
    
    // Your existing logic here...
    const client = new MongoClient(connectionString);
    // ...
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map(e => `${e.path}: ${e.message}`).join('; '),
      };
    }
    // ... handle other errors
  }
});
```

**Verify:** Test with invalid input (wrong types) — should get clear error message.

---

## 🟠 HIGH-PRIORITY BUGS (Do This Week — 1-2 Hours)

### Fix #5: Create Centralized Logging Utility

**Install Pino logger:**
```bash
npm install pino pino-pretty
```

**Create File:** `apps/desktop/main/utils/logger.ts`

```typescript
import pino from 'pino';
import path from 'path';
import { app } from 'electron';

const logDir = path.join(app.getPath('userData'), 'logs');

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: { destination: path.join(logDir, 'migrateiq.log') },
      },
      ...(process.env.NODE_ENV === 'development'
        ? [{
            target: 'pino-pretty',
            options: { colorize: true, singleLine: true },
          }]
        : []),
    ],
  })
);

export default logger;
```

**Update handlers to use it:**

```typescript
// In db.ts, replace console.log with:
import logger from '../utils/logger';

logger.info('Connecting to MongoDB at %s:%d', config.host, config.port);
logger.error({ error: err }, 'Failed to connect');
```

**Verify:** Check `~/.config/MigrateIQ/logs/migrateiq.log` for entries.

---

### Fix #6: Add Error Boundary Component

**Create File:** `apps/desktop/renderer/src/components/ErrorBoundary.tsx`

```typescript
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{ padding: '20px', textAlign: 'center', color: '#dc2626' }}>
            <h2>Oops! Something went wrong.</h2>
            <p>{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()}>
              Reload Application
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

**Use in MigrationWizard.tsx:**

```typescript
import { ErrorBoundary } from '../components/ErrorBoundary';

export function MigrationWizardPage() {
  return (
    <ErrorBoundary>
      <MigrationWizard />
    </ErrorBoundary>
  );
}
```

---

### Fix #7: Close Connections Properly

**File:** `apps/desktop/main/handlers/db.ts`  
**Location:** All MongoDB handler paths

**Current pattern (Risky):**
```typescript
const client = new MongoClient(connectionString);
await client.connect();
const db = client.db(dbName);
// ... do stuff ...
return { success: true, data: result }; // Returns without closing
```

**Better pattern:**
```typescript
const client = new MongoClient(connectionString);
try {
  await client.connect();
  const db = client.db(dbName);
  // ... do stuff ...
  return { success: true, data: result };
} finally {
  await client.close().catch((err) => {
    logger.warn('Failed to close MongoDB connection: %s', err.message);
  });
}
```

---

## 🟡 MEDIUM-PRIORITY ISSUES (Before Release)

### Issue #8: Add Credential Masking Utility

**Create File:** `apps/desktop/main/utils/masking.ts`

```typescript
export function maskSensitiveFields(text: string): string {
  return text
    // Mask URLs with credentials
    .replace(
      /(:\/\/)?([^:]+):([^@]+)@/g,
      '$1$2:••••••••@'
    )
    // Mask password fields
    .replace(
      /(password['":\s]+)([^"',\s]+)/gi,
      '$1••••••••'
    )
    // Mask API keys
    .replace(
      /(api[-_]?key['":\s]+)([^"',\s]+)/gi,
      '$1••••••••'
    )
    // Mask tokens
    .replace(
      /(token['":\s]+)([^"',\s]+)/gi,
      '$1••••••••'
    );
}

export const safelog = {
  info: (msg: string) => console.log(maskSensitiveFields(msg)),
  error: (msg: string) => console.error(maskSensitiveFields(msg)),
  warn: (msg: string) => console.warn(maskSensitiveFields(msg)),
};
```

**Use everywhere:**
```typescript
import { safelog } from '../utils/masking';

safelog.info(`Connected to ${connectionString}`); // ✅ Credentials masked
```

---

### Issue #9: Add Rate Limiting to IPC

**Create File:** `apps/desktop/main/utils/rateLimit.ts`

```typescript
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limits = new Map<string, RateLimitEntry>();
const MAX_CALLS = 100;
const WINDOW_MS = 60000; // 1 minute

export function checkRateLimit(handler: string): boolean {
  const key = `ipc:${handler}`;
  const now = Date.now();
  const limit = limits.get(key);

  if (limit && limit.resetAt > now) {
    limit.count++;
    if (limit.count > MAX_CALLS) {
      return false; // Rate limit exceeded
    }
  } else {
    limits.set(key, { count: 1, resetAt: now + WINDOW_MS });
  }

  return true;
}
```

**Use in handlers:**
```typescript
ipcMain.handle('db:connect-mongodb', async (_event, config) => {
  if (!checkRateLimit('db:connect-mongodb')) {
    return { success: false, error: 'Rate limit exceeded' };
  }
  // ... rest of handler
});
```

---

## 📋 VERIFICATION CHECKLIST

After making these fixes, run:

```bash
# 1. Type checking
npm run typecheck

# 2. Build main process
npm run build:main

# 3. Build renderer
npm run build:renderer

# 4. No warnings in output
npm run build 2>&1 | grep -i error || echo "✅ Build successful"

# 5. Run app
npm start
```

**Expected result:** App starts without crashes, no console errors.

---

## ESTIMATED TIME BREAKDOWN

| Fix | Time |
|-----|------|
| Fix #1-2 (imports + registration) | 5 min |
| Fix #3 (unmounted components) | 30 min |
| Fix #4 (input validation) | 1 hour |
| Fix #5 (logging utility) | 30 min |
| Fix #6 (error boundary) | 20 min |
| Fix #7 (connection closing) | 30 min |
| **Total (Critical + High)** | **~2.5 hours** |
| Fix #8-9 (medium priority) | 1 hour |
| **Total All Fixes** | **~3.5 hours** |

---

## NEXT STEPS (After These Fixes)

1. ✅ All these fixes should take ~3.5 hours
2. ⏭️ Then move to **Phase 8: Dry Run** (2-3 days)
3. ⏭️ Then **Phase 9: Live Migration** (4-5 days)
4. ⏭️ Then **Phase 10: Completion Screen** (2-3 days)

These 3 phases unblock the full user workflow.

---

**Status:** Ready to implement  
**Priority:** CRITICAL → HIGH → MEDIUM  
**Total Remaining Work:** ~24-30 days to full completion
