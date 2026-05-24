'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronDown, MapPin, Pencil, Plus, Trash2,
  ClipboardList, CalendarPlus,
  UtensilsCrossed, BedDouble, Landmark, Ticket, Train, ClipboardList as ClipboardListIcon,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { itineraryApi, ItineraryItem, SpotCategory } from '@/lib/api/itinerary.api';
import { Trip } from '@/lib/api/trips.api';
import { SpotEditorModal } from '@/components/ui/SpotEditorModal';
import { useConfirm } from '@/components/ui/ConfirmDialog';

/* ─────────────────────────── Category config ─────────────────────────── */
const CAT: Record<SpotCategory, { label: string; icon: typeof UtensilsCrossed; badge: string }> = {
  food:       { label: '美食', icon: UtensilsCrossed, badge: 'bg-orange-50 text-orange-600' },
  lodging:    { label: '住宿', icon: BedDouble,       badge: 'bg-sky-50 text-sky-600' },
  attraction: { label: '景點', icon: Landmark,        badge: 'bg-indigo-50 text-indigo-600' },
  activity:   { label: '體驗', icon: Ticket,          badge: 'bg-violet-50 text-violet-600' },
  transport:  { label: '交通', icon: Train,           badge: 'bg-slate-100 text-slate-600' },
  admin:      { label: '行政', icon: ClipboardListIcon, badge: 'bg-amber-50 text-amber-600' },
};

function getCat(c: SpotCategory | null | undefined) {
  return CAT[c ?? 'attraction'];
}

/* ─────────────────────────── Helpers ─────────────────────────── */
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'] as const;

function dayDate(day: number, startDate?: string): { md: string; wd: string } | null {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + (day - 1));
  return { md: `${d.getMonth() + 1}/${d.getDate()}`, wd: WEEKDAY[d.getDay()]! };
}

function tripDayCount(s?: string, e?: string): number | null {
  if (!s || !e) return null;
  const d = new Date(e).getTime() - new Date(s).getTime();
  return Number.isNaN(d) || d < 0 ? null : Math.ceil(d / 86400000) + 1;
}

