'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';
import { create } from 'zustand';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { traceState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'LEVEL_CLEAR' | 'GAMEOVER';
type DirectionIndex = 0 | 1 | 2 | 3;
type MedalTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | null;
type ThemeMode = 'RANDOM' | 'MANUAL';

type TraceTheme = {
  key: string;
  label: string;
  trailA: string;
  trailB: string;
  trailPulse: string;
  player: string;
  playerPhase: string;
  gridA: string;
  gridB: string;
  borderX: string;
  borderZ: string;
  corner: string;
  pickup: string;
  hazard: string;
  spark: string;
};

type TrailSegment = {
  id: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  thickness: number;
  createdAt: number;
};

type TrailCell = {
  key: number;
  x: number;
  z: number;
  createdAt: number;
};

type VoidSquare = {
  x: number;
  z: number;
  size: number;
  ttl: number;
  active: boolean;
};

type PhasePickup = {
  x: number;
  z: number;
  spin: number;
  ttl: number;
  active: boolean;
};

type Spark = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
};

type Runtime = {
  elapsed: number;
  score: number;
  tightTurnBonus: number;
  tightTurns: number;
  danger: number;
  speed: number;
  baseSpeed: number;
  bound: number;
  level: number;
  gridSize: number;
  fillCols: number;
  totalCells: number;
  completion: number;
  collectibles: number;
  playerX: number;
  playerZ: number;
  laneX: number;
  laneZ: number;
  dir: DirectionIndex;
  playerYaw: number;
  targetYaw: number;
  trailStartX: number;
  trailStartZ: number;
  turnAnchorX: number;
  turnAnchorZ: number;
  ignoreSegmentId: number;
  phaseCharges: number;
  phaseTimer: number;
  phaseInvuln: number;
  turnGrace: number;
  segments: TrailSegment[];
  segmentMap: Map<number, TrailSegment>;
  buckets: Map<string, number[]>;
  nextSegmentId: number;
  trailCells: TrailCell[];
  trailCellSet: Set<number>;
  voids: VoidSquare[];
  pickups: PhasePickup[];
  voidSpawnTimer: number;
  pickupSpawnTimer: number;
  sparks: Spark[];
  hudCommit: number;
  activeThemeIndex: number;
  activeHeadStyleIndex: number;
};

type TraceStore = {
  status: GameStatus;
  score: number;
  best: number;
  tightTurns: number;
  phaseCharges: number;
  level: number;
  resultLevel: number;
  completion: number;
  collectibles: number;
  medal: MedalTier;
  themeMode: ThemeMode;
  manualThemeIndex: number;
  manualHeadIndex: number;
  activeThemeIndex: number;
  activeHeadIndex: number;
  startRun: (options: {
    level: number;
    themeIndex: number;
    headIndex: number;
    resetScore: boolean;
  }) => void;
  completeLevel: (result: {
    score: number;
    completion: number;
    collectibles: number;
    medal: Exclude<MedalTier, null>;
    tightTurns: number;
    phaseCharges: number;
  }) => void;
  endRun: (result: {
    score: number;
    completion: number;
    collectibles: number;
    medal: MedalTier;
    tightTurns: number;
    phaseCharges: number;
  }) => void;
  resetToStart: () => void;
  setPhaseCharges: (phaseCharges: number) => void;
  updateHud: (hud: {
    score: number;
    tightTurns: number;
    completion: number;
    collectibles: number;
  }) => void;
  setThemeMode: (mode: ThemeMode) => void;
  cycleTheme: () => void;
  cycleHead: () => void;
};

const TRACE_THEMES: TraceTheme[] = [
  {
    key: 'neon-tide',
    label: 'Neon Tide',
    trailA: '#2be4ff',
    trailB: '#ff48d8',
    trailPulse: '#ff7ce8',
    player: '#77f7ff',
    playerPhase: '#ff8be8',
    gridA: '#1f4962',
    gridB: '#3a234a',
    borderX: '#66c8ff',
    borderZ: '#ff73e3',
    corner: '#e8f7ff',
    pickup: '#ffd46c',
    hazard: '#ff5f78',
    spark: '#ffd46c',
  },
  {
    key: 'solar-flare',
    label: 'Solar Flare',
    trailA: '#ffbe0b',
    trailB: '#ff5f3d',
    trailPulse: '#ffd166',
    player: '#ffd36d',
    playerPhase: '#fff3ad',
    gridA: '#5e3712',
    gridB: '#5a1f18',
    borderX: '#ffb347',
    borderZ: '#ff6c4f',
    corner: '#ffecc9',
    pickup: '#fff3a1',
    hazard: '#ff3d52',
    spark: '#ffe08a',
  },
  {
    key: 'mint-noir',
    label: 'Mint Noir',
    trailA: '#4ef7c8',
    trailB: '#2dd4bf',
    trailPulse: '#86ffd6',
    player: '#8affde',
    playerPhase: '#b7ffe9',
    gridA: '#14352f',
    gridB: '#1b4048',
    borderX: '#4bf2d0',
    borderZ: '#64e8ff',
    corner: '#d8fff3',
    pickup: '#d9ff9d',
    hazard: '#ff6f9c',
    spark: '#b8ffe7',
  },
  {
    key: 'arcade-plum',
    label: 'Arcade Plum',
    trailA: '#8f7dff',
    trailB: '#ff6ad5',
    trailPulse: '#c5b4ff',
    player: '#bbaeff',
    playerPhase: '#f2b9ff',
    gridA: '#2a2158',
    gridB: '#462043',
    borderX: '#9ba1ff',
    borderZ: '#ff8ae3',
    corner: '#efe9ff',
    pickup: '#ffe08e',
    hazard: '#ff5f8d',
    spark: '#f7c8ff',
  },
  {
    key: 'tech-lime',
    label: 'Tech Lime',
    trailA: '#9dfc4c',
    trailB: '#4dd7a8',
    trailPulse: '#d6ff86',
    player: '#c9ff88',
    playerPhase: '#ebffb0',
    gridA: '#2d4623',
    gridB: '#1f3f32',
    borderX: '#b1ff6a',
    borderZ: '#57f0bf',
    corner: '#f0ffd7',
    pickup: '#fff0a8',
    hazard: '#ff6a7a',
    spark: '#e9ff9f',
  },
];

const HEAD_STYLES = ['Comet', 'Prism', 'Halo', 'Bolt'] as const;

const BEST_KEY = 'trace_hyper_best_v2';

const CELL_SIZE = 0.62;
const PLAYER_RADIUS = 0.12;
const TRAIL_THICKNESS = PLAYER_RADIUS;
const TRAIL_TILE_SIZE = PLAYER_RADIUS * 2;
const TRAIL_COMMIT_STEP = TRAIL_TILE_SIZE * 0.95;
const FILL_TILE_HEIGHT = 0.06;
const FILL_TILE_Y = 0.06;
const TRAIL_VISUAL_Y = 0.22;

const MAX_TRAIL_SEGMENTS = 6200;
const TRAIL_INSTANCE_CAP = 4200;
const FILL_CELL_CAP = 2400;
const VOID_POOL = 20;
const PICKUP_POOL = 14;
const MAX_SPARKS = 120;
const GRID_LINE_CAP = 128;

const LEVEL_GRID_START = 7;
const LEVEL_GRID_MAX = 17;
const TIGHT_TURN_THRESHOLD = 0.62;
const SWIPE_THRESHOLD = 0.08;
const SWIPE_AXIS_RATIO = 1.1;
const TURN_GRACE_TIME = 0.1;

const SPEED_START = 1.75;
const SPEED_MAX = 4.2;

const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const DIRECTIONS: Array<{ x: number; z: number }> = [
  { x: -1, z: 0 },
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
];
const DIR_YAWS: number[] = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
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

const bucketKey = (x: number, z: number) => `${x},${z}`;
const toCell = (v: number) => Math.floor(v / CELL_SIZE);

const gridSizeForLevel = (level: number) =>
  Math.floor(clamp(LEVEL_GRID_START + (level - 1), LEVEL_GRID_START, LEVEL_GRID_MAX));
