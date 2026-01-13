// src/components/myRoom/FloatingLight.tsx
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

const FloatingLight = () => {
  const mesh = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.position.y = Math.sin(clock.getElapsedTime()) * 20;
      mesh.current.position.x = Math.cos(clock.getElapsedTime()) * 20;
    }
  });

  return <pointLight ref={mesh} distance={50} intensity={1.5} color="purple" />;
};

export default FloatingLight;
