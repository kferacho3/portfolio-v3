'use client';

import React from 'react';
import { Tetrahedron } from '@react-three/drei';
import type { TetraItem } from '../types';

export const TetraMesh: React.FC<{ item: TetraItem }> = ({ item }) => {
  const c =
    item.type === 'green'
      ? '#22c55e'
      : item.type === 'blue'
        ? '#3b82f6'
        : '#a855f7';
  return (
    <Tetrahedron args={[0.75, 0]} position={item.pos}>
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} />
    </Tetrahedron>
  );
};
