import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { COLORS, LEFT_BOUND, PLANE_SIZE, RIGHT_BOUND, WALL_RADIUS } from '../constants';
import { mutation, voidRunnerState } from '../state';

const Walls: React.FC = () => {
  const leftRef = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);
  const snap = useSnapshot(voidRunnerState);

  useFrame(() => {
    if (snap.phase !== 'playing') return;
    if (mutation.hitStop > 0) return;

    const playerZ = mutation.playerZ;

    if (leftRef.current) {
      leftRef.current.position.z = playerZ;
      (leftRef.current.material as THREE.MeshBasicMaterial).color.copy(mutation.globalColor);
    }
    if (rightRef.current) {
      rightRef.current.position.z = playerZ;
      (rightRef.current.material as THREE.MeshBasicMaterial).color.copy(mutation.globalColor);
    }
  });

  return (
    <>
      <mesh ref={leftRef} position={[LEFT_BOUND, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WALL_RADIUS, WALL_RADIUS, PLANE_SIZE * 2, 8, 1, true]} />
        <meshBasicMaterial color={COLORS[0].three} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={rightRef} position={[RIGHT_BOUND, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WALL_RADIUS, WALL_RADIUS, PLANE_SIZE * 2, 8, 1, true]} />
        <meshBasicMaterial color={COLORS[0].three} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
};

export default Walls;
