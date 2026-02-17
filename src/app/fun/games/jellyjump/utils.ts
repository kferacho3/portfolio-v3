import { SeededRandom } from '../../utils/seededRandom';
import {
  PLATFORM_ANIM_DURATION,
  PLATFORM_ANIM_MIN_DURATION,
  PLATFORM_ANIM_OSCILLATION,
  PLATFORM_CLOSED_PIECE_X,
  PLATFORM_OPEN_SLIDE_X,
  PLATFORM_PATTERN_SIZE,
  PLATFORM_PIECE_LENGTH,
  PLATFORM_ROTATE_OPEN_ANGLE,
  PLATFORM_ROTATE_PIVOT_X,
  PLATFORM_ROTATE_SOLID_ANGLE,
  PLATFORM_SPACING,
  LAVA_BASE_SPEED,
  LAVA_START_Y,
  LAVA_SPEED_PER_LEVEL,
  CORRIDOR_HALF_WIDTH,
  OBSTACLE_SPAWN_RATE,
  LEVER_SPAWN_RATE,
  BOOSTER_SPAWN_RATE,
  GEM_SPAWN_RATE,
  OBSTACLE_DRIFT_MIN,
  OBSTACLE_DRIFT_MAX,
  OBSTACLE_DRIFT_SPEED_MIN,
  OBSTACLE_DRIFT_SPEED_MAX,
  OBSTACLE_Z_WOBBLE,
  GEM_VALUE,
} from './constants';
import type {
  PlatformSide,
  PlatformPattern,
  PlatformPieceTransform,
  PlatformKind,
  ObstacleData,
  LeverData,
  BoosterData,
  GemData,
} from './types';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function generatePattern(
  seed: number,
  size: number = PLATFORM_PATTERN_SIZE
): PlatformPattern {
  const rng = new SeededRandom(seed);
  const platformKinds: PlatformKind[] = [];
  const activationTimes: number[] = [];
  const obstacles: ObstacleData[] = [];
  const levers: LeverData[] = [];
  const boosters: BoosterData[] = [];
  const gems: GemData[] = [];

  platformKinds.push('base');
  for (let i = 0; i < size; i += 1) {
    if (i === 0) continue;
    if (i < 4) {
      platformKinds.push(rng.bool(0.65) ? 'slide' : 'rotate');
      continue;
    }

    const difficulty = clamp01((i - 5) / 180);
    const roll = rng.random();
    const slideW = lerp(0.45, 0.3, difficulty);
    const rotateW = lerp(0.4, 0.24, difficulty);
    const irisW = lerp(0.05, 0.2, difficulty);
    const gearW = lerp(0.05, 0.18, difficulty);
    const membraneW = lerp(0.05, 0.08, difficulty);
    const total = slideW + rotateW + irisW + gearW + membraneW;

    let acc = slideW / total;
    if (roll < acc) {
      platformKinds.push('slide');
      continue;
    }
    acc += rotateW / total;
    if (roll < acc) {
      platformKinds.push('rotate');
      continue;
    }
    acc += irisW / total;
    if (roll < acc) {
      platformKinds.push('iris');
      continue;
    }
    acc += gearW / total;
    if (roll < acc) {
      platformKinds.push('gear');
      continue;
    }
    platformKinds.push('membrane');
  }

  activationTimes.push(0);
  activationTimes.push(3);
  for (let i = 2; i < size; i += 1) {
    const prev = activationTimes[i - 1];
    activationTimes.push(prev + rng.float(1.5, 3.5));
  }

  // Generate obstacles, levers, boosters, and gems (only after level 5 for difficulty)
  for (let i = 5; i < size; i += 1) {
    const difficulty = clamp01((i - 5) / 160);
    const obstacleRate = lerp(
      OBSTACLE_SPAWN_RATE,
      OBSTACLE_SPAWN_RATE + 0.16,
      difficulty
    );
    const leverRate = lerp(
      LEVER_SPAWN_RATE + 0.02,
      LEVER_SPAWN_RATE + 0.08,
      difficulty * 0.65
    );
    const boosterRate = lerp(
      BOOSTER_SPAWN_RATE,
      BOOSTER_SPAWN_RATE * 0.55,
      difficulty
    );
    const gemRate = lerp(GEM_SPAWN_RATE, GEM_SPAWN_RATE * 0.8, difficulty);

    // Levers (unlock next level). Keep lever rows clear from bombs for fairness.
    const hasLever = rng.random() < leverRate && i < size - 1;
    if (hasLever) {
      levers.push({
        rowIndex: i,
        x: rng.float(-2, 2),
        z: 0,
        targetRowIndex: i + 1, // unlocks next row
        activated: false,
      });
    }

    // Obstacles (bombs)
    if (!hasLever && rng.random() < obstacleRate) {
      obstacles.push({
        rowIndex: i,
        x: rng.float(-CORRIDOR_HALF_WIDTH + 1, CORRIDOR_HALF_WIDTH - 1),
        z: rng.float(-0.5, 0.5),
        type: 'bomb',
        driftAmp:
          rng.float(OBSTACLE_DRIFT_MIN, OBSTACLE_DRIFT_MAX) *
          lerp(0.7, 1.2, difficulty),
        driftSpeed:
          rng.float(OBSTACLE_DRIFT_SPEED_MIN, OBSTACLE_DRIFT_SPEED_MAX) *
          lerp(0.8, 1.4, difficulty),
        driftPhase: rng.float(0, Math.PI * 2),
      });
    }

    // Boosters
    if (rng.random() < boosterRate) {
      boosters.push({
        rowIndex: i,
        x: rng.float(-CORRIDOR_HALF_WIDTH + 1, CORRIDOR_HALF_WIDTH - 1),
        z: rng.float(-0.5, 0.5),
        type: rng.bool(0.6) ? 'levelSkip' : 'freeze',
        collected: false,
      });
    }

    // Gems (collectibles)
    if (rng.random() < gemRate) {
      gems.push({
        rowIndex: i,
        x: rng.float(-CORRIDOR_HALF_WIDTH + 1, CORRIDOR_HALF_WIDTH - 1),
        z: rng.float(-0.5, 0.5),
        collected: false,
        value: GEM_VALUE,
      });
    }
  }

  return {
    seed,
    platformKinds,
    activationTimes,
    obstacles,
    levers,
    boosters,
    gems,
  };
}

