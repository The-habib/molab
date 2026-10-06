import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  Slash,
  AlertOctagon,
  ArrowUpDown,
  Activity,
  Play,
  Pause,
  Cpu,
  Layers
} from 'lucide-react';
import { api } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

export const ProcessesPage: React.FC = () => {
  const { showToast } = useToast();
  const [procs, setProcs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'pid'>('cpu');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [killTarget, setKillTarget] = useState<{ pid: number; name: string; signal: number } | null>(null);

  const fetchProcesses = async () => {
    try {
      setLoading(true);
      const res = await api.listProcesses();
      setProcs(res || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
    if (!autoRefresh) return;
    const interval = setInterval(fetchProcesses, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleConfirmKill = async () => {
    if (!killTarget) return;
    try {
      await api.killProcess(killTarget.pid, killTarget.signal);
      showToast(`Signal ${killTarget.signal} sent to PID ${killTarget.pid} (${killTarget.name})`, 'success');
      fetchProcesses();
    } catch (e: any) {
      showToast(`Kill failed: ${e.message}`, 'error');
    } finally {
      setKillTarget(null);
    }
  };

  const filtered = procs
    .filter((p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.cmd.toLowerCase().includes(filter.toLowerCase()) ||
      p.user.toLowerCase().includes(filter.toLowerCase()) ||
      String(p.pid).includes(filter)
    )
    .sort((a, b) => {
      if (sortBy === 'cpu') return (b.cpu_percent || 0) - (a.cpu_percent || 0);
      if (sortBy === 'mem') return (b.memory_percent || 0) - (a.memory_percent || 0);
      return b.pid - a.pid;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      
      {/* Header & Controls Strip */}
      <div className="card" style={{
        padding: '0.85rem 1.25rem',
        backgroundColor: '#0c1424',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '32px' }}
              placeholder="Filter by name, PID, or command..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Sort:</span>
            <button
              className={`btn btn-sm ${sortBy === 'cpu' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSortBy('cpu')}
            >
              CPU %
            </button>
            <button
              className={`btn btn-sm ${sortBy === 'mem' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSortBy('mem')}
            >
              Memory %
            </button>
            <button
              className={`btn btn-sm ${sortBy === 'pid' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSortBy('pid')}
            >
              PID
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          >
            {autoRefresh ? <Pause size={13} color="#38bdf8" /> : <Play size={13} color="#10b981" />}
            {autoRefresh ? 'Live (4s)' : 'Paused'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchProcesses}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Process Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>PID</th>
              <th style={{ width: '160px' }}>Name</th>
              <th style={{ width: '100px' }}>User</th>
              <th style={{ width: '140px' }}>CPU Load</th>
              <th style={{ width: '140px' }}>RAM Load</th>
              <th>Command Line</th>
              <th style={{ textAlign: 'right', width: '140px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  {loading ? 'Inspecting processes...' : 'No matching processes found'}
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const cpuVal = p.cpu_percent || 0;
                const memVal = p.memory_percent || 0;
                return (
                  <tr key={p.pid}>
                    <td className="font-mono" style={{ color: '#38bdf8', fontWeight: 600 }}>{p.pid}</td>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{p.name}</td>
                    <td style={{ color: '#94a3b8' }}>{p.user}</td>
                    
                    {/* CPU Bar */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="font-mono" style={{ width: '45px', fontSize: '0.8rem', color: cpuVal > 20 ? '#ef4444' : '#cbd5e1' }}>
                          {cpuVal.toFixed(1)}%
                        </span>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, cpuVal)}%`, height: '100%', backgroundColor: cpuVal > 20 ? '#ef4444' : '#38bdf8' }} />
                        </div>
                      </div>
                    </td>

                    {/* Memory Bar */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="font-mono" style={{ width: '45px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                          {memVal.toFixed(1)}%
                        </span>
                        <div style={{ flex: 1, height: '4px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, memVal * 2)}%`, height: '100%', backgroundColor: '#a855f7' }} />
                        </div>
                      </div>
                    </td>

                    <td className="font-mono" style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.cmd}>
                      {p.cmd}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setKillTarget({ pid: p.pid, name: p.name, signal: 15 })}
                          title="Send SIGTERM (Graceful Terminate)"
                        >
                          Terminate
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setKillTarget({ pid: p.pid, name: p.name, signal: 9 })}
                          title="Send SIGKILL (Force Kill)"
                        >
                          Kill
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={Boolean(killTarget)}
        title={`Terminate Process ${killTarget?.name} (PID ${killTarget?.pid})?`}
        message={killTarget?.signal === 9 ? 'Force kill (SIGKILL -9) immediately kills the process without cleanup.' : 'Terminate (SIGTERM -15) requests the process to shutdown cleanly.'}
        confirmText={killTarget?.signal === 9 ? 'Force Kill' : 'Terminate'}
        danger
        onConfirm={handleConfirmKill}
        onCancel={() => setKillTarget(null)}
      />

    </div>
  );
};
