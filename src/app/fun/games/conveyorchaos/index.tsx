'use client';

import { Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  buildPatternLibraryTemplate,
  sampleDifficulty,
} from '../../config/ketchapp';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { conveyorChaosState } from './state';

type Junction = {
  id: string;
  z: number;
  choice: -1 | 1;
  safeDirection: -1 | 1;
  resolved: boolean;
};

type SpawnRng = {
  next: () => number;
};

const LOOK_AHEAD = 130;
const DESPAWN_Z = -14;
const LANE_X: Record<-1 | 1, number> = {
  [-1]: -1.8,
  1: 1.8,
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
    const weight = Math.max(0.14, 1.75 - distance * 0.34);
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

const nextSafeDirection = (
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
    return rng.next() < 0.65 ? (previous === -1 ? 1 : -1) : previous;
  }
  if (chunkId === 'C12') return previous;
  return rng.next() < 0.5 ? -1 : 1;
};

const resetRun = (
  progressRef: React.MutableRefObject<number>,
  nextSpawnZRef: React.MutableRefObject<number>,
  packageLaneRef: React.MutableRefObject<-1 | 1>,
  packageXRef: React.MutableRefObject<number>,
  lastSafeRef: React.MutableRefObject<-1 | 1>,
  junctionsRef: React.MutableRefObject<Junction[]>,
  rngRef: React.MutableRefObject<SpawnRng>
) => {
  progressRef.current = 0;
  nextSpawnZRef.current = 18;
  packageLaneRef.current = -1;
  packageXRef.current = LANE_X[-1];
  lastSafeRef.current = 1;
  junctionsRef.current = [];
  rngRef.current = makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
};

