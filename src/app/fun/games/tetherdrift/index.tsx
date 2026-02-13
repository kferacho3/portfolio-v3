'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, Line, PerspectiveCamera, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { useGameUIState } from '../../store/selectors';
import {
  consumeFixedStep,
  createFixedStepState,
  shakeNoiseSigned,
} from '../_shared/hyperUpgradeKit';
import { tetherDriftState } from './state';

type ObstacleCluster = {
  z: number;
  mask: number;
  gapLane: number;
  resolved: boolean;
  flash: number;
  pulse: number;
  hue: number;
  forcedWall: boolean;
  laneHp: number[];
};

type PickupKind = 'boost' | 'shard' | 'blaster';

type PickupPad = {
  z: number;
  x: number;
  y: number;
  active: boolean;
  collected: boolean;
  pulse: number;
  hue: number;
  kind: PickupKind;
};

type BreakShard = {
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
  spin: number;
  spinV: number;
  hue: number;
};

type DriftPalette = {
  name: string;
  clear: string;
  fog: string;
  bgSea: string;
  bgSky: string;
  bgMist: string;
  roadBaseA: string;
  roadBaseB: string;
  roadStripeA: string;
  roadStripeB: string;
  railA: string;
  railB: string;
  anchor: string;
  carBody: string;
  carCockpit: string;
  carFront: string;
  carRear: string;
  tether: string;
  guide: string;
  barrierCore: string;
  barrierHit: string;
  marker: string;
  collectible: string;
  blaster: string;
  boost: string;
  hemiSky: string;
  hemiGround: string;
  dirLight: string;
  pointA: string;
  pointB: string;
};

type Runtime = {
  elapsed: number;
  distance: number;
  speed: number;
  score: number;

  combo: number;
  comboTimer: number;
  clustersPassed: number;
  perfects: number;
  collectibles: number;
  ammo: number;
  shotsFired: number;

  carX: number;
  carVx: number;
  carYaw: number;
  carRoll: number;

  anchorX: number;
  anchorVel: number;
  leadGapX: number;
  leadGapZ: number;

  tetherLen: number;
  tetherTargetLen: number;
  tension: number;
  holdVisual: number;

  boostTime: number;
  boostMix: number;
  shootCooldown: number;
  wallBounceCooldown: number;

  serial: number;
  clusterCursorZ: number;
  boostCursorZ: number;
  shardCursor: number;
  hudCommit: number;
  shake: number;
  paletteIndex: number;

  clusters: ObstacleCluster[];
  pickups: PickupPad[];
  shards: BreakShard[];
};

const BEST_KEY = 'tether_drift_hyper_best_v3';

const LANE_COUNT = 5;
const LANE_SPACING = 1.65;
const CLUSTER_POOL = 40;
const PICKUP_POOL = 38;
const BARRIER_INSTANCES = CLUSTER_POOL * LANE_COUNT;
const TETHER_POINTS = 14;
const TRAIL_POINTS = 50;
const BREAK_SHARD_POOL = 220;

const FIELD_HALF_X = ((LANE_COUNT - 1) * LANE_SPACING) / 2 + 0.95;
const ROAD_HALF_WIDTH = FIELD_HALF_X + 0.85;

const CAR_Z = 0;
const CAR_Y = 0.2;
const CAR_HALF_W = 0.36;

const BARRIER_HALF_W = 0.55;
const BARRIER_DEPTH = 0.52;

const BOOST_W = 0.9;
const SHARD_W = 0.7;
const BLASTER_W = 0.8;

const ANCHOR_Z = -2.35;
const ANCHOR_Y = 0.42;

const BASE_SPEED = 6.8;
const MAX_SPEED = 13.4;
const BOOST_WINDOW = 4.2;
const SHOOT_COOLDOWN = 0.18;
const MAX_AMMO = 10;
const BLOCK_BASE_HP = 3;
const BLOCK_COLOR_SCORE_STEP = 200;
const FULL_BLOCK_MASK = (1 << LANE_COUNT) - 1;
const WALL_BOUNCE_DAMPING = 0.62;
const WALL_BOUNCE_COOLDOWN = 0.12;

const PALETTES: DriftPalette[] = [
  {
    name: 'Peach Teal',
    clear: '#a9ddd6',
    fog: '#9bd2cb',
    bgSea: '#77cfc2',
    bgSky: '#f3d8c4',
    bgMist: '#f7f1ea',
    roadBaseA: '#2e5f66',
    roadBaseB: '#457a80',
    roadStripeA: '#9ef3de',
    roadStripeB: '#fcecc8',
    railA: '#95f3df',
    railB: '#bbd9ff',
    anchor: '#e8fff8',
    carBody: '#fff7ef',
    carCockpit: '#d2faf1',
    carFront: '#9efae0',
    carRear: '#a6d8ff',
    tether: '#f2fff9',
    guide: '#98ffe1',
    barrierCore: '#3e8378',
    barrierHit: '#f5a892',
    marker: '#b8fff0',
    collectible: '#ffcf9f',
    blaster: '#b09aff',
    boost: '#8fffbe',
    hemiSky: '#f7f7ff',
    hemiGround: '#4aa297',
    dirLight: '#fff8ef',
    pointA: '#66e6cb',
    pointB: '#9ad5ff',
  },
  {
    name: 'Lilac Silver',
    clear: '#b5bfd8',
    fog: '#a4bad2',
    bgSea: '#8ea5c7',
    bgSky: '#d8caec',
    bgMist: '#f4f6ff',
    roadBaseA: '#2b3f63',
    roadBaseB: '#3e587d',
    roadStripeA: '#c8e5ff',
    roadStripeB: '#efe3ff',
    railA: '#d0eaff',
    railB: '#dfd4ff',
    anchor: '#f1f7ff',
    carBody: '#f7f9ff',
    carCockpit: '#dbe9ff',
    carFront: '#b2f5ff',
    carRear: '#d0c5ff',
    tether: '#eef6ff',
    guide: '#c2e6ff',
    barrierCore: '#47608f',
    barrierHit: '#f4b9cb',
    marker: '#d6f1ff',
    collectible: '#fbe6a6',
    blaster: '#c4afff',
    boost: '#9eefff',
    hemiSky: '#f8f2ff',
    hemiGround: '#536a96',
    dirLight: '#fdfbff',
    pointA: '#92b7ff',
    pointB: '#d2c3ff',
  },
  {
    name: 'Crystal Aura',
    clear: '#99d4d0',
    fog: '#8ec8c7',
    bgSea: '#6fb6b8',
    bgSky: '#b6c3ef',
    bgMist: '#ebf4ff',
    roadBaseA: '#29505a',
    roadBaseB: '#3e6d77',
    roadStripeA: '#9bf2ff',
    roadStripeB: '#e4d4ff',
    railA: '#84f5de',
    railB: '#b9d6ff',
    anchor: '#e6fff9',
    carBody: '#f5fffd',
    carCockpit: '#c8f4ef',
    carFront: '#9de8e8',
    carRear: '#b0bbff',
    tether: '#e4fff9',
    guide: '#98ffe8',
    barrierCore: '#3b726f',
    barrierHit: '#f2b19e',
    marker: '#b8fff1',
    collectible: '#f8d78f',
    blaster: '#a8b3ff',
    boost: '#8ef5ba',
    hemiSky: '#f2fcff',
    hemiGround: '#4f8f8d',
    dirLight: '#f6feff',
    pointA: '#69dfd6',
    pointB: '#9cbfff',
  },
  {
    name: 'Silver Rose',
    clear: '#c7c8cf',
    fog: '#bcbec9',
    bgSea: '#8ea0ae',
    bgSky: '#efcbd7',
    bgMist: '#f8f8fb',
    roadBaseA: '#485462',
    roadBaseB: '#62707f',
    roadStripeA: '#c8f3ff',
    roadStripeB: '#f8dde8',
    railA: '#d2efff',
    railB: '#ffd5e8',
    anchor: '#f7fcff',
    carBody: '#ffffff',
    carCockpit: '#edf4ff',
    carFront: '#b7f1ff',
    carRear: '#ffc7d7',
    tether: '#f2fdff',
    guide: '#c5ecff',
    barrierCore: '#5f7284',
    barrierHit: '#ffaf98',
    marker: '#d3f3ff',
    collectible: '#f8d88e',
    blaster: '#d2b5ff',
    boost: '#a6f3ca',
    hemiSky: '#fff6fb',
    hemiGround: '#5a6b7d',
    dirLight: '#fffef9',
    pointA: '#abc9ff',
    pointB: '#ffc6db',
  },
  {
    name: 'Soft Aurora',
    clear: '#a9d8e4',
    fog: '#9fcfdb',
    bgSea: '#7ab5c8',
    bgSky: '#c6dafb',
    bgMist: '#edf8ff',
    roadBaseA: '#33576f',
    roadBaseB: '#4a6f89',
    roadStripeA: '#9ef5ff',
    roadStripeB: '#d9e7ff',
    railA: '#92f2e1',
    railB: '#aad8ff',
    anchor: '#e8fbff',
    carBody: '#f8feff',
    carCockpit: '#d9f2ff',
    carFront: '#9cefff',
    carRear: '#b3ceff',
    tether: '#e4fcff',
    guide: '#9fe7ff',
    barrierCore: '#446d89',
    barrierHit: '#f2bf8f',
    marker: '#c4edff',
    collectible: '#ffd99c',
    blaster: '#b5c1ff',
    boost: '#8bf2cf',
    hemiSky: '#f2fcff',
    hemiGround: '#4f7590',
    dirLight: '#f3ffff',
    pointA: '#6ce6ea',
    pointB: '#90c6ff',
  },
  {
    name: 'Solar Pop',
    clear: '#ffd6a8',
    fog: '#f8c791',
    bgSea: '#ff9f68',
    bgSky: '#7ed8ff',
    bgMist: '#fff4da',
    roadBaseA: '#694033',
    roadBaseB: '#8c5442',
    roadStripeA: '#ffe682',
    roadStripeB: '#8ff8ff',
    railA: '#ffe48d',
    railB: '#8fd7ff',
    anchor: '#fff7d8',
    carBody: '#fff8ef',
    carCockpit: '#fff0bf',
    carFront: '#ffd77a',
    carRear: '#9fd8ff',
    tether: '#fff9d7',
    guide: '#ffe58f',
    barrierCore: '#8f4a35',
    barrierHit: '#ff8f6a',
    marker: '#fff4c7',
    collectible: '#ffe16f',
    blaster: '#8ba2ff',
    boost: '#9cf7bb',
    hemiSky: '#fff7e8',
    hemiGround: '#8f5f3f',
    dirLight: '#fff6e0',
    pointA: '#ffcd67',
    pointB: '#8fc8ff',
  },
  {
    name: 'Neon Harbor',
    clear: '#7ed6d9',
    fog: '#6fc2ca',
    bgSea: '#2ea0b2',
    bgSky: '#ff8fa7',
    bgMist: '#f6ffff',
    roadBaseA: '#163942',
    roadBaseB: '#21515c',
    roadStripeA: '#69f6ff',
    roadStripeB: '#ffb7d2',
    railA: '#7cf9ea',
    railB: '#ff9cc0',
    anchor: '#e6ffff',
    carBody: '#f8ffff',
    carCockpit: '#d6f7ff',
    carFront: '#70f0ff',
    carRear: '#ff9cc0',
    tether: '#e1ffff',
    guide: '#89fbff',
    barrierCore: '#24606c',
    barrierHit: '#ff8b87',
    marker: '#bffcff',
    collectible: '#ffe28e',
    blaster: '#b2a4ff',
    boost: '#85ffbd',
    hemiSky: '#f0ffff',
    hemiGround: '#2a6570',
    dirLight: '#f6ffff',
    pointA: '#4fe8e0',
    pointB: '#ff9cb8',
  },
  {
    name: 'Midnight Citrus',
    clear: '#7589c4',
    fog: '#677cb5',
    bgSea: '#2e3e7c',
    bgSky: '#ffbf66',
    bgMist: '#f6f3ff',
    roadBaseA: '#1f274d',
    roadBaseB: '#2d3767',
    roadStripeA: '#ffc75c',
    roadStripeB: '#8ec9ff',
    railA: '#ffd17f',
    railB: '#9cd2ff',
    anchor: '#fff3d8',
    carBody: '#fefaff',
    carCockpit: '#d9e4ff',
    carFront: '#ffc96b',
    carRear: '#9ec8ff',
    tether: '#fff3dd',
    guide: '#ffd689',
    barrierCore: '#37457e',
    barrierHit: '#ff966a',
    marker: '#ffe1a3',
    collectible: '#ffe17c',
    blaster: '#b3afff',
    boost: '#9effc9',
    hemiSky: '#fff3df',
    hemiGround: '#36457c',
    dirLight: '#fff8eb',
    pointA: '#ffc56a',
    pointB: '#87b6ff',
  },
];

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

