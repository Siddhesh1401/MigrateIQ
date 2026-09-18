import { app, BrowserWindow } from 'electron';
import path from 'path';
import { setupDatabaseHandlers } from './handlers/db';
import { setupStoreHandlers } from './handlers/store';
import { setupAIHandlers } from './handlers/ai';
import { setupAIUsageHandlers } from './handlers/aiUsageStore';
import { setupRiskHandlers } from './handlers/risk';
import { setupDryRunHandlers } from './handlers/dryRun';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'MigrateIQ',
    backgroundColor: '#F8FAFC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // In development, load from Vite dev server
  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in dev mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Setup IPC handlers for database connectivity
  setupDatabaseHandlers();

  // Setup IPC handlers for electron-store (saved connections, wizard state)
  setupStoreHandlers();

  // Setup IPC handlers for AI schema mapping
  setupAIHandlers();

  // Setup IPC handlers for AI usage & token tracking
  setupAIUsageHandlers();

  // Setup IPC handlers for pre-migration risk analysis (Step 5)
  setupRiskHandlers();

  // Setup IPC handlers for dry run simulation (Step 6)
  setupDryRunHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
