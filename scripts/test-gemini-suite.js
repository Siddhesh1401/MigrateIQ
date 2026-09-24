const { MongoClient } = require('mongodb');
const https = require('https');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let geminiKey = process.env.VITE_GEMINI_API_KEY;

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('VITE_GEMINI_API_KEY=')) {
      geminiKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

async function testGeminiModels() {
  const benchmarkData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'documentation', 'ai-model-benchmark-results.json'), 'utf8'));
  const schemas = benchmarkData.schemas;

  const prompt = `You are a principal database architect and migration expert. Convert this MongoDB schema to a high-performance PostgreSQL schema mapping.

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

  for (const modelName of ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']) {
    console.log(`\nTesting ${modelName}...`);
    const start = Date.now();
    await new Promise((resolve) => {
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
          console.log(`Status: ${res.statusCode} (${latencyMs}ms)`);
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(body);
              let text = parsed.candidates[0].content.parts[0].text;
              let json = JSON.parse(text);
              benchmarkData.results[modelName] = { success: true, model: modelName, latencyMs, data: json };
              console.log(`✅ ${modelName} returned valid mapping!`);
            } catch (e) {
              console.log('Parse error:', e.message);
            }
          } else {
            console.log('Error:', body.slice(0, 150));
          }
          resolve();
        });
      });

      req.on('error', err => {
        console.error(err);
        resolve();
      });
      req.write(payload);
      req.end();
    });
  }

  fs.writeFileSync(path.join(__dirname, '..', 'documentation', 'ai-model-benchmark-results.json'), JSON.stringify(benchmarkData, null, 2));
  console.log('\nUpdated ai-model-benchmark-results.json');
}

testGeminiModels();
