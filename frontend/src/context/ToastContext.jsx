import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS   = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
const COLORS  = {
  success: 'text-celadon  border-celadon/30  bg-celadon/10',
  error:   'text-red-400  border-red-400/30  bg-red-400/10',
  warning: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  info:    'text-periwinkle border-periwinkle/30 bg-periwinkle/10',
};

function Toast({ message, type, onDismiss }) {
  const Icon = ICONS[type] || Info;
  return (
    <div className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl bg-card/95 backdrop-blur-sm max-w-sm w-full animate-fade-in-up ${COLORS[type]}`}>
      <Icon size={15} className="shrink-0" />
      <p className="text-sm flex-1 text-ink">{message}</p>
      <button onClick={onDismiss} className="shrink-0 text-muted hover:text-thistle transition-colors">
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{ add }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onDismiss={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
