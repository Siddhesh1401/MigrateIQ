import React, { useState } from 'react';
import { useWizardStore } from '../store/wizardStore';
import { useNavigate } from 'react-router-dom';

export interface RescueCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RescueCenterModal: React.FC<RescueCenterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const wizardStore = useWizardStore();
  const navigate = useNavigate();

  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleWipeTarget = async () => {
    if (!window.confirm('Are you sure you want to drop all target PostgreSQL tables created in this session? This action cannot be undone.')) {
      return;
    }
    setIsProcessing(true);
    setFeedbackMessage(null);
    setErrorMessage(null);
    try {
      const res = await window.electronAPI.invoke<{ success: boolean; message: string; droppedTables?: string[] }>(
        'verification:rescue-action',
        {
          action: 'wipe_target',
          targetConfig: wizardStore.targetConfig || undefined,
        }
      );
      if (res.success && res.data) {
        setFeedbackMessage(`✓ ${res.data.message}`);
      } else {
        setErrorMessage(res.error || 'Failed to wipe target database.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportTakeaway = async () => {
    setIsProcessing(true);
    setFeedbackMessage(null);
    setErrorMessage(null);
    try {
      const res = await window.electronAPI.invoke<{ success: boolean; message: string; filePath?: string }>(
        'verification:rescue-action',
        {
          action: 'export_takeaway',
        }
      );
      if (res.success && res.data) {
        setFeedbackMessage(`✓ Takeaway kit saved: ${res.data.filePath || 'Downloads'}`);
      } else {
        if (res.error !== 'Export cancelled by user') {
          setErrorMessage(res.error || 'Export failed.');
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportDiagnostics = async () => {
    setIsProcessing(true);
    setFeedbackMessage(null);
    setErrorMessage(null);
    try {
      const res = await window.electronAPI.invoke<{ success: boolean; message: string; filePath?: string }>(
        'verification:rescue-action',
        {
          action: 'export_diagnostics',
        }
      );
      if (res.success && res.data) {
        setFeedbackMessage(`✓ Diagnostics bundle saved: ${res.data.filePath || 'Desktop'}`);
      } else {
        if (res.error !== 'Export cancelled by user') {
          setErrorMessage(res.error || 'Diagnostics export failed.');
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceReset = () => {
    if (window.confirm('Force reset migration session and return to dashboard?')) {
      wizardStore.reset();
      onClose();
      navigate('/');
    }
  };

  return (
    <div className="rescue-modal-overlay" onClick={onClose}>
      <div className="rescue-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="rescue-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🆘</span>
            <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#0F172A' }}>
              MigrateIQ Emergency &amp; Rescue Center
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: '#64748B',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div className="rescue-modal-body">
          {/* Safety Reassurance Banner */}
          <div style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '8px',
            padding: '1rem',
            color: '#15803D',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}>
            <strong>🛡️ Source Immutability Guarantee:</strong>
            <p style={{ margin: '0.25rem 0 0 0' }}>
              Your source MongoDB database was connected in strictly <strong>READ-ONLY</strong> mode. Zero documents, indexes, or collections were modified or deleted. Your production source data is 100% safe and untouched.
            </p>
          </div>

          {feedbackMessage && (
            <div style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '6px',
              padding: '0.75rem',
              color: '#1E40AF',
              fontSize: '0.8125rem',
            }}>
              {feedbackMessage}
            </div>
          )}

          {errorMessage && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              padding: '0.75rem',
              color: '#DC2626',
              fontSize: '0.8125rem',
            }}>
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          {/* Option 1: 1-Click Clean Slate Rollback */}
          <div className="rescue-option-row">
            <div className="rescue-option-info">
              <h4>1. 1-Click Clean Slate (Target Rollback)</h4>
              <p>Purges partially migrated tables from PostgreSQL (<code style={{ background: '#F1F5F9', padding: '0.1rem 0.2rem' }}>DROP TABLE CASCADE</code>) so your target database is left completely spotless.</p>
            </div>
            <button
              type="button"
              className="btn-verify-secondary"
              onClick={handleWipeTarget}
              disabled={isProcessing}
              style={{ color: '#DC2626', borderColor: '#FECACA', whiteSpace: 'nowrap' }}
            >
              🗑️ Reset Target
            </button>
          </div>

          {/* Option 2: Offline Takeaway Kit */}
          <div className="rescue-option-row">
            <div className="rescue-option-info">
              <h4>2. Offline Standalone Takeaway Kit (.zip)</h4>
              <p>Generates an offline migration bundle (<code style={{ background: '#F1F5F9', padding: '0.1rem 0.2rem' }}>schema.sql</code>, import shell scripts) allowing your software team to finish without MigrateIQ.</p>
            </div>
            <button
              type="button"
              className="btn-verify-secondary"
              onClick={handleExportTakeaway}
              disabled={isProcessing}
              style={{ whiteSpace: 'nowrap' }}
            >
              📦 Export Takeaway
            </button>
          </div>

          {/* Option 3: Blackbox Diagnostics Bundle */}
          <div className="rescue-option-row">
            <div className="rescue-option-info">
              <h4>3. Blackbox Diagnostics Bundle (.zip)</h4>
              <p>Bundles masked logs (passwords hidden as ••••••••), error stack traces, and verification snapshots for support.</p>
            </div>
            <button
              type="button"
              className="btn-verify-secondary"
              onClick={handleExportDiagnostics}
              disabled={isProcessing}
              style={{ whiteSpace: 'nowrap' }}
            >
              📁 Diagnostic ZIP
            </button>
          </div>

          {/* Option 4: Session Hard-Reset */}
          <div className="rescue-option-row">
            <div className="rescue-option-info">
              <h4>4. Session Hard-Reset</h4>
              <p>Cleans the local state in memory and returns safely to the Home Dashboard.</p>
            </div>
            <button
              type="button"
              className="btn-verify-secondary"
              onClick={handleForceReset}
              disabled={isProcessing}
              style={{ whiteSpace: 'nowrap' }}
            >
              🔄 Reset to Home
            </button>
          </div>
        </div>

        <div className="rescue-modal-footer">
          <button
            type="button"
            className="btn-verify-secondary"
            onClick={onClose}
          >
            Close Rescue Center
          </button>
        </div>
      </div>
    </div>
  );
};
