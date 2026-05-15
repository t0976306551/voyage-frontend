'use client';

import { ComponentType, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragEndEvent, DragOverEvent, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronLeft, ChevronRight, GripVertical, Plus, Trash2, MapPin, Pencil,
  Clock, Calendar, UtensilsCrossed, BedDouble, Landmark, Ticket, Train,
  ClipboardList, AlignJustify, Check, ArrowRightLeft,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { itineraryApi, ItineraryItem, SpotCategory } from '@/lib/api/itinerary.api';
import { Trip } from '@/lib/api/trips.api';
import { SpotEditorModal } from '@/components/ui/SpotEditorModal';
import { AddSpotMenu } from '@/components/ui/AddSpotMenu';
import { useConfirm } from '@/components/ui/ConfirmDialog';

/* ─────────────────────────── Category config ─────────────────────────── */
type CatCfg = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;   // left bar color
  badge: string;    // badge bg + text
  time: string;     // time text color
};

const CAT: Record<SpotCategory, CatCfg> = {
  food:       { label: '美食', icon: UtensilsCrossed, accent: 'bg-orange-400', badge: 'bg-orange-50 text-orange-600',   time: 'text-orange-600' },
  lodging:    { label: '住宿', icon: BedDouble,       accent: 'bg-sky-400',    badge: 'bg-sky-50 text-sky-600',         time: 'text-sky-600'    },
  attraction: { label: '景點', icon: Landmark,        accent: 'bg-indigo-400', badge: 'bg-indigo-50 text-indigo-600',   time: 'text-indigo-600' },
  activity:   { label: '體驗', icon: Ticket,          accent: 'bg-violet-400', badge: 'bg-violet-50 text-violet-600',   time: 'text-violet-600' },
  transport:  { label: '交通', icon: Train,           accent: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600',    time: 'text-slate-600'  },
  admin:      { label: '行政', icon: ClipboardList,   accent: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-600',     time: 'text-amber-600'  },
};

function getCat(cat: SpotCategory | null | undefined): CatCfg {
  return CAT[cat ?? 'attraction'];
}

/* ─────────────────────────── Helpers ─────────────────────────── */
function tripDayCount(s?: string, e?: string): number | null {
  if (!s || !e) return null;
  const d = new Date(e).getTime() - new Date(s).getTime();
  return Number.isNaN(d) || d < 0 ? null : Math.ceil(d / 86400000) + 1;
}

function dayLabel(day: number, startDate?: string): string {
  if (!startDate) return `Day ${day}`;
  const d = new Date(startDate);
  d.setDate(d.getDate() + (day - 1));
  return `Day ${day} · ${d.getMonth() + 1}/${d.getDate()} (${['日','一','二','三','四','五','六'][d.getDay()]})`;
}

function gapLabel(a: string, b: string): string {
  const toMin = (t: string) => { const [h=0,m=0] = t.split(':').map(Number); return h*60+m; };
  const d = toMin(b) - toMin(a);
  if (d <= 0) return '';
  if (d < 60) return `${d} 分`;
  const h = Math.floor(d / 60), m = d % 60;
  return m === 0 ? `${h} 小時` : `${h}h ${m}m`;
}

/* ─────────────────────────── SpotCard ─────────────────────────── */
function SpotCard({
  item, timed, canEdit, dragHandleProps, onEdit, onDelete, onMove, totalDays, currentDay, startDate,
}: {
  item: ItineraryItem;
  timed: boolean;
  canEdit: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onEdit: () => void;
  onDelete: () => void;
  onMove?: (targetDay: number) => void;
  totalDays?: number;
  currentDay?: number;
  startDate?: string;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);
  const cfg = getCat(item.category);
  const Icon = cfg.icon;
  const showMoveMenu = menuPos !== null;

  useEffect(() => {
    if (!showMoveMenu) return;
    function handleOutside(e: MouseEvent) {
      if (
        moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node) &&
        moveButtonRef.current && !moveButtonRef.current.contains(e.target as Node)
      ) setMenuPos(null);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showMoveMenu]);

  function openMoveMenu() {
    if (showMoveMenu) { setMenuPos(null); return; }
    const rect = moveButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dropdownWidth = 160;
    const left = Math.max(8, rect.right - dropdownWidth);
    setMenuPos({ top: rect.bottom + 4, left });
  }

  const canMove = canEdit && !!onMove && !!totalDays && totalDays > 1;

  return (
    <div className={`relative flex rounded-2xl bg-white shadow-sm transition-all duration-200 group
      ${timed
        ? 'border border-slate-100 hover:shadow-md hover:border-slate-200'
        : 'border border-dashed border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Left accent bar */}
      <div className={`w-1 flex-shrink-0 self-stretch rounded-l-2xl ${timed ? cfg.accent : 'bg-slate-200'}`} />

      {/* Content */}
      <div className="flex-1 min-w-0 px-4 py-3.5">
        {/* Row 1: time / drag-handle  +  badge  +  actions */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {timed && item.startTime ? (
              <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${cfg.time}`}>
                {item.startTime.slice(0, 5)}
              </span>
            ) : canEdit ? (
              <button
                type="button"
                {...(dragHandleProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                aria-label="拖曳排序"
                className="touch-none flex-shrink-0 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 rounded"
              >
                <GripVertical className="w-4 h-4" />
              </button>
            ) : null}
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>
              <Icon className="w-2.5 h-2.5" />
              {cfg.label}
            </span>
          </div>

          {/* Move / Edit / Delete — visible on hover (desktop) or always small on mobile */}
          {canEdit && (
            <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 sm:transition-opacity">
              {canMove && (
                <>
                  <button
                    ref={moveButtonRef}
                    type="button"
                    onClick={openMoveMenu}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-violet-500 hover:bg-violet-50 cursor-pointer transition-colors"
                    aria-label="移到其他天"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                  {showMoveMenu && menuPos && createPortal(
                    <div
                      ref={moveMenuRef}
                      style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
                      className="bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-900/10 py-1 min-w-[150px]"
                    >
                      <p className="text-[10px] font-semibold text-slate-400 px-3 pt-1 pb-0.5 uppercase tracking-wider">移到</p>
                      {Array.from({ length: totalDays! }, (_, i) => i + 1)
                        .filter(d => d !== currentDay)
                        .map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => { onMove!(d); setMenuPos(null); }}
                            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer transition-colors whitespace-nowrap"
                          >
                            {dayLabel(d, startDate)}
                          </button>
                        ))
                      }
                    </div>,
                    document.body,
                  )}
                </>
              )}
              <button
                type="button"
                onClick={onEdit}
                className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 cursor-pointer transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <p className="text-[15px] font-semibold text-slate-900 leading-snug">{item.title}</p>

        {/* Address */}
        {item.address && (
          <p className="flex items-start gap-1 mt-1.5 text-xs text-slate-500">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">{item.address}</span>
          </p>
        )}

        {/* Note */}
        {item.note && (
          <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.note}</p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Gap connector ─────────────────────────── */
function GapConnector({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1 my-0.5">
      <div className="w-px self-stretch bg-slate-150 mx-[7px]" style={{ minHeight: 16, background: '#e2e8f0' }} />
      <div className="flex items-center gap-1 text-[11px] text-slate-400 py-1">
        <Clock className="w-3 h-3 text-slate-300" />
        {label} 後
      </div>
    </div>
  );
}

/* ─────────────────────────── Sortable untimed row ─────────────────────────── */
function SortableUntimedRow({ item, canEdit, onEdit, onDelete, onMove, totalDays, currentDay, startDate }: {
  item: ItineraryItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove?: (targetDay: number) => void;
  totalDays?: number;
  currentDay?: number;
  startDate?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: item.id, disabled: !canEdit });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
        willChange: 'transform',
      }}
    >
      <SpotCard
        item={item}
        timed={false}
        canEdit={canEdit}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
        onEdit={onEdit}
        onDelete={onDelete}
        onMove={onMove}
        totalDays={totalDays}
        currentDay={currentDay}
        startDate={startDate}
      />
    </li>
  );
}

