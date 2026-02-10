'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { create } from 'zustand';
import {
  buildPatternLibraryTemplate,
  pickPatternChunkForSurvivability,
  sampleDifficulty,
  type DifficultySample,
  type GameChunkPatternTemplate,
} from '../../config/ketchapp';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import {
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
  withinGraceWindow,
} from '../_shared/hyperUpgradeKit';
import { orbitLatchState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';

type Planet = {
  slot: number;
  x: number;
  y: number;
  radius: number;
  orbitRadius: number;
  orbitAngularVel: number;
  colorIndex: number;
  glow: number;
  pulse: number;
};

type StarPickup = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  value: number;
  spin: number;
  colorIndex: number;
  glow: number;
};

type Shard = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
};

type Runtime = {
  elapsed: number;
  score: number;
  latches: number;
  stars: number;
  tightReleases: number;
  streak: number;
  multiplier: number;
  failMessage: string;

  playerX: number;
  playerY: number;
  velX: number;
  velY: number;
  maxYReached: number;

  latched: boolean;
  latchedPlanet: number;
  orbitAngle: number;
  orbitRadius: number;
  orbitAngularVel: number;
  driftTimer: number;

  shake: number;
  hudCommit: number;
  coreGlow: number;
  latchFlash: number;
  impactFlash: number;
  trailHead: number;
  nextOrbitDirection: number;
  lastTapAt: number;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkPlanetsLeft: number;

  spawnCursorY: number;
  lastSpawnX: number;
  lastSpawnY: number;
  hasSpawnAnchor: boolean;
  nextStarSlot: number;

  planets: Planet[];
  starsPool: StarPickup[];
  shards: Shard[];
};

type OrbitStore = {
  status: GameStatus;
  score: number;
  best: number;
  latches: number;
  stars: number;
  tightReleases: number;
  multiplier: number;
  latched: boolean;
  failMessage: string;
  tapNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  onTapFx: () => void;
  updateHud: (
    score: number,
    latches: number,
    stars: number,
    tightReleases: number,
    multiplier: number,
    latched: boolean
  ) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'orbitlatch_hyper_best_v3';

const PLANET_POOL = 24;
const STAR_POOL = 42;
const SHARD_POOL = 120;
const TRAIL_POINTS = 54;

const FIELD_HALF_X = 4.2;
const SAFE_FALL_BACK = 10.5;
const DRIFT_FAIL_BASE = 5.4;

const LATCH_BASE_DISTANCE = 0.3;
const COLLECT_RADIUS = 0.28;
const PLAYER_RADIUS = 0.12;
const RELATCH_LOOKAHEAD_BASE = 0.12;

const STAR_COLORS = [
  new THREE.Color('#55f4ff'),
  new THREE.Color('#ff68d4'),
  new THREE.Color('#c5ff66'),
  new THREE.Color('#ffbf4b'),
] as const;
const PLANET_COLORS = [
  new THREE.Color('#33dcff'),
  new THREE.Color('#ff4fbe'),
  new THREE.Color('#7dff73'),
  new THREE.Color('#ffa945'),
  new THREE.Color('#8f7bff'),
] as const;
const WHITE = new THREE.Color('#fdffff');
const DANGER = new THREE.Color('#ff4d74');

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

let audioContextRef: AudioContext | null = null;

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_KEY);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const writeBest = (score: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_KEY, String(Math.max(0, Math.floor(score))));
};

const maybeVibrate = (ms: number) => {
  if (typeof navigator === 'undefined') return;
  if ('vibrate' in navigator) navigator.vibrate(ms);
};

const playTone = (freq: number, duration = 0.05, volume = 0.03) => {
  if (typeof window === 'undefined') return;
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;

  if (!audioContextRef) audioContextRef = new Context();
  const ctx = audioContextRef;
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.72, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
};

const simToWorld = (x: number, y: number, out: THREE.Vector3) => {
  out.set(x, 0, -y);
  return out;
};

const makePlanet = (slot: number): Planet => ({
  slot,
  x: 0,
  y: 0,
  radius: 0.62,
  orbitRadius: 1.24,
  orbitAngularVel: 1.65,
  colorIndex: slot % PLANET_COLORS.length,
  glow: 0,
  pulse: Math.random() * Math.PI * 2,
});

const makeStar = (slot: number): StarPickup => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  value: 1,
  spin: Math.random() * Math.PI * 2,
  colorIndex: slot % STAR_COLORS.length,
  glow: 0,
});

const makeShard = (slot: number): Shard => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  maxLife: 1,
  size: 0.05,
  color: new THREE.Color('#ffffff'),
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  latches: 0,
  stars: 0,
  tightReleases: 0,
  streak: 0,
  multiplier: 1,
  failMessage: '',

  playerX: 0,
  playerY: 0,
  velX: 0,
  velY: 0,
  maxYReached: 0,

  latched: true,
  latchedPlanet: 0,
  orbitAngle: Math.PI * 0.22,
  orbitRadius: 1.25,
  orbitAngularVel: 1.6,
  driftTimer: 0,

  shake: 0,
  hudCommit: 0,
  coreGlow: 0,
  latchFlash: 0,
  impactFlash: 0,
  trailHead: 0,
  nextOrbitDirection: 1,
  lastTapAt: -99,

  difficulty: sampleDifficulty('orbit-chain', 0),
  chunkLibrary: buildPatternLibraryTemplate('orbitlatch'),
  currentChunk: null,
  chunkPlanetsLeft: 0,

  spawnCursorY: 0,
  lastSpawnX: 0,
  lastSpawnY: 0,
  hasSpawnAnchor: false,
  nextStarSlot: 0,

  planets: Array.from({ length: PLANET_POOL }, (_, idx) => makePlanet(idx)),
  starsPool: Array.from({ length: STAR_POOL }, (_, idx) => makeStar(idx)),
  shards: Array.from({ length: SHARD_POOL }, (_, idx) => makeShard(idx)),
});

