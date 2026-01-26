import { Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { MAX_FRAME_DELTA } from '../constants';
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
  const obstaclesRef = useRef<ObstacleData[]>([]);
  const lastDamageTime = useRef(0);
  const scoreRef = useRef(0);
  const lastScoreSync = useRef(0);
  const obstacleMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initialObstacles: ObstacleData[] = [];
    for (let i = 0; i < 50; i++) {
      initialObstacles.push({
        id: i,
        position: [Math.random() * 8 - 4, 0, -i * 8 - 20] as [
          number,
          number,
          number,
        ],
        active: true,
      });
    }
    obstaclesRef.current = initialObstacles;
    setInitialized(true);
  }, []);

  useRunnerControls({ phase: snap.phase, isJumpingRef, velocityRef });

  useFrame((state, delta) => {
    if (!playerRef.current) return;

    const playerPos = playerRef.current.position;
    const dt = Math.min(delta, MAX_FRAME_DELTA);

    const x = state.pointer.x * 5;
    const z = playerPos.z - dt * 10;

    playerPos.x = x;
    playerPos.z = z;
    playerPos.y += velocityRef.current * dt;

    if (playerPos.y <= 0) {
      playerPos.y = 0;
      velocityRef.current = 0;
      isJumpingRef.current = false;
    } else {
      velocityRef.current -= 18 * dt;
    }

    const cameraOffset = new THREE.Vector3(0, 2.5, 10);
    const cameraPosition = playerPos.clone().add(cameraOffset);
    cameraPosition.y -= 1;
    camera.position.lerp(cameraPosition, 0.1);
    camera.lookAt(playerPos);

    if (snap.phase === 'playing') {
      scoreRef.current += dt * 2;
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
      if (obstacle.position[2] - playerPos.z > 20) {
        obstacle.position = [Math.random() * 8 - 4, 0, playerPos.z - 400] as [
          number,
          number,
          number,
        ];
      }

      const dx = playerPos.x - obstacle.position[0];
      const dz = playerPos.z - obstacle.position[2];
      if (Math.abs(dx) < 1.2 && Math.abs(dz) < 1.5 && playerPos.y < 1.2) {
        if (now - lastDamageTime.current > 600) {
          lastDamageTime.current = now;
          skyBlitzState.health = Math.max(0, skyBlitzState.health - 15);
          obstacle.position = [Math.random() * 8 - 4, 0, playerPos.z - 200] as [
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
        mesh.position.set(
          obstacle.position[0],
          obstacle.position[1],
          obstacle.position[2]
        );
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

      <RunnerGround />

      <group ref={playerRef} position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.8, 1.8, 0.6]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#fcd34d" />
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
          >
            <boxGeometry args={[1, 1.5, 1]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
        ))}
    </>
  );
};

export default RunnerManMode;
