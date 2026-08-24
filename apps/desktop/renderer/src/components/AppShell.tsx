import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export interface AppShellProps {}

export const AppShell: React.FC<AppShellProps> = () => {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-canvas)'
    }}>
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        height: '100vh',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-canvas)'
      }}>
        <Outlet />
      </main>
    </div>
  );
};
