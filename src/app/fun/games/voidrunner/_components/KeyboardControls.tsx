import React, { useEffect } from 'react';
import { voidRunnerState } from '../state';

const KeyboardControls: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      const isArrow =
        code === 'ArrowLeft' || code === 'ArrowRight' || key === 'arrowleft' || key === 'arrowright';

      if (isArrow || code === 'Space' || code === 'Enter' || key === ' ' || key === 'enter') {
        e.preventDefault();
      }

      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'arrowleft' || key === 'a') {
        voidRunnerState.controls.left = true;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || key === 'arrowright' || key === 'd') {
        voidRunnerState.controls.right = true;
      }
      if (code === 'Space' || code === 'Enter' || key === ' ' || key === 'enter') {
        if (voidRunnerState.phase === 'menu' || voidRunnerState.phase === 'gameover') {
          voidRunnerState.reset();
          voidRunnerState.startGame();
        }
      }
      if (code === 'KeyR' || key === 'r') {
        if (voidRunnerState.phase !== 'menu') {
          voidRunnerState.reset();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'arrowleft' || key === 'a') {
        voidRunnerState.controls.left = false;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || key === 'arrowright' || key === 'd') {
        voidRunnerState.controls.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return null;
};

export default KeyboardControls;