let audioContextRef: AudioContext | null = null;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const laneX = (lane: number) =>
  (lane - (LANE_COUNT - 1) * 0.5) * LANE_SPACING;

const nearestLaneIndex = (x: number) =>
  Math.round(
    clamp(x / LANE_SPACING + (LANE_COUNT - 1) * 0.5, 0, LANE_COUNT - 1)
  );

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

const playTone = (frequency: number, duration = 0.05, volume = 0.03) => {
  if (typeof window === 'undefined') return;
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Context) return;

  if (!audioContextRef) {
    audioContextRef = new Context();
  }
  const ctx = audioContextRef;
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = frequency;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const t0 = ctx.currentTime;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration);
};

const createCluster = (): ObstacleCluster => ({
  z: -10,
  mask: 0,
  gapLane: 2,
  resolved: false,
  flash: 0,
  pulse: 0,
  hue: 0,
  forcedWall: false,
  laneHp: Array.from({ length: LANE_COUNT }, () => 0),
});

const createPickupPad = (): PickupPad => ({
  z: -10,
  x: 0,
  y: 0.05,
  active: true,
  collected: false,
  pulse: 0,
  hue: 0,
  kind: 'boost',
});

const createBreakShard = (): BreakShard => ({
  active: false,
  x: 0,
  y: -10,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  maxLife: 0,
  size: 0.08,
  spin: 0,
  spinV: 0,
  hue: 0,
});

const createRuntime = (): Runtime => ({
  elapsed: 0,
  distance: 0,
  speed: BASE_SPEED,
  score: 0,

  combo: 0,
  comboTimer: 0,
  clustersPassed: 0,
  perfects: 0,

  carX: 0,
  carVx: 0,
  carYaw: 0,
  carRoll: 0,

  anchorX: 0,
  anchorVel: 0,
  leadGapX: 0,
  leadGapZ: -6,

  tetherLen: 2.3,
  tetherTargetLen: 2.3,
  tension: 0,
  holdVisual: 0,

  boostTime: 0,
  boostMix: 0,
  shootCooldown: 0,
  wallBounceCooldown: 0,

  serial: 0,
  clusterCursorZ: -9,
  boostCursorZ: -8,
  shardCursor: 0,
  hudCommit: 0,
  shake: 0,
  paletteIndex: 0,
  ammo: 2,
  collectibles: 0,
  shotsFired: 0,

  clusters: Array.from({ length: CLUSTER_POOL }, createCluster),
  pickups: Array.from({ length: PICKUP_POOL }, createPickupPad),
  shards: Array.from({ length: BREAK_SHARD_POOL }, createBreakShard),
});

const difficultyAt = (runtime: Runtime) =>
  clamp(runtime.distance / 280 + runtime.clustersPassed / 160, 0, 1);

const applyClusterMask = (cluster: ObstacleCluster, mask: number, laneHp = BLOCK_BASE_HP) => {
  cluster.mask = 0;
  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const blocked = (mask & (1 << lane)) !== 0;
    cluster.laneHp[lane] = blocked ? laneHp : 0;
    if (blocked) cluster.mask |= 1 << lane;
  }
};

const pickGapLane = (runtime: Runtime) => {
  const prevGap = runtime.serial > 0 ? runtime.clusters[(runtime.serial - 1) % CLUSTER_POOL].gapLane : 2;
  const r = Math.random();

  let delta = 0;
  if (r < 0.42) delta = 0;
  else if (r < 0.68) delta = 1;
  else if (r < 0.9) delta = -1;
  else delta = Math.random() < 0.5 ? 2 : -2;

  return clamp(prevGap + delta, 0, LANE_COUNT - 1);
};

const seedCluster = (cluster: ObstacleCluster, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  runtime.serial += 1;

  const gapLane = pickGapLane(runtime);
  let mask = 0;

  const openNeighborChance = lerp(0.4, 0.08, d);
  let extraOpenLane = -1;
  if (Math.random() < openNeighborChance) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    extraOpenLane = clamp(gapLane + dir, 0, LANE_COUNT - 1);
  }

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const isSafeLane = lane === gapLane || lane === extraOpenLane;
    if (isSafeLane) continue;

    const skipChance = lane === gapLane ? 0 : lerp(0.16, 0.02, d);
    if (Math.random() < skipChance) continue;
    mask |= 1 << lane;
  }

  if (mask === 0) {
    const fallbackLane = gapLane === 2 ? 1 : 2;
    mask |= 1 << fallbackLane;
  }

  cluster.z = z;
  applyClusterMask(cluster, mask);
  cluster.gapLane = gapLane;
  cluster.resolved = false;
  cluster.flash = 0;
  cluster.pulse = Math.random() * Math.PI * 2;
  cluster.hue = Math.random();
  cluster.forcedWall = false;
};

