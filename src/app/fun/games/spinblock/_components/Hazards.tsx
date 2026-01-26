import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import React, { useCallback, useRef, useState } from 'react';
import * as THREE from 'three';
import { spinBlockState } from '../state';
import type { SpinBlockBoardPreset } from '../types';

interface HazardProps {
  position: [number, number, number];
  onHit: () => void;
}

export const Spike: React.FC<HazardProps> = ({ position, onHit }) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      onCollisionEnter={onHit}
    >
      <CylinderCollider args={[0.3, 0.4]} />
      <group ref={meshRef}>
        {[0, 72, 144, 216, 288].map((angle, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((angle * Math.PI) / 180) * 0.2,
              0.2,
              Math.sin((angle * Math.PI) / 180) * 0.2,
            ]}
            rotation={[0, 0, Math.PI]}
          >
            <coneGeometry args={[0.15, 0.5, 4]} />
            <meshPhysicalMaterial
              color="#FF0000"
              emissive="#FF0000"
              emissiveIntensity={0.5}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.15, 16]} />
          <meshPhysicalMaterial
            color="#4a0000"
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
      </group>
      <pointLight color="#FF0000" intensity={0.6} distance={2} />
    </RigidBody>
  );
};

export const HazardZone: React.FC<
  HazardProps & { size?: [number, number] }
> = ({ position, onHit, size = [1.5, 1.5] }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
    }
  });

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      sensor
      onIntersectionEnter={onHit}
    >
      <CuboidCollider args={[size[0] / 2, 0.1, size[1] / 2]} sensor />
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      >
        <planeGeometry args={size} />
        <meshBasicMaterial
          color="#FF0000"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </RigidBody>
  );
};

export const Bumper: React.FC<{
  position: [number, number, number];
  color?: string;
  board: SpinBlockBoardPreset;
  onBumperHit?: () => void;
}> = ({ position, color = '#FF69B4', board, onBumperHit }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hit, setHit] = useState(false);
  const bodyRef = useRef<RapierRigidBody>(null);

  useFrame(() => {
    if (meshRef.current) {
      if (hit) {
        meshRef.current.scale.setScalar(1.3);
        setTimeout(() => setHit(false), 100);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

  const handleCollision = useCallback(
    (payload: unknown) => {
      setHit(true);
      spinBlockState.hitBumper();
      onBumperHit?.();

      const p = payload as {
        other?: { rigidBody?: RapierRigidBody | null };
      };
      const otherBody = p?.other?.rigidBody ?? null;
      const bumperBody = bodyRef.current;
      if (!otherBody || !bumperBody) return;

      const bp = bumperBody.translation();
      const op = otherBody.translation();
      const dir = new THREE.Vector3(op.x - bp.x, 0, op.z - bp.z);
      if (dir.lengthSq() < 1e-6) dir.set(0.0001, 0, 0);
      dir.normalize();

      otherBody.applyImpulse(
        {
          x: dir.x * board.bouncerHorizontalImpulse,
          y: board.bouncerUpImpulse,
          z: dir.z * board.bouncerHorizontalImpulse,
        },
        true
      );
    },
    [board.bouncerHorizontalImpulse, board.bouncerUpImpulse, onBumperHit]
  );

  return (
    <RigidBody
      ref={bodyRef}
      type="fixed"
      position={position}
      colliders={false}
      restitution={1.5}
      onCollisionEnter={handleCollision}
    >
      <CylinderCollider args={[0.4, 0.5]} restitution={1.5} />
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hit ? 0.8 : 0.3}
          metalness={0.4}
          roughness={0.3}
          clearcoat={0.5}
        />
      </mesh>
      <pointLight color={color} intensity={hit ? 1.5 : 0.5} distance={3} />
    </RigidBody>
  );
};
