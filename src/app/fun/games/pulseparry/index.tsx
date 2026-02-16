'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, PerspectiveCamera } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { create } from 'zustand';
import {
  buildPatternLibraryTemplate,
  sampleDifficulty,
  type DifficultySample,
  type GameChunkPatternTemplate,
} from '../../config/ketchapp';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import {
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
} from '../_shared/hyperUpgradeKit';
import { pulseParryState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type GameDifficulty = 'easy' | 'medium' | 'hard';
type ScoreFxTone = 'normal' | 'perfect' | 'streak';
type DifficultyTuning = {
  label: string;
  timingScale: number;
  speedScale: number;
  spawnScale: number;
  perfectScale: number;
  hint: string;
};
type ThemePalette = {
  lane: [THREE.Color, THREE.Color, THREE.Color];
  background: {
    deep: THREE.Color;
    edge: THREE.Color;
    fog: THREE.Color;
    stars: THREE.Color;
  };
  lights: {
    hemisphereSky: THREE.Color;
    hemisphereGround: THREE.Color;
    key: THREE.Color;
    fill: THREE.Color;
  };
  ui: {
    core: THREE.Color;
    coreEmissive: THREE.Color;
    aura: THREE.Color;
    zone: THREE.Color;
    shock: THREE.Color;
  };
};

type Pulse = {
  slot: number;
  active: boolean;
  parried: boolean;
  lane: number;
  angle: number;
  radius: number;
  velocity: number;
  speed: number;
  thickness: number;
  colorIndex: number;
  life: number;
  flash: number;
  requestWeight: number;
  hitFx: number;
};

type Shard = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
};

type Runtime = {
  mode: GameDifficulty;
  elapsed: number;
  score: number;
  lives: number;
  parries: number;
  tapMisses: number;
  phase: number;
  targetLanes: number;
  streak: number;
  laneMask: number;
  perfectCombo: number;
  multiplier: number;
  failMessage: string;

  shake: number;
  hudCommit: number;
  coreGlow: number;
  perfectFlash: number;
  resonance: number;

  cursorAngle: number;
  parryAngle: number;
  parryWindow: number;
  parryWindowLeft: number;
  runeSpin: number;

  shockActive: boolean;
  shockRadius: number;
  shockLife: number;
  shockDuration: number;
  shockMaxRadius: number;
  parryRadius: number;
  tapCooldown: number;
  inputBufferLane: number;
  inputBufferLeft: number;

  spawnTimer: number;
  nextPulseSlot: number;
  nextColor: number;
  paletteSeed: number;
  paletteActive: number;
  paletteTarget: number;
  paletteBlend: number;
  paletteLaneColors: [THREE.Color, THREE.Color, THREE.Color];

  hitThreshold: number;
  perfectThreshold: number;
  overlapLane: number;
  overlapStrength: number;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkPulsesLeft: number;

  pulses: Pulse[];
  shards: Shard[];
};

type PulseParryStore = {
  status: GameStatus;
  mode: GameDifficulty;
  score: number;
  best: number;
  lives: number;
  parries: number;
  phase: number;
  targetLanes: number;
  tapMisses: number;
  combo: number;
  multiplier: number;
  failMessage: string;
  tapNonce: number;
  perfectNonce: number;
  scoreFxNonce: number;
  scoreFxText: string;
  scoreFxTone: ScoreFxTone;
  startRun: () => void;
  resetToStart: () => void;
  setMode: (mode: GameDifficulty) => void;
  setLives: (lives: number) => void;
  onTapFx: () => void;
  onPerfectFx: () => void;
  onScoreFx: (text: string, tone?: ScoreFxTone) => void;
  updateHud: (
    score: number,
    lives: number,
    parries: number,
    phase: number,
    targetLanes: number,
    tapMisses: number,
    combo: number,
    multiplier: number
  ) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'pulseparry_hyper_best_v3';

const PULSE_POOL = 84;
const SHARD_POOL = 96;
const SPARK_POOL = 14;

const CORE_FAIL_RADIUS = 0.1;
const SPAWN_RADIUS_BASE = 0;
const PARRY_RADIUS_BASE = 2.8;
const MISS_RADIUS = 4.05;
const TARGET_NODE_RADIUS = 0.16;
const CAMERA_BASE_Y = 12.6;
const SWIPE_THRESHOLD = 0.16;
const PALETTE_SCORE_STEP = 10;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);
const WHITE = new THREE.Color('#f8fbff');
const DANGER = new THREE.Color('#ff607e');
const LANE_SHAPE_NAMES = ['Right: Orb', 'Up: Block', 'Left: Spike', 'Down: Diamond'] as const;
const LANE_INPUT_NAMES = ['Right', 'Up', 'Left', 'Down'] as const;
const MODE_OPTIONS = ['easy', 'medium', 'hard'] as const satisfies readonly GameDifficulty[];
const DEFAULT_MODE: GameDifficulty = 'medium';
const DIFFICULTY_TUNING: Record<GameDifficulty, DifficultyTuning> = {
  easy: {
    label: 'Easy',
    timingScale: 2,
    speedScale: 0.88,
    spawnScale: 1.12,
    perfectScale: 1.12,
    hint: 'Timing +2.0x',
  },
  medium: {
    label: 'Medium',
    timingScale: 1.5,
    speedScale: 0.94,
    spawnScale: 1.06,
    perfectScale: 1.04,
    hint: 'Timing +1.5x',
  },
  hard: {
    label: 'Hard',
    timingScale: 1,
    speedScale: 1,
    spawnScale: 1,
    perfectScale: 0.92,
    hint: 'Timing +1.0x',
  },
};
const makePalette = (config: {
  lane: [string, string, string];
  background: { deep: string; edge: string; fog: string; stars: string };
  lights: { hemisphereSky: string; hemisphereGround: string; key: string; fill: string };
  ui: { core: string; coreEmissive: string; aura: string; zone: string; shock: string };
}): ThemePalette => ({
  lane: [
    new THREE.Color(config.lane[0]),
    new THREE.Color(config.lane[1]),
    new THREE.Color(config.lane[2]),
  ],
  background: {
    deep: new THREE.Color(config.background.deep),
    edge: new THREE.Color(config.background.edge),
    fog: new THREE.Color(config.background.fog),
    stars: new THREE.Color(config.background.stars),
  },
  lights: {
    hemisphereSky: new THREE.Color(config.lights.hemisphereSky),
    hemisphereGround: new THREE.Color(config.lights.hemisphereGround),
    key: new THREE.Color(config.lights.key),
    fill: new THREE.Color(config.lights.fill),
  },
  ui: {
    core: new THREE.Color(config.ui.core),
    coreEmissive: new THREE.Color(config.ui.coreEmissive),
    aura: new THREE.Color(config.ui.aura),
    zone: new THREE.Color(config.ui.zone),
    shock: new THREE.Color(config.ui.shock),
  },
});
const THEME_PALETTES: ThemePalette[] = [
  makePalette({
    lane: ['#57d9ff', '#ff6fd8', '#b4f766'],
    background: { deep: '#112538', edge: '#1d3d56', fog: '#18344a', stars: '#c2fff6' },
    lights: {
      hemisphereSky: '#8aefff',
      hemisphereGround: '#2a3954',
      key: '#6cffb9',
      fill: '#ffd166',
    },
    ui: {
      core: '#f2f9ff',
      coreEmissive: '#8dffbf',
      aura: '#7effd9',
      zone: '#b4fff1',
      shock: '#f7fcff',
    },
  }),
  makePalette({
    lane: ['#ffc857', '#ff5f9e', '#5af0e2'],
    background: { deep: '#2a1638', edge: '#4d2f5f', fog: '#3e2553', stars: '#ffe9bf' },
    lights: {
      hemisphereSky: '#ffd8ff',
      hemisphereGround: '#2f1f3f',
      key: '#ff9f6e',
      fill: '#7ce2ff',
    },
    ui: {
      core: '#fff4e5',
      coreEmissive: '#ff9fc8',
      aura: '#ffbfe0',
      zone: '#ffd9b3',
      shock: '#fff7d9',
    },
  }),
  makePalette({
    lane: ['#7d7cff', '#32e8ff', '#ff6bcb'],
    background: { deep: '#131b46', edge: '#26346e', fog: '#202d5c', stars: '#cfd8ff' },
    lights: {
      hemisphereSky: '#b4d0ff',
      hemisphereGround: '#1d2953',
      key: '#6ed3ff',
      fill: '#ff9fdc',
    },
    ui: {
      core: '#e8f0ff',
      coreEmissive: '#7db5ff',
      aura: '#9fcbff',
      zone: '#c6e3ff',
      shock: '#f3fbff',
    },
  }),
  makePalette({
    lane: ['#ff8f66', '#ffd166', '#67f3b5'],
    background: { deep: '#1f2f2c', edge: '#36594f', fog: '#2d4a43', stars: '#d6ffe7' },
    lights: {
      hemisphereSky: '#b9ffe2',
      hemisphereGround: '#1f3833',
      key: '#ffd089',
      fill: '#6ef3d6',
    },
    ui: {
      core: '#f3fff8',
      coreEmissive: '#77ffc7',
      aura: '#8effd2',
      zone: '#c2ffe5',
      shock: '#f3fffb',
    },
  }),
  makePalette({
    lane: ['#ff67c7', '#7ef3ff', '#f9ff7a'],
    background: { deep: '#2c1733', edge: '#4a285a', fog: '#3b2148', stars: '#fce4ff' },
    lights: {
      hemisphereSky: '#ffc0ff',
      hemisphereGround: '#2c1f35',
      key: '#ff8fd6',
      fill: '#8de9ff',
    },
    ui: {
      core: '#fff1ff',
      coreEmissive: '#ff9fe0',
      aura: '#ffc6f0',
      zone: '#ffd7f3',
      shock: '#fff7ff',
    },
  }),
  makePalette({
    lane: ['#71f5ff', '#7dff92', '#ffb86f'],
    background: { deep: '#112b30', edge: '#24515a', fog: '#1c434b', stars: '#dcfeff' },
    lights: {
      hemisphereSky: '#b7fbff',
      hemisphereGround: '#203a3f',
      key: '#7efed1',
      fill: '#ffcf8a',
    },
    ui: {
      core: '#ebffff',
      coreEmissive: '#7dffbf',
      aura: '#a9ffe8',
      zone: '#beffef',
      shock: '#f4fffe',
    },
  }),
];
const cloneLaneColors = (
  colors: [THREE.Color, THREE.Color, THREE.Color]
): [THREE.Color, THREE.Color, THREE.Color] => [colors[0].clone(), colors[1].clone(), colors[2].clone()];
const pickPaletteSeed = () => Math.floor(Math.random() * THEME_PALETTES.length);
const smoothstep01 = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;
const CARDINAL_ANGLES = [0, Math.PI * 1.5, Math.PI, Math.PI * 0.5] as const;
const laneBit = (lane: number) => 1 << lane;
const PHASE_LANE_MASKS = [
  laneBit(0) | laneBit(1) | laneBit(2) | laneBit(3),
  laneBit(0) | laneBit(1) | laneBit(2) | laneBit(3),
  laneBit(0) | laneBit(1) | laneBit(2) | laneBit(3),
] as const;
const normalizeAngle = (angle: number) => {
  const m = angle % TAU;
  return m < 0 ? m + TAU : m;
};
const angleDiff = (a: number, b: number) => {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(d, TAU - d);
};
const modeForPressedKey = (keys: Set<string>): GameDifficulty | null => {
  if (keys.has('1')) return 'easy';
  if (keys.has('2')) return 'medium';
  if (keys.has('3')) return 'hard';
  return null;
};
const normalizeMode = (mode: unknown): GameDifficulty => {
  if (mode === 'easy' || mode === 'medium' || mode === 'hard') return mode;
  return DEFAULT_MODE;
};
const getDifficultyTuning = (mode: unknown): DifficultyTuning =>
  DIFFICULTY_TUNING[normalizeMode(mode)];

