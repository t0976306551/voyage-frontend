import { notFound } from 'next/navigation';
import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi } from '@/lib/api/trips.api';
import { itineraryApi, ItineraryItem } from '@/lib/api/itinerary.api';
import DayDetailClient from './DayDetailClient';

interface Props {
  params: Promise<{ id: string; day: string }>;
}

export default async function DayDetailPage({ params }: Props) {
  const { id, day: dayParam } = await params;
  const day = parseInt(dayParam, 10);
  if (Number.isNaN(day) || day < 1) notFound();

  const token = await getServerToken();
  if (!token) notFound();

  const [trip, items] = await Promise.all([
    tripsApi.getTripById(id, token).catch(() => null),
    itineraryApi.getByDay(id, day, token).catch((): ItineraryItem[] => []),
  ]);
  if (!trip) notFound();

  return <DayDetailClient trip={trip} day={day} initialItems={items} token={token} />;
}