const speedForLevel = (level: number) =>
  clamp(SPEED_START + (level - 1) * 0.16, SPEED_START, SPEED_MAX);
const levelBound = (gridSize: number) => gridSize * CELL_SIZE * 0.5;
const fillColsForBound = (bound: number) =>
  Math.max(1, Math.round((bound * 2) / TRAIL_TILE_SIZE));
const boundsForLevel = (level: number) => {
  const gridSize = gridSizeForLevel(level);
  const baseBound = levelBound(gridSize);
  const fillCols = fillColsForBound(baseBound);
  const bound = (fillCols * TRAIL_TILE_SIZE) * 0.5;
  return { gridSize, fillCols, bound };
};

const medalForCompletion = (completion: number): MedalTier => {
  const pct = clamp(completion, 0, 100);
  if (pct >= 100) return 'DIAMOND';
  if (pct >= 90) return 'GOLD';
  if (pct >= 80) return 'SILVER';
  if (pct >= 70) return 'BRONZE';
  return null;
};

const directionFromKeys = (justPressed: Set<string>): DirectionIndex | null => {
  if (justPressed.has('arrowup') || justPressed.has('w')) return 3;
  if (justPressed.has('arrowright') || justPressed.has('d')) return 0;
  if (justPressed.has('arrowdown') || justPressed.has('s')) return 1;
  if (justPressed.has('arrowleft') || justPressed.has('a')) return 2;
  return null;
};

const directionFromSwipe = (
  dx: number,
  dy: number,
  threshold = SWIPE_THRESHOLD
): DirectionIndex | null => {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO) return dx > 0 ? 0 : 2;
  if (Math.abs(dy) > Math.abs(dx) * SWIPE_AXIS_RATIO) return dy > 0 ? 1 : 3;
  return null;
};

const isPerpendicularTurn = (from: DirectionIndex, to: DirectionIndex) => {
  const a = DIRECTIONS[from];
  const b = DIRECTIONS[to];
  return a.x * b.x + a.z * b.z === 0;
};

const cellCenterFromIndex = (bound: number, index: number) =>
  -bound + (index + 0.5) * TRAIL_TILE_SIZE;

const nearestCellCenter = (runtime: Runtime, value: number) => {
  const centered = (value + runtime.bound) / TRAIL_TILE_SIZE - 0.5;
  const idx = Math.round(centered);
  const clamped = Math.max(0, Math.min(runtime.fillCols - 1, idx));
  return cellCenterFromIndex(runtime.bound, clamped);
};

const startCellCenter = (fillCols: number, bound: number) => {
  const mid = Math.floor(fillCols / 2);
  return cellCenterFromIndex(bound, mid);
};

const alignRuntimeToLane = (runtime: Runtime, dir: DirectionIndex = runtime.dir) => {
  const direction = DIRECTIONS[dir];
  if (direction.x !== 0) {
    runtime.laneZ = nearestCellCenter(runtime, runtime.playerZ);
    runtime.playerZ = runtime.laneZ;
    runtime.trailStartZ = runtime.laneZ;
    runtime.turnAnchorZ = runtime.laneZ;
  } else {
    runtime.laneX = nearestCellCenter(runtime, runtime.playerX);
    runtime.playerX = runtime.laneX;
    runtime.trailStartX = runtime.laneX;
    runtime.turnAnchorX = runtime.laneX;
  }
};

const pointSegmentDistance = (
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
) => {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 0.000001) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * vx + (pz - az) * vz) / lenSq;
  t = clamp(t, 0, 1);
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return Math.hypot(px - cx, pz - cz);
};

const useTraceStore = create<TraceStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  tightTurns: 0,
  phaseCharges: 0,
  level: 1,
  resultLevel: 1,
  completion: 0,
  collectibles: 0,
  medal: null,
  themeMode: 'RANDOM',
  manualThemeIndex: 0,
  manualHeadIndex: 0,
  activeThemeIndex: 0,
  activeHeadIndex: 0,
  startRun: ({ level, themeIndex, headIndex, resetScore }) =>
    set((state) => ({
      status: 'PLAYING',
      level,
      resultLevel: level,
      score: resetScore ? 0 : state.score,
      tightTurns: 0,
      phaseCharges: 0,
      completion: 0,
      collectibles: 0,
      medal: null,
      activeThemeIndex: themeIndex,
      activeHeadIndex: headIndex,
    })),
  completeLevel: ({ score, completion, collectibles, medal, tightTurns, phaseCharges }) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'LEVEL_CLEAR',
        score: Math.floor(score),
        best: nextBest,
        tightTurns,
        phaseCharges,
        completion: clamp(completion, 0, 100),
        collectibles,
        medal,
        resultLevel: state.level,
        level: state.level + 1,
      };
    }),
  endRun: ({ score, completion, collectibles, medal, tightTurns, phaseCharges }) =>
    set((state) => {
      const nextBest = Math.max(state.best, Math.floor(score));
      if (nextBest !== state.best) writeBest(nextBest);
      return {
        status: 'GAMEOVER',
        score: Math.floor(score),
        best: nextBest,
        tightTurns,
        phaseCharges,
        completion: clamp(completion, 0, 100),
        collectibles,
        medal,
        resultLevel: state.level,
        level: 1,
      };
    }),
  resetToStart: () =>
    set((state) => ({
      status: 'START',
      score: 0,
      tightTurns: 0,
      phaseCharges: 0,
      level: 1,
      resultLevel: 1,
      completion: 0,
      collectibles: 0,
      medal: null,
      activeThemeIndex: state.manualThemeIndex,
      activeHeadIndex: state.manualHeadIndex,
    })),
  setPhaseCharges: (phaseCharges) => set({ phaseCharges }),
  updateHud: ({ score, tightTurns, completion, collectibles }) =>
    set({
      score: Math.floor(score),
      tightTurns,
      completion: clamp(completion, 0, 100),
      collectibles,
    }),
  setThemeMode: (mode) => set({ themeMode: mode }),
  cycleTheme: () =>
    set((state) => ({
      manualThemeIndex: (state.manualThemeIndex + 1) % TRACE_THEMES.length,
    })),
  cycleHead: () =>
    set((state) => ({
      manualHeadIndex: (state.manualHeadIndex + 1) % HEAD_STYLES.length,
    })),
}));

const createVoid = (): VoidSquare => ({
  x: 0,
  z: 0,
  size: 0.42,
  ttl: 0,
  active: false,
});

const createPickup = (): PhasePickup => ({
  x: 0,
  z: 0,
  spin: 0,
  ttl: 0,
  active: false,
});

const createRuntime = (): Runtime => {
  const initial = boundsForLevel(1);
  const start = startCellCenter(initial.fillCols, initial.bound);
  return {
    elapsed: 0,
    score: 0,
    tightTurnBonus: 0,
    tightTurns: 0,
    danger: 0,
    speed: speedForLevel(1),
    baseSpeed: speedForLevel(1),
    bound: initial.bound,
    level: 1,
    gridSize: initial.gridSize,
    fillCols: initial.fillCols,
    totalCells: initial.fillCols * initial.fillCols,
    completion: 0,
    collectibles: 0,
    playerX: start,
    playerZ: start,
    laneX: start,
    laneZ: start,
    dir: 0,
    playerYaw: DIR_YAWS[0],
    targetYaw: DIR_YAWS[0],
    trailStartX: start,
    trailStartZ: start,
    turnAnchorX: start,
    turnAnchorZ: start,
    ignoreSegmentId: -1,
    phaseCharges: 0,
    phaseTimer: 0,
    phaseInvuln: 0,
    turnGrace: 0,
    segments: [],
    segmentMap: new Map(),
    buckets: new Map(),
    nextSegmentId: 1,
    trailCells: [],
    trailCellSet: new Set(),
    voids: Array.from({ length: VOID_POOL }, createVoid),
    pickups: Array.from({ length: PICKUP_POOL }, createPickup),
    voidSpawnTimer: 2.4,
    pickupSpawnTimer: 4.2,
    sparks: [],
    hudCommit: 0,
    activeThemeIndex: 0,
    activeHeadStyleIndex: 0,
  };
};

