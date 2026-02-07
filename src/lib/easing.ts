import * as THREE from 'three';

type Vec3Tuple = readonly [number, number, number];

const dampScalar = (
  current: number,
  target: number,
  lambda: number,
  dt: number
) => THREE.MathUtils.damp(current, target, lambda, dt);

export const easing = {
  damp3: (v: THREE.Vector3, target: Vec3Tuple, lambda: number, dt: number) => {
    v.x = dampScalar(v.x, target[0], lambda, dt);
    v.y = dampScalar(v.y, target[1], lambda, dt);
    v.z = dampScalar(v.z, target[2], lambda, dt);
  },
  dampE: (e: THREE.Euler, target: Vec3Tuple, lambda: number, dt: number) => {
    e.x = dampScalar(e.x, target[0], lambda, dt);
    e.y = dampScalar(e.y, target[1], lambda, dt);
    e.z = dampScalar(e.z, target[2], lambda, dt);
  },
};