let audioCtx: AudioContext | null = null;

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

const playClick = (perfect: boolean) => {
  if (typeof window === 'undefined') return;
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  if (!audioCtx) audioCtx = new Context();
  const ctx = audioCtx;
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = perfect ? 'square' : 'triangle';
  osc.frequency.setValueAtTime(perfect ? 960 : 760, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(perfect ? 380 : 290, ctx.currentTime + 0.07);
  gain.gain.setValueAtTime(perfect ? 0.03 : 0.018, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (perfect ? 0.09 : 0.07));
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + (perfect ? 0.1 : 0.08));
};

const createPulse = (slot: number): Pulse => ({
  slot,
  active: false,
  parried: false,
  lane: 0,
  angle: 0,
  radius: SPAWN_RADIUS_BASE,
  velocity: 0,
  speed: 1.3,
  thickness: 0.18,
  colorIndex: 0,
  life: 0,
  flash: 0,
  requestWeight: 0,
  hitFx: 0,
});

const createShard = (slot: number): Shard => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  maxLife: 1,
  size: 0.05,
  color: new THREE.Color('#ffffff'),
});

const createRuntime = (): Runtime => {
  const seed = pickPaletteSeed();
  return {
    mode: DEFAULT_MODE,
  elapsed: 0,
  score: 0,
  lives: 3,
  parries: 0,
  tapMisses: 0,
  phase: 1,
  targetLanes: 4,
  streak: 0,
  laneMask: PHASE_LANE_MASKS[0],
  perfectCombo: 0,
  multiplier: 1,
  failMessage: '',

  shake: 0,
  hudCommit: 0,
  coreGlow: 0,
  perfectFlash: 0,
  resonance: 0,

  cursorAngle: 0,
  parryAngle: 0,
  parryWindow: 0.12,
  parryWindowLeft: 0,
  runeSpin: 0,

  shockActive: false,
  shockRadius: PARRY_RADIUS_BASE,
  shockLife: 0,
  shockDuration: 0.11,
  shockMaxRadius: 5.25,
  parryRadius: PARRY_RADIUS_BASE,
  tapCooldown: 0,
  inputBufferLane: -1,
  inputBufferLeft: 0,

  spawnTimer: 0.64,
  nextPulseSlot: 0,
  nextColor: 0,
  paletteSeed: seed,
  paletteActive: seed,
  paletteTarget: seed,
  paletteBlend: 1,
  paletteLaneColors: cloneLaneColors(THEME_PALETTES[seed].lane),

  hitThreshold: 0.14,
  perfectThreshold: 0.06,
  overlapLane: -1,
  overlapStrength: 0,

  difficulty: sampleDifficulty('timing-defense', 0),
  chunkLibrary: buildPatternLibraryTemplate('pulseparry'),
  currentChunk: null,
  chunkPulsesLeft: 0,

  pulses: Array.from({ length: PULSE_POOL }, (_, idx) => createPulse(idx)),
  shards: Array.from({ length: SHARD_POOL }, (_, idx) => createShard(idx)),
  };
};

const resetRuntime = (runtime: Runtime, mode: GameDifficulty) => {
  const seed = pickPaletteSeed();
  runtime.mode = mode;
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.lives = 3;
  runtime.parries = 0;
  runtime.tapMisses = 0;
  runtime.phase = 1;
  runtime.targetLanes = 4;
  runtime.streak = 0;
  runtime.laneMask = PHASE_LANE_MASKS[0];
  runtime.perfectCombo = 0;
  runtime.multiplier = 1;
  runtime.failMessage = '';

  runtime.shake = 0;
  runtime.hudCommit = 0;
  runtime.coreGlow = 0;
  runtime.perfectFlash = 0;
  runtime.resonance = 0;
  runtime.cursorAngle = 0;
  runtime.parryAngle = 0;
  runtime.parryWindow = 0.12;
  runtime.parryWindowLeft = 0;
  runtime.runeSpin = 0;

  runtime.shockActive = false;
  runtime.shockRadius = PARRY_RADIUS_BASE;
  runtime.shockLife = 0;
  runtime.shockDuration = 0.11;
  runtime.shockMaxRadius = 5.25;
  runtime.parryRadius = PARRY_RADIUS_BASE;
  runtime.tapCooldown = 0;
  runtime.inputBufferLane = -1;
  runtime.inputBufferLeft = 0;

  runtime.spawnTimer = 0.64;
  runtime.nextPulseSlot = 0;
  runtime.nextColor = 0;
  runtime.paletteSeed = seed;
  runtime.paletteActive = seed;
  runtime.paletteTarget = seed;
  runtime.paletteBlend = 1;
  runtime.paletteLaneColors[0].copy(THEME_PALETTES[seed].lane[0]);
  runtime.paletteLaneColors[1].copy(THEME_PALETTES[seed].lane[1]);
  runtime.paletteLaneColors[2].copy(THEME_PALETTES[seed].lane[2]);

  runtime.hitThreshold = 0.14;
  runtime.perfectThreshold = 0.06;
  runtime.overlapLane = -1;
  runtime.overlapStrength = 0;

  runtime.difficulty = sampleDifficulty('timing-defense', 0);
  runtime.currentChunk = null;
  runtime.chunkPulsesLeft = 0;

  for (const pulse of runtime.pulses) {
    pulse.active = false;
    pulse.parried = false;
    pulse.lane = 0;
    pulse.angle = 0;
    pulse.radius = SPAWN_RADIUS_BASE;
    pulse.velocity = 0;
    pulse.speed = 1.3;
    pulse.thickness = 0.18;
    pulse.colorIndex = 0;
    pulse.life = 0;
    pulse.flash = 0;
    pulse.requestWeight = 0;
    pulse.hitFx = 0;
  }

  for (const shard of runtime.shards) {
    shard.active = false;
    shard.life = 0;
  }
};

