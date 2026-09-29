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
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  if (!isOpen) return null;

  const handleOpenWipeModal = () => {
    setWipeConfirmText('');
    setFeedbackMessage(null);
    setErrorMessage(null);
    setShowWipeModal(true);
  };

  const handleExecuteWipeTarget = async () => {
    if (wipeConfirmText.trim().toUpperCase() !== 'WIPE') return;
    setIsProcessing(true);
    setFeedbackMessage(null);
    setErrorMessage(null);
    setShowWipeModal(false);
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
          targetConfig: wizardStore.targetConfig || undefined,
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
              onClick={handleOpenWipeModal}
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

        {/* ── Typed WIPE Enterprise Safety Modal ── */}
        {showWipeModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem',
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #FECACA',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <h3 style={{ margin: 0, color: '#991B1B', fontSize: '1.125rem' }}>
                  Confirm Destructive Target Database Wipe
                </h3>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                This action will execute <code style={{ backgroundColor: '#F1F5F9', padding: '0.1rem 0.3rem', color: '#DC2626' }}>DROP TABLE ... CASCADE</code> on all tables in target database:
              </p>

              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#991B1B',
                textAlign: 'center',
              }}>
                Target Database: {wizardStore.targetConfig?.database || 'PostgreSQL Target'}
              </div>

              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0 0 0.5rem 0' }}>
                To prevent accidental destruction, please type <strong>WIPE</strong> in the box below:
              </p>

              <input
                type="text"
                placeholder="Type WIPE to confirm"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  marginBottom: '1.25rem',
                  outline: 'none',
                }}
                autoFocus
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-verify-secondary"
                  onClick={() => setShowWipeModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteWipeTarget}
                  disabled={wipeConfirmText.trim().toUpperCase() !== 'WIPE' || isProcessing}
                  style={{
                    backgroundColor: wipeConfirmText.trim().toUpperCase() === 'WIPE' ? '#DC2626' : '#FCA5A5',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.6rem 1.25rem',
                    fontWeight: 700,
                    cursor: wipeConfirmText.trim().toUpperCase() === 'WIPE' ? 'pointer' : 'not-allowed',
                    fontSize: '0.875rem',
                  }}
                >
                  {isProcessing ? '⏳ Wiping Target…' : '🗑️ Drop All Tables (CASCADE)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
