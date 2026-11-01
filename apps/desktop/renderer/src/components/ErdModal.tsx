/**
 * MigrateIQ - Fullscreen Entity Relationship Diagram (ERD) Modal (Phase 10)
 * 
 * Provides an interactive, resizable fullscreen modal for viewing, zooming,
 * and navigating large database schemas and exporting high-resolution diagrams.
 */

import React, { useState } from 'react';

export interface ErdModalProps {
  isOpen: boolean;
  onClose: () => void;
  svgHtml: string;
  onDownloadPng: () => void;
  isDownloadingPng?: boolean;
}

export const ErdModal: React.FC<ErdModalProps> = ({
  isOpen,
  onClose,
  svgHtml,
  onDownloadPng,
  isDownloadingPng = false
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(3, prev + 0.25));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.4, prev - 0.25));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div className="erd-modal-overlay" onClick={onClose}>
      <div className="erd-modal-window" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="erd-modal-header">
          <div className="erd-modal-title">
            <span>🗺️</span>
            <span>Target PostgreSQL Entity Relationship Diagram (ERD)</span>
          </div>

          <div className="erd-modal-controls">
            <button
              type="button"
              className="btn-secondary-white"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <span>➖</span>
            </button>

            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569', minWidth: 50, textAlign: 'center' }}>
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              type="button"
              className="btn-secondary-white"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <span>➕</span>
            </button>

            <button
              type="button"
              className="btn-secondary-white"
              onClick={handleResetZoom}
              title="Reset Zoom"
            >
              <span>🔄 Reset</span>
            </button>

            <button
              type="button"
              className="btn-primary-blue"
              onClick={onDownloadPng}
              disabled={isDownloadingPng}
            >
              <span>🗺️</span>
              <span>{isDownloadingPng ? 'Exporting...' : 'Download ERD (.png)'}</span>
            </button>

            <button
              type="button"
              className="btn-secondary-white"
              onClick={onClose}
              style={{ marginLeft: '0.5rem', fontWeight: 700 }}
              title="Close Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="erd-modal-canvas-wrap">
          <div
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease'
            }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        </div>
      </div>
    </div>
  );
};

