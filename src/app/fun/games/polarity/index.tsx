'use client';

import { Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import { useSnapshot } from 'valtio';
import {
  buildPatternLibraryTemplate,
  sampleDifficulty,
} from '../../config/ketchapp';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { polarityState, type PolarityCharge } from './state';

type Gate = {
  id: string;
  z: number;
  required: PolarityCharge;
  telegraphLate: boolean;
};

type SpawnRng = {
  next: () => number;
};

const LOOK_AHEAD = 110;
const DESPAWN_Z = -12;
const PLAYER_Z = 0;
const RAIL_X: Record<PolarityCharge, number> = {
  1: -1.6,
  [-1]: 1.6,
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
    const tierDistance = Math.abs(chunk.tier - targetTier);
    const weight = Math.max(0.12, 1.75 - tierDistance * 0.35);
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

const nextPolarity = (
  previous: PolarityCharge,
  chunkId: string,
  indexInChunk: number,
  rng: SpawnRng
): PolarityCharge => {
  if (chunkId === 'C03' || chunkId === 'C04' || chunkId === 'C08') {
    return previous === 1 ? -1 : 1;
  }
  if (chunkId === 'C05') {
    return indexInChunk < 2 ? previous : previous === 1 ? -1 : 1;
  }
  if (chunkId === 'C06' || chunkId === 'C11' || chunkId === 'C13') {
    return rng.next() < 0.7 ? (previous === 1 ? -1 : 1) : previous;
  }
  if (chunkId === 'C12') return previous;
  return rng.next() < 0.5 ? 1 : -1;
};

const resetRun = (
  progressRef: React.MutableRefObject<number>,
  nextSpawnZRef: React.MutableRefObject<number>,
  lastGateChargeRef: React.MutableRefObject<PolarityCharge>,
  gatesRef: React.MutableRefObject<Gate[]>,
  rngRef: React.MutableRefObject<SpawnRng>
) => {
  progressRef.current = 0;
  nextSpawnZRef.current = 20;
  lastGateChargeRef.current = 1;
  gatesRef.current = [];
  rngRef.current = makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  polarityState.charge = 1;
};

const PolarityScene: React.FC = () => {
  const inputRef = useInputRef({ preventDefault: ['space'] });

  const progressRef = useRef(0);
  const elapsedRef = useRef(0);
  const nextSpawnZRef = useRef(20);
  const lastGateChargeRef = useRef<PolarityCharge>(1);
  const lastResetVersionRef = useRef(polarityState.resetVersion);
  const gatesRef = useRef<Gate[]>([]);
  const rngRef = useRef<SpawnRng>(
    makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0)
  );

  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('polarity'),
    []
  );
  const snap = useSnapshot(polarityState);

  useFrame((_, dt) => {
    const input = inputRef.current;
    const tap = input.pointerJustDown || input.justPressed.has(' ');

    if (polarityState.resetVersion !== lastResetVersionRef.current) {
      lastResetVersionRef.current = polarityState.resetVersion;
      elapsedRef.current = 0;
      resetRun(progressRef, nextSpawnZRef, lastGateChargeRef, gatesRef, rngRef);
    }

    if (tap) {
      if (polarityState.gameOver) {
        polarityState.reset();
        elapsedRef.current = 0;
        resetRun(
          progressRef,
          nextSpawnZRef,
          lastGateChargeRef,
          gatesRef,
          rngRef
        );
      } else {
        polarityState.flipCharge();
      }
    }

    if (!polarityState.gameOver) {
      elapsedRef.current += dt;
      const difficulty = sampleDifficulty('lane-switch', elapsedRef.current);
      const intensity = Math.min(
        1,
        Math.max(0, (difficulty.speed - 6.5) / (11.5 - 6.5))
      );

      progressRef.current += difficulty.speed * dt;

      while (nextSpawnZRef.current < progressRef.current + LOOK_AHEAD) {
        const chunk = chooseChunk(rngRef.current, intensity, patternLibrary);
        const hazardCount = Math.max(1, chunk.hazardCount);
        const stride = Math.max(
          2.6,
          (difficulty.speed * chunk.durationSeconds) / hazardCount
        );

        for (let i = 0; i < hazardCount; i += 1) {
          const required = nextPolarity(
            lastGateChargeRef.current,
            chunk.id,
            i,
            rngRef.current
          );
          lastGateChargeRef.current = required;
          gatesRef.current.push({
            id: `${chunk.id}-${nextSpawnZRef.current.toFixed(2)}-${i}`,
            z: nextSpawnZRef.current + stride * (i + 1),
            required,
            telegraphLate: chunk.id === 'C07' || chunk.id === 'C13',
          });
        }

        nextSpawnZRef.current += Math.max(
          stride * hazardCount + 1.2,
          difficulty.speed * chunk.durationSeconds + 1.2
        );
      }

      for (let i = gatesRef.current.length - 1; i >= 0; i -= 1) {
        const gate = gatesRef.current[i];
        const relativeZ = gate.z - progressRef.current;
        if (relativeZ <= 0.22) {
          if (polarityState.charge !== gate.required) {
            polarityState.takeDamage(999);
            polarityState.gameOver = true;
            break;
          }
          polarityState.addScore(1);
          gatesRef.current.splice(i, 1);
        } else if (relativeZ < DESPAWN_Z) {
          gatesRef.current.splice(i, 1);
        }
      }
    }

    clearFrameInput(inputRef);
  });

  const playerX = RAIL_X[snap.charge];
  const scoreText = Math.floor(snap.score).toString();
  const bestText = Math.floor(snap.bestScore).toString();

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5.2, 9]} fov={42} />
      <color attach="background" args={['#0a1221']} />
      <fog attach="fog" args={['#0a1221', 9, 34]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 10, 5]} intensity={1.25} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 22]}>
        <planeGeometry args={[14, 140]} />
        <meshStandardMaterial color="#0d1f3a" />
      </mesh>

      {[1 as PolarityCharge, -1 as PolarityCharge].map((charge) => (
        <mesh
          key={`rail-${charge}`}
          position={[RAIL_X[charge], -0.18, 22]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1.2, 140]} />
          <meshStandardMaterial
            color={charge === 1 ? '#20c9b2' : '#ff5a5f'}
            emissive={charge === 1 ? '#0f8b78' : '#ac2f34'}
            emissiveIntensity={0.55}
          />
        </mesh>
      ))}

      <mesh position={[playerX, 0.15, PLAYER_Z]}>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshStandardMaterial
          color={snap.charge === 1 ? '#20c9b2' : '#ff5a5f'}
          emissive={snap.charge === 1 ? '#0a7464' : '#8b2529'}
          emissiveIntensity={0.8}
        />
      </mesh>

      {gatesRef.current.map((gate) => {
        const z = gate.z - progressRef.current;
        const hiddenByLateTelegraph = gate.telegraphLate && z > 10;
        if (hiddenByLateTelegraph || z < DESPAWN_Z || z > 44) return null;
        const gateColor = gate.required === 1 ? '#2fe0ca' : '#ff6b72';
        return (
          <group key={gate.id} position={[RAIL_X[gate.required], 0.18, z]}>
            <mesh>
              <boxGeometry args={[1.2, 1.05, 0.42]} />
              <meshStandardMaterial color={gateColor} emissive={gateColor} />
            </mesh>
            <mesh position={[0, 0, 0.24]}>
              <planeGeometry args={[0.65, 0.65]} />
              <meshBasicMaterial
                color={gate.required === 1 ? '#d5fff6' : '#ffe3e4'}
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
                Polarity
              </div>
              <div className="text-[11px] opacity-80">
                Tap to flip charge and swap rails.
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
                <div className="text-lg font-semibold">Wrong Charge</div>
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

const Polarity: React.FC<{ soundsOn?: boolean }> = () => {
  return <PolarityScene />;
};

export default Polarity;
export * from './state';
