import { create } from 'zustand';

export type AuthModalMode = 'login' | 'register';

interface AuthModalStore {
  open: boolean;
  mode: AuthModalMode;
  openModal: (mode?: AuthModalMode) => void;
  closeModal: () => void;
}

export const useAuthModal = create<AuthModalStore>((set) => ({
  open: false,
  mode: 'login',
  openModal: (mode = 'login') => set({ open: true, mode }),
  closeModal: () => set({ open: false }),
}));
