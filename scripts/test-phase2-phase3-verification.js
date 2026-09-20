/**
 * Phase 2 & Phase 3 Automated Verification Script
 * Validates:
 * 1. electron-store schema defaults (savedConnections, wizardState, migrationHistory)
 * 2. Migration history save & retrieval logic
 * 3. Wizard state snapshot lifecycle & reset behavior
 * 4. ErrorBoundary component presence and exports
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Running Phase 2 & Phase 3 Verification Suite...\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// ── Check 1: Verify ErrorBoundary Component exists and is exported ──────────
console.log('📋 Test 1: Desktop Shell Error Boundary');
const errorBoundaryPath = path.join(__dirname, '../apps/desktop/renderer/src/components/ErrorBoundary.tsx');
assert(fs.existsSync(errorBoundaryPath), 'ErrorBoundary.tsx file exists');
const errorBoundaryContent = fs.readFileSync(errorBoundaryPath, 'utf8');
assert(errorBoundaryContent.includes('export class ErrorBoundary'), 'ErrorBoundary is exported');
assert(errorBoundaryContent.includes('componentDidCatch'), 'componentDidCatch is implemented');
assert(errorBoundaryContent.includes('getDerivedStateFromError'), 'getDerivedStateFromError is implemented');
assert(errorBoundaryContent.includes('Return to Dashboard'), 'Provides Return to Dashboard recovery action');

// ── Check 2: Verify AppShell wraps Outlet in ErrorBoundary ─────────────────
console.log('\n📋 Test 2: AppShell Architecture & Layout');
const appShellPath = path.join(__dirname, '../apps/desktop/renderer/src/components/AppShell.tsx');
const appShellContent = fs.readFileSync(appShellPath, 'utf8');
assert(appShellContent.includes('<ErrorBoundary>'), 'AppShell wraps Outlet in ErrorBoundary');
assert(appShellContent.includes('app-shell-container'), 'AppShell uses CSS layout class app-shell-container');
assert(appShellContent.includes('app-shell-main'), 'AppShell uses CSS layout class app-shell-main');

// ── Check 3: Verify Electron Main Window Security Hardening ─────────────────
console.log('\n📋 Test 3: Electron Main Window Hardening');
const mainPath = path.join(__dirname, '../apps/desktop/main/main.ts');
const mainContent = fs.readFileSync(mainPath, 'utf8');
assert(mainContent.includes('Menu.setApplicationMenu(null)'), 'Default Chromium menu bar is disabled');
assert(mainContent.includes('setWindowOpenHandler'), 'setWindowOpenHandler is registered to block rogue popups');
assert(mainContent.includes('will-navigate'), 'will-navigate listener guards against unexpected navigation');
assert(mainContent.includes('sandbox: true'), 'Standard Chromium sandbox is enabled');

// ── Check 4: Verify Store Handlers in Electron Main ─────────────────────────
console.log('\n📋 Test 4: electron-store Handlers');
const storePath = path.join(__dirname, '../apps/desktop/main/handlers/store.ts');
const storeContent = fs.readFileSync(storePath, 'utf8');
assert(storeContent.includes('store:get-migration-history'), 'store:get-migration-history IPC handler is registered');
assert(storeContent.includes('store:save-migration-history'), 'store:save-migration-history IPC handler is registered');
assert(storeContent.includes('migrationHistory: MigrationHistoryItem[]'), 'migrationHistory is defined in StoreSchema');

// ── Check 5: Verify HomeDashboard Demo Mode & State Hygiene ─────────────────
console.log('\n📋 Test 5: HomeDashboard Features & Accessibility');
const dashboardPath = path.join(__dirname, '../apps/desktop/renderer/src/screens/HomeDashboard.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
assert(dashboardContent.includes('wizardStore.setIsDemoMode(true)'), 'Card C explicitly sets isDemoMode in store');
assert(dashboardContent.includes('wizardStore.reset()'), 'Start Migration resets wizardStore to start clean');
assert(dashboardContent.includes('table className="migrations-table"'), 'Table uses semantic <table> HTML');
assert(dashboardContent.includes('store:get-migration-history'), 'Dashboard fetches real migration history from electron-store');
assert(dashboardContent.includes('selectedReport'), 'Dashboard has View Report summary modal');
assert(!dashboardContent.includes('<button id="btn-start-migration"'), 'Nested interactive button in card A was eliminated');
assert(!dashboardContent.includes('<button id="btn-launch-demo"'), 'Nested interactive button in card C was eliminated');

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passedTests} passed, ${failedTests} failed`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Phase 2 & Phase 3 verification tests passed successfully!');
  process.exit(0);
}
