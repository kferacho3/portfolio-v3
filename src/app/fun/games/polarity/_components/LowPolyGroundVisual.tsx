'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA_SIZE } from '../constants';

export const LowPolyGroundVisual: React.FC<{ tint: string }> = ({ tint }) => {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 22, 22);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z) / (ARENA_SIZE * 0.6);
      const wobble = Math.sin(x * 0.18) * Math.cos(z * 0.16) * 0.18;
      const bowl = -r * r * 0.38;
      pos.setY(i, -0.58 + wobble + bowl);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial color={tint} roughness={0.95} metalness={0.05} flatShading />
    </mesh>
  );
};