const usePulseParryStore = create<PulseParryStore>((set) => ({
  status: 'START',
  mode: DEFAULT_MODE,
  score: 0,
  best: readBest(),
  lives: 3,
  parries: 0,
  phase: 1,
  targetLanes: 4,
  tapMisses: 0,
  combo: 0,
  multiplier: 1,
  failMessage: '',
  tapNonce: 0,
  perfectNonce: 0,
  scoreFxNonce: 0,
  scoreFxText: '+1',
  scoreFxTone: 'normal',
  startRun: () =>
    set((state) => ({
      status: 'PLAYING',
      score: 0,
      lives: 3,
      parries: 0,
      phase: 1,
      targetLanes: 4,
      tapMisses: 0,
      combo: 0,
      multiplier: 1,
      failMessage: '',
      mode: state.mode,
    })),
  resetToStart: () =>
    set((state) => ({
      status: 'START',
      score: 0,
      lives: 3,
      parries: 0,
      phase: 1,
      targetLanes: 4,
      tapMisses: 0,
      combo: 0,
      multiplier: 1,
      failMessage: '',
      mode: state.mode,
    })),
  setMode: (mode) => set({ mode }),
  setLives: (lives) => set({ lives }),
  onTapFx: () => set((state) => ({ tapNonce: state.tapNonce + 1 })),
  onPerfectFx: () => set((state) => ({ perfectNonce: state.perfectNonce + 1 })),
  onScoreFx: (text, tone = 'normal') =>
    set((state) => ({
      scoreFxNonce: state.scoreFxNonce + 1,
      scoreFxText: text,
      scoreFxTone: tone,
    })),
  updateHud: (score, lives, parries, phase, targetLanes, tapMisses, combo, multiplier) =>
    set({
      score: Math.floor(score),
      lives,
      parries,
      phase,
      targetLanes,
      tapMisses,
      combo,
      multiplier,
    }),
  endRun: (score, reason) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        lives: 0,
        best: nextBest,
        parries: state.parries,
        phase: state.phase,
        targetLanes: state.targetLanes,
        tapMisses: state.tapMisses,
        combo: 0,
        multiplier: 1,
        failMessage: reason,
      };
    }),
}));

const laneIsActive = (runtime: Runtime, lane: number) =>
  (runtime.laneMask & laneBit(lane)) !== 0;

const activeLanes = (runtime: Runtime) => {
  const lanes: number[] = [];
  for (let lane = 0; lane < CARDINAL_ANGLES.length; lane += 1) {
    if (laneIsActive(runtime, lane)) lanes.push(lane);
  }
  return lanes;
};

const laneForDirectionalKey = (keys: Set<string>): number | null => {
  if (keys.has('arrowup') || keys.has('w')) return 1;
  if (keys.has('arrowleft') || keys.has('a')) return 2;
  if (keys.has('arrowdown') || keys.has('s')) return 3;
  if (keys.has('arrowright') || keys.has('d')) return 0;
  return null;
};

const laneForSwipe = (dx: number, dy: number): number | null => {
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 0 : 2;
  return dy > 0 ? 1 : 3;
};

type OverlapCandidate = {
  pulse: Pulse;
  diff: number;
  hitWindow: number;
  contactRadius: number;
};

const findOverlapCandidate = (runtime: Runtime, slack = 1): OverlapCandidate | null => {
  let best: OverlapCandidate | null = null;
  for (const pulse of runtime.pulses) {
    if (!pulse.active || pulse.parried || !laneIsActive(runtime, pulse.lane)) continue;
    const contactRadius = TARGET_NODE_RADIUS + pulse.thickness * 0.52;
    const diff = Math.abs(pulse.radius - runtime.parryRadius);
    const hitWindow = runtime.hitThreshold + contactRadius;
    if (diff > hitWindow * slack) continue;
    if (!best || diff < best.diff) {
      best = { pulse, diff, hitWindow, contactRadius };
    }
  }
  return best;
};

const spawnInterval = (runtime: Runtime) => {
  const tuning = getDifficultyTuning(runtime.mode);
  const base = clamp(1.1 - Math.min(0.58, runtime.elapsed * 0.008), 0.52, 1.1);
  const pressure = clamp(runtime.elapsed * 0.0012 + runtime.score * 0.0022, 0, 0.32);
  return base * tuning.spawnScale * (1 - pressure);
};

const acquirePulse = (runtime: Runtime) => {
  for (let i = 0; i < runtime.pulses.length; i += 1) {
    const idx = (runtime.nextPulseSlot + i) % runtime.pulses.length;
    const pulse = runtime.pulses[idx];
    if (!pulse.active) {
      runtime.nextPulseSlot = (idx + 1) % runtime.pulses.length;
      return pulse;
    }
  }
  const fallback = runtime.pulses[runtime.nextPulseSlot];
  runtime.nextPulseSlot = (runtime.nextPulseSlot + 1) % runtime.pulses.length;
  return fallback;
};

const spawnPulseSet = (runtime: Runtime) => {
  for (const pulse of runtime.pulses) {
    if (pulse.active) return;
  }
  const lanes = activeLanes(runtime);
  if (lanes.length === 0) return;
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  const pulse = acquirePulse(runtime);
  const tuning = getDifficultyTuning(runtime.mode);
  const speedRamp = Math.min(1.05, runtime.elapsed * 0.018);
  const scoreRamp = Math.min(0.95, runtime.score * 0.012);
  pulse.active = true;
  pulse.parried = false;
  pulse.lane = lane;
  pulse.angle = CARDINAL_ANGLES[lane];
  pulse.radius = SPAWN_RADIUS_BASE;
  pulse.velocity = 0;
  pulse.speed = (1.04 + speedRamp + scoreRamp + Math.random() * 0.18) * tuning.speedScale;
  pulse.thickness = 0.24 + Math.random() * 0.06;
  pulse.colorIndex = runtime.nextColor;
  pulse.life = 0;
  pulse.flash = 0;
  pulse.requestWeight = 0;
  pulse.hitFx = 0;
  runtime.nextColor = (runtime.nextColor + 1) % runtime.paletteLaneColors.length;
};

const acquireShard = (runtime: Runtime) => {
  for (const shard of runtime.shards) {
    if (!shard.active) return shard;
  }
  return runtime.shards[Math.floor(Math.random() * runtime.shards.length)];
};

const spawnBurst = (
  runtime: Runtime,
  radius: number,
  color: THREE.Color,
  count: number,
  spread: number,
  lane?: number
) => {
  const hasLane = typeof lane === 'number' && lane >= 0 && lane < CARDINAL_ANGLES.length;
  const laneAngle = hasLane ? CARDINAL_ANGLES[lane] : 0;
  const laneX = hasLane ? Math.cos(laneAngle) * radius : 0;
  const laneZ = hasLane ? Math.sin(laneAngle) * radius : 0;

  for (let i = 0; i < count; i += 1) {
    const shard = acquireShard(runtime);
    const angle = hasLane ? laneAngle + (Math.random() * 2 - 1) * 0.95 : Math.random() * Math.PI * 2;
    const r = hasLane ? Math.random() * 0.11 : Math.max(0.15, radius + (Math.random() * 2 - 1) * 0.08);
    const speed = spread * (0.55 + Math.random() * 0.9);

    shard.active = true;
    shard.x = (hasLane ? laneX : 0) + Math.cos(angle) * r;
    shard.y = -0.02 + Math.random() * 0.05;
    shard.z = (hasLane ? laneZ : 0) + Math.sin(angle) * r;
    shard.vx = Math.cos(angle) * speed + (Math.random() * 2 - 1) * 0.25;
    shard.vz = Math.sin(angle) * speed + (Math.random() * 2 - 1) * 0.25;
    shard.vy = 1.6 + Math.random() * 2.1;
    shard.life = 0.22 + Math.random() * 0.24;
    shard.maxLife = shard.life;
    shard.size = 0.03 + Math.random() * 0.05;
    shard.color.copy(color);
  }
};

