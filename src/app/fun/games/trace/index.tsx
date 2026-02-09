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
import { traceState } from './state';

type PathNode = {
  z: number;
  x: number;
  width: number;
};

type SpawnRng = {
  next: () => number;
};

const LOOK_AHEAD = 170;
const DESPAWN_Z = -18;
const MAX_X = 4.2;

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

const nextCenterX = (
  previousX: number,
  chunkId: string,
  nodeIndex: number,
  rng: SpawnRng
) => {
  if (chunkId === 'C03' || chunkId === 'C04') {
    const sign = nodeIndex % 2 === 0 ? -1 : 1;
    return THREE.MathUtils.clamp(previousX + sign * 1.6, -MAX_X, MAX_X);
  }
  if (chunkId === 'C05') {
    const sign = nodeIndex < 2 ? -1 : 1;
    return THREE.MathUtils.clamp(previousX + sign * 1.5, -MAX_X, MAX_X);
  }
  if (chunkId === 'C08' || chunkId === 'C10' || chunkId === 'C13') {
    const sign = rng.next() < 0.5 ? -1 : 1;
    return THREE.MathUtils.clamp(previousX + sign * 2.15, -MAX_X, MAX_X);
  }
  if (chunkId === 'C11' || chunkId === 'C14' || chunkId === 'C15') {
    const sign = rng.next() < 0.5 ? -1 : 1;
    return THREE.MathUtils.clamp(previousX + sign * 2.6, -MAX_X, MAX_X);
  }
  return THREE.MathUtils.clamp(
    previousX + (rng.next() * 2 - 1) * 1.25,
    -MAX_X,
    MAX_X
  );
};

const resetRun = (
  nodesRef: React.MutableRefObject<PathNode[]>,
  nextNodeZRef: React.MutableRefObject<number>,
  lastXRef: React.MutableRefObject<number>,
  playerXRef: React.MutableRefObject<number>,
  progressRef: React.MutableRefObject<number>,
  distanceBucketRef: React.MutableRefObject<number>,
  rngRef: React.MutableRefObject<SpawnRng>
) => {
  progressRef.current = 0;
  nextNodeZRef.current = 0;
  lastXRef.current = 0;
  playerXRef.current = 0;
  distanceBucketRef.current = 0;
  nodesRef.current = [{ z: 0, x: 0, width: 3.4 }];
  rngRef.current = makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
};

const samplePathAt = (nodes: PathNode[], z: number) => {
  if (nodes.length === 0) return { x: 0, width: 2.8 };
  if (z <= nodes[0].z) return { x: nodes[0].x, width: nodes[0].width };

  for (let i = 1; i < nodes.length; i += 1) {
    const prev = nodes[i - 1];
    const next = nodes[i];
    if (z <= next.z) {
      const t = (z - prev.z) / Math.max(0.0001, next.z - prev.z);
      return {
        x: THREE.MathUtils.lerp(prev.x, next.x, t),
        width: THREE.MathUtils.lerp(prev.width, next.width, t),
      };
    }
  }
  const last = nodes[nodes.length - 1];
  return { x: last.x, width: last.width };
};

