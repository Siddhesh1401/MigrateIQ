# 🚀 How to Set Up & Run MigrateIQ (Team Guide)

Welcome to **MigrateIQ**! Follow these simple steps to get the project running on your computer.

---

## 🛠️ Step 1: Install the Required Tools (One-Time Setup)

Before running the project, make sure you have these installed on your Windows laptop:

1. **Node.js (Version 20 or higher)**  
   👉 Download and install from: [nodejs.org](https://nodejs.org) (Choose the **LTS** version).
2. **Git**  
   👉 Download and install from: [git-scm.com](https://git-scm.com).
3. **VS Code (or Antigravity IDE)**  
   👉 Download from: [code.visualstudio.com](https://code.visualstudio.com).

*(To check if they are installed, open your Command Prompt/Terminal and type `node -v` and `git --version`).*

---

## 📥 Step 2: Clone the Project Repository

1. Open your terminal (PowerShell or Git Bash).
2. Go to the folder where you want to keep the project (e.g., your Desktop):
   ```powershell
   cd ~/Desktop
   ```
3. Clone the repository from GitHub:
   ```powershell
   git clone https://github.com/Siddhesh1401/MigrateIQ.git
   ```
4. Move into the project folder:
   ```powershell
   cd MigrateIQ
   ```

---

## 📦 Step 3: Install Project Dependencies

Run this single command inside the root `MigrateIQ` folder:

```powershell
npm install
```

*(This automatically installs all dependencies across all workspaces and builds the `@migrateiq/shared` types package via postinstall).*

> 💡 **Troubleshooting Tip:** If you ever see `Cannot find module '@migrateiq/shared'`, simply run `npm run shared:build` once in the root folder.

---

## ▶️ Step 4: Running the Applications

### 🌐 Option A: Run the Landing Website
To open and test the Next.js marketing website:
```powershell
npm run web:dev
```
- Open your browser and go to: **[http://localhost:3000](http://localhost:3000)**

---

### 💻 Option B: Run the Windows Desktop App
To open and test the Electron desktop app:
```powershell
npm run desktop:dev
```
- The MigrateIQ desktop window will pop up automatically on your screen!

---

## 🧭 Project Folder Structure (Where is everything?)

```
MigrateIQ/
├── apps/
│   ├── web/           ← The 5-page Landing Website (Next.js)
│   └── desktop/       ← The Windows Desktop App (Electron + React)
├── packages/
│   └── shared/        ← Shared TypeScript types used by both apps
├── documentation/     ← Detailed technical docs for each phase
├── assets/            ← Logos and app icons
├── AGENTS.md          ← AI coding rules & guidelines
└── README.md          ← GitHub repository homepage
```

---

## ❓ Frequently Asked Questions & Troubleshooting

### 1. "I get a TypeScript error about `@migrateiq/shared`"
Run this command to compile the shared types:
```powershell
npm run shared:build
```

### 2. "How do I check if my code has any errors?"
Run the global type checker:
```powershell
npm run typecheck
```

### 3. "How do I pull the latest updates from GitHub?"
Before you start working, make sure you have the newest code:
```powershell
git pull origin main
```

---

*Need help? Reach out to the team on WhatsApp or open an issue on GitHub!*
