# API Key Troubleshooting

## Your Current API Key

You have: `YOUR_GEMINI_API_KEY_HERE`

This format suggests it's from **Google Cloud Console** (OAuth key), not **Google AI Studio**.

---

## How to Get the CORRECT Gemini API Key

### Method 1: Google AI Studio (Easiest - Recommended)

1. **Go to:** https://aistudio.google.com/app/apikey
   - Or: https://aistudio.google.com/ → Click "Get API Key" in left sidebar
   
2. **Sign in** with your Google account

3. **Click "Create API Key"** button

4. **Copy the key** - it should look like:
   ```
   AIzaSyBx1234567890abcdefghijklmnopqrstuvwxyz
   ```
   (starts with `AIzaSy`, about 39 characters total)

### Method 2: Google Cloud Console

1. **Go to:** https://console.cloud.google.com/apis/credentials

2. **Select your project** (or create one)

3. **Click "Create Credentials" → "API Key"**

4. **Copy the key**

5. **IMPORTANT:** Enable Gemini API:
   - Go to "Library" in left sidebar
   - Search for "Gemini API"
   - Click "Enable"

---

## Why Your Key Might Not Work

Your key starts with `AQ.` which suggests:

- ❌ It might be an OAuth client ID (not an API key)
- ❌ It might be from a different Google service
- ❌ It might be a service account key (JSON format)

**Gemini API keys MUST:**
- ✅ Start with `AIzaSy`
- ✅ Be ~39 characters long
- ✅ Have Gemini API enabled for the project

---

## Test Your API Key

### Quick Test in Browser:

1. Open: https://aistudio.google.com/app/apikey
2. Look for your key in the list
3. If you see it there, copy it again
4. If you don't see it, create a new one

### Test with curl:

```bash
curl -s -X POST \
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello"
      }]
    }]
  }'
```

If you get a valid response, your key works!

---

## How to Update Your .env File

1. Open: `apps/desktop/renderer/.env`

2. Replace the current key:
   ```env
   # OLD:
   VITE_GEMINI_API_KEY=YOUR_OLD_API_KEY_HERE
   
   # NEW (correct format):
   VITE_GEMINI_API_KEY=AIzaSyYourCorrectAPIKeyHere123456789
   ```

3. **Restart the dev server:**
   ```bash
   # Stop the app (Ctrl+C)
   cd apps/desktop
   npm run dev
   ```

---

## Verify It's Working

After updating the .env file and restarting:

1. **Open DevTools** (F12) in the app
2. **Go to Console tab**
3. **Connect to MongoDB** (Step 2)
4. **Look for this log:**
   ```
   [Health Score] API Key: Found
   [AI Handler] API Key received: AIzaSyBx12...
   ```

If you see `NOT FOUND` or `NOT PROVIDED`, the .env file isn't loading.

---

## Common Issues

### Issue 1: "API key not valid" error

**Fix:**
- Get a new key from: https://aistudio.google.com/app/apikey
- Make sure Gemini API is enabled

### Issue 2: "Quota exceeded" error

**Fix:**
- You've hit the rate limit (15 req/min on free tier)
- Wait 1 minute and try again

### Issue 3: Environment variable not loading

**Fix:**
- Make sure .env is in `apps/desktop/renderer/` folder
- Make sure variable name is exactly `VITE_GEMINI_API_KEY` (not `GEMINI_API_KEY`)
- Restart the dev server after changing .env

### Issue 4: Key works but no AI badge

**Fix:**
- Check DevTools console for errors
- Look for `[AI] Estimated tokens:` log
- If you see errors, share them with me

---

## Still Not Working?

Please share:
1. Screenshot of your API key page: https://aistudio.google.com/app/apikey
   - **Blur out the actual key** for security!
2. Any errors from DevTools Console (F12 → Console)
3. Any errors from terminal where you ran `npm run dev`

I'll help debug further!
