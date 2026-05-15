'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, Plus, X, Calendar, Loader2, Map, Users, AlertCircle,
  Plane, ArrowRight, Clock,
} from 'lucide-react';
import { tripsApi, Trip, resolveCoverImage } from '@/lib/api/trips.api';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { Portal } from '@/components/ui/Portal';

interface Props {
  trips: Trip[];
  token: string;
}

/* ─── helpers ─────────────────────────────────────────── */

const COVER_GRADIENTS = [
  'from-indigo-500 via-violet-500 to-purple-600',
  'from-rose-400 via-pink-500 to-fuchsia-600',
  'from-amber-400 via-orange-500 to-rose-500',
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-sky-400 via-blue-500 to-indigo-600',
  'from-violet-500 via-purple-500 to-pink-600',
];

function pickGradient(id: string): string {
  const sum = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return COVER_GRADIENTS[sum % COVER_GRADIENTS.length] as string;
}

function tripDays(startDate?: string, endDate?: string): number | null {
  if (!startDate || !endDate) return null;
  return Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

function getTripStatus(startDate?: string, endDate?: string): 'upcoming' | 'ongoing' | 'past' | 'undated' {
  if (!startDate) return 'undated';
  const now = new Date();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  if (now < start) return 'upcoming';
  if (now > end) return 'past';
  return 'ongoing';
}

const STATUS_CONFIG = {
  upcoming: { label: '即將出發', bg: 'bg-indigo-500', dot: 'bg-indigo-400' },
  ongoing:  { label: '旅途中',   bg: 'bg-emerald-500', dot: 'bg-emerald-400' },
  past:     { label: '已結束',   bg: 'bg-slate-400',   dot: 'bg-slate-300' },
  undated:  { label: '規劃中',   bg: 'bg-amber-500',   dot: 'bg-amber-400' },
};

/* ─── MemberAvatars ────────────────────────────────────── */

function MemberAvatars({ members }: { members: Trip['members'] }) {
  const visible = members.slice(0, 3);
  const extra = members.length - 3;
  const COLORS = [
    'from-indigo-400 to-violet-500',
    'from-rose-400 to-pink-500',
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
  ];
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {visible.map((m, i) => (
          <div
            key={m.userId}
            title={m.name || m.email || m.userId}
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br ${COLORS[i % COLORS.length]} border-2 border-white flex items-center justify-center text-[9px] sm:text-[10px] text-white font-bold shadow-sm`}
          >
            {(m.name || m.email || '?').charAt(0).toUpperCase()}
          </div>
        ))}
        {extra > 0 && (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] sm:text-[9px] text-slate-600 font-semibold shadow-sm">
            +{extra}
          </div>
        )}
      </div>
      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">{members.length} 位</span>
    </div>
  );
}

/* ─── TripCard ─────────────────────────────────────────── */

function TripCard({ trip }: { trip: Trip }) {
  const gradient = pickGradient(trip.id);
  const days = tripDays(trip.startDate, trip.endDate);
  const status = getTripStatus(trip.startDate, trip.endDate);
  const sc = STATUS_CONFIG[status];

  return (
    <Link href={`/trips/${trip.id}`} className="block group">
      <article className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 active:scale-[0.99] transition-all duration-300">

        {/* Cover */}
        <div className={`relative h-32 sm:h-44 bg-gradient-to-br ${gradient} overflow-hidden`}>
          {trip.coverImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveCoverImage(trip.coverImage)!}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveCoverImage(trip.coverImage)!}
                alt=""
                className="relative z-[1] w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Plane className="w-12 h-12 text-white/40" strokeWidth={1} />
            </div>
          )}

          {/* Top overlay — status + days */}
          <div className="absolute inset-x-0 top-0 z-[2] p-2 sm:p-3 flex items-start justify-between">
            <span className={`inline-flex items-center gap-1 ${sc.bg} text-white text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-md`}>
              <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${sc.dot} animate-pulse`} />
              {sc.label}
            </span>
            {days && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3" />
                {days} 天
              </span>
            )}
          </div>

          {/* Bottom gradient scrim */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent z-[2]" />

          {/* Title on image */}
          <div className="absolute inset-x-0 bottom-0 z-[3] px-2.5 pb-2 sm:px-4 sm:pb-3">
            <h2 className="text-white font-bold text-xs sm:text-base leading-snug line-clamp-2 drop-shadow-sm">
              {trip.title}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3.5 space-y-2 sm:space-y-3">
          {/* Date range */}
          {trip.startDate ? (
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600">
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="font-medium truncate">
                {formatDate(trip.startDate)}
                {trip.endDate && trip.endDate !== trip.startDate
                  ? ` — ${formatDate(trip.endDate)}`
                  : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>未設日期</span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Members + arrow */}
          <div className="flex items-center justify-between">
            <MemberAvatars members={trip.members} />
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-200 flex-shrink-0">
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 group-hover:text-white transition-colors duration-200" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

/* ─── EmptyState ───────────────────────────────────────── */

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 px-4">
      {/* Decorative illustration */}
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
          <Plane className="w-10 h-10 text-indigo-400" strokeWidth={1.5} />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-100 rounded-2xl flex items-center justify-center shadow-md">
          <MapPin className="w-4 h-4 text-amber-500" />
        </div>
        <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-emerald-100 rounded-2xl flex items-center justify-center shadow-md">
          <Calendar className="w-4 h-4 text-emerald-500" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-2">還沒有任何行程</h2>
      <p className="text-sm text-slate-400 text-center max-w-xs mb-8 leading-relaxed">
        建立你的第一個旅遊計畫，<br />邀請朋友一起共同規劃
      </p>

      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/30"
      >
        <Plus className="w-4 h-4" />
        建立第一個行程
      </button>
    </div>
  );
}

/* ─── CreateTripModal ──────────────────────────────────── */

function CreateTripModal({ token, onSuccess, onClose }: {
  token: string;
  onSuccess: (trip: Trip) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ title: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useBodyScrollLock(true);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('請輸入行程名稱'); return; }
    setError('');
    setLoading(true);
    try {
      const trip = await tripsApi.createTrip(
        { title: form.title.trim(), startDate: form.startDate || undefined, endDate: form.endDate || undefined },
        token,
      );
      onSuccess(trip);
    } catch {
      setError('建立失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] vs-modal-overlay">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm vs-backdrop-in"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-slate-900/25 border border-slate-100 overflow-y-auto vs-modal-dialog"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', maxHeight: '90dvh' }}
      >
        {/* Handle bar — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-5 sm:pt-6 sm:border-b sm:border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/30">
              <Plane className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">建立新行程</h2>
              <p className="text-xs text-slate-400 mt-0.5">開始規劃你的旅程</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-6 pb-6 pt-2 sm:pt-5 space-y-4">
          {/* Error */}
          <div className={`overflow-hidden transition-all duration-200 ${error ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>

          {/* Trip name */}
          <div className="space-y-1.5">
            <label htmlFor="trip-title" className="block text-sm font-semibold text-slate-700">
              行程名稱 <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
              <input
                id="trip-title"
                type="text"
                placeholder="例：日本關西 5 天 4 夜"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/15 transition-all duration-200"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'start-date', label: '出發日期', key: 'startDate', min: undefined },
              { id: 'end-date',   label: '回程日期', key: 'endDate',   min: form.startDate },
            ].map(({ id, label, key, min }) => (
              <div key={id} className="space-y-1.5">
                <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                  <input
                    id={id}
                    type="date"
                    value={form[key as 'startDate' | 'endDate']}
                    min={min}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full pl-9 pr-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/15 transition-all duration-200"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plane className="w-4 h-4" />}
            {loading ? '建立中...' : '出發！建立行程'}
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
}

/* ─── TripsClient (main) ───────────────────────────────── */

export default function TripsClient({ trips: initial, token }: Props) {
  const [trips, setTrips] = useState<Trip[]>(initial);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  function handleTripCreated(trip: Trip) {
    setTrips((prev) => [trip, ...prev]);
    setShowModal(false);
    router.push(`/trips/${trip.id}`);
  }

  const upcoming = trips.filter((t) => getTripStatus(t.startDate, t.endDate) !== 'past');
  const past     = trips.filter((t) => getTripStatus(t.startDate, t.endDate) === 'past');

  return (
    <main className="bg-slate-50 pb-28 md:pb-16 vs-page-enter" style={{ minHeight: '100dvh' }}>

      {/* ── Page hero ── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-8 pb-6 md:pt-10 md:pb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                <Map className="w-3.5 h-3.5" />
                我的行程
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                你的旅行計畫
              </h1>
              <p className="text-sm text-slate-400 mt-1.5">
                {trips.length === 0
                  ? '還沒有行程，建立第一個吧'
                  : `共 ${trips.length} 個行程${upcoming.length > 0 ? `，${upcoming.length} 個即將出發` : ''}`}
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="hidden md:inline-flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/25 flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              建立行程
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-8">
        {trips.length === 0 ? (
          <div className="grid">
            <EmptyState onNew={() => setShowModal(true)} />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Upcoming / undated / ongoing */}
            {upcoming.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-5">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">即將出發</h2>
                  <span className="text-xs bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
                    {upcoming.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {upcoming.map((trip) => <TripCard key={trip.id} trip={trip} />)}
                </div>
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-5">
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">過去行程</h2>
                  <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                    {past.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 opacity-80">
                  {past.map((trip) => <TripCard key={trip.id} trip={trip} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile FAB ── */}
      <button
        onClick={() => setShowModal(true)}
        className="md:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-5 bg-indigo-600 text-white w-14 h-14 rounded-2xl shadow-xl shadow-indigo-500/40 flex items-center justify-center hover:bg-indigo-700 active:scale-[0.93] transition-all duration-200 cursor-pointer z-20"
        aria-label="新增行程"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showModal && (
        <CreateTripModal
          token={token}
          onSuccess={handleTripCreated}
          onClose={() => setShowModal(false)}
        />
      )}
    </main>
  );
}
