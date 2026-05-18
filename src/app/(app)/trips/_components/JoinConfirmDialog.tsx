'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, Loader2, LogIn } from 'lucide-react';
import { tripsApi, TripPreview } from '@/lib/api/trips.api';

interface Props {
  preview: TripPreview;
  token: string;
  /** 'code' = 透過邀請碼加入，'id' = 透過直接連結加入 */
  joinMode: 'code' | 'id';
  inviteCode?: string;
}

function formatDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function JoinConfirmDialog({ preview, token, joinMode, inviteCode }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      let trip;
      if (joinMode === 'code' && inviteCode) {
        trip = await tripsApi.joinByInviteCode(inviteCode, token);
      } else {
        trip = await tripsApi.joinByTripId(preview.id, token);
      }
      router.push(`/trips/${trip.id}`);
    } catch {
      setError('加入失敗，請稍後再試');
      setLoading(false);
    }
  }

  const startStr = formatDate(preview.startDate);
  const endStr = formatDate(preview.endDate);

  return (
    <main
      className="flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 px-4"
      style={{ minHeight: '100dvh' }}
    >
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-500/10 border border-slate-100 overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

          <div className="p-7">
            {/* Label */}
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              <LogIn className="w-3.5 h-3.5" />
              你被邀請加入行程
            </div>

            {/* Trip name */}
            <h1 className="text-2xl font-bold text-slate-900 mb-1 leading-snug">
              {preview.title}
            </h1>
            <p className="text-sm text-slate-500 mb-5">
              由 <span className="font-semibold text-slate-700">{preview.ownerName}</span> 主辦
            </p>

            {/* Info */}
            <div className="space-y-2.5 mb-7">
              {(startStr || endStr) && (
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <span>
                    {startStr ?? '未設日期'}
                    {endStr && endStr !== startStr ? ` — ${endStr}` : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm text-slate-600">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <span>目前 {preview.memberCount} 位成員</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl px-6 py-3.5 text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />加入中...</>
                ) : (
                  <><LogIn className="w-4 h-4" />確定加入</>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push('/trips')}
                disabled={loading}
                className="w-full px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                取消，回到我的行程
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
