import React from 'react';

export interface HomeDashboardProps {}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ 
        fontSize: '1.875rem', 
        fontWeight: 800, 
        color: 'var(--text-primary)',
        margin: 0
      }}>
        Home Dashboard
      </h1>
      <p style={{ 
        marginTop: '0.5rem', 
        color: 'var(--text-muted)',
        fontSize: '0.9375rem'
      }}>
        This screen will be built in Phase 3
      </p>
    </div>
  );
};
