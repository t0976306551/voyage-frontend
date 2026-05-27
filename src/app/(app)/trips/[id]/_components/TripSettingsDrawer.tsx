'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useMutation, useQuery, useQueryClient, keepPreviousData,
} from '@tanstack/react-query';
import {
  X, Settings, CheckSquare, DollarSign, ListChecks, Users, Copy, Check, Link2,
  Calendar, Save, UserPlus, UserMinus, LogOut, Shield, Trash2,
} from 'lucide-react';
import { Trip, tripsApi, EnabledModules, CollaboratorPermissions } from '@/lib/api/trips.api';
import {
  userApi, UserSearchResult, PendingInvitee, InvitationHistoryEntry,
} from '@/lib/api/user.api';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useModalTransition } from '@/lib/hooks/useModalTransition';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Portal } from '@/components/ui/Portal';
import { MemberRemovalDialog } from '@/components/ui/MemberRemovalDialog';
import { formatRelativeDays } from '@/lib/utils/relative-time';

interface Props {
  trip: Trip;
  token: string;
  isOwner: boolean;
  currentUserId: string;
  /** Current item counts per module — used to warn before disabling a non-empty module. */
  moduleCounts?: { checklists: number; tasks: number; expenses: number };
  onClose: () => void;
  open?: boolean;
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
    key: 'canEditContent',
    label: '可以編輯內容',
    desc: '編輯既有的景點、費用、待辦、清單項目',
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

export function TripSettingsDrawer({ trip, token, isOwner, currentUserId, moduleCounts, onClose, open = true }: Props) {
  const { mounted, closing } = useModalTransition(open);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<TabKey>('trip');

  /* ── Delete confirmation state ── */
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirming'>('idle');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteToken, setDeleteToken] = useState('');
  const [deleteInput, setDeleteInput] = useState('');
  const [fetchingToken, setFetchingToken] = useState(false);

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
  const [inviting, setInviting] = useState(false);
  /** Snapshot retains the last removal target so the dialog stays visible during exit animation. */
  const [removalSnapshot, setRemovalSnapshot] = useState<{ userId: string; isSelf: boolean } | null>(null);
  const [removalOpen, setRemovalOpen] = useState(false);
  // Convenience alias — treat removalSnapshot as the "active" target for the rest of the component
  const removalTarget = removalSnapshot;
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);

  /* ── Initial perms snapshot for enabling queries (derive once for hooks) ── */
  const initialPerms = trip.collaboratorPermissions;
  const canInviteForQuery = isOwner || initialPerms?.canInvite === true;

  /* ── Pending invitees (Owner or Editor with canInvite) ── */
  const pendingInviteesQuery = useQuery<PendingInvitee[]>({
    queryKey: ['pending-invitees', trip.id],
    queryFn: () => userApi.getPendingInvitees(trip.id, token),
    enabled: canInviteForQuery,
    placeholderData: keepPreviousData,
  });
  const pendingInvitees: PendingInvitee[] = pendingInviteesQuery.data ?? [];

  /* ── Invitation history (Owner or Editor with canInvite — excludes current trip's members/pending) ── */
  const invitationHistoryQuery = useQuery<InvitationHistoryEntry[]>({
    queryKey: ['invitation-history', trip.id],
    queryFn: () => userApi.getInvitationHistory({ excludeTripId: trip.id }, token),
    enabled: canInviteForQuery,
    placeholderData: keepPreviousData,
  });
  const invitationHistory: InvitationHistoryEntry[] = invitationHistoryQuery.data ?? [];

  /* ── Batch invite selection ── */
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [batchInviting, setBatchInviting] = useState(false);
  const selectedCount = selectedHistoryIds.size;

