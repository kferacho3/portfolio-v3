// @ts-nocheck
'use client';

import * as React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OscillateLevel } from '../types';

export const GemMesh: React.FC<{
  segIndex: number;
  gemIndex: number;
  lvlRef: React.MutableRefObject<OscillateLevel>;
  mats: Record<string, THREE.Material>;
  geoms: { gem: THREE.OctahedronGeometry };
  y: number;
}> = ({ segIndex, gemIndex, lvlRef, mats, geoms, y }) => {
  const ref = React.useRef<THREE.Mesh>(null);
  const rot = React.useRef(Math.random() * Math.PI * 2);

  useFrame((_, dt) => {
    const lvl = lvlRef.current;
    const seg = lvl.segments[segIndex];
    const g = seg?.gems[gemIndex];
    if (!ref.current || !seg || !g) return;

    ref.current.visible = !g.collected;
    rot.current += dt * 1.8;
    ref.current.rotation.set(0.45, rot.current, 0);

    if (seg.axis === 'x') {
      ref.current.position.set(seg.x + seg.dir * g.s, y, seg.z + g.l);
    } else {
      ref.current.position.set(seg.x + g.l, y, seg.z + seg.dir * g.s);
    }
  });

  return (
    <mesh
      ref={ref}
      geometry={geoms.gem}
      material={mats.gem as any}
      castShadow
    />
  );
};
