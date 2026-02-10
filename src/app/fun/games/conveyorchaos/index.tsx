'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
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
import { conveyorChaosState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type ExitDir = 0 | 1 | 2 | 3; // N E S W
type PackagePhase = 'approach' | 'exit';

type PackageRuntime = {
  slot: number;
  active: boolean;
  phase: PackagePhase;
  segmentIndex: number;
  t: number;
  x: number;
  z: number;
  targetExit: ExitDir;
  routeExit: ExitDir;
  speed: number;
  dualTag: boolean;
  rushTag: boolean;
  glow: number;
};

type BeltDef = {
  x: number;
  z: number;
  length: number;
  width: number;
  rotY: number;
  flow: [number, number];
  tint: string;
};

type Runtime = {
  elapsed: number;
  score: number;
  multiplier: number;
  streak: number;
  rushTimer: number;
  streakGlow: number;
  shake: number;
  pulse: number;
  failReason: string;

  diverterDir: ExitDir;
  diverterAngle: number;
  diverterTargetAngle: number;
  lastRotateAt: number;

  spawnTimer: number;
  nextSpawnSlot: number;
  lastTargetExit: number;
  hudCommit: number;
  beltTime: number;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkPackagesLeft: number;

  packages: PackageRuntime[];
};

type ConveyorStore = {
  status: GameStatus;
  score: number;
  best: number;
  multiplier: number;
  streak: number;
  rushTimer: number;
  failMessage: string;
  pulseNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  updateHud: (
    score: number,
    multiplier: number,
    streak: number,
    rushTimer: number,
    pulse: boolean
  ) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'conveyor_chaos_hyper_best_v2';

const PACKAGE_POOL = 72;
const PACKAGE_SIZE = 0.44;
const PACKAGE_HALF = PACKAGE_SIZE * 0.5;
const PACKAGE_Y = 0.28;

const CENTER_X = 0;
const CENTER_Z = 0;
const EXIT_DIST = 5.2;
const APPROACH_START_X = -2.2;
const APPROACH_START_Z = 5.8;
const APPROACH_LEN = Math.hypot(APPROACH_START_X - CENTER_X, APPROACH_START_Z - CENTER_Z);
const EXIT_LEN = EXIT_DIST;

const ROUTE_POINTS = [
  { x: 0, z: -EXIT_DIST }, // N
  { x: EXIT_DIST, z: 0 }, // E
  { x: 0, z: EXIT_DIST }, // S
  { x: -EXIT_DIST, z: 0 }, // W
] as const;

const EXIT_COLORS = [
  new THREE.Color('#58d9ff'),
  new THREE.Color('#ff6dc6'),
  new THREE.Color('#9be66b'),
  new THREE.Color('#ffbf67'),
] as const;

const RUSH_COLOR = new THREE.Color('#ffe16f');
const DUAL_COLOR = new THREE.Color('#f59bff');
const WHITE = new THREE.Color('#f8fbff');
const DIVERTER_BASE = new THREE.Color('#8be7ff');
const DIVERTER_GLOW = new THREE.Color('#b58bff');
const BIN_NEUTRAL = new THREE.Color('#1e2a3f');
const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const INPUT_ROT_Y = Math.atan2(APPROACH_START_X - CENTER_X, APPROACH_START_Z - CENTER_Z);

const BELTS: BeltDef[] = [
  {
    x: (APPROACH_START_X + CENTER_X) * 0.5,
    z: (APPROACH_START_Z + CENTER_Z) * 0.5,
    length: APPROACH_LEN + 0.4,
    width: 1.05,
    rotY: INPUT_ROT_Y,
    flow: [0, -1],
    tint: '#3dc6f8',
  },
  {
    x: 0,
    z: -EXIT_DIST * 0.53,
    length: EXIT_DIST + 0.7,
    width: 1.0,
    rotY: 0,
    flow: [0, -1],
    tint: '#59d8ff',
  },
  {
    x: EXIT_DIST * 0.53,
    z: 0,
    length: EXIT_DIST + 0.7,
    width: 1.0,
    rotY: Math.PI * 0.5,
    flow: [0, 1],
    tint: '#ff74c9',
  },
  {
    x: 0,
    z: EXIT_DIST * 0.53,
    length: EXIT_DIST + 0.7,
    width: 1.0,
    rotY: Math.PI,
    flow: [0, -1],
    tint: '#9ce770',
  },
  {
    x: -EXIT_DIST * 0.53,
    z: 0,
    length: EXIT_DIST + 0.7,
    width: 1.0,
    rotY: -Math.PI * 0.5,
    flow: [0, 1],
    tint: '#ffc56c',
  },
];

const BELT_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BELT_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uRush;
  uniform vec3 uTint;
  uniform vec2 uFlow;
  varying vec2 vUv;

  void main() {
    float speed = 0.75 + uRush * 0.9;
    vec2 uv = vUv + uFlow * (uTime * speed);
    float stripeA = sin((uv.y * 16.0 + uv.x * 2.4) * 6.2831853);
    float stripeB = sin((uv.y * 9.0 - uv.x * 4.3 + uTime * 0.7) * 6.2831853);
    float stripe = stripeA * 0.55 + stripeB * 0.45;
    float pulse = stripe * 0.5 + 0.5;

    float side = abs(vUv.x - 0.5) * 2.0;
    float edge = smoothstep(0.62, 1.0, side);

    vec3 base = mix(vec3(0.08, 0.11, 0.15), uTint, 0.2 + pulse * 0.34);
    base += vec3(0.04, 0.06, 0.08) * edge;
    base += uTint * (uRush * 0.22);

    gl_FragColor = vec4(base, 1.0);
  }
`;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

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

const angleForDir = (dir: ExitDir) => {
  if (dir === 0) return 0;
  if (dir === 1) return -Math.PI * 0.5;
  if (dir === 2) return Math.PI;
  return Math.PI * 0.5;
};

const lerpAngle = (current: number, target: number, t: number) => {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * t;
};

const chooseChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 95, 0, 1);
  runtime.currentChunk = pickPatternChunkForSurvivability(
    'conveyorchaos',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  runtime.chunkPackagesLeft = Math.max(
    3,
    Math.round(runtime.currentChunk.durationSeconds * (1.9 + runtime.difficulty.eventRate * 1.6))
  );
};

const spawnIntervalFor = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 3.4) / 2.8, 0, 1);
  const tutorialSoften = runtime.elapsed < 16 ? 0.24 : runtime.elapsed < 26 ? 0.12 : 0;
  const rushScale = runtime.rushTimer > 0 ? 0.65 : 1;
  const base = lerp(1.02, 0.42, d) + (3 - tier) * 0.04 + tutorialSoften;
  return clamp(base * rushScale + Math.random() * 0.14, 0.24, 1.2);
};

const pickTargetExit = (runtime: Runtime, tier: number): ExitDir => {
  const allowSouth = runtime.elapsed > 24 || tier >= 3;
  const pool: ExitDir[] = allowSouth ? [0, 1, 2, 3] : [0, 1, 3];

  let next = pool[Math.floor(Math.random() * pool.length)];
  if (runtime.lastTargetExit >= 0 && Math.random() < (tier <= 1 ? 0.44 : 0.2)) {
    next = runtime.lastTargetExit as ExitDir;
  } else if (runtime.lastTargetExit >= 0 && tier >= 3 && Math.random() < 0.24) {
    next = ((runtime.lastTargetExit + 1 + Math.floor(Math.random() * 2)) % 4) as ExitDir;
    if (!allowSouth && next === 2) next = 0;
  }

  runtime.lastTargetExit = next;
  return next;
};

const acquirePackageSlot = (runtime: Runtime) => {
  for (let i = 0; i < runtime.packages.length; i += 1) {
    const idx = (runtime.nextSpawnSlot + i) % runtime.packages.length;
    const candidate = runtime.packages[idx];
    if (!candidate.active) {
      runtime.nextSpawnSlot = (idx + 1) % runtime.packages.length;
      return candidate;
    }
  }
  const fallback = runtime.packages[runtime.nextSpawnSlot];
  runtime.nextSpawnSlot = (runtime.nextSpawnSlot + 1) % runtime.packages.length;
  return fallback;
};

const spawnPackage = (runtime: Runtime) => {
  if (!runtime.currentChunk || runtime.chunkPackagesLeft <= 0) {
    chooseChunk(runtime);
  }
  runtime.chunkPackagesLeft -= 1;

  const tier = runtime.currentChunk?.tier ?? 0;
  const d = clamp((runtime.difficulty.speed - 3.4) / 2.8, 0, 1);
  const targetExit = pickTargetExit(runtime, tier);
  const slot = acquirePackageSlot(runtime);

  let dualChance = 0;
  if (runtime.elapsed > 30 && runtime.streak > 0) {
    dualChance = clamp(0.03 + Math.max(0, tier - 1) * 0.03 + d * 0.06, 0, 0.24);
  }
  const dualTag = Math.random() < dualChance;

  let rushChance = 0;
  if (!dualTag && runtime.elapsed > 20) {
    rushChance = clamp(0.02 + d * 0.05, 0, 0.13);
  }
  const rushTag = !dualTag && Math.random() < rushChance;

  slot.active = true;
  slot.phase = 'approach';
  slot.segmentIndex = 0;
  slot.t = 0;
  slot.x = APPROACH_START_X;
  slot.z = APPROACH_START_Z;
  slot.targetExit = targetExit;
  slot.routeExit = targetExit;
  slot.speed = lerp(2.2, 4.7, d) * (1 + Math.max(0, tier - 1) * 0.07);
  slot.dualTag = dualTag;
  slot.rushTag = rushTag;
  slot.glow = 0;
};

const createPackage = (slot: number): PackageRuntime => ({
  slot,
  active: false,
  phase: 'approach',
  segmentIndex: 0,
  t: 0,
  x: OFFSCREEN_POS.x,
  z: OFFSCREEN_POS.z,
  targetExit: 0,
  routeExit: 0,
  speed: 2.4,
  dualTag: false,
  rushTag: false,
  glow: 0,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  multiplier: 1,
  streak: 0,
  rushTimer: 0,
  streakGlow: 0,
  shake: 0,
  pulse: 0,
  failReason: '',

  diverterDir: 0,
  diverterAngle: angleForDir(0),
  diverterTargetAngle: angleForDir(0),
  lastRotateAt: -99,

  spawnTimer: 0.72,
  nextSpawnSlot: 0,
  lastTargetExit: -1,
  hudCommit: 0,
  beltTime: 0,

  difficulty: sampleDifficulty('routing', 0),
  chunkLibrary: buildPatternLibraryTemplate('conveyorchaos'),
  currentChunk: null,
  chunkPackagesLeft: 0,

  packages: Array.from({ length: PACKAGE_POOL }, (_, idx) => createPackage(idx)),
});

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.multiplier = 1;
  runtime.streak = 0;
  runtime.rushTimer = 0;
  runtime.streakGlow = 0;
  runtime.shake = 0;
  runtime.pulse = 0;
  runtime.failReason = '';

  runtime.diverterDir = 0;
  runtime.diverterAngle = angleForDir(0);
  runtime.diverterTargetAngle = angleForDir(0);
  runtime.lastRotateAt = -99;

  runtime.spawnTimer = 0.72;
  runtime.nextSpawnSlot = 0;
  runtime.lastTargetExit = -1;
  runtime.hudCommit = 0;
  runtime.beltTime = 0;

  runtime.difficulty = sampleDifficulty('routing', 0);
  runtime.currentChunk = null;
  runtime.chunkPackagesLeft = 0;

  for (const pkg of runtime.packages) {
    pkg.active = false;
    pkg.phase = 'approach';
    pkg.segmentIndex = 0;
    pkg.t = 0;
    pkg.x = OFFSCREEN_POS.x;
    pkg.z = OFFSCREEN_POS.z;
    pkg.targetExit = 0;
    pkg.routeExit = 0;
    pkg.speed = 2.4;
    pkg.dualTag = false;
    pkg.rushTag = false;
    pkg.glow = 0;
  }
};

const useConveyorStore = create<ConveyorStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  multiplier: 1,
  streak: 0,
  rushTimer: 0,
  failMessage: '',
  pulseNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      multiplier: 1,
      streak: 0,
      rushTimer: 0,
      failMessage: '',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      multiplier: 1,
      streak: 0,
      rushTimer: 0,
      failMessage: '',
    }),
  updateHud: (score, multiplier, streak, rushTimer, pulse) =>
    set((state) => ({
      score: Math.floor(score),
      multiplier,
      streak,
      rushTimer,
      pulseNonce: pulse ? state.pulseNonce + 1 : state.pulseNonce,
    })),
  endRun: (score, reason) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        best: nextBest,
        multiplier: 1,
        streak: 0,
        rushTimer: 0,
        failMessage: reason,
      };
    }),
}));

function ConveyorChaosOverlay() {
  const status = useConveyorStore((state) => state.status);
  const score = useConveyorStore((state) => state.score);
  const best = useConveyorStore((state) => state.best);
  const streak = useConveyorStore((state) => state.streak);
  const multiplier = useConveyorStore((state) => state.multiplier);
  const rushTimer = useConveyorStore((state) => state.rushTimer);
  const failMessage = useConveyorStore((state) => state.failMessage);
  const pulseNonce = useConveyorStore((state) => state.pulseNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-sky-100/55 bg-gradient-to-br from-sky-500/22 via-cyan-500/16 to-emerald-500/18 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Conveyor Chaos</div>
        <div className="text-[11px] text-cyan-50/85">Tap to rotate diverter clockwise.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-amber-100/55 bg-gradient-to-br from-amber-500/24 via-orange-500/18 to-sky-500/16 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-sky-100/35 bg-gradient-to-br from-slate-950/72 via-sky-900/30 to-amber-900/22 px-3 py-2 text-xs">
          <div>
            Streak <span className="font-semibold text-cyan-200">{streak}</span>
          </div>
          <div>
            Multiplier <span className="font-semibold text-amber-200">x{multiplier.toFixed(2)}</span>
          </div>
          <div>
            Rush{' '}
            <span className={`font-semibold ${rushTimer > 0 ? 'text-lime-200' : 'text-white/70'}`}>
              {rushTimer > 0 ? `${rushTimer.toFixed(1)}s` : 'Off'}
            </span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-sky-100/42 bg-gradient-to-br from-slate-950/80 via-sky-950/44 to-amber-950/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">CONVEYOR CHAOS</div>
            <div className="mt-2 text-sm text-white/85">Tap rotates diverter 90° clockwise.</div>
            <div className="mt-1 text-sm text-white/80">
              Match package color to bin direction or lose instantly.
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/42 to-amber-950/28 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Sorting Error</div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div
          key={pulseNonce}
          className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70"
          style={{
            animation: 'conveyor-stamp 220ms ease-out forwards',
            opacity: 0,
            boxShadow: '0 0 24px rgba(88, 217, 255, 0.28)',
          }}
        />
      )}

      <style jsx global>{`
        @keyframes conveyor-stamp {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0.72;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.28);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function ConveyorChaosScene() {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const resetVersion = useSnapshot(conveyorChaosState).resetVersion;

  const runtimeRef = useRef<Runtime>(createRuntime());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  const packageRef = useRef<THREE.InstancedMesh>(null);
  const symbolRef = useRef<THREE.InstancedMesh>(null);
  const markerRef = useRef<THREE.InstancedMesh>(null);
  const diverterGroupRef = useRef<THREE.Group>(null);
  const diverterMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const fixedStepRef = useRef(createFixedStepState());

  const { camera } = useThree();

  const beltUniforms = useMemo(
    () =>
      BELTS.map((belt) => ({
        uTime: { value: 0 },
        uRush: { value: 0 },
        uTint: { value: new THREE.Color(belt.tint) },
        uFlow: { value: new THREE.Vector2(belt.flow[0], belt.flow[1]) },
      })),
    []
  );

  const failRun = (reason: string) => {
    const runtime = runtimeRef.current;
    const store = useConveyorStore.getState();
    if (store.status !== 'PLAYING') return;
    runtime.failReason = reason;
    useConveyorStore.getState().endRun(runtime.score, reason);
  };

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useConveyorStore.getState().resetToStart();
  }, []);

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useConveyorStore.getState().resetToStart();
  }, [resetVersion]);

  useEffect(() => {
    const apply = (state: ReturnType<typeof useConveyorStore.getState>) => {
      conveyorChaosState.score = state.score;
      conveyorChaosState.bestScore = state.best;
      conveyorChaosState.gameOver = state.status === 'GAMEOVER';
      conveyorChaosState.chain = state.streak;
      conveyorChaosState.deliveryStreak = state.streak;
      conveyorChaosState.strikes =
        state.status === 'GAMEOVER' ? conveyorChaosState.maxStrikes : 0;
    };

    apply(useConveyorStore.getState());
    const unsubscribe = useConveyorStore.subscribe(apply);
    return () => unsubscribe();
  }, []);

  useFrame((_, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      clearFrameInput(inputRef);
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = useConveyorStore.getState();

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap) {
      if (store.status !== 'PLAYING') {
        resetRuntime(runtime);
        useConveyorStore.getState().startRun();
      } else {
        const nextDir = ((runtime.diverterDir + 1) % 4) as ExitDir;
        runtime.diverterDir = nextDir;
        runtime.diverterTargetAngle = angleForDir(nextDir);
        runtime.lastRotateAt = runtime.elapsed;
        runtime.shake = Math.min(1.15, runtime.shake + 0.18);
      }
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.difficulty = sampleDifficulty('routing', runtime.elapsed);
      runtime.rushTimer = Math.max(0, runtime.rushTimer - dt);
      runtime.streakGlow = Math.max(0, runtime.streakGlow - dt * 0.58);
      runtime.hudCommit += dt;

      const rushFactor = runtime.rushTimer > 0 ? 2 : 1;
      runtime.beltTime += dt * (1 + runtime.difficulty.speed * 0.18) * rushFactor;

      runtime.spawnTimer -= dt;
      if (runtime.spawnTimer <= 0) {
        spawnPackage(runtime);
        const tier = runtime.currentChunk?.tier ?? 0;
        runtime.spawnTimer += spawnIntervalFor(runtime, tier);
      }

      let routedThisFrame = false;
      for (const pkg of runtime.packages) {
        if (!pkg.active) continue;

        const speed = pkg.speed * rushFactor;
        pkg.glow = Math.max(0, pkg.glow - dt * 3.4);

        if (pkg.phase === 'approach') {
          pkg.segmentIndex = 0;
          pkg.t += (speed * dt) / APPROACH_LEN;
          const t = clamp(pkg.t, 0, 1);
          pkg.x = lerp(APPROACH_START_X, CENTER_X, t);
          pkg.z = lerp(APPROACH_START_Z, CENTER_Z, t);

          if (pkg.t >= 1) {
            const hadStreak = runtime.streak > 0;
            if (runtime.diverterDir !== pkg.targetExit) {
              if (withinGraceWindow(runtime.elapsed, runtime.lastRotateAt, 0.1)) {
                runtime.diverterDir = pkg.targetExit;
                runtime.diverterTargetAngle = angleForDir(pkg.targetExit);
              } else {
                failRun('Wrong diverter direction.');
                break;
              }
            }
            if (pkg.dualTag && !hadStreak) {
              failRun('Dual-tag required two in a row.');
              break;
            }

            pkg.phase = 'exit';
            pkg.segmentIndex = 1;
            pkg.t = 0;
            pkg.routeExit = runtime.diverterDir;
            pkg.glow = 1;

            runtime.streak += 1;
            runtime.multiplier = clamp(1 + Math.min(runtime.streak, 16) * 0.11, 1, 4.2);
            let points = Math.max(1, Math.floor(runtime.multiplier));
            if (pkg.dualTag) points += 2;
            if (runtime.rushTimer > 0) points += 1;
            runtime.score += points;
            if (pkg.rushTag) runtime.rushTimer = Math.max(runtime.rushTimer, 4.0);

            runtime.streakGlow = clamp(runtime.streakGlow + 0.34 + runtime.streak * 0.03, 0, 1.8);
            runtime.pulse = Math.min(1.3, runtime.pulse + 0.38);
            runtime.shake = Math.min(1.2, runtime.shake + (pkg.dualTag ? 0.54 : 0.24));

            useConveyorStore
              .getState()
              .updateHud(
                runtime.score,
                runtime.multiplier,
                runtime.streak,
                runtime.rushTimer,
                true
              );
            runtime.hudCommit = 0;
            routedThisFrame = true;
          }
        } else {
          pkg.segmentIndex = 1;
          const exit = ROUTE_POINTS[pkg.routeExit];
          pkg.t += (speed * dt) / EXIT_LEN;
          const t = clamp(pkg.t, 0, 1);
          pkg.x = lerp(CENTER_X, exit.x, t);
          pkg.z = lerp(CENTER_Z, exit.z, t);
          if (pkg.t >= 1) {
            pkg.active = false;
          }
        }

        if (Math.abs(pkg.x) > EXIT_DIST + 1 || Math.abs(pkg.z) > EXIT_DIST + 1) {
          pkg.active = false;
        }
      }

      if (!routedThisFrame && runtime.hudCommit >= 0.1) {
        runtime.hudCommit = 0;
        useConveyorStore
          .getState()
          .updateHud(runtime.score, runtime.multiplier, runtime.streak, runtime.rushTimer, false);
      }

      conveyorChaosState.elapsed = runtime.elapsed;
      conveyorChaosState.chain = runtime.streak;
    }

    runtime.pulse = Math.max(0, runtime.pulse - dt * 3.8);
    runtime.shake = Math.max(0, runtime.shake - dt * 4.6);

    runtime.diverterAngle = lerpAngle(
      runtime.diverterAngle,
      runtime.diverterTargetAngle,
      1 - Math.exp(-16 * dt)
    );

    if (diverterGroupRef.current) {
      diverterGroupRef.current.rotation.y = runtime.diverterAngle;
    }
    if (diverterMatRef.current) {
      const neon = clamp(0.38 + runtime.streakGlow * 0.44, 0.38, 1.5);
      colorScratch.copy(DIVERTER_BASE).lerp(DIVERTER_GLOW, clamp(runtime.streakGlow * 0.45, 0, 0.8));
      diverterMatRef.current.emissive.copy(colorScratch);
      diverterMatRef.current.emissiveIntensity = neon;
    }

    const shakeAmp = runtime.shake * 0.1;
    const shakeTime = runtime.elapsed * 22;
    camTarget.set(
      shakeNoiseSigned(shakeTime, 2.7) * shakeAmp,
      8.6 + shakeNoiseSigned(shakeTime, 8.2) * shakeAmp * 0.55,
      shakeNoiseSigned(shakeTime, 13.9) * shakeAmp * 0.35
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-7.4 * step.renderDt));
    camera.lookAt(0, 0, 0);

    for (const uniforms of beltUniforms) {
      uniforms.uTime.value = runtime.beltTime;
      uniforms.uRush.value = runtime.rushTimer > 0 ? 1 : 0;
    }

    if (packageRef.current && symbolRef.current && markerRef.current) {
      for (let i = 0; i < runtime.packages.length; i += 1) {
        const pkg = runtime.packages[i];
        if (!pkg.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          packageRef.current.setMatrixAt(i, dummy.matrix);
          packageRef.current.setColorAt(i, WHITE);
          symbolRef.current.setMatrixAt(i, dummy.matrix);
          symbolRef.current.setColorAt(i, WHITE);
          markerRef.current.setMatrixAt(i, dummy.matrix);
          markerRef.current.setColorAt(i, WHITE);
          continue;
        }

        dummy.position.set(pkg.x, PACKAGE_Y, pkg.z);
        dummy.scale.set(PACKAGE_SIZE, PACKAGE_SIZE, PACKAGE_SIZE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        packageRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch
          .copy(EXIT_COLORS[pkg.targetExit])
          .lerp(WHITE, clamp(pkg.glow * 0.5, 0, 0.58));
        packageRef.current.setColorAt(i, colorScratch);

        dummy.position.set(pkg.x, PACKAGE_Y + 0.18, pkg.z);
        dummy.scale.set(0.08, 0.06, 0.24);
        dummy.rotation.set(0, angleForDir(pkg.targetExit), 0);
        dummy.updateMatrix();
        symbolRef.current.setMatrixAt(i, dummy.matrix);
        symbolRef.current.setColorAt(i, WHITE);

        if (pkg.dualTag || pkg.rushTag) {
          dummy.position.set(pkg.x, PACKAGE_Y + 0.26, pkg.z);
          dummy.scale.set(0.19, 0.05, 0.19);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          markerRef.current.setMatrixAt(i, dummy.matrix);
          markerRef.current.setColorAt(i, pkg.dualTag ? DUAL_COLOR : RUSH_COLOR);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          markerRef.current.setMatrixAt(i, dummy.matrix);
          markerRef.current.setColorAt(i, WHITE);
        }
      }
      packageRef.current.instanceMatrix.needsUpdate = true;
      symbolRef.current.instanceMatrix.needsUpdate = true;
      markerRef.current.instanceMatrix.needsUpdate = true;
      if (packageRef.current.instanceColor) packageRef.current.instanceColor.needsUpdate = true;
      if (symbolRef.current.instanceColor) symbolRef.current.instanceColor.needsUpdate = true;
      if (markerRef.current.instanceColor) markerRef.current.instanceColor.needsUpdate = true;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 8.6, 0.001]} zoom={96} near={0.1} far={60} />
      <color attach="background" args={['#18243a']} />
      <fog attach="fog" args={['#18243a', 6, 28]} />

      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#b6e8ff', '#2d3950', 0.28]} />
      <directionalLight position={[3.2, 8.2, 2.4]} intensity={0.92} color="#d6edff" />
      <pointLight position={[0, 2.8, 0]} intensity={0.42} color="#8be8ff" />

      <mesh position={[0, -0.11, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[22, 22]} />
        <meshStandardMaterial color="#10192b" roughness={0.95} metalness={0.02} />
      </mesh>

      {BELTS.map((belt, index) => (
        <mesh
          key={`belt-${index}`}
          position={[belt.x, 0.02, belt.z]}
          rotation={[-Math.PI * 0.5, belt.rotY, 0]}
        >
          <planeGeometry args={[belt.width, belt.length]} />
          <shaderMaterial
            uniforms={beltUniforms[index]}
            vertexShader={BELT_VERTEX_SHADER}
            fragmentShader={BELT_FRAGMENT_SHADER}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[2.16, 0.16, 2.16]} />
        <meshStandardMaterial color="#21314a" roughness={0.48} metalness={0.06} />
      </mesh>

      <group ref={diverterGroupRef} position={[0, 0.17, 0]}>
        <mesh>
          <cylinderGeometry args={[0.58, 0.58, 0.18, 26]} />
          <meshStandardMaterial color="#f6fbff" roughness={0.34} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.06, -0.68]}>
          <boxGeometry args={[0.34, 0.1, 1.18]} />
          <meshStandardMaterial
            ref={diverterMatRef}
            color="#8be7ff"
            emissive="#8be7ff"
            emissiveIntensity={0.45}
            roughness={0.28}
            metalness={0.08}
          />
        </mesh>
        <mesh position={[0, 0.08, -1.24]}>
          <coneGeometry args={[0.27, 0.35, 3]} />
          <meshStandardMaterial color="#d7f6ff" emissive="#9be8ff" emissiveIntensity={0.42} />
        </mesh>
      </group>

      {ROUTE_POINTS.map((target, index) => (
        <group key={`bin-${index}`} position={[target.x, 0.11, target.z]}>
          <mesh>
            <boxGeometry args={[1.45, 0.22, 1.45]} />
            <meshStandardMaterial color={BIN_NEUTRAL} roughness={0.58} metalness={0.04} />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[1.08, 0.04, 1.08]} />
            <meshBasicMaterial color={EXIT_COLORS[index]} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <instancedMesh ref={packageRef} args={[undefined, undefined, PACKAGE_POOL]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.32}
          metalness={0.06}
          emissive="#1f2d44"
          emissiveIntensity={0.22}
        />
      </instancedMesh>

      <instancedMesh ref={symbolRef} args={[undefined, undefined, PACKAGE_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={markerRef} args={[undefined, undefined, PACKAGE_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.4} luminanceThreshold={0.56} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.14} darkness={0.62} />
        <Noise premultiply opacity={0.02} />
      </EffectComposer>

      <Html fullscreen>
        <ConveyorChaosOverlay />
      </Html>
    </>
  );
}

const ConveyorChaos: React.FC<{ soundsOn?: boolean }> = () => {
  return <ConveyorChaosScene />;
};

export default ConveyorChaos;
export * from './state';
