'use client';

import React from 'react';
import { ARENA, HALF } from '../constants';

export const FactoryFrame: React.FC = () => {
  const railLen = ARENA + 2;
  return (
    <group position={[0, 0.25, 0]}>
      <mesh position={[0, 0, -HALF - 0.7]}>
        <boxGeometry args={[railLen, 0.2, 0.35]} />
        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0ea5e9"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0, 0, HALF + 0.7]}>
        <boxGeometry args={[railLen, 0.2, 0.35]} />
        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0ea5e9"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[-HALF - 0.7, 0, 0]}>
        <boxGeometry args={[0.35, 0.2, railLen]} />
        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0ea5e9"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[HALF + 0.7, 0, 0]}>
        <boxGeometry args={[0.35, 0.2, railLen]} />
        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0ea5e9"
          emissiveIntensity={0.25}
        />
      </mesh>
    </group>
  );
};