  function toggleHistorySelect(userId: string) {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  // Drop any selections that disappeared from history (e.g. accepted, kicked, etc.)
  const visibleHistoryIds = useMemo(
    () => new Set(invitationHistory.map((h) => h.userId)),
    [invitationHistory],
  );
  // Sync: filter selection to currently-visible ids on each render snapshot.
  // We don't useEffect here to avoid extra renders — derive the effective set.
  const effectiveSelectedCount = useMemo(() => {
    let n = 0;
    for (const id of selectedHistoryIds) if (visibleHistoryIds.has(id)) n++;
    return n;
  }, [selectedHistoryIds, visibleHistoryIds]);

  useBodyScrollLock(mounted);

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

  const permMutation = useMutation({
    mutationFn: (patch: Partial<CollaboratorPermissions>) =>
      tripsApi.updateCollaboratorPermissions(trip.id, patch, token),
    onSuccess: (updated) => {
      qc.setQueryData(['trip', trip.id], updated);
      qc.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: () => toast.show({ message: '儲存失敗，請稍後再試', variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tripsApi.deleteTrip(trip.id, deleteCode, deleteToken, token),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['trip', trip.id] });
      qc.invalidateQueries({ queryKey: ['trips'] });
      onClose();
      router.push('/trips');
      toast.show({ message: '行程已刪除', variant: 'success' });
    },
    onError: (e: Error) => {
      if (e.message === 'INVALID_DELETE_TOKEN') {
        toast.show({ message: '驗證碼已過期，請重新取得', variant: 'error' });
        setDeletePhase('idle');
        setDeleteCode('');
        setDeleteToken('');
        setDeleteInput('');
      } else {
        toast.show({ message: '刪除失敗，請稍後再試', variant: 'error' });
      }
    },
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
      setSearchResult(null);
      setHandleInput('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['pending-invitees', trip.id] }),
        qc.invalidateQueries({ queryKey: ['invitation-history'] }),
      ]);
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

  async function cancelInvite(userId: string, name?: string) {
    const ok = await confirm({
      title: '取消邀請？',
      message: name ? `將取消對 ${name} 的邀請。對方若尚未接受將收不到通知。` : '將取消這個邀請。',
      confirmLabel: '取消邀請',
      cancelLabel: '保留',
      danger: true,
    });
    if (!ok) return;
    try {
      await userApi.cancelInvitation(trip.id, userId, token);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['pending-invitees', trip.id] }),
        qc.invalidateQueries({ queryKey: ['invitation-history'] }),
      ]);
      toast.show({ message: '已取消邀請', variant: 'info' });
    } catch {
      toast.show({ message: '取消失敗，請稍後再試', variant: 'error' });
    }
  }

  async function batchInviteSelected() {
    const ids = Array.from(selectedHistoryIds).filter((id) => visibleHistoryIds.has(id));
    if (ids.length === 0) return;
    setBatchInviting(true);
    try {
      const res = await userApi.batchInviteByUserIds(trip.id, ids, token);
      setSelectedHistoryIds(new Set());
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['invitation-history'] }),
        qc.invalidateQueries({ queryKey: ['pending-invitees', trip.id] }),
      ]);
      const invited = res.invited.length;
      const skipped = res.skipped.length;
      if (invited === 0) {
        toast.show({ message: '沒有成功邀請任何人', variant: 'error' });
      } else {
        toast.show({ message: `已邀請 ${invited} 人`, variant: 'success' });
      }
      if (skipped > 0) {
        toast.show({ message: `${skipped} 人已是成員或已邀請，已略過`, variant: 'info' });
      }
    } catch {
      toast.show({ message: '批次邀請失敗，請稍後再試', variant: 'error' });
    } finally {
      setBatchInviting(false);
    }
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

  async function startDeleteFlow() {
    setFetchingToken(true);
    try {
      const result = await tripsApi.getDeleteToken(trip.id, token);
      setDeleteCode(result.code);
      setDeleteToken(result.token);
      setDeleteInput('');
      setDeletePhase('confirming');
    } catch {
      toast.show({ message: '無法取得驗證碼，請稍後再試', variant: 'error' });
    } finally {
      setFetchingToken(false);
    }
  }

  function cancelDelete() {
    setDeletePhase('idle');
    setDeleteCode('');
    setDeleteToken('');
    setDeleteInput('');
  }

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/trips/join?code=${trip.inviteCode}`
    : `/trips/join?code=${trip.inviteCode}`;

  /* ── Collaborator permissions (with fallback defaults) ── */
  const perms: CollaboratorPermissions = trip.collaboratorPermissions ?? {
    canEditTripInfo: false,
    canInvite: false,
    canEditContent: true,
    canDeleteContent: false,
    canManageModules: false,
  };

  /* ── Permission-derived visibility flags ── */
  const canEditTripInfo = isOwner || perms.canEditTripInfo;
  const canInvite = isOwner || perms.canInvite;
  // The invite code/link block was historically visible to Editors even when
  // canInvite is undefined (legacy trips). Keep that behavior for the public
  // share-link UI; only gate the active-invite UIs (handle search, history
  // picker) on the explicit canInvite permission.
  const showInviteSection = isOwner || perms.canInvite !== false;

  /* ── Tab definitions ── */
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'trip', label: '行程' },
    { key: 'members', label: '成員' },
    ...(isOwner ? [{ key: 'permissions' as TabKey, label: '協作者權限' }] : []),
  ];

  if (!mounted) return null;

  return (
    <Portal>
    <div data-vs-closing={closing ? '' : undefined} className="fixed inset-0 z-[60] vs-modal-overlay">
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
          key={activeTab}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-6 vs-tab-panel"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          {/* ══════════════════════════════════════
              Tab 1 — 行程
          ══════════════════════════════════════ */}
          {activeTab === 'trip' && (
            <>
              {/* ── Trip info (Owner, or Editor with canEditTripInfo) ── */}
              {canEditTripInfo && (
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

              {/* ── 危險區域：刪除行程（Owner 限定）── */}
              {isOwner && (
                <section className="pt-2 border-t border-red-100">
                  <h3 className="text-sm font-semibold text-red-600 mb-1 inline-flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" />
                    危險區域
                  </h3>

                  {deletePhase === 'idle' ? (
                    <>
                      <p className="text-xs text-slate-500 mb-3">
                        刪除後無法復原。所有行程資料（景點、費用、待辦、清單）將永久消失。
                      </p>
                      <button
                        type="button"
                        onClick={() => void startDeleteFlow()}
                        disabled={fetchingToken}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        {fetchingToken ? '取得驗證碼中…' : '刪除此行程'}
                      </button>
                    </>
                  ) : (
                    <div className="space-y-3 mt-2">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        此操作無法復原。行程的所有景點、費用、待辦、清單、個人備忘都將永久刪除，所有成員也會同時被移出。
                      </p>

                      {/* Verification code display */}
                      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-center">
                        <p className="text-[11px] text-red-500 mb-1.5 font-medium">請在下方輸入此驗證碼以確認刪除</p>
                        <span
                          aria-label="刪除驗證碼"
                          className="font-mono text-xl font-bold text-red-700 tracking-[0.2em] select-all"
                        >
                          {deleteCode}
                        </span>
                      </div>

                      {/* Input */}
                      <input
                        type="text"
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder="輸入上方驗證碼"
                        aria-label="輸入驗證碼"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-colors"
                        autoComplete="off"
                        spellCheck={false}
                      />

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelDelete}
                          disabled={deleteMutation.isPending}
                          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate()}
                          disabled={deleteInput !== deleteCode || deleteMutation.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deleteMutation.isPending ? '刪除中…' : '確認刪除'}
                        </button>
                      </div>
                    </div>
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

              {/* ── Invitation history trigger (Owner or Editor with canInvite) — opens modal ── */}
              {canInvite && (
                <button
                  type="button"
                  onClick={() => setShowHistoryPicker(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all cursor-pointer text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">邀請歷史協辦者</p>
                    <p className="text-xs text-slate-500">
                      {invitationHistory.length > 0
                        ? `從 ${invitationHistory.length} 位曾邀請過的人快速選擇`
                        : '快速從之前邀請過的人中挑選'}
                    </p>
                  </div>
                  {invitationHistory.length > 0 && (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      {invitationHistory.length}
                    </span>
                  )}
                </button>
              )}

              {/* ── Handle invite (Owner or Editor with canInvite) ── */}
              {canInvite && (
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

                </section>
              )}

              {/* ── Members list — 已加入 ── */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">已加入 · {trip.members.length}</h3>
                <ul className="space-y-1.5">
                  {trip.members.map((m) => {
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
                              onClick={() => { setRemovalSnapshot({ userId: m.userId, isSelf: false }); setRemovalOpen(true); }}
                              aria-label={`移除 ${m.name || m.email}`}
                              className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* ── 尚未加入 (Owner or Editor with canInvite — derived from pending invitations) ── */}
              {canInvite && pendingInvitees.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">尚未加入 · {pendingInvitees.length}</h3>
                  <ul className="space-y-1.5">
                    {pendingInvitees.map(p => (
                      <li
                        key={p.userId}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center text-amber-700 text-xs font-semibold flex-shrink-0">
                          {(p.userName || p.userHandle).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{p.userName || '未命名'}</p>
                          <p className="text-xs text-slate-500 font-mono truncate">
                            {p.userHandle}
                            <span className="ml-2 text-slate-400 font-sans">· 邀請於 {formatRelativeDays(p.invitedAt)}</span>
                          </p>
                        </div>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => void cancelInvite(p.userId, p.userName)}
                            className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline transition-colors cursor-pointer flex-shrink-0"
                          >
                            取消邀請
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ── Leave trip (non-Owner only) ── */}
              {!isOwner && (
                <section className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setRemovalSnapshot({ userId: currentUserId, isSelf: true }); setRemovalOpen(true); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-100 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    退出此行程
                  </button>
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

      {/* History picker modal — opens above the drawer */}
      {showHistoryPicker && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm vs-backdrop-in"
            onClick={() => setShowHistoryPicker(false)}
            aria-hidden
          />
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 flex flex-col vs-modal-dialog"
            style={{ maxHeight: '85dvh' }}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">邀請歷史協辦者</h2>
                  <p className="text-[11px] text-slate-500">勾選想邀請的人，一鍵批次發送</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryPicker(false)}
                aria-label="關閉"
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {invitationHistoryQuery.isLoading ? (
                <ul className="space-y-1.5">
                  {[0, 1, 2, 3].map(i => (
                    <li key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </ul>
              ) : invitationHistory.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">還沒邀請過任何人</p>
                  <p className="text-xs text-slate-400 mt-1">用下方「以 Handle 邀請」開始建立你的協作者名單</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {invitationHistory.map(entry => {
                    const selected = selectedHistoryIds.has(entry.userId);
                    return (
                      <li
                        key={entry.userId}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                        onClick={() => toggleHistorySelect(entry.userId)}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleHistorySelect(entry.userId)}
                          onClick={e => e.stopPropagation()}
                          aria-label={`選取 ${entry.name || entry.handle}`}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer flex-shrink-0"
                        />
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0 overflow-hidden">
                          {entry.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (entry.name || entry.handle).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{entry.name || '未命名'}</p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">{entry.handle}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {formatRelativeDays(entry.lastInvitedAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Sticky footer */}
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0 bg-slate-50/40">
              <span className="text-xs text-slate-600">已選 {effectiveSelectedCount} 人</span>
              <button
                type="button"
                onClick={async () => {
                  await batchInviteSelected();
                  // Close modal after successful batch invite (if any invited or all skipped)
                  setShowHistoryPicker(false);
                }}
                disabled={effectiveSelectedCount === 0 || batchInviting}
                className={`px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold transition-colors cursor-pointer ${
                  effectiveSelectedCount === 0 || batchInviting
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-indigo-700'
                }`}
              >
                {batchInviting ? '邀請中…' : `邀請選取的 ${effectiveSelectedCount} 人`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Member removal dialog (self-leave or Owner kick) ── */}
      {removalSnapshot && (
        <MemberRemovalDialog
          open={removalOpen}
          tripId={trip.id}
          trip={trip}
          token={token}
          targetUserId={removalSnapshot.userId}
          isSelf={removalSnapshot.isSelf}
          onClose={() => setRemovalOpen(false)}
          onSuccess={() => {
            const wasSelf = removalSnapshot.isSelf;
            const removedName =
              trip.members.find((m) => m.userId === removalSnapshot.userId)?.name
              || trip.members.find((m) => m.userId === removalSnapshot.userId)?.email?.split('@')[0]
              || '成員';
            setRemovalOpen(false);
            if (wasSelf) {
              onClose();
              router.push('/trips');
              toast.show({ message: '已退出行程', variant: 'info' });
            } else {
              toast.show({ message: `已移除 ${removedName}`, variant: 'success' });
            }
          }}
        />
      )}
    </div>
    </Portal>
  );
}