const difficultyAt = (runtime: Runtime) =>
  clamp((runtime.level - 1) / 12 + runtime.elapsed / 80, 0, 1);

const insertSegmentIntoHash = (runtime: Runtime, seg: TrailSegment) => {
  runtime.segmentMap.set(seg.id, seg);
  const minX = Math.min(seg.ax, seg.bx) - seg.thickness;
  const maxX = Math.max(seg.ax, seg.bx) + seg.thickness;
  const minZ = Math.min(seg.az, seg.bz) - seg.thickness;
  const maxZ = Math.max(seg.az, seg.bz) + seg.thickness;
  const ix0 = toCell(minX);
  const ix1 = toCell(maxX);
  const iz0 = toCell(minZ);
  const iz1 = toCell(maxZ);
  for (let ix = ix0; ix <= ix1; ix += 1) {
    for (let iz = iz0; iz <= iz1; iz += 1) {
      const key = bucketKey(ix, iz);
      const bucket = runtime.buckets.get(key);
      if (bucket) {
        bucket.push(seg.id);
      } else {
        runtime.buckets.set(key, [seg.id]);
      }
    }
  }
};

const rebuildHash = (runtime: Runtime) => {
  runtime.buckets.clear();
  runtime.segmentMap.clear();
  for (const seg of runtime.segments) insertSegmentIntoHash(runtime, seg);
};

const addSegment = (runtime: Runtime, seg: TrailSegment) => {
  runtime.segments.push(seg);
  insertSegmentIntoHash(runtime, seg);
  if (runtime.segments.length > MAX_TRAIL_SEGMENTS) {
    runtime.segments.splice(0, runtime.segments.length - MAX_TRAIL_SEGMENTS);
    rebuildHash(runtime);
  }
};

const finalizeCurrentSegment = (runtime: Runtime, endX: number, endZ: number) => {
  const dx = endX - runtime.trailStartX;
  const dz = endZ - runtime.trailStartZ;
  if (dx * dx + dz * dz < 0.0006) {
    runtime.trailStartX = endX;
    runtime.trailStartZ = endZ;
    runtime.turnAnchorX = endX;
    runtime.turnAnchorZ = endZ;
    return;
  }
  const seg: TrailSegment = {
    id: runtime.nextSegmentId++,
    ax: runtime.trailStartX,
    az: runtime.trailStartZ,
    bx: endX,
    bz: endZ,
    thickness: TRAIL_THICKNESS,
    createdAt: runtime.elapsed,
  };
  addSegment(runtime, seg);
  runtime.ignoreSegmentId = seg.id;
  runtime.trailStartX = endX;
  runtime.trailStartZ = endZ;
  runtime.turnAnchorX = endX;
  runtime.turnAnchorZ = endZ;
};

const commitTrailTo = (runtime: Runtime, endX: number, endZ: number, force = false) => {
  let guard = 0;
  while (guard < 24) {
    const dx = endX - runtime.trailStartX;
    const dz = endZ - runtime.trailStartZ;
    const len = Math.hypot(dx, dz);
    if (len < 0.0009) break;

    if (!force && len <= TRAIL_COMMIT_STEP) break;

    if (force || len <= TRAIL_COMMIT_STEP * 1.05) {
      finalizeCurrentSegment(runtime, endX, endZ);
      break;
    }

    const t = TRAIL_COMMIT_STEP / len;
    const midX = runtime.trailStartX + dx * t;
    const midZ = runtime.trailStartZ + dz * t;
    finalizeCurrentSegment(runtime, midX, midZ);
    guard += 1;
  }
};

const cellFromWorld = (runtime: Runtime, x: number, z: number) => {
  const localX = x + runtime.bound;
  const localZ = z + runtime.bound;
  const gx = Math.floor(localX / TRAIL_TILE_SIZE);
  const gz = Math.floor(localZ / TRAIL_TILE_SIZE);
  if (gx < 0 || gz < 0 || gx >= runtime.fillCols || gz >= runtime.fillCols) return null;
  const key = gz * runtime.fillCols + gx;
  const cx = -runtime.bound + (gx + 0.5) * TRAIL_TILE_SIZE;
  const cz = -runtime.bound + (gz + 0.5) * TRAIL_TILE_SIZE;
  return { key, cx, cz };
};

const markTrailCell = (runtime: Runtime, x: number, z: number) => {
  const cell = cellFromWorld(runtime, x, z);
  if (!cell) return;
  if (runtime.trailCellSet.has(cell.key)) return;
  runtime.trailCellSet.add(cell.key);
  runtime.trailCells.push({
    key: cell.key,
    x: cell.cx,
    z: cell.cz,
    createdAt: runtime.elapsed,
  });
  runtime.completion = (runtime.trailCellSet.size / Math.max(1, runtime.totalCells)) * 100;
};

const queryNearbySegmentIds = (runtime: Runtime, x: number, z: number) => {
  const ix = toCell(x);
  const iz = toCell(z);
  const out = new Set<number>();
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      const bucket = runtime.buckets.get(bucketKey(ix + dx, iz + dz));
      if (!bucket) continue;
      for (const id of bucket) out.add(id);
    }
  }
  return out;
};

const checkTrailCollision = (runtime: Runtime, x: number, z: number) => {
  if (runtime.turnGrace > 0) return { hit: false, near: false };
  const ids = queryNearbySegmentIds(runtime, x, z);
  let near = false;
  const hitThreshold = TRAIL_THICKNESS + PLAYER_RADIUS * 0.9;
  const nearThreshold = TRAIL_THICKNESS + PLAYER_RADIUS * 1.85;
  for (const id of ids) {
    if (id === runtime.ignoreSegmentId) continue;
    const seg = runtime.segmentMap.get(id);
    if (!seg) continue;
    const d = pointSegmentDistance(x, z, seg.ax, seg.az, seg.bx, seg.bz);
    if (d < hitThreshold) return { hit: true, near: true };
    if (d < nearThreshold) near = true;
  }
  return { hit: false, near };
};

const prepareLevelRuntime = (
  runtime: Runtime,
  level: number,
  themeIndex: number,
  headIndex: number
) => {
  const layout = boundsForLevel(level);
  const start = startCellCenter(layout.fillCols, layout.bound);
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.tightTurnBonus = 0;
  runtime.tightTurns = 0;
  runtime.danger = 0;
  runtime.level = level;
  runtime.gridSize = layout.gridSize;
  runtime.fillCols = layout.fillCols;
  runtime.totalCells = layout.fillCols * layout.fillCols;
  runtime.baseSpeed = speedForLevel(level);
  runtime.speed = runtime.baseSpeed;
  runtime.bound = layout.bound;
  runtime.completion = 0;
  runtime.collectibles = 0;
  runtime.playerX = start;
  runtime.playerZ = start;
  runtime.laneX = start;
  runtime.laneZ = start;
  runtime.dir = 0;
  runtime.playerYaw = DIR_YAWS[0];
  runtime.targetYaw = DIR_YAWS[0];
  runtime.trailStartX = start;
  runtime.trailStartZ = start;
  runtime.turnAnchorX = start;
  runtime.turnAnchorZ = start;
  runtime.ignoreSegmentId = -1;
  runtime.phaseCharges = 0;
  runtime.phaseTimer = 0;
  runtime.phaseInvuln = 0;
  runtime.turnGrace = 0;
  runtime.segments.length = 0;
  runtime.segmentMap.clear();
  runtime.buckets.clear();
  runtime.nextSegmentId = 1;
  runtime.trailCells.length = 0;
  runtime.trailCellSet.clear();
  runtime.voidSpawnTimer = level <= 2 ? 6 : 2.4;
  runtime.pickupSpawnTimer = 3.6;
  runtime.sparks.length = 0;
  runtime.hudCommit = 0;
  runtime.activeThemeIndex = themeIndex;
  runtime.activeHeadStyleIndex = headIndex;

  for (const v of runtime.voids) {
    v.active = false;
    v.ttl = 0;
  }
  for (const p of runtime.pickups) {
    p.active = false;
    p.ttl = 0;
    p.spin = 0;
  }

  markTrailCell(runtime, runtime.playerX, runtime.playerZ);
};

