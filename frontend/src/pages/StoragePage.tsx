import React, { useState, useEffect } from 'react';
import { HardDrive, RefreshCw, FolderSearch, Folder, FileText, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { SegmentBar } from '../components/MetricGauges';
import { useToast } from '../components/Toast';

export const StoragePage: React.FC = () => {
  const { showToast } = useToast();
  const [disks, setDisks] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzingPath, setAnalyzingPath] = useState('/marimo');
  const [loading, setLoading] = useState(false);

  const fetchDisks = async () => {
    try {
      setLoading(true);
      const res = await api.getStorageDisks();
      setDisks(res || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      const res = await api.analyzeStorage(analyzingPath);
      setAnalysis(res);
      showToast(`Storage analysis for '${analyzingPath}' completed`, 'success');
    } catch (e: any) {
      showToast(`Analysis failed: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisks();
    handleAnalyze();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Top Header */}
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
          <HardDrive size={18} color="#10b981" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            Storage Volumes & Partitions
          </h2>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchDisks}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Disks
        </button>
      </div>

      {/* Disks Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {disks.map((d, idx) => (
          <div key={idx} className="card" style={{ background: '#0b1324' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>{d.mountpoint}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.device} ({d.fstype})</div>
              </div>
              <HardDrive size={22} color="#10b981" />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <SegmentBar total={d.total_gb} used={d.used_gb} unit="GB" color="#10b981" />
            </div>
          </div>
        ))}
      </div>

      {/* Directory Storage Analyzer */}
      <div className="card" style={{ background: '#0b1324' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderSearch size={18} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                Directory Storage Consumption Analyzer
              </h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Inspect and break down disk usage of directories and files inside your pod.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="text"
              className="input"
              style={{ width: '240px' }}
              value={analyzingPath}
              onChange={(e) => setAnalyzingPath(e.target.value)}
              placeholder="/marimo"
            />
            <button className="btn btn-primary btn-sm" onClick={handleAnalyze}>
              Analyze
            </button>
          </div>
        </div>

        {analysis && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              backgroundColor: '#070d18',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              color: '#94a3b8'
            }}>
              <span>Path: <b style={{ color: '#38bdf8' }}>{analysis.analyzed_path}</b></span>
              <span>Total Measured: <b style={{ color: '#f8fafc' }}>{analysis.total_size_mb} MB</b></span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Size (MB)</th>
                  </tr>
                </thead>
                <tbody>
                  {(!analysis.items || analysis.items.length === 0) ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No items found in this directory
                      </td>
                    </tr>
                  ) : (
                    analysis.items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {item.is_dir ? <Folder size={16} color="#38bdf8" /> : <FileText size={16} color="#94a3b8" />}
                            <span style={{ color: item.is_dir ? '#f8fafc' : '#cbd5e1', fontWeight: item.is_dir ? 600 : 400 }}>
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {item.is_dir ? 'Directory' : 'File'}
                        </td>
                        <td className="font-mono" style={{ color: '#34d399', fontWeight: 600 }}>
                          {item.size_mb} MB
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
