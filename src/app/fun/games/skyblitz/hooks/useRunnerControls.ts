import { useEffect } from 'react';
import { RUNNER_JUMP_VELOCITY } from '../constants';
import { skyBlitzState } from '../state';
import type { SkyBlitzPhase } from '../types';

interface RunnerControlsOptions {
  phase: SkyBlitzPhase;
  isJumpingRef: React.MutableRefObject<boolean>;
  velocityRef: React.MutableRefObject<number>;
}

export const useRunnerControls = ({
  phase,
  isJumpingRef,
  velocityRef,
}: RunnerControlsOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code === 'Space' &&
        !event.repeat &&
        !isJumpingRef.current &&
        phase === 'playing'
      ) {
        velocityRef.current = RUNNER_JUMP_VELOCITY;
        isJumpingRef.current = true;
      }
      if (event.key.toLowerCase() === 'r' && phase === 'gameover') {
        skyBlitzState.reset();
      }
    };
    const handlePointerDown = () => {
      if (!isJumpingRef.current && phase === 'playing') {
        velocityRef.current = RUNNER_JUMP_VELOCITY;
        isJumpingRef.current = true;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [phase, isJumpingRef, velocityRef]);
};
