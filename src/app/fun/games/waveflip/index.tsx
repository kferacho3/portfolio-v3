'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';

import { SeededRandom } from '../../utils/seededRandom';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';

type GameStatus = 'menu' | 'countdown' | 'playing' | 'gameover';

type Spike = {
  z: number;
  up: boolean;
  h: number;
  w: number;
};

type Pickup = {
  z: number;
  y: number;
};

const STORAGE_KEY = 'waveflip_best_v1';

const WORLD_HALF_H = 2.1;
const BALL_R = 0.22;
const AMP = 1.15;
const PHASE_SPEED = 2.55;
const FORWARD_SPEED = 4.8;
const SPIKE_SPACING = 2.15;
const LOOK_AHEAD = 34;

const PALETTE = ['#ff5a7a', '#1bbbd3', '#7c5cff', '#ffb020', '#20c46b'];

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function hashSeed(seed: number, i: number) {
  // deterministic 32-bit-ish mix
  let x = (seed ^ (i * 0x9e3779b1)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function getSpike(i: number, seed: number, out: Spike): Spike {
  const r = new SeededRandom(hashSeed(seed, i));
  out.z = i * SPIKE_SPACING;
  out.up = r.bool(0.5);
  out.h = r.float(0.65, 2.05);
  out.w = r.float(0.25, 0.45);
  return out;
}

function getPickup(i: number, seed: number, out: Pickup): Pickup | null {
  const r = new SeededRandom(hashSeed(seed, i) ^ 0xa5a5a5a5);
  if (!r.bool(0.36)) return null;
  out.z = i * SPIKE_SPACING + r.float(-0.45, 0.45);
  out.y = r.float(-0.75, 0.75);
  return out;
}

export default function WaveFlip() {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [rising, setRising] = useState(true);
  const [gemFlash, setGemFlash] = useState(false);
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 0 | null>(null);

  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(STORAGE_KEY) ?? '0');
      if (!Number.isNaN(v)) setBest(v);
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(() => {
    setSeed((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    setScore(0);
    setCountdown(3);
    setStatus('countdown');
  }, []);

  const backToMenu = useCallback(() => {
    setStatus('menu');
  }, []);

  useEffect(() => {
    if (!gemFlash) return;
    const t = setTimeout(() => setGemFlash(false), 500);
    return () => clearTimeout(t);
  }, [gemFlash]);

  useEffect(() => {
    if (status !== 'countdown' || countdown === null) return;
    if (countdown === 0) {
      const t = setTimeout(() => {
        setStatus('playing');
        setCountdown(null);
      }, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setCountdown((c) => (c === 3 ? 2 : c === 2 ? 1 : 0)),
      800
    );
    return () => clearTimeout(t);
  }, [status, countdown]);

  const onGameOver = useCallback((finalScore: number) => {
    setStatus('gameover');
    setBest((b) => {
      const next = Math.max(b, finalScore);
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <div className="relative w-full h-full select-none">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <color attach="background" args={['#f9f8f2']} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 6, 5]} intensity={0.8} />
        <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={140} />

        <WaveFlipScene
          status={status}
          seed={seed}
          onScore={setScore}
          onGameOver={onGameOver}
          onDirectionChange={setRising}
          onGem={() => {
            setScore((s) => s + 1);
            setGemFlash(true);
          }}
          frozen={status === 'countdown'}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-black/8 px-4 py-2 text-sm text-black/80">
            <div className="font-bold tracking-wide">WaveFlip</div>
            <div className="text-black/55">
              score: {score} · best: {best}
            </div>
          </div>
          {status === 'playing' && (
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-black/8 px-3 py-2 text-sm font-bold tabular-nums text-black/80">
                {rising ? '↑ RISING' : '↓ FALLING'}
              </div>
              {gemFlash && (
                <div className="animate-pulse rounded-lg bg-emerald-500/25 px-2 py-1 text-sm font-bold text-emerald-700">
                  +1
                </div>
              )}
            </div>
          )}
        </div>
        {status === 'playing' && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-lg bg-black/10 px-4 py-2 text-center text-sm font-medium text-black/75">
              <span className="font-bold">OBJECTIVE:</span> Go forward → · Avoid{' '}
              <span className="font-semibold text-red-600">red</span> (floor) &{' '}
              <span className="font-semibold text-blue-600">blue</span>{' '}
              (ceiling) spikes · Tap/Space to flip · Green = +1
            </div>
            <div className="text-2xl font-bold text-black/40">→</div>
          </div>
        )}
      </div>

      {status === 'menu' && (
        <Overlay>
          <h1 className="text-4xl font-extrabold tracking-tight">WaveFlip</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-black/50">
            Objective: Go forward · Avoid spikes · Collect gems
          </p>
          <p className="mt-3 text-black/70 max-w-sm">
            <strong>Tap or Space</strong> flips your direction: you rise or
            fall. Avoid spikes:{' '}
            <span className="font-semibold text-red-600">Red = floor</span> →
            flip to rise.{' '}
            <span className="font-semibold text-blue-600">Blue = ceiling</span>{' '}
            → flip to fall. Green = +1.
          </p>
          <button
            className="mt-6 rounded-lg bg-black px-5 py-3 text-white font-semibold pointer-events-auto"
            onClick={start}
          >
            Play
          </button>
        </Overlay>
      )}

      {status === 'countdown' && countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-2xl bg-white/90 shadow-2xl px-16 py-12 text-center">
            <div className="text-7xl font-black tabular-nums text-black">
              {countdown === 0 ? 'GO!' : countdown}
            </div>
          </div>
        </div>
      )}

      {status === 'gameover' && (
        <Overlay>
          <h2 className="text-4xl font-extrabold tracking-tight">
            You hit a spike!
          </h2>
          <p className="mt-2 text-black/70">Score: {score}</p>
          <p className="mt-1 text-sm text-black/60">
            <span className="font-semibold text-red-600">Red</span> = floor
            (flip ↑) · <span className="font-semibold text-blue-600">Blue</span>{' '}
            = ceiling (flip ↓)
          </p>
          <div className="mt-6 flex gap-3">
            <button
              className="rounded-lg bg-black px-5 py-3 text-white font-semibold pointer-events-auto"
              onClick={start}
            >
              Retry
            </button>
            <button
              className="rounded-lg bg-black/10 px-5 py-3 text-black font-semibold pointer-events-auto"
              onClick={backToMenu}
            >
              Menu
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="rounded-2xl bg-white/80 backdrop-blur px-8 py-8 text-center shadow-xl">
        {children}
      </div>
    </div>
  );
}

function WaveTrail({
  trailRef,
}: {
  trailRef: React.MutableRefObject<THREE.Vector3[]>;
}) {
  const lineRef = useRef<THREE.Line>(null);
  useFrame(() => {
    if (!lineRef.current || trailRef.current.length < 2) return;
    const prev = lineRef.current.geometry;
    const geo = new THREE.BufferGeometry().setFromPoints(trailRef.current);
    lineRef.current.geometry = geo;
    prev.dispose();
  });
  return (
    <line ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial color="#94a3b8" transparent opacity={0.45} />
    </line>
  );
}

const SPIKE_FLOOR_COLOR = '#dc2626';
const SPIKE_CEILING_COLOR = '#2563eb';

function WaveFlipScene({
  status,
  seed,
  onScore,
  onGameOver,
  onDirectionChange,
  onGem,
  frozen,
}: {
  status: GameStatus;
  seed: number;
  onScore: (score: number) => void;
  onGameOver: (score: number) => void;
  onDirectionChange?: (rising: boolean) => void;
  onGem?: () => void;
  frozen?: boolean;
}) {
  const active = status === 'playing' && !frozen;
  const input = useInputRef({
    enabled: active,
    preventDefault: [' ', 'Space'],
  });
  const { camera } = useThree();

  const ballGroupRef = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const floor = useRef<THREE.Mesh>(null);
  const ceiling = useRef<THREE.Mesh>(null);
  const camPos = useRef(new THREE.Vector3(0, 0, 10));
  const camLook = useRef(new THREE.Vector3(0, 0, 0));
  const flipPulse = useRef(0);

  const sim = useRef({
    z: 0,
    phase: 0,
    phaseVel: PHASE_SPEED,
    passed: 0,
    colorIndex: 0,
    alive: true,
    startTime: 0,
  });
  const lastRising = useRef(true);
  const collectedGems = useRef<Set<number>>(new Set());
  const easeInDur = 2.0;

  const tmpSpike = useMemo<Spike>(
    () => ({ z: 0, up: true, h: 1, w: 0.35 }),
    []
  );
  const tmpPickup = useMemo<Pickup>(() => ({ z: 0, y: 0 }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const trail = useRef<THREE.Vector3[]>([]);

  const [worldIndex, setWorldIndex] = useState(0);

  useEffect(() => {
    if (status !== 'playing') return;
    sim.current.z = 0;
    sim.current.phase = 0;
    sim.current.phaseVel = PHASE_SPEED;
    sim.current.passed = 0;
    sim.current.colorIndex = 0;
    sim.current.alive = true;
    setWorldIndex(0);
    onScore(0);
    camPos.current.set(0, 0, 10);
    camLook.current.set(0, 0, 0);
    flipPulse.current = 0;
    lastRising.current = true;
    collectedGems.current.clear();
    trail.current = [];
    sim.current.startTime = performance.now() / 1000;
    onDirectionChange?.(true);
  }, [seed, status, onScore, onDirectionChange]);

  useFrame((state, dt) => {
    if (status !== 'playing' || frozen || !sim.current.alive) {
      clearFrameInput(input.current);
      return;
    }

    dt = Math.min(dt, 1 / 30);

    const just = input.current.justPressed;
    const flip =
      input.current.pointerJustDown ||
      (just && (just.has(' ') || just.has('space')));
    if (flip) {
      sim.current.phaseVel *= -1;
      flipPulse.current = 1;
    }
    flipPulse.current = Math.max(0, flipPulse.current - dt * 6);
    const nowRising = sim.current.phaseVel > 0;
    if (nowRising !== lastRising.current) {
      lastRising.current = nowRising;
      onDirectionChange?.(nowRising);
    }

    const elapsed = performance.now() / 1000 - sim.current.startTime;
    const ease = Math.min(1, elapsed / easeInDur);
    const speedMul = 0.55 + 0.45 * ease;
    const phaseMul = 0.6 + 0.4 * ease;

    sim.current.phase += sim.current.phaseVel * phaseMul * dt;
    sim.current.z += FORWARD_SPEED * speedMul * dt;

    const y = AMP * Math.sin(sim.current.phase);
    const z = sim.current.z;

    // update visuals (group = position, ball = local scale)
    if (ballGroupRef.current) {
      ballGroupRef.current.position.set(0, y, -z);
    }
    if (ball.current) {
      const scale = 1 + flipPulse.current * 0.15;
      ball.current.scale.setScalar(scale);
    }

    const nextPassed = Math.floor(z / SPIKE_SPACING);
    if (nextPassed !== sim.current.passed) {
      sim.current.passed = nextPassed;
      onScore(nextPassed);
      setWorldIndex(nextPassed);
    }

    // collision checks: current and next spike
    for (const i of [nextPassed, nextPassed + 1]) {
      const spike = getSpike(i, seed, tmpSpike);
      const dz = Math.abs(z - spike.z);
      if (dz > 0.55) continue;

      if (spike.up) {
        const top = -WORLD_HALF_H + spike.h;
        if (y - BALL_R <= top) {
          sim.current.alive = false;
          onGameOver(sim.current.passed);
          break;
        }
      } else {
        const bottom = WORLD_HALF_H - spike.h;
        if (y + BALL_R >= bottom) {
          sim.current.alive = false;
          onGameOver(sim.current.passed);
          break;
        }
      }
    }

    // pickup: one per segment (sometimes) — +1 score, color change, track collected
    const pickupIdx = nextPassed + 1;
    const pickup = getPickup(pickupIdx, seed, tmpPickup);
    if (pickup && !collectedGems.current.has(pickupIdx)) {
      const dz = Math.abs(z - pickup.z);
      const dy = Math.abs(y - pickup.y);
      if (dz < 0.45 && dy < 0.45) {
        collectedGems.current.add(pickupIdx);
        sim.current.colorIndex = (sim.current.colorIndex + 1) % PALETTE.length;
        onGem?.();
      }
    }

    // wave trail: recent positions behind ball
    trail.current.push(new THREE.Vector3(0, y, -z));
    const maxTrail = 14;
    if (trail.current.length > maxTrail) trail.current.shift();

    // gentle parallax band drift
    if (floor.current) floor.current.position.z = -z;
    if (ceiling.current) ceiling.current.position.z = -z;

    // camera follow: keep ball centered, look ahead
    const targetZ = 10 - z;
    const targetY = y * 0.25;
    camPos.current.lerp(
      new THREE.Vector3(0, targetY, targetZ),
      1 - Math.exp(-10 * dt)
    );
    camLook.current.lerp(
      new THREE.Vector3(0, y * 0.4, -z - 2),
      1 - Math.exp(-10 * dt)
    );
    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);

    clearFrameInput(input.current);
  });

  const spikesToRender = useMemo(() => {
    const arr: number[] = [];
    for (let i = Math.max(0, worldIndex - 2); i <= worldIndex + 18; i++)
      arr.push(i);
    return arr;
  }, [worldIndex]);

  const pickupsToRender = useMemo(() => {
    const arr: number[] = [];
    for (let i = Math.max(0, worldIndex - 1); i <= worldIndex + 18; i++)
      arr.push(i);
    return arr;
  }, [worldIndex]);

  const ballColor = PALETTE[sim.current.colorIndex];

  return (
    <group>
      <WaveTrail trailRef={trail} />
      {/* corridor rails (very subtle) */}
      <mesh ref={floor} position={[0, -WORLD_HALF_H, 0]}>
        <boxGeometry args={[8, 0.12, LOOK_AHEAD * 2]} />
        <meshStandardMaterial color="#e7e2d4" />
      </mesh>
      <mesh ref={ceiling} position={[0, WORLD_HALF_H, 0]}>
        <boxGeometry args={[8, 0.12, LOOK_AHEAD * 2]} />
        <meshStandardMaterial color="#e7e2d4" />
      </mesh>

      {/* ball = YOU (glow ring + sphere + label) */}
      <group ref={ballGroupRef}>
        <mesh ref={ball} position={[0, 0, 0]} castShadow>
          <sphereGeometry args={[BALL_R, 18, 18]} />
          <meshStandardMaterial
            color={ballColor}
            roughness={0.2}
            metalness={0.1}
            emissive={ballColor}
            emissiveIntensity={0.12}
          />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[BALL_R * 1.35, 0.04, 8, 24]} />
          <meshBasicMaterial color="#fff" transparent opacity={0.5} />
        </mesh>
        <Html
          position={[0, BALL_R + 0.5, 0]}
          center
          className="pointer-events-none select-none"
        >
          <div className="rounded bg-black/80 px-2 py-0.5 text-xs font-bold text-white whitespace-nowrap -translate-y-1">
            YOU
          </div>
        </Html>
      </group>

      {/* spikes */}
      {spikesToRender.map((i) => {
        const spike = getSpike(i, seed, { ...tmpSpike });
        const z = -spike.z;
        const yBase = spike.up ? -WORLD_HALF_H : WORLD_HALF_H;
        const y = spike.up ? yBase + spike.h * 0.5 : yBase - spike.h * 0.5;
        const rotX = spike.up ? Math.PI : 0;
        const color = spike.up ? SPIKE_FLOOR_COLOR : SPIKE_CEILING_COLOR;
        return (
          <mesh key={`spike-${i}`} position={[0, y, z]} rotation={[rotX, 0, 0]}>
            <coneGeometry args={[spike.w, spike.h, 5]} />
            <meshStandardMaterial
              color={color}
              roughness={0.7}
              metalness={0.1}
            />
          </mesh>
        );
      })}

      {/* pickups */}
      {pickupsToRender.map((i) => {
        if (collectedGems.current.has(i)) return null;
        const pickup = getPickup(i, seed, { ...tmpPickup });
        if (!pickup) return null;
        tmp.set(0, pickup.y, -pickup.z);
        return (
          <mesh
            key={`p-${i}`}
            position={tmp.clone()}
            rotation={[0, 0, Math.PI / 4]}
          >
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial
              color="#22c55e"
              emissive="#22c55e"
              emissiveIntensity={0.25}
            />
          </mesh>
        );
      })}
    </group>
  );
}
