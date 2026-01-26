import React from 'react';

const LivesDisplay: React.FC<{ lives: number; maxLives: number }> = ({
  lives,
  maxLives,
}) => (
  <group position={[-5.5, 4, 0]}>
    {Array.from({ length: maxLives }).map((_, i) => (
      <mesh key={i} position={[i * 0.5, 0, 0]}>
        <circleGeometry args={[0.15, 6]} />
        <meshBasicMaterial
          color={i < lives ? '#ff3366' : '#333333'}
          transparent
          opacity={i < lives ? 1 : 0.3}
        />
      </mesh>
    ))}
  </group>
);

export default LivesDisplay;
