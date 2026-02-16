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
};

export const OCTA_OBSTACLE_FAIL_REASON: Record<
  Exclude<OctaObstacleType, 'none'>,
  string
> = {
  arc_blade: 'Arc blade sliced through the lane window.',
  shutter_gate: 'Shutter gate slammed shut.',
  pulse_laser: 'Pulse laser sweep connected.',
  gravity_orb: 'Gravity orb collapsed your orbit.',
  prism_mine: 'Prism mine detonated on contact.',
  flame_jet: 'Flame jet surged through your path.',
  phase_portal: 'Phase portal sheared the packet.',
  trap_split: 'Trap split fractured your lane.',
  magnetron: 'Magnetron lock dragged you off line.',
  spike_fan: 'Spike fan clipped your hull.',
  thunder_column: 'Thunder column strike landed.',
  vortex_saw: 'Vortex saw carved the corridor.',
};

export const STAGE_PROFILES: StageProfile[] = [
  {
    id: 1,
    label: 'ST-01 Hex Surge',
    sides: 6,
    scoreGate: 0,
    speedMultiplier: 1,
    holeDensity: 0.08,
    obstacleDensity: 0.13,
    warpAmplitude: 0.014,
    collectibleChance: 0.34,
  },
  {
    id: 2,
    label: 'ST-02 Octa Pressure',
    sides: 8,
    scoreGate: 3200,
    speedMultiplier: 1.04,
    holeDensity: 0.12,
    obstacleDensity: 0.18,
    warpAmplitude: 0.02,
    collectibleChance: 0.28,
  },
  {
    id: 3,
    label: 'ST-03 Deca Split',
    sides: 10,
    scoreGate: 7600,
    speedMultiplier: 1.08,
    holeDensity: 0.17,
    obstacleDensity: 0.23,
    warpAmplitude: 0.03,
    collectibleChance: 0.24,
  },
  {
    id: 4,
    label: 'ST-04 Zenith Apex',
    sides: 12,
    scoreGate: 12400,
    speedMultiplier: 1.12,
    holeDensity: 0.21,
    obstacleDensity: 0.29,
    warpAmplitude: 0.04,
    collectibleChance: 0.22,
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
  bg: '#070f24',
  fog: '#1f386d',
  shell: '#8dd6ff',
  shell2: '#324b8f',
  wire: '#8ff4ff',
  lane: '#2a4b90',
  laneHot: '#78ddff',
  obstacle: '#ff6f76',
  obstacleHot: '#ffc67f',
  player: '#fefefe',
  playerGlow: '#80f1ff',
  danger: '#ff6a63',
  accent: '#ffad68',
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
