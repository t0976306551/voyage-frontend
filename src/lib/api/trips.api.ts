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

export interface EnabledModules {
  tasks: boolean;
  expenses: boolean;
  checklists: boolean;
}

export interface CollaboratorPermissions {
  canEditTripInfo: boolean;
  canInvite: boolean;
  canEditContent: boolean;
  canDeleteContent: boolean;
  canManageModules: boolean;
}

export interface TripMember {
  userId: string;
  role: string;
  name?: string;
  email?: string;
  avatar?: string | null;
}

export interface Trip {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  inviteCode: string;
  coverImage?: string;
  members: TripMember[];
  enabledModules: EnabledModules;
  collaboratorPermissions: CollaboratorPermissions;
  createdAt: string;
}

export interface TripPreview {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  ownerName: string;
  memberCount: number;
}

export interface TripsListResponse {
  items: Trip[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TripsListParams {
  page?: number;      // default 1
  pageSize?: number;  // default 10
  from?: string;      // YYYY-MM-DD
  to?: string;        // YYYY-MM-DD
}

export interface LeavePreviewDebt {
  expenseId: string;
  description: string | null;
  amount: number;
  currency: string;
  payerName: string;
}

export interface LeavePreviewAssignedTask {
  id: string;
  title: string;
}

export interface LeavePreviewAssignedChecklist {
  id: string;
  title: string;
}

export interface LeavePreviewCreatedContent {
  itineraryItems: number;
  checklists: number;
  expensesPaidByThem: number;
}

export interface LeavePreview {
  targetUserId: string;
  targetName: string;
  isSelf: boolean;
  canRemove: boolean;
  blockReason?: 'UNSETTLED_DEBTS';
  unsettledDebts: LeavePreviewDebt[];
  assignedTasks: LeavePreviewAssignedTask[];
  assignedChecklists: LeavePreviewAssignedChecklist[];
  createdContent: LeavePreviewCreatedContent;
}

export const tripsApi = {
  getMyTrips: (params: TripsListParams, token: string) => {
    const qs = new URLSearchParams();
    if (params.page != null) qs.set('page', String(params.page));
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize));
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const suffix = qs.toString();
    return fetchWithAuth<TripsListResponse>(
      `/api/trips${suffix ? `?${suffix}` : ''}`,
      {},
      token,
    );
  },

  getTripById: (tripId: string, token: string) =>
    fetchWithAuth<Trip>(`/api/trips/${tripId}`, {}, token),

  createTrip: (
    data: { title: string; startDate?: string; endDate?: string },
    token: string,
  ) =>
    fetchWithAuth<Trip>('/api/trips', { method: 'POST', body: JSON.stringify(data) }, token),

  joinByInviteCode: (inviteCode: string, token: string) =>
    fetchWithAuth<Trip>('/api/trips/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    }, token),

  removeMember: (tripId: string, userId: string, token: string) =>
    fetchWithAuth<Trip>(`/api/trips/${tripId}/members/${userId}`, {
      method: 'DELETE',
    }, token),

  leaveTrip: (tripId: string, token: string) =>
    fetchWithAuth<{ ok: boolean }>(`/api/trips/${tripId}/members/me`, {
      method: 'DELETE',
    }, token),

  /**
   * Fetch the impact preview before leaving/kicking a member.
   * Pass `targetUserId` to preview kicking that user; omit (undefined) for self-leave.
   */
  getLeavePreview: (
    tripId: string,
    targetUserId: string | undefined,
    token: string,
  ) => {
    const qs = targetUserId ? `?userId=${encodeURIComponent(targetUserId)}` : '';
    return fetchWithAuth<LeavePreview>(
      `/api/trips/${tripId}/leave-preview${qs}`,
      {},
      token,
    );
  },

  getTripPreviewByCode: (code: string, token: string) =>
    fetchWithAuth<TripPreview>(`/api/trips/preview?code=${encodeURIComponent(code)}`, {}, token),

  getTripPreviewById: (tripId: string, token: string) =>
    fetchWithAuth<TripPreview>(`/api/trips/${tripId}/preview`, {}, token),

  joinByTripId: (tripId: string, token: string) =>
    fetchWithAuth<Trip>(`/api/trips/${tripId}/join`, { method: 'POST' }, token),

  setEnabledModules: (
    tripId: string,
    patch: Partial<EnabledModules>,
    token: string,
  ) =>
    fetchWithAuth<Trip>(`/api/trips/${tripId}/modules`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }, token),

  updateTrip: (
    tripId: string,
    data: { title?: string; startDate?: string; endDate?: string },
    token: string,
  ) =>
    fetchWithAuth<Trip>(`/api/trips/${tripId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, token),

  updateCollaboratorPermissions: (
    tripId: string,
    patch: Partial<CollaboratorPermissions>,
    token: string,
  ) =>
    fetchWithAuth<Trip>(`/api/trips/${tripId}/collaborator-permissions`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }, token),

  uploadCover: async (tripId: string, file: File, token: string): Promise<Trip> => {
    const fd = new FormData();
    fd.append('cover', file);
    const res = await fetch(`${API_URL}/api/trips/${tripId}/cover`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json() as { data: Trip; error: { message: string } | null };
    if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Upload failed');
    return json.data;
  },

  getDeleteToken: (tripId: string, authToken: string) =>
    fetchWithAuth<{ code: string; token: string }>(`/api/trips/${tripId}/delete-token`, {}, authToken),

  deleteTrip: (tripId: string, deleteCode: string, deleteToken: string, authToken: string) =>
    fetchWithAuth<{ ok: boolean }>(`/api/trips/${tripId}`, {
      method: 'DELETE',
      body: JSON.stringify({ code: deleteCode, token: deleteToken }),
    }, authToken),
};

/** Resolve a coverImage path that may be relative (/uploads/...) into a full URL. */
export function resolveCoverImage(coverImage: string | null | undefined): string | null {
  if (!coverImage) return null;
  if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) {
    return coverImage;
  }
  return `${API_URL}${coverImage}`;
}
