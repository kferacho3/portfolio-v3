// @ts-nocheck
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
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
  PLAYER_GRAVITY,
  PLAYER_JUMP_VELOCITY,
  PLAYER_START_X,
  PLAYER_START_Y,
  PLAYER_START_Z,
  RIGHT_BOUND,
  SHIP_PALETTES,
  WALL_RADIUS,
} from '../constants';
import { mutation, voidRunnerState } from '../state';

const ShipMesh: React.FC<{ character: string; palette: keyof typeof SHIP_PALETTES }> = ({
  character,
  palette,
}) => {
  const p = SHIP_PALETTES[palette];
  const ufoRef = useRef<THREE.Group>(null);

  if (character === 'ufoMini') {
    return (
      <>
        <UfoShip
          playerRef={ufoRef}
          scale={0.56}
          position={[0, -0.92, 0]}
        />
        <mesh position={[0, 0.1, 0]}>
          <torusGeometry args={[1.35, 0.13, 12, 36]} />
          <meshStandardMaterial
            color={p.primary}
            emissive={p.glow}
            emissiveIntensity={1.1}
            transparent
            opacity={0.85}
          />
        </mesh>
      </>
    );
  }

  if (character === 'shipDart') {
    return (
      <>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[1.08, 3.9, 3]} />
          <meshStandardMaterial
            color={p.primary}
            emissive={p.secondary}
            emissiveIntensity={0.85}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, -0.2, -0.5]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.2, 2.6, 0.95]} />
          <meshStandardMaterial
            color={p.secondary}
            emissive={p.glow}
            emissiveIntensity={0.62}
            metalness={0.35}
            roughness={0.38}
          />
        </mesh>
        <mesh position={[0, -0.45, 1.05]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.55, 1.6, 6]} />
          <meshStandardMaterial
            color={p.secondary}
            emissive={p.primary}
            emissiveIntensity={0.5}
          />
        </mesh>
      </>
    );
  }

  if (character === 'shipWasp') {
    return (
      <>
        <mesh>
          <octahedronGeometry args={[1.22, 0]} />
          <meshStandardMaterial
            color={p.primary}
            emissive={p.secondary}
            emissiveIntensity={0.9}
            metalness={0.72}
            roughness={0.18}
          />
        </mesh>
        <mesh position={[-1.1, -0.1, -0.15]} rotation={[0.05, 0.6, 0.85]}>
          <boxGeometry args={[0.18, 2.15, 0.62]} />
          <meshStandardMaterial
            color={p.secondary}
            emissive={p.primary}
            emissiveIntensity={0.5}
            metalness={0.35}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[1.1, -0.1, -0.15]} rotation={[0.05, -0.6, -0.85]}>
          <boxGeometry args={[0.18, 2.15, 0.62]} />
          <meshStandardMaterial
            color={p.secondary}
            emissive={p.primary}
            emissiveIntensity={0.5}
            metalness={0.35}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, -0.7, 0.1]}>
          <sphereGeometry args={[0.28, 14, 14]} />
          <meshBasicMaterial color={p.glow} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh rotation={[0, Math.PI, 0]}>
        <coneGeometry args={[1.48, 4.0, 5]} />
        <meshStandardMaterial
          color={p.primary}
          emissive={p.secondary}
          emissiveIntensity={0.95}
          metalness={0.85}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[0, -0.15, -0.25]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.2, 2.65, 0.95]} />
        <meshStandardMaterial
          color={p.secondary}
          emissive={p.glow}
          emissiveIntensity={0.55}
          metalness={0.3}
          roughness={0.44}
        />
      </mesh>
      <mesh position={[0, -0.55, 1.08]}>
        <sphereGeometry args={[0.42, 12, 12]} />
        <meshBasicMaterial color={p.glow} transparent opacity={0.86} />
      </mesh>
    </>
  );
};

