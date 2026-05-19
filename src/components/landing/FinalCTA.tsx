import { ArrowRight } from 'lucide-react';
import { AuthCTAButton } from './AuthCTAButton';

export interface FinalCTAProps {
  isLoggedIn: boolean;
}

export function FinalCTA({ isLoggedIn }: FinalCTAProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 py-20 sm:py-24">
      {/* Decorative blurs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 w-[420px] h-[420px] bg-violet-300/20 rounded-full blur-3xl"
      />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
          準備好開始你的下一段旅程？
        </h2>
        <p className="mt-4 text-base sm:text-lg text-indigo-100/90 leading-relaxed">
          完全免費註冊，30 秒就能建立第一個行程，邀請你的旅伴一起加入。
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-center">
          <AuthCTAButton
            isLoggedIn={isLoggedIn}
            mode="register"
            variant="primary"
            className="!bg-white !text-indigo-700 hover:!bg-indigo-50 !shadow-xl !shadow-indigo-900/30 px-7 py-4 text-base"
          >
            {isLoggedIn ? '進入我的行程' : '免費建立帳號'}
            <ArrowRight className="w-4 h-4" />
          </AuthCTAButton>

          {!isLoggedIn && (
            <AuthCTAButton
              isLoggedIn={false}
              mode="login"
              variant="ghost"
              className="!text-white hover:!bg-white/10 px-7 py-4 text-base"
            >
              已有帳號？登入
            </AuthCTAButton>
          )}
        </div>

        <p className="mt-5 text-xs text-indigo-200/80">
          無需信用卡 · 雲端即時同步 · 隨時可以離開
        </p>
      </div>
    </section>
  );
}

export default FinalCTA;
