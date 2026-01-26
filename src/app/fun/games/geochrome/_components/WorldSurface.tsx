import { Sphere } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { WORLD_RADIUS } from '../constants';

const WorldSurface: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0002;
    }
  });

  return (
    <group>
      <Sphere ref={meshRef} args={[WORLD_RADIUS - 0.5, 128, 128]}>
        <meshStandardMaterial
          color="#0a0a1a"
          metalness={0.2}
          roughness={0.8}
          side={THREE.BackSide}
        />
      </Sphere>

      <Sphere args={[WORLD_RADIUS - 0.3, 48, 48]}>
        <meshBasicMaterial
          color="#1a1a3a"
          wireframe
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </Sphere>

      <Sphere args={[WORLD_RADIUS - 2, 32, 32]}>
        <meshBasicMaterial
          color="#0f0f2f"
          transparent
          opacity={0.5}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  );
};

export default WorldSurface;
