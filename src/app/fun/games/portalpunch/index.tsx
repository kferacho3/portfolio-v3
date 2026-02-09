'use client';

import { Html, PerspectiveCamera, Ring } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import { useSnapshot } from 'valtio';
import {
  buildPatternLibraryTemplate,
  sampleDifficulty,
} from '../../config/ketchapp';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { portalPunchState } from './state';

type Obstacle = {
  id: string;
  z: number;
  lane: -1 | 1;
};

type SpawnRng = {
  next: () => number;
};

const LOOK_AHEAD = 120;
const DESPAWN_Z = -14;
const PLAYER_Z = 0;
const LANE_X: Record<-1 | 1, number> = {
  [-1]: -1.45,
  1: 1.45,
};

const makeRng = (seed: number): SpawnRng => {
  let value = seed >>> 0;
  return {
    next() {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0xffffffff;
    },
  };
};

const chooseChunk = (
  rng: SpawnRng,
  intensity: number,
  library: ReturnType<typeof buildPatternLibraryTemplate>
) => {
  const targetTier = Math.round(intensity * 4);
  let total = 0;
  const weights = library.map((chunk) => {
    const distance = Math.abs(chunk.tier - targetTier);
    const weight = Math.max(0.13, 1.7 - distance * 0.33);
    total += weight;
    return weight;
  });
  const pick = rng.next() * total;
  let cursor = 0;
  for (let i = 0; i < library.length; i += 1) {
    cursor += weights[i];
    if (pick <= cursor) return library[i];
  }
  return library[library.length - 1];
};

const nextLane = (
  chunkId: string,
  i: number,
  previous: -1 | 1,
  rng: SpawnRng
) => {
  if (chunkId === 'C03' || chunkId === 'C04' || chunkId === 'C08') {
    return previous === -1 ? 1 : -1;
  }
  if (chunkId === 'C05') {
    return i < 2 ? previous : previous === -1 ? 1 : -1;
  }
  if (
    chunkId === 'C06' ||
    chunkId === 'C11' ||
    chunkId === 'C13' ||
    chunkId === 'C15'
  ) {
    return rng.next() < 0.7 ? (previous === -1 ? 1 : -1) : previous;
  }
  if (chunkId === 'C12') return previous;
  return rng.next() < 0.5 ? -1 : 1;
};

const resetRun = (
  obstaclesRef: React.MutableRefObject<Obstacle[]>,
  progressRef: React.MutableRefObject<number>,
  nextSpawnZRef: React.MutableRefObject<number>,
  playerLaneRef: React.MutableRefObject<-1 | 1>,
  lastObstacleLaneRef: React.MutableRefObject<-1 | 1>,
  portalFxRef: React.MutableRefObject<number>,
  rngRef: React.MutableRefObject<SpawnRng>
) => {
  obstaclesRef.current = [];
  progressRef.current = 0;
  nextSpawnZRef.current = 18;
  playerLaneRef.current = -1;
  lastObstacleLaneRef.current = 1;
  portalFxRef.current = 0;
  rngRef.current = makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
};

