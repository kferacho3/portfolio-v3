import { useFrame } from '@react-three/fiber';
import { BallCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import React, { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PowerUpType } from '../types';

interface CollectibleProps {
  position: [number, number, number];
  onCollect: () => void;
}

export const Coin: React.FC<CollectibleProps> = ({ position, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const collectedRef = useRef(false);

  useFrame((_, delta) => {
    if (meshRef.current && !collectedRef.current) {
      meshRef.current.rotation.y += delta * 3;
    }
  });

  const handleCollision = useCallback(() => {
    if (!collectedRef.current) {
      collectedRef.current = true;
      onCollect();
    }
  }, [onCollect]);

  if (collectedRef.current) return null;

  return (
    <RigidBody type="fixed" position={position} colliders={false} sensor onIntersectionEnter={handleCollision}>
      <CylinderCollider args={[0.1, 0.3]} sensor />
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
        <meshPhysicalMaterial
          color="#FFD700"
          metalness={0.9}
          roughness={0.1}
          emissive="#FFD700"
          emissiveIntensity={0.3}
        />
      </mesh>
      <pointLight color="#FFD700" intensity={0.5} distance={2} />
    </RigidBody>
  );
};

export const Gem: React.FC<CollectibleProps> = ({ position, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const collectedRef = useRef(false);

  useFrame((state) => {
    if (meshRef.current && !collectedRef.current) {
      meshRef.current.rotation.y += 0.02;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  const handleCollision = useCallback(() => {
    if (!collectedRef.current) {
      collectedRef.current = true;
      onCollect();
    }
  }, [onCollect]);

  if (collectedRef.current) return null;

  return (
    <RigidBody type="fixed" position={position} colliders={false} sensor onIntersectionEnter={handleCollision}>
      <BallCollider args={[0.35]} sensor />
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.35]} />
        <meshPhysicalMaterial
          color="#00FFFF"
          metalness={0.1}
          roughness={0}
          transmission={0.6}
          thickness={0.5}
          emissive="#00FFFF"
          emissiveIntensity={0.4}
        />
      </mesh>
      <pointLight color="#00FFFF" intensity={0.8} distance={3} />
    </RigidBody>
  );
};

interface PowerUpProps {
  position: [number, number, number];
  type: PowerUpType;
  onCollect: (type: PowerUpType) => void;
}

export const PowerUp: React.FC<PowerUpProps> = ({ position, type, onCollect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const collectedRef = useRef(false);

  const config = useMemo(() => {
    switch (type) {
      case 'multiplier':
        return { color: '#32CD32', emissive: '#00FF00', shape: 'dodecahedron' } as const;
      case 'shield':
        return { color: '#4169E1', emissive: '#1E90FF', shape: 'icosahedron' } as const;
      case 'slowTime':
        return { color: '#00CED1', emissive: '#00FFFF', shape: 'torus' } as const;
      case 'heart':
        return { color: '#FF69B4', emissive: '#FF1493', shape: 'sphere' } as const;
      default:
        return { color: '#FFFFFF', emissive: '#FFFFFF', shape: 'sphere' } as const;
    }
  }, [type]);

  useFrame((state) => {
    if (meshRef.current && !collectedRef.current) {
      meshRef.current.rotation.y += 0.03;
      meshRef.current.rotation.x += 0.01;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    }
  });

  const handleCollision = useCallback(() => {
    if (!collectedRef.current) {
      collectedRef.current = true;
      onCollect(type);
    }
  }, [onCollect, type]);

  if (collectedRef.current) return null;

  return (
    <RigidBody type="fixed" position={position} colliders={false} sensor onIntersectionEnter={handleCollision}>
      <BallCollider args={[0.4]} sensor />
      <mesh ref={meshRef}>
        {config.shape === 'dodecahedron' && <dodecahedronGeometry args={[0.35]} />}
        {config.shape === 'icosahedron' && <icosahedronGeometry args={[0.35]} />}
        {config.shape === 'torus' && <torusGeometry args={[0.25, 0.1, 8, 16]} />}
        {config.shape === 'sphere' && <sphereGeometry args={[0.3, 16, 16]} />}
        <meshPhysicalMaterial
          color={config.color}
          emissive={config.emissive}
          emissiveIntensity={0.5}
          metalness={0.3}
          roughness={0.2}
          clearcoat={0.8}
        />
      </mesh>
      <pointLight color={config.emissive} intensity={1} distance={3} />
    </RigidBody>
  );
};
