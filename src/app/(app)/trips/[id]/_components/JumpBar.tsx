'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [activeKey, setActiveKey] = useState<SectionKey | null>(null);
  // Suppress scroll-based activeKey updates briefly after a click so the
  // user-clicked pill stays highlighted during the smooth scroll animation
  // (otherwise scrollY transitions would briefly highlight intermediate sections).
  const suppressUntilRef = useRef<number>(0);

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

  const visible = items.filter((it) => it.enabled);

  // Track which section is currently in view. Pick the last section whose top
  // has scrolled past the jump bar's bottom edge — that's the one the user is
  // looking at. Falls back to the first visible section.
  useEffect(() => {
    if (visible.length <= 1) return;
    function update() {
      // While a click-induced scroll is in progress, respect the explicit
      // intent — don't let intermediate scroll positions overwrite activeKey.
      if (Date.now() < suppressUntilRef.current) return;

      const jumpBar = document.querySelector<HTMLElement>('nav[data-jump-bar]');
      const jumpBarBottom = jumpBar?.getBoundingClientRect().bottom ?? headerH + 44;

      // 1. Bottom-of-page: when the page can't scroll further, the last
      //    section is the one the user is reading even if it hasn't crossed
      //    the probe (handles "clicked 費用 but page ends there" case).
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActiveKey(visible[visible.length - 1]?.key ?? null);
        return;
      }

      // 2. Reading probe — 25% from JumpBar bottom into the visible viewport
      //    (clamped to at least 80px below the bar). Pick whichever section
      //    contains this point.
      const visibleH = window.innerHeight - jumpBarBottom;
      const probe = jumpBarBottom + Math.max(80, visibleH * 0.25);

      let current: SectionKey | null = null;
      for (const it of visible) {
        const el = document.getElementById(`section-${it.key}`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= probe && rect.bottom > probe) {
          current = it.key;
          break;
        }
      }

      // 3. Fallback (small gap between sections): last one whose top crossed.
      if (!current) {
        for (const it of visible) {
          const el = document.getElementById(`section-${it.key}`);
          if (!el) continue;
          if (el.getBoundingClientRect().top <= probe) {
            current = it.key;
          }
        }
      }

      setActiveKey(current ?? visible[0]?.key ?? null);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [visible, headerH]);

  function jumpTo(key: SectionKey) {
    const el = document.getElementById(`section-${key}`);
    if (!el) return;
    const jumpBar = document.querySelector<HTMLElement>('nav[data-jump-bar]');
    // Use the JumpBar's bottom directly — this is the visible reference
    // line for "below the bar". Add 8px breathing room.
    const jumpBarBottom = jumpBar?.getBoundingClientRect().bottom ?? headerH + 44;
    const targetY = Math.max(0, el.getBoundingClientRect().top + window.scrollY - jumpBarBottom - 8);
    // Optimistic: set active immediately so the clicked pill highlights
    // even when the page can't scroll far enough to satisfy the target
    // (still applies bottom padding via TripDetailClient pb-[40vh]).
    setActiveKey(key);
    // Suppress the scroll listener for ~800ms so the smooth-scroll motion
    // doesn't transiently flip activeKey to intermediate sections.
    suppressUntilRef.current = Date.now() + 800;
    const startY = window.scrollY;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
    // Fallback: if the smooth scroll didn't progress within 120ms (some
    // headless/embedded contexts don't honor behavior: 'smooth'), force it.
    if (Math.abs(targetY - startY) > 4) {
      setTimeout(() => {
        if (Math.abs(window.scrollY - startY) < 2) {
          window.scrollTo({ top: targetY });
        }
      }, 120);
    }
  }

  if (visible.length <= 1) return null;

  return (
    <nav
      data-jump-bar
      className="sticky z-[15] bg-white/85 backdrop-blur-md border-b border-slate-100"
      style={{ top: `${headerH}px` }}
      aria-label="跳至段落"
    >
      <div
        className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 md:px-6 max-w-3xl mx-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {visible.map(({ key, label }) => {
          const Icon = ICONS[key];
          const isActive = activeKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => jumpTo(key)}
              aria-current={isActive ? 'true' : undefined}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default JumpBar;
