'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ListChecks, X, Loader2, AlertCircle, Check, Trash2,
  Users as UsersIcon, FileText, Pencil, CheckCircle2, Circle, AlertTriangle,
} from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { checklistsApi, ChecklistItem } from '@/lib/api/checklists.api';
import { Trip } from '@/lib/api/trips.api';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Portal } from '@/components/ui/Portal';
import { SectionHeader } from '../_components/SectionHeader';
import { EditChecklistModal } from '@/components/ui/EditChecklistModal';
import { LinkifyText } from '@/components/ui/LinkifyText';
import { memberLabel } from '@/lib/utils/member-label';

interface Props {
  trip: Trip;
  items: ChecklistItem[];
  token: string;
  currentUserId: string;
  /** Owner or Editor (always). Gates 新增 affordances. */
  canAdd: boolean;
  /** Owner or (Editor && canEditContent). Gates 編輯既有 affordances. */
  canEdit: boolean;
  /** Owner or (Editor && canDeleteContent). Gates 刪除 affordances. */
  canDelete: boolean;
}

function memberInitial(label: string): string {
  return label.charAt(0).toUpperCase();
}

/* ---------------- Avatar pills ---------------- */

function DoneAvatar({ label }: { label: string }) {
  return (
    <span
      className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
    >
      {memberInitial(label)}
    </span>
  );
}

function PendingAvatar({ label }: { label: string }) {
  return (
    <span
      className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
      style={{ background: '#f1f5f9', color: '#64748b', border: '1px dashed #cbd5e1' }}
    >
      {memberInitial(label)}
    </span>
  );
}

function MePendingAvatar({ label }: { label: string }) {
  return (
    <span
      className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
      style={{ background: '#eef2ff', color: '#6366f1', border: '1px dashed #818cf8' }}
    >
      {memberInitial(label)}
    </span>
  );
}

function DoneMemberPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
      <DoneAvatar label={label} />
      <span className="text-xs font-medium text-emerald-800">{label}</span>
      <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={3} />
    </span>
  );
}

function PendingMemberPill({ label, isMe }: { label: string; isMe: boolean }) {
  if (isMe) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
        <MePendingAvatar label={label} />
        <span className="text-xs font-medium text-indigo-700">{label}</span>
        <span className="text-[9px] font-bold text-indigo-500 bg-white px-1 py-0 rounded">待做</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
      <PendingAvatar label={label} />
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </span>
  );
}

/* Compact variant used in partial state's two-column layout */
function DoneMemberPillCompact({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100">
      <span
        className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
      >
        {memberInitial(label)}
      </span>
      <span className="text-[11px] font-medium text-emerald-800">{label}</span>
    </span>
  );
}

function PendingMemberPillCompact({ label, isMe }: { label: string; isMe: boolean }) {
  if (isMe) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200">
        <span
          className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0"
          style={{ background: '#eef2ff', color: '#6366f1', border: '1px dashed #818cf8' }}
        >
          {memberInitial(label)}
        </span>
        <span className="text-[11px] font-medium text-indigo-700">{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200">
      <span
        className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0"
        style={{ background: '#f1f5f9', color: '#64748b', border: '1px dashed #cbd5e1' }}
      >
        {memberInitial(label)}
      </span>
      <span className="text-[11px] font-medium text-slate-600">{label}</span>
    </span>
  );
}

/* ---------------- Checklist card ---------------- */

