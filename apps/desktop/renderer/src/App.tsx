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
  // Support Ctrl + / Ctrl - / Ctrl 0 and Ctrl + Wheel zoom across the entire app
  React.useEffect(() => {
    let currentZoom = 1.0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          currentZoom = Math.min(Math.round((currentZoom + 0.05) * 100) / 100, 1.4);
          document.documentElement.style.zoom = `${currentZoom}`;
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          currentZoom = Math.max(Math.round((currentZoom - 0.05) * 100) / 100, 0.7);
          document.documentElement.style.zoom = `${currentZoom}`;
        } else if (e.key === '0') {
          e.preventDefault();
          currentZoom = 1.0;
          document.documentElement.style.zoom = '1.0';
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          currentZoom = Math.min(Math.round((currentZoom + 0.05) * 100) / 100, 1.4);
        } else {
          currentZoom = Math.max(Math.round((currentZoom - 0.05) * 100) / 100, 0.7);
        }
        document.documentElement.style.zoom = `${currentZoom}`;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

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
