'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSnapshot } from 'valtio';

import { useGameUIState } from '../../store/selectors';
import { clearFrameInput, useInputRef } from '../../hooks/useInput';
import { SeededRandom } from '../../utils/seededRandom';

import {
  stepsRunnerShapeLabels,
  stepsRunnerShapes,
  stepsState,
  stepsTileVariants,
  type StepsRunnerShape,
  type StepsTileVariant,
} from './state';

export { stepsState } from './state';

type Dir = 'x' | 'z';
type SpawnTier = 'intro' | 'early' | 'mid' | 'late' | 'chaos';
type PlatformKind =
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
type HazardKind =
  | 'none'
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
  | 'rotating_hammer'
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

type Tile = {
  key: string;
  ix: number;
  iz: number;
  index: number;
  instanceId: number;
  painted: boolean;
  hasGem: boolean;
  gemTaken: boolean;
  platform: PlatformKind;
  platformPhase: number;
  platformCycle: number;
  platformOpenWindow: number;
  platformWindowStart: number;
  platformOffset: number;
  platformMotion: number;
  hazard: HazardKind;
  hazardPhase: number;
  hazardCycle: number;
  hazardOpenWindow: number;
  hazardWindowStart: number;
  hazardOffset: number;
  hazardMotion: number;
  hazardLastEffect: number;
  fallStart: number;
  drop: number;
  spawnPulse: number;
  bonus: boolean;
};

type Debris = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  size: number;
};

type HazardVisualKind = 'spire' | 'rotor' | 'beam' | 'orb' | 'portal';
type HazardVisualProfile = {
  visual: HazardVisualKind;
  radiusBase: number;
  radiusGain: number;
  heightBase: number;
  heightGain: number;
  lift: number;
  drift: number;
  spin: number;
  pulse: number;
  tilt: number;
  colorHeat: number;
};

const TILE_SIZE = 1;
const TILE_HEIGHT = 0.24;

const PLAYER_SIZE: [number, number, number] = [0.72, 0.42, 0.72];
const PLAYER_BASE_Y = TILE_HEIGHT / 2 + PLAYER_SIZE[1] / 2;

const MAX_RENDER_TILES = 520;
const PATH_AHEAD = 320;
const KEEP_BEHIND = 120;
const HAZARD_SEQUENCE_STEPS = 6;
const TRAIL_DETAIL_SLOTS = 10;
const MAX_TRAIL_DETAIL = MAX_RENDER_TILES * TRAIL_DETAIL_SLOTS;

const INITIAL_PATH_TILES = 280;
const CHUNK_MIN = 4;
const CHUNK_MAX = 9;
const OBSTACLE_WINDOW_SIZE = 10;
const MIN_OBSTACLES_PER_WINDOW = 2;
const OBSTACLE_RULE_START_INDEX = 20;
const RELIEF_WINDOW_START_INDEX = 160;
const RELIEF_WINDOW_MIN_GAP = 8;
const RELIEF_WINDOW_CHANCE = 0.035;

const FIXED_STEP = 1 / 120;
const MAX_SIM_STEPS = 10;

const GRAVITY = -22;
const STEP_DURATION_BASE = 0.185;
const STEP_DURATION_MIN = 0.1;

const IDLE_LIMIT_BASE = 1.0;
const IDLE_LIMIT_MIN = 0.4;

const FALL_DELAY_BASE = 1.25;
const FALL_DELAY_MIN = 0.28;
const FALL_HIDE_Y = 7.5;
const DEBRIS_POOL = 120;

const COLOR_SKY_A = new THREE.Color('#58c8ff');
const COLOR_PATH = new THREE.Color('#f7d66f');
const COLOR_TRAIL = new THREE.Color('#ef57be');
const COLOR_FALL = new THREE.Color('#ae4a9d');
const COLOR_BONUS = new THREE.Color('#ffef9b');
const COLOR_SPIKE = new THREE.Color('#ff2d55');
const COLOR_SAW = new THREE.Color('#ff4d4f');
const COLOR_CLAMP = new THREE.Color('#ff3f7f');
const COLOR_SWING = new THREE.Color('#ff8a00');
const COLOR_PLATFORM_MOVE = new THREE.Color('#5fa8ff');
const COLOR_PLATFORM_BOUNCE = new THREE.Color('#ffae4d');
const COLOR_PLATFORM_STICKY = new THREE.Color('#a855f7');
const COLOR_PLATFORM_ICE = new THREE.Color('#92d7ff');
const COLOR_PLATFORM_GHOST = new THREE.Color('#6ef4ce');
const COLOR_PLATFORM_TRAP = new THREE.Color('#ff7e8b');
const COLOR_GEM = new THREE.Color('#22e3b3');
const COLOR_GEM_BRIGHT = new THREE.Color('#7affde');
const COLOR_WHITE = new THREE.Color('#ffffff');
const COLOR_HAZARD_SAFE = new THREE.Color('#6af0cf');
const COLOR_HAZARD_DANGER = new THREE.Color('#ff1f4d');
const COLOR_WARNING = new THREE.Color('#ff1744');

const HIDDEN_POS = new THREE.Vector3(0, -9999, 0);
const HIDDEN_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const TILE_STYLES = stepsTileVariants;
const RUNNER_SHAPES = stepsRunnerShapes;

