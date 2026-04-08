import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Archive } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    pending?.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };

  const isDanger = pending?.variant === 'danger';
  const isWarning = pending?.variant === 'warning';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4"
          onClick={handleCancel}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-5">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                isDanger
                  ? 'bg-rose-100 dark:bg-rose-900/30'
                  : isWarning
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}>
                {isWarning && !isDanger
                  ? <Archive size={24} className="text-amber-500 dark:text-amber-400" />
                  : <AlertTriangle size={24} className={isDanger ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'} />
                }
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{pending.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{pending.message}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                {pending.cancelLabel || '취소'}
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${
                  isDanger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : isWarning
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700'
                }`}
              >
                {pending.confirmLabel || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
