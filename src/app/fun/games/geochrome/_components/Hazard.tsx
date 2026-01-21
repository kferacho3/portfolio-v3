import { Icosahedron, Octahedron, Sphere, Torus } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { HAZARD_RADIUS, WORLD_RADIUS } from '../constants';
import type { Hazard } from '../types';
import { NeonGlowMaterial } from './Materials';

interface HazardComponentProps {
  hazard: Hazard;
  playerPosition: THREE.Vector3;
  onHit: () => void;
}

const HazardComponent: React.FC<HazardComponentProps> = ({ hazard, playerPosition, onHit }) => {
  const meshRef = useRef<THREE.Group>(null);
  const lastHitTime = useRef(0);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const t = clock.getElapsedTime();
    meshRef.current.rotation.x += 0.03;
    meshRef.current.rotation.y += 0.02;

    if (hazard.type === 'pulse') {
      const scale = 1 + Math.sin(t * 4) * 0.3;
      meshRef.current.scale.setScalar(scale);
    }

    const pos = meshRef.current.position;
    pos.add(hazard.velocity);

    pos.normalize().multiplyScalar(WORLD_RADIUS);

    if (Math.random() < 0.01) {
      hazard.velocity.set((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03);
    }

    if (playerPosition.distanceTo(pos) < HAZARD_RADIUS) {
      const now = t;
      if (now - lastHitTime.current > 1) {
        onHit();
        lastHitTime.current = now;
      }
    }
  });

  const renderHazard = () => {
    switch (hazard.type) {
      case 'spike':
        return (
          <Octahedron args={[1.5]}>
            <meshStandardMaterial color="#ff3366" emissive="#ff0044" emissiveIntensity={0.8} metalness={0.8} roughness={0.2} />
          </Octahedron>
        );
      case 'orb':
        return (
          <Sphere args={[1.2, 16, 16]}>
            <NeonGlowMaterial color="#330011" glowColor="#ff0044" />
          </Sphere>
        );
      case 'ring':
        return (
          <Torus args={[1.2, 0.4, 16, 32]}>
            <meshStandardMaterial color="#ff2200" emissive="#ff4400" emissiveIntensity={0.6} />
          </Torus>
        );
      case 'pulse':
        return (
          <Icosahedron args={[1]}>
            <meshStandardMaterial color="#ff0066" emissive="#ff0088" emissiveIntensity={1} transparent opacity={0.8} />
          </Icosahedron>
        );
      default:
        return null;
    }
  };

  return (
    <group ref={meshRef} position={hazard.position}>
      {renderHazard()}
      <pointLight color="#ff0044" intensity={1} distance={8} />
    </group>
  );
};

export default HazardComponent;
