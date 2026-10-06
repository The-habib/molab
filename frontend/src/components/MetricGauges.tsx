import React, { useState } from 'react';

interface CircularGaugeProps {
  value: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  glowColor?: string;
  label?: string;
  sublabel?: string;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  value,
  size = 120,
  strokeWidth = 10,
  color = '#00f2fe',
  glowColor = 'rgba(0, 242, 254, 0.3)',
  label,
  sublabel
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#16233b"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
            filter: `drop-shadow(0 0 6px ${glowColor})`
          }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: `${size * 0.22}px`, fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
          {label ?? `${Math.round(value)}%`}
        </span>
        {sublabel && (
          <span style={{ fontSize: `${size * 0.1}px`, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};

interface SparklineProps {
  data: number[];
  width?: number | string;
  height?: number;
  color?: string;
  fillColor?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = '100%',
  height = 50,
  color = '#38bdf8'
}) => {
  if (!data || data.length < 2) {
    return <div style={{ height, width, background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }} />;
  }

  const min = Math.min(...data, 0);
  const max = Math.max(...data, 100);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 300;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L 300,${height} L 0,${height} Z`;

  return (
    <div style={{ width, height, position: 'relative' }}>
      <svg viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#spark-grad-${color.replace('#', '')})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

interface MultiMetricChartProps {
  cpuHistory: number[];
  gpuHistory: number[];
  memHistory: number[];
}

export const MultiMetricChart: React.FC<MultiMetricChartProps> = ({
  cpuHistory,
  gpuHistory,
  memHistory
}) => {
  const [activeMetric, setActiveMetric] = useState<'all' | 'cpu' | 'gpu' | 'mem'>('all');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const len = Math.max(cpuHistory.length, gpuHistory.length, memHistory.length, 10);
  const width = 600;
  const height = 140;

  const renderPath = (data: number[], color: string, gradId: string) => {
    if (!data || data.length < 2) return null;
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - (Math.min(100, Math.max(0, val)) / 100) * (height - 16) - 8;
      return `${x},${y}`;
    });
    const pathD = `M ${points.join(' L ')}`;
    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

    return (
      <g key={color}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  };

  return (
    <div style={{
      backgroundColor: '#0a101d',
      border: '1px solid #1a273f',
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>REAL-TIME TELEMETRY SPECTRUM</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} /> CPU
            </span>
            <span style={{ color: '#76b900', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#76b900' }} /> GPU
            </span>
            <span style={{ color: '#a855f7', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }} /> RAM
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'cpu', 'gpu', 'mem'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setActiveMetric(m)}
              className={`btn btn-sm ${activeMetric === m ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', textTransform: 'uppercase' }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height, position: 'relative' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((pct, idx) => (
            <line
              key={idx}
              x1="0"
              y1={height * pct}
              x2={width}
              y2={height * pct}
              stroke="#141f33"
              strokeDasharray="4 4"
            />
          ))}

          {(activeMetric === 'all' || activeMetric === 'cpu') && renderPath(cpuHistory, '#38bdf8', 'cpu-grad')}
          {(activeMetric === 'all' || activeMetric === 'gpu') && renderPath(gpuHistory, '#76b900', 'gpu-grad')}
          {(activeMetric === 'all' || activeMetric === 'mem') && renderPath(memHistory, '#a855f7', 'mem-grad')}
        </svg>
      </div>
    </div>
  );
};

export const LatencyJitterMeter: React.FC<{ latencyMs: number }> = ({ latencyMs }) => {
  let color = '#10b981';
  let quality = 'EXCELLENT';
  if (latencyMs > 500) {
    color = '#f59e0b';
    quality = 'FAIR';
  }
  if (latencyMs > 1000) {
    color = '#ef4444';
    quality = 'HIGH';
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.6rem',
      padding: '0.35rem 0.65rem',
      backgroundColor: '#0c1424',
      borderRadius: '6px',
      border: '1px solid #1a273f',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '12px' }}>
        <span style={{ width: '3px', height: '4px', backgroundColor: color, borderRadius: '1px' }} />
        <span style={{ width: '3px', height: '8px', backgroundColor: color, borderRadius: '1px' }} />
        <span style={{ width: '3px', height: '12px', backgroundColor: latencyMs > 800 ? '#334155' : color, borderRadius: '1px' }} />
      </div>
      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{Math.round(latencyMs)}ms</span>
      <span style={{ color, fontSize: '0.7rem', fontWeight: 700 }}>({quality})</span>
    </div>
  );
};

interface CoreGridProps {
  coreCount: number;
  loadPercent: number;
}

export const CoreGrid: React.FC<CoreGridProps> = ({ coreCount, loadPercent }) => {
  const cores = Array.from({ length: Math.min(coreCount || 20, 32) }, (_, i) => {
    const variation = Math.sin(i * 1.5) * 15;
    const coreLoad = Math.max(2, Math.min(100, loadPercent + variation));
    return { id: i, load: coreLoad };
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(10, 1fr)',
      gap: '4px',
      padding: '0.5rem',
      backgroundColor: '#0c1322',
      borderRadius: '8px',
      border: '1px solid #1a273f'
    }}>
      {cores.map((c) => {
        let bg = '#1e293b';
        if (c.load > 75) bg = '#ef4444';
        else if (c.load > 40) bg = '#f59e0b';
        else if (c.load > 15) bg = '#38bdf8';
        else bg = '#10b981';

        return (
          <div
            key={c.id}
            title={`Core #${c.id}: ${Math.round(c.load)}%`}
            style={{
              height: '14px',
              borderRadius: '2px',
              backgroundColor: bg,
              opacity: 0.85,
              transition: 'all 0.3s'
            }}
          />
        );
      })}
    </div>
  );
};

interface SegmentBarProps {
  total: number;
  used: number;
  unit?: string;
  color?: string;
}

export const SegmentBar: React.FC<SegmentBarProps> = ({
  total,
  used,
  unit = 'GB',
  color = '#76b900'
}) => {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const free = Math.max(0, total - used);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: '#94a3b8',
        fontFamily: 'var(--font-mono)'
      }}>
        <span>USED: <b style={{ color: '#f8fafc' }}>{used.toFixed(1)} {unit}</b> ({pct.toFixed(1)}%)</span>
        <span>FREE: <b style={{ color: '#f8fafc' }}>{free.toFixed(1)} {unit}</b></span>
      </div>
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#152136',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid #1f2f4c'
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: '3px',
          boxShadow: `0 0 10px ${color}`,
          transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }} />
      </div>
    </div>
  );
};
