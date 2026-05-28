'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, User } from 'lucide-react';
import { triggerNavigationGuard } from '@/lib/hooks/useNavigationGuard';

const tabs = [
  { href: '/',        icon: Home, label: '首頁' },
  { href: '/trips',   icon: Map,  label: '行程' },
  { href: '/profile', icon: User, label: '我的' },
];

export function BottomNav() {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  // Expose total space from nav top to screen bottom as `--bottom-nav-h` so
  // floating bottom CTAs (e.g. day-detail "+ 新增景點") can sit above it without overlap.
  // Uses distance-from-top instead of element height to account for the floating offset.
  useEffect(() => {
    function publish() {
      const el = ref.current;
      const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
      const h = el && isMobile
        ? Math.ceil(window.innerHeight - el.getBoundingClientRect().top)
        : 0;
      document.documentElement.style.setProperty('--bottom-nav-h', `${h}px`);
    }
    publish();
    const ro = new ResizeObserver(publish);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', publish);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
      document.documentElement.style.setProperty('--bottom-nav-h', '0px');
    };
  }, []);

  return (
    <>
    {/* Floor: fills the gap below the floating nav so scrolling content doesn't show through */}
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-[49]"
      style={{ height: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      aria-hidden="true"
    />
    <nav
      ref={ref}
      className="md:hidden fixed left-3 right-3 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100/80 shadow-lg shadow-slate-900/10 z-50"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="relative flex max-w-2xl mx-auto">
        {/* Sliding background pill */}
        <span
          className="absolute top-1/2 -translate-y-1/2 h-11 w-14 bg-indigo-50 rounded-2xl transition-all duration-300 ease-out pointer-events-none"
          style={{
            left: `calc(${tabs.findIndex(({ href }) => href === '/' ? pathname === '/' : pathname?.startsWith(href))} / ${tabs.length} * 100% + 100% / ${tabs.length * 2} - 1.75rem)`,
          }}
        />
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={(e) => { if (triggerNavigationGuard(href)) e.preventDefault(); }}
              className={`relative z-10 flex-1 flex flex-col items-center py-2 gap-0.5 cursor-pointer transition-all duration-200 ${
                isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              <span className={`text-xs transition-all duration-200 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