const useOrbitStore = create<OrbitStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  latches: 0,
  stars: 0,
  tightReleases: 0,
  multiplier: 1,
  latched: false,
  failMessage: '',
  tapNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      latches: 0,
      stars: 0,
      tightReleases: 0,
      multiplier: 1,
      latched: true,
      failMessage: '',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      latches: 0,
      stars: 0,
      tightReleases: 0,
      multiplier: 1,
      latched: false,
      failMessage: '',
    }),
  onTapFx: () => set((state) => ({ tapNonce: state.tapNonce + 1 })),
  updateHud: (score, latches, stars, tightReleases, multiplier, latched) =>
    set({
      score: Math.floor(score),
      latches,
      stars,
      tightReleases,
      multiplier,
      latched,
    }),
  endRun: (score, reason) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        best: nextBest,
        latched: false,
        failMessage: reason,
      };
    }),
}));

const chooseChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 95, 0, 1);
  runtime.currentChunk = pickPatternChunkForSurvivability(
    'orbitlatch',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  runtime.chunkPlanetsLeft = Math.max(
    2,
    Math.round(runtime.currentChunk.durationSeconds * (1.55 + runtime.difficulty.eventRate * 1.35))
  );
};

const nextSpacing = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
  const earlySlow = runtime.elapsed < 12 ? 0.55 : runtime.elapsed < 22 ? 0.3 : 0;
  return clamp(
    lerp(3.4, 2.1, d) + (3 - tier) * 0.12 + earlySlow + Math.random() * 0.32,
    1.9,
    4.25
  );
};

const acquireStar = (runtime: Runtime) => {
  for (let i = 0; i < runtime.starsPool.length; i += 1) {
    const idx = (runtime.nextStarSlot + i) % runtime.starsPool.length;
    const star = runtime.starsPool[idx];
    if (!star.active) {
      runtime.nextStarSlot = (idx + 1) % runtime.starsPool.length;
      return star;
    }
  }
  const fallback = runtime.starsPool[runtime.nextStarSlot];
  runtime.nextStarSlot = (runtime.nextStarSlot + 1) % runtime.starsPool.length;
  return fallback;
};

const spawnStarBetween = (
  runtime: Runtime,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tier: number
) => {
  const star = acquireStar(runtime);
  const t = 0.4 + Math.random() * 0.26;
  const mx = lerp(fromX, toX, t);
  const my = lerp(fromY, toY, t);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const offset = (Math.random() * 2 - 1) * (0.38 + Math.random() * 0.3);

  star.active = true;
  star.x = mx + px * offset;
  star.y = my + py * offset;
  star.spin = Math.random() * Math.PI * 2;
  star.value = Math.random() < clamp(0.03 + tier * 0.03, 0, 0.16) ? 2 : 1;
  star.colorIndex = (Math.floor(Math.random() * STAR_COLORS.length) + tier) % STAR_COLORS.length;
  star.glow = 0;
};

const seedPlanet = (runtime: Runtime, planet: Planet, initial: boolean) => {
  if (!initial) {
    if (!runtime.currentChunk || runtime.chunkPlanetsLeft <= 0) chooseChunk(runtime);
    runtime.chunkPlanetsLeft -= 1;
  }
  const tier = runtime.currentChunk?.tier ?? 0;
  const d = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
  const hadAnchor = runtime.hasSpawnAnchor;

  let nextX = 0;
  let nextY = 0;
  if (!hadAnchor) {
    nextX = 0;
    nextY = 0;
    runtime.hasSpawnAnchor = true;
  } else {
    const spacing = nextSpacing(runtime, tier);
    nextY = runtime.spawnCursorY + spacing;
    const offsetScale = lerp(1.45, 3.05, d) + tier * 0.2;
    nextX = clamp(
      runtime.lastSpawnX + (Math.random() * 2 - 1) * offsetScale,
      -FIELD_HALF_X + 0.8,
      FIELD_HALF_X - 0.8
    );
    if (Math.abs(nextX - runtime.lastSpawnX) < 0.5) {
      nextX = clamp(
        nextX + (Math.random() < 0.5 ? -0.72 : 0.72),
        -FIELD_HALF_X + 0.8,
        FIELD_HALF_X - 0.8
      );
    }
  }

  const radius = clamp(lerp(0.52, 0.8, d) + (Math.random() * 2 - 1) * 0.08, 0.45, 0.9);
  const orbitRadius = clamp(
    radius + lerp(0.95, 0.72, d) + (Math.random() * 2 - 1) * 0.12 - tier * 0.02,
    radius + 0.52,
    radius + 1.25
  );
  const orbitAngularVelSign = runtime.nextOrbitDirection >= 0 ? 1 : -1;
  runtime.nextOrbitDirection *= -1;
  const orbitAngularVel = orbitAngularVelSign * clamp(lerp(1.3, 2.75, d) + tier * 0.08 + Math.random() * 0.22, 1.1, 3.4);

  planet.x = nextX;
  planet.y = nextY;
  planet.radius = radius;
  planet.orbitRadius = orbitRadius;
  planet.orbitAngularVel = orbitAngularVel;
  planet.colorIndex = Math.floor(Math.random() * PLANET_COLORS.length);
  planet.glow = 0;
  planet.pulse = Math.random() * Math.PI * 2;

  if (hadAnchor) {
    spawnStarBetween(
      runtime,
      runtime.lastSpawnX,
      runtime.lastSpawnY,
      nextX,
      nextY,
      tier
    );
  }

  runtime.spawnCursorY = nextY;
  runtime.lastSpawnX = nextX;
  runtime.lastSpawnY = nextY;
};

