import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { DIRECTIONS } from '../constants';
import { usePowerUpTimer } from '../hooks/usePowerUpTimer';
import { apexState, mutation } from '../state';

const InputHandler: React.FC = () => {
  const snap = useSnapshot(apexState);

  useEffect(() => {
    const handleInput = (e: KeyboardEvent | PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const activeElement = document.activeElement as HTMLElement | null;
      const isUiEvent = Boolean(
        target?.closest?.('[data-apex-ui]') || activeElement?.closest?.('[data-apex-ui]')
      );
      if (isUiEvent) return;

      if (e.type === 'contextmenu') {
        if (snap.mode === 'curved' && snap.phase === 'playing') {
          e.preventDefault();
        }
        return;
      }

      const isPrimaryPointer =
        e.type === 'pointerdown' && (e as PointerEvent).button === 0;
      const isSecondaryPointer =
        e.type === 'pointerdown' && (e as PointerEvent).button === 2;
      const keyCode = e.type === 'keydown' ? (e as KeyboardEvent).code : '';
      const isAction =
        isPrimaryPointer ||
        (e.type === 'keydown' && ['Space', 'Enter', 'ArrowUp', 'ArrowDown'].includes(keyCode));

      if (isAction) {
        if (e.type === 'keydown') {
          (e as KeyboardEvent).preventDefault();
        }
        if (snap.phase === 'playing' && mutation.isOnPlatform && !mutation.gameOver) {
          if (snap.mode === 'curved') {
            mutation.curveDirection *= -1;
          } else if (snap.mode === 'spiral') {
            mutation.spiralDirection *= -1;
          } else {
            mutation.directionIndex = (mutation.directionIndex + 1) % DIRECTIONS.length;
            mutation.targetDirection.copy(DIRECTIONS[mutation.directionIndex]);
          }
          apexState.addScore(1);
        } else if (snap.phase === 'menu') {
          apexState.reset();
          apexState.startGame();
        } else if (snap.phase === 'gameover') {
          if (e.type === 'keydown' && (e as KeyboardEvent).code === 'Space') {
            apexState.reset();
          }
          if (e.type === 'pointerdown') {
            apexState.reset();
            apexState.startGame();
          }
        }
      }

      if (
        snap.phase === 'playing' &&
        snap.mode === 'curved' &&
        mutation.isOnPlatform &&
        !mutation.gameOver
      ) {
        if (isSecondaryPointer || (e.type === 'keydown' && ['KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(keyCode))) {
          if (e.type === 'pointerdown') {
            e.preventDefault();
          }
          mutation.curveLane = keyCode === 'KeyQ' ? -1 : keyCode === 'KeyE' ? 1 : mutation.curveLane * -1;
        }
      }
    };

    window.addEventListener('pointerdown', handleInput);
    window.addEventListener('contextmenu', handleInput);
    window.addEventListener('keydown', handleInput);

    return () => {
      window.removeEventListener('pointerdown', handleInput);
      window.removeEventListener('contextmenu', handleInput);
      window.removeEventListener('keydown', handleInput);
    };
  }, [snap.phase]);

  usePowerUpTimer();

  return null;
};

export default InputHandler;
