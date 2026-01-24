import { SeededRandom } from '../../utils/seededRandom';
import {
  PLATFORM_ANIM_DURATION,
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
  PlatformPattern,
  PlatformPieceTransform,
  PlatformKind,
  ObstacleData,
  LeverData,
  BoosterData,
  GemData,
} from './types';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function generatePattern(seed: number, size: number = PLATFORM_PATTERN_SIZE): PlatformPattern {
  const rng = new SeededRandom(seed);
  const types: boolean[] = [];
  const activationTimes: number[] = [];
  const obstacles: ObstacleData[] = [];
  const levers: LeverData[] = [];
  const boosters: BoosterData[] = [];
  const gems: GemData[] = [];

  // Mirror your pseudo code:
  // random[i] is 0/1 choice; rantimes starts [0,3], then increments by ~1.5..3.5
  for (let i = 0; i < size; i += 1) {
    types.push(rng.bool(0.5));
  }

  activationTimes.push(0);
  activationTimes.push(3);
  for (let i = 2; i < size; i += 1) {
    const prev = activationTimes[i - 1];
    activationTimes.push(prev + rng.float(1.5, 3.5));
  }

  // Generate obstacles, levers, boosters, and gems (only after level 5 for difficulty)
  for (let i = 5; i < size; i += 1) {
    const difficulty = clamp01((i - 5) / 120);
    const obstacleRate = lerp(OBSTACLE_SPAWN_RATE, OBSTACLE_SPAWN_RATE + 0.18, difficulty);
    const leverRate = lerp(LEVER_SPAWN_RATE, LEVER_SPAWN_RATE + 0.06, difficulty * 0.6);
    const boosterRate = lerp(BOOSTER_SPAWN_RATE, BOOSTER_SPAWN_RATE * 0.6, difficulty);
    const gemRate = lerp(GEM_SPAWN_RATE, GEM_SPAWN_RATE * 0.85, difficulty);
    
    // Obstacles (bombs)
    if (rng.float() < obstacleRate) {
      obstacles.push({
        rowIndex: i,
        x: rng.float(-CORRIDOR_HALF_WIDTH + 1, CORRIDOR_HALF_WIDTH - 1),
        z: rng.float(-0.5, 0.5),
        type: 'bomb',
        driftAmp: rng.float(OBSTACLE_DRIFT_MIN, OBSTACLE_DRIFT_MAX) * lerp(0.7, 1.2, difficulty),
        driftSpeed: rng.float(OBSTACLE_DRIFT_SPEED_MIN, OBSTACLE_DRIFT_SPEED_MAX) * lerp(0.8, 1.4, difficulty),
        driftPhase: rng.float(0, Math.PI * 2),
      });
    }
    
    // Levers (unlock next level)
    if (rng.float() < leverRate && i < size - 1) {
      levers.push({
        rowIndex: i,
        x: rng.float(-2, 2),
        z: 0,
        targetRowIndex: i + 1, // unlocks next row
        activated: false,
      });
    }
    
    // Boosters
    if (rng.float() < boosterRate) {
      boosters.push({
        rowIndex: i,
        x: rng.float(-CORRIDOR_HALF_WIDTH + 1, CORRIDOR_HALF_WIDTH - 1),
        z: rng.float(-0.5, 0.5),
        type: rng.bool(0.6) ? 'levelSkip' : 'freeze',
        collected: false,
      });
    }
    
    // Gems (collectibles)
    if (rng.float() < gemRate) {
      gems.push({
        rowIndex: i,
        x: rng.float(-CORRIDOR_HALF_WIDTH + 1, CORRIDOR_HALF_WIDTH - 1),
        z: rng.float(-0.5, 0.5),
        collected: false,
        value: GEM_VALUE,
      });
    }
  }

  return { seed, types, activationTimes, obstacles, levers, boosters, gems };
}

export function getPlatformKind(index: number, pattern: PlatformPattern): PlatformKind {
  if (index <= 0) return 'base';
  const isSlide = pattern.types[index % pattern.types.length];
  return isSlide ? 'slide' : 'rotate';
}

export function getPlatformPieces(
  index: number,
  timeS: number,
  pattern: PlatformPattern
): { kind: PlatformKind; pieces: [PlatformPieceTransform, PlatformPieceTransform] } {
  const y = index * PLATFORM_SPACING;
  const kind = getPlatformKind(index, pattern);

  if (kind === 'base') {
    // A fully closed stable platform at the start.
    return {
      kind,
      pieces: [
        { x: -PLATFORM_CLOSED_PIECE_X, y, z: 0, rotZ: 0, solid: true },
        { x: PLATFORM_CLOSED_PIECE_X, y, z: 0, rotZ: 0, solid: true },
      ],
    };
  }

  const activation = pattern.activationTimes[index % pattern.activationTimes.length];
  const t = clamp01((timeS - activation) / PLATFORM_ANIM_DURATION);

  if (kind === 'slide') {
    const xL = lerp(-PLATFORM_OPEN_SLIDE_X, -PLATFORM_CLOSED_PIECE_X, t);
    const xR = lerp(PLATFORM_OPEN_SLIDE_X, PLATFORM_CLOSED_PIECE_X, t);
    return {
      kind,
      pieces: [
        { x: xL, y, z: 0, rotZ: 0, solid: true },
        { x: xR, y, z: 0, rotZ: 0, solid: true },
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
    y: y + Math.sin(angle) * half,
    z: 0,
    rotZ: angle,
    solid: angle < PLATFORM_ROTATE_SOLID_ANGLE,
  };

  // Right piece pivots at (+PIVOT_X, y) and rotates symmetrically
  const pivotRX = PLATFORM_ROTATE_PIVOT_X;
  const right: PlatformPieceTransform = {
    x: pivotRX - Math.cos(angle) * half,
    y: y + Math.sin(angle) * half,
    z: 0,
    rotZ: -angle,
    solid: angle < PLATFORM_ROTATE_SOLID_ANGLE,
  };

  return { kind, pieces: [left, right] };
}

export function getLavaY(timeS: number, currentLevel: number): number {
  const speed = LAVA_BASE_SPEED + currentLevel * LAVA_SPEED_PER_LEVEL;
  return LAVA_START_Y + timeS * speed;
}

export function getObstaclePosition(obstacle: ObstacleData, timeS: number) {
  const drift = Math.sin(timeS * obstacle.driftSpeed + obstacle.driftPhase) * obstacle.driftAmp;
  const wobble = Math.cos(timeS * (obstacle.driftSpeed * 0.85) + obstacle.driftPhase) * OBSTACLE_Z_WOBBLE;
  const x = clamp(obstacle.x + drift, -CORRIDOR_HALF_WIDTH + 1, CORRIDOR_HALF_WIDTH - 1);
  const z = clamp(obstacle.z + wobble, -0.9, 0.9);
  return { x, z };
}
