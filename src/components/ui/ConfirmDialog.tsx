'use client';

import {
  createContext, useCallback, useContext, useState,
} from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { Portal } from '@/components/ui/Portal';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Pass null to hide the cancel button entirely — turns the dialog into a single-action alert. */
  cancelLabel?: string | null;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx.confirm;
}

interface ActiveConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => setActive({ options, resolve }));
  }, []);

  function close(value: boolean) {
    active?.resolve(value);
    setActive(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {active && <ConfirmDialog options={active.options} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  options, onClose,
}: { options: ConfirmOptions; onClose: (value: boolean) => void }) {
  useBodyScrollLock(true);
  const isDanger = !!options.danger;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[90] vs-modal-overlay flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in"
        onClick={() => onClose(false)}
        aria-hidden
      />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog" style={{ maxHeight: '90dvh' }}>
        <header className="flex items-start gap-3 px-6 pt-6 pb-3">
          {isDanger && (
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 id="confirm-title" className="text-base font-bold text-slate-900">
              {options.title}
            </h2>
            {options.message && (
              <p className="text-sm text-slate-500 mt-1.5">{options.message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="關閉"
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex gap-2 px-6 pb-5 pt-3">
          {options.cancelLabel !== null && (
            <button
              type="button"
              onClick={() => onClose(false)}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              {options.cancelLabel ?? '取消'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onClose(true)}
            autoFocus
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-md ${
              isDanger
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/25'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/25'
            }`}
          >
            {options.confirmLabel ?? '確定'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