const HAZARD_POOL: Exclude<HazardKind, 'none'>[] = [
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

const PLATFORM_POOL: PlatformKind[] = [
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

const SPIKE_HAZARDS = new Set<HazardKind>([
  'spike_wave',
  'rising_spike_columns',
  'trapdoor_row',
  'bomb_tile',
]);
const SAW_HAZARDS = new Set<HazardKind>([
  'rotating_floor_disk',
  'rotating_hammer',
  'rotating_cross_blades',
  'rolling_boulder',
  'meat_grinder',
  'homing_mine',
]);
const CLAMP_HAZARDS = new Set<HazardKind>([
  'laser_grid',
  'lightning_striker',
  'magnetic_field',
  'gravity_well',
]);
const SWING_HAZARDS = new Set<HazardKind>([
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

const PLATFORM_TRAP_SET = new Set<PlatformKind>([
  'falling_platform',
  'sinking_sand',
  'ghost_platform',
  'weight_sensitive_bridge',
  'crushing_ceiling',
]);

const PLATFORM_MOVING_SET = new Set<PlatformKind>([
  'moving_platform',
  'conveyor_belt',
  'reverse_conveyor',
  'treadmill_switch',
  'wind_tunnel',
]);

const PLATFORM_BOUNCE_SET = new Set<PlatformKind>(['bouncer', 'trampoline', 'speed_ramp']);
const PLATFORM_POWER_SET = new Set<PlatformKind>([
  'teleporter',
  'size_shifter_pad',
  'gravity_flip_zone',
  'wind_tunnel',
]);
const PLATFORM_SURFACE_SET = new Set<PlatformKind>([
  'sticky_glue',
  'sinking_sand',
  'slippery_ice',
  'icy_half_pipe',
]);
const PLATFORM_SPECIAL_SET = new Set<PlatformKind>(
  PLATFORM_POOL.filter((kind): kind is Exclude<PlatformKind, 'standard'> => kind !== 'standard')
);

const READABLE_EFFECT_HAZARDS = new Set<HazardKind>([
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

const HEAVY_CHAOS_HAZARDS = new Set<HazardKind>([
  'rising_lava',
  'meat_grinder',
  'lightning_striker',
  'rotating_cross_blades',
  'pendulum_axes',
  'homing_mine',
  'rolling_boulder',
]);

const PLATFORM_UNLOCK_AT: Record<PlatformKind, number> = {
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

const HAZARD_UNLOCK_AT: Record<Exclude<HazardKind, 'none'>, number> = {
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

const HAZARD_REASON: Record<Exclude<HazardKind, 'none'>, string> = {
  mirror_maze_platform: 'Mirror phase disrupted your rhythm.',
  pulse_expander: 'Pulse expander pushed you off timing.',
  gravity_well: 'Gravity well pulled the cube into danger.',
  snap_trap: 'Snap trap split beneath you.',
  laser_grid: 'Laser grid cycle clipped the cube.',
  rotating_floor_disk: 'Rotating floor spun you out.',
  spike_wave: 'Spike wave caught the cube.',
  split_path_bridge: 'Split path chose the wrong lane.',
  time_slow_zone: 'Time-slow zone desynced your move.',
  bomb_tile: 'Bomb tile exploded underfoot.',
  rotating_hammer: 'Rotating hammer sweep connected.',
  anti_gravity_jump_pad: 'Anti-gravity launch lost control.',
  shifting_tiles: 'Shifting tiles slid away.',
  telefrag_portal: 'Portal exit dropped into danger.',
  magnetic_field: 'Magnetic lock stalled momentum.',
  rolling_boulder: 'Rolling boulder impact.',
  trapdoor_row: 'Trapdoor row opened beneath you.',
  rotating_cross_blades: 'Cross-blade rotation connected.',
  flicker_bridge: 'Flicker bridge vanished at the wrong beat.',
  rising_spike_columns: 'Rising spike columns closed in.',
  meat_grinder: 'Caught in the grinder.',
  homing_mine: 'Homing mine reached the cube.',
  expand_o_matic: 'Expand-o-matic pushed you out.',
  pendulum_axes: 'Pendulum axe timing was off.',
  rising_lava: 'Rising lava reached the cube.',
  fragile_glass: 'Fragile glass shattered under pressure.',
  lightning_striker: 'Lightning striker hit.',
};

const HAZARD_VISUAL_PROFILE: Record<Exclude<HazardKind, 'none'>, HazardVisualProfile> = {
  mirror_maze_platform: { visual: 'portal', radiusBase: 0.28, radiusGain: 0.58, heightBase: 0.06, heightGain: 0.2, lift: 0.2, drift: 0.04, spin: 1.5, pulse: 1.2, tilt: 0.2, colorHeat: 0.78 },
  pulse_expander: { visual: 'orb', radiusBase: 0.2, radiusGain: 0.5, heightBase: 0.16, heightGain: 0.54, lift: 0.16, drift: 0.26, spin: 1.65, pulse: 1.4, tilt: 0.22, colorHeat: 0.84 },
  gravity_well: { visual: 'beam', radiusBase: 0.16, radiusGain: 0.62, heightBase: 0.24, heightGain: 0.74, lift: 0.18, drift: 0.2, spin: 1.1, pulse: 1.1, tilt: 0.2, colorHeat: 0.82 },
  snap_trap: { visual: 'spire', radiusBase: 0.18, radiusGain: 0.42, heightBase: 0.22, heightGain: 1.08, lift: 0.08, drift: 0.06, spin: 1.26, pulse: 1.15, tilt: 0.2, colorHeat: 0.92 },
  laser_grid: { visual: 'beam', radiusBase: 0.24, radiusGain: 0.94, heightBase: 0.14, heightGain: 0.48, lift: 0.22, drift: 0.44, spin: 0.92, pulse: 1.24, tilt: 0.2, colorHeat: 0.98 },
  rotating_floor_disk: { visual: 'rotor', radiusBase: 0.22, radiusGain: 0.74, heightBase: 0.1, heightGain: 0.28, lift: 0.14, drift: 0.18, spin: 2.4, pulse: 1.08, tilt: 0.22, colorHeat: 0.88 },
  spike_wave: { visual: 'spire', radiusBase: 0.16, radiusGain: 0.52, heightBase: 0.2, heightGain: 1.02, lift: 0.09, drift: 0.12, spin: 1.22, pulse: 1.26, tilt: 0.16, colorHeat: 0.9 },
  split_path_bridge: { visual: 'spire', radiusBase: 0.18, radiusGain: 0.46, heightBase: 0.18, heightGain: 0.92, lift: 0.06, drift: 0.1, spin: 1.18, pulse: 1.14, tilt: 0.14, colorHeat: 0.86 },
  time_slow_zone: { visual: 'beam', radiusBase: 0.2, radiusGain: 0.5, heightBase: 0.2, heightGain: 0.58, lift: 0.2, drift: 0.24, spin: 0.84, pulse: 1.02, tilt: 0.24, colorHeat: 0.7 },
  bomb_tile: { visual: 'orb', radiusBase: 0.2, radiusGain: 0.58, heightBase: 0.18, heightGain: 0.52, lift: 0.14, drift: 0.2, spin: 2.05, pulse: 1.56, tilt: 0.2, colorHeat: 0.96 },
  rotating_hammer: { visual: 'rotor', radiusBase: 0.24, radiusGain: 0.92, heightBase: 0.1, heightGain: 0.32, lift: 0.14, drift: 0.22, spin: 2.82, pulse: 1.22, tilt: 0.26, colorHeat: 0.92 },
  anti_gravity_jump_pad: { visual: 'orb', radiusBase: 0.18, radiusGain: 0.46, heightBase: 0.2, heightGain: 0.48, lift: 0.18, drift: 0.18, spin: 1.72, pulse: 1.35, tilt: 0.16, colorHeat: 0.76 },
  shifting_tiles: { visual: 'orb', radiusBase: 0.2, radiusGain: 0.44, heightBase: 0.2, heightGain: 0.46, lift: 0.16, drift: 0.3, spin: 1.9, pulse: 1.18, tilt: 0.18, colorHeat: 0.8 },
  telefrag_portal: { visual: 'portal', radiusBase: 0.26, radiusGain: 0.62, heightBase: 0.06, heightGain: 0.24, lift: 0.2, drift: 0.08, spin: 1.82, pulse: 1.4, tilt: 0.22, colorHeat: 0.88 },
  magnetic_field: { visual: 'beam', radiusBase: 0.18, radiusGain: 0.6, heightBase: 0.2, heightGain: 0.64, lift: 0.18, drift: 0.3, spin: 1.36, pulse: 1.2, tilt: 0.28, colorHeat: 0.78 },
  rolling_boulder: { visual: 'orb', radiusBase: 0.28, radiusGain: 0.66, heightBase: 0.18, heightGain: 0.54, lift: 0.14, drift: 0.38, spin: 2.3, pulse: 1.12, tilt: 0.24, colorHeat: 0.92 },
  trapdoor_row: { visual: 'spire', radiusBase: 0.16, radiusGain: 0.5, heightBase: 0.2, heightGain: 1.12, lift: 0.08, drift: 0.16, spin: 1.3, pulse: 1.26, tilt: 0.2, colorHeat: 0.88 },
  rotating_cross_blades: { visual: 'rotor', radiusBase: 0.28, radiusGain: 1.02, heightBase: 0.12, heightGain: 0.36, lift: 0.16, drift: 0.26, spin: 3.12, pulse: 1.34, tilt: 0.34, colorHeat: 0.96 },
  flicker_bridge: { visual: 'portal', radiusBase: 0.24, radiusGain: 0.52, heightBase: 0.06, heightGain: 0.2, lift: 0.18, drift: 0.06, spin: 1.4, pulse: 1.5, tilt: 0.2, colorHeat: 0.72 },
  rising_spike_columns: { visual: 'spire', radiusBase: 0.2, radiusGain: 0.64, heightBase: 0.24, heightGain: 1.28, lift: 0.12, drift: 0.1, spin: 1.46, pulse: 1.44, tilt: 0.24, colorHeat: 0.94 },
  meat_grinder: { visual: 'rotor', radiusBase: 0.24, radiusGain: 0.96, heightBase: 0.14, heightGain: 0.42, lift: 0.14, drift: 0.34, spin: 2.74, pulse: 1.24, tilt: 0.28, colorHeat: 0.98 },
  homing_mine: { visual: 'orb', radiusBase: 0.24, radiusGain: 0.56, heightBase: 0.2, heightGain: 0.48, lift: 0.16, drift: 0.34, spin: 2.14, pulse: 1.3, tilt: 0.18, colorHeat: 0.9 },
  expand_o_matic: { visual: 'spire', radiusBase: 0.18, radiusGain: 0.72, heightBase: 0.18, heightGain: 1.16, lift: 0.08, drift: 0.22, spin: 1.22, pulse: 1.62, tilt: 0.16, colorHeat: 0.86 },
  pendulum_axes: { visual: 'rotor', radiusBase: 0.24, radiusGain: 0.88, heightBase: 0.12, heightGain: 0.34, lift: 0.16, drift: 0.24, spin: 2.62, pulse: 1.16, tilt: 0.36, colorHeat: 0.92 },
  rising_lava: { visual: 'spire', radiusBase: 0.24, radiusGain: 0.7, heightBase: 0.32, heightGain: 1.34, lift: 0.16, drift: 0.14, spin: 1.54, pulse: 1.5, tilt: 0.22, colorHeat: 1 },
  fragile_glass: { visual: 'spire', radiusBase: 0.18, radiusGain: 0.58, heightBase: 0.2, heightGain: 1, lift: 0.1, drift: 0.18, spin: 1.34, pulse: 1.28, tilt: 0.16, colorHeat: 0.84 },
  lightning_striker: { visual: 'beam', radiusBase: 0.14, radiusGain: 0.72, heightBase: 0.3, heightGain: 1.38, lift: 0.34, drift: 0.28, spin: 1.48, pulse: 1.58, tilt: 0.3, colorHeat: 1 },
};

const LETHAL_HAZARDS = new Set<HazardKind>([
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

const EFFECT_HAZARDS = new Set<HazardKind>([
  'mirror_maze_platform',
  'pulse_expander',
  'gravity_well',
  'split_path_bridge',
  'time_slow_zone',
  'anti_gravity_jump_pad',
  'shifting_tiles',
  'telefrag_portal',
  'magnetic_field',
  'flicker_bridge',
  'expand_o_matic',
]);

function trailStyleLabel(style: StepsTileVariant) {
  if (style === 'classic') return 'Classic';
  if (style === 'voxel') return 'Voxel';
  if (style === 'carved') return 'Carved';
  if (style === 'alloy') return 'Alloy';
  if (style === 'prismatic') return 'Prismatic';
  if (style === 'gridforge') return 'GridForge';
  if (style === 'diamond') return 'Diamond Tess';
  if (style === 'sunken') return 'Sunken Steps';
  return 'Ripple';
}

const VARIANT_ACCENTS: Record<StepsTileVariant, THREE.Color> = {
  classic: new THREE.Color('#ffffff'),
  voxel: new THREE.Color('#a8e8ff'),
  carved: new THREE.Color('#ff9ac6'),
  alloy: new THREE.Color('#7ecbff'),
  prismatic: new THREE.Color('#c38dff'),
  gridforge: new THREE.Color('#61f4c7'),
  diamond: new THREE.Color('#ffd37a'),
  sunken: new THREE.Color('#ff8f8f'),
  ripple: new THREE.Color('#7af0ff'),
};

const HAZARD_LABELS: Record<HazardKind, string> = {
  none: 'Clear',
  mirror_maze_platform: 'Mirror Maze',
  pulse_expander: 'Pulse Expander',
  gravity_well: 'Gravity Well',
  snap_trap: 'Snap Trap',
  laser_grid: 'Laser Grid',
  rotating_floor_disk: 'Floor Disk',
  spike_wave: 'Spike Wave',
  split_path_bridge: 'Split Bridge',
  time_slow_zone: 'Time Slow',
  bomb_tile: 'Bomb Tile',
  rotating_hammer: 'Rotating Hammer',
  anti_gravity_jump_pad: 'Anti-Gravity Pad',
  shifting_tiles: 'Shifting Tiles',
  telefrag_portal: 'Telefrag Portal',
  magnetic_field: 'Magnetic Field',
  rolling_boulder: 'Rolling Boulder',
  trapdoor_row: 'Trapdoor Row',
  rotating_cross_blades: 'Cross Blades',
  flicker_bridge: 'Flicker Bridge',
  rising_spike_columns: 'Spike Columns',
  meat_grinder: 'Meat Grinder',
  homing_mine: 'Homing Mine',
  expand_o_matic: 'Expand-o-Matic',
  pendulum_axes: 'Pendulum Axes',
  rising_lava: 'Rising Lava',
  fragile_glass: 'Fragile Glass',
  lightning_striker: 'Lightning Striker',
};

const PLATFORM_HINTS: Record<PlatformKind, string> = {
  standard: 'Stable footing.',
  moving_platform: 'Shifts side-to-side.',
  falling_platform: 'Drops shortly after contact.',
  conveyor_belt: 'Pushes your step timing forward.',
  reverse_conveyor: 'Drags movement backward.',
  bouncer: 'Auto-launches forward.',
  trampoline: 'Hold to charge extra jump arc.',
  speed_ramp: 'Forces a faster next step.',
  sticky_glue: 'Slows movement and raises pressure.',
  sinking_sand: 'Sinks while you stay still.',
  ghost_platform: 'Phases open and closed.',
  narrow_bridge: 'Reduced landing width.',
  slippery_ice: 'Low friction, extra glide.',
  teleporter: 'Warps ahead on touch.',
  weight_sensitive_bridge: 'Falls after a short delay.',
  size_shifter_pad: 'Shrinks the runner briefly.',
  icy_half_pipe: 'Slide-boosted lane.',
  gravity_flip_zone: 'Flips jump arc timing.',
  treadmill_switch: 'Direction alternates on cycle.',
  crushing_ceiling: 'Closes on a beat timer.',
  wind_tunnel: 'Adds forward lift and drift.',
};

const HAZARD_HINTS: Record<HazardKind, string> = {
  none: 'No obstacle on this tile.',
  mirror_maze_platform: 'Inverts your next tap cycle.',
  pulse_expander: 'Adds collapse pressure instantly.',
  gravity_well: 'Pulls movement and sticks timing.',
  snap_trap: 'Snaps closed during danger phase.',
  laser_grid: 'Sweeping beams on strict intervals.',
  rotating_floor_disk: 'Spins into unsafe windows.',
  spike_wave: 'Spikes rise in pulses.',
  split_path_bridge: 'Only one lane stays safe.',
  time_slow_zone: 'Desyncs your move speed.',
  bomb_tile: 'Explodes during hot phase.',
  rotating_hammer: 'Wide sweep around center.',
  anti_gravity_jump_pad: 'Launches with gravity flip.',
  shifting_tiles: 'Offsets your landing trajectory.',
  telefrag_portal: 'Teleports into danger if mistimed.',
  magnetic_field: 'Locks orientation and control.',
  rolling_boulder: 'Orbital roll sweep.',
  trapdoor_row: 'Floor opens underfoot.',
  rotating_cross_blades: 'Multi-arm rotating sweep.',
  flicker_bridge: 'Visibility-safe windows only.',
  rising_spike_columns: 'Columns rise from floor.',
  meat_grinder: 'Fast high-radius rotor.',
  homing_mine: 'Tracks with pulsing approach.',
  expand_o_matic: 'Expands threat radius quickly.',
  pendulum_axes: 'Alternating swing arcs.',
  rising_lava: 'Heat level rises over time.',
  fragile_glass: 'Shatters if timing is late.',
  lightning_striker: 'Vertical strike on pulse.',
};

function platformLabel(kind: PlatformKind) {
  if (kind === 'standard') return 'Standard';
  if (kind === 'moving_platform') return 'Moving';
  if (kind === 'falling_platform') return 'Falling';
  if (kind === 'conveyor_belt') return 'Conveyor';
  if (kind === 'reverse_conveyor') return 'Reverse Conveyor';
  if (kind === 'bouncer') return 'Bouncer';
  if (kind === 'trampoline') return 'Trampoline';
  if (kind === 'speed_ramp') return 'Speed Ramp';
  if (kind === 'sticky_glue') return 'Sticky Glue';
  if (kind === 'sinking_sand') return 'Sinking Sand';
  if (kind === 'ghost_platform') return 'Ghost Platform';
  if (kind === 'narrow_bridge') return 'Narrow Bridge';
  if (kind === 'slippery_ice') return 'Slippery Ice';
  if (kind === 'teleporter') return 'Teleporter';
  if (kind === 'weight_sensitive_bridge') return 'Weight Bridge';
  if (kind === 'size_shifter_pad') return 'Size Shifter';
  if (kind === 'icy_half_pipe') return 'Icy Half-Pipe';
  if (kind === 'gravity_flip_zone') return 'Gravity Flip';
  if (kind === 'treadmill_switch') return 'Switch Treadmill';
  if (kind === 'crushing_ceiling') return 'Crushing Ceiling';
  return 'Wind Tunnel';
}

function runnerShapeLabel(shape: StepsRunnerShape) {
  return stepsRunnerShapeLabels[shape] ?? 'Cube';
}

function hazardLabel(kind: HazardKind) {
  return HAZARD_LABELS[kind];
}

function keyFor(ix: number, iz: number) {
  return `${ix}|${iz}`;
}

function easingLerp(current: number, target: number, dt: number, lambda = 10) {
  const t = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * t;
}

function smoothStep01(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function holdLimitForScore(score: number) {
  return clamp(IDLE_LIMIT_BASE - score * 0.003, IDLE_LIMIT_MIN, IDLE_LIMIT_BASE);
}

function fallDelayForScore(score: number) {
  return clamp(FALL_DELAY_BASE - score * 0.0045, FALL_DELAY_MIN, FALL_DELAY_BASE);
}

function stepDurationForScore(score: number) {
  return clamp(STEP_DURATION_BASE - score * 0.00065, STEP_DURATION_MIN, STEP_DURATION_BASE);
}

function positiveMod(v: number, mod: number) {
  if (mod <= 0) return 0;
  return ((v % mod) + mod) % mod;
}

function wrappedWindowContains(value: number, start: number, end: number, size: number) {
  if (size <= 0) return true;
  const s = positiveMod(start, size);
  const e = positiveMod(end, size);
  if (s <= e) return value >= s && value <= e;
  return value >= s || value <= e;
}

function wrappedDistance(a: number, b: number, size: number) {
  const raw = Math.abs(a - b);
  return Math.min(raw, Math.max(0, size - raw));
}

function platformTint(kind: PlatformKind) {
  if (PLATFORM_BOUNCE_SET.has(kind)) return COLOR_PLATFORM_BOUNCE;
  if (PLATFORM_MOVING_SET.has(kind)) return COLOR_PLATFORM_MOVE;
  if (kind === 'sticky_glue') return COLOR_PLATFORM_STICKY;
  if (kind === 'slippery_ice' || kind === 'icy_half_pipe') return COLOR_PLATFORM_ICE;
  if (kind === 'ghost_platform' || kind === 'teleporter' || kind === 'size_shifter_pad') return COLOR_PLATFORM_GHOST;
  if (PLATFORM_TRAP_SET.has(kind)) return COLOR_PLATFORM_TRAP;
  return COLOR_PATH;
}

function hazardTint(kind: HazardKind) {
  if (kind === 'none') return COLOR_WARNING;
  if (SPIKE_HAZARDS.has(kind)) return COLOR_SPIKE;
  if (SAW_HAZARDS.has(kind)) return COLOR_SAW;
  if (CLAMP_HAZARDS.has(kind)) return COLOR_CLAMP;
  return COLOR_SWING;
}

function hazardVisualFor(kind: HazardKind) {
  if (kind === 'none') return 'none' as const;
  return HAZARD_VISUAL_PROFILE[kind].visual;
}

function spawnTierForIndex(index: number): SpawnTier {
  if (index < 34) return 'intro';
  if (index < 130) return 'early';
  if (index < 300) return 'mid';
  if (index < 520) return 'late';
  return 'chaos';
}

function sameHazardFamily(a: HazardKind, b: HazardKind) {
  if (a === 'none' || b === 'none') return false;
  return (
    (SPIKE_HAZARDS.has(a) && SPIKE_HAZARDS.has(b)) ||
    (SAW_HAZARDS.has(a) && SAW_HAZARDS.has(b)) ||
    (CLAMP_HAZARDS.has(a) && CLAMP_HAZARDS.has(b)) ||
    (SWING_HAZARDS.has(a) && SWING_HAZARDS.has(b))
  );
}

function platformTierWeight(kind: PlatformKind, tier: SpawnTier) {
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

function hazardTierWeight(kind: Exclude<HazardKind, 'none'>, tier: SpawnTier) {
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

function hazardIndividualBias(kind: Exclude<HazardKind, 'none'>) {
  if (kind === 'mirror_maze_platform' || kind === 'time_slow_zone' || kind === 'split_path_bridge') return 1.12;
  if (kind === 'laser_grid' || kind === 'spike_wave' || kind === 'rotating_floor_disk') return 1.04;
  if (kind === 'rising_lava' || kind === 'meat_grinder' || kind === 'lightning_striker') return 0.72;
  if (kind === 'homing_mine' || kind === 'pendulum_axes' || kind === 'rotating_cross_blades') return 0.9;
  return 1;
}

function isHazardCompatible(platform: PlatformKind, hazard: HazardKind, index: number) {
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

function pickPlatform(
  index: number,
  rng: SeededRandom,
  inBonus: boolean,
  previousPlatform: PlatformKind | null
): PlatformKind {
  if (index < 8) return 'standard';
  if (inBonus) {
    return rng.weighted([
      { item: 'standard' as PlatformKind, weight: 0.3 },
      { item: 'speed_ramp' as PlatformKind, weight: 0.24 },
      { item: 'bouncer' as PlatformKind, weight: 0.22 },
      { item: 'trampoline' as PlatformKind, weight: 0.12 },
      { item: 'conveyor_belt' as PlatformKind, weight: 0.08 },
      { item: 'moving_platform' as PlatformKind, weight: 0.04 },
    ]);
  }

  const tier = spawnTierForIndex(index);
  const tierDifficulty = clamp(index / 620, 0, 1);
  const weighted: { item: PlatformKind; weight: number }[] = [];

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

    weight *= THREE.MathUtils.lerp(0.92, 1.1, tierDifficulty);
    weighted.push({ item, weight });
  }

  if (weighted.length === 0) return 'standard';
  return rng.weighted(weighted);
}

function pickHazard(
  index: number,
  rng: SeededRandom,
  streak: number,
  inBonus: boolean,
  previousHazard: HazardKind,
  reliefWindow = false
): HazardKind {
  if (index < 14) return 'none';

  const tier = spawnTierForIndex(index);
  const allowedConsecutive =
    reliefWindow ? 1 : tier === 'chaos' ? 3 : tier === 'late' ? 2 : tier === 'mid' ? 2 : 1;
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
  const weighted: { item: HazardKind; weight: number }[] = [];
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

    weight *= THREE.MathUtils.lerp(0.94, 1.08, progression);
    weighted.push({ item, weight });
  }

  if (weighted.length === 0) return 'none';
  return rng.weighted(weighted);
}

function pickForcedHazard(
  index: number,
  rng: SeededRandom,
  previousHazard: HazardKind,
  platform: PlatformKind
): HazardKind {
  const tier = spawnTierForIndex(index);
  const progression = clamp(index / 620, 0, 1);
  const weighted: { item: HazardKind; weight: number }[] = [];

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

    weight *= THREE.MathUtils.lerp(0.96, 1.12, progression);
    weighted.push({ item, weight });
  }

  if (weighted.length === 0) return 'none';
  return rng.weighted(weighted);
}

function buildHazardTiming(kind: HazardKind, index: number, rng: SeededRandom, sequence: number) {
  if (kind === 'none') {
    return {
      cycle: 1.8,
      openWindow: 1.2,
      windowStart: 0,
      offset: 0,
    };
  }

  const tier = spawnTierForIndex(index);
  const difficulty = clamp(index / 520, 0, 1);
  const baseCycle = SPIKE_HAZARDS.has(kind)
    ? THREE.MathUtils.lerp(1.9, 1.35, difficulty)
    : SAW_HAZARDS.has(kind)
      ? THREE.MathUtils.lerp(2.1, 1.45, difficulty)
      : CLAMP_HAZARDS.has(kind)
        ? THREE.MathUtils.lerp(2.25, 1.58, difficulty)
        : THREE.MathUtils.lerp(2.35, 1.7, difficulty);
  const tierCycleShift =
    tier === 'intro' ? 0.22 : tier === 'early' ? 0.18 : tier === 'mid' ? 0.05 : tier === 'late' ? -0.04 : -0.12;
  const cycle = clamp(baseCycle + tierCycleShift + rng.float(-0.1, 0.1), 1.2, 2.5);

  const openRatioBase = SPIKE_HAZARDS.has(kind) ? 0.72 : SAW_HAZARDS.has(kind) ? 0.68 : CLAMP_HAZARDS.has(kind) ? 0.64 : 0.67;
  const openShift = tier === 'early' ? 0.08 : tier === 'mid' ? 0.03 : tier === 'chaos' ? -0.05 : tier === 'late' ? -0.02 : 0.1;
  const openRatio = openRatioBase + openShift;
  const openWindow = clamp(cycle * openRatio, 0.85, cycle - 0.28);

  const sequenceStep = sequence % HAZARD_SEQUENCE_STEPS;
  const stride = cycle / HAZARD_SEQUENCE_STEPS;
  const windowStart = positiveMod(sequenceStep * stride + rng.float(-0.05, 0.05), cycle);

  return {
    cycle,
    openWindow,
    windowStart,
    offset: rng.float(-0.12, 0.12),
  };
}

function buildPlatformTiming(kind: PlatformKind, index: number, rng: SeededRandom) {
  const dynamic =
    kind === 'moving_platform' ||
    kind === 'ghost_platform' ||
    kind === 'treadmill_switch' ||
    kind === 'crushing_ceiling' ||
    kind === 'weight_sensitive_bridge' ||
    kind === 'icy_half_pipe';

  if (!dynamic) {
    return {
      cycle: 2.2,
      openWindow: 2.2,
      windowStart: 0,
      offset: 0,
    };
  }

  const tier = spawnTierForIndex(index);
  const difficulty = clamp(index / 560, 0, 1);
  const tierCycleShift =
    tier === 'intro' ? 0.26 : tier === 'early' ? 0.18 : tier === 'mid' ? 0.06 : tier === 'late' ? -0.05 : -0.12;
  const cycle = clamp(THREE.MathUtils.lerp(2.5, 1.55, difficulty) + tierCycleShift + rng.float(-0.08, 0.08), 1.2, 2.7);
  const openRatioBase = kind === 'ghost_platform' ? 0.52 : kind === 'crushing_ceiling' ? 0.58 : 0.66;
  const openShift = tier === 'early' ? 0.08 : tier === 'mid' ? 0.03 : tier === 'chaos' ? -0.05 : tier === 'late' ? -0.02 : 0.1;
  const openRatio = openRatioBase + openShift;
  const openWindow = clamp(cycle * openRatio, 0.65, cycle - 0.2);
  return {
    cycle,
    openWindow,
    windowStart: rng.float(0, cycle),
    offset: rng.float(-0.14, 0.14),
  };
}

function hazardStateAt(tile: Tile, simTime: number) {
  if (tile.hazard === 'none') {
    return {
      open: true,
      openBlend: 1,
      closedBlend: 0,
      phase01: 0,
    };
  }

  const cycle = Math.max(0.8, tile.hazardCycle);
  const local = positiveMod(simTime + tile.hazardOffset, cycle);
  const openStart = positiveMod(tile.hazardWindowStart, cycle);
  const openEnd = openStart + tile.hazardOpenWindow;
  const open = wrappedWindowContains(local, openStart, openEnd, cycle);

  const center = positiveMod(openStart + tile.hazardOpenWindow * 0.5, cycle);
  const dist = wrappedDistance(local, center, cycle);
  const radius = tile.hazardOpenWindow * 0.5;
  const feather = Math.max(0.08, cycle * 0.16);
  const openBlend = clamp(1 - (dist - radius) / feather, 0, 1);

  return {
    open,
    openBlend,
    closedBlend: 1 - openBlend,
    phase01: local / cycle,
  };
}

function platformStateAt(tile: Tile, simTime: number) {
  const cycle = Math.max(0.8, tile.platformCycle);
  const local = positiveMod(simTime + tile.platformOffset, cycle);
  const openStart = positiveMod(tile.platformWindowStart, cycle);
  const openEnd = openStart + tile.platformOpenWindow;
  const open = wrappedWindowContains(local, openStart, openEnd, cycle);
  const center = positiveMod(openStart + tile.platformOpenWindow * 0.5, cycle);
  const dist = wrappedDistance(local, center, cycle);
  const radius = tile.platformOpenWindow * 0.5;
  const feather = Math.max(0.08, cycle * 0.16);
  const openBlend = clamp(1 - (dist - radius) / feather, 0, 1);
  return {
    open,
    openBlend,
    closedBlend: 1 - openBlend,
    phase01: local / cycle,
  };
}

function hazardIsDangerous(tile: Tile) {
  if (tile.hazard === 'none') return false;
  const threshold = SPIKE_HAZARDS.has(tile.hazard)
    ? 0.42
    : SAW_HAZARDS.has(tile.hazard)
      ? 0.48
      : CLAMP_HAZARDS.has(tile.hazard)
        ? 0.5
        : 0.46;
  return tile.hazardMotion > threshold;
}

function failReasonForHazard(kind: HazardKind) {
  if (kind === 'none') return 'Trap timing was off.';
  return HAZARD_REASON[kind];
}

function platformDangerReason(kind: PlatformKind) {
  if (kind === 'ghost_platform') return 'Ghost platform phased out.';
  if (kind === 'crushing_ceiling') return 'Crushing ceiling closed.';
  if (kind === 'falling_platform' || kind === 'weight_sensitive_bridge') return 'Platform dropped out.';
  if (kind === 'sinking_sand') return 'Sank into trap sand.';
  return 'Trap timing was off.';
}

function platformStepModifier(kind: PlatformKind) {
  if (kind === 'speed_ramp') return 0.72;
  if (kind === 'bouncer' || kind === 'trampoline') return 0.8;
  if (kind === 'conveyor_belt' || kind === 'treadmill_switch') return 0.86;
  if (kind === 'sticky_glue' || kind === 'sinking_sand') return 1.25;
  if (kind === 'reverse_conveyor') return 1.16;
  if (kind === 'slippery_ice' || kind === 'icy_half_pipe') return 0.92;
  if (kind === 'moving_platform') return 1.04;
  return 1;
}

function platformPressureModifier(kind: PlatformKind) {
  if (kind === 'sticky_glue' || kind === 'sinking_sand') return 1.35;
  if (kind === 'reverse_conveyor') return 1.22;
  if (kind === 'conveyor_belt' || kind === 'speed_ramp') return 0.88;
  if (kind === 'slippery_ice' || kind === 'icy_half_pipe') return 0.8;
  return 1;
}

function runnerBaseScale(shape: StepsRunnerShape) {
  if (shape === 'rounded_cube') return [1.02, 0.98, 1.02] as const;
  if (shape === 'tri_prism') return [0.98, 0.94, 0.98] as const;
  if (shape === 'hex_prism') return [0.98, 0.96, 0.98] as const;
  if (shape === 'pyramid') return [0.94, 0.92, 0.94] as const;
  if (shape === 'tetra') return [0.96, 0.95, 0.96] as const;
  if (shape === 'octa') return [0.95, 0.94, 0.95] as const;
  if (shape === 'dodeca') return [0.92, 0.92, 0.92] as const;
  if (shape === 'icosa') return [0.9, 0.9, 0.9] as const;
  if (shape === 'star_prism') return [0.98, 0.9, 0.98] as const;
  if (shape === 'fortress') return [1.08, 0.84, 1.08] as const;
  if (shape === 'rhombic') return [0.96, 0.9, 0.96] as const;
  if (shape === 'pillar') return [0.84, 1.06, 0.84] as const;
  if (shape === 'wide_box') return [1.12, 0.78, 1.12] as const;
  return [1, 1, 1] as const;
}

function runnerVerticalOffset(shape: StepsRunnerShape) {
  if (shape === 'pillar') return 0.12;
  if (shape === 'pyramid') return 0.07;
  if (shape === 'tri_prism' || shape === 'hex_prism') return 0.04;
  if (shape === 'star_prism') return 0.05;
  if (shape === 'rhombic') return 0.06;
  if (shape === 'wide_box' || shape === 'fortress') return -0.01;
  return 0;
}

function platformSignalProfile(kind: PlatformKind) {
  if (PLATFORM_BOUNCE_SET.has(kind)) return { lift: 0.24, scale: 0.21, thickness: 0.13, spin: 3 };
  if (PLATFORM_MOVING_SET.has(kind)) return { lift: 0.21, scale: 0.18, thickness: 0.1, spin: 1.2 };
  if (PLATFORM_POWER_SET.has(kind)) return { lift: 0.26, scale: 0.22, thickness: 0.09, spin: 2.4 };
  if (PLATFORM_SURFACE_SET.has(kind)) return { lift: 0.17, scale: 0.2, thickness: 0.08, spin: 0.8 };
  if (PLATFORM_TRAP_SET.has(kind)) return { lift: 0.18, scale: 0.2, thickness: 0.12, spin: 1.6 };
  return { lift: 0.17, scale: 0.16, thickness: 0.08, spin: 1 };
}

function isHazardEffectDue(tile: Tile, simTime: number, cooldown = 0.35) {
  return simTime - tile.hazardLastEffect > cooldown;
}

function Steps() {
  const snap = useSnapshot(stepsState);
  const { paused } = useGameUIState();
  const input = useInputRef({
    preventDefault: [' ', 'Space', 'space', 'enter', 'Enter', 'r', 'R'],
  });
  const { camera, scene } = useThree();

  const bgMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const tileMeshRef = useRef<THREE.InstancedMesh>(null);
  const trailDetailMeshRef = useRef<THREE.InstancedMesh>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const sawMeshRef = useRef<THREE.InstancedMesh>(null);
  const clampMeshRef = useRef<THREE.InstancedMesh>(null);
  const swingMeshRef = useRef<THREE.InstancedMesh>(null);
  const ringMeshRef = useRef<THREE.InstancedMesh>(null);
  const platformSignalMeshRef = useRef<THREE.InstancedMesh>(null);
  const hazardAuraMeshRef = useRef<THREE.InstancedMesh>(null);
  const warningMeshRef = useRef<THREE.InstancedMesh>(null);
  const gemMeshRef = useRef<THREE.InstancedMesh>(null);
  const debrisMeshRef = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef<THREE.Mesh>(null);

  const playerGeometries = useMemo(
    () =>
      ({
        cube: new THREE.BoxGeometry(0.92, 0.52, 0.92),
        rounded_cube: new THREE.BoxGeometry(0.96, 0.5, 0.96, 3, 2, 3),
        tri_prism: new THREE.CylinderGeometry(0.52, 0.52, 0.64, 3),
        hex_prism: new THREE.CylinderGeometry(0.5, 0.5, 0.62, 6),
        pyramid: new THREE.ConeGeometry(0.54, 0.72, 4),
        tetra: new THREE.TetrahedronGeometry(0.5, 0),
        octa: new THREE.OctahedronGeometry(0.48, 0),
        dodeca: new THREE.DodecahedronGeometry(0.44, 0),
        icosa: new THREE.IcosahedronGeometry(0.42, 0),
        star_prism: new THREE.CylinderGeometry(0.42, 0.56, 0.66, 8, 1, false),
        fortress: new THREE.BoxGeometry(1.02, 0.42, 1.02),
        rhombic: new THREE.OctahedronGeometry(0.46, 0),
        pillar: new THREE.CylinderGeometry(0.36, 0.4, 0.78, 8),
        wide_box: new THREE.BoxGeometry(1.14, 0.4, 1.14),
      }) as Record<StepsRunnerShape, THREE.BufferGeometry>,
    []
  );

  const playerGeometry = playerGeometries[snap.runnerShape] ?? playerGeometries.cube;

  useEffect(() => {
    return () => {
      for (const geometry of Object.values(playerGeometries)) {
        geometry.dispose();
      }
    };
  }, [playerGeometries]);

  const world = useRef({
    rng: new SeededRandom(1),

    accumulator: 0,
    simTime: 0,

    genIx: 0,
    genIz: 0,
    genDir: 'x' as Dir,
    chunkTilesLeft: 0,
    bonusTilesLeft: 0,
    nextIndex: 0,
    hazardStreak: 0,
    hazardSequence: 0,
    platformSequence: 0,
    obstacleWindowId: -1,
    obstacleWindowObstacleCount: 0,
    obstacleWindowRelief: false,
    lastReliefWindowId: -999,

    tilesByKey: new Map<string, Tile>(),
    tilesByIndex: new Map<number, Tile>(),
    instanceToTile: Array<Tile | null>(MAX_RENDER_TILES).fill(null),

    currentTileIndex: 0,

    px: 0,
    py: PLAYER_BASE_Y,
    pz: 0,
    playerYaw: 0,

    moving: false,
    moveFromX: 0,
    moveFromZ: 0,
    moveToX: 0,
    moveToZ: 0,
    moveTargetIndex: 0,
    moveT: 0,
    moveDuration: STEP_DURATION_BASE,
    stepQueued: false,
    arcBoost: 0,

    falling: false,
    vy: 0,
    deathSpin: 0,

    idleOnTile: 0,

    cameraShake: 0,
    speedBoostUntil: 0,
    stickyUntil: 0,
    gravityFlipUntil: 0,
    controlsInvertedUntil: 0,
    timeSlowUntil: 0,
    rotationLockUntil: 0,
    sizeShiftUntil: 0,
    sizeShiftScale: 1,
    teleportCooldownUntil: 0,
    invertTapLatch: false,
    autoStepUntil: 0,
    lastPlatform: 'standard' as PlatformKind,
    nearMissBonus: 0,
    tapCharge: 0,

    hudCommit: 0,
    pressure: 0,

    spaceWasDown: false,

    debris: Array.from(
      { length: DEBRIS_POOL },
      (): Debris => ({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        life: 0,
        size: 0.08,
      })
    ),
    debrisCursor: 0,

    dummy: new THREE.Object3D(),
    tempColorA: new THREE.Color(),
    tempColorB: new THREE.Color(),
    tempColorC: new THREE.Color(),
    camTarget: new THREE.Vector3(),
  });

  const hideInstance = (mesh: THREE.InstancedMesh, index: number) => {
    const w = world.current;
    w.dummy.position.copy(HIDDEN_POS);
    w.dummy.scale.copy(HIDDEN_SCALE);
    w.dummy.rotation.set(0, 0, 0);
    w.dummy.updateMatrix();
    mesh.setMatrixAt(index, w.dummy.matrix);
  };

  const hideTrailDetails = (mesh: THREE.InstancedMesh, tileSlot: number) => {
    const base = tileSlot * TRAIL_DETAIL_SLOTS;
    for (let i = 0; i < TRAIL_DETAIL_SLOTS; i += 1) {
      hideInstance(mesh, base + i);
    }
  };

  const removeTile = (tile: Tile | null | undefined) => {
    if (!tile) return;
    const w = world.current;
    w.tilesByKey.delete(tile.key);
    w.tilesByIndex.delete(tile.index);
    w.instanceToTile[tile.instanceId] = null;
  };

  const getTileAt = (ix: number, iz: number) => {
    const w = world.current;
    return w.tilesByKey.get(keyFor(ix, iz));
  };

  const getTileAtPlayer = () => {
    const w = world.current;
    const ix = Math.round(w.px / TILE_SIZE);
    const iz = Math.round(w.pz / TILE_SIZE);
    return getTileAt(ix, iz);
  };

  const addNextTile = () => {
    const w = world.current;

    if (w.nextIndex > 0) {
      if (w.chunkTilesLeft <= 0) {
        const shouldTurn = w.nextIndex > 6 && w.rng.bool(clamp(0.24 + w.nextIndex * 0.0009, 0.24, 0.5));
        if (shouldTurn) {
          w.genDir = w.genDir === 'x' ? 'z' : 'x';
        }
        w.chunkTilesLeft = w.rng.int(CHUNK_MIN, CHUNK_MAX);
      }

      if (w.genDir === 'x') w.genIx += 1;
      else w.genIz += 1;
      w.chunkTilesLeft -= 1;
    }

    if (w.bonusTilesLeft <= 0 && w.nextIndex > 28 && w.nextIndex % 70 === 0 && w.rng.bool(0.5)) {
      w.bonusTilesLeft = w.rng.int(10, 16);
    }

    const ix = w.genIx;
    const iz = w.genIz;
    const index = w.nextIndex;
    const instanceId = index % MAX_RENDER_TILES;
    const key = keyFor(ix, iz);

    const old = w.instanceToTile[instanceId];
    if (old) removeTile(old);

    const inBonus = w.bonusTilesLeft > 0;
    if (inBonus) w.bonusTilesLeft -= 1;

    const previousTile = w.tilesByIndex.get(index - 1);
    const previousPlatform = previousTile?.platform ?? null;
    const previousHazard = previousTile?.hazard ?? 'none';

    const obstacleWindowId = Math.floor(index / OBSTACLE_WINDOW_SIZE);
    if (obstacleWindowId !== w.obstacleWindowId) {
      w.obstacleWindowId = obstacleWindowId;
      w.obstacleWindowObstacleCount = 0;

      const canRelief =
        index >= RELIEF_WINDOW_START_INDEX &&
        obstacleWindowId - w.lastReliefWindowId >= RELIEF_WINDOW_MIN_GAP &&
        w.rng.bool(RELIEF_WINDOW_CHANCE);
      w.obstacleWindowRelief = canRelief;
      if (canRelief) w.lastReliefWindowId = obstacleWindowId;
    }

    const windowOffset = index - obstacleWindowId * OBSTACLE_WINDOW_SIZE;
    const remainingSlots = OBSTACLE_WINDOW_SIZE - windowOffset;
    const requiredObstacles =
      index >= OBSTACLE_RULE_START_INDEX && !w.obstacleWindowRelief ? MIN_OBSTACLES_PER_WINDOW : 0;
    const missingObstacles = Math.max(0, requiredObstacles - w.obstacleWindowObstacleCount);
    const mustSpawnObstacle = missingObstacles > 0 && remainingSlots <= missingObstacles + 1;

    const platform = pickPlatform(index, w.rng, inBonus, previousPlatform);
    const platformTiming = buildPlatformTiming(platform, index, w.rng);

    let hazard = pickHazard(index, w.rng, w.hazardStreak, inBonus, previousHazard, w.obstacleWindowRelief);
    if (mustSpawnObstacle && hazard === 'none') {
      hazard = pickForcedHazard(index, w.rng, previousHazard, platform);
    }
    if (!isHazardCompatible(platform, hazard, index)) {
      hazard = mustSpawnObstacle ? pickForcedHazard(index, w.rng, previousHazard, platform) : 'none';
    }
    if (mustSpawnObstacle && hazard === 'none') {
      const fallback = HAZARD_POOL.find((item) => index >= HAZARD_UNLOCK_AT[item] && isHazardCompatible(platform, item, index));
      if (fallback) hazard = fallback;
    }
    if (mustSpawnObstacle && hazard === 'none') {
      const emergency = HAZARD_POOL.find((item) => index >= HAZARD_UNLOCK_AT[item]);
      if (emergency) hazard = emergency;
    }
    if (hazard === 'none') {
      w.hazardStreak = 0;
    } else {
      w.hazardStreak += 1;
      w.obstacleWindowObstacleCount += 1;
    }
    const hazardTiming = buildHazardTiming(hazard, index, w.rng, w.hazardSequence);
    if (hazard !== 'none') w.hazardSequence += 1;

    const difficulty = Math.floor(index / 20);
    const gemChanceBase = clamp(0.16 + difficulty * 0.01, 0.16, 0.35);
    const gemChance = inBonus ? 0.95 : hazard === 'none' ? gemChanceBase : gemChanceBase * 0.52;

    const tile: Tile = {
      key,
      ix,
      iz,
      index,
      instanceId,
      painted: false,
      hasGem: index > 6 && w.rng.bool(gemChance),
      gemTaken: false,
      platform,
      platformPhase: w.rng.float(0, Math.PI * 2),
      platformCycle: platformTiming.cycle,
      platformOpenWindow: platformTiming.openWindow,
      platformWindowStart: platformTiming.windowStart,
      platformOffset: platformTiming.offset,
      platformMotion: 0,
      hazard,
      hazardPhase: w.rng.float(0, Math.PI * 2),
      hazardCycle: hazardTiming.cycle,
      hazardOpenWindow: hazardTiming.openWindow,
      hazardWindowStart: hazardTiming.windowStart,
      hazardOffset: hazardTiming.offset,
      hazardMotion: 0,
      hazardLastEffect: -999,
      fallStart: Number.POSITIVE_INFINITY,
      drop: 0,
      spawnPulse: 1,
      bonus: inBonus,
    };

    w.tilesByKey.set(tile.key, tile);
    w.tilesByIndex.set(tile.index, tile);
    w.instanceToTile[instanceId] = tile;

    w.nextIndex += 1;
  };

  const ensurePathAhead = (currentIndex: number) => {
    const w = world.current;
    const needed = currentIndex + PATH_AHEAD;
    while (w.nextIndex <= needed) addNextTile();
  };

  const paintTile = (tile: Tile) => {
    if (tile.painted) return;
    tile.painted = true;
  };

  const spawnDebrisBurst = (x: number, y: number, z: number, count = 28) => {
    const w = world.current;
    for (let i = 0; i < count; i += 1) {
      const d = w.debris[w.debrisCursor % DEBRIS_POOL];
      w.debrisCursor += 1;
      d.active = true;
      d.life = 0.42 + w.rng.random() * 0.42;
      d.pos.set(x, y, z);
      d.vel.set(w.rng.float(-4.5, 4.5), w.rng.float(2.2, 7.2), w.rng.float(-4.5, 4.5));
      d.rot.set(w.rng.float(0, Math.PI), w.rng.float(0, Math.PI), w.rng.float(0, Math.PI));
      d.spin.set(w.rng.float(-10, 10), w.rng.float(-10, 10), w.rng.float(-10, 10));
      d.size = 0.045 + w.rng.random() * 0.08;
    }
  };

  const triggerDeath = (reason: string) => {
    const w = world.current;
    if (stepsState.phase === 'gameover') return;

    stepsState.endGame(reason);
    w.falling = true;
    w.moving = false;
    w.stepQueued = false;
    w.vy = -2.2;
    w.deathSpin = (w.rng.bool(0.5) ? 1 : -1) * 7.8;
    w.cameraShake = Math.max(w.cameraShake, 0.38);
    spawnDebrisBurst(w.px, w.py, w.pz, 36);
    stepsState.setPressure(0);
  };

  const applyHazardEffect = (tile: Tile) => {
    const w = world.current;
    if (tile.hazard === 'none') return;
    if (!isHazardEffectDue(tile, w.simTime)) return;
    tile.hazardLastEffect = w.simTime;

    if (tile.hazard === 'mirror_maze_platform') {
      w.controlsInvertedUntil = Math.max(w.controlsInvertedUntil, w.simTime + 2);
      w.invertTapLatch = false;
      w.cameraShake = Math.max(w.cameraShake, 0.1);
      return;
    }

    if (tile.hazard === 'pulse_expander') {
      w.pressure = clamp(w.pressure + 0.24, 0, 1);
      w.cameraShake = Math.max(w.cameraShake, 0.14);
      return;
    }

    if (tile.hazard === 'gravity_well') {
      w.stickyUntil = Math.max(w.stickyUntil, w.simTime + 0.62);
      w.pressure = clamp(w.pressure + 0.16, 0, 1);
      return;
    }

    if (tile.hazard === 'split_path_bridge') {
      const safeRight = tile.index % 2 === 0;
      const wentRight = w.px >= tile.ix * TILE_SIZE;
      if ((safeRight && !wentRight) || (!safeRight && wentRight)) {
        triggerDeath(failReasonForHazard(tile.hazard));
      }
      return;
    }

    if (tile.hazard === 'time_slow_zone') {
      w.timeSlowUntil = Math.max(w.timeSlowUntil, w.simTime + 1.2);
      return;
    }

    if (tile.hazard === 'anti_gravity_jump_pad') {
      w.arcBoost = Math.max(w.arcBoost, 0.3);
      w.gravityFlipUntil = Math.max(w.gravityFlipUntil, w.simTime + 0.9);
      w.autoStepUntil = Math.max(w.autoStepUntil, w.simTime + 0.22);
      return;
    }

    if (tile.hazard === 'shifting_tiles') {
      w.cameraShake = Math.max(w.cameraShake, 0.12);
      w.moveToX += Math.sin(tile.hazardPhase + w.simTime * 4) * 0.08;
      w.moveToZ += Math.cos(tile.hazardPhase + w.simTime * 3) * 0.08;
      return;
    }

    if (tile.hazard === 'telefrag_portal') {
      if (w.simTime < w.teleportCooldownUntil) return;
      w.teleportCooldownUntil = w.simTime + 0.2;
      const target = w.tilesByIndex.get(tile.index + 3 + (tile.index % 3));
      if (target) {
        w.currentTileIndex = target.index;
        w.px = target.ix * TILE_SIZE;
        w.pz = target.iz * TILE_SIZE;
        w.py = PLAYER_BASE_Y + 0.2;
        w.sizeShiftUntil = Math.max(w.sizeShiftUntil, w.simTime + 3);
        w.sizeShiftScale = 0.62;
        paintTile(target);
      }
      return;
    }

    if (tile.hazard === 'magnetic_field') {
      w.rotationLockUntil = Math.max(w.rotationLockUntil, w.simTime + 1.3);
      return;
    }

    if (tile.hazard === 'flicker_bridge') {
      if (!hazardStateAt(tile, w.simTime).open && w.idleOnTile > 0.08) {
        triggerDeath(failReasonForHazard(tile.hazard));
      }
      return;
    }

    if (tile.hazard === 'expand_o_matic') {
      w.pressure = clamp(w.pressure + 0.2, 0, 1);
      w.cameraShake = Math.max(w.cameraShake, 0.1);
      return;
    }
  };

  const tryStepForward = () => {
    const w = world.current;
    if (stepsState.phase !== 'playing') return;
    if (w.moving || w.falling) return;
    w.stepQueued = false;

    const current = w.tilesByIndex.get(w.currentTileIndex);
    const next = w.tilesByIndex.get(w.currentTileIndex + 1);
    if (!current || !next) {
      triggerDeath('No step ahead.');
      return;
    }

    if (!Number.isFinite(current.fallStart)) {
      const baseDelay = fallDelayForScore(stepsState.score);
      const dropDelay =
        current.platform === 'falling_platform'
          ? baseDelay * 0.38
          : current.platform === 'weight_sensitive_bridge'
            ? baseDelay * 0.52
            : baseDelay;
      current.fallStart = w.simTime + dropDelay;
    }

    w.moving = true;
    w.moveFromX = w.px;
    w.moveFromZ = w.pz;
    w.moveToX = next.ix * TILE_SIZE;
    w.moveToZ = next.iz * TILE_SIZE;
    w.moveTargetIndex = next.index;
    w.moveT = 0;
    const baseDuration = stepDurationForScore(stepsState.score);
    const platformMul = platformStepModifier(current.platform);
    const boostMul = w.simTime < w.speedBoostUntil ? 0.78 : 1;
    const stickyMul = w.simTime < w.stickyUntil ? 1.24 : 1;
    const slowMul = w.simTime < w.timeSlowUntil ? 1.34 : 1;
    w.moveDuration = clamp(baseDuration * platformMul * boostMul * stickyMul * slowMul, STEP_DURATION_MIN * 0.66, STEP_DURATION_BASE * 1.6);
    w.arcBoost =
      current.platform === 'bouncer'
        ? 0.14
        : current.platform === 'trampoline'
          ? 0.12 + w.tapCharge * 0.28
          : 0;
    w.tapCharge = 0;
    w.idleOnTile = 0;
    w.cameraShake = Math.max(w.cameraShake, 0.07);

    const dx = w.moveToX - w.moveFromX;
    const dz = w.moveToZ - w.moveFromZ;
    w.playerYaw = Math.atan2(dx, dz);
  };

  const cleanupBehind = () => {
    const w = world.current;
    const cutoff = w.currentTileIndex - KEEP_BEHIND;
    if (cutoff <= 0) return;

    for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
      const tile = w.instanceToTile[i];
      if (!tile) continue;
      if (tile.index >= cutoff) continue;
      if (tile.drop < FALL_HIDE_Y) continue;
      removeTile(tile);
    }
  };

  const resetWorld = () => {
    const w = world.current;

    w.rng.reset(snap.worldSeed);

    w.accumulator = 0;
    w.simTime = 0;

    w.genIx = 0;
    w.genIz = 0;
    w.genDir = 'x';
    w.chunkTilesLeft = 0;
    w.bonusTilesLeft = 0;
    w.nextIndex = 0;
    w.hazardStreak = 0;
    w.hazardSequence = 0;
    w.platformSequence = 0;
    w.obstacleWindowId = -1;
    w.obstacleWindowObstacleCount = 0;
    w.obstacleWindowRelief = false;
    w.lastReliefWindowId = -999;

    w.tilesByKey.clear();
    w.tilesByIndex.clear();
    w.instanceToTile.fill(null);

    w.currentTileIndex = 0;

    w.px = 0;
    w.py = PLAYER_BASE_Y;
    w.pz = 0;
    w.playerYaw = 0;

    w.moving = false;
    w.moveFromX = 0;
    w.moveFromZ = 0;
    w.moveToX = 0;
    w.moveToZ = 0;
    w.moveTargetIndex = 0;
    w.moveT = 0;
    w.moveDuration = STEP_DURATION_BASE;
    w.stepQueued = false;
    w.arcBoost = 0;

    w.falling = false;
    w.vy = 0;
    w.deathSpin = 0;

    w.idleOnTile = 0;
    w.cameraShake = 0;
    w.speedBoostUntil = 0;
    w.stickyUntil = 0;
    w.gravityFlipUntil = 0;
    w.controlsInvertedUntil = 0;
    w.timeSlowUntil = 0;
    w.rotationLockUntil = 0;
    w.sizeShiftUntil = 0;
    w.sizeShiftScale = 1;
    w.teleportCooldownUntil = 0;
    w.invertTapLatch = false;
    w.autoStepUntil = 0;
    w.lastPlatform = 'standard';
    w.nearMissBonus = 0;
    w.tapCharge = 0;

    w.hudCommit = 0;
    w.pressure = 0;

    w.spaceWasDown = false;

    w.debrisCursor = 0;
    for (let i = 0; i < DEBRIS_POOL; i += 1) {
      const d = w.debris[i];
      d.active = false;
      d.pos.set(0, 0, 0);
      d.vel.set(0, 0, 0);
      d.rot.set(0, 0, 0);
      d.spin.set(0, 0, 0);
      d.life = 0;
      d.size = 0.08;
    }

    for (let i = 0; i < INITIAL_PATH_TILES; i += 1) addNextTile();

    const startTile = w.tilesByIndex.get(0);
    if (startTile) {
      paintTile(startTile);
      startTile.spawnPulse = 0;
    }

    ensurePathAhead(0);

    scene.background = COLOR_SKY_A.clone();
    scene.fog = new THREE.Fog('#68ccff', 11, 78);

    camera.position.set(6.8, 7.4, 6.8);
    camera.lookAt(0, 0.25, 0);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 36;
      camera.updateProjectionMatrix();
    }

    if (
      tileMeshRef.current &&
      trailDetailMeshRef.current &&
      spikeMeshRef.current &&
      sawMeshRef.current &&
      clampMeshRef.current &&
      swingMeshRef.current &&
      ringMeshRef.current &&
      platformSignalMeshRef.current &&
      hazardAuraMeshRef.current &&
      warningMeshRef.current &&
      gemMeshRef.current &&
      debrisMeshRef.current
    ) {
      for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
        hideInstance(tileMeshRef.current, i);
        hideTrailDetails(trailDetailMeshRef.current, i);
        hideInstance(spikeMeshRef.current, i);
        hideInstance(sawMeshRef.current, i);
        hideInstance(clampMeshRef.current, i);
        hideInstance(swingMeshRef.current, i);
        hideInstance(ringMeshRef.current, i);
        hideInstance(platformSignalMeshRef.current, i);
        hideInstance(hazardAuraMeshRef.current, i);
        hideInstance(warningMeshRef.current, i);
        hideInstance(gemMeshRef.current, i);
      }

      for (let i = 0; i < DEBRIS_POOL; i += 1) {
        hideInstance(debrisMeshRef.current, i);
      }

      tileMeshRef.current.instanceMatrix.needsUpdate = true;
      trailDetailMeshRef.current.instanceMatrix.needsUpdate = true;
      spikeMeshRef.current.instanceMatrix.needsUpdate = true;
      sawMeshRef.current.instanceMatrix.needsUpdate = true;
      clampMeshRef.current.instanceMatrix.needsUpdate = true;
      swingMeshRef.current.instanceMatrix.needsUpdate = true;
      ringMeshRef.current.instanceMatrix.needsUpdate = true;
      platformSignalMeshRef.current.instanceMatrix.needsUpdate = true;
      hazardAuraMeshRef.current.instanceMatrix.needsUpdate = true;
      warningMeshRef.current.instanceMatrix.needsUpdate = true;
      gemMeshRef.current.instanceMatrix.needsUpdate = true;
      debrisMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    stepsState.setPressure(0);
  };

  const onLandOnTile = (tile: Tile) => {
    const w = world.current;

    w.currentTileIndex = tile.index;
    w.lastPlatform = tile.platform;
    paintTile(tile);

    if (tile.index > stepsState.score) {
      stepsState.score = tile.index;
    }

    if (tile.hasGem && !tile.gemTaken) {
      tile.gemTaken = true;
      stepsState.collectGem(1);
      w.cameraShake = Math.max(w.cameraShake, 0.2);
    }

    const platformState = platformStateAt(tile, w.simTime);
    tile.platformMotion = easingLerp(tile.platformMotion, platformState.closedBlend, FIXED_STEP, 9);

    if (tile.platform === 'ghost_platform' && !platformState.open) {
      triggerDeath(platformDangerReason(tile.platform));
      return;
    }

    if (tile.platform === 'falling_platform' && !Number.isFinite(tile.fallStart)) {
      tile.fallStart = w.simTime + 0.18;
    }

    if (tile.platform === 'weight_sensitive_bridge' && !Number.isFinite(tile.fallStart)) {
      tile.fallStart = w.simTime + 1.0;
    }

    if (tile.platform === 'bouncer') {
      w.arcBoost = Math.max(w.arcBoost, 0.16);
      w.autoStepUntil = Math.max(w.autoStepUntil, w.simTime + 0.18);
      w.cameraShake = Math.max(w.cameraShake, 0.16);
    }

    if (tile.platform === 'trampoline') {
      w.arcBoost = Math.max(w.arcBoost, 0.24);
      w.autoStepUntil = Math.max(w.autoStepUntil, w.simTime + 0.2);
      w.cameraShake = Math.max(w.cameraShake, 0.18);
    }

    if (tile.platform === 'speed_ramp' || tile.platform === 'conveyor_belt') {
      w.speedBoostUntil = Math.max(w.speedBoostUntil, w.simTime + 0.9);
      w.autoStepUntil = Math.max(w.autoStepUntil, w.simTime + 0.16);
    }

    if (tile.platform === 'sticky_glue' || tile.platform === 'sinking_sand') {
      w.stickyUntil = Math.max(w.stickyUntil, w.simTime + 0.85);
    }

    if (tile.platform === 'gravity_flip_zone') {
      w.gravityFlipUntil = Math.max(w.gravityFlipUntil, w.simTime + 0.78);
    }

    if (tile.platform === 'size_shifter_pad') {
      w.sizeShiftUntil = Math.max(w.sizeShiftUntil, w.simTime + 3);
      w.sizeShiftScale = 0.62;
    }

    if (tile.platform === 'icy_half_pipe' || tile.platform === 'slippery_ice') {
      w.speedBoostUntil = Math.max(w.speedBoostUntil, w.simTime + 0.45);
      w.cameraShake = Math.max(w.cameraShake, 0.08);
    }

    if (tile.platform === 'treadmill_switch') {
      const direction = Math.sin(w.simTime * 2.1 + tile.platformPhase) > 0 ? 1 : -1;
      w.moveToX += direction * 0.22;
      w.speedBoostUntil = Math.max(w.speedBoostUntil, w.simTime + 0.36);
    }

    if (tile.platform === 'wind_tunnel') {
      w.arcBoost = Math.max(w.arcBoost, 0.2);
      w.autoStepUntil = Math.max(w.autoStepUntil, w.simTime + 0.16);
    }

    if (tile.platform === 'teleporter') {
      if (w.simTime >= w.teleportCooldownUntil) {
        w.teleportCooldownUntil = w.simTime + 0.2;
        const target = w.tilesByIndex.get(tile.index + 2 + (tile.index % 2));
        if (target) {
          w.currentTileIndex = target.index;
          w.px = target.ix * TILE_SIZE;
          w.pz = target.iz * TILE_SIZE;
          w.py = PLAYER_BASE_Y + 0.15;
          paintTile(target);
          if (target.index > stepsState.score) {
            stepsState.score = target.index;
          }
          w.cameraShake = Math.max(w.cameraShake, 0.18);
        }
      }
    }

    if (tile.platform === 'crushing_ceiling' && platformState.closedBlend > 0.56) {
      triggerDeath(platformDangerReason(tile.platform));
      return;
    }

    if (tile.platform === 'sinking_sand') {
      w.pressure = clamp(w.pressure + 0.16, 0, 1);
    }

    if (tile.platform === 'reverse_conveyor') {
      w.timeSlowUntil = Math.max(w.timeSlowUntil, w.simTime + 0.4);
    }

    if (tile.hazard !== 'none') {
      const dangerous = hazardIsDangerous(tile);
      if (dangerous && LETHAL_HAZARDS.has(tile.hazard)) {
        triggerDeath(failReasonForHazard(tile.hazard));
        return;
      }
      if (EFFECT_HAZARDS.has(tile.hazard) || dangerous) {
        applyHazardEffect(tile);
      }
    }

    ensurePathAhead(w.currentTileIndex);
    cleanupBehind();
  };

  useEffect(() => {
    stepsState.loadBest();
  }, []);

  useEffect(() => {
    resetWorld();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.worldSeed]);

  const simulateFixed = (dt: number) => {
    const w = world.current;
    w.simTime += dt;

    for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
      const tile = w.instanceToTile[i];
      if (!tile) continue;

      tile.spawnPulse = Math.max(0, tile.spawnPulse - dt * 2.6);
      if (Number.isFinite(tile.fallStart)) {
        const age = w.simTime - tile.fallStart;
        if (age > 0) {
          tile.drop = Math.min(FALL_HIDE_Y + 0.6, age * age * 4.6);
        }
      }

      if (tile.hazard === 'none') {
        tile.hazardMotion = easingLerp(tile.hazardMotion, 0, dt, 9);
      } else {
        const motionTarget = hazardStateAt(tile, w.simTime).closedBlend;
        tile.hazardMotion = easingLerp(tile.hazardMotion, motionTarget, dt, 8);
      }

      const platformState = platformStateAt(tile, w.simTime);
      tile.platformMotion = easingLerp(tile.platformMotion, platformState.closedBlend, dt, 7.5);
    }

    if (stepsState.phase === 'playing') {
      w.arcBoost = Math.max(0, w.arcBoost - dt * 0.42);
      if (w.moving) {
        w.moveT += dt / w.moveDuration;
        const t = smoothStep01(w.moveT);

        w.px = THREE.MathUtils.lerp(w.moveFromX, w.moveToX, t);
        w.pz = THREE.MathUtils.lerp(w.moveFromZ, w.moveToZ, t);
        const arc = 0.25 + w.arcBoost + (w.simTime < w.gravityFlipUntil ? 0.16 : 0);
        w.py = PLAYER_BASE_Y + Math.sin(Math.PI * t) * arc;

        if (w.moveT >= 1) {
          w.moving = false;
          w.px = w.moveToX;
          w.pz = w.moveToZ;
          w.py = PLAYER_BASE_Y;
          w.idleOnTile = 0;
          w.arcBoost = Math.max(0, w.arcBoost - 0.12);

          const landedTile = w.tilesByIndex.get(w.moveTargetIndex);
          if (!landedTile) {
            triggerDeath('Missed the next step.');
          } else {
            onLandOnTile(landedTile);
            if (w.stepQueued && stepsState.phase === 'playing' && !w.falling) {
              w.stepQueued = false;
              tryStepForward();
            }
          }
        }
      } else if (w.falling) {
        w.vy += GRAVITY * dt;
        w.py += w.vy * dt;
        if (w.py < -7) {
          stepsState.endGame(stepsState.failReason || 'Fell into the void.');
        }
      } else {
        w.idleOnTile += dt;
        const standingTile = w.tilesByIndex.get(w.currentTileIndex) ?? getTileAtPlayer();
        const platformMul = standingTile ? platformPressureModifier(standingTile.platform) : 1;
        const stickyMul = w.simTime < w.stickyUntil ? 1.2 : 1;
        const holdLimit = holdLimitForScore(stepsState.score) / (platformMul * stickyMul);
        w.pressure = clamp(w.idleOnTile / Math.max(0.1, holdLimit), 0, 1);

        if (!standingTile) {
          triggerDeath('No tile under the cube.');
        } else {
          const platformState = platformStateAt(standingTile, w.simTime);

          if (w.pressure >= 1 && !Number.isFinite(standingTile.fallStart)) {
            standingTile.fallStart = w.simTime + 0.01;
          }

          if (standingTile.drop > 0.25) {
            triggerDeath('Path collapsed under you.');
          }

          if (standingTile.platform === 'ghost_platform' && !platformState.open && w.idleOnTile > 0.08) {
            triggerDeath(platformDangerReason(standingTile.platform));
          }

          if (standingTile.platform === 'crushing_ceiling' && platformState.closedBlend > 0.56 && w.idleOnTile > 0.1) {
            triggerDeath(platformDangerReason(standingTile.platform));
          }

          if (
            standingTile.platform === 'falling_platform' ||
            standingTile.platform === 'weight_sensitive_bridge'
          ) {
            if (!Number.isFinite(standingTile.fallStart)) {
              const delay = standingTile.platform === 'falling_platform' ? 0.16 : 1.0;
              standingTile.fallStart = w.simTime + delay;
            }
          }

          if (w.simTime < w.autoStepUntil && !w.stepQueued) {
            w.stepQueued = true;
            tryStepForward();
          }

          if (standingTile.hazard !== 'none') {
            const dangerous = hazardIsDangerous(standingTile);
            if (dangerous && LETHAL_HAZARDS.has(standingTile.hazard) && w.idleOnTile > 0.12) {
              triggerDeath(failReasonForHazard(standingTile.hazard));
            } else if (EFFECT_HAZARDS.has(standingTile.hazard) && w.idleOnTile > 0.08) {
              applyHazardEffect(standingTile);
            }
          }
        }
      }
    } else if (w.falling) {
      w.vy += GRAVITY * dt;
      w.py += w.vy * dt;
      if (w.py < -9) {
        w.falling = false;
      }
    }

    for (let i = 0; i < DEBRIS_POOL; i += 1) {
      const d = w.debris[i];
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        continue;
      }
      d.vel.y += -18 * dt;
      d.vel.multiplyScalar(Math.max(0, 1 - dt * 2.6));
      d.pos.addScaledVector(d.vel, dt);
      d.rot.x += d.spin.x * dt;
      d.rot.y += d.spin.y * dt;
      d.rot.z += d.spin.z * dt;
      if (d.pos.y < -8) d.active = false;
    }

    w.hudCommit += dt;
    if (w.hudCommit >= 0.04) {
      w.hudCommit = 0;
      const pressure = stepsState.phase === 'playing' ? w.pressure : 0;
      stepsState.setPressure(pressure);
    }
  };

  useFrame((_, dtRender) => {
    const w = world.current;
    const inputState = input.current;

    const spaceDown = inputState.keysDown.has(' ');
    const enterJustDown = inputState.justPressed.has('enter');
    const restart = inputState.justPressed.has('r');
    const spaceJustDown = spaceDown && !w.spaceWasDown;
    w.spaceWasDown = spaceDown;

    const tap = inputState.pointerJustDown || spaceJustDown || enterJustDown;
    const controlsInverted = w.simTime < w.controlsInvertedUntil;
    if (!controlsInverted) {
      w.invertTapLatch = false;
    }

    if (restart) {
      stepsState.startGame();
      resetWorld();
    } else if (tap) {
      if (stepsState.phase === 'menu' || stepsState.phase === 'gameover') {
        stepsState.startGame();
        resetWorld();
      } else if (stepsState.phase === 'playing') {
        if (controlsInverted) {
          if (!w.invertTapLatch) {
            w.invertTapLatch = true;
            w.cameraShake = Math.max(w.cameraShake, 0.1);
            clearFrameInput(input);
            return;
          }
          w.invertTapLatch = false;
        }
        if (w.moving) {
          w.stepQueued = true;
        } else {
          tryStepForward();
        }
      }
    }

    if (stepsState.phase === 'playing' && !w.falling && !w.moving && spaceDown) {
      w.tapCharge = clamp(w.tapCharge + dtRender * 1.5, 0, 1);
    } else {
      w.tapCharge = Math.max(0, w.tapCharge - dtRender * 2.4);
    }

    clearFrameInput(input);

    if (!paused) {
      w.accumulator += Math.min(0.05, dtRender);
      let simSteps = 0;
      while (w.accumulator >= FIXED_STEP && simSteps < MAX_SIM_STEPS) {
        simulateFixed(FIXED_STEP);
        w.accumulator -= FIXED_STEP;
        simSteps += 1;
      }
    }

    if (bgMaterialRef.current) {
      bgMaterialRef.current.uniforms.uTime.value = w.simTime;
    }

    if (
      tileMeshRef.current &&
      trailDetailMeshRef.current &&
      spikeMeshRef.current &&
      sawMeshRef.current &&
      clampMeshRef.current &&
      swingMeshRef.current &&
      ringMeshRef.current &&
      platformSignalMeshRef.current &&
      hazardAuraMeshRef.current &&
      warningMeshRef.current &&
      gemMeshRef.current
    ) {
      const tileMesh = tileMeshRef.current;
      const trailDetailMesh = trailDetailMeshRef.current;
      const spikeMesh = spikeMeshRef.current;
      const sawMesh = sawMeshRef.current;
      const clampMesh = clampMeshRef.current;
      const swingMesh = swingMeshRef.current;
      const ringMesh = ringMeshRef.current;
      const platformSignalMesh = platformSignalMeshRef.current;
      const hazardAuraMesh = hazardAuraMeshRef.current;
      const warningMesh = warningMeshRef.current;
      const gemMesh = gemMeshRef.current;

      for (let i = 0; i < MAX_RENDER_TILES; i += 1) {
        const tile = w.instanceToTile[i];
        if (!tile) {
          hideInstance(tileMesh, i);
          hideTrailDetails(trailDetailMesh, i);
          hideInstance(spikeMesh, i);
          hideInstance(sawMesh, i);
          hideInstance(clampMesh, i);
          hideInstance(swingMesh, i);
          hideInstance(ringMesh, i);
          hideInstance(platformSignalMesh, i);
          hideInstance(hazardAuraMesh, i);
          hideInstance(warningMesh, i);
          hideInstance(gemMesh, i);
          continue;
        }

        if (tile.drop > FALL_HIDE_Y && tile.index < w.currentTileIndex - 8) {
          removeTile(tile);
          hideInstance(tileMesh, i);
          hideTrailDetails(trailDetailMesh, i);
          hideInstance(spikeMesh, i);
          hideInstance(sawMesh, i);
          hideInstance(clampMesh, i);
          hideInstance(swingMesh, i);
          hideInstance(ringMesh, i);
          hideInstance(platformSignalMesh, i);
          hideInstance(hazardAuraMesh, i);
          hideInstance(warningMesh, i);
          hideInstance(gemMesh, i);
          continue;
        }

        const x = tile.ix * TILE_SIZE;
        const z = tile.iz * TILE_SIZE;
        const wobble = Math.sin(w.simTime * 6 + tile.index * 0.41) * tile.spawnPulse * 0.03;
        const platformState = platformStateAt(tile, w.simTime);
        const platformClosed = 1 - platformState.openBlend;
        const platformSink =
          tile.platform === 'ghost_platform'
            ? platformClosed * 1.8
            : tile.platform === 'crushing_ceiling'
              ? platformClosed * 0.12
              : 0;
        const y = TILE_HEIGHT * 0.5 - tile.drop + wobble - platformSink;
        const hazardState = tile.hazard === 'none' ? null : hazardStateAt(tile, w.simTime);
        const hazardProfile = tile.hazard === 'none' ? null : HAZARD_VISUAL_PROFILE[tile.hazard];
        const hazardThreat = tile.hazard === 'none' ? 0 : smoothStep01(tile.hazardMotion);
        const dangerPulse = hazardState
          ? (0.5 + 0.5 * Math.sin(w.simTime * 8 + tile.hazardPhase * 2.2)) * hazardThreat
          : 0;
        const variant = snap.tileVariant;
        const isVoxelTrail = variant === 'voxel';
        const isCarvedTrail = variant === 'carved';
        const isApexPattern =
          variant === 'alloy' ||
          variant === 'prismatic' ||
          variant === 'gridforge' ||
          variant === 'diamond' ||
          variant === 'sunken' ||
          variant === 'ripple';
        const platformScaleX = tile.platform === 'narrow_bridge' ? 0.42 : tile.platform === 'icy_half_pipe' ? 1.12 : 1;
        const platformScaleY = tile.platform === 'weight_sensitive_bridge' ? 0.84 : tile.platform === 'crushing_ceiling' ? 1.08 : 1;
        const platformScaleZ = tile.platform === 'narrow_bridge' ? 1.06 : tile.platform === 'icy_half_pipe' ? 1.22 : 1;
        const tileScaleX = (isVoxelTrail ? 0.94 : isCarvedTrail ? 0.985 : isApexPattern ? 1.01 : 1) * platformScaleX;
        const tileScaleY = isVoxelTrail ? 1.06 : isCarvedTrail ? 0.96 : isApexPattern ? 1.02 : 1;
        const tileScaleZ = (isVoxelTrail ? 0.94 : isCarvedTrail ? 0.985 : isApexPattern ? 1.01 : 1) * platformScaleZ;

        w.dummy.position.set(x, y, z);
        w.dummy.rotation.set(0, 0, 0);
        w.dummy.scale.set(tileScaleX, tileScaleY * platformScaleY, tileScaleZ);
        w.dummy.updateMatrix();
        tileMesh.setMatrixAt(i, w.dummy.matrix);

        w.tempColorA.copy(tile.bonus ? COLOR_BONUS : COLOR_PATH).lerp(COLOR_TRAIL, tile.painted ? (tile.bonus ? 0.72 : 1) : 0);
        if (tile.bonus && !tile.painted) {
          w.tempColorA.lerp(COLOR_WHITE, 0.12 + Math.sin(w.simTime * 5 + tile.index * 0.3) * 0.06);
        }
        if (tile.index === w.currentTileIndex && stepsState.phase === 'playing') {
          w.tempColorA.lerp(COLOR_WHITE, 0.22 + snap.pressure * 0.2);
        }
        if (tile.drop > 0) {
          w.tempColorA.lerp(COLOR_FALL, clamp(tile.drop / 2.5, 0, 1));
        }
        const platformColor = platformTint(tile.platform);
        w.tempColorA.lerp(platformColor, 0.14 + tile.platformMotion * 0.2);
        w.tempColorA.lerp(VARIANT_ACCENTS[variant], isApexPattern ? 0.2 : variant === 'voxel' || variant === 'carved' ? 0.14 : 0.06);
        if (hazardState && !tile.bonus) {
          w.tempColorA.lerp(COLOR_HAZARD_SAFE, hazardState.openBlend * 0.1);
          w.tempColorA.lerp(COLOR_HAZARD_DANGER, hazardThreat * 0.38 + dangerPulse * 0.08);
        }
        tileMesh.setColorAt(i, w.tempColorA);

        const detailBase = i * TRAIL_DETAIL_SLOTS;
        let detailSlot = 0;
        const detailTop = y + TILE_HEIGHT * 0.5 + 0.012;
        const stylePulse = 0.5 + 0.5 * Math.sin(w.simTime * 2.8 + tile.index * 0.24);
        const variantAccent = VARIANT_ACCENTS[variant];
        const writeDetail = (
          px: number,
          py: number,
          pz: number,
          rx: number,
          ry: number,
          rz: number,
          sx: number,
          sy: number,
          sz: number,
          color: THREE.Color
        ) => {
          if (detailSlot >= TRAIL_DETAIL_SLOTS) return;
          const slot = detailBase + detailSlot;
          w.dummy.position.set(px, py, pz);
          w.dummy.rotation.set(rx, ry, rz);
          w.dummy.scale.set(sx, sy, sz);
          w.dummy.updateMatrix();
          trailDetailMesh.setMatrixAt(slot, w.dummy.matrix);
          trailDetailMesh.setColorAt(slot, color);
          detailSlot += 1;
        };
        const hideUnusedDetails = () => {
          while (detailSlot < TRAIL_DETAIL_SLOTS) {
            hideInstance(trailDetailMesh, detailBase + detailSlot);
            detailSlot += 1;
          }
        };

        if (variant === 'voxel') {
          const side = tile.index % 2 === 0 ? 1 : -1;
          writeDetail(
            x,
            detailTop + 0.052 + stylePulse * 0.012,
            z,
            0,
            0,
            0,
            0.46,
            0.12,
            0.46,
            w.tempColorC.copy(w.tempColorA).lerp(COLOR_WHITE, 0.16)
          );
          writeDetail(
            x + 0.28 * side,
            detailTop + 0.036,
            z - 0.28 * side,
            0,
            0,
            0,
            0.2,
            0.1,
            0.2,
            w.tempColorC.copy(w.tempColorA).lerp(COLOR_WHITE, 0.06)
          );
          writeDetail(
            x - 0.28 * side,
            detailTop + 0.034,
            z + 0.28 * side,
            0,
            0,
            0,
            0.2,
            0.1,
            0.2,
            w.tempColorC.copy(w.tempColorA).lerp(COLOR_FALL, 0.12)
          );
          writeDetail(
            x + 0.12 * side,
            detailTop + 0.02,
            z + 0.18 * side,
            0,
            0,
            0,
            0.16,
            0.06,
            0.16,
            w.tempColorC.copy(w.tempColorA).lerp(COLOR_WHITE, 0.08)
          );
          writeDetail(
            x - 0.12 * side,
            detailTop + 0.02,
            z - 0.18 * side,
            0,
            0,
            0,
            0.16,
            0.06,
            0.16,
            w.tempColorC.copy(w.tempColorA).lerp(COLOR_WHITE, 0.04)
          );
        } else if (variant === 'carved') {
          const axisX = tile.index % 2 === 0;
          const carvedColor = w.tempColorC.copy(w.tempColorA).lerp(COLOR_FALL, 0.44);
          writeDetail(
            x,
            detailTop,
            z,
            0,
            axisX ? 0 : Math.PI * 0.5,
            0,
            0.78,
            0.026,
            0.1,
            carvedColor
          );
          writeDetail(
            x,
            detailTop + 0.002,
            z,
            0,
            axisX ? Math.PI * 0.5 : 0,
            0,
            0.48,
            0.024,
            0.1,
            carvedColor
          );
          writeDetail(
            x,
            detailTop + 0.004,
            z,
            0,
            Math.PI * 0.25,
            0,
            0.34,
            0.018,
            0.08,
            w.tempColorC.copy(carvedColor).lerp(COLOR_WHITE, 0.08)
          );
          writeDetail(
            x,
            detailTop + 0.003,
            z,
            0,
            -Math.PI * 0.25,
            0,
            0.34,
            0.018,
            0.08,
            w.tempColorC.copy(carvedColor).lerp(COLOR_FALL, 0.1)
          );
        } else if (variant === 'alloy') {
          const seamColor = w.tempColorC.copy(w.tempColorA).lerp(variantAccent, 0.48).lerp(COLOR_WHITE, 0.12);
          writeDetail(x, detailTop + 0.012, z - 0.22, 0, 0, 0, 0.72, 0.024, 0.08, seamColor);
          writeDetail(x, detailTop + 0.012, z + 0.22, 0, 0, 0, 0.72, 0.024, 0.08, seamColor);
          writeDetail(x - 0.22, detailTop + 0.012, z, 0, 0, 0, 0.08, 0.024, 0.72, seamColor);
          writeDetail(x + 0.22, detailTop + 0.012, z, 0, 0, 0, 0.08, 0.024, 0.72, seamColor);
          writeDetail(
            x,
            detailTop + 0.018 + stylePulse * 0.01,
            z,
            0,
            Math.PI * 0.25,
            0,
            0.62,
            0.02,
            0.1,
            w.tempColorC.copy(variantAccent).lerp(COLOR_WHITE, 0.22)
          );
          writeDetail(
            x,
            detailTop + 0.018 + stylePulse * 0.01,
            z,
            0,
            -Math.PI * 0.25,
            0,
            0.62,
            0.02,
            0.1,
            w.tempColorC.copy(variantAccent).lerp(COLOR_WHITE, 0.22)
          );
        } else if (variant === 'prismatic') {
          const armColor = w.tempColorC.copy(w.tempColorA).lerp(variantAccent, 0.54);
          const spin = tile.index * 0.09 + w.simTime * 0.18;
          for (let shard = 0; shard < 6; shard += 1) {
            const angle = spin + (Math.PI * 2 * shard) / 6;
            const px = x + Math.cos(angle) * 0.24;
            const pz = z + Math.sin(angle) * 0.24;
            writeDetail(
              px,
              detailTop + 0.014 + Math.sin(angle + w.simTime * 0.9) * 0.006,
              pz,
              0,
              angle,
              0,
              0.24,
              0.02,
              0.08,
              armColor
            );
          }
          writeDetail(
            x,
            detailTop + 0.024 + stylePulse * 0.016,
            z,
            0,
            spin,
            0,
            0.16,
            0.022,
            0.16,
            w.tempColorC.copy(variantAccent).lerp(COLOR_WHITE, 0.28 + stylePulse * 0.2)
          );
        } else if (variant === 'gridforge') {
          const gridColor = w.tempColorC.copy(w.tempColorA).lerp(variantAccent, 0.5).lerp(COLOR_WHITE, 0.08);
          for (let lane = -1; lane <= 1; lane += 1) {
            const offset = lane * 0.22;
            writeDetail(x + offset, detailTop + 0.008, z, 0, 0, 0, 0.06, 0.02, 0.78, gridColor);
            writeDetail(x, detailTop + 0.008, z + offset, 0, 0, 0, 0.78, 0.02, 0.06, gridColor);
          }
          writeDetail(
            x,
            detailTop + 0.02 + stylePulse * 0.012,
            z,
            0,
            Math.PI * 0.25,
            0,
            0.22,
            0.02,
            0.22,
            w.tempColorC.copy(variantAccent).lerp(COLOR_WHITE, 0.22)
          );
        } else if (variant === 'diamond') {
          const diamondColor = w.tempColorC.copy(w.tempColorA).lerp(variantAccent, 0.52);
          writeDetail(x, detailTop + 0.014, z, 0, Math.PI * 0.25, 0, 0.66, 0.02, 0.12, diamondColor);
          writeDetail(x, detailTop + 0.014, z, 0, -Math.PI * 0.25, 0, 0.66, 0.02, 0.12, diamondColor);
          writeDetail(x, detailTop + 0.02, z, 0, 0, 0, 0.26, 0.02, 0.26, w.tempColorC.copy(variantAccent).lerp(COLOR_WHITE, 0.24));
          writeDetail(
            x,
            detailTop + 0.026 + stylePulse * 0.012,
            z,
            0,
            tile.index * 0.1,
            0,
            0.14,
            0.018,
            0.14,
            w.tempColorC.copy(variantAccent).lerp(COLOR_WHITE, 0.32 + stylePulse * 0.16)
          );
        } else if (variant === 'sunken') {
          const rimColor = w.tempColorC.copy(w.tempColorA).lerp(variantAccent, 0.46);
          const pitColor = w.tempColorC.copy(variantAccent).lerp(COLOR_FALL, 0.42);
          writeDetail(x, detailTop + 0.006, z - 0.29, 0, 0, 0, 0.72, 0.018, 0.08, rimColor);
          writeDetail(x, detailTop + 0.006, z + 0.29, 0, 0, 0, 0.72, 0.018, 0.08, rimColor);
          writeDetail(x - 0.29, detailTop + 0.006, z, 0, 0, 0, 0.08, 0.018, 0.72, rimColor);
          writeDetail(x + 0.29, detailTop + 0.006, z, 0, 0, 0, 0.08, 0.018, 0.72, rimColor);
          writeDetail(x, detailTop - 0.004, z, 0, 0, 0, 0.44, 0.012, 0.44, pitColor);
          writeDetail(
            x,
            detailTop + 0.012 + stylePulse * 0.01,
            z,
            0,
            Math.PI * 0.25,
            0,
            0.22,
            0.014,
            0.22,
            w.tempColorC.copy(variantAccent).lerp(COLOR_WHITE, 0.18)
          );
        } else if (variant === 'ripple') {
          const rippleColor = w.tempColorC.copy(w.tempColorA).lerp(variantAccent, 0.5).lerp(COLOR_WHITE, 0.08);
          const ringA = 0.68 + stylePulse * 0.08;
          const ringB = 0.5 + stylePulse * 0.06;
          const ringC = 0.32 + stylePulse * 0.04;
          writeDetail(x, detailTop + 0.006, z, 0, 0, 0, ringA, 0.016, 0.06, rippleColor);
          writeDetail(x, detailTop + 0.006, z, 0, Math.PI * 0.5, 0, ringA, 0.016, 0.06, rippleColor);
          writeDetail(x, detailTop + 0.01, z, 0, 0, 0, ringB, 0.016, 0.06, rippleColor);
          writeDetail(x, detailTop + 0.01, z, 0, Math.PI * 0.5, 0, ringB, 0.016, 0.06, rippleColor);
          writeDetail(x, detailTop + 0.014, z, 0, 0, 0, ringC, 0.016, 0.06, rippleColor);
          writeDetail(x, detailTop + 0.014, z, 0, Math.PI * 0.5, 0, ringC, 0.016, 0.06, rippleColor);
          writeDetail(
            x,
            detailTop + 0.02 + stylePulse * 0.016,
            z,
            0,
            tile.index * 0.1,
            0,
            0.14,
            0.018,
            0.14,
            w.tempColorC.copy(variantAccent).lerp(COLOR_WHITE, 0.3 + stylePulse * 0.18)
          );
        }
        hideUnusedDetails();

        if (PLATFORM_SPECIAL_SET.has(tile.platform)) {
          const profile = platformSignalProfile(tile.platform);
          const signalPulse = 0.5 + 0.5 * Math.sin(w.simTime * 4.2 + tile.platformPhase * 1.7);
          const signalScale = profile.scale + tile.platformMotion * 0.08 + signalPulse * 0.03;
          w.dummy.position.set(x, y + TILE_HEIGHT * 0.52 + profile.lift + signalPulse * 0.04, z);
          w.dummy.rotation.set(
            Math.PI * 0.5,
            w.simTime * profile.spin + tile.platformPhase,
            Math.sin(w.simTime * 1.4 + tile.platformPhase) * 0.08
          );
          w.dummy.scale.set(signalScale, signalScale, profile.thickness + tile.platformMotion * 0.05);
          w.dummy.updateMatrix();
          platformSignalMesh.setMatrixAt(i, w.dummy.matrix);
          w.tempColorB
            .copy(platformColor)
            .lerp(variantAccent, 0.16)
            .lerp(COLOR_WHITE, 0.18 + signalPulse * 0.2 + tile.platformMotion * 0.22);
          platformSignalMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(platformSignalMesh, i);
        }

        if (tile.hazard !== 'none' && hazardState && hazardProfile) {
          const auraPulse = 0.5 + 0.5 * Math.sin(w.simTime * (2.6 + hazardProfile.pulse * 0.5) + tile.hazardPhase);
          const auraScale = 0.62 + hazardThreat * 0.56 + auraPulse * 0.16;
          const auraThickness = 0.05 + hazardThreat * 0.04 + dangerPulse * 0.02;
          w.dummy.position.set(x, y + TILE_HEIGHT * 0.5 + 0.02 + hazardProfile.lift * 0.12, z);
          w.dummy.rotation.set(Math.PI * 0.5, w.simTime * (0.7 + hazardProfile.spin * 0.4), 0);
          w.dummy.scale.set(auraScale, auraScale, auraThickness);
          w.dummy.updateMatrix();
          hazardAuraMesh.setMatrixAt(i, w.dummy.matrix);
          w.tempColorB
            .copy(hazardTint(tile.hazard))
            .lerp(COLOR_HAZARD_SAFE, hazardState.openBlend * 0.2)
            .lerp(COLOR_HAZARD_DANGER, 0.34 + hazardThreat * 0.42)
            .lerp(COLOR_WHITE, 0.1 + dangerPulse * 0.16);
          hazardAuraMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(hazardAuraMesh, i);
        }

        const hazardVisual = hazardVisualFor(tile.hazard);

        if (hazardVisual === 'spire' && hazardState && hazardProfile) {
          const bob =
            Math.sin(w.simTime * (1.8 + hazardProfile.pulse + hazardThreat * 2.2) + tile.hazardPhase) *
            0.02 *
            hazardThreat;
          const yLift = -0.24 * (1 - hazardThreat) + hazardProfile.lift + bob;
          const spikeRadius = THREE.MathUtils.lerp(
            hazardProfile.radiusBase,
            hazardProfile.radiusBase + hazardProfile.radiusGain,
            hazardThreat
          );
          const spikeHeight = THREE.MathUtils.lerp(
            hazardProfile.heightBase,
            hazardProfile.heightBase + hazardProfile.heightGain,
            hazardThreat
          );

          w.dummy.position.set(x, y + TILE_HEIGHT * 0.53 + yLift, z);
          w.dummy.rotation.set(
            Math.sin(w.simTime * 1.4 + tile.hazardPhase) * hazardProfile.tilt,
            tile.hazardPhase + w.simTime * (0.2 + hazardProfile.spin),
            Math.cos(w.simTime * 1.2 + tile.hazardPhase) * hazardProfile.tilt * 0.4
          );
          w.dummy.scale.set(spikeRadius, spikeHeight, spikeRadius);
          w.dummy.updateMatrix();
          spikeMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorB
            .copy(hazardTint(tile.hazard))
            .lerp(COLOR_HAZARD_DANGER, 0.44 + hazardThreat * (0.24 + hazardProfile.colorHeat * 0.2))
            .lerp(COLOR_WHITE, 0.06 + dangerPulse * 0.16);
          spikeMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(spikeMesh, i);
        }

        if (hazardVisual === 'rotor' && hazardState && hazardProfile) {
          const radius = THREE.MathUtils.lerp(
            hazardProfile.radiusBase,
            hazardProfile.radiusBase + hazardProfile.radiusGain,
            hazardThreat
          );
          const thickness = THREE.MathUtils.lerp(
            hazardProfile.heightBase,
            hazardProfile.heightBase + hazardProfile.heightGain * 0.34,
            hazardThreat
          );
          const lateral =
            Math.sin(w.simTime * (1.2 + hazardProfile.pulse + hazardThreat * 2.8) + tile.hazardPhase) *
            hazardProfile.drift *
            0.42;
          const lift = -0.16 * (1 - hazardThreat) + hazardProfile.lift;

          w.dummy.position.set(x + lateral, y + TILE_HEIGHT * 0.53 + lift, z);
          w.dummy.rotation.set(
            Math.sin(w.simTime * 0.8 + tile.hazardPhase) * hazardProfile.tilt,
            w.simTime * (1.4 + hazardProfile.spin * 2.2) + tile.hazardPhase,
            Math.cos(w.simTime * 0.75 + tile.hazardPhase) * hazardProfile.tilt
          );
          w.dummy.scale.set(radius, thickness, radius);
          w.dummy.updateMatrix();
          sawMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorB
            .copy(hazardTint(tile.hazard))
            .lerp(COLOR_HAZARD_DANGER, 0.42 + hazardThreat * (0.24 + hazardProfile.colorHeat * 0.22))
            .lerp(COLOR_WHITE, 0.08 + dangerPulse * 0.13);
          sawMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(sawMesh, i);
        }

        if (hazardVisual === 'beam' && hazardState && hazardProfile) {
          const slideSign = tile.index % 2 === 0 ? 1 : -1;
          const slide = slideSign * (1 - hazardThreat) * hazardProfile.drift * 0.7;
          const width = THREE.MathUtils.lerp(
            hazardProfile.radiusBase,
            hazardProfile.radiusBase + hazardProfile.radiusGain,
            hazardThreat
          );
          const height = THREE.MathUtils.lerp(
            hazardProfile.heightBase,
            hazardProfile.heightBase + hazardProfile.heightGain,
            hazardThreat
          );

          w.dummy.position.set(
            x + (tile.index % 2 === 0 ? slide : 0),
            y + TILE_HEIGHT * 0.53 + hazardProfile.lift,
            z + (tile.index % 2 === 0 ? 0 : slide)
          );
          w.dummy.rotation.set(
            0,
            tile.index % 2 === 0 ? 0 : Math.PI * 0.5,
            Math.sin(w.simTime * (1 + hazardProfile.pulse) + tile.hazardPhase) * hazardProfile.tilt
          );
          w.dummy.scale.set(width, height, 0.12 + hazardThreat * 0.08);
          w.dummy.updateMatrix();
          clampMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorB
            .copy(hazardTint(tile.hazard))
            .lerp(COLOR_HAZARD_DANGER, 0.44 + hazardThreat * (0.24 + hazardProfile.colorHeat * 0.24))
            .lerp(COLOR_WHITE, 0.1 + dangerPulse * 0.18);
          clampMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(clampMesh, i);
        }

        if (hazardVisual === 'orb' && hazardState && hazardProfile) {
          const drift =
            Math.sin(w.simTime * (1.8 + hazardProfile.pulse + hazardThreat * 2.4) + tile.hazardPhase) *
            hazardProfile.drift *
            0.55;
          const bob =
            Math.cos(w.simTime * (1.7 + hazardProfile.pulse) + tile.hazardPhase) * 0.05 * hazardThreat;
          const radius = THREE.MathUtils.lerp(
            hazardProfile.radiusBase,
            hazardProfile.radiusBase + hazardProfile.radiusGain,
            hazardThreat
          );

          w.dummy.position.set(x + drift, y + TILE_HEIGHT * 0.53 + hazardProfile.lift + bob, z);
          w.dummy.rotation.set(
            w.simTime * (0.8 + hazardProfile.spin),
            w.simTime * (1.3 + hazardProfile.spin * 1.2),
            w.simTime * (0.65 + hazardProfile.spin * 0.8)
          );
          w.dummy.scale.set(radius, radius, radius);
          w.dummy.updateMatrix();
          swingMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorB
            .copy(hazardTint(tile.hazard))
            .lerp(COLOR_HAZARD_DANGER, 0.4 + hazardThreat * (0.26 + hazardProfile.colorHeat * 0.2))
            .lerp(COLOR_WHITE, 0.08 + dangerPulse * 0.15);
          swingMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(swingMesh, i);
        }

        if (hazardVisual === 'portal' && hazardState && hazardProfile) {
          const ripple =
            Math.sin(w.simTime * (2.4 + hazardProfile.pulse) + tile.hazardPhase * 1.7) *
            0.12 *
            hazardThreat;
          const radius = THREE.MathUtils.lerp(
            hazardProfile.radiusBase,
            hazardProfile.radiusBase + hazardProfile.radiusGain + ripple,
            hazardThreat
          );
          const thickness = THREE.MathUtils.lerp(
            hazardProfile.heightBase,
            hazardProfile.heightBase + hazardProfile.heightGain * 0.2,
            hazardThreat
          );

          w.dummy.position.set(x, y + TILE_HEIGHT * 0.53 + hazardProfile.lift, z);
          w.dummy.rotation.set(
            Math.PI * 0.5 + Math.sin(w.simTime * 0.6 + tile.hazardPhase) * hazardProfile.tilt * 0.2,
            w.simTime * (1 + hazardProfile.spin) + tile.hazardPhase,
            0
          );
          w.dummy.scale.set(radius, radius, thickness);
          w.dummy.updateMatrix();
          ringMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorB
            .copy(hazardTint(tile.hazard))
            .lerp(COLOR_HAZARD_SAFE, 0.16 + hazardState.openBlend * 0.12)
            .lerp(COLOR_HAZARD_DANGER, 0.28 + hazardThreat * (0.2 + hazardProfile.colorHeat * 0.2))
            .lerp(COLOR_WHITE, 0.08 + dangerPulse * 0.16);
          ringMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(ringMesh, i);
        }

        if (tile.hazard !== 'none') {
          const beaconPulse = 0.5 + 0.5 * Math.sin(w.simTime * 5.2 + tile.hazardPhase * 1.7);
          const profileRadius = hazardProfile ? hazardProfile.radiusGain : 0.5;
          const beaconScale = 0.14 + hazardThreat * (0.16 + profileRadius * 0.1) + beaconPulse * 0.08;
          const beaconY = y + TILE_HEIGHT * 0.52 + 0.3 + beaconPulse * 0.08;
          w.dummy.position.set(x, beaconY, z);
          w.dummy.rotation.set(0, w.simTime * 0.8 + tile.hazardPhase, 0);
          w.dummy.scale.set(beaconScale, beaconScale, beaconScale);
          w.dummy.updateMatrix();
          warningMesh.setMatrixAt(i, w.dummy.matrix);
          w.tempColorB.copy(COLOR_WARNING).lerp(COLOR_WHITE, 0.08 + beaconPulse * 0.2 + hazardThreat * 0.18);
          warningMesh.setColorAt(i, w.tempColorB);
        } else {
          hideInstance(warningMesh, i);
        }

        if (tile.hasGem && !tile.gemTaken && tile.drop < 1.1) {
          const gemBob = Math.sin(w.simTime * 6 + tile.hazardPhase * 1.3) * 0.09;
          const gemScale = 0.54 + Math.sin(w.simTime * 8 + tile.index * 0.22) * 0.06;

          w.dummy.position.set(x, y + TILE_HEIGHT * 0.5 + 0.24 + gemBob, z);
          w.dummy.rotation.set(w.simTime * 0.4, w.simTime * 1.8, 0);
          w.dummy.scale.set(gemScale, gemScale, gemScale);
          w.dummy.updateMatrix();
          gemMesh.setMatrixAt(i, w.dummy.matrix);

          w.tempColorC.copy(COLOR_GEM).lerp(COLOR_GEM_BRIGHT, 0.5 + gemBob * 0.7);
          gemMesh.setColorAt(i, w.tempColorC);
        } else {
          hideInstance(gemMesh, i);
        }
      }

      tileMesh.instanceMatrix.needsUpdate = true;
      trailDetailMesh.instanceMatrix.needsUpdate = true;
      spikeMesh.instanceMatrix.needsUpdate = true;
      sawMesh.instanceMatrix.needsUpdate = true;
      clampMesh.instanceMatrix.needsUpdate = true;
      swingMesh.instanceMatrix.needsUpdate = true;
      ringMesh.instanceMatrix.needsUpdate = true;
      platformSignalMesh.instanceMatrix.needsUpdate = true;
      hazardAuraMesh.instanceMatrix.needsUpdate = true;
      warningMesh.instanceMatrix.needsUpdate = true;
      gemMesh.instanceMatrix.needsUpdate = true;

      if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;
      if (trailDetailMesh.instanceColor) trailDetailMesh.instanceColor.needsUpdate = true;
      if (spikeMesh.instanceColor) spikeMesh.instanceColor.needsUpdate = true;
      if (sawMesh.instanceColor) sawMesh.instanceColor.needsUpdate = true;
      if (clampMesh.instanceColor) clampMesh.instanceColor.needsUpdate = true;
      if (swingMesh.instanceColor) swingMesh.instanceColor.needsUpdate = true;
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
      if (platformSignalMesh.instanceColor) platformSignalMesh.instanceColor.needsUpdate = true;
      if (hazardAuraMesh.instanceColor) hazardAuraMesh.instanceColor.needsUpdate = true;
      if (warningMesh.instanceColor) warningMesh.instanceColor.needsUpdate = true;
      if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;
    }

    if (debrisMeshRef.current) {
      const debrisMesh = debrisMeshRef.current;
      for (let i = 0; i < DEBRIS_POOL; i += 1) {
        const d = w.debris[i];
        if (!d.active) {
          hideInstance(debrisMesh, i);
          continue;
        }

        w.dummy.position.copy(d.pos);
        w.dummy.rotation.set(d.rot.x, d.rot.y, d.rot.z);
        w.dummy.scale.set(d.size, d.size, d.size);
        w.dummy.updateMatrix();
        debrisMesh.setMatrixAt(i, w.dummy.matrix);
      }
      debrisMesh.instanceMatrix.needsUpdate = true;
    }

    if (playerRef.current) {
      const player = playerRef.current;
      const [baseScaleX, baseScaleY, baseScaleZ] = runnerBaseScale(snap.runnerShape);
      player.position.set(w.px, w.py + runnerVerticalOffset(snap.runnerShape), w.pz);

      if (w.falling) {
        player.rotation.x += dtRender * w.deathSpin;
        player.rotation.z += dtRender * w.deathSpin * 0.66;
        player.scale.set(1.04 * baseScaleX, 0.7 * baseScaleY, 1.04 * baseScaleZ);
      } else {
        player.rotation.x = easingLerp(player.rotation.x, 0, dtRender, 12);
        player.rotation.z = easingLerp(player.rotation.z, 0, dtRender, 12);
        const yawTarget = w.simTime < w.rotationLockUntil ? w.playerYaw * 0.3 : w.playerYaw;
        player.rotation.y = easingLerp(player.rotation.y, yawTarget, dtRender, 14);

        const stride = w.moving ? Math.sin(Math.PI * clamp(w.moveT, 0, 1)) : 0;
        const boostSquash = w.simTime < w.speedBoostUntil ? 0.08 : 0;
        const sizeTarget = w.simTime < w.sizeShiftUntil ? w.sizeShiftScale : 1;
        const sx = (1 + stride * (0.12 + boostSquash)) * sizeTarget * baseScaleX;
        const sy = (1 - stride * 0.17) * sizeTarget * baseScaleY;
        const sz = (1 + stride * (0.12 + boostSquash)) * sizeTarget * baseScaleZ;
        player.scale.set(sx, sy, sz);
      }
    }

    w.cameraShake = Math.max(0, w.cameraShake - dtRender * 2.8);
    const shakeX = (Math.sin(w.simTime * 37) + Math.cos(w.simTime * 25)) * 0.02 * w.cameraShake;
    const shakeZ = (Math.cos(w.simTime * 31) + Math.sin(w.simTime * 21)) * 0.02 * w.cameraShake;

    const focusX = w.moving
      ? THREE.MathUtils.lerp(w.moveFromX, w.moveToX, clamp(w.moveT + 0.2, 0, 1))
      : w.px;
    const focusZ = w.moving
      ? THREE.MathUtils.lerp(w.moveFromZ, w.moveToZ, clamp(w.moveT + 0.2, 0, 1))
      : w.pz;

    w.camTarget.set(focusX + 6.5, 7.5, focusZ + 6.5);

    camera.position.x = easingLerp(camera.position.x, w.camTarget.x + shakeX, dtRender, 5.2);
    camera.position.y = easingLerp(camera.position.y, w.camTarget.y, dtRender, 5.2);
    camera.position.z = easingLerp(camera.position.z, w.camTarget.z + shakeZ, dtRender, 5.2);

    const targetFov =
      35 +
      snap.pressure * 4 +
      (w.falling ? 2 : 0) +
      (w.simTime < w.speedBoostUntil ? 3.6 : 0) +
      (w.simTime < w.controlsInvertedUntil ? 1.8 : 0) -
      (w.simTime < w.timeSlowUntil ? 1.6 : 0);
    if ('fov' in camera) {
      const perspective = camera as THREE.PerspectiveCamera;
      perspective.fov = easingLerp(perspective.fov, targetFov, dtRender, 4.4);
      perspective.updateProjectionMatrix();
    }
    camera.lookAt(focusX, 0.25, focusZ);
  });

  const collapsePct = Math.round(clamp(snap.pressure, 0, 1) * 100);
  const currentTile = world.current.tilesByIndex.get(world.current.currentTileIndex);
  const nextTile = world.current.tilesByIndex.get(world.current.currentTileIndex + 1);
  const bonusActive = Boolean(currentTile?.bonus);
  const currentPlatform = currentTile?.platform ?? 'standard';
  const currentHazard = currentTile?.hazard ?? 'none';
  const nextPlatform = nextTile?.platform ?? 'standard';
  const nextHazard = nextTile?.hazard ?? 'none';
  const currentHazardState = currentTile ? hazardStateAt(currentTile, world.current.simTime) : null;
  const currentPlatformState = currentTile ? platformStateAt(currentTile, world.current.simTime) : null;
  const nextHazardState = nextTile ? hazardStateAt(nextTile, world.current.simTime) : null;
  const nextPlatformState = nextTile ? platformStateAt(nextTile, world.current.simTime) : null;
  const currentHazardThreatPct = currentHazardState ? Math.round((1 - currentHazardState.openBlend) * 100) : 0;
  const nextHazardThreatPct = nextHazardState ? Math.round((1 - nextHazardState.openBlend) * 100) : 0;
  const currentPlatformWindowPct = currentPlatformState ? Math.round(currentPlatformState.openBlend * 100) : 100;
  const nextPlatformWindowPct = nextPlatformState ? Math.round(nextPlatformState.openBlend * 100) : 100;
  const jumpChargePct = Math.round(clamp(world.current.tapCharge, 0, 1) * 100);

  return (
    <group>
      <ambientLight intensity={0.58} />
      <directionalLight position={[7, 11, 6]} intensity={0.96} castShadow />
      <pointLight position={[2, 3, 2]} intensity={0.38} color="#8af2ff" />
      <pointLight position={[8, 2, 8]} intensity={0.32} color="#ff9fdf" />

      <mesh rotation-x={-Math.PI * 0.5} position={[140, -0.12, 140]}>
        <planeGeometry args={[620, 620]} />
        <shaderMaterial
          ref={bgMaterialRef}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              vec2 p = vUv * 60.0;
              vec2 cell = fract(p);
              vec2 center = cell - 0.5;
              float diamond = abs(center.x) + abs(center.y);
              float mask = smoothstep(0.55, 0.43, diamond);

              vec3 a = vec3(0.16, 0.70, 0.96);
              vec3 b = vec3(0.13, 0.58, 0.92);
              float wave = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 8.0 - uTime * 0.45);
              vec3 base = mix(a, b, wave);
              vec3 high = base + vec3(0.06, 0.08, 0.1);
              vec3 color = mix(base, high, mask * 0.28);
              gl_FragColor = vec4(color, 1.0);
            }
          `}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={tileMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]} castShadow receiveShadow>
        <boxGeometry args={[TILE_SIZE, TILE_HEIGHT, TILE_SIZE]} />
        <meshStandardMaterial vertexColors roughness={0.48} metalness={0.05} />
      </instancedMesh>

      <instancedMesh ref={trailDetailMeshRef} args={[undefined, undefined, MAX_TRAIL_DETAIL]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial vertexColors roughness={0.42} metalness={0.12} />
      </instancedMesh>

      <instancedMesh ref={spikeMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <coneGeometry args={[0.2, 0.46, 16]} />
        <meshStandardMaterial vertexColors roughness={0.28} metalness={0.22} emissive="#ff2d55" emissiveIntensity={0.18} />
      </instancedMesh>

      <instancedMesh ref={sawMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <torusGeometry args={[0.26, 0.08, 10, 18]} />
        <meshStandardMaterial vertexColors roughness={0.2} metalness={0.64} emissive="#ff2f6f" emissiveIntensity={0.24} />
      </instancedMesh>

      <instancedMesh ref={clampMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <cylinderGeometry args={[0.12, 0.12, 1, 10]} />
        <meshStandardMaterial vertexColors roughness={0.26} metalness={0.3} emissive="#ff3f7f" emissiveIntensity={0.22} />
      </instancedMesh>

      <instancedMesh ref={swingMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial vertexColors roughness={0.18} metalness={0.28} emissive="#ff8a00" emissiveIntensity={0.24} />
      </instancedMesh>

      <instancedMesh ref={ringMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <torusGeometry args={[0.22, 0.06, 10, 20]} />
        <meshStandardMaterial vertexColors roughness={0.2} metalness={0.34} emissive="#3dcfff" emissiveIntensity={0.2} />
      </instancedMesh>

      <instancedMesh ref={platformSignalMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <torusGeometry args={[0.22, 0.05, 10, 28]} />
        <meshStandardMaterial vertexColors roughness={0.2} metalness={0.48} emissive="#8bc3ff" emissiveIntensity={0.3} />
      </instancedMesh>

      <instancedMesh ref={hazardAuraMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <torusGeometry args={[0.26, 0.045, 10, 24]} />
        <meshStandardMaterial vertexColors roughness={0.2} metalness={0.34} emissive="#ff1744" emissiveIntensity={0.28} />
      </instancedMesh>

      <instancedMesh ref={warningMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <octahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial vertexColors roughness={0.2} metalness={0.2} emissive="#ff1744" emissiveIntensity={0.28} />
      </instancedMesh>

      <instancedMesh ref={gemMeshRef} args={[undefined, undefined, MAX_RENDER_TILES]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.18}
          metalness={0.26}
          emissive="#4cffc9"
          emissiveIntensity={0.52}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh ref={debrisMeshRef} args={[undefined, undefined, DEBRIS_POOL]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color={'#ffd9f1'} roughness={0.26} metalness={0.08} />
      </instancedMesh>

      <mesh ref={playerRef} castShadow geometry={playerGeometry}>
        <meshStandardMaterial color={'#f85db6'} roughness={0.34} metalness={0.1} emissive="#ff94d4" emissiveIntensity={0.12} />
      </mesh>

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.58} luminanceThreshold={0.42} radius={0.7} mipmapBlur />
        <Vignette eskil={false} offset={0.17} darkness={0.46} />
        <Noise opacity={0.018} />
      </EffectComposer>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            color: 'white',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            textShadow: '0 2px 12px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.86, letterSpacing: 1.3 }}>STEPS</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{snap.score}</div>
          <div style={{ fontSize: 12, opacity: 0.82 }}>
            Gems +{snap.runGems} (Bank {snap.gems})
          </div>
          <div style={{ fontSize: 11, opacity: 0.68 }}>Best: {snap.best}</div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            pointerEvents: 'auto',
            background: 'rgba(10, 18, 38, 0.56)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12,
            padding: '10px 10px',
            backdropFilter: 'blur(6px)',
            color: 'white',
            width: 272,
            zIndex: 40,
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: 0.8, opacity: 0.84, marginBottom: 7 }}>STYLE + RUNNER</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>
            Path: {snap.pathStyle === 'smooth-classic' ? 'Smooth Classic' : snap.pathStyle}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TILE_STYLES.map((style) => (
              <button
                key={style}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => stepsState.setTileVariant(style)}
                style={{
                  opacity: snap.unlockedVariants.includes(style) ? 1 : 0.45,
                  cursor: 'pointer',
                  borderRadius: 999,
                  border:
                    snap.tileVariant === style ? '1px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.25)',
                  background:
                    snap.tileVariant === style ? 'linear-gradient(180deg, rgba(255,94,158,0.55), rgba(255,50,94,0.38))' : 'rgba(255,255,255,0.08)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '5px 9px',
                }}
              >
                {trailStyleLabel(style)}{snap.unlockedVariants.includes(style) ? '' : ' 🔒'}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 7, fontSize: 10, opacity: 0.74 }}>
            Unlocks from gem milestones. Unlocked {snap.unlockedVariants.length}/{TILE_STYLES.length}
          </div>
          {snap.lastUnlockedVariant && (
            <div style={{ marginTop: 4, fontSize: 10, color: '#fff4a3', fontWeight: 700 }}>
              New style unlocked: {trailStyleLabel(snap.lastUnlockedVariant)}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <button
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => stepsState.cycleTileVariant(-1)}
              style={{
                flex: 1,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 0',
                cursor: 'pointer',
              }}
            >
              Prev
            </button>
            <button
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => stepsState.cycleTileVariant(1)}
              style={{
                flex: 1,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 0',
                cursor: 'pointer',
              }}
            >
              Next
            </button>
          </div>
          <div style={{ marginTop: 9, fontSize: 10, opacity: 0.76, letterSpacing: 0.3 }}>
            Runner Shape: {runnerShapeLabel(snap.runnerShape)}
          </div>
          <div style={{ marginTop: 5, display: 'flex', gap: 6 }}>
            <button
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => stepsState.cycleRunnerShape(-1)}
              style={{
                flex: 1,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 0',
                cursor: 'pointer',
              }}
            >
              Prev Shape
            </button>
            <button
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => stepsState.cycleRunnerShape(1)}
              style={{
                flex: 1,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 0',
                cursor: 'pointer',
              }}
            >
              Next Shape
            </button>
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {RUNNER_SHAPES.map((shape) => (
              <button
                key={shape}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => stepsState.setRunnerShape(shape)}
                style={{
                  borderRadius: 999,
                  border:
                    snap.runnerShape === shape ? '1px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.22)',
                  background:
                    snap.runnerShape === shape
                      ? 'linear-gradient(180deg, rgba(116,227,255,0.45), rgba(74,155,255,0.28))'
                      : 'rgba(255,255,255,0.08)',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {runnerShapeLabel(shape)}
              </button>
            ))}
          </div>
        </div>

        {snap.phase === 'playing' && (
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 260,
              pointerEvents: 'none',
            }}
            >
            {bonusActive && (
              <div
                style={{
                  marginBottom: 6,
                  textAlign: 'center',
                  fontSize: 12,
                  letterSpacing: 1.6,
                  fontWeight: 800,
                  color: '#fff4a3',
                }}
              >
                BONUS STAGE
              </div>
            )}
            <div
              style={{
                height: 9,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.24)',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <div
                style={{
                  width: `${collapsePct}%`,
                  height: '100%',
                  background:
                    snap.pressure < 0.55
                      ? 'linear-gradient(90deg, #34d399, #10b981)'
                      : snap.pressure < 0.82
                        ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                  transition: 'width 80ms linear',
                }}
              />
            </div>
            <div
              style={{
                marginTop: 4,
                textAlign: 'center',
                fontSize: 11,
                color: 'rgba(255,255,255,0.92)',
                letterSpacing: 0.4,
              }}
            >
              Collapse Pressure {collapsePct}%
            </div>
            <div
              style={{
                marginTop: 4,
                textAlign: 'center',
                fontSize: 11,
                color: 'rgba(255,255,255,0.86)',
                letterSpacing: 0.4,
              }}
            >
              Current Platform: {platformLabel(currentPlatform)} ({currentPlatformWindowPct}% open)
            </div>
            <div
              style={{
                marginTop: 2,
                textAlign: 'center',
                fontSize: 10,
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: 0.25,
              }}
            >
              {PLATFORM_HINTS[currentPlatform]}
            </div>
            <div
              style={{
                marginTop: 5,
                textAlign: 'center',
                fontSize: 11,
                color: currentHazard === 'none' ? 'rgba(255,255,255,0.76)' : '#ffd2db',
                letterSpacing: 0.35,
              }}
            >
              Current Obstacle: {hazardLabel(currentHazard)}
              {currentHazard !== 'none' ? ` (${currentHazardThreatPct}% threat)` : ''}
            </div>
            {currentHazard !== 'none' && (
              <div
                style={{
                  marginTop: 2,
                  textAlign: 'center',
                  fontSize: 10,
                  color: 'rgba(255,220,230,0.8)',
                  letterSpacing: 0.2,
                }}
              >
                {HAZARD_HINTS[currentHazard]}
              </div>
            )}
            <div
              style={{
                marginTop: 5,
                textAlign: 'center',
                fontSize: 11,
                color: 'rgba(191,245,255,0.92)',
                letterSpacing: 0.35,
              }}
            >
              Next: {platformLabel(nextPlatform)} ({nextPlatformWindowPct}% open) / {hazardLabel(nextHazard)}
              {nextHazard !== 'none' ? ` (${nextHazardThreatPct}% threat)` : ''}
            </div>
            {(currentPlatform === 'trampoline' || currentPlatform === 'bouncer') && (
              <div
                style={{
                  marginTop: 4,
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#fff4a3',
                  letterSpacing: 0.4,
                }}
              >
                Jump Charge {jumpChargePct}%
              </div>
            )}
          </div>
        )}

        {(snap.phase === 'menu' || snap.phase === 'gameover') && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                width: 420,
                padding: 22,
                borderRadius: 18,
                background: 'rgba(7, 16, 34, 0.74)',
                border: '1px solid rgba(255,255,255,0.2)',
                textAlign: 'center',
                backdropFilter: 'blur(9px)',
                color: 'white',
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 1.2 }}>STEPS</div>
              <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>
                Tap to advance one step. Endless path generation and collapse chase stay active.
              </div>
              <div style={{ marginTop: 7, fontSize: 12, opacity: 0.82 }}>
                New obstacle suite: laser grids, gravity wells, cross blades, mines, lava, portals, trapdoors, and more.
              </div>
              <div style={{ marginTop: 5, fontSize: 11, opacity: 0.74 }}>
                Smooth Classic path + collapse chase. Special platforms and obstacle telegraphs are now color-coded for readability. Active style: {trailStyleLabel(snap.tileVariant)} | Runner: {runnerShapeLabel(snap.runnerShape)}
              </div>

              {snap.phase === 'gameover' && (
                <div style={{ marginTop: 14, fontSize: 14 }}>
                  <div style={{ fontWeight: 800 }}>Run over</div>
                  <div style={{ opacity: 0.9 }}>Score {snap.score}</div>
                  <div style={{ opacity: 0.78 }}>{snap.failReason}</div>
                </div>
              )}

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
                Click / Tap / Space = step  |  Enter = start  |  R = restart
              </div>
            </div>
          </div>
        )}
      </Html>
    </group>
  );
}

export default Steps;
