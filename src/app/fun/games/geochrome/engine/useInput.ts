import { useEffect, useRef } from 'react';
import type { InputState } from './types';

const INITIAL_INPUT: InputState = {
  forward: 0,
  right: 0,
  boost: false,
};

export function useInput(enabled: boolean) {
  const inputRef = useRef<InputState>({ ...INITIAL_INPUT });

  useEffect(() => {
    if (!enabled) {
      inputRef.current.forward = 0;
      inputRef.current.right = 0;
      inputRef.current.boost = false;
    }
  }, [enabled]);

  useEffect(() => {
    const pressed = new Set<string>();

    const recompute = () => {
      if (!enabled) {
        inputRef.current.forward = 0;
        inputRef.current.right = 0;
        inputRef.current.boost = false;
        return;
      }

      const up = pressed.has('KeyW') || pressed.has('ArrowUp') ? 1 : 0;
      const down = pressed.has('KeyS') || pressed.has('ArrowDown') ? 1 : 0;
      const left = pressed.has('KeyA') || pressed.has('ArrowLeft') ? 1 : 0;
      const right = pressed.has('KeyD') || pressed.has('ArrowRight') ? 1 : 0;

      inputRef.current.forward = up - down;
      inputRef.current.right = right - left;
      inputRef.current.boost = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
    };

    const onKeyDown = (event: KeyboardEvent) => {
      pressed.add(event.code);
      recompute();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      pressed.delete(event.code);
      recompute();
    };

    const onBlur = () => {
      pressed.clear();
      recompute();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);

  return inputRef;
}
