// @ts-nocheck
import { useBox } from '@react-three/cannon';
import React, { forwardRef } from 'react';
import * as THREE from 'three';

const RunnerObstacle = forwardRef<
  THREE.Object3D,
  { position: [number, number, number]; scale: number }
>(({ position, scale }, ref) => {
  const [boxRef] = useBox(() => ({
    type: 'Static',
    position,
  }), ref);

  return (
    <mesh ref={boxRef} scale={[1, scale, 1]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
});

RunnerObstacle.displayName = 'RunnerObstacle';

export default RunnerObstacle;
