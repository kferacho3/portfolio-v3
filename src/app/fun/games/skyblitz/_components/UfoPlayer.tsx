import { useFrame, useThree } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import UfoShip from '../../models/UFOGames';
import {
  MAX_FRAME_DELTA,
  PLAYER_SPEED,
  UFO_LATERAL_DAMPING,
  UFO_LATERAL_STIFFNESS,
  UFO_PLAYER_MAX_Y,
  UFO_PLAYER_MIN_Y,
  UFO_PLAYER_POINTER_Y_SCALE,
} from '../constants';
import { skyBlitzState } from '../state';

const UfoPlayer: React.FC<{
  playerRef: React.MutableRefObject<THREE.Group | null>;
  forwardSpeedRef: React.MutableRefObject<number>;
}> = ({ playerRef, forwardSpeedRef }) => {
  const { camera } = useThree();

  const velocity = useRef(new THREE.Vector3());
  const aimDir = useRef(new THREE.Vector3());
  const fromForward = useRef(new THREE.Vector3(0, 0, -1));
  const tmpQuat = useRef(new THREE.Quaternion());
  const tmpRollQuat = useRef(new THREE.Quaternion());
  const tmpCameraTarget = useRef(new THREE.Vector3());
  const tmpCameraPos = useRef(new THREE.Vector3());
  const cameraOffset = useRef(new THREE.Vector3(0, 2.15, 10.5));

  useFrame((state, delta) => {
    if (!playerRef.current || skyBlitzState.phase !== 'playing') return;

    const dt = Math.min(delta, MAX_FRAME_DELTA);
    const player = playerRef.current;

    const targetX = state.pointer.x * 7;
    const scaledPointerY = THREE.MathUtils.clamp(
      state.pointer.y * UFO_PLAYER_POINTER_Y_SCALE,
      -1,
      1
    );
    const targetY = THREE.MathUtils.clamp(
      THREE.MathUtils.mapLinear(
        scaledPointerY,
        -1,
        1,
        UFO_PLAYER_MIN_Y,
        UFO_PLAYER_MAX_Y
      ),
      UFO_PLAYER_MIN_Y,
      UFO_PLAYER_MAX_Y
    );
    const forwardSpeed = forwardSpeedRef.current || PLAYER_SPEED;
    const targetZ = player.position.z - forwardSpeed * dt;

    // Smooth critically damped steering for premium feel.
    const ax =
      (targetX - player.position.x) * UFO_LATERAL_STIFFNESS -
      velocity.current.x * UFO_LATERAL_DAMPING;
    const ay =
      (targetY - player.position.y) * UFO_LATERAL_STIFFNESS -
      velocity.current.y * UFO_LATERAL_DAMPING;
    velocity.current.x += ax * dt;
    velocity.current.y += ay * dt;
    player.position.x += velocity.current.x * dt;
    player.position.y += velocity.current.y * dt;
    player.position.z = targetZ;

    // Keep within play bounds.
    const xLimit = 7.5;
    const yMin = UFO_PLAYER_MIN_Y;
    const yMax = UFO_PLAYER_MAX_Y;
    const clampedX = THREE.MathUtils.clamp(player.position.x, -xLimit, xLimit);
    if (clampedX !== player.position.x) velocity.current.x *= 0.35;
    player.position.x = clampedX;

    const clampedY = THREE.MathUtils.clamp(player.position.y, yMin, yMax);
    if (clampedY !== player.position.y) velocity.current.y *= 0.35;
    player.position.y = clampedY;

    // Aim direction (used for smooth yaw/pitch), with banking based on lateral velocity.
    aimDir.current
      .set(
        state.pointer.x * 0.45,
        THREE.MathUtils.clamp(state.pointer.y, -0.3, 1) * 0.14,
        -1
      )
      .normalize();
    tmpQuat.current.setFromUnitVectors(fromForward.current, aimDir.current);

    const roll = THREE.MathUtils.clamp(-velocity.current.x * 0.075, -0.6, 0.6);
    tmpRollQuat.current.setFromAxisAngle(aimDir.current, roll);
    tmpQuat.current.multiply(tmpRollQuat.current);

    const rotAlpha = 1 - Math.exp(-dt * 10);
    player.quaternion.slerp(tmpQuat.current, rotAlpha);

    tmpCameraPos.current.copy(player.position).add(cameraOffset.current);
    tmpCameraPos.current.y -= 1.4;
    const camAlpha = 1 - Math.exp(-dt * 7.5);
    camera.position.lerp(tmpCameraPos.current, camAlpha);

    tmpCameraTarget.current.copy(player.position);
    tmpCameraTarget.current.y -= 0.2;
    tmpCameraTarget.current.z -= 3.5;
    camera.lookAt(tmpCameraTarget.current);
  });

  return <UfoShip playerRef={playerRef} />;
};

export default UfoPlayer;
