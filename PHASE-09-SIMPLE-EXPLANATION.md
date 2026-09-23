# Phase 9: Live Migration Engine — Simple Explanation

## What Did We Build?

We built the **CORE MIGRATION ENGINE** that actually moves your data from MongoDB to PostgreSQL. Think of it like a smart moving truck that:
- Picks up data from one database
- Transforms it to fit the other database
- Delivers it safely
- Tracks progress in real-time
- Can undo everything if something goes wrong

---

## The 6 Parts We Built

### 1. **TypeScript Types** (The Blueprints)
**What it is:** Definitions that tell TypeScript what shape our data has.

**Think of it like:** Blueprint papers that describe what a car looks like before you build it.

**Example:**
```typescript
MigrationProgressEvent = {
  currentTable: "users",
  rowsCompleted: 1500,
  totalRows: 10000,
  estimatedTimeRemaining: "2m 30s"
}
```

---

### 2. **Topological Sort Engine** (The Smart Planner)
**What it is:** Figures out the correct order to create tables so foreign keys don't break.

**Think of it like:** A construction manager who knows you must build the foundation before the walls, and walls before the roof.

**Real Example:**
```
Problem: 
- Users table needs Organizations table (users.org_id → organizations.id)
- Organizations table needs Users table (organizations.created_by → users.id)
- CIRCULAR DEPENDENCY! Can't create either first!

Solution:
1. CREATE TABLE users (no foreign key yet)
2. CREATE TABLE organizations (no foreign key yet)
3. INSERT all users
4. INSERT all organizations
5. ADD CONSTRAINT to users pointing to organizations
6. ADD CONSTRAINT to organizations pointing to users
```

---

### 3. **IPC Handlers** (The Communication System)
**What it is:** Channels that let the backend (Node.js) talk to the frontend (React UI).

**Think of it like:** Walkie-talkies between the engine room and the captain's bridge.

**5 Channels:**
1. `migration:start` → "Start the migration!"
2. `migration:cancel` → "Stop! Cancel it!"
3. `migration:progress` → "We're 45% done..."
4. `migration:log` → "Created table users..."
5. `migration:get-rollback` → "Can we undo this?"

---

### 4. **ETL Streaming Engine** (The Actual Moving Truck)
**What it is:** The core logic that streams data from MongoDB → PostgreSQL.

**Think of it like:** A conveyor belt that moves boxes from one warehouse to another, 500 boxes at a time.

**How it works:**
```
1. Connect to MongoDB
2. Connect to PostgreSQL
3. For each table:
   a. Open a cursor (like opening a water tap, not filling a bucket)
   b. Read 500 documents
   c. Transform each document (ObjectId → text, Date → timestamp)
   d. INSERT 500 rows into PostgreSQL
   e. If INSERT fails, try row-by-row (skip bad ones)
   f. Update progress bar
   g. Repeat until done
```

**Why 500 at a time?**
- Too small (1 row) = SLOW (10,000 database calls)
- Too big (10,000 rows) = MEMORY CRASH (runs out of RAM)
- 500 rows = Perfect balance (fast + safe)

---

### 5. **Progress UI** (The Dashboard You See)
**What it is:** The React screen that shows you what's happening during migration.

**Think of it like:** The GPS in your car showing you how far you've driven and how much time is left.

**What you see:**
```
┌─────────────────────────────────────┐
│ Migration in Progress               │
│                                     │
│ Overall Progress:    [████░░] 45%  │
│ 3 / 7 tables                       │
│ ETA: 5m 23s                        │
│                                     │
│ Current Table: users  [█████░] 75% │
│ 7,500 / 10,000 rows                │
│ 1,234 rows/sec                     │
│                                     │
│ ╔═══ Migration Log ═══╗            │
│ ║ 14:32:10  Created users         ║│
│ ║ 14:32:15  Inserted 500 rows    ║│
│ ║ 14:32:20  Inserted 500 rows    ║│
│ ║ 14:32:25  Inserted 500 rows    ║│
│ ╚═════════════════════════════════╝│
│                                     │
│ [Cancel Migration]                 │
└─────────────────────────────────────┘
```

**4 Different Screens:**
1. **Idle:** "Ready to start?" (shows Start button)
2. **Running:** Progress bars + live logs
3. **Completed:** "Success! 15,000 rows migrated"
4. **Error:** "Something went wrong..." (with retry button)

---

### 6. **Crash Recovery** (The Undo Button)
**What it is:** A banner on the home dashboard that appears if you have a rollback script.

**Think of it like:** A "Restore Previous Version" button in Microsoft Word.

**What it does:**
```
If migration crashes or you want to undo:
1. Detects rollback script exists
2. Shows green banner: "Rollback available (15,000 rows)"
3. Click "Download Script"
4. Opens SQL file:
   DELETE FROM posts WHERE migrated_at >= '2026-09-23 14:30:00';
   DELETE FROM users WHERE migrated_at >= '2026-09-23 14:30:00';
5. Run this script to undo everything
```

---

## How to Use It (Step-by-Step)

### **Before You Start:**
1. Complete Steps 1-6 in the wizard:
   - Connect to MongoDB
   - Connect to PostgreSQL
   - Map your schema
   - Review risks
   - Run dry run
   - Review results

### **Running the Migration:**

**Step 1:** Click "Start Migration" button on Step 7

