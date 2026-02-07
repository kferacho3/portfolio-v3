import { useFrame, useThree } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import UfoShip from '../../models/UFOGames';
import { MAX_FRAME_DELTA, PLAYER_SPEED } from '../constants';
import { skyBlitzState } from '../state';

const UfoPlayer: React.FC<{
  playerRef: React.MutableRefObject<THREE.Group | null>;
}> = ({ playerRef }) => {
  const { camera } = useThree();

  const velocity = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const aimDir = useRef(new THREE.Vector3());
  const fromForward = useRef(new THREE.Vector3(0, 0, -1));
  const tmpQuat = useRef(new THREE.Quaternion());
  const tmpRollQuat = useRef(new THREE.Quaternion());
  const tmpCameraTarget = useRef(new THREE.Vector3());
  const tmpCameraPos = useRef(new THREE.Vector3());
  const cameraOffset = useRef(new THREE.Vector3(0, 3, 12));

  useFrame((state, delta) => {
    if (!playerRef.current || skyBlitzState.phase !== 'playing') return;

    const dt = Math.min(delta, MAX_FRAME_DELTA);
    const player = playerRef.current;

    const targetX = state.pointer.x * 7.25;
    const targetY = THREE.MathUtils.clamp(state.pointer.y * 4.25, 0, 5.25);
    const targetZ = player.position.z - PLAYER_SPEED * dt;
    targetPosition.current.set(targetX, targetY, targetZ);

    // Organic flight: critically-damped spring towards the pointer target (XY),
    // plus constant forward motion (Z).
    const stiffness = 55;
    const damping = 14;

    const ax = (targetX - player.position.x) * stiffness - velocity.current.x * damping;
    const ay = (targetY - player.position.y) * stiffness - velocity.current.y * damping;
    velocity.current.x += ax * dt;
    velocity.current.y += ay * dt;
    player.position.x += velocity.current.x * dt;
    player.position.y += velocity.current.y * dt;
    player.position.z = targetZ;

    // Keep within play bounds.
    const xLimit = 7.5;
    const yMin = 0;
    const yMax = 6;
    const clampedX = THREE.MathUtils.clamp(player.position.x, -xLimit, xLimit);
    if (clampedX !== player.position.x) velocity.current.x *= 0.35;
    player.position.x = clampedX;

    const clampedY = THREE.MathUtils.clamp(player.position.y, yMin, yMax);
    if (clampedY !== player.position.y) velocity.current.y *= 0.35;
    player.position.y = clampedY;

    // Aim direction (used for smooth yaw/pitch), with banking based on lateral velocity.
    aimDir.current
      .set(state.pointer.x * 0.45, THREE.MathUtils.clamp(state.pointer.y, -0.2, 0.9) * 0.25, -1)
      .normalize();
    tmpQuat.current.setFromUnitVectors(fromForward.current, aimDir.current);

    const roll = THREE.MathUtils.clamp(-velocity.current.x * 0.075, -0.6, 0.6);
    tmpRollQuat.current.setFromAxisAngle(aimDir.current, roll);
    tmpQuat.current.multiply(tmpRollQuat.current);

    const rotAlpha = 1 - Math.exp(-dt * 10);
    player.quaternion.slerp(tmpQuat.current, rotAlpha);

    tmpCameraPos.current.copy(player.position).add(cameraOffset.current);
    tmpCameraPos.current.y -= 2;
    const camAlpha = 1 - Math.exp(-dt * 6);
    camera.position.lerp(tmpCameraPos.current, camAlpha);

    tmpCameraTarget.current.copy(player.position);
    camera.lookAt(tmpCameraTarget.current);
  });

  return <UfoShip playerRef={playerRef} />;
};

export default UfoPlayer;
