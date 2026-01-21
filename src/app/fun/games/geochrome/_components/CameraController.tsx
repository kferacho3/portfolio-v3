import { useFrame, useThree } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';

interface CameraControllerProps {
  playerPosition: THREE.Vector3;
}

const CameraController: React.FC<CameraControllerProps> = ({ playerPosition }) => {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3());
  const velocityRef = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const playerUp = playerPosition.clone().normalize();
    const playerForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      playerUp,
      Math.atan2(playerPosition.x, playerPosition.z)
    );

    const cameraHeight = 40;
    const cameraDistance = 30;

    const idealPosition = playerPosition
      .clone()
      .add(playerUp.clone().multiplyScalar(cameraHeight))
      .sub(playerForward.clone().multiplyScalar(cameraDistance));

    const springStrength = 4;
    const damping = 0.8;

    targetRef.current.copy(idealPosition);

    const acceleration = targetRef.current.clone().sub(camera.position).multiplyScalar(springStrength);

    velocityRef.current.add(acceleration.multiplyScalar(delta));
    velocityRef.current.multiplyScalar(damping);

    camera.position.add(velocityRef.current.clone().multiplyScalar(delta * 60));

    const lookTarget = playerPosition.clone();
    camera.lookAt(lookTarget);

    const roll = Math.sin(Date.now() * 0.0005) * 0.02;
    camera.rotation.z += roll;
  });

  return null;
};

export default CameraController;
