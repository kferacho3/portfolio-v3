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

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key;
      const code = event.code;
      if (
        key === 'ArrowLeft' ||
        key === 'a' ||
        key === 'A' ||
        code === 'KeyA' ||
        code === 'KeyQ'
      ) {
        event.preventDefault();
        onLeft();
        return;
      }
      if (
        key === 'ArrowRight' ||
        key === 'd' ||
        key === 'D' ||
        code === 'KeyD' ||
        code === 'KeyE'
      ) {
        event.preventDefault();
        onRight();
        return;
      }
      if (key === ' ' || code === 'Space') {
        event.preventDefault();
        if (onPrimary) onPrimary();
        return;
      }
      if (key === 'Enter' || code === 'NumpadEnter') {
        event.preventDefault();
        if (onStart) onStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onLeft, onRight, onPrimary, onStart]);
}
