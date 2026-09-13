import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HomeDashboard } from './screens/HomeDashboard';
import { MigrationWizard } from './screens/MigrationWizard';
import { SchemaUpdateWizard } from './screens/SchemaUpdateWizard';
import { HistoryScreen } from './screens/HistoryScreen';
import { SchemaHistoryScreen } from './screens/SchemaHistoryScreen';
import { ConnectionsScreen } from './screens/ConnectionsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AIUsageScreen } from './screens/AIUsageScreen';

export interface AppProps {}

export const App: React.FC<AppProps> = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomeDashboard />} />
          <Route path="migrate" element={<MigrationWizard />} />
          <Route path="schema-update" element={<SchemaUpdateWizard />} />
          <Route path="history" element={<HistoryScreen />} />
          <Route path="schema-history" element={<SchemaHistoryScreen />} />
          <Route path="connections" element={<ConnectionsScreen />} />
          <Route path="ai-usage" element={<AIUsageScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
