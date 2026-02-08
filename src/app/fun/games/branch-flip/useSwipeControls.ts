import { useEffect, useRef } from 'react';

type SwipeOptions = {
  enabled?: boolean;
  threshold?: number;
  onLeft: () => void;
  onRight: () => void;
};

export function useSwipeControls({
  enabled = true,
  threshold = 36,
  onLeft,
  onRight,
}: SwipeOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (startX.current == null || startY.current == null) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;
      startX.current = null;
      startY.current = null;

      if (Math.abs(deltaX) < threshold) return;
      if (Math.abs(deltaY) > Math.abs(deltaX) * 0.75) return;

      if (deltaX < 0) onLeft();
      else onRight();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (activePointerId.current != null) return;
      activePointerId.current = event.pointerId;
      startX.current = event.clientX;
      startY.current = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (activePointerId.current !== event.pointerId) return;
      const sx = startX.current;
      const sy = startY.current;
      activePointerId.current = null;
      startX.current = null;
      startY.current = null;
      if (sx == null || sy == null) return;

      const deltaX = event.clientX - sx;
      const deltaY = event.clientY - sy;
      if (Math.abs(deltaX) < threshold) return;
      if (Math.abs(deltaY) > Math.abs(deltaX) * 0.75) return;

      if (deltaX < 0) onLeft();
      else onRight();
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, {
      passive: true,
    });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [enabled, threshold, onLeft, onRight]);
}
