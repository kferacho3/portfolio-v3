import { CuboidCollider, RigidBody } from '@react-three/rapier';
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { WALL_THICKNESS } from '../constants';
import type { SpinBlockBoardPreset } from '../types';

const BoxArena: React.FC<{ board: SpinBlockBoardPreset }> = ({ board }) => {
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#1a1a2e',
        metalness: 0.2,
        roughness: 0.8,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  const floorMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0f0f1a',
        metalness: 0.1,
        roughness: 0.9,
      }),
    []
  );

  const halfSize = board.boxSize / 2;
  const halfWall = WALL_THICKNESS / 2;
  const wallHalfHeight = board.wallHeight / 2;

  return (
    <group>
      <RigidBody type="fixed" position={[0, -halfWall, 0]}>
        <CuboidCollider args={[halfSize, halfWall, halfSize]} restitution={0.3} friction={0.5} />
        <mesh material={floorMaterial} receiveShadow>
          <boxGeometry args={[board.boxSize, WALL_THICKNESS, board.boxSize]} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[board.boxSize - 0.5, board.boxSize - 0.5]} />
        <meshBasicMaterial color="#1a1a3a" transparent opacity={0.5} />
      </mesh>

      <RigidBody type="fixed" position={[0, wallHalfHeight, halfSize + halfWall]}>
        <CuboidCollider args={[halfSize + WALL_THICKNESS, wallHalfHeight, halfWall]} restitution={0.8} />
        <mesh material={wallMaterial}>
          <boxGeometry args={[board.boxSize + WALL_THICKNESS * 2, board.wallHeight, WALL_THICKNESS]} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[0, wallHalfHeight, -halfSize - halfWall]}>
        <CuboidCollider args={[halfSize + WALL_THICKNESS, wallHalfHeight, halfWall]} restitution={0.8} />
        <mesh material={wallMaterial}>
          <boxGeometry args={[board.boxSize + WALL_THICKNESS * 2, board.wallHeight, WALL_THICKNESS]} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[-halfSize - halfWall, wallHalfHeight, 0]}>
        <CuboidCollider args={[halfWall, wallHalfHeight, halfSize]} restitution={0.8} />
        <mesh material={wallMaterial}>
          <boxGeometry args={[WALL_THICKNESS, board.wallHeight, board.boxSize]} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[halfSize + halfWall, wallHalfHeight, 0]}>
        <CuboidCollider args={[halfWall, wallHalfHeight, halfSize]} restitution={0.8} />
        <mesh material={wallMaterial}>
          <boxGeometry args={[WALL_THICKNESS, board.wallHeight, board.boxSize]} />
        </mesh>
      </RigidBody>
    </group>
  );
};

export default BoxArena;
