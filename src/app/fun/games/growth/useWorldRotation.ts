import { useCallback, useRef, useState, type RefObject } from 'react';
import type * as THREE from 'three';
import { QUARTER_TURN, ROTATION_MS } from './constants';
import { gameplayConfig } from './gameplayConfig';

const normalizeFaceIndex = (index: number) => ((index % 4) + 4) % 4;

const cubicEase = (t: number) => {
  const p = Math.max(0, Math.min(1, t));
  return p * p * (3 - 2 * p);
};

type RotationAnim = {
  startMs: number;
  durationMs: number;
  from: number;
  to: number;
};

type WorldRotationHook = {
  isRotating: boolean;
  rotationIndex: number;
  worldRotation: number;
  lastDirection: 1 | -1;
  lastRotateAtMs: number;
  rotateLeft: () => void;
  rotateRight: () => void;
  rotateInLastDirection: () => void;
  update: (nowMs: number, worldRef: RefObject<THREE.Group>) => void;
  reset: (worldRef: RefObject<THREE.Group>) => void;
};

export function useWorldRotation(): WorldRotationHook {
  const anim = useRef<RotationAnim | null>(null);
  const queue = useRef<(1 | -1)[]>([]);
  const rotationIndexRef = useRef(0);
  const worldRotationRef = useRef(0);
  const lastDirectionRef = useRef<1 | -1>(1);
  const lastRotateAtRef = useRef(0);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationIndex, setRotationIndex] = useState(0);

  const startRotation = useCallback((direction: 1 | -1, nowMs: number) => {
    rotationIndexRef.current += direction;
    const target = rotationIndexRef.current * QUARTER_TURN;
    anim.current = {
      startMs: nowMs,
      durationMs: gameplayConfig.rotationDurationMs ?? ROTATION_MS,
      from: worldRotationRef.current,
      to: target,
    };
    lastDirectionRef.current = direction;
    lastRotateAtRef.current = nowMs;
    setRotationIndex(rotationIndexRef.current);
    setIsRotating(true);
  }, []);

  const queueOrRotate = useCallback(
    (direction: 1 | -1) => {
      const nowMs = performance.now();
      if (anim.current) {
        if (queue.current.length < gameplayConfig.rotationQueueLimit) {
          queue.current.push(direction);
        } else {
          queue.current[queue.current.length - 1] = direction;
        }
        return;
      }
      startRotation(direction, nowMs);
    },
    [startRotation]
  );

  const rotateLeft = useCallback(() => queueOrRotate(1), [queueOrRotate]);
  const rotateRight = useCallback(() => queueOrRotate(-1), [queueOrRotate]);

  const rotateInLastDirection = useCallback(() => {
    queueOrRotate(lastDirectionRef.current);
  }, [queueOrRotate]);

  const update = useCallback(
    (nowMs: number, worldRef: RefObject<THREE.Group>) => {
      const currentAnim = anim.current;
      if (!currentAnim) {
        if (worldRef.current) {
          worldRef.current.rotation.z = worldRotationRef.current;
        }
        return;
      }

      const t = Math.min(
        1,
        (nowMs - currentAnim.startMs) / currentAnim.durationMs
      );
      const eased = cubicEase(t);
      const nextRotation =
        currentAnim.from + (currentAnim.to - currentAnim.from) * eased;
      worldRotationRef.current = nextRotation;

      if (worldRef.current) {
        worldRef.current.rotation.z = nextRotation;
      }

      if (t >= 1) {
        const snapped = rotationIndexRef.current * QUARTER_TURN;
        worldRotationRef.current = snapped;
        if (worldRef.current) {
          worldRef.current.rotation.z = snapped;
        }
        anim.current = null;
        setIsRotating(false);

        if (queue.current.length > 0) {
          const nextDir = queue.current.shift() as 1 | -1;
          startRotation(nextDir, nowMs);
        }
      }
    },
    [startRotation]
  );

  const reset = useCallback((worldRef: RefObject<THREE.Group>) => {
    anim.current = null;
    queue.current = [];
    rotationIndexRef.current = 0;
    worldRotationRef.current = 0;
    lastDirectionRef.current = 1;
    lastRotateAtRef.current = 0;
    setIsRotating(false);
    setRotationIndex(0);
    if (worldRef.current) {
      worldRef.current.rotation.z = 0;
    }
  }, []);

  return {
    isRotating,
    rotationIndex: normalizeFaceIndex(rotationIndex),
    worldRotation: worldRotationRef.current,
    lastDirection: lastDirectionRef.current,
    lastRotateAtMs: lastRotateAtRef.current,
    rotateLeft,
    rotateRight,
    rotateInLastDirection,
    update,
    reset,
  };
}
