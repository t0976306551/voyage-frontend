'use client';

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastInput {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends Required<Pick<ToastInput, 'message'>> {
  id: string;
  variant: ToastVariant;
  action?: ToastAction;
  expiresAt: number;
}

interface ToastContextValue {
  show: (t: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback((input: ToastInput): string => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const duration = input.duration ?? 4000;
    const item: ToastItem = {
      id,
      message: input.message,
      variant: input.variant ?? 'info',
      action: input.action,
      expiresAt: Date.now() + duration,
    };
    setItems((prev) => [...prev, item]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div
        className="fixed top-3 left-1/2 -translate-x-1/2 sm:top-4 sm:left-auto sm:right-4 sm:translate-x-0 z-[100] flex flex-col gap-2 w-[calc(100vw-1.5rem)] sm:w-auto sm:max-w-sm pointer-events-none"
        role="region"
        aria-label="通知"
      >
        {items.map((t) => (
          <ToastRow key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof Info; bg: string; iconBg: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-white border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-white border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  info: {
    icon: Info,
    bg: 'bg-white border-slate-200',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
};

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const cfg = VARIANT_STYLE[item.variant];
  const Icon = cfg.icon;

  function handleAction() {
    item.action?.onClick();
    onDismiss();
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 p-3 pr-2 rounded-2xl border shadow-xl shadow-slate-900/10 ${cfg.bg} pointer-events-auto vs-toast-in`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
        <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
      </div>
      <p className="flex-1 text-sm text-slate-700 pt-1.5">{item.message}</p>
      {item.action && (
        <button
          type="button"
          onClick={handleAction}
          className="px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="關閉通知"
        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
