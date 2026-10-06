import React, { useState, useEffect, useRef } from 'react';
import { FileText, RefreshCw, Download, Pause, Play, Search, ArrowDown } from 'lucide-react';
import { api } from '../api';

export const LogsPage: React.FC = () => {
  const [sources, setSources] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState('agent');
  const [lines, setLines] = useState(100);
  const [logText, setLogText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  const logContainerRef = useRef<HTMLPreElement>(null);

  const fetchSources = async () => {
    try {
      const res = await api.getLogSources();
      setSources(res || []);
      if (res && res.length > 0 && !selectedSource) {
        setSelectedSource(res[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLog = async () => {
    if (!selectedSource) return;
    try {
      setLoading(true);
      const res = await api.tailLog(selectedSource, lines);
      setLogText(res.content || '');
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    fetchLog();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLog, 3500);
    return () => clearInterval(interval);
  }, [selectedSource, lines, autoRefresh]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logText, autoScroll]);

  const handleDownload = () => {
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSource}_log.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLines = searchFilter
    ? logText
        .split('\n')
        .filter((l) => l.toLowerCase().includes(searchFilter.toLowerCase()))
        .join('\n')
    : logText;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', gap: '0.75rem' }}>
      
      {/* Log Controls Header */}
      <div className="card" style={{
        padding: '0.75rem 1.25rem',
        backgroundColor: '#0c1424',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Source Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Sources:
          </span>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSource(s.id)}
              className={`btn btn-sm ${selectedSource === s.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Filter and Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '180px' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '9px', color: '#64748b' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '28px', padding: '0.35rem 0.65rem 0.35rem 26px', fontSize: '0.8rem' }}
              placeholder="Search in log..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>

          <select
            className="input"
            style={{ width: '100px', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
          </select>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Pause streaming' : 'Resume live stream'}
          >
            {autoRefresh ? <Pause size={13} color="#38bdf8" /> : <Play size={13} color="#10b981" />}
            {autoRefresh ? 'Live' : 'Paused'}
          </button>

          <button
            className={`btn btn-sm ${autoScroll ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Auto-scroll to bottom"
          >
            <ArrowDown size={13} /> Scroll
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleDownload} title="Download log file">
            <Download size={13} />
          </button>

          <button className="btn btn-secondary btn-sm" onClick={fetchLog} title="Refresh log">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Log Streaming Viewer */}
      <div className="card" style={{
        flex: 1,
        backgroundColor: '#070b14',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        <pre
          ref={logContainerRef}
          style={{
            flex: 1,
            margin: 0,
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            color: '#cbd5e1',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {filteredLines || (loading ? 'Streaming remote log buffer...' : 'No log lines to display.')}
        </pre>
      </div>

    </div>
  );
};
