import {
  OCTA_OBSTACLE_POOL,
  OCTA_PLATFORM_POOL,
  STAGE_PROFILES,
} from '../constants';
import { hashSeed, mulberry32 } from '../engine/rng';
import type {
  CollectibleKind,
  OctaObstacleType,
  OctaPlatformType,
  OctaSurgeMode,
} from '../types';
import type { ModeSides, RingData, RingMask, RingLaneMeta } from './types';

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

const toModeSides = (sides: number): ModeSides => {
  if (sides <= 6) return 6;
  if (sides <= 8) return 8;
  if (sides <= 10) return 10;
  return 12;
};

const stageByIndex = (index: number) => {
  const progress = index * 74;
  let stage = STAGE_PROFILES[0];
  for (const candidate of STAGE_PROFILES) {
    if (progress >= candidate.scoreGate) stage = candidate;
  }
  return stage;
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

const platformWeight = (
  platform: OctaPlatformType,
  stageId: number,
  lane: number,
  safeLane: number,
  sides: number
) => {
  const distance = Math.min(
    Math.abs(lane - safeLane),
    sides - Math.abs(lane - safeLane)
  );

  let weight =
    platform === 'smooth_lane'
      ? 3.1
      : platform === 'drift_boost' || platform === 'reverse_drift'
        ? 1.02
        : platform === 'pulse_pad' || platform === 'spring_pad'
          ? 0.82
          : platform === 'warp_gate'
            ? 0.58
            : platform === 'phase_lane'
              ? 0.54
              : platform === 'resin_lane'
                ? 0.7
                : platform === 'crusher_lane'
                  ? 0.52
                  : 0.86;

  weight *= 1 + (stageId - 1) * 0.15;

  if (distance <= 1 && platform !== 'smooth_lane') weight *= 0.68;
  if (platform === 'smooth_lane' && distance <= 1) weight *= 1.38;
  if (platform === 'phase_lane' && stageId <= 2) weight *= 0.58;
  if (platform === 'crusher_lane' && stageId <= 2) weight *= 0.56;
  if (platform === 'warp_gate' && stageId <= 1) weight *= 0.6;

  return weight;
};

const obstacleWeight = (
  obstacle: Exclude<OctaObstacleType, 'none'>,
  stageId: number,
  mode: OctaSurgeMode
) => {
  let weight =
    obstacle === 'arc_blade'
      ? 0.62
      : obstacle === 'shutter_gate'
        ? 0.58
        : obstacle === 'pulse_laser'
          ? 0.52
          : obstacle === 'gravity_orb'
            ? 0.5
            : obstacle === 'prism_mine'
              ? 0.46
              : obstacle === 'flame_jet'
                ? 0.42
                : obstacle === 'phase_portal'
                  ? 0.46
                  : obstacle === 'trap_split'
                    ? 0.56
                    : obstacle === 'magnetron'
                      ? 0.44
                      : obstacle === 'spike_fan'
                        ? 0.54
                        : obstacle === 'thunder_column'
                          ? 0.42
                          : 0.5;

  weight *= 1 + (stageId - 1) * 0.17;
  if (mode === 'daily') weight *= 1.1;

  if (
    (obstacle === 'flame_jet' || obstacle === 'thunder_column') &&
    stageId <= 2
  ) {
    weight *= 0.7;
  }

  return weight;
};

const obstacleOpenRatioBias = (
  obstacle: Exclude<OctaObstacleType, 'none'>
): number => {
  if (obstacle === 'arc_blade' || obstacle === 'pulse_laser') return -0.08;
  if (obstacle === 'vortex_saw' || obstacle === 'spike_fan') return -0.04;
  if (obstacle === 'flame_jet' || obstacle === 'thunder_column') return 0.06;
  if (obstacle === 'phase_portal' || obstacle === 'gravity_orb') return 0.03;
  return 0;
};

const collectibleKind = (rand: () => number): CollectibleKind => {
  const roll = rand();
  if (roll < 0.54) return 'shard';
  if (roll < 0.82) return 'core';
  return 'sync';
};

const chooseCollectible = (
  rand: () => number,
  sides: number,
  safeLane: number,
  solidMask: RingMask,
  chance: number
) => {
  if (rand() > chance) return { lane: -1, type: null as CollectibleKind };
  const type = collectibleKind(rand);
  const preferred =
    type === 'core'
      ? normalizeLane(safeLane + Math.floor(sides / 2), sides)
      : safeLane;

  if ((solidMask & laneBit(preferred, sides)) !== 0 && rand() < 0.78) {
    return { lane: preferred, type };
  }

  const lanes: number[] = [];
  for (let lane = 0; lane < sides; lane += 1) {
    if ((solidMask & laneBit(lane, sides)) !== 0) lanes.push(lane);
  }

  if (lanes.length <= 0) return { lane: -1, type: null as CollectibleKind };
  return { lane: lanes[Math.floor(rand() * lanes.length)], type };
};

export type RingRunGenerator = {
  reset: (seed: number, mode: OctaSurgeMode) => void;
  getRing: (index: number) => RingData;
};

export const createRingRunGenerator = (
  initialSeed: number,
  initialMode: OctaSurgeMode
): RingRunGenerator => {
  let seed = initialSeed;
  let mode = initialMode;
  let generatedTo = -1;
  let previousSafeLane = Math.floor(STAGE_PROFILES[0].sides / 2);
  const cache = new Map<number, RingData>();

  const clear = () => {
    cache.clear();
    generatedTo = -1;
    previousSafeLane = Math.floor(STAGE_PROFILES[0].sides / 2);
  };

  const buildRing = (index: number): RingData => {
    const stage = stageByIndex(index);
    const sides = toModeSides(stage.sides);
    const rand = mulberry32(hashSeed(seed, index));

    const driftRoll = rand();
    let drift = 0;
    if (driftRoll < 0.2) drift = -1;
    else if (driftRoll < 0.4) drift = 1;
    else if (stage.id >= 3 && driftRoll < 0.49) drift = -2;
    else if (stage.id >= 3 && driftRoll < 0.58) drift = 2;

    const safeLane = normalizeLane(previousSafeLane + drift, sides);

    let solidMask = (1 << sides) - 1;
    const holeDensity =
      stage.holeDensity +
      (mode === 'daily' ? 0.08 : 0) +
      Math.max(0, (stage.id - 2) * 0.016);
    const holeTarget = clamp(
      Math.floor(sides * holeDensity + rand() * 2.3),
      1,
      Math.max(1, sides - 1)
    );

    let carved = 0;
    let guard = 0;
    while (carved < holeTarget && guard < sides * 10) {
      guard += 1;
      const lane = Math.floor(rand() * sides);
      if (lane === safeLane) continue;
      const dist = Math.min(
        Math.abs(lane - safeLane),
        sides - Math.abs(lane - safeLane)
      );
      if (dist <= 1 && rand() < 0.8) continue;
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

    let fillGuard = 0;
    while (bitCount(solidMask) < minSolid && fillGuard < sides * 5) {
      fillGuard += 1;
      solidMask |= laneBit(Math.floor(rand() * sides), sides);
    }

    const laneMeta: RingLaneMeta[] = Array.from({ length: sides }, (_, lane) => ({
      lane,
      platform: 'smooth_lane',
      platformPhase: rand() * Math.PI * 2,
      obstacle: 'none',
      obstaclePhase: rand() * Math.PI * 2,
      obstacleCycle: 2.4,
      obstacleOpenWindow: 2.4,
      obstacleWindowStart: 0,
    }));

    const obstacleDensity = clamp(
      stage.obstacleDensity + (mode === 'daily' ? 0.09 : 0),
      0.08,
      0.9
    );

    let obstacleCount = 0;
    const obstacleCap = Math.max(1, Math.floor(sides * (0.34 + obstacleDensity * 0.88)));

    for (let lane = 0; lane < sides; lane += 1) {
      const bit = laneBit(lane, sides);
      if ((solidMask & bit) === 0) continue;

      const meta = laneMeta[lane];
      meta.platform = pickWeighted(
        rand,
        OCTA_PLATFORM_POOL,
        (platform) => platformWeight(platform, stage.id, lane, safeLane, sides)
      );

      const dist = Math.min(
        Math.abs(lane - safeLane),
        sides - Math.abs(lane - safeLane)
      );
      const nearPenalty = dist <= 1 ? 0.46 : dist === 2 ? 0.78 : 1;
      const platformPenalty =
        meta.platform === 'phase_lane' || meta.platform === 'crusher_lane'
          ? 0.62
          : meta.platform === 'resin_lane'
            ? 0.76
            : 1;
      const chance = obstacleDensity * nearPenalty * platformPenalty;

      if (lane === safeLane || obstacleCount >= obstacleCap || rand() > chance) {
        continue;
      }

      const obstacle = pickWeighted(
        rand,
        OCTA_OBSTACLE_POOL,
        (item) => obstacleWeight(item, stage.id, mode)
      );

      const tempo = 1 + stage.id * 0.18;
      const cycle = clamp(
        (3.05 - stage.id * 0.22 + rand() * 1.14) / tempo,
        0.72,
        3.5
      );
      const openRatio = clamp(
        0.58 - stage.id * 0.05 + rand() * 0.18 + obstacleOpenRatioBias(obstacle),
        0.2,
        0.82
      );

      meta.obstacle = obstacle;
      meta.obstacleCycle = cycle;
      meta.obstacleOpenWindow = clamp(cycle * openRatio, 0.16, cycle * 0.9);
      meta.obstacleWindowStart = rand() * cycle;
      obstacleCount += 1;
    }

    const collectible = chooseCollectible(
      rand,
      sides,
      safeLane,
      solidMask,
      clamp(stage.collectibleChance + (mode === 'daily' ? 0.04 : 0), 0.08, 0.74)
    );

    previousSafeLane = safeLane;

    return {
      index,
      sides,
      stageId: stage.id,
      solidMask,
      safeLane,
      warpSeed: rand() * Math.PI * 2,
      laneMeta,
      collectibleLane: collectible.lane,
      collectibleType: collectible.type,
      collected: false,
    };
  };

  const ensureTo = (index: number) => {
    if (index <= generatedTo) return;
    for (let i = generatedTo + 1; i <= index; i += 1) {
      cache.set(i, buildRing(i));
      generatedTo = i;
    }
  };

  return {
    reset(nextSeed, nextMode) {
      seed = nextSeed;
      mode = nextMode;
      clear();
    },
    getRing(index) {
      ensureTo(index);
      const ring = cache.get(index);
      if (!ring) {
        throw new Error(`Failed to generate ring ${index}`);
      }
      return ring;
    },
  };
};
