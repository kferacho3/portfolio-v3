'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrthographicCamera } from '@react-three/drei';
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
  circleVsAabbForgiving,
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
} from '../_shared/hyperUpgradeKit';
import { waveFlipState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type WaveSign = 1 | -1;

type Obstacle = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 0 | 1 | 2;
  rot: number;
  spin: number;
  requiredSign: WaveSign;
  setId: number;
  resolved: boolean;
  nearBonusGiven: boolean;
  glow: number;
  speedFactor: number;
  trackAmount: number;
  phase: number;
  yOffset: number;
};

type Collectible = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  r: number;
  sign: WaveSign;
  spin: number;
  value: number;
};

type Runtime = {
  elapsed: number;
  score: number;
  streak: number;
  multiplier: number;
  nearMisses: number;
  shake: number;
  impactFlash: number;
  waveSign: WaveSign;
  playerTargetSign: WaveSign;
  displaySign: number;
  flipGrace: number;
  phaseScroll: number;
  waveFreq: number;
  waveAmp: number;
  waveBase: number;
  playerY: number;
  playerNormalY: number;
  lastFlipAt: number;
  hudCommit: number;
  failMessage: string;

  spawnTimer: number;
  nextSpawnSlot: number;
  nextCollectibleSlot: number;
  nextSetId: number;
  setRemaining: Map<number, number>;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkSetsLeft: number;

  obstacles: Obstacle[];
  collectibles: Collectible[];
};

type WaveFlipStore = {
  status: GameStatus;
  score: number;
  best: number;
  streak: number;
  multiplier: number;
  nearMisses: number;
  failMessage: string;
  flipFxNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  onFlipFx: () => void;
  updateHud: (
    score: number,
    streak: number,
    multiplier: number,
    nearMisses: number
  ) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'waveflip_hyper_best_v3';

const VIEW_MIN_X = -7.2;
const VIEW_MAX_X = 7.2;
const PLAYER_X = -2.7;
const PLAYER_R = 0.22;

const WAVE_POINTS = 200;
const WAVE_HALF_THICKNESS = 0.16;
const WAVE_NORMAL_OFFSET = 0.12;

const OBSTACLE_POOL = 72;
const COLLECTIBLE_POOL = 40;
const NEAR_FLIP_WINDOW = 0.22;
const SWIPE_THRESHOLD_Y = 0.16;
const SWIPE_AXIS_RATIO = 1.12;
const TAP_DRIFT_MAX = 0.12;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);
const WAVE_NEON = new THREE.Color('#7ce9ff');
const WAVE_EDGE = new THREE.Color('#ff89cf');
const SPIKE_TOP = new THREE.Color('#ff5d8b');
const SPIKE_BOTTOM = new THREE.Color('#6f8eff');
const OBSTACLE_ORANGE = new THREE.Color('#ffb05a');
const OBSTACLE_GREEN = new THREE.Color('#58ffd8');
const SAFE_MARKER = new THREE.Color('#8ffff2');
const COLLECTIBLE_A = new THREE.Color('#ffe66f');
const COLLECTIBLE_B = new THREE.Color('#ff8df5');
const WHITE = new THREE.Color('#f8fbff');
const BG_BOTTOM = new THREE.Color('#42a7f7');

let audioContextRef: AudioContext | null = null;

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

const playWhoop = () => {
  if (typeof window === 'undefined') return;
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;

  if (!audioContextRef) audioContextRef = new Context();
  const ctx = audioContextRef;
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.085);
  gain.gain.setValueAtTime(0.035, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.11);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.11);
};

const circleVsAabb = (
  px: number,
  py: number,
  r: number,
  bx: number,
  by: number,
  hw: number,
  hh: number
) => circleVsAabbForgiving(px, py, r, bx, by, hw, hh, 0.84);

const waveSampleForSign = (x: number, sign: number, runtime: Runtime) => {
  const arg = runtime.waveFreq * (x + runtime.phaseScroll);
  const yCenter =
    sign *
    (runtime.waveBase + runtime.waveAmp * Math.sin(arg));
  const dyDx =
    sign * runtime.waveAmp * runtime.waveFreq * Math.cos(arg);
  const normalY = 1 / Math.sqrt(1 + dyDx * dyDx);
  return {
    yCenter,
    dyDx,
    normalY,
    yRider: yCenter + normalY * WAVE_NORMAL_OFFSET,
  };
};

const waveSample = (x: number, runtime: Runtime) =>
  waveSampleForSign(x, runtime.displaySign, runtime);

const chooseChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 95, 0, 1);
  runtime.currentChunk = pickPatternChunkForSurvivability(
    'waveflip',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  runtime.chunkSetsLeft = Math.max(
    2,
    Math.round(runtime.currentChunk.durationSeconds * (1.7 + runtime.difficulty.eventRate * 1.4))
  );
};

const spawnInterval = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 4) / 3, 0, 1);
  const tutorialSlow = runtime.elapsed < 16 ? 0.32 : runtime.elapsed < 28 ? 0.14 : 0;
  return clamp(
    lerp(0.86, 0.44, d) + (3 - tier) * 0.04 + tutorialSlow + Math.random() * 0.1,
    0.22,
    1.1
  );
};

