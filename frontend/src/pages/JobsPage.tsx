import React, { useState, useEffect } from 'react';
import {
  ListOrdered,
  Play,
  RefreshCw,
  XCircle,
  CheckCircle,
  Clock,
  Layers,
  FileText,
  X
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export const JobsPage: React.FC = () => {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newJobName, setNewJobName] = useState('Deep Learning GPU Test');
  const [newJobType, setNewJobType] = useState('benchmark');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.listJobs();
      setJobs(res || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.submitJob(newJobName, newJobType, { matrix_size: 4096, iterations: 10 });
      showToast(`Job '${newJobName}' submitted to queue`, 'success');
      fetchJobs();
    } catch (err: any) {
      showToast(`Job submission failed: ${err.message}`, 'error');
    }
  };

  const handleCancel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.cancelJob(id);
      showToast('Job cancelled', 'info');
      fetchJobs();
    } catch (err: any) {
      showToast(`Cancel failed: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Submit Job Card */}
      <div className="card card-glass" style={{ background: '#0c1424' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Layers size={18} color="#f59e0b" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            Dispatch Asynchronous Background Job
          </h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1rem' }}>
          Submit non-blocking background tasks into the Windows controller queue for remote pod execution.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input"
            style={{ flex: 1, minWidth: '220px' }}
            placeholder="Job Title"
            value={newJobName}
            onChange={(e) => setNewJobName(e.target.value)}
          />
          <select
            className="input"
            style={{ width: 'auto', minWidth: '260px' }}
            value={newJobType}
            onChange={(e) => setNewJobType(e.target.value)}
          >
            <option value="benchmark">PyTorch Blackwell Matrix Mult Benchmark</option>
            <option value="ping">Hardware Latency Verification</option>
            <option value="gpu_status">GPU Health & Telemetry Snapshot</option>
          </select>
          <button type="submit" className="btn btn-primary">
            <Play size={14} /> Submit Job
          </button>
        </form>
      </div>

      {/* Jobs List */}
      <div className="card" style={{ background: '#0b1324' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
            Job Queue History
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchJobs}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No background jobs recorded yet
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.job_id}
                    onClick={() => setSelectedJob(job)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-mono" style={{ color: '#38bdf8', fontWeight: 600 }}>{job.job_id}</td>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{job.name}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{job.type}</td>
                    <td>
                      <span className={`badge ${
                        job.status === 'completed' ? 'badge-online' :
                        job.status === 'running' ? 'badge-online' : 'badge-offline'
                      }`}>
                        {job.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="font-mono" style={{ color: '#94a3b8' }}>
                      {job.duration_seconds ? `${job.duration_seconds}s` : 'Active'}
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {new Date(job.created_at * 1000).toLocaleTimeString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJob(job);
                          }}
                        >
                          <FileText size={12} /> View Logs
                        </button>
                        {job.status === 'running' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={(e) => handleCancel(job.job_id, e)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            <XCircle size={12} /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Log Viewer Modal */}
      {selectedJob && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {selectedJob.name}
                </h3>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                  ID: {selectedJob.job_id} • Status: {selectedJob.status}
                </span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedJob(null)}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{
              backgroundColor: '#070b14',
              borderRadius: '8px',
              padding: '1rem',
              border: '1px solid #1a273f',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: '#cbd5e1',
              maxHeight: '260px',
              overflowY: 'auto'
            }}>
              {selectedJob.logs && selectedJob.logs.length > 0 ? (
                selectedJob.logs.map((line: string, idx: number) => (
                  <div key={idx} style={{ padding: '2px 0' }}>{line}</div>
                ))
              ) : (
                <div style={{ color: '#64748b' }}>No output logs recorded for this job.</div>
              )}
            </div>

            {selectedJob.result && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#0c1424', borderRadius: '6px', fontSize: '0.8rem' }}>
                <span style={{ color: '#64748b' }}>Result: </span>
                <span className="font-mono" style={{ color: '#84cc16' }}>{JSON.stringify(selectedJob.result)}</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
