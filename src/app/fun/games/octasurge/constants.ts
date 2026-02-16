import type {
  OctaCameraMode,
  OctaObstacleType,
  OctaPathStyle,
  OctaPlatformType,
  OctaTileVariant,
  StageProfile,
} from './types';

export const OCTA_SURGE_TITLE = 'OctaSurge // Fiber Rift';

export const STORAGE_KEYS = {
  bestScore: 'rachos-fun-octasurge-best-score-v4',
  bestClassic: 'rachos-fun-octasurge-best-classic-v4',
  bestDaily: 'rachos-fun-octasurge-best-daily-v4',
  fxLevel: 'rachos-fun-octasurge-fx-level-v4',
  cameraMode: 'rachos-fun-octasurge-camera-mode-v4',
  tileVariant: 'rachos-fun-octasurge-tile-variant-v1',
  unlockedVariants: 'rachos-fun-octasurge-unlocked-variants-v1',
  variantUnlockTier: 'rachos-fun-octasurge-variant-tier-v1',
  styleShards: 'rachos-fun-octasurge-style-shards-v1',
  lastReplay: 'rachos-fun-octasurge-last-replay-v1',
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
  'trailChevron',
  'gridForge',
  'diamondTess',
  'sunkenSteps',
  'rippleField',
];

export const OCTA_TILE_VARIANT_LABEL: Record<OctaTileVariant, string> = {
  classic: 'Classic',
  alloy: 'Alloy',
  prismatic: 'Prismatic',
  trailChevron: 'Chevron',
  gridForge: 'Grid Forge',
  diamondTess: 'Diamond Tess',
  sunkenSteps: 'Sunken Steps',
  rippleField: 'Ripple Field',
};

export const OCTA_TILE_VARIANT_ACCENT: Record<OctaTileVariant, string> = {
  classic: '#5edbff',
  alloy: '#7ce7ff',
  prismatic: '#c192ff',
  trailChevron: '#ff9b58',
  gridForge: '#35b6ff',
  diamondTess: '#79e2ff',
  sunkenSteps: '#7ddfff',
  rippleField: '#63f2d1',
};

export const OCTA_TILE_UNLOCK_THRESHOLDS = [18, 42, 74, 112, 156] as const;

export const OCTA_DEFAULT_UNLOCKED_VARIANTS: OctaTileVariant[] = [
  'classic',
  'alloy',
  'prismatic',
];

export const OCTA_PLATFORM_POOL: OctaPlatformType[] = [
  'standard',
  'conveyor_belt',
  'reverse_conveyor',
  'bouncer',
  'trampoline',
  'teleporter',
  'ghost_platform',
  'sticky_glue',
  'crushing_ceiling',
  'speed_ramp',
];

export const OCTA_OBSTACLE_POOL: Exclude<OctaObstacleType, 'none'>[] = [
  'laser_grid',
  'gravity_well',
  'rotating_cross_blades',
  'homing_mine',
  'rising_lava',
  'telefrag_portal',
  'trapdoor_row',
  'pulse_expander',
  'magnetic_field',
  'spike_wave',
  'lightning_striker',
];

export const OCTA_PLATFORM_LABEL: Record<OctaPlatformType, string> = {
  standard: 'Standard',
  conveyor_belt: 'Conveyor Belt',
  reverse_conveyor: 'Reverse Conveyor',
  bouncer: 'Bouncer',
  trampoline: 'Trampoline',
  teleporter: 'Teleporter',
  ghost_platform: 'Ghost Platform',
  sticky_glue: 'Sticky Glue',
  crushing_ceiling: 'Crushing Ceiling',
  speed_ramp: 'Speed Ramp',
};

export const OCTA_OBSTACLE_LABEL: Record<OctaObstacleType, string> = {
  none: 'Clear',
  laser_grid: 'Laser Grid',
  gravity_well: 'Gravity Well',
  rotating_cross_blades: 'Cross Blades',
  homing_mine: 'Homing Mine',
  rising_lava: 'Rising Lava',
  telefrag_portal: 'Telefrag Portal',
  trapdoor_row: 'Trapdoor Row',
  pulse_expander: 'Pulse Expander',
  magnetic_field: 'Magnetic Field',
  spike_wave: 'Spike Wave',
  lightning_striker: 'Lightning Striker',
};

export const OCTA_OBSTACLE_FAIL_REASON: Record<
  Exclude<OctaObstacleType, 'none'>,
  string
> = {
  laser_grid: 'Laser grid burn. Lane timing missed.',
  gravity_well: 'Gravity well lock. Orbit collapsed.',
  rotating_cross_blades: 'Cross blade impact.',
  homing_mine: 'Homing mine detonation.',
  rising_lava: 'Lava surge reached the lane.',
  telefrag_portal: 'Portal shear. Wrong window.',
  trapdoor_row: 'Trapdoor lane snapped open.',
  pulse_expander: 'Pulse wall caught your packet.',
  magnetic_field: 'Magnetic field pinned your route.',
  spike_wave: 'Spike wave contact.',
  lightning_striker: 'Lightning strike connected.',
};

