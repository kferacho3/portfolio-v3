// @ts-nocheck
import { useBox } from '@react-three/cannon';
import React, { forwardRef } from 'react';
import * as THREE from 'three';

const Projectile = forwardRef<
  THREE.Object3D,
  { position: [number, number, number]; velocity: [number, number, number] }
>(({ position, velocity }, ref) => {
  const [projRef] = useBox(
    () => ({
      mass: 0.01,
      position,
      velocity,
      type: 'Dynamic',
      restitution: 2,
    }),
    ref
  );

  return (
    <mesh ref={projRef}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="yellow" />
    </mesh>
  );
});

Projectile.displayName = 'Projectile';

export default Projectile;
