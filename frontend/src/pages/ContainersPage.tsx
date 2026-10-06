import React, { useState, useEffect } from 'react';
import { Box, RefreshCw, Play, Square, RotateCw, Info, Layers } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export const ContainersPage: React.FC = () => {
  const { showToast } = useToast();
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContainers = async () => {
    try {
      setLoading(true);
      const res = await api.listContainers();
      setContainers(res || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  const handleAction = async (id: string, action: string) => {
    try {
      await api.controlContainer(id, action);
      showToast(`Container ${id}: ${action} executed`, 'success');
      fetchContainers();
    } catch (e: any) {
      showToast(`Container action failed: ${e.message}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
      
      {/* Container Engine Header */}
      <div className="card" style={{
        padding: '0.85rem 1.25rem',
        backgroundColor: '#0c1424',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Box size={18} color="#38bdf8" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            Container Runtime (Docker / Podman)
          </h2>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchContainers}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Info notice for MoLab */}
      <div style={{
        padding: '0.85rem 1rem',
        backgroundColor: '#0a1220',
        borderRadius: '8px',
        border: '1px solid #1a273f',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.825rem',
        color: '#94a3b8'
      }}>
        <Info size={16} color="#38bdf8" />
        <span>
          MoLab compute instances run directly as isolated container workloads under the host hypervisor. Any nested Docker or Podman containers launched inside this pod will be dynamically tracked here.
        </span>
      </div>

      {/* Container Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Names</th>
              <th>Image</th>
              <th>Status</th>
              <th>State</th>
              <th>Ports</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {containers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  {loading ? 'Inspecting container runtime...' : 'No nested container instances currently running'}
                </td>
              </tr>
            ) : (
              containers.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono" style={{ color: '#38bdf8' }}>{c.id}</td>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>{c.names}</td>
                  <td className="font-mono" style={{ color: '#94a3b8' }}>{c.image}</td>
                  <td>
                    <span className="badge badge-online">{c.status}</span>
                  </td>
                  <td style={{ color: '#64748b' }}>{c.state}</td>
                  <td className="font-mono" style={{ fontSize: '0.8rem' }}>{c.ports || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.2rem 0.5rem' }}
                        onClick={() => handleAction(c.id, 'restart')}
                      >
                        <RotateCw size={12} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.2rem 0.5rem' }}
                        onClick={() => handleAction(c.id, 'stop')}
                      >
                        <Square size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
