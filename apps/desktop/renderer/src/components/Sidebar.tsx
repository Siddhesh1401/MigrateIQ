import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface SidebarProps {}

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'home', path: '/', label: 'Home', icon: '🏠' },
  { id: 'migrate', path: '/migrate', label: 'New Migration', icon: '🔄' },
  { id: 'schema-update', path: '/schema-update', label: 'New Schema Update', icon: '✏️' },
  { id: 'history', path: '/history', label: 'History', icon: '📋' },
  { id: 'schema-history', path: '/schema-history', label: 'Schema History', icon: '📜' },
  { id: 'connections', path: '/connections', label: 'Connections', icon: '🔌' },
  { id: 'settings', path: '/settings', label: 'Settings', icon: '⚙️' },
];

export const Sidebar: React.FC<SidebarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string): boolean => {
    return location.pathname === path;
  };

  return (
    <aside style={{
      width: '240px',
      height: '100vh',
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 0'
    }}>
      {/* Logo Section */}
      <div style={{
        padding: '0 1.25rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'var(--brand-primary)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem'
          }}>
            M
          </div>
          <span style={{ 
            fontWeight: 700, 
            fontSize: '1.125rem', 
            color: 'var(--text-primary)'
          }}>
            MigrateIQ
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.25rem',
                margin: '0 0.5rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: active ? 'var(--brand-primary)' : 'transparent',
                color: active ? '#FFFFFF' : 'var(--text-primary)',
                fontSize: '0.9375rem',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 200ms ease',
                textAlign: 'left',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Version Badge at Bottom */}
      <div style={{
        padding: '0 1.25rem',
        marginTop: 'auto'
      }}>
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '0.5rem',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)'
        }}>
          v1.0.0
        </div>
      </div>
    </aside>
  );
};
