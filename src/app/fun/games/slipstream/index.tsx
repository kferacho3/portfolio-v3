'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera } from '@react-three/drei';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
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
  circleVsAabbForgiving,
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
} from '../_shared/hyperUpgradeKit';
import { slipstreamState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type LaneIndex = 0 | 1 | 2;

type TunnelSegment = {
  slot: number;
  z: number;
  pulse: number;
};

type Comet = {
  slot: number;
  active: boolean;
  lane: LaneIndex;
  x: number;
  z: number;
  weaveAmp: number;
  weaveFreq: number;
  phase: number;
  speedFactor: number;
  radius: number;
  slipMin: number;
  slipMax: number;
  nearAwarded: boolean;
  tint: number;
};

type Gust = {
  slot: number;
  active: boolean;
  lane: LaneIndex;
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  speedFactor: number;
  tint: number;
};

type Streak = {
  slot: number;
  x: number;
  y: number;
  z: number;
  len: number;
  speedFactor: number;
};

type Runtime = {
  elapsed: number;
  score: number;
  distance: number;
  slipTime: number;
  slipStreak: number;
  multiplier: number;
  nearMisses: number;
  laneIndex: LaneIndex;
  targetX: number;
  playerX: number;
  inSlipstream: boolean;
  slipBlend: number;
  slipStrength: number;
  outOfDraftTimer: number;
  hudCommit: number;
  shake: number;
  failMessage: string;
  speedNow: number;

  cometSpawnTimer: number;
  gustSpawnTimer: number;
  nextCometSlot: number;
  nextGustSlot: number;
  lastCometLane: number;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkCometsLeft: number;

  segments: TunnelSegment[];
  comets: Comet[];
  gusts: Gust[];
  streaks: Streak[];
};

type SlipStreamStore = {
  status: GameStatus;
  score: number;
  best: number;
  multiplier: number;
  nearMisses: number;
  slipRatio: number;
  failMessage: string;
  pulseNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  onTapFx: () => void;
  updateHud: (
    score: number,
    multiplier: number,
    nearMisses: number,
    slipRatio: number
  ) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'slipstream_hyper_best_v3';

const LANE_X: readonly [number, number, number] = [-1.35, 0, 1.35];
const PLAYER_R = 0.2;
const PLAYER_Z = 0;

const TUNNEL_HALF_W = 2.05;
const TUNNEL_HALF_H = 0.46;
const SEGMENT_COUNT = 46;
const SEGMENT_SPACING = 1.62;
const PANELS_PER_SEGMENT = 5;
const TUNNEL_INSTANCE_COUNT = SEGMENT_COUNT * PANELS_PER_SEGMENT;

const COMET_POOL = 20;
const GUST_POOL = 28;
const STREAK_POOL = 88;

const FRONT_Z = 6;
const FAR_Z = -92;

const COMET_COLLIDE_Z = 0.5;
const GUST_COLLIDE_Z = 0.46;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const STREAM = new THREE.Color('#87f8ff');
const COMET_COLOR = new THREE.Color('#ff9654');
const GUST_COLOR = new THREE.Color('#b27bff');
const LOG_BROWN = new THREE.Color('#e3b376');
const LOG_DARK = new THREE.Color('#9a6843');
const LANE_DIVIDER = new THREE.Color('#fff4bc');
const DANGER = new THREE.Color('#ff4d84');
const WHITE = new THREE.Color('#f7fbff');
const TRACK_MAIN = new THREE.Color('#3ea8d4');
const TRACK_GLOW = new THREE.Color('#79edff');

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

const circleVsAabb = (
  px: number,
  pz: number,
  r: number,
  bx: number,
  bz: number,
  hw: number,
  hd: number
) => circleVsAabbForgiving(px, pz, r, bx, bz, hw, hd, 0.9);

const makeSegment = (slot: number): TunnelSegment => ({
  slot,
  z: 4 - slot * SEGMENT_SPACING,
  pulse: Math.random() * Math.PI * 2,
});

const makeComet = (slot: number): Comet => ({
  slot,
  active: false,
  lane: 1,
  x: 0,
  z: -12,
  weaveAmp: 0.2,
  weaveFreq: 1.1,
  phase: 0,
  speedFactor: 1,
  radius: 0.42,
  slipMin: 0.8,
  slipMax: 4.2,
  nearAwarded: false,
  tint: Math.random(),
});

const makeGust = (slot: number): Gust => ({
  slot,
  active: false,
  lane: 1,
  x: 0,
  z: -12,
  width: 1.34,
  height: 0.56,
  depth: 0.82,
  swayAmp: 0.14,
  swayFreq: 1.1,
  phase: 0,
  speedFactor: 1.04,
  tint: Math.random(),
});

const makeStreak = (slot: number): Streak => ({
  slot,
  x: (Math.random() < 0.5 ? -1 : 1) * (TUNNEL_HALF_W + 0.72 + Math.random() * 1.35),
  y: -0.32 + Math.random() * 0.2,
  z: FAR_Z + Math.random() * (Math.abs(FAR_Z) + FRONT_Z),
  len: 0.45 + Math.random() * 1.25,
  speedFactor: 0.65 + Math.random() * 1.35,
});

const reseedStreak = (streak: Streak, randomizeDepth: boolean) => {
  streak.x = (Math.random() < 0.5 ? -1 : 1) * (TUNNEL_HALF_W + 0.72 + Math.random() * 1.35);
  streak.y = -0.32 + Math.random() * 0.2;
  streak.z = randomizeDepth ? FAR_Z + Math.random() * (Math.abs(FAR_Z) + FRONT_Z) : -38 - Math.random() * 20;
  streak.len = 0.45 + Math.random() * 1.25;
  streak.speedFactor = 0.65 + Math.random() * 1.35;
};

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  distance: 0,
  slipTime: 0,
  slipStreak: 0,
  multiplier: 1,
  nearMisses: 0,
  laneIndex: 1,
  targetX: 0,
  playerX: 0,
  inSlipstream: false,
  slipBlend: 0,
  slipStrength: 0,
  outOfDraftTimer: 0,
  hudCommit: 0,
  shake: 0,
  failMessage: '',
  speedNow: 6,

  cometSpawnTimer: 0.58,
  gustSpawnTimer: 1.35,
  nextCometSlot: 0,
  nextGustSlot: 0,
  lastCometLane: -1,

  difficulty: sampleDifficulty('lane-switch', 0),
  chunkLibrary: buildPatternLibraryTemplate('slipstream'),
  currentChunk: null,
  chunkCometsLeft: 0,

  segments: Array.from({ length: SEGMENT_COUNT }, (_, idx) => makeSegment(idx)),
  comets: Array.from({ length: COMET_POOL }, (_, idx) => makeComet(idx)),
  gusts: Array.from({ length: GUST_POOL }, (_, idx) => makeGust(idx)),
  streaks: Array.from({ length: STREAK_POOL }, (_, idx) => makeStreak(idx)),
});

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.distance = 0;
  runtime.slipTime = 0;
  runtime.slipStreak = 0;
  runtime.multiplier = 1;
  runtime.nearMisses = 0;
  runtime.laneIndex = 1;
  runtime.targetX = LANE_X[1];
  runtime.playerX = LANE_X[1];
  runtime.inSlipstream = false;
  runtime.slipBlend = 0;
  runtime.slipStrength = 0;
  runtime.outOfDraftTimer = 0;
  runtime.hudCommit = 0;
  runtime.shake = 0;
  runtime.failMessage = '';
  runtime.speedNow = 6;

  runtime.cometSpawnTimer = 0.58;
  runtime.gustSpawnTimer = 1.35;
  runtime.nextCometSlot = 0;
  runtime.nextGustSlot = 0;
  runtime.lastCometLane = -1;

  runtime.difficulty = sampleDifficulty('lane-switch', 0);
  runtime.currentChunk = null;
  runtime.chunkCometsLeft = 0;

  for (let i = 0; i < runtime.segments.length; i += 1) {
    const segment = runtime.segments[i];
    segment.z = 4 - i * SEGMENT_SPACING;
    segment.pulse = Math.random() * Math.PI * 2;
  }

  for (const comet of runtime.comets) {
    comet.active = false;
    comet.x = 0;
    comet.z = -12;
    comet.nearAwarded = false;
  }

  for (const gust of runtime.gusts) {
    gust.active = false;
    gust.x = 0;
    gust.z = -12;
  }

  for (const streak of runtime.streaks) {
    reseedStreak(streak, true);
  }
};

