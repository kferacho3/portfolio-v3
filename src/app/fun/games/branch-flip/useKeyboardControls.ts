import { useEffect } from 'react';

type KeyboardOptions = {
  enabled?: boolean;
  onLeft: () => void;
  onRight: () => void;
  onTapFallback?: () => void;
  onStart?: () => void;
};

export function useKeyboardControls({
  enabled = true,
  onLeft,
  onRight,
  onTapFallback,
  onStart,
}: KeyboardOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const key = event.key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        event.preventDefault();
        onLeft();
        return;
      }
      if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        event.preventDefault();
        onRight();
        return;
      }
      if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        if (onStart) onStart();
        if (onTapFallback) onTapFallback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onLeft, onRight, onTapFallback, onStart]);
}
