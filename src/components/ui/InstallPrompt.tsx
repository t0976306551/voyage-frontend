'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'vs_install_dismissed_at';
const DISMISS_DAYS = 14;

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already installed (display-mode standalone) → never show.
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed) return;

    // Recently dismissed?
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    const cutoff = Date.now() - DISMISS_DAYS * 24 * 60 * 60 * 1000;
    if (dismissedAt && dismissedAt > cutoff) return;

    function onBefore(e: Event) {
      e.preventDefault();
      // Re-check dismissal every time the event fires (Chrome re-fires on navigation)
      const ts = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
      if (ts && ts > Date.now() - DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    window.addEventListener('beforeinstallprompt', onBefore);

    function onInstalled() {
      setEvent(null);
      setHidden(true);
    }
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || !event) return null;

  function dismiss() {
    setHidden(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') {
      setHidden(true);
    } else {
      dismiss();
    }
    setEvent(null);
  }

  return (
    <div className="fixed bottom-[calc(var(--bottom-nav-h,4rem)+0.5rem)] md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-40 vs-slide-in-bottom">
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/30">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">安裝到主畫面</p>
          <p className="text-xs text-slate-500 mt-0.5">像 App 一樣使用，可離線開啟</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              安裝
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              稍後再說
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="關閉"
          className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;
