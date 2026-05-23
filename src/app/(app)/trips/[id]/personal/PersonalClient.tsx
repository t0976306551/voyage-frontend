'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, NotebookPen, Wallet, Plus, Trash2, Check,
  Lock, Globe, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import {
  personalApi,
  PersonalMemo,
  PersonalMemoItem,
  PersonalExpense,
  PersonalExpenseCategory,
} from '@/lib/api/personal.api';
import { TripMember } from '@/lib/api/trips.api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useModalTransition } from '@/lib/hooks/useModalTransition';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<PersonalExpenseCategory, string> = {
  food: '餐飲',
  transport: '交通',
  lodging: '住宿',
  shopping: '購物',
  activity: '活動',
  other: '其他',
};

const CATEGORY_COLORS: Record<PersonalExpenseCategory, string> = {
  food: 'bg-orange-100 text-orange-700',
  transport: 'bg-blue-100 text-blue-700',
  lodging: 'bg-violet-100 text-violet-700',
  shopping: 'bg-pink-100 text-pink-700',
  activity: 'bg-green-100 text-green-700',
  other: 'bg-slate-100 text-slate-600',
};

interface Props {
  tripId: string;
  token: string;
  currentUserId: string;
  currentUserName: string;
  members: TripMember[];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(userId: string): string {
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function MemberAvatar({ member, size = 'md' }: { member: TripMember; size?: 'sm' | 'md' }) {
  const initial = (member.name ?? member.email ?? '?')[0].toUpperCase();
  const sz = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return (
    <span className={`${sz} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${avatarColor(member.userId)}`}>
      {initial}
    </span>
  );
}

// ─── Member Shared Memo Section ───────────────────────────────────────────────

function MemberSharedMemoSection({
  member, memos, tripId, token,
}: {
  member: TripMember;
  memos: PersonalMemo[];
  tripId: string;
  token: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayName = member.name ?? member.email ?? member.userId;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <MemberAvatar member={member} />
        <span className="flex-1 font-medium text-slate-800 truncate">{displayName}</span>
        <span className="text-xs text-slate-400 flex-shrink-0">{memos.length} 個備忘錄</span>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-100">
          {memos.map((memo) => (
            <MemoCard key={memo.id} memo={memo} tripId={tripId} token={token} isOwner={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Member Shared Expense Section ───────────────────────────────────────────

function MemberSharedExpenseSection({
  member, expenses,
}: {
  member: TripMember;
  expenses: PersonalExpense[];
}) {
  const [expanded, setExpanded] = useState(false);
  const displayName = member.name ?? member.email ?? member.userId;
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const currency = expenses[0]?.currency ?? 'TWD';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <MemberAvatar member={member} />
        <span className="flex-1 font-medium text-slate-800 truncate">{displayName}</span>
        <span className="text-xs text-slate-400 flex-shrink-0">
          {currency} {total.toLocaleString()}
        </span>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-100">
          {expenses.map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} isOwner={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sharing Toggle ────────────────────────────────────────────────────────────

function SharingToggle({
  label,
  shared,
  onToggle,
  isPending,
}: {
  label: string;
  shared: boolean;
  onToggle: () => void;
  isPending: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={isPending}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all cursor-pointer disabled:opacity-60 ${
        shared
          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
      }`}
    >
      {shared ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
      {label}
      {shared ? '：公開' : '：私人'}
    </button>
  );
}

// ─── Memo Card ────────────────────────────────────────────────────────────────

function MemoCard({
  memo,
  tripId,
  token,
  isOwner,
}: {
  memo: PersonalMemo;
  tripId: string;
  token: string;
  isOwner: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const qc = useQueryClient();
  const { show: showToast } = useToast();
  const confirm = useConfirm();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['personal-memo-items', memo.id],
    queryFn: () => personalApi.getItems(tripId, memo.id, token),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      personalApi.updateItem(tripId, memo.id, itemId, { completed }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-memo-items', memo.id] }),
  });

  const addItemMutation = useMutation({
    mutationFn: (title: string) =>
      personalApi.createItem(tripId, memo.id, { title }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-memo-items', memo.id] });
      setNewItemTitle('');
      setAddingItem(false);
    },
    onError: () => showToast({ message: '新增項目失敗', variant: 'error' }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      personalApi.deleteItem(tripId, memo.id, itemId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-memo-items', memo.id] }),
    onError: () => showToast({ message: '刪除項目失敗', variant: 'error' }),
  });

  const deleteMemoMutation = useMutation({
    mutationFn: () => personalApi.deleteMemo(tripId, memo.id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-memos', tripId] }),
    onError: () => showToast({ message: '刪除備忘錄失敗', variant: 'error' }),
  });

  const doneCount = items.filter((i) => i.completed).length;

  const handleDeleteMemo = async () => {
    const ok = await confirm({
      title: '刪除備忘錄',
      message: `確定要刪除「${memo.title}」及其所有項目嗎？此操作無法復原。`,
      confirmLabel: '刪除',
      danger: true,
    });
    if (ok) deleteMemoMutation.mutate();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-2 text-left cursor-pointer"
        >
          {expanded
            ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          <span className="font-semibold text-slate-800 truncate">{memo.title}</span>
          {items.length > 0 && (
            <span className="text-xs text-slate-400 flex-shrink-0">{doneCount}/{items.length}</span>
          )}
        </button>
        {isOwner && (
          <button
            onClick={handleDeleteMemo}
            disabled={deleteMemoMutation.isPending}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-slate-100 pt-2">
          {isLoading && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group">
              <button
                onClick={() => isOwner && toggleMutation.mutate({ itemId: item.id, completed: !item.completed })}
                disabled={!isOwner || toggleMutation.isPending}
                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                  item.completed
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'border-slate-300 hover:border-indigo-400'
                } ${isOwner ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {item.completed && <Check className="w-3 h-3" />}
              </button>
              <span className={`flex-1 text-sm ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {item.title}
              </span>
              {isOwner && (
                <button
                  onClick={() => deleteItemMutation.mutate(item.id)}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {isOwner && (
            addingItem ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  autoFocus
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newItemTitle.trim()) addItemMutation.mutate(newItemTitle.trim());
                    if (e.key === 'Escape') { setAddingItem(false); setNewItemTitle(''); }
                  }}
                  placeholder="輸入項目名稱"
                  className="flex-1 min-w-0 text-sm border border-indigo-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  onClick={() => {
                    if (newItemTitle.trim()) addItemMutation.mutate(newItemTitle.trim());
                  }}
                  disabled={!newItemTitle.trim() || addItemMutation.isPending}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                >
                  {addItemMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : '新增'}
                </button>
                <button
                  onClick={() => { setAddingItem(false); setNewItemTitle(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer flex-shrink-0"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 mt-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />新增項目
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Expense Card ─────────────────────────────────────────────────────────────

function ExpenseCard({
  expense,
  isOwner,
  onDelete,
}: {
  expense: PersonalExpense;
  isOwner: boolean;
  onDelete?: () => void;
}) {
  const amt = parseFloat(expense.amount);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
      <div className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[expense.category]}`}>
        {CATEGORY_LABELS[expense.category]}
      </div>
      <div className="flex-1 min-w-0">
        {expense.description && (
          <p className="text-sm font-medium text-slate-800 truncate">{expense.description}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-base font-bold text-slate-900">
            {expense.currency} {amt.toLocaleString()}
          </span>
          {expense.spentAt && (
            <span className="text-xs text-slate-400">{expense.spentAt}</span>
          )}
        </div>
      </div>
      {isOwner && onDelete && (
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Add Memo Modal ───────────────────────────────────────────────────────────

function AddMemoModal({ tripId, token, onClose, open = true }: { tripId: string; token: string; onClose: () => void; open?: boolean }) {
  const { mounted, closing } = useModalTransition(open);
  const [title, setTitle] = useState('');
  const qc = useQueryClient();
  const { show: showToast } = useToast();

  const mutation = useMutation({
    mutationFn: () => personalApi.createMemo(tripId, { title: title.trim() }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['personal-memos', tripId] }); onClose(); },
    onError: () => showToast({ message: '新增備忘錄失敗', variant: 'error' }),
  });

  if (!mounted) return null;

  return (
    <div data-vs-closing={closing ? '' : undefined}>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl mb-[var(--bottom-nav-h,3.5rem)] sm:mb-0 vs-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">新增備忘錄</h2>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">標題</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && title.trim() && mutation.mutate()}
          placeholder="例：購買清單、旅遊筆記"
          maxLength={100}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
        />
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 cursor-pointer">取消</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '新增'}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────

function AddExpenseModal({ tripId, token, onClose, open = true }: { tripId: string; token: string; onClose: () => void; open?: boolean }) {
  const { mounted, closing } = useModalTransition(open);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PersonalExpenseCategory>('other');
  const [spentAt, setSpentAt] = useState('');
  const qc = useQueryClient();
  const { show: showToast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      personalApi.createExpense(tripId, {
        amount: parseFloat(amount),
        description: description.trim() || null,
        category,
        spentAt: spentAt || null,
      }, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['personal-expenses', tripId] }); onClose(); },
    onError: () => showToast({ message: '新增花費失敗', variant: 'error' }),
  });

  const canSubmit = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && !mutation.isPending;

  if (!mounted) return null;

  return (
    <div data-vs-closing={closing ? '' : undefined}>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm vs-backdrop-in" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl max-h-[90dvh] overflow-y-auto mb-[var(--bottom-nav-h,3.5rem)] sm:mb-0 vs-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">記錄個人花費</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">金額 (TWD)</label>
            <input
              autoFocus type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0" min={0}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">說明（選填）</label>
            <input
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="例：午餐、紀念品" maxLength={200}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">類別</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_LABELS) as PersonalExpenseCategory[]).map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    category === cat ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">消費日期（選填）</label>
            <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 cursor-pointer">取消</button>
          <button onClick={() => mutation.mutate()} disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '記錄'}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'memos' | 'expenses';

export default function PersonalClient({ tripId, token, currentUserId, members }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('memos');
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const qc = useQueryClient();
  const { show: showToast } = useToast();
  const confirm = useConfirm();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['personal-settings', tripId],
    queryFn: () => personalApi.getSettings(tripId, token),
  });

  const { data: memosData, isLoading: memosLoading } = useQuery({
    queryKey: ['personal-memos', tripId],
    queryFn: () => personalApi.getMemos(tripId, token),
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['personal-expenses', tripId],
    queryFn: () => personalApi.getExpenses(tripId, token),
  });

  const settingsMutation = useMutation({
    mutationFn: (patch: { memosShared?: boolean; expensesShared?: boolean }) =>
      personalApi.updateSettings(tripId, patch, token),
    onSuccess: (data) => {
      qc.setQueryData(['personal-settings', tripId], data);
      // Refresh shared lists
      qc.invalidateQueries({ queryKey: ['personal-memos', tripId] });
      qc.invalidateQueries({ queryKey: ['personal-expenses', tripId] });
    },
    onError: () => showToast({ message: '更新設定失敗', variant: 'error' }),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => personalApi.deleteExpense(tripId, expenseId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-expenses', tripId] }),
    onError: () => showToast({ message: '刪除失敗', variant: 'error' }),
  });

  const handleToggleMemosShared = async () => {
    const next = !(settings?.memosShared ?? false);
    if (next) {
      const ok = await confirm({
        title: '公開所有備忘錄',
        message: '開啟後，同行程所有成員都能看到你的備忘錄（唯讀）。確定嗎？',
        confirmLabel: '公開',
      });
      if (!ok) return;
    }
    settingsMutation.mutate({ memosShared: next });
  };

  const handleToggleExpensesShared = async () => {
    const next = !(settings?.expensesShared ?? false);
    if (next) {
      const ok = await confirm({
        title: '公開所有個人花費',
        message: '開啟後，同行程所有成員都能看到你的個人花費（唯讀）。確定嗎？',
        confirmLabel: '公開',
      });
      if (!ok) return;
    }
    settingsMutation.mutate({ expensesShared: next });
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const ok = await confirm({ title: '刪除花費', message: '確定要刪除這筆花費嗎？', confirmLabel: '刪除', danger: true });
    if (ok) deleteExpenseMutation.mutate(expenseId);
  };

  const myMemos = memosData?.mine ?? [];
  const sharedMemos = memosData?.shared ?? [];
  const myExpenses = expensesData?.mine ?? [];
  const sharedExpenses = expensesData?.shared ?? [];
  const myTotalExpense = myExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const memberMap = Object.fromEntries(members.map((m) => [m.userId, m]));

  const sharedMemosByUser = sharedMemos.reduce<Record<string, PersonalMemo[]>>((acc, memo) => {
    (acc[memo.userId] ??= []).push(memo);
    return acc;
  }, {});

  const sharedExpensesByUser = sharedExpenses.reduce<Record<string, PersonalExpense[]>>((acc, exp) => {
    (acc[exp.userId] ??= []).push(exp);
    return acc;
  }, {});

  return (
    <main className="min-h-dvh bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 sticky top-0 z-20"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="max-w-3xl mx-auto flex items-center gap-2 min-h-[44px]">
          <button onClick={() => router.back()} aria-label="返回行程"
            className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 transition-all flex-shrink-0 cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-900">個人空間</h1>
            <p className="text-xs text-slate-400">只有你看得到（或選擇分享給所有人）</p>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-white border-b border-slate-100 sticky top-[60px] z-10">
        <div className="max-w-3xl mx-auto px-4 flex gap-1 pt-2 pb-0">
          {([
            { key: 'memos' as Tab, label: '備忘錄', icon: NotebookPen },
            { key: 'expenses' as Tab, label: '個人花費', icon: Wallet },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg cursor-pointer ${
                tab === key ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <Icon className="w-4 h-4" />
              {label}
              {tab === key && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div key={tab} className="max-w-3xl mx-auto px-4 py-5 space-y-6 pb-28 vs-tab-panel">

        {tab === 'memos' && (
          <>
            {/* Sharing toggle */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">我的備忘錄</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddMemo(true)}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-800 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />新增
                </button>
                {!settingsLoading && (
                  <SharingToggle
                    label="備忘錄"
                    shared={settings?.memosShared ?? false}
                    onToggle={handleToggleMemosShared}
                    isPending={settingsMutation.isPending}
                  />
                )}
              </div>
            </div>

            {(settings?.memosShared) && (
              <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg -mt-3">
                ✓ 你的備忘錄目前對同行程所有成員公開（唯讀）
              </p>
            )}

            {memosLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
            {!memosLoading && myMemos.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <NotebookPen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">還沒有備忘錄，點右上角新增</p>
              </div>
            )}
            <div className="space-y-3">
              {myMemos.map((memo) => (
                <MemoCard key={memo.id} memo={memo} tripId={tripId} token={token} isOwner={true} />
              ))}
            </div>

            {Object.keys(sharedMemosByUser).length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">其他成員的備忘錄</h2>
                <div className="space-y-2">
                  {Object.entries(sharedMemosByUser).map(([userId, memos]) => (
                    <MemberSharedMemoSection
                      key={userId}
                      member={memberMap[userId] ?? { userId, role: 'collaborator' }}
                      memos={memos}
                      tripId={tripId}
                      token={token}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {tab === 'expenses' && (
          <>
            {/* Sharing toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">我的花費</h2>
                {myExpenses.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">總計 TWD {myTotalExpense.toLocaleString()}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-800 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />記錄
                </button>
                {!settingsLoading && (
                  <SharingToggle
                    label="花費"
                    shared={settings?.expensesShared ?? false}
                    onToggle={handleToggleExpensesShared}
                    isPending={settingsMutation.isPending}
                  />
                )}
              </div>
            </div>

            {settings?.expensesShared && (
              <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg -mt-3">
                ✓ 你的個人花費目前對同行程所有成員公開（唯讀）
              </p>
            )}

            {expensesLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
            {!expensesLoading && myExpenses.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">還沒有花費紀錄</p>
              </div>
            )}
            <div className="space-y-2">
              {myExpenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  isOwner={true}
                  onDelete={() => handleDeleteExpense(expense.id)}
                />
              ))}
            </div>

            {Object.keys(sharedExpensesByUser).length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">其他成員的花費</h2>
                <div className="space-y-2">
                  {Object.entries(sharedExpensesByUser).map(([userId, expenses]) => (
                    <MemberSharedExpenseSection
                      key={userId}
                      member={memberMap[userId] ?? { userId, role: 'collaborator' }}
                      expenses={expenses}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <AddMemoModal open={showAddMemo} tripId={tripId} token={token} onClose={() => setShowAddMemo(false)} />
      <AddExpenseModal open={showAddExpense} tripId={tripId} token={token} onClose={() => setShowAddExpense(false)} />
    </main>
  );
}
