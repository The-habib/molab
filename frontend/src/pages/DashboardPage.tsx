import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Zap,
  HardDrive,
  Activity,
  Terminal,
  FolderTree,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Flame,
  Radio,
  Server,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  Sparkles,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../api';
import {
  CircularGauge,
  Sparkline,
  CoreGrid,
  SegmentBar,
  MultiMetricChart,
  LatencyJitterMeter
} from '../components/MetricGauges';
import { QuickTerminalDrawer } from '../components/QuickTerminalDrawer';
import { useToast } from '../components/Toast';

interface DashboardProps {
  summary: any;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ summary, onNavigate, onRefresh }) => {
  const { showToast } = useToast();
  const [benchmarking, setBenchmarking] = useState(false);
  const [purgingCache, setPurgingCache] = useState(false);
  const [benchSize, setBenchSize] = useState(4096);
  const [benchIters, setBenchIters] = useState(10);
  const [benchResult, setBenchResult] = useState<any>(null);
  const [quickTerminalOpen, setQuickTerminalOpen] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [useFullCommand, setUseFullCommand] = useState(true);

  const molabFullCommand = summary?.molab_command || `curl -fsSL ${window.location.origin}/agent.sh | bash`;
  const molabShortCommand = summary?.molab_short_command || `curl -fsSL ${window.location.origin}/agent.sh | bash`;
  const activeCommand = useFullCommand ? molabFullCommand : molabShortCommand;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(activeCommand);
    setCopiedCommand(true);
    showToast('MoLab connection command copied to clipboard!', 'success');
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  // Historical telemetry arrays
  const [cpuHistory, setCpuHistory] = useState<number[]>([4, 6, 8, 5, 7, 12, 6, 8, 4, 9, 5, 8]);
  const [memHistory, setMemHistory] = useState<number[]>([2.8, 2.8, 2.9, 2.8, 2.8, 2.9, 2.8, 2.8]);
  const [gpuHistory, setGpuHistory] = useState<number[]>([0, 1, 0, 4, 15, 2, 0, 1, 0, 2]);

  const isOnline = summary?.online ?? false;
  const latency = summary?.latency_ms ?? 0;
  const agent = summary?.agent ?? {};
  const telemetry = summary?.telemetry ?? {};
  const cpu = telemetry?.cpu ?? {};
  const mem = telemetry?.memory ?? {};
  const disk = telemetry?.disk ?? {};
  const net = telemetry?.network ?? {};
  const gpu = telemetry?.gpu ?? agent?.gpu ?? {};

  // Update sparklines when new telemetry arrives
  useEffect(() => {
    if (cpu?.cpu_percent !== undefined) {
      setCpuHistory((prev) => [...prev.slice(-28), cpu.cpu_percent]);
    }
    if (mem?.ram_percent !== undefined) {
      setMemHistory((prev) => [...prev.slice(-28), mem.ram_percent]);
    }
    if (gpu?.utilization_pct !== undefined) {
      setGpuHistory((prev) => [...prev.slice(-28), gpu.utilization_pct]);
    }
  }, [telemetry]);

  const handleRunBenchmark = async () => {
    try {
      setBenchmarking(true);
      showToast('Dispatching CUDA benchmark to Blackwell chip...', 'info');
      const res = await api.runGpuBenchmark(benchSize, benchIters);
      setBenchResult(res);
      showToast(`Benchmark complete: ${res.throughput_tflops} TFLOPS measured!`, 'success');
      onRefresh();
    } catch (e: any) {
      showToast(`Benchmark failed: ${e.message}`, 'error');
    } finally {
      setBenchmarking(false);
    }
  };

  const handlePurgeGpuCache = async () => {
    try {
      setPurgingCache(true);
      const res = await api.purgeGpuCache();
      showToast(`PyTorch CUDA cache purged: ${res.freed_mb} MB freed!`, 'success');
      onRefresh();
    } catch (e: any) {
      showToast(`Cache purge failed: ${e.message}`, 'error');
    } finally {
      setPurgingCache(false);
    }
  };

  const tempC = gpu?.temperature_c ?? 29;
  const tempColor = tempC > 75 ? '#ef4444' : tempC > 55 ? '#f59e0b' : '#10b981';
  const tempStatus = tempC > 75 ? 'THROTTLING RISK' : tempC > 55 ? 'MODERATE' : 'OPTIMAL COOL';

  const powerW = gpu?.power_draw_w ?? 77.4;
  const powerLimitW = gpu?.power_limit_w ?? 600.0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2.5rem' }}>
      
      {/* Hero Workstation HUD Banner */}
      <div className="card card-glass card-glow-cyan" style={{
        background: 'linear-gradient(135deg, #091122 0%, #111a36 60%, #171c3b 100%)',
        padding: '1.75rem 2rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.6rem' }}>
            <div className={`pulse-dot ${isOnline ? 'pulse-dot-online' : ''}`} style={{ backgroundColor: isOnline ? '#10b981' : '#f43f5e' }} />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              {agent.hostname || 'MoLab Blackwell Superpod'}
            </h1>
            <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
              <Radio size={12} /> {isOnline ? 'LINKED' : 'OFFLINE'}
            </span>
            <LatencyJitterMeter latencyMs={latency} />
            <span className="badge badge-nvidia">
              <Zap size={12} /> BLACKWELL ARCHITECTURE
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span className="badge badge-tech">{agent.os || 'Linux'} {agent.os_release || '4.19.0-gvisor'}</span>
            <span className="badge badge-tech">{agent.arch || 'x86_64'}</span>
            <span className="badge badge-tech">Python {agent.python_version || '3.13.11'}</span>
            <span className="badge badge-tech" style={{ color: '#38bdf8', borderColor: '#0284c7' }}>
              PyTorch {gpu.torch_version || '2.11.0+cu130'}
            </span>
            <span className="badge badge-tech" style={{ color: '#a3e635', borderColor: '#65a30d' }}>
              CUDA {gpu.cuda_version || '13.0'}
            </span>
          </div>
        </div>

        {/* HUD Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setQuickTerminalOpen(true)}>
            <Terminal size={15} /> Quick Shell Dock
          </button>
          <button className="btn btn-nvidia" onClick={() => onNavigate('gpu')}>
            <Zap size={15} /> GPU Command Center
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('files')}>
            <FolderTree size={15} /> Files
          </button>
          <button className="btn btn-secondary" onClick={onRefresh} title="Refresh telemetry">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Onboarding Banner when Offline */}
      {!isOnline && (
        <div className="card card-glow-cyan" style={{
          background: 'linear-gradient(135deg, #07152b 0%, #0d1e3d 100%)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          padding: '1.5rem 1.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={22} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Connect Your Remote MoLab GPU Pod
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Run this single autonomous setup command in your <b>MoLab Linux terminal</b> (no notebook cell needed):
                </p>
              </div>
            </div>
            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
              Autonomous Setup
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button
              onClick={() => setUseFullCommand(true)}
              className="btn btn-sm"
              style={{
                backgroundColor: useFullCommand ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                borderColor: useFullCommand ? '#38bdf8' : '#1e3050',
                color: useFullCommand ? '#38bdf8' : '#94a3b8',
                fontSize: '0.75rem'
              }}
            >
              Complete A-to-Z Command (All Credentials Explicit)
            </button>
            <button
              onClick={() => setUseFullCommand(false)}
              className="btn btn-sm"
              style={{
                backgroundColor: !useFullCommand ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                borderColor: !useFullCommand ? '#38bdf8' : '#1e3050',
                color: !useFullCommand ? '#38bdf8' : '#94a3b8',
                fontSize: '0.75rem'
              }}
            >
              Compact 1-Liner Installer
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: '#040914',
            border: '1px solid #1e3050',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            flexWrap: 'wrap'
          }}>
            <code className="font-mono" style={{
              flex: 1,
              color: '#a3e635',
              fontSize: '0.85rem',
              wordBreak: 'break-all',
              userSelect: 'all',
              lineHeight: 1.5
            }}>
              {activeCommand}
            </code>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCopyCommand}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
            >
              {copiedCommand ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copiedCommand ? 'Copied!' : 'Copy Command'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' }}>
            <div><span style={{ color: '#38bdf8', fontWeight: 600 }}>Step 1:</span> Open MoLab terminal tab</div>
            <div><span style={{ color: '#38bdf8', fontWeight: 600 }}>Step 2:</span> Paste & press Enter</div>
            <div><span style={{ color: '#38bdf8', fontWeight: 600 }}>Step 3:</span> This dashboard links in ~3 seconds</div>
          </div>
        </div>
      )}

      {/* Primary Hardware Metrics (4 Grid Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        
        {/* CARD 1: NVIDIA RTX PRO 6000 Blackwell Beast */}
        <div className="card card-glow-nvidia" style={{ background: '#0c1424' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#76b900', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                <Zap size={14} /> NVIDIA ACCELERATOR
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', marginTop: '0.15rem' }}>
                RTX PRO 6000 Blackwell
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Driver {gpu.driver_version || '595.71.05'} • Server Edition
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePurgeGpuCache}
              disabled={purgingCache}
              title="Purge PyTorch GPU memory cache (torch.cuda.empty_cache)"
              style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
            >
              <Trash2 size={12} color="#f59e0b" /> Purge Cache
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <CircularGauge
              value={gpu.vram_percent ?? 1.5}
              size={90}
              strokeWidth={8}
              color="#76b900"
              glowColor="rgba(118, 185, 0, 0.4)"
              label={`${(gpu.vram_percent ?? 1.5).toFixed(1)}%`}
              sublabel="VRAM"
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <SegmentBar
                total={gpu.vram_total_gb ?? 94.97}
                used={gpu.vram_used_gb ?? 1.46}
                unit="GB"
                color="#76b900"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>Core Load: <b style={{ color: '#f8fafc' }}>{gpu.utilization_pct ?? 0}%</b></span>
                <span>Limit: <b style={{ color: '#f8fafc' }}>{powerLimitW}W</b></span>
              </div>
            </div>
          </div>

          {/* Thermal & Power Envelopes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            padding: '0.65rem 0.75rem',
            backgroundColor: '#070d18',
            borderRadius: '8px',
            border: '1px solid #162238'
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Flame size={12} color={tempColor} /> THERMAL ZONE
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: tempColor, marginTop: '0.15rem' }}>
                {tempC}°C <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>({tempStatus})</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>POWER DRAW</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.15rem' }}>
                {powerW}W <span style={{ fontSize: '0.65rem', color: '#64748b' }}>/ {powerLimitW}W</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: CPU Compute Cluster (20 Cores) */}
        <div className="card" style={{ background: '#0c1424' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                COMPUTE CLUSTER
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', marginTop: '0.15rem' }}>
                {cpu.cpu_count || agent.cpu_count || 20} Cores Available
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
              {cpu.cpu_percent ?? 0.7}%
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              Micro-Core Grid Activity
            </div>
            <CoreGrid coreCount={cpu.cpu_count || 20} loadPercent={cpu.cpu_percent ?? 0.7} />
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>
              CPU LOAD HISTORY (SPARKLINE)
            </div>
            <Sparkline data={cpuHistory} height={36} color="#38bdf8" />
          </div>
        </div>

        {/* CARD 3: High-Density System Memory (160 GB RAM) */}
        <div className="card" style={{ background: '#0c1424' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ color: '#a855f7', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                SYSTEM MEMORY FLEET
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', marginTop: '0.15rem' }}>
                {mem.ram_total_gb ?? 160.0} GB Capacity
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
              {mem.ram_percent ?? 2.8}%
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <SegmentBar
              total={mem.ram_total_gb ?? 160.0}
              used={mem.ram_used_gb ?? 4.44}
              unit="GB"
              color="#a855f7"
            />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#070d18',
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: '#94a3b8',
            marginBottom: '0.75rem'
          }}>
            <span>Available: <b style={{ color: '#f8fafc' }}>{mem.ram_free_gb ?? 155.56} GB</b></span>
            <span>Pressure: <b style={{ color: '#10b981' }}>NOMINAL (LOW)</b></span>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>
              RAM USAGE HISTORY
            </div>
            <Sparkline data={memHistory} height={34} color="#a855f7" />
          </div>
        </div>

        {/* CARD 4: Storage & Network I/O */}
        <div className="card" style={{ background: '#0c1424' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                POD STORAGE & I/O
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', marginTop: '0.15rem' }}>
                Overlay Root Partition
              </div>
            </div>
            <HardDrive size={20} color="#10b981" />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <SegmentBar
              total={disk.disk_total_gb ?? 100.0}
              used={disk.disk_used_gb ?? 0.22}
              unit="GB"
              color="#10b981"
            />
          </div>

          {/* Network Throughput Box */}
          <div style={{
            padding: '0.65rem 0.75rem',
            backgroundColor: '#070d18',
            borderRadius: '8px',
            border: '1px solid #162238'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>NETWORK BANDWIDTH</span>
              <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Port 443 WSS Tunnel</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>RX: <b style={{ color: '#f8fafc' }}>{net.total_rx_mb ?? 74.6} MB</b></span>
              <span>TX: <b style={{ color: '#f8fafc' }}>{net.total_tx_mb ?? 191.5} MB</b></span>
            </div>
          </div>
        </div>

      </div>

      {/* Multi-Metric Live Stream Spectrum */}
      <MultiMetricChart
        cpuHistory={cpuHistory}
        gpuHistory={gpuHistory}
        memHistory={memHistory}
      />

      {/* GPU Benchmark Studio Widget */}
      <div className="card card-glass" style={{
        backgroundColor: '#0d1629',
        border: '1px solid #1e3357',
        padding: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="#76b900" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                Live Blackwell Tensor Benchmark Studio
              </h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.825rem', marginTop: '0.2rem' }}>
              Execute hardware-synchronized PyTorch matrix multiplications directly on cuda:0 to measure real Blackwell throughput.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>Matrix Size:</span>
              <select
                className="input"
                style={{ width: 'auto', padding: '0.35rem 0.65rem' }}
                value={benchSize}
                onChange={(e) => setBenchSize(Number(e.target.value))}
              >
                <option value={2048}>2048 x 2048 (Fast)</option>
                <option value={4096}>4096 x 4096 (Standard)</option>
                <option value={8192}>8192 x 8192 (Heavy Compute)</option>
              </select>
            </div>

            <button
              className="btn btn-nvidia"
              onClick={handleRunBenchmark}
              disabled={benchmarking || !isOnline}
              style={{ opacity: benchmarking || !isOnline ? 0.6 : 1 }}
            >
              <Play size={14} className={benchmarking ? 'animate-spin' : ''} />
              {benchmarking ? 'Benchmarking cuda:0...' : 'Run Benchmark'}
            </button>
          </div>
        </div>

        {/* Benchmark Results Display */}
        {benchResult && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#091222',
            borderRadius: '10px',
            border: '1px solid rgba(118, 185, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(118, 185, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={24} color="#84cc16" />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#84cc16', fontWeight: 700 }}>
                  BENCHMARK COMPLETE • {benchResult.gpu_name}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                  {benchResult.throughput_tflops} TFLOPS <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>Throughput</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <div>
                <div style={{ color: '#64748b' }}>AVG ITERATION</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                  {benchResult.avg_iteration_ms} ms
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b' }}>TOTAL TIME</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                  {benchResult.total_elapsed_ms} ms
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b' }}>DIMENSIONS</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                  {benchResult.matrix_size}²
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Navigational Hub & System Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div className="card" onClick={() => onNavigate('processes')} style={{ cursor: 'pointer', background: '#0b1324' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>ACTIVE PROCESSES</span>
            <Activity size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0.5rem 0' }}>
            {summary?.processes_count || 120}+
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Inspect & terminate processes <ArrowUpRight size={12} />
          </div>
        </div>

        <div className="card" onClick={() => onNavigate('terminal')} style={{ cursor: 'pointer', background: '#0b1324' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>TERMINAL SESSIONS</span>
            <Terminal size={18} color="#a855f7" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0.5rem 0' }}>
            {summary?.active_terminal_sessions || 1} Active
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Multi-tab PTY interactive shell <ArrowUpRight size={12} />
          </div>
        </div>

        <div className="card" onClick={() => onNavigate('jobs')} style={{ cursor: 'pointer', background: '#0b1324' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>JOB QUEUE</span>
            <Layers size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0.5rem 0' }}>
            {summary?.running_jobs ?? 0} Running <span style={{ fontSize: '0.9rem', color: '#64748b' }}>({summary?.total_jobs ?? 1} Total)</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Async task execution & logs <ArrowUpRight size={12} />
          </div>
        </div>

        <div className="card" onClick={() => onNavigate('audit')} style={{ cursor: 'pointer', background: '#0b1324' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>AUDIT TRAIL</span>
            <ShieldCheck size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0.5rem 0' }}>
            Active SQLite
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Tamper-evident administrative logs <ArrowUpRight size={12} />
          </div>
        </div>
      </div>

      {/* Floating Quick Terminal Drawer */}
      <QuickTerminalDrawer
        isOpen={quickTerminalOpen}
        onClose={() => setQuickTerminalOpen(false)}
      />

    </div>
  );
};
