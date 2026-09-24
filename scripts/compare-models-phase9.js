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

// 2. Introspect MongoDB Collections
async function introspectTestbed() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('phase9_source_mongo');
  const collections = ['categories', 'users', 'products', 'orders'];
  const schemas = [];

  for (const collName of collections) {
    const coll = db.collection(collName);
    const docs = await coll.find({}).limit(10).toArray();
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

// 3. Build Prompt
function buildPrompt(schemas) {
  return `You are a principal database architect and migration expert. Convert this MongoDB schema to a high-performance PostgreSQL schema mapping.

Rules:
1. ObjectId -> VARCHAR(24) (store as hex string, primary key "id")
2. String -> TEXT or VARCHAR(N)
3. NumberInt -> INTEGER
4. Double -> NUMERIC(10,2) or DOUBLE PRECISION
5. Date -> TIMESTAMP or TIMESTAMPTZ
6. Boolean -> BOOLEAN
7. Array of primitives -> TEXT[] or INTEGER[]
8. Array of objects -> Create separate child table with foreign key (set isChildTable: true, childTableName: "orders_items", foreignKeyToParent: "orders_id")
9. Nested object -> JSONB or flattened with underscore
10. Null/missing -> isNullable: true

Input Schema:
${JSON.stringify(schemas, null, 2)}

Return ONLY valid JSON matching this exact structure:
[
  {
    "collectionName": "...",
    "targetTableName": "...",
    "fields": [
      { "sourceField": "...", "targetColumn": "...", "targetType": "...", "isNullable": true, "include": true, "isChildTable": false }
    ]
  }
]`;
}

// 4. Call Groq
async function callGroq(modelName, prompt) {
  const start = Date.now();
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a database migration expert. Respond in strict JSON format only.' },
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
            let content = parsed.choices[0].message.content;
            let json = JSON.parse(content);
            if (json.mappings) json = json.mappings;
            resolve({ success: true, model: modelName, latencyMs, data: json, usage: parsed.usage });
          } catch (e) {
            resolve({ success: false, model: modelName, latencyMs, error: 'JSON parse error: ' + e.message });
          }
        } else {
          resolve({ success: false, model: modelName, latencyMs, error: `HTTP ${res.statusCode}: ${body.slice(0, 200)}` });
        }
      });
    });

    req.on('error', err => resolve({ success: false, model: modelName, latencyMs: Date.now() - start, error: err.message }));
    req.write(payload);
    req.end();
  });
}

// 5. Call Gemini
async function callGemini(modelName, prompt) {
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
            let text = parsed.candidates[0].content.parts[0].text;
            let json = JSON.parse(text);
            if (json.mappings) json = json.mappings;
            resolve({ success: true, model: modelName, latencyMs, data: json, usage: parsed.usageMetadata });
          } catch (e) {
            resolve({ success: false, model: modelName, latencyMs, error: 'JSON parse error: ' + e.message });
          }
        } else {
          resolve({ success: false, model: modelName, latencyMs, error: `HTTP ${res.statusCode}: ${body.slice(0, 200)}` });
        }
      });
    });

    req.on('error', err => resolve({ success: false, model: modelName, latencyMs: Date.now() - start, error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function runBenchmark() {
  console.log('=================================================================');
  console.log('🚀 Phase 9 Multi-Model AI Schema Mapping Benchmark');
  console.log('=================================================================');
  
  console.log('1. Introspecting phase9_source_mongo...');
  const schemas = await introspectTestbed();
  console.log(`   Collections found: ${schemas.map(s => s.collectionName).join(', ')}`);
  
  const prompt = buildPrompt(schemas);

  console.log('\n2. Testing Candidates:');
  console.log('   • Gemini 3.8-Flash (Primary Google)');
  console.log('   • Gemini 2.5-Flash (Stable Google)');
  console.log('   • Groq Qwen 3.8-27B (Ultra-fast LPU)');
  console.log('   • Groq GPT-OSS 120B (Heavy Reasoning LPU)');

  console.log('\n--- Querying Gemini 3.8-Flash ---');
  let gemini38 = await callGemini('gemini-3.8-flash', prompt);
  console.log(`Gemini 3.8-Flash: ${gemini38.success ? `SUCCESS (${gemini38.latencyMs}ms)` : `FAILED: ${gemini38.error}`}`);

  console.log('\n--- Querying Gemini 2.5-Flash ---');
  let gemini25 = await callGemini('gemini-2.5-flash', prompt);
  console.log(`Gemini 2.5-Flash: ${gemini25.success ? `SUCCESS (${gemini25.latencyMs}ms)` : `FAILED: ${gemini25.error}`}`);

  console.log('\n--- Querying Groq Qwen 3.8-27B ---');
  let groqQwen = await callGroq('qwen/qwen3.8-27b', prompt);
  console.log(`Groq Qwen 3.8-27B: ${groqQwen.success ? `SUCCESS (${groqQwen.latencyMs}ms)` : `FAILED: ${groqQwen.error}`}`);

  console.log('\n--- Querying Groq GPT-OSS 120B ---');
  let groq120b = await callGroq('openai/gpt-oss-120b', prompt);
  console.log(`Groq GPT-OSS 120B: ${groq120b.success ? `SUCCESS (${groq120b.latencyMs}ms)` : `FAILED: ${groq120b.error}`}`);

  // Save full outputs
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    schemas,
    results: {
      gemini38,
      gemini25,
      groqQwen,
      groq120b
    }
  };

  fs.writeFileSync(path.join(__dirname, '..', 'documentation', 'ai-model-benchmark-results.json'), JSON.stringify(benchmarkResults, null, 2));
  console.log('\n✅ Results saved to documentation/ai-model-benchmark-results.json');
}

runBenchmark();
