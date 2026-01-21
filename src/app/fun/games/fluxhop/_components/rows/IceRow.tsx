import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { GROUND_Y, ICE_COLOR, ICE_GLOW, ROW_WIDTH, TILE_SIZE } from '../../constants';
import type { IceRowData } from '../../types';

const IceRow: React.FC<{ rowIndex: number; data: IceRowData }> = ({ rowIndex, data }) => {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const pulse = 0.25 + 0.15 * Math.sin(clock.elapsedTime * 2 + rowIndex);
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
  });

  return (
    <group position={[0, 0, rowIndex * TILE_SIZE]}>
      <mesh receiveShadow position={[0, GROUND_Y, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.2, TILE_SIZE]} />
        <meshStandardMaterial color={ICE_COLOR} roughness={0.1} metalness={0.3} />
      </mesh>
      <mesh ref={glowRef} position={[0, 0.05, 0]}>
        <boxGeometry args={[ROW_WIDTH + TILE_SIZE * 2, 0.04, TILE_SIZE * 0.96]} />
        <meshStandardMaterial color={ICE_GLOW} emissive={ICE_GLOW} emissiveIntensity={0.3} transparent opacity={0.6} />
      </mesh>
      {[-2, 0, 2].map((offset) => (
        <mesh key={offset} position={[offset * TILE_SIZE * 2, 0.08, 0]} rotation={[0, data.drift > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <coneGeometry args={[0.15, 0.3, 4]} />
          <meshStandardMaterial color={ICE_GLOW} emissive={ICE_GLOW} emissiveIntensity={0.5} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
};

export default IceRow;
