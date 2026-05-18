'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, X, Loader2, AlertCircle, Trash2, FileText, Type,
} from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { expensesApi, Expense } from '@/lib/api/expenses.api';
import { Trip } from '@/lib/api/trips.api';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Portal } from '@/components/ui/Portal';
import SectionHeader from '../_components/SectionHeader';

interface Props {
  trip: Trip;
  expenses: Expense[];
  token: string;
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
}

const COMMON_CURRENCIES = ['TWD', 'JPY', 'USD', 'KRW', 'EUR', 'THB'];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function memberShort(uid: string, currentUserId: string, trip: Trip): string {
  if (uid === currentUserId) return '你';
  const m = trip.members.find((mm) => mm.userId === uid);
  return m?.name || m?.email?.split('@')[0] || uid.slice(0, 4).toUpperCase();
}

function memberInitial(label: string): string {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

type SplitMode = 'equal' | 'custom';

function AddExpenseModal({
  trip, currentUserId, token, onClose,
}: { trip: Trip; currentUserId: string; token: string; onClose: () => void }) {
  const qc = useQueryClient();
  useBodyScrollLock(true);
  const memberIds = trip.members.map((m) => m.userId);
  const [payerId, setPayerId] = useState(currentUserId);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(memberIds.map((id) => [id, ''])),
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

  const create = useMutation({
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
      return expensesApi.create(
        trip.id,
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
      onClose();
    },
    onError: (e: Error) => setError(e.message || '建立失敗'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(amt) || amt <= 0) { setError('請輸入有效金額'); return; }
    if (splitMode === 'custom' && !customBalanced) {
      setError(`分攤金額需等於總額（${amt.toFixed(2)}），目前差 ${customDelta.toFixed(2)}`);
      return;
    }
    setError('');
    create.mutate();
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] vs-modal-overlay">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog" style={{ maxHeight: '90dvh' }}>
        <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">新增費用</h2>
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
              <label htmlFor="ex-amount" className="block text-sm font-medium text-slate-700">
                金額 <span className="text-red-400">*</span>
              </label>
              <input
                id="ex-amount"
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
              <label htmlFor="ex-currency" className="block text-sm font-medium text-slate-700">幣別</label>
              <select
                id="ex-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ex-payer" className="block text-sm font-medium text-slate-700">付款人</label>
            <select
              id="ex-payer"
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
            <label htmlFor="ex-desc" className="block text-sm font-medium text-slate-700">描述</label>
            <div className="relative">
              <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="ex-desc"
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
            disabled={create.isPending}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
          >
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {create.isPending ? '建立中...' : '記錄費用'}
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
}

export default function ExpensesSection({ trip, expenses, token, currentUserId, canEdit, canDelete }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      m.set(e.currency, (m.get(e.currency) ?? 0) + Number(e.amount));
    }
    return [...m.entries()];
  }, [expenses]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(trip.id, id, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', trip.id] });
      toast.show({ message: '已刪除費用', variant: 'success' });
    },
    onError: (e: Error) => toast.show({ message: e.message || '刪除失敗', variant: 'error' }),
  });

  async function confirmDelete(e: Expense) {
    const ok = await confirm({
      title: '刪除這筆費用?',
      message: e.description ? `「${e.description}」` : '此動作無法還原。',
      danger: true,
      confirmLabel: '刪除',
    });
    if (ok) deleteMutation.mutate(e.id);
  }

  const subtitle = `${expenses.length} 筆 · ${trip.members.length} 人分攤`;

  return (
    <section id="section-expenses">
      <SectionHeader
        icon={DollarSign}
        iconGradient="amber"
        title="費用"
        subtitle={subtitle}
        action={canEdit ? { label: '新增', onClick: () => setShowAdd(true) } : undefined}
      />

      {totalsByCurrency.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-100 rounded-2xl px-5 py-4 mb-3 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-amber-200/40 blur-2xl" aria-hidden />
          <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide relative">總支出</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 relative">
            {totalsByCurrency.map(([curr, total]) => (
              <div key={curr} className="flex items-baseline gap-1.5">
                <span className="text-xs text-amber-700 font-medium">{curr}</span>
                <span className="text-2xl font-bold text-slate-900 tabular-nums">{fmt(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-indigo-500/5 overflow-hidden">
        {expenses.length === 0 ? (
          <button
            type="button"
            onClick={() => canEdit && setShowAdd(true)}
            disabled={!canEdit}
            className="w-full px-4 py-8 text-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer text-sm"
          >
            還沒有費用，點此新增
          </button>
        ) : (
          <ul className="divide-y divide-slate-100">
            {expenses.map((e) => {
              const payerName = memberShort(e.payerId, currentUserId, trip);
              const isSelf = e.payerId === currentUserId;
              const initial = isSelf ? '你' : memberInitial(payerName);
              return (
                <li key={e.id} className="px-4 py-3 flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-[15px] h-[15px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {e.description || '（無說明）'}
                    </p>
                    <p className="text-xs mt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          isSelf ? 'text-indigo-600 font-medium' : 'text-slate-500'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center bg-gradient-to-br ${
                            isSelf
                              ? 'from-indigo-100 to-violet-200 text-indigo-700'
                              : 'from-slate-100 to-slate-200 text-slate-700'
                          }`}
                        >
                          {initial}
                        </span>
                        {payerName} 付款
                      </span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{fmt(Number(e.amount))}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase">{e.currency}</p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void confirmDelete(e)}
                      aria-label="刪除"
                      className="sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1 rounded hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showAdd && (
        <AddExpenseModal
          trip={trip}
          currentUserId={currentUserId}
          token={token}
          onClose={() => setShowAdd(false)}
        />
      )}
    </section>
  );
}
