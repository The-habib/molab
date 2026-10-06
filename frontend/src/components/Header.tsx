import React from 'react';
import { Search, LogOut, Radio, Cpu, ShieldCheck, Zap, Server } from 'lucide-react';

interface HeaderProps {
  online: boolean;
  latencyMs: number;
  hostname?: string;
  gpuName?: string;
  username: string;
  pods?: any[];
  activePodId?: string;
  onSelectPod?: (podId: string) => void;
  onOpenCommandPalette: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  online,
  latencyMs,
  hostname,
  gpuName,
  username,
  pods,
  activePodId,
  onSelectPod,
  onOpenCommandPalette,
  onLogout,
}) => {
  return (
    <header style={{
      height: '62px',
      backgroundColor: '#090e1a',
      borderBottom: '1px solid #1a273f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 20,
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Connection status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.8rem',
          borderRadius: '9999px',
          backgroundColor: online ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
          border: `1px solid ${online ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          fontSize: '0.75rem',
          fontWeight: 600,
          color: online ? '#34d399' : '#fb7185'
        }}>
          <div className={`pulse-dot ${online ? 'pulse-dot-online' : ''}`} style={{ backgroundColor: online ? '#10b981' : '#f43f5e' }} />
          <span>{online ? (pods && pods.length > 1 ? `CLUSTER ACTIVE (${pods.length} PODS)` : `DIRECT WSS • ${latencyMs}ms`) : 'POD DISCONNECTED'}</span>
        </div>

        {/* Multi-Pod Cluster Selector or Single Hostname Badge */}
        {pods && pods.length > 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#131e33', padding: '0.2rem 0.6rem', borderRadius: '8px', border: '1px solid #203354' }}>
            <Server size={13} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ACTIVE POD:</span>
            <select
              value={activePodId || ''}
              onChange={(e) => onSelectPod && onSelectPod(e.target.value)}
              style={{
                backgroundColor: '#0b1322',
                color: '#38bdf8',
                border: '1px solid #20314f',
                borderRadius: '6px',
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {pods.map((p) => (
                <option key={p.pod_id} value={p.pod_id}>
                  {p.hostname} {p.vram_total_gb ? `(${p.vram_total_gb}GB)` : ''} • {p.latency_ms}ms
                </option>
              ))}
            </select>
          </div>
        ) : (
          hostname && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{hostname}</span>
              {gpuName && (
                <span className="badge badge-nvidia" style={{ fontSize: '0.7rem' }}>
                  <Zap size={11} /> {gpuName.includes('Blackwell') ? 'RTX PRO 6000 Blackwell' : gpuName}
                </span>
              )}
            </div>
          )
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Command palette button */}
        <button
          onClick={onOpenCommandPalette}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.4rem 0.85rem',
            backgroundColor: '#121b2d',
            border: '1px solid #20314f',
            borderRadius: '8px',
            color: '#94a3b8',
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#38bdf8';
            e.currentTarget.style.color = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#20314f';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <Search size={14} />
          <span>Jump to...</span>
          <kbd style={{
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            backgroundColor: '#090e1a',
            border: '1px solid #243554',
            fontSize: '0.7rem',
            color: '#cbd5e1',
            fontFamily: 'var(--font-mono)'
          }}>
            Ctrl+K
          </kbd>
        </button>

        {/* User & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '0.75rem', borderLeft: '1px solid #1a273f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#e2e8f0' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#16243d',
              border: '1px solid #2a436e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={15} color="#38bdf8" />
            </div>
            <span style={{ fontWeight: 600 }}>{username}</span>
          </div>

          <button
            onClick={onLogout}
            title="Sign out of control plane"
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
