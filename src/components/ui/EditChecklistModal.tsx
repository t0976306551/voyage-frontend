'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ListChecks, X, Loader2, AlertCircle, FileText, Users as UsersIcon,
} from 'lucide-react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { checklistsApi, ChecklistItem } from '@/lib/api/checklists.api';
import { Trip } from '@/lib/api/trips.api';
import { useToast } from '@/components/ui/Toast';
import { Portal } from '@/components/ui/Portal';
import { useModalTransition } from '@/lib/hooks/useModalTransition';
import { memberLabel } from '@/lib/utils/member-label';

interface Props {
  item: ChecklistItem;
  trip: Trip;
  token: string;
  currentUserId: string;
  onClose: () => void;
  open?: boolean;
}


export function EditChecklistModal({ item, trip, token, currentUserId, onClose, open = true }: Props) {
  const { mounted, closing } = useModalTransition(open);
  const qc = useQueryClient();
  const toast = useToast();
  useBodyScrollLock(mounted);

  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(
    new Set(item.assignees.map((a) => a.userId)),
  );
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: () =>
      checklistsApi.update(
        trip.id,
        item.id,
        {
          title: title.trim(),
          notes: notes.trim() ? notes.trim() : null,
          assigneeIds: [...assigneeIds],
        },
        token,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklists', trip.id] });
      toast.show({ message: '已更新清單項目', variant: 'success' });
      onClose();
    },
    onError: (e: Error) => setError(e.message || '更新失敗'),
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
    if (!title.trim()) {
      setError('請輸入標題');
      return;
    }
    setError('');
    updateMutation.mutate();
  }

  if (!mounted) return null;

  return (
    <Portal>
      <div data-vs-closing={closing ? '' : undefined} className="fixed inset-0 z-[60] vs-modal-overlay">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in"
          onClick={onClose}
          aria-hidden
        />
        <div
          className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog"
          style={{ maxHeight: '90dvh' }}
        >
          <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm shadow-violet-500/30">
                <ListChecks className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">編輯協作清單</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="關閉"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
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
              <label htmlFor="cl-edit-title" className="block text-sm font-medium text-slate-700">
                標題 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <ListChecks className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="cl-edit-title"
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
              <label htmlFor="cl-edit-notes" className="block text-sm font-medium text-slate-700">備註</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <textarea
                  id="cl-edit-notes"
                  rows={7}
                  placeholder="說明、連結、價格..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 resize-y min-h-[120px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 inline-flex items-center gap-1.5">
                <UsersIcon className="w-4 h-4" />
                指派給
                <span className="text-xs text-slate-400 font-normal">
                  ({assigneeIds.size} / {trip.members.length})
                </span>
              </label>
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
              {assigneeIds.size === 0 && (
                <p className="text-xs text-amber-600">尚未指派任何人</p>
              )}
            </div>

            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {updateMutation.isPending ? '儲存中...' : '儲存變更'}
            </button>
          </form>
        </div>
      </div>
    </Portal>
  );
}

