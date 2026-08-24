import React from 'react';

export interface ConnectionsScreenProps {}

export const ConnectionsScreen: React.FC<ConnectionsScreenProps> = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ 
        fontSize: '1.875rem', 
        fontWeight: 800, 
        color: 'var(--text-primary)',
        margin: 0
      }}>
        Saved Connections
      </h1>
      <p style={{ 
        marginTop: '0.5rem', 
        color: 'var(--text-muted)',
        fontSize: '0.9375rem'
      }}>
        Saved database connections manager will be built in Phase 14
      </p>
    </div>
  );
};
