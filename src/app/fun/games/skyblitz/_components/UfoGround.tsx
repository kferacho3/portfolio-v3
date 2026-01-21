import { useFrame, useLoader } from '@react-three/fiber';
import React from 'react';
import * as THREE from 'three';
import { MAX_FRAME_DELTA } from '../constants';

const UfoGround: React.FC = () => {
  const texture = useLoader(
    THREE.TextureLoader,
    'https://cdn.pixabay.com/photo/2020/05/22/12/26/web-5205244_1280.jpg'
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);
  texture.offset.set(0, 0);

  useFrame((_, delta) => {
    texture.offset.y -= Math.min(delta, MAX_FRAME_DELTA) * 0.15;
  });

  return (
    <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

export default UfoGround;
