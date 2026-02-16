export type Vec3Tuple = [number, number, number];

export type BiomeId = 'ice' | 'lava' | 'neon';

export type PlatformType =
  | 'standard'
  | 'moving_platform'
  | 'falling_platform'
  | 'conveyor_belt'
  | 'reverse_conveyor'
  | 'bouncer'
  | 'trampoline'
  | 'speed_ramp'
  | 'sticky_glue'
  | 'sinking_sand'
  | 'ghost_platform'
  | 'narrow_bridge'
  | 'slippery_ice'
  | 'teleporter'
  | 'weight_sensitive_bridge'
  | 'size_shifter_pad'
  | 'icy_half_pipe'
  | 'gravity_flip_zone'
  | 'treadmill_switch'
  | 'crushing_ceiling'
  | 'wind_tunnel';

export type ObstacleType =
  | 'mirror_maze_platform'
  | 'pulse_expander'
  | 'gravity_well'
  | 'snap_trap'
  | 'laser_grid'
  | 'rotating_floor_disk'
  | 'spike_wave'
  | 'split_path_bridge'
  | 'time_slow_zone'
  | 'bomb_tile'
  | 'anti_gravity_jump_pad'
  | 'shifting_tiles'
  | 'telefrag_portal'
  | 'magnetic_field'
  | 'rolling_boulder'
  | 'trapdoor_row'
  | 'rotating_cross_blades'
  | 'flicker_bridge'
  | 'rising_spike_columns'
  | 'meat_grinder'
  | 'homing_mine'
  | 'expand_o_matic'
  | 'pendulum_axes'
  | 'rising_lava'
  | 'fragile_glass'
  | 'lightning_striker';

export interface PlatformSpawn {
  id: string;
  type: PlatformType;
  position: Vec3Tuple;
  size: Vec3Tuple;
  lane: number;
  props?: Record<string, number | boolean | string>;
}

export interface ObstacleSpawn {
  id: string;
  type: ObstacleType;
  position: Vec3Tuple;
  size: Vec3Tuple;
  lane: number;
  props?: Record<string, number | boolean | string>;
}

export interface ChunkDefinition {
  id: string;
  index: number;
  biome: BiomeId;
  difficulty: number;
  startZ: number;
  length: number;
  isBoss: boolean;
  platforms: PlatformSpawn[];
  obstacles: ObstacleSpawn[];
}

export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  fogColor: string;
  skyColor: string;
  ambientIntensity: number;
  directionalIntensity: number;
  gravityScale: number;
  frictionScale: number;
  speedScale: number;
  obstacleWeightBoost: Partial<Record<ObstacleType, number>>;
}

export interface SeasonDefinition {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  biomeBias?: BiomeId;
  scoreBonus: number;
}

export type SkillEventKind =
  | 'perfect_landing'
  | 'super_bounce'
  | 'near_miss'
  | 'chunk_clear'
  | 'boss_phase_clear';

export interface LeaderboardSubmission {
  score: number;
  distance: number;
  seed: number;
  runDuration: number;
  checksum: string;
  comboPeak: number;
  timestamp: number;
}

export interface GhostFrame {
  t: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export interface RunGhost {
  seed: number;
  score: number;
  duration: number;
  frames: GhostFrame[];
}