/* ─────────────────────────── Day picker (portal dropdown) ─────────────────────────── */
function DayPicker({
  allDays, startDate, onPick, label = '排到',
}: {
  allDays: number[];
  startDate?: string;
  onPick: (day: number) => void;
  label?: string;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = menuPos !== null;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setMenuPos(null);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setMenuPos(null); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = 180;
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - w) });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
        aria-label={label}
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-900/10 py-1 min-w-[170px] max-h-72 overflow-y-auto vs-dropdown-in"
        >
          <p className="text-[10px] font-semibold text-slate-400 px-3 pt-1 pb-0.5 uppercase tracking-wider">排到</p>
          {allDays.map((d) => {
            const f = dayDate(d, startDate);
            return (
              <button
                key={d}
                type="button"
                onClick={() => { onPick(d); setMenuPos(null); }}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer transition-colors whitespace-nowrap inline-flex items-center justify-between gap-2"
              >
                <span>Day {d}</span>
                {f && <span className="text-[11px] text-slate-400">{f.md} ({f.wd})</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─────────────────────────── Bucket row ─────────────────────────── */
function BucketRow({
  item, allDays, startDate, canEdit, canDelete, onPickDay, onEdit, onDelete,
}: {
  item: ItineraryItem;
  allDays: number[];
  startDate?: string;
  canEdit: boolean;
  canDelete: boolean;
  onPickDay: (day: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cfg = getCat(item.category);
  const Icon = cfg.icon;
  return (
    <li className="px-4 py-3 flex items-start gap-3 group hover:bg-slate-50/60 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 leading-tight truncate">{item.title}</h3>
        {item.address && (
          <p className="flex items-start gap-1 mt-0.5 text-xs text-slate-500">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">{item.address}</span>
          </p>
        )}
        {item.note && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{item.note}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {canEdit && allDays.length > 0 && (
          <DayPicker allDays={allDays} startDate={startDate} onPick={onPickDay} />
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="編輯"
            className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 cursor-pointer transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="刪除"
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

/* ─────────────────────────── Main client ─────────────────────────── */
interface Props {
  trip: Trip;
  initialItems: ItineraryItem[];
  token: string;
  currentUserId: string;
}

export default function BucketClient({ trip, initialItems, token, currentUserId }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editSnapshot, setEditSnapshot] = useState<ItineraryItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const selfMutating = useRef(false);

  const myMember = trip.members.find((m) => m.userId === currentUserId);
  const isOwner = myMember?.role === 'Owner';
  const perms = trip.collaboratorPermissions ?? {
    canEditTripInfo: true, canInvite: true, canEditContent: true, canDeleteContent: true, canManageModules: true,
  };
  // Scheme Y: add ≠ edit. Owner/Editor can always add; editing existing items needs canEditContent.
  // "排到" dropdown rewrites the spot's day, which is an EDIT → uses canEdit.
  const canAdd = isOwner || myMember?.role === 'Editor';
  const canEdit = isOwner || (myMember?.role === 'Editor' && perms.canEditContent);
  const canDelete = isOwner || (myMember?.role === 'Editor' && perms.canDeleteContent);

  const { data: items = initialItems } = useQuery({
    queryKey: ['itinerary', trip.id],
    queryFn: () => itineraryApi.getByTrip(trip.id, token),
    initialData: initialItems,
  });

  /* Socket */
  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', {
      auth: { token }, transports: ['websocket', 'polling'],
    });
    s.on('connect', () => s.emit('join_trip', trip.id));
    s.on('itinerary:changed', () => {
      if (selfMutating.current) return;
      qc.invalidateQueries({ queryKey: ['itinerary', trip.id] });
    });
    return () => { s.emit('leave_trip', trip.id); s.disconnect(); };
  }, [token, trip.id, qc]);

  /* Derived data — only bucket here. Scheduled items are managed on /day/[day]
   * where each spot already has a "移到其他天" dropdown (extended to include 未排定). */
  const bucket = useMemo(() => {
    const b = items.filter((it) => it.day === null);
    b.sort((a, b2) => a.order - b2.order);
    return b;
  }, [items]);

  const tripTotalDays = tripDayCount(trip.startDate, trip.endDate);
  const allDays = useMemo<number[]>(() => {
    if (tripTotalDays !== null && tripTotalDays > 0) {
      return Array.from({ length: tripTotalDays }, (_, i) => i + 1);
    }
    const max = items.reduce((acc, it) => Math.max(acc, it.day ?? 0), 0);
    return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1);
  }, [tripTotalDays, items]);

  /* Mutations */
  const moveMutation = useMutation({
    mutationFn: ({ id, day }: { id: string; day: number | null }) => {
      selfMutating.current = true;
      return itineraryApi.updateItem(trip.id, id, { day }, token);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itinerary', trip.id] }),
    onError: () => qc.invalidateQueries({ queryKey: ['itinerary', trip.id] }),
    onSettled: () => {
      setTimeout(() => { selfMutating.current = false; }, 600);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itineraryApi.deleteItem(trip.id, id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itinerary', trip.id] }),
  });

  async function handleDelete(it: ItineraryItem) {
    const ok = await confirm({
      title: `刪除「${it.title}」?`,
      danger: true,
      confirmLabel: '刪除',
    });
    if (ok) deleteMutation.mutate(it.id);
  }

  /* Render */
  return (
    <main
      className="bg-slate-50 vs-page-enter"
      style={{ minHeight: '100dvh', paddingBottom: 'calc(80px + var(--bottom-nav-h, 0px))' }}
    >
      {/* Sticky back header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-20 md:px-6">
        <div className="max-w-2xl mx-auto">
          <Link
            href={`/trips/${trip.id}`}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer mb-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {trip.title}
          </Link>
          <h1 className="text-lg font-bold text-slate-900">未排定行程</h1>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-5 space-y-5">

        {/* Hero / summary */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-indigo-500/5 px-5 py-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30 flex-shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">
              {bucket.length > 0
                ? `${bucket.length} 個還沒決定排哪一天的景點`
                : '目前沒有未排定的景點'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              在這裡管理未排定景點，或把它們安排到某一天
            </p>
          </div>
        </section>

        {/* Bucket list */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              未排定{bucket.length > 0 ? ` (${bucket.length})` : ''}
            </h2>
            {canAdd && bucket.length > 0 && (
              <button
                type="button"
                onClick={() => setCreatingNew(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                新增
              </button>
            )}
          </div>

          {bucket.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">還沒有未排定景點</p>
              <p className="text-xs text-slate-400 mt-1">
                {canAdd
                  ? '把不確定要哪天去的景點先丟到這裡'
                  : '尚未有未排定景點'}
              </p>
              {canAdd && (
                <button
                  type="button"
                  onClick={() => setCreatingNew(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-indigo-500/30"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                  新增景點
                </button>
              )}
            </div>
          ) : (
            <ul className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-indigo-500/5 divide-y divide-slate-100 overflow-hidden">
              {bucket.map((it) => (
                <BucketRow
                  key={it.id}
                  item={it}
                  allDays={allDays}
                  startDate={trip.startDate}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onPickDay={(d) => moveMutation.mutate({ id: it.id, day: d })}
                  onEdit={() => { setEditSnapshot(it); setEditOpen(true); }}
                  onDelete={() => void handleDelete(it)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Hint: how scheduled items get back to bucket */}
        {bucket.length > 0 && (
          <p className="text-[11px] text-slate-400 text-center px-2">
            想把已安排的景點拉回未排定？在「每日行程」單天頁面點該景點的「移到其他天」可以選「📋 未排定」。
          </p>
        )}
      </div>

      {/* Modal: create new bucket item */}
      <SpotEditorModal
        open={creatingNew}
        tripId={trip.id}
        day={null}
        token={token}
        onClose={() => setCreatingNew(false)}
      />

      {/* Modal: edit existing item (bucket only — passes day=null context, but existing.day preserved) */}
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
    </main>
  );
}

