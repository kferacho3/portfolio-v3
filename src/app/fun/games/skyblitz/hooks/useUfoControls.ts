import { useEffect } from 'react';
import { skyBlitzState } from '../state';

interface UfoControlsOptions {
  shootingRef: React.MutableRefObject<boolean>;
  tryShoot: (now: number) => void;
}

export const useUfoControls = ({ shootingRef, tryShoot }: UfoControlsOptions) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        shootingRef.current = true;
        tryShoot(performance.now());
      }
      if (e.key.toLowerCase() === 'r' && skyBlitzState.phase === 'gameover') {
        skyBlitzState.reset();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') shootingRef.current = false;
    };
    const onPointerDown = () => {
      shootingRef.current = true;
      tryShoot(performance.now());
    };
    const onPointerUp = () => {
      shootingRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onPointerUp);
    };
  }, [shootingRef, tryShoot]);
};
