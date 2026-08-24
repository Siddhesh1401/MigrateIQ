import React from 'react';

export interface SettingsScreenProps {}

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ 
        fontSize: '1.875rem', 
        fontWeight: 800, 
        color: 'var(--text-primary)',
        margin: 0
      }}>
        Settings
      </h1>
      <p style={{ 
        marginTop: '0.5rem', 
        color: 'var(--text-muted)',
        fontSize: '0.9375rem'
      }}>
        AI configuration and app preferences will be built in Phase 14
      </p>
    </div>
  );
};
