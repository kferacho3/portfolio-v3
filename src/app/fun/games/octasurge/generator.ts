import { GAME } from './constants';
import type { CollectibleType, RingData } from './types';

const ALL_MASK = (1 << GAME.faces) - 1;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const normalizeLane = (lane: number) => {
  let out = lane % GAME.faces;
  if (out < 0) out += GAME.faces;
  return out;
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

const hash2 = (seed: number, index: number) => {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
};

const difficultyFromIndex = (index: number) => {
  const normalized = Math.max(0, index - GAME.warmupRings);
  return clamp(normalized / GAME.difficultyRampRings, 0, 1);
};

const densityFromDifficulty = (difficulty: number) =>
  difficulty < 0.45
    ? GAME.densityEarly +
      (GAME.densityMid - GAME.densityEarly) * (difficulty / 0.45)
    : GAME.densityMid +
      (GAME.densityLate - GAME.densityMid) * ((difficulty - 0.45) / 0.55);

const weightedPick = (
  rand: () => number,
  list: Array<{ lane: number; weight: number }>
) => {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let r = rand() * total;
  for (const item of list) {
    r -= item.weight;
    if (r <= 0) return item.lane;
  }
  return list[list.length - 1].lane;
};

const pickSafeLane = (
  rand: () => number,
  previousSafeLane: number,
  difficulty: number,
  density: number
) => {
  const options: Array<{ lane: number; weight: number }> = [
    {
      lane: previousSafeLane,
      weight: clamp(0.62 - density * 0.34, 0.28, 0.62),
    },
    {
      lane: normalizeLane(previousSafeLane + 1),
      weight: clamp(0.2 + density * 0.12, 0.2, 0.34),
    },
    {
      lane: normalizeLane(previousSafeLane - 1),
      weight: clamp(0.2 + density * 0.12, 0.2, 0.34),
    },
  ];

  if (difficulty < 0.35) {
    options.push({ lane: normalizeLane(previousSafeLane + 2), weight: 0.08 });
    options.push({ lane: normalizeLane(previousSafeLane - 2), weight: 0.08 });
  } else if (difficulty > 0.62) {
    options.push({
      lane: normalizeLane(previousSafeLane + 2),
      weight: 0.05 + (difficulty - 0.62) * 0.12,
    });
  }

  return weightedPick(rand, options);
};

const maybeCollectible = (
  rand: () => number,
  solidMask: number,
  bumpMask: number,
  safeLane: number,
  difficulty: number
): { lane: number | null; type: CollectibleType | null } => {
  const candidates: number[] = [];
  for (let lane = 0; lane < GAME.faces; lane += 1) {
    const bit = 1 << lane;
    if ((solidMask & bit) !== 0 && (bumpMask & bit) === 0) {
      candidates.push(lane);
    }
  }

  if (candidates.length === 0) return { lane: null, type: null };

  const gemChance = clamp(
    GAME.collectibleGemChance - difficulty * 0.08,
    0.18,
    0.34
  );
  const boostChance = GAME.collectibleBoostChance;
  const shieldChance = GAME.collectibleShieldChance;

  const roll = rand();
  let type: CollectibleType | null = null;
  if (roll < shieldChance) type = 'shield';
  else if (roll < shieldChance + boostChance) type = 'boost';
  else if (roll < shieldChance + boostChance + gemChance) type = 'gem';
  if (!type) return { lane: null, type: null };

  const preferred = [
    safeLane,
    normalizeLane(safeLane + 1),
    normalizeLane(safeLane - 1),
  ];
  for (const lane of preferred) {
    if (candidates.includes(lane) && rand() < 0.62) {
      return { lane, type };
    }
  }

  const lane = candidates[Math.floor(rand() * candidates.length)];
  return { lane, type };
};

export function generateRing(params: {
  seed: number;
  slot: number;
  index: number;
  z: number;
  previousSafeLane: number;
}): RingData {
  const { seed, slot, index, z, previousSafeLane } = params;
  const rand = mulberry32(hash2(seed, index));

  const difficulty = difficultyFromIndex(index);
  const density = densityFromDifficulty(difficulty);
  const breather = index > 0 && index % GAME.breatherEvery === 0;

  const safeLane = pickSafeLane(rand, previousSafeLane, difficulty, density);

  let solidMask = ALL_MASK;
  const maxHoles = breather
    ? 2
    : difficulty < 0.24
      ? 3
      : difficulty < 0.55
        ? 4
        : 5;
  const holeCount = clamp(
    1 + Math.floor(density * 4 + rand() * 1.7),
    1,
    maxHoles
  );

  const carveOrder = Array.from({ length: GAME.faces }, (_, i) => i).sort(
    () => rand() - 0.5
  );
  let carved = 0;
  for (const lane of carveOrder) {
    if (lane === safeLane) continue;
    if (carved >= holeCount) break;

    const keepAdjacent =
      difficulty < 0.38 &&
      (lane === normalizeLane(safeLane + 1) ||
        lane === normalizeLane(safeLane - 1));
    if (keepAdjacent && rand() < 0.72) continue;

    solidMask &= ~(1 << lane);
    carved += 1;
  }

  if ((solidMask & (1 << safeLane)) === 0) {
    solidMask |= 1 << safeLane;
  }

  let bumpMask = 0;
  const bumpChance = breather ? 0.06 : clamp(0.08 + density * 0.52, 0.08, 0.56);
  for (let lane = 0; lane < GAME.faces; lane += 1) {
    const bit = 1 << lane;
    if ((solidMask & bit) === 0) continue;
    if (lane === safeLane) continue;
    if (rand() < bumpChance) {
      bumpMask |= bit;
    }
  }

  let safeWalkable = false;
  for (let lane = 0; lane < GAME.faces; lane += 1) {
    const bit = 1 << lane;
    if ((solidMask & bit) !== 0 && (bumpMask & bit) === 0) {
      safeWalkable = true;
      break;
    }
  }
  if (!safeWalkable) {
    bumpMask &= ~(1 << safeLane);
  }

  const collectible = maybeCollectible(
    rand,
    solidMask,
    bumpMask,
    safeLane,
    difficulty
  );

  return {
    slot,
    index,
    z,
    solidMask,
    bumpMask,
    safeLane,
    collectibleLane: collectible.lane,
    collectibleType: collectible.type,
    collected: false,
    crossed: false,
    theme: index % 3,
  };
}
