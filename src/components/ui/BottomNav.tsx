'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, User } from 'lucide-react';

const tabs = [
  { href: '/',        icon: Home, label: '首頁' },
  { href: '/trips',   icon: Map,  label: '行程' },
  { href: '/profile', icon: User, label: '我的' },
];

export function BottomNav() {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  // Expose actual nav height (incl. safe-area) as `--bottom-nav-h` so floating
  // bottom CTAs (e.g. day-detail "+ 新增景點") can sit above it without overlap.
  useEffect(() => {
    function publish() {
      const el = ref.current;
      const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
      const h = el && isMobile ? Math.ceil(el.getBoundingClientRect().height) : 0;
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
    <nav
      ref={ref}
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-slate-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex max-w-2xl mx-auto">
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 cursor-pointer transition-all duration-200 relative ${
                isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-600 rounded-full" />
              )}
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              <span className={`text-xs font-medium transition-all duration-200 ${isActive ? 'font-semibold' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