const ConveyorChaosScene: React.FC = () => {
  const inputRef = useInputRef({ preventDefault: ['space'] });
  const snap = useSnapshot(conveyorChaosState);

  const elapsedRef = useRef(0);
  const resetVersionRef = useRef(conveyorChaosState.resetVersion);
  const progressRef = useRef(0);
  const nextSpawnZRef = useRef(18);
  const packageLaneRef = useRef<-1 | 1>(-1);
  const packageXRef = useRef(LANE_X[-1]);
  const lastSafeRef = useRef<-1 | 1>(1);
  const junctionsRef = useRef<Junction[]>([]);
  const rngRef = useRef<SpawnRng>(
    makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0)
  );

  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('conveyorchaos'),
    []
  );

  useFrame((_, dt) => {
    const input = inputRef.current;
    const tap = input.pointerJustDown || input.justPressed.has(' ');

    if (conveyorChaosState.resetVersion !== resetVersionRef.current) {
      resetVersionRef.current = conveyorChaosState.resetVersion;
      elapsedRef.current = 0;
      resetRun(
        progressRef,
        nextSpawnZRef,
        packageLaneRef,
        packageXRef,
        lastSafeRef,
        junctionsRef,
        rngRef
      );
    }

    if (tap) {
      if (conveyorChaosState.gameOver) {
        conveyorChaosState.reset();
        elapsedRef.current = 0;
        resetRun(
          progressRef,
          nextSpawnZRef,
          packageLaneRef,
          packageXRef,
          lastSafeRef,
          junctionsRef,
          rngRef
        );
      } else {
        const nextJunction = junctionsRef.current.find(
          (junction) =>
            !junction.resolved && junction.z - progressRef.current > 0.7
        );
        if (nextJunction) {
          nextJunction.choice = nextJunction.choice === -1 ? 1 : -1;
        }
      }
    }

    if (!conveyorChaosState.gameOver) {
      elapsedRef.current += dt;
      const difficulty = sampleDifficulty('routing', elapsedRef.current);
      const intensity = Math.min(
        1,
        Math.max(0, (difficulty.speed - 3.4) / (6.2 - 3.4))
      );

      progressRef.current += difficulty.speed * dt;

      while (nextSpawnZRef.current < progressRef.current + LOOK_AHEAD) {
        const chunk = chooseChunk(rngRef.current, intensity, patternLibrary);
        const count = Math.max(1, chunk.hazardCount);
        const stride = Math.max(
          3.2,
          (difficulty.speed * chunk.durationSeconds) / count + 2
        );

        for (let i = 0; i < count; i += 1) {
          const safe = nextSafeDirection(
            chunk.id,
            i,
            lastSafeRef.current,
            rngRef.current
          );
          lastSafeRef.current = safe;
          const defaultChoice = rngRef.current.next() < 0.5 ? -1 : 1;
          junctionsRef.current.push({
            id: `${chunk.id}-${nextSpawnZRef.current.toFixed(2)}-${i}`,
            z: nextSpawnZRef.current + stride * (i + 1),
            choice: defaultChoice,
            safeDirection: safe,
            resolved: false,
          });
        }

        nextSpawnZRef.current += Math.max(
          stride * count + 1.4,
          difficulty.speed * chunk.durationSeconds + 1.6
        );
      }

      for (let i = 0; i < junctionsRef.current.length; i += 1) {
        const junction = junctionsRef.current[i];
        if (junction.resolved) continue;
        if (junction.z - progressRef.current <= 0.24) {
          junction.resolved = true;
          if (junction.choice !== junction.safeDirection) {
            conveyorChaosState.gameOver = true;
            break;
          }
          packageLaneRef.current = junction.choice;
          conveyorChaosState.addScore(1);
        }
      }

      packageXRef.current = THREE.MathUtils.lerp(
        packageXRef.current,
        LANE_X[packageLaneRef.current],
        dt * 7.5
      );

      for (let i = junctionsRef.current.length - 1; i >= 0; i -= 1) {
        const relativeZ = junctionsRef.current[i].z - progressRef.current;
        if (relativeZ < DESPAWN_Z) junctionsRef.current.splice(i, 1);
      }
    }

    clearFrameInput(inputRef);
  });

  const nextJunction = junctionsRef.current.find(
    (junction) => !junction.resolved && junction.z - progressRef.current > 0.7
  );
  const scoreText = Math.floor(snap.score).toString();
  const bestText = Math.floor(snap.bestScore).toString();

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5.4, 9]} fov={43} />
      <color attach="background" args={['#15150f']} />
      <fog attach="fog" args={['#15150f', 9, 36]} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[6, 10, 5]} intensity={1.3} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 24]}>
        <planeGeometry args={[16, 160]} />
        <meshStandardMaterial color="#2a2415" />
      </mesh>

      {([-1, 1] as const).map((lane) => (
        <mesh
          key={`belt-${lane}`}
          position={[LANE_X[lane], -0.18, 24]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[2.4, 160]} />
          <meshStandardMaterial
            color="#3e341d"
            emissive="#685123"
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}

      <mesh position={[packageXRef.current, 0.14, 0]}>
        <boxGeometry args={[0.66, 0.66, 0.66]} />
        <meshStandardMaterial
          color="#ffe9a8"
          emissive="#8f7a3e"
          emissiveIntensity={0.35}
        />
      </mesh>

      {junctionsRef.current.map((junction) => {
        const z = junction.z - progressRef.current;
        if (z < DESPAWN_Z || z > 44) return null;
        return (
          <group key={junction.id} position={[0, 0.08, z]}>
            <mesh position={[0, -0.08, 0]}>
              <boxGeometry args={[6.2, 0.18, 0.82]} />
              <meshStandardMaterial color="#615126" />
            </mesh>
            <mesh position={[LANE_X[junction.safeDirection], 0.15, 0]}>
              <boxGeometry args={[2.1, 0.3, 0.72]} />
              <meshStandardMaterial
                color="#22c55e"
                emissive="#177239"
                emissiveIntensity={0.55}
              />
            </mesh>
            <mesh
              position={[
                LANE_X[junction.safeDirection === -1 ? 1 : -1],
                0.15,
                0,
              ]}
            >
              <boxGeometry args={[2.1, 0.3, 0.72]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#7f2323"
                emissiveIntensity={0.55}
              />
            </mesh>
            <mesh
              position={[LANE_X[junction.choice], 0.55, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <coneGeometry args={[0.22, 0.5, 3]} />
              <meshStandardMaterial
                color="#fef3c7"
                emissive="#8a7338"
                emissiveIntensity={0.45}
              />
            </mesh>
          </group>
        );
      })}

      <Html fullscreen>
        <div className="pointer-events-none fixed inset-0 p-4 text-white/90">
          <div className="flex items-start justify-between">
            <div className="rounded-md border border-white/20 bg-black/35 px-3 py-2">
              <div className="text-xs uppercase tracking-[0.25em] opacity-70">
                Conveyor Chaos
              </div>
              <div className="text-[11px] opacity-80">
                Tap to switch the next junction.
              </div>
            </div>
            <div className="rounded-md border border-white/20 bg-black/35 px-3 py-2 text-right">
              <div className="text-xl font-bold tabular-nums">{scoreText}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                Best {bestText}
              </div>
            </div>
          </div>
          {nextJunction && !snap.gameOver && (
            <div className="mt-3 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs">
              Next Junction:{' '}
              <span className="font-semibold">
                {nextJunction.choice === -1 ? 'Left' : 'Right'}
              </span>
            </div>
          )}
          {snap.gameOver && (
            <div className="grid h-full place-items-center">
              <div className="rounded-xl border border-white/20 bg-black/60 px-6 py-5 text-center backdrop-blur-md">
                <div className="text-lg font-semibold">Wrong Route</div>
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

const ConveyorChaos: React.FC<{ soundsOn?: boolean }> = () => {
  return <ConveyorChaosScene />;
};

export default ConveyorChaos;
export * from './state';
