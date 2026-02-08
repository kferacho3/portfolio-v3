import { useCallback, useRef, type RefObject } from 'react';
import type * as THREE from 'three';

type SquashAnim = {
  active: boolean;
  elapsedMs: number;
};

const SQUASH_MS = 120;
const REBOUND_MS = 80;
const TOTAL_MS = SQUASH_MS + REBOUND_MS;

export function useJellySquash() {
  const anim = useRef<SquashAnim>({ active: false, elapsedMs: 0 });

  const trigger = useCallback(() => {
    if (anim.current.active) return;
    anim.current.active = true;
    anim.current.elapsedMs = 0;
  }, []);

  const update = useCallback(
    (dt: number, playerRef: RefObject<THREE.Group>) => {
      if (!playerRef.current) return;

      if (!anim.current.active) {
        playerRef.current.scale.set(1, 1, 1);
        return;
      }

      anim.current.elapsedMs += dt * 1000;
      const t = Math.min(1, anim.current.elapsedMs / TOTAL_MS);

      if (anim.current.elapsedMs <= SQUASH_MS) {
        const p = anim.current.elapsedMs / SQUASH_MS;
        const squash = 1 - p * 0.4;
        const stretch = 1 + p * 0.3;
        playerRef.current.scale.set(stretch, squash, stretch);
      } else {
        const p = (anim.current.elapsedMs - SQUASH_MS) / REBOUND_MS;
        const rebound = 0.6 + p * 0.4;
        const reboundXZ = 1.3 - p * 0.3;
        playerRef.current.scale.set(reboundXZ, rebound, reboundXZ);
      }

      if (t >= 1) {
        anim.current.active = false;
        anim.current.elapsedMs = 0;
        playerRef.current.scale.set(1, 1, 1);
      }
    },
    []
  );

  return { trigger, update };
}
