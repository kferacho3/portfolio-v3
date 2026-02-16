import {
  GAME_CONFIG,
  MODE_SETTINGS,
  OBSTACLE_PATTERNS,
  SIDE_SEQUENCE,
} from './constants';
import type {
  ModeSides,
  OctaReplay,
  OctaReplayInput,
  OctaSurgeMode,
  TurnDirection,
} from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const wrapIndex = (value: number, max: number) => {
  const m = Math.max(1, max);
  return ((value % m) + m) % m;
};

const wrapFloat = (value: number, max: number) => {
  const m = Math.max(1, max);
  let out = value;
  while (out < 0) out += m;
  while (out >= m) out -= m;
  return out;
};

const shortestLaneDelta = (from: number, to: number, sides: number) => {
  let delta = to - from;
  const half = sides * 0.5;
  while (delta > half) delta -= sides;
  while (delta < -half) delta += sides;
  return delta;
};

const laneBit = (lane: number, sides: number) => 1 << wrapIndex(lane, sides);

const setLane = (mask: number, lane: number, sides: number) =>
  mask | laneBit(lane, sides);

const clearLane = (mask: number, lane: number, sides: number) =>
  mask & ~laneBit(lane, sides);

const setSpan = (mask: number, center: number, radius: number, sides: number) => {
  let next = mask;
  for (let o = -radius; o <= radius; o += 1) {
    next = setLane(next, center + o, sides);
  }
  return next;
};

const clearSpan = (mask: number, center: number, radius: number, sides: number) => {
  let next = mask;
  for (let o = -radius; o <= radius; o += 1) {
    next = clearLane(next, center + o, sides);
  }
  return next;
};

