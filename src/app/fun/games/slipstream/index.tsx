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
  clearanceY: number;
};

type Relic = {
  slot: number;
  active: boolean;
  lane: LaneIndex;
  x: number;
  z: number;
  radius: number;
  wobbleAmp: number;
  wobbleFreq: number;
  phase: number;
  spin: number;
  speedFactor: number;
  tint: number;
  clearanceY: number;
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
  playerY: number;
  playerVY: number;
  jumpBuffer: number;
  coyoteTimer: number;
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
  relicSpawnTimer: number;
  nextCometSlot: number;
  nextGustSlot: number;
  nextRelicSlot: number;
  lastCometLane: number;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkCometsLeft: number;

  segments: TunnelSegment[];
  comets: Comet[];
  gusts: Gust[];
  relics: Relic[];
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

const COMET_POOL = 30;
const GUST_POOL = 36;
const RELIC_POOL = 20;
const STREAK_POOL = 120;

const FRONT_Z = 6;
const FAR_Z = -92;

const COMET_COLLIDE_Z = 0.38;
const GUST_COLLIDE_Z = 0.38;
const RELIC_COLLIDE_Z = 0.42;

const PLAYER_BASE_Y = -0.02;
const PLAYER_HIT_Y_MARGIN = 0.16;
const JUMP_VELOCITY = 5.55;
const JUMP_GRAVITY = -18.6;
const JUMP_BUFFER_WINDOW = 0.12;
const COYOTE_WINDOW = 0.08;

const SWIPE_THRESHOLD_X = 0.18;
const SWIPE_RATIO = 1.2;
const TAP_MAX_DRIFT = 0.14;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const STREAM = new THREE.Color('#9ff9ff');
const COMET_COLOR = new THREE.Color('#ff9c5c');
const GUST_COLOR = new THREE.Color('#bf89ff');
const RELIC_COLOR = new THREE.Color('#61ffd1');
const LOG_BROWN = new THREE.Color('#f6c88c');
const LOG_DARK = new THREE.Color('#9e6f45');
const LANE_DIVIDER = new THREE.Color('#fff7d3');
const DANGER = new THREE.Color('#ff4d84');
const WHITE = new THREE.Color('#f7fbff');
const TRACK_MAIN = new THREE.Color('#43bddb');
const TRACK_GLOW = new THREE.Color('#7cf3ff');
const RIVER_SKY = new THREE.Color('#0e3552');
const RIVER_FOG = new THREE.Color('#154f71');

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type FractalUniforms = {
  uTime: { value: number };
  uSlip: { value: number };
  uColorA: { value: THREE.Color };
  uColorB: { value: THREE.Color };
  uPatternScale: { value: number };
  uSpeed: { value: number };
  uGlow: { value: number };
};

const applyFractalObstacleShader = (
  material: THREE.MeshStandardMaterial,
  colorA: THREE.ColorRepresentation,
  colorB: THREE.ColorRepresentation,
  patternScale: number,
  speed: number,
  glow: number
) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uSlip = { value: 0 };
    shader.uniforms.uColorA = { value: new THREE.Color(colorA) };
    shader.uniforms.uColorB = { value: new THREE.Color(colorB) };
    shader.uniforms.uPatternScale = { value: patternScale };
    shader.uniforms.uSpeed = { value: speed };
    shader.uniforms.uGlow = { value: glow };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
          #include <common>
          varying vec3 vWorldPos;
        `
      )
      .replace(
        '#include <worldpos_vertex>',
        `
          #include <worldpos_vertex>
          vWorldPos = worldPosition.xyz;
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `
          #include <common>
          uniform float uTime;
          uniform float uSlip;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uPatternScale;
          uniform float uSpeed;
          uniform float uGlow;
          varying vec3 vWorldPos;

          float hash31(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
          }

          float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
            float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
            float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
            float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
            float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
            float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
            float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
            float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
            float nx00 = mix(n000, n100, f.x);
            float nx10 = mix(n010, n110, f.x);
            float nx01 = mix(n001, n101, f.x);
            float nx11 = mix(n011, n111, f.x);
            float nxy0 = mix(nx00, nx10, f.y);
            float nxy1 = mix(nx01, nx11, f.y);
            return mix(nxy0, nxy1, f.z);
          }

          float fbm(vec3 p) {
            float a = 0.5;
            float v = 0.0;
            for (int i = 0; i < 4; i++) {
              v += a * noise3(p);
              p = p * 2.07 + vec3(7.3, 1.9, 3.4);
              a *= 0.52;
            }
            return v;
          }
        `
      )
      .replace(
        '#include <dithering_fragment>',
        `
          vec3 p = vWorldPos * uPatternScale + vec3(0.0, uTime * uSpeed, uTime * uSpeed * 0.5);
          float n = fbm(p);
          float ridged = abs(n * 2.0 - 1.0);
          float band = 0.5 + 0.5 * sin((vWorldPos.y + n * 2.6 + uTime * uSpeed) * 7.6);
          float t = clamp(ridged * 0.78 + band * 0.34, 0.0, 1.0);
          vec3 fractalColor = mix(uColorA, uColorB, t);
          diffuseColor.rgb = mix(diffuseColor.rgb, fractalColor, 0.52 + uSlip * 0.2);
          totalEmissiveRadiance += fractalColor * (0.06 + (0.22 + uGlow) * band + uSlip * 0.16);
          #include <dithering_fragment>
        `
      );

    (material.userData as { fractalUniforms?: FractalUniforms }).fractalUniforms =
      shader.uniforms as FractalUniforms;
  };
  material.needsUpdate = true;
};

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
  clearanceY: 0.94,
});

