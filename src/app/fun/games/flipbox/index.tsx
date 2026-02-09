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
import { flipBoxState } from './state';

type Platform = {
  id: string;
  zStart: number;
  zEnd: number;
  xBase: number;
  moveAmp: number;
  moveFreq: number;
  movePhase: number;
};

type SpawnRng = {
  next: () => number;
};

const LOOK_AHEAD = 180;
const DESPAWN_Z = -24;
const JUMP_DURATION = 0.44;
const JUMP_HEIGHT = 1.35;

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
    const weight = Math.max(0.13, 1.8 - distance * 0.33);
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

const resetRun = (
  platformsRef: React.MutableRefObject<Platform[]>,
  nextPlatformZRef: React.MutableRefObject<number>,
  progressRef: React.MutableRefObject<number>,
  jumpProgressRef: React.MutableRefObject<number>,
  jumpingRef: React.MutableRefObject<boolean>,
  rotationRef: React.MutableRefObject<number>,
  lastLandingIdRef: React.MutableRefObject<string>,
  rngRef: React.MutableRefObject<SpawnRng>
) => {
  platformsRef.current = [];
  nextPlatformZRef.current = 0;
  progressRef.current = 0;
  jumpProgressRef.current = 0;
  jumpingRef.current = false;
  rotationRef.current = 0;
  lastLandingIdRef.current = '';
  rngRef.current = makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
};