const useSlipStreamStore = create<SlipStreamStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  multiplier: 1,
  nearMisses: 0,
  slipRatio: 0,
  failMessage: '',
  pulseNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      multiplier: 1,
      nearMisses: 0,
      slipRatio: 0,
      failMessage: '',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      multiplier: 1,
      nearMisses: 0,
      slipRatio: 0,
      failMessage: '',
    }),
  onTapFx: () => set((state) => ({ pulseNonce: state.pulseNonce + 1 })),
  updateHud: (score, multiplier, nearMisses, slipRatio) =>
    set({
      score: Math.floor(score),
      multiplier,
      nearMisses,
      slipRatio,
    }),
  endRun: (score, reason) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        best: nextBest,
        multiplier: 1,
        nearMisses: 0,
        slipRatio: 0,
        failMessage: reason,
      };
    }),
}));

const chooseChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 95, 0, 1);
  runtime.currentChunk = pickPatternChunkForSurvivability(
    'slipstream',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  runtime.chunkCometsLeft = Math.max(
    3,
    Math.round(runtime.currentChunk.durationSeconds * (1.8 + runtime.difficulty.eventRate * 1.5))
  );
};

const cometIntervalFor = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const tutorialSlow = runtime.elapsed < 14 ? 0.32 : runtime.elapsed < 24 ? 0.16 : 0;
  return clamp(
    lerp(1.2, 0.46, d) + (3 - tier) * 0.05 + tutorialSlow + Math.random() * 0.18,
    0.24,
    1.5
  );
};

