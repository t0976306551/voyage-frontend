import Link from 'next/link';
import { Compass } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-slate-50 border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/30">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">
              VoyageStack
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed max-w-xs">
            為朋友與家庭設計的多人旅遊規劃 PWA。
          </p>
        </div>

        {/* Links — only routes that actually exist */}
        <div className="text-sm">
          <div className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-3">
            產品
          </div>
          <ul className="space-y-2">
            <li>
              <Link
                href="/"
                className="text-slate-600 hover:text-indigo-700 transition-colors duration-200"
              >
                首頁
              </Link>
            </li>
            <li>
              <Link
                href="/trips"
                className="text-slate-600 hover:text-indigo-700 transition-colors duration-200"
              >
                我的行程
              </Link>
            </li>
            <li>
              <Link
                href="/profile"
                className="text-slate-600 hover:text-indigo-700 transition-colors duration-200"
              >
                個人頁
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>© {year} VoyageStack. All rights reserved.</span>
          <span>用 ❤️ 為一起去旅行的人做的</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
