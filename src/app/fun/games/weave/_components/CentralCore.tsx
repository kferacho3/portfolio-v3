import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { NEON_COLORS } from '../constants';

const CentralCore: React.FC<{ level: number; pulse: number }> = ({ level, pulse }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const color = NEON_COLORS[(level - 1) % NEON_COLORS.length];

  useFrame(({ clock }) => {
    if (meshRef.current && glowRef.current) {
      const t = clock.getElapsedTime();
      const scale = 0.4 + 0.05 * Math.sin(t * 3) + pulse * 0.1;
      meshRef.current.scale.setScalar(scale);
      meshRef.current.rotation.z = t * 0.5;
      meshRef.current.rotation.x = t * 0.3;
      glowRef.current.scale.setScalar(scale * 1.8);
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <dodecahedronGeometry args={[1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.BackSide} />
      </mesh>
      <pointLight color={color} intensity={2.5} distance={10} />
    </group>
  );
};

export default CentralCore;
