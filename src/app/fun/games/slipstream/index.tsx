'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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

type SegHazard = 'none' | 'ground' | 'ceiling';

type Segment = {
  z: number;
  height: number;
  gap: boolean;
  hazard: SegHazard;
};

const STORAGE_KEY = 'fun_slipstream_best_v1';

const SEG_LEN = 2.4;
const LOOK_AHEAD = 22;
const SPEED = 6.0;
const BALL_R = 0.24;

const WORLD_W = 5.0;

function hashSeed(baseSeed: number, i: number): number {
  // Deterministic 32-bit mix.
  let x = (baseSeed ^ (i * 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function getSegment(baseSeed: number, index: number, out?: Segment): Segment {
  const r = new SeededRandom(hashSeed(baseSeed, index));
  const z = index * SEG_LEN;

  // Gaps start showing up after the player has settled into the rhythm.
  const gap = index > 4 ? r.bool(0.18) : false;

  // Height offsets are subtle: the skill is *state switching*, not platforming.
  const height = gap ? 0 : r.float(-0.35, 0.55);

  let hazard: SegHazard = 'none';
  if (!gap && index > 2) {
    const roll = r.float(0, 1);
    if (roll < 0.28) hazard = 'ground';
    else if (roll < 0.56) hazard = 'ceiling';
  }

  const seg = out ?? ({ z, height, gap, hazard } as Segment);
  seg.z = z;
  seg.height = height;
  seg.gap = gap;
  seg.hazard = hazard;
  return seg;
}

function getRuntimeSegment(
  baseSeed: number,
  index: number,
  patternLibrary: ReturnType<typeof buildPatternLibraryTemplate>,
  out?: Segment
): Segment {
  const seg = getSegment(baseSeed, index, out);
  const chunk = patternLibrary[index % patternLibrary.length];
  if (!seg.gap && seg.hazard === 'none' && chunk.tier >= 3 && index % 2 === 0) {
    seg.hazard = index % 4 === 0 ? 'ground' : 'ceiling';
  }
  return seg;
}

export default function Slipstream() {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [seed, setSeed] = useState(() => Date.now() >>> 0);

  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
      if (Number.isFinite(v)) setBest(v);
    } catch {}
  }, []);

  const start = useCallback(() => {
    setScore(0);
    setSeed((Date.now() >>> 0) ^ ((Math.random() * 1e9) | 0));
    setStatus('playing');
  }, []);

  const onGameOver = useCallback(
    (finalScore: number) => {
      setStatus('gameover');
      setBest((b) => {
        const next = Math.max(b, finalScore);
        try {
          window.localStorage.setItem(STORAGE_KEY, String(next));
        } catch {}
        return next;
      });
    },
    [setBest]
  );

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
      >
        <color attach="background" args={['#0b0f1a']} />
        <fog attach="fog" args={['#0b0f1a', 10, 34]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 8, 4]} intensity={1.1} />
        <PerspectiveCamera makeDefault position={[0, 5.5, 9]} fov={55} />
        <SlipstreamScene
          seed={seed}
          status={status}
          onScore={setScore}
          onGameOver={onGameOver}
        />
      </Canvas>
      <KetchappGameShell
        gameId="slipstream"
        score={score}
        best={best}
        status={
          status === 'playing'
            ? 'playing'
            : status === 'gameover'
              ? 'gameover'
              : 'ready'
        }
        deathTitle="Collision"
        containerClassName="absolute inset-0"
      />
    </div>
  );
}

