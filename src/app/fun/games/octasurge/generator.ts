import { useMemo } from 'react';

import {
  GAME,
  OCTA_OBSTACLE_POOL,
  OCTA_PLATFORM_POOL,
  STAGE_PROFILES,
} from './constants';
import type {
  CollectibleKind,
  OctaObstacleType,
  OctaPlatformType,
  OctaSurgeMode,
  SegmentLanePattern,
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

const BASE_PLATFORM_WEIGHTS: Record<OctaPlatformType, number> = {
  standard: 2.4,
  conveyor_belt: 0.72,
  reverse_conveyor: 0.48,
  bouncer: 0.54,
  trampoline: 0.38,
  teleporter: 0.3,
  ghost_platform: 0.32,
  sticky_glue: 0.44,
  crushing_ceiling: 0.34,
  speed_ramp: 0.52,
};

const BASE_OBSTACLE_WEIGHTS: Record<Exclude<OctaObstacleType, 'none'>, number> = {
  laser_grid: 0.5,
  gravity_well: 0.42,
  rotating_cross_blades: 0.48,
  homing_mine: 0.36,
  rising_lava: 0.32,
  telefrag_portal: 0.34,
  trapdoor_row: 0.46,
  pulse_expander: 0.37,
  magnetic_field: 0.33,
  spike_wave: 0.44,
  lightning_striker: 0.36,
};

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

const pickWeighted = <T extends string>(
  rand: () => number,
  items: readonly T[],
  weightFor: (item: T) => number
) => {
  let total = 0;
  const weighted = items.map((item) => {
    const weight = Math.max(0.01, weightFor(item));
    total += weight;
    return { item, weight };
  });

  if (total <= 0) return items[0];

  let cursor = rand() * total;
  for (let i = 0; i < weighted.length; i += 1) {
    cursor -= weighted[i].weight;
    if (cursor <= 0) return weighted[i].item;
  }

  return weighted[weighted.length - 1].item;
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
      stage.id <= 2 ? 0.94 : stage.id === 3 ? 0.82 : 0.68;
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
      ? Math.ceil(sides * 0.62)
      : stage.id === 3
        ? Math.ceil(sides * 0.5)
        : Math.ceil(sides * 0.42);

  let safetyGuard = 0;
  while (bitCount(solidMask) < minSolid && safetyGuard < sides * 4) {
    safetyGuard += 1;
    const lane = Math.floor(rand() * sides);
    solidMask |= laneBit(lane, sides);
  }

  return solidMask;
};

const platformWeightFor = (
  platform: OctaPlatformType,
  stage: StageProfile,
  lane: number,
  safeLane: number
) => {
  let weight = BASE_PLATFORM_WEIGHTS[platform];
  const distance = Math.min(
    Math.abs(lane - safeLane),
    stage.sides - Math.abs(lane - safeLane)
  );
  const laterStage = 1 + (stage.id - 1) * 0.14;
  weight *= laterStage;

  if (platform === 'standard') {
    weight *= distance <= 1 ? 1.32 : 1;
  }
  if (platform === 'teleporter' || platform === 'crushing_ceiling') {
    if (stage.id <= 2) weight *= 0.5;
  }
  if (platform === 'ghost_platform' && stage.id <= 1) weight *= 0.42;
  if (platform === 'reverse_conveyor' && distance <= 1) weight *= 0.52;
  if (platform === 'sticky_glue' && distance <= 1) weight *= 0.68;

  return weight;
};

const obstacleWeightFor = (
  obstacle: Exclude<OctaObstacleType, 'none'>,
  stage: StageProfile,
  mode: OctaSurgeMode
) => {
  let weight = BASE_OBSTACLE_WEIGHTS[obstacle];
  weight *= 1 + (stage.id - 1) * 0.16;
  if (mode === 'daily') weight *= 1.09;

  if (
    obstacle === 'rotating_cross_blades' ||
    obstacle === 'laser_grid' ||
    obstacle === 'trapdoor_row'
  ) {
    weight *= 1.08;
  }
  if (
    obstacle === 'rising_lava' ||
    obstacle === 'homing_mine' ||
    obstacle === 'lightning_striker'
  ) {
    weight *= stage.id >= 3 ? 1.2 : 0.7;
  }

  return weight;
};

const buildLanePatterns = (
  rand: () => number,
  stage: StageProfile,
  sides: number,
  safeLane: number,
  solidMask: number,
  mode: OctaSurgeMode
): { lanePatterns: SegmentLanePattern[]; obstacleMask: number } => {
  const lanePatterns: SegmentLanePattern[] = Array.from(
    { length: sides },
    (_, lane) => ({
      lane,
      platform: 'standard',
      platformPhase: rand() * Math.PI * 2,
      obstacle: 'none',
      obstaclePhase: rand() * Math.PI * 2,
      obstacleCycle: 2.2,
      obstacleOpenWindow: 2.2,
      obstacleWindowStart: 0,
    })
  );

  const densityBoost = mode === 'daily' ? 0.08 : 0;
  const baseObstacleChance = clamp(
    stage.obstacleDensity + densityBoost,
    0.06,
    0.84
  );

  let obstacleMask = 0;
  let obstacleCount = 0;
  const maxObstacles = Math.max(
    1,
    Math.floor(sides * (0.22 + stage.obstacleDensity * 0.82))
  );

  for (let lane = 0; lane < sides; lane += 1) {
    const bit = laneBit(lane, sides);
    if ((solidMask & bit) === 0) continue;

    const pattern = lanePatterns[lane];
    const distance = Math.min(
      Math.abs(lane - safeLane),
      sides - Math.abs(lane - safeLane)
    );

    pattern.platform = pickWeighted(
      rand,
      OCTA_PLATFORM_POOL,
      (platform) => platformWeightFor(platform, stage, lane, safeLane)
    );
    pattern.platformPhase = rand() * Math.PI * 2;

    const nearSafeLanePenalty =
      distance <= 1 ? 0.42 : distance === 2 && stage.id <= 2 ? 0.74 : 1;
    const platformPenalty =
      pattern.platform === 'ghost_platform' ||
      pattern.platform === 'crushing_ceiling'
        ? 0.66
        : pattern.platform === 'sticky_glue'
          ? 0.72
          : 1;
    const obstacleChance =
      baseObstacleChance * nearSafeLanePenalty * platformPenalty;

    if (
      lane === safeLane ||
      obstacleCount >= maxObstacles ||
      rand() >= obstacleChance
    ) {
      continue;
    }

    const obstacle = pickWeighted(
      rand,
      OCTA_OBSTACLE_POOL,
      (item) => obstacleWeightFor(item, stage, mode)
    );

    const tempo = 1 + stage.id * 0.16 + (mode === 'daily' ? 0.1 : 0);
    const cycle = clamp(
      (2.95 - stage.id * 0.24 + rand() * 1.15) / tempo,
      0.82,
      3.8
    );
    const openRatio = clamp(0.62 - stage.id * 0.06 + rand() * 0.2, 0.26, 0.82);
    const openWindow = clamp(cycle * openRatio, 0.18, cycle * 0.9);

    pattern.obstacle = obstacle;
    pattern.obstaclePhase = rand() * Math.PI * 2;
    pattern.obstacleCycle = cycle;
    pattern.obstacleOpenWindow = openWindow;
    pattern.obstacleWindowStart = rand() * cycle;
    obstacleMask |= bit;
    obstacleCount += 1;
  }

  return { lanePatterns, obstacleMask };
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
    kind === 'core'
      ? normalizeLane(safeLane + Math.floor(sides / 2), sides)
      : safeLane;

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
    else if (stage.id >= 3 && driftRoll < 0.53) drift = -2;
    else if (stage.id >= 3 && driftRoll < 0.58) drift = 2;

    const safeLane = normalizeLane(previousSafeLane + drift, sides);
    const solidMask = carveHoles(random, stage, sides, safeLane, mode);
    const laneMeta = buildLanePatterns(
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
      obstacleMask: laneMeta.obstacleMask,
      lanePatterns: laneMeta.lanePatterns,
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
