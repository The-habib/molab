import React, { useState, useEffect } from 'react';
import { FileCheck, RefreshCw, Search, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs(100, 0);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) =>
    (l.actor && l.actor.toLowerCase().includes(filter.toLowerCase())) ||
    (l.action && l.action.toLowerCase().includes(filter.toLowerCase())) ||
    (l.resource && l.resource.toLowerCase().includes(filter.toLowerCase()))
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
          <FileCheck size={18} color="#10b981" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            Tamper-Evident Security Audit Trail ({total} Events)
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '32px' }}
              placeholder="Search audit trail..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Status</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  {loading ? 'Retrieving audit events from SQLite...' : 'No audit records match your search'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {log.timestamp}
                  </td>
                  <td>
                    <span className="badge badge-tech" style={{ color: '#38bdf8' }}>
                      {log.actor}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                    {log.action}
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.8rem', color: '#cbd5e1', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.resource}>
                    {log.resource}
                  </td>
                  <td>
                    <span className={`badge ${log.status === 'success' ? 'badge-online' : 'badge-offline'}`}>
                      {log.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {log.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {log.ip || '127.0.0.1'}
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
