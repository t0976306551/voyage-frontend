'use client';

import { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { Portal } from '@/components/ui/Portal';
import { useModalTransition } from '@/lib/hooks/useModalTransition';
import { userApi } from '@/lib/api/user.api';
import { useToast } from '@/components/ui/Toast';

interface Props {
  token: string;
  onClose: () => void;
  open?: boolean;
}

export function ChangePasswordModal({ token, onClose, open = true }: Props) {
  const { mounted, closing } = useModalTransition(open);
  const toast = useToast();
  useBodyScrollLock(mounted);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, loading]);

  const newPwdLengthOk = newPassword.length >= 8;
  const confirmMatches = confirmPassword.length > 0 && confirmPassword === newPassword;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('請輸入舊密碼');
      return;
    }
    if (!newPwdLengthOk) {
      setError('新密碼至少 8 個字元');
      return;
    }
    if (newPassword === currentPassword) {
      setError('新密碼不可與舊密碼相同');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('兩次輸入的新密碼不一致');
      return;
    }

    setLoading(true);
    try {
      await userApi.changePassword(currentPassword, newPassword, token);
      toast.show({ message: '密碼已更新', variant: 'success' });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '更新失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <Portal>
      <div data-vs-closing={closing ? '' : undefined} className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in"
          onClick={() => { if (!loading) onClose(); }}
          aria-hidden
        />
        <form
          onSubmit={submit}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 flex flex-col vs-modal-dialog"
          style={{ maxHeight: '90dvh' }}
        >
          <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/30">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">修改密碼</h2>
                <p className="text-[11px] text-slate-500">需要先輸入舊密碼來驗證身分</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="關閉"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Current password */}
            <div className="space-y-1.5">
              <label htmlFor="cp-current" className="block text-sm font-medium text-slate-700">
                舊密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={firstFieldRef}
                  id="cp-current"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="輸入目前的密碼"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? '隱藏密碼' : '顯示密碼'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <label htmlFor="cp-new" className="block text-sm font-medium text-slate-700">
                新密碼
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="cp-new"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 8 個字元"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? '隱藏密碼' : '顯示密碼'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div
                  className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                    newPwdLengthOk ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 transition-opacity duration-200 ${
                      newPwdLengthOk ? 'opacity-100' : 'opacity-30'
                    }`}
                  />
                  {newPwdLengthOk
                    ? '密碼長度符合要求'
                    : `還需要 ${8 - newPassword.length} 個字元`}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="cp-confirm" className="block text-sm font-medium text-slate-700">
                確認新密碼
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="cp-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再輸入一次新密碼"
                  required
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? '隱藏密碼' : '顯示密碼'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <div
                  className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                    confirmMatches ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 transition-opacity duration-200 ${
                      confirmMatches ? 'opacity-100' : 'opacity-30'
                    }`}
                  />
                  {confirmMatches ? '兩次密碼一致' : '與新密碼不一致'}
                </div>
              )}
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-indigo-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  更新中…
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  更新密碼
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </Portal>
  );
}
