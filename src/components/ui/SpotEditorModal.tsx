'use client';

import { useState, useEffect } from 'react';
import type { ComponentType, FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, X, Loader2, AlertCircle, Type, FileText, Clock, ChevronDown, ChevronUp,
  UtensilsCrossed, BedDouble, Landmark, Ticket, Train, ClipboardList,
} from 'lucide-react';
import { itineraryApi, SpotCategory, ItineraryItem } from '@/lib/api/itinerary.api';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { Portal } from '@/components/ui/Portal';
import { useModalTransition } from '@/lib/hooks/useModalTransition';

const CATEGORY_ORDER: SpotCategory[] = ['food', 'lodging', 'attraction', 'activity', 'transport', 'admin'];

const CATEGORY_CONFIG: Record<SpotCategory, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  bg: string;
  text: string;
  ring: string;
}> = {
  food:       { label: '美食', icon: UtensilsCrossed, bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-200' },
  lodging:    { label: '住宿', icon: BedDouble,       bg: 'bg-blue-100',   text: 'text-blue-700',   ring: 'ring-blue-200' },
  attraction: { label: '景點', icon: Landmark,        bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  activity:   { label: '體驗', icon: Ticket,          bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200' },
  transport:  { label: '交通', icon: Train,           bg: 'bg-slate-100',  text: 'text-slate-700',  ring: 'ring-slate-200' },
  admin:      { label: '行政', icon: ClipboardList,   bg: 'bg-amber-100',  text: 'text-amber-700',  ring: 'ring-amber-200' },
};

export interface SpotEditorModalProps {
  tripId: string;
  /** Day number (1+) or null for bucket. */
  day: number | null;
  token: string;
  /** When provided, edit mode; otherwise create mode. */
  existing?: ItineraryItem | null;
  onClose: () => void;
  open?: boolean;
}

export function SpotEditorModal({
  tripId, day, token, existing, onClose, open = true,
}: SpotEditorModalProps) {
  const { mounted, closing } = useModalTransition(open);
  const qc = useQueryClient();
  useBodyScrollLock(mounted);
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<SpotCategory>(existing?.category ?? 'attraction');
  const [startTime, setStartTime] = useState(existing?.startTime?.slice(0, 5) ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [showAdvanced, setShowAdvanced] = useState(!!(existing?.address || existing?.note));
  const [error, setError] = useState('');

  // Autofocus title on open (without auto-zoom on iOS — handled by font-size 16+)
  useEffect(() => {
    const t = setTimeout(() => {
      const input = document.getElementById('sp-title') as HTMLInputElement | null;
      input?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  const createMutation = useMutation({
    mutationFn: () =>
      itineraryApi.createItem(
        tripId,
        {
          title: title.trim(),
          day,
          category,
          startTime: startTime || null,
          address: address.trim() || null,
          note: note.trim() || undefined,
        },
        token,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['itinerary', tripId] });
      void qc.invalidateQueries({ queryKey: ['day', tripId, day] });
      onClose();
    },
    onError: (e: Error) => setError(e.message || '建立失敗'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      itineraryApi.updateItem(
        tripId,
        existing!.id,
        {
          title: title.trim(),
          category,
          startTime: startTime || null,
          address: address.trim() || null,
          note: note.trim() || undefined,
        },
        token,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['itinerary', tripId] });
      void qc.invalidateQueries({ queryKey: ['day', tripId, day] });
      onClose();
    },
    onError: (e: Error) => setError(e.message || '更新失敗'),
  });

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!title.trim()) { setError('請輸入景點名稱'); return; }
    setError('');
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  }

  const pending = createMutation.isPending || updateMutation.isPending;
  const dayLabel = day === null ? '未排定' : `Day ${day}`;
  const titleLabel = isEdit ? '編輯景點' : `${dayLabel} — 新增景點`;

  if (!mounted) return null;

  return (
    <Portal>
    <div data-vs-closing={closing ? '' : undefined} className="fixed inset-0 z-[60] vs-modal-overlay">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog" style={{ maxHeight: '92dvh' }}>
        {/* Handle bar — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <header className="flex items-center justify-between px-5 pt-3 pb-4 sm:pt-5 sm:px-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-900 truncate">{titleLabel}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className={`overflow-hidden transition-all duration-300 ${error ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>

          {/* Title — required */}
          <div className="space-y-1.5">
            <label htmlFor="sp-title" className="block text-sm font-medium text-slate-700">
              景點名稱 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="sp-title"
                type="text"
                placeholder="例：清水寺、一蘭拉麵"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
          </div>

          {/* Category + Time row */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5 min-w-0">
              <label className="block text-sm font-medium text-slate-700">分類</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ORDER.map((c) => {
                  const cfg = CATEGORY_CONFIG[c];
                  const Icon = cfg.icon;
                  const active = c === category;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer active:scale-[0.97] ${
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
          </div>

          {/* Optional time */}
          <div className="space-y-1.5">
            <label htmlFor="sp-time" className="block text-sm font-medium text-slate-700 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              時間（選填）
            </label>
            <div className="flex items-center gap-2">
              <input
                id="sp-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
              {startTime && (
                <button
                  type="button"
                  onClick={() => setStartTime('')}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2 py-2 cursor-pointer"
                >
                  清除
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">未填時間 → 列為「未指定時間」</p>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full inline-flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-indigo-600 cursor-pointer py-1"
          >
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showAdvanced ? '收合進階欄位' : '新增地址、備註'}
          </button>

          {showAdvanced && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="sp-address" className="block text-sm font-medium text-slate-700 inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  地址（選填）
                </label>
                <input
                  id="sp-address"
                  type="text"
                  placeholder="例：京都市東山区清水 1 丁目 294"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sp-note" className="block text-sm font-medium text-slate-700 inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  備註（選填）
                </label>
                <textarea
                  id="sp-note"
                  rows={3}
                  placeholder="訂位電話、開放時間、票價、提醒..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {pending ? '儲存中...' : isEdit ? '儲存' : '新增景點'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}

