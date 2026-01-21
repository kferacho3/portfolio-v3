// @ts-nocheck
import { usePlane } from '@react-three/cannon';
import React from 'react';

const RunnerGround: React.FC = () => {
  const [groundRef] = usePlane(() => ({
    position: [0, -1, 0],
    rotation: [-Math.PI / 2, 0, 0],
  }));

  return (
    <mesh ref={groundRef} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="gray" />
    </mesh>
  );
};

export default RunnerGround;