const popcount = (value: number) => {
  let count = 0;
  let n = value;
  while (n) {
    n &= n - 1;
    count += 1;
  }
  return count;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const mulberry32 = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export function createFixedStepper(step = GAME_CONFIG.fixedStep) {
  let accumulator = 0;
  return (delta: number, tick: (dt: number) => void) => {
    const clamped = Math.min(delta, 0.05);
    accumulator += clamped;
    while (accumulator >= step) {
      tick(step);
      accumulator -= step;
    }
  };
}

export type OctaWorld = {
  seed: number;
  mode: OctaSurgeMode;
  preview: boolean;

  ringCount: number;
  maxSides: number;
  ringSpacing: number;
  tunnelRadius: number;

  ringIds: Int32Array;
  ringMasks: Uint16Array;
  ringCollectibles: Uint16Array;
  ringSides: Uint8Array;
  ringPattern: Uint8Array;
  bufferVersion: number;

  firstRingId: number;
  nextRingId: number;

  safeLane: number;
  previousSafeLane: number;

  lane: number;
  laneTarget: number;
  laneFloat: number;
  laneVelocity: number;
  turnQueue: TurnDirection[];

  elapsed: number;
  distance: number;
  scroll: number;
  speed: number;
  difficulty: number;
  combo: number;
  nearMisses: number;
  collectibles: number;
  speedTier: number;
  bestCombo: number;
  fxPulse: number;
  hitFlash: number;
  switchBlur: number;

  visualSides: number;
  lastPatternIndex: number;
  hudCommit: number;

  alive: boolean;

  inputLog: OctaReplayInput[];
  playbackQueue: OctaReplayInput[] | null;
  playbackCursor: number;

  rng: () => number;
};

export type StepOutcome = {
  died: boolean;
  passed: number;
};

export type CreateWorldOptions = {
  seed: number;
  mode: OctaSurgeMode;
  replayInputs?: OctaReplayInput[] | null;
  playback?: boolean;
  preview?: boolean;
};

const sideForDistance = (mode: OctaSurgeMode, distance: number): ModeSides => {
  if (mode === 'symmetry') return 8;
  if (mode === 'gauntlet') return 12;

  const segment = Math.floor(distance / 160);
  return SIDE_SEQUENCE[segment % SIDE_SEQUENCE.length] ?? 8;
};

const choosePatternIndex = (rand: () => number, difficulty: number) => {
  const p = rand();
  if (difficulty < 0.25) {
    if (p < 0.22) return 0;
    if (p < 0.42) return 1;
    if (p < 0.58) return 2;
    if (p < 0.72) return 3;
    if (p < 0.86) return 7;
    return 8;
  }
  if (difficulty < 0.58) {
    if (p < 0.12) return 0;
    if (p < 0.24) return 1;
    if (p < 0.35) return 2;
    if (p < 0.46) return 3;
    if (p < 0.58) return 4;
    if (p < 0.7) return 5;
    if (p < 0.82) return 6;
    if (p < 0.92) return 7;
    return 8;
  }
  if (p < 0.09) return 1;
  if (p < 0.18) return 2;
  if (p < 0.29) return 3;
  if (p < 0.41) return 4;
  if (p < 0.54) return 5;
  if (p < 0.68) return 6;
  if (p < 0.82) return 7;
  if (p < 0.92) return 8;
  return 9;
};

const generatePatternMask = (
  patternIndex: number,
  sides: ModeSides,
  difficulty: number,
  world: OctaWorld,
  phase: number
) => {
  const fullMask = (1 << sides) - 1;
  const half = sides / 2;
  const quarter = sides / 4;
  let mask = 0;

  switch (patternIndex) {
    case 0: {
      mask = fullMask;
      const gapRadius = difficulty < 0.45 ? 1 : 0;
      const gateA = wrapIndex(world.safeLane, sides);
      const gateB = wrapIndex(gateA + half, sides);
      mask = clearSpan(mask, gateA, gapRadius + 1, sides);
      mask = clearSpan(mask, gateB, gapRadius, sides);

      const ribs = 2 + Math.floor(difficulty * 3);
      for (let i = 0; i < ribs; i += 1) {
        const lane = wrapIndex(phase + Math.floor(((i + 1) * sides) / (ribs + 2)), sides);
        mask = setSpan(mask, lane, difficulty > 0.8 ? 1 : 0, sides);
      }
      break;
    }
    case 1: {
      const parity = phase % 2;
      for (let lane = 0; lane < sides; lane += 1) {
        if ((lane + parity) % 2 === 0) {
          mask = setLane(mask, lane, sides);
          if (difficulty > 0.72 && lane % 3 === 0) {
            mask = setLane(mask, lane + 1, sides);
          }
        }
      }
      break;
    }
    case 2: {
      const center = wrapIndex(phase, sides);
      const arc = 1 + Math.floor(difficulty * 2.4);
      mask = setSpan(mask, center, arc, sides);
      mask = setSpan(mask, center + half, Math.max(1, arc - 1), sides);

      if (difficulty > 0.56) {
        mask = setSpan(mask, center + quarter, 0, sides);
        mask = setSpan(mask, center - quarter, 0, sides);
      }
      break;
    }
    case 3: {
      const axis = wrapIndex(phase, quarter);
      const width = difficulty > 0.7 ? 1 : 0;
      for (let i = 0; i < 4; i += 1) {
        const lane = axis + i * quarter;
        mask = setSpan(mask, lane, width, sides);
      }
      if (difficulty > 0.5) {
        const off = wrapIndex(axis + Math.floor(quarter / 2), sides);
        mask = setLane(mask, off, sides);
        mask = setLane(mask, off + half, sides);
      }
      break;
    }
    case 4: {
      const pairCount = 2 + Math.floor(difficulty * 4);
      for (let i = 0; i < pairCount; i += 1) {
        const lane = Math.floor(world.rng() * half);
        mask = setLane(mask, lane, sides);
        mask = setLane(mask, lane + half, sides);
        if (difficulty > 0.65 && world.rng() < 0.45) {
          mask = setLane(mask, lane + 1, sides);
          mask = setLane(mask, lane + half + 1, sides);
        }
      }
      break;
    }
    case 5:
    default: {
      mask = fullMask;
      const windowCount = difficulty > 0.8 ? 2 : 3;
      const center = wrapIndex(world.safeLane, sides);
      const offsets = [0, half, quarter];
      for (let i = 0; i < windowCount; i += 1) {
        const offset = offsets[i] ?? 0;
        mask = clearSpan(mask, center + offset, 0, sides);
      }
      break;
    }
    case 6: {
      const sweep = wrapIndex(phase + Math.floor(world.elapsed * (2.2 + difficulty * 2.8)), sides);
      const mirror = wrapIndex(sweep + half, sides);
      mask = setSpan(mask, sweep, difficulty > 0.65 ? 1 : 0, sides);
      mask = setSpan(mask, mirror, difficulty > 0.65 ? 1 : 0, sides);
      if (difficulty > 0.48) {
        mask = setLane(mask, sweep + 2, sides);
        mask = setLane(mask, mirror - 2, sides);
      }
      break;
    }
    case 7: {
      const clusterCount = 1 + Math.floor(difficulty * 3);
      for (let i = 0; i < clusterCount; i += 1) {
        const lane = wrapIndex(phase + i * quarter, sides);
        mask = setSpan(mask, lane, 0, sides);
        if (difficulty > 0.5) mask = setLane(mask, lane + half, sides);
        if (difficulty > 0.72) {
          mask = setLane(mask, lane + 1, sides);
          mask = setLane(mask, lane - 1, sides);
        }
      }
      break;
    }
    case 8: {
      const a = wrapIndex(phase + quarter, sides);
      const b = wrapIndex(phase - quarter, sides);
      mask = setSpan(mask, a, difficulty > 0.7 ? 1 : 0, sides);
      mask = setSpan(mask, b, difficulty > 0.7 ? 1 : 0, sides);
      mask = setSpan(mask, a + half, difficulty > 0.7 ? 1 : 0, sides);
      mask = setSpan(mask, b + half, difficulty > 0.7 ? 1 : 0, sides);
      break;
    }
    case 9: {
      const stride = Math.max(2, Math.floor(sides / 3));
      const start = wrapIndex(phase, sides);
      for (let lane = start; lane < start + sides; lane += stride) {
        mask = setLane(mask, lane, sides);
      }
      if (difficulty > 0.66) {
        for (let lane = start + 1; lane < start + sides; lane += stride) {
          mask = setLane(mask, lane, sides);
        }
      }
      break;
    }
  }

  return mask & fullMask;
};

const ensurePlayableSymmetry = (
  maskInput: number,
  sides: ModeSides,
  difficulty: number,
  world: OctaWorld
) => {
  const fullMask = (1 << sides) - 1;
  let mask = maskInput & fullMask;
  const half = sides / 2;
  const previousSafe = wrapIndex(world.safeLane, sides);

  const turnChance = 0.04 + difficulty * 0.2;
  let nextSafe = previousSafe;
  if (world.rng() < turnChance) {
    const step = world.rng() < 0.75 ? 1 : 2;
    const dir = world.rng() < 0.5 ? -1 : 1;
    nextSafe = wrapIndex(nextSafe + step * dir, sides);
  }

  mask = clearLane(mask, previousSafe, sides);
  mask = clearLane(mask, nextSafe, sides);

  if (difficulty < 0.32) {
    mask = clearLane(mask, nextSafe + 1, sides);
    mask = clearLane(mask, nextSafe - 1, sides);
  }

  if (difficulty < 0.12) {
    mask = clearLane(mask, previousSafe + 1, sides);
    mask = clearLane(mask, previousSafe - 1, sides);
  }

  if (world.rng() < 0.55) {
    mask = clearLane(mask, nextSafe + half, sides);
  }

  const blockedMin = Math.min(
    sides - 1,
    Math.floor(sides * (0.32 + difficulty * 0.24 + MODE_SETTINGS[world.mode].densityBias))
  );
  const blockedMax = Math.max(1, sides - 2);

  let guard = 0;
  while (popcount(mask) < blockedMin && guard < sides * 4) {
    guard += 1;
    const candidate = Math.floor(world.rng() * (sides / 2));
    const mirrored = candidate + half;
    if (candidate === nextSafe || mirrored === nextSafe) continue;
    if (candidate === previousSafe || mirrored === previousSafe) continue;
    mask = setLane(mask, candidate, sides);
    mask = setLane(mask, mirrored, sides);
  }

  guard = 0;
  while (popcount(mask) > blockedMax && guard < sides * 4) {
    guard += 1;
    const candidate = Math.floor(world.rng() * (sides / 2));
    const mirrored = candidate + half;
    if (candidate === nextSafe || mirrored === nextSafe) continue;
    if (candidate === previousSafe || mirrored === previousSafe) continue;
    mask = clearLane(mask, candidate, sides);
    mask = clearLane(mask, mirrored, sides);
  }

  if (mask === fullMask) {
    mask = clearLane(mask, nextSafe, sides);
  }

  world.previousSafeLane = world.safeLane;
  world.safeLane = nextSafe;

  return mask;
};

const createCollectibleMask = (
  world: OctaWorld,
  sides: ModeSides,
  blockedMask: number,
  difficulty: number
) => {
  let collectibleMask = 0;

  const spawnChance = 0.44 - difficulty * 0.2;
  if (world.rng() > spawnChance) return collectibleMask;

  const options = [
    wrapIndex(world.safeLane, sides),
    wrapIndex(world.previousSafeLane, sides),
    wrapIndex(world.safeLane + 1, sides),
    wrapIndex(world.safeLane - 1, sides),
  ];

  for (let i = 0; i < options.length; i += 1) {
    const lane = options[i];
    if ((blockedMask & laneBit(lane, sides)) !== 0) continue;
    collectibleMask = setLane(collectibleMask, lane, sides);
    break;
  }

  if (collectibleMask === 0) return collectibleMask;

  if (difficulty > 0.45 && world.rng() < 0.25) {
    const firstLane = options[0] ?? 0;
    const mirrorLane = wrapIndex(firstLane + sides / 2, sides);
    if ((blockedMask & laneBit(mirrorLane, sides)) === 0) {
      collectibleMask = setLane(collectibleMask, mirrorLane, sides);
    }
  }

  return collectibleMask;
};

const writeRing = (world: OctaWorld, globalRingId: number) => {
  const slot = wrapIndex(globalRingId, world.ringCount);
  const distance = globalRingId * world.ringSpacing;
  const sides = sideForDistance(world.mode, distance);
  const settings = MODE_SETTINGS[world.mode];
  const difficulty = clamp(distance / settings.rampDistance, 0, 1);

  world.safeLane = wrapIndex(world.safeLane, sides);
  world.previousSafeLane = wrapIndex(world.previousSafeLane, sides);

  const patternIndex = choosePatternIndex(world.rng, difficulty);
  const phase = Math.floor(world.rng() * sides);
  const baseMask = generatePatternMask(patternIndex, sides, difficulty, world, phase);
  const mask = ensurePlayableSymmetry(baseMask, sides, difficulty, world);
  const collectibleMask = createCollectibleMask(world, sides, mask, difficulty);

  world.ringIds[slot] = globalRingId;
  world.ringMasks[slot] = mask;
  world.ringCollectibles[slot] = collectibleMask;
  world.ringSides[slot] = sides;
  world.ringPattern[slot] = patternIndex;
  world.bufferVersion += 1;
};

export const createWorld = ({
  seed,
  mode,
  replayInputs = null,
  playback = false,
  preview = false,
}: CreateWorldOptions): OctaWorld => {
  const rng = mulberry32(seed);
  const ringCount = GAME_CONFIG.ringCount;
  const world: OctaWorld = {
    seed,
    mode,
    preview,

    ringCount,
    maxSides: GAME_CONFIG.maxSides,
    ringSpacing: GAME_CONFIG.ringSpacing,
    tunnelRadius: GAME_CONFIG.tunnelRadius,

    ringIds: new Int32Array(ringCount),
    ringMasks: new Uint16Array(ringCount),
    ringCollectibles: new Uint16Array(ringCount),
    ringSides: new Uint8Array(ringCount),
    ringPattern: new Uint8Array(ringCount),
    bufferVersion: 0,

    firstRingId: 0,
    nextRingId: 0,

    safeLane: 0,
    previousSafeLane: 0,

    lane: 0,
    laneTarget: 0,
    laneFloat: 0,
    laneVelocity: 0,
    turnQueue: [],

    elapsed: 0,
    distance: 0,
    scroll: 0,
    speed: MODE_SETTINGS[mode].baseSpeed,
    difficulty: 0,
    combo: 0,
    nearMisses: 0,
    collectibles: 0,
    speedTier: 0,
    bestCombo: 0,
    fxPulse: 0,
    hitFlash: 0,
    switchBlur: 0,

    visualSides: sideForDistance(mode, 0),
    lastPatternIndex: 0,
    hudCommit: 0,

    alive: true,

    inputLog: [],
    playbackQueue: playback && replayInputs ? replayInputs.slice() : null,
    playbackCursor: 0,

    rng,
  };

  for (let i = 0; i < ringCount; i += 1) {
    writeRing(world, i);
    world.nextRingId += 1;
  }

  return world;
};

export const getRingSlot = (world: OctaWorld, globalRingId: number) =>
  wrapIndex(globalRingId, world.ringCount);

export const getRingSides = (world: OctaWorld, globalRingId: number): ModeSides => {
  const slot = getRingSlot(world, globalRingId);
  const sides = world.ringSides[slot] as ModeSides | 0;
  if (sides === 6 || sides === 8 || sides === 10 || sides === 12) return sides;
  return 8;
};

export const getActiveSides = (world: OctaWorld) =>
  getRingSides(world, world.firstRingId + 3);

export const enqueueTurn = (
  world: OctaWorld,
  dir: TurnDirection,
  record = true
): boolean => {
  if (!world.alive) return false;
  if (world.turnQueue.length >= 6) return false;
  world.turnQueue.push(dir);
  if (record && !world.preview && !world.playbackQueue) {
    world.inputLog.push({ t: Number(world.elapsed.toFixed(5)), dir });
  }
  return true;
};

const laneBlocked = (mask: number, lane: number, sides: number) =>
  (mask & laneBit(lane, sides)) !== 0;

export const computeScore = (world: OctaWorld) =>
  Math.floor(
    world.distance * GAME_CONFIG.scoreDistanceFactor +
      world.nearMisses * GAME_CONFIG.scoreNearMissBonus +
      world.bestCombo * GAME_CONFIG.scoreComboBonus +
      world.collectibles * GAME_CONFIG.collectibleScoreBonus
  );

const consumePlaybackInputs = (world: OctaWorld) => {
  if (!world.playbackQueue) return;
  while (world.playbackCursor < world.playbackQueue.length) {
    const next = world.playbackQueue[world.playbackCursor];
    if (!next || next.t > world.elapsed + 1e-7) break;
    enqueueTurn(world, next.dir, false);
    world.playbackCursor += 1;
  }
};

export const stepWorld = (world: OctaWorld, dt: number): StepOutcome => {
  if (!world.alive) return { died: false, passed: 0 };

  consumePlaybackInputs(world);

  const activeSides = getActiveSides(world);
  world.lane = wrapIndex(world.lane, activeSides);
  world.laneTarget = wrapIndex(world.laneTarget, activeSides);

  let processedTurns = 0;
  while (world.turnQueue.length > 0 && processedTurns < 4) {
    const turn = world.turnQueue.shift();
    if (!turn) break;
    world.lane = wrapIndex(world.lane + turn, activeSides);
    world.laneTarget = world.lane;
    world.fxPulse = Math.min(1.15, world.fxPulse + 0.12);
    world.switchBlur = Math.min(1.2, world.switchBlur + 0.58);
    processedTurns += 1;
  }

  world.laneFloat = wrapFloat(world.laneFloat, activeSides);
  const turnDelta = shortestLaneDelta(world.laneFloat, world.laneTarget, activeSides);
  const follow = 1 - Math.exp(-58 * dt);
  world.laneFloat = wrapFloat(world.laneFloat + turnDelta * follow, activeSides);
  world.laneVelocity = lerp(
    world.laneVelocity,
    turnDelta * 26,
    1 - Math.exp(-24 * dt)
  );

  const settings = MODE_SETTINGS[world.mode];
  world.difficulty = clamp(world.distance / settings.rampDistance, 0, 1);
  world.speedTier = Math.floor(computeScore(world) / GAME_CONFIG.pointsPerSpeedTier);
  const targetSpeed =
    settings.baseSpeed +
    settings.bonusSpeed * world.difficulty +
    clamp(world.combo, 0, 24) * 0.05 +
    world.speedTier * GAME_CONFIG.speedTierBoost;
  world.speed = lerp(world.speed, targetSpeed, 1 - Math.exp(-2.7 * dt));

  world.elapsed += dt;
  world.distance += world.speed * dt;
  world.scroll = world.distance;

  world.visualSides = lerp(
    world.visualSides,
    getRingSides(world, world.firstRingId + 8),
    1 - Math.exp(-3.6 * dt)
  );

  world.fxPulse = Math.max(0, world.fxPulse - dt * 1.95);
  world.hitFlash = Math.max(0, world.hitFlash - dt * 4.7);
  world.switchBlur = Math.max(0, world.switchBlur - dt * 6.2);

  let passed = 0;
  const crossed = Math.floor(world.scroll / world.ringSpacing);

  while (world.firstRingId <= crossed) {
    const ringId = world.firstRingId;
    const slot = getRingSlot(world, ringId);
    const ringSides = world.ringSides[slot] || 8;
    let ringMask = world.ringMasks[slot] || 0;
    let collectibleMask = world.ringCollectibles[slot] || 0;
    world.lastPatternIndex = world.ringPattern[slot] ?? 0;

    const lane = wrapIndex(world.lane, ringSides);
    const hit = laneBlocked(ringMask, lane, ringSides);

    if (hit && !world.preview) {
      world.alive = false;
      world.hitFlash = 1;
      return { died: true, passed };
    }

    if (hit && world.preview) {
      ringMask = clearLane(ringMask, lane, ringSides);
      world.ringMasks[slot] = ringMask;
      world.bufferVersion += 1;
    }

    if ((collectibleMask & laneBit(lane, ringSides)) !== 0) {
      collectibleMask = clearLane(collectibleMask, lane, ringSides);
      world.ringCollectibles[slot] = collectibleMask;
      world.collectibles += 1;
      world.fxPulse = Math.min(1.35, world.fxPulse + 0.24);
      world.switchBlur = Math.min(1.2, world.switchBlur + 0.2);
      world.bufferVersion += 1;
    }

    const leftBlocked = laneBlocked(ringMask, lane - 1, ringSides);
    const rightBlocked = laneBlocked(ringMask, lane + 1, ringSides);
    if (leftBlocked || rightBlocked) {
      world.nearMisses += 1;
      world.combo += 1;
      world.fxPulse = Math.min(1.3, world.fxPulse + 0.12);
      world.hitFlash = Math.min(1.1, world.hitFlash + 0.07);
    } else {
      world.combo = Math.max(0, world.combo - 0.18);
    }

    world.bestCombo = Math.max(world.bestCombo, Math.floor(world.combo));

    world.firstRingId += 1;
    writeRing(world, world.nextRingId);
    world.nextRingId += 1;
    passed += 1;
  }

  return { died: false, passed };
};

export const getPlayerAngle = (world: OctaWorld) => {
  const sides = Math.max(3, getActiveSides(world));
  return (world.laneFloat / sides) * Math.PI * 2;
};

export const buildReplay = (
  world: OctaWorld,
  {
    score,
    mode,
    cameraMode,
    tileVariant,
    runnerShape,
    fxLevel,
  }: {
    score: number;
    mode: OctaReplay['mode'];
    cameraMode: OctaReplay['cameraMode'];
    tileVariant: OctaReplay['tileVariant'];
    runnerShape: OctaReplay['runnerShape'];
    fxLevel: OctaReplay['fxLevel'];
  }
): OctaReplay => ({
  v: 1,
  seed: world.seed,
  mode,
  cameraMode,
  tileVariant,
  runnerShape,
  fxLevel,
  createdAt: Date.now(),
  score: Math.max(0, Math.floor(score)),
  distance: Number(world.distance.toFixed(2)),
  bestCombo: Math.max(0, Math.floor(world.bestCombo)),
  collectibles: Math.max(0, Math.floor(world.collectibles)),
  inputs: world.inputLog.slice(),
});

export const getPatternName = (index: number) => {
  const pattern = OBSTACLE_PATTERNS[index] ?? OBSTACLE_PATTERNS[0];
  return pattern;
};
