import type {
  OctaCameraMode,
  OctaObstacleType,
  OctaPathStyle,
  OctaPlatformType,
  OctaRunnerShape,
  OctaTileVariant,
  StageProfile,
} from './types';

export const OCTA_SURGE_TITLE = 'OctaSurge // Smooth Classic';

export const STORAGE_KEYS = {
  bestScore: 'rachos-fun-octasurge-best-score-v5',
  bestClassic: 'rachos-fun-octasurge-best-classic-v5',
  bestDaily: 'rachos-fun-octasurge-best-daily-v5',
  fxLevel: 'rachos-fun-octasurge-fx-level-v5',
  cameraMode: 'rachos-fun-octasurge-camera-mode-v5',
  tileVariant: 'rachos-fun-octasurge-tile-variant-v5',
  runnerShape: 'rachos-fun-octasurge-runner-shape-v1',
  unlockedVariants: 'rachos-fun-octasurge-unlocked-variants-v5',
  variantUnlockTier: 'rachos-fun-octasurge-variant-tier-v5',
  styleShards: 'rachos-fun-octasurge-style-shards-v5',
  lastReplay: 'rachos-fun-octasurge-last-replay-v2',
};

export const CAMERA_MODE_LABEL: Record<OctaCameraMode, string> = {
  chase: 'Chase',
  firstPerson: 'First Person',
  topDown: 'Top Down',
};

export const OCTA_PATH_STYLE_LABEL: Record<OctaPathStyle, string> = {
  'smooth-classic': 'Smooth Classic',
};

export const OCTA_TILE_VARIANTS: OctaTileVariant[] = [
  'classic',
  'alloy',
  'prismatic',
  'gridForge',
  'diamondTess',
  'sunkenSteps',
  'ripple',
];

export const OCTA_TILE_VARIANT_LABEL: Record<OctaTileVariant, string> = {
  classic: 'Classic',
  alloy: 'Alloy',
  prismatic: 'Prismatic',
  gridForge: 'GridForge',
  diamondTess: 'Diamond Tess',
  sunkenSteps: 'Sunken Steps',
  ripple: 'Ripple',
};

export const OCTA_TILE_VARIANT_ACCENT: Record<OctaTileVariant, string> = {
  classic: '#62dfff',
  alloy: '#a6f4ff',
  prismatic: '#df9fff',
  gridForge: '#40befe',
  diamondTess: '#9fe8ff',
  sunkenSteps: '#8dc9ff',
  ripple: '#62f3cc',
};

export const OCTA_TILE_UNLOCK_THRESHOLDS = [22, 46, 78, 118] as const;

export const OCTA_DEFAULT_UNLOCKED_VARIANTS: OctaTileVariant[] = [
  'classic',
  'alloy',
  'prismatic',
];

export const OCTA_RUNNER_SHAPES: OctaRunnerShape[] = [
  'cube',
  'tri_prism',
  'hex_prism',
  'pyramid',
  'tetra',
  'octa',
  'dodeca',
  'icosa',
  'star_prism',
  'fortress',
];

export const OCTA_RUNNER_SHAPE_LABEL: Record<OctaRunnerShape, string> = {
  cube: 'Cube',
  tri_prism: 'Tri Prism',
  hex_prism: 'Hex Prism',
  pyramid: 'Pyramid',
  tetra: 'Tetra',
  octa: 'Octa',
  dodeca: 'Dodeca',
  icosa: 'Icosa',
  star_prism: 'Star Prism',
  fortress: 'Fortress',
};

export const OCTA_DEFAULT_RUNNER_SHAPE: OctaRunnerShape = 'cube';

export const OCTA_PLATFORM_POOL: OctaPlatformType[] = [
  'smooth_lane',
  'drift_boost',
  'reverse_drift',
  'pulse_pad',
  'spring_pad',
  'warp_gate',
  'phase_lane',
  'resin_lane',
  'crusher_lane',
  'overdrive_strip',
  'split_rail',
  'gravity_drift',
];

export const OCTA_OBSTACLE_POOL: Exclude<OctaObstacleType, 'none'>[] = [
  'arc_blade',
  'shutter_gate',
  'pulse_laser',
  'gravity_orb',
  'prism_mine',
  'flame_jet',
  'phase_portal',
  'trap_split',
  'magnetron',
  'spike_fan',
  'thunder_column',
  'vortex_saw',
  'ion_barrier',
  'void_serpent',
  'ember_wave',
  'quantum_shard',
];

export const OCTA_PLATFORM_LABEL: Record<OctaPlatformType, string> = {
  smooth_lane: 'Smooth Lane',
  drift_boost: 'Drift Boost',
  reverse_drift: 'Reverse Drift',
  pulse_pad: 'Pulse Pad',
  spring_pad: 'Spring Pad',
  warp_gate: 'Warp Gate',
  phase_lane: 'Phase Lane',
  resin_lane: 'Resin Lane',
  crusher_lane: 'Crusher Lane',
  overdrive_strip: 'Overdrive Strip',
  split_rail: 'Split Rail',
  gravity_drift: 'Gravity Drift',
};

