import { SeededRandom } from '../../utils/seededRandom';
import type {
  BiomeId,
  ChunkDefinition,
  ObstacleSpawn,
  ObstacleType,
  PlatformSpawn,
  PlatformType,
} from './types';

export const CHUNK_LENGTH = 44;
export const SEGMENTS_PER_CHUNK = 9;
export const BOSS_INTERVAL = 7;

const LANE_X = [-2.3, 0, 2.3] as const;

const PLATFORM_POOL: PlatformType[] = [
  'standard',
  'moving_platform',
  'falling_platform',
  'conveyor_belt',
  'reverse_conveyor',
  'bouncer',
  'trampoline',
  'speed_ramp',
  'sticky_glue',
  'sinking_sand',
  'ghost_platform',
  'narrow_bridge',
  'slippery_ice',
  'teleporter',
  'weight_sensitive_bridge',
  'size_shifter_pad',
  'icy_half_pipe',
  'gravity_flip_zone',
  'treadmill_switch',
  'crushing_ceiling',
  'wind_tunnel',
];

const OBSTACLE_POOL: ObstacleType[] = [
  'mirror_maze_platform',
  'pulse_expander',
  'gravity_well',
  'snap_trap',
  'laser_grid',
  'rotating_floor_disk',
  'spike_wave',
  'split_path_bridge',
  'time_slow_zone',
  'bomb_tile',
  'anti_gravity_jump_pad',
  'shifting_tiles',
  'telefrag_portal',
  'magnetic_field',
  'rolling_boulder',
  'trapdoor_row',
  'rotating_cross_blades',
  'flicker_bridge',
  'rising_spike_columns',
  'meat_grinder',
  'homing_mine',
  'expand_o_matic',
  'pendulum_axes',
  'rising_lava',
  'fragile_glass',
  'lightning_striker',
];

const BASE_PLATFORM_WEIGHTS: Record<PlatformType, number> = {
  standard: 1.6,
  moving_platform: 0.6,
  falling_platform: 0.6,
  conveyor_belt: 0.45,
  reverse_conveyor: 0.32,
  bouncer: 0.4,
  trampoline: 0.3,
  speed_ramp: 0.24,
  sticky_glue: 0.28,
  sinking_sand: 0.3,
  ghost_platform: 0.24,
  narrow_bridge: 0.34,
  slippery_ice: 0.4,
  teleporter: 0.2,
  weight_sensitive_bridge: 0.23,
  size_shifter_pad: 0.22,
  icy_half_pipe: 0.14,
  gravity_flip_zone: 0.17,
  treadmill_switch: 0.22,
  crushing_ceiling: 0.2,
  wind_tunnel: 0.22,
};

const BASE_OBSTACLE_WEIGHTS: Record<ObstacleType, number> = {
  mirror_maze_platform: 0.23,
  pulse_expander: 0.28,
  gravity_well: 0.32,
  snap_trap: 0.3,
  laser_grid: 0.35,
  rotating_floor_disk: 0.26,
  spike_wave: 0.36,
  split_path_bridge: 0.28,
  time_slow_zone: 0.22,
  bomb_tile: 0.33,
  anti_gravity_jump_pad: 0.21,
  shifting_tiles: 0.29,
  telefrag_portal: 0.24,
  magnetic_field: 0.26,
  rolling_boulder: 0.26,
  trapdoor_row: 0.3,
  rotating_cross_blades: 0.34,
  flicker_bridge: 0.3,
  rising_spike_columns: 0.35,
  meat_grinder: 0.22,
  homing_mine: 0.2,
  expand_o_matic: 0.18,
  pendulum_axes: 0.24,
  rising_lava: 0.22,
  fragile_glass: 0.22,
  lightning_striker: 0.2,
};

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function hashChunkSeed(baseSeed: number, chunkIndex: number) {
  return (baseSeed ^ (chunkIndex * 0x45d9f3b)) >>> 0;
}

function laneX(index: number) {
  const lane = clamp(index, 0, LANE_X.length - 1);
  return LANE_X[lane];
}

function pickWeighted<T extends string>(
  rng: SeededRandom,
  pool: readonly T[],
  baseWeights: Record<T, number>,
  bonusWeights?: Partial<Record<T, number>>,
  difficulty = 1
): T {
  const weighted = pool.map((item) => {
    const base = baseWeights[item] ?? 0;
    const bonus = bonusWeights?.[item] ?? 0;
    return {
      item,
      weight: Math.max(0.01, base + bonus + difficulty * 0.015 * base),
    };
  });
  return rng.weighted(weighted);
}

function platformSizeFor(type: PlatformType): [number, number, number] {
  if (type === 'narrow_bridge') return [0.58, 0.4, 3.4];
  if (type === 'icy_half_pipe') return [2.4, 0.45, 3.7];
  if (type === 'weight_sensitive_bridge') return [2.2, 0.28, 3.2];
  if (type === 'crushing_ceiling') return [2.2, 0.4, 3.2];
  return [2, 0.45, 3.4];
}

