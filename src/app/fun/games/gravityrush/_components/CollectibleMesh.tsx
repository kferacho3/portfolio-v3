import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import type { Collectible, Theme } from '../types';

const CollectibleMesh: React.FC<{ collectible: Collectible; theme: Theme }> = ({ collectible }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;

    meshRef.current.visible = !collectible.collected;
    if (collectible.collected) return;

    const bob = Math.sin(state.clock.elapsedTime * 3 + collectible.z * 0.1) * 0.2;
    meshRef.current.position.y = collectible.y + bob;
    meshRef.current.rotation.y += 0.02;
  });

  let color = '#ffcc00';
  let size = 0.3;

  if (collectible.type === 'gem') {
    color = '#ff00ff';
    size = 0.4;
  } else if (collectible.type === 'powerup') {
    color =
      collectible.powerupType === 'shield'
        ? '#00ff88'
        : collectible.powerupType === 'speed'
          ? '#ff8800'
          : '#ffff00';
    size = 0.5;
  }

  return (
    <mesh ref={meshRef} position={[collectible.x, collectible.y, -collectible.z]}>
      {collectible.type === 'coin' ? (
        <cylinderGeometry args={[size, size, 0.1, 16]} />
      ) : collectible.type === 'gem' ? (
        <octahedronGeometry args={[size]} />
      ) : (
        <dodecahedronGeometry args={[size]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        metalness={0.8}
        roughness={0.2}
      />
      <pointLight color={color} intensity={0.5} distance={3} />
    </mesh>
  );
};

export default CollectibleMesh;
