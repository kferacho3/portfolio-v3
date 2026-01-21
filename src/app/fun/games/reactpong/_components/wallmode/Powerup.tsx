import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import type { PowerupType } from '../../types';

interface PowerupProps {
  type: PowerupType;
  position: readonly [number, number, number];
  onCollect: () => void;
}

const Powerup: React.FC<PowerupProps> = ({ type, position, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const getColor = () => {
    switch (type) {
      case 'slowmo':
        return '#00ffff';
      case 'widen':
        return '#ff00ff';
      case 'magnet':
        return '#ffff00';
      case 'shield':
        return '#00ff88';
      case 'curveBoost':
        return '#ff8800';
    }
  };

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime();
      meshRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 2) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} position={[position[0], position[1], position[2]]} onClick={onCollect}>
      <octahedronGeometry args={[0.4, 0]} />
      <meshStandardMaterial
        color={getColor()}
        emissive={getColor()}
        emissiveIntensity={0.8}
        metalness={0.5}
        roughness={0.2}
      />
      <pointLight color={getColor()} intensity={0.6} distance={4} />
    </mesh>
  );
};

export default Powerup;
