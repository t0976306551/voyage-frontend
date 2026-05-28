'use client';

import type { ComponentType } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  MapPin, X, Clock, FileText, ChevronRight, Copy, Check,
  UtensilsCrossed, BedDouble, Landmark, Ticket, Train, ClipboardList,
} from 'lucide-react';
import { ItineraryItem, SpotCategory } from '@/lib/api/itinerary.api';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { Portal } from '@/components/ui/Portal';
import { useModalTransition } from '@/lib/hooks/useModalTransition';

const CATEGORY_CONFIG: Record<SpotCategory, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  bg: string;
  text: string;
}> = {
  food:       { label: '美食', icon: UtensilsCrossed, bg: 'bg-orange-100', text: 'text-orange-700' },
  lodging:    { label: '住宿', icon: BedDouble,       bg: 'bg-blue-100',   text: 'text-blue-700' },
  attraction: { label: '景點', icon: Landmark,        bg: 'bg-indigo-100', text: 'text-indigo-700' },
  activity:   { label: '體驗', icon: Ticket,          bg: 'bg-violet-100', text: 'text-violet-700' },
  transport:  { label: '交通', icon: Train,           bg: 'bg-slate-100',  text: 'text-slate-700' },
  admin:      { label: '行政', icon: ClipboardList,   bg: 'bg-amber-100',  text: 'text-amber-700' },
};

export interface SpotViewModalProps {
  item: ItineraryItem;
  tripId: string;
  onClose: () => void;
  open?: boolean;
}

export function SpotViewModal({ item, tripId, onClose, open = true }: SpotViewModalProps) {
  const { mounted, closing } = useModalTransition(open);
  useBodyScrollLock(mounted);
  const [copied, setCopied] = useState(false);

  if (!mounted) return null;

  const cfg = CATEGORY_CONFIG[item.category ?? 'attraction'];
  const Icon = cfg.icon;
  const hasDetails = !!(item.startTime || item.address || item.note);

  function handleCopyAddress() {
    if (!item.address) return;
    void navigator.clipboard.writeText(item.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const mapsUrl = item.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`
    : null;

  return (
    <Portal>
      <div data-vs-closing={closing ? '' : undefined} className="fixed inset-0 z-[60] vs-modal-overlay">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose} aria-hidden />
        <div
          className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-y-auto vs-modal-dialog"
          style={{ maxHeight: '92dvh' }}
        >
          {/* Handle bar — mobile only */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          <header className="flex items-center justify-between px-5 pt-3 pb-4 sm:pt-5 sm:px-6 border-b border-slate-100 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-900 truncate">景點詳細資訊</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="關閉"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="p-6 space-y-5">
            {/* Title + Category */}
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-slate-900 leading-tight">{item.title}</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                <Icon className="w-3 h-3" />
                {cfg.label}
              </span>
            </div>

            {/* Time */}
            {item.startTime && (
              <div className="flex items-center gap-2.5 text-sm text-slate-700">
                <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="font-semibold tabular-nums">{item.startTime.slice(0, 5)}</span>
              </div>
            )}

            {/* Address — tap to open Maps, copy button on the right */}
            {item.address && (
              <div className="flex items-center gap-2">
                <a
                  href={mapsUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-start gap-2.5 text-sm text-slate-700 hover:text-indigo-600 group min-w-0"
                >
                  <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5 group-hover:text-indigo-600 transition-colors" />
                  <span className="underline underline-offset-2 decoration-slate-300 group-hover:decoration-indigo-400 transition-colors leading-snug">
                    {item.address}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  aria-label="複製地址"
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                >
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {/* Note */}
            {item.note && (
              <div className="flex items-start gap-2.5 text-sm text-slate-700">
                <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed whitespace-pre-wrap">{item.note}</p>
              </div>
            )}

            {!hasDetails && (
              <p className="text-sm text-slate-400">尚未填寫詳細資訊。</p>
            )}

            {/* Footer */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                關閉
              </button>
              {item.day !== null && (
                <Link
                  href={`/trips/${tripId}/day/${item.day}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-indigo-500/25"
                >
                  前往 Day {item.day} 編輯
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
