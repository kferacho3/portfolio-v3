'use client';

import React from 'react';
import type { PyramidItem } from '../types';

export const PyramidMesh: React.FC<{ item: PyramidItem }> = ({ item }) => {
  const map: Record<PyramidItem['type'], { color: string; emissive: string }> =
    {
      brown: { color: '#7c2d12', emissive: '#451a03' },
      darkred: { color: '#7f1d1d', emissive: '#3f0a0a' },
      red: { color: '#ef4444', emissive: '#7f1d1d' },
      black: { color: '#0b0b12', emissive: '#111827' },
    };
  const c = map[item.type];
  return (
    <mesh position={item.pos} castShadow>
      <coneGeometry args={[0.85, 1.65, 6]} />
      <meshStandardMaterial
        color={c.color}
        emissive={c.emissive}
        emissiveIntensity={0.35}
      />
    </mesh>
  );
};