const acquireObstacle = (runtime: Runtime) => {
  for (let i = 0; i < runtime.obstacles.length; i += 1) {
    const idx = (runtime.nextSpawnSlot + i) % runtime.obstacles.length;
    const obstacle = runtime.obstacles[idx];
    if (!obstacle.active) {
      runtime.nextSpawnSlot = (idx + 1) % runtime.obstacles.length;
      return obstacle;
    }
  }
  const fallback = runtime.obstacles[runtime.nextSpawnSlot];
  runtime.nextSpawnSlot = (runtime.nextSpawnSlot + 1) % runtime.obstacles.length;
  return fallback;
};

const acquireCollectible = (runtime: Runtime) => {
  for (let i = 0; i < runtime.collectibles.length; i += 1) {
    const idx = (runtime.nextCollectibleSlot + i) % runtime.collectibles.length;
    const collectible = runtime.collectibles[idx];
    if (!collectible.active) {
      runtime.nextCollectibleSlot = (idx + 1) % runtime.collectibles.length;
      return collectible;
    }
  }
  const fallback = runtime.collectibles[runtime.nextCollectibleSlot];
  runtime.nextCollectibleSlot = (runtime.nextCollectibleSlot + 1) % runtime.collectibles.length;
  return fallback;
};

const spawnObstacleSet = (runtime: Runtime) => {
  if (!runtime.currentChunk || runtime.chunkSetsLeft <= 0) chooseChunk(runtime);
  runtime.chunkSetsLeft -= 1;
  const tier = runtime.currentChunk?.tier ?? 0;

  const d = clamp((runtime.difficulty.speed - 4) / 3, 0, 1);
  const intensity = clamp(runtime.elapsed / 90, 0, 1);
  const doubleChance =
    runtime.elapsed < 9
      ? 0
      : clamp(0.16 + Math.max(0, tier - 1) * 0.11 + d * 0.24, 0, 0.76);
  const tripleChance =
    runtime.elapsed < 18 ? 0 : clamp(0.07 + d * 0.12 + Math.max(0, tier - 2) * 0.06, 0, 0.34);
  const count = Math.random() < tripleChance ? 3 : Math.random() < doubleChance ? 2 : 1;

  const oppositeSign = runtime.playerTargetSign === 1 ? -1 : 1;
  const baseRequired =
    Math.random() < 0.58 + intensity * 0.2 ? runtime.playerTargetSign : (oppositeSign as WaveSign);
  const setId = runtime.nextSetId++;
  runtime.setRemaining.set(setId, count);

  const baseX = VIEW_MAX_X + 1.2;
  const spacing = 0.94 + Math.random() * 0.24;

  for (let i = 0; i < count; i += 1) {
    const obstacle = acquireObstacle(runtime);
    const requiredSign = (
      count >= 2 && i % 2 === 1
        ? (baseRequired === 1 ? -1 : 1)
        : baseRequired
    ) as WaveSign;

    const sample = waveSampleForSign(baseX + i * spacing, requiredSign, runtime);
    obstacle.active = true;
    obstacle.x = baseX + i * spacing;
    obstacle.kind =
      runtime.elapsed > 20 && Math.random() < 0.22
        ? 2
        : runtime.elapsed > 10 && Math.random() < 0.42
          ? 1
          : 0;
    obstacle.w =
      obstacle.kind === 2
        ? clamp(lerp(0.42, 0.68, d) + tier * 0.02, 0.4, 0.76)
        : clamp(lerp(0.56, 0.86, d) + tier * 0.02, 0.5, 0.94);
    obstacle.h =
      obstacle.kind === 0
        ? clamp(lerp(0.86, 1.3, d) + tier * 0.04, 0.8, 1.42)
        : clamp(lerp(0.64, 1.12, d) + tier * 0.04, 0.62, 1.24);
    obstacle.yOffset =
      (requiredSign === 1 ? 1 : -1) *
      (obstacle.kind === 0 ? 0.13 : obstacle.kind === 1 ? 0.08 : 0.04);
    obstacle.y = sample.yCenter + obstacle.yOffset;
    obstacle.requiredSign = requiredSign;
    obstacle.speedFactor = clamp(0.98 + d * 0.18 + tier * 0.04 + (Math.random() * 2 - 1) * 0.05, 0.9, 1.32);
    obstacle.trackAmount = obstacle.kind === 2 ? 0.95 : obstacle.kind === 1 ? 0.42 : 0.18;
    obstacle.spin = (Math.random() * 2 - 1) * (obstacle.kind === 2 ? 3.4 : obstacle.kind === 1 ? 1.9 : 1.2);
    obstacle.rot = 0;
    obstacle.phase = Math.random() * Math.PI * 2;
    obstacle.setId = setId;
    obstacle.resolved = false;
    obstacle.nearBonusGiven = false;
    obstacle.glow = 0;
  }

  const collectibleChance =
    runtime.elapsed < 8 ? 0.24 : runtime.elapsed < 24 ? 0.46 : 0.62;
  if (Math.random() < collectibleChance) {
    const collectible = acquireCollectible(runtime);
    collectible.active = true;
    collectible.sign = (baseRequired === 1 ? -1 : 1) as WaveSign;
    collectible.x = baseX + (count - 1) * spacing * 0.45 + 0.15 + Math.random() * 0.32;
    collectible.r = 0.13 + Math.random() * 0.04;
    collectible.spin = Math.random() * Math.PI * 2;
    collectible.value = count >= 3 ? 4 : count === 2 ? 3 : 2;
    const ySample = waveSampleForSign(collectible.x, collectible.sign, runtime);
    collectible.y = ySample.yRider;
  }
};

