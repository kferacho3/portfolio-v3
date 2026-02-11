import * as THREE from 'three';
import React from 'react';
import type { Particle } from '../types';

const ParticleEffect: React.FC<{ particles: Particle[] }> = ({ particles }) => (
  <>
    {particles.map((p) => (
      <group key={p.id} position={[p.x, p.y, p.z]}>
        <mesh rotation={[0, 0, p.spin * (1 - p.life)]}>
          <octahedronGeometry args={[p.size * (0.35 + p.life * 0.85)]} />
          <meshBasicMaterial
            color={p.color}
            transparent
            opacity={p.life * 0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[p.size * p.glow * (0.55 + p.life), 10, 10]} />
          <meshBasicMaterial
            color={p.color}
            transparent
            opacity={p.life * 0.24}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      </group>
    ))}
  </>
);

export default ParticleEffect;
