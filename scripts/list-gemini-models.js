const https = require('https');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let geminiKey = process.env.VITE_GEMINI_API_KEY;
if (!geminiKey && fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('VITE_GEMINI_API_KEY=')) {
      geminiKey = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

console.log('Querying Gemini models for key:', geminiKey ? geminiKey.slice(0, 10) + '...' : 'NOT FOUND');

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;

https.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      const data = JSON.parse(body);
      const modelNames = data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => ({
          name: m.name.replace('models/', ''),
          displayName: m.displayName,
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit
        }));
      console.log('Gemini Models supporting generateContent:');
      console.table(modelNames);
    } else {
      console.error(`Gemini Error ${res.statusCode}:`, body);
    }
  });
}).on('error', err => console.error(err));
