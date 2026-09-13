# Gemini API Setup Guide for MigrateIQ

## 🎯 Overview

MigrateIQ uses **Google Gemini 3.7 Flash** (latest stable model) for AI-powered schema mapping. This guide shows you how to get and configure your API key.

---

## 📋 Step 1: Get Your Gemini API Key

### Option A: Google AI Studio (Recommended for Individual Use)

1. **Go to:** https://aistudio.google.com/apikey
2. **Sign in** with your Google account (Gmail)
3. **Click "Create API Key"**
4. **Select or create a Google Cloud project** (free tier available)
5. **Copy your API key** (looks like: `AIzaSy...`)

### Option B: Google Cloud Console (For Production)

1. **Go to:** https://console.cloud.google.com/
2. **Create or select a project**
3. **Enable the Gemini API:**
   - Go to "APIs & Services" → "Library"
   - Search for "Gemini API"
   - Click "Enable"
4. **Create credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the key

---

## 🔐 Step 2: Configure the API Key

### 2.1: Open the .env file

Navigate to: `apps/desktop/.env`

### 2.2: Add your API key

Replace the empty line with your key:

```env
# MigrateIQ Desktop App - Environment Variables
# DO NOT commit this file to Git!

# Google Gemini API Key (get from: https://aistudio.google.com/apikey)
VITE_GEMINI_API_KEY=AIzaSyYourActualAPIKeyHere123456789
```

**⚠️ Important:**
- No quotes around the key
- No spaces after the `=`
- Keep it on one line

### 2.3: Save the file

That's it! The app will automatically read this key on startup.

---

## ✅ Step 3: Verify It Works

### 3.1: Restart the dev server

If the app is already running, stop it and restart:

```bash
cd apps/desktop
npm run dev
```

### 3.2: Test in the wizard

1. Go through Steps 1-3 (direction, MongoDB connection, PostgreSQL connection)
2. When you reach **Step 4**, watch for:
   - **Badge:** "🤖 AI Suggested" (instead of "🔧 Auto Rule-Mapped")
   - **Loading time:** 2-5 seconds (instead of instant)
   - **Console log:** Look for `[AI] Estimated tokens: X` in DevTools (F12)

### 3.3: Check health score

After connecting to MongoDB in **Step 2**, you should see:
- "🧬 Analyzing..." badge appears briefly
- Then shows "🧬 Health: XX/100" with color coding

---

## 🧪 Testing Without API Key (Rule Engine Fallback)

If you don't have an API key or want to test offline:

1. **Leave `.env` file as is** (empty `VITE_GEMINI_API_KEY=`)
2. Run the app normally
3. Step 4 will use the **rule engine** (deterministic mapping)
4. Badge will show "🔧 Auto Rule-Mapped"
5. Health score badge won't appear (graceful degradation)

---

## 💰 Pricing & Limits

### Free Tier (Google AI Studio)
- **15 requests per minute**
- **1 million tokens per day**
- **32K context window**
- Perfect for development and testing

### Gemini Pro Plan (What you have!)
- **Higher rate limits**
- **Priority access**
- **Better performance**
- **Longer context window**
- Check your specific plan details at: https://ai.google.dev/pricing

### Cost Estimation for MigrateIQ
- **Per schema mapping:** ~500-2000 tokens (depending on schema size)
- **Per health score:** ~300-800 tokens
- **Example:** 100 migrations = ~100,000 tokens ≈ **FREE** (well under 1M/day limit)

---

## 🔒 Security Best Practices

### ✅ DO:
- ✅ Store API key in `.env` file
- ✅ Keep `.env` in `.gitignore` (already done)
- ✅ Use environment variables in production
- ✅ Rotate keys if exposed

### ❌ DON'T:
- ❌ Commit `.env` to Git
- ❌ Share API keys in Slack/Discord
- ❌ Hardcode keys in source code
- ❌ Use production keys in dev/test

---

## 🐛 Troubleshooting

### Error: "API key not valid"

**Cause:** Invalid or missing API key

**Fix:**
1. Verify key is correct (no extra spaces)
2. Check key is active at: https://aistudio.google.com/apikey
3. Ensure Gemini API is enabled for your project

---

### Error: "Quota exceeded"

**Cause:** Rate limit reached (15 req/min on free tier)

**Fix:**
1. Wait 1 minute and try again
2. Upgrade to paid plan for higher limits
3. Implement request caching (future enhancement)

---

### Error: "Model not found"

**Cause:** Using wrong model name

**Fix:**
The code already uses the correct model: `gemini-3.7-flash`

If you see this error, check:
- Your API key has Gemini API access
- The model is available in your region
- Try fallback model: `gemini-2.5-flash` (edit `apps/desktop/main/handlers/ai.ts` line 43)

---

### AI Fallback Not Working

**Symptom:** App crashes instead of falling back to rule engine

**Fix:**
1. Check console for errors (F12 → Console)
2. Verify error handling in `apps/desktop/main/handlers/ai.ts`
3. Should gracefully fallback to `generateMappingByRules()`

---

## 📊 How It Works (Technical Details)

### Flow Diagram:

```
User connects MongoDB (Step 2)
         ↓
fetchHealthScoreAsync() called
         ↓
Reads VITE_GEMINI_API_KEY from .env
         ↓
If key exists:
    → Call Gemini API (gemini-3.7-flash)
    → Return health score 0-100
    → Show color-coded badge
If no key:
    → Return null silently
    → Badge doesn't appear
```

```
User reaches Step 4
         ↓
generateAIMapping() called
         ↓
Reads VITE_GEMINI_API_KEY from .env
         ↓
If key exists:
    → Call Gemini API with schema JSON
    → Receive mapping suggestions
    → Badge: "🤖 AI Suggested"
If no key OR error:
    → Use rule engine (deterministic)
    → Badge: "🔧 Auto Rule-Mapped"
    → No error shown to user
```

### Environment Variable Access:

```typescript
// In renderer process (React components)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || undefined;

// This is injected by Vite at build time
// VITE_ prefix is required for client-side access
```

---

## 🔄 Updating the API Key

If you need to change your API key:

1. **Edit `.env` file:**
   ```env
   VITE_GEMINI_API_KEY=YourNewAPIKeyHere
   ```

2. **Restart the dev server:**
   ```bash
   # Stop the app (Ctrl+C)
   npm run dev
   ```

3. **Clear browser cache** (if needed):
   - DevTools → Application → Clear storage
   - Or hard refresh: Ctrl+Shift+R

---

## 🚀 Production Deployment

For production builds, you'll need to:

### Option 1: Build-time Environment Variables
```bash
VITE_GEMINI_API_KEY=YourKey npm run build
```

### Option 2: Runtime Configuration (Recommended)
Create a `config.json` file loaded at runtime (not yet implemented).

### Option 3: User Settings UI (Future)
Let users input their own API key in settings screen (Phase 8+).

---

## 📝 Summary Checklist

- [ ] Get API key from https://aistudio.google.com/apikey
- [ ] Add to `apps/desktop/.env` as `VITE_GEMINI_API_KEY=...`
- [ ] Restart dev server (`npm run dev`)
- [ ] Test Step 4 shows "🤖 AI Suggested" badge
- [ ] Test Step 2 shows health score badge
- [ ] Verify `.env` is NOT in Git (`git status` should not show it)

---

## 🎉 You're All Set!

Once your API key is configured, you'll have:
- ✅ AI-powered schema mapping (Gemini 3.7 Flash)
- ✅ Intelligent health scores
- ✅ Smart type inference
- ✅ Better index recommendations
- ✅ Seamless fallback to rule engine

**Happy migrating! 🚀**
