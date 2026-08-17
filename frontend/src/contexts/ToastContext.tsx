import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, Info, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'info' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" style={{
            backgroundColor: toast.type === 'error' ? 'var(--error)' : 
                             toast.type === 'info' ? 'var(--secondary-color)' : 
                             'var(--primary-color)'
          }}>
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
