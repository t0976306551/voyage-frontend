import {
  ArrowRight,
  Sparkles,
  Calendar,
  CheckSquare,
  Users,
  ListChecks,
  Receipt,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Settings,
  ClipboardList,
  Check,
  DollarSign,
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
/* Phone mockup — mirrors the real trip detail screen 1:1 (TripHeader +   */
/* JumpBar + ItinerarySection: section header + day pills + day header +  */
/* timeline). Pure CSS, no images.                                        */
/* --------------------------------------------------------------------- */

function PhoneMockup() {
  return (
    <div className="relative">
      {/* Floating accent badges — positioned beside the phone (not above) so
          the sticky TopNav (z-40) never covers them. */}
      <div
        aria-hidden
        className="absolute top-16 -left-4 sm:-left-8 bg-white rounded-2xl shadow-xl shadow-indigo-500/20 border border-slate-100 px-3 py-2 flex items-center gap-2 vs-anim-float z-20"
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
        className="absolute -bottom-3 -right-3 bg-white rounded-2xl shadow-xl shadow-indigo-500/20 border border-slate-100 px-3 py-2 flex items-center gap-2 vs-anim-float z-20"
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
        <div className="w-full h-full bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 rounded-[2.4rem] overflow-hidden flex flex-col">
          {/* Status bar */}
          <div className="h-6 flex items-center justify-between px-6 pt-1 text-[10px] font-medium text-slate-600 shrink-0">
            <span>9:41</span>
            <span>VoyageStack</span>
          </div>

          {/* TripHeader — sticky in real app */}
          <div className="px-3 py-2 bg-white/80 backdrop-blur border-b border-slate-100 shrink-0 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400">
              <ChevronLeft className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-slate-900 leading-tight truncate">
                京都・大阪 6 日
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-500">
                <span className="inline-flex items-center gap-0.5">
                  <Calendar className="w-2.5 h-2.5" />
                  5/8 — 5/13
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Users className="w-2.5 h-2.5" />
                  4 位
                </span>
              </div>
            </div>
            <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
              <Settings className="w-3 h-3" />
            </div>
          </div>

          {/* JumpBar — sticky pills below header */}
          <div className="px-3 py-1.5 bg-white/85 backdrop-blur border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-1">
              {[
                { icon: MapPin, label: '行程', active: true },
                { icon: ListChecks, label: '協作清單' },
                { icon: CheckSquare, label: '待辦' },
                { icon: Receipt, label: '費用' },
              ].map(({ icon: Icon, label, active }) => (
                <div
                  key={label}
                  className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[9px] font-semibold whitespace-nowrap ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-500'
                  }`}
                >
                  <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Body — Itinerary section */}
          <div className="flex-1 px-3 pt-3 overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/30 flex-shrink-0">
                  <MapPin className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-900 leading-none">
                    每日行程
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    6 天 · 8 個景點
                  </div>
                </div>
              </div>
              <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-indigo-600 bg-indigo-50">
                <ClipboardList className="w-2.5 h-2.5" />
                未排定 (1)
              </div>
            </div>

            {/* Day pills */}
            <div className="flex items-center gap-1 mb-2.5">
              {[
                { wd: '五', md: '5/8', dot: true },
                { wd: '六', md: '5/9', active: true, dot: true },
                { wd: '日', md: '5/10', dot: true },
                { wd: '一', md: '5/11' },
                { wd: '二', md: '5/12' },
              ].map((d, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 flex flex-col items-center justify-center w-9 h-11 rounded-lg px-1 ${
                    d.active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                      : 'bg-white border border-slate-200 text-slate-500'
                  }`}
                >
                  <span className="text-[8px] font-semibold uppercase opacity-80 leading-none">
                    {d.wd}
                  </span>
                  <span className="text-[10px] font-bold leading-none mt-1 tabular-nums">
                    {d.md}
                  </span>
                  <span
                    className={`w-1 h-1 rounded-full mt-1 ${
                      d.dot ? (d.active ? 'bg-white/80' : 'bg-indigo-300') : 'bg-transparent'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Day header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm shadow-indigo-500/30 flex-shrink-0 tabular-nums">
                  2
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-900 leading-tight">
                    Day 2 · 5/9 (六)
                  </div>
                  <div className="text-[9px] text-slate-500">4 個景點</div>
                </div>
              </div>
              <div className="text-[10px] font-medium text-indigo-600 inline-flex items-center gap-0.5 flex-shrink-0">
                編輯
                <ChevronRight className="w-2.5 h-2.5" />
              </div>
            </div>

            {/* Timeline */}
            <div className="relative pl-5 mb-3">
              <div className="absolute left-[7px] top-1.5 bottom-1.5 w-0.5 bg-gradient-to-b from-indigo-200 via-indigo-200 to-indigo-50" />
              {[
                { time: '09:00', title: '嵐山竹林小徑' },
                { time: '10:30', title: '天龍寺庭園' },
                { time: '12:00', title: '湯豆腐 嵯峨野' },
              ].map((it, i, arr) => (
                <div key={i} className={`relative ${i === arr.length - 1 ? '' : 'mb-1.5'}`}>
                  {/* Dot */}
                  <div className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center shadow-sm">
                    <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  </div>
                  {/* Card */}
                  <div className="bg-white rounded-lg border border-slate-100 shadow-sm shadow-indigo-500/5 px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-800 leading-tight truncate">
                      {it.title}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600 tabular-nums flex-shrink-0">
                      {it.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 協作清單 mini section */}
            <MiniSection
              icon={ListChecks}
              gradient="from-violet-500 to-purple-600 shadow-violet-500/30"
              title="協作清單"
              subtitle="eSIM、入境卡…"
            >
              <div className="bg-white rounded-lg border border-emerald-200/60 shadow-sm shadow-emerald-500/5 px-2 py-1.5 flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-800 leading-none truncate">
                    購買 eSIM
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full w-3/4 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" />
                    </div>
                    <span className="text-[8px] font-bold text-emerald-600 tabular-nums">3/4</span>
                  </div>
                </div>
                <div className="flex -space-x-1 flex-shrink-0">
                  {[
                    { ch: 'A', tone: 'from-indigo-100 to-violet-200 text-indigo-700' },
                    { ch: 'M', tone: 'from-emerald-100 to-teal-200 text-emerald-700' },
                    { ch: 'L', tone: 'from-amber-100 to-orange-200 text-amber-700' },
                  ].map((a, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full bg-gradient-to-br ${a.tone} border border-white text-[8px] font-bold flex items-center justify-center`}
                    >
                      {a.ch}
                    </div>
                  ))}
                </div>
              </div>
            </MiniSection>

            {/* 待辦 mini section */}
            <MiniSection
              icon={CheckSquare}
              gradient="from-emerald-500 to-teal-600 shadow-emerald-500/30"
              title="待辦"
              subtitle="一人負責一件事"
            >
              <div className="bg-white rounded-lg border border-slate-100 shadow-sm px-2 py-1.5 flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded border-2 border-indigo-500 bg-indigo-500 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2 h-2 text-white" strokeWidth={3} />
                </div>
                <span className="text-[11px] text-slate-400 line-through truncate flex-1 min-w-0">
                  訂日本機票
                </span>
                <span className="text-[8px] font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0">
                  交通
                </span>
                <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded flex-shrink-0">
                  A
                </span>
              </div>
            </MiniSection>

            {/* 費用 mini section */}
            <MiniSection
              icon={DollarSign}
              gradient="from-amber-500 to-orange-600 shadow-amber-500/30"
              title="費用"
              subtitle="自動結算誰該付給誰"
            >
              <div className="bg-white rounded-lg border border-slate-100 shadow-sm px-2 py-1.5 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-800 leading-none truncate">
                    嵐山纜車
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">M 付款 · 4 人分</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[11px] font-bold text-slate-900 tabular-nums leading-none">
                    ¥6,400
                  </div>
                  <div className="text-[8px] text-emerald-600 font-semibold mt-0.5">已結算</div>
                </div>
              </div>
            </MiniSection>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Compact section block reused for 協作清單 / 待辦 / 費用 previews. */
function MiniSection({
  icon: Icon,
  gradient,
  title,
  subtitle,
  children,
}: {
  icon: typeof MapPin;
  gradient: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <div
          className={`w-5 h-5 rounded-md bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-sm flex-shrink-0`}
        >
          <Icon className="w-2.5 h-2.5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold text-slate-900 leading-none">
            {title}
          </div>
          <div className="text-[8px] text-slate-500 leading-none mt-0.5">
            {subtitle}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default Hero;
