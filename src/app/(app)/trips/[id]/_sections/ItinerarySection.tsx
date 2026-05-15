'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragEndEvent, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, MapPin, Plus, Trash2, ChevronRight, Calendar, Clock,
} from 'lucide-react';
import { itineraryApi, ItineraryItem } from '@/lib/api/itinerary.api';
import { Trip } from '@/lib/api/trips.api';
import { SpotEditorModal } from '@/components/ui/SpotEditorModal';
import { AddSpotMenu } from '@/components/ui/AddSpotMenu';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface Props {
  trip: Trip;
  itinerary: ItineraryItem[];
  token: string;
  canEdit: boolean;
}

function dayLabel(day: number, startDate?: string): string {
  if (!startDate) return `Day ${day}`;
  const d = new Date(startDate);
  d.setDate(d.getDate() + (day - 1));
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `Day ${day} · ${md} (${wd})`;
}

function DaySummaryCard({
  trip, day, items, canEdit,
}: {
  trip: Trip;
  day: number;
  items: ItineraryItem[];
  canEdit: boolean;
}) {
  const preview = items.slice(0, 3);
  const remaining = Math.max(0, items.length - preview.length);
  const timedCount = items.filter((i) => !!i.startTime).length;

  return (
    <Link
      href={`/trips/${trip.id}/day/${day}`}
      className="block bg-white rounded-2xl border border-slate-100 shadow-sm shadow-indigo-500/5 hover:shadow-md hover:shadow-indigo-500/15 hover:border-indigo-200 active:scale-[0.99] transition-all duration-200 cursor-pointer overflow-hidden"
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          {dayLabel(day, trip.startDate)}
        </h3>
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          {items.length > 0 && (
            <span className="font-medium">{items.length} 項</span>
          )}
          {timedCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-indigo-500">
              <Clock className="w-3 h-3" />
              {timedCount}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400 text-center">
          {canEdit ? '點此進入安排景點' : '尚未安排'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {preview.map((it) => (
            <li key={it.id} className="px-4 py-2.5 flex items-center gap-2.5 text-sm">
              <span className="w-12 flex-shrink-0 tabular-nums text-xs">
                {it.startTime ? (
                  <span className="text-indigo-600 font-semibold">{it.startTime.slice(0, 5)}</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </span>
              <span className="flex-1 min-w-0 truncate text-slate-700">{it.title}</span>
            </li>
          ))}
          {remaining > 0 && (
            <li className="px-4 py-2 text-xs text-slate-400 text-center">+{remaining} 個更多</li>
          )}
        </ul>
      )}
    </Link>
  );
}

function SortableBucketRow({ item, canEdit, onEdit, onDelete }: {
  item: ItineraryItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: item.id, disabled: !canEdit });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : 'transform 120ms cubic-bezier(0.25,1,0.5,1)',
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="px-3 py-2.5 flex items-center gap-2 group bg-white"
    >
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="拖曳排序"
          className="flex-shrink-0 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-slate-100"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="flex-1 min-w-0 text-left text-sm text-slate-700 truncate hover:text-indigo-600 cursor-pointer"
      >
        {item.title}
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="刪除"
          className="sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1 rounded hover:bg-red-50 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </li>
  );
}

