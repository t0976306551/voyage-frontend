'use client';

import { useState } from 'react';
import type { ComponentType, FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, X, Loader2, AlertCircle, Type, FileText,
  UtensilsCrossed, BedDouble, Landmark, Ticket, Train, ClipboardList,
} from 'lucide-react';
import { itineraryApi, SpotCategory, CreateItemPayload } from '@/lib/api/itinerary.api';
import { Portal } from '@/components/ui/Portal';

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

export interface AddItineraryItemModalProps {
  tripId: string;
  /** Day number to add the item to. Use null to add as bucket-list item. */
  day: number | null;
  token: string;
  onClose: () => void;
}

export function AddItineraryItemModal({
  tripId, day, token, onClose,
}: AddItineraryItemModalProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SpotCategory>('attraction');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload: CreateItemPayload) =>
      itineraryApi.createItem(tripId, payload, token),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['itinerary', tripId] });
      void qc.invalidateQueries({ queryKey: ['bucket', tripId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message || '建立失敗'),
  });

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!title.trim()) { setError('請輸入景點名稱'); return; }
    setError('');
    createMutation.mutate({
      title: title.trim(),
      day,
      category,
      note: note.trim() || undefined,
    });
  }

  const titleLabel = day === null ? '加入景點庫' : `Day ${day} — 新增景點`;

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] vs-modal-overlay">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog" style={{ maxHeight: '90dvh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{titleLabel}</h2>
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
            <label htmlFor="iti-title" className="block text-sm font-medium text-slate-700">
              景點名稱 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="iti-title"
                type="text"
                placeholder="例：清水寺"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
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

          {/* Note */}
          <div className="space-y-1.5">
            <label htmlFor="iti-note" className="block text-sm font-medium text-slate-700">備註</label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <textarea
                id="iti-note"
                rows={3}
                placeholder="例：訂位電話、開放時間、票價..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 resize-none"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {createMutation.isPending ? '建立中...' : '新增景點'}
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
}

export default AddItineraryItemModal;
