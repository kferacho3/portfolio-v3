import * as THREE from 'three';

import { BALL_PHYSICS } from '../game/constants';

export type Projectile = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
};

export type FireVolleyArgs = {
  projectiles: Projectile[];
  projectileCursor: number;
  origin: THREE.Vector3;
  pointerX: number;
  pointerY: number;
  count: number;
  shotSpeed: number;
  shotTtl: number;
  cameraVelZ: number;
};

function makeShotDirection(pointerX: number, pointerY: number, spread = 0) {
  const dir = new THREE.Vector3(
    pointerX * 0.52 + spread,
    pointerY * 0.34 + spread * 0.18,
    -1
  );
  dir.normalize();
  return dir;
}

export function emitVolley({
  projectiles,
  projectileCursor,
  origin,
  pointerX,
  pointerY,
  count,
  shotSpeed,
  shotTtl,
  cameraVelZ,
}: FireVolleyArgs) {
  const spawnCount = Math.max(1, Math.min(5, count));
  let cursor = projectileCursor;
  const spreadCenter = (spawnCount - 1) * 0.5;

  for (let i = 0; i < spawnCount; i += 1) {
    const shot = projectiles[cursor % projectiles.length];
    cursor += 1;

    const spread = (i - spreadCenter) * 0.024;
    const dir = makeShotDirection(pointerX, pointerY, spread);

    shot.active = true;
    shot.life = shotTtl;
    shot.pos.copy(origin);
    shot.vel.copy(dir).multiplyScalar(shotSpeed * BALL_PHYSICS.restitution);
    shot.vel.z += cameraVelZ;
  }

  return cursor;
}
