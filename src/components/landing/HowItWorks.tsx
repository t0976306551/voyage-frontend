import { Plus, Send, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Step {
  num: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

const steps: Step[] = [
  {
    num: '01',
    icon: Plus,
    title: '建立行程',
    desc: '為下一趟旅行命名，設定日期，挑一張封面圖。',
  },
  {
    num: '02',
    icon: Send,
    title: '邀請夥伴',
    desc: '分享一組邀請碼，朋友 30 秒內就能加入協作。',
  },
  {
    num: '03',
    icon: Sparkles,
    title: '即時協作',
    desc: '同時編輯景點、行程、費用與待辦，所有變更雲端即時同步。',
  },
];

export function HowItWorks() {
  return (
    <section className="bg-gradient-to-b from-white via-indigo-50/40 to-white py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            怎麼開始
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            三步驟，開啟一場說走就走的旅行
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
          {/* Connector line (desktop) */}
          <div
            aria-hidden
            className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-indigo-200 via-violet-200 to-indigo-200"
          />

          {steps.map(({ num, icon: Icon, title, desc }) => (
            <div
              key={num}
              className="relative bg-white border border-slate-200/70 rounded-2xl p-6 sm:p-7 text-center md:text-left shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200"
            >
              <div className="relative inline-flex">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mx-auto md:mx-0">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 bg-white border border-indigo-100 rounded-full text-[11px] font-bold text-indigo-600 flex items-center justify-center shadow-sm">
                  {num}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mt-5 mb-1.5">
                {title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