function LaneShapeGeometry({
  lane,
}: {
  lane: number;
}) {
  switch (lane % 4) {
    case 0:
      return <sphereGeometry args={[1, 16, 16]} />;
    case 1:
      return <boxGeometry args={[1.7, 1.7, 1.7]} />;
    case 2:
      return <tetrahedronGeometry args={[1.25, 0]} />;
    default:
      return <octahedronGeometry args={[1.35, 0]} />;
  }
}

const syncPulseLaneMesh = (
  mesh: THREE.InstancedMesh | null,
  lane: number,
  runtime: Runtime,
  dummy: THREE.Object3D,
  colorScratch: THREE.Color,
  laneColor: THREE.Color
) => {
  if (!mesh) return;
  for (let i = 0; i < runtime.pulses.length; i += 1) {
    const pulse = runtime.pulses[i];
    if (!pulse.active || pulse.lane !== lane) {
      dummy.position.copy(OFFSCREEN_POS);
      dummy.scale.copy(TINY_SCALE);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, WHITE);
      continue;
    }

    const appear = clamp(pulse.life / 0.14, 0, 1);
    const requestW = clamp(pulse.requestWeight, 0, 1);
    const hitW = clamp(pulse.hitFx, 0, 1);
    const organic = 0.9 + 0.1 * Math.sin((runtime.elapsed + pulse.slot * 0.037) * 6.4);
    const wiggle =
      Math.sin(runtime.elapsed * 16 + pulse.slot * 0.9) * (requestW * 0.036 + hitW * 0.026);
    const bob = Math.cos(runtime.elapsed * 13 + pulse.slot * 0.7) * (requestW * 0.012 + hitW * 0.02);
    const radialX = Math.cos(pulse.angle) * pulse.radius;
    const radialZ = Math.sin(pulse.angle) * pulse.radius;
    const tangentX = -Math.sin(pulse.angle);
    const tangentZ = Math.cos(pulse.angle);
    dummy.position.set(
      radialX + tangentX * wiggle,
      0.022 + (1 - appear) * 0.06 + Math.sin((pulse.life + pulse.slot) * 7) * 0.006 + bob,
      radialZ + tangentZ * wiggle
    );
    const s = Math.max(
      0.001,
      pulse.thickness * (0.35 + 0.65 * appear) * organic * (1 + requestW * 0.22 + hitW * 0.28)
    );
    dummy.scale.setScalar(s * 1.08);
    dummy.rotation.set(
      pulse.life * 3.4 + lane * 0.3 + Math.sin(runtime.elapsed * 18 + pulse.slot) * requestW * 0.45,
      runtime.elapsed * 0.55 + pulse.slot * 0.1,
      pulse.life * 2.8 + Math.cos(runtime.elapsed * 13 + pulse.slot) * (requestW * 0.42 + hitW * 0.34)
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    if (pulse.parried) {
      colorScratch.copy(laneColor).lerp(WHITE, 0.14 + hitW * 0.2);
    } else {
      colorScratch
        .copy(laneColor)
        .lerp(WHITE, clamp((1 - appear) * 0.35 + requestW * 0.65, 0, 0.82));
    }
    if (pulse.flash > 0) colorScratch.lerp(WHITE, clamp(pulse.flash, 0, 0.8));
    mesh.setColorAt(i, colorScratch);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
};

function PulseParryOverlay() {
  const status = usePulseParryStore((state) => state.status);
  const mode = usePulseParryStore((state) => state.mode);
  const score = usePulseParryStore((state) => state.score);
  const best = usePulseParryStore((state) => state.best);
  const lives = usePulseParryStore((state) => state.lives);
  const hits = usePulseParryStore((state) => state.parries);
  const combo = usePulseParryStore((state) => state.combo);
  const multiplier = usePulseParryStore((state) => state.multiplier);
  const failMessage = usePulseParryStore((state) => state.failMessage);
  const tapNonce = usePulseParryStore((state) => state.tapNonce);
  const perfectNonce = usePulseParryStore((state) => state.perfectNonce);
  const scoreFxNonce = usePulseParryStore((state) => state.scoreFxNonce);
  const scoreFxText = usePulseParryStore((state) => state.scoreFxText);
  const scoreFxTone = usePulseParryStore((state) => state.scoreFxTone);
  const setMode = usePulseParryStore((state) => state.setMode);
  const outs = 3 - lives;
  const safeMode = normalizeMode(mode);
  const modeMeta = getDifficultyTuning(mode);
  const scoreFxColor =
    scoreFxTone === 'streak' ? '#fef08a' : scoreFxTone === 'perfect' ? '#9ae6ff' : '#ffffff';
  const modeAccentClass: Record<GameDifficulty, string> = {
    easy: 'border-emerald-300/80 bg-emerald-500/30 text-emerald-50',
    medium: 'border-amber-300/80 bg-amber-500/28 text-amber-50',
    hard: 'border-rose-300/80 bg-rose-500/30 text-rose-50',
  };

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-5 top-4 rounded-md border border-emerald-100/55 bg-gradient-to-br from-emerald-500/22 via-cyan-500/16 to-lime-500/22 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Pulse Parry</div>
        <div className="text-[11px] text-cyan-50/85">
          Send shapes from center to targets. Press the matching direction when they touch.
        </div>
        <div className="text-[10px] text-cyan-100/70">
          W/↑ Top • A/← Left • S/↓ Bottom • D/→ Right • 1/2/3 Difficulty • Swipe on mobile
        </div>
        <div className="mt-2 pointer-events-auto flex gap-1">
          {MODE_OPTIONS.map((entry) => (
            <button
              key={entry}
              type="button"
              disabled={status === 'PLAYING'}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (status !== 'PLAYING') setMode(entry);
              }}
              className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em] transition ${
                entry === safeMode
                  ? modeAccentClass[entry]
                  : 'border-white/22 bg-black/25 text-white/70 hover:text-white/90'
              } ${status === 'PLAYING' ? 'cursor-not-allowed opacity-55' : ''}`}
            >
              {DIFFICULTY_TUNING[entry].label}
            </button>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-cyan-100/75">
          {modeMeta.label}: {modeMeta.hint}
        </div>
      </div>

      <div className="absolute right-5 top-4 rounded-md border border-fuchsia-100/55 bg-gradient-to-br from-fuchsia-500/22 via-violet-500/15 to-emerald-500/18 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
        <div className="text-[10px] uppercase tracking-[0.17em] text-cyan-100/80">{modeMeta.label}</div>
        {status === 'PLAYING' && (
          <div className="text-[10px] text-white/80">
            Streak {combo} • x{multiplier.toFixed(2)}
          </div>
        )}
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-5 top-[132px] rounded-md border border-emerald-100/35 bg-gradient-to-br from-slate-950/72 via-emerald-900/30 to-fuchsia-900/26 px-3 py-2 text-xs">
          <div>
            Hits <span className="font-semibold text-cyan-200">{hits}</span>
          </div>
          <div>
            Outs <span className="font-semibold text-rose-200">{outs}/3</span>
          </div>
          <div>
            Flow <span className="font-semibold text-emerald-200">{combo}</span> • x
            <span className="font-semibold text-amber-100">{multiplier.toFixed(2)}</span>
          </div>
          <div>
            Correct touch timing only. Wrong key or late input = out.
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-emerald-100/42 bg-gradient-to-br from-slate-950/80 via-emerald-950/44 to-fuchsia-950/34 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">PULSE PARRY</div>
            <div className="mt-2 text-sm text-white/85">
              Shapes launch from the center. Hit the matching direction when the moving and fixed shapes touch.
            </div>
            <div className="mt-1 text-sm text-white/80">
              Keyboard: W/A/S/D or arrows. Mobile: swipe Up/Left/Down/Right.
            </div>
            <div className="mt-1 text-sm text-white/80">You get 3 outs.</div>
            <div className="mt-1 text-xs text-white/70">
              Target order: {LANE_SHAPE_NAMES.join(' • ')}
            </div>
            <div className="mt-2 text-xs text-white/75">
              Difficulty: <span className="font-semibold text-cyan-100">{modeMeta.label}</span> (
              {modeMeta.hint})
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/45 to-emerald-950/26 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">3 Outs</div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-1 text-xs text-white/70">
              Difficulty: {modeMeta.label} ({modeMeta.hint})
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap or press R to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && scoreFxNonce > 0 && (
        <div key={scoreFxNonce}>
          <div
            className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 text-3xl font-black tracking-[0.08em]"
            style={{
              color: scoreFxColor,
              textShadow: `0 0 20px ${scoreFxColor}`,
              animation: 'pulseparry-scorefx 460ms cubic-bezier(0.2, 0.8, 0.25, 1) forwards',
              opacity: 0,
            }}
          >
            {scoreFxText}
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={tapNonce}>
          <div
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/60"
            style={{
              animation: 'pulseparry-tap 180ms ease-out forwards',
              opacity: 0,
            }}
          />
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={perfectNonce}>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35), rgba(131,253,255,0.08) 35%, rgba(0,0,0,0) 75%)',
              animation: 'pulseparry-perfect 130ms ease-out forwards',
              opacity: 0,
            }}
          />
        </div>
      )}

      <style jsx global>{`
        @keyframes pulseparry-tap {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.62;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.28);
            opacity: 0;
          }
        }
        @keyframes pulseparry-perfect {
          0% {
            opacity: 0.82;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes pulseparry-scorefx {
          0% {
            transform: translate(-50%, -50%) scale(0.7);
            opacity: 0.05;
          }
          25% {
            transform: translate(-50%, -50%) scale(1.04);
            opacity: 0.96;
          }
          100% {
            transform: translate(-50%, -112%) scale(0.92);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function PulseParryScene() {
  const inputRef = useInputRef({
    preventDefault: [
      ' ',
      'Space',
      'space',
      'enter',
      'Enter',
      'arrowup',
      'ArrowUp',
      'arrowdown',
      'ArrowDown',
      'arrowleft',
      'ArrowLeft',
      'arrowright',
      'ArrowRight',
      'w',
      'KeyW',
      'a',
      'KeyA',
      's',
      'KeyS',
      'd',
      'KeyD',
      'W',
      'A',
      'S',
      'D',
      'r',
      'R',
      '1',
      '2',
      '3',
      'Digit1',
      'Digit2',
      'Digit3',
    ],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const starsMaterialRef = useRef<THREE.PointsMaterial>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const keyLightRef = useRef<THREE.PointLight>(null);
  const fillLightRef = useRef<THREE.PointLight>(null);
  const pulseLaneRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const auraMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const parryZoneRef = useRef<THREE.Mesh>(null);
  const parryZoneMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const shockRef = useRef<THREE.Mesh>(null);
  const shockMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const cursorRef = useRef<THREE.Mesh>(null);
  const parryPetalRefs = useRef<Array<THREE.Mesh | null>>([]);
  const runeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const laneBeamRefs = useRef<Array<THREE.Mesh | null>>([]);
  const bloomRef = useRef<any>(null);
  const fixedStepRef = useRef(createFixedStepState());
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const themeDeep = useMemo(() => new THREE.Color(), []);
  const themeEdge = useMemo(() => new THREE.Color(), []);
  const themeFog = useMemo(() => new THREE.Color(), []);
  const themeStars = useMemo(() => new THREE.Color(), []);
  const themeSky = useMemo(() => new THREE.Color(), []);
  const themeGround = useMemo(() => new THREE.Color(), []);
  const themeKey = useMemo(() => new THREE.Color(), []);
  const themeFill = useMemo(() => new THREE.Color(), []);
  const themeCore = useMemo(() => new THREE.Color(), []);
  const themeCoreEmissive = useMemo(() => new THREE.Color(), []);
  const themeAura = useMemo(() => new THREE.Color(), []);
  const themeZone = useMemo(() => new THREE.Color(), []);
  const themeShock = useMemo(() => new THREE.Color(), []);

  const starsGeometry = useMemo(() => {
    const count = 220;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() * 2 - 1) * 7.6;
      pos[i * 3 + 1] = -0.6 - Math.random() * 0.8;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 7.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  const { camera, scene } = useThree();

  useEffect(() => {
    const mode = normalizeMode(usePulseParryStore.getState().mode);
    usePulseParryStore.getState().setMode(mode);
    resetRuntime(runtimeRef.current, mode);
    usePulseParryStore.getState().resetToStart();
    pulseParryState.status = 'menu';
    pulseParryState.score = 0;
  }, []);

  useEffect(() => {
    const apply = (state: ReturnType<typeof usePulseParryStore.getState>) => {
      pulseParryState.status =
        state.status === 'START'
          ? 'menu'
          : state.status === 'PLAYING'
            ? 'playing'
            : 'gameover';
      pulseParryState.score = state.score;
      pulseParryState.best = state.best;
    };

    apply(usePulseParryStore.getState());
    const unsub = usePulseParryStore.subscribe(apply);
    return () => unsub();
  }, []);

  useEffect(
    () => () => {
      starsGeometry.dispose();
    },
    [starsGeometry]
  );

  useFrame((_, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = usePulseParryStore.getState();
    const activeMode = normalizeMode(store.mode);
    const paletteStep = Math.floor(runtime.score / PALETTE_SCORE_STEP);
    const desiredPalette = (runtime.paletteSeed + paletteStep) % THEME_PALETTES.length;
    if (desiredPalette !== runtime.paletteTarget) {
      runtime.paletteActive = runtime.paletteTarget;
      runtime.paletteTarget = desiredPalette;
      runtime.paletteBlend = 0;
    }
    runtime.paletteBlend = clamp(runtime.paletteBlend + dt * 0.72, 0, 1);
    const paletteT = smoothstep01(runtime.paletteBlend);
    const paletteFrom = THEME_PALETTES[runtime.paletteActive];
    const paletteTo = THEME_PALETTES[runtime.paletteTarget];
    for (let i = 0; i < runtime.paletteLaneColors.length; i += 1) {
      runtime.paletteLaneColors[i]
        .copy(paletteFrom.lane[i])
        .lerp(paletteTo.lane[i], paletteT);
    }
    themeDeep.copy(paletteFrom.background.deep).lerp(paletteTo.background.deep, paletteT);
    themeEdge.copy(paletteFrom.background.edge).lerp(paletteTo.background.edge, paletteT);
    themeFog.copy(paletteFrom.background.fog).lerp(paletteTo.background.fog, paletteT);
    themeStars.copy(paletteFrom.background.stars).lerp(paletteTo.background.stars, paletteT);
    themeSky.copy(paletteFrom.lights.hemisphereSky).lerp(paletteTo.lights.hemisphereSky, paletteT);
    themeGround
      .copy(paletteFrom.lights.hemisphereGround)
      .lerp(paletteTo.lights.hemisphereGround, paletteT);
    themeKey.copy(paletteFrom.lights.key).lerp(paletteTo.lights.key, paletteT);
    themeFill.copy(paletteFrom.lights.fill).lerp(paletteTo.lights.fill, paletteT);
    themeCore.copy(paletteFrom.ui.core).lerp(paletteTo.ui.core, paletteT);
    themeCoreEmissive
      .copy(paletteFrom.ui.coreEmissive)
      .lerp(paletteTo.ui.coreEmissive, paletteT);
    themeAura.copy(paletteFrom.ui.aura).lerp(paletteTo.ui.aura, paletteT);
    themeZone.copy(paletteFrom.ui.zone).lerp(paletteTo.ui.zone, paletteT);
    themeShock.copy(paletteFrom.ui.shock).lerp(paletteTo.ui.shock, paletteT);

    const startTap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const keyLane = laneForDirectionalKey(input.justPressed);
    const modeInput = modeForPressedKey(input.justPressed);

    if (input.pointerJustDown) {
      swipeStartRef.current = { x: input.pointerX, y: input.pointerY };
    }
    let swipeLane: number | null = null;
    if (input.pointerJustUp) {
      const swipeStart = swipeStartRef.current;
      if (swipeStart) {
        swipeLane = laneForSwipe(input.pointerX - swipeStart.x, input.pointerY - swipeStart.y);
      }
      swipeStartRef.current = null;
    }
    const laneInput = keyLane ?? swipeLane;
    const restart = input.justPressed.has('r');

    if (modeInput && store.status !== 'PLAYING') {
      usePulseParryStore.getState().setMode(modeInput);
      runtime.mode = modeInput;
    } else if (store.status !== 'PLAYING') {
      runtime.mode = activeMode;
      if (store.mode !== activeMode) {
        usePulseParryStore.getState().setMode(activeMode);
      }
    }

    if (restart) {
      resetRuntime(runtime, activeMode);
      usePulseParryStore.getState().startRun();
    }

    if (startTap && !restart && store.status !== 'PLAYING') {
      resetRuntime(runtime, activeMode);
      usePulseParryStore.getState().startRun();
    }

    if (store.status === 'PLAYING') {
      let failed = false;
      runtime.mode = activeMode;
      const tuning = getDifficultyTuning(runtime.mode);
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.phase = 1;
      runtime.targetLanes = 4;
      runtime.laneMask = PHASE_LANE_MASKS[0];
      runtime.parryWindowLeft = Math.max(0, runtime.parryWindowLeft - dt);
      const challenge = clamp(runtime.elapsed * 0.0065 + runtime.score * 0.014, 0, 1.2);
      const challengeWindowScale = clamp(1 - challenge * 0.16, 0.78, 1);
      const baseHitWindow = clamp(
        clamp(0.072 - Math.min(0.022, runtime.elapsed * 0.00056), 0.05, 0.072) *
          challengeWindowScale,
        0.045,
        0.072
      );
      runtime.hitThreshold = clamp(baseHitWindow * tuning.timingScale, 0.05, 0.2);
      runtime.perfectThreshold = clamp(
        runtime.hitThreshold *
          clamp(0.44 + (tuning.perfectScale - 1) * 0.32 - challenge * 0.04, 0.34, 0.7),
        0.03,
        runtime.hitThreshold * 0.74
      );
      runtime.parryRadius = PARRY_RADIUS_BASE;
      runtime.tapCooldown = Math.max(0, runtime.tapCooldown - dt);
      runtime.inputBufferLeft = Math.max(0, runtime.inputBufferLeft - dt);
      if (runtime.inputBufferLeft <= 0) runtime.inputBufferLane = -1;
      const overlapCandidate = findOverlapCandidate(runtime, 1.05);
      runtime.overlapLane = overlapCandidate?.pulse.lane ?? -1;
      runtime.overlapStrength = overlapCandidate
        ? clamp(1 - overlapCandidate.diff / (overlapCandidate.hitWindow * 1.05), 0, 1)
        : 0;
      runtime.cursorAngle =
        runtime.overlapLane >= 0
          ? CARDINAL_ANGLES[runtime.overlapLane]
          : normalizeAngle(runtime.cursorAngle + dt * 1.45);

      const registerOut = (reason: string, lane?: number) => {
        if (failed) return;
        runtime.lives -= 1;
        runtime.tapMisses = 3 - runtime.lives;
        runtime.streak = 0;
        runtime.multiplier = 1;
        runtime.perfectCombo = 0;
        runtime.resonance = Math.max(0, runtime.resonance - 0.8);
        runtime.shake = Math.min(1.6, runtime.shake + 0.62);
        runtime.coreGlow = Math.min(1.35, runtime.coreGlow + 0.2);
        runtime.perfectFlash = 1;
        runtime.parryWindowLeft = 0;
        runtime.shockActive = false;
        runtime.shockLife = 0;
        runtime.inputBufferLeft = 0;
        runtime.inputBufferLane = -1;
        spawnBurst(runtime, runtime.parryRadius, DANGER, 12, 2.3, lane);
        usePulseParryStore.getState().setLives(runtime.lives);
        if (runtime.lives <= 0) {
          runtime.failMessage = reason;
          usePulseParryStore.getState().endRun(runtime.score, runtime.failMessage);
          failed = true;
        }
      };

      const resolveParry = (lane: number, slack: number, buffered: boolean) => {
        const contact = findOverlapCandidate(runtime, slack);
        if (!contact) return false;
        if (contact.pulse.lane !== lane) {
          if (!buffered) {
            const missedLane = contact.pulse.lane;
            contact.pulse.active = false;
            contact.pulse.requestWeight = 0;
            registerOut(
              `Out: pressed ${LANE_INPUT_NAMES[lane]}, needed ${LANE_INPUT_NAMES[missedLane]}.`,
              missedLane
            );
          }
          return false;
        }

        const pulse = contact.pulse;
        pulse.parried = true;
        pulse.flash = 1;
        pulse.hitFx = 1;
        pulse.requestWeight = Math.max(0, pulse.requestWeight - 0.65);
        runtime.parryAngle = pulse.angle;
        runtime.parryWindowLeft = runtime.parryWindow;
        runtime.parries += 1;
        runtime.streak += 1;
        const perfect = contact.diff <= runtime.perfectThreshold + contact.contactRadius * 0.46;
        runtime.perfectCombo = perfect ? runtime.perfectCombo + 1 : 0;
        runtime.multiplier = clamp(
          1 + Math.floor(runtime.streak / 6) * 0.2 + runtime.perfectCombo * 0.05,
          1,
          3.2
        );
        const streakBonus = runtime.streak > 0 && runtime.streak % 8 === 0;
        let scoreGain = 1;
        if (perfect) scoreGain += 1;
        if (streakBonus) scoreGain += 1;
        scoreGain = Math.max(1, Math.round(scoreGain * (0.75 + runtime.multiplier * 0.25)));
        runtime.score += scoreGain;
        runtime.resonance = clamp(runtime.resonance + 0.48, 0, 12);
        runtime.coreGlow = Math.min(1.7, runtime.coreGlow + 0.32);
        runtime.shake = Math.min(1.1, runtime.shake + 0.16);
        runtime.inputBufferLeft = 0;
        runtime.inputBufferLane = -1;

        const laneColor = runtime.paletteLaneColors[pulse.colorIndex % runtime.paletteLaneColors.length];
        const shardCount = perfect ? 16 : 11;
        spawnBurst(runtime, runtime.parryRadius, laneColor, shardCount, 2.4, pulse.lane);
        spawnBurst(runtime, runtime.parryRadius * 0.9, WHITE, perfect ? 9 : 6, 2.05, pulse.lane);
        runtime.perfectFlash = 1;
        const scoreFxTone: ScoreFxTone = streakBonus ? 'streak' : perfect ? 'perfect' : 'normal';
        const scoreFxText = streakBonus
          ? `+${scoreGain} STREAK`
          : perfect
            ? `+${scoreGain} PERFECT`
            : `+${scoreGain}`;
        usePulseParryStore.getState().onScoreFx(scoreFxText, scoreFxTone);
        if (perfect) {
          playClick(true);
          usePulseParryStore.getState().onPerfectFx();
        } else {
          playClick(false);
        }
        return true;
      };

      if (laneInput !== null && runtime.tapCooldown <= 0) {
        runtime.tapCooldown = 0.08;
        runtime.shockActive = true;
        runtime.shockRadius = runtime.parryRadius;
        runtime.shockLife = runtime.shockDuration;
        runtime.coreGlow = Math.min(1.25, runtime.coreGlow + 0.08);
        runtime.inputBufferLane = laneInput;
        runtime.inputBufferLeft = clamp(0.09 * tuning.timingScale, 0.09, 0.24);
        usePulseParryStore.getState().onTapFx();
        resolveParry(laneInput, 1.16, false);
      }

      if (!failed) {
        runtime.spawnTimer -= dt;
        if (runtime.spawnTimer <= 0) {
          spawnPulseSet(runtime);
          runtime.spawnTimer += spawnInterval(runtime);
        }
      }

      if (runtime.shockActive) {
        runtime.shockLife -= dt;
        if (runtime.shockLife <= 0) {
          runtime.shockActive = false;
          runtime.shockLife = 0;
        }
      }

      for (const pulse of runtime.pulses) {
        if (failed) break;
        if (!pulse.active) continue;
        pulse.flash = Math.max(0, pulse.flash - dt * 4.5);
        pulse.hitFx = Math.max(0, pulse.hitFx - dt * 4.6);
        pulse.life += dt;

        if (pulse.parried) {
          pulse.requestWeight = Math.max(0, pulse.requestWeight - dt * 6);
          pulse.radius += dt * (0.95 + pulse.speed * 0.32);
          if (pulse.hitFx <= 0.02 || pulse.radius >= MISS_RADIUS + pulse.thickness * 0.8) {
            pulse.active = false;
            pulse.parried = false;
          }
          continue;
        }

        const targetVelocity = pulse.speed * (0.55 + Math.min(0.7, pulse.life * 0.9));
        const accel = (targetVelocity - pulse.velocity) * (5.4 - Math.min(2.5, pulse.life * 1.4));
        pulse.velocity += accel * dt;
        pulse.velocity *= Math.exp(-0.2 * dt);
        pulse.radius += pulse.velocity * dt;

        const contactRadius = TARGET_NODE_RADIUS + pulse.thickness * 0.52;
        const requestBand = runtime.hitThreshold + contactRadius;
        const proximity = clamp(
          1 - Math.abs(pulse.radius - runtime.parryRadius) / Math.max(0.0001, requestBand * 1.18),
          0,
          1
        );
        pulse.requestWeight = clamp(
          lerp(pulse.requestWeight, proximity, 1 - Math.exp(-dt * 10.5)),
          0,
          1
        );
        const bufferLateGrace =
          runtime.inputBufferLeft > 0 && runtime.inputBufferLane === pulse.lane
            ? runtime.hitThreshold * 0.42
            : 0;
        if (pulse.radius > runtime.parryRadius + contactRadius + runtime.hitThreshold * 1.18 + bufferLateGrace) {
          pulse.active = false;
          pulse.requestWeight = 0;
          registerOut(`Out: missed ${LANE_INPUT_NAMES[pulse.lane]} touch window.`, pulse.lane);
          continue;
        }

        if (pulse.radius >= MISS_RADIUS + pulse.thickness * 0.6) {
          pulse.active = false;
          pulse.requestWeight = 0;
        }
      }

      if (
        !failed &&
        runtime.inputBufferLeft > 0 &&
        runtime.inputBufferLane >= 0 &&
        runtime.tapCooldown <= 0.065
      ) {
        resolveParry(runtime.inputBufferLane, 1.22, true);
      }

      if (!failed && runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        usePulseParryStore
          .getState()
          .updateHud(
            runtime.score,
            runtime.lives,
            runtime.parries,
            runtime.phase,
            runtime.targetLanes,
            runtime.tapMisses,
            runtime.streak,
            runtime.multiplier
          );
      }
    }

    runtime.coreGlow = Math.max(0, runtime.coreGlow - dt * 1.8);
    runtime.resonance = Math.max(0, runtime.resonance - dt * 0.35);
    runtime.perfectFlash = Math.max(0, runtime.perfectFlash - dt * 4.8);

    for (const shard of runtime.shards) {
      if (!shard.active) continue;
      shard.life -= dt;
      if (shard.life <= 0) {
        shard.active = false;
        continue;
      }
      shard.x += shard.vx * dt;
      shard.z += shard.vz * dt;
      shard.y += shard.vy * dt;
      shard.vy -= 9.2 * dt;
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 5.4);
    const shakeAmp = runtime.shake * 0.055;
    const shakeTime = runtime.elapsed * 24;
    camTarget.set(
      shakeNoiseSigned(shakeTime, 1.7) * shakeAmp,
      CAMERA_BASE_Y + shakeNoiseSigned(shakeTime, 9.3) * shakeAmp * 0.2,
      0.002 + shakeNoiseSigned(shakeTime, 17.9) * shakeAmp
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-8 * step.renderDt));
    camera.lookAt(0, 0, 0);

    if (bgMaterialRef.current) {
      bgMaterialRef.current.uniforms.uTime.value += dt;
      bgMaterialRef.current.uniforms.uFlash.value = runtime.perfectFlash;
      bgMaterialRef.current.uniforms.uDeep.value.copy(themeDeep);
      bgMaterialRef.current.uniforms.uEdge.value.copy(themeEdge);
    }
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(themeFog);
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(themeFog);
    }
    if (starsMaterialRef.current) {
      starsMaterialRef.current.color.copy(themeStars);
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.color.copy(themeSky);
      hemiLightRef.current.groundColor.copy(themeGround);
    }
    if (keyLightRef.current) {
      keyLightRef.current.color.copy(themeKey);
    }
    if (fillLightRef.current) {
      fillLightRef.current.color.copy(themeFill);
    }
    if (coreMaterialRef.current) {
      coreMaterialRef.current.color.copy(themeCore);
      coreMaterialRef.current.emissive.copy(themeCoreEmissive);
    }
    if (auraMaterialRef.current) {
      auraMaterialRef.current.color.copy(themeAura);
    }
    if (parryZoneMaterialRef.current) {
      parryZoneMaterialRef.current.color.copy(themeZone);
    }
    if (shockMaterialRef.current) {
      shockMaterialRef.current.color.copy(themeShock);
    }

    if (coreRef.current) {
      coreRef.current.position.set(0, 0.02, 0);
      if (coreMaterialRef.current) {
        coreMaterialRef.current.emissiveIntensity = 0.5 + runtime.coreGlow * 0.8 + runtime.perfectCombo * 0.05;
      }
      const coreScale = 1 + runtime.coreGlow * 0.08;
      coreRef.current.scale.setScalar(coreScale);
    }

    if (auraRef.current) {
      const auraScale = 0.8 + runtime.coreGlow * 0.38 + runtime.perfectCombo * 0.02;
      auraRef.current.scale.set(auraScale, auraScale, auraScale);
      if (auraMaterialRef.current) {
        auraMaterialRef.current.opacity = clamp(
          0.24 + runtime.coreGlow * 0.32 + runtime.perfectCombo * 0.014,
          0.2,
          0.8
        );
      }
    }

    if (parryZoneRef.current) {
      const zoneScale = runtime.parryRadius;
      parryZoneRef.current.scale.setScalar(zoneScale);
      if (parryZoneMaterialRef.current) {
        parryZoneMaterialRef.current.opacity = clamp(
          0.18 + runtime.coreGlow * 0.18 + runtime.perfectCombo * 0.01,
          0.16,
          0.48
        );
      }
    }

    if (shockRef.current) {
      const visible = runtime.shockActive;
      const lifeT = runtime.shockDuration > 0 ? clamp(runtime.shockLife / runtime.shockDuration, 0, 1) : 0;
      const pulseT = 1 - lifeT;
      const r = Math.max(0.0001, runtime.shockRadius * (1 + pulseT * 0.1));
      shockRef.current.visible = visible;
      shockRef.current.scale.setScalar(r);
      if (shockMaterialRef.current) {
        shockMaterialRef.current.opacity = clamp(0.88 * lifeT, 0, 0.88);
      }
    }

    if (cursorRef.current) {
      const hasOverlap = runtime.overlapLane >= 0;
      cursorRef.current.visible = hasOverlap;
      cursorRef.current.position.set(
        Math.cos(runtime.cursorAngle) * runtime.parryRadius,
        0.02,
        Math.sin(runtime.cursorAngle) * runtime.parryRadius
      );
      cursorRef.current.rotation.set(Math.PI * 0.5, runtime.cursorAngle, 0);
      const mat = cursorRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = clamp(0.56 + runtime.overlapStrength * 0.34 + runtime.coreGlow * 0.12, 0.4, 0.95);
    }

    for (let i = 0; i < CARDINAL_ANGLES.length; i += 1) {
      const angle = CARDINAL_ANGLES[i];
      const laneActive = laneIsActive(runtime, i);
      const isHot = runtime.overlapLane === i;
      const isLocked = angleDiff(runtime.parryAngle, angle) < 0.08 && runtime.parryWindowLeft > 0;
      const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 5 + i);

      const petal = parryPetalRefs.current[i];
      if (petal) {
        petal.visible = laneActive;
        petal.position.set(
          Math.cos(angle) * runtime.parryRadius,
          0.015,
          Math.sin(angle) * runtime.parryRadius
        );
        petal.rotation.set(-Math.PI * 0.5, runtime.elapsed * 0.5 + i, angle);
        const idleScale = 0.19 + pulse * 0.01;
        const hotScale = 0.235 + runtime.overlapStrength * 0.04;
        const lockedScale = 0.285;
        petal.scale.setScalar(isLocked ? lockedScale : isHot ? hotScale : idleScale);
        const mat = petal.material as THREE.MeshBasicMaterial;
        mat.color.copy(isLocked || isHot ? WHITE : runtime.paletteLaneColors[i % runtime.paletteLaneColors.length]);
        mat.opacity = isLocked ? 0.95 : isHot ? clamp(0.68 + runtime.overlapStrength * 0.25, 0.68, 0.96) : 0.6;
      }

      const rune = runeRefs.current[i];
      if (rune) {
        rune.visible = laneActive;
        const targetAngle = angle;
        const targetRadius = runtime.parryRadius + 0.02;
        rune.position.set(
          Math.cos(targetAngle) * targetRadius,
          0.05,
          Math.sin(targetAngle) * targetRadius
        );
        rune.rotation.set(
          runtime.elapsed * 0.65 + i,
          runtime.elapsed * 0.72 + i * 0.4,
          runtime.elapsed * 0.53
        );
        const runeScale = isLocked
          ? 0.275
          : isHot
            ? 0.24 + runtime.overlapStrength * 0.05
            : 0.21 + pulse * 0.014;
        rune.scale.setScalar(runeScale);
        const mat = rune.material as THREE.MeshBasicMaterial;
        mat.color.copy(
          isLocked ? WHITE : isHot ? WHITE : runtime.paletteLaneColors[i % runtime.paletteLaneColors.length]
        );
        mat.opacity = isLocked
          ? 0.97
          : isHot
            ? clamp(0.74 + runtime.overlapStrength * 0.2, 0.74, 0.95)
            : 0.68 + runtime.resonance * 0.018;
      }

      const laneBeam = laneBeamRefs.current[i];
      if (laneBeam) {
        laneBeam.visible = laneActive;
        const lanePulse = 0.2 + Math.max(0, Math.sin(runtime.elapsed * 3 + i) * 0.1);
        laneBeam.position.set(Math.cos(angle) * runtime.parryRadius * 0.5, 0.005, Math.sin(angle) * runtime.parryRadius * 0.5);
        laneBeam.scale.set(1, Math.max(0.75, runtime.parryRadius / 1.55), 1);
        laneBeam.rotation.set(-Math.PI * 0.5, 0, angle);
        const mat = laneBeam.material as THREE.MeshBasicMaterial;
        mat.color.copy(runtime.paletteLaneColors[i % runtime.paletteLaneColors.length]);
        mat.opacity = (lanePulse + (isLocked ? 0.26 : 0) + (isHot ? runtime.overlapStrength * 0.25 : 0)) * 0.62;
      }
    }

    for (let lane = 0; lane < CARDINAL_ANGLES.length; lane += 1) {
      syncPulseLaneMesh(
        pulseLaneRefs.current[lane],
        lane,
        runtime,
        dummy,
        colorScratch,
        runtime.paletteLaneColors[lane % runtime.paletteLaneColors.length]
      );
    }

    if (sparkRef.current) {
      const sparkIntensity = clamp(runtime.perfectCombo / 10 + runtime.coreGlow * 0.4, 0, 1);
      for (let i = 0; i < SPARK_POOL; i += 1) {
        if (sparkIntensity <= 0.03) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          sparkRef.current.setMatrixAt(i, dummy.matrix);
          sparkRef.current.setColorAt(i, WHITE);
          continue;
        }

        const angle =
          runtime.elapsed * (1.4 + sparkIntensity * 2.3) + i * ((Math.PI * 2) / SPARK_POOL);
        const radius = 0.34 + sparkIntensity * 0.34 + Math.sin(angle * 1.9) * 0.04;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 0.03 + Math.sin(angle * 1.7) * 0.03;
        const s = 0.02 + sparkIntensity * 0.026;

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        sparkRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch
          .copy(runtime.paletteLaneColors[i % runtime.paletteLaneColors.length])
          .lerp(WHITE, clamp(0.2 + sparkIntensity * 0.55, 0, 0.85));
        sparkRef.current.setColorAt(i, colorScratch);
      }

      sparkRef.current.instanceMatrix.needsUpdate = true;
      if (sparkRef.current.instanceColor) sparkRef.current.instanceColor.needsUpdate = true;
    }

    if (shardRef.current) {
      let shardCount = 0;
      for (const shard of runtime.shards) {
        if (!shard.active) continue;
        if (shardCount >= SHARD_POOL) break;
        const lifeT = clamp(shard.life / shard.maxLife, 0, 1);

        dummy.position.set(shard.x, shard.y, shard.z);
        dummy.scale.setScalar(shard.size * lifeT);
        dummy.rotation.set(runtime.elapsed * 1.7, runtime.elapsed * 2.1, runtime.elapsed * 1.3);
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
      bloomRef.current.intensity = lerp(
        0.24,
        0.62,
        clamp(runtime.coreGlow * 0.6 + runtime.perfectCombo * 0.05, 0, 1)
      );
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, CAMERA_BASE_Y, 0.002]} fov={34} near={0.1} far={50} />
      <color attach="background" args={['#102337']} />
      <fog attach="fog" args={['#102337', 11, 34]} />

      <ambientLight intensity={0.66} />
      <hemisphereLight args={['#8aefff', '#22304b', 0.5]} />
      <pointLight position={[0, 3.8, 0]} intensity={0.66} color="#6cffb9" />
      <pointLight position={[0, 1.5, 0]} intensity={0.58} color="#ffd166" />

      <mesh position={[0, -0.72, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[18, 18]} />
        <shaderMaterial
          ref={bgMaterialRef}
          uniforms={{ uTime: { value: 0 }, uFlash: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uFlash;
            varying vec2 vUv;
            void main() {
              vec2 p = vUv * 2.0 - 1.0;
              float r = length(p);
              vec3 deep = vec3(0.04, 0.10, 0.15);
              vec3 edge = vec3(0.16, 0.22, 0.16);
              float halo = smoothstep(1.1, 0.15, r);
              float stars = fract(sin(dot(vUv * (uTime + 1.6), vec2(12.9898, 78.233))) * 43758.5453);
              stars = smoothstep(0.9945, 1.0, stars);
              vec3 col = mix(deep, edge, halo * 0.35);
              col += vec3(stars) * 0.2;
              col += vec3(0.36, 0.42, 0.22) * uFlash * 0.12;
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <points geometry={starsGeometry}>
        <pointsMaterial
          color="#b7ffd2"
          size={0.022}
          sizeAttenuation
          transparent
          opacity={0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {CARDINAL_ANGLES.map((_, lane) => (
        <instancedMesh
          key={`pulse-shape-${lane}`}
          ref={(node) => {
            pulseLaneRefs.current[lane] = node;
          }}
          args={[undefined, undefined, PULSE_POOL]}
        >
          <LaneShapeGeometry lane={lane} />
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.95}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      ))}

      {CARDINAL_ANGLES.map((_, idx) => (
        <mesh
          key={`pulse-lane-${idx}`}
          ref={(node) => {
            laneBeamRefs.current[idx] = node;
          }}
          position={[0, 0.005, 0]}
          rotation={[-Math.PI * 0.5, 0, 0]}
        >
          <planeGeometry args={[0.22, 3.1]} />
          <meshBasicMaterial
            color={PULSE_COLORS[idx % PULSE_COLORS.length]}
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh ref={parryZoneRef} position={[0, 0.012, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.965, 1.0, 96]} />
        <meshBasicMaterial
          color="#a5ffe8"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={shockRef} visible={false} position={[0, 0.02, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.968, 1.0, 96]} />
        <meshBasicMaterial
          color="#f7fcff"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={cursorRef} position={[0, 0.02, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
        <coneGeometry args={[0.14, 0.32, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.84}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {CARDINAL_ANGLES.map((_, idx) => (
        <mesh
          key={`pulse-petal-${idx}`}
          ref={(node) => {
            parryPetalRefs.current[idx] = node;
          }}
          position={[0, 0.015, 0]}
          rotation={[-Math.PI * 0.5, 0, 0]}
        >
          <LaneShapeGeometry lane={idx} />
          <meshBasicMaterial
            color={PULSE_COLORS[idx % PULSE_COLORS.length]}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {CARDINAL_ANGLES.map((_, idx) => (
        <mesh
          key={`pulse-rune-${idx}`}
          ref={(node) => {
            runeRefs.current[idx] = node;
          }}
          position={[0, 0.05, 0]}
          rotation={[Math.PI * 0.5, 0, 0]}
        >
          <LaneShapeGeometry lane={idx} />
          <meshBasicMaterial
            color={PULSE_COLORS[idx % PULSE_COLORS.length]}
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh ref={coreRef} position={[0, 0.02, 0]}>
        <sphereGeometry args={[CORE_FAIL_RADIUS, 24, 24]} />
        <meshStandardMaterial
          color="#f3fbff"
          emissive="#9dffbf"
          emissiveIntensity={0.56}
          roughness={0.2}
          metalness={0.08}
        />
      </mesh>

      <mesh ref={auraRef} position={[0, 0.01, 0]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.9, 1.26, 72]} />
        <meshBasicMaterial
          color="#6fffb2"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARK_POOL]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={shardRef} args={[undefined, undefined, SHARD_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom ref={bloomRef} intensity={0.28} luminanceThreshold={0.68} luminanceSmoothing={0.34} />
        <Vignette eskil={false} offset={0.1} darkness={0.4} />
        <Noise premultiply opacity={0.008} />
      </EffectComposer>

      <Html fullscreen>
        <PulseParryOverlay />
      </Html>
    </>
  );
}

const PulseParry: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <Canvas
      dpr={[1, 1.8]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      className="absolute inset-x-4 bottom-4 top-20 sm:top-16"
      style={{
        touchAction: 'none',
        borderRadius: 14,
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <PulseParryScene />
    </Canvas>
  );
};

export default PulseParry;
export * from './state';