const PortalPunchScene: React.FC = () => {
  const inputRef = useInputRef({ preventDefault: ['space'] });
  const snap = useSnapshot(portalPunchState);

  const elapsedRef = useRef(0);
  const resetVersionRef = useRef(portalPunchState.resetVersion);
  const progressRef = useRef(0);
  const nextSpawnZRef = useRef(18);
  const playerLaneRef = useRef<-1 | 1>(-1);
  const lastObstacleLaneRef = useRef<-1 | 1>(1);
  const portalFxRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const rngRef = useRef<SpawnRng>(
    makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0)
  );

  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('portalpunch'),
    []
  );

  useFrame((_, dt) => {
    const input = inputRef.current;
    const tap = input.pointerJustDown || input.justPressed.has(' ');

    if (portalPunchState.resetVersion !== resetVersionRef.current) {
      resetVersionRef.current = portalPunchState.resetVersion;
      elapsedRef.current = 0;
      resetRun(
        obstaclesRef,
        progressRef,
        nextSpawnZRef,
        playerLaneRef,
        lastObstacleLaneRef,
        portalFxRef,
        rngRef
      );
    }

    if (tap) {
      if (portalPunchState.gameOver) {
        portalPunchState.reset();
        elapsedRef.current = 0;
        resetRun(
          obstaclesRef,
          progressRef,
          nextSpawnZRef,
          playerLaneRef,
          lastObstacleLaneRef,
          portalFxRef,
          rngRef
        );
      } else {
        playerLaneRef.current = playerLaneRef.current === -1 ? 1 : -1;
        portalFxRef.current = 0.18;
      }
    }

    if (!portalPunchState.gameOver) {
      elapsedRef.current += dt;
      const difficulty = sampleDifficulty('lane-switch', elapsedRef.current);
      const intensity = Math.min(
        1,
        Math.max(0, (difficulty.speed - 6.5) / (11.5 - 6.5))
      );

      portalFxRef.current = Math.max(0, portalFxRef.current - dt);
      progressRef.current += difficulty.speed * dt;

      while (nextSpawnZRef.current < progressRef.current + LOOK_AHEAD) {
        const chunk = chooseChunk(rngRef.current, intensity, patternLibrary);
        const hazardCount = Math.max(1, chunk.hazardCount);
        const stride = Math.max(
          2.2,
          (difficulty.speed * chunk.durationSeconds) / hazardCount
        );

        for (let i = 0; i < hazardCount; i += 1) {
          const lane = nextLane(
            chunk.id,
            i,
            lastObstacleLaneRef.current,
            rngRef.current
          );
          lastObstacleLaneRef.current = lane;
          obstaclesRef.current.push({
            id: `${chunk.id}-${nextSpawnZRef.current.toFixed(2)}-${i}`,
            z: nextSpawnZRef.current + stride * (i + 1),
            lane,
          });
        }

        nextSpawnZRef.current += Math.max(
          stride * hazardCount + 1.2,
          difficulty.speed * chunk.durationSeconds + 1.2
        );
      }

      for (let i = obstaclesRef.current.length - 1; i >= 0; i -= 1) {
        const obstacle = obstaclesRef.current[i];
        const relativeZ = obstacle.z - progressRef.current;
        if (relativeZ <= 0.24) {
          if (playerLaneRef.current === obstacle.lane) {
            portalPunchState.gameOver = true;
            break;
          }
          portalPunchState.addScore(1);
          obstaclesRef.current.splice(i, 1);
        } else if (relativeZ < DESPAWN_Z) {
          obstaclesRef.current.splice(i, 1);
        }
      }
    }

    clearFrameInput(inputRef);
  });

  const scoreText = Math.floor(snap.score).toString();
  const bestText = Math.floor(snap.bestScore).toString();
  const playerX = LANE_X[playerLaneRef.current];

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5.2, 9]} fov={42} />
      <color attach="background" args={['#140d1e']} />
      <fog attach="fog" args={['#140d1e', 9, 34]} />
      <ambientLight intensity={0.74} />
      <directionalLight position={[6, 10, 5]} intensity={1.2} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 22]}>
        <planeGeometry args={[14, 150]} />
        <meshStandardMaterial color="#1c132b" />
      </mesh>

      {([-1, 1] as const).map((lane) => (
        <mesh
          key={`lane-${lane}`}
          position={[LANE_X[lane], -0.2, 22]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1.1, 150]} />
          <meshStandardMaterial
            color="#fb7185"
            emissive="#8f3342"
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}

      <mesh position={[playerX, 0.14, PLAYER_Z]}>
        <sphereGeometry args={[0.4, 18, 18]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ff8fa0"
          emissiveIntensity={0.55}
        />
      </mesh>

      {portalFxRef.current > 0 && (
        <Ring
          args={[0.5, 0.8, 24]}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[playerX, 0.18, 0.15]}
        >
          <meshBasicMaterial
            color="#ff9cb7"
            transparent
            opacity={portalFxRef.current / 0.18}
          />
        </Ring>
      )}

      {obstaclesRef.current.map((obstacle) => {
        const z = obstacle.z - progressRef.current;
        if (z < DESPAWN_Z || z > 44) return null;
        return (
          <mesh key={obstacle.id} position={[LANE_X[obstacle.lane], 0.2, z]}>
            <boxGeometry args={[1.1, 1.1, 0.55]} />
            <meshStandardMaterial
              color="#ff5a5f"
              emissive="#922a2e"
              emissiveIntensity={0.68}
            />
          </mesh>
        );
      })}

      <Html fullscreen>
        <div className="pointer-events-none fixed inset-0 p-4 text-white/90">
          <div className="flex items-start justify-between">
            <div className="rounded-md border border-white/20 bg-black/35 px-3 py-2">
              <div className="text-xs uppercase tracking-[0.25em] opacity-70">
                Portal Punch
              </div>
              <div className="text-[11px] opacity-80">
                Tap to punch a portal and swap.
              </div>
            </div>
            <div className="rounded-md border border-white/20 bg-black/35 px-3 py-2 text-right">
              <div className="text-xl font-bold tabular-nums">{scoreText}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                Best {bestText}
              </div>
            </div>
          </div>
          {snap.gameOver && (
            <div className="grid h-full place-items-center">
              <div className="rounded-xl border border-white/20 bg-black/60 px-6 py-5 text-center backdrop-blur-md">
                <div className="text-lg font-semibold">Direct Hit</div>
                <div className="mt-2 text-sm opacity-80">
                  Tap anywhere to retry instantly.
                </div>
              </div>
            </div>
          )}
        </div>
      </Html>
    </>
  );
};

const PortalPunch: React.FC<{ soundsOn?: boolean }> = () => {
  return <PortalPunchScene />;
};

export default PortalPunch;
export * from './state';
