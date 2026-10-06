import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Plus,
  Trash2,
  Download,
  RefreshCw,
  Terminal as TerminalIcon,
  Maximize2,
  Copy,
  ChevronRight,
  Radio,
  Zap,
  HardDrive,
  Cpu,
  Activity
} from 'lucide-react';
import { api, getStoredToken } from '../api';
import { useToast } from '../components/Toast';

interface Tab {
  id: string;
  title: string;
}

export const TerminalPage: React.FC = () => {
  const { showToast } = useToast();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [connected, setConnected] = useState<boolean>(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize tabs from backend sessions or create first
  useEffect(() => {
    const initTabs = async () => {
      try {
        const sessions = await api.listTerminalSessions();
        if (sessions && sessions.length > 0) {
          const tabList = sessions.map((s: any, idx: number) => ({
            id: s.session_id,
            title: `Shell ${idx + 1}`
          }));
          setTabs(tabList);
          setActiveTab(tabList[0].id);
        } else {
          await createNewTab();
        }
      } catch (e) {
        await createNewTab();
      }
    };
    initTabs();
  }, []);

  const createNewTab = async () => {
    try {
      const res = await api.createTerminalSession(100, 30);
      const newTab: Tab = {
        id: res.session_id,
        title: `Shell ${tabs.length + 1}`
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTab(newTab.id);
    } catch (e: any) {
      showToast(`Failed to create terminal session: ${e.message}`, 'error');
    }
  };

  const closeTab = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.closeTerminalSession(id);
      const remaining = tabs.filter((t) => t.id !== id);
      setTabs(remaining);
      if (activeTab === id && remaining.length > 0) {
        setActiveTab(remaining[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Mount active terminal session
  useEffect(() => {
    if (!activeTab || !terminalRef.current) return;

    // Teardown previous instance
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (xtermInstance.current) {
      xtermInstance.current.dispose();
      xtermInstance.current = null;
    }

    setConnected(false);

    // Initialize xterm.js instance
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
      letterSpacing: 0.5,
      lineHeight: 1.25,
      theme: {
        background: '#070b14',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        cursorAccent: '#070b14',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#0f172a',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#334155',
        brightRed: '#fb7185',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      convertEol: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    xtermInstance.current = term;
    fitAddon.current = fit;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getStoredToken();
    const wsUrl = `${protocol}//${host}/api/terminal/ws/${activeTab}?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      term.write('\r\n\x1b[38;2;118;185;0m[Connected to Remote Pod Interactive Shell via Secure WSS]\x1b[0m\r\n\r\n');
      if (fitAddon.current) {
        fitAddon.current.fit();
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      setConnected(false);
      term.write('\r\n\x1b[31m[Terminal session disconnected]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => {
      if (fitAddon.current && ws.readyState === WebSocket.OPEN) {
        fitAddon.current.fit();
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      term.dispose();
    };
  }, [activeTab]);

  const sendQuickCommand = (cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(`${cmd}\n`);
      if (xtermInstance.current) {
        xtermInstance.current.focus();
      }
    }
  };

  const handleClear = () => {
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      xtermInstance.current.focus();
    }
  };

  const handleDownloadScrollback = () => {
    if (activeTab) {
      window.open(`/api/terminal/sessions/${activeTab}/scrollback`, '_blank');
    }
  };

  const quickCommands = [
    { label: 'nvidia-smi', cmd: 'nvidia-smi', icon: Zap, color: '#76b900' },
    { label: 'free -h', cmd: 'free -h', icon: Cpu, color: '#a855f7' },
    { label: 'df -h', cmd: 'df -h', icon: HardDrive, color: '#10b981' },
    { label: 'top -b -n 1', cmd: 'top -b -n 1 | head -n 18', icon: Activity, color: '#38bdf8' },
    { label: 'PyTorch CUDA Test', cmd: 'python3 -c "import torch; print(f\'CUDA: {torch.cuda.is_available()} | GPU: {torch.cuda.get_device_name(0)}\')"', icon: Zap, color: '#f59e0b' },
    { label: 'ls -la /marimo', cmd: 'ls -la /marimo', icon: ChevronRight, color: '#94a3b8' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', gap: '0.75rem' }}>
      
      {/* Top Tab Bar & Terminal Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0c1220',
        padding: '0.5rem 0.75rem',
        borderRadius: '10px',
        border: '1px solid #1a273f'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflowX: 'auto' }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: active ? '#1a273f' : '#0e1627',
                  border: `1px solid ${active ? '#38bdf8' : 'transparent'}`,
                  color: active ? '#f8fafc' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s'
                }}
              >
                <div className={`pulse-dot ${active && connected ? 'pulse-dot-online' : ''}`} style={{ backgroundColor: active && connected ? '#10b981' : '#64748b' }} />
                <span>{tab.title}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#f43f5e')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={createNewTab}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.6rem' }}
            title="Create new terminal shell"
          >
            <Plus size={14} /> New Shell
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handleClear}
            className="btn btn-secondary btn-sm"
            title="Clear terminal screen"
          >
            Clear
          </button>
          <button
            onClick={handleDownloadScrollback}
            className="btn btn-secondary btn-sm"
            title="Download full scrollback log"
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Quick Command Snippets Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto',
        padding: '0.2rem 0'
      }}>
        <span style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          Quick Inject:
        </span>
        {quickCommands.map((qc, idx) => {
          const Icon = qc.icon;
          return (
            <button
              key={idx}
              onClick={() => sendQuickCommand(qc.cmd)}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.65rem',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <Icon size={12} color={qc.color} />
              {qc.label}
            </button>
          );
        })}
      </div>

      {/* Terminal View Container */}
      <div
        className="card"
        style={{
          flex: 1,
          backgroundColor: '#070b14',
          borderColor: '#19263e',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.8)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          ref={terminalRef}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          }}
        />
      </div>

    </div>
  );
};
