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
import { clearFrameInput, useInputRef } from '../../hooks/useInput';

type GameStatus = 'menu' | 'playing' | 'gameover';

const STORAGE_KEY = 'pulseparry_best_v1';

const TRACK_HALF_W = 2.4;
const TRACK_LEN = 24;
const BALL_R = 0.26;
const PLAYER_Y = 0.3;

const SPAWN_Z = 13;
const DESPAWN_Z = -8;

const SPEED_Z = 7.2;
const MAX_PROJECTILES = 18;

const SHIELD_DURATION = 0.34;
const SHIELD_COOLDOWN = 0.55;
const SHIELD_RADIUS = 0.78;

type Projectile = {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  r: number;
  reflected: boolean;
  alive: boolean;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export default function PulseParry() {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(STORAGE_KEY) ?? '0');
      if (Number.isFinite(v)) setBest(v);
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(() => {
    setScore(0);
    setSeed((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    setStatus('playing');
  }, []);

  const onGameOver = useCallback(
    (finalScore: number) => {
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
    },
    [setBest]
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-950 text-white">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#07090f']} />
        <PerspectiveCamera makeDefault position={[0, 4.5, 6.5]} fov={55} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 6, 2]} intensity={1.4} />
        <PulseParryScene
          seed={seed}
          status={status}
          onScore={setScore}
          onGameOver={onGameOver}
        />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-4 top-4 text-sm opacity-80">
          PulseParry
        </div>
        <div className="absolute right-4 top-3 text-right">
          <div className="text-3xl font-semibold tracking-tight">{score}</div>
          <div className="text-xs opacity-60">BEST {best}</div>
        </div>
      </div>

      {status !== 'playing' && (
        <div className="absolute inset-0 grid place-items-center bg-black/60">
          <div className="w-[min(420px,92vw)] rounded-xl bg-neutral-900/80 p-6 shadow-2xl backdrop-blur">
            <div className="text-2xl font-semibold">PulseParry</div>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              One tap = a short shield pulse. Time it to parry incoming shards.
              Parried shards bounce back and score points.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                className="pointer-events-auto rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
                onClick={start}
              >
                {status === 'menu' ? 'Play' : 'Retry'}
              </button>
              <div className="text-xs text-white/60">
                Tap anywhere during play
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PulseParryScene({
  seed,
  status,
  onScore,
  onGameOver,
}: {
  seed: number;
  status: GameStatus;
  onScore: React.Dispatch<React.SetStateAction<number>>;
  onGameOver: (finalScore: number) => void;
}) {
  const input = useInputRef(status === 'playing');
  const ballRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);

  const rngRef = useRef<SeededRandom>(new SeededRandom(seed));
  const projectilesRef = useRef<Projectile[]>([]);
  const idRef = useRef(1);

  const sim = useRef({
    shieldT: 0,
    cooldownT: 0,
    spawnT: 0,
    score: 0,
    alive: true,
  });

  const tmp = useMemo(
    () => ({
      v1: new THREE.Vector3(),
      v2: new THREE.Vector3(),
    }),
    []
  );

  useEffect(() => {
    if (status !== 'playing') return;
    rngRef.current = new SeededRandom(seed);
    projectilesRef.current = [];
    idRef.current = 1;
    sim.current.shieldT = 0;
    sim.current.cooldownT = 0;
    sim.current.spawnT = 0;
    sim.current.score = 0;
    sim.current.alive = true;
    onScore(0);
  }, [seed, status, onScore]);

  const spawn = useCallback(() => {
    const arr = projectilesRef.current;
    if (arr.length >= MAX_PROJECTILES) return;

    const rng = rngRef.current;
    const side = rng.bool(0.5) ? -1 : 1;

    // Mix of straight shots and side-to-side cutters
    const x0 = rng.float(-TRACK_HALF_W * 0.7, TRACK_HALF_W * 0.7);
    const y0 = PLAYER_Y + rng.float(-0.15, 0.35);

    const lateral = rng.bool(0.45);
    const vx = lateral ? side * rng.float(1.3, 2.4) : rng.float(-0.35, 0.35);
    const vz = -SPEED_Z * rng.float(0.85, 1.15);

    arr.push({
      id: idRef.current++,
      pos: new THREE.Vector3(x0, y0, SPAWN_Z),
      vel: new THREE.Vector3(vx, 0, vz),
      r: rng.float(0.16, 0.24),
      reflected: false,
      alive: true,
    });
  }, []);

  const gameOver = useCallback(() => {
    if (!sim.current.alive) return;
    sim.current.alive = false;
    onGameOver(sim.current.score);
  }, [onGameOver]);

  useFrame((_state, dt) => {
    dt = Math.min(dt, 1 / 30);

    if (status !== 'playing') {
      clearFrameInput(input.current);
      return;
    }

    // Input: pulse shield
    if (input.current.pointerJustDown && sim.current.cooldownT <= 0) {
      sim.current.shieldT = SHIELD_DURATION;
      sim.current.cooldownT = SHIELD_COOLDOWN;
    }

    sim.current.shieldT = Math.max(0, sim.current.shieldT - dt);
    sim.current.cooldownT = Math.max(0, sim.current.cooldownT - dt);

    // Spawn cadence scales slightly with score
    sim.current.spawnT -= dt;
    const spawnEvery = clamp(0.7 - sim.current.score * 0.005, 0.38, 0.7);
    if (sim.current.spawnT <= 0) {
      sim.current.spawnT = spawnEvery;
      spawn();
    }

    // Update visuals
    if (shieldRef.current) {
      shieldRef.current.visible = sim.current.shieldT > 0;
      const k = sim.current.shieldT > 0 ? 1 : 0;
      shieldRef.current.scale.setScalar(0.9 + 0.2 * k);
    }

    // Projectiles
    const ballPos = tmp.v1.set(0, PLAYER_Y, 0);
    const arr = projectilesRef.current;

    for (const p of arr) {
      if (!p.alive) continue;
      p.pos.addScaledVector(p.vel, dt);

      // bounce off corridor walls for extra spice
      if (p.pos.x < -TRACK_HALF_W || p.pos.x > TRACK_HALF_W) {
        p.vel.x *= -1;
        p.pos.x = clamp(p.pos.x, -TRACK_HALF_W, TRACK_HALF_W);
      }

      // collision with player / shield
      const dist = tmp.v2.copy(p.pos).sub(ballPos).length();
      const hitDist = p.r + BALL_R;

      if (dist <= hitDist) {
        // shield parry?
        if (sim.current.shieldT > 0 && dist <= SHIELD_RADIUS) {
          if (!p.reflected) {
            p.reflected = true;
            p.vel.z *= -1;
            p.vel.x *= 0.6;
            sim.current.score += 2;
            onScore(sim.current.score);
          }
        } else {
          gameOver();
        }
      }

      // remove when offscreen
      if (p.pos.z < DESPAWN_Z || p.pos.z > SPAWN_Z + 4) {
        p.alive = false;
      }

      // scoring for fully cleared reflected projectiles
      if (p.reflected && p.alive && p.pos.z > SPAWN_Z + 1) {
        p.alive = false;
        sim.current.score += 1;
        onScore(sim.current.score);
      }
    }

    clearFrameInput(input.current);
  });

  // Render helpers
  const liveProjectiles = projectilesRef.current.filter((p) => p.alive);

  return (
    <group>
      {/* Track */}
      <mesh
        position={[0, -0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[TRACK_HALF_W * 2, TRACK_LEN]} />
        <meshStandardMaterial color="#0d1220" />
      </mesh>
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK_HALF_W * 2 + 1.4, TRACK_LEN]} />
        <meshStandardMaterial color="#07090f" />
      </mesh>

      {/* Side rails */}
      <mesh position={[TRACK_HALF_W + 0.18, 0.25, 0]}>
        <boxGeometry args={[0.24, 0.9, TRACK_LEN]} />
        <meshStandardMaterial color="#131a2e" />
      </mesh>
      <mesh position={[-TRACK_HALF_W - 0.18, 0.25, 0]}>
        <boxGeometry args={[0.24, 0.9, TRACK_LEN]} />
        <meshStandardMaterial color="#131a2e" />
      </mesh>

      {/* Player */}
      <mesh ref={ballRef} position={[0, PLAYER_Y, 0]} castShadow>
        <sphereGeometry args={[BALL_R, 24, 24]} />
        <meshStandardMaterial
          color="#e6e6ff"
          roughness={0.25}
          metalness={0.15}
        />
      </mesh>

      {/* Shield */}
      <mesh ref={shieldRef} position={[0, PLAYER_Y, 0]}>
        <sphereGeometry args={[SHIELD_RADIUS, 24, 24]} />
        <meshStandardMaterial
          color="#7dd3fc"
          transparent
          opacity={0.18}
          roughness={0.1}
        />
      </mesh>

      {/* Projectiles */}
      {liveProjectiles.map((p) => (
        <mesh key={p.id} position={p.pos} castShadow>
          <icosahedronGeometry args={[p.r, 0]} />
          <meshStandardMaterial
            color={p.reflected ? '#86efac' : '#fb7185'}
            roughness={0.35}
            metalness={0.05}
          />
        </mesh>
      ))}
    </group>
  );
}
