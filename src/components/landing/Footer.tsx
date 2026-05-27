import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-slate-50 border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-master.svg"
              alt=""
              width={32}
              height={32}
              className="w-8 h-8 rounded-xl shadow-md shadow-slate-900/10"
            />
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

