import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HitEffect } from '../types';

interface HitParticlesProps {
  effects: HitEffect[];
}

const HitParticleEffect: React.FC<{ effect: HitEffect }> = ({ effect }) => {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.5,
      size: 0.08 + Math.random() * 0.1,
      offset: Math.random() * 0.2,
    }));
  }, []);

  useFrame((_, delta) => {
    particles.forEach((p, i) => {
      const mesh = meshRefs.current[i];
      if (mesh) {
        mesh.position.x += Math.cos(p.angle) * p.speed * delta * 3;
        mesh.position.y += Math.sin(p.angle) * p.speed * delta * 3;
        mesh.scale.multiplyScalar(0.95);
      }
    });
  });

  return (
    <group position={effect.position}>
      {particles.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          position={[Math.cos(p.angle) * p.offset, Math.sin(p.angle) * p.offset, 0]}
        >
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshBasicMaterial color={effect.color} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
};

const HitParticles: React.FC<HitParticlesProps> = ({ effects }) => {
  return (
    <>
      {effects.map((effect) => (
        <HitParticleEffect key={effect.id} effect={effect} />
      ))}
    </>
  );
};

export default HitParticles;
