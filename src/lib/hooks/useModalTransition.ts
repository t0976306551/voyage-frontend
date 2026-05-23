'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Manages modal mount/unmount lifecycle with exit animation support.
 * - `mounted`: whether the modal DOM should exist
 * - `closing`: whether the exit animation is currently playing
 *
 * Usage: add `data-vs-closing={closing ? '' : undefined}` to the modal's
 * outermost div (inside <Portal>), and return null when !mounted.
 */
export function useModalTransition(open: boolean, duration = 300) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      timer.current = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, duration);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { mounted, closing };
}
