import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { NEON_CYAN, PLAYER_HEIGHT, TILE_SIZE } from '../constants';

const PlayerAvatar: React.FC<{
  playerRef: React.RefObject<THREE.Group>;
  bodyRef: React.RefObject<THREE.Mesh>;
}> = ({ playerRef, bodyRef }) => {
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.intensity = 0.6 + 0.3 * Math.sin(clock.elapsedTime * 3);
    }
  });

  return (
    <group ref={playerRef}>
      <mesh ref={bodyRef} position={[0, PLAYER_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[TILE_SIZE * 0.6, PLAYER_HEIGHT, TILE_SIZE * 0.5]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={NEON_CYAN}
          emissiveIntensity={0.3}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      <mesh
        position={[TILE_SIZE * 0.1, PLAYER_HEIGHT * 0.85, TILE_SIZE * 0.26]}
      >
        <boxGeometry args={[TILE_SIZE * 0.12, TILE_SIZE * 0.12, 0.04]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh
        position={[-TILE_SIZE * 0.1, PLAYER_HEIGHT * 0.85, TILE_SIZE * 0.26]}
      >
        <boxGeometry args={[TILE_SIZE * 0.12, TILE_SIZE * 0.12, 0.04]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <pointLight
        ref={glowRef}
        position={[0, 1.2, 0]}
        intensity={0.6}
        color={NEON_CYAN}
        distance={4}
      />
      <Sparkles
        count={16}
        scale={[1.2, 1.2, 1.2]}
        size={2.5}
        speed={0.5}
        color={NEON_CYAN}
      />
    </group>
  );
};

export default PlayerAvatar;