const createObstacle = (slot: number): Obstacle => ({
  slot,
  active: false,
  x: OFFSCREEN_POS.x,
  y: OFFSCREEN_POS.y,
  w: 0.6,
  h: 1.2,
  kind: 0,
  rot: 0,
  spin: 0,
  requiredSign: 1,
  setId: 0,
  resolved: false,
  nearBonusGiven: false,
  glow: 0,
  speedFactor: 1,
  trackAmount: 0,
  phase: 0,
  yOffset: 0,
});

const createCollectible = (slot: number): Collectible => ({
  slot,
  active: false,
  x: OFFSCREEN_POS.x,
  y: OFFSCREEN_POS.y,
  r: 0.14,
  sign: 1,
  spin: 0,
  value: 2,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  streak: 0,
  multiplier: 1,
  nearMisses: 0,
  shake: 0,
  impactFlash: 0,
  waveSign: 1,
  playerTargetSign: 1,
  displaySign: 1,
  flipGrace: 0,
  phaseScroll: 0,
  waveFreq: 1.52,
  waveAmp: 0.34,
  waveBase: 0.92,
  playerY: 0.96,
  playerNormalY: 1,
  lastFlipAt: -99,
  hudCommit: 0,
  failMessage: '',

  spawnTimer: 0.8,
  nextSpawnSlot: 0,
  nextCollectibleSlot: 0,
  nextSetId: 1,
  setRemaining: new Map(),

  difficulty: sampleDifficulty('wave-timing', 0),
  chunkLibrary: buildPatternLibraryTemplate('waveflip'),
  currentChunk: null,
  chunkSetsLeft: 0,

  obstacles: Array.from({ length: OBSTACLE_POOL }, (_, idx) => createObstacle(idx)),
  collectibles: Array.from({ length: COLLECTIBLE_POOL }, (_, idx) => createCollectible(idx)),
});

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.streak = 0;
  runtime.multiplier = 1;
  runtime.nearMisses = 0;
  runtime.shake = 0;
  runtime.impactFlash = 0;
  runtime.waveSign = 1;
  runtime.playerTargetSign = 1;
  runtime.displaySign = 1;
  runtime.flipGrace = 0;
  runtime.phaseScroll = 0;
  runtime.waveFreq = 1.52;
  runtime.waveAmp = 0.34;
  runtime.waveBase = 0.92;
  runtime.playerY = 0.96;
  runtime.playerNormalY = 1;
  runtime.lastFlipAt = -99;
  runtime.hudCommit = 0;
  runtime.failMessage = '';

  runtime.spawnTimer = 0.8;
  runtime.nextSpawnSlot = 0;
  runtime.nextCollectibleSlot = 0;
  runtime.nextSetId = 1;
  runtime.setRemaining.clear();

  runtime.difficulty = sampleDifficulty('wave-timing', 0);
  runtime.currentChunk = null;
  runtime.chunkSetsLeft = 0;

  for (const obstacle of runtime.obstacles) {
    obstacle.active = false;
    obstacle.x = OFFSCREEN_POS.x;
    obstacle.y = OFFSCREEN_POS.y;
    obstacle.w = 0.6;
    obstacle.h = 1.2;
    obstacle.requiredSign = 1;
    obstacle.setId = 0;
    obstacle.resolved = false;
    obstacle.nearBonusGiven = false;
    obstacle.glow = 0;
    obstacle.kind = 0;
    obstacle.rot = 0;
    obstacle.spin = 0;
    obstacle.speedFactor = 1;
    obstacle.trackAmount = 0;
    obstacle.phase = 0;
    obstacle.yOffset = 0;
  }

  for (const collectible of runtime.collectibles) {
    collectible.active = false;
    collectible.x = OFFSCREEN_POS.x;
    collectible.y = OFFSCREEN_POS.y;
    collectible.r = 0.14;
    collectible.sign = 1;
    collectible.spin = 0;
    collectible.value = 2;
  }
};

const useWaveFlipStore = create<WaveFlipStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  streak: 0,
  multiplier: 1,
  nearMisses: 0,
  failMessage: '',
  flipFxNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      streak: 0,
      multiplier: 1,
      nearMisses: 0,
      failMessage: '',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      streak: 0,
      multiplier: 1,
      nearMisses: 0,
      failMessage: '',
    }),
  onFlipFx: () => set((state) => ({ flipFxNonce: state.flipFxNonce + 1 })),
  updateHud: (score, streak, multiplier, nearMisses) =>
    set({
      score: Math.floor(score),
      streak,
      multiplier,
      nearMisses,
    }),
  endRun: (score, reason) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        best: nextBest,
        streak: 0,
        multiplier: 1,
        nearMisses: 0,
        failMessage: reason,
      };
    }),
}));