const TraceScene: React.FC = () => {
  const inputRef = useInputRef();
  const snap = useSnapshot(traceState);

  const elapsedRef = useRef(0);
  const resetVersionRef = useRef(traceState.resetVersion);
  const progressRef = useRef(0);
  const nextNodeZRef = useRef(0);
  const playerXRef = useRef(0);
  const lastXRef = useRef(0);
  const distanceBucketRef = useRef(0);
  const nodesRef = useRef<PathNode[]>([{ z: 0, x: 0, width: 3.4 }]);
  const rngRef = useRef<SpawnRng>(
    makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0)
  );

  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('trace'),
    []
  );

  useFrame((_, dt) => {
    const input = inputRef.current;
    const tap = input.pointerJustDown || input.justPressed.has(' ');

    if (traceState.resetVersion !== resetVersionRef.current) {
      resetVersionRef.current = traceState.resetVersion;
      elapsedRef.current = 0;
      resetRun(
        nodesRef,
        nextNodeZRef,
        lastXRef,
        playerXRef,
        progressRef,
        distanceBucketRef,
        rngRef
      );
    }

    if (tap && traceState.gameOver) {
      traceState.reset();
      elapsedRef.current = 0;
      resetRun(
        nodesRef,
        nextNodeZRef,
        lastXRef,
        playerXRef,
        progressRef,
        distanceBucketRef,
        rngRef
      );
    }

    if (!traceState.gameOver) {
      elapsedRef.current += dt;
      const difficulty = sampleDifficulty('path-follow', elapsedRef.current);
      const intensity = Math.min(
        1,
        Math.max(0, (difficulty.speed - 4.8) / (8.2 - 4.8))
      );

      const dragTargetX = input.pointerX * MAX_X;
      const steerStrength = input.pointerDown ? 12 : 4;
      playerXRef.current = THREE.MathUtils.lerp(
        playerXRef.current,
        dragTargetX,
        dt * steerStrength
      );
      playerXRef.current = THREE.MathUtils.clamp(
        playerXRef.current,
        -MAX_X,
        MAX_X
      );

      progressRef.current += difficulty.speed * dt;

      distanceBucketRef.current += difficulty.speed * dt;
      while (distanceBucketRef.current >= 1) {
        traceState.addScore(1);
        distanceBucketRef.current -= 1;
      }

      const widthScale = THREE.MathUtils.clamp(
        difficulty.decisionWindowMs / 560,
        0.48,
        1
      );

      while (nextNodeZRef.current < progressRef.current + LOOK_AHEAD) {
        const chunk = chooseChunk(rngRef.current, intensity, patternLibrary);
        const nodeCount = Math.max(2, Math.round(chunk.durationSeconds * 3));
        const stride = Math.max(
          1.6,
          (difficulty.speed * chunk.durationSeconds) / nodeCount
        );

        for (let i = 0; i < nodeCount; i += 1) {
          const x = nextCenterX(lastXRef.current, chunk.id, i, rngRef.current);
          lastXRef.current = x;
          const width = THREE.MathUtils.clamp(
            (1.6 + (4 - chunk.tier) * 0.45) * widthScale,
            1.15,
            3.6
          );
          nextNodeZRef.current += stride;
          nodesRef.current.push({
            z: nextNodeZRef.current,
            x,
            width,
          });
        }
      }

      const pathSample = samplePathAt(nodesRef.current, progressRef.current);
      if (
        Math.abs(playerXRef.current - pathSample.x) >
        pathSample.width * 0.5
      ) {
        traceState.gameOver = true;
      }

      while (
        nodesRef.current.length > 6 &&
        nodesRef.current[1].z < progressRef.current + DESPAWN_Z
      ) {
        nodesRef.current.shift();
      }
    }

    clearFrameInput(inputRef);
  });

  const visiblePairs: Array<{ a: PathNode; b: PathNode }> = [];
  for (let i = 1; i < nodesRef.current.length; i += 1) {
    const a = nodesRef.current[i - 1];
    const b = nodesRef.current[i];
    const relativeZ = b.z - progressRef.current;
    if (relativeZ < DESPAWN_Z || relativeZ > 46) continue;
    visiblePairs.push({ a, b });
  }

  const scoreText = Math.floor(snap.score).toString();
  const bestText = Math.floor(snap.bestScore).toString();

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5.8, 8.2]} fov={46} />
      <color attach="background" args={['#091021']} />
      <fog attach="fog" args={['#091021', 9, 36]} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[5, 10, 6]} intensity={1.25} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 24]}>
        <planeGeometry args={[20, 200]} />
        <meshStandardMaterial color="#0b1734" />
      </mesh>

      {visiblePairs.map(({ a, b }) => {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const segmentLength = Math.sqrt(dx * dx + dz * dz);
        const centerX = (a.x + b.x) * 0.5;
        const centerZ = (a.z + b.z) * 0.5 - progressRef.current;
        const width = (a.width + b.width) * 0.5;
        const angle = Math.atan2(dx, dz);
        return (
          <group key={`${a.z.toFixed(2)}-${b.z.toFixed(2)}`}>
            <mesh position={[centerX, -0.2, centerZ]} rotation={[0, angle, 0]}>
              <boxGeometry args={[width, 0.02, segmentLength]} />
              <meshStandardMaterial
                color="#20c9b2"
                emissive="#107c70"
                emissiveIntensity={0.58}
              />
            </mesh>
            <mesh
              position={[centerX + width * 0.5, -0.17, centerZ]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.06, 0.08, segmentLength]} />
              <meshStandardMaterial
                color="#ff5a5f"
                emissive="#8e272b"
                emissiveIntensity={0.35}
              />
            </mesh>
            <mesh
              position={[centerX - width * 0.5, -0.17, centerZ]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.06, 0.08, segmentLength]} />
              <meshStandardMaterial
                color="#ff5a5f"
                emissive="#8e272b"
                emissiveIntensity={0.35}
              />
            </mesh>
          </group>
        );
      })}

      <mesh position={[playerXRef.current, 0.1, 0]}>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshStandardMaterial
          color="#ffe066"
          emissive="#9f8a2f"
          emissiveIntensity={0.75}
        />
      </mesh>

      <Html fullscreen>
        <div className="pointer-events-none fixed inset-0 p-4 text-white/90">
          <div className="flex items-start justify-between">
            <div className="rounded-md border border-white/20 bg-black/35 px-3 py-2">
              <div className="text-xs uppercase tracking-[0.25em] opacity-70">
                Trace
              </div>
              <div className="text-[11px] opacity-80">
                Drag to stay on the line.
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
                <div className="text-lg font-semibold">Off The Path</div>
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

const Trace: React.FC<{ soundsOn?: boolean }> = () => {
  return <TraceScene />;
};

export default Trace;
export * from './state';
