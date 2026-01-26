import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import {
  BONUS_ORB_COLOR,
  ORB_COLOR,
  ORB_GLOW,
  ORB_LIFETIME,
  ORB_SIZE,
} from '../constants';
import type { Orb as OrbType } from '../types';

const Orb: React.FC<{ orb: OrbType; currentTime: number }> = ({
  orb,
  currentTime,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const x = Math.cos(orb.angle) * orb.radius;
  const y = Math.sin(orb.angle) * orb.radius;

  const age = currentTime - orb.spawnTime;
  const fadeStart = ORB_LIFETIME - 1.0;
  const opacity = age > fadeStart ? 1 - (age - fadeStart) / 1.0 : 1;
  const color = orb.isBonus ? BONUS_ORB_COLOR : ORB_COLOR;
  const glow = orb.isBonus ? BONUS_ORB_COLOR : ORB_GLOW;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.z = t * 3;
      meshRef.current.rotation.y = t * 2;
      const pulse = 1 + 0.15 * Math.sin(t * 5 + orb.angle);
      meshRef.current.scale.setScalar(pulse);
    }
  });

  if (orb.collected) return null;

  return (
    <group position={[x, y, 0]}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[ORB_SIZE]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh scale={[1.8, 1.8, 1.8]}>
        <sphereGeometry args={[ORB_SIZE, 16, 16]} />
        <meshBasicMaterial color={glow} transparent opacity={opacity * 0.2} />
      </mesh>
      <pointLight color={color} intensity={0.8 * opacity} distance={1.5} />
    </group>
  );
};

export default Orb;
