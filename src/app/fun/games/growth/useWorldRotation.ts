import { useCallback, useRef, type RefObject } from 'react';
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
  rotateLeft: () => void;
  rotateRight: () => void;
  rotateInLastDirection: () => void;
  update: (nowMs: number, worldRef: RefObject<THREE.Group>) => void;
  reset: (worldRef: RefObject<THREE.Group>) => void;
  isRotating: () => boolean;
  getRotationIndex: () => number;
  getWorldRotation: () => number;
  getLastRotateAtMs: () => number;
};

export function useWorldRotation(): WorldRotationHook {
  const anim = useRef<RotationAnim | null>(null);
  const rotationIndexRef = useRef(0);
  const worldRotationRef = useRef(0);
  const lastDirectionRef = useRef<1 | -1>(1);
  const lastRotateAtRef = useRef(0);

  const startRotation = useCallback((direction: 1 | -1, nowMs: number) => {
    if (anim.current) return;
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
  }, []);

  const rotateLeft = useCallback(() => {
    startRotation(1, performance.now());
  }, [startRotation]);

  const rotateRight = useCallback(() => {
    startRotation(-1, performance.now());
  }, [startRotation]);

  const rotateInLastDirection = useCallback(() => {
    startRotation(lastDirectionRef.current, performance.now());
  }, [startRotation]);

  const update = useCallback((nowMs: number, worldRef: RefObject<THREE.Group>) => {
    const currentAnim = anim.current;
    if (!currentAnim) {
      if (worldRef.current) {
        worldRef.current.rotation.z = worldRotationRef.current;
      }
      return;
    }

    const duration = Math.max(1, currentAnim.durationMs);
    const t = Math.min(1, (nowMs - currentAnim.startMs) / duration);
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
    }
  }, []);

  const reset = useCallback((worldRef: RefObject<THREE.Group>) => {
    anim.current = null;
    rotationIndexRef.current = 0;
    worldRotationRef.current = 0;
    lastDirectionRef.current = 1;
    lastRotateAtRef.current = 0;
    if (worldRef.current) {
      worldRef.current.rotation.z = 0;
    }
  }, []);

  const isRotating = useCallback(() => anim.current != null, []);
  const getRotationIndex = useCallback(
    () => normalizeFaceIndex(rotationIndexRef.current),
    []
  );
  const getWorldRotation = useCallback(() => worldRotationRef.current, []);
  const getLastRotateAtMs = useCallback(() => lastRotateAtRef.current, []);

  return {
    rotateLeft,
    rotateRight,
    rotateInLastDirection,
    update,
    reset,
    isRotating,
    getRotationIndex,
    getWorldRotation,
    getLastRotateAtMs,
  };
}