const seedPickup = (boost: PickupPad, runtime: Runtime, z: number) => {
  const d = difficultyAt(runtime);
  boost.z = z;
  const r = Math.random();
  if (r < lerp(0.46, 0.58, d)) {
    boost.kind = 'boost';
  } else if (r < lerp(0.84, 0.74, d)) {
    boost.kind = 'shard';
  } else {
    boost.kind = 'blaster';
  }
  boost.active = Math.random() < lerp(0.5, 0.8, d);
  boost.collected = false;
  boost.pulse = Math.random() * Math.PI * 2;
  boost.hue = Math.random();

  const leadLane = runtime.serial > 0 ? runtime.clusters[(runtime.serial - 1) % CLUSTER_POOL].gapLane : 2;
  const lane = Math.random() < 0.64 ? leadLane : Math.floor(Math.random() * LANE_COUNT);
  boost.x = laneX(lane) + (Math.random() * 2 - 1) * 0.16;
  boost.y = boost.kind === 'boost' ? 0.05 : boost.kind === 'blaster' ? 0.2 : 0.32;
};

const pickNextPalette = (prev: number) => {
  if (PALETTES.length <= 1) return 0;
  let idx = Math.floor(Math.random() * PALETTES.length);
  if (idx === prev) {
    idx = (idx + 1 + Math.floor(Math.random() * (PALETTES.length - 1))) % PALETTES.length;
  }
  return idx;
};

const spawnShatterBurst = (
  runtime: Runtime,
  x: number,
  z: number,
  hue: number,
  power = 1
) => {
  const pieces = Math.floor(10 + power * 9);
  for (let i = 0; i < pieces; i += 1) {
    const shard = runtime.shards[runtime.shardCursor % runtime.shards.length];
    runtime.shardCursor = (runtime.shardCursor + 1) % runtime.shards.length;

    const angle = Math.random() * Math.PI * 2;
    const speed = (1.6 + Math.random() * 3.8) * (0.75 + power * 0.35);
    shard.active = true;
    shard.x = x + (Math.random() * 2 - 1) * 0.12;
    shard.y = 0.34 + Math.random() * 0.18;
    shard.z = z + (Math.random() * 2 - 1) * 0.1;
    shard.vx = Math.cos(angle) * speed;
    shard.vy = 0.4 + Math.random() * 2.3;
    shard.vz = (Math.random() * 2 - 1) * speed * 0.38;
    shard.maxLife = 0.32 + Math.random() * 0.5;
    shard.life = shard.maxLife;
    shard.size = 0.06 + Math.random() * 0.08 * (0.7 + power * 0.35);
    shard.spin = Math.random() * Math.PI * 2;
    shard.spinV = (Math.random() * 2 - 1) * (6 + power * 4);
    shard.hue = hue + (Math.random() * 2 - 1) * 0.06;
  }
};

const spawnForcedBlasterWall = (runtime: Runtime) => {
  let target: ObstacleCluster | null = null;
  let farthestZ = Infinity;
  for (const cluster of runtime.clusters) {
    if (cluster.z < farthestZ) {
      farthestZ = cluster.z;
      target = cluster;
    }
  }
  if (!target) return;

  const targetZ = clamp(runtime.leadGapZ - 7.2, -16.8, -10.2);
  target.z = targetZ;
  target.gapLane = nearestLaneIndex(runtime.carX);
  target.resolved = false;
  target.flash = 0.34;
  target.pulse = Math.random() * Math.PI * 2;
  target.hue = Math.random();
  target.forcedWall = true;
  applyClusterMask(target, FULL_BLOCK_MASK, BLOCK_BASE_HP);

  runtime.clusterCursorZ = Math.min(runtime.clusterCursorZ, targetZ - (4.4 + Math.random() * 1.4));
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.distance = 0;
  runtime.speed = BASE_SPEED;
  runtime.score = 0;

  runtime.combo = 0;
  runtime.comboTimer = 0;
  runtime.clustersPassed = 0;
  runtime.perfects = 0;

  runtime.carX = 0;
  runtime.carVx = 0;
  runtime.carYaw = 0;
  runtime.carRoll = 0;

  runtime.anchorX = 0;
  runtime.anchorVel = 0;
  runtime.leadGapX = 0;
  runtime.leadGapZ = -6;

  runtime.tetherLen = 2.3;
  runtime.tetherTargetLen = 2.3;
  runtime.tension = 0;
  runtime.holdVisual = 0;

  runtime.boostTime = 0;
  runtime.boostMix = 0;
  runtime.shootCooldown = 0;
  runtime.wallBounceCooldown = 0;

  runtime.serial = 0;
  runtime.clusterCursorZ = -9;
  runtime.boostCursorZ = -8;
  runtime.shardCursor = 0;
  runtime.hudCommit = 0;
  runtime.shake = 0;
  runtime.collectibles = 0;
  runtime.ammo = 2;
  runtime.shotsFired = 0;

  for (const cluster of runtime.clusters) {
    seedCluster(cluster, runtime, runtime.clusterCursorZ);
    runtime.clusterCursorZ -= 5 + Math.random() * 1.5;
  }

  for (const boost of runtime.pickups) {
    seedPickup(boost, runtime, runtime.boostCursorZ);
    runtime.boostCursorZ -= 4.2 + Math.random() * 1.8;
  }

  for (const shard of runtime.shards) {
    shard.active = false;
    shard.life = 0;
  }
};

const findLeadCluster = (runtime: Runtime): ObstacleCluster | null => {
  let lead: ObstacleCluster | null = null;
  let leadZ = -Infinity;
  for (const cluster of runtime.clusters) {
    if (cluster.z > -0.4 || cluster.z < -18) continue;
    if (cluster.z > leadZ) {
      lead = cluster;
      leadZ = cluster.z;
    }
  }
  return lead;
};

const syncHud = (runtime: Runtime, holding: boolean) => {
  const lanePressure = Math.abs(runtime.carX) / (FIELD_HALF_X - CAR_HALF_W);
  const stability = clamp(100 - lanePressure * 42 - runtime.tension * 48, 18, 100);

  tetherDriftState.phase = 'playing';
  tetherDriftState.score = Math.floor(runtime.score);
  tetherDriftState.health = Math.floor(stability);
  tetherDriftState.gameOver = false;
  tetherDriftState.chain = runtime.combo;
  tetherDriftState.chainTime = runtime.comboTimer;
  tetherDriftState.heat = Math.floor(runtime.tension * 100);
  tetherDriftState.speed = runtime.speed;
  tetherDriftState.reeling = holding;
  tetherDriftState.ammo = runtime.ammo;
  tetherDriftState.collectibles = runtime.collectibles;
  tetherDriftState.shotsFired = runtime.shotsFired;
  tetherDriftState.paletteName = PALETTES[runtime.paletteIndex]?.name ?? PALETTES[0].name;
  tetherDriftState.perfects = runtime.perfects;
  tetherDriftState.constellationsCleared = runtime.clustersPassed;
  tetherDriftState.elapsed = runtime.elapsed;
};

const beginRun = (runtime: Runtime) => {
  runtime.paletteIndex = pickNextPalette(runtime.paletteIndex);
  resetRuntime(runtime);

  tetherDriftState.phase = 'playing';
  tetherDriftState.score = 0;
  tetherDriftState.health = 100;
  tetherDriftState.gameOver = false;
  tetherDriftState.chain = 0;
  tetherDriftState.chainTime = 0;
  tetherDriftState.heat = 0;
  tetherDriftState.speed = BASE_SPEED;
  tetherDriftState.reeling = false;
  tetherDriftState.ammo = runtime.ammo;
  tetherDriftState.collectibles = runtime.collectibles;
  tetherDriftState.shotsFired = runtime.shotsFired;
  tetherDriftState.paletteName = PALETTES[runtime.paletteIndex]?.name ?? PALETTES[0].name;
  tetherDriftState.perfectFlash = 0;
  tetherDriftState.perfects = 0;
  tetherDriftState.constellationsCleared = 0;
  tetherDriftState.toastText = '';
  tetherDriftState.toastTime = 0;
  tetherDriftState.slowMoTime = 0;
  tetherDriftState.elapsed = 0;
};

const endRun = (runtime: Runtime) => {
  const finalScore = Math.max(0, Math.floor(runtime.score));
  const nextBest = Math.max(tetherDriftState.bestScore, finalScore);
  if (nextBest !== tetherDriftState.bestScore) {
    tetherDriftState.bestScore = nextBest;
    writeBest(nextBest);
  }

  tetherDriftState.phase = 'gameover';
  tetherDriftState.score = finalScore;
  tetherDriftState.health = 0;
  tetherDriftState.gameOver = true;
  tetherDriftState.reeling = false;
  tetherDriftState.speed = runtime.speed;
  tetherDriftState.chainTime = 0;
  tetherDriftState.ammo = runtime.ammo;
  tetherDriftState.collectibles = runtime.collectibles;
  tetherDriftState.shotsFired = runtime.shotsFired;
  tetherDriftState.paletteName = PALETTES[runtime.paletteIndex]?.name ?? PALETTES[0].name;
};

