import React, { useState, useEffect } from 'react';
import {
  Search,
  Terminal,
  Zap,
  FolderTree,
  Activity,
  Server,
  HardDrive,
  Wifi,
  FileText,
  Sliders,
  FileCheck,
  Play,
  LogOut,
  X,
  Sparkles
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onTriggerAction: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onTriggerAction,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    { id: 'dashboard', title: 'Open Dashboard', category: 'Navigation', icon: Sliders, action: () => onNavigate('dashboard') },
    { id: 'ai', title: 'Open AI LLM Cluster (Hermes 3 Frontier AI)', category: 'Navigation', icon: Sparkles, action: () => onNavigate('ai') },
    { id: 'terminal', title: 'Open Terminal (PTY)', category: 'Navigation', icon: Terminal, action: () => onNavigate('terminal') },
    { id: 'gpu', title: 'Show GPU Center (RTX PRO 6000 Blackwell)', category: 'Navigation', icon: Zap, action: () => onNavigate('gpu') },
    { id: 'files', title: 'Browse Files (/workspace)', category: 'Navigation', icon: FolderTree, action: () => onNavigate('files') },
    { id: 'processes', title: 'Inspect Processes', category: 'Navigation', icon: Activity, action: () => onNavigate('processes') },
    { id: 'services', title: 'Manage Services', category: 'Navigation', icon: Server, action: () => onNavigate('services') },
    { id: 'storage', title: 'Storage & Disk Analyzer', category: 'Navigation', icon: HardDrive, action: () => onNavigate('storage') },
    { id: 'network', title: 'Network Diagnostics', category: 'Navigation', icon: Wifi, action: () => onNavigate('network') },
    { id: 'logs', title: 'Live Log Stream', category: 'Navigation', icon: FileText, action: () => onNavigate('logs') },
    { id: 'audit', title: 'Security Audit Log', category: 'Navigation', icon: FileCheck, action: () => onNavigate('audit') },
    { id: 'benchmark', title: 'Run PyTorch CUDA Benchmark', category: 'Action', icon: Play, action: () => onTriggerAction('run_benchmark') },
    { id: 'clear_tmp', title: 'Clear /tmp temporary files', category: 'Action', icon: Sliders, action: () => onTriggerAction('clear_tmp') },
    { id: 'logout', title: 'Sign Out', category: 'Account', icon: LogOut, action: () => onTriggerAction('logout') },
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '15vh',
      zIndex: 100
    }} onClick={onClose}>
      <div style={{
        width: '560px',
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }} onClick={(e) => e.stopPropagation()}>
        {/* Search header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #1e293b'
        }}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              color: '#f8fafc'
            }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Results list */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '0.5rem' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              No matching commands found
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Icon size={16} color="#38bdf8" />
                  <span style={{ flex: 1, fontSize: '0.875rem', color: '#e2e8f0' }}>{item.title}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
