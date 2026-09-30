import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

interface ToastItem {
  id: string;
  msg: string;
  type: ToastType;
}

interface ToastContextType {
  push: (msg: string, type?: ToastType, durationMs?: number) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  push: () => '',
  dismiss: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((msg: string, type: ToastType = 'info', durationMs = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, msg, type }]);
    if (durationMs > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, durationMs);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="fixed top-2 left-3 right-3 max-w-[380px] mx-auto flex flex-col gap-2 pointer-events-none z-[9999]">
        {toasts.map(t => {
          let borderCls = 'border-slate-700 bg-slate-900/95';
          let icon = <Info size={16} className="text-teal-400 mt-0.5 shrink-0" />;
          if (t.type === 'error') {
            borderCls = 'border-rose-500/50 bg-rose-950/95 text-rose-100';
            icon = <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />;
          } else if (t.type === 'warn') {
            borderCls = 'border-amber-500/50 bg-amber-950/95 text-amber-100';
            icon = <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />;
          } else if (t.type === 'success') {
            borderCls = 'border-emerald-500/50 bg-emerald-950/95 text-emerald-100';
            icon = <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto shadow-2xl backdrop-blur-md px-3.5 py-2.5 text-xs flex items-start gap-2.5 rounded-2xl border transition-all duration-300 animate-m3-slide-down ${borderCls}`}
            >
              {icon}
              <span className="flex-1 font-medium leading-snug">{t.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
