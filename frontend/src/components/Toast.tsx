import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {}
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}>
        {toasts.map((toast) => {
          let bg = '#0f172a';
          let border = '#1e293b';
          let color = '#38bdf8';
          let Icon = Info;

          if (toast.type === 'success') {
            bg = '#071612';
            border = 'rgba(16, 185, 129, 0.4)';
            color = '#10b981';
            Icon = CheckCircle2;
          } else if (toast.type === 'error') {
            bg = '#180b11';
            border = 'rgba(244, 63, 94, 0.4)';
            color = '#fb7185';
            Icon = AlertCircle;
          }

          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: bg,
                border: `1px solid ${border}`,
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                color: '#f8fafc',
                fontSize: '0.85rem',
                minWidth: '280px',
                maxWidth: '420px',
                animation: 'toast-in 0.25s ease-out'
              }}
            >
              <Icon size={18} color={color} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
