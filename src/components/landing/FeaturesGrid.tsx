import {
  Calendar,
  Receipt,
  CheckSquare,
  ListChecks,
  Users,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  tone: 'indigo' | 'violet' | 'amber' | 'emerald' | 'rose' | 'sky';
}

const features: Feature[] = [
  {
    icon: Calendar,
    title: '每日行程編排',
    desc: '按天規劃景點、自訂開始時間與停留長度，拖拉一下就能重新排序。',
    tone: 'indigo',
  },
  {
    icon: Receipt,
    title: '費用分帳',
    desc: '即時記帳、彈性分攤規則，旅程結束自動算出誰該付給誰。',
    tone: 'amber',
  },
  {
    icon: CheckSquare,
    title: '待辦清單',
    desc: '訂房、買票、辦簽證，分工指派與到期日，一個人負責一件事。',
    tone: 'emerald',
  },
  {
    icon: ListChecks,
    title: '協作清單',
    desc: '辦 eSIM、填入境卡這種「大家各自要做」的事，一鍵指派，誰做完了一目了然。',
    tone: 'violet',
  },
  {
    icon: Users,
    title: '即時協作',
    desc: '用邀請碼或連結邀請夥伴加入，多人同時編輯、雲端即時同步。',
    tone: 'rose',
  },
  {
    icon: Smartphone,
    title: '安裝即用 PWA',
    desc: '直接安裝到手機桌面，像 App 一樣使用，免上應用商店。',
    tone: 'sky',
  },
];

const toneClasses: Record<Feature['tone'], { bg: string; text: string }> = {
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-600'  },
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-600'  },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-600'   },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-600'    },
  sky:     { bg: 'bg-sky-100',     text: 'text-sky-600'     },
};

export function FeaturesGrid() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            功能總覽
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            把整趟旅行裝進一個 App
          </h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            從每日行程到分帳對帳，VoyageStack 把多人旅行該有的每件事都做好。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc, tone }) => {
            const t = toneClasses[tone];
            return (
              <div
                key={title}
                className="group relative bg-white border border-slate-200/70 rounded-2xl p-6 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${t.bg} flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110`}
                >
                  <Icon className={`w-6 h-6 ${t.text}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  {title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FeaturesGrid;
