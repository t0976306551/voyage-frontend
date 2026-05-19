'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Map, User, ChevronRight, LogOut,
} from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
  icon: typeof Map;
}

const NAV_LINKS: NavLink[] = [
  { href: '/trips', label: '我的行程', icon: Map },
];

export interface AppTopNavProps {
  /** Trip name to show in the breadcrumb when on /trips/:id */
  currentTripName?: string;
}

export function AppTopNav({ currentTripName }: AppTopNavProps) {
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close avatar menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const isOnTripDetail = /^\/trips\/[^/]+/.test(pathname);

  return (
    <header className="hidden md:block sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Brand */}
        <Link
          href="/trips"
          className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0"
          aria-label="VoyageStack 我的行程"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-master.svg"
            alt=""
            width={36}
            height={36}
            className="w-9 h-9 rounded-xl shadow-md shadow-slate-900/10 group-hover:shadow-lg group-hover:shadow-slate-900/15 transition-all duration-200"
          />
          <span className="font-bold text-slate-900 text-lg tracking-tight">
            VoyageStack
          </span>
        </Link>

        {/* Center nav links */}
        <nav className="flex items-center gap-1 flex-1 justify-center" aria-label="主要導航">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/trips'
                ? pathname === '/trips' || pathname.startsWith('/trips/')
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-indigo-600 bg-indigo-50/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                {label}
                {isActive && (
                  <span className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: avatar menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="個人選單"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 border border-slate-200 flex items-center justify-center text-indigo-700 hover:border-indigo-300 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <User className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl shadow-slate-900/10 border border-slate-100 overflow-hidden z-50 vs-dropdown-in"
            >
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-slate-400" />
                個人頁
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => void signOut({ callbackUrl: '/' })}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 border-t border-slate-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                登出
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumb row (only when on trip detail) */}
      {isOnTripDetail && currentTripName && (
        <div className="max-w-6xl mx-auto px-6 pb-2 -mt-1">
          <nav aria-label="麵包屑" className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link
              href="/trips"
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              我的行程
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-700 font-medium truncate max-w-md">
              {currentTripName}
            </span>
          </nav>
        </div>
      )}
    </header>
  );
}

export default AppTopNav;
