import React from 'react';
import {
  LayoutDashboard,
  Terminal,
  FolderTree,
  Activity,
  Server,
  Zap,
  HardDrive,
  Wifi,
  ListOrdered,
  FileText,
  Box,
  Sliders,
  FileCheck,
  Settings,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  online: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, online }) => {
  const sections = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'COMPUTE & ACCELERATOR',
      items: [
        { id: 'ai', label: 'AI LLM Cluster', icon: Sparkles, badge: 'Hermes 3', highlight: true },
        { id: 'terminal', label: 'Interactive Shell', icon: Terminal, badge: 'PTY' },
        { id: 'gpu', label: 'GPU Center', icon: Zap, badge: 'Blackwell', highlight: true },
        { id: 'processes', label: 'Processes', icon: Activity },
        { id: 'services', label: 'Services', icon: Server }
      ]
    },
    {
      title: 'FILES & STORAGE',
      items: [
        { id: 'files', label: 'Pod Filesystem', icon: FolderTree },
        { id: 'storage', label: 'Disks & Volumes', icon: HardDrive }
      ]
    },
    {
      title: 'NETWORK & ENGINE',
      items: [
        { id: 'network', label: 'Network & Diagnostics', icon: Wifi },
        { id: 'containers', label: 'Containers', icon: Box },
        { id: 'jobs', label: 'Job Queue', icon: ListOrdered }
      ]
    },
    {
      title: 'MANAGEMENT & AUDIT',
      items: [
        { id: 'system', label: 'System Control', icon: Sliders },
        { id: 'logs', label: 'System Logs', icon: FileText },
        { id: 'audit', label: 'Audit Trail', icon: FileCheck },
        { id: 'settings', label: 'Settings', icon: Settings }
      ]
    }
  ];

  return (
    <aside style={{
      width: '240px',
      backgroundColor: '#090e1a',
      borderRight: '1px solid #1a273f',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none'
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid #1a273f',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.05) 0%, transparent 100%)'
      }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)'
        }}>
          <Zap size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em', color: '#f8fafc' }}>
            Cloud PC
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>
            CONTROL PLANE
          </div>
        </div>
      </div>

      {/* Nav Groups */}
      <nav style={{ padding: '0.75rem 0.65rem', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {sections.map((sec, secIdx) => (
            <div key={secIdx}>
              <div style={{
                fontSize: '0.65rem',
                color: '#475569',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '0 0.75rem 0.4rem',
                textTransform: 'uppercase'
              }}>
                {sec.title}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.7rem',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.825rem',
                        fontWeight: active ? 600 : 500,
                        backgroundColor: active
                          ? 'rgba(56, 189, 248, 0.12)'
                          : 'transparent',
                        color: active
                          ? '#38bdf8'
                          : '#94a3b8',
                        borderLeft: active ? '3px solid #38bdf8' : '3px solid transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.color = '#e2e8f0';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#94a3b8';
                        }
                      }}
                    >
                      <Icon size={16} color={active ? '#38bdf8' : item.highlight ? '#76b900' : '#64748b'} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          fontSize: '0.625rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor: item.highlight ? 'rgba(118, 185, 0, 0.15)' : '#162238',
                          color: item.highlight ? '#84cc16' : '#94a3b8',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer Connection Pill */}
      <div style={{
        padding: '0.85rem 1rem',
        borderTop: '1px solid #1a273f',
        fontSize: '0.75rem',
        color: '#64748b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#070b14'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className={`pulse-dot ${online ? 'pulse-dot-online' : ''}`} style={{ backgroundColor: online ? '#10b981' : '#f43f5e' }} />
          <span style={{ color: online ? '#34d399' : '#fb7185', fontWeight: 600 }}>
            {online ? 'MoLab Online' : 'Pod Offline'}
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>v1.2.0</span>
      </div>
    </aside>
  );
};
