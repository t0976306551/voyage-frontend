import { Trip } from '@/lib/api/trips.api';

export interface EditPermissions {
  isOwner: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function useEditPermissions(trip: Trip, currentUserId: string): EditPermissions {
  const myMember = trip.members.find((m) => m.userId === currentUserId);
  const isOwner = myMember?.role === 'Owner';
  const perms = trip.collaboratorPermissions ?? {
    canEditTripInfo: true, canInvite: true, canEditContent: true, canDeleteContent: true, canManageModules: true,
  };
  return {
    isOwner,
    canAdd: isOwner || myMember?.role === 'Editor',
    canEdit: isOwner || (myMember?.role === 'Editor' && !!perms.canEditContent),
    canDelete: isOwner || (myMember?.role === 'Editor' && !!perms.canDeleteContent),
  };
}
