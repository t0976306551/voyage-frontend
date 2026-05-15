'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ListChecks, Plus, X, Loader2, AlertCircle, Check, Trash2,
  Users as UsersIcon, FileText,
} from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { checklistsApi, ChecklistItem } from '@/lib/api/checklists.api';
import { Trip } from '@/lib/api/trips.api';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Portal } from '@/components/ui/Portal';

interface Props {
  trip: Trip;
  items: ChecklistItem[];
  token: string;
  currentUserId: string;
  canEdit: boolean;
}

function memberLabel(userId: string, currentUserId: string, trip: Trip): string {
  if (userId === currentUserId) return '你';
  const m = trip.members.find((mm) => mm.userId === userId);
  return m?.name || m?.email?.split('@')[0] || userId.slice(0, 4);
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AssigneePill({
  userId, currentUserId, completed, trip,
}: { userId: string; currentUserId: string; completed: boolean; trip: Trip }) {
  const isMe = userId === currentUserId;
  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
        completed
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : isMe
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'bg-slate-50 text-slate-600 border-slate-200'
      }`}
      title={memberLabel(userId, currentUserId, trip)}
    >
      {completed ? <Check className="w-3 h-3" /> : <span className="w-2 h-2 rounded-full bg-current opacity-30" />}
      {memberLabel(userId, currentUserId, trip)}
    </div>
  );
}

function ChecklistCard({
  item, currentUserId, canEdit, trip, onToggle, onDelete,
}: {
  item: ChecklistItem;
  currentUserId: string;
  canEdit: boolean;
  trip: Trip;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
}) {
  const myAssign = item.assignees.find((a) => a.userId === currentUserId);
  const myDone = !!myAssign?.completedAt;
  const isCreator = item.createdById === currentUserId;
  const allDone = item.progress.total > 0 && item.progress.done === item.progress.total;

  return (
    <article className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${allDone ? 'border-emerald-200 shadow-emerald-500/5' : 'border-slate-100 shadow-indigo-500/5'}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold ${allDone ? 'text-emerald-700' : 'text-slate-900'}`}>
              {item.title}
            </h3>
            {item.notes && (
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{item.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-bold ${allDone ? 'text-emerald-600' : 'text-slate-500'}`}>
              {item.progress.done}/{item.progress.total}
            </span>
            {(isCreator || canEdit) && (
              <button
                onClick={onDelete}
                aria-label="刪除"
                className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {item.assignees.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {item.assignees.map((a) => (
                <AssigneePill
                  key={a.userId}
                  userId={a.userId}
                  currentUserId={currentUserId}
                  trip={trip}
                  completed={!!a.completedAt}
                />
              ))}
            </div>
            <ProgressBar done={item.progress.done} total={item.progress.total} />
          </>
        ) : (
          <p className="text-xs text-slate-400 italic">尚未指派任何人</p>
        )}

        {myAssign && (
          <button
            type="button"
            onClick={() => onToggle(!myDone)}
            className={`w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer ${
              myDone
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/30'
            }`}
          >
            {myDone ? <Check className="w-4 h-4" /> : null}
            {myDone ? '已完成（點擊取消）' : '我完成了'}
          </button>
        )}
      </div>
    </article>
  );
}

function CreateChecklistModal({
  trip, token, currentUserId, onClose,
}: { trip: Trip; token: string; currentUserId: string; onClose: () => void }) {
  // memberLabel inherits trip from closure via direct param at call site.

  const qc = useQueryClient();
  useBodyScrollLock(true);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assignAll, setAssignAll] = useState(true);
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(
    new Set(trip.members.map((m) => m.userId)),
  );
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      checklistsApi.create(
        trip.id,
        {
          title: title.trim(),
          notes: notes.trim() || null,
          assigneeIds: assignAll
            ? trip.members.map((m) => m.userId)
            : [...assigneeIds],
        },
        token,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklists', trip.id] });
      onClose();
    },
    onError: (e: Error) => setError(e.message || '建立失敗'),
  });

  function toggleMember(uid: string) {
    setAssigneeIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('請輸入標題'); return; }
    setError('');
    createMutation.mutate();
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] vs-modal-overlay">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog" style={{ maxHeight: '90dvh' }}>
        <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <ListChecks className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">新增協作清單</h2>
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

          <div className="space-y-1.5">
            <label htmlFor="cl-title" className="block text-sm font-medium text-slate-700">
              標題 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <ListChecks className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="cl-title"
                type="text"
                placeholder="例：開通 eSIM、填寫入境卡"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cl-notes" className="block text-sm font-medium text-slate-700">備註</label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <textarea
                id="cl-notes"
                rows={3}
                placeholder="說明、連結、價格..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 resize-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700 inline-flex items-center gap-1.5">
                <UsersIcon className="w-4 h-4" />
                指派給
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignAll}
                  onChange={(e) => setAssignAll(e.target.checked)}
                  className="accent-indigo-600"
                />
                全員都要做（預設）
              </label>
            </div>
            {!assignAll && (
              <div className="flex flex-wrap gap-1.5">
                {trip.members.map((m) => {
                  const on = assigneeIds.has(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => toggleMember(m.userId)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer active:scale-[0.97] ${
                        on
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                      }`}
                    >
                      {memberLabel(m.userId, currentUserId, trip)}
                    </button>
                  );
                })}
              </div>
            )}
            {assignAll && (
              <p className="text-xs text-slate-500">將指派給所有 {trip.members.length} 位成員</p>
            )}
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {createMutation.isPending ? '建立中...' : '建立'}
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
}

