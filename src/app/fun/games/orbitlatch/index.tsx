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
  setMode: (mode: OrbitMode) => void;
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
const SCATTERED_MIN_FORWARD_TARGETS = 8;

const FIELD_HALF_X = 4.2;
const SAFE_FALL_BACK = 10.5;
const DRIFT_FAIL_BASE = 5.4;

const LATCH_BASE_DISTANCE = 0.3;
const COLLECT_RADIUS = 0.28;
const PLAYER_RADIUS = 0.12;
const RELATCH_LOOKAHEAD_BASE = 0.12;

const STAR_COLORS = [
  new THREE.Color('#22d3ee'),
  new THREE.Color('#ff44eb'),
  new THREE.Color('#f59e0b'),
  new THREE.Color('#a78bfa'),
  new THREE.Color('#34d399'),
  new THREE.Color('#fb7185'),
] as const;
const PLANET_COLORS = [
  new THREE.Color('#00ffff'),
  new THREE.Color('#ff00ff'),
  new THREE.Color('#6c5ce7'),
  new THREE.Color('#f39c12'),
  new THREE.Color('#34d399'),
  new THREE.Color('#f43f5e'),
] as const;
const HAZARD_COLORS = [
  new THREE.Color('#ff4d74'),
  new THREE.Color('#fb7185'),
  new THREE.Color('#f97316'),
  new THREE.Color('#f43f5e'),
] as const;
const WHITE = new THREE.Color('#fdffff');
const DANGER = new THREE.Color('#ff4d74');

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

let audioContextRef: AudioContext | null = null;

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
  colorIndex: slot % HAZARD_COLORS.length,
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

const spawnHazardBetween = (
  runtime: Runtime,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tier: number
) => {
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
  hazard.colorIndex = Math.floor(Math.random() * HAZARD_COLORS.length);
  hazard.glow = 0;
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
    runtime.scatterBandCursor = 0;
    runtime.scatterBandSize = 0;
  } else if (runtime.mode === 'scattered') {
    if (runtime.scatterBandCursor <= 0) {
      runtime.spawnCursorY += nextSpacing(runtime, tier);
      runtime.scatterBandSize = 3 + (Math.random() < 0.45 ? 1 : 0);
      runtime.scatterBandCursor = runtime.scatterBandSize;
    }
    const bandIndex = runtime.scatterBandSize - runtime.scatterBandCursor;
    const laneSpread = FIELD_HALF_X - 0.7;
    const laneT = runtime.scatterBandSize <= 1 ? 0.5 : bandIndex / (runtime.scatterBandSize - 1);
    nextX = clamp(
      lerp(-laneSpread, laneSpread, laneT) + (Math.random() * 2 - 1) * 0.42,
      -FIELD_HALF_X + 0.62,
      FIELD_HALF_X - 0.62
    );
    nextY = runtime.spawnCursorY + (Math.random() * 2 - 1) * (0.26 + tier * 0.02);
    runtime.scatterBandCursor -= 1;
    if (runtime.scatterBandCursor <= 0) runtime.spawnCursorY += 0.22 + Math.random() * 0.28;
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
    spawnHazardBetween(runtime, runtime.lastSpawnX, runtime.lastSpawnY, nextX, nextY, tier);
  }

  runtime.spawnCursorY = nextY;
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
  for (const planet of runtime.planets) {
    furthestY = Math.max(furthestY, planet.y);
    if (planet.y > runtime.playerY + 0.45) ahead += 1;
  }
  if (ahead >= minTargets) return;

  let needed = minTargets - ahead;
  const recycle = runtime.planets
    .filter((planet) => planet.y <= runtime.playerY + 0.45 && (!runtime.latched || planet.slot !== runtime.latchedPlanet))
    .sort((a, b) => a.y - b.y);
  let anchorY = furthestY;

  for (const planet of recycle) {
    if (needed <= 0) break;
    runtime.spawnCursorY = Math.max(runtime.spawnCursorY, anchorY - 0.12);
    seedPlanet(runtime, planet, false);
    if (planet.y <= anchorY + 0.36) {
      planet.y = anchorY + 0.36 + Math.random() * 0.52;
    }
    anchorY = planet.y;
    needed -= 1;
  }
};

