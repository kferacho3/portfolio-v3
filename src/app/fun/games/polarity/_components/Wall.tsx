'use client';

import { useBox } from '@react-three/cannon';
import React from 'react';

export const Wall: React.FC<{ position: [number, number, number]; size: [number, number, number] }> = ({ position, size }) => {
  const [ref] = useBox(() => ({
    type: 'Static',
    position,
    args: size,
  }));
  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial />
    </mesh>
  );
};
