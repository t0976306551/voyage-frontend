'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MapPin, Plus, ChevronRight, Circle, ClipboardList,
} from 'lucide-react';
import { ItineraryItem } from '@/lib/api/itinerary.api';
import { Trip } from '@/lib/api/trips.api';
import { SpotEditorModal } from '@/components/ui/SpotEditorModal';
import { SectionHeader } from '@/app/(app)/trips/[id]/_components/SectionHeader';

interface Props {
  trip: Trip;
  itinerary: ItineraryItem[];
  token: string;
  /** Owner or Editor — always; gates 新增 affordances (Scheme Y). */
  canAdd: boolean;
  /** Owner or (Editor with canEditContent) — gates 編輯 既有 affordances. */
  canEdit: boolean;
  /** Owner or (Editor with canDeleteContent) — gates 刪除 affordances. */
  canDelete: boolean;
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'] as const;

function fmtDayDate(day: number, startDate?: string): { md: string; wd: string } | null {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + (day - 1));
  return {
    md: `${d.getMonth() + 1}/${d.getDate()}`,
    wd: WEEKDAY[d.getDay()]!,
  };
}

function dayHeaderTitle(day: number, startDate?: string): string {
  const fmt = fmtDayDate(day, startDate);
  return fmt ? `Day ${day} · ${fmt.md} (${fmt.wd})` : `Day ${day}`;
}

function DayPill({
  day, startDate, hasItems, active, onClick,
}: {
  day: number;
  startDate?: string;
  hasItems: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const fmt = fmtDayDate(day, startDate);
  // With dates: show weekday + M/D (e.g. 五 / 5/8). Without: show "D" + day number.
  const topLabel = fmt ? fmt.wd : 'D';
  const mainLabel = fmt ? fmt.md : String(day);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all cursor-pointer px-1',
        active
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
          : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600',
      ].join(' ')}
    >
      <span className="text-[9px] font-semibold uppercase opacity-80 leading-none">{topLabel}</span>
      <span className="text-sm font-bold leading-none mt-1 tabular-nums">{mainLabel}</span>
      <span
        className={[
          'w-1 h-1 rounded-full mt-1',
          hasItems ? (active ? 'bg-white/80' : 'bg-indigo-300') : 'bg-transparent',
        ].join(' ')}
      />
    </button>
  );
}

