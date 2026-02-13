'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Html,
  MeshReflectorMaterial,
  MeshTransmissionMaterial,
  Stars,
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useAudioState, useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';
import { comboIntensity, getMultiBallCount, smashHitState } from './state';

export { smashHitState } from './state';

const COLS = 5;
const ROWS = 3;
const BLOCKS_PER_BARRIER = COLS * ROWS;

const MAX_BARRIERS = 84;
const MAX_BLOCKS = MAX_BARRIERS * BLOCKS_PER_BARRIER;

const MAX_PROJECTILES = 72;
const MAX_SHARDS = 640;
const MAX_HIT_FX = 220;

const ROOM_LENGTH = 34;
const ROOMS_AHEAD = 3;
const CLEANUP_BEHIND_ROOMS = 2;

const START_Z = 8;
const START_SPAWN_Z = -20;

const CORRIDOR_W = 10.2;
const CORRIDOR_H = 6.6;
const CORRIDOR_DEPTH = 260;

const BLOCK_SIZE = 1.32;
const BLOCK_THICKNESS = 0.18;

const SHOT_RADIUS = 0.15;
const SHOT_SPEED = 42;
const SHOT_TTL = 3.2;

const BASE_SPEED = 10.5;
const MAX_SPEED = 24;
const FIRE_INTERVAL_BASE = 0.13;

const FIXED_STEP = 1 / 120;
const MAX_SIM_STEPS = 8;

const SHARD_TTL = 2.0;
const HIT_FX_TTL = 0.22;

const SPACING_MIN = 7.4;
const SPACING_MAX = 10.8;
const INTRO_SPAWN_BUFFER = 12;

const BREACH_AMMO_PENALTY_BASE = 6;
const BREACH_AMMO_PENALTY_PER_BLOCK = 2;

const GLASS_PHYSICS = {
  restitution: 0.8,
  friction: 0.05,
  density: 0.2,
  linearDamping: 0.15,
  angularDamping: 0.35,
  impulseThreshold: 6.5,
  shardTTL: 2.0,
} as const;

const STONE_PHYSICS = {
  restitution: 0.2,
  friction: 0.8,
  density: 3.0,
  linearDamping: 0.6,
  angularDamping: 0.9,
  impulseThreshold: Number.POSITIVE_INFINITY,
} as const;

const BALL_PHYSICS = {
  restitution: 0.95,
  friction: 0.01,
  density: 1.0,
  linearDamping: 0.01,
  angularDamping: 0.05,
  ccd: true,
} as const;

const EVT = {
  GLASS_HIT: 1,
  CRYSTAL_HIT: 2,
  PENALTY_HIT: 3,
  GAME_OVER: 4,
  ROOM_ADVANCE: 5,
  BEAT: 6,
} as const;

const MAX_EVENTS = 512;

const QUALITY_PRESETS = {
  low: {
    bloom: false,
    chromatic: false,
    noise: false,
    vignette: false,
    reflectiveFloor: false,
    transmission: false,
    shardNormal: 7,
    shardHero: 12,
    crackGlow: 0.55,
    transmissionSamples: 2,
    transmissionResolution: 128,
  },
  medium: {
    bloom: true,
    chromatic: true,
    noise: true,
    vignette: true,
    reflectiveFloor: true,
    transmission: true,
    shardNormal: 10,
    shardHero: 18,
    crackGlow: 0.8,
    transmissionSamples: 4,
    transmissionResolution: 192,
  },
  high: {
    bloom: true,
    chromatic: true,
    noise: true,
    vignette: true,
    reflectiveFloor: true,
    transmission: true,
    shardNormal: 12,
    shardHero: 24,
    crackGlow: 1.05,
    transmissionSamples: 6,
    transmissionResolution: 256,
  },
} as const;

const THEMES = [
  {
    name: 'Azure Pulse',
    bpm: 108,
    fogNear: 14,
    fogFar: 98,
    bg: '#06111a',
    fog: '#5cb8ff',
    corridor: '#65d4ff',
    bloom: '#7dd3fc',
  },
  {
    name: 'Violet Drift',
    bpm: 112,
    fogNear: 14,
    fogFar: 94,
    bg: '#12061f',
    fog: '#a78bfa',
    corridor: '#a5b4fc',
    bloom: '#c4b5fd',
  },
  {
    name: 'Solar Magenta',
    bpm: 118,
    fogNear: 15,
    fogFar: 92,
    bg: '#170712',
    fog: '#f472b6',
    corridor: '#fb7185',
    bloom: '#f9a8d4',
  },
  {
    name: 'Neon Lime',
    bpm: 122,
    fogNear: 16,
    fogFar: 90,
    bg: '#081a0f',
    fog: '#4ade80',
    corridor: '#86efac',
    bloom: '#bbf7d0',
  },
  {
    name: 'Amber Rush',
    bpm: 126,
    fogNear: 16,
    fogFar: 88,
    bg: '#1b1105',
    fog: '#f59e0b',
    corridor: '#fcd34d',
    bloom: '#fde68a',
  },
  {
    name: 'Crimson Rail',
    bpm: 130,
    fogNear: 16,
    fogFar: 86,
    bg: '#1c0608',
    fog: '#ef4444',
    corridor: '#f87171',
    bloom: '#fca5a5',
  },
  {
    name: 'Cyan Abyss',
    bpm: 132,
    fogNear: 18,
    fogFar: 90,
    bg: '#041117',
    fog: '#22d3ee',
    corridor: '#67e8f9',
    bloom: '#a5f3fc',
  },
  {
    name: 'Rose Quartz',
    bpm: 136,
    fogNear: 16,
    fogFar: 84,
    bg: '#160a13',
    fog: '#fb7185',
    corridor: '#fda4af',
    bloom: '#fecdd3',
  },
  {
    name: 'Polar Night',
    bpm: 98,
    fogNear: 18,
    fogFar: 108,
    bg: '#05070f',
    fog: '#93c5fd',
    corridor: '#bfdbfe',
    bloom: '#dbeafe',
  },
  {
    name: 'Ion Storm',
    bpm: 140,
    fogNear: 15,
    fogFar: 82,
    bg: '#070f1d',
    fog: '#60a5fa',
    corridor: '#38bdf8',
    bloom: '#7dd3fc',
  },
  {
    name: 'Golden Rift',
    bpm: 124,
    fogNear: 16,
    fogFar: 86,
    bg: '#181006',
    fog: '#fbbf24',
    corridor: '#fcd34d',
    bloom: '#fef08a',
  },
] as const;

const THEME_COLORS = THEMES.map((theme) => ({
  bg: new THREE.Color(theme.bg),
  fog: new THREE.Color(theme.fog),
  corridor: new THREE.Color(theme.corridor),
  bloom: new THREE.Color(theme.bloom),
}));

type ThemeGameplayTuning = {
  speedMul: number;
  holeBias: number;
  stoneBias: number;
  crystalBias: number;
  clearScoreMul: number;
  hitScoreMul: number;
  crystalScoreMul: number;
  penaltyMul: number;
  driftMul: number;
};

const THEME_GAMEPLAY: ThemeGameplayTuning[] = [
  {
    speedMul: 0.98,
    holeBias: 0.05,
    stoneBias: -0.04,
    crystalBias: 0.08,
    clearScoreMul: 1.0,
    hitScoreMul: 1.0,
    crystalScoreMul: 1.02,
    penaltyMul: 0.96,
    driftMul: 0.9,
  },
  {
    speedMul: 1.0,
    holeBias: 0.03,
    stoneBias: -0.02,
    crystalBias: 0.05,
    clearScoreMul: 1.04,
    hitScoreMul: 1.04,
    crystalScoreMul: 1.08,
    penaltyMul: 1.0,
    driftMul: 0.95,
  },
  {
    speedMul: 1.03,
    holeBias: -0.01,
    stoneBias: 0.04,
    crystalBias: -0.03,
    clearScoreMul: 1.1,
    hitScoreMul: 1.12,
    crystalScoreMul: 1.05,
    penaltyMul: 1.05,
    driftMul: 1.02,
  },
  {
    speedMul: 0.97,
    holeBias: 0.06,
    stoneBias: -0.08,
    crystalBias: 0.14,
    clearScoreMul: 0.96,
    hitScoreMul: 0.98,
    crystalScoreMul: 1.12,
    penaltyMul: 0.9,
    driftMul: 0.88,
  },
  {
    speedMul: 1.05,
    holeBias: -0.03,
    stoneBias: 0.05,
    crystalBias: -0.01,
    clearScoreMul: 1.16,
    hitScoreMul: 1.14,
    crystalScoreMul: 1.06,
    penaltyMul: 1.08,
    driftMul: 1.04,
  },
  {
    speedMul: 1.08,
    holeBias: -0.07,
    stoneBias: 0.1,
    crystalBias: -0.08,
    clearScoreMul: 1.18,
    hitScoreMul: 1.22,
    crystalScoreMul: 1.0,
    penaltyMul: 1.14,
    driftMul: 1.08,
  },
  {
    speedMul: 1.01,
    holeBias: 0.02,
    stoneBias: 0.03,
    crystalBias: 0.04,
    clearScoreMul: 1.08,
    hitScoreMul: 1.1,
    crystalScoreMul: 1.1,
    penaltyMul: 1.0,
    driftMul: 1.2,
  },
  {
    speedMul: 0.99,
    holeBias: 0.04,
    stoneBias: -0.03,
    crystalBias: 0.09,
    clearScoreMul: 1.02,
    hitScoreMul: 1.0,
    crystalScoreMul: 1.12,
    penaltyMul: 0.94,
    driftMul: 0.92,
  },
  {
    speedMul: 0.95,
    holeBias: -0.02,
    stoneBias: 0.06,
    crystalBias: 0.0,
    clearScoreMul: 1.08,
    hitScoreMul: 1.12,
    crystalScoreMul: 1.02,
    penaltyMul: 1.06,
    driftMul: 1.0,
  },
  {
    speedMul: 1.1,
    holeBias: -0.06,
    stoneBias: 0.09,
    crystalBias: -0.05,
    clearScoreMul: 1.22,
    hitScoreMul: 1.24,
    crystalScoreMul: 1.0,
    penaltyMul: 1.12,
    driftMul: 1.14,
  },
  {
    speedMul: 1.02,
    holeBias: 0.01,
    stoneBias: 0.01,
    crystalBias: 0.07,
    clearScoreMul: 1.14,
    hitScoreMul: 1.1,
    crystalScoreMul: 1.12,
    penaltyMul: 1.0,
    driftMul: 0.98,
  },
];

const COLOR_WHITE = new THREE.Color('#ffffff');
const COLOR_BASE_GLASS = new THREE.Color('#e6f1ff');
const COLOR_STONE = new THREE.Color('#6b7280');
const COLOR_DANGER = new THREE.Color('#fca5a5');
const COLOR_SHARD_FALLBACK = new THREE.Color('#dbeafe');
const COLOR_CRYSTAL_3 = new THREE.Color('#67e8f9');
const COLOR_CRYSTAL_5 = new THREE.Color('#93c5fd');
const COLOR_CRYSTAL_10 = new THREE.Color('#fde047');

type Barrier = {
  active: boolean;
  roomIndex: number;
  z: number;
  passed: boolean;
  themeIndex: number;
  color: THREE.Color;
  crystalActive: boolean;
  crystalX: number;
  crystalY: number;
  crystalValue: number;
  archetype: RoomArchetype;
  clearBonus: number;
  breachPenaltyMul: number;
  driftAmp: number;
  driftYAmp: number;
  driftSpeed: number;
  driftPhase: number;
};

type Projectile = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
};

type Shard = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  scale: number;
  color: THREE.Color;
};

type HitFx = {
  active: boolean;
  pos: THREE.Vector3;
  life: number;
  size: number;
  color: THREE.Color;
};

