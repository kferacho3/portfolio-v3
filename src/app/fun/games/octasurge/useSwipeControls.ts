'use client';

import { useEffect, useRef } from 'react';

export function useSwipeControls({
  enabled,
  onLeft,
  onRight,
  onUp,
  onDown,
  threshold = 36,
}: {
  enabled: boolean;
  onLeft: () => void;
  onRight: () => void;
  onUp?: () => void;
  onDown?: () => void;
  threshold?: number;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (event: TouchEvent) => {
      const t = event.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (startX.current == null || startY.current == null) return;
      const t = event.changedTouches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;

      startX.current = null;
      startY.current = null;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < threshold && absY < threshold) return;

      if (absX >= absY * 1.2) {
        if (dx < 0) onLeft();
        else onRight();
        return;
      }

      if (absY >= absX * 1.1) {
        if (dy < 0) onUp?.();
        else onDown?.();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, onDown, onLeft, onRight, onUp, threshold]);
}
