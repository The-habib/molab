import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { X, Terminal as TerminalIcon, Maximize2, Zap, Download } from 'lucide-react';
import { api, getStoredToken } from '../api';

interface QuickTerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickTerminalDrawer: React.FC<QuickTerminalDrawerProps> = ({ isOpen, onClose }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (xtermInstance.current) {
        xtermInstance.current.dispose();
        xtermInstance.current = null;
      }
      return;
    }

    const initTerminal = async () => {
      try {
        const res = await api.createTerminalSession(80, 20);
        const sid = res.session_id;
        setSessionId(sid);

        if (!terminalRef.current) return;

        const term = new XTerm({
          cursorBlink: true,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          theme: {
            background: '#070b14',
            foreground: '#e2e8f0',
            cursor: '#38bdf8'
          },
          convertEol: true
        });

        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(terminalRef.current);
        fit.fit();

        xtermInstance.current = term;
        fitAddon.current = fit;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const token = getStoredToken();
        const wsUrl = `${protocol}//${host}/api/terminal/ws/${sid}?token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          term.write('\r\n\x1b[32m[Quick Shell Dock Linked]\x1b[0m\r\n\r\n');
          fit.fit();
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        };

        ws.onmessage = (e) => term.write(e.data);
        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });

      } catch (err: any) {
        console.error('Quick terminal init failed:', err);
      }
    };

    const timer = setTimeout(initTerminal, 150);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '340px',
      backgroundColor: '#070b14',
      borderTop: '2px solid #38bdf8',
      boxShadow: '0 -15px 40px rgba(0,0,0,0.8)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Drawer Header */}
      <div style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#0c1424',
        borderBottom: '1px solid #1a273f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <TerminalIcon size={16} color="#38bdf8" />
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>
            Interactive Quick Shell Dock
          </span>
          <span className="badge badge-tech" style={{ fontSize: '0.65rem' }}>
            Direct Linux PTY
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Drawer Terminal Body */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          padding: '0.5rem',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};
