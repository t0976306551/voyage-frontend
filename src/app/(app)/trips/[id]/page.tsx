import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi } from '@/lib/api/trips.api';
import { itineraryApi, ItineraryItem } from '@/lib/api/itinerary.api';
import { tasksApi, Task } from '@/lib/api/tasks.api';
import { expensesApi, Expense } from '@/lib/api/expenses.api';
import { checklistsApi, ChecklistItem } from '@/lib/api/checklists.api';
import { notFound } from 'next/navigation';
import { auth } from '../../../../../auth';
import TripDetailClient from './TripDetailClient';
import JoinConfirmDialog from '../_components/JoinConfirmDialog';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: Props) {
  const { id } = await params;
  const token = await getServerToken();
  if (!token) notFound();

  const session = await auth();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? '';

  // 分開處理 trip fetch，區分 FORBIDDEN vs NOT_FOUND
  let trip = null;
  let isForbidden = false;
  try {
    trip = await tripsApi.getTripById(id, token);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'Access denied') {
      isForbidden = true;
    }
  }

  // 非成員訪問了有效的行程連結 → 顯示加入確認 dialog
  if (isForbidden) {
    let preview = null;
    try {
      preview = await tripsApi.getTripPreviewById(id, token);
    } catch {
      notFound();
    }
    if (!preview) notFound();
    return (
      <JoinConfirmDialog
        preview={preview}
        token={token}
        joinMode="id"
      />
    );
  }

  if (!trip) notFound();

  const [itinerary, tasks, expenses, checklists] = await Promise.all([
    itineraryApi.getByTrip(id, token).catch((): ItineraryItem[] => []),
    tasksApi.getByTrip(id, token).catch((): Task[] => []),
    expensesApi.getByTrip(id, token).catch((): Expense[] => []),
    checklistsApi.list(id, token).catch((): ChecklistItem[] => []),
  ]);

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
