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

export interface Wave {
  id: string;
  pos: Vec3;
  color: string;
  bornAt: number;
  life: number;
  maxScale: number;
}

export interface Flash {
  id: string;
  pos: Vec3;
  color: string;
  bornAt: number;
  life: number;
  intensity: number;
}

export const BurstFX: React.FC<{ burst: Burst }> = ({ burst }) => {
  const groupRef = useRef<THREE.Group>(null);

  const pieces = useMemo(() => {
    return Array.from({ length: burst.count }, (_, i) => {
      const a = (i / burst.count) * Math.PI * 2 + Math.random() * 0.6;
      const r = 0.35 + Math.random() * 0.75;
      const y = 0.15 + Math.random() * 0.68;
      return {
        x: Math.cos(a) * r,
        y,
        z: Math.sin(a) * r,
        s: 0.16 + Math.random() * 0.26,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst.id]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: burst.color,
      emissive: burst.color,
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.88,
      roughness: 0.2,
      metalness: 0.1,
    });
  }, [burst.color]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame(() => {
    const t = THREE.MathUtils.clamp((performance.now() / 1000 - burst.bornAt) / burst.life, 0, 1);
    const scale = THREE.MathUtils.lerp(1, 0.08, t);
    material.opacity = THREE.MathUtils.lerp(0.88, 0, t);
    material.emissiveIntensity = THREE.MathUtils.lerp(0.95, 0.15, t);
    if (groupRef.current) groupRef.current.scale.setScalar(scale);
  });

  const shape = burst.shape ?? 'spark';

  return (
    <group ref={groupRef} position={burst.pos as unknown as THREE.Vector3Tuple}>
      {pieces.map((p, i) => (
        <mesh key={`${burst.id}-${i}`} position={[p.x, p.y, p.z]} scale={[p.s, p.s, p.s]} material={material}>
          {shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
          {shape === 'tetra' && <tetrahedronGeometry args={[0.9, 0]} />}
          {shape === 'spark' && <sphereGeometry args={[0.58, 8, 8]} />}
        </mesh>
      ))}
    </group>
  );
};

export const WaveFX: React.FC<{ wave: Wave }> = ({ wave }) => {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!groupRef.current || !matRef.current) return;
    const t = THREE.MathUtils.clamp((performance.now() / 1000 - wave.bornAt) / wave.life, 0, 1);
    const s = THREE.MathUtils.lerp(0.2, wave.maxScale, t);
    groupRef.current.scale.setScalar(s);
    matRef.current.opacity = THREE.MathUtils.lerp(0.62, 0, t);
  });

  return (
    <group ref={groupRef} position={wave.pos as unknown as THREE.Vector3Tuple}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 1.1, 44]} />
        <meshBasicMaterial ref={matRef} color={wave.color} transparent opacity={0.62} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

export const FlashFX: React.FC<{ flash: Flash }> = ({ flash }) => {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const t = THREE.MathUtils.clamp((performance.now() / 1000 - flash.bornAt) / flash.life, 0, 1);
    lightRef.current.intensity = THREE.MathUtils.lerp(flash.intensity, 0, t);
  });

  return (
    <pointLight
      ref={lightRef}
      position={flash.pos as unknown as THREE.Vector3Tuple}
      color={flash.color}
      distance={6}
      intensity={flash.intensity}
    />
  );
};
