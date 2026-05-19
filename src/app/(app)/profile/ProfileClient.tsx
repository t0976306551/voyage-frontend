'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { User, Mail, LogOut, Shield, Home, ChevronRight, Map, Copy, Check, Users, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { userApi, TripInvitation, UserProfile, InvitationHistoryEntry } from '@/lib/api/user.api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatRelativeDays } from '@/lib/utils/relative-time';

interface Props {
  name: string;
  email: string;
  image: string | null;
  token: string;
}

export default function ProfileClient({ name, email, image, token }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    userApi.getMe(token).then(setUserProfile).catch(() => {});
  }, [token]);

  useEffect(() => {
    userApi.getMyInvitations(token)
      .then(setInvitations)
      .catch(() => {})
      .finally(() => setInvitationsLoading(false));
  }, [token]);

  /* ── Invitation history (people I've invited) ── */
  const historyQuery = useQuery<InvitationHistoryEntry[]>({
    queryKey: ['invitation-history'],
    queryFn: () => userApi.getInvitationHistory({}, token),
    placeholderData: keepPreviousData,
  });
  const history: InvitationHistoryEntry[] = historyQuery.data ?? [];

  async function acceptInvite(id: string) {
    try {
      await userApi.acceptInvitation(id, token);
      setInvitations(prev => prev.filter(i => i.id !== id));
      toast.show({ message: '已接受行程邀請', variant: 'success' });
    } catch {
      toast.show({ message: '操作失敗，請稍後再試', variant: 'error' });
    }
  }

  async function declineInvite(id: string) {
    try {
      await userApi.declineInvitation(id, token);
      setInvitations(prev => prev.filter(i => i.id !== id));
      toast.show({ message: '已拒絕邀請', variant: 'info' });
    } catch {
      toast.show({ message: '操作失敗，請稍後再試', variant: 'error' });
    }
  }

  async function copyHandle() {
    if (!userProfile?.handle) return;
    try {
      await navigator.clipboard.writeText(userProfile.handle);
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 1500);
    } catch {
      /* insecure origin */
    }
  }

  async function removeFromHistory(entry: InvitationHistoryEntry) {
    const ok = await confirm({
      title: '從歷史中移除？',
      message: '下次在行程設定不會再看到此人，但已建立的邀請不受影響。',
      confirmLabel: '移除',
      danger: true,
    });
    if (!ok) return;

    // Optimistic update
    const previous = historyQuery.data ?? [];
    qc.setQueryData<InvitationHistoryEntry[]>(['invitation-history'], (cur) =>
      (cur ?? []).filter((e) => e.userId !== entry.userId),
    );
    setRemovingId(entry.userId);
    try {
      await userApi.hideInvitationHistory(entry.userId, token);
      await qc.invalidateQueries({ queryKey: ['invitation-history'] });
      toast.show({ message: '已從歷史移除', variant: 'success' });
    } catch {
      // Rollback
      qc.setQueryData<InvitationHistoryEntry[]>(['invitation-history'], previous);
      toast.show({ message: '移除失敗，請稍後再試', variant: 'error' });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 pb-24" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-900">我的帳號</h1>
        <p className="text-sm text-slate-500 mt-0.5">帳號資訊與設定</p>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto space-y-5">
        {/* Avatar + name card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-indigo-500/10 border border-slate-100 p-6 flex items-center gap-4">
          {image ? (
            <Image
              src={image}
              alt={name}
              width={64}
              height={64}
              className="rounded-2xl object-cover"
            />
          ) : (
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-lg truncate">{name || '旅行者'}</p>
            <p className="text-slate-500 text-sm flex items-start gap-1.5 mt-0.5 break-all">
              <Mail className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{email}</span>
            </p>
            {userProfile?.handle && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <p className="text-xs font-mono text-slate-500">識別碼：{userProfile.handle}</p>
                <button
                  type="button"
                  onClick={() => void copyHandle()}
                  aria-label="複製識別碼"
                  className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {copiedHandle ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Trip invitations */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900">行程邀請</h2>
              {invitations.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  {invitations.length}
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {invitationsLoading ? (
              <div className="px-5 py-6 text-center text-sm text-slate-400">載入中…</div>
            ) : invitations.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-slate-400">目前沒有待確認的行程邀請</div>
            ) : (
              invitations.map(inv => (
                <div key={inv.id} className="px-5 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-200 flex items-center justify-center flex-shrink-0">
                    <Map className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{inv.tripTitle}</p>
                    <p className="text-xs text-slate-500">{inv.inviterName} 邀請你加入</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => void acceptInvite(inv.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:scale-[0.97] transition-all cursor-pointer"
                    >
                      接受
                    </button>
                    <button
                      type="button"
                      onClick={() => void declineInvite(inv.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 active:scale-[0.97] transition-all cursor-pointer"
                    >
                      拒絕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Invitation history — 我邀請過的人 */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900">我邀請過的人</h2>
              {history.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  {history.length}
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {historyQuery.isLoading ? (
              <div className="px-5 py-6 text-center text-sm text-slate-400">載入中…</div>
            ) : history.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-slate-500">你還沒邀請過任何人</p>
                <p className="text-xs text-slate-400 mt-1">用 Handle 邀請他人加入行程後，會出現在這裡</p>
              </div>
            ) : (
              history.map(entry => (
                <div key={entry.userId} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-200 flex items-center justify-center text-indigo-700 text-sm font-semibold flex-shrink-0 overflow-hidden">
                    {entry.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (entry.name || entry.handle).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{entry.name || '未命名'}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">
                      {entry.handle}
                      <span className="ml-1.5 text-slate-400 font-sans">· 上次邀請：{formatRelativeDays(entry.lastInvitedAt)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeFromHistory(entry)}
                    disabled={removingId === entry.userId}
                    aria-label={`從歷史移除 ${entry.name || entry.handle}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors cursor-pointer flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    移除
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Info rows */}
        <div className="bg-white rounded-2xl shadow-xl shadow-indigo-500/10 border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">帳號安全</p>
              <p className="text-xs text-slate-400">Email 帳號已驗證</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">Email</p>
              <p className="text-xs text-slate-400 break-all">{email}</p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <Link
          href="/"
          className="w-full flex items-center gap-3 bg-white text-slate-700 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium hover:border-indigo-300 hover:text-indigo-600 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm"
        >
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Home className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="flex-1 text-left">回到首頁</span>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </Link>

        {/* Logout */}
        <button
          onClick={() => void signOut({ callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-2.5 bg-white text-red-500 border border-red-100 rounded-2xl px-6 py-4 text-sm font-semibold hover:bg-red-50 hover:border-red-200 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          登出帳號
        </button>
      </div>
    </main>
  );
}
