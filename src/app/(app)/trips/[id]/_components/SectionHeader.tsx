'use client';

import { LucideIcon, Plus } from 'lucide-react';

type Gradient = 'indigo' | 'violet' | 'emerald' | 'amber';

const GRADIENT_MAP: Record<Gradient, string> = {
  indigo: 'from-indigo-500 to-violet-600 shadow-indigo-500/30',
  violet: 'from-violet-500 to-purple-600 shadow-violet-500/30',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/30',
  amber: 'from-amber-500 to-orange-600 shadow-amber-500/30',
};

interface Props {
  icon: LucideIcon;
  iconGradient: Gradient;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    icon?: LucideIcon;
  };
}

export function SectionHeader({ icon: Icon, iconGradient, title, subtitle, action }: Props) {
  const ActionIcon = action?.icon ?? Plus;
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${GRADIENT_MAP[iconGradient]} text-white flex items-center justify-center shadow-sm flex-shrink-0`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 leading-tight truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ActionIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
          {action.label}
        </button>
      )}
    </div>
  );
}

export default SectionHeader;
