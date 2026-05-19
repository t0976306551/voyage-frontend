'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Settings, CheckSquare, DollarSign, ListChecks, Users, Copy, Check, Link2,
  Calendar, Save, UserPlus, UserMinus, LogOut, Shield,
} from 'lucide-react';
import { Trip, tripsApi, EnabledModules, CollaboratorPermissions } from '@/lib/api/trips.api';
import { userApi, UserSearchResult, PendingInvitee } from '@/lib/api/user.api';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Portal } from '@/components/ui/Portal';

interface Props {
  trip: Trip;
  token: string;
  isOwner: boolean;
  currentUserId: string;
  /** Current item counts per module — used to warn before disabling a non-empty module. */
  moduleCounts?: { checklists: number; tasks: number; expenses: number };
  onClose: () => void;
}

type TabKey = 'trip' | 'members' | 'permissions';

const MODULES: Array<{ key: keyof EnabledModules; label: string; desc: string; icon: typeof CheckSquare }> = [
  { key: 'checklists', label: '協作清單', desc: '大家各自打勾的事 — eSIM、入境卡…', icon: ListChecks },
  { key: 'tasks',      label: '待辦',     desc: '一個人負責的任務（例如：訂機票、換日幣）', icon: CheckSquare },
  { key: 'expenses',   label: '費用分攤', desc: '記帳 + 多人分攤計算', icon: DollarSign },
];

const PERMISSION_ITEMS: Array<{
  key: keyof CollaboratorPermissions;
  label: string;
  desc: string;
}> = [
  {
    key: 'canEditTripInfo',
    label: '可以修改行程資訊',
    desc: '行程名稱、出發/回程日期',
  },
  {
    key: 'canInvite',
    label: '可以邀請新成員',
    desc: '查看邀請碼並分享加入連結',
  },
  {
    key: 'canDeleteContent',
    label: '可以刪除內容',
    desc: '刪除景點、費用、待辦、清單項目',
  },
  {
    key: 'canManageModules',
    label: '可以管理功能模組',
    desc: '開啟或關閉協作清單、待辦、費用',
  },
];

