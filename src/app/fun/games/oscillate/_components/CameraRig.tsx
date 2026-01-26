'use client';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OscillateLevel, RunStatus } from '../types';
import { ballWorldPos } from '../utils';

export const CameraRig: React.FC<{
  lvlRef: React.MutableRefObject<OscillateLevel>;
  run: React.MutableRefObject<RunStatus>;
}> = ({ lvlRef, run }) => {
  const { camera } = useThree();

  useFrame((_, dt) => {
    const lvl = lvlRef.current;
    const r = run.current;

    const p = ballWorldPos(lvl, r);
    const target = new THREE.Vector3(p.x, r.y, p.z);

    // Isometric-ish view.
    const desired = new THREE.Vector3(p.x + 6.2, 8.2, p.z + 6.4);
    camera.position.lerp(desired, 1 - Math.exp(-3.8 * dt));
    camera.lookAt(target);

    // camera shake
    if (r.shake > 0.001) {
      const s = r.shake;
      r.shake = Math.max(0, r.shake - dt * 2.6);
      camera.position.x += (Math.sin(r.t * 40.0) * 0.06 + (Math.random() - 0.5) * 0.04) * s;
      camera.position.y += (Math.cos(r.t * 33.0) * 0.04 + (Math.random() - 0.5) * 0.03) * s;
    }
  });

  return null;
};
