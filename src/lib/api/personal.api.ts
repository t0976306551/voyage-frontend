const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchWithAuth<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  const json = (await res.json()) as { data: T; error: { message: string } | null };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? 'API error');
  return json.data;
}

export type PersonalExpenseCategory = 'food' | 'transport' | 'lodging' | 'shopping' | 'activity' | 'other';

export interface PersonalSettings {
  memosShared: boolean;
  expensesShared: boolean;
}

export interface PersonalMemo {
  id: string;
  tripId: string;
  userId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalMemoItem {
  id: string;
  memoId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalExpense {
  id: string;
  tripId: string;
  userId: string;
  amount: string;
  currency: string;
  description: string | null;
  category: PersonalExpenseCategory;
  spentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalMemosResponse {
  mine: PersonalMemo[];
  shared: PersonalMemo[];
}

export interface PersonalExpensesResponse {
  mine: PersonalExpense[];
  shared: PersonalExpense[];
}

export const personalApi = {
  // ── Settings ───────────────────────────────────────────────────────────

  getSettings: (tripId: string, token: string): Promise<PersonalSettings> =>
    fetchWithAuth<PersonalSettings>(`/api/trips/${tripId}/personal/settings`, token),

  updateSettings: (
    tripId: string,
    patch: { memosShared?: boolean; expensesShared?: boolean },
    token: string,
  ): Promise<PersonalSettings> =>
    fetchWithAuth<PersonalSettings>(`/api/trips/${tripId}/personal/settings`, token, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // ── Memos ──────────────────────────────────────────────────────────────

  getMemos: (tripId: string, token: string): Promise<PersonalMemosResponse> =>
    fetchWithAuth<PersonalMemosResponse>(`/api/trips/${tripId}/personal/memos`, token),

  createMemo: (
    tripId: string,
    payload: { title: string; sortOrder?: number },
    token: string,
  ): Promise<PersonalMemo> =>
    fetchWithAuth<PersonalMemo>(`/api/trips/${tripId}/personal/memos`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMemo: (
    tripId: string,
    memoId: string,
    payload: { title?: string; sortOrder?: number },
    token: string,
  ): Promise<PersonalMemo> =>
    fetchWithAuth<PersonalMemo>(`/api/trips/${tripId}/personal/memos/${memoId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteMemo: (tripId: string, memoId: string, token: string): Promise<void> =>
    fetchWithAuth<void>(`/api/trips/${tripId}/personal/memos/${memoId}`, token, {
      method: 'DELETE',
    }),

  // ── Memo Items ─────────────────────────────────────────────────────────

  getItems: (tripId: string, memoId: string, token: string): Promise<PersonalMemoItem[]> =>
    fetchWithAuth<PersonalMemoItem[]>(`/api/trips/${tripId}/personal/memos/${memoId}/items`, token),

  createItem: (
    tripId: string,
    memoId: string,
    payload: { title: string; sortOrder?: number },
    token: string,
  ): Promise<PersonalMemoItem> =>
    fetchWithAuth<PersonalMemoItem>(`/api/trips/${tripId}/personal/memos/${memoId}/items`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateItem: (
    tripId: string,
    memoId: string,
    itemId: string,
    payload: { title?: string; completed?: boolean; sortOrder?: number },
    token: string,
  ): Promise<PersonalMemoItem> =>
    fetchWithAuth<PersonalMemoItem>(
      `/api/trips/${tripId}/personal/memos/${memoId}/items/${itemId}`,
      token,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),

  deleteItem: (tripId: string, memoId: string, itemId: string, token: string): Promise<void> =>
    fetchWithAuth<void>(
      `/api/trips/${tripId}/personal/memos/${memoId}/items/${itemId}`,
      token,
      { method: 'DELETE' },
    ),

  reorderItems: (
    tripId: string,
    memoId: string,
    items: { id: string; sortOrder: number }[],
    token: string,
  ): Promise<void> =>
    fetchWithAuth<void>(
      `/api/trips/${tripId}/personal/memos/${memoId}/items/reorder`,
      token,
      { method: 'PATCH', body: JSON.stringify({ items }) },
    ),

  // ── Expenses ───────────────────────────────────────────────────────────

  getExpenses: (tripId: string, token: string): Promise<PersonalExpensesResponse> =>
    fetchWithAuth<PersonalExpensesResponse>(`/api/trips/${tripId}/personal/expenses`, token),

  createExpense: (
    tripId: string,
    payload: {
      amount: number;
      currency?: string;
      description?: string | null;
      category?: PersonalExpenseCategory;
      spentAt?: string | null;
    },
    token: string,
  ): Promise<PersonalExpense> =>
    fetchWithAuth<PersonalExpense>(`/api/trips/${tripId}/personal/expenses`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateExpense: (
    tripId: string,
    expenseId: string,
    payload: {
      amount?: number;
      currency?: string;
      description?: string | null;
      category?: PersonalExpenseCategory;
      spentAt?: string | null;
    },
    token: string,
  ): Promise<PersonalExpense> =>
    fetchWithAuth<PersonalExpense>(`/api/trips/${tripId}/personal/expenses/${expenseId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteExpense: (tripId: string, expenseId: string, token: string): Promise<void> =>
    fetchWithAuth<void>(`/api/trips/${tripId}/personal/expenses/${expenseId}`, token, {
      method: 'DELETE',
    }),
};