const gustIntervalFor = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const tutorialSlow = runtime.elapsed < 18 ? 1.2 : runtime.elapsed < 28 ? 0.5 : 0;
  return clamp(
    lerp(3.8, 1.25, d) + (3 - tier) * 0.16 + tutorialSlow + Math.random() * 0.35,
    0.95,
    4.4
  );
};

const acquireComet = (runtime: Runtime) => {
  for (let i = 0; i < runtime.comets.length; i += 1) {
    const idx = (runtime.nextCometSlot + i) % runtime.comets.length;
    const comet = runtime.comets[idx];
    if (!comet.active) {
      runtime.nextCometSlot = (idx + 1) % runtime.comets.length;
      return comet;
    }
  }
  const fallback = runtime.comets[runtime.nextCometSlot];
  runtime.nextCometSlot = (runtime.nextCometSlot + 1) % runtime.comets.length;
  return fallback;
};

const acquireGust = (runtime: Runtime) => {
  for (let i = 0; i < runtime.gusts.length; i += 1) {
    const idx = (runtime.nextGustSlot + i) % runtime.gusts.length;
    const gust = runtime.gusts[idx];
    if (!gust.active) {
      runtime.nextGustSlot = (idx + 1) % runtime.gusts.length;
      return gust;
    }
  }
  const fallback = runtime.gusts[runtime.nextGustSlot];
  runtime.nextGustSlot = (runtime.nextGustSlot + 1) % runtime.gusts.length;
  return fallback;
};

const spawnComet = (runtime: Runtime) => {
  if (!runtime.currentChunk || runtime.chunkCometsLeft <= 0) {
    chooseChunk(runtime);
  }
  runtime.chunkCometsLeft -= 1;
  const tier = runtime.currentChunk?.tier ?? 0;
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const earlyScale = runtime.elapsed < 12 ? 0.42 : runtime.elapsed < 20 ? 0.72 : 1;

  let lane = Math.floor(Math.random() * 3) as LaneIndex;
  if (runtime.lastCometLane >= 0 && Math.random() < (tier <= 1 ? 0.42 : 0.22)) {
    lane = runtime.lastCometLane as LaneIndex;
  }
  runtime.lastCometLane = lane;

  const comet = acquireComet(runtime);
  comet.active = true;
  comet.lane = lane;
  comet.z = -15.5 - Math.random() * 6.5;
  comet.x = LANE_X[lane];
  comet.weaveAmp = lerp(0.02, 0.18, d) * (0.62 + tier * 0.1) * earlyScale;
  comet.weaveFreq = lerp(0.8, 1.7, d) + Math.random() * 0.35;
  comet.phase = Math.random() * Math.PI * 2;
  comet.speedFactor = clamp(lerp(0.95, 1.24, d) + tier * 0.04 + (Math.random() * 2 - 1) * 0.05, 0.88, 1.42);
  comet.radius = clamp(lerp(0.38, 0.54, d) + tier * 0.02, 0.34, 0.6);
  comet.slipMin = 0.82;
  comet.slipMax = clamp(lerp(5.0, 3.7, d) + tier * 0.1, 3.0, 5.3);
  comet.nearAwarded = false;
  comet.tint = Math.random();
};

const spawnGust = (runtime: Runtime) => {
  const tier = runtime.currentChunk?.tier ?? 0;
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const gust = acquireGust(runtime);

  let lane = runtime.laneIndex;
  if (Math.random() > 0.56) {
    lane = Math.floor(Math.random() * 3) as LaneIndex;
  }

  gust.active = true;
  gust.lane = lane;
  gust.z = -16.2 - Math.random() * 7.2;
  gust.x = LANE_X[lane];
  gust.width = clamp(1.14 + Math.random() * 0.26, 1.02, 1.54);
  gust.height = clamp(0.42 + Math.random() * 0.22, 0.36, 0.78);
  gust.depth = clamp(0.72 + Math.random() * 0.26, 0.64, 1.02);
  gust.swayAmp = lerp(0.02, 0.16, d) * (0.52 + tier * 0.08);
  gust.swayFreq = lerp(0.9, 1.9, d) + Math.random() * 0.42;
  gust.phase = Math.random() * Math.PI * 2;
  gust.speedFactor = clamp(0.98 + d * 0.22 + (Math.random() * 2 - 1) * 0.08, 0.9, 1.34);
  gust.tint = Math.random();
};

