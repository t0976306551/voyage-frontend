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

export interface Trip {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  inviteCode: string;
  coverImage?: string;
  members: Array<{ userId: string; role: string }>;
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
};
