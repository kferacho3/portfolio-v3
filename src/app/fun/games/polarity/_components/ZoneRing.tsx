'use client';

import React from 'react';
import { useSnapshot } from 'valtio';
import { polarityState } from '../state';

export const ZoneRing: React.FC = () => {
  const snap = useSnapshot(polarityState);
  if (!snap.zone) return null;

  const glow = snap.zoneActive ? 0.6 : 0.25;
  return (
    <group position={[snap.zone.x, -0.68, snap.zone.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[snap.zone.radius - 0.45, snap.zone.radius, 48]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={glow} transparent opacity={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[snap.zone.radius - 0.8, 40]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.2} transparent opacity={0.15} />
      </mesh>
    </group>
  );
};
