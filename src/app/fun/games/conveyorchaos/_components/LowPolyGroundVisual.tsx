'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA } from '../constants';

export const LowPolyGroundVisual: React.FC<{ tint: string }> = ({ tint }) => {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(ARENA, ARENA, 20, 20);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ridge = Math.sin(x * 0.22) * Math.cos(z * 0.2) * 0.12;
      const bowl = -Math.hypot(x, z) / (ARENA * 0.7) * 0.5;
      pos.setY(i, -0.03 + ridge + bowl);
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
