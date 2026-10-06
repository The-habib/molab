import React, { useState } from 'react';
import { Settings, Shield, Key, Bell, Save } from 'lucide-react';
import { useToast } from '../components/Toast';

export const SettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const [requireConfirm, setRequireConfirm] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState('3000');
  const [dangerZoneProtection, setDangerZoneProtection] = useState(true);

  const handleSave = () => {
    showToast('Control plane preferences saved', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Settings size={20} color="#38bdf8" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc' }}>
            Control Plane Security & Preferences
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Setting 1 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #1e293b' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>Destructive Action Confirmation</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Require modal confirmation before process kill, service stop, or file deletion</div>
            </div>
            <input
              type="checkbox"
              checked={requireConfirm}
              onChange={(e) => setRequireConfirm(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer' }}
            />
          </div>

          {/* Setting 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #1e293b' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>Root Filesystem Protection</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Enforce strict write and delete locks on /, /etc, /bin, and system directories</div>
            </div>
            <input
              type="checkbox"
              checked={dangerZoneProtection}
              onChange={(e) => setDangerZoneProtection(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer' }}
            />
          </div>

          {/* Setting 3 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>Telemetry Refresh Interval</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Heartbeat telemetry sampling rate from remote agent</div>
            </div>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.85rem'
              }}
            >
              <option value="1000">1 Second (High Frequency)</option>
              <option value="3000">3 Seconds (Standard)</option>
              <option value="5000">5 Seconds (Low Bandwidth)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={14} /> Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