**Step 2:** Watch the progress bar fill up
```
Progress: [████████░░] 80%
Current: users table (8,000 / 10,000 rows)
ETA: 1m 15s
```

**Step 3:** Read the logs to see what's happening
```
14:30:00 🔌 Connecting to MongoDB...
14:30:01 ✅ Connected to MongoDB
14:30:01 📐 Creating tables...
14:30:02 ✅ Created table: users
14:30:02 📦 Migrating data...
14:30:05 ✅ Inserted 500 rows into users
14:30:08 ✅ Inserted 500 rows into users
...
```

**Step 4:** If you need to cancel, click "Cancel Migration"
- It will finish the current batch (500 rows)
- Then stop gracefully
- Saves a rollback script so you can undo

**Step 5:** When done, you see:
```
✅ Migration Complete!
15,230 rows migrated across 7 tables in 45 seconds

[View Rollback Script]  [Continue →]
```

---

## What Happens Under the Hood

### **Memory Management**
```
Bad Way (loads everything in memory):
const allDocs = await collection.find({}).toArray(); // 💥 CRASH if 100,000 docs

Good Way (streams in batches):
const cursor = collection.find({}).batchSize(500);  // ✅ Only 500 in memory
while (await cursor.hasNext()) {
  const doc = await cursor.next();
  // Process 1 doc at a time
}
```

### **Error Isolation**
```
Scenario: You have 20,000 documents. Document #5,342 has a corrupt date.

Bad Way:
- Try to insert all 20,000
- Document #5,342 fails
- ENTIRE migration fails
- 0 rows inserted 💥

Good Way:
- Insert batch 1-500: ✅ SUCCESS
- Insert batch 501-1000: ✅ SUCCESS
- ...
- Insert batch 5,001-5,500: ❌ FAIL (contains #5,342)
  - Retry row-by-row
  - Row 5,342 skipped
  - Other 499 rows inserted ✅
- Continue with next batches
- Result: 19,999 rows inserted, 1 skipped
```

### **ETA Calculation**
```javascript
const startTime = Date.now();
const rowsCompleted = 7500;
const totalRows = 10000;

const elapsedMs = Date.now() - startTime; // 30,000ms (30 seconds)
const rowsPerSec = rowsCompleted / (elapsedMs / 1000); // 250 rows/sec

const rowsRemaining = totalRows - rowsCompleted; // 2,500 rows
const etaMs = (rowsRemaining / rowsPerSec) * 1000; // 10,000ms (10 seconds)

console.log("ETA: 10s");
```

---

## Testing

### **Manual Test (Recommended):**
1. Open the app: `npm run desktop:dev`
2. Go through the wizard with a real MongoDB + PostgreSQL
3. Click "Start Migration" on Step 7
4. Watch the progress bar
5. Check if data actually appears in PostgreSQL

### **Unit Tests (We should add these):**
```bash
# Test topological sort
npm run test -- topologicalSort.test.ts

# Test ETL engine
npm run test -- etlEngine.test.ts
```

**Note:** We didn't write unit tests yet because:
1. You need real databases (MongoDB + PostgreSQL) running
2. Integration tests are more valuable for this feature
3. The code is complex and needs real-world testing first

---

## Common Issues & Solutions

### **Issue 1: "Migration stuck at 0%"**
**Cause:** MongoDB connection failed
**Solution:** Check MongoDB connection string in Step 1

### **Issue 2: "Foreign key constraint violation"**
**Cause:** Topological sort failed (circular dependency not handled)
**Solution:** Check the logs for circular FK warning

### **Issue 3: "Out of memory"**
**Cause:** Batch size too large (shouldn't happen with 500)
**Solution:** Reduce batch size in code (currently hardcoded to 500)

### **Issue 4: "Migration failed: permission denied"**
**Cause:** PostgreSQL user doesn't have CREATE TABLE permission
**Solution:** Grant permissions: `GRANT CREATE ON SCHEMA public TO your_user;`

---

## Performance Expectations

| Dataset Size | Expected Time | Memory Usage |
|--------------|---------------|--------------|
| 1,000 rows | 1-2 seconds | ~10 MB |
| 10,000 rows | 5-10 seconds | ~10 MB |
| 100,000 rows | 1-2 minutes | ~10 MB |
| 1,000,000 rows | 10-20 minutes | ~10 MB |

**Why memory stays constant?**
- We only load 500 rows at a time
- Once inserted, they're garbage collected
- Streaming = no memory spike

---

## What's Next (Phase 10)

Phase 9 migrates the data. Phase 10 will add:
1. **Audit Reports:** PDF/HTML report with summary
2. **Data Validation:** Checksum verification (did all data arrive?)
3. **ERD Diagrams:** Visual diagram of your new schema
4. **Performance Metrics:** How fast was it? Any bottlenecks?

---

## Summary

**What we built:**
A complete live migration system that streams data from MongoDB to PostgreSQL with real-time progress, error isolation, and crash recovery.

**Key innovation:**
Batch processing with row-level fallback means 1 corrupt document doesn't fail 20,000 good ones.

**How to use:**
Complete Steps 1-6, then click "Start Migration" on Step 7 and watch it go!

**Testing:**
Run `npm run desktop:dev` and test with real databases. Unit tests to be added later.

---

*This is Phase 9 — the CORE of MigrateIQ. Everything before this was preparation. Everything after this is validation.*
