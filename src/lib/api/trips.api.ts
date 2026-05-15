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
  createdAt: string;
}

export const tripsApi = {
  getMyTrips: (token: string) =>
    fetchWithAuth<Trip[]>('/api/trips', {}, token),

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
};

/** Resolve a coverImage path that may be relative (/uploads/...) into a full URL. */
export function resolveCoverImage(coverImage: string | null | undefined): string | null {
  if (!coverImage) return null;
  if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) {
    return coverImage;
  }
  return `${API_URL}${coverImage}`;
}
