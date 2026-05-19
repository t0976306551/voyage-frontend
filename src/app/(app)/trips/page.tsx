import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi, type TripsListResponse } from '@/lib/api/trips.api';
import { redirect } from 'next/navigation';
import TripsClient from './TripsClient';

const PAGE_SIZE = 10;

export default async function TripsPage() {
  const token = await getServerToken();
  if (!token) redirect('/');

  let initial: TripsListResponse = {
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  };
  try {
    initial = await tripsApi.getMyTrips({ page: 1, pageSize: PAGE_SIZE }, token);
  } catch (err) {
    console.error('[TripsPage] Failed to fetch trips:', err);
  }

  return <TripsClient initial={initial} token={token} pageSize={PAGE_SIZE} />;
}
