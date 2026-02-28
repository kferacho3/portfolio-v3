import { useThree } from '@react-three/fiber';
import React, { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import {
  CURVE_DEFAULT_CURVATURE,
  CURVE_DEFAULT_CURVATURE_VEL,
  CURVE_INPUT_CURVATURE_BOOST,
  CURVE_INPUT_CURVATURE_VEL_BOOST,
  CURVE_MAX_YAW,
  DIRECTIONS,
} from '../constants';
import { usePowerUpTimer } from '../hooks/usePowerUpTimer';
import { apexState, mutation } from '../state';

const InputHandler: React.FC = () => {
  const snap = useSnapshot(apexState);
  const { gl } = useThree();

  useEffect(() => {
    const isCanvasEventTarget = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      return target === gl.domElement || gl.domElement.contains(target);
    };

    const handleInput = (e: KeyboardEvent | PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const activeElement = document.activeElement as HTMLElement | null;
      const isUiEvent = Boolean(
        target?.closest?.('[data-apex-ui]') ||
        activeElement?.closest?.('[data-apex-ui]')
      );
      if (isUiEvent) return;

      const isPointerDown = e.type === 'pointerdown';
      if (isPointerDown) {
        const pointer = e as PointerEvent;
        if (pointer.button !== 0) return;
        if (!isCanvasEventTarget(pointer.target)) return;
      }

      if (e.type === 'contextmenu') {
        if (
          snap.mode === 'curved' &&
          snap.phase === 'playing' &&
          isCanvasEventTarget((e as PointerEvent).target)
        ) {
          e.preventDefault();
        }
        return;
      }

      const isPrimaryPointer = e.type === 'pointerdown';
      const keyCode = e.type === 'keydown' ? (e as KeyboardEvent).code : '';
      const isAction =
        isPrimaryPointer ||
        (e.type === 'keydown' &&
          ['Space', 'Enter', 'ArrowUp', 'ArrowDown'].includes(keyCode));
      const isMenuOrGameOverKeyboardStart =
        e.type === 'keydown' && ['Space', 'Enter'].includes(keyCode);

      if (isAction) {
        if (e.type === 'keydown') {
          (e as KeyboardEvent).preventDefault();
        }
        if (
          snap.phase === 'playing' &&
          mutation.isOnPlatform &&
          !mutation.gameOver
        ) {
          if (snap.mode === 'curved') {
            mutation.curveDirection *= -1;
            mutation.curveCurvature = Math.min(
              CURVE_MAX_YAW * 0.92,
              Math.max(
                CURVE_DEFAULT_CURVATURE,
                mutation.curveCurvature + CURVE_INPUT_CURVATURE_BOOST
              )
            );
            mutation.curveCurvatureVel = Math.min(
              1.28,
              Math.max(
                CURVE_DEFAULT_CURVATURE_VEL,
                mutation.curveCurvatureVel + CURVE_INPUT_CURVATURE_VEL_BOOST
              )
            );
          } else if (snap.mode === 'spiral') {
            mutation.spiralDirection *= -1;
            mutation.pathSpiralDirection = mutation.spiralDirection;
            mutation.pathSpiralSwitchRemaining = 0;
          } else {
            mutation.directionIndex =
              (mutation.directionIndex + 1) % DIRECTIONS.length;
            mutation.targetDirection.copy(DIRECTIONS[mutation.directionIndex]);
          }
          apexState.addScore(1);
        } else if (snap.phase === 'menu' && isMenuOrGameOverKeyboardStart) {
          apexState.reset();
          apexState.startGame();
        } else if (
          snap.phase === 'gameover' &&
          isMenuOrGameOverKeyboardStart
        ) {
          apexState.reset();
          apexState.startGame();
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
  }, [gl, snap.phase, snap.mode]);

  usePowerUpTimer();

  return null;
};

export default InputHandler;