/* ─────────────────────────── Main page ─────────────────────────── */
interface Props {
  trip: Trip;
  day: number;
  initialItems: ItineraryItem[];
  token: string;
}

export default function DayDetailClient({ trip, day, initialItems, token }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Live-sorted untimed items during drag (null = not dragging, use server order)
  const [dragItems, setDragItems] = useState<ItineraryItem[] | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Suppress self-triggered itinerary:changed after reorder (server broadcasts to all incl. self)
  const selfReordering = useRef(false);

  const totalDays = tripDayCount(trip.startDate, trip.endDate) ?? day;
  const canEdit = trip.members.some(m => m.role === 'Owner' || m.role === 'Editor');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: items = initialItems } = useQuery({
    queryKey: ['day', trip.id, day],
    queryFn: () => itineraryApi.getByDay(trip.id, day, token),
    initialData: initialItems,
  });

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', {
      auth: { token }, transports: ['websocket', 'polling'],
    });
    s.on('connect', () => s.emit('join_trip', trip.id));
    s.on('itinerary:changed', () => {
      if (selfReordering.current) return;
      qc.invalidateQueries({ queryKey: ['day', trip.id, day] });
      qc.invalidateQueries({ queryKey: ['itinerary', trip.id] });
    });
    return () => { s.emit('leave_trip', trip.id); s.disconnect(); };
  }, [token, trip.id, day, qc]);

  const { timed, untimed } = useMemo(() => {
    const t: ItineraryItem[] = [], u: ItineraryItem[] = [];
    for (const it of items) (it.startTime ? t : u).push(it);
    t.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    u.sort((a, b) => a.order - b.order);
    return { timed: t, untimed: u };
  }, [items]);

  // Display list: live drag order during drag, server order otherwise
  const displayUntimed = dragItems ?? untimed;

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => {
      selfReordering.current = true;
      return itineraryApi.reorder(trip.id, day, ids.map((id, order) => ({ id, order })), token);
    },
    onSuccess: () => setPendingOrder(null),
    onError: () => {
      qc.invalidateQueries({ queryKey: ['day', trip.id, day] });
      setPendingOrder(null);
    },
    onSettled: () => {
      setTimeout(() => { selfReordering.current = false; }, 600);
    },
  });

  function saveOrder() {
    if (!pendingOrder) return;
    reorderMutation.mutate([...timed.map(t => t.id), ...pendingOrder]);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itineraryApi.deleteItem(trip.id, id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day', trip.id, day] }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ itemId, targetDay }: { itemId: string; targetDay: number }) =>
      itineraryApi.updateItem(trip.id, itemId, { day: targetDay }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day', trip.id, day] });
      qc.invalidateQueries({ queryKey: ['itinerary', trip.id] });
    },
  });

  const handleMove = useCallback((itemId: string, targetDay: number) => {
    moveMutation.mutate({ itemId, targetDay });
  }, [moveMutation]);

  async function confirmDelete(it: ItineraryItem) {
    if (await confirm({ title: `刪除「${it.title}」?`, danger: true, confirmLabel: '刪除' }))
      deleteMutation.mutate(it.id);
  }

  function handleDragStart(e: { active: { id: string | number } }) {
    setActiveId(e.active.id as string);
    setDragItems([...untimed]); // snapshot server order at drag start
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDragItems(prev => {
      if (!prev) return prev;
      const from = prev.findIndex(i => i.id === active.id);
      const to   = prev.findIndex(i => i.id === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function handleDragEnd(_e: DragEndEvent) {
    setActiveId(null);
    if (dragItems) {
      const next = dragItems.map(i => i.id);
      const original = untimed.map(i => i.id);
      // Compare by order, not by active/over IDs — because onDragOver already moved
      // items in the array, so over.id may equal active.id even when order changed
      const changed = next.length !== original.length || next.some((id, idx) => id !== original[idx]);
      if (changed) {
        qc.setQueryData<ItineraryItem[]>(['day', trip.id, day], prev =>
          prev ? prev.map(item =>
            item.startTime ? item : { ...item, order: next.indexOf(item.id) }
          ) : prev
        );
        setPendingOrder(next);
      }
    }
    setDragItems(null);
  }

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  return (
    <main
      className="bg-slate-50 vs-page-enter"
      style={{ minHeight: '100dvh', paddingBottom: 'calc(120px + var(--bottom-nav-h, 0px))' }}
    >
      {/* ── Sticky header ── */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-20 md:px-6">
        <div className="max-w-2xl mx-auto">
          <Link
            href={`/trips/${trip.id}`}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer mb-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {trip.title}
          </Link>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
              <Calendar className="w-[18px] h-[18px] text-indigo-500 flex-shrink-0" />
              {dayLabel(day, trip.startDate)}
            </h1>
            <div className="flex items-center gap-1.5">
              {/* Deferred save button */}
              {pendingOrder && (
                <button
                  type="button"
                  onClick={saveOrder}
                  disabled={reorderMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.97] disabled:opacity-60 transition-all cursor-pointer shadow-sm shadow-indigo-500/30"
                >
                  <Check className="w-3.5 h-3.5" />
                  {reorderMutation.isPending ? '儲存中…' : '儲存順序'}
                </button>
              )}
              {/* Stats badge */}
              {items.length > 0 && !pendingOrder && (
                <span className="text-xs text-slate-400 tabular-nums mr-1">
                  {items.length} 個景點
                </span>
              )}
              {day > 1 && (
                <Link href={`/trips/${trip.id}/day/${day - 1}`}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition-all cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              )}
              {day < totalDays && (
                <Link href={`/trips/${trip.id}/day/${day + 1}`}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition-all cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-5">

        {/* Empty state */}
        {items.length === 0 && (
          <div className="mt-6 rounded-3xl bg-white border-2 border-dashed border-slate-200 p-12 text-center vs-anim-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-indigo-300" />
            </div>
            <p className="text-base font-semibold text-slate-700">這天還沒安排景點</p>
            <p className="text-sm text-slate-400 mt-1.5 mb-6 leading-relaxed">
              加入景點後可以設定時間、地址、備註<br />有設時間的會自動依順序排列
            </p>
            {canEdit && (
              <button type="button" onClick={() => setShowAddMenu(true)}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-2xl px-6 py-3 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.97] transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                <Plus className="w-4 h-4" />
                新增第一個景點
              </button>
            )}
          </div>
        )}

        {/* ── Timed items ── */}
        {timed.length > 0 && (
          <section className="space-y-0">
            {timed.map((item, i) => {
              const next = timed[i + 1];
              const gap = next?.startTime ? gapLabel(item.startTime!, next.startTime) : '';
              return (
                <div key={item.id}>
                  <SpotCard
                    item={item}
                    timed
                    canEdit={canEdit}
                    onEdit={() => setEditing(item)}
                    onDelete={() => void confirmDelete(item)}
                    onMove={(targetDay) => handleMove(item.id, targetDay)}
                    totalDays={totalDays}
                    currentDay={day}
                    startDate={trip.startDate}
                  />
                  {/* Gap or simple spacer */}
                  {(gap || i < timed.length - 1 || untimed.length > 0) && (
                    gap
                      ? <GapConnector label={gap} />
                      : <div className="h-3" />
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* ── Divider between timed and untimed ── */}
        {timed.length > 0 && untimed.length > 0 && (
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 flex-shrink-0">
              <AlignJustify className="w-3 h-3" />
              未指定時間
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        )}

        {/* ── Untimed items (DnD) ── */}
        {untimed.length > 0 && (
          <section>
            {timed.length === 0 && (
              <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                <GripVertical className="w-3.5 h-3.5" />
                未指定時間 · 拖曳可調整順序
              </p>
            )}
            {mounted ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={displayUntimed.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2.5">
                    {displayUntimed.map(item => (
                      <SortableUntimedRow
                        key={item.id}
                        item={item}
                        canEdit={canEdit}
                        onEdit={() => setEditing(item)}
                        onDelete={() => void confirmDelete(item)}
                        onMove={(targetDay) => handleMove(item.id, targetDay)}
                        totalDays={totalDays}
                        currentDay={day}
                        startDate={trip.startDate}
                      />
                    ))}
                  </ul>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeItem && (
                    <div
                      style={{
                        transform: 'scale(1.03) rotate(0.6deg)',
                        boxShadow: '0 24px 48px -8px rgba(0,0,0,0.18), 0 8px 16px -4px rgba(99,102,241,0.15)',
                        cursor: 'grabbing',
                      }}
                      className="rounded-2xl bg-white border border-indigo-200 px-4 py-3.5"
                    >
                      <p className="text-[10px] font-semibold text-indigo-500 mb-1.5 uppercase tracking-wide">
                        {getCat(activeItem.category).label}
                      </p>
                      <p className="text-[15px] font-semibold text-slate-900 leading-snug">{activeItem.title}</p>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            ) : (
              <ul className="space-y-2.5">
                {untimed.map(item => (
                  <SortableUntimedRow
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    onEdit={() => setEditing(item)}
                    onDelete={() => void confirmDelete(item)}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* ── Sticky add button ── */}
      {canEdit && items.length > 0 && (
        <div
          className="fixed left-0 right-0 md:left-16 z-[55] pointer-events-none"
          style={{ bottom: 'var(--bottom-nav-h, 0px)' }}
        >
          <div className="max-w-2xl mx-auto px-4 pb-4 pt-8 pointer-events-auto"
            style={{ background: 'linear-gradient(to top, #f8fafc 60%, transparent)' }}>
            <button type="button" onClick={() => setShowAddMenu(true)}
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl px-5 py-4 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-xl shadow-indigo-500/25 cursor-pointer">
              <Plus className="w-4 h-4" />
              新增景點
            </button>
          </div>
        </div>
      )}

      {showAddMenu && (
        <AddSpotMenu tripId={trip.id} day={day} token={token} onClose={() => setShowAddMenu(false)} />
      )}
      {editing && (
        <SpotEditorModal tripId={trip.id} day={day} token={token} existing={editing} onClose={() => setEditing(null)} />
      )}
    </main>
  );
}
