import { getServerToken } from '@/lib/auth/get-server-token';
import { notFound } from 'next/navigation';
import { auth } from '../../../../../../auth';
import { tripsApi } from '@/lib/api/trips.api';
import PersonalClient from './PersonalClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PersonalPage({ params }: Props) {
  const { id } = await params;
  const token = await getServerToken();
  if (!token) notFound();

  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? '';
  const currentUserName = (session?.user as { name?: string } | undefined)?.name ?? '';

  const trip = await tripsApi.getTripById(id, token).catch(() => null);

  return (
    <PersonalClient
      tripId={id}
      token={token}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      members={trip?.members ?? []}
    />
  );
}
