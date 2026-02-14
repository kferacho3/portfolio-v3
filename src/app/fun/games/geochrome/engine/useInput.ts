import { useEffect, useRef } from 'react';
import type { InputState } from './types';

const INITIAL_INPUT: InputState = {
  forward: 0,
  right: 0,
  boost: false,
};
const POINTER_DEADZONE = 0.08;
const MOUSE_AIM_GAIN = 0.68;

export function useInput(enabled: boolean) {
  const inputRef = useRef<InputState>({ ...INITIAL_INPUT });
  const pointerRef = useRef({ forward: 0, right: 0, active: false });
  const hoverRef = useRef({ forward: 0, right: 0 });

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
        : hoverRef.current.forward;
      const pointerRight = pointerRef.current.active
        ? pointerRef.current.right
        : hoverRef.current.right;

      const normalizedPointerForward =
        Math.abs(pointerForward) < POINTER_DEADZONE ? 0 : pointerForward;
      const normalizedPointerRight =
        Math.abs(pointerRight) < POINTER_DEADZONE ? 0 : pointerRight;

      inputRef.current.forward = Math.max(
        -1,
        Math.min(1, keyboardForward + normalizedPointerForward)
      );
      inputRef.current.right = Math.max(
        -1,
        Math.min(1, keyboardRight + normalizedPointerRight)
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
      hoverRef.current.forward = 0;
      hoverRef.current.right = 0;
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
      if (!enabled) return;
      if (pointerRef.current.active) {
        const dx = (event.clientX - pointerStartX) / 140;
        const dy = (event.clientY - pointerStartY) / 140;
        const rawRight = Math.max(-1, Math.min(1, dx));
        const rawForward = Math.max(-1, Math.min(1, -dy));
        pointerRef.current.right =
          pointerRef.current.right * 0.55 + rawRight * 0.45;
        pointerRef.current.forward =
          pointerRef.current.forward * 0.55 + rawForward * 0.45;
        recompute();
        return;
      }

      if (event.pointerType === 'mouse') {
        const nx = event.clientX / Math.max(1, window.innerWidth);
        const ny = event.clientY / Math.max(1, window.innerHeight);
        const rawRight = Math.max(-1, Math.min(1, (nx * 2 - 1) * MOUSE_AIM_GAIN));
        const rawForward = Math.max(
          -1,
          Math.min(1, -(ny * 2 - 1) * MOUSE_AIM_GAIN)
        );
        hoverRef.current.right = hoverRef.current.right * 0.8 + rawRight * 0.2;
        hoverRef.current.forward =
          hoverRef.current.forward * 0.8 + rawForward * 0.2;
        recompute();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      pointerRef.current.active = false;
      pointerRef.current.forward = 0;
      pointerRef.current.right = 0;
      if (event.pointerType !== 'mouse') {
        hoverRef.current.forward = 0;
        hoverRef.current.right = 0;
      }
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