const Player: React.FC = () => {
  const playerRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const trailGlowRef = useRef<THREE.Mesh>(null);
  const thrusterRef = useRef<THREE.Mesh>(null);
  const accentLightRef = useRef<THREE.PointLight>(null);
  const { camera } = useThree();
  const snap = useSnapshot(voidRunnerState);

  const palette = useMemo(() => SHIP_PALETTES[snap.shipPalette], [snap.shipPalette]);

  useEffect(() => {
    camera.position.set(
      PLAYER_START_X + CAMERA_OFFSET_X,
      PLAYER_START_Y + CAMERA_OFFSET_Y,
      PLAYER_START_Z + CAMERA_OFFSET_Z
    );
    camera.lookAt(
      PLAYER_START_X,
      PLAYER_START_Y,
      PLAYER_START_Z - CAMERA_LOOK_AHEAD
    );
    camera.fov = CAMERA_FOV;
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (snap.phase === 'menu' || snap.phase === 'playing') {
      const baseYaw = snap.character === 'ufoMini' ? 0 : Math.PI;
      playerRef.current.position.set(
        PLAYER_START_X,
        PLAYER_START_Y,
        PLAYER_START_Z
      );
      playerRef.current.rotation.set(0, baseYaw, 0);
      mutation.playerZ = PLAYER_START_Z;
      mutation.playerX = PLAYER_START_X;
      mutation.playerY = PLAYER_START_Y;
      mutation.horizontalVelocity = 0;
      mutation.verticalVelocity = 0;
      mutation.isJumping = false;
    }
  }, [snap.phase, snap.character]);

  useFrame((state, delta) => {
    if (!playerRef.current || snap.phase !== 'playing') return;
    if (mutation.hitStop > 0) {
      mutation.hitStop = Math.max(0, mutation.hitStop - delta);
      return;
    }

    const mesh = playerRef.current;
    const { left, right, jump } = voidRunnerState.controls;
    const accelDelta = delta * 3.2;

    if (jump && !mutation.isJumping) {
      mutation.verticalVelocity = PLAYER_JUMP_VELOCITY;
      mutation.isJumping = true;
      voidRunnerState.controls.jump = false;
    }

    mesh.position.z -= mutation.gameSpeed * delta * 165;
    mutation.playerZ = mesh.position.z;

    if (!mutation.gameOver) {
      mesh.position.x += mutation.horizontalVelocity * delta * 165;

      mesh.position.x = Math.max(
        LEFT_BOUND + WALL_RADIUS / 2 + 5,
        Math.min(RIGHT_BOUND - WALL_RADIUS / 2 - 5, mesh.position.x)
      );

      if ((left && right) || (!left && !right)) {
        if (mutation.horizontalVelocity < 0) {
          mutation.horizontalVelocity = Math.min(
            0,
            mutation.horizontalVelocity + accelDelta
          );
        } else if (mutation.horizontalVelocity > 0) {
          mutation.horizontalVelocity = Math.max(
            0,
            mutation.horizontalVelocity - accelDelta
          );
        }
      } else if (left) {
        mutation.horizontalVelocity = Math.max(
          -0.86,
          mutation.horizontalVelocity - accelDelta
        );
      } else if (right) {
        mutation.horizontalVelocity = Math.min(
          0.86,
          mutation.horizontalVelocity + accelDelta
        );
      }

      if (mutation.isJumping || mesh.position.y > PLAYER_START_Y) {
        mutation.verticalVelocity -= PLAYER_GRAVITY * delta;
        mesh.position.y += mutation.verticalVelocity * delta;

        if (mesh.position.y <= PLAYER_START_Y) {
          mesh.position.y = PLAYER_START_Y;
          mutation.verticalVelocity = 0;
          mutation.isJumping = false;
        }
      }
    }

    mutation.playerX = mesh.position.x;
    mutation.playerY = mesh.position.y;

    const baseYaw = snap.character === 'ufoMini' ? 0 : Math.PI;
    const jumpTilt = THREE.MathUtils.clamp(mutation.verticalVelocity * 0.012, -0.42, 0.42);
    mesh.rotation.z = mutation.horizontalVelocity * 1.05;
    mesh.rotation.x = jumpTilt;
    mesh.rotation.y = baseYaw - mutation.horizontalVelocity * 0.24;

    if (mutation.speedBoostTimer > 0) {
      mutation.speedBoostTimer = Math.max(0, mutation.speedBoostTimer - delta);
    }

    const speedBoostMultiplier = mutation.speedBoostTimer > 0 ? 1.26 : 1;
    const desiredSpeed = mutation.desiredSpeed * speedBoostMultiplier;
    const speedDelta = desiredSpeed - mutation.gameSpeed;
    if (Math.abs(speedDelta) > 0.0001) {
      const accel = speedDelta > 0 ? 0.2 : 0.1;
      mutation.gameSpeed +=
        Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), delta * accel);
    }

    voidRunnerState.speed = Math.floor(mutation.gameSpeed * 420);

    const distanceScore = Math.floor(
      (Math.abs(mesh.position.z) * voidRunnerState.comboMultiplier) / 10
    );
    const score = distanceScore + voidRunnerState.bonusScore;
    voidRunnerState.score = score;
    voidRunnerState.syncLevelByScore(score);

    if (mutation.shake > 0) {
      mutation.shake = Math.max(0, mutation.shake - delta * mutation.shakeDecay);
    }

    const wobble = Math.sin(state.clock.elapsedTime * 0.9) * 0.08;
    const shake = mutation.shake;
    const shakeX = Math.sin(state.clock.elapsedTime * 40) * shake * 0.6;
    const shakeY = Math.cos(state.clock.elapsedTime * 48) * shake * 0.4;
    const shakeZ = Math.sin(state.clock.elapsedTime * 55) * shake * 0.3;

    camera.position.set(
      mesh.position.x + CAMERA_OFFSET_X + shakeX + wobble,
      mesh.position.y + CAMERA_OFFSET_Y + shakeY + wobble * 0.4,
      mesh.position.z + CAMERA_OFFSET_Z + shakeZ
    );
    camera.lookAt(mesh.position.x, mesh.position.y, mesh.position.z - CAMERA_LOOK_AHEAD);

    if (trailRef.current && trailGlowRef.current) {
      const trailScale = 0.48 + Math.abs(mutation.horizontalVelocity) * 0.75;
      const boostPulse = mutation.speedBoostTimer > 0 ? 1.4 : 1;
      trailRef.current.position.copy(mesh.position);
      trailRef.current.position.z += 3.2;
      trailRef.current.position.y = mesh.position.y - 0.2;
      trailRef.current.scale.x = trailScale;
      (trailRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.26 + mutation.gameSpeed * 0.28 * boostPulse;

      trailGlowRef.current.position.copy(mesh.position);
      trailGlowRef.current.position.z += 3.5;
      trailGlowRef.current.position.y = mesh.position.y - 0.15;
      trailGlowRef.current.scale.x = 0.72 + Math.abs(mutation.horizontalVelocity) * 0.9;
      (trailGlowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.12 + mutation.gameSpeed * 0.13 * boostPulse;
    }

    if (thrusterRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 22) * 0.25;
      thrusterRef.current.scale.set(1, 1, pulse);
      thrusterRef.current.position.y = -0.2 + Math.sin(state.clock.elapsedTime * 12) * 0.05;
    }

    if (accentLightRef.current) {
      accentLightRef.current.intensity =
        2.6 + (mutation.speedBoostTimer > 0 ? 1.2 : 0) + Math.sin(state.clock.elapsedTime * 8) * 0.3;
    }
  });

  return (
    <>
      <group ref={playerRef} position={[PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z]}>
        <ShipMesh character={snap.character} palette={snap.shipPalette} />

        <mesh ref={thrusterRef} position={[0, -0.18, 1.78]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.44, 1.42, 10, 1, true]} />
          <meshBasicMaterial
            color={palette.trail}
            transparent
            opacity={0.78}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        <pointLight
          ref={accentLightRef}
          color={palette.glow}
          intensity={2.8}
          distance={18}
        />
      </group>

      <mesh ref={trailRef} position={[PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z + 3.2]}>
        <planeGeometry args={[2.25, 9.8]} />
        <meshBasicMaterial
          color={palette.trail}
          transparent
          opacity={0.32}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={trailGlowRef} position={[PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z + 3.4]}>
        <planeGeometry args={[3.4, 13.2]} />
        <meshBasicMaterial
          color={palette.glow}
          transparent
          opacity={0.14}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </>
  );
};

export default Player;
