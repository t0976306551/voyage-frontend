import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi, Trip } from '@/lib/api/trips.api';
import { redirect } from 'next/navigation';
import TripsClient from './TripsClient';

export default async function TripsPage() {
  const token = await getServerToken();
  if (!token) redirect('/');

  let trips: Trip[] = [];
  try {
    trips = await tripsApi.getMyTrips(token);
  } catch (err) {
    console.error('[TripsPage] Failed to fetch trips:', err);
  }

  return <TripsClient trips={trips} token={token} />;
}
