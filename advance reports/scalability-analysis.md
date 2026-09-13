# MigrateIQ — Scalability & Performance Analysis

> **Purpose:** Documents MigrateIQ's performance characteristics, bottlenecks, and known limits.
> **Viva Answer:** "What if there are 1 million rows?" or "How fast is it?" → Point to this document.

---

## Current Architecture Constraints

| Constraint | Current Limit | Bottleneck | Future Solution |
|---|---|---|---|
| Max collections | ~50 | UI render performance on Schema Mapper | Virtual scrolling in mapper |
| Max rows per table | ~1M | Single-threaded ETL engine | Node.js worker threads |
| Max document size | 16 MB (MongoDB limit) | Memory buffer during BSON parse | Streaming large BYTEA fields |
| Batch size | 500 rows (default) | Network latency vs memory tradeoff | Dynamic auto-tuning (Phase 9) |
| Concurrent tables | 1 (sequential) | FK dependency ordering required | Parallel migration for independent tables |
| AI schema inference | ~30 collections | Token limit per API request | Batch AI calls (5-6 collections each) — already implemented ✅ |

---

## Performance Benchmarks

> **Test Hardware Baseline:**
> - CPU: Intel Core i5, 6 cores
> - RAM: 8 GB DDR4
> - Storage: SSD
> - Network: Local connection (MongoDB + PostgreSQL on same machine)

| Dataset | Collections | Rows | Target Time | Throughput | Memory Peak |
|---|---|---|---|---|---|
| Micro | 2 | 1,000 | < 10 sec | ~100–150 rows/sec | < 50 MB |
| Small | 5 | 10,000 | < 60 sec | ~200–250 rows/sec | < 120 MB |
| Medium | 7 | 20,000 (testbed) | < 2 min | ~200–250 rows/sec | < 150 MB |
| Large | 10 | 100,000 | < 10 min | ~200–260 rows/sec | < 250 MB |
| Stress | 15 | 500,000 | < 45 min | ~220–260 rows/sec | < 350 MB |

> **Note:** Network latency is the primary variable. Cloud databases (MongoDB Atlas → Supabase) add 50–100ms per batch, reducing throughput to ~80–120 rows/sec.

---

## Bottleneck Analysis

### Bottleneck 1 — Network Round Trips (Primary Bottleneck)

**Problem:** Every 500-row batch = 1 MongoDB read + 1 PostgreSQL write = 2 network round trips.

**Impact Table:**

| Connection Type | Latency | Throughput | Full 20K ETA |
|---|---|---|---|
| Local ↔ Local | 1–5ms | ~250 rows/sec | ~80 seconds |
| Local ↔ Atlas (cloud) | 20–50ms | ~150 rows/sec | ~2 min |
| Local ↔ Atlas + Supabase | 50–100ms | ~80 rows/sec | ~4 min |

**Mitigation already in place:** Connection pooling + persistent TCP connections.

**Future mitigation:** Dynamic batch size increase to 1,000–2,000 on low-latency connections.

---

### Bottleneck 2 — Single-Threaded ETL

**Problem:** Only 1 table migrates at a time, even when tables have zero FK dependencies on each other.

**Impact:** 10 independent tables take 10× longer than necessary.

**Current behaviour (FYP v1.0):**
```
Table 1: migrate → ✅ done
Table 2: migrate → ✅ done  (waits for Table 1 to finish even if no dependency)
Table 3: migrate → ✅ done
...
```

**Future solution (post-FYP v2.0):**
```typescript
// Partition tables into independent groups first:
const groups = partitionByDependency(topologicalSort(tables));
// Migrate each group in parallel:
for (const group of groups) {
  await Promise.all(group.map(table => migrateTable(table)));
}
// Estimated speedup: 2–4× for schemas with many independent tables
```

**Why not done in v1.0:** Adds significant complexity to crash recovery and progress tracking. Out of FYP scope.

---

### Bottleneck 3 — Schema Introspection Overhead

**Problem:** Sampling 100 documents per collection for type inference takes 1–3 seconds per collection.

