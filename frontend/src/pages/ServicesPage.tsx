import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Square, RotateCw, Server, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export const ServicesPage: React.FC = () => {
  const { showToast } = useToast();
  const [services, setServices] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await api.listServices();
      setServices(res || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleAction = async (name: string, action: string) => {
    try {
      await api.controlService(name, action);
      showToast(`Service ${name}: ${action} executed successfully`, 'success');
      fetchServices();
    } catch (e: any) {
      showToast(`Service action failed: ${e.message}`, 'error');
    }
  };

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      
      {/* Header Strip */}
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
          <Server size={18} color="#38bdf8" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            System Daemons & Init Services
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '32px' }}
              placeholder="Search services..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <button className="btn btn-secondary btn-sm" onClick={fetchServices}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Services Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Status</th>
              <th>State</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  {loading ? 'Discovering system services...' : 'No system services found matching filter'}
                </td>
              </tr>
            ) : (
              filtered.map((s, idx) => {
                const isActive = s.active === 'active' || s.sub === 'running';
                return (
                  <tr key={idx}>
                    <td className="font-mono" style={{ fontWeight: 600, color: '#f8fafc' }}>
                      {s.name}
                    </td>
                    <td>
                      <span className={`badge ${isActive ? 'badge-online' : 'badge-offline'}`}>
                        {isActive ? 'RUNNING' : 'STOPPED'}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {s.sub}
                    </td>
                    <td style={{ color: '#cbd5e1' }}>
                      {s.description || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem' }}
                          onClick={() => handleAction(s.name, 'restart')}
                          title="Restart service"
                        >
                          <RotateCw size={12} /> Restart
                        </button>
                        {isActive ? (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.2rem 0.5rem' }}
                            onClick={() => handleAction(s.name, 'stop')}
                            title="Stop service"
                          >
                            <Square size={12} /> Stop
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.2rem 0.5rem' }}
                            onClick={() => handleAction(s.name, 'start')}
                            title="Start service"
                          >
                            <Play size={12} /> Start
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
