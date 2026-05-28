import { Trip } from '@/lib/api/trips.api';

export function memberLabel(userId: string, trip: Trip, currentUserId?: string): string {
  if (currentUserId && userId === currentUserId) return '你';
  const m = trip.members.find((mm) => mm.userId === userId);
  return m?.name || m?.email?.split('@')[0] || userId.slice(0, 6).toUpperCase();
}

export function memberShort(uid: string, trip: Trip, currentUserId?: string): string {
  if (currentUserId && uid === currentUserId) return '你';
  const m = trip.members.find((mm) => mm.userId === uid);
  return m?.name || m?.email?.split('@')[0] || uid.slice(0, 4).toUpperCase();
}