export const STAGE_PROFILES: StageProfile[] = [
  {
    id: 1,
    label: 'ST-01 Hex Launch',
    sides: 6,
    scoreGate: 0,
    speedMultiplier: 1,
    holeDensity: 0.08,
    obstacleDensity: 0.05,
    warpAmplitude: 0.012,
    collectibleChance: 0.32,
  },
  {
    id: 2,
    label: 'ST-02 Octa Drift',
    sides: 8,
    scoreGate: 3200,
    speedMultiplier: 1.04,
    holeDensity: 0.11,
    obstacleDensity: 0.08,
    warpAmplitude: 0.018,
    collectibleChance: 0.28,
  },
  {
    id: 3,
    label: 'ST-03 Deca Fracture',
    sides: 10,
    scoreGate: 7600,
    speedMultiplier: 1.08,
    holeDensity: 0.16,
    obstacleDensity: 0.12,
    warpAmplitude: 0.028,
    collectibleChance: 0.24,
  },
  {
    id: 4,
    label: 'ST-04 Zenith Grid',
    sides: 12,
    scoreGate: 12400,
    speedMultiplier: 1.12,
    holeDensity: 0.2,
    obstacleDensity: 0.16,
    warpAmplitude: 0.038,
    collectibleChance: 0.2,
  },
];

const maxSides = Math.max(...STAGE_PROFILES.map((stage) => stage.sides));

export const GAME = {
  maxSides,
  radius: 4.8,
  playerAngle: -Math.PI / 2,
  segmentCount: 30,
  segmentLength: 9.2,
  spawnStartZ: -18,
  despawnZ: 10,
  playerZ: 0,

  baseSpeed: 5.8,
  speedRamp: 0.13,
  maxSpeed: 14.2,
  scoreRate: 12,

  springStiffness: 15,
  springDamping: 11.2,
  maxAngularVelocity: 6.4,

  turnCooldownMs: 118,
  flipCooldownMs: 320,
  flipFovBoost: 7,

  stageFlashDuration: 1.1,
  comboWindow: 0.8,
  nearMissMargin: 0.32,

  classicTargetScore: 12000,
  dailyTargetScore: 9000,

  audioFile: '/fun/audio/sfx_swooshing.wav',
  audioFFTSize: 256,

  tunnelLength: 220,
  tunnelShellRadius: 7.2,

  collisionThresholdZ: 0.12,
  collectibleThresholdZ: 0.7,
} as const;

export const FIBER_COLORS = {
  bg: '#07182b',
  fog: '#17395f',
  shell: '#9ce6ff',
  shell2: '#325787',
  wire: '#89f7ff',
  lane: '#2a5688',
  laneHot: '#76f6ff',
  obstacle: '#ff7a63',
  obstacleHot: '#ffd08f',
  player: '#fefefe',
  playerGlow: '#7af5ff',
  danger: '#ff6a63',
  accent: '#ffbc8b',
} as const;

export const STAGE_AESTHETICS: Record<
  number,
  {
    bg: string;
    fog: string;
    lane: string;
    laneHot: string;
    wire: string;
    shell: string;
    shell2: string;
    obstacle: string;
    obstacleHot: string;
    accent: string;
  }
> = {
  1: {
    bg: '#07182b',
    fog: '#17395f',
    lane: '#2a5688',
    laneHot: '#76f6ff',
    wire: '#89f7ff',
    shell: '#9ce6ff',
    shell2: '#325787',
    obstacle: '#ff7a63',
    obstacleHot: '#ffd08f',
    accent: '#ffbc8b',
  },
  2: {
    bg: '#0d1833',
    fog: '#2f3f78',
    lane: '#4c56a7',
    laneHot: '#8ec0ff',
    wire: '#9df2ff',
    shell: '#9cc7ff',
    shell2: '#434f9b',
    obstacle: '#ff7aa8',
    obstacleHot: '#ffc2e0',
    accent: '#ffa4db',
  },
  3: {
    bg: '#101533',
    fog: '#3f3583',
    lane: '#6351bd',
    laneHot: '#b497ff',
    wire: '#aef6ff',
    shell: '#b8a6ff',
    shell2: '#5f47a6',
    obstacle: '#ff6c93',
    obstacleHot: '#ffb17f',
    accent: '#ffad7a',
  },
  4: {
    bg: '#151228',
    fog: '#5a2f68',
    lane: '#8346a3',
    laneHot: '#f58bff',
    wire: '#b8f7ff',
    shell: '#f2a3ff',
    shell2: '#7f4084',
    obstacle: '#ff6f72',
    obstacleHot: '#ffd679',
    accent: '#ffc379',
  },
};
