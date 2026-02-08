'use client';

import { useEffect } from 'react';

export function useKeyboardControls({
  enabled,
  onLeft,
  onRight,
  onFlip,
  onTapFallback,
  onStart,
}: {
  enabled: boolean;
  onLeft: () => void;
  onRight: () => void;
  onFlip: () => void;
  onTapFallback: () => void;
  onStart: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    const handle = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        onLeft();
        return;
      }
      if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        onRight();
        return;
      }
      if (key === 'arrowup' || key === 'w') {
        event.preventDefault();
        onFlip();
        return;
      }
      if (
        key === ' ' ||
        key === 'space' ||
        key === 'spacebar' ||
        key === 'enter'
      ) {
        event.preventDefault();
        onStart();
        return;
      }
      if (key === 'arrowdown' || key === 's') {
        event.preventDefault();
        onTapFallback();
      }
    };

    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [enabled, onFlip, onLeft, onRight, onStart, onTapFallback]);
}
