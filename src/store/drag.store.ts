import { create } from 'zustand';

interface DragStore {
  draggingId: string | null;
  setDragging: (id: string | null) => void;
}

export const useDragStore = create<DragStore>((set) => ({
  draggingId: null,
  setDragging: (id) => set({ draggingId: id }),
}));