const acquireShard = (runtime: Runtime) => {
  for (const shard of runtime.shards) {
    if (!shard.active) return shard;
  }
  return runtime.shards[Math.floor(Math.random() * runtime.shards.length)];
};

const spawnBurst = (
  runtime: Runtime,
  x: number,
  y: number,
  color: THREE.Color,
  count: number,
  speed: number
) => {
  for (let i = 0; i < count; i += 1) {
    const shard = acquireShard(runtime);
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.55 + Math.random() * 0.85);
    shard.active = true;
    shard.x = x + (Math.random() * 2 - 1) * 0.06;
    shard.y = y + (Math.random() * 2 - 1) * 0.06;
    shard.vx = Math.cos(angle) * s;
    shard.vy = Math.sin(angle) * s;
    shard.life = 0.3 + Math.random() * 0.28;
    shard.maxLife = shard.life;
    shard.size = 0.03 + Math.random() * 0.05;
    shard.color.copy(color);
  }
};

function OrbitLatchOverlay() {
  const status = useOrbitStore((state) => state.status);
  const score = useOrbitStore((state) => state.score);
  const best = useOrbitStore((state) => state.best);
  const latches = useOrbitStore((state) => state.latches);
  const stars = useOrbitStore((state) => state.stars);
  const tightReleases = useOrbitStore((state) => state.tightReleases);
  const multiplier = useOrbitStore((state) => state.multiplier);
  const latched = useOrbitStore((state) => state.latched);
  const failMessage = useOrbitStore((state) => state.failMessage);
  const tapNonce = useOrbitStore((state) => state.tapNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/55 bg-gradient-to-br from-cyan-500/23 via-sky-500/16 to-emerald-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Orbit Latch</div>
        <div className="text-[11px] text-cyan-50/85">Tap to latch near ring. Tap again to release.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-amber-100/55 bg-gradient-to-br from-amber-500/22 via-fuchsia-500/16 to-violet-500/20 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-cyan-100/35 bg-gradient-to-br from-slate-950/72 via-cyan-900/30 to-amber-900/24 px-3 py-2 text-xs">
          <div>
            State{' '}
            <span className={`font-semibold ${latched ? 'text-cyan-200' : 'text-fuchsia-200'}`}>
              {latched ? 'Latched' : 'Drifting'}
            </span>
          </div>
          <div>
            Transfers <span className="font-semibold text-cyan-200">{latches}</span>
          </div>
          <div>
            Stars <span className="font-semibold text-amber-200">{stars}</span>
          </div>
          <div>
            Tight Releases <span className="font-semibold text-emerald-200">{tightReleases}</span>
          </div>
          <div>
            Multiplier <span className="font-semibold text-violet-200">x{multiplier.toFixed(2)}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-cyan-100/42 bg-gradient-to-br from-slate-950/80 via-cyan-950/44 to-amber-950/32 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">ORBIT LATCH</div>
            <div className="mt-2 text-sm text-white/85">Tap to latch when crossing an orbit ring.</div>
            <div className="mt-1 text-sm text-white/80">Tap again to release and slingshot to the next world.</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/45 to-cyan-950/28 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Orbit Lost</div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={tapNonce}>
          <div
            className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70"
            style={{
              animation: 'orbitlatch-pulse 220ms ease-out forwards',
              opacity: 0,
            }}
          />
        </div>
      )}

      <style jsx global>{`
        @keyframes orbitlatch-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.62);
            opacity: 0.7;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function OrbitLatchScene() {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const impactOverlayRef = useRef<HTMLDivElement>(null);
  const planetRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const starRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const satRef = useRef<THREE.Mesh>(null);
  const latchSparkRef = useRef<THREE.Mesh>(null);
  const bloomRef = useRef<any>(null);
  const fixedStepRef = useRef(createFixedStepState());

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const trailWorld = useMemo(() => new THREE.Vector3(), []);

  const trailPositions = useMemo(() => new Float32Array(TRAIL_POINTS * 3), []);
  const trailGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    return geo;
  }, [trailPositions]);
  const trailMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#8fffd6', transparent: true, opacity: 0.62, toneMapped: false }),
    []
  );
  const trailObject = useMemo(
    () => new THREE.Line(trailGeometry, trailMaterial),
    [trailGeometry, trailMaterial]
  );

  const { camera } = useThree();

  const resetRuntime = (runtime: Runtime) => {
    runtime.elapsed = 0;
    runtime.score = 0;
    runtime.latches = 0;
    runtime.stars = 0;
    runtime.tightReleases = 0;
    runtime.streak = 0;
    runtime.multiplier = 1;
    runtime.failMessage = '';

    runtime.playerX = 0;
    runtime.playerY = 0;
    runtime.velX = 0;
    runtime.velY = 0;
    runtime.maxYReached = 0;

    runtime.latched = true;
    runtime.latchedPlanet = 0;
    runtime.orbitAngle = Math.PI * 0.22;
    runtime.orbitRadius = 1.2;
    runtime.orbitAngularVel = 1.6;
    runtime.driftTimer = 0;

    runtime.shake = 0;
    runtime.hudCommit = 0;
    runtime.coreGlow = 0;
    runtime.latchFlash = 0;
    runtime.impactFlash = 0;
    runtime.trailHead = 0;
    runtime.nextOrbitDirection = 1;
    runtime.lastTapAt = -99;

    runtime.difficulty = sampleDifficulty('orbit-chain', 0);
    runtime.currentChunk = null;
    runtime.chunkPlanetsLeft = 0;

    runtime.spawnCursorY = 0;
    runtime.lastSpawnX = 0;
    runtime.lastSpawnY = 0;
    runtime.hasSpawnAnchor = false;
    runtime.nextStarSlot = 0;

    for (const star of runtime.starsPool) {
      star.active = false;
      star.glow = 0;
    }
    for (const shard of runtime.shards) {
      shard.active = false;
      shard.life = 0;
    }

    for (let i = 0; i < runtime.planets.length; i += 1) {
      seedPlanet(runtime, runtime.planets[i], i < 2);
    }
    for (let i = 0; i < runtime.planets.length; i += 1) {
      if (i >= 2 && runtime.planets[i].y <= runtime.planets[i - 1].y + 0.4) {
        runtime.planets[i].y = runtime.planets[i - 1].y + nextSpacing(runtime, 0);
      }
    }

    runtime.latchedPlanet = runtime.planets[0].slot;
    runtime.orbitRadius = runtime.planets[0].orbitRadius;
    runtime.orbitAngularVel = runtime.planets[0].orbitAngularVel;
    runtime.orbitAngle = Math.PI * 0.2;
    runtime.playerX = runtime.planets[0].x + Math.cos(runtime.orbitAngle) * runtime.orbitRadius;
    runtime.playerY = runtime.planets[0].y + Math.sin(runtime.orbitAngle) * runtime.orbitRadius;
    runtime.maxYReached = runtime.playerY;

    const world = simToWorld(runtime.playerX, runtime.playerY, trailWorld);
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const ptr = i * 3;
      trailPositions[ptr] = world.x;
      trailPositions[ptr + 1] = 0.02;
      trailPositions[ptr + 2] = world.z;
    }
  };

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useOrbitStore.getState().resetToStart();
    orbitLatchState.status = 'menu';
    orbitLatchState.score = 0;
  }, []);

  useEffect(() => {
    const apply = (state: ReturnType<typeof useOrbitStore.getState>) => {
      orbitLatchState.status =
        state.status === 'START'
          ? 'menu'
          : state.status === 'PLAYING'
            ? 'playing'
            : 'gameover';
      orbitLatchState.score = state.score;
      orbitLatchState.best = state.best;
    };

    apply(useOrbitStore.getState());
    const unsub = useOrbitStore.subscribe(apply);
    return () => unsub();
  }, []);

  useEffect(
    () => () => {
      trailGeometry.dispose();
      trailMaterial.dispose();
    },
    [trailGeometry, trailMaterial]
  );

  useFrame((_, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      clearFrameInput(inputRef);
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = useOrbitStore.getState();

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap) {
      runtime.lastTapAt = runtime.elapsed;
      if (store.status !== 'PLAYING') {
        resetRuntime(runtime);
        useOrbitStore.getState().startRun();
      } else if (runtime.latched) {
        const planet = runtime.planets.find((p) => p.slot === runtime.latchedPlanet);
        if (planet) {
          const sign = runtime.orbitAngularVel >= 0 ? 1 : -1;
          const tangentX = -Math.sin(runtime.orbitAngle) * sign;
          const tangentY = Math.cos(runtime.orbitAngle) * sign;
          const radialX = Math.cos(runtime.orbitAngle);
          const radialY = Math.sin(runtime.orbitAngle);
          const orbitalLinear = Math.abs(runtime.orbitAngularVel) * runtime.orbitRadius;
          const launchScale = 1.06;
          runtime.velX = tangentX * orbitalLinear * launchScale + radialX * 0.22;
          runtime.velY = tangentY * orbitalLinear * launchScale + radialY * 0.22 + 0.38;

          // Keep early transfers playable even when clockwise orbits launch downward.
          let nearestAhead: Planet | null = null;
          let nearestAheadDy = Infinity;
          for (const other of runtime.planets) {
            if (other.slot === planet.slot) continue;
            const dy = other.y - runtime.playerY;
            if (dy <= 0) continue;
            if (dy < nearestAheadDy) {
              nearestAheadDy = dy;
              nearestAhead = other;
            }
          }
          if (nearestAhead) {
            const ax = nearestAhead.x - runtime.playerX;
            const ay = nearestAhead.y - runtime.playerY;
            const len = Math.hypot(ax, ay) || 1;
            runtime.velX += (ax / len) * 0.26;
            runtime.velY += Math.max(0, ay / len) * 0.42;
          }
          runtime.velY = Math.max(runtime.velY, 0.42);

          runtime.latched = false;
          runtime.driftTimer = 0;
          runtime.coreGlow = Math.min(1.2, runtime.coreGlow + 0.15);
          runtime.shake = Math.min(1.2, runtime.shake + 0.2);
          useOrbitStore.getState().onTapFx();
          playTone(520, 0.045, 0.025);

          let tightMin = Infinity;
          for (const other of runtime.planets) {
            if (other.slot === planet.slot) continue;
            const dx = runtime.playerX - other.x;
            const dy = runtime.playerY - other.y;
            const clearance = Math.hypot(dx, dy) - (other.radius + PLAYER_RADIUS);
            tightMin = Math.min(tightMin, clearance);
          }
          if (tightMin < 0.42) {
            runtime.tightReleases += 1;
            runtime.score += 1;
            runtime.coreGlow = Math.min(1.45, runtime.coreGlow + 0.22);
            spawnBurst(runtime, runtime.playerX, runtime.playerY, STAR_COLORS[0], 7, 2.4);
          }
        }
      } else {
        let bestPlanet: Planet | null = null;
        let bestDelta = Infinity;
        const dNorm = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
        const speed = Math.hypot(runtime.velX, runtime.velY);
        const speedAssist = clamp(speed * 0.08, 0, 0.16);
        const lookAhead = clamp(
          RELATCH_LOOKAHEAD_BASE + speedAssist * 0.55,
          RELATCH_LOOKAHEAD_BASE,
          0.26
        );
        const predictX = runtime.playerX + runtime.velX * lookAhead;
        const predictY = runtime.playerY + runtime.velY * lookAhead;
        const latchDistance = clamp(
          LATCH_BASE_DISTANCE + 0.04 + speedAssist - dNorm * 0.08,
          0.22,
          0.48
        );

        for (const planet of runtime.planets) {
          const dx = runtime.playerX - planet.x;
          const dy = runtime.playerY - planet.y;
          const dist = Math.hypot(dx, dy);
          const pdx = predictX - planet.x;
          const pdy = predictY - planet.y;
          const predictDist = Math.hypot(pdx, pdy);
          if (
            dist <= planet.radius + PLAYER_RADIUS * 0.9 &&
            predictDist <= planet.radius + PLAYER_RADIUS * 0.9
          ) {
            continue;
          }
          const deltaRing = Math.min(
            Math.abs(dist - planet.orbitRadius),
            Math.abs(predictDist - planet.orbitRadius)
          );
          if (deltaRing <= latchDistance && deltaRing < bestDelta) {
            bestDelta = deltaRing;
            bestPlanet = planet;
          }
        }

        if (bestPlanet) {
          runtime.latched = true;
          runtime.latchedPlanet = bestPlanet.slot;
          runtime.orbitRadius = bestPlanet.orbitRadius;
          runtime.orbitAngularVel = bestPlanet.orbitAngularVel;
          runtime.orbitAngle = Math.atan2(
            runtime.playerY - bestPlanet.y,
            runtime.playerX - bestPlanet.x
          );
          runtime.playerX = bestPlanet.x + Math.cos(runtime.orbitAngle) * runtime.orbitRadius;
          runtime.playerY = bestPlanet.y + Math.sin(runtime.orbitAngle) * runtime.orbitRadius;
          runtime.velX = 0;
          runtime.velY = 0;
          runtime.driftTimer = 0;

          runtime.latches += 1;
          runtime.streak += 1;
          runtime.multiplier = 1 + Math.min(runtime.streak, 18) * 0.09;
          runtime.score += runtime.multiplier;
          runtime.coreGlow = Math.min(1.6, runtime.coreGlow + 0.24);
          runtime.shake = Math.min(1.2, runtime.shake + 0.24);
          runtime.latchFlash = 1;

          bestPlanet.glow = 1.2;
          spawnBurst(
            runtime,
            runtime.playerX,
            runtime.playerY,
            PLANET_COLORS[bestPlanet.colorIndex],
            8,
            2.2
          );
          maybeVibrate(10);
          playTone(760, 0.05, 0.03);
          useOrbitStore.getState().onTapFx();
        } else {
          runtime.streak = 0;
          runtime.multiplier = Math.max(1, runtime.multiplier - 0.06);
        }
      }
    }

    const failRun = (reason: string, color: THREE.Color = DANGER) => {
      const latest = useOrbitStore.getState();
      if (latest.status !== 'PLAYING') return;
      runtime.failMessage = reason;
      runtime.impactFlash = Math.max(runtime.impactFlash, 1);
      runtime.shake = Math.max(runtime.shake, 1.25);
      runtime.coreGlow = Math.max(runtime.coreGlow, 1.2);
      runtime.latchFlash = Math.max(runtime.latchFlash, 0.7);
      spawnBurst(runtime, runtime.playerX, runtime.playerY, color, 16, 3.4);
      maybeVibrate(16);
      playTone(190, 0.09, 0.042);
      useOrbitStore.getState().endRun(runtime.score, runtime.failMessage);
    };

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.difficulty = sampleDifficulty('orbit-chain', runtime.elapsed);

      const d = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
      const gravityScale = lerp(0.34, 0.68, d);
      const driftFail = lerp(DRIFT_FAIL_BASE, 3.9, d);

      for (const planet of runtime.planets) {
        planet.glow = Math.max(0, planet.glow - dt * 2.2);
      }

      if (runtime.latched) {
        const planet = runtime.planets.find((p) => p.slot === runtime.latchedPlanet);
        if (!planet) {
          failRun('Orbit source collapsed.');
        } else {
          runtime.orbitAngularVel = planet.orbitAngularVel;
          runtime.orbitRadius = planet.orbitRadius;
          runtime.orbitAngle += runtime.orbitAngularVel * dt;
          runtime.playerX = planet.x + Math.cos(runtime.orbitAngle) * runtime.orbitRadius;
          runtime.playerY = planet.y + Math.sin(runtime.orbitAngle) * runtime.orbitRadius;
          runtime.velX = 0;
          runtime.velY = 0;
          runtime.driftTimer = 0;
          planet.glow = Math.max(planet.glow, 0.6);
        }
      } else {
        runtime.driftTimer += dt;

        let nearest: Planet | null = null;
        let nearestDistSq = Infinity;
        let ax = 0;
        let ay = 0.22;

        for (const planet of runtime.planets) {
          const dx = planet.x - runtime.playerX;
          const dy = planet.y - runtime.playerY;
          const distSq = dx * dx + dy * dy;
          if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearest = planet;
          }
          if (distSq < 22) {
            const inv = 1 / Math.sqrt(distSq + 0.0001);
            const g = gravityScale * (1.2 / (distSq + 0.5));
            ax += dx * inv * g;
            ay += dy * inv * g;
          }
        }

        runtime.velX += ax * dt;
        runtime.velY += ay * dt;

        const speed = Math.hypot(runtime.velX, runtime.velY);
        const speedCap = lerp(3.8, 6.3, d);
        if (speed > speedCap) {
          const inv = speedCap / speed;
          runtime.velX *= inv;
          runtime.velY *= inv;
        }

        runtime.velX *= 1 - dt * 0.05;
        runtime.velY *= 1 - dt * 0.035;
        runtime.playerX += runtime.velX * dt;
        runtime.playerY += runtime.velY * dt;

        if (nearest && nearestDistSq < (nearest.radius + PLAYER_RADIUS) * (nearest.radius + PLAYER_RADIUS)) {
          failRun('Satellite impacted a planet core.');
        } else if (runtime.driftTimer > driftFail) {
          if (!withinGraceWindow(runtime.elapsed, runtime.lastTapAt, 0.1)) {
            failRun('Drift window expired before relatch.');
          }
        }
      }

      runtime.maxYReached = Math.max(runtime.maxYReached, runtime.playerY);

      if (Math.abs(runtime.playerX) > FIELD_HALF_X + 0.05) {
        failRun('Satellite escaped lateral bounds.');
      } else if (runtime.playerY < runtime.maxYReached - SAFE_FALL_BACK) {
        failRun('Signal lost below relay field.');
      }

      for (const star of runtime.starsPool) {
        if (!star.active) continue;
        star.glow = Math.max(0, star.glow - dt * 3.8);
        star.spin += dt * (0.8 + star.value * 0.3);

        const dx = runtime.playerX - star.x;
        const dy = runtime.playerY - star.y;
        if (dx * dx + dy * dy <= COLLECT_RADIUS * COLLECT_RADIUS) {
          star.active = false;
          runtime.stars += star.value;
          runtime.score += star.value * 1.25;
          runtime.coreGlow = Math.min(1.55, runtime.coreGlow + 0.2);
          spawnBurst(runtime, star.x, star.y, STAR_COLORS[star.colorIndex], 7, 2.1);
          playTone(980, 0.045, 0.022);
        } else if (star.y < runtime.playerY - 9) {
          star.active = false;
        }
      }

      for (const planet of runtime.planets) {
        if (planet.slot === runtime.latchedPlanet && runtime.latched) continue;
        if (planet.y < runtime.playerY - 12) {
          seedPlanet(runtime, planet, false);
        }
      }

      if (runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        useOrbitStore
          .getState()
          .updateHud(
            runtime.score,
            runtime.latches,
            runtime.stars,
            runtime.tightReleases,
            runtime.multiplier,
            runtime.latched
          );
      }
    }

    runtime.coreGlow = Math.max(0, runtime.coreGlow - dt * 1.9);
    runtime.latchFlash = Math.max(0, runtime.latchFlash - dt * 3.6);
    runtime.impactFlash = Math.max(0, runtime.impactFlash - dt * 2.9);
    runtime.shake = Math.max(0, runtime.shake - dt * 4.8);

    for (const shard of runtime.shards) {
      if (!shard.active) continue;
      shard.life -= dt;
      if (shard.life <= 0) {
        shard.active = false;
        continue;
      }
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.vx *= 1 - dt * 0.4;
      shard.vy *= 1 - dt * 0.4;
    }

    const worldPos = simToWorld(runtime.playerX, runtime.playerY, trailWorld);
    for (let i = 0; i < TRAIL_POINTS - 1; i += 1) {
      const src = (i + 1) * 3;
      const dst = i * 3;
      trailPositions[dst] = trailPositions[src];
      trailPositions[dst + 1] = trailPositions[src + 1];
      trailPositions[dst + 2] = trailPositions[src + 2];
    }
    const last = (TRAIL_POINTS - 1) * 3;
    trailPositions[last] = worldPos.x;
    trailPositions[last + 1] = 0.03;
    trailPositions[last + 2] = worldPos.z;
    (
      trailGeometry.getAttribute('position') as THREE.BufferAttribute
    ).needsUpdate = true;
    trailGeometry.computeBoundingSphere();

    const shakeAmp = runtime.shake * 0.09;
    const shakeTime = runtime.elapsed * 21;
    camTarget.set(
      runtime.playerX * 0.3 + shakeNoiseSigned(shakeTime, 2.9) * shakeAmp,
      7.3 + shakeNoiseSigned(shakeTime, 7.5) * shakeAmp * 0.32,
      -runtime.playerY + 4.9 + shakeNoiseSigned(shakeTime, 15.1) * shakeAmp
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-8 * step.renderDt));
    lookTarget.set(runtime.playerX * 0.2, 0, -runtime.playerY - 3.4);
    camera.lookAt(lookTarget);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = lerp(camera.fov, 39 - runtime.coreGlow * 1.6, 1 - Math.exp(-6 * dt));
      camera.updateProjectionMatrix();
    }

    if (bgMaterialRef.current) {
      bgMaterialRef.current.uniforms.uTime.value += dt;
      bgMaterialRef.current.uniforms.uGlow.value = runtime.coreGlow + runtime.latchFlash;
    }

    if (satRef.current) {
      satRef.current.position.set(worldPos.x, 0.03, worldPos.z);
      satRef.current.scale.setScalar(1 + runtime.coreGlow * 0.12);
      const satMat = satRef.current.material as THREE.MeshStandardMaterial;
      satMat.emissiveIntensity = 0.6 + runtime.coreGlow * 0.9;
    }

    if (latchSparkRef.current) {
      if (runtime.latched) {
        const planet = runtime.planets.find((p) => p.slot === runtime.latchedPlanet);
        if (planet) {
          const sx = planet.x + Math.cos(runtime.orbitAngle) * planet.orbitRadius;
          const sy = planet.y + Math.sin(runtime.orbitAngle) * planet.orbitRadius;
          const sw = simToWorld(sx, sy, trailWorld);
          latchSparkRef.current.visible = true;
          latchSparkRef.current.position.set(sw.x, 0.04, sw.z);
          const s = 0.12 + runtime.coreGlow * 0.09;
          latchSparkRef.current.scale.setScalar(s);
        } else {
          latchSparkRef.current.visible = false;
        }
      } else {
        latchSparkRef.current.visible = false;
      }
    }

    if (planetRef.current && ringRef.current) {
      for (let i = 0; i < runtime.planets.length; i += 1) {
        const planet = runtime.planets[i];
        const world = simToWorld(planet.x, planet.y, trailWorld);
        const pulsing = 0.5 + 0.5 * Math.sin(runtime.elapsed * 1.5 + planet.pulse);

        dummy.position.set(world.x, 0, world.z);
        dummy.scale.setScalar(planet.radius);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        planetRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch
          .copy(PLANET_COLORS[planet.colorIndex])
          .lerp(WHITE, clamp(planet.glow * 0.35 + pulsing * 0.1, 0, 0.55));
        planetRef.current.setColorAt(i, colorScratch);

        dummy.position.set(world.x, 0.015, world.z);
        dummy.scale.set(planet.orbitRadius, planet.orbitRadius, planet.orbitRadius);
        dummy.rotation.set(-Math.PI * 0.5, 0, 0);
        dummy.updateMatrix();
        ringRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch
          .copy(PLANET_COLORS[planet.colorIndex])
          .lerp(WHITE, clamp(0.16 + planet.glow * 0.62 + runtime.latchFlash * 0.2, 0, 0.92));
        ringRef.current.setColorAt(i, colorScratch);
      }
      planetRef.current.instanceMatrix.needsUpdate = true;
      if (planetRef.current.instanceColor) planetRef.current.instanceColor.needsUpdate = true;
      ringRef.current.instanceMatrix.needsUpdate = true;
      if (ringRef.current.instanceColor) ringRef.current.instanceColor.needsUpdate = true;
    }

    if (starRef.current) {
      let count = 0;
      for (const star of runtime.starsPool) {
        if (!star.active) continue;
        const world = simToWorld(star.x, star.y, trailWorld);
        dummy.position.set(world.x, 0.06, world.z);
        const s = 0.12 + star.value * 0.05 + star.glow * 0.04;
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, star.spin, 0);
        dummy.updateMatrix();
        starRef.current.setMatrixAt(count, dummy.matrix);

        colorScratch
          .copy(STAR_COLORS[star.colorIndex])
          .lerp(WHITE, clamp(0.32 + star.glow * 0.46, 0, 0.82));
        starRef.current.setColorAt(count, colorScratch);
        count += 1;
      }
      starRef.current.count = count;
      starRef.current.instanceMatrix.needsUpdate = true;
      if (starRef.current.instanceColor) starRef.current.instanceColor.needsUpdate = true;
    }

    if (shardRef.current) {
      let shardCount = 0;
      for (const shard of runtime.shards) {
        if (!shard.active) continue;
        if (shardCount >= SHARD_POOL) break;
        const lifeT = clamp(shard.life / shard.maxLife, 0, 1);
        const world = simToWorld(shard.x, shard.y, trailWorld);
        dummy.position.set(world.x, 0.04 + (1 - lifeT) * 0.06, world.z);
        dummy.scale.setScalar(shard.size * lifeT);
        dummy.rotation.set(runtime.elapsed * 1.8, runtime.elapsed * 1.2, runtime.elapsed * 1.5);
        dummy.updateMatrix();
        shardRef.current.setMatrixAt(shardCount, dummy.matrix);

        colorScratch.copy(shard.color).lerp(WHITE, 0.25 + (1 - lifeT) * 0.45);
        shardRef.current.setColorAt(shardCount, colorScratch);
        shardCount += 1;
      }
      shardRef.current.count = shardCount;
      shardRef.current.instanceMatrix.needsUpdate = true;
      if (shardRef.current.instanceColor) shardRef.current.instanceColor.needsUpdate = true;
    }

    if (bloomRef.current) {
      bloomRef.current.intensity = lerp(0.38, 0.98, clamp(runtime.coreGlow * 0.7 + runtime.latchFlash * 0.4, 0, 1));
    }
    if (impactOverlayRef.current) {
      impactOverlayRef.current.style.opacity = `${clamp(runtime.impactFlash * 0.74, 0, 0.74)}`;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 7.3, 4.9]} fov={39} near={0.1} far={120} />
      <color attach="background" args={['#171d3f']} />
      <fog attach="fog" args={['#171d3f', 11, 74]} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#9ad9ff', '#2f264f', 0.28]} />
      <pointLight position={[0, 3.8, 1]} intensity={0.6} color="#55f4ff" />
      <pointLight position={[0, 2.2, -2]} intensity={0.5} color="#ff7fd0" />
      <pointLight position={[-1.8, 2.5, -1.4]} intensity={0.34} color="#c5ff66" />

      <mesh position={[0, -0.85, -30]}>
        <planeGeometry args={[42, 34]} />
        <shaderMaterial
          ref={bgMaterialRef}
          uniforms={{ uTime: { value: 0 }, uGlow: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uGlow;
            varying vec2 vUv;
            void main() {
              vec2 p = vUv * 2.0 - 1.0;
              float r = length(p);
              vec3 deep = vec3(0.03, 0.05, 0.13);
              vec3 violet = vec3(0.2, 0.07, 0.24);
              vec3 cyan = vec3(0.07, 0.23, 0.27);
              float grad = smoothstep(0.0, 1.0, vUv.y);
              float wave = sin((vUv.x * 3.0 + uTime * 0.25) * 6.2831853) * 0.5 + 0.5;
              float grain = fract(sin(dot(vUv * (uTime + 1.37), vec2(12.9898, 78.233))) * 43758.5453);
              vec3 col = mix(deep, violet, grad * 0.8);
              col = mix(col, cyan, wave * 0.16);
              col += (grain - 0.5) * 0.018;
              col += vec3(0.35, 0.29, 0.18) * uGlow * 0.13;
              col *= smoothstep(1.15, 0.18, r);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={planetRef} args={[undefined, undefined, PLANET_POOL]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.1} />
      </instancedMesh>

      <instancedMesh ref={ringRef} args={[undefined, undefined, PLANET_POOL]}>
        <torusGeometry args={[1, 0.028, 10, 80]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={starRef} args={[undefined, undefined, STAR_POOL]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <primitive object={trailObject} />

      <mesh ref={satRef} position={[0, 0.03, 0]}>
        <sphereGeometry args={[PLAYER_RADIUS, 18, 18]} />
        <meshStandardMaterial
          color="#f7fcff"
          emissive="#8ce9ff"
          emissiveIntensity={0.62}
          roughness={0.18}
          metalness={0.06}
        />
      </mesh>

      <mesh ref={latchSparkRef} visible={false} position={[0, 0.04, 0]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={shardRef} args={[undefined, undefined, SHARD_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom ref={bloomRef} intensity={0.4} luminanceThreshold={0.54} luminanceSmoothing={0.24} mipmapBlur />
        <Vignette eskil={false} offset={0.14} darkness={0.68} />
        <Noise premultiply opacity={0.018} />
      </EffectComposer>

      <Html fullscreen>
        <div
          ref={impactOverlayRef}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,112,170,0.45),rgba(255,73,112,0.3),rgba(12,7,25,0))]"
          style={{ opacity: 0, mixBlendMode: 'screen' }}
        />
        <OrbitLatchOverlay />
      </Html>
    </>
  );
}

const OrbitLatch: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(event) => event.preventDefault()}
    >
      <OrbitLatchScene />
    </Canvas>
  );
};

export default OrbitLatch;
export * from './state';
