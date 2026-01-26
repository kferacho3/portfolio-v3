'use client';

import React from 'react';
import type { Magnet } from '../types';
import { chargeColors } from './chargeColors';

export const MagnetPylon: React.FC<{ magnet: Magnet }> = ({ magnet }) => {
  const c = chargeColors[magnet.charge];
  return (
    <group position={[magnet.pos.x, magnet.pos.y, magnet.pos.z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.55, 0.75, 3.0, 12]} />
        <meshStandardMaterial color="#0b1226" metalness={0.2} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial color={c.main} emissive={c.emissive} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
};
