'use client';

import { LoginModal } from '@/components/auth/LoginModal';
import { useAuthModal } from '@/store/auth-modal.store';

/**
 * Singleton mount point for the auth modal. Place once on the landing page
 * (only when the visitor is logged out). Any client component can open it via
 * `useAuthModal.openModal('login' | 'register')`.
 */
export function AuthModalMount() {
  const { open, mode, closeModal } = useAuthModal();
  return <LoginModal open={open} onClose={closeModal} defaultMode={mode} />;
}

export default AuthModalMount;
