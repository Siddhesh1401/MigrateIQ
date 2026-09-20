import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from './ErrorBoundary';

export interface AppShellProps {}

export const AppShell: React.FC<AppShellProps> = () => {
  return (
    <div className="app-shell-container">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area protected by Error Boundary */}
      <main className="app-shell-main" role="main">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

