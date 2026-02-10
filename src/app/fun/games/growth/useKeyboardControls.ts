import { useEffect } from 'react';

type KeyboardOptions = {
  enabled?: boolean;
  onLeft: () => void;
  onRight: () => void;
  onPrimary?: () => void;
  onStart?: () => void;
};

export function useKeyboardControls({
  enabled = true,
  onLeft,
  onRight,
  onPrimary,
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
      if (key === ' ') {
        event.preventDefault();
        if (onPrimary) onPrimary();
        return;
      }
      if (key === 'Enter') {
        event.preventDefault();
        if (onStart) onStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onLeft, onRight, onPrimary, onStart]);
}
