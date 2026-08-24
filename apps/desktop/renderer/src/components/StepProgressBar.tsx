import React from 'react';

export interface StepProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

export const StepProgressBar: React.FC<StepProgressBarProps> = ({ currentStep, totalSteps = 8 }) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '1.5rem',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <React.Fragment key={step}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: 600,
              backgroundColor: step === currentStep ? 'var(--brand-primary)' : 'var(--bg-sidebar)',
              color: step === currentStep ? '#FFFFFF' : 'var(--text-muted)',
              border: `2px solid ${step === currentStep ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
              transition: 'all 200ms ease',
            }}
          >
            {step}
          </div>
          {step < totalSteps && (
            <div
              style={{
                height: '2px',
                flex: 1,
                backgroundColor: step < currentStep ? 'var(--brand-primary)' : 'var(--border-subtle)',
                transition: 'background-color 200ms ease',
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