export function TripSettingsDrawer({ trip, token, isOwner, currentUserId, moduleCounts, onClose }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<TabKey>('trip');

  /* ── Trip info state ── */
  const [title, setTitle] = useState(trip.title);
  const [startDate, setStartDate] = useState(trip.startDate ?? '');
  const [endDate, setEndDate] = useState(trip.endDate ?? '');
  const infoChanged =
    title.trim() !== trip.title ||
    startDate !== (trip.startDate ?? '') ||
    endDate !== (trip.endDate ?? '');

  /* ── Module state ── */
  const [modules, setModules] = useState<EnabledModules>(trip.enabledModules);
  const MODULE_LABEL: Record<keyof EnabledModules, string> = {
    tasks: '待辦', expenses: '費用分攤', checklists: '協作清單',
  };

  /* ── Cover state ── */

  /* ── Invite copy state ── */
  const [copiedKey, setCopiedKey] = useState<'code' | 'link' | null>(null);

  /* ── Handle invite state ── */
  const [handleInput, setHandleInput] = useState('');
  const [searchResult, setSearchResult] = useState<UserSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [pendingInvitees, setPendingInvitees] = useState<PendingInvitee[]>([]);
  const [inviting, setInviting] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    userApi.getPendingInvitees(trip.id, token)
      .then(setPendingInvitees)
      .catch(() => {});
  }, [trip.id, token, isOwner]);

  useBodyScrollLock(true);

  /* ── Mutations ── */
  const infoMutation = useMutation({
    mutationFn: () => {
      const data: { title?: string; startDate?: string; endDate?: string } = {};
      if (title.trim() !== trip.title) data.title = title.trim();
      if (startDate !== (trip.startDate ?? '')) data.startDate = startDate;
      if (endDate !== (trip.endDate ?? '')) data.endDate = endDate;
      return tripsApi.updateTrip(trip.id, data, token);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['trip', trip.id], updated);
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.show({ message: '已儲存', variant: 'success' });
    },
    onError: (e: Error) => toast.show({ message: e.message || '儲存失敗', variant: 'error' }),
  });

  const moduleMutation = useMutation({
    mutationFn: (patch: Partial<EnabledModules>) =>
      tripsApi.setEnabledModules(trip.id, patch, token),
    onSuccess: (updated) => {
      qc.setQueryData(['trip', trip.id], updated);
      qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  async function toggle(key: keyof EnabledModules) {
    const next = !modules[key];
    const label = MODULE_LABEL[key];

    // Disabling: block entirely if there's data. User must delete all items first.
    if (!next) {
      const count = moduleCounts?.[key] ?? 0;
      if (count > 0) {
        await confirm({
          title: `無法關閉「${label}」`,
          message: `這趟行程的「${label}」還有 ${count} 個項目。\n請先回到「${label}」把所有項目刪除後，再來關閉這個模組。`,
          confirmLabel: '我知道了',
          cancelLabel: null, // single-action alert
          danger: true,
        });
        return; // never apply the disable when there's data
      }
    }

    setModules((m) => ({ ...m, [key]: next }));
    moduleMutation.mutate({ [key]: next });
    if (!next) {
      toast.show({
        message: `已關閉「${label}」`,
        variant: 'info',
        action: {
          label: '還原',
          onClick: () => {
            setModules((m) => ({ ...m, [key]: true }));
            moduleMutation.mutate({ [key]: true });
          },
        },
      });
    }
  }

  const leaveMutation = useMutation({
    mutationFn: () => tripsApi.leaveTrip(trip.id, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.removeQueries({ queryKey: ['trip', trip.id] });
      onClose();
      router.push('/trips');
    },
    onError: () => toast.show({ message: '退出失敗，請稍後再試', variant: 'error' }),
  });

  const kickMutation = useMutation({
    mutationFn: (userId: string) => tripsApi.removeMember(trip.id, userId, token),
    onSuccess: (updated) => {
      qc.setQueryData(['trip', trip.id], updated);
      qc.invalidateQueries({ queryKey: ['trips'] });
      setKickingId(null);
      toast.show({ message: '已移除成員', variant: 'success' });
    },
    onError: () => toast.show({ message: '移除失敗，請稍後再試', variant: 'error' }),
  });

  const permMutation = useMutation({
    mutationFn: (patch: Partial<CollaboratorPermissions>) =>
      tripsApi.updateCollaboratorPermissions(trip.id, patch, token),
    onSuccess: (updated) => {
      qc.setQueryData(['trip', trip.id], updated);
      qc.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: () => toast.show({ message: '儲存失敗，請稍後再試', variant: 'error' }),
  });

  async function searchHandle() {
    const h = handleInput.trim().toUpperCase();
    if (!h) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const result = await userApi.searchByHandle(h, token);
      setSearchResult(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setSearchError(msg === 'USER_NOT_FOUND' ? '找不到此 Handle 的使用者' : '搜尋失敗');
    } finally {
      setSearching(false);
    }
  }

  async function sendInvite() {
    if (!searchResult) return;
    setInviting(true);
    try {
      await userApi.inviteByHandle(trip.id, searchResult.handle, token);
      setPendingInvitees(prev => [...prev, {
        id: Date.now().toString(),
        userId: searchResult.id,
        userName: searchResult.name,
        userHandle: searchResult.handle,
        invitedAt: new Date().toISOString(),
      }]);
      setSearchResult(null);
      setHandleInput('');
      toast.show({ message: `已邀請 ${searchResult.name}`, variant: 'success' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      const text = msg === 'ALREADY_MEMBER' ? '對方已是行程成員'
        : msg === 'ALREADY_INVITED' ? '已送出邀請，等待對方確認'
        : '邀請失敗，請稍後再試';
      toast.show({ message: text, variant: 'error' });
    } finally {
      setInviting(false);
    }
  }

  async function cancelInvite(userId: string) {
    await userApi.cancelInvitation(trip.id, userId, token);
    setPendingInvitees(prev => prev.filter(p => p.userId !== userId));
  }

  async function copyText(text: string, key: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* insecure origin */
    }
  }

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/trips/join?code=${trip.inviteCode}`
    : `/trips/join?code=${trip.inviteCode}`;

  /* ── Collaborator permissions (with fallback defaults) ── */
  const perms: CollaboratorPermissions = trip.collaboratorPermissions ?? {
    canEditTripInfo: false,
    canInvite: false,
    canDeleteContent: false,
    canManageModules: false,
  };

  /* ── Show invite section to Editor if canInvite is not explicitly false ── */
  const showInviteSection = isOwner || perms.canInvite !== false;

  /* ── Tab definitions ── */
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'trip', label: '行程' },
    { key: 'members', label: '成員' },
    ...(isOwner ? [{ key: 'permissions' as TabKey, label: '協作者權限' }] : []),
  ];

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] vs-modal-overlay">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog panel */}
      <aside
        role="dialog"
        aria-label="行程設定"
        className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 flex flex-col vs-modal-dialog"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-900">行程設定</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Tab bar */}
        <div className="flex border-b border-slate-100 px-5 flex-shrink-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto px-5 py-5 space-y-6"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          {/* ══════════════════════════════════════
              Tab 1 — 行程
          ══════════════════════════════════════ */}
          {activeTab === 'trip' && (
            <>
              {/* ── Trip info (Owner only) ── */}
              {isOwner && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    行程資訊
                  </h3>

                  <div className="space-y-3">
                    {/* Title */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">行程名稱</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={80}
                        placeholder="為這趟旅程取個名字"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                      />
                    </div>

                    {/* Dates row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">出發日期</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">回程日期</label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || undefined}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Save button */}
                    {infoChanged && (
                      <button
                        type="button"
                        onClick={() => infoMutation.mutate()}
                        disabled={infoMutation.isPending || !title.trim()}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {infoMutation.isPending ? '儲存中…' : '儲存變更'}
                      </button>
                    )}
                    {infoMutation.isError && (
                      <p className="text-xs text-red-600">儲存失敗，請稍後再試</p>
                    )}
                  </div>
                </section>
              )}

              {/* ── Modules (Owner 永遠可見；Editor 需 canManageModules) ── */}
              {(isOwner || perms.canManageModules) && (
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">啟用模組</h3>
                <p className="text-xs text-slate-500 mb-3">關閉的模組會從這趟行程隱藏，但資料保留。</p>
                <ul className="space-y-2">
                  {MODULES.map(({ key, label, desc, icon: Icon }) => {
                    const on = modules[key];
                    return (
                      <li
                        key={key}
                        className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${on ? '停用' : '啟用'}${label}`}
                          onClick={() => toggle(key)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                            on ? 'bg-indigo-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                              on ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {moduleMutation.isError && (
                  <p className="mt-3 text-xs text-red-600">儲存失敗，請稍後再試</p>
                )}
              </section>
              )}
            </>
          )}

          {/* ══════════════════════════════════════
              Tab 2 — 成員
          ══════════════════════════════════════ */}
          {activeTab === 'members' && (
            <>
              {/* ── Invite (Owner always; Editor only if canInvite) ── */}
              {showInviteSection && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-1 inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-500" />
                    邀請成員
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">複製邀請碼或連結給朋友，他們就能加入這個行程。</p>
                  <div className="space-y-2">
                    <div className="flex items-stretch gap-2">
                      <div className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base text-slate-900 tracking-wider text-center select-all">
                        {trip.inviteCode}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(trip.inviteCode, 'code')}
                        aria-label="複製邀請碼"
                        className={`px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] cursor-pointer inline-flex items-center gap-1 ${
                          copiedKey === 'code'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {copiedKey === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(inviteLink, 'link')}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] cursor-pointer border ${
                        copiedKey === 'link'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      {copiedKey === 'link' ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                      {copiedKey === 'link' ? '已複製' : '複製分享連結'}
                    </button>
                  </div>
                </section>
              )}

              {/* ── Handle invite (Owner only) ── */}
              {isOwner && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-1 inline-flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-indigo-500" />
                    以 Handle 邀請
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">輸入對方的識別碼（例：VS_AB12C）直接邀請加入</p>

                  {/* Search row */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={handleInput}
                      onChange={e => { setHandleInput(e.target.value.toUpperCase()); setSearchResult(null); setSearchError(null); }}
                      onKeyDown={e => e.key === 'Enter' && void searchHandle()}
                      placeholder="VS_XXXXX"
                      maxLength={8}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => void searchHandle()}
                      disabled={searching || !handleInput.trim()}
                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {searching ? '搜尋中…' : '搜尋'}
                    </button>
                  </div>

                  {/* Search result */}
                  {searchError && <p className="mt-2 text-xs text-red-500">{searchError}</p>}
                  {searchResult && (
                    <div className="mt-2 flex items-center gap-3 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                        {(searchResult.name || searchResult.handle).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{searchResult.name || '未命名'}</p>
                        <p className="text-xs text-slate-500 font-mono">{searchResult.handle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void sendInvite()}
                        disabled={inviting}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {inviting ? '邀請中…' : '邀請'}
                      </button>
                    </div>
                  )}

                  {/* Pending invitees */}
                  {pendingInvitees.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-500 mb-1.5">待確認（{pendingInvitees.length}）</p>
                      <ul className="space-y-1.5">
                        {pendingInvitees.map(p => (
                          <li key={p.userId} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center text-amber-700 text-xs font-semibold flex-shrink-0">
                              {(p.userName || p.userHandle).charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{p.userName || '未命名'}</p>
                              <p className="text-xs text-slate-500 font-mono">{p.userHandle}</p>
                            </div>
                            <span className="text-[10px] text-amber-600 font-medium bg-amber-100 px-1.5 py-0.5 rounded-full">待確認</span>
                            <button
                              type="button"
                              onClick={() => void cancelInvite(p.userId)}
                              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* ── Members list ── */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">目前成員 · {trip.members.length}</h3>
                <ul className="space-y-1.5">
                  {trip.members.map((m) => {
                    const isConfirming = kickingId === m.userId;
                    const canKick = isOwner && m.role !== 'Owner';
                    return (
                      <li
                        key={m.userId}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 border border-slate-200 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                          {(m.name || m.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {m.name || m.email?.split('@')[0] || m.userId.slice(0, 6)}
                          </p>
                          {m.email && (
                            <p className="text-xs text-slate-500 truncate">{m.email}</p>
                          )}
                        </div>

                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs text-slate-500">確定移除？</span>
                            <button
                              type="button"
                              onClick={() => kickMutation.mutate(m.userId)}
                              disabled={kickMutation.isPending}
                              className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors cursor-pointer"
                            >
                              {kickMutation.isPending ? '…' : '移除'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setKickingId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              m.role === 'Owner'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : m.role === 'Editor'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-600'
                            }`}>
                              {m.role === 'Owner' ? '擁有者' : m.role === 'Editor' ? '編輯' : '檢視'}
                            </span>
                            {canKick && (
                              <button
                                type="button"
                                onClick={() => setKickingId(m.userId)}
                                aria-label={`移除 ${m.name || m.email}`}
                                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* ── Leave trip (non-Owner only) ── */}
              {!isOwner && (
                <section className="pt-2 border-t border-slate-100">
                  {confirmLeave ? (
                    <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <p className="text-sm text-red-700 font-medium">確定要退出這個行程嗎？</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => leaveMutation.mutate()}
                          disabled={leaveMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors cursor-pointer"
                        >
                          {leaveMutation.isPending ? '退出中…' : '確定退出'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmLeave(false)}
                          className="px-3 py-1.5 rounded-lg bg-white text-slate-600 text-xs font-medium border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-100 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      退出此行程
                    </button>
                  )}
                </section>
              )}
            </>
          )}

          {/* ══════════════════════════════════════
              Tab 3 — 協作者權限 (Owner only)
          ══════════════════════════════════════ */}
          {activeTab === 'permissions' && isOwner && (
            <>
              {/* Intro */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-violet-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700">協作者權限設定</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                  這些設定控制「協作者」（非主辦人）可以執行哪些操作。主辦人不受這些限制。
                </p>
              </section>

              {/* Permission toggles */}
              <section>
                <ul className="space-y-2">
                  {PERMISSION_ITEMS.map(({ key, label, desc }) => {
                    const on = perms[key];
                    return (
                      <li
                        key={key}
                        className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Shield className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${on ? '停用' : '啟用'}：${label}`}
                          onClick={() => permMutation.mutate({ [key]: !on })}
                          disabled={permMutation.isPending}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 cursor-pointer disabled:opacity-60 ${
                            on ? 'bg-violet-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                              on ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {permMutation.isError && (
                  <p className="mt-3 text-xs text-red-600">儲存失敗，請稍後再試</p>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
    </Portal>
  );
}

export default TripSettingsDrawer;
