import { useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';

const RunnerGround: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    if (meshRef.current) {
      meshRef.current.position.z = camera.position.z - 50;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
};

export default RunnerGround;