const makeRelic = (slot: number): Relic => ({
  slot,
  active: false,
  lane: 1,
  x: 0,
  z: -12,
  radius: 0.42,
  wobbleAmp: 0.12,
  wobbleFreq: 1.2,
  phase: 0,
  spin: 0.65,
  speedFactor: 1.12,
  tint: Math.random(),
  clearanceY: 0.48,
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
  playerY: 0,
  playerVY: 0,
  jumpBuffer: 0,
  coyoteTimer: COYOTE_WINDOW,
  inSlipstream: false,
  slipBlend: 0,
  slipStrength: 0,
  outOfDraftTimer: 0,
  hudCommit: 0,
  shake: 0,
  failMessage: '',
  speedNow: 6,

  cometSpawnTimer: 0.72,
  gustSpawnTimer: 1.6,
  relicSpawnTimer: 2.9,
  nextCometSlot: 0,
  nextGustSlot: 0,
  nextRelicSlot: 0,
  lastCometLane: -1,

  difficulty: sampleDifficulty('lane-switch', 0),
  chunkLibrary: buildPatternLibraryTemplate('slipstream'),
  currentChunk: null,
  chunkCometsLeft: 0,

  segments: Array.from({ length: SEGMENT_COUNT }, (_, idx) => makeSegment(idx)),
  comets: Array.from({ length: COMET_POOL }, (_, idx) => makeComet(idx)),
  gusts: Array.from({ length: GUST_POOL }, (_, idx) => makeGust(idx)),
  relics: Array.from({ length: RELIC_POOL }, (_, idx) => makeRelic(idx)),
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
  runtime.playerY = 0;
  runtime.playerVY = 0;
  runtime.jumpBuffer = 0;
  runtime.coyoteTimer = COYOTE_WINDOW;
  runtime.inSlipstream = false;
  runtime.slipBlend = 0;
  runtime.slipStrength = 0;
  runtime.outOfDraftTimer = 0;
  runtime.hudCommit = 0;
  runtime.shake = 0;
  runtime.failMessage = '';
  runtime.speedNow = 6;

  runtime.cometSpawnTimer = 0.72;
  runtime.gustSpawnTimer = 1.6;
  runtime.relicSpawnTimer = 2.9;
  runtime.nextCometSlot = 0;
  runtime.nextGustSlot = 0;
  runtime.nextRelicSlot = 0;
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

  for (const relic of runtime.relics) {
    relic.active = false;
    relic.x = 0;
    relic.z = -12;
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
    Math.round(runtime.currentChunk.durationSeconds * (2.15 + runtime.difficulty.eventRate * 1.8))
  );
};

const cometIntervalFor = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const pressure = clamp(runtime.elapsed / 90, 0, 1);
  const tutorialSlow = runtime.elapsed < 10 ? 0.32 : runtime.elapsed < 18 ? 0.12 : 0;
  return clamp(
    lerp(1.0, 0.3, d * 0.65 + pressure * 0.35) + (3 - tier) * 0.04 + tutorialSlow + Math.random() * 0.12,
    0.18,
    1.35
  );
};

