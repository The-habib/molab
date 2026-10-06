import React, { useState, useEffect } from 'react';
import { api, getStoredToken } from './api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CommandPalette } from './components/CommandPalette';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TerminalPage } from './pages/TerminalPage';
import { FilesPage } from './pages/FilesPage';
import { ProcessesPage } from './pages/ProcessesPage';
import { ServicesPage } from './pages/ServicesPage';
import { GPUPage } from './pages/GPUPage';
import { StoragePage } from './pages/StoragePage';
import { NetworkPage } from './pages/NetworkPage';
import { JobsPage } from './pages/JobsPage';
import { LogsPage } from './pages/LogsPage';
import { ContainersPage } from './pages/ContainersPage';
import { SystemPage } from './pages/SystemPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { ToastProvider, useToast } from './components/Toast';

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('admin');
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  // Check auth on startup
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const me = await api.getMe();
        if (me && me.authenticated) {
          setAuthenticated(true);
          setCurrentUser(me.username || 'admin');
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      }
    };

    checkAuth();

    const handleUnauthorized = () => setAuthenticated(false);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Fetch summary and establish realtime WebSocket
  const fetchSummary = async () => {
    try {
      const res = await api.getDashboardSummary();
      setSummary(res);
    } catch (e) {
      console.error('Failed to fetch summary:', e);
    }
  };

  useEffect(() => {
    if (!authenticated) return;

    fetchSummary();

    // Setup realtime telemetry WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getStoredToken();
    const ws = new WebSocket(`${protocol}//${host}/api/dashboard/ws?token=${token}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'summary' || msg.type === 'telemetry') {
          setSummary((prev: any) => ({
            ...prev,
            online: msg.online,
            latency_ms: msg.latency_ms,
            telemetry: msg.telemetry || prev?.telemetry,
            agent: msg.agent || prev?.agent,
          }));
        } else if (msg.type === 'ping') {
          setSummary((prev: any) => ({
            ...prev,
            online: msg.online,
            latency_ms: msg.latency_ms,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [authenticated]);

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
    showToast('Signed out successfully', 'info');
  };

  const handleTriggerAction = async (action: string) => {
    if (action === 'logout') {
      handleLogout();
    } else if (action === 'run_benchmark') {
      setCurrentTab('gpu');
    } else if (action === 'clear_tmp') {
      await api.executeSystemAction('clear_tmp');
      showToast('Remote /tmp directory cleared', 'success');
    }
  };

  if (authenticated === null) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', color: '#64748b' }}>
        Loading Control Plane...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setAuthenticated(true);
        }}
      />
    );
  }

  const isOnline = summary?.online ?? false;
  const latency = summary?.latency_ms ?? 0;
  const hostname = summary?.agent?.hostname;
  const gpuName = summary?.telemetry?.gpu?.gpu_name || summary?.agent?.gpu?.gpu_name;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#090d16' }}>
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        online={isOnline}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Header
          online={isOnline}
          latencyMs={latency}
          hostname={hostname}
          gpuName={gpuName}
          username={currentUser}
          pods={summary?.pods}
          activePodId={summary?.active_pod_id}
          onSelectPod={async (podId) => {
            await api.selectPod(podId);
            fetchSummary();
            showToast(`Switched active node to ${podId}`, 'info');
          }}
          onOpenCommandPalette={() => setCmdPaletteOpen(true)}
          onLogout={handleLogout}
        />

        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: '#090d16' }}>
          {currentTab === 'dashboard' && <DashboardPage summary={summary} onNavigate={setCurrentTab} onRefresh={fetchSummary} />}
          {currentTab === 'terminal' && <TerminalPage />}
          {currentTab === 'files' && <FilesPage />}
          {currentTab === 'processes' && <ProcessesPage />}
          {currentTab === 'services' && <ServicesPage />}
          {currentTab === 'gpu' && <GPUPage />}
          {currentTab === 'storage' && <StoragePage />}
          {currentTab === 'network' && <NetworkPage />}
          {currentTab === 'jobs' && <JobsPage />}
          {currentTab === 'logs' && <LogsPage />}
          {currentTab === 'containers' && <ContainersPage />}
          {currentTab === 'system' && <SystemPage />}
          {currentTab === 'audit' && <AuditPage />}
          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={(tab) => {
          setCurrentTab(tab);
          setCmdPaletteOpen(false);
        }}
        onTriggerAction={handleTriggerAction}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};