const resetRuntime = (runtime: Runtime) => {
  runtime.elapsed = 0;
  runtime.score = 0;
  runtime.tightTurnBonus = 0;
  runtime.tightTurns = 0;
  runtime.danger = 0;
  const layout = boundsForLevel(1);
  const start = startCellCenter(layout.fillCols, layout.bound);
  runtime.level = 1;
  runtime.gridSize = layout.gridSize;
  runtime.bound = layout.bound;
  runtime.fillCols = layout.fillCols;
  runtime.totalCells = runtime.fillCols * runtime.fillCols;
  runtime.baseSpeed = speedForLevel(1);
  runtime.speed = runtime.baseSpeed;
  runtime.completion = 0;
  runtime.collectibles = 0;
  runtime.playerX = start;
  runtime.playerZ = start;
  runtime.laneX = start;
  runtime.laneZ = start;
  runtime.dir = 0;
  runtime.playerYaw = DIR_YAWS[0];
  runtime.targetYaw = DIR_YAWS[0];
  runtime.trailStartX = start;
  runtime.trailStartZ = start;
  runtime.turnAnchorX = start;
  runtime.turnAnchorZ = start;
  runtime.ignoreSegmentId = -1;
  runtime.phaseCharges = 0;
  runtime.phaseTimer = 0;
  runtime.phaseInvuln = 0;
  runtime.turnGrace = 0;
  runtime.segments.length = 0;
  runtime.segmentMap.clear();
  runtime.buckets.clear();
  runtime.nextSegmentId = 1;
  runtime.trailCells.length = 0;
  runtime.trailCellSet.clear();
  runtime.voidSpawnTimer = 2.4;
  runtime.pickupSpawnTimer = 4.2;
  runtime.sparks.length = 0;
  runtime.hudCommit = 0;
  runtime.activeThemeIndex = 0;
  runtime.activeHeadStyleIndex = 0;

  for (const v of runtime.voids) {
    v.active = false;
    v.ttl = 0;
  }
  for (const p of runtime.pickups) {
    p.active = false;
    p.ttl = 0;
    p.spin = 0;
  }
};

const spawnVoid = (runtime: Runtime) => {
  if (runtime.level <= 2) return;
  const slot =
    runtime.voids.find((v) => !v.active) ??
    runtime.voids[Math.floor(Math.random() * runtime.voids.length)];
  const d = difficultyAt(runtime);
  const size = clamp(lerp(0.34, 0.84, d) + Math.random() * 0.12, 0.32, 0.88);
  const margin = size * 0.5 + 0.35;
  for (let i = 0; i < 9; i += 1) {
    const x = (Math.random() * 2 - 1) * (runtime.bound - margin);
    const z = (Math.random() * 2 - 1) * (runtime.bound - margin);
    if (Math.hypot(x - runtime.playerX, z - runtime.playerZ) < 1.1) continue;
    slot.x = x;
    slot.z = z;
    slot.size = size;
    slot.ttl = lerp(8.0, 4.3, d) + Math.random() * 2.3;
    slot.active = true;
    return;
  }
};

const spawnPickup = (runtime: Runtime) => {
  const slot =
    runtime.pickups.find((p) => !p.active) ??
    runtime.pickups[Math.floor(Math.random() * runtime.pickups.length)];
  const margin = 0.7;
  for (let i = 0; i < 10; i += 1) {
    const x = (Math.random() * 2 - 1) * (runtime.bound - margin);
    const z = (Math.random() * 2 - 1) * (runtime.bound - margin);
    if (Math.hypot(x - runtime.playerX, z - runtime.playerZ) < 1.0) continue;
    slot.x = x;
    slot.z = z;
    slot.spin = Math.random() * Math.PI * 2;
    slot.ttl = 10 + Math.random() * 7;
    slot.active = true;
    return;
  }
};

const medalClassName = (medal: MedalTier) => {
  if (medal === 'DIAMOND') return 'text-cyan-100';
  if (medal === 'GOLD') return 'text-amber-200';
  if (medal === 'SILVER') return 'text-zinc-100';
  if (medal === 'BRONZE') return 'text-orange-200';
  return 'text-white';
};

function TraceOverlay() {
  const status = useTraceStore((s) => s.status);
  const score = useTraceStore((s) => s.score);
  const best = useTraceStore((s) => s.best);
  const tightTurns = useTraceStore((s) => s.tightTurns);
  const phaseCharges = useTraceStore((s) => s.phaseCharges);
  const level = useTraceStore((s) => s.level);
  const resultLevel = useTraceStore((s) => s.resultLevel);
  const completion = useTraceStore((s) => s.completion);
  const collectibles = useTraceStore((s) => s.collectibles);
  const medal = useTraceStore((s) => s.medal);

  const themeMode = useTraceStore((s) => s.themeMode);
  const manualThemeIndex = useTraceStore((s) => s.manualThemeIndex);
  const manualHeadIndex = useTraceStore((s) => s.manualHeadIndex);
  const activeThemeIndex = useTraceStore((s) => s.activeThemeIndex);
  const setThemeMode = useTraceStore((s) => s.setThemeMode);
  const cycleTheme = useTraceStore((s) => s.cycleTheme);
  const cycleHead = useTraceStore((s) => s.cycleHead);

  const previewThemeIndex = themeMode === 'MANUAL' ? manualThemeIndex : activeThemeIndex;
  const previewTheme = TRACE_THEMES[previewThemeIndex] ?? TRACE_THEMES[0];

  const stopPointer: React.PointerEventHandler<HTMLElement> = (event) => {
    event.stopPropagation();
  };

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-cyan-100/55 bg-gradient-to-br from-cyan-500/22 via-sky-500/16 to-emerald-500/20 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/80">Trace</div>
        <div className="text-[11px] text-cyan-50/80">Arrows/WASD or swipe to steer.</div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-amber-100/55 bg-gradient-to-br from-amber-500/24 via-fuchsia-500/16 to-violet-500/20 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-cyan-100/35 bg-gradient-to-br from-slate-950/72 via-cyan-900/30 to-amber-900/22 px-3 py-2 text-xs text-white/90">
          <div>
            Level <span className="font-semibold text-cyan-200">{level}</span>
          </div>
          <div>
            Fill <span className="font-semibold text-emerald-200">{completion.toFixed(1)}%</span>
          </div>
          <div>
            Collectibles <span className="font-semibold text-amber-200">{collectibles}</span>
          </div>
          <div>
            Tight Turns <span className="font-semibold text-cyan-200">{tightTurns}</span>
          </div>
          <div>
            PHASE <span className="font-semibold text-fuchsia-200">{phaseCharges}</span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-cyan-100/42 bg-gradient-to-br from-slate-950/82 via-cyan-950/46 to-amber-950/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">TRACE</div>
            <div className="mt-2 text-sm text-white/85">Fill the grid and never overlap your path.</div>
            <div className="mt-1 text-sm text-white/80">Your full trail now stays painted on the arena.</div>
            <div className="mt-2 text-xs text-white/75">
              Medals: 70-79 Bronze • 80-89 Silver • 90-99 Gold • 100 Diamond
            </div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap to start Level 1.</div>
          </div>
        </div>
      )}

      {status === 'LEVEL_CLEAR' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-emerald-100/45 bg-gradient-to-br from-black/84 via-emerald-950/44 to-cyan-950/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-emerald-100">Level {resultLevel} Cleared</div>
            <div className={`mt-2 text-sm font-semibold tracking-wide ${medalClassName(medal)}`}>
              {medal} Medal
            </div>
            <div className="mt-1 text-sm text-white/80">Completion {completion.toFixed(1)}%</div>
            <div className="mt-1 text-sm text-white/75">Collectibles {collectibles}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap for Level {level}.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/45 bg-gradient-to-br from-black/84 via-rose-950/44 to-cyan-950/30 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-fuchsia-200">Trace Lost</div>
            <div className="mt-2 text-sm text-white/80">Level {resultLevel} • Fill {completion.toFixed(1)}%</div>
            <div className="mt-1 text-sm text-white/75">Collectibles {collectibles}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <div className="mt-3 text-sm text-cyan-200/90">Tap to restart at Level 1.</div>
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-xs backdrop-blur-sm">
        <button
          type="button"
          onPointerDown={stopPointer}
          onClick={() => setThemeMode(themeMode === 'RANDOM' ? 'MANUAL' : 'RANDOM')}
          className="rounded bg-white/10 px-2 py-1 text-white/90 hover:bg-white/20"
        >
          Palette {themeMode === 'RANDOM' ? 'Random' : 'Manual'}
        </button>
        <button
          type="button"
          onPointerDown={stopPointer}
          onClick={cycleTheme}
          className="rounded bg-white/10 px-2 py-1 text-white/90 hover:bg-white/20"
        >
          Trail {previewTheme.label}
        </button>
        <button
          type="button"
          onPointerDown={stopPointer}
          onClick={cycleHead}
          className="rounded bg-white/10 px-2 py-1 text-white/90 hover:bg-white/20"
        >
          Head {HEAD_STYLES[manualHeadIndex]}
        </button>
      </div>
    </div>
  );
}

