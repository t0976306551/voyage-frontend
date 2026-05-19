'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, AlertTriangle, Loader2, LogOut, UserMinus, ChevronLeft,
  ListChecks, CheckSquare, MapPin, DollarSign, ShieldAlert,
} from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { tripsApi, Trip, LeavePreview } from '@/lib/api/trips.api';

interface Props {
  tripId: string;
  trip: Trip;
  token: string;
  /** The userId of the member that is being removed. */
  targetUserId: string;
  /** true = self-leave; false = Owner kicking someone else. */
  isSelf: boolean;
  /** Fired after a successful removal — parent should close the dialog (and navigate if self). */
  onSuccess: () => void;
  /** Close without removing (cancel button or X). */
  onClose: () => void;
}

type Step = 'preview' | 'confirm';

export function MemberRemovalDialog({
  tripId, trip, token, targetUserId, isSelf, onSuccess, onClose,
}: Props): React.ReactElement {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('preview');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useBodyScrollLock(true);

  const targetName =
    trip.members.find((m) => m.userId === targetUserId)?.name
    || trip.members.find((m) => m.userId === targetUserId)?.email?.split('@')[0]
    || (isSelf ? '你' : '此成員');

  const previewQuery = useQuery<LeavePreview>({
    queryKey: ['trip-leave-preview', tripId, targetUserId],
    queryFn: () => tripsApi.getLeavePreview(tripId, isSelf ? undefined : targetUserId, token),
  });

  const preview = previewQuery.data;
  const canRemove = preview?.canRemove ?? false;

  const removeMutation = useMutation<unknown, Error, void>({
    mutationFn: () => isSelf
      ? tripsApi.leaveTrip(tripId, token)
      : tripsApi.removeMember(tripId, targetUserId, token),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trip', tripId] });
      void qc.invalidateQueries({ queryKey: ['trips'] });
      if (isSelf) {
        qc.removeQueries({ queryKey: ['trip', tripId] });
      }
      onSuccess();
    },
    onError: (err: Error) => {
      const msg = err.message || '';
      if (msg === 'UNSETTLED_DEBTS') {
        // Debts appeared between preview and submit — refresh preview + bounce to step 1.
        setSubmitError('有未還清的費用，無法繼續');
        setStep('preview');
        void previewQuery.refetch();
      } else {
        setSubmitError(isSelf ? '退出失敗，請稍後再試' : '移除失敗，請稍後再試');
      }
    },
  });

  function handleSubmit(): void {
    setSubmitError(null);
    removeMutation.mutate();
  }

  /* ── Derived counts for summaries ── */
  const assignedTaskCount = preview?.assignedTasks.length ?? 0;
  const assignedChecklistCount = preview?.assignedChecklists.length ?? 0;
  const debtCount = preview?.unsettledDebts.length ?? 0;
  const created = preview?.createdContent;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 vs-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-removal-title"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in"
          onClick={removeMutation.isPending ? undefined : onClose}
          aria-hidden
        />

        {/* Dialog panel */}
        <div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 flex flex-col vs-modal-dialog"
          style={{ maxHeight: '85dvh' }}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                step === 'preview'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-red-100 text-red-600'
              }`}>
                {isSelf ? <LogOut className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
              </div>
              <h2 id="member-removal-title" className="text-base font-bold text-slate-900 truncate">
                {step === 'preview'
                  ? (isSelf ? '退出此行程' : `移除 ${targetName}`)
                  : (isSelf ? '確定要退出此行程？' : `確定要移除 ${targetName}？`)
                }
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={removeMutation.isPending}
              aria-label="關閉"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Body */}
          <div
            key={step}
            className="flex-1 overflow-y-auto px-5 py-5 vs-anim-fade-in"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            {/* ── Step 1: Preview ── */}
            {step === 'preview' && (
              <>
                {previewQuery.isLoading && (
                  <div className="space-y-3">
                    <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
                    <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                    <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                  </div>
                )}

                {previewQuery.isError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                    無法載入影響預覽，請稍後再試。
                  </div>
                )}

                {preview && !canRemove && preview.blockReason === 'UNSETTLED_DEBTS' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-red-700">
                            {isSelf
                              ? `無法退出，因為${targetName === '你' ? '你' : ''}還有 ${debtCount} 筆未還費用`
                              : `無法移除，因為 ${targetName} 還有 ${debtCount} 筆未還費用`
                            }
                          </p>
                          <p className="text-xs text-red-600/80 mt-1">
                            請先在「費用分攤」結清以下款項，再回來繼續。
                          </p>
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1.5">
                      {preview.unsettledDebts.map((d) => (
                        <li
                          key={d.expenseId}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-slate-100"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                            <DollarSign className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {d.description || '未命名費用'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              欠 {d.payerName}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                            {d.currency} {d.amount.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview && canRemove && (
                  <div className="space-y-5">
                    {/* Auto-handled section */}
                    {(assignedTaskCount > 0 || assignedChecklistCount > 0) && (
                      <section>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                          即將被自動處理
                        </h3>
                        <ul className="space-y-1.5">
                          {assignedTaskCount > 0 && (
                            <li className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                                <CheckSquare className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                  {assignedTaskCount} 個指派的待辦
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  會被解除指派（待辦本身保留）
                                </p>
                                {preview.assignedTasks.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5">
                                    {preview.assignedTasks.slice(0, 3).map((t) => (
                                      <li key={t.id} className="text-xs text-slate-500 truncate">
                                        · {t.title}
                                      </li>
                                    ))}
                                    {preview.assignedTasks.length > 3 && (
                                      <li className="text-xs text-slate-400">
                                        … 還有 {preview.assignedTasks.length - 3} 個
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </div>
                            </li>
                          )}
                          {assignedChecklistCount > 0 && (
                            <li className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                                <ListChecks className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                  {assignedChecklistCount} 個指派的清單
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  會從清單中移除指派
                                </p>
                                {preview.assignedChecklists.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5">
                                    {preview.assignedChecklists.slice(0, 3).map((c) => (
                                      <li key={c.id} className="text-xs text-slate-500 truncate">
                                        · {c.title}
                                      </li>
                                    ))}
                                    {preview.assignedChecklists.length > 3 && (
                                      <li className="text-xs text-slate-400">
                                        … 還有 {preview.assignedChecklists.length - 3} 個
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </div>
                            </li>
                          )}
                        </ul>
                      </section>
                    )}

                    {/* Kept section */}
                    {created && (created.itineraryItems > 0 || created.checklists > 0 || created.expensesPaidByThem > 0) && (
                      <section>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                          會保留在行程內
                        </h3>
                        <ul className="space-y-1.5">
                          {created.itineraryItems > 0 && (
                            <li className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-4 h-4" />
                              </div>
                              <p className="flex-1 text-sm text-slate-700">
                                <span className="font-semibold">{created.itineraryItems}</span> 個建立的景點
                              </p>
                            </li>
                          )}
                          {created.checklists > 0 && (
                            <li className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                <ListChecks className="w-4 h-4" />
                              </div>
                              <p className="flex-1 text-sm text-slate-700">
                                <span className="font-semibold">{created.checklists}</span> 個建立的清單
                              </p>
                            </li>
                          )}
                          {created.expensesPaidByThem > 0 && (
                            <li className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                <DollarSign className="w-4 h-4" />
                              </div>
                              <p className="flex-1 text-sm text-slate-700">
                                <span className="font-semibold">{created.expensesPaidByThem}</span> 筆付款紀錄
                              </p>
                            </li>
                          )}
                        </ul>
                      </section>
                    )}

                    {/* Nothing-to-handle empty state */}
                    {assignedTaskCount === 0
                      && assignedChecklistCount === 0
                      && created
                      && created.itineraryItems === 0
                      && created.checklists === 0
                      && created.expensesPaidByThem === 0
                    && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-600">
                        {isSelf
                          ? '你沒有指派或建立的資料，可以直接退出。'
                          : `${targetName} 沒有指派或建立的資料，可以直接移除。`}
                      </div>
                    )}

                    {submitError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                        {submitError}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Step 2: Final confirm ── */}
            {step === 'confirm' && preview && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-700">
                        此動作無法復原
                      </p>
                      <p className="text-xs text-red-600/80 mt-1">
                        {isSelf
                          ? '退出後將失去此行程的存取權，需重新被邀請才能回來。'
                          : `${targetName} 將失去此行程的存取權，需重新邀請才能回來。`}
                      </p>
                    </div>
                  </div>
                </div>

                {(assignedTaskCount > 0 || assignedChecklistCount > 0) && (
                  <ul className="space-y-1.5">
                    {assignedTaskCount > 0 && (
                      <li className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        {assignedTaskCount} 個待辦指派會被解除
                      </li>
                    )}
                    {assignedChecklistCount > 0 && (
                      <li className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        {assignedChecklistCount} 個清單指派會被解除
                      </li>
                    )}
                  </ul>
                )}

                {submitError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                    {submitError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="border-t border-slate-100 px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0">
            {step === 'preview' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  取消
                </button>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => { setSubmitError(null); setStep('confirm'); }}
                    disabled={previewQuery.isLoading || !preview}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    繼續
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setSubmitError(null); setStep('preview'); }}
                  disabled={removeMutation.isPending}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一步
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={removeMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-red-500/25"
                >
                  {removeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {removeMutation.isPending
                    ? (isSelf ? '退出中…' : '移除中…')
                    : (isSelf ? '確定退出' : '確定移除')
                  }
                </button>
              </>
            )}
          </footer>
        </div>
      </div>
    </Portal>
  );
}

export default MemberRemovalDialog;
