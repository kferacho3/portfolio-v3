import { Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  MAX_FRAME_DELTA,
  RUNNER_BASE_FORWARD_SPEED,
  RUNNER_FORWARD_ACCEL,
  RUNNER_GRAVITY,
  RUNNER_LATERAL_DAMPING,
  RUNNER_LATERAL_STIFFNESS,
  RUNNER_MAX_FORWARD_SPEED,
  RUNNER_MAX_LATERAL,
  RUNNER_PLAYER_COLLISION_HEIGHT,
  RUNNER_PLAYER_COLLISION_RADIUS_X,
  RUNNER_PLAYER_COLLISION_RADIUS_Z,
} from '../constants';
import { useRunnerControls } from '../hooks/useRunnerControls';
import { skyBlitzState } from '../state';
import type { ObstacleData } from '../types';
import RunnerGround from './RunnerGround';

const RunnerManMode: React.FC = () => {
  const snap = useSnapshot(skyBlitzState);
  const playerRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();

  const velocityRef = useRef(0);
  const isJumpingRef = useRef(false);
  const lateralVelocityRef = useRef(0);
  const forwardSpeedRef = useRef(RUNNER_BASE_FORWARD_SPEED);
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const lastDamageTime = useRef(0);
  const scoreRef = useRef(0);
  const lastScoreSync = useRef(0);
  const obstacleMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initialObstacles: ObstacleData[] = [];
    for (let i = 0; i < 72; i++) {
      const width = 0.8 + Math.random() * 1.1;
      const height = 1 + Math.random() * 1.4;
      const depth = 0.7 + Math.random() * 1.2;
      initialObstacles.push({
        id: i,
        position: [Math.random() * 9 - 4.5, 0, -i * 9 - 24] as [
          number,
          number,
          number,
        ],
        active: true,
        width,
        height,
        depth,
        wobbleAmp: Math.random() * 0.16,
        wobbleSpeed: 1.5 + Math.random() * 2.3,
        wobblePhase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.3,
      });
    }
    obstaclesRef.current = initialObstacles;
    velocityRef.current = 0;
    lateralVelocityRef.current = 0;
    forwardSpeedRef.current = RUNNER_BASE_FORWARD_SPEED;
    scoreRef.current = 0;
    skyBlitzState.phase = 'playing';
    skyBlitzState.health = 100;
    skyBlitzState.score = 0;
    skyBlitzState.wave = 1;
    setInitialized(true);
  }, []);

  useRunnerControls({ phase: snap.phase, isJumpingRef, velocityRef });

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    const playerPos = playerRef.current.position;
    const dt = Math.min(delta, MAX_FRAME_DELTA);

    const waveFromScore = 1 + Math.floor(scoreRef.current / 165);
    if (waveFromScore !== skyBlitzState.wave) {
      skyBlitzState.wave = waveFromScore;
    }
    const targetSpeed = Math.min(
      RUNNER_MAX_FORWARD_SPEED,
      RUNNER_BASE_FORWARD_SPEED + (skyBlitzState.wave - 1) * 1.12
    );
    forwardSpeedRef.current = THREE.MathUtils.lerp(
      forwardSpeedRef.current,
      targetSpeed,
      Math.min(1, dt * RUNNER_FORWARD_ACCEL)
    );

    const targetX = state.pointer.x * RUNNER_MAX_LATERAL;
    const ax =
      (targetX - playerPos.x) * RUNNER_LATERAL_STIFFNESS -
      lateralVelocityRef.current * RUNNER_LATERAL_DAMPING;
    lateralVelocityRef.current += ax * dt;
    playerPos.x += lateralVelocityRef.current * dt;
    playerPos.x = THREE.MathUtils.clamp(playerPos.x, -RUNNER_MAX_LATERAL, RUNNER_MAX_LATERAL);

    playerPos.z -= dt * forwardSpeedRef.current;
    playerPos.y += velocityRef.current * dt;

    if (playerPos.y <= 0) {
      playerPos.y = 0;
      velocityRef.current = 0;
      isJumpingRef.current = false;
    } else {
      velocityRef.current -= RUNNER_GRAVITY * dt;
    }

    const cameraOffset = new THREE.Vector3(0, 2.9, 11.5);
    const cameraPosition = playerPos.clone().add(cameraOffset);
    cameraPosition.y -= 0.9;
    camera.position.lerp(cameraPosition, 0.12);
    const cameraLookAt = playerPos.clone();
    cameraLookAt.z -= 4.2;
    camera.lookAt(cameraLookAt);

    playerRef.current.rotation.z = THREE.MathUtils.clamp(
      -lateralVelocityRef.current * 0.065,
      -0.35,
      0.35
    );
    playerRef.current.rotation.x = THREE.MathUtils.clamp(
      -velocityRef.current * 0.035,
      -0.25,
      0.25
    );

    if (snap.phase === 'playing') {
      scoreRef.current += dt * (2.2 + forwardSpeedRef.current * 0.58);
      const now = performance.now();
      if (now - lastScoreSync.current > 75) {
        lastScoreSync.current = now;
        skyBlitzState.score = Math.floor(scoreRef.current);
      }
    }

    if (snap.phase === 'gameover') return;

    const now = performance.now();
    for (let i = 0; i < obstaclesRef.current.length; i++) {
      const obstacle = obstaclesRef.current[i];
      const mesh = obstacleMeshRefs.current[i];
      if (obstacle.position[2] - playerPos.z > 24) {
        const width = 0.8 + Math.random() * 1.1;
        const height = 1 + Math.random() * 1.4;
        const depth = 0.7 + Math.random() * 1.2;
        obstacle.position = [Math.random() * 9 - 4.5, 0, playerPos.z - 520] as [
          number,
          number,
          number,
        ];
        obstacle.width = width;
        obstacle.height = height;
        obstacle.depth = depth;
        obstacle.wobbleAmp = Math.random() * 0.16;
        obstacle.wobbleSpeed = 1.5 + Math.random() * 2.3;
        obstacle.wobblePhase = Math.random() * Math.PI * 2;
        obstacle.spin = (Math.random() - 0.5) * 0.3;
      }

      const dx = playerPos.x - obstacle.position[0];
      const dz = playerPos.z - obstacle.position[2];
      const halfX = (obstacle.width ?? 1) * 0.5 + RUNNER_PLAYER_COLLISION_RADIUS_X;
      const halfZ = (obstacle.depth ?? 1) * 0.5 + RUNNER_PLAYER_COLLISION_RADIUS_Z;
      const top = obstacle.position[1] + (obstacle.height ?? 1.5);
      const playerBottom = playerPos.y;
      const playerTop = playerPos.y + RUNNER_PLAYER_COLLISION_HEIGHT;
      const overlapY = playerTop >= obstacle.position[1] && playerBottom <= top;

      if (Math.abs(dx) < halfX && Math.abs(dz) < halfZ && overlapY) {
        if (now - lastDamageTime.current > 600) {
          lastDamageTime.current = now;
          skyBlitzState.health = Math.max(0, skyBlitzState.health - 15);
          obstacle.position = [Math.random() * 9 - 4.5, 0, playerPos.z - 260] as [
            number,
            number,
            number,
          ];

          if (skyBlitzState.health <= 0) {
            skyBlitzState.phase = 'gameover';
          }
        }
      }

      if (mesh) {
        const wobbleT = now * 0.001 * (obstacle.wobbleSpeed ?? 0);
        const wobbleY = Math.sin(wobbleT + (obstacle.wobblePhase ?? 0)) * (obstacle.wobbleAmp ?? 0);
        mesh.position.set(
          obstacle.position[0],
          obstacle.position[1] + wobbleY,
          obstacle.position[2]
        );
        mesh.rotation.y += dt * (obstacle.spin ?? 0);
      }
    }
  });

  return (
    <>
      <Sky
        distance={450000}
        turbidity={10}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        inclination={0.49}
        azimuth={0.25}
      />
      <Stars
        radius={400}
        depth={60}
        count={3000}
        factor={2}
        saturation={0}
        fade
      />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />

      <RunnerGround forwardSpeedRef={forwardSpeedRef} />

      <group ref={playerRef} position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.8, 1.8, 0.6]} />
          <meshStandardMaterial color="#38bdf8" emissive="#22d3ee" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#fcd34d" emissive="#fcd34d" emissiveIntensity={0.28} />
        </mesh>
      </group>

      {initialized &&
        obstaclesRef.current.map((obstacle, idx) => (
          <mesh
            key={obstacle.id}
            ref={(el) => {
              obstacleMeshRefs.current[idx] = el;
            }}
            position={obstacle.position}
            scale={[
              obstacle.width ?? 1,
              obstacle.height ?? 1.5,
              obstacle.depth ?? 1,
            ]}
          >
            <boxGeometry args={[1, 1.5, 1]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.18} />
          </mesh>
        ))}
    </>
  );
};

export default RunnerManMode;