function TetherDriftOverlay() {
  const snap = useSnapshot(tetherDriftState);
  const flash = clamp(snap.perfectFlash * 2.3, 0, 1);

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/60 bg-gradient-to-br from-emerald-500/30 via-cyan-500/24 to-sky-500/26 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-50/90">Tether Drift</div>
        <div className="text-[11px] text-cyan-50/85">Hold to tighten tether and carve drift lines. Release to slide out.</div>
        <div className="text-[11px] text-cyan-50/85">A/D or Arrow keys steer. Walls bounce your drift line instead of ending the run.</div>
        <div className="text-[11px] text-cyan-50/85">Press F to blast blockers. Each block needs 3 hits before it breaks.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-sky-100/60 bg-gradient-to-br from-slate-900/60 via-cyan-900/42 to-emerald-700/35 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{snap.score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {snap.bestScore}</div>
      </div>

      {snap.phase === 'playing' && (
        <div
          className="absolute left-4 top-[92px] rounded-md border border-white/30 bg-black/35 px-3 py-2 text-xs text-white/90"
          style={{ boxShadow: `0 0 ${18 * flash}px rgba(138,255,232,${0.52 * flash})` }}
        >
          <div>
            Gates <span className="font-semibold text-cyan-100">{snap.constellationsCleared}</span>
          </div>
          <div>
            Drift Combo <span className="font-semibold text-emerald-100">x{Math.max(1, snap.chain)}</span>
          </div>
          <div>
            Speed <span className="font-semibold text-lime-100">{snap.speed.toFixed(1)}</span>
          </div>
          <div>
            Tension <span className="font-semibold text-amber-100">{Math.round(snap.heat)}%</span>
          </div>
          <div>
            Mode <span className="font-semibold">{snap.reeling ? 'TETHERED' : 'DRIFTING'}</span>
          </div>
          <div>
            Crystals <span className="font-semibold text-violet-100">{snap.collectibles}</span>
          </div>
          <div>
            Blaster Ammo <span className="font-semibold text-cyan-100">{snap.ammo}</span>
          </div>
          <div>
            World <span className="font-semibold text-rose-100">{snap.paletteName}</span>
          </div>
        </div>
      )}

      {snap.toastTime > 0 && snap.toastText && (
        <div className="absolute inset-x-0 top-20 flex justify-center">
          <div className="rounded-md border border-cyan-100/55 bg-black/44 px-4 py-1 text-sm font-semibold tracking-[0.12em] text-cyan-100">
            {snap.toastText}
          </div>
        </div>
      )}

      {snap.phase === 'menu' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-cyan-100/45 bg-gradient-to-br from-slate-900/80 via-cyan-900/44 to-emerald-800/34 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">TETHER DRIFT</div>
            <div className="mt-2 text-sm text-white/85">A tethered drift car blasts through an endless corridor.</div>
            <div className="mt-1 text-sm text-white/85">Hold to reel your anchor and snap into line. Release to sling wide around blockers.</div>
            <div className="mt-1 text-sm text-white/85">Steer with A/D or ←/→. Collect crystals and power cells. Press F to shoot blockers away.</div>
            <div className="mt-1 text-sm text-white/85">Blaster pickups trigger full-wall barrages, so carve an opening before impact.</div>
            <div className="mt-1 text-sm text-white/85">Blocks cycle to a new color phase every 200 points and each run gets a fresh palette.</div>
            <div className="mt-3 text-sm text-cyan-100/95">Tap or press Space to start.</div>
          </div>
        </div>
      )}

      {snap.phase === 'gameover' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-900/42 to-cyan-900/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-cyan-100">Drift Crashed</div>
            <div className="mt-2 text-sm text-white/80">Score {snap.score}</div>
            <div className="mt-1 text-sm text-white/75">Best {snap.bestScore}</div>
            <div className="mt-1 text-sm text-white/75">Crystals {snap.collectibles} • Shots {snap.shotsFired}</div>
            <div className="mt-3 text-sm text-cyan-100/90">Tap to run again.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TetherDriftScene() {
  const snap = useSnapshot(tetherDriftState);
  const { paused, restartSeed } = useGameUIState();

  const inputRef = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter', 'r', 'R', 'f', 'F'],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());
  const fixedStepRef = useRef(createFixedStepState());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const roadMatRef = useRef<THREE.ShaderMaterial>(null);
  const barrierRef = useRef<THREE.InstancedMesh>(null);
  const gapMarkerRef = useRef<THREE.InstancedMesh>(null);
  const pickupRef = useRef<THREE.InstancedMesh>(null);
  const breakShardRef = useRef<THREE.InstancedMesh>(null);
  const carGroupRef = useRef<THREE.Group>(null);
  const anchorRef = useRef<THREE.Mesh>(null);
  const anchorMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const leftRailMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rightRailMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const carBodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const carCockpitMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const carFrontMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const carRearMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const trailMatRef = useRef<THREE.PointsMaterial>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const pointLightARef = useRef<THREE.PointLight>(null);
  const pointLightBRef = useRef<THREE.PointLight>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const tetherLineRef = useRef<any>(null);
  const guideLineRef = useRef<any>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const colorScratchB = useMemo(() => new THREE.Color(), []);
  const colorScratchC = useMemo(() => new THREE.Color(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  const tetherPoints = useMemo(
    () => Array.from({ length: TETHER_POINTS }, () => new THREE.Vector3()),
    []
  );
  const tetherFlat = useMemo(() => new Float32Array(TETHER_POINTS * 3), []);

  const guidePoints = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)],
    []
  );
  const guideFlat = useMemo(() => new Float32Array(6), []);

  const trailAttr = useMemo(
    () => new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    []
  );
  const trailGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', trailAttr);
    return g;
  }, [trailAttr]);

  const { camera, scene } = useThree();

  const primeTrail = (x: number) => {
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const ptr = i * 3;
      trailAttr.array[ptr] = x;
      trailAttr.array[ptr + 1] = CAR_Y;
      trailAttr.array[ptr + 2] = -i * 0.12;
    }
    trailAttr.needsUpdate = true;
  };

  useEffect(() => {
    const best = readBest();
    tetherDriftState.bestScore = Math.max(tetherDriftState.bestScore, best);
    runtimeRef.current.paletteIndex = Math.floor(Math.random() * PALETTES.length);
    resetRuntime(runtimeRef.current);
    tetherDriftState.paletteName = PALETTES[runtimeRef.current.paletteIndex]?.name ?? PALETTES[0].name;
    tetherDriftState.ammo = runtimeRef.current.ammo;
    tetherDriftState.collectibles = runtimeRef.current.collectibles;
    tetherDriftState.shotsFired = runtimeRef.current.shotsFired;
    primeTrail(0);
  }, []);

  useEffect(() => {
    const best = readBest();
    tetherDriftState.bestScore = Math.max(tetherDriftState.bestScore, best);
    resetRuntime(runtimeRef.current);
    tetherDriftState.paletteName = PALETTES[runtimeRef.current.paletteIndex]?.name ?? PALETTES[0].name;
    tetherDriftState.ammo = runtimeRef.current.ammo;
    tetherDriftState.collectibles = runtimeRef.current.collectibles;
    tetherDriftState.shotsFired = runtimeRef.current.shotsFired;
    primeTrail(0);
  }, [snap.resetVersion]);

  useEffect(() => {
    if (restartSeed <= 0) return;
    beginRun(runtimeRef.current);
    primeTrail(runtimeRef.current.carX);
  }, [restartSeed]);

  useEffect(
    () => () => {
      trailGeometry.dispose();
      trailAttr.array.fill(0);
    },
    [trailAttr, trailGeometry]
  );

  useFrame((_state, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) return;

    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;

    tetherDriftState.tick(dt);

    const tap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const restart = input.justPressed.has('r');

    if ((tap || restart) && tetherDriftState.phase !== 'playing') {
      beginRun(runtime);
      primeTrail(runtime.carX);
      maybeVibrate(10);
      playTone(580, 0.06, 0.03);
    } else if (restart && tetherDriftState.phase === 'playing') {
      beginRun(runtime);
      primeTrail(runtime.carX);
    }

    const holding =
      tetherDriftState.phase === 'playing' &&
      !paused &&
      (input.pointerDown ||
        input.keysDown.has(' ') ||
        input.keysDown.has('space') ||
        input.keysDown.has('enter'));

    const leftPressed = input.keysDown.has('a') || input.keysDown.has('arrowleft');
    const rightPressed = input.keysDown.has('d') || input.keysDown.has('arrowright');
    let steerInput = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    if (input.pointerDown && Math.abs(input.pointerX) > 0.16) {
      steerInput += clamp(input.pointerX, -1, 1) * 0.95;
    }
    steerInput = clamp(steerInput, -1, 1);

    const shootPressed =
      tetherDriftState.phase === 'playing' &&
      !paused &&
      (input.justPressed.has('f') || input.justPressed.has('x'));

    const activePalette = PALETTES[runtime.paletteIndex] ?? PALETTES[0];

    if (tetherDriftState.phase === 'playing' && !paused) {
      runtime.elapsed += dt;
      runtime.comboTimer = Math.max(0, runtime.comboTimer - dt);
      if (runtime.comboTimer <= 0) runtime.combo = 0;

      const d = difficultyAt(runtime);
      const baseSpeed = lerp(BASE_SPEED, MAX_SPEED, d);

      runtime.boostTime = Math.max(0, runtime.boostTime - dt);
      runtime.boostMix = clamp(runtime.boostTime / BOOST_WINDOW, 0, 1);
      runtime.shootCooldown = Math.max(0, runtime.shootCooldown - dt);
      runtime.wallBounceCooldown = Math.max(0, runtime.wallBounceCooldown - dt);
      const boostScale = 1 + runtime.boostMix * 0.28;
      runtime.speed = baseSpeed * boostScale;
      runtime.hudCommit += dt;

      for (const cluster of runtime.clusters) {
        cluster.z += runtime.speed * dt;
        cluster.flash = Math.max(0, cluster.flash - dt * 3.3);

        if (cluster.z > 8.6) {
          seedCluster(cluster, runtime, runtime.clusterCursorZ);
          runtime.clusterCursorZ -= lerp(5.9, 3.4, d) + Math.random() * 1.4;
        }
      }

      for (const boost of runtime.pickups) {
        boost.z += runtime.speed * dt;
        if (boost.z > 8.2) {
          seedPickup(boost, runtime, runtime.boostCursorZ);
          runtime.boostCursorZ -= lerp(5, 2.8, d) + Math.random() * 1.7;
        }
      }

      const lead = findLeadCluster(runtime);
      runtime.leadGapX = lead ? laneX(lead.gapLane) : runtime.anchorX;
      runtime.leadGapZ = lead ? lead.z : -6;

      const wave =
        Math.sin(runtime.elapsed * 0.8 + runtime.serial * 0.02) * 0.4 +
        Math.sin(runtime.elapsed * 1.3) * 0.2;
      const targetX = clamp(runtime.leadGapX * 0.86 + wave, -FIELD_HALF_X * 0.9, FIELD_HALF_X * 0.9);

      runtime.anchorVel += (targetX - runtime.anchorX) * (6.2 + d * 3.2) * dt;
      runtime.anchorVel *= Math.exp(-(4.2 + d * 1.2) * dt);
      runtime.anchorX += runtime.anchorVel * dt;

      runtime.tetherTargetLen = holding ? lerp(0.58, 0.44, d) : lerp(2.4, 3.1, d * 0.8);
      runtime.tetherLen = lerp(runtime.tetherLen, runtime.tetherTargetLen, 1 - Math.exp(-9.2 * dt));
      runtime.holdVisual = lerp(runtime.holdVisual, holding ? 1 : 0, 1 - Math.exp(-12 * dt));

      const dx = runtime.carX - runtime.anchorX;
      const dist = Math.abs(dx);
      const dir = dx >= 0 ? 1 : -1;
      const stretch = Math.max(0, dist - runtime.tetherLen);

      const springK = holding ? lerp(72, 112, d) : lerp(32, 56, d);
      const ropeForce = -dir * stretch * springK;
      const assistForce = (runtime.anchorX - runtime.carX) * (holding ? 7.4 : 1.7);
      const steerForce = steerInput * (holding ? 48 : 58) * (1 + runtime.boostMix * 0.16);

      runtime.carVx += (ropeForce + assistForce + steerForce) * dt;
      const drag = holding ? 5.6 : 2.8;
      runtime.carVx *= Math.exp(-drag * dt);
      runtime.carX += runtime.carVx * dt;

      runtime.tension = clamp(
        Math.abs(runtime.carX - runtime.anchorX) / Math.max(0.0001, runtime.tetherLen),
        0,
        1
      );

      const yawTarget = clamp(-runtime.carVx * 0.32, -0.6, 0.6);
      const rollTarget = clamp(-runtime.carVx * 0.45, -0.55, 0.55);
      runtime.carYaw = lerp(runtime.carYaw, yawTarget, 1 - Math.exp(-8.4 * dt));
      runtime.carRoll = lerp(runtime.carRoll, rollTarget, 1 - Math.exp(-9.4 * dt));

      let crashed = false;
      const wallLimit = FIELD_HALF_X - CAR_HALF_W * 0.72;
      if (runtime.carX > wallLimit) {
        runtime.carX = wallLimit;
        if (runtime.carVx > 0) runtime.carVx = -Math.abs(runtime.carVx) * WALL_BOUNCE_DAMPING;
        runtime.carYaw = Math.max(runtime.carYaw, 0.08);
        runtime.carRoll = Math.max(runtime.carRoll, 0.14);
        runtime.shake = Math.min(1.2, runtime.shake + 0.22);
        if (runtime.wallBounceCooldown <= 0) {
          runtime.wallBounceCooldown = WALL_BOUNCE_COOLDOWN;
          playTone(300, 0.04, 0.028);
          maybeVibrate(5);
        }
      } else if (runtime.carX < -wallLimit) {
        runtime.carX = -wallLimit;
        if (runtime.carVx < 0) runtime.carVx = Math.abs(runtime.carVx) * WALL_BOUNCE_DAMPING;
        runtime.carYaw = Math.min(runtime.carYaw, -0.08);
        runtime.carRoll = Math.min(runtime.carRoll, -0.14);
        runtime.shake = Math.min(1.2, runtime.shake + 0.22);
        if (runtime.wallBounceCooldown <= 0) {
          runtime.wallBounceCooldown = WALL_BOUNCE_COOLDOWN;
          playTone(300, 0.04, 0.028);
          maybeVibrate(5);
        }
      }

      if (shootPressed && runtime.shootCooldown <= 0) {
        if (runtime.ammo > 0) {
          let targetCluster: ObstacleCluster | null = null;
          let targetZ = -Infinity;

          for (const cluster of runtime.clusters) {
            if (cluster.resolved || cluster.mask === 0) continue;
            if (cluster.z < -9.4 || cluster.z > 1.6) continue;
            if (cluster.z > targetZ) {
              targetCluster = cluster;
              targetZ = cluster.z;
            }
          }

          if (targetCluster) {
            const lanePref = nearestLaneIndex(runtime.carX);
            let laneToBlast = -1;
            if ((targetCluster.mask & (1 << lanePref)) !== 0) {
              laneToBlast = lanePref;
            } else {
              let bestDist = Infinity;
              for (let lane = 0; lane < LANE_COUNT; lane += 1) {
                if ((targetCluster.mask & (1 << lane)) === 0) continue;
                const distLane = Math.abs(laneX(lane) - runtime.carX);
                if (distLane < bestDist) {
                  bestDist = distLane;
                  laneToBlast = lane;
                }
              }
            }

            if (laneToBlast >= 0) {
              const laneBit = 1 << laneToBlast;
              const previousHp = Math.max(1, targetCluster.laneHp[laneToBlast] || BLOCK_BASE_HP);
              const nextHp = Math.max(0, previousHp - 1);
              targetCluster.laneHp[laneToBlast] = nextHp;
              if (nextHp <= 0) {
                targetCluster.mask &= ~laneBit;
                targetCluster.gapLane = laneToBlast;
                if (targetCluster.mask === 0) targetCluster.forcedWall = false;
              }
              targetCluster.flash = 1;
              runtime.ammo = Math.max(0, runtime.ammo - 1);
              runtime.shotsFired += 1;
              runtime.shootCooldown = SHOOT_COOLDOWN;
              runtime.score += nextHp > 0 ? 9 + runtime.combo : 16 + runtime.combo * 2;
              runtime.shake = Math.min(1.4, runtime.shake + 0.12);
              spawnShatterBurst(
                runtime,
                laneX(laneToBlast),
                targetCluster.z,
                targetCluster.hue,
                nextHp > 0 ? 0.95 : 1.45
              );
              if (nextHp > 0) {
                tetherDriftState.setToast(`BLOCK ${nextHp}/${BLOCK_BASE_HP}`, 0.26);
                playTone(1020, 0.035, 0.028);
              } else {
                tetherDriftState.setToast('BLOCK SHATTERED', 0.3);
                playTone(1320, 0.04, 0.034);
              }
            }
          } else {
            tetherDriftState.setToast('NO TARGET', 0.22);
          }
        } else {
          tetherDriftState.setToast('NO AMMO', 0.3);
          playTone(340, 0.03, 0.02);
        }
      }

      for (const cluster of runtime.clusters) {
        if (crashed) break;

        if (!cluster.resolved && cluster.z > CAR_Z + BARRIER_DEPTH * 0.55) {
          cluster.resolved = true;

          let collision = false;
          for (let lane = 0; lane < LANE_COUNT; lane += 1) {
            if ((cluster.mask & (1 << lane)) === 0) continue;
            const bx = laneX(lane);
            if (Math.abs(runtime.carX - bx) < BARRIER_HALF_W + CAR_HALF_W * 0.84) {
              collision = true;
              break;
            }
          }

          if (collision) {
            crashed = true;
            break;
          }

          runtime.clustersPassed += 1;
          const gapX = laneX(cluster.gapLane);
          const offset = Math.abs(runtime.carX - gapX);
          const perfect = offset < 0.28;

          if (perfect) {
            runtime.combo = Math.min(runtime.combo + 1, 30);
            runtime.comboTimer = 2.1;
            runtime.perfects += 1;
            runtime.score += 26 + runtime.combo * 7;
            cluster.flash = 1;
            runtime.shake = Math.min(1.2, runtime.shake + 0.2);
            tetherDriftState.perfectFlash = 0.28;
            if (runtime.combo >= 2) {
              tetherDriftState.setToast(`DRIFT FLOW x${runtime.combo}`, 0.45);
            }
            playTone(960 + runtime.combo * 6, 0.05, 0.03);
          } else {
            runtime.combo = Math.max(0, runtime.combo - 1);
            runtime.comboTimer = Math.max(runtime.comboTimer, 0.95);
            runtime.score += 14 + Math.floor(runtime.speed * 0.9);
            cluster.flash = 0.56;
            playTone(640, 0.035, 0.02);
          }
        }
      }

      for (const boost of runtime.pickups) {
        if (crashed) break;
        if (!boost.active || boost.collected) continue;
        if (Math.abs(boost.z - CAR_Z) > 0.64) continue;

        const pickupHalfW =
          boost.kind === 'boost'
            ? BOOST_W * 0.5
            : boost.kind === 'blaster'
              ? BLASTER_W * 0.5
              : SHARD_W * 0.5;

        if (Math.abs(boost.x - runtime.carX) < pickupHalfW + CAR_HALF_W * 0.85) {
          boost.collected = true;
          if (boost.kind === 'boost') {
            runtime.boostTime = clamp(runtime.boostTime + 1.9, 0, BOOST_WINDOW);
            runtime.score += 36 + runtime.combo * 3;
            runtime.shake = Math.min(1.3, runtime.shake + 0.16);
            tetherDriftState.setToast('BOOST', 0.35);
            playTone(1180, 0.06, 0.032);
            maybeVibrate(6);
          } else if (boost.kind === 'shard') {
            runtime.collectibles += 1;
            runtime.score += 22 + runtime.combo * 2;
            runtime.shake = Math.min(1.24, runtime.shake + 0.08);
            if (runtime.collectibles % 5 === 0 && runtime.ammo < MAX_AMMO) {
              runtime.ammo += 1;
              tetherDriftState.setToast('CRYSTAL + AMMO', 0.5);
            } else {
              tetherDriftState.setToast('CRYSTAL', 0.25);
            }
            spawnShatterBurst(runtime, boost.x, boost.z, 0.1 + boost.hue * 0.2, 0.78);
            playTone(870, 0.04, 0.028);
          } else {
            runtime.ammo = clamp(runtime.ammo + 4, 0, MAX_AMMO);
            runtime.score += 32 + runtime.combo * 2;
            runtime.boostTime = clamp(runtime.boostTime + 0.8, 0, BOOST_WINDOW);
            runtime.shake = Math.min(1.28, runtime.shake + 0.11);
            spawnForcedBlasterWall(runtime);
            tetherDriftState.setToast('BLASTER ONLINE', 0.45);
            spawnShatterBurst(runtime, boost.x, boost.z, 0.68 + boost.hue * 0.1, 1);
            playTone(1040, 0.06, 0.03);
            maybeVibrate(8);
          }
        }
      }

      if (crashed) {
        runtime.shake = 1.3;
        spawnShatterBurst(runtime, runtime.carX, CAR_Z - 0.1, 0.02 + runtime.elapsed * 0.01, 2);
        maybeVibrate(18);
        playTone(200, 0.11, 0.055);
        endRun(runtime);
      } else {
        runtime.distance += runtime.speed * dt;
        const paceScore = runtime.distance * 0.7;
        const progression = runtime.clustersPassed * 12 + runtime.perfects * 8;
        runtime.score = Math.max(runtime.score, Math.floor(paceScore + progression));

        if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          syncHud(runtime, holding);
        }
      }
    } else {
      runtime.elapsed += dt * 0.5;
      runtime.anchorX = Math.sin(runtime.elapsed * 1.1) * 0.8;
      runtime.carX = lerp(runtime.carX, runtime.anchorX + Math.sin(runtime.elapsed * 1.6) * 0.6, 1 - Math.exp(-2.4 * dt));
      runtime.carVx *= Math.exp(-3.5 * dt);
      runtime.tetherLen = lerp(runtime.tetherLen, 2.3, 1 - Math.exp(-2.2 * dt));
      runtime.holdVisual = lerp(runtime.holdVisual, 0, 1 - Math.exp(-4.2 * dt));
      runtime.tension = clamp(
        Math.abs(runtime.carX - runtime.anchorX) / Math.max(0.0001, runtime.tetherLen),
        0,
        1
      );
      runtime.carYaw = lerp(runtime.carYaw, 0, 1 - Math.exp(-4.5 * dt));
      runtime.carRoll = lerp(runtime.carRoll, 0, 1 - Math.exp(-4.5 * dt));
      runtime.leadGapX = runtime.anchorX;
      runtime.leadGapZ = -6;
      runtime.boostMix = Math.max(0, runtime.boostMix - dt * 0.8);
      runtime.shootCooldown = Math.max(0, runtime.shootCooldown - dt);
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.8);
    const shakeAmp = runtime.shake * 0.07;
    const shakeTime = runtime.elapsed * 20;
    const jitterX = shakeNoiseSigned(shakeTime, 1.2) * shakeAmp;
    const jitterY = shakeNoiseSigned(shakeTime, 5.8) * shakeAmp * 0.34;
    const jitterZ = shakeNoiseSigned(shakeTime, 9.7) * shakeAmp * 0.4;

    camTarget.set(runtime.carX * 0.38 + jitterX, 2.8 + runtime.boostMix * 0.22 + jitterY, 6.8 + jitterZ);
    lookTarget.set(runtime.carX * 0.24, 0.18, -3);
    camera.position.lerp(camTarget, 1 - Math.exp(-6.6 * step.renderDt));
    camera.lookAt(lookTarget);

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
      bgMatRef.current.uniforms.uSea.value.set(activePalette.bgSea);
      bgMatRef.current.uniforms.uSky.value.set(activePalette.bgSky);
      bgMatRef.current.uniforms.uMist.value.set(activePalette.bgMist);
    }
    if (roadMatRef.current) {
      roadMatRef.current.uniforms.uTime.value += dt * (1 + runtime.boostMix * 0.8);
      roadMatRef.current.uniforms.uBoost.value = runtime.boostMix;
      roadMatRef.current.uniforms.uBaseA.value.set(activePalette.roadBaseA);
      roadMatRef.current.uniforms.uBaseB.value.set(activePalette.roadBaseB);
      roadMatRef.current.uniforms.uStripeA.value.set(activePalette.roadStripeA);
      roadMatRef.current.uniforms.uStripeB.value.set(activePalette.roadStripeB);
    }

    if (scene.background) {
      (scene.background as THREE.Color).set(activePalette.clear);
    }
    if (fogRef.current) {
      fogRef.current.color.set(activePalette.fog);
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.color.set(activePalette.hemiSky);
      hemiLightRef.current.groundColor.set(activePalette.hemiGround);
    }
    if (dirLightRef.current) dirLightRef.current.color.set(activePalette.dirLight);
    if (pointLightARef.current) pointLightARef.current.color.set(activePalette.pointA);
    if (pointLightBRef.current) pointLightBRef.current.color.set(activePalette.pointB);
    if (leftRailMatRef.current) {
      leftRailMatRef.current.color.set(activePalette.railA);
      leftRailMatRef.current.emissive.set(activePalette.railA);
    }
    if (rightRailMatRef.current) {
      rightRailMatRef.current.color.set(activePalette.railB);
      rightRailMatRef.current.emissive.set(activePalette.railB);
    }
    if (anchorMatRef.current) {
      anchorMatRef.current.color.set(activePalette.anchor);
      anchorMatRef.current.emissive.set(activePalette.anchor);
    }
    if (carBodyMatRef.current) {
      carBodyMatRef.current.color.set(activePalette.carBody);
      carBodyMatRef.current.emissive.set(activePalette.carCockpit);
    }
    if (carCockpitMatRef.current) {
      carCockpitMatRef.current.color.set(activePalette.carCockpit);
      carCockpitMatRef.current.emissive.set(activePalette.carFront);
    }
    if (carFrontMatRef.current) {
      carFrontMatRef.current.color.set(activePalette.carFront);
      carFrontMatRef.current.emissive.set(activePalette.carFront);
    }
    if (carRearMatRef.current) {
      carRearMatRef.current.color.set(activePalette.carRear);
      carRearMatRef.current.emissive.set(activePalette.carRear);
    }
    if (trailMatRef.current) {
      trailMatRef.current.color.set(activePalette.tether);
    }

    if (anchorRef.current) {
      const pulse = 1 + Math.sin(runtime.elapsed * 8.6) * 0.06;
      anchorRef.current.position.set(runtime.anchorX, ANCHOR_Y, ANCHOR_Z);
      anchorRef.current.scale.setScalar(pulse + runtime.holdVisual * 0.12);
    }

    if (carGroupRef.current) {
      carGroupRef.current.position.set(runtime.carX, CAR_Y, CAR_Z);
      carGroupRef.current.rotation.set(0, runtime.carYaw, runtime.carRoll);
    }

    const tetherMaterial: any = tetherLineRef.current?.material;
    if (tetherMaterial?.color?.set) tetherMaterial.color.set(activePalette.tether);
    const guideMaterial: any = guideLineRef.current?.material;
    if (guideMaterial?.color?.set) guideMaterial.color.set(activePalette.guide);

    if (barrierRef.current && gapMarkerRef.current) {
      let index = 0;
      const scoreBand = Math.floor(Math.max(0, runtime.score) / BLOCK_COLOR_SCORE_STEP);
      const hueBandShift = (scoreBand % 7) * 0.09;
      const satBandBoost = (scoreBand % 3) * 0.03;

      for (let i = 0; i < runtime.clusters.length; i += 1) {
        const cluster = runtime.clusters[i];
        const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 4.3 + cluster.pulse);

        for (let lane = 0; lane < LANE_COUNT; lane += 1) {
          if ((cluster.mask & (1 << lane)) !== 0) {
            const hpNorm = clamp(cluster.laneHp[lane] / BLOCK_BASE_HP, 0.14, 1);
            dummy.position.set(laneX(lane), 0.36, cluster.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1.08, 0.66 + hpNorm * 0.5, 0.82);
            dummy.updateMatrix();
            barrierRef.current.setMatrixAt(index, dummy.matrix);

            const barrierColor = colorScratch
              .set(activePalette.barrierCore)
              .offsetHSL(cluster.hue * 0.05 + hueBandShift, satBandBoost, pulse * 0.07 + (1 - hpNorm) * 0.08)
              .lerp(colorScratchB.set(activePalette.blaster), cluster.forcedWall ? 0.24 : 0)
              .lerp(colorScratchB.set(activePalette.barrierHit), cluster.flash * (0.36 + (1 - hpNorm) * 0.38))
              .lerp(colorScratchC.set(activePalette.boost), runtime.boostMix * 0.24);
            barrierRef.current.setColorAt(index, barrierColor);
          } else {
            dummy.position.copy(OFFSCREEN_POS);
            dummy.scale.copy(TINY_SCALE);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            barrierRef.current.setMatrixAt(index, dummy.matrix);
            barrierRef.current.setColorAt(index, colorScratchB.set(activePalette.barrierCore));
          }
          index += 1;
        }

        if (cluster.forcedWall && cluster.mask === FULL_BLOCK_MASK) {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          gapMarkerRef.current.setMatrixAt(i, dummy.matrix);
          gapMarkerRef.current.setColorAt(i, colorScratchB.set(activePalette.barrierHit));
        } else {
          dummy.position.set(laneX(cluster.gapLane), 0.12, cluster.z + 0.01);
          dummy.rotation.set(Math.PI / 2, 0, 0);
          const markerScale = 0.6 + pulse * 0.06 + cluster.flash * 0.38;
          dummy.scale.set(markerScale, markerScale, markerScale);
          dummy.updateMatrix();
          gapMarkerRef.current.setMatrixAt(i, dummy.matrix);

          const markerColor = colorScratch
            .set(activePalette.marker)
            .lerp(colorScratchB.set(activePalette.tether), 0.35 + pulse * 0.25 + cluster.flash * 0.25);
          gapMarkerRef.current.setColorAt(i, markerColor);
        }
      }

      barrierRef.current.instanceMatrix.needsUpdate = true;
      gapMarkerRef.current.instanceMatrix.needsUpdate = true;
      if (barrierRef.current.instanceColor) barrierRef.current.instanceColor.needsUpdate = true;
      if (gapMarkerRef.current.instanceColor) gapMarkerRef.current.instanceColor.needsUpdate = true;
    }

    if (pickupRef.current) {
      for (let i = 0; i < runtime.pickups.length; i += 1) {
        const boost = runtime.pickups[i];
        if (boost.active && !boost.collected) {
          const pulse = 0.5 + 0.5 * Math.sin(runtime.elapsed * 6 + boost.pulse);
          const y = boost.y + Math.sin(runtime.elapsed * 3.2 + boost.pulse) * 0.04;
          dummy.position.set(boost.x, y, boost.z);
          dummy.rotation.set(0, runtime.elapsed * 0.9 + boost.pulse, 0);
          if (boost.kind === 'boost') {
            dummy.scale.set(0.88, 0.14 + pulse * 0.06, 0.82);
          } else if (boost.kind === 'blaster') {
            const s = 0.52 + pulse * 0.12;
            dummy.scale.set(s, s, s);
          } else {
            const s = 0.44 + pulse * 0.08;
            dummy.scale.set(s, s, s);
          }
          dummy.updateMatrix();
          pickupRef.current.setMatrixAt(i, dummy.matrix);

          const baseColor =
            boost.kind === 'boost'
              ? activePalette.boost
              : boost.kind === 'blaster'
                ? activePalette.blaster
                : activePalette.collectible;
          const boostColor = colorScratch
            .set(baseColor)
            .offsetHSL(boost.hue * 0.08, 0, pulse * 0.14)
            .lerp(colorScratchB.set(activePalette.tether), 0.2 + runtime.boostMix * 0.22);
          pickupRef.current.setColorAt(i, boostColor);
        } else {
          dummy.position.copy(OFFSCREEN_POS);
          dummy.scale.copy(TINY_SCALE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          pickupRef.current.setMatrixAt(i, dummy.matrix);
          pickupRef.current.setColorAt(i, colorScratchB.set(activePalette.boost));
        }
      }
      pickupRef.current.instanceMatrix.needsUpdate = true;
      if (pickupRef.current.instanceColor) pickupRef.current.instanceColor.needsUpdate = true;
    }

    if (breakShardRef.current) {
      for (let i = 0; i < runtime.shards.length; i += 1) {
        const shard = runtime.shards[i];
        if (shard.active) {
          shard.life -= dt;
          if (shard.life <= 0 || shard.z > 8.8) {
            shard.active = false;
          } else {
            const lifeN = clamp(shard.life / Math.max(0.001, shard.maxLife), 0, 1);
            shard.vy -= 7.2 * dt;
            shard.vx *= Math.exp(-1.6 * dt);
            shard.vy *= Math.exp(-1.4 * dt);
            shard.vz *= Math.exp(-1.9 * dt);
            shard.x += shard.vx * dt;
            shard.y += shard.vy * dt;
            shard.z += (runtime.speed + shard.vz) * dt;
            shard.spin += shard.spinV * dt;

            dummy.position.set(shard.x, shard.y, shard.z);
            dummy.rotation.set(shard.spin, shard.spin * 0.6, shard.spin * 0.3);
            const s = shard.size * (0.48 + lifeN * 0.72);
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            breakShardRef.current.setMatrixAt(i, dummy.matrix);

            const shardColor = colorScratch
              .set(activePalette.collectible)
              .offsetHSL(shard.hue, 0.05, lifeN * 0.12)
              .lerp(colorScratchB.set(activePalette.blaster), 0.36 * (1 - lifeN));
            breakShardRef.current.setColorAt(i, shardColor);
            continue;
          }
        }

        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        breakShardRef.current.setMatrixAt(i, dummy.matrix);
        breakShardRef.current.setColorAt(i, colorScratchB.set(activePalette.collectible));
      }
      breakShardRef.current.instanceMatrix.needsUpdate = true;
      if (breakShardRef.current.instanceColor) {
        breakShardRef.current.instanceColor.needsUpdate = true;
      }
    }

    for (let i = TRAIL_POINTS - 1; i > 0; i -= 1) {
      const ptr = i * 3;
      const prev = (i - 1) * 3;
      trailAttr.array[ptr] = trailAttr.array[prev];
      trailAttr.array[ptr + 1] = trailAttr.array[prev + 1];
      trailAttr.array[ptr + 2] = -i * 0.13;
    }
    trailAttr.array[0] = runtime.carX;
    trailAttr.array[1] = CAR_Y + 0.02;
    trailAttr.array[2] = 0;
    trailAttr.needsUpdate = true;

    const ax = runtime.anchorX;
    const ay = ANCHOR_Y;
    const az = ANCHOR_Z;
    const px = runtime.carX;
    const py = CAR_Y + 0.15;
    const pz = CAR_Z + 0.28;

    for (let i = 0; i < TETHER_POINTS; i += 1) {
      const t = i / (TETHER_POINTS - 1);
      const centerBias = 1 - Math.abs(t * 2 - 1);
      const hum = Math.sin(runtime.elapsed * 12 + i * 0.6) * (0.06 * centerBias + runtime.tension * 0.05);
      const tx = lerp(px, ax, t);
      const ty = lerp(py, ay, t) - 0.08 * Math.sin(Math.PI * t) + hum * 0.22;
      const tz = lerp(pz, az, t);
      tetherPoints[i].set(tx, ty, tz);

      const ptr = i * 3;
      tetherFlat[ptr] = tx;
      tetherFlat[ptr + 1] = ty;
      tetherFlat[ptr + 2] = tz;
    }
    const tetherGeom: any = tetherLineRef.current?.geometry;
    if (tetherGeom?.setFromPoints) tetherGeom.setFromPoints(tetherPoints);
    else if (tetherGeom?.setPositions) tetherGeom.setPositions(tetherFlat);

    guidePoints[0].set(px, CAR_Y + 0.06, 0);
    guidePoints[1].set(runtime.leadGapX, 0.08, runtime.leadGapZ);
    guideFlat[0] = guidePoints[0].x;
    guideFlat[1] = guidePoints[0].y;
    guideFlat[2] = guidePoints[0].z;
    guideFlat[3] = guidePoints[1].x;
    guideFlat[4] = guidePoints[1].y;
    guideFlat[5] = guidePoints[1].z;
    const guideGeom: any = guideLineRef.current?.geometry;
    if (guideGeom?.setFromPoints) guideGeom.setFromPoints(guidePoints);
    else if (guideGeom?.setPositions) guideGeom.setPositions(guideFlat);

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 2.8, 6.8]} fov={46} />
      <color attach="background" args={[PALETTES[0].clear]} />
      <fog ref={fogRef} attach="fog" args={[PALETTES[0].fog, 8, 44]} />

      <Html fullscreen>
        <TetherDriftOverlay />
      </Html>

      <Stars radius={95} depth={60} count={1200} factor={2.4} saturation={0.38} fade speed={0.25} />

      <ambientLight intensity={0.84} />
      <hemisphereLight
        ref={hemiLightRef}
        args={[PALETTES[0].hemiSky, PALETTES[0].hemiGround, 0.58]}
      />
      <directionalLight
        ref={dirLightRef}
        position={[2.8, 5.8, 4]}
        intensity={0.92}
        color={PALETTES[0].dirLight}
      />
      <pointLight
        ref={pointLightARef}
        position={[-3.2, 2.4, -8]}
        intensity={0.46}
        color={PALETTES[0].pointA}
      />
      <pointLight
        ref={pointLightBRef}
        position={[2.8, 2.2, -9]}
        intensity={0.34}
        color={PALETTES[0].pointB}
      />

      <mesh position={[0, 0.35, -10]}>
        <planeGeometry args={[24, 16]} />
        <shaderMaterial
          ref={bgMatRef}
          uniforms={{
            uTime: { value: 0 },
            uSea: { value: new THREE.Color(PALETTES[0].bgSea) },
            uSky: { value: new THREE.Color(PALETTES[0].bgSky) },
            uMist: { value: new THREE.Color(PALETTES[0].bgMist) },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform vec3 uSea;
            uniform vec3 uSky;
            uniform vec3 uMist;
            varying vec2 vUv;
            void main() {
              vec3 sea = uSea;
              vec3 sky = uSky;
              vec3 mist = uMist;

              float grad = smoothstep(0.0, 1.0, vUv.y);
              float flow = 0.5 + 0.5 * sin((vUv.x * 2.0 + uTime * 0.12) * 6.2831853);
              float haze = 0.5 + 0.5 * sin((vUv.y * 3.3 + uTime * 0.08) * 6.2831853);

              vec3 col = mix(sea, sky, grad * 0.75);
              col = mix(col, mist, (1.0 - grad) * 0.24 + flow * 0.08 + haze * 0.05);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -12]}>
        <planeGeometry args={[ROAD_HALF_WIDTH * 2, 60]} />
        <shaderMaterial
          ref={roadMatRef}
          uniforms={{
            uTime: { value: 0 },
            uBoost: { value: 0 },
            uBaseA: { value: new THREE.Color(PALETTES[0].roadBaseA) },
            uBaseB: { value: new THREE.Color(PALETTES[0].roadBaseB) },
            uStripeA: { value: new THREE.Color(PALETTES[0].roadStripeA) },
            uStripeB: { value: new THREE.Color(PALETTES[0].roadStripeB) },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uBoost;
            uniform vec3 uBaseA;
            uniform vec3 uBaseB;
            uniform vec3 uStripeA;
            uniform vec3 uStripeB;
            varying vec2 vUv;

            void main() {
              float edge = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
              float lane = sin((vUv.y * 30.0 - uTime * (18.0 + uBoost * 14.0)) * 6.2831853);
              float laneGlow = smoothstep(0.92, 1.0, lane);
              float center = exp(-pow((vUv.x - 0.5) * 4.0, 2.0));
              vec3 base = mix(uBaseA, uBaseB, center);
              vec3 stripe = mix(uStripeA, uStripeB, uBoost * 0.7);
              vec3 col = base + stripe * laneGlow * edge * (0.32 + uBoost * 0.35);
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[-ROAD_HALF_WIDTH, 0.24, -12]}>
        <boxGeometry args={[0.18, 0.5, 60]} />
        <meshStandardMaterial
          ref={leftRailMatRef}
          color={PALETTES[0].railA}
          emissive={PALETTES[0].railA}
          emissiveIntensity={0.46}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[ROAD_HALF_WIDTH, 0.24, -12]}>
        <boxGeometry args={[0.18, 0.5, 60]} />
        <meshStandardMaterial
          ref={rightRailMatRef}
          color={PALETTES[0].railB}
          emissive={PALETTES[0].railB}
          emissiveIntensity={0.42}
          roughness={0.25}
        />
      </mesh>

      <instancedMesh ref={barrierRef} args={[undefined, undefined, BARRIER_INSTANCES]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.24}
          metalness={0.18}
          emissive="#2f746a"
          emissiveIntensity={0.42}
        />
      </instancedMesh>

      <instancedMesh ref={gapMarkerRef} args={[undefined, undefined, CLUSTER_POOL]}>
        <torusGeometry args={[0.26, 0.05, 10, 24]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.84}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh ref={pickupRef} args={[undefined, undefined, PICKUP_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.2}
          metalness={0.25}
          emissive="#8cd74a"
          emissiveIntensity={0.38}
        />
      </instancedMesh>

      <instancedMesh ref={breakShardRef} args={[undefined, undefined, BREAK_SHARD_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.2}
          metalness={0.36}
          emissive={PALETTES[0].collectible}
          emissiveIntensity={0.56}
        />
      </instancedMesh>

      <mesh ref={anchorRef} position={[0, ANCHOR_Y, ANCHOR_Z]}>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          ref={anchorMatRef}
          color={PALETTES[0].anchor}
          emissive={PALETTES[0].anchor}
          emissiveIntensity={0.6}
          roughness={0.16}
        />
      </mesh>

      <group ref={carGroupRef} position={[0, CAR_Y, CAR_Z]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[0.72, 0.22, 1.3]} />
          <meshStandardMaterial
            ref={carBodyMatRef}
            color={PALETTES[0].carBody}
            emissive={PALETTES[0].carCockpit}
            emissiveIntensity={0.34}
            roughness={0.14}
            metalness={0.26}
          />
        </mesh>

        <mesh position={[0, 0.24, -0.08]} castShadow>
          <boxGeometry args={[0.5, 0.2, 0.48]} />
          <meshStandardMaterial
            ref={carCockpitMatRef}
            color={PALETTES[0].carCockpit}
            emissive={PALETTES[0].carFront}
            emissiveIntensity={0.22}
            roughness={0.2}
            metalness={0.22}
          />
        </mesh>

        <mesh position={[0, 0.03, -0.52]}>
          <boxGeometry args={[0.58, 0.08, 0.22]} />
          <meshStandardMaterial
            ref={carFrontMatRef}
            color={PALETTES[0].carFront}
            emissive={PALETTES[0].carFront}
            emissiveIntensity={0.92}
            roughness={0.1}
            metalness={0.3}
          />
        </mesh>

        <mesh position={[0, 0.03, 0.56]}>
          <boxGeometry args={[0.58, 0.08, 0.2]} />
          <meshStandardMaterial
            ref={carRearMatRef}
            color={PALETTES[0].carRear}
            emissive={PALETTES[0].carRear}
            emissiveIntensity={0.72}
            roughness={0.1}
            metalness={0.3}
          />
        </mesh>
      </group>

      <Line
        ref={tetherLineRef}
        points={tetherPoints}
        color={PALETTES[0].tether}
        lineWidth={2.6}
        transparent
        opacity={snap.phase === 'playing' ? 0.95 : 0.72}
      />

      <Line
        ref={guideLineRef}
        points={guidePoints}
        color={PALETTES[0].guide}
        lineWidth={1.2}
        transparent
        opacity={snap.phase === 'playing' ? 0.38 : 0.2}
      />

      <points geometry={trailGeometry}>
        <pointsMaterial
          ref={trailMatRef}
          color={PALETTES[0].tether}
          size={0.055}
          sizeAttenuation
          transparent
          opacity={0.62}
        />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.72} luminanceThreshold={0.42} luminanceSmoothing={0.22} mipmapBlur />
        <Vignette eskil={false} offset={0.08} darkness={0.32} />
        <Noise premultiply opacity={0.01} />
      </EffectComposer>
    </>
  );
}

const TetherDrift: React.FC<{ soundsOn?: boolean }> = () => {
  return <TetherDriftScene />;
};

export default TetherDrift;
export * from './state';
