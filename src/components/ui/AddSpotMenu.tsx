'use client';

import { SpotEditorModal } from '@/components/ui/SpotEditorModal';

interface Props {
  tripId: string;
  day: number | null;
  token: string;
  onClose: () => void;
}

export function AddSpotMenu({ tripId, day, token, onClose }: Props) {
  return (
    <SpotEditorModal
      tripId={tripId}
      day={day}
      token={token}
      onClose={onClose}
    />
  );
}

export default AddSpotMenu;
