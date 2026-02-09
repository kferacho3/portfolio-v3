'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import { SeededRandom } from '../../utils/seededRandom';
import {
  buildPatternLibraryTemplate,
  sampleSurvivability,
  sampleDifficulty,
} from '../../config/ketchapp';
import { KetchappGameShell } from '../_shared/KetchappGameShell';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';

type GameStatus = 'menu' | 'playing' | 'gameover';

const STORAGE_KEY = 'runeroll_best_v1';

const SPACING = 3.25;
const LOOK_AHEAD = 20;
const CUBE_SIZE = 0.8;

const RUNE_COLORS = ['#ff6b6b', '#4dd4ac', '#6c7bff', '#ffd166'] as const;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function hashSeed(seed: number, n: number) {
  // cheap deterministic mix
  let x = (seed ^ (n * 0x9e3779b1)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

type Gate = {
  z: number;
  rune: number;
};

function getGate(seed: number, i: number, out: Gate) {
  const rng = new SeededRandom(hashSeed(seed, i));
  out.z = i * SPACING;
  out.rune = rng.int(0, 3);
  return out;
}

function getRuntimeGate(
  seed: number,
  i: number,
  patternLibrary: ReturnType<typeof buildPatternLibraryTemplate>,
  out: Gate
) {
  getGate(seed, i, out);
  const chunk = patternLibrary[i % patternLibrary.length];
  if (chunk.id === 'C03' || chunk.id === 'C04') {
    out.rune = i % 2;
  } else if (chunk.id === 'C05') {
    out.rune = i % 3 === 2 ? 2 : 0;
  } else if (chunk.id === 'C08' || chunk.id === 'C13') {
    out.rune = (out.rune + 1) % 4;
  } else if (chunk.id === 'C14' || chunk.id === 'C15') {
    out.rune = (out.rune + 2) % 4;
  }
  return out;
}

export default function RuneRoll() {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [seed, setSeed] = useState<number>(() => Date.now() >>> 0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(STORAGE_KEY) || 0);
      if (Number.isFinite(v)) setBest(v);
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(() => {
    setScore(0);
    setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    setStatus('playing');
  }, []);

  return (
    <div
      className="relative h-full w-full select-none"
      onPointerDown={() => {
        if (status !== 'playing') start();
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        className="absolute inset-0"
      >
        <PerspectiveCamera makeDefault position={[0, 3.2, 5.2]} fov={55} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 2]} intensity={0.9} />

        <Scene
          seed={seed}
          status={status}
          onScore={() => setScore((s) => s + 1)}
          onGameOver={(finalScore) => {
            setStatus('gameover');
            setBest((b) => {
              const n = Math.max(b, finalScore);
              try {
                localStorage.setItem(STORAGE_KEY, String(n));
              } catch {
                // ignore
              }
              return n;
            });
          }}
        />
      </Canvas>
      <KetchappGameShell
        gameId="runeroll"
        score={score}
        best={best}
        status={
          status === 'playing'
            ? 'playing'
            : status === 'gameover'
              ? 'gameover'
              : 'ready'
        }
        deathTitle="Rune Mismatch"
        containerClassName="absolute inset-0"
      />
    </div>
  );
}

function Scene({
  seed,
  status,
  onScore,
  onGameOver,
}: {
  seed: number;
  status: GameStatus;
  onScore: () => void;
  onGameOver: (finalScore: number) => void;
}) {
  const input = useInputRef({
    enabled: status === 'playing',
    preventDefault: [' ', 'Space'],
  });

  const cubeRef = useRef<THREE.Mesh>(null!);
  const gatesGroupRef = useRef<THREE.Group>(null!);

  const sim = useRef({
    z: 0,
    rune: 0,
    runeScore: 0,
    rot: 0,
    rotTarget: 0,
  });

  const gateScratch = useMemo(() => ({ z: 0, rune: 0 }) as Gate, []);
  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('runeroll'),
    []
  );

  useEffect(() => {
    if (status !== 'playing') return;
    sim.current.z = 0;
    sim.current.rune = 0;
    sim.current.runeScore = 0;
    sim.current.rot = 0;
    sim.current.rotTarget = 0;
  }, [seed, status]);

  const materials = useMemo(() => {
    // 6 faces: [right,left,top,bottom,front,back]
    // We color top & front faces with rune color, rest neutral.
    const neutral = new THREE.MeshStandardMaterial({
      color: '#22252a',
      roughness: 0.55,
      metalness: 0.15,
    });
    return {
      neutral,
      runeMats: RUNE_COLORS.map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.35,
            metalness: 0.15,
          })
      ),
    };
  }, []);

  useFrame((state, dt) => {
    dt = Math.min(dt, 1 / 30);

    if (status !== 'playing') {
      clearFrameInput(input.current);
      return;
    }

    const s = sim.current;

    const just = input.current.justPressed;
    const rotate =
      input.current.pointerJustDown ||
      (just && (just.has(' ') || just.has('space')));
    if (rotate) {
      s.rune = (s.rune + 1) % 4;
      s.rotTarget = s.rune * (Math.PI / 2);
    }

    // smooth rotation
    const diff = s.rotTarget - s.rot;
    s.rot += diff * clamp(dt * 10, 0, 1);

    // move world forward (path flows from ahead (-Z) toward you)
    const difficulty = sampleDifficulty('timing-defense', s.runeScore * 0.75);
    const survivability = sampleSurvivability('runeroll', s.runeScore);
    s.z += difficulty.speed * survivability.intensityScale * dt;

    // gate check: when a gate crosses z==0 in world space (gate i at world z = s.z - i*SPACING)
    const justCleared = Math.floor(s.z / SPACING);
    if (justCleared > s.runeScore) {
      // we cleared one or more gates (dt might be large)
      for (let i = s.runeScore + 1; i <= justCleared; i++) {
        getRuntimeGate(seed, i, patternLibrary, gateScratch);
        const mismatchForgiven =
          survivability.onboarding > 0.45 &&
          (s.rune + 1) % 4 === gateScratch.rune;
        if (gateScratch.rune !== s.rune && !mismatchForgiven) {
          onGameOver(s.runeScore);
          clearFrameInput(input.current);
          return;
        }
        if (mismatchForgiven) {
          s.rune = gateScratch.rune;
          s.rotTarget = s.rune * (Math.PI / 2);
        }
        s.runeScore = i;
        onScore();
      }
    }

    // update cube
    if (cubeRef.current) {
      cubeRef.current.rotation.set(0, s.rot, 0);
    }

    // update moving gates group (inverted: path comes from -Z ahead, flows toward +Z past you)
    if (gatesGroupRef.current) {
      gatesGroupRef.current.position.z = s.z;
    }

    clearFrameInput(input.current);
  });

  const visibleGateIndices = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i <= LOOK_AHEAD; i++) out.push(i);
    return out;
  }, []);

  const cubeFaceMaterials = useMemo(() => {
    const runeMat = materials.runeMats[sim.current.rune];
    // right,left,top,bottom,front,back
    return [
      materials.neutral,
      materials.neutral,
      runeMat,
      materials.neutral,
      runeMat,
      materials.neutral,
    ];
  }, [materials.neutral, materials.runeMats]);

  return (
    <group>
      {/* background */}
      <color attach="background" args={['#0b0f1a']} />

      {/* floor */}
      <mesh
        position={[0, -0.9, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 120]} />
        <meshStandardMaterial color="#0f1626" roughness={1} />
      </mesh>

      {/* center strip */}
      <mesh
        position={[0, -0.899, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[2.2, 120]} />
        <meshStandardMaterial color="#111b2e" roughness={1} />
      </mesh>

      {/* cube */}
      <mesh ref={cubeRef} position={[0, -0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
        <primitive object={cubeFaceMaterials} attach="material" />
      </mesh>

      <group ref={gatesGroupRef}>
        {visibleGateIndices.map((i) => {
          const g = { z: 0, rune: 0 };
          getRuntimeGate(seed, i, patternLibrary, g);
          const c = RUNE_COLORS[g.rune];
          return (
            <group key={i} position={[0, 0, -g.z]}>
              {/* arch */}
              <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.6, 0.2, 0.25]} />
                <meshStandardMaterial color="#1e2738" roughness={0.9} />
              </mesh>
              <mesh position={[-1.1, 0.65, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.25, 1.8, 0.25]} />
                <meshStandardMaterial color="#1e2738" roughness={0.9} />
              </mesh>
              <mesh position={[1.1, 0.65, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.25, 1.8, 0.25]} />
                <meshStandardMaterial color="#1e2738" roughness={0.9} />
              </mesh>

              {/* rune panel */}
              <mesh position={[0, 0.65, 0.13]} castShadow>
                <boxGeometry args={[0.8, 0.8, 0.08]} />
                <meshStandardMaterial
                  color={c}
                  roughness={0.35}
                  metalness={0.15}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}
