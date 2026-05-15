import {
  ArrowRight,
  Sparkles,
  MapPin,
  Calendar,
  CheckSquare,
  Users,
} from 'lucide-react';
import { AuthCTAButton } from './AuthCTAButton';

export interface HeroProps {
  isLoggedIn: boolean;
}

export function Hero({ isLoggedIn }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100">
      {/* Decorative blurs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-indigo-300/30 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-32 -right-32 w-[420px] h-[420px] bg-violet-300/30 rounded-full blur-3xl"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-20 sm:pt-20 sm:pb-28 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 bg-white/70 backdrop-blur-sm border border-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            多人即時協作 PWA
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-slate-900 leading-[1.15] tracking-tight">
            跟朋友一起，
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              規劃完美的旅行
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0">
            景點收藏、行程拖拽、費用分帳、待辦清單，
            <br className="hidden sm:block" />
            多人同時編輯，雲端即時同步。
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-center lg:justify-start">
            <AuthCTAButton
              isLoggedIn={isLoggedIn}
              mode="register"
              variant="primary"
              className="px-7 py-4 text-base"
            >
              {isLoggedIn ? '進入我的行程' : '免費開始規劃'}
              <ArrowRight className="w-4 h-4" />
            </AuthCTAButton>

            {!isLoggedIn && (
              <AuthCTAButton
                isLoggedIn={false}
                mode="login"
                variant="secondary"
                className="px-7 py-4 text-base"
              >
                已有帳號？登入
              </AuthCTAButton>
            )}
          </div>

          <p className="mt-5 text-xs text-slate-500">
            完全免費 · 支援手機/平板/桌機 · 可離線使用
          </p>
        </div>

        {/* Phone mockup */}
        <div className="relative flex justify-center lg:justify-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- */
/* Decorative phone mockup — pure CSS, no images                          */
/* --------------------------------------------------------------------- */

function PhoneMockup() {
  return (
    <div className="relative">
      {/* Floating accent badges */}
      <div
        aria-hidden
        className="absolute -top-4 -left-6 bg-white rounded-2xl shadow-xl shadow-indigo-500/20 border border-slate-100 px-3 py-2 flex items-center gap-2 vs-anim-float"
        style={{ animationDelay: '0s' }}
      >
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Users className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <div className="text-[11px] text-slate-400 leading-none">同行</div>
          <div className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">
            4 位夥伴
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute -bottom-4 -right-2 bg-white rounded-2xl shadow-xl shadow-indigo-500/20 border border-slate-100 px-3 py-2 flex items-center gap-2 vs-anim-float"
        style={{ animationDelay: '1.5s' }}
      >
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
          <CheckSquare className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <div className="text-[11px] text-slate-400 leading-none">待辦</div>
          <div className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">
            3/8 完成
          </div>
        </div>
      </div>

      {/* Phone frame */}
      <div className="relative w-[280px] sm:w-[320px] h-[580px] sm:h-[640px] bg-slate-900 rounded-[3rem] p-3 shadow-2xl shadow-indigo-900/30">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-900 rounded-b-2xl z-10" />
        <div className="w-full h-full bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-50 rounded-[2.4rem] overflow-hidden flex flex-col">
          {/* Status bar */}
          <div className="h-7 flex items-center justify-between px-6 pt-1 text-[10px] font-medium text-slate-600 shrink-0">
            <span>9:41</span>
            <span>VoyageStack</span>
          </div>

          {/* Header */}
          <div className="px-5 pt-2 pb-3 shrink-0">
            <div className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide">
              Day 2
            </div>
            <div className="text-base font-bold text-slate-900 leading-tight mt-0.5">
              京都 · 嵐山一日遊
            </div>
          </div>

          {/* Itinerary cards */}
          <div className="flex-1 px-4 space-y-2 overflow-hidden">
            <ItineraryCard time="09:00" title="嵐山竹林小徑" tone="indigo" />
            <ItineraryCard time="10:30" title="天龍寺庭園" tone="violet" />
            <ItineraryCard time="12:00" title="湯豆腐 嵯峨野" tone="amber" />
            <ItineraryCard time="14:00" title="保津川遊船" tone="emerald" highlighted />
            <ItineraryCard time="17:00" title="渡月橋夕景" tone="rose" />
          </div>

          {/* Bottom nav (mock) */}
          <div className="h-14 mx-3 mb-3 mt-2 bg-white/90 backdrop-blur rounded-2xl border border-slate-100 flex items-center justify-around shrink-0">
            {[
              { icon: Calendar, label: '行程', active: true },
              { icon: MapPin, label: '景點' },
              { icon: CheckSquare, label: '待辦' },
              { icon: Users, label: '我的' },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex flex-col items-center gap-0.5 ${
                  active ? 'text-indigo-600' : 'text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const toneStyles: Record<
  string,
  { dot: string; bg: string; pillBg: string; pillText: string }
> = {
  indigo: { dot: 'bg-indigo-500', bg: 'bg-white', pillBg: 'bg-indigo-50', pillText: 'text-indigo-700' },
  violet: { dot: 'bg-violet-500', bg: 'bg-white', pillBg: 'bg-violet-50', pillText: 'text-violet-700' },
  amber:  { dot: 'bg-amber-500',  bg: 'bg-white', pillBg: 'bg-amber-50',  pillText: 'text-amber-700' },
  emerald:{ dot: 'bg-emerald-500',bg: 'bg-white', pillBg: 'bg-emerald-50',pillText: 'text-emerald-700' },
  rose:   { dot: 'bg-rose-500',   bg: 'bg-white', pillBg: 'bg-rose-50',   pillText: 'text-rose-700' },
};

function ItineraryCard({
  time,
  title,
  tone,
  highlighted = false,
}: {
  time: string;
  title: string;
  tone: keyof typeof toneStyles;
  highlighted?: boolean;
}) {
  const t = toneStyles[tone] ?? toneStyles['indigo']!;
  return (
    <div
      className={`flex items-center gap-3 ${t.bg} rounded-xl px-3 py-2.5 border ${
        highlighted
          ? 'border-indigo-300 ring-2 ring-indigo-200/60 shadow-sm'
          : 'border-slate-100'
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${t.dot} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-400 leading-none">{time}</div>
        <div className="text-xs font-semibold text-slate-800 leading-tight mt-0.5 truncate">
          {title}
        </div>
      </div>
      <span
        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${t.pillBg} ${t.pillText}`}
      >
        景點
      </span>
    </div>
  );
}

export default Hero;
