'use client';

import * as React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OscillateLevel } from '../types';
import { clamp } from '../helpers';

export const WallBar: React.FC<{
  side: -1 | 1;
  segIndex: number;
  lvlRef: React.MutableRefObject<OscillateLevel>;
  mats: Record<string, THREE.Material>;
  geoms: { unitBox: THREE.BoxGeometry };
  CONST: { BASE_H: number; WALL_H: number; WALL_T: number };
}> = ({ side, segIndex, lvlRef, mats, geoms, CONST }) => {
  const ref = React.useRef<THREE.Mesh>(null);

  useFrame(() => {
    const lvl = lvlRef.current;
    const seg = lvl.segments[segIndex];
    if (!ref.current || !seg) return;

    const idx = side === -1 ? 0 : 1;
    const broken = seg.wallBroken[idx];
    const hp01 = clamp(seg.wallHp[idx] / seg.wallMaxHp, 0, 1);
    const mat = broken ? mats.danger : hp01 < 0.34 ? mats.danger : mats.wall;
    (ref.current.material as THREE.Material) = mat;
    ref.current.visible = !broken || hp01 > 0.001;

    const wallY = CONST.BASE_H + CONST.WALL_H * 0.5;
    if (seg.axis === 'x') {
      const cx = seg.x + seg.dir * seg.length * 0.5;
      const cz = seg.z + side * (seg.halfWidth + CONST.WALL_T * 0.5);
      ref.current.position.set(cx, wallY, cz);
      ref.current.scale.set(seg.length, CONST.WALL_H, CONST.WALL_T);
    } else {
      const cx = seg.x + side * (seg.halfWidth + CONST.WALL_T * 0.5);
      const cz = seg.z + seg.dir * seg.length * 0.5;
      ref.current.position.set(cx, wallY, cz);
      ref.current.scale.set(CONST.WALL_T, CONST.WALL_H, seg.length);
    }

    // subtle "crack" feel
    ref.current.scale.y *= broken ? 0.35 : 0.75 + hp01 * 0.25;
  });

  return <mesh ref={ref} geometry={geoms.unitBox} material={mats.wall as any} castShadow />;
};