const gustIntervalFor = (runtime: Runtime, tier: number) => {
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const pressure = clamp(runtime.elapsed / 95, 0, 1);
  const tutorialSlow = runtime.elapsed < 12 ? 1.0 : runtime.elapsed < 20 ? 0.42 : 0;
  return clamp(
    lerp(2.9, 0.8, d * 0.55 + pressure * 0.45) + (3 - tier) * 0.1 + tutorialSlow + Math.random() * 0.2,
    0.72,
    3.4
  );
};

const relicIntervalFor = (runtime: Runtime) => {
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const pressure = clamp(runtime.elapsed / 110, 0, 1);
  const tutorialSlow = runtime.elapsed < 16 ? 2.1 : runtime.elapsed < 24 ? 1.0 : 0;
  return clamp(
    lerp(4.8, 1.35, d * 0.5 + pressure * 0.5) + tutorialSlow + Math.random() * 0.25,
    1.1,
    5.2
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

const acquireRelic = (runtime: Runtime) => {
  for (let i = 0; i < runtime.relics.length; i += 1) {
    const idx = (runtime.nextRelicSlot + i) % runtime.relics.length;
    const relic = runtime.relics[idx];
    if (!relic.active) {
      runtime.nextRelicSlot = (idx + 1) % runtime.relics.length;
      return relic;
    }
  }
  const fallback = runtime.relics[runtime.nextRelicSlot];
  runtime.nextRelicSlot = (runtime.nextRelicSlot + 1) % runtime.relics.length;
  return fallback;
};

const spawnComet = (runtime: Runtime) => {
  if (!runtime.currentChunk || runtime.chunkCometsLeft <= 0) {
    chooseChunk(runtime);
  }
  runtime.chunkCometsLeft -= 1;
  const tier = runtime.currentChunk?.tier ?? 0;
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const pressure = clamp(runtime.elapsed / 100, 0, 1);
  const earlyScale = runtime.elapsed < 8 ? 0.4 : runtime.elapsed < 16 ? 0.7 : 1;

  let lane = Math.floor(Math.random() * 3) as LaneIndex;
  if (runtime.lastCometLane >= 0 && Math.random() < (tier <= 1 ? 0.34 : 0.2)) {
    lane = runtime.lastCometLane as LaneIndex;
  }
  runtime.lastCometLane = lane;

  const comet = acquireComet(runtime);
  comet.active = true;
  comet.lane = lane;
  comet.z = -24 - Math.random() * 16.5;
  comet.x = LANE_X[lane];
  comet.weaveAmp = lerp(0.03, 0.24, d) * (0.65 + tier * 0.08) * earlyScale;
  comet.weaveFreq = lerp(0.9, 1.9, d) + Math.random() * 0.5;
  comet.phase = Math.random() * Math.PI * 2;
  comet.speedFactor = clamp(
    lerp(0.96, 1.36, d * 0.64 + pressure * 0.36) + tier * 0.04 + (Math.random() * 2 - 1) * 0.06,
    0.9,
    1.54
  );
  comet.radius = clamp(lerp(0.46, 0.82, d) + tier * 0.04, 0.42, 0.9);
  comet.slipMin = 0.82;
  comet.slipMax = clamp(lerp(5.1, 3.5, d) + tier * 0.14, 3.0, 5.4);
  comet.nearAwarded = false;
  comet.tint = Math.random();
};

const spawnGust = (runtime: Runtime) => {
  const tier = runtime.currentChunk?.tier ?? 0;
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const pressure = clamp(runtime.elapsed / 90, 0, 1);
  const gust = acquireGust(runtime);

  let lane = runtime.laneIndex;
  if (Math.random() > 0.62) {
    lane = Math.floor(Math.random() * 3) as LaneIndex;
  }

  gust.active = true;
  gust.lane = lane;
  gust.z = -23 - Math.random() * 14.4;
  gust.x = LANE_X[lane];
  gust.width = clamp(1.2 + Math.random() * 0.46, 1.06, 1.92);
  gust.height = clamp(0.52 + Math.random() * 0.24, 0.42, 0.84);
  gust.depth = clamp(0.88 + Math.random() * 0.46, 0.8, 1.34);
  gust.swayAmp = lerp(0.03, 0.2, d) * (0.5 + tier * 0.1);
  gust.swayFreq = lerp(1.0, 2.25, d) + Math.random() * 0.5;
  gust.phase = Math.random() * Math.PI * 2;
  gust.speedFactor = clamp(0.96 + d * 0.24 + pressure * 0.18 + (Math.random() * 2 - 1) * 0.08, 0.9, 1.48);
  gust.tint = Math.random();
  gust.clearanceY = clamp(0.86 + Math.random() * 0.2, 0.82, 1.04);
};

const spawnRelic = (runtime: Runtime) => {
  const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
  const pressure = clamp(runtime.elapsed / 100, 0, 1);
  const relic = acquireRelic(runtime);
  const lane = Math.floor(Math.random() * 3) as LaneIndex;

  relic.active = true;
  relic.lane = lane;
  relic.z = -25 - Math.random() * 19;
  relic.x = LANE_X[lane];
  relic.radius = clamp(0.33 + Math.random() * 0.24 + d * 0.1, 0.32, 0.72);
  relic.wobbleAmp = lerp(0.03, 0.16, d);
  relic.wobbleFreq = lerp(1.1, 2.2, d) + Math.random() * 0.48;
  relic.phase = Math.random() * Math.PI * 2;
  relic.spin = lerp(0.8, 1.9, pressure) + Math.random() * 0.4;
  relic.speedFactor = clamp(1.04 + d * 0.26 + pressure * 0.18 + (Math.random() * 2 - 1) * 0.08, 0.95, 1.58);
  relic.tint = Math.random();
  relic.clearanceY = clamp(0.42 + Math.random() * 0.14, 0.39, 0.62);
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
        <div className="text-[11px] text-cyan-50/85">Jump the debris, swipe or strafe lanes, survive the river rush.</div>
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
            <div className="mt-2 text-sm text-white/85">Mobile: tap to jump, swipe left or right to change lanes.</div>
            <div className="mt-1 text-sm text-white/80">Desktop: click or Space to jump, Arrow keys or A/D to switch lanes.</div>
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
    preventDefault: [
      ' ',
      'Space',
      'space',
      'enter',
      'Enter',
      'arrowleft',
      'arrowright',
      'a',
      'd',
      'A',
      'D',
    ],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const tunnelRef = useRef<THREE.InstancedMesh>(null);
  const cometRef = useRef<THREE.InstancedMesh>(null);
  const coneRef = useRef<THREE.InstancedMesh>(null);
  const gustRef = useRef<THREE.InstancedMesh>(null);
  const relicRef = useRef<THREE.InstancedMesh>(null);
  const streakRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);
  const cometMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const gustMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const relicMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bloomRef = useRef<any>(null);
  const fixedStepRef = useRef(createFixedStepState());
  const gestureRef = useRef({
    active: false,
    swiped: false,
    startX: 0,
    startY: 0,
  });

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

  useEffect(() => {
    if (cometMatRef.current) {
      applyFractalObstacleShader(cometMatRef.current, '#ff8f52', '#ffe08f', 1.12, 0.24, 0.24);
    }
    if (gustMatRef.current) {
      applyFractalObstacleShader(gustMatRef.current, '#9f72ff', '#80f6ff', 0.84, 0.2, 0.2);
    }
    if (relicMatRef.current) {
      applyFractalObstacleShader(relicMatRef.current, '#42ffd2', '#b2fff0', 1.36, 0.31, 0.3);
    }
  }, []);

  useFrame((_, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = useSlipStreamStore.getState();

    const gesture = gestureRef.current;
    const leftPressed = input.justPressed.has('arrowleft') || input.justPressed.has('a');
    const rightPressed = input.justPressed.has('arrowright') || input.justPressed.has('d');
    const jumpByKey = input.justPressed.has(' ') || input.justPressed.has('space');
    const enterPressed = input.justPressed.has('enter');

    let laneDelta = 0;
    let jumpPressed = jumpByKey;

    if (leftPressed) laneDelta -= 1;
    if (rightPressed) laneDelta += 1;

    if (input.pointerJustDown) {
      gesture.active = true;
      gesture.swiped = false;
      gesture.startX = input.pointerX;
      gesture.startY = input.pointerY;
    }

    if (gesture.active && input.pointerDown) {
      const dx = input.pointerX - gesture.startX;
      const dy = input.pointerY - gesture.startY;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_X && Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO) {
        laneDelta += dx > 0 ? 1 : -1;
        gesture.swiped = true;
        gesture.startX = input.pointerX;
        gesture.startY = input.pointerY;
      }
    }

    if (input.pointerJustUp) {
      if (gesture.active) {
        const dx = input.pointerX - gesture.startX;
        const dy = input.pointerY - gesture.startY;
        if (!gesture.swiped && Math.abs(dx) <= TAP_MAX_DRIFT && Math.abs(dy) <= TAP_MAX_DRIFT) {
          jumpPressed = true;
        }
      } else {
        jumpPressed = true;
      }
      gesture.active = false;
      gesture.swiped = false;
    }

    if (store.status !== 'PLAYING') {
      if (jumpPressed || laneDelta !== 0 || enterPressed) {
        resetRuntime(runtime);
        if (jumpPressed) runtime.jumpBuffer = JUMP_BUFFER_WINDOW;
        useSlipStreamStore.getState().startRun();
      }
    } else {
      if (laneDelta !== 0) {
        const previousLane = runtime.laneIndex;
        runtime.laneIndex = clamp(runtime.laneIndex + Math.sign(laneDelta), 0, 2) as LaneIndex;
        runtime.targetX = LANE_X[runtime.laneIndex];
        if (runtime.laneIndex !== previousLane) {
          runtime.shake = Math.min(1.15, runtime.shake + 0.24);
          useSlipStreamStore.getState().onTapFx();
        }
      }
      if (jumpPressed) {
        runtime.jumpBuffer = JUMP_BUFFER_WINDOW;
      }
    }

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.difficulty = sampleDifficulty('lane-switch', runtime.elapsed);

      const d = clamp((runtime.difficulty.speed - 6.5) / 5, 0, 1);
      const pressure = clamp(runtime.elapsed / 100, 0, 1);
      const intensity = clamp(d * 0.64 + pressure * 0.36, 0, 1);
      const baseSpeed = lerp(6.2, 14.9, intensity);
      runtime.inSlipstream = runtime.laneIndex === 1;
      runtime.slipStrength = runtime.inSlipstream ? 1 : 0;
      runtime.speedNow = baseSpeed * (1 + runtime.slipStrength * 0.24);

      runtime.playerX = lerp(runtime.playerX, runtime.targetX, 1 - Math.exp(-16 * dt));
      runtime.jumpBuffer = Math.max(0, runtime.jumpBuffer - dt);
      runtime.coyoteTimer = runtime.playerY <= 0.001 ? COYOTE_WINDOW : Math.max(0, runtime.coyoteTimer - dt);

      if (runtime.jumpBuffer > 0 && runtime.coyoteTimer > 0) {
        runtime.playerVY = JUMP_VELOCITY;
        runtime.playerY = Math.max(runtime.playerY, 0.001);
        runtime.jumpBuffer = 0;
        runtime.coyoteTimer = 0;
        runtime.shake = Math.min(1.05, runtime.shake + 0.1);
      }

      runtime.playerVY += JUMP_GRAVITY * dt;
      runtime.playerY += runtime.playerVY * dt;
      if (runtime.playerY <= 0) {
        runtime.playerY = 0;
        runtime.playerVY = 0;
        runtime.coyoteTimer = COYOTE_WINDOW;
      }

      runtime.cometSpawnTimer -= dt;
      if (runtime.cometSpawnTimer <= 0) {
        spawnComet(runtime);
        if (intensity > 0.45 && Math.random() < 0.3 + intensity * 0.22) {
          spawnComet(runtime);
        }
        const tier = runtime.currentChunk?.tier ?? 0;
        runtime.cometSpawnTimer += cometIntervalFor(runtime, tier);
      }

      runtime.gustSpawnTimer -= dt;
      if (runtime.gustSpawnTimer <= 0) {
        const tier = runtime.currentChunk?.tier ?? 0;
        const gustChance =
          runtime.elapsed < 10
            ? 0
            : clamp(0.3 + Math.max(0, tier - 1) * 0.1 + intensity * 0.34, 0.26, 0.9);
        if (Math.random() < gustChance) {
          spawnGust(runtime);
          if (intensity > 0.6 && Math.random() < 0.2) {
            spawnGust(runtime);
          }
        }
        runtime.gustSpawnTimer += gustIntervalFor(runtime, tier);
      }

      runtime.relicSpawnTimer -= dt;
      if (runtime.relicSpawnTimer <= 0) {
        const relicChance = runtime.elapsed < 8 ? 0 : clamp(0.2 + intensity * 0.56, 0.2, 0.82);
        if (Math.random() < relicChance) {
          spawnRelic(runtime);
        }
        runtime.relicSpawnTimer += relicIntervalFor(runtime);
      }

      let failed = false;
      const playerClearY = runtime.playerY + PLAYER_HIT_Y_MARGIN;

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
          Math.abs(runtime.playerX - comet.x) < PLAYER_R + comet.radius &&
          playerClearY < clamp(0.44 + comet.radius * 0.5, 0.52, 0.84)
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
            Math.abs(gust.z - PLAYER_Z) < GUST_COLLIDE_Z &&
            playerClearY < gust.clearanceY
          ) {
            runtime.failMessage = 'A crate blocked your lane.';
            useSlipStreamStore.getState().endRun(runtime.score, runtime.failMessage);
            failed = true;
            break;
          }
        }
      }

      if (!failed) {
        for (const relic of runtime.relics) {
          if (!relic.active) continue;

          const prevZ = relic.z;
          relic.z += runtime.speedNow * relic.speedFactor * dt;
          relic.x = LANE_X[relic.lane] + Math.sin(runtime.elapsed * relic.wobbleFreq + relic.phase) * relic.wobbleAmp;

          if (relic.z > FRONT_Z + 1.2) {
            relic.active = false;
            continue;
          }

          if (
            Math.abs(relic.z - PLAYER_Z) < RELIC_COLLIDE_Z &&
            Math.abs(runtime.playerX - relic.x) < PLAYER_R + relic.radius &&
            playerClearY < relic.clearanceY
          ) {
            runtime.failMessage = 'A fractal totem clipped your run.';
            useSlipStreamStore.getState().endRun(runtime.score, runtime.failMessage);
            failed = true;
            break;
          }

          if (
            !failed &&
            prevZ < 0 &&
            relic.z >= 0 &&
            Math.abs(runtime.playerX - relic.x) < PLAYER_R + relic.radius + 0.16 &&
            playerClearY >= relic.clearanceY
          ) {
            runtime.nearMisses += 1;
            runtime.score += 2.4 + runtime.multiplier * 0.7;
            runtime.shake = Math.min(1.22, runtime.shake + 0.1);
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
      runtime.jumpBuffer = 0;
      runtime.playerVY += JUMP_GRAVITY * dt;
      runtime.playerY = Math.max(0, runtime.playerY + runtime.playerVY * dt);
      if (runtime.playerY === 0 && runtime.playerVY < 0) {
        runtime.playerVY = 0;
      }
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
      2.35 + runtime.slipBlend * 0.12 + runtime.playerY * 0.1 + shakeNoiseSigned(shakeTime, 7.2) * shakeAmp * 0.24,
      5.7 - runtime.slipBlend * 0.28 + shakeNoiseSigned(shakeTime, 13.7) * shakeAmp * 0.28
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-7.5 * step.renderDt));
    camera.lookAt(runtime.playerX * 0.12, -0.12 + runtime.playerY * 0.34, -10);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = lerp(camera.fov, 38 - runtime.slipBlend * 2.4 - runtime.playerY * 0.8, 1 - Math.exp(-6 * dt));
      camera.updateProjectionMatrix();
    }

    if (playerRef.current) {
      playerRef.current.position.set(runtime.playerX, PLAYER_BASE_Y + runtime.playerY, 0.28);
      const targetRoll = clamp((runtime.targetX - runtime.playerX) * 0.22, -0.42, 0.42);
      const hopPitch = clamp(runtime.playerVY * 0.03, -0.15, 0.22);
      playerRef.current.rotation.set(Math.PI * 0.5 + hopPitch, 0, targetRoll * 0.8);
      const scale = 1 + runtime.slipBlend * 0.06 + runtime.shake * 0.03 + runtime.playerY * 0.02;
      playerRef.current.scale.set(scale, scale, scale * 1.06);
    }

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
      bgMatRef.current.uniforms.uSlip.value = runtime.slipBlend;
    }

    if (bloomRef.current) {
      bloomRef.current.intensity = lerp(0.46, 1.2, clamp(runtime.slipBlend + runtime.playerY * 0.4, 0, 1));
    }
    chromaOffset.set(0.00032 + runtime.slipBlend * 0.0013, 0);

    const updateFractalUniforms = (mat: THREE.MeshStandardMaterial | null) => {
      if (!mat) return;
      const uniforms = (mat.userData as { fractalUniforms?: FractalUniforms }).fractalUniforms;
      if (!uniforms) return;
      uniforms.uTime.value = runtime.elapsed;
      uniforms.uSlip.value = runtime.slipBlend;
    };
    updateFractalUniforms(cometMatRef.current);
    updateFractalUniforms(gustMatRef.current);
    updateFractalUniforms(relicMatRef.current);

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

        dummy.position.set(comet.x, 0.2, comet.z);
        dummy.scale.setScalar(comet.radius);
        dummy.rotation.set(runtime.elapsed * 0.75, runtime.elapsed * 1.1, runtime.elapsed * 0.58);
        dummy.updateMatrix();
        cometRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(COMET_COLOR)
          .lerp(DANGER, 0.32 + comet.tint * 0.2)
          .lerp(WHITE, clamp(0.46 + comet.tint * 0.3 + runtime.slipBlend * 0.14, 0, 0.95));
        cometRef.current.setColorAt(i, colorScratch);

        const trailLen = 1.52 + runtime.slipBlend * 0.96;
        const trailRad = 0.28 + runtime.slipBlend * 0.16;
        dummy.position.set(comet.x, 0.04, comet.z - 0.78);
        dummy.scale.set(trailRad, trailLen, trailRad);
        dummy.rotation.set(Math.PI * 0.5, 0, 0);
        dummy.updateMatrix();
        coneRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(STREAM)
          .lerp(DANGER, 0.34)
          .lerp(WHITE, clamp(0.54 + runtime.slipBlend * 0.26, 0, 0.9));
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

        dummy.position.set(gust.x, 0.12 + gust.height * 0.12, gust.z);
        dummy.scale.set(gust.width, gust.height, gust.depth);
        dummy.rotation.set(
          Math.sin(runtime.elapsed * 0.9 + gust.phase) * 0.06,
          runtime.elapsed * 0.2 + gust.phase * 0.15,
          Math.cos(runtime.elapsed * 0.8 + gust.phase) * 0.05
        );
        dummy.updateMatrix();
        gustRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(GUST_COLOR)
          .lerp(STREAM, 0.35)
          .lerp(WHITE, clamp(0.45 + gust.tint * 0.36 + runtime.slipBlend * 0.25, 0, 0.96));
        gustRef.current.setColorAt(i, colorScratch);
      }

      gustRef.current.instanceMatrix.needsUpdate = true;
      if (gustRef.current.instanceColor) gustRef.current.instanceColor.needsUpdate = true;
    }

    if (relicRef.current) {
      for (let i = 0; i < runtime.relics.length; i += 1) {
        const relic = runtime.relics[i];
        if (!relic.active) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          relicRef.current.setMatrixAt(i, dummy.matrix);
          relicRef.current.setColorAt(i, WHITE);
          continue;
        }

        dummy.position.set(relic.x, 0.18 + Math.sin(runtime.elapsed * relic.wobbleFreq + relic.phase) * 0.05, relic.z);
        dummy.scale.setScalar(relic.radius);
        dummy.rotation.set(runtime.elapsed * relic.spin, runtime.elapsed * relic.spin * 1.3, runtime.elapsed * 0.4);
        dummy.updateMatrix();
        relicRef.current.setMatrixAt(i, dummy.matrix);
        colorScratch
          .copy(RELIC_COLOR)
          .lerp(STREAM, 0.34 + relic.tint * 0.2)
          .lerp(WHITE, clamp(0.5 + relic.tint * 0.35 + runtime.slipBlend * 0.2, 0, 0.98));
        relicRef.current.setColorAt(i, colorScratch);
      }
      relicRef.current.instanceMatrix.needsUpdate = true;
      if (relicRef.current.instanceColor) relicRef.current.instanceColor.needsUpdate = true;
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
      <PerspectiveCamera makeDefault position={[0, 2.5, 6.35]} fov={38} near={0.1} far={125} />
      <color attach="background" args={[RIVER_SKY]} />
      <fog attach="fog" args={[RIVER_FOG, 16, 84]} />

      <ambientLight intensity={0.74} />
      <hemisphereLight args={['#c7feff', '#1f5d7f', 0.65]} />
      <directionalLight position={[2.6, 5.4, 3.4]} intensity={0.72} color="#f6fcff" />
      <pointLight position={[0, 3.8, 5.2]} intensity={1.05} color="#9ef8ff" distance={18} />
      <pointLight position={[0, 1.2, -7]} intensity={0.7} color="#8cffdc" distance={24} />
      <pointLight position={[0, -1.2, 4.6]} intensity={0.6} color="#ffcaa2" distance={14} />

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
                p = p * 2.02 + vec2(7.3, 2.1);
                a *= 0.52;
              }
              return v;
            }
            void main() {
              vec3 deep = vec3(0.05, 0.24, 0.40);
              vec3 mid = vec3(0.10, 0.47, 0.66);
              vec3 foam = vec3(0.34, 0.87, 0.93);
              vec3 apexGlow = vec3(0.44, 0.88, 0.95);
              vec2 uv = vUv * vec2(3.4, 12.2);
              float drift = uTime * 0.12;
              float river = fbm2(uv + vec2(drift, -drift * 0.5));
              float streaks = fbm2(uv * vec2(1.0, 1.8) - vec2(drift * 0.8, drift * 1.2));
              float foamMask = smoothstep(0.52, 0.88, river + streaks * 0.32);
              float grad = smoothstep(0.0, 1.0, vUv.y);
              float pulse = 0.5 + 0.5 * sin((vUv.y * 5.4 + uTime * 0.45) * 6.2831853);
              vec3 col = mix(deep, mid, grad * 0.72);
              col = mix(col, foam, foamMask * 0.34);
              col = mix(col, apexGlow, uSlip * (0.24 + pulse * 0.36));
              col += vec3(0.02, 0.05, 0.08) * (pulse * 0.8 + river * 0.3);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, -0.1, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[4.45, 126]} />
        <meshBasicMaterial color={TRACK_MAIN} transparent opacity={0.94} toneMapped={false} />
      </mesh>

      <mesh position={[0, -0.07, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[3.1, 126]} />
        <meshBasicMaterial
          color={TRACK_GLOW}
          transparent
          opacity={0.34}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[-(TUNNEL_HALF_W + 1.65), -0.34, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[4.2, 124]} />
        <meshBasicMaterial
          color="#5fe9ff"
          transparent
          opacity={0.64}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[TUNNEL_HALF_W + 1.65, -0.34, -34]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[4.2, 124]} />
        <meshBasicMaterial
          color="#5fe9ff"
          transparent
          opacity={0.64}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={tunnelRef} args={[undefined, undefined, TUNNEL_INSTANCE_COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={TRACK_MAIN}
          vertexColors
          emissive="#66dfff"
          emissiveIntensity={0.16}
          roughness={0.5}
          metalness={0.12}
          toneMapped={false}
        />
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
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={cometRef} args={[undefined, undefined, COMET_POOL]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          ref={cometMatRef}
          color={COMET_COLOR}
          vertexColors
          emissive="#ff8a47"
          emissiveIntensity={0.36}
          roughness={0.24}
          metalness={0.24}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={gustRef} args={[undefined, undefined, GUST_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={gustMatRef}
          color={GUST_COLOR}
          vertexColors
          emissive="#8f73ff"
          emissiveIntensity={0.32}
          roughness={0.3}
          metalness={0.16}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={relicRef} args={[undefined, undefined, RELIC_POOL]}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          ref={relicMatRef}
          color={RELIC_COLOR}
          vertexColors
          emissive="#57ffd5"
          emissiveIntensity={0.38}
          roughness={0.2}
          metalness={0.22}
          toneMapped={false}
        />
      </instancedMesh>

      <mesh ref={playerRef} position={[0, 0.08, 0.28]} rotation={[Math.PI * 0.5, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.54, 16]} />
        <meshPhysicalMaterial
          color="#f3c086"
          emissive="#c78546"
          emissiveIntensity={0.24}
          roughness={0.3}
          metalness={0.09}
          clearcoat={0.42}
          clearcoatRoughness={0.35}
        />
      </mesh>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom ref={bloomRef} intensity={0.58} luminanceThreshold={0.36} luminanceSmoothing={0.24} mipmapBlur />
        <ChromaticAberration offset={chromaOffset} radialModulation modulationOffset={0.44} />
        <Vignette eskil={false} offset={0.09} darkness={0.56} />
        <Noise premultiply opacity={0.022} />
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
      dpr={[1, 1.45]}
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
