// @ts-nocheck
'use client';

import { usePlane } from '@react-three/cannon';
import React from 'react';
import { ARENA_SIZE } from '../constants';

export const Ground: React.FC = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -0.7, 0],
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
      <meshStandardMaterial color="#050814" />
    </mesh>
  );
};
