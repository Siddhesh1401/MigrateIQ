const { MongoClient } = require('mongodb');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Read API Keys from .env
const envPath = path.join(__dirname, '..', '.env');
let geminiKey = process.env.VITE_GEMINI_API_KEY;
let groqKey = process.env.GROQ_API_KEY;

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('VITE_GEMINI_API_KEY=')) {
      geminiKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
    if (line.startsWith('GROQ_API_KEY=')) {
      groqKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

// 2. Introspect MongoDB Collections exactly as db.ts does
async function introspectTestbed() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('phase9_source_mongo');
  const collections = ['categories', 'users', 'products', 'orders'];
  const schemas = [];

  for (const collName of collections) {
    const coll = db.collection(collName);
    const docs = await coll.find({}).limit(20).toArray();
    const fieldsMap = new Map();

    for (const doc of docs) {
      for (const [k, v] of Object.entries(doc)) {
        let bsonType = 'string';
        if (v === null || v === undefined) bsonType = 'null';
        else if (v instanceof Date) bsonType = 'date';
        else if (v._bsontype === 'ObjectId' || (typeof v === 'object' && v.toHexString)) bsonType = 'ObjectId';
        else if (Array.isArray(v)) {
          const hasObj = v.some(el => el !== null && typeof el === 'object' && !Array.isArray(el));
          bsonType = hasObj ? 'arrayOfObjects' : 'array';
        } else if (typeof v === 'number') {
          bsonType = Number.isInteger(v) ? 'int' : 'double';
        } else if (typeof v === 'boolean') {
          bsonType = 'bool';
        } else if (typeof v === 'object') {
          bsonType = 'object';
        }

        if (!fieldsMap.has(k)) {
          fieldsMap.set(k, {
            name: k,
            bsonType,
            sampleValues: [String(v).slice(0, 50)],
            isNullable: v === null
          });
        }
      }
    }

    schemas.push({
      collectionName: collName,
      documentCount: await coll.countDocuments(),
      fields: Array.from(fieldsMap.values())
    });
  }

  await client.close();
  return schemas;
}

// 3. Exact MigrateIQ Production Prompt from ai.ts lines 1133-1221
function buildExactProductionPrompt(schemas) {
  return `You are a principal database architect and migration expert. Convert this MongoDB schema to a high-performance PostgreSQL schema mapping.

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
15. Cross-Collection Relationships & Foreign Keys:
    Analyze all collections together. If a collection has a field referencing another collection's primary key (e.g., 'userId' or 'customerEmail' in orders pointing to 'users._id'):
    - Set foreignKeyToParent to the referenced table (e.g. "users.id")
    - Ensure targetColumn uses snake_case (e.g. "user_id")
    - Set targetType to match the referenced key (VARCHAR(24))
16. Value-Aware Sizing from sampleValues:
    If sampleValues are provided, use them to optimize column types:
    - Email addresses → VARCHAR(255)
    - Short status/codes → VARCHAR(20) or VARCHAR(50)
    - Phone numbers → VARCHAR(20)
    - Price/money values → NUMERIC(18,4) or NUMERIC(10,2)
17. PostgreSQL Reserved Words Protection:
    Do NOT name columns or tables with unquoted PostgreSQL reserved keywords (such as 'order', 'user', 'group', 'table', 'check', 'limit', 'offset', 'primary', 'references').
    Rename them safely to prevent syntax errors (e.g. 'order' → 'orders', 'user' → 'users').

---
### Few-Shot Example:
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
    "indexes": [],
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

Return ONLY the JSON array matching the structure above. No markdown, no conversational text.`;
}

// 4. Query Groq
async function queryGroq(modelName, prompt) {
  const start = Date.now();
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are an expert database migration assistant. Respond ONLY with valid JSON conforming strictly to the requested array format.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const latencyMs = Date.now() - start;
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(body);
            let content = parsed.choices[0].message.content.trim();
            let json = JSON.parse(content);
            if (!Array.isArray(json) && json.mappings) json = json.mappings;
            if (!Array.isArray(json) && Object.values(json).find(Array.isArray)) {
              json = Object.values(json).find(Array.isArray);
            }
            resolve({ success: true, model: modelName, latencyMs, data: json });
          } catch (e) {
            resolve({ success: false, model: modelName, latencyMs, error: 'JSON Parse Error: ' + e.message, raw: body });
          }
        } else {
          resolve({ success: false, model: modelName, latencyMs, error: `HTTP ${res.statusCode}: ${body.slice(0, 150)}` });
        }
      });
    });

    req.on('error', err => resolve({ success: false, model: modelName, latencyMs: Date.now() - start, error: err.message }));
    req.write(payload);
    req.end();
  });
}

// 5. Query Gemini
async function queryGemini(modelName, prompt) {
  const start = Date.now();
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const latencyMs = Date.now() - start;
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(body);
            let text = parsed.candidates[0].content.parts[0].text.trim();
            let json = JSON.parse(text);
            if (!Array.isArray(json) && json.mappings) json = json.mappings;
            resolve({ success: true, model: modelName, latencyMs, data: json });
          } catch (e) {
            resolve({ success: false, model: modelName, latencyMs, error: 'JSON Parse Error: ' + e.message });
          }
        } else {
          resolve({ success: false, model: modelName, latencyMs, error: `HTTP ${res.statusCode}: ${body.slice(0, 150)}` });
        }
      });
    });

    req.on('error', err => resolve({ success: false, model: modelName, latencyMs: Date.now() - start, error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('=================================================================');
  console.log('🧪 LIVE COMPARISON WITH EXACT MIGRATEIQ PRODUCTION PROMPT');
  console.log('=================================================================');
  
  const schemas = await introspectTestbed();
  console.log(`Introspected: ${schemas.map(s => s.collectionName).join(', ')}`);
  
  const prompt = buildExactProductionPrompt(schemas);

  console.log('\nSending EXACT same prompt to all 3 models:');
  console.log('1. Groq Qwen (qwen/qwen3.8-27b)...');
  const groqQwen = await queryGroq('qwen/qwen3.8-27b', prompt);
  console.log(`   -> Groq Qwen: ${groqQwen.success ? `✅ SUCCESS (${groqQwen.latencyMs}ms)` : `❌ ${groqQwen.error}`}`);

  console.log('2. Groq GPT-OSS 120B (openai/gpt-oss-120b)...');
  const groq120b = await queryGroq('openai/gpt-oss-120b', prompt);
  console.log(`   -> Groq 120B: ${groq120b.success ? `✅ SUCCESS (${groq120b.latencyMs}ms)` : `❌ ${groq120b.error}`}`);

  console.log('3. Gemini 3.5-Flash-Lite (gemini-3.5-flash-lite)...');
  const gemini35 = await queryGemini('gemini-3.5-flash-lite', prompt);
  console.log(`   -> Gemini: ${gemini35.success ? `✅ SUCCESS (${gemini35.latencyMs}ms)` : `❌ ${gemini35.error}`}`);

  const results = {
    promptLengthChars: prompt.length,
    models: {
      groqQwen,
      groq120b,
      gemini35
    }
  };

  fs.writeFileSync(path.join(__dirname, '..', 'documentation', 'exact-prompt-comparison.json'), JSON.stringify(results, null, 2));
  console.log('\nSaved full results to documentation/exact-prompt-comparison.json');
}

run();
