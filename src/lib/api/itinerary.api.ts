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

export type SpotCategory = 'food' | 'lodging' | 'attraction' | 'activity' | 'transport' | 'admin';

export interface ItineraryItem {
  id: string;
  tripId: string;
  day: number | null;
  title: string;
  category: SpotCategory | null;
  coverImage?: string | null;
  lat?: number | null;
  lng?: number | null;
  order: number;
  sourceUrl?: string | null;
  note?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  address?: string | null;
  createdAt: string;
}

export interface CreateItemPayload {
  title: string;
  day: number | null;
  category?: SpotCategory;
  coverImage?: string;
  lat?: number;
  lng?: number;
  sourceUrl?: string;
  note?: string;
  startTime?: string | null;
  durationMinutes?: number | null;
  address?: string | null;
}

export const itineraryApi = {
  getByTrip: (tripId: string, token: string): Promise<ItineraryItem[]> =>
    fetchWithAuth<ItineraryItem[]>(`/api/trips/${tripId}/itinerary`, token),

  getByDay: (tripId: string, day: number, token: string): Promise<ItineraryItem[]> =>
    fetchWithAuth<ItineraryItem[]>(`/api/trips/${tripId}/itinerary?day=${day}`, token),

  getBucket: (tripId: string, token: string): Promise<ItineraryItem[]> =>
    fetchWithAuth<ItineraryItem[]>(`/api/trips/${tripId}/itinerary?bucket=true`, token),

  createItem: (tripId: string, payload: CreateItemPayload, token: string): Promise<ItineraryItem> =>
    fetchWithAuth<ItineraryItem>(`/api/trips/${tripId}/itinerary`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteItem: (tripId: string, itemId: string, token: string): Promise<void> =>
    fetchWithAuth<void>(`/api/trips/${tripId}/itinerary/${itemId}`, token, {
      method: 'DELETE',
    }),

  reorderBucket: (
    tripId: string,
    items: { id: string; order: number }[],
    token: string,
  ): Promise<void> =>
    fetchWithAuth<void>(`/api/trips/${tripId}/itinerary/reorder`, token, {
      method: 'PATCH',
      body: JSON.stringify({ day: null, items }),
    }),

  reorder: (
    tripId: string,
    day: number | null,
    items: { id: string; order: number }[],
    token: string,
  ): Promise<void> =>
    fetchWithAuth<void>(`/api/trips/${tripId}/itinerary/reorder`, token, {
      method: 'PATCH',
      body: JSON.stringify({ day, items }),
    }),

  updateItem: (
    tripId: string,
    itemId: string,
    patch: Partial<CreateItemPayload> & { day?: number | null; order?: number },
    token: string,
  ): Promise<ItineraryItem> =>
    fetchWithAuth<ItineraryItem>(`/api/trips/${tripId}/itinerary/${itemId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
};
