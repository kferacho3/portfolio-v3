import * as THREE from 'three';
import { SeededRandom, stringToSeed } from '../../utils/seededRandom';
import { BG_CUBE_COUNT, BG_CUBE_SPREAD } from './constants';
import type { Arena, BackgroundCube } from './types';

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function keyFor(ix: number) {
  return `${ix}`;
}

export function hslToColor(h: number, s: number, l: number) {
  const c = new THREE.Color();
  c.setHSL(h, s, l);
  return c;
}

export function easingLerp(current: number, target: number, dt: number, lambda = 12) {
  const t = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * t;
}

export function getArena(index: number, arenas: Arena[]) {
  return arenas[index] ?? arenas[0];
}

export function buildBackgroundCubes(arenaId: string): BackgroundCube[] {
  const rng = new SeededRandom(stringToSeed(arenaId) + 19);
  return Array.from({ length: BG_CUBE_COUNT }, () => ({
    x: rng.float(-BG_CUBE_SPREAD, BG_CUBE_SPREAD),
    y: rng.float(2, 28),
    z: rng.float(-BG_CUBE_SPREAD, BG_CUBE_SPREAD),
    scale: rng.float(0.5, 1.8),
    rotationY: rng.float(0, Math.PI * 2),
    tint: rng.float(0.8, 1.2),
  }));
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}