type DynamicShardRequest = {
  id: number;
  width: number;
  height: number;
  thickness: number;
  impact: { x: number; y: number };
  shardCount: number;
  seed: number;
};

type DynamicShardResult = {
  id: number;
  positions: Float32Array;
  indices: Uint16Array;
  centers: Float32Array;
};

type PendingDynamicShard = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: THREE.Color;
  maxCount: number;
};

type RoomStats = {
  targets: number;
  cleared: number;
  breaches: number;
  crystals: number;
  themeIndex: number;
  archetype: RoomArchetype;
};

type RoomArchetype =
  | 'calm'
  | 'lane'
  | 'split'
  | 'cross'
  | 'weave'
  | 'fortress'
  | 'gauntlet';

const ROOM_ARCHETYPE_LABEL: Record<RoomArchetype, string> = {
  calm: 'Calm Flow',
  lane: 'Lane Control',
  split: 'Split Gates',
  cross: 'Crossfield',
  weave: 'Weave Drift',
  fortress: 'Fortress',
  gauntlet: 'Gauntlet',
};

type RoomArchetypeProfile = {
  holeBias: number;
  stoneBias: number;
  heroBias: number;
  crystalBias: number;
  clearBonus: number;
  breachPenaltyMul: number;
  speedBase: number;
  speedRamp: number;
  driftX: [number, number];
  driftY: [number, number];
  driftSpeed: [number, number];
};

const ROOM_PROFILE: Record<RoomArchetype, RoomArchetypeProfile> = {
  calm: {
    holeBias: 0.08,
    stoneBias: -0.08,
    heroBias: 0.03,
    crystalBias: 0.15,
    clearBonus: 26,
    breachPenaltyMul: 0.86,
    speedBase: 0.97,
    speedRamp: 0.005,
    driftX: [0, 0.06],
    driftY: [0, 0.04],
    driftSpeed: [0.45, 0.75],
  },
  lane: {
    holeBias: -0.05,
    stoneBias: 0.02,
    heroBias: 0.04,
    crystalBias: 0.04,
    clearBonus: 32,
    breachPenaltyMul: 1.0,
    speedBase: 1.0,
    speedRamp: 0.008,
    driftX: [0.02, 0.16],
    driftY: [0, 0.08],
    driftSpeed: [0.55, 0.95],
  },
  split: {
    holeBias: -0.08,
    stoneBias: 0.04,
    heroBias: 0.05,
    crystalBias: 0.02,
    clearBonus: 36,
    breachPenaltyMul: 1.04,
    speedBase: 1.02,
    speedRamp: 0.01,
    driftX: [0.05, 0.2],
    driftY: [0.01, 0.1],
    driftSpeed: [0.65, 1.05],
  },
  cross: {
    holeBias: -0.1,
    stoneBias: 0.07,
    heroBias: 0.06,
    crystalBias: -0.02,
    clearBonus: 40,
    breachPenaltyMul: 1.08,
    speedBase: 1.04,
    speedRamp: 0.01,
    driftX: [0.04, 0.18],
    driftY: [0.02, 0.12],
    driftSpeed: [0.7, 1.1],
  },
  weave: {
    holeBias: -0.06,
    stoneBias: 0.1,
    heroBias: 0.05,
    crystalBias: 0.01,
    clearBonus: 44,
    breachPenaltyMul: 1.12,
    speedBase: 1.06,
    speedRamp: 0.012,
    driftX: [0.08, 0.28],
    driftY: [0.02, 0.12],
    driftSpeed: [0.85, 1.25],
  },
  fortress: {
    holeBias: -0.14,
    stoneBias: 0.14,
    heroBias: 0.08,
    crystalBias: -0.06,
    clearBonus: 52,
    breachPenaltyMul: 1.18,
    speedBase: 1.08,
    speedRamp: 0.012,
    driftX: [0.02, 0.16],
    driftY: [0.02, 0.1],
    driftSpeed: [0.75, 1.15],
  },
  gauntlet: {
    holeBias: -0.2,
    stoneBias: 0.18,
    heroBias: 0.1,
    crystalBias: -0.08,
    clearBonus: 62,
    breachPenaltyMul: 1.24,
    speedBase: 1.12,
    speedRamp: 0.014,
    driftX: [0.1, 0.34],
    driftY: [0.04, 0.14],
    driftSpeed: [0.95, 1.35],
  },
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothLerp = (
  current: number,
  target: number,
  dt: number,
  speed: number
) => {
  const t = 1 - Math.pow(0.001, dt * speed);
  return lerp(current, target, t);
};

const hiddenPosition = new THREE.Vector3(0, -9999, 0);
const tinyScale = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const CELL_LOCAL_POS: Array<{ x: number; y: number }> = (() => {
  const arr: Array<{ x: number; y: number }> = [];
  const x0 = (COLS - 1) / 2;
  const y0 = (ROWS - 1) / 2;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      arr.push({
        x: (c - x0) * BLOCK_SIZE,
        y: (r - y0) * BLOCK_SIZE,
      });
    }
  }
  return arr;
})();

