# Groq API Setup Guide for MigrateIQ

This guide explains how to get and configure a **100% free Groq API key** to serve as an ultra-fast, high-availability backup for MigrateIQ.

---

## 🚀 Why Use Groq with MigrateIQ?

1. **Lightning Fast:** Groq runs on custom LPU (Language Processing Unit) silicon, generating **500+ tokens per second** (responses come back in ~0.5 seconds vs 3–5 seconds on traditional cloud providers).
2. **100% Free Tier:** Generous free allowances with zero credit card required.
3. **No 503 Overload Spikes:** Extremely stable uptime, making it the ideal fallback during live presentations, viva defenses, and demos.

---

## 🔑 How to Get Your Free Groq API Key (Takes 30 Seconds)

1. Open your browser and go to: **[https://console.groq.com/keys](https://console.groq.com/keys)**
2. Sign in with your **Google Account** or **GitHub Account** (no credit card needed).
3. Click the blue button: **"Create API Key"**.
4. Give it a name (e.g., `MigrateIQ-Dev`).
5. Copy the generated key (it starts with `gsk_...`).
   > *Note: Copy it immediately because Groq will only show it to you once!*

---

## ⚙️ How to Add it into MigrateIQ

### Method 1: Directly via the Desktop App UI (Recommended)
1. Open the MigrateIQ Desktop App.
2. In the left sidebar, click **"Settings"** (gear icon at the bottom).
3. Find the **AI Provider Configuration** section:
   - Select Provider: **Groq** (or Gemini with Groq Fallback)
   - API Key: Paste your `gsk_...` key.
   - Default Model: `llama-3.3-70b-versatile` or `llama-3.1-8b-instant`.
4. Click **"Save Settings"** or **"Test API Key"**.

### Method 2: Via `.env` File (Optional)
Add this to your `.env` file in the project root:
```env
GROQ_API_KEY="gsk_your_key_here"
```

---

## 📊 Groq Free Tier Limits

| Feature | Free Tier Allowance |
| :--- | :--- |
| **Cost** | **$0.00 (Completely Free)** |
| **Credit Card Required?** | **No** |
| **Requests Per Minute** | 30 requests / minute |
| **Requests Per Day** | 14,400 requests / day |
| **Recommended Models** | `llama-3.3-70b-versatile` (Smartest)<br>`llama-3.1-8b-instant` (Fastest) |

---

*Keep this guide handy whenever you want to set up Groq for your live presentations!*
