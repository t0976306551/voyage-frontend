'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Map, User, LogOut, Home,
} from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface NavLink {
  href: string;
  label: string;
  icon: typeof Map;
}

const NAV_LINKS: NavLink[] = [
  { href: '/trips', label: '我的行程', icon: Map },
  { href: '/profile', label: '個人頁', icon: User },
];

function isLinkActive(href: string, pathname: string): boolean {
  if (href === '/trips') {
    return pathname === '/trips' || pathname.startsWith('/trips/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const BRAND_HREF = '/';

/**
 * Tooltip rendered on the right of the rail item, shown via group-hover.
 * Avoids the previous hover-expand-the-whole-rail pattern that overlapped page content.
 */
function RailTooltip({ label }: { label: string }) {
  // 250ms appearance delay so accidental hovers near the rail edge don't flash
  // the tooltip on top of nearby content (e.g. JumpBar tabs at left:64+).
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[70] px-2 py-1 rounded-md bg-slate-900 text-white text-xs font-medium whitespace-nowrap shadow-lg shadow-slate-900/20 opacity-0 -translate-x-1 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-150 delay-200 group-hover/item:delay-300"
    >
      {label}
    </span>
  );
}

export function AppRail() {
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  async function handleLogout() {
    setMenuOpen(false);
    const ok = await confirm({ title: '確定要登出嗎？', confirmLabel: '登出', cancelLabel: '取消' });
    if (ok) void signOut({ callbackUrl: '/' });
  }

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

  return (
    <aside
      style={{ height: '100dvh' }}
      className="hidden md:flex fixed left-0 top-0 z-40 w-16 bg-white/95 backdrop-blur-md border-r border-slate-200 shadow-sm flex-col"
      aria-label="主要導航"
    >
      {/* Brand — never shows active state (it's a logo, not a tab) */}
      <Link
        href={BRAND_HREF}
        className="flex items-center justify-center h-16 flex-shrink-0 cursor-pointer hover:bg-slate-50 transition-colors group/item relative"
        aria-label="VoyageStack 首頁"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-master.svg"
          alt=""
          width={32}
          height={32}
          className="w-8 h-8 rounded-xl shadow-md shadow-slate-900/10 transition-transform group-hover/item:scale-105"
        />
        <RailTooltip label="VoyageStack" />
      </Link>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-2 pt-3" aria-label="主要連結">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isLinkActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`relative flex items-center justify-center h-11 rounded-lg cursor-pointer transition-colors group/item ${
                active
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r-full" />
              )}
              <Icon className={`w-5 h-5 transition-transform duration-150 group-hover/item:scale-110 ${active ? 'scale-110' : ''}`} />
              <RailTooltip label={label} />
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user menu */}
      <div className="relative px-2 pb-4 pt-2 border-t border-slate-100" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="個人選單"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="w-full flex items-center justify-center h-11 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-slate-700 group/item relative"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 border border-slate-200 flex items-center justify-center text-indigo-700">
            <User className="w-4 h-4" />
          </div>
          <RailTooltip label="我的帳號" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute left-full bottom-4 ml-2 w-44 bg-white rounded-xl shadow-xl shadow-slate-900/10 border border-slate-100 overflow-hidden vs-dropdown-in z-[70]"
          >
            <Link
              href="/"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 text-slate-400" />
              首頁
            </Link>
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors cursor-pointer"
            >
              <User className="w-4 h-4 text-slate-400" />
              個人頁
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 border-t border-slate-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              登出
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

