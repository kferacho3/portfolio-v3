import { useFrame, useThree } from '@react-three/fiber';
import { easing } from '@/lib/easing';
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { WALL_MODE_HEIGHT, WALL_MODE_WIDTH } from '../../constants';
import { reactPongState } from '../../state';

const WallModeCameraSetup: React.FC = () => {
  const { camera, scene, size } = useThree();
  const targetFov = 48;

  const basePosition = useMemo(() => {
    const aspect = size.width / size.height || 1;
    const verticalFov = THREE.MathUtils.degToRad(targetFov);
    const fitHeight = WALL_MODE_HEIGHT * 1.05;
    const fitWidth = WALL_MODE_WIDTH * 1.04;
    const distanceForHeight = fitHeight / 2 / Math.tan(verticalFov / 2);
    const distanceForWidth =
      fitWidth / 2 / (Math.tan(verticalFov / 2) * aspect);
    const distance = Math.max(distanceForHeight, distanceForWidth);
    return new THREE.Vector3(0, 0.2, distance + 1.6);
  }, [size.width, size.height, targetFov]);

  useEffect(() => {
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = targetFov;
      (camera as THREE.PerspectiveCamera).near = 0.1;
      (camera as THREE.PerspectiveCamera).far = 1000;
      camera.updateProjectionMatrix();
    }
    scene.background = new THREE.Color('#050816');
  }, [camera, scene, targetFov]);

  useEffect(() => {
    camera.position.copy(basePosition);
    camera.lookAt(0, 0, -2);
  }, [camera, basePosition]);

  useFrame((state, delta) => {
    const shake = reactPongState.screenShake;
    let shakeX = 0;
    let shakeY = 0;
    if (shake > 0) {
      const t = state.clock.elapsedTime * 80;
      shakeX = Math.sin(t) * shake * 0.42;
      shakeY = Math.cos(t * 0.93) * shake * 0.35;
      reactPongState.screenShake *= 0.86;
      if (reactPongState.screenShake < 0.01) reactPongState.screenShake = 0;
    }

    easing.damp3(
      camera.position,
      [basePosition.x + shakeX, basePosition.y + shakeY, basePosition.z],
      0.22,
      delta
    );
    camera.lookAt(0, 0, -2);
  });

  return null;
};

export default WallModeCameraSetup;
