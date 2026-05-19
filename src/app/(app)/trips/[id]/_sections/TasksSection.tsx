'use client';

import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare, Trash2, Calendar, Pencil,
  Smartphone, FileBadge, BedDouble, Plane, ListTodo,
} from 'lucide-react';
import { tasksApi, Task, TaskStatus, TaskCategory } from '@/lib/api/tasks.api';
import { Trip } from '@/lib/api/trips.api';
import { AddTaskModal } from '@/components/ui/AddTaskModal';
import { EditTaskModal } from '@/components/ui/EditTaskModal';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import SectionHeader from '../_components/SectionHeader';
import { LinkifyText } from '@/components/ui/LinkifyText';

interface Props {
  trip: Trip;
  tasks: Task[];
  token: string;
  canEdit: boolean;
  canDelete: boolean;
}

const CATEGORY_CONFIG: Record<TaskCategory, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  bg: string;
  text: string;
}> = {
  esim:          { label: 'eSIM', icon: Smartphone, bg: 'bg-emerald-100', text: 'text-emerald-700' },
  visa:          { label: '證件', icon: FileBadge,  bg: 'bg-amber-100',   text: 'text-amber-700' },
  accommodation: { label: '訂房', icon: BedDouble,  bg: 'bg-blue-100',    text: 'text-blue-700' },
  transport:     { label: '交通', icon: Plane,      bg: 'bg-violet-100',  text: 'text-violet-700' },
  general:       { label: '一般', icon: ListTodo,   bg: 'bg-slate-100',   text: 'text-slate-700' },
};

function memberLabel(userId: string, trip: Trip): string {
  const m = trip.members.find((mm) => mm.userId === userId);
  return m?.name || m?.email?.split('@')[0] || userId.slice(0, 4);
}

function memberInitial(label: string): string {
  // Take the first non-space character (works for both ASCII names and CJK).
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

function dueDateInfo(due: string | null): { label: string; tone: 'overdue' | 'soon' | 'normal' } | null {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(due);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return { label: `已過期 ${Math.abs(days)} 天`, tone: 'overdue' };
  if (days === 0) return { label: '今天到期', tone: 'soon' };
  if (days <= 3) return { label: `${days} 天後到期`, tone: 'soon' };
  return { label: `${days} 天後到期`, tone: 'normal' };
}

export default function TasksSection({ trip, tasks, token, canEdit, canDelete }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.update(trip.id, id, { status }, token),
    onMutate: async ({ id, status }) => {
      const prev = qc.getQueryData<Task[]>(['tasks', trip.id]);
      qc.setQueryData<Task[]>(['tasks', trip.id], (old) =>
        old ? old.map((t) => (t.id === id ? { ...t, status } : t)) : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks', trip.id], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', trip.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(trip.id, id, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', trip.id] });
      toast.show({ message: '已刪除', variant: 'success' });
    },
    onError: (e: Error) => toast.show({ message: e.message || '刪除失敗', variant: 'error' }),
  });

  const sorted = useMemo(() => {
    // pending first (todo, in_progress), then done; within each, by due date asc.
    return [...tasks].sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0;
      const bDone = b.status === 'done' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const ad = a.dueDate ?? '9999';
      const bd = b.dueDate ?? '9999';
      return ad.localeCompare(bd);
    });
  }, [tasks]);

  const doneCount = tasks.filter((t) => t.status === 'done').length;

  async function handleDelete(t: Task) {
    const ok = await confirm({
      title: `刪除「${t.title}」?`,
      message: '此動作無法還原。',
      danger: true,
      confirmLabel: '刪除',
    });
    if (ok) deleteMutation.mutate(t.id);
  }

  const subtitle = tasks.length > 0
    ? `${doneCount} / ${tasks.length} 完成 · 個人任務`
    : '個人任務';

  return (
    <section id="section-tasks">
      <SectionHeader
        icon={CheckSquare}
        iconGradient="emerald"
        title="待辦"
        subtitle={subtitle}
        action={canEdit ? { label: '新增', onClick: () => setShowAdd(true) } : undefined}
      />
      {!canEdit && (
        <p className="text-xs text-slate-400 -mt-2 mb-3" title="僅 Owner / Editor 可新增">僅檢視</p>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-indigo-500/5 overflow-hidden">
        {tasks.length === 0 ? (
          <button
            type="button"
            onClick={() => canEdit && setShowAdd(true)}
            disabled={!canEdit}
            title={canEdit ? undefined : '僅 Owner / Editor 可新增'}
            className="w-full px-4 py-8 text-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer text-sm disabled:cursor-not-allowed"
          >
            還沒有待辦{canEdit && '，點此新增'}
            <br />
            <span className="text-xs text-slate-400">適合：訂機票、辦簽證等一個人負責的任務</span>
          </button>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sorted.map((t) => {
              const done = t.status === 'done';
              const cfg = CATEGORY_CONFIG[t.category];
              const Icon = cfg.icon;
              const due = dueDateInfo(t.dueDate);
              return (
                <li key={t.id} className="px-4 py-3 flex items-start gap-3 group">
                  <button
                    type="button"
                    onClick={() =>
                      updateMutation.mutate({ id: t.id, status: done ? 'todo' : 'done' })
                    }
                    aria-label={done ? '取消完成' : '標記完成'}
                    disabled={!canEdit}
                    title={canEdit ? undefined : '僅 Owner / Editor 可勾選'}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all active:scale-95 ${
                      done
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-white border-slate-300 hover:border-indigo-400'
                    } disabled:cursor-not-allowed`}
                  >
                    {done && <span className="block w-2 h-2 bg-white rounded-sm" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-tight ${
                        done ? 'text-slate-400 line-through' : 'text-slate-800 font-medium'
                      }`}
                    >
                      <LinkifyText text={t.title} />
                    </p>
                    {t.notes && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-line">
                        <LinkifyText text={t.notes} />
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                        <Icon className="w-2.5 h-2.5" />
                        {cfg.label}
                      </span>
                      {due && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
                            due.tone === 'overdue'
                              ? 'bg-red-50 text-red-700'
                              : due.tone === 'soon'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          <Calendar className="w-2.5 h-2.5" />
                          {due.label}
                        </span>
                      )}
                      {t.assignedUserId && (() => {
                        const name = memberLabel(t.assignedUserId, trip);
                        const initial = memberInitial(name);
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md">
                            <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-[8px] font-bold text-slate-700 flex items-center justify-center">
                              {initial}
                            </span>
                            {name}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-start gap-0.5 flex-shrink-0">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingTask(t)}
                        aria-label="編輯"
                        className="mt-0.5 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-slate-300 hover:text-emerald-600 transition-all p-1 rounded hover:bg-emerald-50 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(t)}
                        aria-label="刪除"
                        className="mt-0.5 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1 rounded hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showAdd && (
        <AddTaskModal
          trip={trip}
          token={token}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editingTask && (
        <EditTaskModal
          trip={trip}
          token={token}
          existing={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </section>
  );
}
