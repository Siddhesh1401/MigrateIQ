import React from 'react';

export interface StepProgressBarProps {
  currentStep: number;
  totalSteps?: number;
  onStepClick?: (step: number) => void;
}

const STEP_LABELS = ['Direction', 'Source DB', 'Target DB', 'Map Schema', 'Risk', 'Dry Run', 'Migrate', 'Complete'];

export const StepProgressBar: React.FC<StepProgressBarProps> = ({ currentStep, totalSteps = 8, onStepClick }) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="wizard-progress-bar">
      {steps.map((step) => {
        const isDone   = step < currentStep;
        const isActive = step === currentStep;
        const isClickable = isDone && Boolean(onStepClick);

        return (
          <React.Fragment key={step}>
            <div
              className={`step-item ${isClickable ? 'clickable' : ''}`}
              onClick={() => {
                if (isClickable && onStepClick) {
                  onStepClick(step);
                }
              }}
              style={{ cursor: isClickable ? 'pointer' : 'default' }}
              title={isClickable ? `Jump back to Step ${step}: ${STEP_LABELS[step - 1]}` : undefined}
            >
              <div className={`step-circle ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                {isDone ? '✓' : step}
              </div>
              <span className={`step-label ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                {STEP_LABELS[step - 1] ?? `Step ${step}`}
              </span>
            </div>

            {step < totalSteps && (
              <div className={`step-connector ${isDone ? 'completed' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
