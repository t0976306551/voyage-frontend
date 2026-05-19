'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

type Mode = 'login' | 'register';

export interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: Mode;
}

export function LoginModal({ open, onClose, defaultMode = 'login' }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);

  // Safe redirect target from ?next= param — only allow relative paths
  function getPostLoginUrl(): string {
    if (typeof window === 'undefined') return '/trips';
    const next = new URLSearchParams(window.location.search).get('next') ?? '';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/trips';
  }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Reset internal mode whenever the modal is opened with a (potentially) different defaultMode
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError('');
      setLoading(false);
    }
  }, [open, defaultMode]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setError('');
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    if (result?.error) {
      setError('Email 或密碼錯誤，請再試一次');
      setLoading(false);
    } else {
      onClose();
      router.push(getPostLoginUrl());
      router.refresh();
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('請輸入名稱');
      return;
    }
    if (password.length < 8) {
      setError('密碼至少 8 個字元');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env['NEXT_PUBLIC_API_URL']}/api/auth/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            name: name.trim(),
          }),
        },
      );
      const json = (await res.json()) as {
        data: unknown;
        error: { code: string; message: string } | null;
      };

      if (!res.ok || json.error) {
        const code = json.error?.code;
        if (code === 'EMAIL_TAKEN') {
          setError('此 Email 已被使用，請改用登入');
          // auto-flip to login tab so user can switch quickly
          setMode('login');
        } else if (code === 'EMAIL_GOOGLE_ONLY') {
          setError('此 Email 已用 Google 註冊，請使用 Google 登入');
        } else if (code === 'VALIDATION_ERROR') {
          setError(json.error?.message ?? '輸入資料有誤，請再檢查一次');
        } else {
          setError(json.error?.message ?? '註冊失敗，請稍後再試');
        }
        setLoading(false);
        return;
      }

      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (result?.error) {
        setError('帳號建立成功，但自動登入失敗，請手動登入');
        setMode('login');
        setLoading(false);
      } else {
        onClose();
        router.push(getPostLoginUrl());
        router.refresh();
      }
    } catch {
      setError('網路連線錯誤，請重試');
      setLoading(false);
    }
  }

  if (!open) return null;

  const isLogin = mode === 'login';

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] vs-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm vs-anim-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet / Card */}
      <div
        ref={dialogRef}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-indigo-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog"
        style={{ maxHeight: '92dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all duration-200 cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-7 sm:p-8 pt-8">
          {/* Brand */}
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-master.svg"
              alt=""
              width={44}
              height={44}
              className="w-11 h-11 rounded-2xl mb-4 shadow-lg shadow-slate-900/10"
            />
            <h2 id="login-modal-title" className="text-2xl font-bold text-slate-900">
              {isLogin ? '歡迎回來' : '加入 VoyageStack'}
            </h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              {isLogin ? '登入你的 VoyageStack 帳號' : '建立帳號，開始你的旅程'}
            </p>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                isLogin
                  ? 'bg-white text-indigo-700 shadow-sm shadow-indigo-500/10'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              登入
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                !isLogin
                  ? 'bg-white text-indigo-700 shadow-sm shadow-indigo-500/10'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              註冊
            </button>
          </div>

          {/* Error banner — animated slide */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              error ? 'max-h-24 opacity-100 mb-5' : 'max-h-0 opacity-0 mb-0'
            }`}
          >
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>

          <form
            onSubmit={isLogin ? handleLogin : handleRegister}
            className="space-y-5"
          >
            {/* Name (register only) */}
            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="lm-name" className="block text-sm font-medium text-slate-700">
                  名稱
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="lm-name"
                    type="text"
                    placeholder="你的名字"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="lm-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="lm-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="lm-password" className="block text-sm font-medium text-slate-700">
                密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="lm-password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder={isLogin ? '輸入你的密碼' : '至少 8 個字元'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isLogin ? undefined : 8}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label={showPwd ? '隱藏密碼' : '顯示密碼'}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!isLogin && password.length > 0 && (
                <div
                  className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                    password.length >= 8 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 transition-opacity duration-200 ${
                      password.length >= 8 ? 'opacity-100' : 'opacity-30'
                    }`}
                  />
                  {password.length >= 8
                    ? '密碼長度符合要求'
                    : `還需要 ${8 - password.length} 個字元`}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25 mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isLogin ? '登入中...' : '建立中...'}
                </>
              ) : isLogin ? (
                '登入'
              ) : (
                '建立帳號'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-slate-400">或使用以下方式</span>
            </div>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={() => void signIn('google', { callbackUrl: getPostLoginUrl() })}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 rounded-xl px-6 py-3 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            使用 Google {isLogin ? '登入' : '註冊'}
          </button>

          {/* Mode switch hint */}
          <p className="text-center text-sm text-slate-500 mt-6">
            {isLogin ? '還沒有帳號？' : '已有帳號？'}{' '}
            <button
              type="button"
              onClick={() => switchMode(isLogin ? 'register' : 'login')}
              className="text-indigo-600 font-medium hover:text-indigo-700 transition-colors cursor-pointer"
            >
              {isLogin ? '立即註冊' : '直接登入'}
            </button>
          </p>
        </div>
      </div>
    </div>
    </Portal>
  );
}

export default LoginModal;
