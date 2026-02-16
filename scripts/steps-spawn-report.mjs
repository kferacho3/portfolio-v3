#!/usr/bin/env node

/*
 * Steps spawn-frequency report
 *
 * Usage:
 *   npm run steps:spawn-report
 *   npm run steps:spawn-report -- --runs=5000 --tiles=50,150,300,600 --top=8
 *   npm run steps:spawn-report -- --json
 */

const DEFAULT_RUNS = 20000;
const DEFAULT_TILES = [50, 150, 300, 600];
const DEFAULT_TOP = 10;
const OBSTACLE_WINDOW_SIZE = 10;
const MIN_OBSTACLES_PER_WINDOW = 2;
const OBSTACLE_RULE_START_INDEX = 20;
const RELIEF_WINDOW_START_INDEX = 160;
const RELIEF_WINDOW_MIN_GAP = 8;
const RELIEF_WINDOW_CHANCE = 0.035;

const PLATFORM_POOL = [
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

const HAZARD_POOL = [
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
  'rotating_hammer',
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

const SPIKE_HAZARDS = new Set(['spike_wave', 'rising_spike_columns', 'trapdoor_row', 'bomb_tile']);
const SAW_HAZARDS = new Set([
  'rotating_floor_disk',
  'rotating_hammer',
  'rotating_cross_blades',
  'rolling_boulder',
  'meat_grinder',
  'homing_mine',
]);
const CLAMP_HAZARDS = new Set(['laser_grid', 'lightning_striker', 'magnetic_field', 'gravity_well']);
const SWING_HAZARDS = new Set([
  'mirror_maze_platform',
  'pulse_expander',
  'snap_trap',
  'split_path_bridge',
  'time_slow_zone',
  'anti_gravity_jump_pad',
  'shifting_tiles',
  'telefrag_portal',
  'flicker_bridge',
  'expand_o_matic',
  'pendulum_axes',
  'rising_lava',
  'fragile_glass',
]);

const PLATFORM_TRAP_SET = new Set([
  'falling_platform',
  'sinking_sand',
  'ghost_platform',
  'weight_sensitive_bridge',
  'crushing_ceiling',
]);

const READABLE_EFFECT_HAZARDS = new Set([
  'mirror_maze_platform',
  'pulse_expander',
  'gravity_well',
  'split_path_bridge',
  'time_slow_zone',
  'anti_gravity_jump_pad',
  'shifting_tiles',
  'flicker_bridge',
  'expand_o_matic',
]);

const HEAVY_CHAOS_HAZARDS = new Set([
  'rising_lava',
  'meat_grinder',
  'lightning_striker',
  'rotating_cross_blades',
  'pendulum_axes',
  'homing_mine',
  'rolling_boulder',
]);

const LETHAL_HAZARDS = new Set([
  'laser_grid',
  'rotating_floor_disk',
  'spike_wave',
  'bomb_tile',
  'rotating_hammer',
  'rolling_boulder',
  'trapdoor_row',
  'rotating_cross_blades',
  'rising_spike_columns',
  'meat_grinder',
  'homing_mine',
  'pendulum_axes',
  'rising_lava',
  'fragile_glass',
  'lightning_striker',
  'snap_trap',
]);

const PLATFORM_UNLOCK_AT = {
  standard: 0,
  moving_platform: 10,
  falling_platform: 30,
  conveyor_belt: 18,
  reverse_conveyor: 62,
  bouncer: 12,
  trampoline: 20,
  speed_ramp: 28,
  sticky_glue: 80,
  sinking_sand: 130,
  ghost_platform: 74,
  narrow_bridge: 40,
  slippery_ice: 48,
  teleporter: 90,
  weight_sensitive_bridge: 116,
  size_shifter_pad: 150,
  icy_half_pipe: 104,
  gravity_flip_zone: 138,
  treadmill_switch: 120,
  crushing_ceiling: 178,
  wind_tunnel: 96,
};

const HAZARD_UNLOCK_AT = {
  mirror_maze_platform: 14,
  pulse_expander: 18,
  gravity_well: 24,
  snap_trap: 58,
  laser_grid: 74,
  rotating_floor_disk: 70,
  spike_wave: 52,
  split_path_bridge: 32,
  time_slow_zone: 28,
  bomb_tile: 84,
  rotating_hammer: 64,
  anti_gravity_jump_pad: 36,
  shifting_tiles: 42,
  telefrag_portal: 92,
  magnetic_field: 88,
  rolling_boulder: 98,
  trapdoor_row: 80,
  rotating_cross_blades: 116,
  flicker_bridge: 46,
  rising_spike_columns: 110,
  meat_grinder: 156,
  homing_mine: 132,
  expand_o_matic: 124,
  pendulum_axes: 148,
  rising_lava: 168,
  fragile_glass: 104,
  lightning_striker: 140,
};

class SeededRandom {
  constructor(seed = 1) {
    this.rng = this.#mulberry32(seed >>> 0);
  }

  #mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  bool(probability = 0.5) {
    return this.rng() < probability;
  }

  int(min, max) {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  weighted(items) {
    const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
    let r = this.rng() * totalWeight;

    for (const { item, weight } of items) {
      r -= weight;
      if (r <= 0) return item;
    }

    return items[items.length - 1].item;
  }
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function spawnTierForIndex(index) {
  if (index < 34) return 'intro';
  if (index < 130) return 'early';
  if (index < 300) return 'mid';
  if (index < 520) return 'late';
  return 'chaos';
}

function sameHazardFamily(a, b) {
  if (a === 'none' || b === 'none') return false;
  return (
    (SPIKE_HAZARDS.has(a) && SPIKE_HAZARDS.has(b)) ||
    (SAW_HAZARDS.has(a) && SAW_HAZARDS.has(b)) ||
    (CLAMP_HAZARDS.has(a) && CLAMP_HAZARDS.has(b)) ||
    (SWING_HAZARDS.has(a) && SWING_HAZARDS.has(b))
  );
}

function platformTierWeight(kind, tier) {
  if (tier === 'intro') {
    if (kind === 'standard') return 5.2;
    if (kind === 'moving_platform') return 1.25;
    if (kind === 'conveyor_belt') return 0.72;
    if (kind === 'bouncer') return 0.62;
    if (kind === 'trampoline') return 0.44;
    if (kind === 'speed_ramp') return 0.36;
    return 0;
  }

  if (tier === 'early') {
    if (kind === 'standard') return 2.9;
    if (kind === 'moving_platform') return 1.45;
    if (kind === 'conveyor_belt') return 1.02;
    if (kind === 'bouncer') return 1.06;
    if (kind === 'trampoline') return 0.82;
    if (kind === 'speed_ramp') return 0.78;
    if (kind === 'narrow_bridge') return 0.56;
    if (kind === 'slippery_ice') return 0.46;
    if (kind === 'falling_platform') return 0.32;
    if (kind === 'reverse_conveyor') return 0.34;
    if (kind === 'teleporter') return 0.34;
    if (kind === 'wind_tunnel') return 0.34;
    if (kind === 'ghost_platform') return 0.22;
    if (kind === 'sticky_glue') return 0.24;
    if (kind === 'icy_half_pipe') return 0.22;
    if (kind === 'treadmill_switch') return 0.2;
    return 0;
  }

  if (tier === 'mid') {
    if (kind === 'standard') return 1.9;
    if (kind === 'moving_platform') return 1.34;
    if (kind === 'falling_platform') return 0.82;
    if (kind === 'conveyor_belt') return 0.92;
    if (kind === 'reverse_conveyor') return 0.74;
    if (kind === 'bouncer') return 0.88;
    if (kind === 'trampoline') return 0.72;
    if (kind === 'speed_ramp') return 0.74;
    if (kind === 'sticky_glue') return 0.62;
    if (kind === 'sinking_sand') return 0.42;
    if (kind === 'ghost_platform') return 0.62;
    if (kind === 'narrow_bridge') return 0.72;
    if (kind === 'slippery_ice') return 0.66;
    if (kind === 'teleporter') return 0.58;
    if (kind === 'weight_sensitive_bridge') return 0.46;
    if (kind === 'size_shifter_pad') return 0.42;
    if (kind === 'icy_half_pipe') return 0.54;
    if (kind === 'gravity_flip_zone') return 0.36;
    if (kind === 'treadmill_switch') return 0.54;
    if (kind === 'crushing_ceiling') return 0.3;
    if (kind === 'wind_tunnel') return 0.58;
    return 0;
  }

  if (tier === 'late') {
    if (kind === 'standard') return 1.24;
    if (kind === 'moving_platform') return 1.18;
    if (kind === 'falling_platform') return 0.96;
    if (kind === 'conveyor_belt') return 0.82;
    if (kind === 'reverse_conveyor') return 0.84;
    if (kind === 'bouncer') return 0.66;
    if (kind === 'trampoline') return 0.6;
    if (kind === 'speed_ramp') return 0.7;
    if (kind === 'sticky_glue') return 0.76;
    if (kind === 'sinking_sand') return 0.72;
    if (kind === 'ghost_platform') return 0.84;
    if (kind === 'narrow_bridge') return 0.86;
    if (kind === 'slippery_ice') return 0.84;
    if (kind === 'teleporter') return 0.84;
    if (kind === 'weight_sensitive_bridge') return 0.76;
    if (kind === 'size_shifter_pad') return 0.7;
    if (kind === 'icy_half_pipe') return 0.76;
    if (kind === 'gravity_flip_zone') return 0.68;
    if (kind === 'treadmill_switch') return 0.74;
    if (kind === 'crushing_ceiling') return 0.64;
    if (kind === 'wind_tunnel') return 0.74;
    return 0;
  }

  if (kind === 'standard') return 1.05;
  if (kind === 'moving_platform') return 1.02;
  if (kind === 'falling_platform') return 1.06;
  if (kind === 'conveyor_belt') return 0.72;
  if (kind === 'reverse_conveyor') return 0.92;
  if (kind === 'bouncer') return 0.56;
  if (kind === 'trampoline') return 0.5;
  if (kind === 'speed_ramp') return 0.64;
  if (kind === 'sticky_glue') return 0.84;
  if (kind === 'sinking_sand') return 0.84;
  if (kind === 'ghost_platform') return 0.94;
  if (kind === 'narrow_bridge') return 0.95;
  if (kind === 'slippery_ice') return 0.9;
  if (kind === 'teleporter') return 0.96;
  if (kind === 'weight_sensitive_bridge') return 0.88;
  if (kind === 'size_shifter_pad') return 0.82;
  if (kind === 'icy_half_pipe') return 0.84;
  if (kind === 'gravity_flip_zone') return 0.88;
  if (kind === 'treadmill_switch') return 0.84;
  if (kind === 'crushing_ceiling') return 0.92;
  if (kind === 'wind_tunnel') return 0.84;
  return 0;
}

function hazardTierWeight(kind, tier) {
  if (tier === 'intro') return 0;
  if (tier === 'early') {
    if (READABLE_EFFECT_HAZARDS.has(kind)) return 1.06;
    if (HEAVY_CHAOS_HAZARDS.has(kind)) return 0.14;
    if (kind === 'snap_trap' || kind === 'trapdoor_row' || kind === 'bomb_tile') return 0.36;
    return 0.62;
  }
  if (tier === 'mid') {
    if (READABLE_EFFECT_HAZARDS.has(kind)) return 0.94;
    if (HEAVY_CHAOS_HAZARDS.has(kind)) return 0.48;
    return 0.82;
  }
  if (tier === 'late') {
    if (READABLE_EFFECT_HAZARDS.has(kind)) return 0.86;
    if (HEAVY_CHAOS_HAZARDS.has(kind)) return 0.82;
    return 0.94;
  }
  if (READABLE_EFFECT_HAZARDS.has(kind)) return 0.78;
  if (HEAVY_CHAOS_HAZARDS.has(kind)) return 1.06;
  return 0.98;
}

function hazardIndividualBias(kind) {
  if (kind === 'mirror_maze_platform' || kind === 'time_slow_zone' || kind === 'split_path_bridge') return 1.12;
  if (kind === 'laser_grid' || kind === 'spike_wave' || kind === 'rotating_floor_disk') return 1.04;
  if (kind === 'rising_lava' || kind === 'meat_grinder' || kind === 'lightning_striker') return 0.72;
  if (kind === 'homing_mine' || kind === 'pendulum_axes' || kind === 'rotating_cross_blades') return 0.9;
  return 1;
}

function isHazardCompatible(platform, hazard, index) {
  if (hazard === 'none') return true;
  const tier = spawnTierForIndex(index);
  const isTrapPlatform =
    platform === 'ghost_platform' ||
    platform === 'crushing_ceiling' ||
    platform === 'falling_platform' ||
    platform === 'weight_sensitive_bridge';

  if (isTrapPlatform && LETHAL_HAZARDS.has(hazard) && tier !== 'chaos') return false;
  if (platform === 'narrow_bridge' && (HEAVY_CHAOS_HAZARDS.has(hazard) || hazard === 'laser_grid') && tier !== 'chaos') return false;
  if (platform === 'sticky_glue' && (hazard === 'gravity_well' || hazard === 'time_slow_zone')) return false;
  if (platform === 'teleporter' && hazard === 'telefrag_portal' && tier !== 'chaos') return false;
  return true;
}

function pickPlatform(index, rng, inBonus, previousPlatform) {
  if (index < 8) return 'standard';
  if (inBonus) {
    return rng.weighted([
      { item: 'standard', weight: 0.3 },
      { item: 'speed_ramp', weight: 0.24 },
      { item: 'bouncer', weight: 0.22 },
      { item: 'trampoline', weight: 0.12 },
      { item: 'conveyor_belt', weight: 0.08 },
      { item: 'moving_platform', weight: 0.04 },
    ]);
  }

  const tier = spawnTierForIndex(index);
  const tierDifficulty = clamp(index / 620, 0, 1);
  const weighted = [];

  for (const item of PLATFORM_POOL) {
    if (index < PLATFORM_UNLOCK_AT[item]) continue;
    let weight = platformTierWeight(item, tier);
    if (weight <= 0) continue;

    if (previousPlatform && previousPlatform === item && item !== 'standard') {
      weight *= tier === 'intro' || tier === 'early' ? 0.24 : tier === 'mid' ? 0.38 : 0.5;
    }

    if (PLATFORM_TRAP_SET.has(item) && (tier === 'intro' || tier === 'early')) {
      weight *= 0.74;
    }

    weight *= lerp(0.92, 1.1, tierDifficulty);
    weighted.push({ item, weight });
  }

  if (weighted.length === 0) return 'standard';
  return rng.weighted(weighted);
}

function pickHazard(index, rng, streak, inBonus, previousHazard, reliefWindow = false) {
  if (index < 14) return 'none';

  const tier = spawnTierForIndex(index);
  const allowedConsecutive = reliefWindow ? 1 : tier === 'chaos' ? 3 : tier === 'late' ? 2 : tier === 'mid' ? 2 : 1;
  if (streak >= allowedConsecutive) return 'none';

  let hazardChance = 0;
  if (tier === 'early') hazardChance = clamp(0.12 + (index - 34) * 0.0013, 0.12, 0.24);
  else if (tier === 'mid') hazardChance = clamp(0.28 + (index - 130) * 0.00065, 0.28, 0.4);
  else if (tier === 'late') hazardChance = clamp(0.4 + (index - 300) * 0.0005, 0.4, 0.52);
  else if (tier === 'chaos') hazardChance = clamp(0.52 + (index - 520) * 0.0003, 0.52, 0.62);

  if (inBonus) hazardChance *= 0.46;
  if (reliefWindow) hazardChance *= 0.28;

  if (hazardChance <= 0 || !rng.bool(hazardChance)) return 'none';

  const progression = clamp(index / 620, 0, 1);
  const weighted = [];
  for (const item of HAZARD_POOL) {
    if (index < HAZARD_UNLOCK_AT[item]) continue;

    let weight = hazardTierWeight(item, tier);
    if (weight <= 0) continue;

    weight *= hazardIndividualBias(item);

    if (previousHazard !== 'none' && previousHazard === item) {
      weight *= tier === 'chaos' ? 0.52 : 0.22;
    } else if (sameHazardFamily(item, previousHazard)) {
      weight *= tier === 'chaos' ? 0.82 : 0.54;
    }

    weight *= lerp(0.94, 1.08, progression);
    weighted.push({ item, weight });
  }

  if (weighted.length === 0) return 'none';
  return rng.weighted(weighted);
}

function pickForcedHazard(index, rng, previousHazard, platform) {
  const tier = spawnTierForIndex(index);
  const progression = clamp(index / 620, 0, 1);
  const weighted = [];

  for (const item of HAZARD_POOL) {
    if (index < HAZARD_UNLOCK_AT[item]) continue;
    if (!isHazardCompatible(platform, item, index)) continue;

    let weight = Math.max(0.16, hazardTierWeight(item, tier));
    weight *= hazardIndividualBias(item);

    if (previousHazard !== 'none' && previousHazard === item) {
      weight *= 0.42;
    } else if (sameHazardFamily(item, previousHazard)) {
      weight *= 0.72;
    }

    weight *= lerp(0.96, 1.12, progression);
    weighted.push({ item, weight });
  }

  if (weighted.length === 0) return 'none';
  return rng.weighted(weighted);
}

function parseArgs(argv) {
  const parsed = {
    runs: DEFAULT_RUNS,
    tiles: DEFAULT_TILES,
    top: DEFAULT_TOP,
    json: false,
  };

  for (const arg of argv) {
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg.startsWith('--runs=')) {
      const v = Number(arg.slice('--runs='.length));
      if (Number.isFinite(v) && v > 0) parsed.runs = Math.floor(v);
      continue;
    }
    if (arg.startsWith('--top=')) {
      const v = Number(arg.slice('--top='.length));
      if (Number.isFinite(v) && v > 0) parsed.top = Math.floor(v);
      continue;
    }
    if (arg.startsWith('--tiles=')) {
      const tiles = arg
        .slice('--tiles='.length)
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value >= 0)
        .map((value) => Math.floor(value));
      if (tiles.length > 0) parsed.tiles = Array.from(new Set(tiles)).sort((a, b) => a - b);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
}

function topEntries(map, limit, includeNone = true) {
  return [...map.entries()]
    .filter(([key]) => (includeNone ? true : key !== 'none'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function percent(count, total) {
  return `${((count / total) * 100).toFixed(1)}%`;
}

function runReport({ runs, tiles, top, json }) {
  const maxTile = Math.max(...tiles);
  const sampleSet = new Set(tiles);
  const report = {};
  const windowPolicy = {
    considered: 0,
    reliefWindows: 0,
    belowMinimum: 0,
    zeroObstacleWindows: 0,
  };

  for (const tile of tiles) {
    report[tile] = {
      tier: spawnTierForIndex(tile),
      hazardRateCount: 0,
      platformCounts: new Map(),
      hazardCounts: new Map(),
    };
  }

  for (let seed = 1; seed <= runs; seed += 1) {
    const rng = new SeededRandom((seed * 2654435761) >>> 0);

    let bonusTilesLeft = 0;
    let hazardStreak = 0;
    let previousPlatform = 'standard';
    let previousHazard = 'none';
    let obstacleWindowId = -1;
    let obstacleWindowObstacleCount = 0;
    let obstacleWindowRelief = false;
    let lastReliefWindowId = -999;
    let trackedWindowId = -1;
    let trackedWindowObstacleCount = 0;
    let trackedWindowRelief = false;

    for (let index = 0; index <= maxTile; index += 1) {
      if (bonusTilesLeft <= 0 && index > 28 && index % 70 === 0 && rng.bool(0.5)) {
        bonusTilesLeft = rng.int(10, 16);
      }

      const inBonus = bonusTilesLeft > 0;
      if (inBonus) bonusTilesLeft -= 1;

      const windowId = Math.floor(index / OBSTACLE_WINDOW_SIZE);
      if (windowId !== obstacleWindowId) {
        if (trackedWindowId >= 0 && trackedWindowId * OBSTACLE_WINDOW_SIZE >= OBSTACLE_RULE_START_INDEX) {
          windowPolicy.considered += 1;
          if (trackedWindowRelief) windowPolicy.reliefWindows += 1;
          if (trackedWindowObstacleCount === 0) windowPolicy.zeroObstacleWindows += 1;
          if (!trackedWindowRelief && trackedWindowObstacleCount < MIN_OBSTACLES_PER_WINDOW) {
            windowPolicy.belowMinimum += 1;
          }
        }

        obstacleWindowId = windowId;
        obstacleWindowObstacleCount = 0;

        const canRelief =
          index >= RELIEF_WINDOW_START_INDEX &&
          windowId - lastReliefWindowId >= RELIEF_WINDOW_MIN_GAP &&
          rng.bool(RELIEF_WINDOW_CHANCE);
        obstacleWindowRelief = canRelief;
        if (canRelief) lastReliefWindowId = windowId;

        trackedWindowId = windowId;
        trackedWindowObstacleCount = 0;
        trackedWindowRelief = obstacleWindowRelief;
      }

      const windowOffset = index - windowId * OBSTACLE_WINDOW_SIZE;
      const remainingSlots = OBSTACLE_WINDOW_SIZE - windowOffset;
      const requiredObstacles =
        index >= OBSTACLE_RULE_START_INDEX && !obstacleWindowRelief ? MIN_OBSTACLES_PER_WINDOW : 0;
      const missingObstacles = Math.max(0, requiredObstacles - obstacleWindowObstacleCount);
      const mustSpawnObstacle = missingObstacles > 0 && remainingSlots <= missingObstacles + 1;

      const platform = pickPlatform(index, rng, inBonus, previousPlatform);
      let hazard = pickHazard(index, rng, hazardStreak, inBonus, previousHazard, obstacleWindowRelief);
      if (mustSpawnObstacle && hazard === 'none') {
        hazard = pickForcedHazard(index, rng, previousHazard, platform);
      }
      if (!isHazardCompatible(platform, hazard, index)) hazard = 'none';
      if (mustSpawnObstacle && hazard === 'none') {
        hazard = pickForcedHazard(index, rng, previousHazard, platform);
      }
      if (mustSpawnObstacle && hazard === 'none') {
        const fallback = HAZARD_POOL.find((item) => index >= HAZARD_UNLOCK_AT[item] && isHazardCompatible(platform, item, index));
        if (fallback) hazard = fallback;
      }
      if (mustSpawnObstacle && hazard === 'none') {
        const emergency = HAZARD_POOL.find((item) => index >= HAZARD_UNLOCK_AT[item]);
        if (emergency) hazard = emergency;
      }

      if (hazard === 'none') hazardStreak = 0;
      else {
        hazardStreak += 1;
        obstacleWindowObstacleCount += 1;
        trackedWindowObstacleCount += 1;
      }

      if (sampleSet.has(index)) {
        const entry = report[index];
        entry.platformCounts.set(platform, (entry.platformCounts.get(platform) ?? 0) + 1);
        entry.hazardCounts.set(hazard, (entry.hazardCounts.get(hazard) ?? 0) + 1);
        if (hazard !== 'none') entry.hazardRateCount += 1;
      }

      previousPlatform = platform;
      previousHazard = hazard;
    }

    if (trackedWindowId >= 0 && trackedWindowId * OBSTACLE_WINDOW_SIZE >= OBSTACLE_RULE_START_INDEX) {
      const windowIsComplete = (trackedWindowId + 1) * OBSTACLE_WINDOW_SIZE - 1 <= maxTile;
      if (windowIsComplete) {
        windowPolicy.considered += 1;
        if (trackedWindowRelief) windowPolicy.reliefWindows += 1;
        if (trackedWindowObstacleCount === 0) windowPolicy.zeroObstacleWindows += 1;
        if (!trackedWindowRelief && trackedWindowObstacleCount < MIN_OBSTACLES_PER_WINDOW) {
          windowPolicy.belowMinimum += 1;
        }
      }
    }
  }

  if (json) {
    const payload = {
      runs,
      tiles,
      generatedAt: new Date().toISOString(),
      windowPolicy: {
        considered: windowPolicy.considered,
        reliefWindows: windowPolicy.reliefWindows,
        belowMinimum: windowPolicy.belowMinimum,
        zeroObstacleWindows: windowPolicy.zeroObstacleWindows,
        reliefPct: Number(((windowPolicy.reliefWindows / Math.max(1, windowPolicy.considered)) * 100).toFixed(2)),
        zeroWindowPct: Number(((windowPolicy.zeroObstacleWindows / Math.max(1, windowPolicy.considered)) * 100).toFixed(2)),
      },
      samples: tiles.map((tile) => {
        const entry = report[tile];
        return {
          tile,
          tier: entry.tier,
          hazardRatePct: Number(((entry.hazardRateCount / runs) * 100).toFixed(2)),
          topPlatforms: topEntries(entry.platformCounts, top).map(([name, count]) => ({
            name,
            pct: Number(((count / runs) * 100).toFixed(2)),
          })),
          topHazards: topEntries(entry.hazardCounts, top).map(([name, count]) => ({
            name,
            pct: Number(((count / runs) * 100).toFixed(2)),
          })),
          topActiveHazards: topEntries(entry.hazardCounts, top, false).map(([name, count]) => ({
            name,
            pct: Number(((count / runs) * 100).toFixed(2)),
          })),
        };
      }),
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Steps Spawn Report`);
  console.log(`runs=${runs} tiles=${tiles.join(',')} top=${top}`);
  console.log(
    `window_policy: considered=${windowPolicy.considered} relief=${windowPolicy.reliefWindows} (${percent(
      windowPolicy.reliefWindows,
      Math.max(1, windowPolicy.considered)
    )}) below_min=${windowPolicy.belowMinimum} zero=${windowPolicy.zeroObstacleWindows} (${percent(
      windowPolicy.zeroObstacleWindows,
      Math.max(1, windowPolicy.considered)
    )})`
  );

  for (const tile of tiles) {
    const entry = report[tile];
    const noneCount = entry.hazardCounts.get('none') ?? 0;
    console.log(`\n=== TILE ${tile} (${entry.tier}) ===`);
    console.log(`hazard_rate=${percent(entry.hazardRateCount, runs)} (none=${percent(noneCount, runs)})`);

    console.log(`platform_top:`);
    for (const [name, count] of topEntries(entry.platformCounts, top)) {
      console.log(`  ${name.padEnd(24)} ${percent(count, runs)}`);
    }

    console.log(`hazard_top:`);
    for (const [name, count] of topEntries(entry.hazardCounts, top)) {
      console.log(`  ${name.padEnd(24)} ${percent(count, runs)}`);
    }

    console.log(`hazard_active_top:`);
    for (const [name, count] of topEntries(entry.hazardCounts, top, false)) {
      console.log(`  ${name.padEnd(24)} ${percent(count, runs)}`);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage: node scripts/steps-spawn-report.mjs [--runs=20000] [--tiles=50,150,300,600] [--top=10] [--json]`);
  process.exit(0);
}

runReport(args);