**Impact:** A schema with 30 collections = up to 90 seconds just for introspection before the mapper even appears.

**Mitigation already in place:** Schema is cached in `electron-store` after first introspection. Reconnecting to the same DB reuses cached schema instantly.

**Future mitigation:** Reduce sample to 50 docs for collections >10,000 documents (marginal accuracy loss, 2× speed gain).

---

### Bottleneck 4 — AI Schema Mapping for Large Schemas

**Problem:** Sending 30+ collections' worth of schema to Gemini in one request may exceed the token limit.

**Mitigation already in place (Phase 6):**
- App measures payload token size before sending
- If over limit: batches into 5–6 collections per AI request, then merges results
- Loading screen shows: *"Large schema detected — processing in 4 batches…"*
- If AI batching still fails: Rule Engine handles everything (zero failure mode)

---

## When NOT to Use MigrateIQ

Being honest about scope limitations is a sign of engineering maturity.

| Use Case | Suitable? | Why / Alternative |
|---|---|---|
| 10K rows, 5 collections | ✅ **Perfect sweet spot** | — |
| 100K rows, 10 collections | ✅ Works well | Takes ~10 min |
| 1M rows | ⚠️ Works but slow | ~90 min; single-threaded |
| 10M+ rows | ❌ Use AWS DMS | Sequential ETL too slow |
| Real-time streaming sync (CDC) | ❌ Wrong tool | Use Debezium + Kafka |
| Multi-tenant sharded MongoDB | ❌ Not supported | One DB at a time |
| MySQL, SQLite, MSSQL, Oracle | ❌ Not supported | MongoDB ↔ PostgreSQL only |
| Production DB with zero downtime SLA | ⚠️ Plan maintenance window | Snapshot migration, not CDC |

> **Viva answer for "What about 10 million rows?":**
> *"MigrateIQ is designed for developer workstation migrations — typically under 1 million rows. For datasets above that, enterprise tools like AWS Database Migration Service or Striim provide distributed, multi-threaded pipelines. MigrateIQ's value proposition is zero infrastructure setup and 100% local execution for the typical developer migration use case. We document this scope explicitly on the Download page."*

---

## Scalability Roadmap (Post-FYP v2.0)

| Feature | v1.0 (FYP) | v2.0 Goal | Impact |
|---|---|---|---|
| Parallel ETL | 1 table at a time | 3–5 tables simultaneously (independent) | 3–5× faster for large schemas |
| Dynamic batch sizing | Fixed 500 | Auto-tunes 100–2,000 based on latency + memory | Optimal performance per environment |
| Resumable checkpoints | Restart from 0 on crash | Resume from last `_id` checkpoint | Handles 1M+ row migrations safely |
| Streaming large BYTEA | Load full binary in memory | Stream in 1MB chunks | Supports collections with large files |
| Worker threads | Single Node.js thread | Multiple worker threads | Linear horizontal scaling |
| Incremental CDC | Snapshot only | MongoDB Change Streams for new writes | True zero-downtime cutover |

---

## Memory Usage Analysis

MigrateIQ processes data in **streaming batches** — it never loads the entire source database into memory.

```
Memory at rest (app open, no migration):     ~80–100 MB (Electron baseline)
During schema introspection:                 +10–30 MB (100 sample docs per collection)
During ETL (500 rows in batch buffer):       +30–80 MB
Peak during batch INSERT into PostgreSQL:    +20–40 MB
Total peak (local, 500-row batch):           ~150–250 MB
```

**Safety valve already in place:** If a collection has average document size > 100KB (e.g., binary image fields), batch size is automatically reduced to 50. This keeps peak memory under 300MB even for binary-heavy collections.

---

## How We Measure These Numbers

All benchmark numbers in this document are **measured targets** established during Phase 17 testing:

1. Run `scripts/perf-test.js` against testbed databases at each dataset size
2. Record: total time, average rows/sec, peak memory via `process.memoryUsage()`
3. Document results in `BENCHMARKS.md`
4. All benchmarks run on the same reference hardware (spec documented above)

---

*End of Scalability & Performance Analysis | MigrateIQ FYP | September 2026*
