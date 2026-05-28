'use client';

import { useEffect, useRef } from 'react';

// Module-level singleton — only one guard is active at a time
let _guard: ((href: string) => void) | null = null;

export function setNavigationGuard(fn: ((href: string) => void) | null) {
  _guard = fn;
}

/**
 * Call from Link onClick / navigation buttons.
 * Returns true if a guard intercepted (caller should e.preventDefault()).
 */
export function triggerNavigationGuard(href: string): boolean {
  if (_guard) {
    _guard(href);
    return true;
  }
  return false;
}

export function useNavigationGuard(
  isDirty: boolean,
  onIntercepted: (href: string) => void,
) {
  const callbackRef = useRef(onIntercepted);
  callbackRef.current = onIntercepted;

  useEffect(() => {
    if (!isDirty) {
      setNavigationGuard(null);
      return;
    }
    setNavigationGuard((href) => callbackRef.current(href));
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      setNavigationGuard(null);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);
}
