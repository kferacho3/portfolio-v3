import { useEffect } from 'react';
import { skyBlitzState } from '../state';
import type { SkyBlitzPhase } from '../types';

interface RunnerControlsOptions {
  phase: SkyBlitzPhase;
  isJumpingRef: React.MutableRefObject<boolean>;
  velocityRef: React.MutableRefObject<number>;
}

export const useRunnerControls = ({ phase, isJumpingRef, velocityRef }: RunnerControlsOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isJumpingRef.current && phase === 'playing') {
        velocityRef.current = 7;
        isJumpingRef.current = true;
      }
      if (event.key.toLowerCase() === 'r' && phase === 'gameover') {
        skyBlitzState.reset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, isJumpingRef, velocityRef]);
};