function ChecklistCard({
  item, currentUserId, canEdit, canDelete, trip, onToggle, onDelete, onEdit,
}: {
  item: ChecklistItem;
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  trip: Trip;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const myAssign = item.assignees.find((a) => a.userId === currentUserId);
  const myDone = !!myAssign?.completedAt;
  const total = item.progress.total;
  const done = item.progress.done;
  const allDone = total > 0 && done === total;
  const noneDone = done === 0;
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  const doneAssignees = item.assignees.filter((a) => a.completedAt !== null);
  const pendingAssignees = item.assignees.filter((a) => a.completedAt === null);

  function handleCheckClick() {
    if (myAssign) onToggle(!myDone);
  }

  /* Status indicator (left of title).
     Rules:
     - If the current user is one of the assignees → always render a toggleable
       button so they can uncheck themselves (even when allDone). Visual style
       follows myDone + allDone: green when team-complete, indigo when only-self.
     - If the current user is NOT an assignee → render a non-interactive disc
       that shows the team's overall completion state. */
  const leftIndicator = myAssign ? (
    <button
      type="button"
      onClick={handleCheckClick}
      aria-label={myDone ? '取消我的完成' : '標記我完成'}
      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all active:scale-90 ${
        myDone && allDone
          ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-2 border-emerald-600 shadow-sm shadow-emerald-500/40'
          : myDone
            ? 'bg-indigo-600 border-2 border-indigo-600 shadow-sm shadow-indigo-500/40'
            : 'bg-white border-2 border-slate-300 hover:border-indigo-400'
      }`}
    >
      {myDone && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
    </button>
  ) : allDone ? (
    <div
      className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/40"
      aria-label="已全部完成"
    >
      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
    </div>
  ) : (
    <div
      className="w-7 h-7 rounded-full border-2 border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0"
      aria-label="非你被指派"
    />
  );

  const cardBase = allDone
    ? 'bg-white rounded-2xl border border-emerald-200/50 overflow-hidden transition-all'
    : 'group bg-white rounded-2xl border border-slate-100 shadow-sm shadow-indigo-500/5 hover:shadow-md hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all duration-200 overflow-hidden';

  const cardStyle = allDone
    ? { boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.2), 0 4px 12px -2px rgba(16, 185, 129, 0.15)' }
    : undefined;

  return (
    <article className={cardBase} style={cardStyle}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        {leftIndicator}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-snug text-slate-900">
              <LinkifyText text={item.title} />
            </h3>
            <div className="flex items-center gap-0.5 -mt-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              {canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label="編輯"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label="刪除"
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {item.notes && (
            <p className="text-xs text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
              <LinkifyText text={item.notes} />
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-1.5">
          {allDone ? (
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
              已全部完成！
            </span>
          ) : noneDone ? (
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
              還沒有人開始
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">進度</span>
          )}
          <span className={`text-xs font-bold tabular-nums ${allDone ? 'text-emerald-600' : 'text-slate-600'}`}>
            {done}/{total}{!allDone && !noneDone ? ' 完成' : ''}
          </span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden ${allDone ? 'bg-emerald-50' : 'bg-slate-100'}`}>
          {allDone ? (
            <div className="vs-checklist-progress-complete h-full rounded-full" style={{ width: '100%' }} />
          ) : noneDone ? (
            <div className="h-full bg-slate-200 rounded-full" style={{ width: '0%' }} />
          ) : (
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          )}
        </div>
      </div>

      {/* Member status */}
      <div className="px-4 py-3">
        {item.assignees.length === 0 ? (
          <p className="text-xs text-slate-400 italic">尚未指派任何人</p>
        ) : allDone ? (
          <>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 inline-flex items-center gap-1">
              <Check className="w-3 h-3" strokeWidth={2.5} />
              完成成員
            </p>
            <div className="flex flex-wrap gap-1.5">
              {doneAssignees.map((a) => (
                <DoneMemberPill
                  key={a.userId}
                  label={memberLabel(a.userId, trip, currentUserId)}
                />
              ))}
            </div>
          </>
        ) : noneDone ? (
          <>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 inline-flex items-center gap-1">
              <Circle className="w-3 h-3" />
              待完成 {pendingAssignees.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pendingAssignees.map((a) => (
                <PendingMemberPill
                  key={a.userId}
                  label={memberLabel(a.userId, trip, currentUserId)}
                  isMe={a.userId === currentUserId}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1.5 inline-flex items-center gap-1">
                <Check className="w-3 h-3" strokeWidth={3} />
                已完成 {doneAssignees.length}
              </p>
              <div className="flex flex-wrap gap-1">
                {doneAssignees.map((a) => (
                  <DoneMemberPillCompact
                    key={a.userId}
                    label={memberLabel(a.userId, trip, currentUserId)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 inline-flex items-center gap-1">
                <Circle className="w-3 h-3" />
                待完成 {pendingAssignees.length}
              </p>
              <div className="flex flex-wrap gap-1">
                {pendingAssignees.map((a) => (
                  <PendingMemberPillCompact
                    key={a.userId}
                    label={memberLabel(a.userId, trip, currentUserId)}
                    isMe={a.userId === currentUserId}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/* ---------------- Create modal (preserved from original) ---------------- */

function CreateChecklistModal({
  trip, token, currentUserId, onClose,
}: { trip: Trip; token: string; currentUserId: string; onClose: () => void }) {
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
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm shadow-violet-500/30">
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
                      {memberLabel(m.userId, trip, currentUserId)}
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

/* ---------------- Section ---------------- */

export default function ChecklistSection({ trip, items, token, currentUserId, canAdd, canEdit, canDelete }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<ChecklistItem | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);

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

  const count = items.length;

  return (
    <section id="section-checklists">
      <SectionHeader
        icon={ListChecks}
        iconGradient="violet"
        title="協作清單"
        subtitle={count > 0 ? `${count} 項 · 大家一起完成` : '大家一起完成'}
        action={canAdd ? {
          label: '新增清單',
          onClick: () => setShowCreate(true),
        } : undefined}
      />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => canAdd && setShowCreate(true)}
          disabled={!canAdd}
          className="w-full bg-white rounded-2xl border-2 border-dashed border-slate-200 px-4 py-8 text-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer text-sm disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-transparent"
        >
          <ListChecks className="w-6 h-6 mx-auto mb-2 opacity-60" />
          還沒有協作清單。
          <br />
          適合：eSIM、入境卡、訂房確認…大家各自打勾的事
        </button>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ChecklistCard
              key={item.id}
              item={item}
              currentUserId={currentUserId}
              canEdit={canEdit}
              canDelete={canDelete}
              trip={trip}
              onToggle={(completed) => toggleMutation.mutate({ itemId: item.id, completed })}
              onDelete={() => void confirmDelete(item)}
              onEdit={() => { setEditingSnapshot(item); setEditingOpen(true); }}
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

      {editingSnapshot && (
        <EditChecklistModal
          open={editingOpen}
          item={editingSnapshot}
          trip={trip}
          token={token}
          currentUserId={currentUserId}
          onClose={() => setEditingOpen(false)}
        />
      )}
    </section>
  );
}
