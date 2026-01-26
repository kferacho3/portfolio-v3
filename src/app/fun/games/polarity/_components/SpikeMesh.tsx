'use client';

import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import type { Spike } from '../types';

export const SpikeMesh: React.FC<{ spike: Spike }> = ({ spike }) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const wobble = Math.sin(t * 1.6 + spike.pos.x * 0.1) * 0.12;
    if (ref.current) ref.current.rotation.set(0, wobble, 0);
  });

  return (
    <mesh
      ref={ref}
      position={[spike.pos.x, spike.pos.y, spike.pos.z]}
      castShadow
    >
      <coneGeometry args={[0.85, 2.1, 8]} />
      <meshStandardMaterial
        color="#ef4444"
        emissive="#7f1d1d"
        emissiveIntensity={0.35}
      />
    </mesh>
  );
};
