import { useMemo } from 'react';

import { GAME, STAGE_PROFILES } from './constants';
import type {
  CollectibleKind,
  OctaSurgeMode,
  SegmentPattern,
  StageProfile,
} from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const normalizeLane = (lane: number, sides: number) => {
  let output = lane % sides;
  if (output < 0) output += sides;
  return output;
};

export const laneBit = (lane: number, sides: number) =>
  1 << normalizeLane(lane, sides);

const bitCount = (mask: number) => {
  let count = 0;
  let value = mask >>> 0;
  while (value !== 0) {
    value &= value - 1;
    count += 1;
  }
  return count;
};

const stageByScore = (scoreHint: number) => {
  let stage = STAGE_PROFILES[0];
  for (const candidate of STAGE_PROFILES) {
    if (scoreHint >= candidate.scoreGate) stage = candidate;
  }
  return stage;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (seed: number, index: number, salt = 0) => {
  let x = (seed ^ Math.imul(index + 1 + salt, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
};

const collectiblePick = (rand: () => number): CollectibleKind => {
  const roll = rand();
  if (roll < 0.54) return 'shard';
  if (roll < 0.82) return 'core';
  return 'sync';
};

const carveHoles = (
  rand: () => number,
  stage: StageProfile,
  sides: number,
  safeLane: number,
  mode: OctaSurgeMode
) => {
  const allMask = (1 << sides) - 1;
  let solidMask = allMask;

  const densityBoost = mode === 'daily' ? 0.07 : 0;
  const holeTarget = clamp(
    Math.floor((stage.holeDensity + densityBoost) * sides + rand() * 1.9),
    1,
    Math.max(1, sides - 1)
  );

  let carved = 0;
  let guard = 0;

  while (carved < holeTarget && guard < sides * 6) {
    guard += 1;
    const lane = Math.floor(rand() * sides);
    if (lane === safeLane) continue;

    const distance = Math.min(
      Math.abs(lane - safeLane),
      sides - Math.abs(lane - safeLane)
    );
    const adjacentGuard =
      stage.id <= 2 ? 0.9 : stage.id === 3 ? 0.78 : 0.64;
    if (distance <= 1 && rand() < adjacentGuard) continue;
    if (distance === 2 && stage.id <= 2 && rand() < 0.62) continue;

    const bit = laneBit(lane, sides);
    if ((solidMask & bit) === 0) continue;

    solidMask &= ~bit;
    carved += 1;
  }

  solidMask |= laneBit(safeLane, sides);
  const minSolid =
    stage.id <= 2
      ? Math.ceil(sides * 0.58)
      : stage.id === 3
        ? Math.ceil(sides * 0.48)
        : Math.ceil(sides * 0.4);

  let safetyGuard = 0;
  while (bitCount(solidMask) < minSolid && safetyGuard < sides * 4) {
    safetyGuard += 1;
    const lane = Math.floor(rand() * sides);
    solidMask |= laneBit(lane, sides);
  }

  return solidMask;
};

const buildObstacleMask = (
  rand: () => number,
  stage: StageProfile,
  sides: number,
  safeLane: number,
  solidMask: number,
  mode: OctaSurgeMode
) => {
  const densityBoost = mode === 'daily' ? 0.06 : 0;
  const density = clamp(stage.obstacleDensity + densityBoost, 0.04, 0.78);

  let obstacleMask = 0;
  let obstacleCount = 0;
  const maxObstacles = Math.max(1, Math.floor(sides * density));
  const guardRadius = stage.id <= 2 ? 1 : 0;

  for (let lane = 0; lane < sides; lane += 1) {
    const bit = laneBit(lane, sides);
    if ((solidMask & bit) === 0) continue;
    if (lane === safeLane) continue;

    const distance = Math.min(
      Math.abs(lane - safeLane),
      sides - Math.abs(lane - safeLane)
    );
    if (distance <= guardRadius) continue;
    if (obstacleCount >= maxObstacles) continue;

    if (rand() < density) {
      obstacleMask |= bit;
      obstacleCount += 1;
    }
  }

  return obstacleMask;
};

const collectibleLane = (
  rand: () => number,
  stage: StageProfile,
  sides: number,
  safeLane: number,
  solidMask: number,
  mode: OctaSurgeMode
): { lane: number; kind: CollectibleKind } => {
  const chanceBoost = mode === 'daily' ? 0.04 : 0;
  const dropChance = clamp(stage.collectibleChance + chanceBoost, 0.08, 0.72);
  if (rand() > dropChance) return { lane: -1, kind: null };

  const kind = collectiblePick(rand);
  const preferredLane =
    kind === 'core' ? normalizeLane(safeLane + Math.floor(sides / 2), sides) : safeLane;

  if ((solidMask & laneBit(preferredLane, sides)) !== 0 && rand() < 0.78) {
    return { lane: preferredLane, kind };
  }

  const lanes: number[] = [];
  for (let lane = 0; lane < sides; lane += 1) {
    if ((solidMask & laneBit(lane, sides)) !== 0) lanes.push(lane);
  }

  if (!lanes.length) return { lane: -1, kind: null };
  return { lane: lanes[Math.floor(rand() * lanes.length)], kind };
};

export type LevelGenerator = {
  createSegment: (params: {
    slot: number;
    index: number;
    z: number;
    previousSafeLane: number;
    scoreHint: number;
  }) => SegmentPattern;
  initialSegments: () => SegmentPattern[];
};

export const createLevelGenerator = (
  seed: number,
  mode: OctaSurgeMode
): LevelGenerator => {
  const createSegment = ({
    slot,
    index,
    z,
    previousSafeLane,
    scoreHint,
  }: {
    slot: number;
    index: number;
    z: number;
    previousSafeLane: number;
    scoreHint: number;
  }): SegmentPattern => {
    const random = mulberry32(hashSeed(seed, index, slot));
    const stage = stageByScore(scoreHint);
    const sides = stage.sides;

    const driftRoll = random();
    let drift = 0;
    if (driftRoll < 0.24) drift = -1;
    else if (driftRoll < 0.48) drift = 1;
    else if (stage.id >= 3 && driftRoll < 0.56) drift = -2;
    else if (stage.id >= 3 && driftRoll < 0.64) drift = 2;

    const safeLane = normalizeLane(previousSafeLane + drift, sides);
    const solidMask = carveHoles(random, stage, sides, safeLane, mode);
    const obstacleMask = buildObstacleMask(
      random,
      stage,
      sides,
      safeLane,
      solidMask,
      mode
    );

    const collectible = collectibleLane(
      random,
      stage,
      sides,
      safeLane,
      solidMask,
      mode
    );

    return {
      slot,
      index,
      z,
      prevZ: z,
      sides,
      solidMask,
      obstacleMask,
      safeLane,
      collectibleLane: collectible.lane,
      collectibleType: collectible.kind,
      collected: false,
      warpSeed: random() * Math.PI * 2,
      stageId: stage.id,
      checked: false,
    };
  };

  const initialSegments = () => {
    const segments: SegmentPattern[] = [];
    let previousSafeLane = Math.floor(STAGE_PROFILES[0].sides / 2);

    for (let slot = 0; slot < GAME.segmentCount; slot += 1) {
      const index = slot;
      const z = GAME.spawnStartZ - slot * GAME.segmentLength;
      const scoreHint = slot * GAME.scoreRate * 7.2;

      const segment = createSegment({
        slot,
        index,
        z,
        previousSafeLane,
        scoreHint,
      });

      previousSafeLane = segment.safeLane;
      segments.push(segment);
    }

    return segments;
  };

  return {
    createSegment,
    initialSegments,
  };
};

export const useLevelGen = (seed: number, mode: OctaSurgeMode) =>
  useMemo(() => createLevelGenerator(seed, mode), [seed, mode]);