export function getPlatformKind(
  index: number,
  pattern: PlatformPattern
): PlatformKind {
  if (index <= 0) return 'base';
  return pattern.platformKinds[index % pattern.platformKinds.length] ?? 'slide';
}

export function getPlatformPieces(
  index: number,
  timeS: number,
  pattern: PlatformPattern
): {
  kind: PlatformKind;
  progress: number;
  pieces: [PlatformPieceTransform, PlatformPieceTransform];
} {
  const y = index * PLATFORM_SPACING;
  const kind = getPlatformKind(index, pattern);

  if (kind === 'base' || (kind !== 'slide' && kind !== 'rotate')) {
    // A fully closed stable platform at the start.
    return {
      kind,
      progress: 1,
      pieces: [
        { x: -PLATFORM_CLOSED_PIECE_X, y, z: 0, rotZ: 0, solid: true },
        { x: PLATFORM_CLOSED_PIECE_X, y, z: 0, rotZ: 0, solid: true },
      ],
    };
  }

  const activation =
    pattern.activationTimes[index % pattern.activationTimes.length];
  const rowDifficulty = clamp01((index - 5) / 160);
  const animDuration = lerp(
    PLATFORM_ANIM_DURATION,
    PLATFORM_ANIM_MIN_DURATION,
    rowDifficulty
  );
  const cycleRate = lerp(1, PLATFORM_ANIM_OSCILLATION, rowDifficulty * 0.7);
  const phase = Math.max(0, ((timeS - activation) / animDuration) * cycleRate);
  const wrapped = phase % 2;
  const t = wrapped <= 1 ? wrapped : 2 - wrapped;

  if (kind === 'slide') {
    const xL = lerp(-PLATFORM_OPEN_SLIDE_X, -PLATFORM_CLOSED_PIECE_X, t);
    const xR = lerp(PLATFORM_OPEN_SLIDE_X, PLATFORM_CLOSED_PIECE_X, t);
    return {
      kind,
      progress: t,
      pieces: [
        {
          x: xL,
          y,
          z: 0,
          rotZ: 0,
          side: 'left',
          solid: true,
        },
        {
          x: xR,
          y,
          z: 0,
          rotZ: 0,
          side: 'right',
          solid: true,
        },
      ],
    };
  }

  // rotate
  const angle = (1 - t) * PLATFORM_ROTATE_OPEN_ANGLE; // π/2 -> 0
  const half = PLATFORM_PIECE_LENGTH / 2;

  // Left piece pivots at (-PIVOT_X, y)
  const pivotLX = -PLATFORM_ROTATE_PIVOT_X;
  const left: PlatformPieceTransform = {
    x: pivotLX + Math.cos(angle) * half,
    y,
    z: Math.sin(angle) * half,
    rotY: -angle,
    rotZ: 0,
    side: 'left',
    solid: angle < PLATFORM_ROTATE_SOLID_ANGLE,
  };

  // Right piece pivots at (+PIVOT_X, y) and rotates symmetrically
  const pivotRX = PLATFORM_ROTATE_PIVOT_X;
  const right: PlatformPieceTransform = {
    x: pivotRX - Math.cos(angle) * half,
    y,
    z: -Math.sin(angle) * half,
    rotY: angle,
    rotZ: 0,
    side: 'right',
    solid: angle < PLATFORM_ROTATE_SOLID_ANGLE,
  };

  return { kind, progress: t, pieces: [left, right] };
}

