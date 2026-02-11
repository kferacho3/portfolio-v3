import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import {
  BONUS_ORB_COLOR,
  ORB_COLLECT_RADIUS,
  ORB_COLOR,
  ORB_GLOW,
  ORB_LIFETIME,
  ORB_SIZE,
} from '../constants';
import type { Orb as OrbType } from '../types';

const Orb: React.FC<{
  orb: OrbType;
  currentTime: number;
  playerX: number;
  playerY: number;
}> = ({
  orb,
  currentTime,
  playerX,
  playerY,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const satellitesRef = useRef<THREE.Group>(null);
  const x = Math.cos(orb.angle) * orb.radius;
  const y = Math.sin(orb.angle) * orb.radius;

  const age = currentTime - orb.spawnTime;
  const fadeStart = ORB_LIFETIME - 1.0;
  const opacity = age > fadeStart ? 1 - (age - fadeStart) / 1.0 : 1;
  const distToPlayer = Math.hypot(playerX - x, playerY - y);
  const proximity = THREE.MathUtils.clamp(
    1 - distToPlayer / (ORB_COLLECT_RADIUS * 2.5),
    0,
    1
  );
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
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.rotation.z = Math.sin(t * 0.8 + orb.angle) * 0.05;
    }
    if (haloRef.current) {
      const t = clock.getElapsedTime();
      const pulse = 1 + Math.sin(t * 7 + orb.angle) * 0.08;
      haloRef.current.scale.set(pulse, pulse, 1);
    }
    if (satellitesRef.current) {
      const t = clock.getElapsedTime();
      satellitesRef.current.rotation.z = t * (orb.isBonus ? 3.4 : 2.4);
    }
  });

  if (orb.collected) return null;

  return (
    <group ref={groupRef} position={[x, y, 0.08]}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[ORB_SIZE]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.15 + proximity * 0.55}
          metalness={0.25}
          roughness={0.15}
          transmission={0.08}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh ref={haloRef} scale={[2.2, 2.2, 1]}>
        <ringGeometry args={[ORB_SIZE * 1.4, ORB_SIZE * 2.5, 28]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={opacity * (0.18 + proximity * 0.22)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={[1.95, 1.95, 1.95]}>
        <sphereGeometry args={[ORB_SIZE, 18, 18]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={opacity * (0.18 + proximity * 0.12)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <ringGeometry
          args={[
            ORB_COLLECT_RADIUS * 0.72,
            ORB_COLLECT_RADIUS * 0.82,
            40,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * (0.06 + proximity * 0.24)}
          depthWrite={false}
        />
      </mesh>
      <group ref={satellitesRef}>
        <mesh position={[ORB_SIZE * 1.45, 0, 0.01]}>
          <sphereGeometry args={[ORB_SIZE * 0.22, 8, 8]} />
          <meshBasicMaterial
            color={glow}
            transparent
            opacity={opacity * 0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[-ORB_SIZE * 1.45, 0, 0.01]}>
          <sphereGeometry args={[ORB_SIZE * 0.17, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity * 0.62}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
      <pointLight
        color={color}
        intensity={(orb.isBonus ? 1.6 : 1.1) * opacity}
        distance={2.6}
      />
    </group>
  );
};

export default Orb;
