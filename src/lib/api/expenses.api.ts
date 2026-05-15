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

export interface Expense {
  id: string;
  tripId: string;
  payerId: string;
  amount: number;
  currency: string;
  description: string | null;
  splitInfo: Record<string, number>;
  createdAt: string;
}

export interface CreateExpensePayload {
  payerId: string;
  amount: number;
  currency?: string;
  description?: string;
  splitInfo: Record<string, number>;
}

export interface UpdateExpensePayload {
  payerId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  splitInfo?: Record<string, number>;
}

export interface SettlementTransfer {
  from: string;
  to: string;
  amount: number;
}

export const expensesApi = {
  getByTrip: (tripId: string, token: string): Promise<Expense[]> =>
    fetchWithAuth<Expense[]>(`/api/trips/${tripId}/expenses`, token),

  create: (tripId: string, payload: CreateExpensePayload, token: string): Promise<Expense> =>
    fetchWithAuth<Expense>(`/api/trips/${tripId}/expenses`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (
    tripId: string,
    expenseId: string,
    payload: UpdateExpensePayload,
    token: string,
  ): Promise<Expense> =>
    fetchWithAuth<Expense>(`/api/trips/${tripId}/expenses/${expenseId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  delete: (tripId: string, expenseId: string, token: string): Promise<void> =>
    fetchWithAuth<void>(`/api/trips/${tripId}/expenses/${expenseId}`, token, {
      method: 'DELETE',
    }),

  getSettlement: (tripId: string, token: string): Promise<SettlementTransfer[]> =>
    fetchWithAuth<SettlementTransfer[]>(`/api/trips/${tripId}/expenses/settlement`, token),
};