function TraceScene() {
  const resetVersion = useSnapshot(traceState).resetVersion;
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
      'a',
      's',
      'd',
      'W',
      'A',
      'S',
      'D',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
    ],
  });

  const runtimeRef = useRef<Runtime>(createRuntime());

  const fillMeshRef = useRef<THREE.InstancedMesh>(null);
  const trailMeshRef = useRef<THREE.InstancedMesh>(null);
  const voidMeshRef = useRef<THREE.InstancedMesh>(null);
  const pickupMeshRef = useRef<THREE.InstancedMesh>(null);
  const gridLineRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Group>(null);
  const headStyleRefs = useRef<Array<THREE.Object3D | null>>([]);
  const headStyleMatRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const currentTrailRef = useRef<THREE.Mesh>(null);
  const trailMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const fillMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const playerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const sparkPointsRef = useRef<THREE.Points>(null);
  const sparkMatRef = useRef<THREE.PointsMaterial>(null);
  const glowLightRef = useRef<THREE.PointLight>(null);
  const borderRefs = useRef<Array<THREE.Mesh | null>>([]);
  const cornerRefs = useRef<Array<THREE.Mesh | null>>([]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const segDirection = useMemo(() => new THREE.Vector3(), []);
  const segColor = useMemo(() => new THREE.Color(), []);
  const edgeColor = useMemo(() => new THREE.Color(), []);
  const cameraPosTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraLookTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraUp = useMemo(() => new THREE.Vector3(), []);
  const themeTrailA = useMemo(() => new THREE.Color(), []);
  const themeTrailB = useMemo(() => new THREE.Color(), []);
  const themeTrailPulse = useMemo(() => new THREE.Color(), []);
  const themePlayer = useMemo(() => new THREE.Color(), []);
  const themePlayerPhase = useMemo(() => new THREE.Color(), []);
  const themeBorderX = useMemo(() => new THREE.Color(), []);
  const themeBorderZ = useMemo(() => new THREE.Color(), []);
  const themeCorner = useMemo(() => new THREE.Color(), []);
  const themePickup = useMemo(() => new THREE.Color(), []);
  const themeHazard = useMemo(() => new THREE.Color(), []);
  const themeSpark = useMemo(() => new THREE.Color(), []);
  const sparkPositions = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);
  const sparkGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    geom.setDrawRange(0, 0);
    return geom;
  }, [sparkPositions]);

  const { camera, gl } = useThree();
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useTraceStore.getState().resetToStart();
  }, []);

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useTraceStore.getState().resetToStart();
  }, [resetVersion]);

  useEffect(() => {
    const snap = useTraceStore.getState();
    traceState.score = snap.score;
    traceState.bestScore = snap.best;
    traceState.gameOver = snap.status === 'GAMEOVER';
    traceState.phaseCharges = snap.phaseCharges;

    const unsubscribe = useTraceStore.subscribe((storeState) => {
      traceState.score = storeState.score;
      traceState.bestScore = storeState.best;
      traceState.gameOver = storeState.status === 'GAMEOVER';
      traceState.phaseCharges = storeState.phaseCharges;
      traceState.combo = storeState.tightTurns;
    });

    return () => unsubscribe();
  }, []);

  useEffect(
    () => () => {
      sparkGeometry.dispose();
    },
    [sparkGeometry]
  );

  useEffect(() => {
    const previousTouchAction = gl.domElement.style.touchAction;
    gl.domElement.style.touchAction = 'none';
    return () => {
      gl.domElement.style.touchAction = previousTouchAction;
    };
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(0.033, Math.max(0.001, delta));
    const runtime = runtimeRef.current;
    const store = useTraceStore.getState();
    const input = inputRef.current;

    if (store.status !== 'PLAYING') {
      runtime.activeHeadStyleIndex = store.manualHeadIndex;
      if (store.themeMode === 'MANUAL') {
        runtime.activeThemeIndex = store.manualThemeIndex;
      }
    }

    const startTap =
      input.pointerJustDown ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const keyDirection = directionFromKeys(input.justPressed);

    if (input.pointerJustDown) {
      swipeStartRef.current = { x: input.pointerX, y: input.pointerY };
    }

    let swipeDirection: DirectionIndex | null = null;
    if (input.pointerJustUp) {
      const swipeStart = swipeStartRef.current;
      if (swipeStart) {
        swipeDirection = directionFromSwipe(
          input.pointerX - swipeStart.x,
          input.pointerY - swipeStart.y
        );
      }
      swipeStartRef.current = null;
    }

    const directionInput = keyDirection ?? swipeDirection;

    if (store.status !== 'PLAYING' && (startTap || directionInput !== null)) {
      const levelToStart = store.status === 'LEVEL_CLEAR' ? store.level : 1;
      const themeIndex =
        store.themeMode === 'RANDOM'
          ? Math.floor(Math.random() * TRACE_THEMES.length)
          : store.manualThemeIndex;
      const headIndex = store.manualHeadIndex;
      prepareLevelRuntime(runtime, levelToStart, themeIndex, headIndex);
      if (directionInput !== null) {
        runtime.dir = directionInput;
        runtime.targetYaw = DIR_YAWS[directionInput];
        runtime.playerYaw = DIR_YAWS[directionInput];
      }
      alignRuntimeToLane(runtime, runtime.dir);
      useTraceStore.getState().startRun({
        level: levelToStart,
        themeIndex,
        headIndex,
        resetScore: true,
      });
    } else if (store.status === 'PLAYING' && directionInput !== null) {
      if (isPerpendicularTurn(runtime.dir, directionInput)) {
        commitTrailTo(runtime, runtime.playerX, runtime.playerZ, true);
        runtime.dir = directionInput;
        runtime.targetYaw = DIR_YAWS[runtime.dir];
        runtime.turnGrace = TURN_GRACE_TIME;
        alignRuntimeToLane(runtime, runtime.dir);

        const distToWall = Math.min(
          runtime.bound - Math.abs(runtime.playerX),
          runtime.bound - Math.abs(runtime.playerZ)
        );
        if (distToWall < TIGHT_TURN_THRESHOLD) {
          const bonus = Math.round((TIGHT_TURN_THRESHOLD - distToWall) * 110);
          runtime.tightTurnBonus += bonus;
          runtime.tightTurns += 1;
          runtime.score += bonus;
        }

        for (let i = 0; i < 8; i += 1) {
          if (runtime.sparks.length >= MAX_SPARKS) runtime.sparks.shift();
          const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.7;
          const speed = 1.6 + Math.random() * 1.5;
          runtime.sparks.push({
            x: runtime.playerX,
            z: runtime.playerZ,
            vx: Math.cos(a) * speed,
            vz: Math.sin(a) * speed,
            life: 0.33 + Math.random() * 0.24,
          });
        }
      }
    }

    const finalizeOutcome = (forcedMedal?: Exclude<MedalTier, null>) => {
      const completion = forcedMedal === 'DIAMOND' ? 100 : clamp(runtime.completion, 0, 100);
      const medal = forcedMedal ?? medalForCompletion(completion);
      const hud = {
        score: runtime.score,
        tightTurns: runtime.tightTurns,
        completion,
        collectibles: runtime.collectibles,
      };

      if (medal) {
        useTraceStore.getState().completeLevel({
          score: runtime.score,
          completion,
          collectibles: runtime.collectibles,
          medal,
          tightTurns: runtime.tightTurns,
          phaseCharges: runtime.phaseCharges,
        });
      } else {
        useTraceStore.getState().endRun({
          score: runtime.score,
          completion,
          collectibles: runtime.collectibles,
          medal,
          tightTurns: runtime.tightTurns,
          phaseCharges: runtime.phaseCharges,
        });
      }

      useTraceStore.getState().updateHud(hud);
    };

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt;
      runtime.hudCommit += dt;
      runtime.phaseTimer = Math.max(0, runtime.phaseTimer - dt);
      runtime.phaseInvuln = Math.max(0, runtime.phaseInvuln - dt);
      runtime.turnGrace = Math.max(0, runtime.turnGrace - dt);

      const d = difficultyAt(runtime);
      runtime.speed = clamp(runtime.baseSpeed + runtime.elapsed * 0.03, runtime.baseSpeed, SPEED_MAX);
      runtime.danger = Math.max(0, runtime.danger - dt * 1.7);

      runtime.voidSpawnTimer -= dt;
      runtime.pickupSpawnTimer -= dt;
      if (runtime.voidSpawnTimer <= 0) {
        spawnVoid(runtime);
        runtime.voidSpawnTimer = runtime.level <= 2 ? 6.8 : lerp(2.8, 1.35, d) + Math.random() * 0.9;
      }
      if (runtime.pickupSpawnTimer <= 0) {
        spawnPickup(runtime);
        runtime.pickupSpawnTimer = lerp(5.0, 2.8, d) + Math.random() * 1.4;
      }

      for (const v of runtime.voids) {
        if (!v.active) continue;
        v.ttl -= dt;
        if (v.ttl <= 0) v.active = false;
      }
      for (const p of runtime.pickups) {
        if (!p.active) continue;
        p.ttl -= dt;
        p.spin += dt * 2.3;
        if (p.ttl <= 0) p.active = false;
      }

      if (
        runtime.ignoreSegmentId !== -1 &&
        Math.hypot(runtime.playerX - runtime.turnAnchorX, runtime.playerZ - runtime.turnAnchorZ) >
          TRAIL_THICKNESS * 2.8
      ) {
        runtime.ignoreSegmentId = -1;
      }

      const dir = DIRECTIONS[runtime.dir];
      alignRuntimeToLane(runtime, runtime.dir);
      const stepCount = Math.max(1, Math.ceil((runtime.speed * dt) / 0.045));
      const subDt = dt / stepCount;
      let gameOver = false;

      for (let i = 0; i < stepCount; i += 1) {
        runtime.playerX += dir.x * runtime.speed * subDt;
        runtime.playerZ += dir.z * runtime.speed * subDt;
        if (dir.x !== 0) runtime.playerZ = runtime.laneZ;
        if (dir.z !== 0) runtime.playerX = runtime.laneX;

        if (
          Math.abs(runtime.playerX) + PLAYER_RADIUS > runtime.bound ||
          Math.abs(runtime.playerZ) + PLAYER_RADIUS > runtime.bound
        ) {
          runtime.playerX = clamp(
            runtime.playerX,
            -runtime.bound + PLAYER_RADIUS,
            runtime.bound - PLAYER_RADIUS
          );
          runtime.playerZ = clamp(
            runtime.playerZ,
            -runtime.bound + PLAYER_RADIUS,
            runtime.bound - PLAYER_RADIUS
          );
          gameOver = true;
          break;
        }

        commitTrailTo(runtime, runtime.playerX, runtime.playerZ, false);
        markTrailCell(runtime, runtime.playerX, runtime.playerZ);

        let trailHit = false;
        const trailCollision = checkTrailCollision(runtime, runtime.playerX, runtime.playerZ);
        if (trailCollision.hit) {
          trailHit = true;
        } else if (trailCollision.near) {
          runtime.danger = Math.min(1, runtime.danger + 0.35);
        }

        if (trailHit) {
          gameOver = true;
          break;
        }

        for (const p of runtime.pickups) {
          if (!p.active) continue;
          if (Math.hypot(runtime.playerX - p.x, runtime.playerZ - p.z) < PLAYER_RADIUS + 0.17) {
            p.active = false;
            runtime.collectibles += 1;
            runtime.phaseCharges = clamp(runtime.phaseCharges + 1, 0, 3);
            useTraceStore.getState().setPhaseCharges(runtime.phaseCharges);
            runtime.score += 65 + runtime.level * 4;
          }
        }
      }

      if (gameOver) {
        commitTrailTo(runtime, runtime.playerX, runtime.playerZ, true);
        markTrailCell(runtime, runtime.playerX, runtime.playerZ);
        finalizeOutcome();
      } else {
        runtime.score += dt * (10.5 + runtime.level * 1.2);
        runtime.score += dt * runtime.tightTurnBonus * 0.078;

        if (runtime.completion >= 99.999) {
          runtime.score += 220 + runtime.level * 15;
          finalizeOutcome('DIAMOND');
        } else if (runtime.hudCommit >= 0.08) {
          runtime.hudCommit = 0;
          useTraceStore.getState().setPhaseCharges(runtime.phaseCharges);
          useTraceStore.getState().updateHud({
            score: runtime.score,
            tightTurns: runtime.tightTurns,
            completion: runtime.completion,
            collectibles: runtime.collectibles,
          });
        }
      }
    }

    for (let i = runtime.sparks.length - 1; i >= 0; i -= 1) {
      const s = runtime.sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.vx *= Math.max(0, 1 - 4.8 * dt);
      s.vz *= Math.max(0, 1 - 4.8 * dt);
      if (s.life <= 0) runtime.sparks.splice(i, 1);
    }

    const activeTheme = TRACE_THEMES[runtime.activeThemeIndex] ?? TRACE_THEMES[0];
    themeTrailA.set(activeTheme.trailA);
    themeTrailB.set(activeTheme.trailB);
    themeTrailPulse.set(activeTheme.trailPulse);
    themePlayer.set(activeTheme.player);
    themePlayerPhase.set(activeTheme.playerPhase);
    themeBorderX.set(activeTheme.borderX);
    themeBorderZ.set(activeTheme.borderZ);
    themeCorner.set(activeTheme.corner);
    themePickup.set(activeTheme.pickup);
    themeHazard.set(activeTheme.hazard);
    themeSpark.set(activeTheme.spark);

    if (fillMeshRef.current) {
      let idx = 0;
      const total = runtime.trailCells.length;
      for (let i = 0; i < total && idx < FILL_CELL_CAP; i += 1) {
        const cell = runtime.trailCells[i];

        dummy.position.set(cell.x, FILL_TILE_Y, cell.z);
        dummy.scale.set(TRAIL_TILE_SIZE, FILL_TILE_HEIGHT, TRAIL_TILE_SIZE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        fillMeshRef.current.setMatrixAt(idx, dummy.matrix);
        idx += 1;
      }

      while (idx < FILL_CELL_CAP) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        fillMeshRef.current.setMatrixAt(idx, dummy.matrix);
        idx += 1;
      }

      fillMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (fillMatRef.current) {
      fillMatRef.current.color.copy(runtime.phaseTimer > 0 ? themeTrailPulse : themeTrailA);
    }

    if (trailMeshRef.current) {
      let idx = 0;
      const count = runtime.segments.length;
      for (let i = 0; i < count && idx < TRAIL_INSTANCE_CAP; i += 1) {
        const seg = runtime.segments[i];
        const dx = seg.bx - seg.ax;
        const dz = seg.bz - seg.az;
        const len = Math.hypot(dx, dz);
        if (len < 0.001) continue;
        const midX = (seg.ax + seg.bx) * 0.5;
        const midZ = (seg.az + seg.bz) * 0.5;
        dummy.position.set(midX, TRAIL_VISUAL_Y, midZ);
        segDirection.set(dx / len, 0, dz / len);
        dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, segDirection);
        dummy.scale.set(seg.thickness, len, seg.thickness);
        dummy.updateMatrix();
        trailMeshRef.current.setMatrixAt(idx, dummy.matrix);

        segColor.copy(runtime.phaseTimer > 0 ? themeTrailPulse : themeTrailA);
        trailMeshRef.current.setColorAt(idx, segColor);
        idx += 1;
      }

      while (idx < TRAIL_INSTANCE_CAP) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trailMeshRef.current.setMatrixAt(idx, dummy.matrix);
        trailMeshRef.current.setColorAt(idx, themeTrailA);
        idx += 1;
      }

      trailMeshRef.current.instanceMatrix.needsUpdate = true;
      if (trailMeshRef.current.instanceColor) trailMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (currentTrailRef.current) {
      const dx = runtime.playerX - runtime.trailStartX;
      const dz = runtime.playerZ - runtime.trailStartZ;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) {
        const midX = (runtime.trailStartX + runtime.playerX) * 0.5;
        const midZ = (runtime.trailStartZ + runtime.playerZ) * 0.5;
        currentTrailRef.current.position.set(midX, TRAIL_VISUAL_Y, midZ);
        segDirection.set(dx / len, 0, dz / len);
        currentTrailRef.current.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, segDirection);
        currentTrailRef.current.scale.set(PLAYER_RADIUS, len, PLAYER_RADIUS);
        currentTrailRef.current.visible = true;
      } else {
        currentTrailRef.current.visible = false;
      }
    }

    if (trailMatRef.current) {
      trailMatRef.current.color.copy(runtime.phaseTimer > 0 ? themeTrailPulse : themeTrailA);
    }

    if (voidMeshRef.current) {
      let idx = 0;
      for (const v of runtime.voids) {
        if (!v.active) continue;
        dummy.position.set(v.x, 0.09, v.z);
        dummy.scale.set(v.size, 0.08, v.size);
        dummy.rotation.set(0, runtime.elapsed * 0.24, 0);
        dummy.updateMatrix();
        voidMeshRef.current.setMatrixAt(idx, dummy.matrix);
        voidMeshRef.current.setColorAt(idx, themeHazard);
        idx += 1;
      }
      while (idx < VOID_POOL) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        voidMeshRef.current.setMatrixAt(idx, dummy.matrix);
        voidMeshRef.current.setColorAt(idx, themeHazard);
        idx += 1;
      }
      voidMeshRef.current.instanceMatrix.needsUpdate = true;
      if (voidMeshRef.current.instanceColor) voidMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (pickupMeshRef.current) {
      let idx = 0;
      for (const p of runtime.pickups) {
        if (!p.active) continue;
        dummy.position.set(p.x, 0.17, p.z);
        dummy.scale.set(0.14, 0.14, 0.14);
        dummy.rotation.set(0, p.spin, 0);
        dummy.updateMatrix();
        pickupMeshRef.current.setMatrixAt(idx, dummy.matrix);
        pickupMeshRef.current.setColorAt(idx, themePickup);
        idx += 1;
      }
      while (idx < PICKUP_POOL) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pickupMeshRef.current.setMatrixAt(idx, dummy.matrix);
        pickupMeshRef.current.setColorAt(idx, themePickup);
        idx += 1;
      }
      pickupMeshRef.current.instanceMatrix.needsUpdate = true;
      if (pickupMeshRef.current.instanceColor) pickupMeshRef.current.instanceColor.needsUpdate = true;
    }

    runtime.playerYaw = lerpAngle(runtime.playerYaw, runtime.targetYaw, 1 - Math.exp(-8.2 * dt));

    if (playerRef.current) {
      playerRef.current.position.set(runtime.playerX, 0.16, runtime.playerZ);
      playerRef.current.rotation.set(0, runtime.playerYaw, 0);
      const pulse = runtime.phaseTimer > 0 ? 1.08 : 1;
      playerRef.current.scale.setScalar(pulse);
    }

    for (let i = 0; i < headStyleRefs.current.length; i += 1) {
      const node = headStyleRefs.current[i];
      if (!node) continue;
      node.visible = i === runtime.activeHeadStyleIndex;
    }

    if (playerMatRef.current) {
      playerMatRef.current.emissiveIntensity = 0.5 + runtime.danger * 1.05 + runtime.phaseTimer * 0.4;
      playerMatRef.current.color.copy(runtime.phaseTimer > 0 ? themePlayerPhase : themePlayer);
      playerMatRef.current.emissive.copy(runtime.phaseTimer > 0 ? themeTrailPulse : themePlayer);
    }

    for (const mat of headStyleMatRefs.current) {
      if (!mat) continue;
      mat.color.copy(runtime.phaseTimer > 0 ? themeTrailPulse : themeCorner);
    }

    if (glowLightRef.current) {
      glowLightRef.current.position.set(runtime.playerX, 0.35, runtime.playerZ);
      glowLightRef.current.intensity = 0.32 + runtime.danger * 1.1 + runtime.phaseTimer * 0.25;
      glowLightRef.current.color.copy(runtime.phaseTimer > 0 ? themeTrailPulse : themeTrailA);
    }

    const arenaBound = runtime.bound;
    const arenaSpan = arenaBound * 2;
    const boundDanger = clamp(runtime.danger + runtime.level / 24, 0, 1);
    const edgeGlow = 0.2 + boundDanger * 0.6;

    if (borderRefs.current.length >= 4) {
      const edgeW = 0.05;
      const edgeH = 0.07;

      const top = borderRefs.current[0];
      const bottom = borderRefs.current[1];
      const left = borderRefs.current[2];
      const right = borderRefs.current[3];

      if (top) {
        top.position.set(0, 0.035, -arenaBound);
        top.scale.set(arenaSpan + 0.2, edgeH, edgeW);
        (top.material as THREE.MeshBasicMaterial).color.copy(themeBorderX);
      }
      if (bottom) {
        bottom.position.set(0, 0.035, arenaBound);
        bottom.scale.set(arenaSpan + 0.2, edgeH, edgeW);
        (bottom.material as THREE.MeshBasicMaterial).color.copy(themeBorderX);
      }
      if (left) {
        left.position.set(-arenaBound, 0.035, 0);
        left.scale.set(edgeW, edgeH, arenaSpan + 0.2);
        (left.material as THREE.MeshBasicMaterial).color.copy(themeBorderZ);
      }
      if (right) {
        right.position.set(arenaBound, 0.035, 0);
        right.scale.set(edgeW, edgeH, arenaSpan + 0.2);
        (right.material as THREE.MeshBasicMaterial).color.copy(themeBorderZ);
      }
    }

    if (cornerRefs.current.length >= 4) {
      const cs = 0.09 + boundDanger * 0.03;
      const corners = [
        [-arenaBound, -arenaBound],
        [arenaBound, -arenaBound],
        [arenaBound, arenaBound],
        [-arenaBound, arenaBound],
      ];
      for (let i = 0; i < 4; i += 1) {
        const corner = cornerRefs.current[i];
        if (!corner) continue;
        corner.position.set(corners[i][0], 0.05, corners[i][1]);
        corner.scale.setScalar(cs);
        (corner.material as THREE.MeshBasicMaterial).color.copy(themeCorner);
      }
    }

    if (gridLineRef.current) {
      const divisions = runtime.fillCols;
      let idx = 0;
      for (let i = 0; i <= divisions; i += 1) {
        const t = i / divisions;
        const offset = -arenaBound + arenaSpan * t;

        dummy.position.set(offset, 0.01, 0);
        dummy.scale.set(0.01, 0.02, arenaSpan);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        gridLineRef.current.setMatrixAt(idx, dummy.matrix);
        edgeColor.set(activeTheme.gridA).lerp(themeTrailA, 0.22 + edgeGlow * 0.18);
        gridLineRef.current.setColorAt(idx, edgeColor);
        idx += 1;

        dummy.position.set(0, 0.01, offset);
        dummy.scale.set(arenaSpan, 0.02, 0.01);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        gridLineRef.current.setMatrixAt(idx, dummy.matrix);
        edgeColor.set(activeTheme.gridB).lerp(themeTrailB, 0.2 + edgeGlow * 0.17);
        gridLineRef.current.setColorAt(idx, edgeColor);
        idx += 1;
      }
      while (idx < GRID_LINE_CAP) {
        dummy.position.copy(OFFSCREEN_POS);
        dummy.scale.copy(TINY_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        gridLineRef.current.setMatrixAt(idx, dummy.matrix);
        gridLineRef.current.setColorAt(idx, themeTrailA);
        idx += 1;
      }
      gridLineRef.current.instanceMatrix.needsUpdate = true;
      if (gridLineRef.current.instanceColor) gridLineRef.current.instanceColor.needsUpdate = true;
    }

    const sparkAttr = sparkGeometry.getAttribute('position') as THREE.BufferAttribute;
    let sparkCount = 0;
    for (let i = 0; i < runtime.sparks.length && sparkCount < MAX_SPARKS; i += 1) {
      const s = runtime.sparks[i];
      const ptr = sparkCount * 3;
      sparkPositions[ptr] = s.x;
      sparkPositions[ptr + 1] = 0.18;
      sparkPositions[ptr + 2] = s.z;
      sparkCount += 1;
    }
    sparkGeometry.setDrawRange(0, sparkCount);
    sparkAttr.needsUpdate = true;

    if (sparkMatRef.current) {
      sparkMatRef.current.color.copy(themeSpark);
    }

    const driftX = Math.sin(runtime.elapsed * 0.18) * 0.05;
    const driftZ = Math.cos(runtime.elapsed * 0.21) * 0.05;
    const tilt = Math.sin(runtime.elapsed * 0.33) * 0.012;
    const baseHeight = 5.9 + runtime.bound * 1.08;
    cameraPosTarget.set(driftX, baseHeight, driftZ);
    camera.position.lerp(cameraPosTarget, 1 - Math.exp(-4.7 * dt));
    cameraLookTarget.set(runtime.playerX * 0.07, 0, runtime.playerZ * 0.07);
    camera.lookAt(cameraLookTarget);
    cameraUp.set(Math.sin(tilt), 1, Math.cos(tilt));
    camera.up.lerp(cameraUp, 1 - Math.exp(-5 * dt));

    const ortho = camera as THREE.OrthographicCamera;
    if ('zoom' in ortho) {
      const targetZoom = clamp(126 - runtime.bound * 9.2, 72, 110);
      ortho.zoom = lerp(ortho.zoom, targetZoom, 1 - Math.exp(-4.5 * dt));
      ortho.updateProjectionMatrix();
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 9.2, 0]} zoom={96} near={0.1} far={50} />
      <color attach="background" args={['#0a0f16']} />
      <fog attach="fog" args={['#0a0f16', 8, 26]} />

      <ambientLight intensity={0.32} />
      <pointLight position={[0, 1.6, 0]} intensity={0.34} color="#73f4ff" />
      <pointLight position={[0, 2.5, 0]} intensity={0.24} color="#ff52d8" />
      <pointLight ref={glowLightRef} position={[0, 0.35, 0]} intensity={0.35} color="#73f4ff" distance={2.2} />

      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#111722" roughness={0.92} metalness={0.04} />
      </mesh>

      <instancedMesh
        ref={fillMeshRef}
        args={[undefined, undefined, FILL_CELL_CAP]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          ref={fillMatRef}
          color="#2be4ff"
          toneMapped={false}
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh ref={gridLineRef} args={[undefined, undefined, GRID_LINE_CAP]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.76} />
      </instancedMesh>

      {[0, 1, 2, 3].map((idx) => (
        <mesh
          key={`trace-border-${idx}`}
          ref={(node) => {
            borderRefs.current[idx] = node;
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#2f6f9a" toneMapped={false} />
        </mesh>
      ))}

      {[0, 1, 2, 3].map((idx) => (
        <mesh
          key={`trace-corner-${idx}`}
          ref={(node) => {
            cornerRefs.current[idx] = node;
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#e4f8ff" toneMapped={false} />
        </mesh>
      ))}

      <instancedMesh
        ref={trailMeshRef}
        args={[undefined, undefined, TRAIL_INSTANCE_CAP]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshBasicMaterial
          vertexColors
          toneMapped={false}
          transparent
          opacity={0.84}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <mesh ref={currentTrailRef} position={[0, TRAIL_VISUAL_Y, 0]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshBasicMaterial
          ref={trailMatRef}
          color="#2be4ff"
          toneMapped={false}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <instancedMesh ref={voidMeshRef} args={[undefined, undefined, VOID_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={pickupMeshRef} args={[undefined, undefined, PICKUP_POOL]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <group ref={playerRef} position={[0, 0.16, 0]}>
        <mesh>
          <sphereGeometry args={[PLAYER_RADIUS, 20, 20]} />
          <meshStandardMaterial
            ref={playerMatRef}
            color="#2be4ff"
            emissive="#2be4ff"
            emissiveIntensity={0.5}
            roughness={0.28}
            metalness={0.15}
          />
        </mesh>

        <mesh
          ref={(node) => {
            headStyleRefs.current[0] = node;
          }}
          position={[0, 0.055, PLAYER_RADIUS + 0.07]}
          rotation={[Math.PI * 0.5, 0, 0]}
        >
          <coneGeometry args={[0.062, 0.22, 12]} />
          <meshBasicMaterial
            ref={(node) => {
              headStyleMatRefs.current[0] = node;
            }}
            color="#ecfcff"
            toneMapped={false}
          />
        </mesh>

        <mesh
          ref={(node) => {
            headStyleRefs.current[1] = node;
          }}
          position={[0, 0.16, 0]}
        >
          <octahedronGeometry args={[0.09, 0]} />
          <meshBasicMaterial
            ref={(node) => {
              headStyleMatRefs.current[1] = node;
            }}
            color="#ecfcff"
            toneMapped={false}
          />
        </mesh>

        <mesh
          ref={(node) => {
            headStyleRefs.current[2] = node;
          }}
          position={[0, 0.03, 0]}
          rotation={[Math.PI * 0.5, 0, 0]}
        >
          <torusGeometry args={[0.19, 0.03, 10, 22]} />
          <meshBasicMaterial
            ref={(node) => {
              headStyleMatRefs.current[2] = node;
            }}
            color="#ecfcff"
            toneMapped={false}
          />
        </mesh>

        <mesh
          ref={(node) => {
            headStyleRefs.current[3] = node;
          }}
          position={[0, 0.06, PLAYER_RADIUS + 0.09]}
          rotation={[0, Math.PI * 0.25, 0]}
        >
          <boxGeometry args={[0.09, 0.09, 0.09]} />
          <meshBasicMaterial
            ref={(node) => {
              headStyleMatRefs.current[3] = node;
            }}
            color="#ecfcff"
            toneMapped={false}
          />
        </mesh>
      </group>

      <points ref={sparkPointsRef} geometry={sparkGeometry}>
        <pointsMaterial
          ref={sparkMatRef}
          color="#ffd46c"
          size={0.09}
          transparent
          opacity={0.75}
          sizeAttenuation
        />
      </points>

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.5} luminanceThreshold={0.5} luminanceSmoothing={0.22} mipmapBlur />
        <Vignette eskil={false} offset={0.11} darkness={0.64} />
        <Noise premultiply opacity={0.03} />
      </EffectComposer>

      <Html fullscreen>
        <TraceOverlay />
      </Html>
    </>
  );
}

const Trace: React.FC<{ soundsOn?: boolean }> = () => {
  return <TraceScene />;
};

export default Trace;
export * from './state';
