import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Vec3 } from '../types';

export type BurstShape = 'box' | 'tetra' | 'spark';

export interface Burst {
  id: string;
  pos: Vec3;
  color: string;
  bornAt: number;
  life: number;
  count: number;
  shape?: BurstShape;
}

export const BurstFX: React.FC<{ burst: Burst }> = ({ burst }) => {
  const groupRef = useRef<THREE.Group>(null);

  const parts = useMemo(() => {
    return Array.from({ length: burst.count }, (_, i) => {
      const a = (i / burst.count) * Math.PI * 2 + Math.random() * 0.6;
      const r = 0.35 + Math.random() * 0.75;
      const y = 0.15 + Math.random() * 0.65;
      return {
        x: Math.cos(a) * r,
        y,
        z: Math.sin(a) * r,
        s: 0.18 + Math.random() * 0.22,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst.id]);

  const shape = burst.shape ?? 'spark';

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: burst.color,
      emissive: burst.color,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.85,
    });
    return m;
  }, [burst.color]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame(() => {
    const now = performance.now() / 1000;
    const t = THREE.MathUtils.clamp((now - burst.bornAt) / burst.life, 0, 1);
    const scale = THREE.MathUtils.lerp(1, 0.1, t);
    const opacity = THREE.MathUtils.lerp(0.85, 0, t);

    if (groupRef.current) groupRef.current.scale.set(scale, scale, scale);
    material.opacity = opacity;
    material.emissiveIntensity = THREE.MathUtils.lerp(0.9, 0.2, t);
  });

  return (
    <group ref={groupRef} position={burst.pos as unknown as THREE.Vector3Tuple}>
      {parts.map((p, i) => (
        <mesh
          key={`${burst.id}-${i}`}
          position={[p.x, p.y, p.z]}
          scale={[p.s, p.s, p.s]}
          material={material}
        >
          {shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
          {shape === 'tetra' && <tetrahedronGeometry args={[0.9, 0]} />}
          {shape === 'spark' && <sphereGeometry args={[0.6, 8, 8]} />}
        </mesh>
      ))}
    </group>
  );
};
