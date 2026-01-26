import React from 'react';

const OrbitRing: React.FC<{ radius: number; color: string }> = ({
  radius,
  color,
}) => (
  <mesh rotation={[Math.PI / 2, 0, 0]}>
    <torusGeometry args={[radius, 0.02, 8, 64]} />
    <meshBasicMaterial color={color} transparent opacity={0.25} />
  </mesh>
);

export default OrbitRing;
