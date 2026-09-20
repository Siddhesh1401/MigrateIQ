import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/sidebar.css';

export interface SidebarProps {}

interface NavItem {
  id: string;
  path: string;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'home',          path: '/',              label: 'Home',              section: 'Main' },
  { id: 'migrate',       path: '/migrate',       label: 'New Migration',     section: 'Main' },
  { id: 'schema-update', path: '/schema-update', label: 'New Schema Update', section: 'Main' },
  { id: 'history',       path: '/history',       label: 'History',           section: 'Data' },
  { id: 'schema-history',path: '/schema-history',label: 'Schema History',    section: 'Data' },
  { id: 'connections',   path: '/connections',   label: 'Connections',       section: 'Data' },
  { id: 'ai-usage',      path: '/ai-usage',      label: 'AI Usage & Tokens', section: 'System' },
  { id: 'settings',      path: '/settings',      label: 'Settings',          section: 'System' },
];


// Map of better Unicode/SVG-like icons for each nav item
const NAV_ICONS: Record<string, string> = {
  home: '🏠',
  migrate: '🔄',
  'schema-update': '✏️',
  history: '📋',
  'schema-history': '📜',
  connections: '🔌',
  'ai-usage': '🤖',
  settings: '⚙️',
};

export const Sidebar: React.FC<SidebarProps> = () => {
  const navigate  = useNavigate();
  const location  = useLocation();

  const isActive = (path: string): boolean => location.pathname === path;

  // Group nav items by section
  const sections = ['Main', 'Data', 'System'];

  return (
    <aside className="sidebar">
      {/* ── Brand Header ── */}
      <div className="sidebar-header">
        <div className="sidebar-logo-mark">M</div>
        <span className="sidebar-brand-name">MigrateIQ</span>
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">
        {sections.map((section) => {
          const items = navItems.filter((i) => i.section === section);
          return (
            <React.Fragment key={section}>
              <div className="sidebar-section-label">{section}</div>
              {items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    className={`sidebar-nav-item ${active ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                    aria-current={active ? 'page' : undefined}
                    title={item.label}
                  >
                    <span className="sidebar-nav-icon">{NAV_ICONS[item.id] ?? '●'}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </nav>

      {/* ── Footer Version ── */}
      <div className="sidebar-footer">
        <div className="sidebar-version-badge">
          <span className="sidebar-version-dot" />
          v1.0.0 — Beta
        </div>
      </div>
    </aside>
  );
};
