import React from 'react';
import type { Particle } from '../types';

const ParticleEffect: React.FC<{ particles: Particle[] }> = ({ particles }) => (
  <>
    {particles.map((p) => (
      <mesh key={p.id} position={[p.x, p.y, 0]} scale={p.size * p.life}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={p.color} transparent opacity={p.life * 0.8} />
      </mesh>
    ))}
  </>
);

export default ParticleEffect;
