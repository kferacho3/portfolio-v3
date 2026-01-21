import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { ARM_COLOR, INNER_SAFE_RADIUS, PLAYER_ORBIT_RADIUS } from '../constants';

const DangerZone: React.FC = () => {
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (innerRef.current) {
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.03 + 0.02 * Math.sin(t * 2);
    }
  });

  return (
    <group>
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]}>
        <ringGeometry args={[INNER_SAFE_RADIUS, PLAYER_ORBIT_RADIUS - 0.3, 64]} />
        <meshBasicMaterial color={ARM_COLOR} transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

export default DangerZone;
