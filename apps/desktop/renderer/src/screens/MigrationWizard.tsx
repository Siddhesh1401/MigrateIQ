import React from 'react';

export interface MigrationWizardProps {}

export const MigrationWizard: React.FC<MigrationWizardProps> = () => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ 
        fontSize: '1.875rem', 
        fontWeight: 800, 
        color: 'var(--text-primary)',
        margin: 0
      }}>
        Migration Wizard
      </h1>
      <p style={{ 
        marginTop: '0.5rem', 
        color: 'var(--text-muted)',
        fontSize: '0.9375rem'
      }}>
        8-step migration wizard will be built in future phases
      </p>
    </div>
  );
};
