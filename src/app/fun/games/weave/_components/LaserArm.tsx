import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { ARM_GLOW, ARM_WIDTH, INNER_SAFE_RADIUS } from '../constants';
import type { LaserArm as LaserArmType } from '../types';

const LaserArm: React.FC<{ arm: LaserArmType }> = ({ arm }) => {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const t = clock.getElapsedTime();
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.12 + 0.04 * Math.sin(t * 8);
    }
  });

  const armLength = arm.length - INNER_SAFE_RADIUS;
  const armCenter = INNER_SAFE_RADIUS + armLength / 2;
  const visualWidth = ARM_WIDTH * 1.5;

  return (
    <group rotation={[0, 0, arm.angle]}>
      <mesh position={[armCenter, 0, 0]}>
        <boxGeometry args={[armLength, visualWidth, 0.04]} />
        <meshStandardMaterial
          color={arm.color}
          emissive={arm.color}
          emissiveIntensity={1.5}
        />
      </mesh>
      <mesh ref={glowRef} position={[armCenter, 0, -0.02]}>
        <boxGeometry args={[armLength, visualWidth * 3, 0.02]} />
        <meshBasicMaterial color={ARM_GLOW} transparent opacity={0.12} />
      </mesh>
      <mesh position={[INNER_SAFE_RADIUS, 0, 0]}>
        <circleGeometry args={[visualWidth, 12]} />
        <meshBasicMaterial color={arm.color} />
      </mesh>
      <mesh position={[arm.length, 0, 0]}>
        <circleGeometry args={[visualWidth, 12]} />
        <meshBasicMaterial color={arm.color} />
      </mesh>
    </group>
  );
};

export default LaserArm;
