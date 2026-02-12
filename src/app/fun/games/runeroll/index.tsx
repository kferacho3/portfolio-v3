'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, PerspectiveCamera } from '@react-three/drei';
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
import { consumeFixedStep, createFixedStepState, shakeNoiseSigned } from '../_shared/hyperUpgradeKit';
import { runeRollState } from './state';

type GameStatus = 'START' | 'PLAYING' | 'GAMEOVER';
type LaneIndex = 0 | 1 | 2;
type MoveDir = 'left' | 'up' | 'right' | 'back';
type RuneId = 0 | 1 | 2 | 3;
type ForwardMove = Exclude<MoveDir, 'back'>;

type FaceMap = {
  top: RuneId;
  bottom: RuneId;
  left: RuneId;
  right: RuneId;
  front: RuneId;
  back: RuneId;
};

type RowData = {
  slot: number;
  index: number;
  mask: number;
  runes: [RuneId, RuneId, RuneId];
  wildMask: number;
  glowLane: number;
  glow: number;
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
  elapsed: number;
  score: number;
  streak: number;
  multiplier: number;
  illegalMoves: number;
  illegalLimit: number;
  nearPerfects: number;
  failMessage: string;
  shake: number;
  hudCommit: number;

  currentRow: number;
  currentLane: LaneIndex;
  progressRow: number;
  nextMove: MoveDir;
  maxReachedRow: number;
  scoredRow: number;
  pathLanes: LaneIndex[];
  playerX: number;
  cubeRotX: number;
  cubeRotZ: number;

  faces: FaceMap;
  targetFaces: FaceMap;

  stepActive: boolean;
  stepTime: number;
  stepDuration: number;
  fromRow: number;
  toRow: number;
  fromLane: LaneIndex;
  toLane: LaneIndex;
  stepMove: MoveDir;
  fromRotX: number;
  toRotX: number;
  fromRotZ: number;
  toRotZ: number;
  pendingStep: boolean;

  difficulty: DifficultySample;
  chunkLibrary: GameChunkPatternTemplate[];
  currentChunk: GameChunkPatternTemplate | null;
  chunkRowsLeft: number;

  rows: RowData[];
  shards: Shard[];
};

type MovePreview = {
  move: ForwardMove;
  lane: LaneIndex | null;
  available: boolean;
  targetRune: RuneId;
  tileRune: RuneId | null;
  tileWild: boolean;
  legal: boolean;
};

type RuneRollStore = {
  status: GameStatus;
  score: number;
  best: number;
  multiplier: number;
  streak: number;
  illegalMoves: number;
  illegalLimit: number;
  direction: 'L' | 'U' | 'R' | 'B';
  bottomRune: RuneId;
  previews: MovePreview[];
  suddenDeath: boolean;
  failMessage: string;
  pulseNonce: number;
  startRun: () => void;
  resetToStart: () => void;
  onTapFx: () => void;
  toggleSuddenDeath: () => void;
  updateHud: (
    score: number,
    multiplier: number,
    streak: number,
    illegalMoves: number,
    illegalLimit: number,
    direction: 'L' | 'U' | 'R' | 'B',
    bottomRune: RuneId,
    previews: MovePreview[]
  ) => void;
  endRun: (score: number, reason: string) => void;
};

const BEST_KEY = 'runeroll_hyper_best_v3';

const LANE_X: readonly [number, number, number] = [-1.38, 0, 1.38];
const ROW_SPACING = 1.12;
const TILE_SIZE = 0.9;
const TILE_HEIGHT = 0.18;
const TILE_INSET_SIZE = TILE_SIZE * 0.8;
const TILE_INSET_HEIGHT = TILE_HEIGHT * 0.22;
const TILE_INSET_Y = TILE_HEIGHT * 0.48;
const TILE_CORE_SIZE = TILE_SIZE * 0.74;
const TILE_CORE_HEIGHT = TILE_HEIGHT * 0.24;
const TILE_CORE_Y = TILE_HEIGHT * 0.62;
const PREVIEW_MARKER_Y = TILE_HEIGHT * 1.25;
const CUBE_SIZE = 0.72;

const ROW_POOL = 280;
const SHARD_POOL = 108;

const DRAW_AHEAD_ROWS = 34;
const TILE_DRAW_CAP = 220;
const GLYPH_DRAW_CAP = 220;
const PREVIEW_DRAW_CAP = 9;

const SHATTER_Y = TILE_HEIGHT * 0.62;
const OFFSCREEN_POS = new THREE.Vector3(9999, 9999, 9999);
const TINY_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const TILE_BASE = new THREE.Color('#1e2536');
const TILE_EDGE = new THREE.Color('#3b4560');
const WHITE = new THREE.Color('#f8fbff');
const DANGER = new THREE.Color('#ff657f');
const LEGAL = new THREE.Color('#49f2bc');
const GUIDE = new THREE.Color('#72d7ff');
const WILD = new THREE.Color('#ffd56a');
const RUNE_TILE_OUTER = [
  new THREE.Color('#1e95cc'),
  new THREE.Color('#c742a1'),
  new THREE.Color('#63b93f'),
  new THREE.Color('#d88a36'),
] as const;
const RUNE_TILE_INSET = [
  new THREE.Color('#32c8ff'),
  new THREE.Color('#ff5bc2'),
  new THREE.Color('#a6f06a'),
  new THREE.Color('#ffb85a'),
] as const;
const RUNE_NAMES = ['Azure', 'Rose', 'Moss', 'Amber'] as const;
const RUNE_COLORS = [
  new THREE.Color('#2fd8ff'),
  new THREE.Color('#ff5eb8'),
  new THREE.Color('#9cf159'),
  new THREE.Color('#ffb04a'),
] as const;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const normAngle = (v: number) => {
  const m = v % (Math.PI * 2);
  return m < 0 ? m + Math.PI * 2 : m;
};
const snapRightAngle = (v: number) => Math.round(v / (Math.PI * 0.5)) * (Math.PI * 0.5);

const bit = (lane: number) => 1 << lane;
const moveLabel = (move: MoveDir): 'L' | 'U' | 'R' | 'B' =>
  move === 'left' ? 'L' : move === 'right' ? 'R' : move === 'back' ? 'B' : 'U';
const moveName = (move: ForwardMove) =>
  move === 'left' ? 'Left' : move === 'right' ? 'Right' : 'Forward';
const runeName = (rune: RuneId) => RUNE_NAMES[rune];
const FORWARD_MOVES: ForwardMove[] = ['left', 'up', 'right'];

