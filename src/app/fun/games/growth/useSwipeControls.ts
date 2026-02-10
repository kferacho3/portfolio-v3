import { useEffect, useRef } from 'react';

type SwipeOptions = {
  enabled?: boolean;
  threshold?: number;
  onLeft: () => void;
  onRight: () => void;
  onTap?: () => void;
};

export function useSwipeControls({
  enabled = true,
  threshold = 36,
  onLeft,
  onRight,
  onTap,
}: SwipeOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const supportsPointerEvents =
      typeof window !== 'undefined' &&
      typeof (window as Window & { PointerEvent?: unknown }).PointerEvent ===
        'function';

    const commitSwipe = (deltaX: number, deltaY: number) => {
      if (Math.abs(deltaX) < threshold) return;
      if (Math.abs(deltaY) > Math.abs(deltaX) * 0.75) return;
      if (deltaX < 0) onLeft();
      else onRight();
    };

    if (supportsPointerEvents) {
      const handlePointerDown = (event: PointerEvent) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
          return;
        }
        if (activePointerId.current != null) return;
        activePointerId.current = event.pointerId;
        startX.current = event.clientX;
        startY.current = event.clientY;
      };

      const handlePointerUp = (event: PointerEvent) => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
          return;
        }
        if (activePointerId.current !== event.pointerId) return;
        const sx = startX.current;
        const sy = startY.current;
        activePointerId.current = null;
        startX.current = null;
        startY.current = null;
        if (sx == null || sy == null) return;
        const deltaX = event.clientX - sx;
        const deltaY = event.clientY - sy;
        if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
          if (onTap) onTap();
          return;
        }
        commitSwipe(deltaX, deltaY);
      };

      const handlePointerCancel = (event: PointerEvent) => {
        if (activePointerId.current !== event.pointerId) return;
        activePointerId.current = null;
        startX.current = null;
        startY.current = null;
      };

      window.addEventListener('pointerdown', handlePointerDown, {
        passive: true,
      });
      window.addEventListener('pointerup', handlePointerUp, { passive: true });
      window.addEventListener('pointercancel', handlePointerCancel, {
        passive: true,
      });

      return () => {
        window.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
      };
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const sx = startX.current;
      const sy = startY.current;
      startX.current = null;
      startY.current = null;
      if (sx == null || sy == null) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - sx;
      const deltaY = touch.clientY - sy;
      if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
        if (onTap) onTap();
        return;
      }
      commitSwipe(deltaX, deltaY);
    };

    const handleTouchCancel = () => {
      startX.current = null;
      startY.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, threshold, onLeft, onRight, onTap]);
}
