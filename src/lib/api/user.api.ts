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

  const json = await res.json() as T;

  if (!res.ok) {
    const err = json as { error?: string };
    throw new Error(err.error ?? 'API error');
  }

  return json;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  handle: string;
  avatar: string | null;
}

export interface UserSearchResult {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
}

export interface TripInvitation {
  id: string;
  tripId: string;
  tripTitle: string;
  tripCover: string | null;
  inviterName: string;
  createdAt: string;
}

export interface PendingInvitee {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  invitedAt: string;
}

export const userApi = {
  async getMe(token: string): Promise<UserProfile> {
    return fetchWithAuth<UserProfile>('/api/users/me', {}, token);
  },

  async searchByHandle(handle: string, token: string): Promise<UserSearchResult> {
    return fetchWithAuth<UserSearchResult>(
      `/api/users/search?handle=${encodeURIComponent(handle)}`,
      {},
      token,
    );
  },

  async getMyInvitations(token: string): Promise<TripInvitation[]> {
    return fetchWithAuth<TripInvitation[]>('/api/users/me/invitations', {}, token);
  },

  async acceptInvitation(id: string, token: string): Promise<void> {
    await fetchWithAuth<{ ok: true }>(
      `/api/users/me/invitations/${id}/accept`,
      { method: 'POST' },
      token,
    );
  },

  async declineInvitation(id: string, token: string): Promise<void> {
    await fetchWithAuth<{ ok: true }>(
      `/api/users/me/invitations/${id}/decline`,
      { method: 'POST' },
      token,
    );
  },

  async inviteByHandle(
    tripId: string,
    handle: string,
    token: string,
  ): Promise<{ invitedUser: UserSearchResult }> {
    return fetchWithAuth<{ invitedUser: UserSearchResult }>(
      `/api/trips/${tripId}/invitations`,
      { method: 'POST', body: JSON.stringify({ handle }) },
      token,
    );
  },

  async getPendingInvitees(tripId: string, token: string): Promise<PendingInvitee[]> {
    return fetchWithAuth<PendingInvitee[]>(`/api/trips/${tripId}/invitations`, {}, token);
  },

  async cancelInvitation(tripId: string, userId: string, token: string): Promise<void> {
    await fetchWithAuth<{ ok: true }>(
      `/api/trips/${tripId}/invitations/${userId}`,
      { method: 'DELETE' },
      token,
    );
  },
};
