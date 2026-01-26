'use client';

import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { FLOOR_Y } from '../constants';
import { rolletteState } from '../state';

export const ZoneVisual: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const c = rolletteState.zoneCenter;
    const r = rolletteState.zoneRadius;
    g.position.set(c[0], FLOOR_Y + 0.02, c[2]);
    g.scale.set(r, 1, r);
    if (glowRef.current) {
      glowRef.current.distance = r * 2.2;
      glowRef.current.intensity = 0.85;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.86, 1, 48]} />
        <meshStandardMaterial
          color="#34d399"
          emissive="#34d399"
          emissiveIntensity={0.6}
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1, 1.08, 48]} />
        <meshStandardMaterial
          color="#34d399"
          emissive="#34d399"
          emissiveIntensity={0.95}
          transparent
          opacity={0.18}
        />
      </mesh>
      <pointLight
        ref={glowRef}
        color="#34d399"
        intensity={0.85}
        distance={40}
      />
    </group>
  );
};
