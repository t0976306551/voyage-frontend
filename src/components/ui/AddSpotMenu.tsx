'use client';

import { SpotEditorModal } from '@/components/ui/SpotEditorModal';

interface Props {
  tripId: string;
  day: number | null;
  token: string;
  onClose: () => void;
  open?: boolean;
}

export function AddSpotMenu({ tripId, day, token, onClose, open = true }: Props) {
  return (
    <SpotEditorModal
      open={open}
      tripId={tripId}
      day={day}
      token={token}
      onClose={onClose}
    />
  );
}

export default AddSpotMenu;
