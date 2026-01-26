import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { WALL_MODE_HEIGHT, WALL_MODE_WIDTH } from '../../constants';
import { reactPongState } from '../../state';

const WallModeCameraSetup: React.FC = () => {
  const { camera, scene, size } = useThree();
  const targetFov = 55;

  const basePosition = useMemo(() => {
    const aspect = size.width / size.height || 1;
    const verticalFov = THREE.MathUtils.degToRad(targetFov);
    const fitHeight = WALL_MODE_HEIGHT * 1.2;
    const fitWidth = WALL_MODE_WIDTH * 1.1;
    const distanceForHeight = fitHeight / 2 / Math.tan(verticalFov / 2);
    const distanceForWidth =
      fitWidth / 2 / (Math.tan(verticalFov / 2) * aspect);
    const distance = Math.max(distanceForHeight, distanceForWidth);
    return new THREE.Vector3(0, 0, distance + 2);
  }, [size.width, size.height, targetFov]);

  useEffect(() => {
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = targetFov;
      (camera as THREE.PerspectiveCamera).near = 0.1;
      (camera as THREE.PerspectiveCamera).far = 1000;
      camera.updateProjectionMatrix();
    }
    scene.background = new THREE.Color('#050510');
  }, [camera, scene, targetFov]);

  useEffect(() => {
    camera.position.copy(basePosition);
    camera.lookAt(0, 0, 0);
  }, [camera, basePosition]);

  useFrame((_, delta) => {
    const shake = reactPongState.screenShake;
    let shakeX = 0;
    let shakeY = 0;
    if (shake > 0) {
      shakeX = (Math.random() - 0.5) * shake;
      shakeY = (Math.random() - 0.5) * shake;
      reactPongState.screenShake *= 0.9;
      if (reactPongState.screenShake < 0.01) reactPongState.screenShake = 0;
    }

    easing.damp3(
      camera.position,
      [basePosition.x + shakeX, basePosition.y + shakeY, basePosition.z],
      0.3,
      delta
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
};

export default WallModeCameraSetup;