export function getSlideGapWidth(
  index: number,
  timeS: number,
  pattern: PlatformPattern
) {
  const { pieces } = getPlatformPieces(index, timeS, pattern);
  const left = pieces[0];
  const right = pieces[1];
  const pieceHalf = PLATFORM_PIECE_LENGTH * 0.5;
  const gapLeft = left.x + pieceHalf;
  const gapRight = right.x - pieceHalf;
  return gapRight - gapLeft;
}

export function getLavaY(timeS: number, currentLevel: number): number {
  const speed = LAVA_BASE_SPEED + currentLevel * LAVA_SPEED_PER_LEVEL;
  return LAVA_START_Y + timeS * speed;
}

export function getObstaclePosition(obstacle: ObstacleData, timeS: number) {
  const drift =
    Math.sin(timeS * obstacle.driftSpeed + obstacle.driftPhase) *
    obstacle.driftAmp;
  const wobble =
    Math.cos(timeS * (obstacle.driftSpeed * 0.85) + obstacle.driftPhase) *
    OBSTACLE_Z_WOBBLE;
  const x = clamp(
    obstacle.x + drift,
    -CORRIDOR_HALF_WIDTH + 1,
    CORRIDOR_HALF_WIDTH - 1
  );
  const z = clamp(obstacle.z + wobble, -0.9, 0.9);
  return { x, z };
}

export function hashRow(seed: number, rowIndex: number, salt = 0) {
  let x = (seed ^ (rowIndex * 374761393) ^ (salt * 668265263)) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

export function rowRandom01(seed: number, rowIndex: number, salt = 0) {
  return hashRow(seed, rowIndex, salt) / 4294967295;
}

export function pickSignedSide(seed: number, rowIndex: number, salt = 0) {
  return rowRandom01(seed, rowIndex, salt) > 0.5 ? 1 : -1;
}

export function sideFromIndex(index: number): PlatformSide {
  return index % 2 === 0 ? 'left' : 'right';
}
