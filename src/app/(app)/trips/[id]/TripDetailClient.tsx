'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon } from 'lucide-react';
import { itineraryApi, ItineraryItem } from '@/lib/api/itinerary.api';
import { tasksApi, Task } from '@/lib/api/tasks.api';
import { expensesApi, Expense } from '@/lib/api/expenses.api';
import { checklistsApi, ChecklistItem } from '@/lib/api/checklists.api';
import { Trip, EnabledModules } from '@/lib/api/trips.api';
import TripHeader from './_components/TripHeader';
import JumpBar, { JumpBarItem } from './_components/JumpBar';
import TripSettingsDrawer from './_components/TripSettingsDrawer';
import ItinerarySection from './_sections/ItinerarySection';
import ChecklistSection from './_sections/ChecklistSection';
import TasksSection from './_sections/TasksSection';
import ExpensesSection from './_sections/ExpensesSection';

interface Props {
  trip: Trip;
  itinerary: ItineraryItem[];
  initialTasks: Task[];
  initialExpenses: Expense[];
  initialChecklists: ChecklistItem[];
  token: string;
  currentUserId: string;
}

export default function TripDetailClient({
  trip,
  itinerary: initial,
  initialTasks,
  initialExpenses,
  initialChecklists,
  token,
  currentUserId,
}: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);

  const tripQuery = useQuery({
    queryKey: ['trip', trip.id],
    queryFn: async () => trip,
    initialData: trip,
  });
  const liveTrip = tripQuery.data ?? trip;
  const enabled: EnabledModules = liveTrip.enabledModules ?? {
    tasks: true, expenses: true, checklists: true,
  };

  const isOwner = liveTrip.members.some(
    (m) => m.userId === currentUserId && m.role === 'Owner',
  );
  const myMember = liveTrip.members.find((m) => m.userId === currentUserId);
  const perms = liveTrip.collaboratorPermissions ?? {
    canEditTripInfo: true, canInvite: true, canEditContent: true, canDeleteContent: true, canManageModules: true,
  };
  const canEdit = isOwner || (myMember?.role === 'Editor' && perms.canEditContent);
  const canDelete = isOwner || (myMember?.role === 'Editor' && perms.canDeleteContent);

  const { data: itinerary = initial } = useQuery({
    queryKey: ['itinerary', trip.id],
    queryFn: () => itineraryApi.getByTrip(trip.id, token),
    initialData: initial,
  });
  const { data: tasks = initialTasks } = useQuery({
    queryKey: ['tasks', trip.id],
    queryFn: () => tasksApi.getByTrip(trip.id, token),
    initialData: initialTasks,
  });
  const { data: expenses = initialExpenses } = useQuery({
    queryKey: ['expenses', trip.id],
    queryFn: () => expensesApi.getByTrip(trip.id, token),
    initialData: initialExpenses,
  });
  const { data: checklists = initialChecklists } = useQuery({
    queryKey: ['checklists', trip.id],
    queryFn: () => checklistsApi.list(trip.id, token),
    initialData: initialChecklists,
  });

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => socket.emit('join_trip', trip.id));

    socket.on('itinerary:changed', () => {
      qc.invalidateQueries({ queryKey: ['itinerary', trip.id] });
    });
    socket.on('expense:changed', () => {
      qc.invalidateQueries({ queryKey: ['expenses', trip.id] });
    });
    socket.on('task:changed', () => {
      qc.invalidateQueries({ queryKey: ['tasks', trip.id] });
    });
    socket.on('checklist:item:created', () => {
      qc.invalidateQueries({ queryKey: ['checklists', trip.id] });
    });
    socket.on('checklist:item:updated', () => {
      qc.invalidateQueries({ queryKey: ['checklists', trip.id] });
    });
    socket.on('checklist:item:deleted', () => {
      qc.invalidateQueries({ queryKey: ['checklists', trip.id] });
    });
    socket.on('checklist:assignment:toggled', () => {
      qc.invalidateQueries({ queryKey: ['checklists', trip.id] });
    });
    socket.on('trip:modules:updated', (data: { tripId: string; enabledModules: EnabledModules }) => {
      if (data.tripId !== trip.id) return;
      qc.setQueryData<Trip>(['trip', trip.id], (prev) =>
        prev ? { ...prev, enabledModules: data.enabledModules } : prev,
      );
    });
    socket.on('trip:updated', (data: { tripId: string; trip: Trip }) => {
      qc.setQueryData(['trip', trip.id], data.trip);
      qc.invalidateQueries({ queryKey: ['trips'] });
    });
    socket.on('trip:member:joined', () => {
      qc.invalidateQueries({ queryKey: ['trip', trip.id] });
    });
    socket.on('trip:member:removed', () => {
      qc.invalidateQueries({ queryKey: ['trip', trip.id] });
    });
    socket.on('trip:kicked', ({ tripId }: { tripId: string }) => {
      if (tripId !== trip.id) return;
      router.push('/trips');
    });

    return () => {
      socket.emit('leave_trip', trip.id);
      socket.disconnect();
    };
  }, [token, trip.id, qc, router]);

  const jumpItems: JumpBarItem[] = [
    { key: 'itinerary',  label: '行程',     enabled: true },
    { key: 'checklists', label: '協作清單', enabled: enabled.checklists },
    { key: 'tasks',      label: '待辦',     enabled: enabled.tasks },
    { key: 'expenses',   label: '費用',     enabled: enabled.expenses },
  ];

  return (
    <main className="bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-100 vs-page-enter" style={{ minHeight: '100dvh' }}>

      {/* ── Sticky header (sticks when hero scrolls away) ── */}
      <TripHeader
        trip={liveTrip}
        isOwner={isOwner}
        token={token}
        onOpenSettings={() => setShowSettings(true)}
      />
      <JumpBar items={jumpItems} />

      {/* ── Main content ── */}
      {/* pb-28 = normal breathing room. JumpBar clicks still highlight the
          target pill instantly via optimistic setActiveKey, so even when the
          page is too short to scroll the last section flush below the bar,
          the user gets immediate feedback the click was registered. */}
      <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto space-y-8 pb-28">
        <ItinerarySection
          trip={liveTrip}
          itinerary={itinerary}
          token={token}
          canEdit={canEdit}
          canDelete={canDelete}
        />

        {enabled.checklists && (
          <ChecklistSection
            trip={liveTrip}
            items={checklists}
            token={token}
            currentUserId={currentUserId}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}

        {enabled.tasks && (
          <TasksSection
            trip={liveTrip}
            tasks={tasks}
            token={token}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}

        {enabled.expenses && (
          <ExpensesSection
            trip={liveTrip}
            expenses={expenses}
            token={token}
            currentUserId={currentUserId}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}

        {isOwner && (!enabled.checklists || !enabled.tasks || !enabled.expenses) && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-slate-500 bg-white/60 border border-dashed border-slate-300 hover:text-indigo-600 hover:border-indigo-400 hover:bg-white transition-all cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              新增模組（協作清單／待辦／費用）
            </button>
          </div>
        )}
      </div>

      {showSettings && (
        <TripSettingsDrawer
          trip={liveTrip}
          token={token}
          isOwner={isOwner}
          currentUserId={currentUserId}
          moduleCounts={{
            checklists: checklists.length,
            tasks: tasks.length,
            expenses: expenses.length,
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}
