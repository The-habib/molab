import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  isDanger?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmText,
  isDanger,
  danger,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const resolvedDanger = danger ?? isDanger ?? true;
  const resolvedLabel = confirmText ?? confirmLabel ?? 'Confirm';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200
    }}>
      <div style={{
        width: '460px',
        backgroundColor: '#0c1424',
        border: '1px solid #1e2e4a',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: resolvedDanger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle size={20} color={resolvedDanger ? '#ef4444' : '#38bdf8'} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{title}</h3>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${resolvedDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {resolvedLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
