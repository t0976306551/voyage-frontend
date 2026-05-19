import {
  ArrowRight,
  Sparkles,
  Calendar,
  CheckSquare,
  Users,
  ListChecks,
  Receipt,
  Landmark,
  Utensils,
  Mountain,
  BedDouble,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
            每日行程編排、費用分帳、待辦與協作清單，
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
            完全免費 · 支援手機／平板／桌機 · 可安裝到桌面像 App 一樣使用
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
/* Phone mockup — mirrors the real trip detail screen (day pills +        */
/* timeline cards + JumpBar). Pure CSS, no images.                        */
/* --------------------------------------------------------------------- */

function PhoneMockup() {
  return (
    <div className="relative">
      {/* Floating accent badges — surface signals the screen itself can't fit */}
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
        className="absolute -bottom-3 -right-3 bg-white rounded-2xl shadow-xl shadow-indigo-500/20 border border-slate-100 px-3 py-2 flex items-center gap-2 vs-anim-float"
        style={{ animationDelay: '1.5s' }}
      >
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
          <Receipt className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <div className="text-[11px] text-slate-400 leading-none">分帳</div>
          <div className="text-xs font-semibold text-slate-700 leading-tight mt-0.5">
            自動結算
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

          {/* Trip title */}
          <div className="px-4 pt-2 pb-2 shrink-0">
            <div className="text-sm font-bold text-slate-900 leading-tight">
              京都・大阪 6 日
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">5/8 — 5/13 · 4 位</div>
          </div>

          {/* Day pills — mirrors the real day selector */}
          <div className="px-3 pb-2 shrink-0">
            <div className="flex items-center gap-1.5 overflow-hidden">
              {[
                { md: '5/8', wd: '五' },
                { md: '5/9', wd: '六', active: true },
                { md: '5/10', wd: '日' },
                { md: '5/11', wd: '一' },
                { md: '5/12', wd: '二' },
              ].map((d) => (
                <div
                  key={d.md}
                  className={`flex flex-col items-center justify-center rounded-lg px-1.5 py-1 text-center min-w-[34px] ${
                    d.active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/40'
                      : 'bg-white text-slate-600 border border-slate-100'
                  }`}
                >
                  <span className="text-[8px] leading-none opacity-80">{d.wd}</span>
                  <span className="text-[10px] font-bold leading-tight mt-0.5">{d.md}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day header */}
          <div className="px-4 pb-2 shrink-0 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
              2
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-900 leading-none">
                Day 2 · 5/9 (六)
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">嵐山一日遊</div>
            </div>
          </div>

          {/* Itinerary timeline */}
          <div className="flex-1 px-3 space-y-1.5 overflow-hidden">
            <ItineraryCard
              time="09:00"
              title="嵐山竹林小徑"
              category="景點"
              icon={Landmark}
              tone="indigo"
            />
            <ItineraryCard
              time="10:30"
              title="天龍寺庭園"
              category="景點"
              icon={Landmark}
              tone="indigo"
            />
            <ItineraryCard
              time="12:00"
              title="湯豆腐 嵯峨野"
              category="美食"
              icon={Utensils}
              tone="amber"
            />
            <ItineraryCard
              time="14:00"
              title="保津川遊船"
              category="活動"
              icon={Mountain}
              tone="emerald"
              highlighted
            />
            <ItineraryCard
              time="17:00"
              title="渡月橋夕景"
              category="景點"
              icon={Landmark}
              tone="rose"
            />
            <ItineraryCard
              time="20:00"
              title="嵐山溫泉旅館"
              category="住宿"
              icon={BedDouble}
              tone="sky"
            />
          </div>

          {/* JumpBar — mirrors the real sticky section nav */}
          <div className="mx-3 mb-3 mt-2 px-2 py-1.5 bg-white/90 backdrop-blur rounded-2xl border border-slate-100 flex items-center gap-1 shrink-0">
            {[
              { icon: Calendar, label: '行程', active: true },
              { icon: ListChecks, label: '協作清單' },
              { icon: CheckSquare, label: '待辦' },
              { icon: Receipt, label: '費用' },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded-lg text-[9px] font-semibold ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-400'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="truncate">{label}</span>
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
  { dot: string; pillBg: string; pillText: string }
> = {
  indigo:  { dot: 'bg-indigo-500',  pillBg: 'bg-indigo-50',  pillText: 'text-indigo-700' },
  violet:  { dot: 'bg-violet-500',  pillBg: 'bg-violet-50',  pillText: 'text-violet-700' },
  amber:   { dot: 'bg-amber-500',   pillBg: 'bg-amber-50',   pillText: 'text-amber-700'  },
  emerald: { dot: 'bg-emerald-500', pillBg: 'bg-emerald-50', pillText: 'text-emerald-700'},
  rose:    { dot: 'bg-rose-500',    pillBg: 'bg-rose-50',    pillText: 'text-rose-700'   },
  sky:     { dot: 'bg-sky-500',     pillBg: 'bg-sky-50',     pillText: 'text-sky-700'    },
};

function ItineraryCard({
  time,
  title,
  category,
  icon: Icon,
  tone,
  highlighted = false,
}: {
  time: string;
  title: string;
  category: string;
  icon: LucideIcon;
  tone: keyof typeof toneStyles;
  highlighted?: boolean;
}) {
  const t = toneStyles[tone] ?? toneStyles['indigo']!;
  return (
    <div
      className={`flex items-center gap-2.5 bg-white rounded-xl px-2.5 py-2 border ${
        highlighted
          ? 'border-indigo-300 ring-2 ring-indigo-200/60 shadow-sm shadow-indigo-500/10'
          : 'border-slate-100'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${t.dot} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-slate-400 leading-none font-medium tabular-nums">
          {time}
        </div>
        <div className="text-[11px] font-semibold text-slate-800 leading-tight mt-0.5 truncate">
          {title}
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded ${t.pillBg} ${t.pillText}`}
      >
        <Icon className="w-2.5 h-2.5" />
        {category}
      </span>
    </div>
  );
}

export default Hero;
