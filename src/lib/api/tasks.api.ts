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

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskCategory = 'general' | 'esim' | 'visa' | 'accommodation' | 'transport';

export interface Task {
  id: string;
  tripId: string;
  assignedUserId: string | null;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  category?: TaskCategory;
  status?: TaskStatus;
  assignedUserId?: string;
  dueDate?: string;
  notes?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  category?: TaskCategory;
  status?: TaskStatus;
  assignedUserId?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export const tasksApi = {
  getByTrip: (tripId: string, token: string): Promise<Task[]> =>
    fetchWithAuth<Task[]>(`/api/trips/${tripId}/tasks`, token),

  create: (tripId: string, payload: CreateTaskPayload, token: string): Promise<Task> =>
    fetchWithAuth<Task>(`/api/trips/${tripId}/tasks`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (
    tripId: string,
    taskId: string,
    payload: UpdateTaskPayload,
    token: string,
  ): Promise<Task> =>
    fetchWithAuth<Task>(`/api/trips/${tripId}/tasks/${taskId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  delete: (tripId: string, taskId: string, token: string): Promise<void> =>
    fetchWithAuth<void>(`/api/trips/${tripId}/tasks/${taskId}`, token, {
      method: 'DELETE',
    }),
};
