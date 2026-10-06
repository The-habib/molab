import React, { useState } from 'react';
import { Zap, Lock, User, AlertCircle } from 'lucide-react';
import { api } from '../api';

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.login(username, password);
      onLoginSuccess(res.username);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#090d16',
      backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(59, 130, 246, 0.08) 0%, transparent 60%)',
      padding: '1.5rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
          }}>
            <Zap size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>Cloud PC Control Plane</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
            Authenticated Infrastructure Management
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
              Username
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={16} color="#64748b" style={{ position: 'absolute', left: '0.75rem' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
              Administrator Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '0.75rem' }} />
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.65rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Control Plane'}
          </button>
        </form>
      </div>
    </div>
  );
};
