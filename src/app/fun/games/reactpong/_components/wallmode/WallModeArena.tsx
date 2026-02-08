import { Physics, type RapierRigidBody } from '@react-three/rapier';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  WALL_MODE_BALL_OFFSET,
  WALL_MODE_DEPTH,
  WALL_MODE_HEIGHT,
  WALL_MODE_PLAYER_Z,
  WALL_MODE_WALL_Z,
  WALL_MODE_WIDTH,
} from '../../constants';
import { reactPongState } from '../../state';
import HitParticles from '../HitParticles';
import ScorePopups from '../ScorePopups';
import OpposingWall from './OpposingWall';
import WallModeBall from './WallModeBall';
import WallModeBounds from './WallModeBounds';
import WallModePaddle from './WallModePaddle';
import WallModeUI from './WallModeUI';

interface WallModeArenaProps {
  scoreColor: string;
  ballColor: string;
}

const guideMaterial = new THREE.MeshBasicMaterial({
  color: '#38bdf8',
  transparent: true,
  opacity: 0.18,
});

const WallModeArena: React.FC<WallModeArenaProps> = ({
  scoreColor,
  ballColor,
}) => {
  const { scorePopups, hitEffects } = useSnapshot(reactPongState);
  const ballRef = useRef<RapierRigidBody | null>(null);
  const tunnelDepth = WALL_MODE_DEPTH + 2;
  const roomShellSize = useMemo<[number, number, number]>(
    () => [WALL_MODE_WIDTH + 0.85, WALL_MODE_HEIGHT + 0.85, tunnelDepth],
    [tunnelDepth]
  );
  const halfW = WALL_MODE_WIDTH / 2;
  const halfH = WALL_MODE_HEIGHT / 2;

  return (
    <>
      <ambientLight intensity={0.22} />
      <hemisphereLight intensity={0.34} color="#67e8f9" groundColor="#0f172a" />
      <pointLight position={[0, 0, 8.5]} intensity={0.56} color="#67e8f9" />
      <pointLight
        position={[0, 0, WALL_MODE_WALL_Z + 1.8]}
        intensity={0.44}
        distance={17}
        color="#818cf8"
      />

      <mesh>
        <boxGeometry args={roomShellSize} />
        <meshBasicMaterial color="#081120" side={THREE.BackSide} />
      </mesh>

      <mesh position={[-halfW + 0.02, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[tunnelDepth * 0.95, WALL_MODE_HEIGHT]} />
        <meshBasicMaterial color="#5b21b6" transparent opacity={0.2} />
      </mesh>
      <mesh position={[halfW - 0.02, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[tunnelDepth * 0.95, WALL_MODE_HEIGHT]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, -halfH + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WALL_MODE_WIDTH, tunnelDepth * 0.95]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, halfH - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WALL_MODE_WIDTH, tunnelDepth * 0.95]} />
        <meshBasicMaterial color="#1e3a8a" transparent opacity={0.2} />
      </mesh>

      <group>
        {Array.from({ length: 12 }).map((_, i) => {
          const z = WALL_MODE_PLAYER_Z - i * 2.1;
          return (
            <mesh
              key={`guide-z-${i}`}
              position={[0, -halfH + 0.44, z]}
              material={guideMaterial}
            >
              <boxGeometry args={[WALL_MODE_WIDTH * 0.94, 0.02, 0.02]} />
            </mesh>
          );
        })}
        {Array.from({ length: 9 }).map((_, i) => {
          const x = -WALL_MODE_WIDTH / 2 + 0.9 + i * 1.8;
          return (
            <mesh
              key={`guide-x-${i}`}
              position={[x, 0, -WALL_MODE_DEPTH * 0.16]}
              material={guideMaterial}
            >
              <boxGeometry
                args={[0.012, WALL_MODE_HEIGHT * 0.78, WALL_MODE_DEPTH * 0.78]}
              />
            </mesh>
          );
        })}
      </group>

      <ScorePopups popups={[...scorePopups]} />
      <HitParticles effects={[...hitEffects]} />

      <Physics gravity={[0, 0, 0]} timeStep="vary">
        <WallModeBall
          position={[0, 0, WALL_MODE_PLAYER_Z - WALL_MODE_BALL_OFFSET]}
          ballColor={ballColor}
          onBodyReady={(body) => {
            ballRef.current = body;
          }}
        />
        <WallModePaddle ballRef={ballRef} scoreColor={scoreColor} />
        <OpposingWall ballRef={ballRef} />
        <WallModeBounds />
      </Physics>

      <WallModeUI />
    </>
  );
};

export default WallModeArena;
