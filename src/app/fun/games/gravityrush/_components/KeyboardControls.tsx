import React, { useEffect } from 'react';
import { gravityRushState } from '../state';

const KeyboardControls: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      const isArrow =
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        key === 'arrowup' ||
        key === 'arrowdown' ||
        key === 'arrowleft' ||
        key === 'arrowright';

      if (isArrow || code === 'Space' || key === ' ') {
        e.preventDefault();
      }

      if (code === 'ArrowUp' || code === 'KeyW' || key === 'arrowup' || key === 'w') {
        gravityRushState.controls.forward = true;
      }
      if (code === 'ArrowDown' || code === 'KeyS' || key === 'arrowdown' || key === 's') {
        gravityRushState.controls.back = true;
      }
      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'arrowleft' || key === 'a') {
        gravityRushState.controls.left = true;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || key === 'arrowright' || key === 'd') {
        gravityRushState.controls.right = true;
      }
      if (code === 'Space' || key === ' ') {
        if (gravityRushState.phase === 'menu' || gravityRushState.phase === 'gameover') {
          gravityRushState.reset();
          gravityRushState.startGame();
        } else {
          gravityRushState.controls.jump = true;
        }
      }
      if (code === 'KeyR' || key === 'r') {
        gravityRushState.reset();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      if (code === 'ArrowUp' || code === 'KeyW' || key === 'arrowup' || key === 'w') {
        gravityRushState.controls.forward = false;
      }
      if (code === 'ArrowDown' || code === 'KeyS' || key === 'arrowdown' || key === 's') {
        gravityRushState.controls.back = false;
      }
      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'arrowleft' || key === 'a') {
        gravityRushState.controls.left = false;
      }
      if (code === 'ArrowRight' || code === 'KeyD' || key === 'arrowright' || key === 'd') {
        gravityRushState.controls.right = false;
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