export const OCTA_OBSTACLE_LABEL: Record<OctaObstacleType, string> = {
  none: 'Clear',
  arc_blade: 'Arc Blade',
  shutter_gate: 'Shutter Gate',
  pulse_laser: 'Pulse Laser',
  gravity_orb: 'Gravity Orb',
  prism_mine: 'Prism Mine',
  flame_jet: 'Flame Jet',
  phase_portal: 'Phase Portal',
  trap_split: 'Trap Split',
  magnetron: 'Magnetron',
  spike_fan: 'Spike Fan',
  thunder_column: 'Thunder Column',
  vortex_saw: 'Vortex Saw',
  ion_barrier: 'Ion Barrier',
  void_serpent: 'Void Serpent',
  ember_wave: 'Ember Wave',
  quantum_shard: 'Quantum Shard',
};

export const OCTA_OBSTACLE_FAIL_REASON: Record<
  Exclude<OctaObstacleType, 'none'>,
  string
> = {
  arc_blade: 'Arc blade sliced your lane timing.',
  shutter_gate: 'Shutter gate slammed shut.',
  pulse_laser: 'Pulse laser sweep connected.',
  gravity_orb: 'Gravity orb collapsed your orbit.',
  prism_mine: 'Prism mine detonated on contact.',
  flame_jet: 'Flame jet consumed your route.',
  phase_portal: 'Phase portal sheared your packet.',
  trap_split: 'Trap split fractured your lane.',
  magnetron: 'Magnetron dragged you off-line.',
  spike_fan: 'Spike fan clipped your hull.',
  thunder_column: 'Thunder column strike landed.',
  vortex_saw: 'Vortex saw carved the corridor.',
  ion_barrier: 'Ion barrier caught your trajectory.',
  void_serpent: 'Void serpent wrapped the lane.',
  ember_wave: 'Ember wave scorched your path.',
  quantum_shard: 'Quantum shard burst impact.',
};

export const STAGE_PROFILES: StageProfile[] = [
  {
    id: 1,
    label: 'ST-01 Hex Flow',
    sides: 6,
    scoreGate: 0,
    speedMultiplier: 1,
    holeDensity: 0.07,
    obstacleDensity: 0.11,
    collectibleChance: 0.33,
  },
  {
    id: 2,
    label: 'ST-02 Octa Pressure',
    sides: 8,
    scoreGate: 2800,
    speedMultiplier: 1.05,
    holeDensity: 0.11,
    obstacleDensity: 0.16,
    collectibleChance: 0.28,
  },
  {
    id: 3,
    label: 'ST-03 Deca Fracture',
    sides: 10,
    scoreGate: 6500,
    speedMultiplier: 1.09,
    holeDensity: 0.16,
    obstacleDensity: 0.22,
    collectibleChance: 0.24,
  },
  {
    id: 4,
    label: 'ST-04 Apex Lattice',
    sides: 12,
    scoreGate: 10800,
    speedMultiplier: 1.13,
    holeDensity: 0.21,
    obstacleDensity: 0.28,
    collectibleChance: 0.2,
  },
];

const maxSides = Math.max(...STAGE_PROFILES.map((stage) => stage.sides));

export const GAME = {
  maxSides,
  radius: 4.75,
  playerAngle: -Math.PI / 2,
  playerZ: 0,

  baseSpeed: 5.9,
  speedRamp: 0.14,
  maxSpeed: 14.8,
  scoreRate: 11.5,

  springStiffness: 15,
  springDamping: 11.6,
  maxAngularVelocity: 6.8,

  turnCooldownMs: 108,
  flipCooldownMs: 290,

  stageFlashDuration: 1,
  comboWindow: 0.9,

  classicTargetScore: 12000,
  dailyTargetScore: 9000,
} as const;

export const FIBER_COLORS = {
  bg: '#05111f',
  fog: '#183862',
  player: '#f3fbff',
  playerGlow: '#8fe8ff',
  obstacle: '#ff7c5c',
  platform: '#6ed9ff',
  collectible: '#9ff8df',
} as const;

export const STAGE_AESTHETICS: Record<
  number,
  {
    bg: string;
    fog: string;
    lane: string;
    laneHot: string;
    hazard: string;
    platform: string;
  }
> = {
  1: {
    bg: '#061522',
    fog: '#16375d',
    lane: '#3f6ea8',
    laneHot: '#81ecff',
    hazard: '#ff7e66',
    platform: '#72e3ff',
  },
  2: {
    bg: '#0b1731',
    fog: '#2a3f79',
    lane: '#5b61b8',
    laneHot: '#a6ceff',
    hazard: '#ff7fb8',
    platform: '#88d3ff',
  },
  3: {
    bg: '#11153a',
    fog: '#46358d',
    lane: '#7d61cf',
    laneHot: '#c4a7ff',
    hazard: '#ff7697',
    platform: '#93d9ff',
  },
  4: {
    bg: '#161436',
    fog: '#5b2f8b',
    lane: '#9152cf',
    laneHot: '#eab2ff',
    hazard: '#ff7169',
    platform: '#9fe8ff',
  },
};
