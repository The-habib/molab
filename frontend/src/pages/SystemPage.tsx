import React, { useState, useEffect } from 'react';
import { 
  Sliders, RefreshCw, Trash2, RotateCw, Server, ShieldCheck, 
  Cpu, Zap, Key, Search, Copy, Check, Terminal, FileCode2, Info
} from 'lucide-react';
import { api } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

export const SystemPage: React.FC = () => {
  const { showToast } = useToast();
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  // Environment variables modal state
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [envLoading, setEnvLoading] = useState(false);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [envFilter, setEnvFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Pycache cleaning state
  const [cleaningPycache, setCleaningPycache] = useState(false);

  const fetchSystemInfo = async () => {
    try {
      setLoading(true);
      const res = await api.getSystemInfo();
      setSysInfo(res);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to fetch system info', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const handleConfirmAction = async () => {
    if (!actionTarget) return;
    try {
      await api.executeSystemAction(actionTarget);
      showToast(`System action '${actionTarget}' executed successfully.`, 'success');
      fetchSystemInfo();
    } catch (e: any) {
      showToast(`Action failed: ${e.message}`, 'error');
    } finally {
      setActionTarget(null);
    }
  };

  const handleFetchEnvVars = async () => {
    try {
      setEnvLoading(true);
      setEnvModalOpen(true);
      const res = await api.getEnvVars();
      setEnvVars(res || {});
    } catch (e: any) {
      showToast(`Failed to inspect environment: ${e.message}`, 'error');
    } finally {
      setEnvLoading(false);
    }
  };

  const handleCleanPycache = async () => {
    try {
      setCleaningPycache(true);
      const res = await api.cleanPycache('/marimo');
      showToast(res?.message || 'Python bytecode cache cleaned successfully', 'success');
    } catch (e: any) {
      showToast(`Clean pycache failed: ${e.message}`, 'error');
    } finally {
      setCleaningPycache(false);
    }
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showToast(`Copied ${keyName} to clipboard`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const gpu = sysInfo?.gpu || {};
  const filteredEnvKeys = Object.keys(envVars).filter(k => 
    k.toLowerCase().includes(envFilter.toLowerCase()) || 
    envVars[k].toLowerCase().includes(envFilter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Infrastructure Specs Header */}
      <div className="card card-glass" style={{ background: '#0b1324' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Sliders size={20} color="#38bdf8" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              Cloud PC Infrastructure Specifications
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleFetchEnvVars}>
              <Key size={13} color="#38bdf8" /> Inspect Env Vars
            </button>
            <button className="btn btn-secondary btn-sm" onClick={fetchSystemInfo}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Specs
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#070d18', borderRadius: '8px', border: '1px solid #16243a' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Operating System</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
              {sysInfo?.system || 'Linux'} ({sysInfo?.machine || 'x86_64'})
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Kernel: {sysInfo?.release || 'gVisor-virt'}
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#070d18', borderRadius: '8px', border: '1px solid #16243a' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Hostname & Environment</div>
            <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>
              {sysInfo?.hostname || 'molab-pod-instance'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              gVisor Sandboxed Compute Pod
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#070d18', borderRadius: '8px', border: '1px solid #16243a' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>CPU Cores Available</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
              {sysInfo?.cpu_cores || 20} Physical / Logical Cores
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              High-Throughput Thread Pool
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#070d18', borderRadius: '8px', border: '1px solid #16243a' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Dedicated GPU Accelerator</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#84cc16', marginTop: '0.25rem' }}>
              {gpu.gpu_name || 'NVIDIA RTX PRO 6000 Blackwell'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              94.97 GB VRAM • CUDA {gpu.cuda_version || '13.0'}
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#070d18', borderRadius: '8px', border: '1px solid #16243a' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Python & ML Stack</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
              Python {sysInfo?.python_version || '3.11'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              PyTorch {gpu.torch_version || '2.11.0+cu130'}
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#070d18', borderRadius: '8px', border: '1px solid #16243a' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Control Plane Link</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#34d399', marginTop: '0.25rem' }}>
              Authenticated Outbound WSS
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Zero Open Inbound Ports on Pod
            </div>
          </div>
        </div>
      </div>

      {/* Administrative Actions */}
      <div className="card" style={{ background: '#0b1324' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
          Administrative & Maintenance Actions
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.825rem', marginBottom: '1.25rem' }}>
          Execute authorized administrative and housekeeping operations on the remote pod instance.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setActionTarget('clear_tmp')}
          >
            <Trash2 size={15} color="#f59e0b" /> Flush /tmp Directory
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleCleanPycache}
            disabled={cleaningPycache}
          >
            <FileCode2 size={15} color="#a855f7" /> {cleaningPycache ? 'Cleaning __pycache__...' : 'Clean Python Bytecode Cache'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleFetchEnvVars}
          >
            <Key size={15} color="#38bdf8" /> Inspect Pod Environment
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setActionTarget('restart_agent')}
          >
            <RotateCw size={15} color="#06b6d4" /> Restart Background Agent Loop
          </button>
        </div>
      </div>

      {/* Environment Variables Modal */}
      {envModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(5, 8, 16, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card card-glass" style={{
            width: '100%',
            maxWidth: '850px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0c1527',
            borderColor: '#1e3050'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                  Remote Pod Environment Variables
                </h3>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                  Sanitized
                </span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEnvModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', backgroundColor: '#070e1b', border: '1px solid #16243a', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
              <Search size={15} color="#64748b" />
              <input
                type="text"
                placeholder="Filter environment variables by key or value..."
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  outline: 'none',
                  fontSize: '0.85rem',
                  width: '100%'
                }}
              />
              {envFilter && (
                <button
                  onClick={() => setEnvFilter('')}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #16243a', borderRadius: '6px', backgroundColor: '#060b16' }}>
              {envLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  Loading environment variables from remote agent...
                </div>
              ) : filteredEnvKeys.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No matching environment variables found.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #16243a', backgroundColor: '#08101e', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 1rem', width: '35%' }}>Variable Key</th>
                      <th style={{ padding: '0.65rem 1rem' }}>Value</th>
                      <th style={{ padding: '0.65rem 1rem', width: '50px', textAlign: 'center' }}>Copy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnvKeys.map((k) => (
                      <tr key={k} style={{ borderBottom: '1px solid #0f1c30' }}>
                        <td className="font-mono" style={{ padding: '0.6rem 1rem', color: '#38bdf8', fontWeight: 600, wordBreak: 'break-all' }}>
                          {k}
                        </td>
                        <td className="font-mono" style={{ padding: '0.6rem 1rem', color: '#cbd5e1', wordBreak: 'break-all' }}>
                          {envVars[k]}
                        </td>
                        <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => copyToClipboard(envVars[k], k)}
                            title="Copy value"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedKey === k ? '#10b981' : '#64748b',
                              cursor: 'pointer',
                              padding: '2px'
                            }}
                          >
                            {copiedKey === k ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Info size={13} />
              Tokens, secrets, passwords, and authorization keys are automatically masked by the agent RPC security filter.
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(actionTarget)}
        title={`Execute Action: ${actionTarget}?`}
        message="Please confirm that you want to perform this administrative task on the remote machine."
        confirmText="Execute"
        onConfirm={handleConfirmAction}
        onCancel={() => setActionTarget(null)}
      />

    </div>
  );
};
