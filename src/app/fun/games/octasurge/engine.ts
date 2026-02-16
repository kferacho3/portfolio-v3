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
  bestCombo: number;
  fxPulse: number;
  hitFlash: number;

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
    if (p < 0.36) return 0;
    if (p < 0.7) return 1;
    return 2;
  }
  if (difficulty < 0.58) {
    if (p < 0.2) return 0;
    if (p < 0.38) return 1;
    if (p < 0.58) return 2;
    if (p < 0.79) return 3;
    return 4;
  }
  if (p < 0.15) return 1;
  if (p < 0.31) return 2;
  if (p < 0.52) return 3;
  if (p < 0.74) return 4;
  return 5;
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

  const turnChance = 0.1 + difficulty * 0.32;
  let nextSafe = wrapIndex(world.safeLane, sides);
  if (world.rng() < turnChance) {
    const step = world.rng() < 0.75 ? 1 : 2;
    const dir = world.rng() < 0.5 ? -1 : 1;
    nextSafe = wrapIndex(nextSafe + step * dir, sides);
  }

  mask = clearLane(mask, world.safeLane, sides);
  mask = clearLane(mask, nextSafe, sides);

  if (difficulty < 0.45) {
    mask = clearLane(mask, world.safeLane + 1, sides);
    mask = clearLane(mask, world.safeLane - 1, sides);
  }

  if (world.rng() < 0.55) {
    mask = clearLane(mask, nextSafe + half, sides);
  }

  const blockedMin = Math.min(
    sides - 1,
    Math.floor(sides * (0.46 + difficulty * 0.35 + MODE_SETTINGS[world.mode].densityBias))
  );

  let guard = 0;
  while (popcount(mask) < blockedMin && guard < sides * 4) {
    guard += 1;
    const candidate = Math.floor(world.rng() * (sides / 2));
    const mirrored = candidate + half;
    if (candidate === nextSafe || mirrored === nextSafe) continue;
    if (candidate === world.safeLane || mirrored === world.safeLane) continue;
    mask = setLane(mask, candidate, sides);
    mask = setLane(mask, mirrored, sides);
  }

  if (mask === fullMask) {
    mask = clearLane(mask, nextSafe, sides);
  }

  world.previousSafeLane = world.safeLane;
  world.safeLane = nextSafe;

  return mask;
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

  world.ringIds[slot] = globalRingId;
  world.ringMasks[slot] = mask;
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
    bestCombo: 0,
    fxPulse: 0,
    hitFlash: 0,

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
      world.bestCombo * GAME_CONFIG.scoreComboBonus
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
  if (world.turnQueue.length > 0) {
    const turn = world.turnQueue.shift();
    if (turn) {
      world.laneTarget = wrapIndex(world.laneTarget + turn, activeSides);
      world.fxPulse = Math.min(1.15, world.fxPulse + 0.1);
    }
  }

  world.laneFloat = wrapFloat(world.laneFloat, activeSides);
  const turnForce = shortestLaneDelta(world.laneFloat, world.laneTarget, activeSides);
  world.laneVelocity += turnForce * 44 * dt;
  world.laneVelocity *= Math.exp(-12 * dt);
  world.laneFloat = wrapFloat(world.laneFloat + world.laneVelocity * dt, activeSides);
  world.lane = wrapIndex(Math.round(world.laneFloat), activeSides);

  const settings = MODE_SETTINGS[world.mode];
  world.difficulty = clamp(world.distance / settings.rampDistance, 0, 1);
  const targetSpeed =
    settings.baseSpeed +
    settings.bonusSpeed * world.difficulty +
    clamp(world.combo, 0, 24) * 0.11;
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

  let passed = 0;
  const crossed = Math.floor(world.scroll / world.ringSpacing);

  while (world.firstRingId <= crossed) {
    const ringId = world.firstRingId;
    const slot = getRingSlot(world, ringId);
    const ringSides = world.ringSides[slot] || 8;
    let ringMask = world.ringMasks[slot] || 0;
    world.lastPatternIndex = world.ringPattern[slot] ?? 0;

    const lane = wrapIndex(Math.round(world.laneFloat), ringSides);
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
  inputs: world.inputLog.slice(),
});

export const getPatternName = (index: number) => {
  const pattern = OBSTACLE_PATTERNS[index] ?? OBSTACLE_PATTERNS[0];
  return pattern;
};
