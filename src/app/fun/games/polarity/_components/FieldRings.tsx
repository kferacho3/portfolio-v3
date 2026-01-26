'use client';

import React from 'react';

export const FieldRings: React.FC = () => {
  const rings = [8, 16, 24, 32];
  return (
    <group position={[0, -0.69, 0]}>
      {rings.map((r, i) => (
        <mesh key={`field-ring-${r}`} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.18, r + 0.18, 64]} />
          <meshStandardMaterial
            color="#0ea5e9"
            emissive="#0ea5e9"
            emissiveIntensity={0.12 + i * 0.05}
            transparent
            opacity={0.18}
          />
        </mesh>
      ))}
    </group>
  );
};
