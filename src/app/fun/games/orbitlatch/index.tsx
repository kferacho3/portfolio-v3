'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
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
import { CUBE_PALETTES } from '../prismjump/constants';
import type { CubePalette } from '../prismjump/types';
import { orbitLatchState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type OrbitMode = 'classic' | 'scattered';

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

type Hazard = {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  radius: number;
  spin: number;
  spinVel: number;
  phase: number;
  drift: number;
  colorIndex: number;
  glow: number;
};

type Runtime = {
  mode: OrbitMode;
  elapsed: number;
  score: number;
  latches: number;
  stars: number;
  timeRemaining: number;
  releaseCount: number;
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
  scatterBandCursor: number;
  scatterBandSize: number;
  nextStarSlot: number;
  nextHazardSlot: number;
  paletteIndex: number;
  startNonceSeen: number;
  cuePulseT: number;
  cuePulseCooldown: number;
  cuePulseSlot: number;

  planets: Planet[];
  starsPool: StarPickup[];
  hazardsPool: Hazard[];
  shards: Shard[];
};

type OrbitStore = {
  status: GameStatus;
  mode: OrbitMode;
  score: number;
  best: number;
  bestByMode: Record<OrbitMode, number>;
  latches: number;
  stars: number;
  timeRemaining: number;
  tightReleases: number;
  multiplier: number;
  latched: boolean;
  failMessage: string;
  tapNonce: number;
  startNonce: number;
  setMode: (mode: OrbitMode) => void;
  requestStart: () => void;
  startRun: (mode?: OrbitMode) => void;
  resetToStart: () => void;
  onTapFx: () => void;
  updateHud: (
    score: number,
    latches: number,
    stars: number,
    timeRemaining: number,
    tightReleases: number,
    multiplier: number,
    latched: boolean
  ) => void;
  endRun: (score: number, reason: string) => void;
};
const ORBIT_MODES = ['classic', 'scattered'] as const satisfies readonly OrbitMode[];
const BEST_KEYS: Record<OrbitMode, string> = {
  classic: 'orbitlatch_hyper_best_classic_v1',
  scattered: 'orbitlatch_hyper_best_scattered_v1',
};
const MODE_KEY = 'orbitlatch_hyper_mode_v1';

const PLANET_POOL = 24;
const STAR_POOL = 42;
const HAZARD_POOL = 30;
const SHARD_POOL = 120;
const TRAIL_POINTS = 54;

const SCATTERED_TIME_LIMIT = 80;
const CLASSIC_MIN_FORWARD_TARGETS = 4;
const SCATTERED_MIN_FORWARD_TARGETS = 6;
const RECYCLE_HIDDEN_MARGIN = 9.8;
const MIN_RESPAWN_LEAD = 10.6;

const FIELD_HALF_X = 4.2;
const SAFE_FALL_BACK = 10.5;
const DRIFT_FAIL_BASE = 5.4;

const LATCH_BASE_DISTANCE = 0.3;
const COLLECT_RADIUS = 0.28;
const PLAYER_RADIUS = 0.12;
const RELATCH_LOOKAHEAD_BASE = 0.12;

const WHITE = new THREE.Color('#fdffff');
const DANGER = new THREE.Color('#ff4d74');

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mod = (value: number, length: number) => ((value % length) + length) % length;

type OrbitVisualPalette = {
  id: string;
  name: string;
  background: THREE.Color;
  fog: THREE.Color;
  ambient: THREE.Color;
  key: THREE.Color;
  fillA: THREE.Color;
  fillB: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  planets: readonly THREE.Color[];
  stars: readonly THREE.Color[];
  hazards: readonly THREE.Color[];
  ringCue: THREE.Color;
  trail: THREE.Color;
  trailGlow: THREE.Color;
  player: THREE.Color;
  playerEmissive: THREE.Color;
  bloomBase: number;
  bloomMax: number;
  vignetteDarkness: number;
};

const shiftHexColor = (
  hex: string,
  hueShift = 0,
  satMul = 1,
  lightMul = 1
) => {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(
    mod(hsl.h + hueShift, 1),
    clamp(hsl.s * satMul, 0, 1),
    clamp(hsl.l * lightMul, 0, 1)
  );
  return color;
};

const buildSwatch = (
  sourceHex: readonly string[],
  count: number,
  options?: { satMul?: number; lightMul?: number; hueJitter?: number }
) => {
  const satMul = options?.satMul ?? 1;
  const lightMul = options?.lightMul ?? 1;
  const hueJitter = options?.hueJitter ?? 0.02;
  const seeds = sourceHex.length > 0 ? sourceHex : ['#7df9ff'];
  const out: THREE.Color[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = seeds[i % seeds.length] ?? seeds[0];
    const wobble = ((i % 5) - 2) * hueJitter;
    const sat = satMul * (0.94 + ((i % 3) - 1) * 0.07);
    const lit = lightMul * (0.92 + ((i % 4) - 1.5) * 0.06);
    const color = shiftHexColor(seed, wobble, sat, lit);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    if (hsl.l < 0.44) {
      color.setHSL(hsl.h, clamp(hsl.s * 0.92, 0, 1), 0.44 + hsl.l * 0.12);
    }
    out.push(color);
  }
  return out;
};

const buildOrbitPalette = (base: CubePalette, index: number): OrbitVisualPalette => {
  const lane = base.laneColors.length > 0 ? base.laneColors : [base.cubeColor, base.playerColor];
  const planets = buildSwatch(
    [
      ...lane,
      base.playerColor,
      base.fillLightA,
      base.fillLightB,
    ],
    14,
    { satMul: 1.08, lightMul: 1.06, hueJitter: 0.022 }
  );
  const stars = buildSwatch(
    [base.cubeColor, base.playerColor, base.fillLightB, '#ffffff'],
    10,
    { satMul: 1.12, lightMul: 1.14, hueJitter: 0.026 }
  );
  const hazards = buildSwatch(
    [base.cubeEmissive, '#ff4d74', '#ff9d5c', base.fillLightB],
    8,
    { satMul: 1.1, lightMul: 0.86, hueJitter: 0.03 }
  );

  return {
    id: base.id,
    name: base.name,
    background: shiftHexColor(base.background, 0.008, 1.05, 0.85),
    fog: shiftHexColor(base.fog, 0.006, 1.04, 0.95),
    ambient: shiftHexColor(base.ambientLight, 0, 0.92, 0.98),
    key: shiftHexColor(base.keyLight, 0, 0.88, 1.04),
    fillA: shiftHexColor(base.fillLightA, 0, 0.98, 1.03),
    fillB: shiftHexColor(base.fillLightB, 0, 1.02, 1.02),
    hemiSky: shiftHexColor(base.fillLightA, 0.01, 0.9, 1.04),
    hemiGround: shiftHexColor(base.waterBottom, 0, 0.88, 0.92),
    planets,
    stars,
    hazards,
    ringCue: shiftHexColor(base.cubeColor, 0.012, 1.12, 1.15),
    trail: shiftHexColor(base.fillLightA, -0.01, 1.06, 1.02),
    trailGlow: shiftHexColor(base.fillLightB, 0.01, 1.1, 1.08),
    player: shiftHexColor(base.playerColor, 0, 0.88, 1.1),
    playerEmissive: shiftHexColor(base.playerEmissive, 0, 1.04, 1.14),
    bloomBase: 0.54 + (index % 4) * 0.03,
    bloomMax: 1.2 + (index % 3) * 0.16,
    vignetteDarkness: 0.22 + (index % 5) * 0.04,
  };
};

const ORBIT_PALETTES: OrbitVisualPalette[] = CUBE_PALETTES.map(buildOrbitPalette);

const getRuntimePalette = (runtime: Pick<Runtime, 'paletteIndex'>) =>
  ORBIT_PALETTES[mod(runtime.paletteIndex, ORBIT_PALETTES.length)] ?? ORBIT_PALETTES[0];

const getPaletteColor = (colors: readonly THREE.Color[], index: number) =>
  colors[mod(index, colors.length)] ?? WHITE;

const distanceToSegmentSq = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 1e-7) {
    const dx = px - x1;
    const dy = py - y1;
    return dx * dx + dy * dy;
  }
  const t = clamp(((px - x1) * vx + (py - y1) * vy) / lenSq, 0, 1);
  const sx = x1 + vx * t;
  const sy = y1 + vy * t;
  const dx = px - sx;
  const dy = py - sy;
  return dx * dx + dy * dy;
};

