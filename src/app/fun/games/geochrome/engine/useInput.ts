import { useEffect, useRef } from 'react';
import type { InputState } from './types';

const INITIAL_INPUT: InputState = {
  forward: 0,
  right: 0,
  boost: false,
};

export function useInput(enabled: boolean) {
  const inputRef = useRef<InputState>({ ...INITIAL_INPUT });
  const pointerRef = useRef({ forward: 0, right: 0, active: false });

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

      const keyboardForward = up - down;
      const keyboardRight = right - left;

      const pointerForward = pointerRef.current.active
        ? pointerRef.current.forward
        : 0;
      const pointerRight = pointerRef.current.active ? pointerRef.current.right : 0;

      inputRef.current.forward = Math.max(
        -1,
        Math.min(1, keyboardForward + pointerForward)
      );
      inputRef.current.right = Math.max(
        -1,
        Math.min(1, keyboardRight + pointerRight)
      );
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
      pointerRef.current.active = false;
      pointerRef.current.forward = 0;
      pointerRef.current.right = 0;
      inputRef.current.forward = 0;
      inputRef.current.right = 0;
      recompute();
    };

    let pointerStartX = 0;
    let pointerStartY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (!enabled) return;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerRef.current.active = true;
      pointerRef.current.forward = 0;
      pointerRef.current.right = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!enabled || !pointerRef.current.active) return;
      const dx = (event.clientX - pointerStartX) / 140;
      const dy = (event.clientY - pointerStartY) / 140;
      const rawRight = Math.max(-1, Math.min(1, dx));
      const rawForward = Math.max(-1, Math.min(1, -dy));
      pointerRef.current.right = pointerRef.current.right * 0.55 + rawRight * 0.45;
      pointerRef.current.forward =
        pointerRef.current.forward * 0.55 + rawForward * 0.45;
      recompute();
    };

    const onPointerUp = () => {
      pointerRef.current.active = false;
      pointerRef.current.forward = 0;
      pointerRef.current.right = 0;
      recompute();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [enabled]);

  return inputRef;
}
