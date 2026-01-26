'use client';

import React from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { ARENA_SIZE, ARENA_HALF, FLOOR_Y } from '../constants';

export const Arena: React.FC = () => {
  const wallThickness = 1.2;
  const wallHeight = 6;

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[ARENA_SIZE / 2, 0.1, ARENA_SIZE / 2]} position={[0, FLOOR_Y - 0.1, 0]} friction={1.2} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, FLOOR_Y, 0]}>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE, 1, 1]} />
        <meshStandardMaterial color="#06101a" />
      </mesh>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[ARENA_SIZE / 2 + wallThickness, wallHeight, wallThickness]} position={[0, wallHeight, -ARENA_HALF - wallThickness]} />
        <CuboidCollider args={[ARENA_SIZE / 2 + wallThickness, wallHeight, wallThickness]} position={[0, wallHeight, ARENA_HALF + wallThickness]} />
        <CuboidCollider args={[wallThickness, wallHeight, ARENA_SIZE / 2 + wallThickness]} position={[-ARENA_HALF - wallThickness, wallHeight, 0]} />
        <CuboidCollider args={[wallThickness, wallHeight, ARENA_SIZE / 2 + wallThickness]} position={[ARENA_HALF + wallThickness, wallHeight, 0]} />
      </RigidBody>
      <mesh position={[0, 0.3, -ARENA_HALF - wallThickness]} castShadow>
        <boxGeometry args={[ARENA_SIZE + wallThickness * 2, 0.6, wallThickness * 2]} />
        <meshStandardMaterial color="#0b1220" emissive="#0b1220" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.3, ARENA_HALF + wallThickness]} castShadow>
        <boxGeometry args={[ARENA_SIZE + wallThickness * 2, 0.6, wallThickness * 2]} />
        <meshStandardMaterial color="#0b1220" emissive="#0b1220" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[-ARENA_HALF - wallThickness, 0.3, 0]} castShadow>
        <boxGeometry args={[wallThickness * 2, 0.6, ARENA_SIZE + wallThickness * 2]} />
        <meshStandardMaterial color="#0b1220" emissive="#0b1220" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[ARENA_HALF + wallThickness, 0.3, 0]} castShadow>
        <boxGeometry args={[wallThickness * 2, 0.6, ARENA_SIZE + wallThickness * 2]} />
        <meshStandardMaterial color="#0b1220" emissive="#0b1220" emissiveIntensity={0.25} />
      </mesh>
    </>
  );
};
