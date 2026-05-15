import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi } from '@/lib/api/trips.api';
import { itineraryApi, ItineraryItem } from '@/lib/api/itinerary.api';
import { tasksApi, Task } from '@/lib/api/tasks.api';
import { expensesApi, Expense } from '@/lib/api/expenses.api';
import { checklistsApi, ChecklistItem } from '@/lib/api/checklists.api';
import { notFound } from 'next/navigation';
import { auth } from '../../../../../auth';
import TripDetailClient from './TripDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: Props) {
  const { id } = await params;
  const token = await getServerToken();
  if (!token) notFound();

  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? '';

  const [trip, itinerary, tasks, expenses, checklists] = await Promise.all([
    tripsApi.getTripById(id, token).catch(() => null),
    itineraryApi.getByTrip(id, token).catch((): ItineraryItem[] => []),
    tasksApi.getByTrip(id, token).catch((): Task[] => []),
    expensesApi.getByTrip(id, token).catch((): Expense[] => []),
    checklistsApi.list(id, token).catch((): ChecklistItem[] => []),
  ]);

  if (!trip) notFound();

  return (
    <TripDetailClient
      trip={trip}
      itinerary={itinerary}
      initialTasks={tasks}
      initialExpenses={expenses}
      initialChecklists={checklists}
      token={token}
      currentUserId={currentUserId}
    />
  );
}
