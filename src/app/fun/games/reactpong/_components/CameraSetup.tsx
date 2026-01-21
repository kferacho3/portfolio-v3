import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const CameraSetup: React.FC = () => {
  const { camera, scene } = useThree();
  const frameCount = useRef(0);

  useEffect(() => {
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 45;
      (camera as THREE.PerspectiveCamera).near = 0.1;
      (camera as THREE.PerspectiveCamera).far = 1000;
      camera.updateProjectionMatrix();
    }
    scene.background = new THREE.Color('#0a0a1a');
  }, [camera, scene]);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current < 30) {
      camera.position.set(0, 5, 12);
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
};

export default CameraSetup;