function hashInt(seed: number, n: number) {
  let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function themeIndexForRoom(seed: number, roomIndex: number) {
  return hashInt(seed * 3 + 17, roomIndex) % THEMES.length;
}

function roomArchetypeFor(seed: number, roomIndex: number): RoomArchetype {
  if (roomIndex <= 0) return 'calm';
  const roll = (hashInt(seed * 11 + 71, roomIndex) % 1000) / 1000;
  const phase = Math.floor(roomIndex / 4);

  if (phase <= 1) {
    if (roll < 0.58) return 'calm';
    if (roll < 0.82) return 'lane';
    return 'split';
  }
  if (phase <= 3) {
    if (roll < 0.2) return 'calm';
    if (roll < 0.42) return 'lane';
    if (roll < 0.62) return 'split';
    if (roll < 0.8) return 'cross';
    return 'weave';
  }
  if (roll < 0.16) return 'lane';
  if (roll < 0.32) return 'split';
  if (roll < 0.5) return 'cross';
  if (roll < 0.7) return 'weave';
  if (roll < 0.86) return 'fortress';
  return 'gauntlet';
}

function roomSpeedMultiplier(archetype: RoomArchetype, difficulty: number) {
  const profile = ROOM_PROFILE[archetype];
  return clamp(profile.speedBase + difficulty * profile.speedRamp, 0.92, 1.25);
}

function requiredPattern(
  difficulty: number,
  rng: SeededRandom,
  archetype: RoomArchetype,
  barrierIndex: number
): number[] {
  const center = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
  const left = center - 1;
  const right = center + 1;
  const up = center - COLS;
  const down = center + COLS;
  const row = (r: number) =>
    new Array(COLS).fill(0).map((_, c) => r * COLS + c);
  const col = (c: number) =>
    new Array(ROWS).fill(0).map((_, r) => r * COLS + c);
  const dedupe = (arr: number[]) =>
    [...new Set(arr)].filter((i) => i >= 0 && i < BLOCKS_PER_BARRIER);

  if (archetype === 'calm') {
    if (difficulty < 1) return [center];
    if (difficulty < 2) return rng.bool(0.5) ? [center, left] : [center, right];
    return rng.bool(0.5) ? [center, left, right] : [center, up, down];
  }

  if (archetype === 'lane') {
    const laneCol = clamp(2 + rng.int(-1, 1), 0, COLS - 1);
    const lane = col(laneCol);
    if (difficulty < 2) return [lane[1]];
    if (difficulty < 4) return dedupe([lane[0], lane[1]]);
    return dedupe(lane);
  }

  if (archetype === 'split') {
    const midRow = Math.floor(ROWS / 2) * COLS;
    const leftGate = midRow + 1;
    const rightGate = midRow + 3;
    if (difficulty < 3) return [leftGate, rightGate];
    return dedupe([leftGate, rightGate, center]);
  }

  if (archetype === 'cross') {
    const cross = dedupe([center, left, right, up, down]);
    if (difficulty < 3) return dedupe([center, left, right]);
    if (difficulty < 5 && cross.length > 4) {
      cross.splice(rng.bool(0.5) ? 1 : 2, 1);
    }
    return cross;
  }

  if (archetype === 'weave') {
    const zigA = dedupe([0, 6, 12, center]);
    const zigB = dedupe([2, 8, 14, center]);
    const pickA = (barrierIndex + difficulty) % 2 === 0;
    const zig = pickA ? zigA : zigB;
    if (difficulty < 3) return dedupe([zig[1], zig[2]]);
    return zig;
  }

  if (archetype === 'fortress') {
    const shell = dedupe([center, left, right, up, down, row(0)[0], row(0)[4]]);
    if (difficulty < 4) return dedupe([center, up, down, left]);
    return shell.slice(0, 5 + (rng.bool(0.5) ? 1 : 0));
  }

  // gauntlet
  const gauntlet = dedupe([
    center,
    left,
    right,
    up,
    down,
    row(0)[rng.int(0, 4)],
    row(2)[rng.int(0, 4)],
  ]);
  if (difficulty < 5) return gauntlet.slice(0, 4);
  return gauntlet.slice(0, 5 + (rng.bool(0.45) ? 1 : 0));
}

function makeShotDirection(pointerX: number, pointerY: number, spread = 0) {
  const dir = new THREE.Vector3(
    pointerX * 0.52 + spread,
    pointerY * 0.34 + spread * 0.18,
    -1
  );
  dir.normalize();
  return dir;
}

function pickCrystalValue(rng: SeededRandom) {
  const r = rng.random();
  if (r < 0.62) return 3;
  if (r < 0.9) return 5;
  return 10;
}

function makeEventBus() {
  return {
    type: new Int16Array(MAX_EVENTS),
    a: new Float32Array(MAX_EVENTS),
    b: new Float32Array(MAX_EVENTS),
    c: new Float32Array(MAX_EVENTS),
    write: 0,
    read: 0,
  };
}

function emitEvent(
  bus: ReturnType<typeof makeEventBus>,
  type: number,
  a = 0,
  b = 0,
  c = 0
) {
  const i = bus.write % MAX_EVENTS;
  bus.type[i] = type;
  bus.a[i] = a;
  bus.b[i] = b;
  bus.c[i] = c;
  bus.write += 1;
  if (bus.write - bus.read > MAX_EVENTS) {
    bus.read = bus.write - MAX_EVENTS;
  }
}

function SmashHit() {
  const snap = useSnapshot(smashHitState);
  const { paused } = useGameUIState();
  const { soundsOn } = useAudioState();

  const input = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'r', 'R'],
  });
  const { camera, scene, gl } = useThree();

  const corridorRef = useRef<THREE.Mesh>(null);
  const floorRef = useRef<THREE.Mesh>(null);

  const glassRef = useRef<THREE.InstancedMesh>(null);
  const stoneRef = useRef<THREE.InstancedMesh>(null);
  const crackRef = useRef<THREE.InstancedMesh>(null);
  const crystalRef = useRef<THREE.InstancedMesh>(null);

  const shotsRef = useRef<THREE.InstancedMesh>(null);
  const shardsRef = useRef<THREE.InstancedMesh>(null);
  const hitFxRef = useRef<THREE.InstancedMesh>(null);
  const impactFlashRef = useRef<THREE.Mesh>(null);
  const bloomRef = useRef<{ intensity: number } | null>(null);
  const dynamicShardWorkerRef = useRef<Worker | null>(null);
  const dynamicShardPendingRef = useRef<Map<number, PendingDynamicShard>>(
    new Map()
  );

  const [showDev, setShowDev] = useState(false);

  const world = useRef({
    seed: snap.seed,
    rng: new SeededRandom(snap.seed),

    dummy: new THREE.Object3D(),
    tempColorA: new THREE.Color(),
    tempColorB: new THREE.Color(),
    tempColorC: new THREE.Color(),
    sceneBg: new THREE.Color(THEMES[0].bg),
    sceneFogColor: new THREE.Color(THEMES[0].fog),
    sceneFog: new THREE.Fog(
      new THREE.Color(THEMES[0].fog),
      THEMES[0].fogNear,
      THEMES[0].fogFar
    ),

    accumulator: 0,
    simTime: 0,

    cameraZ: START_Z,
    cameraX: 0,
    cameraY: 0,
    cameraShake: 0,
    bloomPunch: 0,
    flashAlpha: 0,

    speed: BASE_SPEED,
    distance: 0,

    currentRoom: 0,
    maxGeneratedRoom: -1,

    barriers: Array.from(
      { length: MAX_BARRIERS },
      (): Barrier => ({
        active: false,
        roomIndex: -999,
        z: 0,
        passed: false,
        themeIndex: 0,
        color: new THREE.Color('#67e8f9'),
        crystalActive: false,
        crystalX: 0,
        crystalY: 0,
        crystalValue: 3,
        archetype: 'calm',
        clearBonus: 30,
        breachPenaltyMul: 1,
        driftAmp: 0,
        driftYAmp: 0,
        driftSpeed: 0.6,
        driftPhase: 0,
      })
    ),

    blockAlive: new Array<boolean>(MAX_BLOCKS).fill(false),
    blockRequired: new Array<boolean>(MAX_BLOCKS).fill(false),
    blockStone: new Array<boolean>(MAX_BLOCKS).fill(false),
    blockHero: new Array<boolean>(MAX_BLOCKS).fill(false),

    blockBaseX: new Float32Array(MAX_BLOCKS),
    blockBaseY: new Float32Array(MAX_BLOCKS),
    blockX: new Float32Array(MAX_BLOCKS),
    blockY: new Float32Array(MAX_BLOCKS),
    blockZ: new Float32Array(MAX_BLOCKS),
    barrierDriftX: new Float32Array(MAX_BARRIERS),
    barrierDriftY: new Float32Array(MAX_BARRIERS),

    blockCrack: new Float32Array(MAX_BLOCKS),
    blockDelayFrames: new Uint8Array(MAX_BLOCKS),

    blockHitX: new Float32Array(MAX_BLOCKS),
    blockHitY: new Float32Array(MAX_BLOCKS),
    blockHitZ: new Float32Array(MAX_BLOCKS),
    blockHitVx: new Float32Array(MAX_BLOCKS),
    blockHitVy: new Float32Array(MAX_BLOCKS),
    blockHitVz: new Float32Array(MAX_BLOCKS),

    projectiles: Array.from(
      { length: MAX_PROJECTILES },
      (): Projectile => ({
        active: false,
        pos: new THREE.Vector3(0, 0, 0),
        vel: new THREE.Vector3(0, 0, -1),
        life: 0,
      })
    ),
    projectileCursor: 0,

    shards: Array.from(
      { length: MAX_SHARDS },
      (): Shard => ({
        active: false,
        pos: new THREE.Vector3(0, 0, 0),
        vel: new THREE.Vector3(0, 0, 0),
        rot: new THREE.Vector3(0, 0, 0),
        spin: new THREE.Vector3(0, 0, 0),
        life: 0,
        scale: 0.1,
        color: new THREE.Color('#dbeafe'),
      })
    ),
    shardCursor: 0,

    hitFx: Array.from(
      { length: MAX_HIT_FX },
      (): HitFx => ({
        active: false,
        pos: new THREE.Vector3(0, 0, 0),
        life: 0,
        size: 0.2,
        color: new THREE.Color('#ffffff'),
      })
    ),
    hitFxCursor: 0,

    eventBus: makeEventBus(),

    themeFrom: 0,
    themeTo: 0,
    themeT: 1,
    pendingTheme: -1,

    beatClock: 0,
    beatInterval: 60 / THEMES[0].bpm,
    currentRoomArchetype: 'calm' as RoomArchetype,
    currentRoomSpeedMul: 1,
    currentThemeTuning: THEME_GAMEPLAY[0],
    flawlessRoomStreak: 0,
    lastFinalizedRoom: -1,
    roomStats: new Map<number, RoomStats>(),
    finalizedRooms: new Set<number>(),

    spaceWasDown: false,
    fireCooldown: 0,

    smoothedFps: 60,
    lowFpsTime: 0,
    highFpsTime: 0,

    audioCtx: null as AudioContext | null,
    audioGain: null as GainNode | null,

    dynamicShardReqId: 0,
  });

  const tierCfg = QUALITY_PRESETS[snap.qualityTier] ?? QUALITY_PRESETS.high;

  const ensureAudio = () => {
    const w = world.current;
    if (!soundsOn) return;
    if (typeof window === 'undefined') return;

    if (!w.audioCtx) {
      const globalWithWebkit = globalThis as typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx =
        globalThis.AudioContext ?? globalWithWebkit.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.16;
      gainNode.connect(ctx.destination);
      w.audioCtx = ctx;
      w.audioGain = gainNode;
    }

    if (w.audioCtx && w.audioCtx.state === 'suspended') {
      w.audioCtx.resume().catch(() => undefined);
    }
  };

  const playTone = (
    freq: number,
    duration: number,
    type: OscillatorType,
    gain = 0.11
  ) => {
    const w = world.current;
    if (!soundsOn) return;
    if (!w.audioCtx || !w.audioGain) return;

    const t0 = w.audioCtx.currentTime;
    const osc = w.audioCtx.createOscillator();
    const amp = w.audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(amp);
    amp.connect(w.audioGain);

    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  };

  const playNoiseBurst = (duration = 0.08, gain = 0.06) => {
    const w = world.current;
    if (!soundsOn) return;
    if (!w.audioCtx || !w.audioGain) return;

    const frameCount = Math.floor(w.audioCtx.sampleRate * duration);
    const buffer = w.audioCtx.createBuffer(
      1,
      frameCount,
      w.audioCtx.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }

    const source = w.audioCtx.createBufferSource();
    source.buffer = buffer;

    const amp = w.audioCtx.createGain();
    const t0 = w.audioCtx.currentTime;
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    source.connect(amp);
    amp.connect(w.audioGain);
    source.start(t0);
  };

  const hideInstance = (mesh: THREE.InstancedMesh, index: number) => {
    const w = world.current;
    w.dummy.position.copy(hiddenPosition);
    w.dummy.scale.copy(tinyScale);
    w.dummy.rotation.set(0, 0, 0);
    w.dummy.updateMatrix();
    mesh.setMatrixAt(index, w.dummy.matrix);
  };

  const deactivateBarrier = (slot: number) => {
    const w = world.current;
    const barrier = w.barriers[slot];
    barrier.active = false;
    barrier.passed = false;
    barrier.crystalActive = false;
    w.barrierDriftX[slot] = 0;
    w.barrierDriftY[slot] = 0;

    const blockBase = slot * BLOCKS_PER_BARRIER;
    for (let i = 0; i < BLOCKS_PER_BARRIER; i += 1) {
      const blockIdx = blockBase + i;
      w.blockAlive[blockIdx] = false;
      w.blockRequired[blockIdx] = false;
      w.blockStone[blockIdx] = false;
      w.blockHero[blockIdx] = false;
      w.blockCrack[blockIdx] = 0;
      w.blockDelayFrames[blockIdx] = 0;
    }
  };

  const allocateBarrierSlot = () => {
    const w = world.current;

    for (let i = 0; i < MAX_BARRIERS; i += 1) {
      if (!w.barriers[i].active) return i;
    }

    let oldestIndex = 0;
    let oldestRoom = Number.POSITIVE_INFINITY;
    for (let i = 0; i < MAX_BARRIERS; i += 1) {
      const roomIndex = w.barriers[i].roomIndex;
      if (roomIndex < oldestRoom) {
        oldestRoom = roomIndex;
        oldestIndex = i;
      }
    }

    deactivateBarrier(oldestIndex);
    return oldestIndex;
  };

  const spawnHitFx = (
    x: number,
    y: number,
    z: number,
    color: THREE.Color,
    size = 0.25
  ) => {
    const w = world.current;
    const fx = w.hitFx[w.hitFxCursor % MAX_HIT_FX];
    w.hitFxCursor += 1;

    fx.active = true;
    fx.life = HIT_FX_TTL;
    fx.size = size;
    fx.pos.set(x, y, z);
    fx.color.copy(color);
  };

  const spawnShard = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    scale: number,
    color: THREE.Color
  ) => {
    const w = world.current;
    const shard = w.shards[w.shardCursor % MAX_SHARDS];
    w.shardCursor += 1;

    shard.active = true;
    shard.life = SHARD_TTL * (0.72 + w.rng.random() * 0.45);
    shard.pos.set(x, y, z);
    shard.vel.set(vx, vy, vz);
    shard.rot.set(
      w.rng.float(0, Math.PI),
      w.rng.float(0, Math.PI),
      w.rng.float(0, Math.PI)
    );
    shard.spin.set(w.rng.float(-8, 8), w.rng.float(-8, 8), w.rng.float(-8, 8));
    shard.scale = scale;
    shard.color.copy(color);
  };

  const spawnVoronoiStyleShards = (
    centerX: number,
    centerY: number,
    centerZ: number,
    inVx: number,
    inVy: number,
    inVz: number,
    count: number,
    color: THREE.Color
  ) => {
    const w = world.current;
    const slices = Math.max(6, Math.min(24, count));
    const radius = 0.62;

    for (let i = 0; i < slices; i += 1) {
      const angle = (i / slices) * Math.PI * 2 + w.rng.float(-0.18, 0.18);
      const ring = radius * (0.45 + w.rng.random() * 0.65);
      const dirX = Math.cos(angle) * ring;
      const dirY = Math.sin(angle) * ring;
      const dirZ = w.rng.float(-0.45, 0.25);

      const areaWeight = 0.6 + w.rng.random() * 0.8;
      const scale = 0.035 + 0.06 * areaWeight;

      spawnShard(
        centerX + dirX * 0.05,
        centerY + dirY * 0.05,
        centerZ,
        dirX * (5.5 + w.rng.random() * 2.5) + inVx * 0.08,
        dirY * (5.5 + w.rng.random() * 2.5) + inVy * 0.08,
        dirZ * (6 + w.rng.random() * 4) + inVz * 0.12,
        scale,
        color
      );
    }
  };

  const spawnDynamicShardsFromWorker = (
    result: DynamicShardResult,
    meta: PendingDynamicShard
  ) => {
    const w = world.current;
    const centerCount = Math.floor(result.centers.length / 3);
    const shardCount = Math.min(meta.maxCount, centerCount);
    for (let i = 0; i < shardCount; i += 1) {
      const cIdx = i * 3;
      const localX = result.centers[cIdx];
      const localY = result.centers[cIdx + 1];
      const areaWeight = result.centers[cIdx + 2];

      const dist = Math.hypot(localX, localY) + 0.001;
      const nx = localX / dist;
      const ny = localY / dist;
      const nz = w.rng.float(-0.42, 0.26);

      const launch = 4.2 + areaWeight * 5.2;
      spawnShard(
        meta.x + localX * 0.9,
        meta.y + localY * 0.9,
        meta.z,
        nx * launch + meta.vx * 0.08,
        ny * launch + meta.vy * 0.08,
        nz * launch + meta.vz * 0.14,
        0.028 + areaWeight * 0.085,
        meta.color
      );
    }
  };

  const requestDynamicShatter = (
    blockIdx: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: THREE.Color,
    shardCount: number
  ) => {
    const worker = dynamicShardWorkerRef.current;
    if (!worker) return false;

    const w = world.current;
    const requestId = w.dynamicShardReqId++;
    dynamicShardPendingRef.current.set(requestId, {
      x,
      y,
      z,
      vx,
      vy,
      vz,
      color: color.clone(),
      maxCount: Math.max(6, Math.min(28, shardCount)),
    });

    const localImpactX = clamp(
      x - w.blockX[blockIdx],
      -BLOCK_SIZE * 0.5,
      BLOCK_SIZE * 0.5
    );
    const localImpactY = clamp(
      y - w.blockY[blockIdx],
      -BLOCK_SIZE * 0.5,
      BLOCK_SIZE * 0.5
    );

    const payload: DynamicShardRequest = {
      id: requestId,
      width: BLOCK_SIZE,
      height: BLOCK_SIZE,
      thickness: BLOCK_THICKNESS,
      impact: { x: localImpactX, y: localImpactY },
      shardCount,
      seed: (w.seed ^ (blockIdx * 2654435761)) >>> 0,
    };
    worker.postMessage(payload);
    return true;
  };

  const shatterBlock = (blockIdx: number) => {
    const w = world.current;
    if (!w.blockAlive[blockIdx]) return;

    const tier =
      QUALITY_PRESETS[smashHitState.qualityTier] ?? QUALITY_PRESETS.high;

    const x = w.blockHitX[blockIdx] || w.blockX[blockIdx];
    const y = w.blockHitY[blockIdx] || w.blockY[blockIdx];
    const z = w.blockHitZ[blockIdx] || w.blockZ[blockIdx];
    const vx = w.blockHitVx[blockIdx] || 0;
    const vy = w.blockHitVy[blockIdx] || 0;
    const vz = w.blockHitVz[blockIdx] || -1;

    const barrierSlot = Math.floor(blockIdx / BLOCKS_PER_BARRIER);
    const color = w.barriers[barrierSlot]?.color ?? COLOR_SHARD_FALLBACK;

    w.blockAlive[blockIdx] = false;
    w.blockCrack[blockIdx] = 0;

    const distanceToCamera = Math.abs(z - w.cameraZ);
    const isFar = distanceToCamera > 86;
    const isMid = distanceToCamera > 42 && distanceToCamera <= 86;

    const hero = w.blockHero[blockIdx] && smashHitState.qualityTier !== 'low';
    if (isFar) {
      // Cheap far-field shatter: crack and spark only.
      spawnHitFx(x, y, z, color, 0.22);
    } else if (hero && !isMid) {
      const requested = requestDynamicShatter(
        blockIdx,
        x,
        y,
        z,
        vx,
        vy,
        vz,
        color,
        tier.shardHero
      );
      if (!requested) {
        spawnVoronoiStyleShards(x, y, z, vx, vy, vz, tier.shardHero, color);
      }
    } else {
      const shardCount = isMid
        ? Math.max(4, Math.floor(tier.shardNormal * 0.55))
        : tier.shardNormal;
      for (let i = 0; i < shardCount; i += 1) {
        spawnShard(
          x,
          y,
          z,
          w.rng.float(-4.5, 4.5) + vx * 0.08,
          w.rng.float(-4.5, 4.5) + vy * 0.08,
          w.rng.float(-6.5, 1.5) + vz * 0.12,
          0.045 + w.rng.random() * 0.055,
          color
        );
      }
    }

    spawnHitFx(x, y, z, color, 0.28);
    const themeIndex = w.barriers[barrierSlot]?.themeIndex ?? 0;
    emitEvent(
      w.eventBus,
      EVT.GLASS_HIT,
      blockIdx,
      hero && !isMid ? 1 : 0,
      themeIndex
    );
  };

  const startCrack = (
    blockIdx: number,
    hitPos: THREE.Vector3,
    vel: THREE.Vector3
  ) => {
    const w = world.current;
    if (!w.blockAlive[blockIdx]) return;
    if (w.blockDelayFrames[blockIdx] > 0) return;
    if (vel.length() < GLASS_PHYSICS.impulseThreshold) return;

    w.blockCrack[blockIdx] = 1;
    w.blockDelayFrames[blockIdx] = 1 + Math.floor(w.rng.random() * 3);

    w.blockHitX[blockIdx] = hitPos.x;
    w.blockHitY[blockIdx] = hitPos.y;
    w.blockHitZ[blockIdx] = hitPos.z;
    w.blockHitVx[blockIdx] = vel.x;
    w.blockHitVy[blockIdx] = vel.y;
    w.blockHitVz[blockIdx] = vel.z;

    const barrierSlot = Math.floor(blockIdx / BLOCKS_PER_BARRIER);
    const color = w.barriers[barrierSlot]?.color ?? COLOR_SHARD_FALLBACK;
    spawnHitFx(hitPos.x, hitPos.y, hitPos.z + 0.02, color, 0.2);
  };

  const ensureRoomStats = (
    roomIndex: number,
    themeIndex: number,
    archetype: RoomArchetype
  ) => {
    const w = world.current;
    let stats = w.roomStats.get(roomIndex);
    if (!stats) {
      stats = {
        targets: 0,
        cleared: 0,
        breaches: 0,
        crystals: 0,
        themeIndex,
        archetype,
      };
      w.roomStats.set(roomIndex, stats);
    }
    return stats;
  };

  const syncRoomRuntime = (roomIndex: number) => {
    const w = world.current;
    const themeIndex = themeIndexForRoom(w.seed, roomIndex);
    const archetype = roomArchetypeFor(w.seed, roomIndex);
    const difficulty = Math.floor(roomIndex / 3);
    const themeTuning = THEME_GAMEPLAY[themeIndex];
    const archetypeSpeed = roomSpeedMultiplier(archetype, difficulty);

    w.currentRoomArchetype = archetype;
    w.currentThemeTuning = themeTuning;
    w.currentRoomSpeedMul = clamp(
      archetypeSpeed * themeTuning.speedMul,
      0.9,
      1.28
    );
  };

  const finalizeRoom = (roomIndex: number) => {
    const w = world.current;
    if (roomIndex < 0 || w.finalizedRooms.has(roomIndex)) return;

    const stats = w.roomStats.get(roomIndex);
    w.finalizedRooms.add(roomIndex);
    if (!stats || stats.targets <= 0) return;

    const difficulty = Math.floor(roomIndex / 3);
    const completion = clamp(stats.cleared / stats.targets, 0, 1);
    const themeTuning = THEME_GAMEPLAY[stats.themeIndex];
    let bonus = 0;

    if (stats.breaches === 0 && completion >= 0.999) {
      w.flawlessRoomStreak += 1;
      bonus = Math.floor(
        (105 +
          stats.targets * 18 +
          stats.crystals * 7 +
          difficulty * 15 +
          w.flawlessRoomStreak * 22) *
          themeTuning.clearScoreMul
      );
      const ammoBonus = clamp(
        2 +
          Math.floor(stats.targets / 3) +
          Math.floor(w.flawlessRoomStreak / 2),
        2,
        8
      );
      smashHitState.addAmmo(ammoBonus);
      w.bloomPunch = Math.max(w.bloomPunch, 0.32);
      playTone(520 + Math.random() * 80, 0.12, 'triangle', 0.07);
    } else if (completion >= 0.67) {
      w.flawlessRoomStreak = 0;
      bonus = Math.floor(
        (42 + stats.cleared * 9 + stats.crystals * 4 + difficulty * 8) *
          themeTuning.clearScoreMul
      );
    } else {
      w.flawlessRoomStreak = 0;
    }

    if (bonus > 0) {
      smashHitState.addScore(bonus);
    }

    const cleanupBefore = roomIndex - (CLEANUP_BEHIND_ROOMS + 3);
    if (cleanupBefore >= 0) {
      w.roomStats.delete(cleanupBefore);
      w.finalizedRooms.delete(cleanupBefore);
    }
  };

  const spawnBarrier = (
    roomIndex: number,
    z: number,
    themeIndex: number,
    rng: SeededRandom,
    difficulty: number,
    archetype: RoomArchetype,
    barrierIndex: number
  ) => {
    const w = world.current;
    const slot = allocateBarrierSlot();
    const barrier = w.barriers[slot];
    const profile = ROOM_PROFILE[archetype];
    const themeTuning = THEME_GAMEPLAY[themeIndex];

    barrier.active = true;
    barrier.roomIndex = roomIndex;
    barrier.z = z;
    barrier.passed = false;
    barrier.themeIndex = themeIndex;
    barrier.archetype = archetype;
    barrier.clearBonus = Math.floor(
      (profile.clearBonus + difficulty * 4 + rng.int(-2, 4)) *
        themeTuning.clearScoreMul
    );
    barrier.breachPenaltyMul = profile.breachPenaltyMul * themeTuning.penaltyMul;
    barrier.driftAmp =
      rng.float(profile.driftX[0], profile.driftX[1]) *
      themeTuning.driftMul *
      clamp(0.78 + difficulty * 0.06, 0.78, 1.28);
    barrier.driftYAmp =
      rng.float(profile.driftY[0], profile.driftY[1]) *
      themeTuning.driftMul *
      clamp(0.74 + difficulty * 0.05, 0.74, 1.16);
    barrier.driftSpeed = rng.float(profile.driftSpeed[0], profile.driftSpeed[1]);
    barrier.driftPhase = rng.float(0, Math.PI * 2);
    barrier.color
      .copy(THEME_COLORS[themeIndex].corridor)
      .lerp(COLOR_WHITE, 0.15);

    const crystalChance = clamp(
      (roomIndex === 0 ? 0.64 : roomIndex === 1 ? 0.5 : 0.34) +
        profile.crystalBias +
        themeTuning.crystalBias,
      0.12,
      0.82
    );
    barrier.crystalActive = rng.bool(crystalChance);
    barrier.crystalX = rng.float(-2.3, 2.3);
    barrier.crystalY = rng.float(-1.2, 1.2);
    barrier.crystalValue = pickCrystalValue(rng);

    const required = requiredPattern(difficulty, rng, archetype, barrierIndex);

    const holeChance =
      roomIndex === 0
        ? clamp(0.68 + profile.holeBias + themeTuning.holeBias, 0.36, 0.82)
        : roomIndex === 1
          ? clamp(0.46 + profile.holeBias + themeTuning.holeBias, 0.2, 0.72)
          : clamp(
              0.13 +
                difficulty * 0.03 +
                profile.holeBias +
                themeTuning.holeBias,
              0.07,
              0.44
            );
    const stoneChance =
      roomIndex <= 1
        ? 0
        : clamp(
            0.08 +
              difficulty * 0.035 +
              profile.stoneBias +
              themeTuning.stoneBias,
            0.06,
            0.42
          );
    const heroChance =
      roomIndex <= 1
        ? clamp(0.22 + profile.heroBias * 0.5, 0.12, 0.34)
        : clamp(0.08 + difficulty * 0.02 + profile.heroBias, 0.08, 0.32);

    ensureRoomStats(roomIndex, themeIndex, archetype).targets += 1;

    const blockBase = slot * BLOCKS_PER_BARRIER;
    for (let b = 0; b < BLOCKS_PER_BARRIER; b += 1) {
      const idx = blockBase + b;
      const cell = CELL_LOCAL_POS[b];

      const isRequired = required.includes(b);
      const isStone = !isRequired && rng.bool(stoneChance);
      const alive = isRequired ? true : isStone ? true : !rng.bool(holeChance);
      const isHero = isRequired && rng.bool(heroChance);

      w.blockRequired[idx] = isRequired;
      w.blockStone[idx] = isStone;
      w.blockAlive[idx] = alive;
      w.blockHero[idx] = isHero;
      w.blockCrack[idx] = 0;
      w.blockDelayFrames[idx] = 0;

      w.blockBaseX[idx] = cell.x;
      w.blockBaseY[idx] = cell.y;
      w.blockX[idx] = cell.x;
      w.blockY[idx] = cell.y;
      w.blockZ[idx] = z;
    }
  };

  const generateRoom = (roomIndex: number) => {
    const w = world.current;
    const seed = hashInt(w.seed, roomIndex);
    const rng = new SeededRandom(seed);

    const themeIndex = themeIndexForRoom(w.seed, roomIndex);
    const archetype = roomArchetypeFor(w.seed, roomIndex);
    const profile = ROOM_PROFILE[archetype];
    const roomStartZ =
      START_SPAWN_Z - roomIndex * ROOM_LENGTH - (roomIndex === 0 ? INTRO_SPAWN_BUFFER : 0);

    const difficulty = Math.floor(roomIndex / 3);
    const densityBias =
      archetype === 'calm'
        ? -1
        : archetype === 'gauntlet'
          ? 2
          : archetype === 'fortress'
            ? 1
            : 0;
    const barrierCount =
      roomIndex === 0
        ? 2 + rng.int(0, 1)
        : clamp(
            3 +
              densityBias +
              rng.int(0, 2) +
              Math.floor(difficulty * 0.35 + profile.stoneBias * 2.4),
            3,
            7
          );

    let cursorZ =
      roomIndex === 0
        ? roomStartZ - rng.float(8.5, 11.5)
        : roomStartZ - rng.float(4.5, 7.5);

    for (let i = 0; i < barrierCount; i += 1) {
      spawnBarrier(roomIndex, cursorZ, themeIndex, rng, difficulty, archetype, i);
      cursorZ -= rng.float(SPACING_MIN, SPACING_MAX);
    }
  };

  const ensureRooms = (currentRoom: number) => {
    const w = world.current;
    const targetMax = currentRoom + ROOMS_AHEAD - 1;

    while (w.maxGeneratedRoom < targetMax) {
      const nextRoom = w.maxGeneratedRoom + 1;
      generateRoom(nextRoom);
      w.maxGeneratedRoom = nextRoom;
    }
  };

  const cleanupBehindRooms = (currentRoom: number) => {
    const cutoff = currentRoom - CLEANUP_BEHIND_ROOMS;
    if (cutoff < 0) return;

    const w = world.current;
    for (let i = 0; i < MAX_BARRIERS; i += 1) {
      const barrier = w.barriers[i];
      if (!barrier.active) continue;
      if (barrier.roomIndex < cutoff) {
        deactivateBarrier(i);
      }
    }
  };

  const resetWorld = () => {
    const w = world.current;

    w.seed = snap.seed;
    w.rng.reset(snap.seed);

    w.accumulator = 0;
    w.simTime = 0;

    w.cameraZ = START_Z;
    w.cameraX = 0;
    w.cameraY = 0;
    w.cameraShake = 0;
    w.bloomPunch = 0;
    w.flashAlpha = 0;

    w.speed = BASE_SPEED;
    w.distance = 0;

    w.currentRoom = 0;
    w.maxGeneratedRoom = -1;
    w.flawlessRoomStreak = 0;
    w.lastFinalizedRoom = -1;
    w.roomStats.clear();
    w.finalizedRooms.clear();

    for (let i = 0; i < MAX_BARRIERS; i += 1) {
      deactivateBarrier(i);
    }

    for (let i = 0; i < MAX_BLOCKS; i += 1) {
      w.blockBaseX[i] = 0;
      w.blockBaseY[i] = 0;
      w.blockX[i] = 0;
      w.blockY[i] = 0;
      w.blockZ[i] = 0;
    }

    for (let i = 0; i < MAX_PROJECTILES; i += 1) {
      const shot = w.projectiles[i];
      shot.active = false;
      shot.life = 0;
      shot.pos.set(0, 0, 0);
      shot.vel.set(0, 0, -1);
    }

    for (let i = 0; i < MAX_SHARDS; i += 1) {
      const shard = w.shards[i];
      shard.active = false;
      shard.life = 0;
      shard.pos.set(0, 0, 0);
      shard.vel.set(0, 0, 0);
      shard.rot.set(0, 0, 0);
      shard.spin.set(0, 0, 0);
      shard.scale = 0.1;
    }

    for (let i = 0; i < MAX_HIT_FX; i += 1) {
      const fx = w.hitFx[i];
      fx.active = false;
      fx.life = 0;
      fx.size = 0.2;
      fx.pos.set(0, 0, 0);
    }

    w.projectileCursor = 0;
    w.shardCursor = 0;
    w.hitFxCursor = 0;
    w.dynamicShardReqId = 0;
    dynamicShardPendingRef.current.clear();

    w.eventBus.read = 0;
    w.eventBus.write = 0;

    const t0 = themeIndexForRoom(w.seed, 0);
    w.themeFrom = t0;
    w.themeTo = t0;
    w.themeT = 1;
    w.pendingTheme = -1;
    w.beatClock = 0;
    w.beatInterval = 60 / THEMES[t0].bpm;
    w.currentRoomArchetype = roomArchetypeFor(w.seed, 0);
    w.currentThemeTuning = THEME_GAMEPLAY[t0];
    w.currentRoomSpeedMul = roomSpeedMultiplier('calm', 0) * THEME_GAMEPLAY[t0].speedMul;
    syncRoomRuntime(0);

    w.spaceWasDown = false;
    w.fireCooldown = 0;

    camera.position.set(0, 0, START_Z);
    camera.lookAt(0, 0, START_Z - 12);

    ensureAudio();

    ensureRooms(0);
    cleanupBehindRooms(0);

    if (glassRef.current) {
      for (let i = 0; i < MAX_BLOCKS; i += 1) {
        hideInstance(glassRef.current, i);
      }
      glassRef.current.instanceMatrix.needsUpdate = true;
    }

    if (stoneRef.current) {
      for (let i = 0; i < MAX_BLOCKS; i += 1) {
        hideInstance(stoneRef.current, i);
      }
      stoneRef.current.instanceMatrix.needsUpdate = true;
    }

    if (crackRef.current) {
      for (let i = 0; i < MAX_BLOCKS; i += 1) {
        hideInstance(crackRef.current, i);
      }
      crackRef.current.instanceMatrix.needsUpdate = true;
    }

    if (crystalRef.current) {
      for (let i = 0; i < MAX_BARRIERS; i += 1) {
        hideInstance(crystalRef.current, i);
      }
      crystalRef.current.instanceMatrix.needsUpdate = true;
    }

    if (shotsRef.current) {
      for (let i = 0; i < MAX_PROJECTILES; i += 1) {
        hideInstance(shotsRef.current, i);
      }
      shotsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (shardsRef.current) {
      for (let i = 0; i < MAX_SHARDS; i += 1) {
        hideInstance(shardsRef.current, i);
      }
      shardsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (hitFxRef.current) {
      for (let i = 0; i < MAX_HIT_FX; i += 1) {
        hideInstance(hitFxRef.current, i);
      }
      hitFxRef.current.instanceMatrix.needsUpdate = true;
    }
  };

  const spawnProjectile = (
    originX: number,
    originY: number,
    originZ: number,
    pointerX: number,
    pointerY: number,
    spread: number,
    cameraVelZ: number
  ) => {
    const w = world.current;
    const shot = w.projectiles[w.projectileCursor % MAX_PROJECTILES];
    w.projectileCursor += 1;

    const dir = makeShotDirection(pointerX, pointerY, spread);

    shot.active = true;
    shot.life = SHOT_TTL;
    shot.pos.set(originX, originY, originZ);
    shot.vel.copy(dir).multiplyScalar(SHOT_SPEED * BALL_PHYSICS.restitution);
    shot.vel.z += cameraVelZ;
  };

  const fireVolley = () => {
    if (smashHitState.phase !== 'playing') return false;
    if (!smashHitState.useBall(1)) return false;

    ensureAudio();
    const comboBoost = comboIntensity(smashHitState.combo);
    playTone(
      220 + comboBoost * 90 + Math.random() * 30,
      0.09,
      'triangle',
      0.08
    );

    const w = world.current;
    const count = clamp(
      smashHitState.multiball,
      1,
      getMultiBallCount(smashHitState.combo)
    );

    const spreadCenter = (count - 1) * 0.5;
    for (let i = 0; i < count; i += 1) {
      const spread = (i - spreadCenter) * 0.024;
      spawnProjectile(
        camera.position.x,
        camera.position.y,
        camera.position.z - 0.55,
        input.current.pointerX,
        input.current.pointerY,
        spread,
        -w.speed * 0.22
      );
    }

    return true;
  };

  const processEvents = () => {
    const w = world.current;
    const bus = w.eventBus;

    while (bus.read < bus.write) {
      const idx = bus.read % MAX_EVENTS;
      const type = bus.type[idx];
      const a = bus.a[idx];
      const b = bus.b[idx];
      const c = bus.c[idx];

      if (type === EVT.GLASS_HIT) {
        const themeIndex = clamp(Math.floor(c), 0, THEMES.length - 1);
        const tuning = THEME_GAMEPLAY[themeIndex];
        const hitScore = Math.floor((12 + (b > 0.5 ? 8 : 0)) * tuning.hitScoreMul);
        smashHitState.addScore(hitScore);
        w.cameraShake = Math.max(w.cameraShake, 0.15 + b * 0.14);
        w.bloomPunch = Math.max(w.bloomPunch, 0.32 + b * 0.08);
        w.flashAlpha = Math.max(w.flashAlpha, 0.25 + b * 0.1);
        playNoiseBurst(
          0.07,
          0.04 + b * 0.01 + GLASS_PHYSICS.restitution * 0.01
        );
      } else if (type === EVT.CRYSTAL_HIT) {
        const themeIndex = clamp(Math.floor(b), 0, THEMES.length - 1);
        const roomIndex = Math.floor(c);
        const tuning = THEME_GAMEPLAY[themeIndex];
        const gain = Math.max(1, Math.floor(a));
        smashHitState.onCrystalHit(gain);
        const crystalBonus = Math.floor((18 + gain * 3) * tuning.crystalScoreMul);
        smashHitState.addScore(crystalBonus);
        if (roomIndex >= 0) {
          const stats = ensureRoomStats(
            roomIndex,
            themeIndex,
            roomArchetypeFor(w.seed, roomIndex)
          );
          stats.crystals += 1;
        }
        w.cameraShake = Math.max(w.cameraShake, 0.32);
        w.bloomPunch = Math.max(w.bloomPunch, 0.28);
        const toneLift = comboIntensity(smashHitState.combo);
        playTone(720 + toneLift * 120 + Math.random() * 40, 0.12, 'sine', 0.08);
      } else if (type === EVT.PENALTY_HIT) {
        const penalty = Math.max(1, Math.floor(a || 10));
        const roomIndex = Math.floor(b);
        const themeIndex = clamp(Math.floor(c), 0, THEMES.length - 1);
        if (roomIndex >= 0) {
          const stats = ensureRoomStats(
            roomIndex,
            themeIndex,
            roomArchetypeFor(w.seed, roomIndex)
          );
          stats.breaches += 1;
        }
        smashHitState.combo = 0;
        smashHitState.multiball = 1;
        smashHitState.addAmmo(-penalty);
        w.cameraShake = Math.max(w.cameraShake, 0.45);
        w.bloomPunch = Math.max(w.bloomPunch, 0.18);
        w.flashAlpha = Math.max(w.flashAlpha, 0.2);
        playTone(120, 0.18, 'sawtooth', 0.07 + STONE_PHYSICS.friction * 0.035);
        if (smashHitState.ammo <= 0) {
          emitEvent(w.eventBus, EVT.GAME_OVER, 0, 0, 0);
        }
      } else if (type === EVT.GAME_OVER) {
        smashHitState.endGame();
        w.cameraShake = Math.max(w.cameraShake, 0.7);
        w.bloomPunch = Math.max(w.bloomPunch, 0.44);
        w.flashAlpha = Math.max(w.flashAlpha, 0.34);
        playTone(78, 0.32, 'square', 0.1);
      } else if (type === EVT.ROOM_ADVANCE) {
        const roomIndex = Math.floor(a);
        smashHitState.setRoomIndex(roomIndex);
        const nextTheme = Math.floor(b);
        w.pendingTheme = nextTheme;
      } else if (type === EVT.BEAT) {
        if (w.pendingTheme >= 0 && w.pendingTheme !== w.themeTo) {
          w.themeFrom = w.themeTo;
          w.themeTo = w.pendingTheme;
          w.themeT = 0;
          w.pendingTheme = -1;
          w.beatInterval = 60 / THEMES[w.themeTo].bpm;

          playTone(310 + Math.random() * 30, 0.08, 'triangle', 0.06);
        }
      }

      bus.read += 1;
    }

    if (bus.read === bus.write) {
      bus.read = 0;
      bus.write = 0;
    }
  };

  const simulateFixed = (step: number) => {
    const w = world.current;

    if (smashHitState.phase !== 'playing') return;

    w.simTime += step;

    syncRoomRuntime(w.currentRoom);

    const speedRamp = Math.min(
      MAX_SPEED - BASE_SPEED,
      smashHitState.score * 0.0035 + w.distance * 0.0028
    );
    w.speed = clamp(
      (BASE_SPEED + speedRamp) * w.currentRoomSpeedMul,
      BASE_SPEED * 0.9,
      MAX_SPEED * 1.14
    );

    w.cameraZ -= w.speed * step;
    w.distance = START_Z - w.cameraZ;

    const roomNow = Math.floor(Math.max(0, w.distance / ROOM_LENGTH));
    if (roomNow !== w.currentRoom) {
      for (let r = w.currentRoom + 1; r <= roomNow; r += 1) {
        const themeIndex = themeIndexForRoom(w.seed, r);
        emitEvent(w.eventBus, EVT.ROOM_ADVANCE, r, themeIndex, 0);
      }
      w.currentRoom = roomNow;
      syncRoomRuntime(w.currentRoom);
      ensureRooms(w.currentRoom);
      cleanupBehindRooms(w.currentRoom);
    }

    w.beatClock += step;
    if (w.beatClock >= w.beatInterval) {
      w.beatClock -= w.beatInterval;
      emitEvent(w.eventBus, EVT.BEAT, 0, 0, 0);
    }

    for (let slot = 0; slot < MAX_BARRIERS; slot += 1) {
      const barrier = w.barriers[slot];
      if (!barrier.active) {
        w.barrierDriftX[slot] = 0;
        w.barrierDriftY[slot] = 0;
        continue;
      }

      const roomDepth = Math.max(0, barrier.roomIndex - w.currentRoom);
      const phaseBoost = 1 + Math.min(0.35, roomDepth * 0.06);
      const driftX =
        Math.sin(w.simTime * barrier.driftSpeed + barrier.driftPhase) *
        barrier.driftAmp *
        phaseBoost;
      const driftY =
        Math.cos(
          w.simTime * (barrier.driftSpeed * 0.82) + barrier.driftPhase * 1.24
        ) *
        barrier.driftYAmp *
        phaseBoost;

      w.barrierDriftX[slot] = driftX;
      w.barrierDriftY[slot] = driftY;

      const blockBase = slot * BLOCKS_PER_BARRIER;
      for (let b = 0; b < BLOCKS_PER_BARRIER; b += 1) {
        const idx = blockBase + b;
        w.blockX[idx] = w.blockBaseX[idx] + driftX;
        w.blockY[idx] = w.blockBaseY[idx] + driftY;
      }
    }

    for (let i = 0; i < MAX_PROJECTILES; i += 1) {
      const shot = w.projectiles[i];
      if (!shot.active) continue;

      shot.life -= step;
      if (shot.life <= 0) {
        shot.active = false;
        continue;
      }

      shot.vel.multiplyScalar(
        Math.max(0, 1 - BALL_PHYSICS.linearDamping * step * 3.4)
      );
      const prevX = shot.pos.x;
      const prevY = shot.pos.y;
      const prevZ = shot.pos.z;
      shot.pos.addScaledVector(shot.vel, step);
      const segDx = shot.pos.x - prevX;
      const segDy = shot.pos.y - prevY;
      const segDz = shot.pos.z - prevZ;

      if (
        shot.pos.z < w.cameraZ - 170 ||
        Math.abs(shot.pos.x) > CORRIDOR_W * 0.7
      ) {
        shot.active = false;
        continue;
      }

      let consumed = false;

      for (let slot = 0; slot < MAX_BARRIERS; slot += 1) {
        const barrier = w.barriers[slot];
        if (!barrier.active) continue;

        const crystalZ = barrier.z - 2.2;
        const crystalX = barrier.crystalX + w.barrierDriftX[slot] * 0.85;
        const crystalY = barrier.crystalY + w.barrierDriftY[slot] * 0.85;
        if (barrier.crystalActive) {
          const crystalNear = Math.abs(shot.pos.z - crystalZ) < 0.8;
          const crystalT = Math.abs(segDz) > 1e-6 ? (crystalZ - prevZ) / segDz : -1;
          const crossedCrystal = crystalT >= 0 && crystalT <= 1;
          if (crystalNear || crossedCrystal) {
            const sampleX = crossedCrystal ? prevX + segDx * crystalT : shot.pos.x;
            const sampleY = crossedCrystal ? prevY + segDy * crystalT : shot.pos.y;
            const sampleZ = crossedCrystal ? crystalZ : shot.pos.z;
            const dx = sampleX - crystalX;
            const dy = sampleY - crystalY;
            const dz = sampleZ - crystalZ;
            if (
              dx * dx + dy * dy + dz * dz <=
              (SHOT_RADIUS + 0.23) * (SHOT_RADIUS + 0.23)
            ) {
              barrier.crystalActive = false;
              emitEvent(
                w.eventBus,
                EVT.CRYSTAL_HIT,
                barrier.crystalValue,
                barrier.themeIndex,
                barrier.roomIndex
              );
              spawnHitFx(
                crystalX,
                crystalY,
                crystalZ,
                THEME_COLORS[barrier.themeIndex].bloom,
                0.32
              );
              consumed = true;
              break;
            }
          }
        }

        const blockNear =
          Math.abs(shot.pos.z - barrier.z) <=
          BLOCK_THICKNESS + SHOT_RADIUS + 0.09;
        const blockT = Math.abs(segDz) > 1e-6 ? (barrier.z - prevZ) / segDz : -1;
        const crossedBlock = blockT >= 0 && blockT <= 1;
        if (!blockNear && !crossedBlock) continue;

        const sampleX = crossedBlock ? prevX + segDx * blockT : shot.pos.x;
        const sampleY = crossedBlock ? prevY + segDy * blockT : shot.pos.y;

        const blockBase = slot * BLOCKS_PER_BARRIER;
        const half = BLOCK_SIZE * 0.5;

        for (let b = 0; b < BLOCKS_PER_BARRIER; b += 1) {
          const idx = blockBase + b;

          const alive = w.blockAlive[idx];
          const stone = w.blockStone[idx];
          if (!alive && !stone) continue;

          const dx = Math.abs(sampleX - w.blockX[idx]);
          const dy = Math.abs(sampleY - w.blockY[idx]);
          if (dx > half + SHOT_RADIUS || dy > half + SHOT_RADIUS) continue;

          if (stone) {
            const stonePenalty = Math.floor(
              clamp(
                10 * barrier.breachPenaltyMul,
                6,
                24
              )
            );
            emitEvent(
              w.eventBus,
              EVT.PENALTY_HIT,
              stonePenalty,
              barrier.roomIndex,
              barrier.themeIndex
            );
            spawnHitFx(
              w.blockX[idx],
              w.blockY[idx],
              w.blockZ[idx],
              COLOR_DANGER,
              0.26
            );
          } else if (alive) {
            shot.pos.set(sampleX, sampleY, barrier.z);
            startCrack(idx, shot.pos, shot.vel);
          }

          consumed = true;
          break;
        }

        if (consumed) break;
      }

      if (consumed) {
        shot.active = false;
      }
    }

    for (let i = 0; i < MAX_BLOCKS; i += 1) {
      if (w.blockDelayFrames[i] > 0) {
        w.blockDelayFrames[i] -= 1;
        w.blockCrack[i] = 1;
        if (w.blockDelayFrames[i] === 0) {
          shatterBlock(i);
        }
      } else {
        w.blockCrack[i] = Math.max(0, w.blockCrack[i] - step * 4.2);
      }
    }

    for (let i = 0; i < MAX_SHARDS; i += 1) {
      const shard = w.shards[i];
      if (!shard.active) continue;

      shard.life -= step;
      if (shard.life <= 0 || shard.pos.z > w.cameraZ + 8) {
        shard.active = false;
        continue;
      }

      shard.vel.y += -11.2 * step;
      shard.vel.multiplyScalar(
        Math.max(0, 1 - GLASS_PHYSICS.linearDamping * step * 4.5)
      );
      shard.pos.addScaledVector(shard.vel, step);
      const spinDamp = Math.max(
        0,
        1 - GLASS_PHYSICS.angularDamping * step * 3.2
      );
      shard.spin.multiplyScalar(spinDamp);
      shard.rot.x += shard.spin.x * step;
      shard.rot.y += shard.spin.y * step;
      shard.rot.z += shard.spin.z * step;
    }

    for (let i = 0; i < MAX_HIT_FX; i += 1) {
      const fx = w.hitFx[i];
      if (!fx.active) continue;

      fx.life -= step;
      if (fx.life <= 0 || fx.pos.z > w.cameraZ + 8) {
        fx.active = false;
      }
    }

    for (let slot = 0; slot < MAX_BARRIERS; slot += 1) {
      const barrier = w.barriers[slot];
      if (!barrier.active || barrier.passed) continue;

      if (barrier.roomIndex < w.currentRoom - CLEANUP_BEHIND_ROOMS) {
        deactivateBarrier(slot);
        continue;
      }

      if (w.cameraZ < barrier.z + 0.44) {
        let cleared = true;
        let requiredLeft = 0;
        const blockBase = slot * BLOCKS_PER_BARRIER;
        for (let b = 0; b < BLOCKS_PER_BARRIER; b += 1) {
          const idx = blockBase + b;
          if (w.blockRequired[idx] && w.blockAlive[idx]) {
            cleared = false;
            requiredLeft += 1;
          }
        }

        if (!cleared) {
          const introPenaltyScale = barrier.roomIndex === 0 ? 0.55 : 1;
          const penalty = Math.floor(
            clamp(
              (BREACH_AMMO_PENALTY_BASE +
                requiredLeft * BREACH_AMMO_PENALTY_PER_BLOCK) *
                introPenaltyScale *
                barrier.breachPenaltyMul,
              4,
              30
            )
          );
          emitEvent(
            w.eventBus,
            EVT.PENALTY_HIT,
            penalty,
            barrier.roomIndex,
            barrier.themeIndex
          );
          barrier.crystalActive = false;

          for (let b = 0; b < BLOCKS_PER_BARRIER; b += 1) {
            const idx = blockBase + b;
            if (!w.blockRequired[idx] || !w.blockAlive[idx]) continue;
            w.blockCrack[idx] = 1;
            w.blockDelayFrames[idx] = 1;
            w.blockHitX[idx] = w.blockX[idx];
            w.blockHitY[idx] = w.blockY[idx];
            w.blockHitZ[idx] = w.blockZ[idx];
            w.blockHitVx[idx] = 0;
            w.blockHitVy[idx] = 0;
            w.blockHitVz[idx] = -w.speed * 0.55;
          }
          barrier.passed = true;
          continue;
        }

        barrier.passed = true;
        barrier.crystalActive = false;
        ensureRoomStats(
          barrier.roomIndex,
          barrier.themeIndex,
          barrier.archetype
        ).cleared += 1;
        const clearScore = Math.floor(
          barrier.clearBonus + Math.floor(smashHitState.combo * 0.62)
        );
        smashHitState.addScore(clearScore);
      }
    }

    smashHitState.setScoreFloor(Math.floor(w.distance * 2.2));

    if (smashHitState.ammo <= 0) {
      smashHitState.combo = Math.max(0, smashHitState.combo - step * 2.4);
      smashHitState.multiball = getMultiBallCount(smashHitState.combo);
    }

    processEvents();

    const finalizeUntil = w.currentRoom - 1;
    if (finalizeUntil > w.lastFinalizedRoom) {
      for (let room = w.lastFinalizedRoom + 1; room <= finalizeUntil; room += 1) {
        finalizeRoom(room);
      }
      w.lastFinalizedRoom = finalizeUntil;
    }
  };

  useEffect(() => {
    smashHitState.loadBest();
    ensureAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key.toLowerCase() === 'f2') {
        setShowDev((v) => !v);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
    const pendingMap = dynamicShardPendingRef.current;
    const worker = new Worker(
      new URL('./GlassShardFactory.worker.ts', import.meta.url),
      { type: 'module' }
    );
    dynamicShardWorkerRef.current = worker;

    worker.onmessage = (event: MessageEvent<DynamicShardResult>) => {
      const result = event.data;
      const meta = pendingMap.get(result.id);
      if (!meta) return;
      pendingMap.delete(result.id);
      spawnDynamicShardsFromWorker(result, meta);
    };

    worker.onerror = () => {
      pendingMap.clear();
    };

    return () => {
      pendingMap.clear();
      dynamicShardWorkerRef.current = null;
      worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gl.shadowMap.enabled = snap.qualityTier !== 'low';
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl, snap.qualityTier]);

  useEffect(() => {
    resetWorld();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.seed, snap.worldSeed]);

  useFrame((_, dtRender) => {
    const w = world.current;

    const inputState = input.current;
    const spaceDown = inputState.keysDown.has(' ');
    const spaceJustDown = spaceDown && !w.spaceWasDown;
    w.spaceWasDown = spaceDown;
    w.fireCooldown = Math.max(0, w.fireCooldown - dtRender);

    const firePressed = inputState.pointerJustDown || spaceJustDown;
    const holdFire = inputState.pointerDown || spaceDown;
    const restartPressed = inputState.justPressed.has('r');

    if (restartPressed) {
      smashHitState.startGame();
      resetWorld();
      if (fireVolley()) {
        w.fireCooldown = FIRE_INTERVAL_BASE;
      }
    } else if (firePressed) {
      if (smashHitState.phase === 'menu' || smashHitState.phase === 'gameover') {
        smashHitState.startGame();
        resetWorld();
        if (fireVolley()) {
          w.fireCooldown = FIRE_INTERVAL_BASE;
        }
      } else {
        if (fireVolley()) {
          w.fireCooldown = FIRE_INTERVAL_BASE;
        }
      }
    } else if (
      holdFire &&
      smashHitState.phase === 'playing' &&
      w.fireCooldown <= 0
    ) {
      if (fireVolley()) {
        w.fireCooldown = FIRE_INTERVAL_BASE;
      }
    }

    clearFrameInput(input);

    const fps = dtRender > 0.0001 ? 1 / dtRender : 60;
    w.smoothedFps = lerp(w.smoothedFps, fps, 0.08);

    if (w.smoothedFps < 45) {
      w.lowFpsTime += dtRender;
      w.highFpsTime = Math.max(0, w.highFpsTime - dtRender * 0.5);
    } else if (w.smoothedFps > 58) {
      w.highFpsTime += dtRender;
      w.lowFpsTime = Math.max(0, w.lowFpsTime - dtRender * 0.5);
    } else {
      w.lowFpsTime = Math.max(0, w.lowFpsTime - dtRender * 0.5);
      w.highFpsTime = Math.max(0, w.highFpsTime - dtRender * 0.5);
    }

    if (w.lowFpsTime > 2) {
      if (snap.qualityTier === 'high') smashHitState.setQualityTier('medium');
      else if (snap.qualityTier === 'medium')
        smashHitState.setQualityTier('low');
      w.lowFpsTime = 0;
    }

    if (w.highFpsTime > 6) {
      if (snap.qualityTier === 'low') smashHitState.setQualityTier('medium');
      else if (snap.qualityTier === 'medium')
        smashHitState.setQualityTier('high');
      w.highFpsTime = 0;
    }

    if (!paused) {
      w.accumulator += Math.min(0.05, dtRender);
      let simSteps = 0;
      while (w.accumulator >= FIXED_STEP && simSteps < MAX_SIM_STEPS) {
        simulateFixed(FIXED_STEP);
        w.accumulator -= FIXED_STEP;
        simSteps += 1;
      }
    }

    const currentThemeColor = THEME_COLORS[w.themeFrom];
    const targetThemeColor = THEME_COLORS[w.themeTo];

    if (w.themeFrom !== w.themeTo) {
      w.themeT = Math.min(1, w.themeT + dtRender * 0.85);
      if (w.themeT >= 1) {
        w.themeFrom = w.themeTo;
      }
    }

    const t = clamp(w.themeT, 0, 1);

    w.tempColorA.copy(currentThemeColor.bg).lerp(targetThemeColor.bg, t);
    w.tempColorB.copy(currentThemeColor.fog).lerp(targetThemeColor.fog, t);
    w.tempColorC
      .copy(currentThemeColor.corridor)
      .lerp(targetThemeColor.corridor, t);

    if (scene.background !== w.sceneBg) {
      scene.background = w.sceneBg;
    }
    w.sceneBg.copy(w.tempColorA);

    const fogNear = lerp(
      THEMES[w.themeFrom].fogNear,
      THEMES[w.themeTo].fogNear,
      t
    );
    const fogFar = lerp(
      THEMES[w.themeFrom].fogFar,
      THEMES[w.themeTo].fogFar,
      t
    );
    if (scene.fog !== w.sceneFog) {
      scene.fog = w.sceneFog;
    }
    w.sceneFogColor.copy(w.tempColorB);
    w.sceneFog.color.copy(w.sceneFogColor);
    w.sceneFog.near = fogNear;
    w.sceneFog.far = fogFar;

    const swayX = inputState.pointerX * 0.35;
    const swayY = inputState.pointerY * 0.2;

    w.cameraX = smoothLerp(w.cameraX, swayX, dtRender, 7);
    w.cameraY = smoothLerp(w.cameraY, swayY, dtRender, 7);

    w.cameraShake = Math.max(0, w.cameraShake - dtRender * 2.8);
    w.bloomPunch = Math.max(0, w.bloomPunch - dtRender * 1.9);
    w.flashAlpha = Math.max(0, w.flashAlpha - dtRender * 5.6);
    const shake = w.cameraShake;

    const shakeX =
      (Math.sin(w.simTime * 43) + Math.sin(w.simTime * 27)) * 0.03 * shake;
    const shakeY =
      (Math.cos(w.simTime * 39) + Math.sin(w.simTime * 21)) * 0.03 * shake;

    camera.position.x = w.cameraX + shakeX;
    camera.position.y = w.cameraY + shakeY;
    camera.position.z = w.cameraZ;
    camera.lookAt(0, 0, w.cameraZ - 13);

    if (impactFlashRef.current) {
      impactFlashRef.current.visible = w.flashAlpha > 0.001;
      impactFlashRef.current.position.set(
        camera.position.x,
        camera.position.y,
        camera.position.z - 1.4
      );
      impactFlashRef.current.quaternion.copy(camera.quaternion);
      const flashMat = impactFlashRef.current
        .material as THREE.MeshBasicMaterial;
      flashMat.opacity = w.flashAlpha;
    }

    if (corridorRef.current) {
      corridorRef.current.position.z = w.cameraZ - CORRIDOR_DEPTH / 2;
      const mat = corridorRef.current.material as THREE.MeshStandardMaterial;
      mat.color.copy(w.tempColorC).lerp(COLOR_WHITE, 0.35);
      mat.emissive.copy(w.tempColorC).multiplyScalar(0.12);
    }

    if (floorRef.current) {
      floorRef.current.position.z = w.cameraZ - CORRIDOR_DEPTH * 0.42;
    }

    if (bloomRef.current) {
      const baseBloom =
        (THEMES[w.themeFrom].bpm + THEMES[w.themeTo].bpm) * 0.0048;
      bloomRef.current.intensity =
        baseBloom + comboIntensity(smashHitState.combo) * 0.22 + w.bloomPunch;
    }

    if (glassRef.current && stoneRef.current && crackRef.current) {
      const dummy = w.dummy;
      for (let i = 0; i < MAX_BLOCKS; i += 1) {
        const slot = Math.floor(i / BLOCKS_PER_BARRIER);
        const barrier = w.barriers[slot];
        const alive = barrier.active && w.blockAlive[i];
        const stone = w.blockStone[i];

        if (alive && !stone) {
          dummy.position.set(w.blockX[i], w.blockY[i], w.blockZ[i]);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          glassRef.current.setMatrixAt(i, dummy.matrix);

          w.tempColorA
            .copy(barrier.color)
            .lerp(COLOR_BASE_GLASS, w.blockRequired[i] ? 0.32 : 0.15);
          glassRef.current.setColorAt(i, w.tempColorA);
        } else {
          hideInstance(glassRef.current, i);
        }

        if (alive && stone) {
          dummy.position.set(w.blockX[i], w.blockY[i], w.blockZ[i]);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          stoneRef.current.setMatrixAt(i, dummy.matrix);
          stoneRef.current.setColorAt(i, COLOR_STONE);
        } else {
          hideInstance(stoneRef.current, i);
        }

        const crack = w.blockCrack[i];
        if (crack > 0.001 && alive && !stone) {
          dummy.position.set(
            w.blockX[i],
            w.blockY[i],
            w.blockZ[i] + BLOCK_THICKNESS * 0.52
          );
          dummy.scale.set(1.02 + crack * 0.03, 1.02 + crack * 0.03, 1);
          dummy.rotation.set(0, 0, Math.sin(w.simTime * 70 + i) * 0.05);
          dummy.updateMatrix();
          crackRef.current.setMatrixAt(i, dummy.matrix);

          w.tempColorB
            .copy(barrier.color)
            .lerp(COLOR_WHITE, tierCfg.crackGlow * crack);
          crackRef.current.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(crackRef.current, i);
        }
      }

      glassRef.current.instanceMatrix.needsUpdate = true;
      stoneRef.current.instanceMatrix.needsUpdate = true;
      crackRef.current.instanceMatrix.needsUpdate = true;
      if (glassRef.current.instanceColor)
        glassRef.current.instanceColor.needsUpdate = true;
      if (stoneRef.current.instanceColor)
        stoneRef.current.instanceColor.needsUpdate = true;
      if (crackRef.current.instanceColor)
        crackRef.current.instanceColor.needsUpdate = true;
    }

    if (crystalRef.current) {
      const dummy = w.dummy;
      for (let slot = 0; slot < MAX_BARRIERS; slot += 1) {
        const barrier = w.barriers[slot];
        if (!barrier.active || !barrier.crystalActive) {
          hideInstance(crystalRef.current, slot);
          continue;
        }

        const crystalX = barrier.crystalX + w.barrierDriftX[slot] * 0.85;
        const crystalY = barrier.crystalY + w.barrierDriftY[slot] * 0.85;
        dummy.position.set(crystalX, crystalY, barrier.z - 2.2);
        dummy.rotation.set(w.simTime * 2.1, w.simTime * 1.7, 0);
        const scale = 0.86 + Math.sin(w.simTime * 8 + slot) * 0.07;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        crystalRef.current.setMatrixAt(slot, dummy.matrix);

        const crystalColor =
          barrier.crystalValue >= 10
            ? COLOR_CRYSTAL_10
            : barrier.crystalValue >= 5
              ? COLOR_CRYSTAL_5
              : COLOR_CRYSTAL_3;
        crystalRef.current.setColorAt(slot, crystalColor);
      }

      crystalRef.current.instanceMatrix.needsUpdate = true;
      if (crystalRef.current.instanceColor)
        crystalRef.current.instanceColor.needsUpdate = true;
    }

    if (shotsRef.current) {
      const dummy = w.dummy;
      for (let i = 0; i < MAX_PROJECTILES; i += 1) {
        const shot = w.projectiles[i];
        if (!shot.active) {
          hideInstance(shotsRef.current, i);
          continue;
        }

        dummy.position.copy(shot.pos);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        shotsRef.current.setMatrixAt(i, dummy.matrix);
      }
      shotsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (shardsRef.current) {
      const dummy = w.dummy;
      for (let i = 0; i < MAX_SHARDS; i += 1) {
        const shard = w.shards[i];
        if (!shard.active) {
          hideInstance(shardsRef.current, i);
          continue;
        }

        dummy.position.copy(shard.pos);
        dummy.rotation.set(shard.rot.x, shard.rot.y, shard.rot.z);
        dummy.scale.set(shard.scale, shard.scale, shard.scale * 0.55);
        dummy.updateMatrix();
        shardsRef.current.setMatrixAt(i, dummy.matrix);

        const alpha = clamp(shard.life / SHARD_TTL, 0, 1);
        w.tempColorA.copy(shard.color).lerp(COLOR_WHITE, alpha * 0.45);
        shardsRef.current.setColorAt(i, w.tempColorA);
      }
      shardsRef.current.instanceMatrix.needsUpdate = true;
      if (shardsRef.current.instanceColor)
        shardsRef.current.instanceColor.needsUpdate = true;
    }

    if (hitFxRef.current) {
      const dummy = w.dummy;
      for (let i = 0; i < MAX_HIT_FX; i += 1) {
        const fx = w.hitFx[i];
        if (!fx.active) {
          hideInstance(hitFxRef.current, i);
          continue;
        }

        const tLife = clamp(fx.life / HIT_FX_TTL, 0, 1);
        const growth = 1 + (1 - tLife) * 1.8;

        dummy.position.copy(fx.pos);
        dummy.rotation.set(0, 0, w.simTime * 8 + i * 0.07);
        dummy.scale.set(fx.size * growth, fx.size * growth, 1);
        dummy.updateMatrix();
        hitFxRef.current.setMatrixAt(i, dummy.matrix);

        w.tempColorB.copy(fx.color).lerp(COLOR_WHITE, tLife * 0.5);
        hitFxRef.current.setColorAt(i, w.tempColorB);
      }

      hitFxRef.current.instanceMatrix.needsUpdate = true;
      if (hitFxRef.current.instanceColor)
        hitFxRef.current.instanceColor.needsUpdate = true;
    }
  });

  const activeBodiesEstimate = (() => {
    const w = world.current;
    let barriers = 0;
    let projectiles = 0;
    let shards = 0;

    for (let i = 0; i < MAX_BARRIERS; i += 1)
      if (w.barriers[i].active) barriers += 1;
    for (let i = 0; i < MAX_PROJECTILES; i += 1)
      if (w.projectiles[i].active) projectiles += 1;
    for (let i = 0; i < MAX_SHARDS; i += 1) if (w.shards[i].active) shards += 1;

    return barriers * 15 + projectiles + shards;
  })();

  const bloomTint = THEME_COLORS[world.current.themeTo].bloom;
  const bloomBaseIntensity =
    (THEMES[world.current.themeFrom].bpm + THEMES[world.current.themeTo].bpm) *
    0.0048;

  return (
    <group>
      <ambientLight intensity={0.42} color="#a5b4fc" />
      <directionalLight
        position={[10, 10, 8]}
        intensity={0.92}
        color="#ffffff"
        castShadow={snap.qualityTier !== 'low'}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-6, 2, 2]} intensity={0.54} color="#67e8f9" />
      <pointLight position={[6, 1, -5]} intensity={0.48} color="#f472b6" />

      <Stars
        radius={120}
        depth={90}
        count={1800}
        factor={3.6}
        saturation={0}
        fade
        speed={0.55}
      />

      <mesh ref={corridorRef} position={[0, 0, START_Z - CORRIDOR_DEPTH / 2]}>
        <boxGeometry args={[CORRIDOR_W, CORRIDOR_H, CORRIDOR_DEPTH]} />
        <meshStandardMaterial
          side={THREE.BackSide}
          color="#8bd3ff"
          roughness={0.82}
          metalness={0.05}
        />
      </mesh>

      <mesh
        ref={floorRef}
        rotation-x={-Math.PI / 2}
        position={[
          0,
          -CORRIDOR_H * 0.5 + 0.04,
          START_Z - CORRIDOR_DEPTH * 0.42,
        ]}
      >
        <planeGeometry args={[CORRIDOR_W * 1.2, CORRIDOR_DEPTH]} />
        {tierCfg.reflectiveFloor ? (
          <MeshReflectorMaterial
            blur={[240, 80]}
            mixStrength={0.72}
            mirror={0.28}
            resolution={snap.qualityTier === 'high' ? 512 : 256}
            roughness={0.38}
            metalness={0.18}
            color="#1b1e33"
            depthScale={0.2}
            minDepthThreshold={0.1}
            maxDepthThreshold={2}
          />
        ) : (
          <meshStandardMaterial
            color="#1b1e33"
            roughness={0.8}
            metalness={0.1}
          />
        )}
      </mesh>

      <instancedMesh
        ref={glassRef}
        args={[undefined, undefined, MAX_BLOCKS]}
        castShadow
      >
        <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_THICKNESS]} />
        {tierCfg.transmission ? (
          <MeshTransmissionMaterial
            transmission={1}
            samples={tierCfg.transmissionSamples}
            resolution={tierCfg.transmissionResolution}
            thickness={0.35}
            ior={1.45}
            chromaticAberration={0.02}
            roughness={0.05}
            anisotropy={0}
            distortion={0}
            distortionScale={0}
            temporalDistortion={0}
            backside
            transparent
            opacity={0.88}
            toneMapped={false}
            vertexColors
          />
        ) : (
          <meshPhysicalMaterial
            vertexColors
            transparent
            opacity={snap.qualityTier === 'low' ? 0.32 : 0.44}
            roughness={0.14}
            metalness={0.06}
            transmission={snap.qualityTier === 'medium' ? 0.35 : 0}
          />
        )}
      </instancedMesh>

      <instancedMesh
        ref={stoneRef}
        args={[undefined, undefined, MAX_BLOCKS]}
        castShadow
      >
        <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_THICKNESS]} />
        <meshStandardMaterial vertexColors roughness={0.82} metalness={0.08} />
      </instancedMesh>

      <instancedMesh ref={crackRef} args={[undefined, undefined, MAX_BLOCKS]}>
        <planeGeometry args={[BLOCK_SIZE * 0.88, BLOCK_SIZE * 0.88]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={snap.qualityTier === 'low' ? 0.3 : 0.48}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={crystalRef}
        args={[undefined, undefined, MAX_BARRIERS]}
      >
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.2}
          metalness={0.2}
          emissive="#67e8f9"
          emissiveIntensity={0.25}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={shotsRef}
        args={[undefined, undefined, MAX_PROJECTILES]}
      >
        <sphereGeometry args={[SHOT_RADIUS, 12, 12]} />
        <meshStandardMaterial
          color="#e5e7eb"
          roughness={0.1}
          metalness={0.95}
          emissive="#ffffff"
          emissiveIntensity={0.05}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={shardsRef} args={[undefined, undefined, MAX_SHARDS]}>
        <boxGeometry args={[0.1, 0.08, 0.045]} />
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.76}
          roughness={0.24}
          metalness={0.08}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={hitFxRef} args={[undefined, undefined, MAX_HIT_FX]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      <mesh ref={impactFlashRef} visible={false}>
        <planeGeometry args={[5.2, 3.2]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {tierCfg.bloom && (
        <EffectComposer multisampling={snap.qualityTier === 'high' ? 4 : 0}>
          <Bloom
            ref={(effect) => {
              bloomRef.current = effect as unknown as {
                intensity: number;
              } | null;
            }}
            mipmapBlur
            luminanceThreshold={0.16}
            intensity={bloomBaseIntensity}
            radius={0.65}
            kernelSize={snap.qualityTier === 'high' ? 4 : 3}
          />
          {tierCfg.chromatic && (
            <ChromaticAberration
              offset={new THREE.Vector2(0.0007, 0.0012)}
              radialModulation
              modulationOffset={0.15}
            />
          )}
          {tierCfg.noise && <Noise opacity={0.07} />}
          {tierCfg.vignette && <Vignette darkness={0.42} offset={0.22} />}
        </EffectComposer>
      )}

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: 'white',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            textShadow: '0 2px 10px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.85, letterSpacing: 1.3 }}>
            SMASH HIT // PRISM RUSH
          </div>
          <div style={{ fontSize: 34, fontWeight: 900 }}>{snap.score}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Ammo: {snap.ammo} • Combo: {Math.floor(snap.combo)} • Multiball x
            {snap.multiball}
          </div>
          <div style={{ fontSize: 12, opacity: 0.62 }}>
            Room {snap.roomIndex + 1} •{' '}
            {ROOM_ARCHETYPE_LABEL[world.current.currentRoomArchetype]} • Seed{' '}
            {snap.seed}
          </div>
          <div style={{ fontSize: 11, opacity: 0.52 }}>Best: {snap.best}</div>
        </div>

        {(snap.phase === 'menu' || snap.phase === 'gameover') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                width: 460,
                padding: 22,
                borderRadius: 18,
                background: 'rgba(0,0,0,0.56)',
                border: '1px solid rgba(255,255,255,0.18)',
                textAlign: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 2 }}>
                SMASH HIT
              </div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                Break incoming glass, chain crystal pickups, and survive by
                managing ammo.
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                Crystal grants: +3 / +5 / +10 • Stone hit = -10 ammo + combo
                reset.
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                Missed barriers now cost ammo instead of instant death.
                Multiball grows with streak: x1 → x5.
              </div>

              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 14, fontSize: 14 }}>
                  <div style={{ fontWeight: 800 }}>Run collapsed.</div>
                  <div style={{ opacity: 0.85 }}>Score: {snap.score}</div>
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.62 }}>
                Hold Click / Tap / Space to fire • R restarts run • F2 toggles
                dev overlay • Tier: {snap.qualityTier}
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            border: `2px solid ${bloomTint.getStyle()}`,
            borderRadius: 999,
            boxShadow: '0 0 18px rgba(255,255,255,0.28)',
          }}
        />

        {showDev && (
          <div
            style={{
              position: 'absolute',
              right: 14,
              top: 14,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.9)',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10,
              padding: '10px 12px',
              minWidth: 220,
            }}
          >
            <div>FPS: {world.current.smoothedFps.toFixed(1)}</div>
            <div>Tier: {snap.qualityTier}</div>
            <div>Seed: {snap.seed}</div>
            <div>Room: {snap.roomIndex}</div>
            <div>Archetype: {world.current.currentRoomArchetype}</div>
            <div>Bodies (est): {activeBodiesEstimate}</div>
            <div>Draw Calls: {gl.info.render.calls}</div>
            <div>Theme: {THEMES[world.current.themeTo].name}</div>
          </div>
        )}
      </Html>
    </group>
  );
}

export default SmashHit;
