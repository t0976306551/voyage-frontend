'use client';

import { useEffect, useState } from 'react';
import { MapPin, ListChecks, CheckSquare, DollarSign } from 'lucide-react';

export type SectionKey = 'itinerary' | 'checklists' | 'tasks' | 'expenses';

export interface JumpBarItem {
  key: SectionKey;
  label: string;
  enabled: boolean;
}

const ICONS: Record<SectionKey, typeof MapPin> = {
  itinerary: MapPin,
  checklists: ListChecks,
  tasks: CheckSquare,
  expenses: DollarSign,
};

interface Props {
  items: JumpBarItem[];
}

export function JumpBar({ items }: Props) {
  // Measure TripHeader's actual height so the JumpBar sits flush below it
  // regardless of font wrap / publish badge etc.
  const [headerH, setHeaderH] = useState(64);

  useEffect(() => {
    function measure() {
      const h = document.querySelector<HTMLElement>('header[data-trip-header]');
      if (h) setHeaderH(Math.ceil(h.getBoundingClientRect().height));
    }
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    const target = document.querySelector('header[data-trip-header]');
    if (target) ro.observe(target);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  function jumpTo(key: SectionKey) {
    const el = document.getElementById(`section-${key}`);
    if (!el) return;
    const jumpBar = document.querySelector<HTMLElement>('nav[data-jump-bar]');
    const offset = headerH + (jumpBar?.getBoundingClientRect().height ?? 44) + 8;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  const visible = items.filter((it) => it.enabled);
  if (visible.length <= 1) return null;

  return (
    <nav
      data-jump-bar
      className="sticky z-[15] bg-white/85 backdrop-blur-md border-b border-slate-100"
      style={{ top: `${headerH}px` }}
      aria-label="跳至段落"
    >
      <div className="max-w-3xl mx-auto px-2 md:px-6 overflow-x-auto">
        <ul className="flex items-center gap-1 py-2 text-sm" role="list">
          {visible.map(({ key, label }) => {
            const Icon = ICONS[key];
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => jumpTo(key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 active:scale-[0.97] transition-all cursor-pointer whitespace-nowrap"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export default JumpBar;
