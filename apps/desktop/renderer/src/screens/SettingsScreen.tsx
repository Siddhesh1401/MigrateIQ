import React, { useState, useEffect } from 'react';
import type { AppSettings } from '@migrateiq/shared';

export interface SettingsScreenProps {}

const defaultSettings: AppSettings = {
  aiProvider: 'gemini',
  apiKey: '',
  batchSize: 500,
  lockTimeoutSeconds: 5,
};

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Key testing state
  const [keyTestStatus, setKeyTestStatus] = useState<{ testing: boolean; ok?: boolean; message?: string } | null>(null);

  // Confirmation modals
  const [confirmModal, setConfirmModal] = useState<'connections' | 'history' | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await window.electronAPI.invoke<AppSettings>('store:get-settings');
      if (res.success && res.data) {
        setSettings(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveBanner(null);
    try {
      const res = await window.electronAPI.invoke<AppSettings>('store:save-settings', settings);
      if (res.success && res.data) {
        setSettings(res.data);
        setSaveBanner('Settings saved successfully to local storage.');
        setTimeout(() => setSaveBanner(null), 4000);
      }
    } catch {
      // Ignored
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestKey = async () => {
    setKeyTestStatus({ testing: true });
    try {
      const res = await window.electronAPI.invoke<{ ok: boolean; message: string; model?: string }>('ai:test-key', {
        provider: settings.aiProvider,
        apiKey: settings.apiKey,
      });

      if (res.success && res.data) {
        setKeyTestStatus({ testing: false, ok: true, message: res.data.message });
      } else {
        setKeyTestStatus({ testing: false, ok: false, message: res.error || 'API Key verification failed.' });
      }
    } catch (err) {
      setKeyTestStatus({
        testing: false,
        ok: false,
        message: err instanceof Error ? err.message : 'Error validating key',
      });
    }
  };

  const handleExportSettings = async () => {
    try {
      const res = await window.electronAPI.invoke<{ filePath: string }>('store:export-settings');
      if (res.success && res.data?.filePath) {
        setSaveBanner(`Exported configuration to ${res.data.filePath}`);
        setTimeout(() => setSaveBanner(null), 5000);
      }
    } catch {
      // Ignored
    }
  };

  const handleImportSettings = async () => {
    try {
      const res = await window.electronAPI.invoke<AppSettings>('store:import-settings');
      if (res.success && res.data) {
        setSettings(res.data);
        setSaveBanner('Settings successfully imported!');
        setTimeout(() => setSaveBanner(null), 4000);
      }
    } catch {
      // Ignored
    }
  };

  const handleClearConnections = async () => {
    try {
      await window.electronAPI.invoke('store:clear-all-connections');
      setConfirmModal(null);
      setSaveBanner('All saved database connections have been wiped.');
      setTimeout(() => setSaveBanner(null), 4000);
    } catch {
      // Ignored
    }
  };

  const handleClearHistory = async () => {
    try {
      await Promise.all([
        window.electronAPI.invoke('store:clear-migration-history'),
        window.electronAPI.invoke('store:clear-schema-history'),
      ]);
      setConfirmModal(null);
      setSaveBanner('Migration and schema evolution history cleared.');
      setTimeout(() => setSaveBanner(null), 4000);
    } catch {
      // Ignored
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', color: '#0F172A' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Application Settings &amp; Preferences
          </h1>
          <p style={{ marginTop: '0.375rem', color: '#64748B', fontSize: '0.875rem' }}>
            Configure generative AI providers, ETL chunk concurrency defaults, and credentials security.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSave()}
          disabled={isSaving || isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1.25rem',
            backgroundColor: '#2563EB',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#FFFFFF',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            transition: 'background-color 0.2s',
          }}
        >
          {isSaving ? 'Saving...' : '💾 Save Changes'}
        </button>
      </div>

      {saveBanner && (
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          color: '#1E40AF',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span>✅</span>
          <span>{saveBanner}</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#64748B' }}>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>Loading settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* ── SECTION A: AI Configuration ── */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🧠</span>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Section A — AI Configuration
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Provider selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  AI Engine Provider
                </label>
                <select
                  value={settings.aiProvider}
                  onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value as AppSettings['aiProvider'] })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    outline: 'none',
                  }}
                >
                  <option value="gemini">Google Gemini (Recommended - bleed-edge thinking models)</option>
                  <option value="groq">Groq (Llama 3 - high speed cloud inference)</option>
                  <option value="rules_only">No AI (Use Deterministic Rule Engine Only)</option>
                </select>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                  Select the LLM engine powering schema normalization, type inference, and natural language Copilot chat.
                </p>
              </div>

              {/* API Key */}
              {settings.aiProvider !== 'rules_only' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                    API Key
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.apiKey}
                        placeholder={settings.aiProvider === 'gemini' ? 'AIzaSy...' : 'gsk_...'}
                        onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.55rem 2.5rem 0.55rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.875rem',
                          fontFamily: showApiKey ? 'monospace' : 'inherit',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          fontSize: '0.85rem',
                          color: '#64748B',
                          cursor: 'pointer',
                        }}
                      >
                        {showApiKey ? '🙈' : '👁️'}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={keyTestStatus?.testing}
                      onClick={handleTestKey}
                      style={{
                        padding: '0.55rem 1rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#2563EB',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {keyTestStatus?.testing ? 'Testing...' : '⚡ Test API Key'}
                    </button>
                  </div>

                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    Get a free API key from Google AI Studio at{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563EB', textDecoration: 'underline' }}
                    >
                      aistudio.google.com
                    </a>
                    . The free tier is sufficient for MigrateIQ.
                  </p>

                  {keyTestStatus && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: keyTestStatus.testing ? '#F1F5F9' : keyTestStatus.ok ? '#F0FDF4' : '#FEF2F2',
                      color: keyTestStatus.testing ? '#475569' : keyTestStatus.ok ? '#16A34A' : '#DC2626',
                    }}>
                      {keyTestStatus.testing ? '⏳ Contacting AI provider endpoint...' : keyTestStatus.ok ? `✅ ${keyTestStatus.message}` : `❌ ${keyTestStatus.message}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION B: Migration Defaults ── */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚙️</span>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Section B — Migration Defaults
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Default Batch Size (Rows per chunk)
                </label>
                <input
                  type="number"
                  min={50}
                  max={10000}
                  step={50}
                  value={settings.batchSize}
                  onChange={(e) => setSettings({ ...settings, batchSize: Math.max(50, Number(e.target.value)) })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                  How many rows to process at a time. Increase for faster migrations on powerful machines (default: 500).
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  DDL Lock Timeout (Seconds)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={settings.lockTimeoutSeconds}
                  onChange={(e) => setSettings({ ...settings, lockTimeoutSeconds: Math.max(1, Number(e.target.value)) })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                  How long to wait for an exclusive database table lock before aborting to protect production workloads (default: 5s).
                </p>
              </div>
            </div>
          </div>

          {/* ── SECTION C: Data & Privacy ── */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🛡️</span>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Section C — Data &amp; Privacy
              </h2>
            </div>

            {/* Challenge 11 Security Warning Box */}
            <div style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              gap: '0.75rem',
            }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <div style={{ fontSize: '0.8125rem', color: '#92400E', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#B45309' }}>
                  Challenge 11 Security Notice
                </strong>
                Saved credentials are stored locally and unencrypted. Do not save production credentials on a shared PC.
              </div>
            </div>

            {/* Export & Import JSON */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={handleExportSettings}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#334155',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                📤 Export Settings JSON
              </button>
              <button
                type="button"
                onClick={handleImportSettings}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#334155',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                📥 Import Settings JSON
              </button>
            </div>

            {/* Danger Zone */}
            <div style={{
              borderTop: '1px solid #FEE2E2',
              paddingTop: '1.25rem',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Danger Zone
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setConfirmModal('connections')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#DC2626',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Clear All Saved Connections
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmModal('history')}
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#DC2626',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Clear Migration &amp; Schema History
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── Confirm Deletion Modal ── */}
      {confirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              maxWidth: '420px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 800, color: '#DC2626' }}>
              {confirmModal === 'connections' ? 'Clear All Saved Connections?' : 'Clear Migration & Schema History?'}
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: '#64748B' }}>
              {confirmModal === 'connections'
                ? 'This will erase all saved database profiles from local storage. You will need to re-enter credentials manually.'
                : 'This will permanently delete all past migration records and schema change history. This action cannot be undone.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.8125rem',
                  color: '#475569',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal === 'connections' ? handleClearConnections : handleClearHistory}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: '#DC2626',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Confirm Erase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
