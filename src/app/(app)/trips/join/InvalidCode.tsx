'use client';

import Link from 'next/link';
import { LinkIcon } from 'lucide-react';

export default function InvalidCode() {
  return (
    <main
      className="flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 px-4"
      style={{ minHeight: '100dvh' }}
    >
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-3xl bg-white shadow-lg shadow-indigo-500/20 flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="w-10 h-10 text-indigo-400" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">邀請連結無效</h1>
        <p className="text-sm text-slate-500 mb-8">
          這個邀請連結可能已過期，或者連結不正確。
          <br />
          請向行程擁有者索取新的邀請連結。
        </p>
        <Link
          href="/trips"
          className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/25"
        >
          回到我的行程
        </Link>
      </div>
    </main>
  );
}