export default function ItinerarySection({ trip, itinerary, token, canAdd, canEdit }: Props) {
  const [editSnapshot, setEditSnapshot] = useState<ItineraryItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [extraDays, setExtraDays] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(1);

  // If trip has dates, derive total days. Otherwise null (use extraDays).
  const tripTotalDays = useMemo(() => {
    if (!trip.startDate || !trip.endDate) return null;
    const diff = new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime();
    if (Number.isNaN(diff) || diff < 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [trip.startDate, trip.endDate]);

  const { bucket, byDay } = useMemo(() => {
    const b: ItineraryItem[] = [];
    const m = new Map<number, ItineraryItem[]>();

    // Pre-fill manually-added days (only used when trip has no dates)
    for (const d of extraDays) m.set(d, []);

    for (const it of itinerary) {
      if (it.day === null) {
        b.push(it);
      } else {
        const arr = m.get(it.day) ?? [];
        arr.push(it);
        m.set(it.day, arr);
      }
    }

    b.sort((a, b2) => a.order - b2.order);
    for (const arr of m.values()) {
      arr.sort((a, b2) => {
        if (a.startTime && b2.startTime) return a.startTime.localeCompare(b2.startTime);
        if (a.startTime) return -1;
        if (b2.startTime) return 1;
        return a.order - b2.order;
      });
    }

    return { bucket: b, byDay: m };
  }, [itinerary, extraDays]);

  // Master list of days to render in pills.
  // - With trip dates: 1..tripTotalDays
  // - Without trip dates: union of itinerary days + extraDays, always at least [1]
  const allDays = useMemo<number[]>(() => {
    if (tripTotalDays !== null && tripTotalDays > 0) {
      return Array.from({ length: tripTotalDays }, (_, i) => i + 1);
    }
    const set = new Set<number>([1]);
    for (const d of byDay.keys()) set.add(d);
    return [...set].sort((a, b) => a - b);
  }, [tripTotalDays, byDay]);

  const totalItems = itinerary.length;

  // Ensure selectedDay stays within range when allDays changes.
  useEffect(() => {
    if (allDays.length === 0) return;
    if (!allDays.includes(selectedDay)) {
      setSelectedDay(allDays[0]!);
    }
  }, [allDays, selectedDay]);

  const selectedItems = byDay.get(selectedDay) ?? [];

  // Used only when trip has no dates: append next day number.
  function handleAddDayPill() {
    const maxKnown = allDays.length > 0 ? allDays[allDays.length - 1]! : 0;
    const next = maxKnown + 1;
    setExtraDays((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setSelectedDay(next);
  }

  const fmt = fmtDayDate(selectedDay, trip.startDate);
  // 新增天數 pill 只是把一個沒有任何 spot 的 day 顯示在 UI 上（純前端 state，
  // 後端從 itinerary day 集合或 trip startDate/endDate 推算）。當作「新增」affordance。
  const showAddDayPill = canAdd && tripTotalDays === null;

  return (
    <section id="section-itinerary">
      <div className="relative">
        <SectionHeader
          icon={MapPin}
          iconGradient="indigo"
          title="每日行程"
          subtitle={`${allDays.length} 天 · ${totalItems} 個景點`}
        />
        <Link
          href={`/trips/${trip.id}/bucket`}
          className="absolute top-1 right-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
          aria-label="管理未排定景點"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          未排定{bucket.length > 0 ? ` (${bucket.length})` : ''}
        </Link>
      </div>

      {/* Bucket inline card removed — bucket items are managed at /trips/[id]/bucket */}


      {/* Day pills (horizontal scroll) */}
      <div
        role="tablist"
        aria-label="行程天數"
        className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {allDays.map((d) => (
          <DayPill
            key={d}
            day={d}
            startDate={trip.startDate}
            hasItems={(byDay.get(d)?.length ?? 0) > 0}
            active={d === selectedDay}
            onClick={() => setSelectedDay(d)}
          />
        ))}
        {showAddDayPill && (
          <button
            type="button"
            onClick={handleAddDayPill}
            aria-label="新增天數"
            className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span className="text-[9px] font-semibold mt-0.5">新增</span>
          </button>
        )}
      </div>

      {/* Selected day panel */}
      <div>
        {/* Day header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-indigo-500/30 flex-shrink-0 tabular-nums">
              {selectedDay}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {dayHeaderTitle(selectedDay, trip.startDate)}
              </h3>
              <p className="text-[11px] text-slate-500">
                {selectedItems.length > 0
                  ? `${selectedItems.length} 個景點`
                  : '尚未安排'}
              </p>
            </div>
          </div>
          {selectedItems.length > 0 && (
            <Link
              href={`/trips/${trip.id}/day/${selectedDay}`}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5 cursor-pointer flex-shrink-0"
            >
              編輯
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {selectedItems.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              {fmt ? `${fmt.md} (${fmt.wd}) ` : ''}Day {selectedDay} 尚未安排景點
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {canAdd ? '點下面按鈕加入第一個景點' : '尚未安排景點'}
            </p>
            {canAdd && (
              <Link
                href={`/trips/${trip.id}/day/${selectedDay}`}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-indigo-500/30"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                進入編輯加入第一個景點
              </Link>
            )}
          </div>
        ) : (
          /* Timeline */
          <div className="relative pl-7">
            <div className="absolute left-[10px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-200 via-indigo-200 to-indigo-50" />

            {selectedItems.map((it, i) => {
              const isLast = i === selectedItems.length - 1;
              const hasTime = !!it.startTime;
              return (
                <div key={it.id} className={`relative ${isLast ? '' : 'mb-2.5'} group`}>
                  {/* Dot */}
                  <div
                    className={[
                      'absolute -left-7 top-3 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center shadow-sm',
                      hasTime ? 'border-indigo-500' : 'border-slate-300',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'w-1.5 h-1.5 rounded-full',
                        hasTime ? 'bg-indigo-500' : 'bg-slate-300',
                      ].join(' ')}
                    />
                  </div>
                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => { setEditSnapshot(it); setEditOpen(true); }}
                    className="w-full text-left bg-white rounded-xl border border-slate-100 shadow-sm shadow-indigo-500/5 hover:shadow-md hover:border-indigo-200 transition-all px-4 py-2.5 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 leading-tight truncate">
                          {it.title}
                        </h4>
                        {it.note && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{it.note}</p>
                        )}
                      </div>
                      {hasTime ? (
                        <span className="text-xs font-bold text-indigo-600 tabular-nums flex-shrink-0">
                          {it.startTime!.slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 flex-shrink-0 inline-flex items-center gap-0.5">
                          <Circle className="w-2.5 h-2.5" />
                          未設時間
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: edit bucket items only (timeline cards navigate to day detail for editing) */}
      {editSnapshot && (
        <SpotEditorModal
          open={editOpen}
          tripId={trip.id}
          day={editSnapshot.day}
          token={token}
          existing={editSnapshot}
          onClose={() => setEditOpen(false)}
        />
      )}
    </section>
  );
}