export default function ChecklistSection({ trip, items, token, currentUserId, canEdit }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      checklistsApi.toggle(trip.id, itemId, completed, token),
    onMutate: async ({ itemId, completed }) => {
      const prev = qc.getQueryData<ChecklistItem[]>(['checklists', trip.id]);
      qc.setQueryData<ChecklistItem[]>(['checklists', trip.id], (old) => {
        if (!old) return old;
        return old.map((it) => {
          if (it.id !== itemId) return it;
          const newAssignees = it.assignees.map((a) =>
            a.userId === currentUserId
              ? { ...a, completedAt: completed ? new Date().toISOString() : null }
              : a,
          );
          const done = newAssignees.filter((a) => a.completedAt !== null).length;
          return { ...it, assignees: newAssignees, progress: { done, total: it.progress.total } };
        });
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['checklists', trip.id], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['checklists', trip.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => checklistsApi.remove(trip.id, itemId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklists', trip.id] });
      toast.show({ message: '已刪除清單項目', variant: 'success' });
    },
    onError: (e: Error) => toast.show({ message: e.message || '刪除失敗', variant: 'error' }),
  });

  async function confirmDelete(item: ChecklistItem) {
    const ok = await confirm({
      title: `刪除「${item.title}」?`,
      message: '此動作無法還原。',
      danger: true,
      confirmLabel: '刪除',
    });
    if (ok) deleteMutation.mutate(item.id);
  }

  return (
    <section id="section-checklists">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-indigo-500" />
          協作清單
          {items.length > 0 && (
            <span className="text-xs text-slate-400 font-normal">{items.length} 項</span>
          )}
        </h2>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => canEdit && setShowCreate(true)}
          disabled={!canEdit}
          className="w-full bg-white rounded-2xl border-2 border-dashed border-slate-200 px-4 py-8 text-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer text-sm"
        >
          <ListChecks className="w-6 h-6 mx-auto mb-2 opacity-60" />
          還沒有協作清單。
          <br />
          適合：eSIM、入境卡、訂房確認…大家各自打勾的事
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <ChecklistCard
              key={item.id}
              item={item}
              currentUserId={currentUserId}
              canEdit={canEdit}
              trip={trip}
              onToggle={(completed) => toggleMutation.mutate({ itemId: item.id, completed })}
              onDelete={() => void confirmDelete(item)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateChecklistModal
          trip={trip}
          token={token}
          currentUserId={currentUserId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </section>
  );
}
