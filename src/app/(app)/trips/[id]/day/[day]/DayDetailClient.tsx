'use client';

import { ComponentType, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Calendar, UtensilsCrossed, BedDouble, Landmark, Ticket, Train,
  ClipboardList, Check, ArrowRightLeft, Circle, AlertTriangle, Loader2,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { itineraryApi, ItineraryItem, SpotCategory } from '@/lib/api/itinerary.api';
import { Trip } from '@/lib/api/trips.api';
import { SpotEditorModal } from '@/components/ui/SpotEditorModal';
import { AddSpotMenu } from '@/components/ui/AddSpotMenu';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Portal } from '@/components/ui/Portal';
import { useNavigationGuard, triggerNavigationGuard } from '@/lib/hooks/useNavigationGuard';

/* ─────────────────────────── Category config ─────────────────────────── */
type CatCfg = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge: string;    // badge bg + text
};

const CAT: Record<SpotCategory, CatCfg> = {
  food:       { label: '美食', icon: UtensilsCrossed, badge: 'bg-orange-50 text-orange-600' },
  lodging:    { label: '住宿', icon: BedDouble,       badge: 'bg-sky-50 text-sky-600'      },
  attraction: { label: '景點', icon: Landmark,        badge: 'bg-indigo-50 text-indigo-600' },
  activity:   { label: '體驗', icon: Ticket,          badge: 'bg-violet-50 text-violet-600' },
  transport:  { label: '交通', icon: Train,           badge: 'bg-slate-100 text-slate-600'  },
  admin:      { label: '行政', icon: ClipboardList,   badge: 'bg-amber-50 text-amber-600'   },
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

/* ─────────────────────────── Action buttons (edit/delete/move) ─────────────────────────── */
function ActionButtons({
  item, canEdit, canDelete, onEdit, onDelete, onMove, totalDays, currentDay, startDate,
}: {
  item: ItineraryItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** targetDay: number → 排到某天；null → 拉回未排定 bucket */
  onMove?: (targetDay: number | null) => void;
  totalDays?: number;
  currentDay?: number;
  startDate?: string;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);
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

  function openMoveMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (showMoveMenu) { setMenuPos(null); return; }
    const rect = moveButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dropdownWidth = 160;
    const left = Math.max(8, rect.right - dropdownWidth);
    setMenuPos({ top: rect.bottom + 4, left });
  }

  // Always allow opening the move menu when editable — at minimum you can
  // bounce to 未排定. If there's only 1 day, the "其他天" list is empty but
  // the 未排定 option still shows.
  const canMove = canEdit && !!onMove;
  if (!canEdit && !canDelete) return null;

  return (
    <div
      className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 sm:transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
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
              className="bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-900/10 py-1 min-w-[180px] max-h-72 overflow-y-auto vs-dropdown-in"
            >
              <p className="text-[10px] font-semibold text-slate-400 px-3 pt-1 pb-0.5 uppercase tracking-wider">移到</p>
              <button
                type="button"
                onClick={() => { onMove!(null); setMenuPos(null); }}
                className="w-full text-left px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors whitespace-nowrap inline-flex items-center gap-2"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                未排定
              </button>
              {totalDays && totalDays > 1 && (
                <>
                  <div className="h-px bg-slate-100 my-1" />
                  {Array.from({ length: totalDays }, (_, i) => i + 1)
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
                </>
              )}
            </div>,
            document.body,
          )}
        </>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 cursor-pointer transition-colors"
          aria-label={`編輯 ${item.title}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
          aria-label={`刪除 ${item.title}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── Timeline card body (shared) ─────────────────────────── */
function TimelineCardContent({
  item, timed, canEdit, canDelete, onEdit, onDelete, onMove, totalDays, currentDay, startDate, dragHandleProps,
}: {
  item: ItineraryItem;
  timed: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove?: (targetDay: number | null) => void;
  totalDays?: number;
  currentDay?: number;
  startDate?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const cfg = getCat(item.category);
  const Icon = cfg.icon;

  return (
    <div className="flex items-start gap-2">
      {/* Grip handle (untimed only) */}
      {!timed && canEdit && (
        <button
          type="button"
          {...(dragHandleProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          aria-label="拖曳排序"
          onClick={(e) => e.stopPropagation()}
          className="touch-none flex-shrink-0 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 rounded -ml-1 mt-0.5"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 leading-tight">
              {item.title}
            </h4>
            {item.address && (
              <p className="flex items-start gap-1 mt-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                <span className="truncate">{item.address}</span>
              </p>
            )}
            {item.note && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{item.note}</p>
            )}
          </div>

          {/* Right column: time/未設時間 + badge stacked */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {timed && item.startTime ? (
              <span className="text-xs font-bold text-indigo-600 tabular-nums">
                {item.startTime.slice(0, 5)}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 inline-flex items-center gap-0.5">
                <Circle className="w-2.5 h-2.5" />
                未設時間
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
              <Icon className="w-2.5 h-2.5" />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Action buttons row (hover) */}
        {(canEdit || canDelete) && (
          <div className="mt-1.5 flex justify-end">
            <ActionButtons
              item={item}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              totalDays={totalDays}
              currentDay={currentDay}
              startDate={startDate}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Timeline row (timed, non-draggable) ─────────────────────────── */
function TimedTimelineRow({
  item, canEdit, canDelete, onEdit, onDelete, onMove, totalDays, currentDay, startDate, gapAfter,
}: {
  item: ItineraryItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove?: (targetDay: number | null) => void;
  totalDays?: number;
  currentDay?: number;
  startDate?: string;
  gapAfter?: string;
}) {
  return (
    <div className="relative mb-2.5 group">
      {/* Dot */}
      <div className="absolute -left-7 top-3 w-5 h-5 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center shadow-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
      </div>

      {/* Card (click-through to edit) */}
      <div
        onClick={canEdit ? onEdit : undefined}
        className={[
          'bg-white rounded-xl border border-slate-100 shadow-sm shadow-indigo-500/5',
          'hover:shadow-md hover:border-indigo-200 transition-all px-4 py-3',
          canEdit ? 'cursor-pointer' : '',
        ].join(' ')}
      >
        <TimelineCardContent
          item={item}
          timed
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          totalDays={totalDays}
          currentDay={currentDay}
          startDate={startDate}
        />
      </div>

      {/* Gap annotation between this and next timed item */}
      {gapAfter && (
        <div className="pl-1 pt-1 pb-0.5 text-[11px] text-slate-400 italic">
          {gapAfter} 後
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Sortable untimed timeline row ─────────────────────────── */
function SortableUntimedTimelineRow({
  item, canEdit, canDelete, onEdit, onDelete, onMove, totalDays, currentDay, startDate,
}: {
  item: ItineraryItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove?: (targetDay: number | null) => void;
  totalDays?: number;
  currentDay?: number;
  startDate?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: item.id, disabled: !canEdit });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
        willChange: 'transform',
      }}
      className="relative mb-2.5 group"
    >
      {/* Dot */}
      <div className="absolute -left-7 top-3 w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shadow-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
      </div>

      {/* Card (dashed border) */}
      <div
        onClick={canEdit ? onEdit : undefined}
        className={[
          'bg-white rounded-xl border border-dashed border-slate-200 shadow-sm shadow-indigo-500/5',
          'hover:shadow-md hover:border-indigo-300 transition-all px-4 py-3',
          canEdit ? 'cursor-pointer' : '',
        ].join(' ')}
      >
        <TimelineCardContent
          item={item}
          timed={false}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          totalDays={totalDays}
          currentDay={currentDay}
          startDate={startDate}
          dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── Main page ─────────────────────────── */
interface Props {
  trip: Trip;
  day: number;
  initialItems: ItineraryItem[];
  token: string;
  currentUserId: string;
}

export default function DayDetailClient({ trip, day, initialItems, token, currentUserId }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const router = useRouter();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<ItineraryItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Live-sorted untimed items during drag (null = not dragging, use server order)
  const [dragItems, setDragItems] = useState<ItineraryItem[] | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Suppress self-triggered itinerary:changed after reorder (server broadcasts to all incl. self)
  const selfReordering = useRef(false);

  // Unsaved-changes guard
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);
  const navAfterSaveRef = useRef<string | null>(null);
  useNavigationGuard(!!pendingOrder, (href) => setPendingNavHref(href));

  const totalDays = tripDayCount(trip.startDate, trip.endDate) ?? day;
  const myMember = trip.members.find((m) => m.userId === currentUserId);
  const isOwner = myMember?.role === 'Owner';
  const perms = trip.collaboratorPermissions ?? {
    canEditTripInfo: true, canInvite: true, canEditContent: true, canDeleteContent: true, canManageModules: true,
  };
  // Scheme Y. 注意：drag-reorder / 移到其他天 / 編輯既有景點 → canEdit；新增景點 → canAdd。
  // 刪除 → canDelete（後端 deleteItem 已正確檢查 canDeleteContent）。
  const canAdd = isOwner || myMember?.role === 'Editor';
  const canEdit = isOwner || (myMember?.role === 'Editor' && perms.canEditContent);
  const canDelete = isOwner || (myMember?.role === 'Editor' && perms.canDeleteContent);

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
    onSuccess: () => {
      setPendingOrder(null);
      if (navAfterSaveRef.current) {
        router.push(navAfterSaveRef.current);
        navAfterSaveRef.current = null;
      }
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['day', trip.id, day] });
      setPendingOrder(null);
      navAfterSaveRef.current = null;
    },
    onSettled: () => {
      setTimeout(() => { selfReordering.current = false; }, 600);
    },
  });

  function saveOrder() {
    if (!pendingOrder) return;
    reorderMutation.mutate([...timed.map(t => t.id), ...pendingOrder]);
  }

  function handleSaveAndNavigate() {
    if (!pendingNavHref || !pendingOrder) return;
    navAfterSaveRef.current = pendingNavHref;
    setPendingNavHref(null);
    reorderMutation.mutate([...timed.map(t => t.id), ...pendingOrder]);
  }

  function handleDiscardAndNavigate() {
    if (!pendingNavHref) return;
    const href = pendingNavHref;
    setPendingNavHref(null);
    setPendingOrder(null);
    router.push(href);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itineraryApi.deleteItem(trip.id, id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day', trip.id, day] }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ itemId, targetDay }: { itemId: string; targetDay: number | null }) =>
      itineraryApi.updateItem(trip.id, itemId, { day: targetDay }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day', trip.id, day] });
      qc.invalidateQueries({ queryKey: ['itinerary', trip.id] });
    },
  });

  /** targetDay: number → 排到某天；null → 拉回未排定 bucket */
  const handleMove = useCallback((itemId: string, targetDay: number | null) => {
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

  // Render-prep flags
  const hasUntimed = untimed.length > 0;

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
            onClick={(e) => { if (triggerNavigationGuard(`/trips/${trip.id}`)) e.preventDefault(); }}
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
                <Link
                  href={`/trips/${trip.id}/day/${day - 1}`}
                  onClick={(e) => { if (triggerNavigationGuard(`/trips/${trip.id}/day/${day - 1}`)) e.preventDefault(); }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              )}
              {day < totalDays && (
                <Link
                  href={`/trips/${trip.id}/day/${day + 1}`}
                  onClick={(e) => { if (triggerNavigationGuard(`/trips/${trip.id}/day/${day + 1}`)) e.preventDefault(); }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                >
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
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 px-6 py-10 text-center vs-anim-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              Day {day} 尚未安排景點
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {canAdd ? '點下面按鈕加入第一個景點' : '尚未安排景點'}
            </p>
            {canAdd && (
              <button
                type="button"
                onClick={() => setShowAddMenu(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-indigo-500/30"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                新增第一個景點
              </button>
            )}
          </div>
        )}

        {/* ── Timeline ── */}
        {items.length > 0 && (
          <div className="relative pl-7">
            {/* Vertical line */}
            <div className="absolute left-[10px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-200 via-indigo-200 to-indigo-50" />

            {/* Timed items (not draggable) */}
            {timed.map((item, i) => {
              const next = timed[i + 1];
              const gap = next?.startTime ? gapLabel(item.startTime!, next.startTime) : '';
              return (
                <TimedTimelineRow
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={() => { setEditSnapshot(item); setEditOpen(true); }}
                  onDelete={() => void confirmDelete(item)}
                  onMove={(targetDay) => handleMove(item.id, targetDay)}
                  totalDays={totalDays}
                  currentDay={day}
                  startDate={trip.startDate}
                  gapAfter={gap || undefined}
                />
              );
            })}

            {/* Divider / hint label for untimed section */}
            {hasUntimed && canEdit && (
              <div className="relative mb-2.5">
                <div className="absolute -left-7 top-1.5 w-5 h-5 rounded-full bg-white border-2 border-dashed border-slate-300 flex items-center justify-center">
                  <GripVertical className="w-2.5 h-2.5 text-slate-400" />
                </div>
                <p className="text-[11px] font-medium text-slate-400 inline-flex items-center gap-1.5 py-1">
                  未指定時間 · 拖曳調整順序
                </p>
              </div>
            )}

            {/* Untimed items (DnD) */}
            {hasUntimed && (
              mounted ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={displayUntimed.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {displayUntimed.map(item => (
                      <SortableUntimedTimelineRow
                        key={item.id}
                        item={item}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={() => { setEditSnapshot(item); setEditOpen(true); }}
                        onDelete={() => void confirmDelete(item)}
                        onMove={(targetDay) => handleMove(item.id, targetDay)}
                        totalDays={totalDays}
                        currentDay={day}
                        startDate={trip.startDate}
                      />
                    ))}
                  </SortableContext>
                  <DragOverlay dropAnimation={null}>
                    {activeItem && (
                      <div
                        style={{
                          transform: 'scale(1.03) rotate(0.6deg)',
                          boxShadow: '0 24px 48px -8px rgba(0,0,0,0.18), 0 8px 16px -4px rgba(99,102,241,0.15)',
                          cursor: 'grabbing',
                        }}
                        className="rounded-xl bg-white border border-dashed border-indigo-300 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 leading-tight">{activeItem.title}</p>
                            {activeItem.address && (
                              <p className="flex items-start gap-1 mt-1 text-xs text-slate-500">
                                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                                <span className="truncate">{activeItem.address}</span>
                              </p>
                            )}
                          </div>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${getCat(activeItem.category).badge}`}>
                            {getCat(activeItem.category).label}
                          </span>
                        </div>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              ) : (
                displayUntimed.map(item => (
                  <SortableUntimedTimelineRow
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={() => { setEditSnapshot(item); setEditOpen(true); }}
                    onDelete={() => void confirmDelete(item)}
                    onMove={(targetDay) => handleMove(item.id, targetDay)}
                    totalDays={totalDays}
                    currentDay={day}
                    startDate={trip.startDate}
                  />
                ))
              )
            )}
          </div>
        )}
      </div>

      {/* ── Sticky add button ── */}
      {canAdd && items.length > 0 && (
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

      <AddSpotMenu open={showAddMenu} tripId={trip.id} day={day} token={token} onClose={() => setShowAddMenu(false)} />
      {editSnapshot && (
        <SpotEditorModal open={editOpen} tripId={trip.id} day={day} token={token} existing={editSnapshot} onClose={() => setEditOpen(false)} />
      )}

      {/* Unsaved-changes guard dialog */}
      {pendingNavHref && (
        <Portal>
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPendingNavHref(null)} aria-hidden />
            <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 vs-modal-dialog">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">有未儲存的變更</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    您已調整景點排列順序但尚未儲存，離開後變更將遺失。
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleDiscardAndNavigate}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  取消編輯並離開
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndNavigate}
                  disabled={reorderMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 shadow-sm shadow-indigo-500/30"
                >
                  {reorderMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Check className="w-4 h-4" />}
                  儲存
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </main>
  );
}