const laneForForwardMove = (
  currentLane: LaneIndex,
  move: MoveDir
): LaneIndex | null => {
  if (move === 'up') return currentLane;
  if (move === 'left') return currentLane > 0 ? ((currentLane - 1) as LaneIndex) : null;
  if (move === 'right') return currentLane < 2 ? ((currentLane + 1) as LaneIndex) : null;
  return null;
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

const createFaces = (): FaceMap => ({
  top: 0,
  bottom: 1,
  left: 2,
  right: 3,
  front: 0,
  back: 1,
});

const rollFaces = (faces: FaceMap, move: MoveDir): FaceMap => {
  if (move === 'right') {
    return {
      top: faces.left,
      bottom: faces.right,
      left: faces.bottom,
      right: faces.top,
      front: faces.front,
      back: faces.back,
    };
  }
  if (move === 'left') {
    return {
      top: faces.right,
      bottom: faces.left,
      left: faces.top,
      right: faces.bottom,
      front: faces.front,
      back: faces.back,
    };
  }
  if (move === 'up') {
    return {
      top: faces.back,
      bottom: faces.front,
      left: faces.left,
      right: faces.right,
      front: faces.top,
      back: faces.bottom,
    };
  }
  return {
    top: faces.front,
    bottom: faces.back,
    left: faces.left,
    right: faces.right,
    front: faces.bottom,
    back: faces.top,
  };
};

const forwardCandidates = (runtime: Runtime) => {
  const lane = runtime.currentLane;
  const list: Array<{ lane: LaneIndex; move: Exclude<MoveDir, 'back'>; targetBottom: RuneId }> = [
    {
      lane,
      move: 'up',
      targetBottom: rollFaces(runtime.faces, 'up').bottom,
    },
  ];
  if (lane > 0) {
    list.push({
      lane: (lane - 1) as LaneIndex,
      move: 'left',
      targetBottom: rollFaces(runtime.faces, 'left').bottom,
    });
  }
  if (lane < 2) {
    list.push({
      lane: (lane + 1) as LaneIndex,
      move: 'right',
      targetBottom: rollFaces(runtime.faces, 'right').bottom,
    });
  }
  return list;
};

const mapPointerToMove = (x: number, y: number): MoveDir => {
  if (y < -0.34) return 'back';
  if (x < -0.33) return 'left';
  if (x > 0.33) return 'right';
  return 'up';
};

const canStepBack = (runtime: Runtime) =>
  runtime.currentRow > 0 && runtime.currentRow === runtime.maxReachedRow;

const minVisibleRow = (runtime: Runtime) => Math.max(0, runtime.maxReachedRow - 1);

const resolveBackLane = (runtime: Runtime): LaneIndex | null => {
  const row = runtime.currentRow - 1;
  if (row < 0) return null;
  const lane = runtime.pathLanes[row];
  return lane === undefined ? null : lane;
};

const initialFaces = createFaces();
const initialBottomRune = initialFaces.bottom;
const createEmptyMovePreviews = (): MovePreview[] =>
  FORWARD_MOVES.map((move) => ({
    move,
    lane: null,
    available: false,
    targetRune: 0,
    tileRune: null,
    tileWild: false,
    legal: false,
  }));

const useRuneRollStore = create<RuneRollStore>((set) => ({
  status: 'START',
  score: 0,
  best: readBest(),
  multiplier: 1,
  streak: 0,
  illegalMoves: 0,
  illegalLimit: 3,
  direction: 'U',
  bottomRune: initialBottomRune,
  previews: createEmptyMovePreviews(),
  suddenDeath: false,
  failMessage: '',
  pulseNonce: 0,
  startRun: () =>
    set({
      status: 'PLAYING',
      score: 0,
      multiplier: 1,
      streak: 0,
      illegalMoves: 0,
      direction: 'U',
      bottomRune: initialBottomRune,
      previews: createEmptyMovePreviews(),
      failMessage: '',
    }),
  resetToStart: () =>
    set({
      status: 'START',
      score: 0,
      multiplier: 1,
      streak: 0,
      illegalMoves: 0,
      direction: 'U',
      bottomRune: initialBottomRune,
      previews: createEmptyMovePreviews(),
      failMessage: '',
    }),
  onTapFx: () => set((state) => ({ pulseNonce: state.pulseNonce + 1 })),
  toggleSuddenDeath: () =>
    set((state) => ({
      suddenDeath: !state.suddenDeath,
      illegalLimit: state.suddenDeath ? 3 : 1,
      illegalMoves: 0,
      previews: createEmptyMovePreviews(),
    })),
  updateHud: (score, multiplier, streak, illegalMoves, illegalLimit, direction, bottomRune, previews) =>
    set({
      score: Math.floor(score),
      multiplier,
      streak,
      illegalMoves,
      illegalLimit,
      direction,
      bottomRune,
      previews,
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
        streak: 0,
        illegalMoves: state.illegalMoves,
        direction: 'U',
        failMessage: reason,
      };
    }),
}));

const createRuntime = (): Runtime => ({
  elapsed: 0,
  score: 0,
  streak: 0,
  multiplier: 1,
  illegalMoves: 0,
  illegalLimit: 3,
  nearPerfects: 0,
  failMessage: '',
  shake: 0,
  hudCommit: 0,

  currentRow: 0,
  currentLane: 1,
  progressRow: 0,
  nextMove: 'up',
  maxReachedRow: 0,
  scoredRow: 0,
  pathLanes: [1],
  playerX: LANE_X[1],
  cubeRotX: 0,
  cubeRotZ: 0,

  faces: createFaces(),
  targetFaces: createFaces(),

  stepActive: false,
  stepTime: 0,
  stepDuration: 0.2,
  fromRow: 0,
  toRow: 1,
  fromLane: 1,
  toLane: 1,
  stepMove: 'up',
  fromRotX: 0,
  toRotX: Math.PI * 0.5,
  fromRotZ: 0,
  toRotZ: 0,
  pendingStep: false,

  difficulty: sampleDifficulty('timing-defense', 0),
  chunkLibrary: buildPatternLibraryTemplate('runeroll'),
  currentChunk: null,
  chunkRowsLeft: 0,

  rows: Array.from({ length: ROW_POOL }, (_, idx) => createRow(idx)),
  shards: Array.from({ length: SHARD_POOL }, (_, idx) => createShard(idx)),
});

