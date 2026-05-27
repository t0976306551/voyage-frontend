const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchWithAuth<T>(
  path: string,
  options: RequestInit = {},
  token: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  const json = await res.json() as { data: T; error: { message: string } | null };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? 'API error');
  }
  return json.data;
}

interface ChecklistAssignee {
  userId: string;
  completedAt: string | null;
}

export interface ChecklistItem {
  id: string;
  tripId: string;
  title: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  assignees: ChecklistAssignee[];
  progress: { done: number; total: number };
}

export interface CreateChecklistDto {
  title: string;
  notes?: string | null;
  assigneeIds?: string[];
}

export interface UpdateChecklistDto {
  title?: string;
  notes?: string | null;
  assigneeIds?: string[];
}

export const checklistsApi = {
  list: (tripId: string, token: string) =>
    fetchWithAuth<ChecklistItem[]>(`/api/trips/${tripId}/checklists`, {}, token),

  create: (tripId: string, dto: CreateChecklistDto, token: string) =>
    fetchWithAuth<ChecklistItem>(`/api/trips/${tripId}/checklists`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }, token),

  update: (tripId: string, itemId: string, dto: UpdateChecklistDto, token: string) =>
    fetchWithAuth<ChecklistItem>(`/api/trips/${tripId}/checklists/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }, token),

  remove: (tripId: string, itemId: string, token: string) =>
    fetchWithAuth<{ id: string }>(`/api/trips/${tripId}/checklists/${itemId}`, {
      method: 'DELETE',
    }, token),

  toggle: (tripId: string, itemId: string, completed: boolean, token: string) =>
    fetchWithAuth<{ itemId: string; userId: string; completedAt: string | null }>(
      `/api/trips/${tripId}/checklists/${itemId}/toggle`,
      { method: 'POST', body: JSON.stringify({ completed }) },
      token,
    ),
};
