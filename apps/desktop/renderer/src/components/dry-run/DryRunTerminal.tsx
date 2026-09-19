import React, { useRef, useEffect } from 'react';

export interface LogEntry {
  id: string;
  time: string;
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
}

export interface DryRunTerminalProps {
  logs: LogEntry[];
  schemaMappingCount: number;
  terminalBodyRef?: React.RefObject<HTMLDivElement>;
  height?: string;
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
}

export const DryRunTerminal: React.FC<DryRunTerminalProps> = ({
  logs,
  schemaMappingCount,
  terminalBodyRef,
  height,
  title = 'PostgreSQL Transaction Sandbox',
  subtitle = 'SIMULATION IN PROGRESS',
  showProgress = true,
}) => {
  const localRef = useRef<HTMLDivElement>(null);
  const activeRef = terminalBodyRef || localRef;

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollTop = activeRef.current.scrollHeight;
    }
  }, [logs, activeRef]);

  const calculatedPercent = Math.min(
    95,
    Math.max(15, Math.round((logs.length / Math.max(1, schemaMappingCount * 3 + 2)) * 100))
  );

  return (
    <div className="dry-run-terminal-container">
      <div className="dry-run-terminal-header">
        <div className="dry-run-terminal-dots">
          <div className="dry-run-dot red" />
          <div className="dry-run-dot yellow" />
          <div className="dry-run-dot green" />
        </div>
        <div className="dry-run-terminal-status">
          {showProgress && <div className="dry-run-pulse-indicator" />}
          <span>{subtitle}</span>
        </div>
        <span>{title}</span>
      </div>

      {showProgress && (
        <div className="dry-run-terminal-progress-bar">
          <div className="dry-run-terminal-track">
            <div
              className="dry-run-terminal-fill"
              style={{ width: `${calculatedPercent}%` }}
            />
          </div>
          <span className="dry-run-terminal-progress-text">
            {calculatedPercent}% • Validating {schemaMappingCount} tables
          </span>
        </div>
      )}

      <div
        className="dry-run-terminal-body"
        ref={activeRef}
        style={height ? { height } : undefined}
      >
        {logs.map((log) => (
          <div key={log.id} className="dry-run-log-line">
            <span className="dry-run-log-time">[{log.time}]</span>
            <span className={`dry-run-log-content ${log.status}`}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
