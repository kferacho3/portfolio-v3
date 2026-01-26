'use client';

import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import type { Ion } from '../types';
import { chargeColors } from './chargeColors';

export const IonMesh: React.FC<{ ion: Ion }> = ({ ion }) => {
  const c = chargeColors[ion.kind];
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const bob = Math.sin(t * 2 + ion.pos.x * 0.2 + ion.pos.z * 0.2) * 0.18;
    if (ref.current) ref.current.position.set(ion.pos.x, ion.pos.y + bob, ion.pos.z);
  });

  return (
    <mesh ref={ref} position={[ion.pos.x, ion.pos.y, ion.pos.z]} castShadow>
      <sphereGeometry args={[0.42, 14, 14]} />
      <meshStandardMaterial color={c.main} emissive={c.emissive} emissiveIntensity={0.55} />
    </mesh>
  );
};
