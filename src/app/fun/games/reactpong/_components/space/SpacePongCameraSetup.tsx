import { useThree } from '@react-three/fiber';
import React, { useEffect } from 'react';
import * as THREE from 'three';
import { TUNNEL_DEPTH } from '../../constants';

const SpacePongCameraSetup: React.FC = () => {
  const { camera, scene } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, -TUNNEL_DEPTH / 2);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 60;
      (camera as THREE.PerspectiveCamera).near = 0.1;
      (camera as THREE.PerspectiveCamera).far = 1000;
      camera.updateProjectionMatrix();
    }
    scene.background = new THREE.Color('#050510');
  }, [camera, scene]);

  return null;
};

export default SpacePongCameraSetup;
