import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, Send, CheckCircle2, XCircle, Globe, Terminal as TerminalIcon } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export const NetworkPage: React.FC = () => {
  const { showToast } = useToast();
  const [ifaces, setIfaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [diagTool, setDiagTool] = useState('ping');
  const [diagTarget, setDiagTarget] = useState('8.8.8.8');
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);

  const fetchInterfaces = async () => {
    try {
      setLoading(true);
      const res = await api.getNetworkInterfaces();
      setIfaces(res || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterfaces();
  }, []);

  const handleRunDiagnostic = async () => {
    try {
      setDiagRunning(true);
      setDiagResult(null);
      const res = await api.runNetworkDiagnostic(diagTool, diagTarget);
      setDiagResult(res);
      showToast(`Diagnostic (${diagTool}) completed`, 'success');
    } catch (e: any) {
      showToast(`Diagnostic failed: ${e.message}`, 'error');
    } finally {
      setDiagRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Network Interfaces Card */}
      <div className="card" style={{ background: '#0b1324' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wifi size={18} color="#38bdf8" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
              Active Network Interfaces
            </h2>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchInterfaces}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Interface</th>
                <th>IPv4 Address</th>
                <th>Status</th>
                <th>Link Speed</th>
                <th>Total RX</th>
                <th>Total TX</th>
              </tr>
            </thead>
            <tbody>
              {ifaces.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    {loading ? 'Discovering network interfaces...' : 'No network interfaces detected'}
                  </td>
                </tr>
              ) : (
                ifaces.map((i, idx) => (
                  <tr key={idx}>
                    <td className="font-mono" style={{ fontWeight: 600, color: '#38bdf8' }}>
                      {i.interface}
                    </td>
                    <td className="font-mono" style={{ color: '#f8fafc' }}>
                      {i.ip || 'N/A'}
                    </td>
                    <td>
                      <span className={`badge ${i.status === 'UP' ? 'badge-online' : 'badge-offline'}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="font-mono" style={{ color: '#94a3b8' }}>
                      {i.speed_mbps ? `${i.speed_mbps} Mbps` : 'Virtual / Unlimited'}
                    </td>
                    <td className="font-mono" style={{ color: '#34d399' }}>
                      {i.rx_mb} MB
                    </td>
                    <td className="font-mono" style={{ color: '#60a5fa' }}>
                      {i.tx_mb} MB
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Network Diagnostics Console */}
      <div className="card card-glass" style={{ background: '#0c1424' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Globe size={18} color="#10b981" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            Interactive Network Diagnostic Console
          </h3>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Test internet connectivity, latency, DNS lookups, or HTTP reaching from your MoLab pod.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <select
            className="input"
            style={{ width: '150px' }}
            value={diagTool}
            onChange={(e) => setDiagTool(e.target.value)}
          >
            <option value="ping">ICMP Ping</option>
            <option value="dns">DNS Resolution</option>
            <option value="http">HTTP Latency</option>
          </select>

          <input
            type="text"
            className="input"
            style={{ flex: 1, minWidth: '220px' }}
            placeholder="Target IP, hostname, or URL (e.g. 8.8.8.8, huggingface.co)"
            value={diagTarget}
            onChange={(e) => setDiagTarget(e.target.value)}
          />

          <button
            className="btn btn-primary"
            onClick={handleRunDiagnostic}
            disabled={diagRunning}
            style={{ minWidth: '130px' }}
          >
            <Send size={14} className={diagRunning ? 'animate-spin' : ''} />
            {diagRunning ? 'Testing...' : 'Execute Test'}
          </button>
        </div>

        {diagResult && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#070b14',
            borderRadius: '8px',
            border: '1px solid #1a273f',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {diagResult.success ? (
                <CheckCircle2 size={16} color="#10b981" />
              ) : (
                <XCircle size={16} color="#ef4444" />
              )}
              <span style={{ fontWeight: 600, color: diagResult.success ? '#10b981' : '#ef4444' }}>
                {diagResult.success ? 'Diagnostic Test Passed' : 'Diagnostic Test Failed'}
              </span>
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap',
              color: '#cbd5e1',
              backgroundColor: '#05080e',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid #121c2d',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {diagResult.output}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
};