const createRow = (slot: number): RowData => ({
  slot,
  index: Number.MIN_SAFE_INTEGER,
  mask: 0,
  runes: [0, 1, 2],
  wildMask: 0,
  glowLane: -1,
  glow: 0,
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

const activeRuneCount = (runtime: Runtime) => {
  const byTime = clamp(runtime.elapsed / 50, 0, 1);
  const byScore = clamp(runtime.score / 120, 0, 1);
  const mix = byTime * 0.65 + byScore * 0.35;
  if (mix < 0.34) return 2;
  if (mix < 0.7) return 3;
  return 4;
};

const chooseChunk = (runtime: Runtime) => {
  const intensity = clamp(runtime.elapsed / 95, 0, 1);
  runtime.currentChunk = pickPatternChunkForSurvivability(
    'runeroll',
    runtime.chunkLibrary,
    Math.random,
    intensity,
    runtime.elapsed
  );
  runtime.chunkRowsLeft = Math.max(
    4,
    Math.round(runtime.currentChunk.durationSeconds * (1.9 + runtime.difficulty.eventRate * 1.5))
  );
};

const seedRow = (runtime: Runtime, row: RowData, index: number) => {
  if (!runtime.currentChunk || runtime.chunkRowsLeft <= 0) chooseChunk(runtime);
  runtime.chunkRowsLeft -= 1;

  const tier = runtime.currentChunk?.tier ?? 0;
  const d = clamp((runtime.difficulty.speed - 3) / 3.6, 0, 1);
  const runeCount = activeRuneCount(runtime);

  row.index = index;
  row.glowLane = -1;
  row.glow = 0;
  row.wildMask = 0;

  let mask = 0b111;
  if (index > 6) {
    const narrowChance = clamp(0.08 + tier * 0.05 + d * 0.15, 0.08, 0.46);
    const singleLaneChance = index > 18 ? clamp(0.015 + Math.max(0, tier - 1) * 0.04 + d * 0.1, 0, 0.24) : 0;
    const roll = Math.random();
    if (roll < singleLaneChance) {
      mask = bit(Math.floor(Math.random() * 3));
    } else if (roll < singleLaneChance + narrowChance) {
      mask = 0b111 & ~bit(Math.floor(Math.random() * 3));
    }
  }
  if (index <= 2) mask = 0b111;
  row.mask = mask;

  for (let lane = 0; lane < 3; lane += 1) {
    row.runes[lane] = Math.floor(Math.random() * runeCount) as RuneId;
    if ((row.mask & bit(lane)) !== 0 && index > 10) {
      const wildChance = clamp(0.007 + tier * 0.01 + d * 0.02, 0.005, 0.06);
      if (Math.random() < wildChance) row.wildMask |= bit(lane);
    }
  }
};

const ensureRow = (runtime: Runtime, rowIndex: number) => {
  const slot = ((rowIndex % ROW_POOL) + ROW_POOL) % ROW_POOL;
  const row = runtime.rows[slot];
  if (row.index !== rowIndex) seedRow(runtime, row, rowIndex);
  return row;
};

const enforceReachability = (runtime: Runtime, row: RowData, currentLane: LaneIndex) => {
  const candidates: Array<{ lane: LaneIndex; move: Exclude<MoveDir, 'back'>; targetBottom: RuneId }> = [
    {
      lane: currentLane,
      move: 'up',
      targetBottom: rollFaces(runtime.faces, 'up').bottom,
    },
  ];
  if (currentLane > 0) {
    candidates.push({
      lane: (currentLane - 1) as LaneIndex,
      move: 'left',
      targetBottom: rollFaces(runtime.faces, 'left').bottom,
    });
  }
  if (currentLane < 2) {
    candidates.push({
      lane: (currentLane + 1) as LaneIndex,
      move: 'right',
      targetBottom: rollFaces(runtime.faces, 'right').bottom,
    });
  }
  const allowedMask = candidates.reduce((acc, item) => acc | bit(item.lane), 0);
  if (allowedMask === 0) return;

  const d = clamp((runtime.difficulty.speed - 3) / 3.6, 0, 1);
  const tier = runtime.currentChunk?.tier ?? 0;
  const preferredMove = runtime.nextMove === 'back' ? 'up' : runtime.nextMove;
  const preferredCandidate =
    candidates.find((candidate) => candidate.move === preferredMove) ??
    candidates[Math.floor(Math.random() * candidates.length)];

  row.mask &= allowedMask;
  if (row.mask === 0) row.mask = bit(preferredCandidate.lane);

  if (runtime.elapsed > 10) {
    const tightenChance = clamp(0.12 + tier * 0.08 + d * 0.18, 0.1, 0.72);
    if (Math.random() < tightenChance) {
      row.mask = bit(preferredCandidate.lane);
    } else {
      for (const candidate of candidates) {
        if ((row.mask & bit(candidate.lane)) !== 0) continue;
        if (Math.random() < clamp(0.34 - tier * 0.03 - d * 0.05, 0.12, 0.38)) {
          row.mask |= bit(candidate.lane);
        }
      }
    }
  } else {
    row.mask |= allowedMask;
  }

  const runeCount = activeRuneCount(runtime);
  for (let lane = 0; lane < 3; lane += 1) {
    if ((row.mask & bit(lane)) === 0) {
      row.wildMask &= ~bit(lane);
      continue;
    }
    if (row.runes[lane] >= runeCount) {
      row.runes[lane] = Math.floor(Math.random() * runeCount) as RuneId;
    }
  }

  const activeCandidates = candidates.filter((candidate) => (row.mask & bit(candidate.lane)) !== 0);
  if (activeCandidates.length === 0) {
    row.mask = bit(preferredCandidate.lane);
    activeCandidates.push(preferredCandidate);
  }

  const hasPlayableMatch = activeCandidates.some((candidate) => {
    const isWild = (row.wildMask & bit(candidate.lane)) !== 0;
    return isWild || row.runes[candidate.lane] === candidate.targetBottom;
  });

  if (!hasPlayableMatch) {
    const pick =
      activeCandidates.find((candidate) => candidate.move === preferredMove) ??
      activeCandidates[Math.floor(Math.random() * activeCandidates.length)];
    row.runes[pick.lane] = pick.targetBottom;
    row.wildMask &= ~bit(pick.lane);
  }
};

const buildMovePreviews = (runtime: Runtime): MovePreview[] => {
  const row = ensureRow(runtime, runtime.currentRow + 1);
  enforceReachability(runtime, row, runtime.currentLane);

  return FORWARD_MOVES.map((move) => {
    const lane = laneForForwardMove(runtime.currentLane, move);
    const targetRune = rollFaces(runtime.faces, move).bottom;
    if (lane === null) {
      return {
        move,
        lane: null,
        available: false,
        targetRune,
        tileRune: null,
        tileWild: false,
        legal: false,
      };
    }

    const laneBit = bit(lane);
    const available = (row.mask & laneBit) !== 0;
    const tileWild = available && (row.wildMask & laneBit) !== 0;
    const tileRune = available ? row.runes[lane] : null;
    const legal = available && (tileWild || tileRune === targetRune);

    return {
      move,
      lane,
      available,
      targetRune,
      tileRune,
      tileWild,
      legal,
    };
  });
};

const ensureLegalForwardOption = (runtime: Runtime, previews: MovePreview[]) => {
  if (previews.some((preview) => preview.legal)) return previews;

  const row = ensureRow(runtime, runtime.currentRow + 1);
  const candidates = previews.filter((preview) => preview.lane !== null);
  const fallback =
    candidates.find((candidate) => candidate.available) ?? candidates.find((candidate) => candidate.lane !== null);

  if (!fallback || fallback.lane === null) return previews;

  const lane = fallback.lane;
  row.mask |= bit(lane);
  row.runes[lane] = fallback.targetRune;
  row.wildMask &= ~bit(lane);

  const repaired = buildMovePreviews(runtime);
  if (repaired.some((preview) => preview.legal)) return repaired;

  for (const preview of repaired) {
    if (preview.lane === null) continue;
    row.mask |= bit(preview.lane);
    row.runes[preview.lane] = preview.targetRune;
    row.wildMask &= ~bit(preview.lane);
    break;
  }

  return buildMovePreviews(runtime);
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
  z: number,
  color: THREE.Color,
  count: number,
  lateral: number,
  lift: number
) => {
  for (let i = 0; i < count; i += 1) {
    const shard = acquireShard(runtime);
    const ang = Math.random() * Math.PI * 2;
    const spd = lateral * (0.45 + Math.random() * 0.9);

    shard.active = true;
    shard.x = x + (Math.random() * 2 - 1) * 0.12;
    shard.y = SHATTER_Y + Math.random() * 0.06;
    shard.z = z + (Math.random() * 2 - 1) * 0.12;
    shard.vx = Math.cos(ang) * spd;
    shard.vz = Math.sin(ang) * spd;
    shard.vy = lift * (0.7 + Math.random() * 0.8);
    shard.life = 0.42 + Math.random() * 0.3;
    shard.maxLife = shard.life;
    shard.size = 0.04 + Math.random() * 0.05;
    shard.color.copy(color);
  }
};

const stepDurationFor = (runtime: Runtime) => {
  const d = clamp((runtime.difficulty.speed - 3) / 3.6, 0, 1);
  const tier = runtime.currentChunk?.tier ?? 0;
  return clamp(lerp(0.22, 0.168, d) - Math.max(0, tier - 2) * 0.004, 0.16, 0.225);
};

function RuneRollOverlay() {
  const status = useRuneRollStore((state) => state.status);
  const score = useRuneRollStore((state) => state.score);
  const best = useRuneRollStore((state) => state.best);
  const multiplier = useRuneRollStore((state) => state.multiplier);
  const streak = useRuneRollStore((state) => state.streak);
  const illegalMoves = useRuneRollStore((state) => state.illegalMoves);
  const illegalLimit = useRuneRollStore((state) => state.illegalLimit);
  const direction = useRuneRollStore((state) => state.direction);
  const bottomRune = useRuneRollStore((state) => state.bottomRune);
  const previews = useRuneRollStore((state) => state.previews);
  const suddenDeath = useRuneRollStore((state) => state.suddenDeath);
  const failMessage = useRuneRollStore((state) => state.failMessage);
  const pulseNonce = useRuneRollStore((state) => state.pulseNonce);
  const startRun = useRuneRollStore((state) => state.startRun);
  const toggleSuddenDeath = useRuneRollStore((state) => state.toggleSuddenDeath);

  const bottomColor = RUNE_COLORS[bottomRune].getStyle();
  const nextLabel =
    direction === 'L'
      ? 'Left'
      : direction === 'R'
        ? 'Right'
        : direction === 'B'
          ? 'Back'
          : 'Forward';

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      <div className="absolute left-4 top-4 rounded-md border border-violet-100/55 bg-gradient-to-br from-violet-500/22 via-indigo-500/15 to-amber-500/18 px-3 py-2 backdrop-blur-[2px]">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/90">Rune Roll</div>
        <div className="text-[11px] text-cyan-50/85">
          Match your cube's bottom color with the tile color.
        </div>
      </div>

      <div className="absolute right-4 top-4 rounded-md border border-amber-100/55 bg-gradient-to-br from-amber-500/22 via-fuchsia-500/16 to-indigo-500/22 px-3 py-2 text-right backdrop-blur-[2px]">
        <div className="text-2xl font-black tabular-nums">{score}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Best {best}</div>
      </div>

      {status === 'PLAYING' && (
        <div className="absolute left-4 top-[92px] rounded-md border border-violet-100/40 bg-gradient-to-br from-slate-950/82 via-indigo-900/45 to-amber-900/26 px-3 py-2 text-xs shadow-[0_8px_30px_rgba(4,8,20,0.5)]">
          <div>
            Mode{' '}
            <span className="font-semibold text-amber-200">
              {suddenDeath ? 'Sudden Death' : 'Classic 3-Strike'}
            </span>
          </div>
          <div>
            Next <span className="font-semibold text-cyan-200">{nextLabel}</span>
          </div>
          <div>
            Bottom Face
            <span
              className="ml-2 inline-block h-3 w-3 rounded-sm align-middle"
              style={{ background: bottomColor, boxShadow: `0 0 12px ${bottomColor}` }}
            />
            <span className="ml-1 font-semibold text-fuchsia-200">{runeName(bottomRune)}</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/80">
            Face (landing) {'->'} Tile (target)
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {previews.map((preview) => {
              const targetColor = RUNE_COLORS[preview.targetRune].getStyle();
              const tileColor = preview.tileWild
                ? WILD.getStyle()
                : preview.tileRune !== null
                  ? RUNE_COLORS[preview.tileRune].getStyle()
                  : '#475569';
              const directionLabel = moveName(preview.move);
              const shortLabel = preview.move === 'left' ? 'L' : preview.move === 'right' ? 'R' : 'F';
              const targetLabel = runeName(preview.targetRune);
              const tileLabel = preview.tileWild
                ? 'Wild'
                : preview.tileRune !== null
                  ? runeName(preview.tileRune)
                  : 'Blocked';
              const legalityText = preview.available
                ? preview.legal
                  ? 'Legal'
                  : 'Illegal'
                : 'Blocked';
              const legalityClass = preview.available
                ? preview.legal
                  ? 'text-emerald-200'
                  : 'text-rose-200'
                : 'text-slate-300';
              const frameClass = preview.available
                ? preview.legal
                  ? 'border-emerald-200/55'
                  : 'border-rose-200/55'
                : 'border-slate-200/24';
              const bgClass = preview.available
                ? preview.legal
                  ? 'bg-emerald-950/22'
                  : 'bg-rose-950/20'
                : 'bg-black/30';

              return (
                <div
                  key={preview.move}
                  className={`rounded border px-1.5 py-1 ${frameClass} ${bgClass}`}
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em]">
                    <span className="font-semibold text-cyan-100">
                      {shortLabel} {directionLabel}
                    </span>
                    <span className={`font-semibold ${legalityClass}`}>{legalityText}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-0.5 text-[10px]">
                    <span className="text-white/60">Face</span>
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ background: targetColor, boxShadow: `0 0 8px ${targetColor}` }}
                        title="Bottom face after move"
                      />
                      <span className="text-white/90">{targetLabel}</span>
                    </span>
                    <span className="text-white/60">Tile</span>
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ background: tileColor, boxShadow: `0 0 8px ${tileColor}` }}
                        title="Tile color in that lane"
                      />
                      <span className="text-white/90">{tileLabel}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/70">
            {RUNE_COLORS.map((color, idx) => (
              <span key={idx} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: color.getStyle(), boxShadow: `0 0 8px ${color.getStyle()}` }}
                  title={runeName(idx as RuneId)}
                />
                <span>{runeName(idx as RuneId)}</span>
              </span>
            ))}
          </div>
          <div>
            Multiplier <span className="font-semibold text-amber-200">x{multiplier.toFixed(2)}</span>
          </div>
          <div>
            Streak <span className="font-semibold text-emerald-200">{streak}</span>
          </div>
          <div>
            Illegal{' '}
            <span className="font-semibold text-sky-200">
              {illegalMoves}/{illegalLimit}
            </span>
          </div>
        </div>
      )}

      {status === 'START' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-violet-100/42 bg-gradient-to-br from-slate-950/80 via-violet-950/46 to-amber-950/32 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black tracking-wide">RUNE ROLL</div>
            <div className="mt-2 text-sm text-white/85">Controls: Left, Forward, Right. Down = back one tile.</div>
            <div className="mt-1 text-sm text-white/80">Desktop: A/Left, W/Up/Space, D/Right, S/Down.</div>
            <div className="mt-1 text-sm text-white/80">Mobile: tap left/center/right zones. Tap lower center to back.</div>
            <div className="mt-1 text-sm text-white/80">Every tile now has an embedded color core. Land only on matching colors.</div>
            <div className="mt-1 text-sm text-cyan-200/85">Direction cards show Face Color vs Tile Color. Classic loses after 3 illegal moves.</div>
            <button
              type="button"
              className="pointer-events-auto mt-3 rounded-md border border-amber-100/55 bg-amber-300/16 px-4 py-1.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/28"
              onClick={(event) => {
                event.stopPropagation();
                toggleSuddenDeath();
              }}
            >
              Mode: {suddenDeath ? 'Sudden Death (1 Strike)' : 'Classic (3 Strikes)'}
            </button>
            <button
              type="button"
              className="pointer-events-auto mt-3 rounded-md border border-cyan-100/55 bg-cyan-300/18 px-4 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/28"
              onClick={(event) => {
                event.stopPropagation();
                startRun();
              }}
            >
              Start Run
            </button>
            <div className="mt-2 text-sm text-cyan-200/90">Tap anywhere to start.</div>
          </div>
        </div>
      )}

      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-xl border border-rose-100/42 bg-gradient-to-br from-black/84 via-rose-950/42 to-violet-950/45 px-6 py-5 text-center backdrop-blur-md">
            <div className="text-2xl font-black text-rose-200">Run Broken</div>
            <div className="mt-2 text-sm text-white/82">{failMessage}</div>
            <div className="mt-2 text-sm text-white/82">Score {score}</div>
            <div className="mt-1 text-sm text-white/75">Best {best}</div>
            <button
              type="button"
              className="pointer-events-auto mt-3 rounded-md border border-amber-100/55 bg-amber-300/16 px-4 py-1.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/28"
              onClick={(event) => {
                event.stopPropagation();
                toggleSuddenDeath();
              }}
            >
              Mode: {suddenDeath ? 'Sudden Death (1 Strike)' : 'Classic (3 Strikes)'}
            </button>
            <button
              type="button"
              className="pointer-events-auto mt-3 rounded-md border border-cyan-100/55 bg-cyan-300/18 px-4 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/28"
              onClick={(event) => {
                event.stopPropagation();
                startRun();
              }}
            >
              Retry
            </button>
            <div className="mt-2 text-sm text-cyan-200/90">Tap instantly to retry.</div>
          </div>
        </div>
      )}

      {status === 'PLAYING' && (
        <div key={pulseNonce}>
          <div
            className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70"
            style={{
              animation: 'runeroll-pulse 200ms ease-out forwards',
              opacity: 0,
            }}
          />
        </div>
      )}

      <style jsx global>{`
        @keyframes runeroll-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.55);
            opacity: 0.65;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.18);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function RuneRollScene() {
  const inputRef = useInputRef({
    preventDefault: [
      ' ',
      'Space',
      'space',
      'enter',
      'Enter',
      'arrowleft',
      'arrowup',
      'arrowright',
      'arrowdown',
      'a',
      'w',
      'd',
      's',
      'q',
      'm',
      'A',
      'W',
      'D',
      'S',
      'Q',
      'M',
    ],
  });
  const runtimeRef = useRef<Runtime>(createRuntime());

  const bgMatRef = useRef<THREE.ShaderMaterial>(null);
  const tileRef = useRef<THREE.InstancedMesh>(null);
  const tileInsetRef = useRef<THREE.InstancedMesh>(null);
  const tileCoreRef = useRef<THREE.InstancedMesh>(null);
  const previewMarkerRef = useRef<THREE.InstancedMesh>(null);
  const runeRef0 = useRef<THREE.InstancedMesh>(null);
  const runeRef1 = useRef<THREE.InstancedMesh>(null);
  const runeRef2 = useRef<THREE.InstancedMesh>(null);
  const runeRef3 = useRef<THREE.InstancedMesh>(null);
  const runeRefWild = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);
  const cubeRef = useRef<THREE.Mesh>(null);
  const faceRefs = useRef<Array<THREE.Mesh | null>>([]);
  const fixedStepRef = useRef(createFixedStepState());

  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);

  const { camera } = useThree();
  const status = useRuneRollStore((state) => state.status);

  const runeInstanceRefs = useMemo(
    () => [runeRef0, runeRef1, runeRef2, runeRef3, runeRefWild],
    []
  );

  const resetRuntime = (runtime: Runtime) => {
    runtime.elapsed = 0;
    runtime.score = 0;
    runtime.streak = 0;
    runtime.multiplier = 1;
    runtime.illegalMoves = 0;
    runtime.illegalLimit = useRuneRollStore.getState().suddenDeath ? 1 : 3;
    runtime.nearPerfects = 0;
    runtime.failMessage = '';
    runtime.shake = 0;
    runtime.hudCommit = 0;

    runtime.currentRow = 0;
    runtime.currentLane = 1;
    runtime.progressRow = 0;
    runtime.nextMove = 'up';
    runtime.maxReachedRow = 0;
    runtime.scoredRow = 0;
    runtime.pathLanes = [1];
    runtime.playerX = LANE_X[1];
    runtime.cubeRotX = 0;
    runtime.cubeRotZ = 0;

    runtime.faces = createFaces();
    runtime.targetFaces = createFaces();

    runtime.stepActive = false;
    runtime.stepTime = 0;
    runtime.stepDuration = 0.2;
    runtime.fromRow = 0;
    runtime.toRow = 1;
    runtime.fromLane = 1;
    runtime.toLane = 1;
    runtime.stepMove = 'up';
    runtime.fromRotX = 0;
    runtime.toRotX = Math.PI * 0.5;
    runtime.fromRotZ = 0;
    runtime.toRotZ = 0;
    runtime.pendingStep = false;

    runtime.difficulty = sampleDifficulty('timing-defense', 0);
    runtime.currentChunk = null;
    runtime.chunkRowsLeft = 0;

    for (const row of runtime.rows) {
      row.index = Number.MIN_SAFE_INTEGER;
      row.mask = 0;
      row.wildMask = 0;
      row.glowLane = -1;
      row.glow = 0;
    }

    for (const shard of runtime.shards) {
      shard.active = false;
      shard.life = 0;
    }

    for (let i = 0; i <= DRAW_AHEAD_ROWS + 4; i += 1) {
      ensureRow(runtime, i);
    }
    const row0 = ensureRow(runtime, 0);
    row0.mask = 0b111;
    row0.runes[1] = runtime.faces.bottom;
    row0.wildMask &= ~bit(1);
  };

  useEffect(() => {
    resetRuntime(runtimeRef.current);
    useRuneRollStore.getState().resetToStart();
    runeRollState.status = 'menu';
    runeRollState.score = 0;
    runeRollState.rune = initialBottomRune;
  }, []);

  useEffect(() => {
    const apply = (state: ReturnType<typeof useRuneRollStore.getState>) => {
      runeRollState.status =
        state.status === 'START'
          ? 'menu'
          : state.status === 'PLAYING'
            ? 'playing'
            : 'gameover';
      runeRollState.score = state.score;
      runeRollState.best = state.best;
      runeRollState.rune = state.bottomRune;
    };

    apply(useRuneRollStore.getState());
    const unsub = useRuneRollStore.subscribe(apply);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (status !== 'PLAYING') return;
    const runtime = runtimeRef.current;
    resetRuntime(runtime);
  }, [status]);

  useFrame((_, delta) => {
    const step = consumeFixedStep(fixedStepRef.current, delta);
    if (step.steps <= 0) {
      return;
    }
    const dt = step.dt;
    const runtime = runtimeRef.current;
    const input = inputRef.current;
    const store = useRuneRollStore.getState();

    const pointerTap = input.pointerJustDown;
    const leftPressed = input.justPressed.has('arrowleft') || input.justPressed.has('a');
    const rightPressed = input.justPressed.has('arrowright') || input.justPressed.has('d');
    const upPressed =
      input.justPressed.has('arrowup') ||
      input.justPressed.has('w') ||
      input.justPressed.has(' ') ||
      input.justPressed.has('space') ||
      input.justPressed.has('enter');
    const backPressed =
      input.justPressed.has('arrowdown') ||
      input.justPressed.has('s') ||
      input.justPressed.has('q');
    const toggleModePressed = input.justPressed.has('m');

    let requestedMove: MoveDir | null = null;
    if (leftPressed) requestedMove = 'left';
    else if (rightPressed) requestedMove = 'right';
    else if (upPressed) requestedMove = 'up';
    else if (backPressed) requestedMove = 'back';
    else if (pointerTap) requestedMove = mapPointerToMove(input.pointerX, input.pointerY);

    if (toggleModePressed && store.status !== 'PLAYING') {
      useRuneRollStore.getState().toggleSuddenDeath();
      runtime.illegalLimit = useRuneRollStore.getState().suddenDeath ? 1 : 3;
      runtime.illegalMoves = 0;
    }

    if (requestedMove) {
      if (store.status !== 'PLAYING') {
        resetRuntime(runtime);
        runtime.nextMove = requestedMove === 'back' ? 'up' : requestedMove;
        useRuneRollStore.getState().startRun();
      } else {
        runtime.nextMove = requestedMove;
        runtime.pendingStep = true;
        runtime.shake = Math.min(1.15, runtime.shake + 0.2);
        useRuneRollStore.getState().onTapFx();
      }
    }

    let previewsForRender = store.previews;

    if (store.status === 'PLAYING') {
      runtime.elapsed += dt * (runtime.stepActive ? 1 : 0.08);
      runtime.hudCommit += dt;
      runtime.difficulty = sampleDifficulty('timing-defense', runtime.elapsed);
      let previews = ensureLegalForwardOption(runtime, buildMovePreviews(runtime));

      for (const row of runtime.rows) {
        if (row.glow > 0) row.glow = Math.max(0, row.glow - dt * 2.8);
      }

      if (!runtime.stepActive && runtime.pendingStep) {
        runtime.pendingStep = false;
        const move = runtime.nextMove;
        let nextRow = runtime.currentRow;
        let nextLane: LaneIndex | null = null;
        let movingBack = false;

        if (move === 'back') {
          if (!canStepBack(runtime)) {
            runtime.shake = Math.min(1.2, runtime.shake + 0.18);
          } else {
            movingBack = true;
            nextRow = runtime.currentRow - 1;
            nextLane = resolveBackLane(runtime);
          }
        } else {
          nextRow = runtime.currentRow + 1;
          nextLane = laneForForwardMove(runtime.currentLane, move);
        }

        if (nextLane === null) {
          runtime.shake = Math.min(1.2, runtime.shake + 0.2);
        } else {
          const row = ensureRow(runtime, nextRow);
          if (!movingBack) enforceReachability(runtime, row, runtime.currentLane);

          if (!movingBack && (row.mask & bit(nextLane)) === 0) {
            const z = -(nextRow - runtime.progressRow) * ROW_SPACING;
            spawnBurst(runtime, LANE_X[nextLane], z, DANGER, 9, 2.4, 2.7);
            row.glowLane = nextLane;
            row.glow = 0.32;
            runtime.illegalMoves += 1;
            runtime.streak = 0;
            runtime.multiplier = 1;
            if (runtime.illegalMoves >= runtime.illegalLimit) {
              runtime.failMessage = 'Too many illegal moves. Branch closed.';
              useRuneRollStore.getState().endRun(runtime.score, runtime.failMessage);
            }
          } else {
            runtime.stepActive = true;
            runtime.stepTime = 0;
            runtime.stepDuration = stepDurationFor(runtime);
            runtime.fromRow = runtime.currentRow;
            runtime.toRow = nextRow;
            runtime.fromLane = runtime.currentLane;
            runtime.toLane = nextLane;
            runtime.stepMove = move;
            runtime.fromRotX = runtime.cubeRotX;
            runtime.fromRotZ = runtime.cubeRotZ;
            runtime.toRotX = runtime.cubeRotX;
            runtime.toRotZ = runtime.cubeRotZ;
            if (move === 'left') runtime.toRotZ += Math.PI * 0.5;
            else if (move === 'right') runtime.toRotZ -= Math.PI * 0.5;
            else if (move === 'up') runtime.toRotX += Math.PI * 0.5;
            else runtime.toRotX -= Math.PI * 0.5;
            runtime.targetFaces = rollFaces(runtime.faces, move);
          }
        }
      }

      if (runtime.stepActive) {
        runtime.stepTime += dt;
        const t = clamp(runtime.stepTime / runtime.stepDuration, 0, 1);
        const eased = easeInOut(t);
        runtime.progressRow =
          runtime.stepMove === 'back'
            ? runtime.fromRow - eased
            : runtime.fromRow + eased;
        runtime.playerX = lerp(LANE_X[runtime.fromLane], LANE_X[runtime.toLane], eased);
        runtime.cubeRotX = lerp(runtime.fromRotX, runtime.toRotX, eased);
        runtime.cubeRotZ = lerp(runtime.fromRotZ, runtime.toRotZ, eased);

        if (t >= 1) {
          runtime.stepActive = false;
          runtime.currentRow = runtime.toRow;
          runtime.currentLane = runtime.toLane;
          runtime.progressRow = runtime.currentRow;
          runtime.playerX = LANE_X[runtime.currentLane];
          runtime.faces = runtime.targetFaces;
          runtime.cubeRotX = normAngle(snapRightAngle(runtime.toRotX));
          runtime.cubeRotZ = normAngle(snapRightAngle(runtime.toRotZ));

          if (runtime.stepMove !== 'back') {
            runtime.maxReachedRow = Math.max(runtime.maxReachedRow, runtime.currentRow);
            runtime.pathLanes[runtime.currentRow] = runtime.currentLane;
          }

          const landedRow = ensureRow(runtime, runtime.currentRow);
          const landedLane = runtime.currentLane;
          const isWild = (landedRow.wildMask & bit(landedLane)) !== 0;
          const requiredRune = landedRow.runes[landedLane];
          const matched =
            runtime.stepMove === 'back' || isWild || runtime.faces.bottom === requiredRune;
          const firstTimeProgress = runtime.currentRow > runtime.scoredRow;

          if (matched) {
            landedRow.glowLane = landedLane;
            landedRow.glow = runtime.stepMove === 'back' ? 0.24 : 0.46;
            if (runtime.stepMove !== 'back' && firstTimeProgress) {
              runtime.streak += 1;
              runtime.multiplier = 1 + Math.min(runtime.streak, 26) * 0.08;
              const stepPoints = isWild ? 3 : 1;
              runtime.score += stepPoints * runtime.multiplier;
              if (isWild) runtime.score += 1;
              const lanePerfect =
                Math.abs(runtime.playerX - LANE_X[landedLane]) < 0.025 &&
                runtime.stepDuration <= 0.19;
              if (lanePerfect) {
                runtime.nearPerfects += 1;
                runtime.score += 0.5;
              }
              runtime.scoredRow = runtime.currentRow;
            }

            if (runtime.stepMove !== 'back') {
              const z = -(runtime.currentRow - runtime.progressRow) * ROW_SPACING;
              spawnBurst(
                runtime,
                LANE_X[landedLane],
                z,
                isWild ? WILD : RUNE_COLORS[requiredRune],
                isWild ? 7 : 5,
                isWild ? 1.4 : 1.15,
                isWild ? 2.6 : 2.1
              );
            }
          } else if (runtime.stepMove !== 'back') {
            runtime.illegalMoves += 1;
            runtime.streak = 0;
            runtime.multiplier = 1;
            landedRow.glowLane = landedLane;
            landedRow.glow = 0.3;
            const z = -(runtime.currentRow - runtime.progressRow) * ROW_SPACING;
            spawnBurst(runtime, LANE_X[landedLane], z, DANGER, 6, 1.3, 2.0);
            if (runtime.illegalMoves >= runtime.illegalLimit) {
              spawnBurst(runtime, LANE_X[landedLane], z, DANGER, 10, 2.6, 3.2);
              runtime.failMessage =
                runtime.illegalLimit === 1
                  ? 'Sudden death: bottom rune mismatch.'
                  : 'Bottom rune mismatch. Third illegal move.';
              useRuneRollStore.getState().endRun(runtime.score, runtime.failMessage);
            }
          }
        }
      } else {
        runtime.progressRow = runtime.currentRow;
        runtime.playerX = LANE_X[runtime.currentLane];
        runtime.cubeRotX = normAngle(snapRightAngle(runtime.cubeRotX));
        runtime.cubeRotZ = normAngle(snapRightAngle(runtime.cubeRotZ));
      }

      previews = ensureLegalForwardOption(runtime, buildMovePreviews(runtime));
      previewsForRender = previews;
      if (runtime.hudCommit >= 0.08) {
        runtime.hudCommit = 0;
        useRuneRollStore.getState().updateHud(
          runtime.score,
          runtime.multiplier,
          runtime.streak,
          runtime.illegalMoves,
          runtime.illegalLimit,
          moveLabel(runtime.nextMove),
          runtime.faces.bottom,
          previews
        );
      }
    } else {
      runtime.progressRow = runtime.currentRow;
      runtime.playerX = lerp(runtime.playerX, LANE_X[runtime.currentLane], 1 - Math.exp(-10 * dt));
      runtime.cubeRotX = normAngle(snapRightAngle(runtime.cubeRotX));
      runtime.cubeRotZ = normAngle(snapRightAngle(runtime.cubeRotZ));
      previewsForRender = ensureLegalForwardOption(runtime, buildMovePreviews(runtime));
      for (const row of runtime.rows) {
        if (row.glow > 0) row.glow = Math.max(0, row.glow - dt * 1.8);
      }
    }

    for (const shard of runtime.shards) {
      if (!shard.active) continue;
      shard.life -= dt;
      if (shard.life <= 0) {
        shard.active = false;
        continue;
      }
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.z += shard.vz * dt;
      shard.vy -= 9.4 * dt;
    }

    runtime.shake = Math.max(0, runtime.shake - dt * 4.3);
    const shakeAmp = runtime.shake * 0.08;
    const shakeTime = runtime.elapsed * 22;
    camTarget.set(
      5.8 + shakeNoiseSigned(shakeTime, 2.1) * shakeAmp,
      6.3 + shakeNoiseSigned(shakeTime, 8.3) * shakeAmp * 0.65,
      6.6 + shakeNoiseSigned(shakeTime, 14.6) * shakeAmp
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-7.5 * step.renderDt));
    camera.lookAt(0, 0.2, -7.5);

    if (bgMatRef.current) {
      bgMatRef.current.uniforms.uTime.value += dt;
      bgMatRef.current.uniforms.uPulse.value = runtime.stepActive ? runtime.stepTime / runtime.stepDuration : 0;
    }

    if (cubeRef.current) {
      cubeRef.current.position.set(runtime.playerX, TILE_HEIGHT + CUBE_SIZE * 0.5, 0);
      cubeRef.current.rotation.set(runtime.cubeRotX, 0, runtime.cubeRotZ);
      const scale = 1 + runtime.shake * 0.03;
      cubeRef.current.scale.setScalar(scale);
    }

    const faceOrder: Array<keyof FaceMap> = ['top', 'bottom', 'left', 'right', 'front', 'back'];
    for (let i = 0; i < faceOrder.length; i += 1) {
      const mesh = faceRefs.current[i];
      if (!mesh) continue;
      const rune = runtime.faces[faceOrder[i]];
      (mesh.material as THREE.MeshStandardMaterial).emissive.copy(RUNE_COLORS[rune]).multiplyScalar(0.5);
      (mesh.material as THREE.MeshStandardMaterial).color.copy(RUNE_COLORS[rune]).lerp(WHITE, 0.16);
    }

    if (tileRef.current && tileInsetRef.current && tileCoreRef.current && previewMarkerRef.current) {
      const tileMesh = tileRef.current;
      const tileInsetMesh = tileInsetRef.current;
      const tileCoreMesh = tileCoreRef.current;
      const previewMarkerMesh = previewMarkerRef.current;
      const glyphCounts = [0, 0, 0, 0, 0];
      let tileCount = 0;
      let insetCount = 0;
      let coreCount = 0;
      let previewCount = 0;
      const startRow = Math.max(minVisibleRow(runtime), Math.floor(runtime.progressRow) - 1);
      const endRow = Math.floor(runtime.progressRow) + DRAW_AHEAD_ROWS;
      const nextRowIndex = runtime.currentRow + 1;
      const selectableLanes = new Set(forwardCandidates(runtime).map((candidate) => candidate.lane));
      const previewByLane = new Map<number, MovePreview>();
      for (const preview of previewsForRender) {
        if (preview.lane !== null) previewByLane.set(preview.lane, preview);
      }

      for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
        if (rowIndex < minVisibleRow(runtime)) continue;
        const row = ensureRow(runtime, rowIndex);
        const z = -(rowIndex - runtime.progressRow) * ROW_SPACING;
        if (z < -45 || z > 13) continue;

        for (let lane = 0; lane < 3; lane += 1) {
          if ((row.mask & bit(lane)) === 0) continue;
          if (tileCount >= TILE_DRAW_CAP) break;

          const x = LANE_X[lane as LaneIndex];
          const laneIdx = lane as LaneIndex;
          const isWild = (row.wildMask & bit(lane)) !== 0;
          const rune = row.runes[lane];
          const lanePreview = rowIndex === nextRowIndex ? previewByLane.get(laneIdx) : undefined;
          const runeColor = isWild ? WILD : RUNE_COLORS[rune];
          const runeOuter = isWild ? WILD : RUNE_TILE_OUTER[rune];
          const runeInset = isWild ? WILD : RUNE_TILE_INSET[rune];
          const isCurrent = rowIndex === runtime.currentRow && laneIdx === runtime.currentLane;
          const isSelectable = rowIndex === nextRowIndex && selectableLanes.has(laneIdx);

          dummy.position.set(x, 0, z);
          dummy.scale.set(TILE_SIZE, TILE_HEIGHT, TILE_SIZE);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          tileMesh.setMatrixAt(tileCount, dummy.matrix);

          colorScratch
            .copy(runeOuter)
            .lerp(TILE_BASE, isCurrent ? 0.06 : isSelectable ? 0.1 : 0.14);
          colorScratch.lerp(TILE_EDGE, 0.05);
          if (lanePreview?.available) {
            colorScratch.lerp(lanePreview.legal ? LEGAL : DANGER, 0.12);
          }
          if (isCurrent) colorScratch.lerp(WHITE, 0.24);
          else if (isSelectable) colorScratch.lerp(GUIDE, 0.12);
          if (row.glowLane === lane && row.glow > 0) {
            colorScratch.lerp(WHITE, clamp(row.glow * 0.7, 0, 0.62));
          }
          tileMesh.setColorAt(tileCount, colorScratch);
          tileCount += 1;

          if (insetCount < TILE_DRAW_CAP) {
            dummy.position.set(x, TILE_INSET_Y, z);
            dummy.scale.set(TILE_INSET_SIZE, TILE_INSET_HEIGHT, TILE_INSET_SIZE);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            tileInsetMesh.setMatrixAt(insetCount, dummy.matrix);

            colorScratch.copy(runeInset).lerp(TILE_EDGE, 0.08).lerp(WHITE, 0.16);
            if (lanePreview?.available) colorScratch.lerp(lanePreview.legal ? LEGAL : DANGER, 0.1);
            if (isCurrent) colorScratch.lerp(WHITE, 0.26);
            if (row.glowLane === lane && row.glow > 0) {
              colorScratch.lerp(WHITE, clamp(row.glow * 0.8, 0, 0.8));
            }
            tileInsetMesh.setColorAt(insetCount, colorScratch);
            insetCount += 1;
          }

          if (coreCount < TILE_DRAW_CAP) {
            dummy.position.set(x, TILE_CORE_Y, z);
            dummy.scale.set(TILE_CORE_SIZE, TILE_CORE_HEIGHT, TILE_CORE_SIZE);
            dummy.rotation.set(0, runtime.elapsed * 0.55, 0);
            dummy.updateMatrix();
            tileCoreMesh.setMatrixAt(coreCount, dummy.matrix);

            colorScratch.copy(runeColor).lerp(WHITE, isWild ? 0.42 : 0.34);
            if (lanePreview?.available) colorScratch.lerp(lanePreview.legal ? LEGAL : DANGER, 0.16);
            if (isCurrent) colorScratch.lerp(WHITE, 0.24);
            if (row.glowLane === lane && row.glow > 0) {
              colorScratch.lerp(WHITE, clamp(row.glow * 0.9, 0, 0.86));
            }
            tileCoreMesh.setColorAt(coreCount, colorScratch);
            coreCount += 1;
          }

          if (rowIndex === nextRowIndex && lanePreview && previewCount < PREVIEW_DRAW_CAP) {
            dummy.position.set(x, PREVIEW_MARKER_Y, z);
            dummy.scale.set(0.18, 0.18, 0.18);
            dummy.rotation.set(runtime.elapsed * 0.8, runtime.elapsed * 1.15, 0);
            dummy.updateMatrix();
            previewMarkerMesh.setMatrixAt(previewCount, dummy.matrix);

            colorScratch
              .copy(RUNE_COLORS[lanePreview.targetRune])
              .lerp(lanePreview.legal ? LEGAL : DANGER, 0.32)
              .lerp(WHITE, 0.16);
            previewMarkerMesh.setColorAt(previewCount, colorScratch);
            previewCount += 1;
          }

          const glyphType = isWild ? 4 : rune;
          const glyphMeshRef = runeInstanceRefs[glyphType];
          const glyphMesh = glyphMeshRef.current;
          if (!glyphMesh) continue;
          const cursor = glyphCounts[glyphType];
          if (cursor >= GLYPH_DRAW_CAP) continue;

          dummy.position.set(x, TILE_HEIGHT * 0.72, z);
          if (glyphType === 0) dummy.scale.set(0.46, 0.042, 0.12);
          else if (glyphType === 1) dummy.scale.set(0.12, 0.042, 0.46);
          else if (glyphType === 2) dummy.scale.set(0.22, 0.06, 0.22);
          else if (glyphType === 3) dummy.scale.set(0.2, 0.06, 0.2);
          else dummy.scale.set(0.22, 0.07, 0.22);
          dummy.rotation.set(0, runtime.elapsed * (glyphType === 4 ? 1.2 : 0.35), 0);
          dummy.updateMatrix();
          glyphMesh.setMatrixAt(cursor, dummy.matrix);

          if (glyphType === 4) {
            colorScratch.copy(WILD).lerp(WHITE, 0.34 + clamp(row.glow * 0.35, 0, 0.28));
          } else {
            colorScratch
              .copy(RUNE_COLORS[glyphType as RuneId])
              .lerp(WHITE, 0.26 + clamp(row.glow * 0.24, 0, 0.34));
          }
          glyphMesh.setColorAt(cursor, colorScratch);
          glyphCounts[glyphType] = cursor + 1;
        }
      }

      tileMesh.count = tileCount;
      tileMesh.instanceMatrix.needsUpdate = true;
      if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;

      tileInsetMesh.count = insetCount;
      tileInsetMesh.instanceMatrix.needsUpdate = true;
      if (tileInsetMesh.instanceColor) tileInsetMesh.instanceColor.needsUpdate = true;

      tileCoreMesh.count = coreCount;
      tileCoreMesh.instanceMatrix.needsUpdate = true;
      if (tileCoreMesh.instanceColor) tileCoreMesh.instanceColor.needsUpdate = true;

      previewMarkerMesh.count = previewCount;
      previewMarkerMesh.instanceMatrix.needsUpdate = true;
      if (previewMarkerMesh.instanceColor) previewMarkerMesh.instanceColor.needsUpdate = true;

      for (let i = 0; i < runeInstanceRefs.length; i += 1) {
        const mesh = runeInstanceRefs[i].current;
        if (!mesh) continue;
        mesh.count = glyphCounts[i];
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }

    if (shardRef.current) {
      let shardCount = 0;
      for (const shard of runtime.shards) {
        if (!shard.active) continue;
        if (shardCount >= SHARD_POOL) break;
        const lifeT = clamp(shard.life / shard.maxLife, 0, 1);

        dummy.position.set(shard.x, shard.y, shard.z);
        dummy.scale.setScalar(shard.size * lifeT);
        dummy.rotation.set(runtime.elapsed * 2.3, runtime.elapsed * 1.7, runtime.elapsed * 1.3);
        dummy.updateMatrix();
        shardRef.current.setMatrixAt(shardCount, dummy.matrix);

        colorScratch.copy(shard.color).lerp(WHITE, 0.24 + (1 - lifeT) * 0.5);
        shardRef.current.setColorAt(shardCount, colorScratch);
        shardCount += 1;
      }

      shardRef.current.count = shardCount;
      shardRef.current.instanceMatrix.needsUpdate = true;
      if (shardRef.current.instanceColor) shardRef.current.instanceColor.needsUpdate = true;
    }

    clearFrameInput(inputRef);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[5.8, 6.3, 6.6]} fov={37} near={0.1} far={120} />
      <color attach="background" args={['#0f1324']} />
      <fog attach="fog" args={['#11172a', 12, 66]} />

      <ambientLight intensity={0.78} />
      <hemisphereLight args={['#a7e4ff', '#1d2238', 0.46]} />
      <directionalLight position={[5, 9, 6]} intensity={1.05} color="#ffe7cf" />
      <pointLight position={[-2, 2.4, 2]} intensity={0.74} color="#7a66ff" />
      <pointLight position={[2, 1.6, -1]} intensity={0.64} color="#ffb870" />
      <pointLight position={[0, 1.5, -7]} intensity={0.42} color="#4fd7ff" />

      <mesh position={[0, -0.7, -24]}>
        <planeGeometry args={[40, 24]} />
        <shaderMaterial
          ref={bgMatRef}
          uniforms={{ uTime: { value: 0 }, uPulse: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uPulse;
            varying vec2 vUv;
            void main() {
              vec3 deep = vec3(0.04, 0.03, 0.08);
              vec3 violet = vec3(0.17, 0.08, 0.18);
              vec3 cyan = vec3(0.07, 0.15, 0.17);
              float grad = smoothstep(0.0, 1.0, vUv.y);
              float ripple = sin((vUv.x * 3.5 + uTime * 0.25) * 6.2831853) * 0.5 + 0.5;
              float grain = fract(sin(dot(vUv * (uTime + 1.7), vec2(12.9898, 78.233))) * 43758.5453);
              vec3 col = mix(deep, violet, grad * 0.8);
              col = mix(col, cyan, (0.15 + ripple * 0.22) * uPulse);
              col += (grain - 0.5) * 0.02;
              gl_FragColor = vec4(col, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={tileRef} args={[undefined, undefined, TILE_DRAW_CAP]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={tileInsetRef} args={[undefined, undefined, TILE_DRAW_CAP]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={tileCoreRef} args={[undefined, undefined, TILE_DRAW_CAP]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          toneMapped={false}
          transparent
          opacity={0.98}
        />
      </instancedMesh>
      <instancedMesh ref={previewMarkerRef} args={[undefined, undefined, PREVIEW_DRAW_CAP]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={runeRef0} args={[undefined, undefined, GLYPH_DRAW_CAP]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>
      <instancedMesh ref={runeRef1} args={[undefined, undefined, GLYPH_DRAW_CAP]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>
      <instancedMesh ref={runeRef2} args={[undefined, undefined, GLYPH_DRAW_CAP]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>
      <instancedMesh ref={runeRef3} args={[undefined, undefined, GLYPH_DRAW_CAP]}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>
      <instancedMesh ref={runeRefWild} args={[undefined, undefined, GLYPH_DRAW_CAP]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>

      <mesh ref={cubeRef} position={[0, TILE_HEIGHT + CUBE_SIZE * 0.5, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
        <meshStandardMaterial
          color="#181227"
          emissive="#25193d"
          emissiveIntensity={0.24}
          roughness={0.58}
          metalness={0.14}
        />

        <mesh
          ref={(node) => {
            faceRefs.current[0] = node;
          }}
          position={[0, CUBE_SIZE * 0.502, 0]}
          rotation={[-Math.PI * 0.5, 0, 0]}
        >
          <planeGeometry args={[0.34, 0.34]} />
          <meshStandardMaterial emissiveIntensity={0.7} metalness={0.12} roughness={0.3} />
        </mesh>
        <mesh
          ref={(node) => {
            faceRefs.current[1] = node;
          }}
          position={[0, -CUBE_SIZE * 0.502, 0]}
          rotation={[Math.PI * 0.5, 0, 0]}
        >
          <planeGeometry args={[0.34, 0.34]} />
          <meshStandardMaterial emissiveIntensity={0.6} metalness={0.12} roughness={0.3} />
        </mesh>
        <mesh
          ref={(node) => {
            faceRefs.current[2] = node;
          }}
          position={[-CUBE_SIZE * 0.502, 0, 0]}
          rotation={[0, Math.PI * 0.5, 0]}
        >
          <planeGeometry args={[0.34, 0.34]} />
          <meshStandardMaterial emissiveIntensity={0.62} metalness={0.12} roughness={0.3} />
        </mesh>
        <mesh
          ref={(node) => {
            faceRefs.current[3] = node;
          }}
          position={[CUBE_SIZE * 0.502, 0, 0]}
          rotation={[0, -Math.PI * 0.5, 0]}
        >
          <planeGeometry args={[0.34, 0.34]} />
          <meshStandardMaterial emissiveIntensity={0.62} metalness={0.12} roughness={0.3} />
        </mesh>
        <mesh
          ref={(node) => {
            faceRefs.current[4] = node;
          }}
          position={[0, 0, CUBE_SIZE * 0.502]}
          rotation={[0, 0, 0]}
        >
          <planeGeometry args={[0.34, 0.34]} />
          <meshStandardMaterial emissiveIntensity={0.56} metalness={0.12} roughness={0.3} />
        </mesh>
        <mesh
          ref={(node) => {
            faceRefs.current[5] = node;
          }}
          position={[0, 0, -CUBE_SIZE * 0.502]}
          rotation={[0, Math.PI, 0]}
        >
          <planeGeometry args={[0.34, 0.34]} />
          <meshStandardMaterial emissiveIntensity={0.56} metalness={0.12} roughness={0.3} />
        </mesh>
      </mesh>

      <instancedMesh ref={shardRef} args={[undefined, undefined, SHARD_POOL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.22}
        scale={12}
        blur={2.6}
        far={18}
        resolution={512}
        color="#0f1322"
      />

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.46} luminanceThreshold={0.52} luminanceSmoothing={0.24} mipmapBlur />
        <Vignette eskil={false} offset={0.12} darkness={0.64} />
        <Noise premultiply opacity={0.02} />
      </EffectComposer>

      <Html fullscreen>
        <RuneRollOverlay />
      </Html>
    </>
  );
}

const RuneRoll: React.FC<{ soundsOn?: boolean }> = () => {
  return (
    <Canvas
      dpr={[1, 1.45]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(event) => event.preventDefault()}
    >
      <RuneRollScene />
    </Canvas>
  );
};

export default RuneRoll;
export * from './state';