function SlipstreamScene({
  seed,
  status,
  onScore,
  onGameOver,
}: {
  seed: number;
  status: GameStatus;
  onScore: (value: number | ((prev: number) => number)) => void;
  onGameOver: (score: number) => void;
}) {
  const input = useInputRef({
    enabled: status === 'playing',
    preventDefault: [' ', 'Space'],
  });

  const { camera } = useThree();
  const ballRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const camPos = useRef(new THREE.Vector3(0, 5.5, 9));
  const camLook = useRef(new THREE.Vector3(0, 0, -4));

  const tmpSeg = useMemo(
    () => ({ z: 0, height: 0, gap: false, hazard: 'none' as SegHazard }),
    []
  );

  const sim = useRef({
    z: 0,
    y: 0.4,
    mode: 'ground' as 'ground' | 'glide',
    glideY: 0.4,
    score: 0,
    dead: false,
  });

  const [segIndex, setSegIndex] = useState(0);
  const patternLibrary = useMemo(
    () => buildPatternLibraryTemplate('slipstream'),
    []
  );

  const reset = useCallback(() => {
    sim.current.z = 0;
    sim.current.y = 0.4;
    sim.current.mode = 'ground';
    sim.current.glideY = 0.4;
    sim.current.score = 0;
    sim.current.dead = false;
    setSegIndex(0);
    onScore(0);
    camPos.current.set(0, 5.5, 9);
    camLook.current.set(0, 0, -4);
  }, [onScore]);

  useEffect(() => {
    if (status === 'playing') reset();
  }, [status, seed, reset]);

  const visibleSegments = useMemo(() => {
    const base = Math.max(0, segIndex - 2);
    const out: Segment[] = [];
    for (let i = base; i < base + LOOK_AHEAD; i++) {
      out.push(getRuntimeSegment(seed, i, patternLibrary));
    }
    return out;
  }, [seed, segIndex, patternLibrary]);

  useFrame((_state, dt) => {
    dt = Math.min(dt, 1 / 30);

    if (status !== 'playing') {
      clearFrameInput(input.current);
      return;
    }

    const s = sim.current;
    const elapsed = s.z / SPEED;
    const difficulty = sampleDifficulty('lane-switch', elapsed);
    const survivability = sampleSurvivability('slipstream', elapsed);

    // Input: toggle mode (tap or Space).
    const just = input.current.justPressed;
    const toggle =
      input.current.pointerJustDown ||
      (just && (just.has(' ') || just.has('space')));
    if (toggle) {
      if (s.mode === 'ground') {
        s.mode = 'glide';
        s.glideY = s.y;
      } else {
        // Attempt to snap back to ground. If there is no ground, you crash.
        const i = Math.floor(s.z / SEG_LEN);
        const seg = getRuntimeSegment(seed, i, patternLibrary, tmpSeg);
        if (seg.gap) {
          if (survivability.onboarding < 0.35) s.dead = true;
        } else {
          s.mode = 'ground';
        }
      }
    }

    // Advance.
    s.z += difficulty.speed * survivability.intensityScale * dt;

    const i = Math.floor(s.z / SEG_LEN);
    if (i !== segIndex) setSegIndex(i);

    // Score: segments cleared.
    if (i > s.score) {
      s.score = i;
      onScore(i);
    }

    const seg = getRuntimeSegment(seed, i, patternLibrary, tmpSeg);

    // Resolve vertical position.
    const groundY = -0.65 + seg.height + BALL_R;

    if (s.mode === 'ground') {
      if (seg.gap) s.dead = true;
      // Smoothly approach ground height.
      s.y += (groundY - s.y) * (1 - Math.exp(-12 * dt));
    } else {
      // Glide holds altitude.
      s.y = s.glideY;
    }

    // Collisions.
    // - Ground hazard hits only when grounded.
    if (!seg.gap && seg.hazard === 'ground' && s.mode === 'ground') {
      // Ground spike top.
      const spikeTop =
        groundY + 0.55 - (survivability.decisionWindowScale - 1) * 0.18;
      if (s.y - BALL_R <= spikeTop) s.dead = true;
    }

    // - Ceiling hazard hits only when gliding.
    if (!seg.gap && seg.hazard === 'ceiling' && s.mode === 'glide') {
      const ceilBottom = 1 + (survivability.decisionWindowScale - 1) * 0.18;
      if (s.y + BALL_R >= ceilBottom) s.dead = true;
    }

    // Update meshes.
    if (ballRef.current) {
      ballRef.current.position.set(0, s.y, -s.z);
    }

    if (shieldRef.current) {
      // A subtle halo indicating current mode.
      shieldRef.current.position.set(0, s.y, -s.z);
      const scale = s.mode === 'glide' ? 1.22 : 1.05;
      shieldRef.current.scale.setScalar(scale);
      (shieldRef.current.material as THREE.MeshStandardMaterial).opacity =
        s.mode === 'glide' ? 0.28 : 0.12;
    }

    // Camera follow: smooth Z + Y, look ahead of player
    const targetY = 5.5 + (s.y - 0.4) * 0.35;
    const targetZ = 9 - s.z;
    const lookZ = -s.z - 5;
    camPos.current.lerp(
      new THREE.Vector3(0, targetY, targetZ),
      1 - Math.exp(-8 * dt)
    );
    camLook.current.lerp(
      new THREE.Vector3(0, s.y * 0.6, lookZ),
      1 - Math.exp(-8 * dt)
    );
    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);

    clearFrameInput(input.current);

    if (s.dead) {
      onGameOver(s.score);
    }
  });

  return (
    <group>
      {/* Corridor backdrop */}
      <mesh position={[0, -1.1, -12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WORLD_W, 60]} />
        <meshStandardMaterial color="#0f1629" roughness={1} metalness={0} />
      </mesh>

      {/* Side rails */}
      <mesh position={[WORLD_W / 2 + 0.2, -0.6, -12]}>
        <boxGeometry args={[0.3, 1.2, 60]} />
        <meshStandardMaterial color="#18213b" roughness={1} />
      </mesh>
      <mesh position={[-WORLD_W / 2 - 0.2, -0.6, -12]}>
        <boxGeometry args={[0.3, 1.2, 60]} />
        <meshStandardMaterial color="#18213b" roughness={1} />
      </mesh>

      {/* Segments */}
      {visibleSegments.map((seg, idx) => {
        const local = idx + Math.max(0, segIndex - 2);
        // Recompute deterministic segment (avoids stale memo for map key ordering).
        const s = getRuntimeSegment(seed, local, patternLibrary);
        const z = -s.z;
        const y = -0.95 + s.height;
        return (
          <group key={local}>
            {!s.gap && (
              <mesh position={[0, y, z]}>
                <boxGeometry args={[WORLD_W, 0.55, SEG_LEN * 0.98]} />
                <meshStandardMaterial color="#1a2a52" roughness={0.95} />
              </mesh>
            )}

            {/* Ground spikes */}
            {!s.gap && s.hazard === 'ground' && (
              <mesh position={[0, y + 0.45, z]}>
                <coneGeometry args={[0.45, 0.9, 4]} />
                <meshStandardMaterial color="#ff4d6d" roughness={0.7} />
              </mesh>
            )}

            {/* Ceiling blocks */}
            {!s.gap && s.hazard === 'ceiling' && (
              <mesh position={[0, 1.25, z]}>
                <boxGeometry args={[2.2, 0.5, 0.9]} />
                <meshStandardMaterial
                  color="#61dafb"
                  roughness={0.35}
                  metalness={0.15}
                />
              </mesh>
            )}

            {/* A little void glow when gap */}
            {s.gap && (
              <mesh position={[0, -1.05, z]}>
                <boxGeometry args={[WORLD_W, 0.12, SEG_LEN * 0.98]} />
                <meshStandardMaterial
                  color="#05070f"
                  emissive="#05070f"
                  emissiveIntensity={1}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Player */}
      <mesh ref={ballRef}>
        <sphereGeometry args={[BALL_R, 18, 18]} />
        <meshStandardMaterial
          color="#f5f7ff"
          roughness={0.25}
          metalness={0.2}
        />
      </mesh>
      <mesh ref={shieldRef}>
        <torusGeometry args={[BALL_R * 1.4, 0.06, 8, 18]} />
        <meshStandardMaterial
          color="#8b5cf6"
          transparent
          opacity={0.12}
          roughness={0.2}
          metalness={0.2}
          emissive="#8b5cf6"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* A floating reticle */}
      <mesh position={[0, 0.85, -12]}>
        <ringGeometry args={[0.35, 0.42, 32]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}