const FlipBoxScene: React.FC = () => {
  const inputRef = useInputRef({ preventDefault: ['space'] });
  const snap = useSnapshot(flipBoxState);

  const elapsedRef = useRef(0);
  const resetVersionRef = useRef(flipBoxState.resetVersion);
  const progressRef = useRef(0);
  const nextPlatformZRef = useRef(0);
  const jumpProgressRef = useRef(0);
  const jumpingRef = useRef(false);
  const rotationRef = useRef(0);
  const distanceBucketRef = useRef(0);
  const lastLandingIdRef = useRef('');
  const platformsRef = useRef<Platform[]>([]);
  const rngRef = useRef<SpawnRng>(
    makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0)
  );

  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('flipbox'),
    []
  );

  useFrame((state, dt) => {
    const input = inputRef.current;
    const tap = input.pointerJustDown || input.justPressed.has(' ');

    if (flipBoxState.resetVersion !== resetVersionRef.current) {
      resetVersionRef.current = flipBoxState.resetVersion;
      elapsedRef.current = 0;
      resetRun(
        platformsRef,
        nextPlatformZRef,
        progressRef,
        jumpProgressRef,
        jumpingRef,
        rotationRef,
        lastLandingIdRef,
        rngRef
      );
    }

    if (tap && flipBoxState.gameOver) {
      flipBoxState.reset();
      elapsedRef.current = 0;
      resetRun(
        platformsRef,
        nextPlatformZRef,
        progressRef,
        jumpProgressRef,
        jumpingRef,
        rotationRef,
        lastLandingIdRef,
        rngRef
      );
    }

    if (!flipBoxState.gameOver) {
      elapsedRef.current += dt;
      const difficulty = sampleDifficulty('flip-timing', elapsedRef.current);
      const intensity = Math.min(
        1,
        Math.max(0, (difficulty.speed - 4) / (7 - 4))
      );

      while (nextPlatformZRef.current < progressRef.current + LOOK_AHEAD) {
        const chunk = chooseChunk(rngRef.current, intensity, patternLibrary);
        const count = Math.max(1, chunk.hazardCount);
        const baseLength = THREE.MathUtils.clamp(
          2.8 - chunk.tier * 0.34,
          1.25,
          2.8
        );

        for (let i = 0; i < count; i += 1) {
          const length = THREE.MathUtils.clamp(
            baseLength + (rngRef.current.next() * 2 - 1) * 0.5,
            1.1,
            3
          );
          const gap = THREE.MathUtils.clamp(
            1.2 + chunk.tier * 0.35 + rngRef.current.next() * 0.7,
            1.1,
            3.2
          );
          const moveAmp =
            chunk.tier >= 2 && rngRef.current.next() < 0.35 ? 0.65 : 0;
          const xBase = (rngRef.current.next() * 2 - 1) * 1.2;
          const zStart = nextPlatformZRef.current + gap;
          const zEnd = zStart + length;
          platformsRef.current.push({
            id: `${chunk.id}-${zStart.toFixed(2)}-${i}`,
            zStart,
            zEnd,
            xBase,
            moveAmp,
            moveFreq: 1 + rngRef.current.next() * 1.4,
            movePhase: rngRef.current.next() * Math.PI * 2,
          });
          nextPlatformZRef.current = zEnd;
        }

        nextPlatformZRef.current += Math.max(
          0.8,
          difficulty.speed * chunk.durationSeconds * 0.08
        );
      }

      if (tap && !jumpingRef.current) {
        jumpingRef.current = true;
        jumpProgressRef.current = 0;
      }

      progressRef.current += difficulty.speed * dt;
      distanceBucketRef.current += difficulty.speed * dt * 0.25;
      while (distanceBucketRef.current >= 1) {
        flipBoxState.addScore(1);
        distanceBucketRef.current -= 1;
      }

      if (jumpingRef.current) {
        jumpProgressRef.current += dt / JUMP_DURATION;
        rotationRef.current += dt * 11;
        if (jumpProgressRef.current >= 1) {
          jumpProgressRef.current = 1;
          jumpingRef.current = false;
        }
      }

      const jumpT = jumpProgressRef.current;
      const playerY = jumpingRef.current
        ? Math.sin(jumpT * Math.PI) * JUMP_HEIGHT
        : 0;

      let landedPlatform: Platform | null = null;
      for (let i = 0; i < platformsRef.current.length; i += 1) {
        const platform = platformsRef.current[i];
        if (
          progressRef.current < platform.zStart ||
          progressRef.current > platform.zEnd
        ) {
          continue;
        }
        landedPlatform = platform;
        break;
      }

      if (!jumpingRef.current && landedPlatform == null && playerY <= 0.02) {
        flipBoxState.gameOver = true;
      }

      if (!jumpingRef.current && landedPlatform != null) {
        if (lastLandingIdRef.current !== landedPlatform.id) {
          const platformCenter =
            (landedPlatform.zStart + landedPlatform.zEnd) * 0.5;
          const centerError = Math.abs(progressRef.current - platformCenter);
          const perfect = centerError < 0.18;
          flipBoxState.addScore(perfect ? 2 : 1);
          lastLandingIdRef.current = landedPlatform.id;
        }
      }

      for (let i = platformsRef.current.length - 1; i >= 0; i -= 1) {
        if (platformsRef.current[i].zEnd < progressRef.current + DESPAWN_Z) {
          platformsRef.current.splice(i, 1);
        }
      }
    }

    clearFrameInput(inputRef);
  });

  const scoreText = Math.floor(snap.score).toString();
  const bestText = Math.floor(snap.bestScore).toString();
  const playerY = jumpingRef.current
    ? Math.sin(jumpProgressRef.current * Math.PI) * JUMP_HEIGHT
    : 0;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 5.8, 8.2]}
        rotation={[-0.36, 0, 0]}
        fov={43}
      />
      <color attach="background" args={['#111522']} />
      <fog attach="fog" args={['#111522', 8, 40]} />
      <ambientLight intensity={0.74} />
      <directionalLight position={[5, 10, 6]} intensity={1.3} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 26]}>
        <planeGeometry args={[20, 220]} />
        <meshStandardMaterial color="#151b2e" />
      </mesh>

      {platformsRef.current.map((platform) => {
        const zCenter =
          (platform.zStart + platform.zEnd) * 0.5 - progressRef.current;
        if (zCenter < DESPAWN_Z || zCenter > 48) return null;
        const x =
          platform.xBase +
          Math.sin(
            elapsedRef.current * platform.moveFreq + platform.movePhase
          ) *
            platform.moveAmp;
        return (
          <mesh key={platform.id} position={[x, -0.18, zCenter]}>
            <boxGeometry args={[2.4, 0.34, platform.zEnd - platform.zStart]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#12648b"
              emissiveIntensity={0.58}
            />
          </mesh>
        );
      })}

      <mesh
        position={[0, 0.1 + playerY, 0]}
        rotation={[rotationRef.current, 0, 0]}
      >
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color="#f6f8ff"
          emissive="#aeb5db"
          emissiveIntensity={0.35}
        />
      </mesh>

      <Html fullscreen>
        <div className="pointer-events-none fixed inset-0 p-4 text-white/90">
          <div className="flex items-start justify-between">
            <div className="rounded-md border border-white/20 bg-black/35 px-3 py-2">
              <div className="text-xs uppercase tracking-[0.25em] opacity-70">
                Flip Box
              </div>
              <div className="text-[11px] opacity-80">
                Tap to flip onto the next platform.
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
                <div className="text-lg font-semibold">Missed Landing</div>
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

const FlipBox: React.FC<{ soundsOn?: boolean }> = () => {
  return <FlipBoxScene />;
};

export default FlipBox;
export * from './state';
