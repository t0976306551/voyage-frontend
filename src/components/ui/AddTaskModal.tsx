'use client';

import { useState } from 'react';
import type { ComponentType, FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare, X, Loader2, AlertCircle, Calendar, User, FileText,
  Smartphone, FileBadge, BedDouble, Plane, ListTodo,
} from 'lucide-react';
import { Trip } from '@/lib/api/trips.api';
import { tasksApi, TaskCategory, CreateTaskPayload } from '@/lib/api/tasks.api';
import { Portal } from '@/components/ui/Portal';
import { useModalTransition } from '@/lib/hooks/useModalTransition';

const CATEGORY_CONFIG: Record<TaskCategory, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  bg: string;
  text: string;
  ring: string;
}> = {
  esim:          { label: 'ESIM / 網路', icon: Smartphone,  bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  visa:          { label: '簽證 / 證件', icon: FileBadge,   bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-200' },
  accommodation: { label: '訂房',        icon: BedDouble,   bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-200' },
  transport:     { label: '交通 / 機票', icon: Plane,       bg: 'bg-violet-100',  text: 'text-violet-700',  ring: 'ring-violet-200' },
  general:       { label: '一般',        icon: ListTodo,    bg: 'bg-slate-100',   text: 'text-slate-700',   ring: 'ring-slate-200' },
};

const CATEGORY_ORDER: TaskCategory[] = ['esim', 'visa', 'accommodation', 'transport', 'general'];

function memberLabel(userId: string, trip: Trip): string {
  const m = trip.members.find((mm) => mm.userId === userId);
  return m?.name || m?.email?.split('@')[0] || userId.slice(0, 6).toUpperCase();
}

export interface AddTaskModalProps {
  trip: Trip;
  token: string;
  onClose: () => void;
  open?: boolean;
}

export function AddTaskModal({ trip, token, onClose, open = true }: AddTaskModalProps) {
  const { mounted, closing } = useModalTransition(open);
  const qc = useQueryClient();
  const memberIds = trip.members.map((m) => m.userId);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('general');
  const [dueDate, setDueDate] = useState('');
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload: CreateTaskPayload) =>
      tasksApi.create(trip.id, payload, token),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', trip.id] });
      onClose();
    },
    onError: (err: Error) => setError(err.message || '建立失敗'),
  });

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!title.trim()) { setError('請輸入待辦事項'); return; }
    setError('');
    const trimmedNotes = notes.trim();
    createMutation.mutate({
      title: title.trim(),
      category,
      dueDate: dueDate || undefined,
      assignedUserId: assignedUserId || undefined,
      notes: trimmedNotes ? trimmedNotes : undefined,
    });
  }

  if (!mounted) return null;

  return (
    <Portal>
      <div data-vs-closing={closing ? '' : undefined} className="fixed inset-0 z-[60] vs-modal-overlay">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog" style={{ maxHeight: '90dvh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">新增待辦</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error */}
          <div className={`overflow-hidden transition-all duration-300 ${error ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="td-task-title" className="block text-sm font-medium text-slate-700">
              待辦事項 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <CheckSquare className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="td-task-title"
                type="text"
                placeholder="例：辦理日本 ESIM"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="task-notes" className="block text-sm font-medium text-slate-700">備註</label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <textarea
                id="task-notes"
                rows={6}
                placeholder="補充說明、連結、價格..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 resize-y min-h-[120px]"
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">分類</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ORDER.map((c) => {
                const cfg = CATEGORY_CONFIG[c];
                const Icon = cfg.icon;
                const active = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                      active
                        ? `${cfg.bg} ${cfg.text} ring-2 ${cfg.ring}`
                        : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due date + Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="td-task-due" className="block text-sm font-medium text-slate-700">截止日期</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="td-task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="td-task-assignee" className="block text-sm font-medium text-slate-700">負責人</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  id="td-task-assignee"
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                >
                  <option value="">未指派</option>
                  {memberIds.map((uid) => (
                    <option key={uid} value={uid}>{memberLabel(uid, trip)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {createMutation.isPending ? '建立中...' : '新增待辦'}
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
}

export default AddTaskModal;
