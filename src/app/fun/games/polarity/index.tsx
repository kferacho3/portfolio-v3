'use client';

import { Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  buildPatternLibraryTemplate,
  pickPatternChunkForSurvivability,
  sampleSurvivability,
  sampleDifficulty,
} from '../../config/ketchapp';
import { KetchappGameShell } from '../_shared/KetchappGameShell';
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
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);

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
      startedRef.current = false;
      setStarted(false);
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
        startedRef.current = true;
        setStarted(true);
      } else if (!startedRef.current) {
        startedRef.current = true;
        setStarted(true);
      } else {
        polarityState.flipCharge();
      }
    }

    if (startedRef.current && !polarityState.gameOver) {
      elapsedRef.current += dt;
      const difficulty = sampleDifficulty('lane-switch', elapsedRef.current);
      const survivability = sampleSurvivability('polarity', elapsedRef.current);
      const intensity = Math.min(
        1,
        Math.max(0, (difficulty.speed - 6.5) / (11.5 - 6.5))
      );

      progressRef.current += difficulty.speed * dt;

      while (nextSpawnZRef.current < progressRef.current + LOOK_AHEAD) {
        const chunk = pickPatternChunkForSurvivability(
          'polarity',
          patternLibrary,
          rngRef.current.next,
          intensity,
          elapsedRef.current
        );
        const hazardCount = Math.max(
          1,
          Math.round(chunk.hazardCount * survivability.hazardScale)
        );
        const stride = Math.max(
          2.6 * survivability.telegraphScale,
          ((difficulty.speed * chunk.durationSeconds) / hazardCount) *
            survivability.telegraphScale
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
            telegraphLate:
              (chunk.id === 'C07' || chunk.id === 'C13') &&
              survivability.onboarding < 0.45,
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
        const gateHitThreshold =
          0.22 + (survivability.decisionWindowScale - 1) * 0.12;
        if (relativeZ <= gateHitThreshold) {
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
  const survivability = sampleSurvivability('polarity', elapsedRef.current);
  const lateTelegraphHideZ = 10 / survivability.telegraphScale;
  const shellStatus = snap.gameOver
    ? 'gameover'
    : started
      ? 'playing'
      : 'ready';

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
        const hiddenByLateTelegraph =
          gate.telegraphLate && z > lateTelegraphHideZ;
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
        <KetchappGameShell
          gameId="polarity"
          score={scoreText}
          best={bestText}
          status={shellStatus}
          deathTitle="Wrong Charge"
          containerClassName="fixed inset-0"
        />
      </Html>
    </>
  );
};

const Polarity: React.FC<{ soundsOn?: boolean }> = () => {
  return <PolarityScene />;
};

export default Polarity;
export * from './state';
