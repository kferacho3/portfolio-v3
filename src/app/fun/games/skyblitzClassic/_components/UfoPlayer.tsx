import { useFrame, useThree } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import UfoShip from '../../models/UFOGames';
import { MAX_FRAME_DELTA, UFO_PLAYER_SPEED } from '../constants';

const UfoPlayer: React.FC<{
  playerRef: React.RefObject<THREE.Object3D>;
  setScore: (fn: (prev: number) => number) => void;
}> = ({ playerRef, setScore }) => {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Quaternion());
  const dir = useRef(new THREE.Vector3());
  const fromForward = useRef(new THREE.Vector3(0, 0, -1));

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    const dt = Math.min(delta, MAX_FRAME_DELTA);

    const xPosition = state.pointer.x * 6;
    const yPosition = Math.max(state.pointer.y * 3, 0);
    const zPosition = playerRef.current.position.z - dt * UFO_PLAYER_SPEED;

    targetPosition.current.set(xPosition, yPosition, zPosition);
    playerRef.current.position.lerp(targetPosition.current, 0.1);

    dir.current
      .set(state.pointer.x / 5, Math.max(state.pointer.y, -0.1), -1)
      .normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(fromForward.current, dir.current);
    targetRotation.current.slerp(rotation, 0.1);
    playerRef.current.quaternion.slerp(targetRotation.current, 0.1);

    const cameraOffset = new THREE.Vector3(0, 3, 12);
    const cameraPosition = playerRef.current.position.clone().add(cameraOffset);
    cameraPosition.y -= 2;
    camera.position.lerp(cameraPosition, 0.2);
    camera.lookAt(playerRef.current.position);

    setScore((prev) => prev + dt);
  });

  return <UfoShip playerRef={playerRef} />;
};

export default UfoPlayer;
