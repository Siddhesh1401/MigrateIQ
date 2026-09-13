import React, { useState, useEffect } from 'react';
import type { AIUsageLogEntry, AIUsageStats } from '@migrateiq/shared';
import '../styles/ai-usage.css';

export interface AIUsageScreenProps {}

export const AIUsageScreen: React.FC<AIUsageScreenProps> = () => {
  const [stats, setStats] = useState<AIUsageStats>({
    requestsToday: 0,
    dailyLimit: 1500,
    tokensToday: 0,
    lifetimeRequests: 0,
    lifetimeTokens: 0,
    lastUsedTimestamp: null,
  });
  const [logs, setLogs] = useState<AIUsageLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchUsageData = async () => {
    setIsLoading(true);
    try {
      const statsRes = await window.electronAPI.invoke<AIUsageStats>('ai:get-usage-stats');
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }

      const logsRes = await window.electronAPI.invoke<AIUsageLogEntry[]>('ai:get-usage-logs');
      if (logsRes.success && logsRes.data) {
        setLogs(logsRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch AI usage data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, []);

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear your AI activity logs? Daily and lifetime token counters will be preserved.')) {
      await window.electronAPI.invoke('ai:clear-usage-logs');
      fetchUsageData();
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = selectedFilter === 'all' || log.feature.toLowerCase().includes(selectedFilter.toLowerCase());
    const matchesSearch =
      searchQuery.trim() === '' ||
      log.promptSnippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.model.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const dailyPercent = Math.min(100, Math.round((stats.requestsToday / stats.dailyLimit) * 100));

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  const formatDate = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="ai-usage-page">
      {/* ── Page Header ── */}
      <div className="ai-usage-header">
        <div>
          <div className="header-title-wrap">
            <h1 className="ai-usage-title">AI Token &amp; Usage Monitor</h1>
            <span className="live-pill">● Live Tracking</span>
          </div>
          <p className="ai-usage-subtitle">
            Real-time telemetry and quota guard for Google Gemini across all schema mapping, data quality, and copilot operations.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-refresh"
            onClick={fetchUsageData}
            disabled={isLoading}
            title="Refresh usage statistics"
          >
            {isLoading ? '⏳ Refreshing...' : '🔄 Refresh Stats'}
          </button>
          {logs.length > 0 && (
            <button
              type="button"
              className="btn-clear-logs"
              onClick={handleClearLogs}
              title="Clear activity log history"
            >
              🗑️ Clear History
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="metrics-grid">
        {/* Card 1: Daily Requests */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Daily Free-Tier Requests</span>
            <span className="metric-tag quota-tag">1,500 RPD Limit</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{stats.requestsToday}</span>
            <span className="metric-denom">/ {stats.dailyLimit} calls</span>
          </div>
          <div className="quota-bar-container">
            <div
              className={`quota-bar-fill ${dailyPercent > 80 ? 'critical' : dailyPercent > 50 ? 'warning' : 'safe'}`}
              style={{ width: `${Math.max(dailyPercent, 2)}%` }}
            />
          </div>
          <div className="metric-footer">
            <span className="subtext">
              {stats.dailyLimit - stats.requestsToday} free requests remaining today ({dailyPercent}% used)
            </span>
          </div>
        </div>

        {/* Card 2: Tokens Consumed */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Tokens Consumed</span>
            <span className="metric-tag info-tag">1M TPM Limit</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">~{stats.tokensToday.toLocaleString()}</span>
            <span className="metric-denom">tokens today</span>
          </div>
          <div className="metric-footer" style={{ marginTop: '1rem' }}>
            <span className="subtext">
              Lifetime Total: <strong>~{stats.lifetimeTokens.toLocaleString()}</strong> tokens across {stats.lifetimeRequests} requests
            </span>
          </div>
        </div>

        {/* Card 3: Rate Limit Status */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Rate Limit Health</span>
            <span className="metric-tag status-tag">15 RPM Cap</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value status-good">🟢 Healthy</span>
          </div>
          <div className="metric-footer" style={{ marginTop: '1rem' }}>
            <span className="subtext">
              Throttling protection active. Auto-switches to Rule Engine if throttled.
            </span>
          </div>
        </div>

        {/* Card 4: Cost */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Current Billing</span>
            <span className="metric-tag cost-tag">Free Tier</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">$0.00</span>
            <span className="metric-denom">USD</span>
          </div>
          <div className="metric-footer" style={{ marginTop: '1rem' }}>
            <span className="subtext">
              Google AI Studio Free Tier is active. Zero charges incurred.
            </span>
          </div>
        </div>
      </div>

      {/* ── Activity Log Section ── */}
      <div className="log-section-card">
        <div className="log-section-header">
          <div className="section-title-group">
            <h2 className="section-title">AI Request Activity Log</h2>
            <span className="log-count-badge">{filteredLogs.length} events</span>
          </div>

          <div className="log-filters-wrap">
            <input
              type="text"
              placeholder="Search instructions or prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="log-search-input"
            />
            <div className="filter-chip-group">
              <button
                type="button"
                className={`filter-chip ${selectedFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('all')}
              >
                All Operations
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedFilter === 'copilot' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('copilot')}
              >
                Copilot Tweaks
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedFilter === 'schema' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('schema')}
              >
                Schema Inference
              </button>
              <button
                type="button"
                className={`filter-chip ${selectedFilter === 'health' ? 'active' : ''}`}
                onClick={() => setSelectedFilter('health')}
              >
                Health Score
              </button>
            </div>
          </div>
        </div>

        {/* Table / Empty State */}
        {filteredLogs.length === 0 ? (
          <div className="empty-log-state">
            <span className="empty-icon">🤖</span>
            <h3>No AI Operations Found</h3>
            <p>
              {searchQuery || selectedFilter !== 'all'
                ? 'No activity logs match your filter criteria.'
                : 'No AI operations have been performed yet today. When you connect databases or instruct the AI Copilot, live token metrics will be saved here automatically!'}
            </p>
          </div>
        ) : (
          <div className="log-table-wrap">
            <table className="ai-log-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Time</th>
                  <th style={{ width: '150px' }}>Feature</th>
                  <th>Operation / Prompt Instruction</th>
                  <th style={{ width: '130px' }}>Model</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Tokens</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="time-cell">
                      <strong>{formatTime(log.timestamp)}</strong>
                      <span className="date-sub">{formatDate(log.timestamp)}</span>
                    </td>
                    <td>
                      <span className={`feature-pill feature-${log.feature.toLowerCase().replace(/[^a-z]/g, '')}`}>
                        {log.feature === 'Copilot Tweak' && '✨ '}
                        {log.feature === 'Database Q&A' && '💡 '}
                        {log.feature === 'Schema Inference' && '🧬 '}
                        {log.feature === 'Health Score' && '📊 '}
                        {log.feature}
                      </span>
                    </td>
                    <td className="prompt-cell">
                      <code>{log.promptSnippet}</code>
                    </td>
                    <td className="model-cell">
                      <span className="model-badge">{log.model}</span>
                    </td>
                    <td className="tokens-cell" style={{ textAlign: 'right' }}>
                      {log.status === 'cached' || log.status === 'fallback' ? (
                        <span className="zero-token-tag">0 (Free)</span>
                      ) : (
                        <div>
                          <strong>{log.totalTokens.toLocaleString()}</strong>
                          <span className="tokens-detail">
                            in: {log.promptTokens} · out: {log.responseTokens}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-badge status-${log.status}`}>
                        {log.status === 'success' && '✓ Success'}
                        {log.status === 'cached' && '⚡ Cached'}
                        {log.status === 'fallback' && '🔄 Rule'}
                        {log.status === 'rate-limited' && '⚠️ Rate Limit'}
                        {log.status === 'error' && '✕ Error'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
