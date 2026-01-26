'use client';

import React from 'react';
import type { StarItem } from '../types';

export const StarMesh: React.FC<{ item: StarItem }> = ({ item }) => {
  return (
    <mesh position={item.pos} castShadow>
      <tetrahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial
        color="#111827"
        emissive="#111827"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
};