export default function ItinerarySection({ trip, itinerary, token, canEdit }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const [extraDays, setExtraDays] = useState<number[]>([]);
  const [addingDay, setAddingDay] = useState(false);
  const [dayInput, setDayInput] = useState('');

  // All days available from trip dates (null if dates not set)
  const tripTotalDays = useMemo(() => {
    if (!trip.startDate || !trip.endDate) return null;
    const diff = new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime();
    if (Number.isNaN(diff) || diff < 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [trip.startDate, trip.endDate]);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { bucket, byDay } = useMemo(() => {
    const b: ItineraryItem[] = [];
    const m = new Map<number, ItineraryItem[]>();

    // Pre-fill days that were explicitly added by user
    for (const d of extraDays) m.set(d, []);

    // Add items from itinerary (also adds their days to the map)
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

    // Always show at least Day 1
    if (m.size === 0) m.set(1, []);

    return { bucket: b, byDay: m };
  }, [itinerary, extraDays]);

  const sortedDays = [...byDay.keys()].sort((a, b) => a - b);
  const maxDay = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1]! : 0;
  const nextDay = maxDay + 1;

  const reorderBucket = useMutation({
    mutationFn: (orderedIds: string[]) =>
      itineraryApi.reorderBucket(
        trip.id,
        orderedIds.map((id, idx) => ({ id, order: idx })),
        token,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itineraryApi.deleteItem(trip.id, id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itinerary', trip.id] }),
  });

  function handleBucketDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = bucket.map((i) => i.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    qc.setQueryData<ItineraryItem[]>(['itinerary', trip.id], (prev) => {
      if (!prev) return prev;
      const lookup = new Map(next.map((id, idx) => [id, idx]));
      return prev.map((it) =>
        it.day === null && lookup.has(it.id) ? { ...it, order: lookup.get(it.id)! } : it,
      );
    });
    reorderBucket.mutate(next, {
      onError: () => qc.invalidateQueries({ queryKey: ['itinerary', trip.id] }),
    });
  }

  function confirmAddDay() {
    const n = parseInt(dayInput, 10);
    if (Number.isFinite(n) && n >= 1 && !byDay.has(n)) {
      setExtraDays((prev) => (prev.includes(n) ? prev : [...prev, n]));
    }
    setAddingDay(false);
    setDayInput('');
  }

  return (
    <section id="section-itinerary">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-500" />
          每日行程
          <span className="text-xs font-normal text-slate-400 ml-1">{sortedDays.length} 天</span>
        </h2>
      </div>

      {/* Bucket card — only shown when there are unscheduled items */}
      {bucket.length > 0 && (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-indigo-500/5 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
            未排定
          </h3>
          <span className="text-xs text-slate-500 font-medium">{bucket.length} 項</span>
        </div>
        {!mounted ? (
          <ul className="divide-y divide-slate-100">
            {bucket.map((it) => (
              <li key={it.id} className="px-3 py-2.5 text-sm text-slate-700 truncate">
                {it.title}
              </li>
            ))}
          </ul>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleBucketDragEnd}
          >
            <SortableContext
              items={bucket.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y divide-slate-100">
                {bucket.map((it) => (
                  <SortableBucketRow
                    key={it.id}
                    item={it}
                    canEdit={canEdit}
                    onEdit={() => setEditing(it)}
                    onDelete={async () => {
                      const ok = await confirm({
                        title: `刪除「${it.title}」?`,
                        danger: true,
                        confirmLabel: '刪除',
                      });
                      if (ok) deleteMutation.mutate(it.id);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
      )}

      {/* Day summary cards */}
      <div className="space-y-3">
        {sortedDays.map((d) => (
          <DaySummaryCard
            key={d}
            trip={trip}
            day={d}
            items={byDay.get(d) ?? []}
            canEdit={canEdit}
          />
        ))}
      </div>

      {/* Add day */}
      {canEdit && (
        addingDay ? (
          <div className="mt-3 bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
              <span className="text-sm font-semibold text-slate-700">選擇要新增的天數</span>
              <button
                type="button"
                onClick={() => { setAddingDay(false); setDayInput(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                取消
              </button>
            </div>

            {tripTotalDays !== null ? (
              /* Date-based: show all days from trip dates, hide already-visible ones */
              <ul className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
                {Array.from({ length: tripTotalDays }, (_, i) => i + 1)
                  .filter((d) => !byDay.has(d))
                  .map((d) => (
                    <li key={d}>
                      <button
                        type="button"
                        onClick={() => {
                          setExtraDays((prev) => (prev.includes(d) ? prev : [...prev, d]));
                          setAddingDay(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer inline-flex items-center gap-2"
                      >
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        {dayLabel(d, trip.startDate)}
                      </button>
                    </li>
                  ))}
                {Array.from({ length: tripTotalDays }, (_, i) => i + 1).every((d) => byDay.has(d)) && (
                  <li className="px-4 py-4 text-sm text-slate-400 text-center">所有天數已新增</li>
                )}
              </ul>
            ) : (
              /* No dates: manual number input */
              <form
                className="flex items-center gap-2 px-4 py-3"
                onSubmit={(e) => { e.preventDefault(); confirmAddDay(); }}
              >
                <span className="text-sm text-slate-600 whitespace-nowrap">新增第</span>
                <input
                  type="number"
                  min={1}
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  placeholder={String(nextDay)}
                  autoFocus
                  className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
                <span className="text-sm text-slate-600">天</span>
                <button
                  type="submit"
                  className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  新增
                </button>
              </form>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setDayInput(String(nextDay)); setAddingDay(true); }}
            className="mt-3 w-full py-3 rounded-2xl border border-dashed border-slate-200 text-sm font-medium text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            新增天數
          </button>
        )
      )}

      {showAddMenu && (
        <AddSpotMenu
          tripId={trip.id}
          day={null}
          token={token}
          onClose={() => setShowAddMenu(false)}
        />
      )}
      {editing && (
        <SpotEditorModal
          tripId={trip.id}
          day={editing.day}
          token={token}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
