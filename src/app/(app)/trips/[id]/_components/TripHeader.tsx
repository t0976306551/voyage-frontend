'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, Settings, ChevronLeft } from 'lucide-react';
import { Trip } from '@/lib/api/trips.api';

interface Props {
  trip: Trip;
  isOwner: boolean;
  token: string;
  onOpenSettings: () => void;
}

export function TripHeader({ trip, isOwner, onOpenSettings }: Props) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Collapse subtitle row when scrolled past 60px (saves vertical space on mobile).
  useEffect(() => {
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCollapsed(window.scrollY > 60));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header
      data-trip-header
      className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 sticky top-0 z-20 md:px-6 md:py-4"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="max-w-3xl mx-auto flex items-center gap-2 min-h-[44px]">
        {/* Back button — mobile only */}
        <button
          onClick={() => router.push('/trips')}
          aria-label="返回行程列表"
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 transition-all flex-shrink-0 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-xl font-bold text-slate-900 truncate leading-tight">{trip.title}</h1>
          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
              collapsed ? 'grid-rows-[0fr] opacity-0 mt-0' : 'grid-rows-[1fr] opacity-100 mt-0.5'
            }`}
          >
            <div className="overflow-hidden">
              <div className="flex items-center gap-x-3 gap-y-0.5 text-xs md:text-sm text-slate-500 flex-nowrap">
                {trip.startDate && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 flex-shrink-0" />
                    <span className="truncate">{trip.startDate}{trip.endDate ? ` — ${trip.endDate}` : ''}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                  <Users className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  {trip.members.length} 位
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <button
              onClick={onOpenSettings}
              aria-label="行程設定"
              title="行程設定"
              className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default TripHeader;
