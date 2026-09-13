/**
 * Simple test to verify Gemini API key works
 * Run with: node test-gemini-key.js
 */

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';

async function testGeminiKey() {
  console.log('🧪 Testing Gemini API Key...\n');
  console.log('API Key:', apiKey.substring(0, 10) + '...');

  try {
    console.log('\n1️⃣ Importing Google Generative AI SDK...');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    console.log('✅ SDK imported successfully\n');

    console.log('2️⃣ Initializing Gemini AI...');
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini AI initialized\n');

    console.log('3️⃣ Getting model (gemini-3.7-flash)...');
    const model = genAI.getGenerativeModel({ model: 'gemini-3.7-flash' });
    console.log('✅ Model loaded\n');

    console.log('4️⃣ Sending test request...');
    const result = await model.generateContent('Say "Hello from MigrateIQ!" in 5 words or less.');
    const response = result.response.text();
    console.log('✅ Response received:\n');
    console.log('   ', response);
    console.log('\n✅ API Key is VALID and working!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
  }
}

testGeminiKey();
