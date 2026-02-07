import { useFrame, useLoader } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import { MAX_FRAME_DELTA } from '../constants';

const UfoGround: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(
    THREE.TextureLoader,
    'https://cdn.pixabay.com/photo/2020/05/22/12/26/web-5205244_1280.jpg'
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);
  texture.offset.set(0, 0);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, MAX_FRAME_DELTA);
    texture.offset.y -= dt * 0.35;
    if (meshRef.current) {
      meshRef.current.position.x = camera.position.x;
      meshRef.current.position.z = camera.position.z - 50;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, -1, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

export default UfoGround;
