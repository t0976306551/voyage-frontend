import Link from 'next/link';
import { MapPin } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 px-4" style={{ minHeight: '100dvh' }}>
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-3xl bg-white shadow-lg shadow-indigo-500/20 flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-10 h-10 text-indigo-400" strokeWidth={1.5} />
        </div>
        <h1 className="text-6xl font-bold text-slate-900 mb-2">404</h1>
        <p className="text-lg font-semibold text-slate-700 mb-1">找不到這個頁面</p>
        <p className="text-sm text-slate-500 mb-8">
          路徑可能不存在，或者你需要先登入。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/trips"
            className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/25"
          >
            回到我的行程
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 bg-white text-slate-700 border border-slate-200 rounded-xl px-6 py-3 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all"
          >
            返回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}
