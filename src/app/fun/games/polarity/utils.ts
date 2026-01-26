import * as THREE from 'three';
import type { PolarityCharge } from './state';
import type { Spike } from './types';
import { ARENA_SIZE, HALF } from './constants';

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const randRange = (min: number, max: number) => min + Math.random() * (max - min);

export const randSign = (): PolarityCharge => (Math.random() < 0.5 ? -1 : 1);

export const randomInArena = (y: number): THREE.Vector3 =>
  new THREE.Vector3((Math.random() * ARENA_SIZE - HALF) * 0.95, y, (Math.random() * ARENA_SIZE - HALF) * 0.95);

export const insideArena = (x: number, z: number, margin: number = 3) =>
  x > -HALF + margin && x < HALF - margin && z > -HALF + margin && z < HALF - margin;

export const farFromSpikes = (pos: THREE.Vector3, spikes: Spike[], minDist: number) => {
  for (let i = 0; i < spikes.length; i++) {
    if (spikes[i].pos.distanceTo(pos) < minDist) return false;
  }
  return true;
};

export function spawnAroundPlayer(
  player: THREE.Vector3,
  y: number,
  opts: { minDist: number; maxDist: number; attempts?: number } = { minDist: 8, maxDist: 26, attempts: 18 }
): THREE.Vector3 {
  const attempts = opts.attempts ?? 18;
  for (let i = 0; i < attempts; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = opts.minDist + Math.random() * (opts.maxDist - opts.minDist);
    const x = player.x + Math.cos(a) * r;
    const z = player.z + Math.sin(a) * r;
    if (x > -HALF + 3 && x < HALF - 3 && z > -HALF + 3 && z < HALF - 3) return new THREE.Vector3(x, y, z);
  }
  return randomInArena(y);
}

export function spawnIonAhead(player: THREE.Vector3, forward: THREE.Vector3, spikes: Spike[]): THREE.Vector3 {
  const dir = forward.clone();
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
  dir.normalize();

  for (let i = 0; i < 30; i++) {
    const angle = (Math.random() * 2 - 1) * (Math.PI / 3); // ±60deg
    const r = randRange(7, 24);
    const rotated = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const x = player.x + rotated.x * r;
    const z = player.z + rotated.z * r;
    if (!insideArena(x, z, 3)) continue;
    const pos = new THREE.Vector3(x, 0.9, z);
    if (!farFromSpikes(pos, spikes, 3.2)) continue;
    return pos;
  }
  return randomInArena(0.9);
}
