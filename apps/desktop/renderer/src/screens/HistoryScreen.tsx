import React from 'react';

export interface HistoryScreenProps {}

export const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ 
        fontSize: '1.875rem', 
        fontWeight: 800, 
        color: 'var(--text-primary)',
        margin: 0
      }}>
        History
      </h1>
      <p style={{ 
        marginTop: '0.5rem', 
        color: 'var(--text-muted)',
        fontSize: '0.9375rem'
      }}>
        Past migrations and schema updates log will be built in Phase 14
      </p>
    </div>
  );
};