function SlipStreamOverlay() {
  const status = useSlipStreamStore((state) => state.status);
  const score = useSlipStreamStore((state) => state.score);
  const best = useSlipStreamStore((state) => state.best);
  const multiplier = useSlipStreamStore((state) => state.multiplier);
  const nearMisses = useSlipStreamStore((state) => state.nearMisses);
  const slipRatio = useSlipStreamStore((state) => state.slipRatio);
  const failMessage = useSlipStreamStore((state) => state.failMessage);
  const pulseNonce = useSlipStreamStore((state) => state.pulseNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-sky-100/55 bg-gradient-to-br from-sky-500/24 via-cyan-500/16 to-emerald-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Slip Stream</div>
        <div className="text-[11px] text-cyan-50/85">Tap lanes. Dodge visible logs, rocks, and crates.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-amber-100/55 bg-gradient-to-br from-violet-500/22 via-fuchsia-500/16 to-amber-500/22 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-sky-100/35 bg-gradient-to-br from-slate-950/72 via-cyan-900/30 to-emerald-900/28 px-3 py-2 text-xs">
          <div>
            Flow <span className="font-semibold text-cyan-200">{Math.round(slipRatio * 100)}%</span>
          </div>
          <div>
            Multiplier <span className="font-semibold text-amber-200">x{multiplier.toFixed(2)}</span>
          </div>
          <div>
            Near-Miss <span className="font-semibold text-fuchsia-200">{nearMisses}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-sky-100/40 bg-gradient-to-br from-slate-950/78 via-cyan-950/52 to-amber-950/35 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">SLIP STREAM</div>
            <div className="mt-2 text-sm text-white/85">Tap cycles Left, Center, Right lanes.</div>
            <div className="mt-1 text-sm text-white/80">Dodge rocks and crates on the floating log track.</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/82 via-rose-950/45 to-amber-950/35 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Run Collapsed</div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={pulseNonce}>
          <div
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, rgba(47,217,255,0) 0%, rgba(47,217,255,0.8) 25%, rgba(255,97,204,0.85) 75%, rgba(255,97,204,0) 100%)',
              boxShadow: '0 0 20px rgba(95,224,255,0.45)',
              animation: 'slipstream-laneflash 220ms ease-out forwards',
            }}
          />
        </div>
      )}

      {status === 'PLAYING' && (
        <div
          className="absolute inset-0"
          style={{
            opacity: slipRatio * 0.2,
            background:
              'radial-gradient(70% 45% at 50% 52%, rgba(47,217,255,0.14), rgba(168,92,255,0.02) 60%, rgba(0,0,0,0) 100%)',
            transition: 'opacity 80ms linear',
          }}
        />
      )}

      <style jsx global>{`
        @keyframes slipstream-laneflash {
          0% {
            opacity: 0.95;
            transform: scaleX(0.75);
          }
          100% {
            opacity: 0;
            transform: scaleX(1.12);
          }
        }
      `}</style>
    </div>
  );
}

