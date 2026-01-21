import { Trail } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { PLAYER_ORBIT_RADIUS, PLAYER_SIZE } from '../constants';

const Player: React.FC<{
  angle: number;
  color: string;
  isHit: boolean;
  invincible: boolean;
}> = ({ angle, color, isHit, invincible }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const x = Math.cos(angle) * PLAYER_ORBIT_RADIUS;
  const y = Math.sin(angle) * PLAYER_ORBIT_RADIUS;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.z = t * 4;
      meshRef.current.rotation.x = t * 3;

      if (invincible) {
        meshRef.current.visible = Math.floor(t * 10) % 2 === 0;
      } else {
        meshRef.current.visible = true;
      }
    }
  });

  const displayColor = isHit ? '#ff0000' : color;

  return (
    <group position={[x, y, 0]}>
      <Trail width={0.4} length={6} color={color} attenuation={(t) => t * t}>
        <mesh ref={meshRef}>
          <octahedronGeometry args={[PLAYER_SIZE]} />
          <meshStandardMaterial color={displayColor} emissive={displayColor} emissiveIntensity={isHit ? 1.5 : 0.8} />
        </mesh>
      </Trail>
      <pointLight color={color} intensity={1.2} distance={2.5} />
    </group>
  );
};

export default Player;
