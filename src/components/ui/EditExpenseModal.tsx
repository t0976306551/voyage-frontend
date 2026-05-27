'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, X, Loader2, AlertCircle, FileText, Type,
} from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { expensesApi, Expense } from '@/lib/api/expenses.api';
import { Trip } from '@/lib/api/trips.api';
import { useToast } from '@/components/ui/Toast';
import { Portal } from '@/components/ui/Portal';
import { useModalTransition } from '@/lib/hooks/useModalTransition';

interface Props {
  trip: Trip;
  existing: Expense;
  currentUserId: string;
  token: string;
  onClose: () => void;
  open?: boolean;
}

const COMMON_CURRENCIES = ['TWD', 'JPY', 'USD', 'KRW', 'EUR', 'THB'];

type SplitMode = 'equal' | 'custom';

function memberShort(uid: string, currentUserId: string, trip: Trip): string {
  if (uid === currentUserId) return '你';
  const m = trip.members.find((mm) => mm.userId === uid);
  return m?.name || m?.email?.split('@')[0] || uid.slice(0, 4).toUpperCase();
}

/** Infer split mode by comparing each share to amount/n. If all shares within
 * 0.01 of the equal share, treat as 'equal'; otherwise 'custom'. */
function inferSplitMode(existing: Expense, memberIds: string[]): SplitMode {
  const n = memberIds.length;
  if (n === 0) return 'equal';
  const amt = Number(existing.amount);
  const equalShare = amt / n;
  for (const uid of memberIds) {
    const share = Number(existing.splitInfo?.[uid] ?? 0);
    if (Math.abs(share - equalShare) >= 0.01) return 'custom';
  }
  return 'equal';
}

export function EditExpenseModal({
  trip, existing, currentUserId, token, onClose, open = true,
}: Props) {
  const { mounted, closing } = useModalTransition(open);
  const qc = useQueryClient();
  const toast = useToast();
  useBodyScrollLock(mounted);
  const memberIds = trip.members.map((m) => m.userId);

  const [payerId, setPayerId] = useState(existing.payerId);
  const [amount, setAmount] = useState(String(existing.amount));
  const [currency, setCurrency] = useState(existing.currency);
  const [description, setDescription] = useState(existing.description ?? '');
  const [error, setError] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>(() =>
    inferSplitMode(existing, memberIds),
  );
  const [customShares, setCustomShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      memberIds.map((id) => {
        const v = existing.splitInfo?.[id];
        return [id, v != null ? Number(v).toFixed(2) : ''];
      }),
    ),
  );

  const amt = Number(amount);
  const customSum = useMemo(() => {
    let s = 0;
    for (const v of Object.values(customShares)) {
      const n = Number(v);
      if (!Number.isNaN(n)) s += n;
    }
    return s;
  }, [customShares]);
  const customDelta = amt - customSum;
  const customBalanced = !!amount && Math.abs(customDelta) < 0.01;

  function fillEqual() {
    if (!amount || isNaN(amt) || amt <= 0) return;
    const each = (amt / memberIds.length).toFixed(2);
    setCustomShares(Object.fromEntries(memberIds.map((id) => [id, each])));
  }

  const update = useMutation({
    mutationFn: () => {
      const splitInfo: Record<string, number> = {};
      if (splitMode === 'equal') {
        const equalShare = amt / memberIds.length;
        for (const uid of memberIds) splitInfo[uid] = equalShare;
      } else {
        for (const uid of memberIds) {
          const v = Number(customShares[uid] ?? 0);
          if (v > 0) splitInfo[uid] = v;
        }
      }
      return expensesApi.update(
        trip.id,
        existing.id,
        {
          payerId,
          amount: amt,
          currency,
          description: description.trim() || undefined,
          splitInfo,
        },
        token,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', trip.id] });
      toast.show({ message: '已更新費用', variant: 'success' });
      onClose();
    },
    onError: (e: Error) => setError(e.message || '更新失敗'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(amt) || amt <= 0) { setError('請輸入有效金額'); return; }
    if (splitMode === 'custom' && !customBalanced) {
      setError(`分攤金額需等於總額（${amt.toFixed(2)}），目前差 ${customDelta.toFixed(2)}`);
      return;
    }
    setError('');
    update.mutate();
  }

  if (!mounted) return null;

  return (
    <Portal>
    <div data-vs-closing={closing ? '' : undefined} className="fixed inset-0 z-[60] vs-modal-overlay">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog" style={{ maxHeight: '90dvh' }}>
        <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm shadow-amber-500/30">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">編輯費用</h2>
          </div>
          <button onClick={onClose} aria-label="關閉" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={submit} className="p-6 space-y-5">
          <div className={`overflow-hidden transition-all duration-300 ${error ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <label htmlFor="ex-edit-amount" className="block text-sm font-medium text-slate-700">
                金額 <span className="text-red-400">*</span>
              </label>
              <input
                id="ex-edit-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-base font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ex-edit-currency" className="block text-sm font-medium text-slate-700">幣別</label>
              <select
                id="ex-edit-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ex-edit-payer" className="block text-sm font-medium text-slate-700">付款人</label>
            <select
              id="ex-edit-payer"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              {memberIds.map((uid) => (
                <option key={uid} value={uid}>{memberShort(uid, currentUserId, trip)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ex-edit-desc" className="block text-sm font-medium text-slate-700">描述</label>
            <div className="relative">
              <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="ex-edit-desc"
                type="text"
                placeholder="例：第一晚住宿、晚餐"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          {/* Split mode */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">分攤方式</label>
            <div className="inline-flex bg-slate-100 rounded-xl p-1 w-full">
              <button
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  splitMode === 'equal'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                平均分攤（{memberIds.length} 人）
              </button>
              <button
                type="button"
                onClick={() => { setSplitMode('custom'); fillEqual(); }}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  splitMode === 'custom'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                自訂分攤
              </button>
            </div>
            {splitMode === 'equal' && (
              <p className="text-xs text-slate-500 inline-flex items-start gap-1.5">
                <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {amount ? `每人 ${(amt / memberIds.length).toFixed(2)} ${currency}` : `輸入金額後自動算每人份額`}
              </p>
            )}
            {splitMode === 'custom' && (
              <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
                {memberIds.map((uid) => (
                  <div key={uid} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-700 truncate">
                      {memberShort(uid, currentUserId, trip)}
                    </span>
                    <div className="relative w-32">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={customShares[uid] ?? ''}
                        onChange={(e) =>
                          setCustomShares((prev) => ({ ...prev, [uid]: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm text-right focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{currency}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={fillEqual}
                    className="text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                  >
                    平均填入
                  </button>
                  <span className={`font-medium ${customBalanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                    已分攤 {customSum.toFixed(2)} / {amount ? amt.toFixed(2) : '0.00'}
                    {!customBalanced && amount && ` (差 ${customDelta.toFixed(2)})`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={update.isPending}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:from-amber-600 hover:to-orange-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-500/25"
          >
            {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {update.isPending ? '儲存中...' : '儲存變更'}
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
}