function SlipStreamScene() {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const tunnelRef = useRef<THREE.InstancedMesh>(null);
  const cometRef = useRef<THREE.InstancedMesh>(null);
  const coneRef = useRef<THREE.InstancedMesh>(null);
  const gustRef = useRef<THREE.InstancedMesh>(null);
  const streakRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  const bloomRef = useRef<any>(null);
  const fixedStepRef = useRef(createFixedStepState());

  const chromaOffset = useMemo(() => new THREE.Vector2(0.00032, 0), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  const { camera } = useThree();

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useSlipStreamStore.getState().resetToStart();
    slipstreamState.status = 'menu';
    slipstreamState.score = 0;
  }, []);

  useEffect(() => {
    const apply = (state: ReturnType<typeof useSlipStreamStore.getState>) => {
      slipstreamState.status =
        state.status === 'START'
          ? 'menu'
          : state.status === 'PLAYING'
            ? 'playing'
            : 'gameover';
      slipstreamState.score = state.score;
      slipstreamState.best = state.best;
    };

    apply(useSlipStreamStore.getState());
    const unsub = useSlipStreamStore.subscribe(apply);
    return () => unsub();
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
    const store = useSlipStreamStore.getState();

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');

    if (tap) {
      if (store.status !== 'PLAYING') {
        resetRuntime(runtime);
        useSlipStreamStore.getState().startRun();
      } else {
        runtime.laneIndex = ((runtime.laneIndex + 1) % 3) as LaneIndex;
        runtime.targetX = LANE_X[runtime.laneIndex];
        runtime.shake = Math.min(1.15, runtime.shake + 0.24);
        useSlipStreamStore.getState().onTapFx();
      }
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.difficulty = sampleDifficulty('lane-switch', runtime.elapsed);

      const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
      const baseSpeed = lerp(5.8, 10.2, d);
      runtime.inSlipstream = runtime.laneIndex === 1;
      runtime.slipStrength = runtime.inSlipstream ? 1 : 0;
      runtime.speedNow = baseSpeed * (1 + runtime.slipStrength * 0.2);

      runtime.playerX = lerp(runtime.playerX, runtime.targetX, 1 - Math.exp(-14 * dt));

      runtime.cometSpawnTimer -= dt;
      if (runtime.cometSpawnTimer <= 0) {
        spawnComet(runtime);
        const tier = runtime.currentChunk?.tier ?? 0;
        runtime.cometSpawnTimer += cometIntervalFor(runtime, tier);
      }

      runtime.gustSpawnTimer -= dt;
      if (runtime.gustSpawnTimer <= 0) {
        const tier = runtime.currentChunk?.tier ?? 0;
        const gustChance =
          runtime.elapsed < 14
            ? 0
            : clamp(0.2 + Math.max(0, tier - 1) * 0.1 + d * 0.22, 0.2, 0.75);
        if (Math.random() < gustChance) {
          spawnGust(runtime);
        }
        runtime.gustSpawnTimer += gustIntervalFor(runtime, tier);
      }

      let failed = false;

      for (const comet of runtime.comets) {
        if (!comet.active) continue;

        const prevZ = comet.z;
        comet.z += runtime.speedNow * comet.speedFactor * dt;
        comet.x =
          LANE_X[comet.lane] +
          Math.sin(runtime.elapsed * comet.weaveFreq + comet.phase) * comet.weaveAmp;

        if (comet.z > FRONT_Z + 1.5) {
          comet.active = false;
          continue;
        }

        if (
          Math.abs(comet.z - PLAYER_Z) < COMET_COLLIDE_Z &&
          Math.abs(runtime.playerX - comet.x) < PLAYER_R + comet.radius
        ) {
          runtime.failMessage = 'You slammed into a rock.';
          useSlipStreamStore.getState().endRun(runtime.score, runtime.failMessage);
          failed = true;
          break;
        }

        if (!comet.nearAwarded && prevZ < 0 && comet.z >= 0) {
          const xDist = Math.abs(runtime.playerX - comet.x);
          const hitRange = PLAYER_R + comet.radius;
          if (xDist > hitRange && xDist < hitRange + 0.42) {
            runtime.nearMisses += 1;
            runtime.score += 1.4 + runtime.multiplier;
            runtime.shake = Math.min(1.2, runtime.shake + 0.14);
          }
          comet.nearAwarded = true;
        }
      }

      if (!failed) {
        for (const gust of runtime.gusts) {
          if (!gust.active) continue;

          gust.z += runtime.speedNow * gust.speedFactor * dt;
          gust.x =
            LANE_X[gust.lane] +
            Math.sin(runtime.elapsed * gust.swayFreq + gust.phase) * gust.swayAmp;

          if (gust.z > FRONT_Z + 1.2) {
            gust.active = false;
            continue;
          }

          if (
            circleVsAabb(
              runtime.playerX,
              PLAYER_Z,
              PLAYER_R,
              gust.x,
              gust.z,
              gust.width * 0.5,
              gust.depth * 0.5
            ) &&
            Math.abs(gust.z - PLAYER_Z) < GUST_COLLIDE_Z
          ) {
            runtime.failMessage = 'A crate blocked your lane.';
            useSlipStreamStore.getState().endRun(runtime.score, runtime.failMessage);
            failed = true;
            break;
          }
        }
      }

      if (!failed && Math.abs(runtime.playerX) > TUNNEL_HALF_W - PLAYER_R * 0.8) {
        runtime.failMessage = 'You slipped off the log.';
        useSlipStreamStore.getState().endRun(runtime.score, runtime.failMessage);
        failed = true;
      }

      if (!failed) {
        if (runtime.inSlipstream) {
          runtime.slipTime += dt;
          runtime.slipStreak = Math.min(18, runtime.slipStreak + dt * 1.25);
          runtime.outOfDraftTimer = Math.max(0, runtime.outOfDraftTimer - dt * 3.2);
        } else {
          runtime.slipStreak = Math.max(0, runtime.slipStreak - dt * 2.2);
          runtime.outOfDraftTimer += dt;
        }

        runtime.multiplier = 1 + clamp(runtime.slipStreak / 3.5, 0, 2.4);
        const targetSlipBlend = runtime.inSlipstream
          ? 0.95
          : 0;
        runtime.slipBlend = lerp(runtime.slipBlend, targetSlipBlend, 1 - Math.exp(-7 * dt));

        runtime.distance += runtime.speedNow * dt;
        runtime.score += runtime.speedNow * dt * (0.54 + runtime.multiplier * 0.16);
        runtime.score += runtime.inSlipstream ? dt * (1 + runtime.multiplier * 0.75) : 0;
      }

      if (!failed && runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        useSlipStreamStore
          .getState()
          .updateHud(runtime.score, runtime.multiplier, runtime.nearMisses, clamp(runtime.slipBlend, 0, 1));
      }
    } else {
      runtime.slipBlend = Math.max(0, runtime.slipBlend - dt * 1.8);
      runtime.shake = Math.max(0, runtime.shake - dt * 3.2);
      runtime.speedNow = 5.4;
    }

    let minSegmentZ = Infinity;
    for (const segment of runtime.segments) {
      if (segment.z < minSegmentZ) minSegmentZ = segment.z;
    }
    for (const segment of runtime.segments) {
      segment.z += runtime.speedNow * dt;
      if (segment.z > FRONT_Z) {
        segment.z = minSegmentZ - SEGMENT_SPACING;
        minSegmentZ = segment.z;
      }
    }

    for (const streak of runtime.streaks) {
      streak.z += runtime.speedNow * dt * (1.06 + streak.speedFactor + runtime.slipBlend * 1.45);
      if (streak.z > FRONT_Z + 1) {
        reseedStreak(streak, false);
      }
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.8);
    const shakeAmp = runtime.shake * 0.09;
    const shakeTime = runtime.elapsed * 23;
    camTarget.set(
      shakeNoiseSigned(shakeTime, 1.9) * shakeAmp,
      2.35 + runtime.slipBlend * 0.12 + shakeNoiseSigned(shakeTime, 7.2) * shakeAmp * 0.24,
      5.7 - runtime.slipBlend * 0.28 + shakeNoiseSigned(shakeTime, 13.7) * shakeAmp * 0.28
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-7.5 * step.renderDt));
    camera.lookAt(0, -0.12, -10);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = lerp(camera.fov, 38 - runtime.slipBlend * 2.4, 1 - Math.exp(-6 * dt));
      camera.updateProjectionMatrix();
    }

    if (playerRef.current) {
      playerRef.current.position.set(runtime.playerX, -0.02, 0.28);
      const targetRoll = clamp((runtime.targetX - runtime.playerX) * 0.22, -0.42, 0.42);
      playerRef.current.rotation.set(Math.PI * 0.5, 0, targetRoll * 0.8);
      const scale = 1 + runtime.slipBlend * 0.06 + runtime.shake * 0.03;
      playerRef.current.scale.set(scale, scale, scale * 1.06);
    }

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
      bgMatRef.current.uniforms.uSlip.value = runtime.slipBlend;
    }

    if (bloomRef.current) {
      bloomRef.current.intensity = lerp(0.4, 1.05, clamp(runtime.slipBlend, 0, 1));
    }
    chromaOffset.set(0.00032 + runtime.slipBlend * 0.0013, 0);

    if (tunnelRef.current) {
      let instance = 0;
      for (const segment of runtime.segments) {
        const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 2 + segment.pulse);
        const woodMix = clamp(0.58 + runtime.slipBlend * 0.28 + pulse * 0.16, 0, 1);
        const railMix = clamp(0.5 + runtime.slipBlend * 0.3, 0, 1);
        const laneMix = clamp(0.56 + runtime.slipBlend * 0.42 + pulse * 0.2, 0, 1);

        dummy.rotation.set(0, 0, 0);

        dummy.position.set(0, -0.14, segment.z);
        dummy.scale.set(TUNNEL_HALF_W * 2, 0.24, SEGMENT_SPACING * 1.02);
        dummy.updateMatrix();
        tunnelRef.current.setMatrixAt(instance, dummy.matrix);
        colorScratch.copy(LOG_BROWN).lerp(TRACK_GLOW, woodMix * 0.28).lerp(WHITE, woodMix * 0.1);
        tunnelRef.current.setColorAt(instance, colorScratch);
        instance += 1;

        dummy.position.set(-TUNNEL_HALF_W - 0.12, -0.03, segment.z);
        dummy.scale.set(0.15, 0.34, SEGMENT_SPACING * 0.98);
        dummy.updateMatrix();
        tunnelRef.current.setMatrixAt(instance, dummy.matrix);
        colorScratch.copy(LOG_DARK).lerp(TRACK_GLOW, railMix * 0.24).lerp(WHITE, railMix * 0.08);
        tunnelRef.current.setColorAt(instance, colorScratch);
        instance += 1;

        dummy.position.set(TUNNEL_HALF_W + 0.12, -0.03, segment.z);
        dummy.scale.set(0.15, 0.34, SEGMENT_SPACING * 0.98);
        dummy.updateMatrix();
        tunnelRef.current.setMatrixAt(instance, dummy.matrix);
        colorScratch.copy(LOG_DARK).lerp(TRACK_GLOW, railMix * 0.24).lerp(WHITE, railMix * 0.08);
        tunnelRef.current.setColorAt(instance, colorScratch);
        instance += 1;

        dummy.position.set((LANE_X[0] + LANE_X[1]) * 0.5, -0.02, segment.z);
        dummy.scale.set(0.05, 0.08, SEGMENT_SPACING * 0.94);
        dummy.updateMatrix();
        tunnelRef.current.setMatrixAt(instance, dummy.matrix);
        colorScratch.copy(LANE_DIVIDER).lerp(TRACK_GLOW, laneMix * 0.2).lerp(WHITE, laneMix * 0.16);
        tunnelRef.current.setColorAt(instance, colorScratch);
        instance += 1;

        dummy.position.set((LANE_X[1] + LANE_X[2]) * 0.5, -0.02, segment.z);
        dummy.scale.set(0.05, 0.08, SEGMENT_SPACING * 0.94);
        dummy.updateMatrix();
        tunnelRef.current.setMatrixAt(instance, dummy.matrix);
        colorScratch.copy(LANE_DIVIDER).lerp(TRACK_GLOW, laneMix * 0.2).lerp(WHITE, laneMix * 0.16);
        tunnelRef.current.setColorAt(instance, colorScratch);
        instance += 1;
      }

      tunnelRef.current.instanceMatrix.needsUpdate = true;
      if (tunnelRef.current.instanceColor) tunnelRef.current.instanceColor.needsUpdate = true;
    }

    if (cometRef.current && coneRef.current) {
      for (let i = 0; i < runtime.comets.length; i += 1) {
        const comet = runtime.comets[i];
        if (!comet.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          cometRef.current.setMatrixAt(i, dummy.matrix);
          cometRef.current.setColorAt(i, WHITE);
          coneRef.current.setMatrixAt(i, dummy.matrix);
          coneRef.current.setColorAt(i, WHITE);
          continue;
        }

        dummy.position.set(comet.x, 0.32, comet.z);
        dummy.scale.setScalar(comet.radius);
        dummy.rotation.set(runtime.elapsed * 0.6, runtime.elapsed * 0.9, runtime.elapsed * 0.4);
        dummy.updateMatrix();
        cometRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(COMET_COLOR)
          .lerp(DANGER, 0.26 + comet.tint * 0.18)
          .lerp(WHITE, clamp(0.44 + comet.tint * 0.3, 0, 0.92));
        cometRef.current.setColorAt(i, colorScratch);

        const trailLen = 1.38 + runtime.slipBlend * 0.82;
        const trailRad = 0.34 + runtime.slipBlend * 0.14;
        dummy.position.set(comet.x, 0.12, comet.z - 0.72);
        dummy.scale.set(trailRad, trailLen, trailRad);
        dummy.rotation.set(Math.PI * 0.5, 0, 0);
        dummy.updateMatrix();
        coneRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(STREAM)
          .lerp(DANGER, 0.3)
          .lerp(WHITE, clamp(0.42 + runtime.slipBlend * 0.24, 0, 0.8));
        coneRef.current.setColorAt(i, colorScratch);
      }

      cometRef.current.instanceMatrix.needsUpdate = true;
      if (cometRef.current.instanceColor) cometRef.current.instanceColor.needsUpdate = true;
      coneRef.current.instanceMatrix.needsUpdate = true;
      if (coneRef.current.instanceColor) coneRef.current.instanceColor.needsUpdate = true;
    }

    if (gustRef.current) {
      for (let i = 0; i < runtime.gusts.length; i += 1) {
        const gust = runtime.gusts[i];
        if (!gust.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          gustRef.current.setMatrixAt(i, dummy.matrix);
          gustRef.current.setColorAt(i, WHITE);
          continue;
        }

        dummy.position.set(gust.x, 0.2, gust.z);
        dummy.scale.set(gust.width, gust.height, gust.depth);
        dummy.rotation.set(0, runtime.elapsed * 0.15, 0);
        dummy.updateMatrix();
        gustRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(GUST_COLOR)
          .lerp(STREAM, 0.28)
          .lerp(WHITE, clamp(0.42 + gust.tint * 0.32 + runtime.slipBlend * 0.24, 0, 0.92));
        gustRef.current.setColorAt(i, colorScratch);
      }

      gustRef.current.instanceMatrix.needsUpdate = true;
      if (gustRef.current.instanceColor) gustRef.current.instanceColor.needsUpdate = true;
    }

    if (streakRef.current) {
      for (let i = 0; i < runtime.streaks.length; i += 1) {
        const streak = runtime.streaks[i];
        dummy.position.set(streak.x, streak.y, streak.z);
        dummy.scale.set(0.03, 0.03, streak.len * (1 + runtime.slipBlend * 1.7));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        streakRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(STREAM)
          .lerp(WHITE, clamp(0.2 + runtime.slipBlend * 0.7, 0, 0.95));
        streakRef.current.setColorAt(i, colorScratch);
      }
      streakRef.current.instanceMatrix.needsUpdate = true;
      if (streakRef.current.instanceColor) streakRef.current.instanceColor.needsUpdate = true;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2.5, 6.35]} fov={38} near={0.1} far={120} />
      <color attach="background" args={['#1d8fb4']} />
      <fog attach="fog" args={['#1d8fb4', 14, 70]} />

      <ambientLight intensity={0.78} />
      <hemisphereLight args={['#c4fbff', '#2a6c85', 0.52]} />
      <pointLight position={[0, 3.6, 4]} intensity={0.84} color="#c8faff" />
      <pointLight position={[0, -1.3, 4]} intensity={0.5} color="#ffd7a8" />

      <mesh position={[0, -0.9, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[36, 132]} />
        <shaderMaterial
          ref={bgMatRef}
          uniforms={{ uTime: { value: 0 }, uSlip: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uSlip;
            varying vec2 vUv;
            void main() {
              vec3 deep = vec3(0.10, 0.46, 0.58);
              vec3 foam = vec3(0.36, 0.82, 0.90);
              vec3 cool = vec3(0.26, 0.64, 0.74);
              float grad = smoothstep(0.0, 1.0, vUv.y);
              float pulse = 0.5 + 0.5 * sin((vUv.y * 4.6 + uTime * 0.35) * 6.2831853);
              float grain = fract(sin(dot(vUv * (uTime + 1.37), vec2(12.9898, 78.233))) * 43758.5453);
              vec3 col = mix(deep, foam, grad * 0.55);
              col = mix(col, cool, uSlip * (0.3 + pulse * 0.26));
              col += (grain - 0.5) * 0.03;
              col += vec3(0.02, 0.06, 0.08) * pulse;
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, -0.1, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[4.45, 126]} />
        <meshBasicMaterial color={TRACK_MAIN} transparent opacity={0.9} toneMapped={false} />
      </mesh>

      <mesh position={[0, -0.07, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[3.1, 126]} />
        <meshBasicMaterial
          color={TRACK_GLOW}
          transparent
          opacity={0.26}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[-(TUNNEL_HALF_W + 1.65), -0.34, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[4.2, 124]} />
        <meshBasicMaterial
          color="#4fcfe2"
          transparent
          opacity={0.72}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[TUNNEL_HALF_W + 1.65, -0.34, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[4.2, 124]} />
        <meshBasicMaterial
          color="#4fcfe2"
          transparent
          opacity={0.72}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={tunnelRef} args={[undefined, undefined, TUNNEL_INSTANCE_COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={TRACK_MAIN} vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={streakRef} args={[undefined, undefined, STREAK_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.72}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={coneRef} args={[undefined, undefined, COMET_POOL]}>
        <coneGeometry args={[1, 1, 12, 1, true]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={cometRef} args={[undefined, undefined, COMET_POOL]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={COMET_COLOR} vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={gustRef} args={[undefined, undefined, GUST_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={GUST_COLOR}
          vertexColors
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <mesh ref={playerRef} position={[0, 0.08, 0.28]} rotation={[Math.PI * 0.5, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.54, 16]} />
        <meshBasicMaterial
          color="#ffe39b"
          toneMapped={false}
        />
      </mesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom ref={bloomRef} intensity={0.42} luminanceThreshold={0.5} luminanceSmoothing={0.2} mipmapBlur />
        <ChromaticAberration offset={chromaOffset} radialModulation modulationOffset={0.44} />
        <Vignette eskil={false} offset={0.12} darkness={0.62} />
        <Noise premultiply opacity={0.028} />
      </EffectComposer>

      <Html fullscreen>
        <SlipStreamOverlay />
      </Html>
    </>
  );
}

const Slipstream: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(event) => event.preventDefault()}
    >
      <SlipStreamScene />
    </Canvas>
  );
};

export default Slipstream;
export * from './state';
