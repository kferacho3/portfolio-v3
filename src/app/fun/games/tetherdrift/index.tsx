'use client';

import { Html, Line, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import {
  buildPatternLibraryTemplate,
  pickPatternChunkForSurvivability,
  sampleSurvivability,
  sampleDifficulty,
} from '../../config/ketchapp';
import { KetchappGameShell } from '../_shared/KetchappGameShell';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { tetherDriftState } from './state';

type Anchor = {
  id: string;
  x: number;
  z: number;
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
};

type SpawnRng = {
  next: () => number;
};

const LOOK_AHEAD = 130;
const DESPAWN_Z = -18;
const CAPTURE_RADIUS = 2.25;
const ORBIT_RADIUS = 1.5;
const DRIFT_FAIL_TIME = 2.1;

const makeRng = (seed: number): SpawnRng => {
  let value = seed >>> 0;
  return {
    next() {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0xffffffff;
    },
  };
};

const anchorOffsetForChunk = (chunkId: string, i: number, rng: SpawnRng) => {
  if (chunkId === 'C03' || chunkId === 'C04') {
    return i % 2 === 0 ? -2.2 : 2.2;
  }
  if (chunkId === 'C05') {
    return i < 2 ? -1.8 : 2.4;
  }
  if (chunkId === 'C08' || chunkId === 'C13') {
    return (rng.next() * 2 - 1) * 2.8;
  }
  if (chunkId === 'C11' || chunkId === 'C14' || chunkId === 'C15') {
    return (rng.next() * 2 - 1) * 3.3;
  }
  return (rng.next() * 2 - 1) * 2.1;
};

const resetRun = (
  anchorsRef: React.MutableRefObject<Anchor[]>,
  nextAnchorZRef: React.MutableRefObject<number>,
  posRef: React.MutableRefObject<THREE.Vector3>,
  velRef: React.MutableRefObject<THREE.Vector3>,
  tetheredAnchorRef: React.MutableRefObject<number>,
  orbitAngleRef: React.MutableRefObject<number>,
  driftTimeRef: React.MutableRefObject<number>,
  rngRef: React.MutableRefObject<SpawnRng>
) => {
  anchorsRef.current = [];
  nextAnchorZRef.current = 10;
  posRef.current.set(0, 0.35, 0);
  velRef.current.set(0, 0, 6);
  tetheredAnchorRef.current = -1;
  orbitAngleRef.current = 0;
  driftTimeRef.current = 0;
  rngRef.current = makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
};

const TetherDriftScene: React.FC = () => {
  const inputRef = useInputRef({ preventDefault: ['space'] });
  const snap = useSnapshot(tetherDriftState);
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);

  const elapsedRef = useRef(0);
  const resetVersionRef = useRef(tetherDriftState.resetVersion);
  const wasHoldingRef = useRef(false);

  const playerPosRef = useRef(new THREE.Vector3(0, 0.35, 0));
  const playerVelRef = useRef(new THREE.Vector3(0, 0, 6));
  const tetheredAnchorRef = useRef(-1);
  const orbitAngleRef = useRef(0);
  const nextAnchorZRef = useRef(10);
  const driftTimeRef = useRef(0);
  const anchorsRef = useRef<Anchor[]>([]);
  const rngRef = useRef<SpawnRng>(
    makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0)
  );

  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('tetherdrift'),
    []
  );

  useFrame((state, dt) => {
    const input = inputRef.current;
    const tap = input.pointerJustDown || input.justPressed.has(' ');
    const holding = input.pointerDown || input.keysDown.has(' ');

    if (tetherDriftState.resetVersion !== resetVersionRef.current) {
      resetVersionRef.current = tetherDriftState.resetVersion;
      elapsedRef.current = 0;
      startedRef.current = false;
      setStarted(false);
      resetRun(
        anchorsRef,
        nextAnchorZRef,
        playerPosRef,
        playerVelRef,
        tetheredAnchorRef,
        orbitAngleRef,
        driftTimeRef,
        rngRef
      );
    }

    if (tap && tetherDriftState.gameOver) {
      tetherDriftState.reset();
      elapsedRef.current = 0;
      resetRun(
        anchorsRef,
        nextAnchorZRef,
        playerPosRef,
        playerVelRef,
        tetheredAnchorRef,
        orbitAngleRef,
        driftTimeRef,
        rngRef
      );
      startedRef.current = true;
      setStarted(true);
    } else if (!startedRef.current && (tap || holding)) {
      startedRef.current = true;
      setStarted(true);
    }

    if (startedRef.current && !tetherDriftState.gameOver) {
      elapsedRef.current += dt;
      const difficulty = sampleDifficulty('swing-chain', elapsedRef.current);
      const survivability = sampleSurvivability(
        'tetherdrift',
        elapsedRef.current
      );
      const intensity = Math.min(
        1,
        Math.max(0, (difficulty.speed - 4.2) / (7.8 - 4.2))
      );
      const captureRadius = CAPTURE_RADIUS * survivability.decisionWindowScale;
      const driftFailTime = DRIFT_FAIL_TIME * survivability.decisionWindowScale;

      while (nextAnchorZRef.current < playerPosRef.current.z + LOOK_AHEAD) {
        const chunk = pickPatternChunkForSurvivability(
          'tetherdrift',
          patternLibrary,
          rngRef.current.next,
          intensity,
          elapsedRef.current
        );
        const count = Math.max(
          1,
          Math.round(chunk.hazardCount * survivability.hazardScale)
        );
        const stride = Math.max(
          4 * survivability.telegraphScale,
          ((difficulty.speed * chunk.durationSeconds) / count + 2.4) *
            survivability.telegraphScale
        );

        for (let i = 0; i < count; i += 1) {
          const x = anchorOffsetForChunk(chunk.id, i, rngRef.current);
          const wobbleAmp =
            chunk.tier >= 2 && rngRef.current.next() < 0.45 ? 0.6 : 0;
          anchorsRef.current.push({
            id: `${chunk.id}-${nextAnchorZRef.current.toFixed(2)}-${i}`,
            x,
            z: nextAnchorZRef.current + stride * (i + 1),
            wobbleAmp,
            wobbleFreq: 1.2 + rngRef.current.next() * 1.6,
            wobblePhase: rngRef.current.next() * Math.PI * 2,
          });
        }

        nextAnchorZRef.current += Math.max(
          stride * count + 2,
          difficulty.speed * chunk.durationSeconds + 3
        );
      }

      let anchoredX = 0;
      let anchoredZ = 0;
      if (tetheredAnchorRef.current >= 0) {
        const anchor = anchorsRef.current[tetheredAnchorRef.current];
        if (anchor) {
          anchoredX =
            anchor.x +
            Math.sin(
              state.clock.elapsedTime * anchor.wobbleFreq + anchor.wobblePhase
            ) *
              anchor.wobbleAmp;
          anchoredZ = anchor.z;
        }
      }

      if (holding) {
        if (tetheredAnchorRef.current < 0) {
          let bestIndex = -1;
          let bestDistSq = captureRadius * captureRadius;
          for (let i = 0; i < anchorsRef.current.length; i += 1) {
            const anchor = anchorsRef.current[i];
            const ax =
              anchor.x +
              Math.sin(
                state.clock.elapsedTime * anchor.wobbleFreq + anchor.wobblePhase
              ) *
                anchor.wobbleAmp;
            const dz = anchor.z - playerPosRef.current.z;
            if (dz < -0.5) continue;
            const dx = ax - playerPosRef.current.x;
            const distSq = dx * dx + dz * dz;
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              bestIndex = i;
            }
          }
          if (bestIndex >= 0) {
            tetheredAnchorRef.current = bestIndex;
            const anchor = anchorsRef.current[bestIndex];
            const ax =
              anchor.x +
              Math.sin(
                state.clock.elapsedTime * anchor.wobbleFreq + anchor.wobblePhase
              ) *
                anchor.wobbleAmp;
            orbitAngleRef.current = Math.atan2(
              playerPosRef.current.z - anchor.z,
              playerPosRef.current.x - ax
            );
            driftTimeRef.current = 0;
            tetherDriftState.addScore(1);
          }
        } else {
          orbitAngleRef.current +=
            (2.1 + intensity * 1.2) * survivability.intensityScale * dt;
          const orbitX = Math.cos(orbitAngleRef.current) * ORBIT_RADIUS;
          const orbitZ = Math.sin(orbitAngleRef.current) * ORBIT_RADIUS * 0.6;
          playerPosRef.current.set(
            anchoredX + orbitX,
            0.35,
            anchoredZ + orbitZ
          );
          driftTimeRef.current = 0;
        }
      }

      if (!holding && wasHoldingRef.current && tetheredAnchorRef.current >= 0) {
        const tangent = new THREE.Vector3(
          -Math.sin(orbitAngleRef.current),
          0,
          Math.cos(orbitAngleRef.current) * 0.62 + 0.9
        ).normalize();
        playerVelRef.current.copy(
          tangent.multiplyScalar(difficulty.speed * (1.4 + intensity * 0.2))
        );
        tetheredAnchorRef.current = -1;
      }

      if (tetheredAnchorRef.current < 0) {
        playerPosRef.current.addScaledVector(playerVelRef.current, dt);
        playerVelRef.current.z = THREE.MathUtils.lerp(
          playerVelRef.current.z,
          difficulty.speed * 1.1,
          dt * 2.2
        );
        playerVelRef.current.x *= 1 - dt * 1.35;
        driftTimeRef.current += dt;
        if (driftTimeRef.current >= driftFailTime) {
          tetherDriftState.gameOver = true;
        }
      }

      for (let i = anchorsRef.current.length - 1; i >= 0; i -= 1) {
        if (anchorsRef.current[i].z < playerPosRef.current.z + DESPAWN_Z) {
          anchorsRef.current.splice(i, 1);
        }
      }
    }

    wasHoldingRef.current = holding;
    clearFrameInput(inputRef);
  });

  const scoreText = Math.floor(snap.score).toString();
  const bestText = Math.floor(snap.bestScore).toString();
  const shellStatus = snap.gameOver
    ? 'gameover'
    : started
      ? 'playing'
      : 'ready';
  const player = playerPosRef.current;
  const tetheredAnchor =
    tetheredAnchorRef.current >= 0
      ? anchorsRef.current[tetheredAnchorRef.current]
      : null;
  const anchorX =
    tetheredAnchor != null
      ? tetheredAnchor.x +
        Math.sin(
          elapsedRef.current * tetheredAnchor.wobbleFreq +
            tetheredAnchor.wobblePhase
        ) *
          tetheredAnchor.wobbleAmp
      : 0;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 6.4, 8]}
        rotation={[-0.38, 0, 0]}
        fov={44}
      />
      <color attach="background" args={['#0d1226']} />
      <fog attach="fog" args={['#0d1226', 8, 36]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[7, 12, 5]} intensity={1.35} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.35, player.z + 26]}
      >
        <planeGeometry args={[24, 220]} />
        <meshStandardMaterial color="#121b39" />
      </mesh>

      <mesh position={[player.x, player.y, 0]}>
        <sphereGeometry args={[0.38, 18, 18]} />
        <meshStandardMaterial
          color="#a78bfa"
          emissive="#5b47a4"
          emissiveIntensity={0.85}
        />
      </mesh>

      {tetheredAnchor && (
        <Line
          points={[
            [player.x, player.y, 0],
            [anchorX, 0.25, tetheredAnchor.z - player.z],
          ]}
          color="#d8d1ff"
          lineWidth={2}
          transparent
          opacity={0.9}
        />
      )}

      {anchorsRef.current.map((anchor) => {
        const z = anchor.z - player.z;
        if (z < DESPAWN_Z || z > 44) return null;
        const x =
          anchor.x +
          Math.sin(
            elapsedRef.current * anchor.wobbleFreq + anchor.wobblePhase
          ) *
            anchor.wobbleAmp;
        return (
          <group key={anchor.id} position={[x, 0.25, z]}>
            <mesh>
              <sphereGeometry args={[0.36, 14, 14]} />
              <meshStandardMaterial
                color="#63e6ff"
                emissive="#1f97af"
                emissiveIntensity={0.7}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.85, 0.07, 10, 24]} />
              <meshStandardMaterial
                color="#63e6ff"
                emissive="#1f97af"
                emissiveIntensity={0.65}
              />
            </mesh>
          </group>
        );
      })}

      <Html fullscreen>
        <KetchappGameShell
          gameId="tetherdrift"
          score={scoreText}
          best={bestText}
          status={shellStatus}
          deathTitle="Missed The Chain"
          containerClassName="fixed inset-0"
          startCtaText="Tap to start, then hold to tether."
        />
      </Html>
    </>
  );
};

const TetherDrift: React.FC<{ soundsOn?: boolean }> = () => {
  return <TetherDriftScene />;
};

export default TetherDrift;
export * from './state';
