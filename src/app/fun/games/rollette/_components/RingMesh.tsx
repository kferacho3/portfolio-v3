'use client';

import React from 'react';
import { Torus } from '@react-three/drei';
import type { RingItem } from '../types';

export const RingMesh: React.FC<{ item: RingItem }> = ({ item }) => {
  const colors: Record<RingItem['color'], { main: string; emissive: string }> =
    {
      gold: { main: '#facc15', emissive: '#f59e0b' },
      silver: { main: '#cbd5e1', emissive: '#94a3b8' },
      bronze: { main: '#cd7f32', emissive: '#92400e' },
    };
  const c = colors[item.color];
  return (
    <Torus
      args={[0.78, 0.16, 10, 20]}
      position={item.pos}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <meshStandardMaterial
        color={c.main}
        emissive={c.emissive}
        emissiveIntensity={0.55}
      />
    </Torus>
  );
};
