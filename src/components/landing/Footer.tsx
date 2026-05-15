import Link from 'next/link';
import { Compass } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-slate-50 border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 items-start">
        {/* Brand */}
        <div className="sm:col-span-1">
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

        {/* Links */}
        <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
          <FooterCol title="產品">
            <FooterLink href="/">首頁</FooterLink>
            <FooterLink href="/trips">我的行程</FooterLink>
          </FooterCol>
          <FooterCol title="關於">
            <FooterLink href="#">關於我們</FooterLink>
            <FooterLink href="#">部落格</FooterLink>
          </FooterCol>
          <FooterCol title="法律">
            <FooterLink href="#">隱私權政策</FooterLink>
            <FooterLink href="#">使用條款</FooterLink>
          </FooterCol>
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

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-3">
        {title}
      </div>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-slate-600 hover:text-indigo-700 transition-colors duration-200"
      >
        {children}
      </Link>
    </li>
  );
}

export default Footer;
