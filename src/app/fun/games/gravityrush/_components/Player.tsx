import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  AIR_FRICTION,
  BALL_RADIUS,
  CAMERA_SHIFT_X,
  CAMERA_SHIFT_Y,
  CAMERA_SHIFT_Z,
  CHUNK_SIZE,
  GRAVITY,
  GROUND_FRICTION,
  JUMP_FORCE,
  MAX_VELOCITY,
  MOVE_FORCE,
  THEME_KEYS,
} from '../constants';
import { gravityRushState, mutation } from '../state';
import type { Theme } from '../types';
import { collectiblePickupRadius, distSq3, worldZ } from '../utils/generation';

interface PlayerProps {
  theme: Theme;
  onChunkUpdate: (chunk: number) => void;
}

const Player: React.FC<PlayerProps> = ({ theme, onChunkUpdate }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const lastChunkRef = useRef(0);
  const cameraPosRef = useRef(new THREE.Vector3());

  useEffect(() => {
    camera.position.set(CAMERA_SHIFT_X, CAMERA_SHIFT_Y, CAMERA_SHIFT_Z);
    camera.lookAt(0, 0, 0);
    camera.fov = 50;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame((state, delta) => {
    if (!meshRef.current || gravityRushState.phase !== 'playing') return;

    const dt = Math.min(delta, 0.05);
    const [px, py, pz] = mutation.playerPos;
    let [vx, vy, vz] = mutation.playerVel;

    const { forward, back, left, right, jump } = gravityRushState.controls;
    const speedMult = gravityRushState.hasSpeedBoost ? 1.5 : 1;

    const force = MOVE_FORCE * speedMult;
    if (forward) vz -= force * dt;
    if (back) vz += force * dt;
    if (left) vx -= force * dt;
    if (right) vx += force * dt;

    vy += GRAVITY * dt;

    if (jump && mutation.isGrounded) {
      vy = JUMP_FORCE;
      mutation.isGrounded = false;
      gravityRushState.controls.jump = false;
    }

    vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, vx));
    vz = Math.max(-MAX_VELOCITY * speedMult, Math.min(MAX_VELOCITY * speedMult, vz));

    const friction = mutation.isGrounded ? GROUND_FRICTION : AIR_FRICTION;
    vx *= friction;
    vz *= friction;

    let newX = px + vx * dt;
    let newY = py + vy * dt;
    let newZ = pz + vz * dt;

    mutation.isGrounded = false;
    const currentChunk = Math.max(0, Math.floor(-newZ / CHUNK_SIZE));

    if (currentChunk !== lastChunkRef.current) {
      lastChunkRef.current = currentChunk;
      onChunkUpdate(currentChunk);
    }

    for (let ci = Math.max(0, currentChunk - 1); ci <= currentChunk + 1; ci++) {
      const platforms = mutation.chunks.get(ci);
      if (!platforms) continue;

      for (const platform of platforms) {
        let platX = platform.x;
        let platZ = platform.z;
        let platY = platform.y;

        if (platform.type === 'moving' && platform.moveAxis) {
          const moveRange = platform.moveRange || 2;
          const moveAmount = Math.sin(state.clock.elapsedTime * 1.5 + (platform.movePhase || 0)) * moveRange;
          if (platform.moveAxis === 'x') {
            platX += moveAmount;
          } else {
            platZ += moveAmount;
          }
        }

        if (platform.type === 'crumble' && platform.crumbleTimer !== undefined && platform.crumbleTimer < 0.6) {
          platY = platform.y - (0.6 - platform.crumbleTimer) * 15;
        }

        const halfW = platform.width / 2;
        const halfL = platform.length / 2;
        const platTop = platY + 0.2;

        if (
          newX > platX - halfW - BALL_RADIUS &&
          newX < platX + halfW + BALL_RADIUS &&
          newZ > -platZ - halfL - BALL_RADIUS &&
          newZ < -platZ + halfL + BALL_RADIUS
        ) {
          if (newY - BALL_RADIUS <= platTop && newY - BALL_RADIUS > platTop - 1.5 && vy < 0) {
            newY = platTop + BALL_RADIUS;
            vy = 0;
            mutation.isGrounded = true;

            if (platform.type === 'boost') {
              vz = -MAX_VELOCITY * 1.3;
              vy = JUMP_FORCE * 0.8;
              mutation.isGrounded = false;
            } else if (platform.type === 'crumble' && !platform.touched) {
              platform.touched = true;
              platform.crumbleTimer = 0.8;
            }

            gravityRushState.addCombo();
          }
        }

        if (platform.type === 'crumble' && platform.crumbleTimer !== undefined) {
          platform.crumbleTimer -= dt;
          if (platform.crumbleTimer <= -1) {
            platform.y -= 100;
          }
        }
      }
    }

    for (const [, collectible] of mutation.collectibles) {
      if (collectible.collected) continue;

      const dx = newX - collectible.x;
      const dy = newY - collectible.y;
      const dz = newZ - worldZ(collectible.z);
      const distSq = distSq3(dx, dy, dz);

      const collectRadius = collectiblePickupRadius(collectible.type);
      const collectRadiusSq = collectRadius * collectRadius;

      if (distSq < collectRadiusSq) {
        collectible.collected = true;

        if (collectible.type === 'coin') {
          gravityRushState.collectCoin(10);
        } else if (collectible.type === 'gem') {
          gravityRushState.collectCoin(50);
        } else if (collectible.type === 'powerup' && collectible.powerupType) {
          gravityRushState.activatePowerup(collectible.powerupType);
        }
      }
    }

    if (newY < -8) {
      if (gravityRushState.hasShield) {
        gravityRushState.hasShield = false;
        gravityRushState.shieldTimer = 0;
        newY = 3;
        vy = 0;
        vx = 0;
        vz = 0;
      } else {
        gravityRushState.endGame();
        return;
      }
    }

    mutation.playerPos = [newX, newY, newZ];
    mutation.playerVel = [vx, vy, vz];
    mutation.currentChunk = currentChunk;

    const distance = Math.max(0, -newZ);
    gravityRushState.distance = Math.floor(distance);
    gravityRushState.score = Math.floor(distance * gravityRushState.comboMultiplier) + gravityRushState.collectibleScore;

    const themeIndex = Math.floor(distance / 200) % THEME_KEYS.length;
    if (THEME_KEYS[themeIndex] !== gravityRushState.currentTheme) {
      gravityRushState.currentTheme = THEME_KEYS[themeIndex];
    }

    meshRef.current.position.set(newX, newY, newZ);
    meshRef.current.rotation.x -= vz * dt * 2;
    meshRef.current.rotation.z += vx * dt * 2;

    const cameraPos = cameraPosRef.current;
    if (newY > -2.5) {
      camera.position.lerp(cameraPos.set(newX + CAMERA_SHIFT_X, newY + CAMERA_SHIFT_Y, newZ + CAMERA_SHIFT_Z), dt * 10);
    } else {
      camera.lookAt(newX, newY, newZ);
    }

    if (trailRef.current) {
      trailRef.current.position.set(newX, newY, newZ + 1);
      const speed = Math.sqrt(vx * vx + vz * vz);
      trailRef.current.scale.z = Math.min(speed * 0.3, 3);
      (trailRef.current.material as THREE.MeshBasicMaterial).opacity = Math.min(speed * 0.05, 0.5);
    }

    if (shieldRef.current) {
      shieldRef.current.position.copy(meshRef.current.position);
      shieldRef.current.visible = gravityRushState.hasShield;
      shieldRef.current.rotation.y += dt * 2;
    }

    if (gravityRushState.shieldTimer > 0) {
      gravityRushState.shieldTimer -= dt;
      if (gravityRushState.shieldTimer <= 0) gravityRushState.hasShield = false;
    }
    if (gravityRushState.speedBoostTimer > 0) {
      gravityRushState.speedBoostTimer -= dt;
      if (gravityRushState.speedBoostTimer <= 0) gravityRushState.hasSpeedBoost = false;
    }
    if (gravityRushState.doublePointsTimer > 0) {
      gravityRushState.doublePointsTimer -= dt;
      if (gravityRushState.doublePointsTimer <= 0) gravityRushState.hasDoublePoints = false;
    }
  });

  return (
    <>
      <mesh ref={meshRef} position={[0, 2, 0]} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
        <meshStandardMaterial
          color={theme.ball}
          emissive={theme.ball}
          emissiveIntensity={0.4}
          metalness={0.6}
          roughness={0.2}
        />
        <pointLight color={theme.ball} intensity={0.8} distance={4} />
      </mesh>

      <mesh ref={trailRef} position={[0, 2, 1]}>
        <boxGeometry args={[0.2, 0.2, 1.5]} />
        <meshBasicMaterial color={theme.ball} transparent opacity={0.4} />
      </mesh>

      <mesh ref={shieldRef} visible={false}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.3} wireframe />
      </mesh>
    </>
  );
};

export default Player;