function WaveFlipOverlay() {
  const status = useWaveFlipStore((state) => state.status);
  const score = useWaveFlipStore((state) => state.score);
  const best = useWaveFlipStore((state) => state.best);
  const streak = useWaveFlipStore((state) => state.streak);
  const multiplier = useWaveFlipStore((state) => state.multiplier);
  const nearMisses = useWaveFlipStore((state) => state.nearMisses);
  const failMessage = useWaveFlipStore((state) => state.failMessage);
  const flipFxNonce = useWaveFlipStore((state) => state.flipFxNonce);

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/55 bg-gradient-to-br from-cyan-500/25 via-blue-500/15 to-indigo-500/25 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">WaveFlip</div>
        <div className="text-[11px] text-cyan-50/85">
          Swipe up/down to phase the wave. Spikes punish the wrong side.
        </div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-fuchsia-100/55 bg-gradient-to-br from-fuchsia-500/25 via-violet-500/18 to-cyan-500/16 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-sky-100/35 bg-gradient-to-br from-slate-950/72 via-cyan-900/35 to-indigo-900/35 px-3 py-2 text-xs">
          <div>
            Streak <span className="font-semibold text-cyan-200">{streak}</span>
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
          <div className="rounded-xl border border-cyan-100/40 bg-gradient-to-br from-slate-950/78 via-blue-950/55 to-fuchsia-950/40 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">WAVEFLIP</div>
            <div className="mt-2 text-sm text-white/85">Mobile: swipe up for top rail, swipe down for bottom rail.</div>
            <div className="mt-1 text-sm text-white/80">
              Desktop: ArrowUp/W for top, ArrowDown/S for bottom, Space/click toggles.
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/82 via-rose-950/45 to-indigo-950/52 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Phase Crash</div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={flipFxNonce}>
          <div
            className="absolute top-0 h-full w-[2px]"
            style={{
              left: '-4px',
              background:
                'linear-gradient(180deg, rgba(88,217,255,0) 0%, rgba(88,217,255,0.9) 50%, rgba(88,217,255,0) 100%)',
              boxShadow: '0 0 20px rgba(88,217,255,0.45)',
              animation: 'waveflip-scan 220ms linear forwards',
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-100/70"
            style={{
              animation: 'waveflip-ring 220ms ease-out forwards',
              opacity: 0,
            }}
          />
        </div>
      )}

      <style jsx global>{`
        @keyframes waveflip-scan {
          from {
            transform: translateX(0);
            opacity: 0.85;
          }
          to {
            transform: translateX(calc(100vw + 8px));
            opacity: 0;
          }
        }
        @keyframes waveflip-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0.75;
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

function WaveFlipScene() {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter', 'ArrowUp', 'ArrowDown', 'arrowup', 'arrowdown', 'w', 's'],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const obstacleRef = useRef<THREE.InstancedMesh>(null);
  const bladeRef = useRef<THREE.InstancedMesh>(null);
  const markerRef = useRef<THREE.InstancedMesh>(null);
  const collectibleRef = useRef<THREE.InstancedMesh>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const fixedStepRef = useRef(createFixedStepState());
  const impactOverlayRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef({
    active: false,
    swiped: false,
    startX: 0,
    startY: 0,
  });

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);

  const ribbonPositions = useMemo(() => new Float32Array(WAVE_POINTS * 2 * 3), []);
  const centerPositions = useMemo(() => new Float32Array(WAVE_POINTS * 3), []);

  const ribbonGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const indices = new Uint16Array((WAVE_POINTS - 1) * 6);
    let cursor = 0;
    for (let i = 0; i < WAVE_POINTS - 1; i += 1) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices[cursor++] = a;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = c;
      indices[cursor++] = b;
      indices[cursor++] = d;
    }
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(ribbonPositions, 3));
    return geo;
  }, [ribbonPositions]);

  const centerGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(centerPositions, 3));
    return geo;
  }, [centerPositions]);
  const centerLineMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: WAVE_EDGE, transparent: true, opacity: 0.72, toneMapped: false }),
    []
  );
  const centerLineObject = useMemo(
    () => new THREE.Line(centerGeometry, centerLineMaterial),
    [centerGeometry, centerLineMaterial]
  );

  const { camera } = useThree();

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useWaveFlipStore.getState().resetToStart();
    waveFlipState.status = 'menu';
    waveFlipState.score = 0;
  }, []);

  useEffect(() => {
    const apply = (state: ReturnType<typeof useWaveFlipStore.getState>) => {
      waveFlipState.status =
        state.status === 'START'
          ? 'menu'
          : state.status === 'PLAYING'
            ? 'playing'
            : 'gameover';
      waveFlipState.score = state.score;
      waveFlipState.best = state.best;
    };

    apply(useWaveFlipStore.getState());
    const unsub = useWaveFlipStore.subscribe(apply);
    return () => unsub();
  }, []);

  useEffect(
    () => () => {
      ribbonGeometry.dispose();
      centerGeometry.dispose();
      centerLineMaterial.dispose();
    },
    [ribbonGeometry, centerGeometry, centerLineMaterial]
  );

  useFrame((_, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = useWaveFlipStore.getState();

    const gesture = gestureRef.current;
    const upPressed = input.justPressed.has('arrowup') || input.justPressed.has('w');
    const downPressed = input.justPressed.has('arrowdown') || input.justPressed.has('s');
    const togglePressed =
      input.justPressed.has(' ') || input.justPressed.has('space') || input.justPressed.has('enter');

    let desiredSign: WaveSign | null = null;
    let toggleSign = togglePressed;
    let hasPointerAction = false;

    if (upPressed) desiredSign = 1;
    if (downPressed) desiredSign = -1;

    if (input.pointerJustDown) {
      gesture.active = true;
      gesture.swiped = false;
      gesture.startX = input.pointerX;
      gesture.startY = input.pointerY;
    }

    if (gesture.active && input.pointerDown) {
      const dx = input.pointerX - gesture.startX;
      const dy = input.pointerY - gesture.startY;
      if (Math.abs(dy) >= SWIPE_THRESHOLD_Y && Math.abs(dy) > Math.abs(dx) * SWIPE_AXIS_RATIO) {
        desiredSign = dy > 0 ? 1 : -1;
        gesture.swiped = true;
        gesture.startX = input.pointerX;
        gesture.startY = input.pointerY;
        hasPointerAction = true;
      }
    }

    if (input.pointerJustUp) {
      hasPointerAction = true;
      if (gesture.active && !gesture.swiped) {
        const dx = input.pointerX - gesture.startX;
        const dy = input.pointerY - gesture.startY;
        if (Math.abs(dx) <= TAP_DRIFT_MAX && Math.abs(dy) <= TAP_DRIFT_MAX) {
          toggleSign = true;
        }
      }
      gesture.active = false;
      gesture.swiped = false;
    }

    const applyWaveSign = (nextSign: WaveSign) => {
      if (runtime.waveSign === nextSign) return;
      runtime.waveSign = nextSign;
      runtime.playerTargetSign = nextSign;
      runtime.lastFlipAt = runtime.elapsed;
      runtime.flipGrace = 0.2;
      runtime.shake = Math.min(1.25, runtime.shake + 0.34);
      useWaveFlipStore.getState().onFlipFx();
      playWhoop();
    };

    if (store.status !== 'PLAYING') {
      if (desiredSign !== null || toggleSign || hasPointerAction) {
        resetRuntime(runtime);
        if (desiredSign !== null) {
          runtime.waveSign = desiredSign;
          runtime.playerTargetSign = desiredSign;
          runtime.displaySign = desiredSign;
        } else if (toggleSign) {
          runtime.waveSign = runtime.waveSign === 1 ? -1 : 1;
          runtime.playerTargetSign = runtime.waveSign;
          runtime.displaySign = runtime.waveSign;
        }
        useWaveFlipStore.getState().startRun();
      }
    } else if (desiredSign !== null) {
      applyWaveSign(desiredSign);
    } else if (toggleSign) {
      applyWaveSign(runtime.waveSign === 1 ? -1 : 1);
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.difficulty = sampleDifficulty('wave-timing', runtime.elapsed);

      const pressure = clamp(runtime.elapsed / 110, 0, 1);
      const speed = runtime.difficulty.speed * (1.22 + pressure * 0.52);
      const d = clamp((runtime.difficulty.speed - 4) / 3, 0, 1);
      const intensity = clamp(d * 0.64 + pressure * 0.36, 0, 1);
      runtime.waveFreq = lerp(1.48, 2.95, intensity);
      runtime.waveAmp = lerp(0.34, 0.56, intensity);
      runtime.waveBase = lerp(0.92, 1.14, intensity);
      runtime.displaySign = lerp(runtime.displaySign, runtime.waveSign, 1 - Math.exp(-(runtime.flipGrace > 0 ? 22 : 13) * dt));
      runtime.flipGrace = Math.max(0, runtime.flipGrace - dt);

      runtime.phaseScroll += speed * dt * 0.9;
      runtime.hudCommit += dt;

      const playerSample = waveSampleForSign(PLAYER_X, runtime.playerTargetSign, runtime);
      const playerResponse = runtime.flipGrace > 0 ? 24 : 17;
      runtime.playerY = lerp(runtime.playerY, playerSample.yRider, 1 - Math.exp(-playerResponse * dt));
      runtime.playerNormalY = lerp(
        runtime.playerNormalY,
        playerSample.normalY,
        1 - Math.exp(-20 * dt)
      );

      runtime.spawnTimer -= dt;
      if (runtime.spawnTimer <= 0) {
        spawnObstacleSet(runtime);
        const tier = runtime.currentChunk?.tier ?? 0;
        runtime.spawnTimer += spawnInterval(runtime, tier);
      }

      let failed = false;
      for (const obstacle of runtime.obstacles) {
        if (!obstacle.active) continue;
        obstacle.glow = Math.max(0, obstacle.glow - dt * 3.8);
        obstacle.x -= speed * obstacle.speedFactor * dt;
        obstacle.rot += obstacle.spin * dt * (1 + obstacle.trackAmount * 0.22);

        const laneSample = waveSampleForSign(obstacle.x, obstacle.requiredSign, runtime);
        const playerInfluence = clamp((runtime.playerY - laneSample.yCenter) * 0.36, -0.3, 0.3);
        const wobble = Math.sin(runtime.elapsed * (2.3 + obstacle.trackAmount) + obstacle.phase) * 0.1;
        const targetY = laneSample.yCenter + obstacle.yOffset + wobble + playerInfluence * obstacle.trackAmount;
        obstacle.y = lerp(obstacle.y, targetY, 1 - Math.exp(-(8 + obstacle.trackAmount * 7) * dt));

        const laneBlocked = runtime.playerTargetSign === obstacle.requiredSign;
        if (
          laneBlocked &&
          circleVsAabb(
            PLAYER_X,
            runtime.playerY,
            PLAYER_R,
            obstacle.x,
            obstacle.y,
            obstacle.w * 0.46,
            obstacle.h * 0.44
          )
        ) {
          runtime.failMessage = obstacle.requiredSign === 1 ? 'Upper rail spike caught you.' : 'Lower rail spike caught you.';
          runtime.impactFlash = 1;
          runtime.shake = Math.min(1.5, runtime.shake + 0.6);
          useWaveFlipStore.getState().endRun(runtime.score, runtime.failMessage);
          failed = true;
          break;
        }

        if (
          !obstacle.resolved &&
          obstacle.x < PLAYER_X - obstacle.w * 0.5 - PLAYER_R - 0.02
        ) {
          obstacle.resolved = true;
          obstacle.glow = 1;

          const laneCleared = runtime.playerTargetSign !== obstacle.requiredSign;
          const sinceFlip = runtime.elapsed - runtime.lastFlipAt;
          if (laneCleared && sinceFlip >= 0 && sinceFlip <= NEAR_FLIP_WINDOW + 0.06 && !obstacle.nearBonusGiven) {
            obstacle.nearBonusGiven = true;
            runtime.nearMisses += 1;
            runtime.score += 1.2;
            runtime.multiplier = clamp(runtime.multiplier + 0.08, 1, 4.6);
          }

          const left = runtime.setRemaining.get(obstacle.setId);
          if (left !== undefined) {
            const remain = left - 1;
            if (remain <= 0) {
              runtime.setRemaining.delete(obstacle.setId);
              runtime.streak += 1;
              runtime.multiplier = clamp(1 + Math.min(runtime.streak, 24) * 0.07, 1, 4.4);
              runtime.score += Math.max(1, Math.floor(runtime.multiplier));
            } else {
              runtime.setRemaining.set(obstacle.setId, remain);
            }
          }
        }

        if (obstacle.x < VIEW_MIN_X - 2.5) {
          obstacle.active = false;
        }
      }

      for (const collectible of runtime.collectibles) {
        if (!collectible.active) continue;
        collectible.x -= speed * dt;
        collectible.spin += dt * 3.5;
        collectible.y = waveSampleForSign(collectible.x, collectible.sign, runtime).yRider;
        if (Math.hypot(collectible.x - PLAYER_X, collectible.y - runtime.playerY) < collectible.r + PLAYER_R) {
          collectible.active = false;
          runtime.score += collectible.value;
          runtime.multiplier = clamp(runtime.multiplier + 0.05, 1, 4.8);
          runtime.streak += 1;
        } else if (collectible.x < VIEW_MIN_X - 1.6) {
          collectible.active = false;
        }
      }

      if (!failed && runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        useWaveFlipStore
          .getState()
          .updateHud(runtime.score, runtime.streak, runtime.multiplier, runtime.nearMisses);
      }
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.5);
    runtime.impactFlash = Math.max(0, runtime.impactFlash - dt * 4.2);
    const shakeAmp = runtime.shake * 0.08;
    const shakeTime = runtime.elapsed * 24;
    camTarget.set(
      shakeNoiseSigned(shakeTime, 2.3) * shakeAmp,
      shakeNoiseSigned(shakeTime, 8.8) * shakeAmp * 0.5,
      9 + shakeNoiseSigned(shakeTime, 16.4) * shakeAmp * 0.35
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-8 * step.renderDt));
    camera.lookAt(0, 0, 0);

    if (orbRef.current) {
      orbRef.current.position.set(PLAYER_X, runtime.playerY, 0.15);
      const scale = 1 + runtime.shake * 0.04;
      orbRef.current.scale.setScalar(scale);
    }
    if (bgMaterialRef.current) {
      bgMaterialRef.current.uniforms.uTime.value += dt;
    }
    if (impactOverlayRef.current) {
      impactOverlayRef.current.style.opacity = String(clamp(runtime.impactFlash * 0.42, 0, 0.42));
    }

    for (let i = 0; i < WAVE_POINTS; i += 1) {
      const t = i / (WAVE_POINTS - 1);
      const x = lerp(VIEW_MIN_X, VIEW_MAX_X, t);
      const sample = waveSample(x, runtime);
      const dy = sample.dyDx;
      const invLen = 1 / Math.sqrt(1 + dy * dy);
      const nx = -dy * invLen;
      const ny = invLen;

      const topX = x + nx * WAVE_HALF_THICKNESS;
      const topY = sample.yCenter + ny * WAVE_HALF_THICKNESS;
      const botX = x - nx * WAVE_HALF_THICKNESS;
      const botY = sample.yCenter - ny * WAVE_HALF_THICKNESS;

      const ribbonPtr = i * 6;
      ribbonPositions[ribbonPtr] = topX;
      ribbonPositions[ribbonPtr + 1] = topY;
      ribbonPositions[ribbonPtr + 2] = 0;
      ribbonPositions[ribbonPtr + 3] = botX;
      ribbonPositions[ribbonPtr + 4] = botY;
      ribbonPositions[ribbonPtr + 5] = 0;

      const linePtr = i * 3;
      centerPositions[linePtr] = x;
      centerPositions[linePtr + 1] = sample.yCenter;
      centerPositions[linePtr + 2] = 0.01;
    }

    (
      ribbonGeometry.getAttribute('position') as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      centerGeometry.getAttribute('position') as THREE.BufferAttribute
    ).needsUpdate = true;
    ribbonGeometry.computeBoundingSphere();
    centerGeometry.computeBoundingSphere();

    if (obstacleRef.current && bladeRef.current) {
      for (let i = 0; i < runtime.obstacles.length; i += 1) {
        const obstacle = runtime.obstacles[i];
        if (!obstacle.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          obstacleRef.current.setMatrixAt(i, dummy.matrix);
          obstacleRef.current.setColorAt(i, WHITE);
          bladeRef.current.setMatrixAt(i, dummy.matrix);
          bladeRef.current.setColorAt(i, WHITE);
          continue;
        }

        const phaseColor = obstacle.requiredSign === 1 ? SPIKE_TOP : SPIKE_BOTTOM;
        const baseColor = obstacle.kind === 0 ? phaseColor : obstacle.kind === 1 ? OBSTACLE_ORANGE : OBSTACLE_GREEN;

        if (obstacle.kind === 2) {
          dummy.position.set(obstacle.x, obstacle.y, 0.08);
          dummy.scale.set(obstacle.w * 0.7, obstacle.h * 0.56, 0.28);
          dummy.rotation.set(0, 0, -obstacle.rot * 0.45);
          dummy.updateMatrix();
          obstacleRef.current.setMatrixAt(i, dummy.matrix);
          colorScratch.copy(baseColor).lerp(WHITE, clamp(0.24 + obstacle.glow * 0.56, 0, 0.9));
          obstacleRef.current.setColorAt(i, colorScratch);

          dummy.position.set(obstacle.x, obstacle.y, 0.2);
          dummy.scale.set(obstacle.w * 0.94, obstacle.h * 0.66, 0.38);
          dummy.rotation.set(0, 0, obstacle.rot);
          dummy.updateMatrix();
          bladeRef.current.setMatrixAt(i, dummy.matrix);
          colorScratch.copy(baseColor).lerp(WHITE, clamp(0.34 + obstacle.glow * 0.52, 0, 0.95));
          bladeRef.current.setColorAt(i, colorScratch);
        } else if (obstacle.kind === 1) {
          dummy.position.set(obstacle.x, obstacle.y, 0.08);
          dummy.scale.set(obstacle.w * 0.9, obstacle.h * 0.88, 0.26);
          dummy.rotation.set(0, 0, obstacle.rot * 0.65);
          dummy.updateMatrix();
          obstacleRef.current.setMatrixAt(i, dummy.matrix);
          colorScratch.copy(baseColor).lerp(phaseColor, 0.22).lerp(WHITE, clamp(0.22 + obstacle.glow * 0.52, 0, 0.84));
          obstacleRef.current.setColorAt(i, colorScratch);

          dummy.position.set(obstacle.x, obstacle.y, 0.18);
          dummy.scale.set(obstacle.w * 0.58, obstacle.h * 0.54, 0.24);
          dummy.rotation.set(0, 0, -obstacle.rot * 1.25);
          dummy.updateMatrix();
          bladeRef.current.setMatrixAt(i, dummy.matrix);
          colorScratch.copy(phaseColor).lerp(WHITE, clamp(0.28 + obstacle.glow * 0.45, 0, 0.86));
          bladeRef.current.setColorAt(i, colorScratch);
        } else {
          dummy.position.set(obstacle.x, obstacle.y, 0.08);
          dummy.scale.set(obstacle.w, obstacle.h, 0.26);
          dummy.rotation.set(0, 0, obstacle.rot * 0.42);
          dummy.updateMatrix();
          obstacleRef.current.setMatrixAt(i, dummy.matrix);
          colorScratch.copy(baseColor).lerp(WHITE, clamp(0.24 + obstacle.glow * 0.52, 0, 0.86));
          obstacleRef.current.setColorAt(i, colorScratch);

          dummy.position.set(obstacle.x, obstacle.y, 0.18);
          dummy.scale.set(obstacle.w * 0.58, obstacle.h * 0.42, 0.22);
          dummy.rotation.set(0, 0, obstacle.rot * 1.4 + obstacle.phase);
          dummy.updateMatrix();
          bladeRef.current.setMatrixAt(i, dummy.matrix);
          colorScratch.copy(phaseColor).lerp(WHITE, clamp(0.28 + obstacle.glow * 0.5, 0, 0.9));
          bladeRef.current.setColorAt(i, colorScratch);
        }
      }
      obstacleRef.current.instanceMatrix.needsUpdate = true;
      bladeRef.current.instanceMatrix.needsUpdate = true;
      if (obstacleRef.current.instanceColor) obstacleRef.current.instanceColor.needsUpdate = true;
      if (bladeRef.current.instanceColor) bladeRef.current.instanceColor.needsUpdate = true;
    }

    if (markerRef.current) {
      for (let i = 0; i < runtime.obstacles.length; i += 1) {
        const obstacle = runtime.obstacles[i];
        if (!obstacle.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          markerRef.current.setMatrixAt(i, dummy.matrix);
          markerRef.current.setColorAt(i, WHITE);
          continue;
        }

        const safeSign = (obstacle.requiredSign === 1 ? -1 : 1) as WaveSign;
        const safeSample = waveSampleForSign(obstacle.x, safeSign, runtime);
        const safeY = safeSample.yRider + safeSign * 0.2;
        dummy.position.set(obstacle.x - 0.06, safeY, 0.2);
        const pulseScale = 0.22 + Math.sin(runtime.elapsed * 8 + i * 0.37) * 0.03;
        dummy.scale.setScalar(pulseScale);
        dummy.rotation.set(0, 0, runtime.elapsed * 2 + i * 0.1);
        dummy.updateMatrix();
        markerRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch.copy(SAFE_MARKER).lerp(WHITE, clamp(obstacle.glow * 0.5, 0, 0.45));
        markerRef.current.setColorAt(i, colorScratch);
      }
      markerRef.current.instanceMatrix.needsUpdate = true;
      if (markerRef.current.instanceColor) markerRef.current.instanceColor.needsUpdate = true;
    }

    if (collectibleRef.current) {
      for (let i = 0; i < runtime.collectibles.length; i += 1) {
        const collectible = runtime.collectibles[i];
        if (!collectible.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          collectibleRef.current.setMatrixAt(i, dummy.matrix);
          collectibleRef.current.setColorAt(i, WHITE);
          continue;
        }

        dummy.position.set(collectible.x, collectible.y, 0.25);
        dummy.scale.setScalar(collectible.r);
        dummy.rotation.set(collectible.spin, collectible.spin * 0.7, 0);
        dummy.updateMatrix();
        collectibleRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(collectible.sign === 1 ? COLLECTIBLE_A : COLLECTIBLE_B)
          .lerp(WHITE, 0.36 + Math.sin(runtime.elapsed * 8 + i) * 0.12);
        collectibleRef.current.setColorAt(i, colorScratch);
      }
      collectibleRef.current.instanceMatrix.needsUpdate = true;
      if (collectibleRef.current.instanceColor) collectibleRef.current.instanceColor.needsUpdate = true;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 9]} zoom={58} near={0.1} far={40} />
      <color attach="background" args={[BG_BOTTOM]} />
      <fog attach="fog" args={[BG_BOTTOM, 9, 30]} />

      <ambientLight intensity={0.66} />
      <hemisphereLight args={['#b4f7ff', '#46308f', 0.54]} />
      <directionalLight position={[2.8, 2.6, 6]} intensity={0.6} color="#eef8ff" />
      <pointLight position={[0, 2.7, 4]} intensity={0.86} color="#9bf8ff" />
      <pointLight position={[0, -2.1, 4]} intensity={0.76} color="#ff9bd8" />

      <mesh position={[0, 0, -2.2]}>
        <planeGeometry args={[26, 14]} />
        <shaderMaterial
          ref={bgMaterialRef}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            varying vec2 vUv;
            float hash21(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
            float noise2(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              float a = hash21(i);
              float b = hash21(i + vec2(1.0, 0.0));
              float c = hash21(i + vec2(0.0, 1.0));
              float d = hash21(i + vec2(1.0, 1.0));
              return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
            float fbm2(vec2 p) {
              float a = 0.5;
              float v = 0.0;
              for (int i = 0; i < 4; i++) {
                v += a * noise2(p);
                p = p * 2.02 + vec2(8.3, 2.7);
                a *= 0.52;
              }
              return v;
            }
            void main() {
              vec3 deep = vec3(0.14, 0.38, 0.76);
              vec3 purple = vec3(0.58, 0.29, 0.84);
              vec3 glow = vec3(0.72, 0.84, 0.98);
              float grad = smoothstep(0.0, 1.0, vUv.y);
              vec2 uv = vUv * vec2(3.2, 8.4);
              float drift = uTime * 0.12;
              float cloud = fbm2(uv + vec2(0.0, drift));
              float ribbons = fbm2(uv * vec2(0.8, 1.7) - vec2(drift, 0.0));
              float grain = hash21(vUv * (uTime + 1.9));
              vec3 col = mix(deep, purple, grad);
              col = mix(col, glow, smoothstep(0.52, 0.94, cloud + ribbons * 0.35) * 0.18);
              col += (grain - 0.5) * 0.03;
              col += vec3(0.03, 0.05, 0.08);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh geometry={ribbonGeometry}>
        <meshBasicMaterial
          color={WAVE_NEON}
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <primitive object={centerLineObject} />

      <instancedMesh ref={obstacleRef} args={[undefined, undefined, OBSTACLE_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          emissive="#7db8ff"
          emissiveIntensity={0.28}
          roughness={0.24}
          metalness={0.16}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={bladeRef} args={[undefined, undefined, OBSTACLE_POOL]}>
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

      <instancedMesh ref={markerRef} args={[undefined, undefined, OBSTACLE_POOL]}>
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

      <instancedMesh ref={collectibleRef} args={[undefined, undefined, COLLECTIBLE_POOL]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          vertexColors
          emissive="#ffe9a9"
          emissiveIntensity={0.34}
          roughness={0.18}
          metalness={0.2}
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <mesh ref={orbRef} position={[PLAYER_X, 1, 0.15]}>
        <sphereGeometry args={[PLAYER_R, 18, 18]} />
        <meshStandardMaterial
          color="#f7fbff"
          emissive="#8ce8ff"
          emissiveIntensity={0.45}
          roughness={0.18}
          metalness={0.04}
        />
      </mesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.62} luminanceThreshold={0.48} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.13} darkness={0.62} />
        <Noise premultiply opacity={0.018} />
      </EffectComposer>

      <Html fullscreen>
        <div
          ref={impactOverlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0,
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,160,178,0.42), rgba(255,90,120,0.24) 30%, rgba(0,0,0,0) 70%)',
          }}
        />
        <WaveFlipOverlay />
      </Html>
    </>
  );
}

const WaveFlip: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <Canvas
      dpr={[1, 1.45]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(event) => event.preventDefault()}
    >
      <WaveFlipScene />
    </Canvas>
  );
};

export default WaveFlip;
export * from './state';
