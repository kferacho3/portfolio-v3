'use client';

import React from 'react';
import type { SpringItem } from '../types';

export const SpringMesh: React.FC<{ item: SpringItem }> = ({ item }) => {
  const c = item.type === 'cyan' ? '#22d3ee' : '#facc15';
  return (
    <mesh position={item.pos} castShadow>
      <cylinderGeometry args={[0.55, 0.55, 1.2, 12]} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} />
    </mesh>
  );
};
