'use client';

import { useEffect, useRef } from 'react';

export function useSwipeControls({
  enabled,
  onLeft,
  onRight,
  threshold = 36,
}: {
  enabled: boolean;
  onLeft: () => void;
  onRight: () => void;
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

      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

      if (dx < 0) onLeft();
      else onRight();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, onLeft, onRight, threshold]);
}