function buildBossChunk(
  baseSeed: number,
  chunkIndex: number,
  biome: BiomeId,
  difficulty: number
): ChunkDefinition {
  const rng = new SeededRandom(hashChunkSeed(baseSeed, chunkIndex));
  const startZ = -chunkIndex * CHUNK_LENGTH;
  const platforms: PlatformSpawn[] = [];
  const obstacles: ObstacleSpawn[] = [];
  const segmentStep = CHUNK_LENGTH / SEGMENTS_PER_CHUNK;

  for (let i = 0; i < SEGMENTS_PER_CHUNK; i += 1) {
    const z = startZ - i * segmentStep - segmentStep * 0.5;
    platforms.push({
      id: `boss-${chunkIndex}-platform-${i}`,
      type: i % 2 === 0 ? 'moving_platform' : 'standard',
      position: [0, 0, z],
      size: [5.8, 0.46, 3.8],
      lane: 1,
      props: {
        speed: 0.7 + i * 0.06,
        amplitude: 1.2,
      },
    });

    const lane = i % 3;
    const ox = laneX(lane);
    const scripted: ObstacleType[] = [
      'rotating_cross_blades',
      'meat_grinder',
      'rising_lava',
      'lightning_striker',
      'pendulum_axes',
      'trapdoor_row',
      'spike_wave',
      'laser_grid',
      'rolling_boulder',
    ];
    const type = scripted[i % scripted.length];
    obstacles.push({
      id: `boss-${chunkIndex}-obstacle-${i}`,
      type,
      position: [ox, 1, z],
      size: [1.5, 1.5, 1.5],
      lane,
      props: {
        speed: 1.4 + difficulty * 0.16,
        phase: rng.float(0, Math.PI * 2),
        severity: 1 + difficulty * 0.04,
      },
    });
  }

  return {
    id: `chunk-${chunkIndex}`,
    index: chunkIndex,
    biome,
    difficulty,
    startZ,
    length: CHUNK_LENGTH,
    isBoss: true,
    platforms,
    obstacles,
  };
}

export function buildChunk(
  baseSeed: number,
  chunkIndex: number,
  biome: BiomeId,
  difficulty: number,
  biomeObstacleBonus: Partial<Record<ObstacleType, number>> = {}
): ChunkDefinition {
  if (chunkIndex > 0 && chunkIndex % BOSS_INTERVAL === 0) {
    return buildBossChunk(baseSeed, chunkIndex, biome, difficulty);
  }

  const rng = new SeededRandom(hashChunkSeed(baseSeed, chunkIndex));
  const startZ = -chunkIndex * CHUNK_LENGTH;
  const platforms: PlatformSpawn[] = [];
  const obstacles: ObstacleSpawn[] = [];
  const segmentStep = CHUNK_LENGTH / SEGMENTS_PER_CHUNK;

  let lane = rng.int(0, 2);

  for (let i = 0; i < SEGMENTS_PER_CHUNK; i += 1) {
    const z = startZ - i * segmentStep - segmentStep * 0.5;

    if (i > 0 && rng.bool(0.42)) {
      lane += rng.bool(0.5) ? -1 : 1;
      lane = clamp(lane, 0, 2);
    }

    const pType = pickWeighted(
      rng,
      PLATFORM_POOL,
      BASE_PLATFORM_WEIGHTS,
      undefined,
      difficulty
    );

    const platform: PlatformSpawn = {
      id: `chunk-${chunkIndex}-platform-${i}`,
      type: pType,
      position: [laneX(lane), 0, z],
      size: platformSizeFor(pType),
      lane,
      props: {
        speed: 0.75 + difficulty * 0.09,
        amplitude: 1 + difficulty * 0.03,
        shift: rng.float(-1.2, 1.2),
        triggerDelay: 0.25 + rng.float(0, 0.35),
      },
    };

    if (pType === 'teleporter') {
      platform.props = {
        ...platform.props,
        targetX: laneX(clamp(lane + (rng.bool(0.5) ? 1 : -1), 0, 2)),
        targetY: 1.7,
        targetZ: z - segmentStep * (rng.bool(0.5) ? 1.5 : 2.5),
      };
    }

    if (pType === 'narrow_bridge') {
      platform.size = [0.62, 0.4, 3.4];
    }

    platforms.push(platform);

    if (i < 2) continue;

    const obstacleChance = clamp(0.48 + difficulty * 0.03, 0.42, 0.8);
    if (!rng.bool(obstacleChance)) continue;

    const oType = pickWeighted(
      rng,
      OBSTACLE_POOL,
      BASE_OBSTACLE_WEIGHTS,
      biomeObstacleBonus,
      difficulty
    );

    const obstacle: ObstacleSpawn = {
      id: `chunk-${chunkIndex}-obstacle-${i}`,
      type: oType,
      position: [laneX(lane), 1, z],
      size: [1.6, 1.6, 1.6],
      lane,
      props: {
        speed: 0.8 + difficulty * 0.16,
        amplitude: 0.8 + difficulty * 0.06,
        phase: rng.float(0, Math.PI * 2),
        interval: clamp(1.9 - difficulty * 0.08, 0.7, 2.2),
        safeLane: rng.int(0, 2),
      },
    };

    obstacles.push(obstacle);

    if (oType === 'split_path_bridge') {
      const safeLane = Number(obstacle.props?.safeLane ?? lane);
      const leftLane = 0;
      const rightLane = 2;
      platforms.push({
        id: `chunk-${chunkIndex}-split-left-${i}`,
        type: 'narrow_bridge',
        position: [laneX(leftLane), 0, z + 0.2],
        size: [0.55, 0.36, 3.8],
        lane: leftLane,
        props: { safe: safeLane === leftLane },
      });
      platforms.push({
        id: `chunk-${chunkIndex}-split-right-${i}`,
        type: 'narrow_bridge',
        position: [laneX(rightLane), 0, z - 0.2],
        size: [0.55, 0.36, 3.8],
        lane: rightLane,
        props: { safe: safeLane === rightLane },
      });
    }
  }

  return {
    id: `chunk-${chunkIndex}`,
    index: chunkIndex,
    biome,
    difficulty,
    startZ,
    length: CHUNK_LENGTH,
    isBoss: false,
    platforms,
    obstacles,
  };
}
