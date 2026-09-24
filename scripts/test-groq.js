const https = require('https');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let groqKey = process.env.GROQ_API_KEY;
if (!groqKey && fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('GROQ_API_KEY=')) {
      groqKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

async function testFullMapping() {
  const prompt = `You are a database migration expert. Map this MongoDB collection schema to PostgreSQL:
Collection: "orders"
Fields:
- _id: ObjectId
- orderNumber: string
- customerEmail: string
- status: string
- totalAmount: double
- itemCount: int
- items: arrayOfObjects
- notes: string (nullable)
- orderDate: date

Return a JSON object conforming strictly to:
{
  "mappings": [
    {
      "collectionName": "orders",
      "targetTableName": "orders",
      "fields": [
        { "sourceField": "...", "targetColumn": "...", "targetType": "...", "isNullable": true/false, "include": true }
      ]
    }
  ]
}`;

  const payload = JSON.stringify({
    model: 'qwen/qwen3.8-27b',
    messages: [
      { role: 'system', content: 'You are an expert database migration assistant. Respond ONLY with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1
  });

  const start = Date.now();
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
      console.log(`Response time: ${Date.now() - start}ms`);
      if (res.statusCode === 200) {
        const parsed = JSON.parse(body);
        console.log('Generated mapping:');
        console.log(JSON.stringify(JSON.parse(parsed.choices[0].message.content), null, 2));
      } else {
        console.error('Error:', body);
      }
    });
  });

  req.write(payload);
  req.end();
}

testFullMapping();
