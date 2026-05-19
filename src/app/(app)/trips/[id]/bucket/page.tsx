import { notFound } from 'next/navigation';
import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi } from '@/lib/api/trips.api';
import { itineraryApi, ItineraryItem } from '@/lib/api/itinerary.api';
import { auth } from '../../../../../../auth';
import BucketClient from './BucketClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BucketPage({ params }: Props) {
  const { id } = await params;
  const token = await getServerToken();
  if (!token) notFound();

  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? '';

  const trip = await tripsApi.getTripById(id, token).catch(() => null);
  if (!trip) notFound();

  const items = await itineraryApi
    .getByTrip(id, token)
    .catch((): ItineraryItem[] => []);

  return (
    <BucketClient
      trip={trip}
      initialItems={items}
      token={token}
      currentUserId={currentUserId}
    />
  );
}
