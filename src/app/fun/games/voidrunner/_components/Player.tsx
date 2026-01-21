import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import UfoShip from '../../models/UFOGames';
import {
  CAMERA_FOV,
  CAMERA_LOOK_AHEAD,
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
  LEFT_BOUND,
  PLAYER_START_X,
  PLAYER_START_Y,
  PLAYER_START_Z,
  RIGHT_BOUND,
  WALL_RADIUS,
} from '../constants';
import { mutation, voidRunnerState } from '../state';

const Player: React.FC = () => {
  const playerRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const snap = useSnapshot(voidRunnerState);

  useEffect(() => {
    camera.position.set(
      PLAYER_START_X + CAMERA_OFFSET_X,
      PLAYER_START_Y + CAMERA_OFFSET_Y,
      PLAYER_START_Z + CAMERA_OFFSET_Z
    );
    camera.lookAt(PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z - CAMERA_LOOK_AHEAD);
    camera.fov = CAMERA_FOV;
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (snap.phase === 'menu' || snap.phase === 'playing') {
      const baseYaw = snap.character === 'ufoMini' ? 0 : Math.PI;
      playerRef.current.position.set(PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z);
      playerRef.current.rotation.set(0, baseYaw, 0);
      mutation.playerZ = PLAYER_START_Z;
      mutation.playerX = PLAYER_START_X;
      mutation.horizontalVelocity = 0;
    }
  }, [snap.phase, snap.character]);

  useFrame((state, delta) => {
    if (!playerRef.current || snap.phase !== 'playing') return;

    const mesh = playerRef.current;
    const { left, right } = voidRunnerState.controls;
    const accelDelta = delta * 3;

    mesh.position.z -= mutation.gameSpeed * delta * 165;
    mutation.playerZ = mesh.position.z;
    mutation.playerX = mesh.position.x;

    if (!mutation.gameOver) {
      mesh.position.x += mutation.horizontalVelocity * delta * 165;

      mesh.position.x = Math.max(
        LEFT_BOUND + WALL_RADIUS / 2 + 5,
        Math.min(RIGHT_BOUND - WALL_RADIUS / 2 - 5, mesh.position.x)
      );

      mesh.rotation.z = mutation.horizontalVelocity * 1.2;
      const baseYaw = snap.character === 'ufoMini' ? 0 : Math.PI;
      mesh.rotation.y = baseYaw - mutation.horizontalVelocity * 0.3;

      if ((left && right) || (!left && !right)) {
        if (mutation.horizontalVelocity < 0) {
          mutation.horizontalVelocity = Math.min(0, mutation.horizontalVelocity + accelDelta);
        } else if (mutation.horizontalVelocity > 0) {
          mutation.horizontalVelocity = Math.max(0, mutation.horizontalVelocity - accelDelta);
        }
      } else if (left) {
        mutation.horizontalVelocity = Math.max(-0.7, mutation.horizontalVelocity - accelDelta);
      } else if (right) {
        mutation.horizontalVelocity = Math.min(0.7, mutation.horizontalVelocity + accelDelta);
      }
    }

    camera.position.set(
      mesh.position.x + CAMERA_OFFSET_X,
      mesh.position.y + CAMERA_OFFSET_Y,
      mesh.position.z + CAMERA_OFFSET_Z
    );
    camera.lookAt(mesh.position.x, mesh.position.y, mesh.position.z - CAMERA_LOOK_AHEAD);

    if (trailRef.current) {
      trailRef.current.position.copy(mesh.position);
      trailRef.current.position.z += 3;
      trailRef.current.position.y = 2;
      trailRef.current.scale.x = 0.5 + Math.abs(mutation.horizontalVelocity);
      (trailRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + mutation.gameSpeed * 0.3;
    }

    if (mutation.gameSpeed < mutation.desiredSpeed) {
      mutation.gameSpeed = Math.min(mutation.desiredSpeed, mutation.gameSpeed + delta * 0.15);
      voidRunnerState.speed = Math.floor(mutation.gameSpeed * 400);
    }

    voidRunnerState.score = Math.floor(
      Math.abs(mesh.position.z) * voidRunnerState.comboMultiplier / 10
    );
  });

  return (
    <>
      <group ref={playerRef} position={[PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z]}>
        {snap.character === 'ufoMini' ? (
          <UfoShip
            playerRef={playerRef as unknown as React.MutableRefObject<THREE.Group | null>}
            scale={0.55}
            position={[0, -0.9, 0]}
          />
        ) : (
          <mesh rotation={[0, Math.PI, 0]}>
            <coneGeometry args={[1.5, 4, 4]} />
            <meshStandardMaterial
              color="#00ffff"
              emissive="#00aaff"
              emissiveIntensity={0.8}
              metalness={0.8}
              roughness={0.2}
            />
            <pointLight color="#00ffff" intensity={3} distance={15} />
          </mesh>
        )}
      </group>

      <mesh ref={trailRef} position={[PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z + 3]}>
        <planeGeometry args={[2, 8]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
};

export default Player;
