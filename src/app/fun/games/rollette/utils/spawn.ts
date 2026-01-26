import * as THREE from 'three';
import { ARENA_HALF } from '../constants';
import type { Vec3 } from '../types';

export interface SpawnAvoid {
  center: Vec3;
  radius: number;
}

export interface SpawnOptions {
  arenaHalf?: number;
  minDist: number;
  maxDist: number;
  y?: number;
  avoid?: SpawnAvoid[];
  preferDir?: THREE.Vector3; // world-space (x,z used)
  biasTowardPreferDir?: number; // 0..1
}

const tmpV = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

const randBetween = (a: number, b: number) => a + Math.random() * (b - a);

function randomDonutRadius(min: number, max: number) {
  // area-uniform in annulus: r = sqrt(u*(max^2-min^2)+min^2)
  const u = Math.random();
  const r2 = u * (max * max - min * min) + min * min;
  return Math.sqrt(r2);
}

export function clampToArena(pos: Vec3, arenaHalf = ARENA_HALF): Vec3 {
  const limit = arenaHalf - 2;
  return [
    THREE.MathUtils.clamp(pos[0], -limit, limit),
    pos[1],
    THREE.MathUtils.clamp(pos[2], -limit, limit),
  ];
}

export function pickSpawnPoint(playerPos: Vec3, opts: SpawnOptions): Vec3 {
  const arenaHalf = opts.arenaHalf ?? ARENA_HALF;
  const y = opts.y ?? 0.55;
  const avoid = opts.avoid ?? [];

  const attempts = 18;
  const bias = THREE.MathUtils.clamp(opts.biasTowardPreferDir ?? 0.6, 0, 1);

  tmpV.set(playerPos[0], 0, playerPos[2]);
  const prefer = opts.preferDir ? tmpDir.copy(opts.preferDir).setY(0) : null;
  if (prefer && prefer.lengthSq() > 1e-5) prefer.normalize();

  for (let i = 0; i < attempts; i++) {
    const usePrefer = prefer && Math.random() < bias;
    let angle: number;
    if (usePrefer && prefer) {
      const base = Math.atan2(prefer.z, prefer.x);
      angle = base + randBetween(-Math.PI / 3, Math.PI / 3);
    } else {
      angle = Math.random() * Math.PI * 2;
    }
    const r = randomDonutRadius(opts.minDist, opts.maxDist);
    const x = playerPos[0] + Math.cos(angle) * r;
    const z = playerPos[2] + Math.sin(angle) * r;
    const candidate: Vec3 = [x, y, z];

    const limit = arenaHalf - 2;
    if (Math.abs(x) > limit || Math.abs(z) > limit) continue;

    const dxp = x - playerPos[0];
    const dzp = z - playerPos[2];
    if (dxp * dxp + dzp * dzp < opts.minDist * opts.minDist) continue;

    let ok = true;
    for (const a of avoid) {
      const dx = x - a.center[0];
      const dz = z - a.center[2];
      const rr = (a.radius + 1.2) * (a.radius + 1.2);
      if (dx * dx + dz * dz < rr) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    return candidate;
  }

  // fallback: random inside arena
  const limit = arenaHalf - 3;
  return [randBetween(-limit, limit), y, randBetween(-limit, limit)];
}