const ensureImmediateLatchOpportunity = (runtime: Runtime, fromPlanet: Planet) => {
  const px = runtime.playerX;
  const py = runtime.playerY;
  const lookTime = runtime.mode === 'scattered' ? 0.72 : 0.84;
  const predictX = px + runtime.velX * lookTime;
  const predictY = py + runtime.velY * lookTime;
  const reachDelta = runtime.mode === 'scattered' ? 0.92 : 0.78;

  let reachable = false;
  for (const planet of runtime.planets) {
    if (planet.slot === fromPlanet.slot) continue;
    const dy = planet.y - py;
    if (dy < 0.25 || dy > 4.8) continue;
    const d = Math.hypot(predictX - planet.x, predictY - planet.y);
    if (Math.abs(d - planet.orbitRadius) <= reachDelta) {
      reachable = true;
      break;
    }
  }
  if (reachable) return;

  const recycle = runtime.planets
    .filter((planet) => planet.slot !== fromPlanet.slot)
    .sort((a, b) => a.y - b.y)[0];
  if (!recycle) return;

  recycle.x = clamp(predictX + (Math.random() * 2 - 1) * 0.48, -FIELD_HALF_X + 0.7, FIELD_HALF_X - 0.7);
  recycle.y = Math.max(py + 1.35, predictY + 0.85 + Math.random() * 0.75);
  recycle.radius = clamp(
    recycle.radius + (Math.random() * 2 - 1) * 0.03,
    runtime.mode === 'scattered' ? 0.42 : 0.48,
    runtime.mode === 'scattered' ? 0.76 : 0.88
  );
  recycle.orbitRadius = clamp(
    recycle.radius + (runtime.mode === 'scattered' ? 0.74 : 0.86) + Math.random() * 0.22,
    recycle.radius + 0.5,
    recycle.radius + 1.22
  );
  const dir = runtime.velX >= 0 ? 1 : -1;
  recycle.orbitAngularVel = dir * (1.5 + Math.random() * 1.2);
  recycle.colorIndex = Math.floor(Math.random() * PLANET_COLORS.length);
  recycle.glow = 0.45;
  recycle.pulse = Math.random() * Math.PI * 2;
  runtime.spawnCursorY = Math.max(runtime.spawnCursorY, recycle.y + 0.24);
  runtime.lastSpawnX = recycle.x;
  runtime.lastSpawnY = recycle.y;
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
  const tapNonce = useOrbitStore((state) => state.tapNonce);
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
              Tap anywhere outside the mode buttons to start.
            </div>
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
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={tapNonce}>
          <div
            className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70"
            style={{
              animation: 'orbitlatch-pulse 260ms ease-out forwards',
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
  const hazardRef = useRef<THREE.InstancedMesh>(null);
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
    () =>
      new THREE.LineBasicMaterial({
        color: '#74f5ff',
        transparent: true,
        opacity: 0.74,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );
  const trailObject = useMemo(
    () => new THREE.Line(trailGeometry, trailMaterial),
    [trailGeometry, trailMaterial]
  );

  const { camera } = useThree();

  const resetRuntime = (runtime: Runtime, mode: OrbitMode) => {
    runtime.mode = mode;
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

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('spacebar') ||
      input.justPressed.has('enter');

    if (tap) {
      runtime.lastTapAt = runtime.elapsed;
      if (store.status !== 'PLAYING') {
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
          const launchScale = 1.06;
          runtime.velX = tangentX * orbitalLinear * launchScale + radialX * 0.22;
          runtime.velY = tangentY * orbitalLinear * launchScale + radialY * 0.22 + 0.38;

          runtime.releaseCount += 1;
          ensureForwardTargets(runtime);
          const nearestAhead = findNearestAheadPlanet(runtime, runtime.playerX, runtime.playerY, planet.slot);
          if (nearestAhead) {
            const ax = nearestAhead.x - runtime.playerX;
            const ay = nearestAhead.y - runtime.playerY;
            const len = Math.hypot(ax, ay) || 1;
            const firstRelease = runtime.releaseCount === 1;
            runtime.velX += (ax / len) * (firstRelease ? 0.46 : 0.26);
          runtime.velY += Math.max(0, ay / len) * (firstRelease ? 0.68 : 0.42);
          }
          if (runtime.releaseCount === 1) {
            runtime.velY = Math.max(runtime.velY, runtime.mode === 'scattered' ? 0.86 : 0.94);
            runtime.velX *= 0.95;
            runtime.velX = clamp(runtime.velX, -2.2, 2.2);
          }
          runtime.velY = Math.max(runtime.velY, runtime.mode === 'scattered' ? 0.52 : 0.42);

          if (runtime.releaseCount === 1) {
            ensureImmediateLatchOpportunity(runtime, planet);
          }
          runtime.latched = false;
          runtime.driftTimer = runtime.releaseCount === 1 ? -0.18 : 0;
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
        let fallbackPlanet: Planet | null = null;
        let fallbackDelta = Infinity;
        const dNorm = clamp((runtime.difficulty.speed - 4.2) / 3.6, 0, 1);
        const speed = Math.hypot(runtime.velX, runtime.velY);
        const speedAssist = clamp(speed * 0.08, 0, runtime.mode === 'scattered' ? 0.22 : 0.16);
        const firstLatchAssist = runtime.latches === 0 ? 0.09 : 0;
        const modeAssist = runtime.mode === 'scattered' ? 0.05 : 0;
        const lookAhead = clamp(
          RELATCH_LOOKAHEAD_BASE + speedAssist * 0.55 + firstLatchAssist * 0.35 + modeAssist * 0.4,
          RELATCH_LOOKAHEAD_BASE,
          runtime.mode === 'scattered' ? 0.34 : 0.3
        );
        const predictX = runtime.playerX + runtime.velX * lookAhead;
        const predictY = runtime.playerY + runtime.velY * lookAhead;
        const latchDistance = clamp(
          LATCH_BASE_DISTANCE + 0.04 + speedAssist - dNorm * 0.08 + firstLatchAssist + modeAssist,
          0.22,
          runtime.mode === 'scattered' ? 0.62 : 0.56
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
          if (deltaRing < fallbackDelta) {
            fallbackDelta = deltaRing;
            fallbackPlanet = planet;
          }
          if (deltaRing <= latchDistance && deltaRing < bestDelta) {
            bestDelta = deltaRing;
            bestPlanet = planet;
          }
        }
        if (!bestPlanet && fallbackPlanet) {
          const fallbackSlack = runtime.latches === 0 ? 0.22 : 0.14;
          if (fallbackDelta <= latchDistance + fallbackSlack) {
            bestPlanet = fallbackPlanet;
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
      if (runtime.mode === 'scattered') {
        runtime.timeRemaining = Math.max(0, runtime.timeRemaining - dt);
        if (runtime.timeRemaining <= 0) {
          failRun('Time limit reached before extraction.', STAR_COLORS[2]);
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

        if (runtime.releaseCount === 1 && runtime.latches === 0 && runtime.driftTimer > 0.35) {
          ensureImmediateLatchOpportunity(runtime, runtime.planets.find((p) => p.slot === runtime.latchedPlanet) ?? runtime.planets[0]);
        }

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

      for (const hazard of runtime.hazardsPool) {
        if (!hazard.active) continue;
        hazard.spin += dt * hazard.spinVel;
        hazard.glow = Math.max(0, hazard.glow - dt * 2.4);
        hazard.x += Math.sin(runtime.elapsed * 1.35 + hazard.phase) * hazard.drift * dt;
        hazard.x = clamp(hazard.x, -FIELD_HALF_X + 0.46, FIELD_HALF_X - 0.46);

        const dx = runtime.playerX - hazard.x;
        const dy = runtime.playerY - hazard.y;
        const hitRadius = hazard.radius + PLAYER_RADIUS * 0.82;
        if (dx * dx + dy * dy < 2.2) {
          hazard.glow = Math.min(1.2, hazard.glow + dt * 2.9);
        }
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          failRun('Satellite shattered on a hazard shard.', HAZARD_COLORS[hazard.colorIndex]);
          break;
        }
        if (hazard.y < runtime.playerY - 10) {
          hazard.active = false;
        }
      }

      for (const planet of runtime.planets) {
        if (planet.slot === runtime.latchedPlanet && runtime.latched) continue;
        if (planet.y < runtime.playerY - (runtime.mode === 'scattered' ? 10.5 : 12)) {
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

    const shakeAmp = runtime.shake * 0.09;
    const shakeTime = runtime.elapsed * 21;
    const scatteredCamLift = runtime.mode === 'scattered' ? 0.95 : 0;
    const scatteredCamPull = runtime.mode === 'scattered' ? 1.05 : 0;
    camTarget.set(
      runtime.playerX * 0.3 + shakeNoiseSigned(shakeTime, 2.9) * shakeAmp,
      7.3 + scatteredCamLift + shakeNoiseSigned(shakeTime, 7.5) * shakeAmp * 0.32,
      -runtime.playerY + 4.9 + scatteredCamPull + shakeNoiseSigned(shakeTime, 15.1) * shakeAmp
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-8 * step.renderDt));
    lookTarget.set(runtime.playerX * 0.2, 0, -runtime.playerY - (runtime.mode === 'scattered' ? 4.2 : 3.4));
    camera.lookAt(lookTarget);
    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = runtime.mode === 'scattered' ? 44 : 39;
      camera.fov = lerp(camera.fov, baseFov - runtime.coreGlow * 1.8, 1 - Math.exp(-6 * dt));
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
          .copy(HAZARD_COLORS[hazard.colorIndex])
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
        0.52,
        1.24,
        clamp(runtime.coreGlow * 0.7 + runtime.latchFlash * 0.42 + (runtime.mode === 'scattered' ? 0.12 : 0), 0, 1)
      );
    }
    if (impactOverlayRef.current) {
      impactOverlayRef.current.style.opacity = `${clamp(runtime.impactFlash * 0.74, 0, 0.74)}`;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 7.3, 4.9]} fov={39} near={0.1} far={120} />
      <color attach="background" args={['#0a0a15']} />
      <fog attach="fog" args={['#0f0a1d', 8, 86]} />

      <ambientLight intensity={0.42} />
      <directionalLight position={[6, 9, 3]} intensity={0.58} color="#8ad9ff" />
      <hemisphereLight args={['#6de6ff', '#1b1236', 0.3]} />
      <pointLight position={[0, 4.1, 2]} intensity={0.72} color="#22d3ee" />
      <pointLight position={[2.2, 2.8, -3.2]} intensity={0.52} color="#ff44eb" />
      <pointLight position={[-2.6, 2.6, -1.6]} intensity={0.36} color="#f59e0b" />

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
              vec3 deep = vec3(0.02, 0.02, 0.08);
              vec3 cyan = vec3(0.02, 0.36, 0.42);
              vec3 magenta = vec3(0.44, 0.05, 0.35);
              vec3 amber = vec3(0.42, 0.2, 0.04);
              float grad = smoothstep(-0.25, 1.2, vUv.y);
              float waveA = sin((vUv.x * 2.8 + uTime * 0.18) * 6.2831853) * 0.5 + 0.5;
              float waveB = sin((vUv.y * 3.7 - uTime * 0.23) * 6.2831853) * 0.5 + 0.5;
              float rim = smoothstep(1.25, 0.28, r);
              float grain = fract(sin(dot(vUv * (uTime + 3.17), vec2(12.9898, 78.233))) * 43758.5453);
              vec3 col = mix(deep, magenta, grad * 0.72);
              col = mix(col, cyan, waveA * 0.28);
              col += amber * (waveB * 0.08 + uGlow * 0.16);
              col += (grain - 0.5) * 0.02;
              col *= rim;
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={planetRef} args={[undefined, undefined, PLANET_POOL]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial vertexColors roughness={0.26} metalness={0.32} />
      </instancedMesh>

      <instancedMesh ref={ringRef} args={[undefined, undefined, PLANET_POOL]} frustumCulled={false}>
        <torusGeometry args={[1, 0.032, 12, 96]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={starRef} args={[undefined, undefined, STAR_POOL]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.98}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={hazardRef} args={[undefined, undefined, HAZARD_POOL]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial vertexColors roughness={0.2} metalness={0.56} />
      </instancedMesh>

      <primitive object={trailObject} />

      <mesh ref={satRef} position={[0, 0.03, 0]}>
        <sphereGeometry args={[PLAYER_RADIUS, 18, 18]} />
        <meshStandardMaterial
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
          color="#ffffff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={shardRef} args={[undefined, undefined, SHARD_POOL]} frustumCulled={false}>
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
        <Bloom ref={bloomRef} intensity={0.64} luminanceThreshold={0.36} luminanceSmoothing={0.21} mipmapBlur />
        <Vignette eskil={false} offset={0.16} darkness={0.72} />
        <Noise premultiply opacity={0.024} />
      </EffectComposer>

      <Html fullscreen>
        <div
          ref={impactOverlayRef}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,68,235,0.42),rgba(34,211,238,0.26),rgba(10,10,21,0))]"
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
