import { GAME } from './constants';
import type { CollectibleType, RingData, RingMotif } from './types';

const ALL_MASK = (1 << GAME.faces) - 1;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const normalizeLane = (lane: number) => {
  let out = lane % GAME.faces;
  if (out < 0) out += GAME.faces;
  return out;
};

const laneBit = (lane: number) => 1 << normalizeLane(lane);

const laneDistance = (a: number, b: number) => {
  const d = Math.abs(normalizeLane(a) - normalizeLane(b));
  return Math.min(d, GAME.faces - d);
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

const weightedPick = <T>(
  rand: () => number,
  list: Array<{ value: T; weight: number }>
): T => {
  const total = list.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return list[0].value;
  let r = rand() * total;
  for (const item of list) {
    r -= Math.max(0, item.weight);
    if (r <= 0) return item.value;
  }
  return list[list.length - 1].value;
};

const pickMotif = (
  rand: () => number,
  index: number,
  difficulty: number
): RingMotif => {
  if (index > 0 && index % GAME.breatherEvery === 0) return 'breather';

  const late = clamp((difficulty - 0.45) / 0.55, 0, 1);
  return weightedPick(rand, [
    { value: 'single-hole', weight: 1.4 - difficulty * 0.5 },
    { value: 'double-hole', weight: 0.6 + difficulty * 0.9 },
    { value: 'alternating', weight: 0.34 + difficulty * 0.78 },
    { value: 'bump-corridor', weight: 0.72 + difficulty * 0.84 },
    { value: 'crusher-gate', weight: 0.18 + late * 0.7 },
    { value: 'flip-gate', weight: 0.1 + late * 0.6 },
    { value: 'speed-run', weight: 0.34 + (1 - difficulty) * 0.56 },
    { value: 'breather', weight: 0.16 + (1 - difficulty) * 0.24 },
  ]);
};

const pickSafeLane = (
  rand: () => number,
  previousSafeLane: number,
  difficulty: number,
  motif: RingMotif
) => {
  if (motif === 'flip-gate' && rand() < 0.84) {
    return normalizeLane(previousSafeLane + 4);
  }

  const drift = weightedPick(rand, [
    { value: 0, weight: clamp(0.58 - difficulty * 0.34, 0.2, 0.58) },
    { value: 1, weight: clamp(0.26 + difficulty * 0.2, 0.2, 0.44) },
    { value: -1, weight: clamp(0.26 + difficulty * 0.2, 0.2, 0.44) },
    { value: 2, weight: clamp(0.13 + difficulty * 0.1, 0.08, 0.22) },
    { value: -2, weight: clamp(0.13 + difficulty * 0.1, 0.08, 0.22) },
    { value: 4, weight: motif === 'flip-gate' ? 0.32 : 0.04 + difficulty * 0.06 },
  ]);

  return normalizeLane(previousSafeLane + drift);
};

const shuffleLanes = (rand: () => number) =>
  Array.from({ length: GAME.faces }, (_, i) => i).sort(() => rand() - 0.5);

type CandidateRing = {
  solidMask: number;
  bumpMask: number;
  crusherMask: number;
  speedMask: number;
  safeLane: number;
  collectibleLane: number | null;
  collectibleType: CollectibleType | null;
  theme: number;
  motif: RingMotif;
};

const ensureSafeWalkable = (
  solidMask: number,
  bumpMask: number,
  crusherMask: number,
  safeLane: number
) => {
  const safeBit = laneBit(safeLane);
  let solid = solidMask | safeBit;
  let bump = bumpMask & ~safeBit;
  let crusher = crusherMask & ~safeBit;

  const walkableMask = solid & ~(bump | crusher);
  if (walkableMask !== 0) {
    return { solid, bump, crusher };
  }
  bump &= ~safeBit;
  crusher &= ~safeBit;
  solid |= safeBit;
  return { solid, bump, crusher };
};

const carveHoles = (
  rand: () => number,
  solidMask: number,
  safeLane: number,
  holeCount: number
) => {
  let solid = solidMask;
  const lanes = shuffleLanes(rand);
  let carved = 0;

  for (const lane of lanes) {
    if (lane === safeLane) continue;
    if (carved >= holeCount) break;

    const adjacent =
      laneDistance(lane, safeLane) <= 1 || laneDistance(lane, safeLane) === 4;
    if (adjacent && rand() < 0.54) continue;

    solid &= ~laneBit(lane);
    carved += 1;
  }

  if ((solid & ALL_MASK) === 0) {
    solid = laneBit(safeLane);
  }
  return solid;
};

const maybeCollectible = (
  rand: () => number,
  walkableMask: number,
  safeLane: number,
  difficulty: number
): { lane: number | null; type: CollectibleType | null } => {
  const candidates: number[] = [];
  for (let lane = 0; lane < GAME.faces; lane += 1) {
    if ((walkableMask & laneBit(lane)) !== 0) candidates.push(lane);
  }

  if (candidates.length === 0) return { lane: null, type: null };

  const gemChance = clamp(
    GAME.collectibleGemChance - difficulty * 0.06,
    0.18,
    0.32
  );
  const shieldChance = GAME.collectibleShieldChance;
  const boostChance = GAME.collectibleBoostChance;
  const magnetChance = GAME.collectibleMagnetChance;
  const prismChance = GAME.collectiblePrismChance;
  const phaseChance = GAME.collectiblePhaseChance;
  const totalChance =
    gemChance +
    shieldChance +
    boostChance +
    magnetChance +
    prismChance +
    phaseChance;

  const roll = rand();
  if (roll > totalChance) return { lane: null, type: null };

  const type = weightedPick(rand, [
    { value: 'gem' as const, weight: gemChance },
    { value: 'boost' as const, weight: boostChance },
    { value: 'shield' as const, weight: shieldChance },
    { value: 'magnet' as const, weight: magnetChance },
    { value: 'prism' as const, weight: prismChance },
    { value: 'phase' as const, weight: phaseChance },
  ]);

  const preferred = [
    safeLane,
    normalizeLane(safeLane + 1),
    normalizeLane(safeLane - 1),
  ];
  for (const lane of preferred) {
    if (candidates.includes(lane) && rand() < 0.66) {
      return { lane, type };
    }
  }
  return { lane: candidates[Math.floor(rand() * candidates.length)], type };
};

const buildCandidate = (params: {
  seed: number;
  index: number;
  previousSafeLane: number;
  salt: number;
}): CandidateRing => {
  const { seed, index, previousSafeLane, salt } = params;
  const randomSeed = hash2(seed ^ Math.imul(salt + 1, 0x45d9f3b), index);
  const rand = mulberry32(randomSeed);
  const difficulty = difficultyFromIndex(index);
  const density = densityFromDifficulty(difficulty);

  const motif = pickMotif(rand, index, difficulty);
  const safeLane = pickSafeLane(rand, previousSafeLane, difficulty, motif);
  let solidMask = ALL_MASK;
  let bumpMask = 0;
  let crusherMask = 0;
  let speedMask = 0;

  if (motif === 'breather') {
    solidMask = carveHoles(rand, solidMask, safeLane, 1);
  } else if (motif === 'single-hole') {
    const holes = clamp(1 + Math.floor(density * 2.1 + rand() * 1.25), 1, 3);
    solidMask = carveHoles(rand, solidMask, safeLane, holes);
  } else if (motif === 'double-hole') {
    const holes = clamp(2 + Math.floor(density * 1.7 + rand() * 1.1), 2, 4);
    solidMask = carveHoles(rand, solidMask, safeLane, holes);
  } else if (motif === 'alternating') {
    const parity = (index + Math.floor(rand() * 2)) % 2;
    for (let lane = 0; lane < GAME.faces; lane += 1) {
      if (lane === safeLane) continue;
      if ((lane % 2) === parity && rand() < 0.92) {
        solidMask &= ~laneBit(lane);
      }
    }
  } else if (motif === 'bump-corridor') {
    const holes = clamp(1 + Math.floor(density * 1.8), 1, 3);
    solidMask = carveHoles(rand, solidMask, safeLane, holes);
  } else if (motif === 'crusher-gate') {
    const holes = clamp(2 + Math.floor(density * 1.6 + rand() * 0.8), 2, 4);
    solidMask = carveHoles(rand, solidMask, safeLane, holes);
  } else if (motif === 'flip-gate') {
    solidMask = carveHoles(rand, solidMask, safeLane, 2);
    solidMask &= ~laneBit(normalizeLane(safeLane + 1));
    solidMask &= ~laneBit(normalizeLane(safeLane - 1));
    solidMask |= laneBit(safeLane);
  } else if (motif === 'speed-run') {
    solidMask = carveHoles(rand, solidMask, safeLane, 1);
  }

  const bumpChance =
    motif === 'breather'
      ? 0.02
      : motif === 'speed-run'
        ? 0.08 + difficulty * 0.14
        : motif === 'bump-corridor'
          ? 0.24 + difficulty * 0.36
          : 0.1 + difficulty * 0.26;

  const crusherChance =
    motif === 'crusher-gate'
      ? 0.18 + difficulty * 0.24
      : motif === 'flip-gate'
        ? 0.11 + difficulty * 0.18
        : 0.035 + difficulty * 0.08;

  for (let lane = 0; lane < GAME.faces; lane += 1) {
    const bit = laneBit(lane);
    if ((solidMask & bit) === 0) continue;
    if (lane === safeLane) continue;

    if (rand() < crusherChance) {
      crusherMask |= bit;
      continue;
    }
    if (rand() < bumpChance) bumpMask |= bit;
  }

  let safeResult = ensureSafeWalkable(solidMask, bumpMask, crusherMask, safeLane);
  solidMask = safeResult.solid;
  bumpMask = safeResult.bump;
  crusherMask = safeResult.crusher;

  const walkableMask = solidMask & ~(bumpMask | crusherMask);

  const speedChance =
    motif === 'speed-run'
      ? 0.7
      : motif === 'breather'
        ? 0.2
        : clamp(0.11 + (1 - difficulty) * 0.15, 0.08, 0.28);

  for (let lane = 0; lane < GAME.faces; lane += 1) {
    const bit = laneBit(lane);
    if ((walkableMask & bit) === 0) continue;
    const prefer =
      lane === safeLane ||
      laneDistance(lane, safeLane) === 1 ||
      (motif === 'speed-run' && laneDistance(lane, safeLane) <= 2);
    if (prefer && rand() < speedChance) speedMask |= bit;
  }
  if (speedMask === 0 && motif === 'speed-run') {
    speedMask |= laneBit(safeLane);
  }

  safeResult = ensureSafeWalkable(solidMask, bumpMask, crusherMask, safeLane);
  solidMask = safeResult.solid;
  bumpMask = safeResult.bump;
  crusherMask = safeResult.crusher;

  const collectible = maybeCollectible(
    rand,
    solidMask & ~(bumpMask | crusherMask),
    safeLane,
    difficulty
  );

  return {
    solidMask,
    bumpMask,
    crusherMask,
    speedMask,
    safeLane,
    collectibleLane: collectible.lane,
    collectibleType: collectible.type,
    theme: (index + Math.floor(difficulty * 12) + salt) % 4,
    motif,
  };
};

const predictedSpeedAtIndex = (index: number) => {
  const elapsedApprox = Math.max(0, index - 8) * (GAME.ringSpacing / GAME.baseSpeed);
  const speed =
    GAME.baseSpeed +
    elapsedApprox * GAME.speedRampPerSecond +
    index * GAME.speedRampFromScore * 4.6;
  return clamp(speed, GAME.baseSpeed, GAME.maxSpeed);
};

const canTransition = (fromLane: number, toLane: number, ringIndex: number) => {
  const speed = predictedSpeedAtIndex(ringIndex);
  const ringsPerSecond = speed / GAME.ringSpacing;
  const stepFloat = GAME.maxInputRateLanePerSecond / Math.max(1, ringsPerSecond);
  const baseMaxStep = clamp(Math.floor(stepFloat + 0.35), 1, 3);
  const dist = laneDistance(fromLane, toLane);
  if (dist <= baseMaxStep) return true;
  return dist === 4 && stepFloat >= 0.8;
};

const walkableMask = (ring: CandidateRing) =>
  ring.solidMask & ~(ring.bumpMask | ring.crusherMask);

const isWindowSolvable = (params: {
  startMask: number;
  startIndex: number;
  preview: CandidateRing[];
}) => {
  const { startMask, startIndex, preview } = params;
  let reachable = startMask;

  for (let i = 0; i < preview.length; i += 1) {
    const ring = preview[i];
    const walkable = walkableMask(ring);
    let nextReachable = 0;

    for (let lane = 0; lane < GAME.faces; lane += 1) {
      const bit = laneBit(lane);
      if ((walkable & bit) === 0) continue;

      for (let prevLane = 0; prevLane < GAME.faces; prevLane += 1) {
        if ((reachable & laneBit(prevLane)) === 0) continue;
        if (!canTransition(prevLane, lane, startIndex + i)) continue;
        nextReachable |= bit;
        break;
      }
    }

    if (nextReachable === 0) return false;
    reachable = nextReachable;
  }

  return true;
};

const toRingData = (
  candidate: CandidateRing,
  params: { slot: number; index: number; z: number }
): RingData => {
  const { slot, index, z } = params;
  return {
    slot,
    index,
    z,
    solidMask: candidate.solidMask,
    bumpMask: candidate.bumpMask,
    crusherMask: candidate.crusherMask,
    speedMask: candidate.speedMask,
    safeLane: candidate.safeLane,
    collectibleLane: candidate.collectibleLane,
    collectibleType: candidate.collectibleType,
    collected: false,
    crossed: false,
    theme: candidate.theme,
    motif: candidate.motif,
  };
};

export function generateRing(params: {
  seed: number;
  slot: number;
  index: number;
  z: number;
  previousSafeLane: number;
}): RingData {
  const { seed, slot, index, z, previousSafeLane } = params;

  const startMask =
    laneBit(previousSafeLane) |
    laneBit(previousSafeLane + 1) |
    laneBit(previousSafeLane - 1);

  for (let attempt = 0; attempt < GAME.generatorMaxAttempts; attempt += 1) {
    const candidate = buildCandidate({
      seed,
      index,
      previousSafeLane,
      salt: attempt,
    });

    const preview: CandidateRing[] = [candidate];
    let lookSafeLane = candidate.safeLane;
    for (let k = 1; k < GAME.lookaheadRings; k += 1) {
      const future = buildCandidate({
        seed,
        index: index + k,
        previousSafeLane: lookSafeLane,
        salt: attempt + k * 13,
      });
      preview.push(future);
      lookSafeLane = future.safeLane;
    }

    if (isWindowSolvable({ startMask, startIndex: index, preview })) {
      return toRingData(candidate, { slot, index, z });
    }
  }

  const fallback = buildCandidate({
    seed,
    index,
    previousSafeLane,
    salt: 9991,
  });
  fallback.bumpMask = 0;
  fallback.crusherMask = 0;
  fallback.speedMask |= laneBit(fallback.safeLane);
  fallback.motif = 'breather';
  return toRingData(fallback, { slot, index, z });
}
