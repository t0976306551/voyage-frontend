'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuthModal } from '@/store/auth-modal.store';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface AuthCTAButtonProps {
  /** When true and logged in, link to /trips instead of opening the modal. */
  isLoggedIn: boolean;
  mode?: 'login' | 'register';
  variant?: Variant;
  children: ReactNode;
  className?: string;
  /** When logged in, where to navigate. Defaults to /trips. */
  loggedInHref?: string;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/25',
  secondary:
    'bg-white text-indigo-700 border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm',
  ghost:
    'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
};

export function AuthCTAButton({
  isLoggedIn,
  mode = 'register',
  variant = 'primary',
  children,
  className = '',
  loggedInHref = '/trips',
}: AuthCTAButtonProps) {
  const openModal = useAuthModal((s) => s.openModal);

  const baseCls =
    'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold active:scale-[0.98] transition-all duration-200 cursor-pointer';
  const cls = `${baseCls} ${variants[variant]} ${className}`;

  if (isLoggedIn) {
    return (
      <Link href={loggedInHref} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => openModal(mode)} className={cls}>
      {children}
    </button>
  );
}

