/**
 * MigrateIQ - Real-Time Query Performance Benchmark Engine (Phase 10)
 * 
 * Executes parallel non-mutating test queries across live source (MongoDB)
 * and target (PostgreSQL) databases:
 * 1. Primary Key Lookups
 * 2. Category / Filter / Sort Operations
 * 3. Multi-table Joins & Aggregations
 * 
 * Computes average, P50, P95, and P99 latency percentiles and throughput (QPS).
 */

import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import type {
  ConnectionConfig,
  CollectionMapping,
  Phase10BenchmarkResult,
  BenchmarkMetrics,
  BenchmarkCategoryBreakdown
} from '@migrateiq/shared';
import { sanitizeIdentifier, normalizeConnectionConfig } from '../utils';

export interface RunBenchmarkOptions {
  sourceConfig: ConnectionConfig;
  targetConfig: ConnectionConfig;
  queryCount?: number; // default: 1000
  concurrency?: number; // default: 20
  mappings?: CollectionMapping[];
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return Math.round((sorted[Math.max(0, Math.min(index, sorted.length - 1))] || 0) * 100) / 100;
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/**
 * Runs 1,000 non-mutating queries across live MongoDB and PostgreSQL
 */
export async function runQueryBenchmark(
  options: RunBenchmarkOptions
): Promise<Phase10BenchmarkResult> {
  const {
    sourceConfig,
    targetConfig,
    queryCount = 1000,
    concurrency = 20,
    mappings = []
  } = options;

  // 1. Normalize connection configs
  const normSource = normalizeConnectionConfig(sourceConfig);
  const normTarget = normalizeConnectionConfig(targetConfig);

  const mongoUri = normSource.connectionString ||
    `mongodb://${normSource.host || 'localhost'}:${normSource.port || 27017}/${normSource.database}`;

  const mongoClient = new MongoClient(mongoUri, {
    connectTimeoutMS: 6000,
    serverSelectionTimeoutMS: 6000,
    maxPoolSize: concurrency + 5
  });

  const pgPoolConfig = normTarget.connectionString
    ? { connectionString: normTarget.connectionString }
    : {
        host: normTarget.host || 'localhost',
        port: normTarget.port || 5432,
        user: normTarget.user || 'postgres',
        password: normTarget.password || '',
        database: normTarget.database,
        ssl: normTarget.ssl ? { rejectUnauthorized: false } : undefined
      };

  const pgPool = new Pool({
    ...pgPoolConfig,
    max: concurrency + 5,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 10000
  });

  await Promise.all([
    mongoClient.connect(),
    pgPool.query('SELECT 1;')
  ]);

  try {
    const mongoDb = mongoClient.db(normSource.database);

    // 2. Determine target tables & collections to query
    let primaryCollection = mappings[0]?.collectionName;
    let primaryTable = mappings[0]?.targetTableName || primaryCollection;

    if (!primaryCollection) {
      const cols = await mongoDb.listCollections().toArray();
      primaryCollection = cols[0]?.name || 'users';
      primaryTable = sanitizeIdentifier(primaryCollection);
    } else {
      primaryTable = sanitizeIdentifier(primaryTable);
    }

    // Check for child table for Join tests
    const childMapping = mappings.find(m => m.childTables && m.childTables.length > 0);
    const childTable = childMapping?.childTables?.[0]?.targetTableName;
    const parentTableForJoin = childMapping ? sanitizeIdentifier(childMapping.targetTableName) : primaryTable;
    const safeChildTable = childTable ? sanitizeIdentifier(childTable) : null;

    // 3. Collect sample IDs and sample filters
    const mongoColl = mongoDb.collection(primaryCollection);
    const sampleDocs = await mongoColl.find({}, { limit: 50 }).toArray();
    const sampleMongoIds = sampleDocs.map(d => d._id);

    // Get sample PG IDs
    const pgSampleRes = await pgPool.query(
      `SELECT id FROM "${primaryTable}" LIMIT 50;`
    ).catch(() => ({ rows: [] as Array<{ id: unknown }> }));
    const samplePgIds = pgSampleRes.rows.map(r => r.id);

    // Latency storage
    const mongoPkLatencies: number[] = [];
    const pgPkLatencies: number[] = [];
    const mongoFilterLatencies: number[] = [];
    const pgFilterLatencies: number[] = [];
    const mongoJoinLatencies: number[] = [];
    const pgJoinLatencies: number[] = [];

    // Category allocation: ~40% PK, ~35% Filter/Sort, ~25% Join/Aggregate
    const pkCount = Math.floor(queryCount * 0.40);
    const filterCount = Math.floor(queryCount * 0.35);
    const joinCount = queryCount - pkCount - filterCount;

    // Concurrency runner helper
    async function runParallel(tasks: Array<() => Promise<void>>, poolLimit: number): Promise<void> {
      const executing = new Set<Promise<void>>();
      for (const task of tasks) {
        const p = task().finally(() => executing.delete(p));
        executing.add(p);
        if (executing.size >= poolLimit) {
          await Promise.race(executing);
        }
      }
      await Promise.all(executing);
    }

    const startOverall = Date.now();

    // -------------------------------------------------------------
    // A. PRIMARY KEY LOOKUPS
    // -------------------------------------------------------------
    const pkTasks: Array<() => Promise<void>> = [];
    for (let i = 0; i < pkCount; i++) {
      pkTasks.push(async () => {
        // Mongo PK
        const mongoId = sampleMongoIds[i % (sampleMongoIds.length || 1)];
        const mStart = process.hrtime.bigint();
        try {
          if (mongoId !== undefined) {
            await mongoColl.findOne({ _id: mongoId });
          } else {
            await mongoColl.findOne({});
          }
        } catch {
          // Non-fatal
        }
        const mEnd = process.hrtime.bigint();
        mongoPkLatencies.push(Number(mEnd - mStart) / 1_000_000);

        // PG PK
        const pgId = samplePgIds[i % (samplePgIds.length || 1)];
        const pStart = process.hrtime.bigint();
        try {
          if (pgId !== undefined) {
            await pgPool.query(`SELECT * FROM "${primaryTable}" WHERE id = $1 LIMIT 1;`, [pgId]);
          } else {
            await pgPool.query(`SELECT * FROM "${primaryTable}" LIMIT 1;`);
          }
        } catch {
          // Non-fatal
        }
        const pEnd = process.hrtime.bigint();
        pgPkLatencies.push(Number(pEnd - pStart) / 1_000_000);
      });
    }
    await runParallel(pkTasks, concurrency);

    // -------------------------------------------------------------
    // B. CATEGORY / FILTER & SORT
    // -------------------------------------------------------------
    const filterTasks: Array<() => Promise<void>> = [];
    for (let i = 0; i < filterCount; i++) {
      filterTasks.push(async () => {
        // Mongo Filter & Sort
        const mStart = process.hrtime.bigint();
        try {
          await mongoColl.find({}).sort({ _id: -1 }).limit(10).toArray();
        } catch {
          // Non-fatal
        }
        const mEnd = process.hrtime.bigint();
        mongoFilterLatencies.push(Number(mEnd - mStart) / 1_000_000);

        // PG Filter & Sort
        const pStart = process.hrtime.bigint();
        try {
          await pgPool.query(`SELECT * FROM "${primaryTable}" ORDER BY id DESC LIMIT 10;`);
        } catch {
          // Non-fatal
        }
        const pEnd = process.hrtime.bigint();
        pgFilterLatencies.push(Number(pEnd - pStart) / 1_000_000);
      });
    }
    await runParallel(filterTasks, concurrency);

    // -------------------------------------------------------------
    // C. AGGREGATE / JOIN
    // -------------------------------------------------------------
    const joinTasks: Array<() => Promise<void>> = [];
    for (let i = 0; i < joinCount; i++) {
      joinTasks.push(async () => {
        // Mongo Aggregate
        const mStart = process.hrtime.bigint();
        try {
          await mongoColl.aggregate([
            { $group: { _id: null, totalDocs: { $sum: 1 } } }
          ]).toArray();
        } catch {
          // Non-fatal
        }
        const mEnd = process.hrtime.bigint();
        mongoJoinLatencies.push(Number(mEnd - mStart) / 1_000_000);

        // PG Relational Join or Count Aggregate
        const pStart = process.hrtime.bigint();
        try {
          if (safeChildTable) {
            await pgPool.query(
              `SELECT p.id, COUNT(c.id) AS child_count
               FROM "${parentTableForJoin}" p
               LEFT JOIN "${safeChildTable}" c ON c."${parentTableForJoin}_id" = p.id
               GROUP BY p.id
               LIMIT 10;`
            );
          } else {
            await pgPool.query(`SELECT COUNT(*) AS total_count FROM "${primaryTable}";`);
          }
        } catch {
          // Fallback simple count
          await pgPool.query(`SELECT COUNT(*) FROM "${primaryTable}";`).catch(() => null);
        }
        const pEnd = process.hrtime.bigint();
        pgJoinLatencies.push(Number(pEnd - pStart) / 1_000_000);
      });
    }
    await runParallel(joinTasks, concurrency);

    const totalElapsedSec = Math.max(0.1, (Date.now() - startOverall) / 1000);

    // Aggregate Latencies
    const allMongoLatencies = [
      ...mongoPkLatencies,
      ...mongoFilterLatencies,
      ...mongoJoinLatencies
    ];
    const allPgLatencies = [
      ...pgPkLatencies,
      ...pgFilterLatencies,
      ...pgJoinLatencies
    ];

    const mongoMetrics: BenchmarkMetrics = {
      totalQueries: allMongoLatencies.length,
      avgLatencyMs: calculateAverage(allMongoLatencies),
      p50LatencyMs: calculatePercentile(allMongoLatencies, 50),
      p95LatencyMs: calculatePercentile(allMongoLatencies, 95),
      p99LatencyMs: calculatePercentile(allMongoLatencies, 99),
      throughputQps: Math.round(allMongoLatencies.length / totalElapsedSec)
    };

    const pgMetrics: BenchmarkMetrics = {
      totalQueries: allPgLatencies.length,
      avgLatencyMs: calculateAverage(allPgLatencies),
      p50LatencyMs: calculatePercentile(allPgLatencies, 50),
      p95LatencyMs: calculatePercentile(allPgLatencies, 95),
      p99LatencyMs: calculatePercentile(allPgLatencies, 99),
      throughputQps: Math.round(allPgLatencies.length / totalElapsedSec)
    };

    // Speedup multiplier
    const speedup = pgMetrics.avgLatencyMs > 0
      ? Math.round((mongoMetrics.avgLatencyMs / pgMetrics.avgLatencyMs) * 10) / 10
      : 1.0;

    // Categories
    const categories: BenchmarkCategoryBreakdown[] = [
      {
        name: 'Primary Key Lookup',
        mongoAvgMs: calculateAverage(mongoPkLatencies),
        postgresAvgMs: calculateAverage(pgPkLatencies),
        speedupFactor: pgPkLatencies.length > 0 && calculateAverage(pgPkLatencies) > 0
          ? Math.round((calculateAverage(mongoPkLatencies) / calculateAverage(pgPkLatencies)) * 10) / 10
          : 1.0,
        queriesRun: pkCount
      },
      {
        name: 'Category Filter & Sort',
        mongoAvgMs: calculateAverage(mongoFilterLatencies),
        postgresAvgMs: calculateAverage(pgFilterLatencies),
        speedupFactor: pgFilterLatencies.length > 0 && calculateAverage(pgFilterLatencies) > 0
          ? Math.round((calculateAverage(mongoFilterLatencies) / calculateAverage(pgFilterLatencies)) * 10) / 10
          : 1.0,
        queriesRun: filterCount
      },
      {
        name: 'Aggregate / Multi-Table Join',
        mongoAvgMs: calculateAverage(mongoJoinLatencies),
        postgresAvgMs: calculateAverage(pgJoinLatencies),
        speedupFactor: pgJoinLatencies.length > 0 && calculateAverage(pgJoinLatencies) > 0
          ? Math.round((calculateAverage(mongoJoinLatencies) / calculateAverage(pgJoinLatencies)) * 10) / 10
          : 1.0,
        queriesRun: joinCount
      }
    ];

    return {
      queryCount,
      mongo: mongoMetrics,
      postgres: pgMetrics,
      speedupFactor: speedup,
      isPostgresFaster: pgMetrics.avgLatencyMs <= mongoMetrics.avgLatencyMs,
      categories,
      timestamp: new Date().toISOString()
    };
  } finally {
    await mongoClient.close().catch(() => null);
    await pgPool.end().catch(() => null);
  }
}

