# Phase 9: Live Migration Engine — Documentation

## Phase Summary & Goal
Phase 9 implements the **core live migration engine** that actually moves data from MongoDB to PostgreSQL. This is the most critical phase of MigrateIQ. All previous phases (0-8) were preparation, analysis, and schema design. Phase 9 executes the actual ETL (Extract-Transform-Load) operation with streaming, progress tracking, error isolation, and crash recovery.

---

## Progress Status

### ✅ Part 1: TypeScript Types (COMPLETED)
- **File Modified:** `packages/shared/src/types.ts`
- **Lines Added:** ~120 lines
- **Types Added:**
  - `MigrationProgressEvent` — Real-time progress updates sent from main → renderer
  - `MigrationLogEntry` — Structured log entries with levels (info/warn/error/debug)
  - `TableMigrationProgress` — Per-table migration status tracking
  - `MigrationResult` — Final migration summary with success/failure stats
  - `MigrationRollbackInfo` — Rollback availability and script generation
  - `TopologicalSortResult` — Table dependency ordering results
  - `ETLBatchResult` — Batch-level processing results
  - `EnhancedSkippedRow` — Extended SkippedRow with batch number and retry info

**Verification:** TypeScript types compile without errors.

---

### 🔲 Part 2: Topological Sort Engine (PENDING)
- **File to Create:** `apps/desktop/main/engine/topologicalSort.ts`
- **Algorithm:** Kahn's Algorithm (DAG ordering)
- **Handles:** Circular FK detection and safe ordering

---

### 🔲 Part 3: IPC Handlers (PENDING)
- **File to Create:** `apps/desktop/main/handlers/migration.ts`
- **Channels:** migration:start, migration:cancel, migration:progress, migration:log

---

### 🔲 Part 4: ETL Engine (PENDING)
- **File to Create:** `apps/desktop/main/engine/etlEngine.ts`
- **Core Logic:** Streaming cursor, batch insert, row-level retry

---

### 🔲 Part 5: Progress UI (PENDING)
- **File to Create:** `apps/desktop/renderer/src/screens/MigrationProgressScreen.tsx`
- **Features:** Live progress bars, ETA calculation, log viewer

---

### 🔲 Part 6: Crash Recovery (PENDING)
- **File to Modify:** `apps/desktop/renderer/src/screens/HomeDashboard.tsx`
- **Feature:** Resume interrupted migrations from disk state

---

## Files Created & Modified

### Modified Files
1. **packages/shared/src/types.ts** (+120 lines)
   - Added 8 new TypeScript interfaces for Phase 9 migration types
   - All types use strict typing (no `any` or `@ts-ignore`)

### Files to Create (Pending)
2. **apps/desktop/main/engine/topologicalSort.ts** (~180 lines)
3. **apps/desktop/main/engine/etlEngine.ts** (~650 lines)
4. **apps/desktop/main/handlers/migration.ts** (~200 lines)
5. **apps/desktop/renderer/src/screens/MigrationProgressScreen.tsx** (~450 lines)

### Files to Modify (Pending)
6. **apps/desktop/renderer/src/screens/HomeDashboard.tsx** (+60 lines)

---

## Architecture & Key Implementation Details

### Part 1: TypeScript Types (Current)
**Foundation Types for Migration Engine:**

1. **MigrationProgressEvent** — Real-time progress updates
   - Tracks overall migration progress (totalTables, completedTables)
   - Tracks current table progress (currentTable, rowsCompleted)
   - Performance metrics (rowsPerSecond, estimatedTimeRemainingMs)
   - Error handling (skippedRows array)

2. **MigrationLogEntry** — Structured logging
   - Levels: info, warn, error, debug
   - Optional table context
   - Structured details object for debugging

3. **TableMigrationProgress** — Per-table state
   - Status: pending | running | completed | failed | skipped
   - Row counts and percentage
   - Start/end timestamps
   - Skipped rows collection

4. **MigrationResult** — Final summary
   - Success/failure counts per table
   - Total rows migrated vs skipped
   - Duration in milliseconds
   - Rollback script generation

5. **TopologicalSortResult** — Dependency ordering
   - Ordered list of tables (safe migration order)
   - Circular dependency detection
   - FK cycle information

6. **ETLBatchResult** — Batch processing results
   - Rows processed in batch
   - Rows skipped with reasons
   - Error isolation per batch

7. **EnhancedSkippedRow** — Extended error tracking
   - Batch number for context
   - Retry attempt count
   - Full stack trace for debugging

---

## Verification & Test Results

### Part 1 Verification
✅ **TypeScript Compilation:** Types added successfully to `packages/shared/src/types.ts`  
✅ **No Breaking Changes:** All existing types remain unchanged  
✅ **Strict Typing:** No use of `any`, `@ts-ignore`, or `@ts-nocheck`  
✅ **Export Correctness:** All interfaces use `export` keyword for cross-package usage

---

## Edge Cases & FYP Report Notes

### Part 1: Type Design Decisions
1. **Optional Fields Strategy:** Most `MigrationProgressEvent` fields are optional (`?`) because different event types need different data (e.g., 'start' doesn't have `currentTable`, but 'table_progress' does)

2. **EnhancedSkippedRow Pattern:** Extends existing `SkippedRow` type instead of replacing it, maintaining backward compatibility with Phase 8 (Dry Run)

3. **Timestamp Format:** All timestamp fields use `string` type (ISO 8601 format) for JSON serialization across IPC boundary

4. **Duration in Milliseconds:** `MigrationResult.duration` uses milliseconds instead of seconds for precision (migrations can be very fast for small datasets)

---

## Next Phase Handoff

### Prerequisites for Part 2 (Topological Sort)
- ✅ `TopologicalSortResult` type defined
- ✅ Can now implement Kahn's Algorithm with proper return type
- ✅ Will use existing `RiskAnalysis.circularForeignKeyChains` from Phase 8 for cycle detection

### State Established
- Type system foundation complete
- Progress event structure defined
- Error handling types ready
- Next: Implement dependency ordering algorithm

---

## Technical Highlights for FYP Report

### Why This Phase is Critical
Phase 9 is the **execution engine** — all previous phases were planning. This is where MigrateIQ proves it can safely move millions of rows without data loss.

### Key Challenges Solved in Part 1
1. **Progress Granularity:** Types support both table-level AND row-level progress tracking
2. **Error Isolation:** Batch-level error tracking prevents one bad row from failing entire migration
3. **IPC Type Safety:** All events use strict TypeScript types across Electron's main↔renderer boundary
4. **Extensibility:** Types designed for future enhancements (e.g., parallel table migration)

---

*Document created: Part 1 completion*  
*Last updated: [Timestamp will be added after user verification]*
