'use client';

import Link from 'next/link';
import { Compass, ArrowRight, User } from 'lucide-react';
import { useAuthModal } from '@/store/auth-modal.store';

export interface TopNavProps {
  isLoggedIn: boolean;
}

export function TopNav({ isLoggedIn }: TopNavProps) {
  const openModal = useAuthModal((s) => s.openModal);

  return (
    <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0"
          aria-label="VoyageStack 首頁"
        >
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/30 group-hover:shadow-lg group-hover:shadow-indigo-500/40 transition-all duration-200">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">
            VoyageStack
          </span>
        </Link>

        {/* Right side */}
        {isLoggedIn ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/trips"
              className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-md shadow-indigo-500/25"
            >
              <span className="hidden sm:inline">進入我的行程</span>
              <span className="sm:hidden">我的行程</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/profile"
              aria-label="個人頁"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 border border-slate-200 flex items-center justify-center text-indigo-700 hover:border-indigo-300 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <User className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => openModal('login')}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer"
            >
              登入
            </button>
            <button
              type="button"
              onClick={() => openModal('register')}
              className="bg-indigo-600 text-white rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-md shadow-indigo-500/25"
            >
              免費註冊
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default TopNav;