let audioContextRef: AudioContext | null = null;
let lastToneAt = 0;

const readMode = (): OrbitMode => {
  if (typeof window === 'undefined') return 'classic';
  const raw = window.localStorage.getItem(MODE_KEY);
  return ORBIT_MODES.includes(raw as OrbitMode) ? (raw as OrbitMode) : 'classic';
};

const writeMode = (mode: OrbitMode) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MODE_KEY, mode);
};

const readBest = (mode: OrbitMode) => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_KEYS[mode]);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const writeBest = (mode: OrbitMode, score: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_KEYS[mode], String(Math.max(0, Math.floor(score))));
};

const maybeVibrate = (ms: number) => {
  if (typeof navigator === 'undefined') return;
  if ('vibrate' in navigator) navigator.vibrate(ms);
};

const playTone = (freq: number, duration = 0.05, volume = 0.03) => {
  if (typeof window === 'undefined') return;
  const now = performance.now();
  if (now - lastToneAt < 34) return;
  lastToneAt = now;
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
  colorIndex: slot % 12,
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
  colorIndex: slot % 8,
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

const makeHazard = (slot: number): Hazard => ({
  slot,
  active: false,
  x: 0,
  y: 0,
  radius: 0.2,
  spin: Math.random() * Math.PI * 2,
  spinVel: 1.1 + Math.random() * 1.8,
  phase: Math.random() * Math.PI * 2,
  drift: 0.1 + Math.random() * 0.28,
  colorIndex: slot % 6,
  glow: 0,
});

const createRuntime = (): Runtime => ({
  mode: 'classic',
  elapsed: 0,
  score: 0,
  latches: 0,
  stars: 0,
  timeRemaining: 0,
  releaseCount: 0,
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
  scatterBandCursor: 0,
  scatterBandSize: 0,
  nextStarSlot: 0,
  nextHazardSlot: 0,
  paletteIndex: 0,
  startNonceSeen: 0,
  cuePulseT: 0,
  cuePulseCooldown: 0,
  cuePulseSlot: -1,

  planets: Array.from({ length: PLANET_POOL }, (_, idx) => makePlanet(idx)),
  starsPool: Array.from({ length: STAR_POOL }, (_, idx) => makeStar(idx)),
  hazardsPool: Array.from({ length: HAZARD_POOL }, (_, idx) => makeHazard(idx)),
  shards: Array.from({ length: SHARD_POOL }, (_, idx) => makeShard(idx)),
});

const initialMode = readMode();
const initialBestByMode: Record<OrbitMode, number> = {
  classic: readBest('classic'),
  scattered: readBest('scattered'),
};

const useOrbitStore = create<OrbitStore>((set, get) => ({
  status: 'START',
  mode: initialMode,
  score: 0,
  best: initialBestByMode[initialMode],
  bestByMode: initialBestByMode,
  latches: 0,
  stars: 0,
  timeRemaining: initialMode === 'scattered' ? SCATTERED_TIME_LIMIT : 0,
  tightReleases: 0,
  multiplier: 1,
  latched: false,
  failMessage: '',
  tapNonce: 0,
  startNonce: 0,
  setMode: (mode) =>
    set((state) => {
      if (state.mode === mode) return {};
      writeMode(mode);
      return {
        mode,
        best: state.bestByMode[mode],
        timeRemaining: mode === 'scattered' ? SCATTERED_TIME_LIMIT : 0,
      };
    }),
  requestStart: () => set((state) => ({ startNonce: state.startNonce + 1 })),
  startRun: (mode) => {
    const nextMode = mode ?? get().mode;
    writeMode(nextMode);
    set((state) => ({
      status: 'PLAYING',
      mode: nextMode,
      best: state.bestByMode[nextMode],
      score: 0,
      latches: 0,
      stars: 0,
      tightReleases: 0,
      timeRemaining: nextMode === 'scattered' ? SCATTERED_TIME_LIMIT : 0,
      multiplier: 1,
      latched: true,
      failMessage: '',
    }));
  },
  resetToStart: () =>
    set((state) => ({
      status: 'START',
      score: 0,
      latches: 0,
      stars: 0,
      tightReleases: 0,
      timeRemaining: state.mode === 'scattered' ? SCATTERED_TIME_LIMIT : 0,
      multiplier: 1,
      latched: false,
      failMessage: '',
      best: state.bestByMode[state.mode],
    })),
  onTapFx: () => set((state) => ({ tapNonce: state.tapNonce + 1 })),
  updateHud: (score, latches, stars, timeRemaining, tightReleases, multiplier, latched) =>
    set({
      score: Math.floor(score),
      latches,
      stars,
      timeRemaining,
      tightReleases,
      multiplier,
      latched,
    }),
  endRun: (score, reason) =>
    set((state) => {
      const scoreInt = Math.floor(score);
      const modeBest = state.bestByMode[state.mode];
      const nextBest = Math.max(modeBest, scoreInt);
      const nextByMode = { ...state.bestByMode, [state.mode]: nextBest };
      if (nextBest > modeBest) writeBest(state.mode, nextBest);
      return {
        status: 'GAMEOVER',
        score: scoreInt,
        best: nextBest,
        bestByMode: nextByMode,
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
    Math.round(
      runtime.currentChunk.durationSeconds *
        (1.55 + runtime.difficulty.eventRate * 1.35) *
        (runtime.mode === 'scattered' ? 1.24 : 1)
    )
  );
};

const nextSpacing = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
  if (runtime.mode === 'scattered') {
    return clamp(
      lerp(2.15, 1.45, d) + (3 - tier) * 0.09 + (runtime.elapsed < 12 ? 0.18 : 0) + Math.random() * 0.24,
      1.05,
      2.45
    );
  }
  const earlySlow = runtime.elapsed < 12 ? 0.55 : runtime.elapsed < 22 ? 0.3 : 0;
  return clamp(lerp(3.4, 2.1, d) + (3 - tier) * 0.12 + earlySlow + Math.random() * 0.32, 1.9, 4.25);
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

const acquireHazard = (runtime: Runtime) => {
  for (let i = 0; i < runtime.hazardsPool.length; i += 1) {
    const idx = (runtime.nextHazardSlot + i) % runtime.hazardsPool.length;
    const hazard = runtime.hazardsPool[idx];
    if (!hazard.active) {
      runtime.nextHazardSlot = (idx + 1) % runtime.hazardsPool.length;
      return hazard;
    }
  }
  const fallback = runtime.hazardsPool[runtime.nextHazardSlot];
  runtime.nextHazardSlot = (runtime.nextHazardSlot + 1) % runtime.hazardsPool.length;
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
  const palette = getRuntimePalette(runtime);
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
  star.colorIndex =
    (Math.floor(Math.random() * palette.stars.length) + tier) %
    Math.max(1, palette.stars.length);
  star.glow = 0;
};

const spawnHazardBetween = (
  runtime: Runtime,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tier: number
) => {
  const palette = getRuntimePalette(runtime);
  if (runtime.mode !== 'scattered') return;
  const chance = clamp(0.26 + tier * 0.08 + runtime.elapsed * 0.0015, 0.24, 0.58);
  if (Math.random() > chance) return;

  const hazard = acquireHazard(runtime);
  const t = 0.4 + Math.random() * 0.28;
  const mx = lerp(fromX, toX, t);
  const my = lerp(fromY, toY, t);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const side = Math.random() < 0.5 ? -1 : 1;
  const offset = side * (0.78 + Math.random() * 0.52);

  hazard.active = true;
  hazard.x = clamp(mx + px * offset, -FIELD_HALF_X + 0.54, FIELD_HALF_X - 0.54);
  hazard.y = my + py * offset * 0.28;
  hazard.radius = 0.16 + Math.random() * 0.12;
  hazard.spin = Math.random() * Math.PI * 2;
  hazard.spinVel = 1.1 + Math.random() * 2.3;
  hazard.phase = Math.random() * Math.PI * 2;
  hazard.drift = 0.08 + Math.random() * 0.26;
  hazard.colorIndex = Math.floor(Math.random() * Math.max(1, palette.hazards.length));
  hazard.glow = 0;
};

const seedPlanet = (runtime: Runtime, planet: Planet, initial: boolean) => {
  const palette = getRuntimePalette(runtime);
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
    runtime.scatterBandCursor = 0;
    runtime.scatterBandSize = 0;
  } else if (runtime.mode === 'scattered') {
    if (runtime.scatterBandCursor <= 0) {
      runtime.spawnCursorY += nextSpacing(runtime, tier);
      runtime.scatterBandSize = 2 + (Math.random() < 0.38 ? 1 : 0);
      runtime.scatterBandCursor = runtime.scatterBandSize;
    }
    const bandIndex = runtime.scatterBandSize - runtime.scatterBandCursor;
    const bandStep = lerp(0.54, 0.38, d);
    const laneSpread = FIELD_HALF_X - 0.7;
    const laneT = runtime.scatterBandSize <= 1 ? 0.5 : bandIndex / (runtime.scatterBandSize - 1);
    nextX = clamp(
      lerp(-laneSpread, laneSpread, laneT) + (Math.random() * 2 - 1) * 0.42,
      -FIELD_HALF_X + 0.62,
      FIELD_HALF_X - 0.62
    );
    nextY =
      runtime.spawnCursorY +
      bandIndex * bandStep +
      (Math.random() * 2 - 1) * (0.14 + tier * 0.015);
    runtime.scatterBandCursor -= 1;
    if (runtime.scatterBandCursor <= 0) {
      runtime.spawnCursorY +=
        runtime.scatterBandSize * bandStep + 0.32 + Math.random() * 0.28;
    }
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

  if (!initial) {
    nextY = Math.max(nextY, runtime.playerY + MIN_RESPAWN_LEAD + Math.random() * 1.15);
  }

  const radius =
    runtime.mode === 'scattered'
      ? clamp(lerp(0.46, 0.66, d) + (Math.random() * 2 - 1) * 0.07, 0.4, 0.78)
      : clamp(lerp(0.52, 0.8, d) + (Math.random() * 2 - 1) * 0.08, 0.45, 0.9);
  const orbitRadius = clamp(
    radius +
      (runtime.mode === 'scattered' ? lerp(0.84, 0.6, d) : lerp(0.95, 0.72, d)) +
      (Math.random() * 2 - 1) * 0.12 -
      tier * 0.02,
    radius + 0.48,
    runtime.mode === 'scattered' ? radius + 1.08 : radius + 1.25
  );
  const orbitAngularVelSign =
    runtime.mode === 'scattered' ? (Math.random() < 0.5 ? -1 : 1) : runtime.nextOrbitDirection >= 0 ? 1 : -1;
  if (runtime.mode !== 'scattered') runtime.nextOrbitDirection *= -1;
  const orbitAngularVel =
    orbitAngularVelSign *
    clamp(
      (runtime.mode === 'scattered' ? lerp(1.45, 3.1, d) : lerp(1.3, 2.75, d)) + tier * 0.08 + Math.random() * 0.24,
      runtime.mode === 'scattered' ? 1.2 : 1.1,
      runtime.mode === 'scattered' ? 3.9 : 3.4
    );

  planet.x = nextX;
  planet.y = nextY;
  planet.radius = radius;
  planet.orbitRadius = orbitRadius;
  planet.orbitAngularVel = orbitAngularVel;
  planet.colorIndex = Math.floor(Math.random() * Math.max(1, palette.planets.length));
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
    spawnHazardBetween(runtime, runtime.lastSpawnX, runtime.lastSpawnY, nextX, nextY, tier);
  }

  runtime.spawnCursorY = Math.max(runtime.spawnCursorY, nextY);
  runtime.lastSpawnX = nextX;
  runtime.lastSpawnY = nextY;
};

const findNearestAheadPlanet = (runtime: Runtime, fromX: number, fromY: number, excludeSlot?: number) => {
  let bestPlanet: Planet | null = null;
  let bestScore = Infinity;
  for (const planet of runtime.planets) {
    if (excludeSlot !== undefined && planet.slot === excludeSlot) continue;
    const dy = planet.y - fromY;
    if (dy <= 0) continue;
    const dx = planet.x - fromX;
    const score = dy + Math.abs(dx) * 0.75;
    if (score < bestScore) {
      bestScore = score;
      bestPlanet = planet;
    }
  }
  return bestPlanet;
};

const ensureForwardTargets = (runtime: Runtime) => {
  const minTargets = runtime.mode === 'scattered' ? SCATTERED_MIN_FORWARD_TARGETS : CLASSIC_MIN_FORWARD_TARGETS;
  let ahead = 0;
  let furthestY = runtime.playerY;
  let furthestX = runtime.playerX;
  for (const planet of runtime.planets) {
    if (planet.y > furthestY) {
      furthestY = planet.y;
      furthestX = planet.x;
    }
    if (planet.y > runtime.playerY + 0.45) ahead += 1;
  }
  if (ahead >= minTargets) return;

  let needed = minTargets - ahead;
  const recycle = runtime.planets
    .filter(
      (planet) =>
        planet.y <= runtime.playerY - RECYCLE_HIDDEN_MARGIN &&
        (!runtime.latched || planet.slot !== runtime.latchedPlanet)
    )
    .sort((a, b) => a.y - b.y);
  if (recycle.length === 0) return;
  let anchorY = furthestY;
  let anchorX = furthestX;

  for (const planet of recycle) {
    if (needed <= 0) break;
    runtime.spawnCursorY = Math.max(runtime.spawnCursorY, anchorY - 0.12);
    seedPlanet(runtime, planet, false);
    const minYStep = runtime.mode === 'scattered' ? 0.56 : 0.86;
    const yJitter = runtime.mode === 'scattered' ? 0.34 : 0.52;
    const minSafeRespawnY = runtime.playerY + MIN_RESPAWN_LEAD + 1.6 + Math.random() * 1.9;
    const targetY = Math.max(anchorY + minYStep + Math.random() * yJitter, minSafeRespawnY);
    if (planet.y <= targetY) planet.y = targetY;
    const minXStep = runtime.mode === 'scattered' ? 0.42 : 0.62;
    if (Math.abs(planet.x - anchorX) < minXStep) {
      planet.x = clamp(
        planet.x + (Math.random() < 0.5 ? -1 : 1) * (minXStep + Math.random() * 0.35),
        -FIELD_HALF_X + 0.62,
        FIELD_HALF_X - 0.62
      );
    }
    anchorY = planet.y;
    anchorX = planet.x;
    needed -= 1;
  }
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
  const mode = useOrbitStore((state) => state.mode);
  const setMode = useOrbitStore((state) => state.setMode);
  const score = useOrbitStore((state) => state.score);
  const best = useOrbitStore((state) => state.best);
  const latches = useOrbitStore((state) => state.latches);
  const stars = useOrbitStore((state) => state.stars);
  const timeRemaining = useOrbitStore((state) => state.timeRemaining);
  const tightReleases = useOrbitStore((state) => state.tightReleases);
  const multiplier = useOrbitStore((state) => state.multiplier);
  const latched = useOrbitStore((state) => state.latched);
  const failMessage = useOrbitStore((state) => state.failMessage);
  const requestStart = useOrbitStore((state) => state.requestStart);
  const timerText = `${Math.max(0, timeRemaining).toFixed(1)}s`;

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/55 bg-gradient-to-br from-cyan-500/22 via-sky-500/18 to-fuchsia-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Orbit Latch</div>
        <div className="text-[11px] text-cyan-50/85">Tap to latch near orbit rings. Tap again to slingshot.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-fuchsia-100/50 bg-gradient-to-br from-fuchsia-500/22 via-cyan-500/16 to-amber-500/20 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-cyan-100/35 bg-gradient-to-br from-slate-950/78 via-cyan-900/30 to-fuchsia-900/22 px-3 py-2 text-xs">
          <div>
            Mode{' '}
            <span className="font-semibold uppercase tracking-[0.12em] text-sky-200">
              {mode === 'classic' ? 'Classic' : 'Scattered'}
            </span>
          </div>
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
          {mode === 'scattered' && (
            <div>
              Time <span className="font-semibold text-rose-200">{timerText}</span>
            </div>
          )}
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-cyan-100/42 bg-gradient-to-br from-slate-950/85 via-indigo-950/45 to-fuchsia-950/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide text-transparent bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text">
              ORBIT LATCH
            </div>
            <div className="mt-2 text-sm text-white/88">Tap to latch when crossing an orbit ring.</div>
            <div className="mt-1 text-sm text-white/82">
              Tap again to release and steer into your next orbit.
            </div>
            <div className="pointer-events-auto mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setMode('classic');
                }}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  mode === 'classic'
                    ? 'border-cyan-100/80 bg-cyan-400/22'
                    : 'border-white/20 bg-white/5 hover:border-cyan-100/50'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Classic</div>
                <div className="mt-1 text-[11px] text-white/75">Endless vertical chain with clean rhythm.</div>
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setMode('scattered');
                }}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  mode === 'scattered'
                    ? 'border-fuchsia-100/80 bg-fuchsia-400/22'
                    : 'border-white/20 bg-white/5 hover:border-fuchsia-100/50'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-100">Scattered</div>
                <div className="mt-1 text-[11px] text-white/75">Dense orbit fields, hazards, and a timer.</div>
              </button>
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">
              Latch when the orbit cue blooms. Release to slingshot.
            </div>
            <div className="pointer-events-auto mt-4 flex items-center justify-center">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  requestStart();
                }}
                className="rounded-lg border border-cyan-100/80 bg-gradient-to-r from-cyan-400/35 via-sky-400/28 to-fuchsia-400/28 px-5 py-2 text-sm font-bold tracking-[0.12em] text-cyan-50 shadow-[0_0_26px_rgba(56,219,255,0.35)] transition hover:brightness-110"
              >
                START RUN
              </button>
            </div>
            <div className="mt-2 text-[11px] text-white/70">Tap, Space, or Enter to launch</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/45 to-indigo-950/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">
              {mode === 'scattered' ? 'Window Closed' : 'Orbit Lost'}
            </div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">
              Best {best} • {mode === 'classic' ? 'Classic' : 'Scattered'}
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap instantly to retry.</div>
            <div className="pointer-events-auto mt-3 flex items-center justify-center">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  requestStart();
                }}
                className="rounded-md border border-cyan-100/80 bg-cyan-400/24 px-4 py-2 text-xs font-bold tracking-[0.12em] text-cyan-100 transition hover:brightness-110"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function OrbitLatchScene({
  impactOverlayRef,
}: {
  impactOverlayRef: React.RefObject<HTMLDivElement | null>;
}) {
  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter'],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const planetRef = useRef<THREE.InstancedMesh>(null);
  const planetGlowRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const starRef = useRef<THREE.InstancedMesh>(null);
  const hazardRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const satRef = useRef<THREE.Mesh>(null);
  const latchSparkRef = useRef<THREE.Mesh>(null);
  const latchCuePulseRef = useRef<THREE.Mesh>(null);
  const latchCuePulseRefSecondary = useRef<THREE.Mesh>(null);
  const bloomRef = useRef<any>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const fillLightARef = useRef<THREE.PointLight>(null);
  const fillLightBRef = useRef<THREE.PointLight>(null);
  const fillLightCRef = useRef<THREE.PointLight>(null);
  const planetMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const planetGlowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const starMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const hazardMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const satMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const latchSparkMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const latchCuePulseMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const latchCuePulseSecondaryMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const shardMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const fixedStepRef = useRef(createFixedStepState());
  const paletteAppliedRef = useRef<number>(-1);

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
    () =>
      new THREE.LineBasicMaterial({
        color: '#7df9ff',
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );
  const trailObject = useMemo(
    () => new THREE.Line(trailGeometry, trailMaterial),
    [trailGeometry, trailMaterial]
  );

  const { camera, scene } = useThree();

  const resetRuntime = (runtime: Runtime, mode: OrbitMode) => {
    const previousPalette = runtime.paletteIndex;
    let nextPalette = Math.floor(Math.random() * ORBIT_PALETTES.length);
    if (ORBIT_PALETTES.length > 1 && nextPalette === previousPalette) {
      nextPalette = (nextPalette + 1) % ORBIT_PALETTES.length;
    }

    runtime.mode = mode;
    runtime.paletteIndex = nextPalette;
    paletteAppliedRef.current = -1;
    runtime.elapsed = 0;
    runtime.score = 0;
    runtime.latches = 0;
    runtime.stars = 0;
    runtime.timeRemaining = mode === 'scattered' ? SCATTERED_TIME_LIMIT : 0;
    runtime.releaseCount = 0;
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
    runtime.scatterBandCursor = 0;
    runtime.scatterBandSize = 0;
    runtime.nextStarSlot = 0;
    runtime.nextHazardSlot = 0;
    runtime.cuePulseT = 0;
    runtime.cuePulseCooldown = 0;
    runtime.cuePulseSlot = -1;

    for (const star of runtime.starsPool) {
      star.active = false;
      star.glow = 0;
    }
    for (const hazard of runtime.hazardsPool) {
      hazard.active = false;
      hazard.glow = 0;
    }
    for (const shard of runtime.shards) {
      shard.active = false;
      shard.life = 0;
    }

    for (let i = 0; i < runtime.planets.length; i += 1) {
      seedPlanet(runtime, runtime.planets[i], i < (mode === 'scattered' ? 6 : 2));
    }
    for (let i = 0; i < runtime.planets.length; i += 1) {
      if (mode === 'scattered') continue;
      if (i >= 2 && runtime.planets[i].y <= runtime.planets[i - 1].y + 0.4) {
        runtime.planets[i].y = runtime.planets[i - 1].y + nextSpacing(runtime, 0);
      }
    }

    runtime.latchedPlanet = runtime.planets[0].slot;
    runtime.orbitRadius = runtime.planets[0].orbitRadius;
    runtime.orbitAngularVel = runtime.planets[0].orbitAngularVel;
    runtime.orbitAngle = mode === 'scattered' ? Math.PI * 0.16 : Math.PI * 0.2;
    runtime.playerX = runtime.planets[0].x + Math.cos(runtime.orbitAngle) * runtime.orbitRadius;
    runtime.playerY = runtime.planets[0].y + Math.sin(runtime.orbitAngle) * runtime.orbitRadius;
    runtime.maxYReached = runtime.playerY;
    ensureForwardTargets(runtime);

    const world = simToWorld(runtime.playerX, runtime.playerY, trailWorld);
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const ptr = i * 3;
      trailPositions[ptr] = world.x;
      trailPositions[ptr + 1] = 0.02;
      trailPositions[ptr + 2] = world.z;
    }
  };

  useEffect(() => {
    const initial = useOrbitStore.getState().mode;
    resetRuntime(runtimeRef.current, initial);
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
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = useOrbitStore.getState();
    const palette = getRuntimePalette(runtime);
    let status = store.status;

    try {

    if (paletteAppliedRef.current !== runtime.paletteIndex) {
      paletteAppliedRef.current = runtime.paletteIndex;
      scene.background = palette.background.clone();
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(palette.fog);
        scene.fog.near = 18;
        scene.fog.far = runtime.mode === 'scattered' ? 132 : 144;
      } else {
        scene.fog = new THREE.Fog(
          palette.fog.clone(),
          18,
          runtime.mode === 'scattered' ? 132 : 144
        );
      }

      ambientLightRef.current?.color.copy(palette.ambient);
      directionalLightRef.current?.color.copy(palette.key);
      hemiLightRef.current?.color.copy(palette.hemiSky);
      if (hemiLightRef.current) hemiLightRef.current.groundColor.copy(palette.hemiGround);
      fillLightARef.current?.color.copy(palette.fillA);
      fillLightBRef.current?.color.copy(palette.fillB);
      fillLightCRef.current?.color.copy(palette.ringCue);

      if (planetMaterialRef.current) {
        planetMaterialRef.current.emissive.copy(palette.hemiGround).multiplyScalar(0.7);
      }
      if (hazardMaterialRef.current) {
        hazardMaterialRef.current.emissive.copy(palette.hazards[0] ?? DANGER).multiplyScalar(0.45);
      }
      if (satMaterialRef.current) {
        satMaterialRef.current.color.copy(palette.player);
        satMaterialRef.current.emissive.copy(palette.playerEmissive);
      }
      if (latchSparkMaterialRef.current) {
        latchSparkMaterialRef.current.color.copy(palette.ringCue);
      }
      if (latchCuePulseMaterialRef.current) {
        latchCuePulseMaterialRef.current.color.copy(palette.ringCue);
      }
      if (latchCuePulseSecondaryMaterialRef.current) {
        latchCuePulseSecondaryMaterialRef.current.color.copy(palette.trailGlow);
      }
      trailMaterial.color.copy(palette.trail);
      if (impactOverlayRef.current) {
        const c0 = `#${palette.trailGlow.getHexString()}`;
        const c1 = `#${palette.ringCue.getHexString()}`;
        const c2 = `#${palette.hemiGround.getHexString()}`;
        impactOverlayRef.current.style.background = `radial-gradient(circle at center, ${c0}88, ${c1}66, ${c2}00)`;
      }
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.far = runtime.mode === 'scattered' ? 132 : 144;
    }
    if (fillLightARef.current) {
      fillLightARef.current.intensity = lerp(1.0, 1.5, clamp(runtime.coreGlow * 0.7, 0, 1));
    }
    if (fillLightBRef.current) {
      fillLightBRef.current.intensity = lerp(0.85, 1.2, clamp(runtime.latchFlash * 0.8 + runtime.coreGlow * 0.2, 0, 1));
    }
    if (fillLightCRef.current) {
      fillLightCRef.current.intensity = lerp(0.72, 1.04, clamp(runtime.impactFlash * 0.7 + runtime.coreGlow * 0.2, 0, 1));
    }

    let startedFromOverlay = false;
    if (store.startNonce !== runtime.startNonceSeen && store.status !== 'PLAYING') {
      runtime.startNonceSeen = store.startNonce;
      resetRuntime(runtime, store.mode);
      useOrbitStore.getState().startRun(store.mode);
      status = 'PLAYING';
      startedFromOverlay = true;
    }

    const rawTap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar') ||
      input.justPressed.has('enter');
    const tap = rawTap && !startedFromOverlay;

    if (tap) {
      runtime.lastTapAt = runtime.elapsed;
      if (status !== 'PLAYING') {
        resetRuntime(runtime, store.mode);
        useOrbitStore.getState().startRun(store.mode);
      } else if (runtime.latched) {
        const planet = runtime.planets.find((p) => p.slot === runtime.latchedPlanet);
        if (planet) {
          const sign = runtime.orbitAngularVel >= 0 ? 1 : -1;
          const tangentX = -Math.sin(runtime.orbitAngle) * sign;
          const tangentY = Math.cos(runtime.orbitAngle) * sign;
          const radialX = Math.cos(runtime.orbitAngle);
          const radialY = Math.sin(runtime.orbitAngle);
          const orbitalLinear = Math.abs(runtime.orbitAngularVel) * runtime.orbitRadius;
          const launchScale = 0.98 + clamp(runtime.coreGlow * 0.05, 0, 0.08);
          runtime.velX = tangentX * orbitalLinear * launchScale + radialX * 0.14;
          runtime.velY = tangentY * orbitalLinear * launchScale + radialY * 0.14 + 0.24;

          runtime.releaseCount += 1;
          ensureForwardTargets(runtime);
          if (runtime.releaseCount === 1) {
            runtime.velY = Math.max(runtime.velY, runtime.mode === 'scattered' ? 0.78 : 0.9);
            runtime.velX *= 0.97;
            runtime.velX = clamp(runtime.velX, -2.4, 2.4);
          }
          runtime.velY = Math.max(runtime.velY, runtime.mode === 'scattered' ? 0.46 : 0.38);
          runtime.latched = false;
          runtime.driftTimer = runtime.releaseCount === 1 ? -0.18 : 0;
          runtime.cuePulseT = Math.max(runtime.cuePulseT, 0.48);
          runtime.cuePulseCooldown = 0.1;
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
            spawnBurst(
              runtime,
              runtime.playerX,
              runtime.playerY,
              getPaletteColor(palette.stars, 0),
              7,
              2.4
            );
          }
        }
      } else {
        const dNorm = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
        const speed = Math.hypot(runtime.velX, runtime.velY);
        const speedAssist = clamp(speed * 0.07, 0, runtime.mode === 'scattered' ? 0.14 : 0.12);
        const modeAssist = runtime.mode === 'scattered' ? 0.03 : 0.02;
        const lookAhead = clamp(
          RELATCH_LOOKAHEAD_BASE + speedAssist * 0.44 + modeAssist * 0.26,
          RELATCH_LOOKAHEAD_BASE,
          runtime.mode === 'scattered' ? 0.32 : 0.28
        );
        const predictX = runtime.playerX + runtime.velX * lookAhead;
        const predictY = runtime.playerY + runtime.velY * lookAhead;
        const latchDistance = clamp(
          LATCH_BASE_DISTANCE - 0.01 + speedAssist - dNorm * 0.05 + modeAssist,
          0.24,
          runtime.mode === 'scattered' ? 0.52 : 0.46
        );
        let nextPlanet: Planet | null = null;
        let nextDelta = Infinity;
        let nextScore = Infinity;
        const vx = runtime.velX;
        const vy = runtime.velY;
        const vLen = Math.hypot(vx, vy) || 1;
        for (const planet of runtime.planets) {
          const toX = planet.x - runtime.playerX;
          const toY = planet.y - runtime.playerY;
          if (toY < -0.75) continue;

          const forward = (toX * vx + toY * vy) / vLen;
          if (forward < -0.45) continue;

          const dist = Math.hypot(runtime.playerX - planet.x, runtime.playerY - planet.y);
          const predictDist = Math.hypot(predictX - planet.x, predictY - planet.y);
          const deltaRing = Math.min(
            Math.abs(dist - planet.orbitRadius),
            Math.abs(predictDist - planet.orbitRadius)
          );
          const score =
            deltaRing * 1.7 +
            Math.max(0, -forward) * 0.8 +
            Math.max(0, -toY) * 0.35 +
            Math.abs(toX) * 0.08;

          if (score < nextScore) {
            nextScore = score;
            nextDelta = deltaRing;
            nextPlanet = planet;
          }
        }
        if (nextPlanet) {
          if (nextDelta > latchDistance) {
            runtime.streak = 0;
            runtime.multiplier = Math.max(1, runtime.multiplier - 0.06);
          } else {
            runtime.latched = true;
            runtime.latchedPlanet = nextPlanet.slot;
            runtime.orbitRadius = nextPlanet.orbitRadius;
            runtime.orbitAngularVel = nextPlanet.orbitAngularVel;
            runtime.orbitAngle = Math.atan2(
              runtime.playerY - nextPlanet.y,
              runtime.playerX - nextPlanet.x
            );
            runtime.playerX = nextPlanet.x + Math.cos(runtime.orbitAngle) * runtime.orbitRadius;
            runtime.playerY = nextPlanet.y + Math.sin(runtime.orbitAngle) * runtime.orbitRadius;
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
            runtime.cuePulseT = 0;
            runtime.cuePulseCooldown = 0.12;
            runtime.cuePulseSlot = nextPlanet.slot;

            nextPlanet.glow = 1.2;
            spawnBurst(
              runtime,
              runtime.playerX,
              runtime.playerY,
              getPaletteColor(palette.planets, nextPlanet.colorIndex),
              8,
              2.2
            );
            maybeVibrate(10);
            playTone(760, 0.05, 0.03);
            useOrbitStore.getState().onTapFx();
          }
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

    if (status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.difficulty = sampleDifficulty('orbit-chain', runtime.elapsed);
      let segmentStartX = runtime.playerX;
      let segmentStartY = runtime.playerY;
      if (runtime.mode === 'scattered') {
        runtime.timeRemaining = Math.max(0, runtime.timeRemaining - dt);
        if (runtime.timeRemaining <= 0) {
          failRun('Time limit reached before extraction.', getPaletteColor(palette.stars, 2));
        }
      }

      const d = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
      const gravityScale = lerp(0.34, 0.68, d) * (runtime.mode === 'scattered' ? 1.12 : 1);
      const driftFail =
        runtime.mode === 'scattered' ? lerp(DRIFT_FAIL_BASE - 1.1, 3.5, d) : lerp(DRIFT_FAIL_BASE, 3.9, d);

      for (const planet of runtime.planets) {
        planet.glow = Math.max(0, planet.glow - dt * 2.2);
      }

      if (runtime.latched) {
        const planet = runtime.planets.find((p) => p.slot === runtime.latchedPlanet);
        if (!planet) {
          failRun('Orbit source collapsed.');
        } else {
          segmentStartX = runtime.playerX;
          segmentStartY = runtime.playerY;
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

        runtime.velX *= 1 - dt * 0.06;
        runtime.velY *= 1 - dt * 0.045;
        const prevX = runtime.playerX;
        const prevY = runtime.playerY;
        segmentStartX = prevX;
        segmentStartY = prevY;
        runtime.playerX += runtime.velX * dt;
        runtime.playerY += runtime.velY * dt;

        if (
          !Number.isFinite(runtime.playerX) ||
          !Number.isFinite(runtime.playerY) ||
          !Number.isFinite(runtime.velX) ||
          !Number.isFinite(runtime.velY)
        ) {
          failRun('Signal solver destabilized.', DANGER);
          runtime.playerX = 0;
          runtime.playerY = 0;
          runtime.velX = 0;
          runtime.velY = 0;
        }

        let impactedCore = false;
        for (const planet of runtime.planets) {
          if (runtime.latched && planet.slot === runtime.latchedPlanet) continue;
          const hitRadius = planet.radius + PLAYER_RADIUS * 0.82;
          const hitRadiusSq = hitRadius * hitRadius;
          const segDistSq = distanceToSegmentSq(
            planet.x,
            planet.y,
            prevX,
            prevY,
            runtime.playerX,
            runtime.playerY
          );
          if (segDistSq <= hitRadiusSq) {
            impactedCore = true;
            break;
          }
        }

        if (impactedCore || (nearest && nearestDistSq < (nearest.radius + PLAYER_RADIUS) * (nearest.radius + PLAYER_RADIUS))) {
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
        const segDistSq = distanceToSegmentSq(
          star.x,
          star.y,
          segmentStartX,
          segmentStartY,
          runtime.playerX,
          runtime.playerY
        );
        if (dx * dx + dy * dy <= COLLECT_RADIUS * COLLECT_RADIUS || segDistSq <= COLLECT_RADIUS * COLLECT_RADIUS) {
          star.active = false;
          runtime.stars += star.value;
          runtime.score += star.value * 1.25;
          runtime.coreGlow = Math.min(1.55, runtime.coreGlow + 0.2);
          spawnBurst(
            runtime,
            star.x,
            star.y,
            getPaletteColor(palette.stars, star.colorIndex),
            7,
            2.1
          );
          playTone(980, 0.045, 0.022);
        } else if (star.y < runtime.playerY - 9) {
          star.active = false;
        }
      }

      for (const hazard of runtime.hazardsPool) {
        if (!hazard.active) continue;
        hazard.spin += dt * hazard.spinVel;
        hazard.glow = Math.max(0, hazard.glow - dt * 2.4);
        hazard.x += Math.sin(runtime.elapsed * 1.35 + hazard.phase) * hazard.drift * dt;
        hazard.x = clamp(hazard.x, -FIELD_HALF_X + 0.46, FIELD_HALF_X - 0.46);

        const dx = runtime.playerX - hazard.x;
        const dy = runtime.playerY - hazard.y;
        const hitRadius = hazard.radius + PLAYER_RADIUS * 0.82;
        const segDistSq = distanceToSegmentSq(
          hazard.x,
          hazard.y,
          segmentStartX,
          segmentStartY,
          runtime.playerX,
          runtime.playerY
        );
        if (dx * dx + dy * dy < 2.2) {
          hazard.glow = Math.min(1.2, hazard.glow + dt * 2.9);
        }
        if (dx * dx + dy * dy <= hitRadius * hitRadius || segDistSq <= hitRadius * hitRadius) {
          failRun(
            'Satellite shattered on a hazard shard.',
            getPaletteColor(palette.hazards, hazard.colorIndex)
          );
          break;
        }
        if (hazard.y < runtime.playerY - 10) {
          hazard.active = false;
        }
      }

      for (const planet of runtime.planets) {
        if (planet.slot === runtime.latchedPlanet && runtime.latched) continue;
        if (planet.y < runtime.playerY - (runtime.mode === 'scattered' ? 13.5 : 15.2)) {
          seedPlanet(runtime, planet, false);
        }
      }
      ensureForwardTargets(runtime);

      if (runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        useOrbitStore
          .getState()
          .updateHud(
            runtime.score,
            runtime.latches,
            runtime.stars,
            runtime.timeRemaining,
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

    const latchCuePlanet =
      findNearestAheadPlanet(
        runtime,
        runtime.playerX,
        runtime.playerY,
        runtime.latched ? runtime.latchedPlanet : undefined
      ) ??
      runtime.planets
        .filter((planet) => !runtime.latched || planet.slot !== runtime.latchedPlanet)
        .sort(
          (a, b) =>
            Math.abs(a.y - (runtime.playerY + 1.8)) - Math.abs(b.y - (runtime.playerY + 1.8))
        )[0] ??
      null;

    let cueRingDelta = Infinity;
    if (latchCuePlanet) {
      const cueDx = runtime.playerX - latchCuePlanet.x;
      const cueDy = runtime.playerY - latchCuePlanet.y;
      cueRingDelta = Math.abs(Math.hypot(cueDx, cueDy) - latchCuePlanet.orbitRadius);
    }

    runtime.cuePulseCooldown = Math.max(0, runtime.cuePulseCooldown - dt);
    if (latchCuePlanet && !runtime.latched) {
      if (runtime.cuePulseSlot !== latchCuePlanet.slot) {
        runtime.cuePulseSlot = latchCuePlanet.slot;
        runtime.cuePulseT = Math.max(runtime.cuePulseT, 0.14);
        runtime.cuePulseCooldown = Math.max(runtime.cuePulseCooldown, 0.08);
      }
      const triggerWindow = runtime.mode === 'scattered' ? 0.25 : 0.21;
      if (cueRingDelta <= triggerWindow && runtime.cuePulseCooldown <= 0) {
        runtime.cuePulseT = 1;
        runtime.cuePulseCooldown = 0.44 + Math.random() * 0.2;
      }
    } else {
      runtime.cuePulseSlot = -1;
    }
    runtime.cuePulseT = Math.max(0, runtime.cuePulseT - dt * 2.6);

    const shakeAmp = runtime.shake * 0.09;
    const shakeTime = runtime.elapsed * 21;
    const drifting = !runtime.latched;
    const scatteredCamLift = runtime.mode === 'scattered' ? 1.35 : 0.68;
    const scatteredCamPull = runtime.mode === 'scattered' ? 3.35 : 2.85;
    const focusY = latchCuePlanet
      ? lerp(runtime.playerY, latchCuePlanet.y, drifting ? 0.69 : 0.57)
      : runtime.playerY + (runtime.latched ? 2.24 : 1.62);
    const focusX = latchCuePlanet
      ? lerp(runtime.playerX, latchCuePlanet.x, drifting ? 0.44 : 0.3)
      : runtime.playerX;
    camTarget.set(
      focusX * 0.24 + shakeNoiseSigned(shakeTime, 2.9) * shakeAmp,
      7.6 + scatteredCamLift + shakeNoiseSigned(shakeTime, 7.5) * shakeAmp * 0.3,
      -focusY + 7.15 + scatteredCamPull + shakeNoiseSigned(shakeTime, 15.1) * shakeAmp
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-8 * step.renderDt));
    lookTarget.set(
      focusX * 0.16,
      0,
      -focusY - (runtime.mode === 'scattered' ? 7.25 : 6.75)
    );
    camera.lookAt(lookTarget);
    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = runtime.mode === 'scattered' ? 58 : 56;
      camera.fov = lerp(camera.fov, baseFov - runtime.coreGlow * 1.8, 1 - Math.exp(-6 * dt));
      camera.updateProjectionMatrix();
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

    if (latchCuePulseRef.current && latchCuePulseRefSecondary.current) {
      if (latchCuePlanet) {
        const cueWorld = simToWorld(latchCuePlanet.x, latchCuePlanet.y, trailWorld);
        const distToCue = Math.hypot(
          runtime.playerX - latchCuePlanet.x,
          runtime.playerY - latchCuePlanet.y
        );
        const ringDelta = Math.abs(distToCue - latchCuePlanet.orbitRadius);
        const timingWindow = clamp(1 - ringDelta / 0.45, 0, 1);
        const coreWindow = clamp(1 - ringDelta / 0.72, 0, 1);
        const phaseA = 1 - runtime.cuePulseT;
        const phaseB = clamp(phaseA - 0.2, 0, 1);
        const minScale = latchCuePlanet.radius * 0.58;
        const maxScale = latchCuePlanet.orbitRadius * (runtime.latched ? 1.04 : 1.18);
        const scaleA = lerp(minScale, maxScale, phaseA);
        const scaleB = lerp(minScale, maxScale, phaseB);
        const pulseActive = !runtime.latched && runtime.cuePulseT > 0.001;

        latchCuePulseRef.current.visible = pulseActive;
        latchCuePulseRef.current.position.set(cueWorld.x, 0.045, cueWorld.z);
        latchCuePulseRef.current.scale.set(scaleA, scaleA, 1);
        latchCuePulseRef.current.rotation.set(-Math.PI * 0.5, 0, 0);
        const pulseOpacity = clamp(runtime.cuePulseT * (0.11 + timingWindow * 0.42), 0.04, 0.56);
        if (latchCuePulseMaterialRef.current) {
          latchCuePulseMaterialRef.current.opacity = pulseOpacity;
          latchCuePulseMaterialRef.current.color
            .copy(palette.ringCue)
            .lerp(palette.trailGlow, clamp(0.18 + timingWindow * 0.4, 0, 0.84));
        }

        latchCuePulseRefSecondary.current.visible = pulseActive;
        latchCuePulseRefSecondary.current.position.set(cueWorld.x, 0.044, cueWorld.z);
        latchCuePulseRefSecondary.current.scale.set(scaleB, scaleB, 1);
        latchCuePulseRefSecondary.current.rotation.set(-Math.PI * 0.5, 0, 0);
        if (latchCuePulseSecondaryMaterialRef.current) {
          latchCuePulseSecondaryMaterialRef.current.opacity = clamp(
            runtime.cuePulseT * (0.04 + coreWindow * 0.18),
            0.02,
            0.22
          );
          latchCuePulseSecondaryMaterialRef.current.color
            .copy(palette.trailGlow)
            .lerp(WHITE, clamp(coreWindow * 0.22, 0, 0.4));
        }
      } else {
        latchCuePulseRef.current.visible = false;
        latchCuePulseRefSecondary.current.visible = false;
      }
    }

    if (planetRef.current && ringRef.current) {
      const latchCueSlot = latchCuePlanet?.slot ?? -1;
      for (let i = 0; i < runtime.planets.length; i += 1) {
        const planet = runtime.planets[i];
        const world = simToWorld(planet.x, planet.y, trailWorld);
        const pulsing = 0;
        const cuePulse =
          planet.slot === latchCueSlot ? runtime.cuePulseT : 0;
        const isCuePlanet = planet.slot === latchCueSlot;

        dummy.position.set(world.x, 0, world.z);
        dummy.scale.setScalar(planet.radius);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        planetRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch
          .copy(getPaletteColor(palette.planets, planet.colorIndex))
          .lerp(WHITE, clamp(planet.glow * 0.4 + pulsing * 0.16 + cuePulse * 0.28, 0, 0.82))
          .multiplyScalar(1.68);
        planetRef.current.setColorAt(i, colorScratch);

        if (planetGlowRef.current) {
          dummy.position.set(world.x, 0.01, world.z);
          dummy.scale.setScalar(planet.radius * (1.08 + pulsing * 0.09 + cuePulse * 0.22 + planet.glow * 0.08));
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          planetGlowRef.current.setMatrixAt(i, dummy.matrix);

          colorScratch
            .copy(getPaletteColor(palette.planets, planet.colorIndex))
            .lerp(WHITE, clamp(0.34 + pulsing * 0.34 + planet.glow * 0.44 + cuePulse * 0.45, 0, 0.99))
            .multiplyScalar(1.52);
          planetGlowRef.current.setColorAt(i, colorScratch);
        }

        dummy.position.set(world.x, 0.015, world.z);
        const ringScale = planet.orbitRadius * (isCuePlanet ? 1 + cuePulse * 0.12 : 1);
        dummy.scale.set(ringScale, ringScale, ringScale);
        dummy.rotation.set(-Math.PI * 0.5, 0, 0);
        dummy.updateMatrix();
        ringRef.current.setMatrixAt(i, dummy.matrix);

        colorScratch
          .copy(getPaletteColor(palette.planets, planet.colorIndex))
          .lerp(palette.ringCue, clamp(cuePulse * 0.86 + runtime.latchFlash * 0.22, 0, 0.9))
          .lerp(
            WHITE,
            isCuePlanet
              ? clamp(0.26 + planet.glow * 0.58 + runtime.latchFlash * 0.18 + cuePulse * 0.44, 0, 0.95)
              : clamp(0.02 + planet.glow * 0.09, 0, 0.12)
          )
          .multiplyScalar(isCuePlanet ? 1.36 : 0.28);
        ringRef.current.setColorAt(i, colorScratch);
      }
      planetRef.current.instanceMatrix.needsUpdate = true;
      if (planetRef.current.instanceColor) planetRef.current.instanceColor.needsUpdate = true;
      if (planetGlowRef.current) {
        planetGlowRef.current.instanceMatrix.needsUpdate = true;
        if (planetGlowRef.current.instanceColor) planetGlowRef.current.instanceColor.needsUpdate = true;
      }
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
          .copy(getPaletteColor(palette.stars, star.colorIndex))
          .lerp(WHITE, clamp(0.32 + star.glow * 0.46, 0, 0.82));
        starRef.current.setColorAt(count, colorScratch);
        count += 1;
      }
      starRef.current.count = count;
      starRef.current.instanceMatrix.needsUpdate = true;
      if (starRef.current.instanceColor) starRef.current.instanceColor.needsUpdate = true;
    }

    if (hazardRef.current) {
      let hazardCount = 0;
      for (const hazard of runtime.hazardsPool) {
        if (!hazard.active) continue;
        const world = simToWorld(hazard.x, hazard.y, trailWorld);
        const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 3.2 + hazard.phase);
        dummy.position.set(world.x, 0.05 + Math.sin(runtime.elapsed * 1.7 + hazard.phase) * 0.04, world.z);
        dummy.scale.setScalar(hazard.radius * (1 + pulse * 0.22 + hazard.glow * 0.18));
        dummy.rotation.set(
          runtime.elapsed * 0.8 + hazard.spin,
          runtime.elapsed * 1.05 + hazard.spin * 0.5,
          runtime.elapsed * 1.35
        );
        dummy.updateMatrix();
        hazardRef.current.setMatrixAt(hazardCount, dummy.matrix);

        colorScratch
          .copy(getPaletteColor(palette.hazards, hazard.colorIndex))
          .lerp(WHITE, clamp(0.16 + hazard.glow * 0.58 + pulse * 0.16, 0, 0.9));
        hazardRef.current.setColorAt(hazardCount, colorScratch);
        hazardCount += 1;
      }
      hazardRef.current.count = hazardCount;
      hazardRef.current.instanceMatrix.needsUpdate = true;
      if (hazardRef.current.instanceColor) hazardRef.current.instanceColor.needsUpdate = true;
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
      bloomRef.current.intensity = lerp(
        palette.bloomBase,
        palette.bloomMax,
        clamp(runtime.coreGlow * 0.7 + runtime.latchFlash * 0.42 + (runtime.mode === 'scattered' ? 0.12 : 0), 0, 1)
      );
    }
    if (impactOverlayRef.current) {
      impactOverlayRef.current.style.opacity = `${clamp(runtime.impactFlash * 0.74, 0, 0.74)}`;
    }
    } finally {
      clearFrameInput(inputRef);
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 7.2, 6.2]} fov={52} near={0.1} far={240} />
      <color attach="background" args={['#1a2d4c']} />
      <fog attach="fog" args={['#32507a', 20, 154]} />

      <ambientLight ref={ambientLightRef} intensity={1.1} color="#f3f9ff" />
      <directionalLight
        ref={directionalLightRef}
        position={[6, 9, 3]}
        intensity={1.18}
        color="#f7fbff"
      />
      <hemisphereLight ref={hemiLightRef} args={['#9de4ff', '#21335a', 0.82]} />
      <pointLight ref={fillLightARef} position={[0, 4.1, 2]} intensity={1.35} color="#65efff" />
      <pointLight ref={fillLightBRef} position={[2.2, 2.8, -3.2]} intensity={1.08} color="#ff8ce5" />
      <pointLight ref={fillLightCRef} position={[-2.6, 2.6, -1.6]} intensity={0.95} color="#ffd27d" />

      <instancedMesh ref={planetRef} args={[undefined, undefined, PLANET_POOL]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          ref={planetMaterialRef}
          color="#ffffff"
          vertexColors
          roughness={0.18}
          metalness={0.12}
          emissive="#23355c"
          emissiveIntensity={1.26}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={planetGlowRef}
        args={[undefined, undefined, PLANET_POOL]}
        frustumCulled={false}
        renderOrder={3}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={planetGlowMaterialRef}
          color="#ffffff"
          vertexColors
          transparent
          opacity={0.68}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={ringRef} args={[undefined, undefined, PLANET_POOL]} frustumCulled={false}>
        <torusGeometry args={[1, 0.05, 14, 96]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          vertexColors
          transparent
          opacity={0.34}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={starRef} args={[undefined, undefined, STAR_POOL]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          ref={starMaterialRef}
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={hazardRef} args={[undefined, undefined, HAZARD_POOL]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          ref={hazardMaterialRef}
          color="#ffffff"
          vertexColors
          roughness={0.2}
          metalness={0.4}
          emissive="#5b1a33"
          emissiveIntensity={0.56}
          toneMapped={false}
        />
      </instancedMesh>

      <primitive object={trailObject} />

      <mesh ref={satRef} position={[0, 0.03, 0]}>
        <sphereGeometry args={[PLAYER_RADIUS, 18, 18]} />
        <meshStandardMaterial
          ref={satMaterialRef}
          color="#f8fdff"
          emissive="#34d9ff"
          emissiveIntensity={0.72}
          roughness={0.12}
          metalness={0.18}
        />
      </mesh>

      <mesh ref={latchSparkRef} visible={false} position={[0, 0.04, 0]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          ref={latchSparkMaterialRef}
          color="#ffffff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={latchCuePulseRef} visible={false} position={[0, 0.044, 0]} renderOrder={4}>
        <ringGeometry args={[0.78, 0.9, 64]} />
        <meshBasicMaterial
          ref={latchCuePulseMaterialRef}
          color="#9fffff"
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        ref={latchCuePulseRefSecondary}
        visible={false}
        position={[0, 0.0435, 0]}
        renderOrder={4}
      >
        <ringGeometry args={[0.52, 0.62, 64]} />
        <meshBasicMaterial
          ref={latchCuePulseSecondaryMaterialRef}
          color="#ff95d8"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <instancedMesh ref={shardRef} args={[undefined, undefined, SHARD_POOL]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={shardMaterialRef}
          vertexColors
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom ref={bloomRef} intensity={0.64} luminanceThreshold={0.36} luminanceSmoothing={0.21} mipmapBlur />
        <Vignette eskil={false} offset={0.16} darkness={0.26} />
        <Noise premultiply opacity={0.022} />
      </EffectComposer>

    </>
  );
}

const OrbitLatch: React.FC<{ soundsOn?: boolean }> = () => {
  const impactOverlayRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.6]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        className="absolute inset-0 h-full w-full"
        onContextMenu={(event) => event.preventDefault()}
      >
        <OrbitLatchScene impactOverlayRef={impactOverlayRef} />
      </Canvas>

      <div
        ref={impactOverlayRef}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,68,235,0.42),rgba(34,211,238,0.26),rgba(10,10,21,0))]"
        style={{ opacity: 0, mixBlendMode: 'screen' }}
      />

      <OrbitLatchOverlay />
    </div>
  );
};

export default OrbitLatch;
export * from './state';
