import type { OctaCameraMode, StageProfile } from './types';

export const OCTA_SURGE_TITLE = 'OctaSurge // Fiber Rift';

export const STORAGE_KEYS = {
  bestScore: 'rachos-fun-octasurge-best-score-v4',
  bestClassic: 'rachos-fun-octasurge-best-classic-v4',
  bestDaily: 'rachos-fun-octasurge-best-daily-v4',
  fxLevel: 'rachos-fun-octasurge-fx-level-v4',
  cameraMode: 'rachos-fun-octasurge-camera-mode-v4',
};

export const CAMERA_MODE_LABEL: Record<OctaCameraMode, string> = {
  chase: 'Chase',
  firstPerson: 'First Person',
  topDown: 'Top Down',
};

export const STAGE_PROFILES: StageProfile[] = [
  {
    id: 1,
    label: 'ST-01 Hex Launch',
    sides: 6,
    scoreGate: 0,
    speedMultiplier: 1,
    holeDensity: 0.2,
    obstacleDensity: 0.18,
    warpAmplitude: 0.08,
    collectibleChance: 0.28,
  },
  {
    id: 2,
    label: 'ST-02 Octa Drift',
    sides: 8,
    scoreGate: 2200,
    speedMultiplier: 1.14,
    holeDensity: 0.32,
    obstacleDensity: 0.28,
    warpAmplitude: 0.14,
    collectibleChance: 0.25,
  },
  {
    id: 3,
    label: 'ST-03 Deca Fracture',
    sides: 10,
    scoreGate: 6200,
    speedMultiplier: 1.26,
    holeDensity: 0.43,
    obstacleDensity: 0.36,
    warpAmplitude: 0.18,
    collectibleChance: 0.22,
  },
  {
    id: 4,
    label: 'ST-04 Zenith Grid',
    sides: 12,
    scoreGate: 12500,
    speedMultiplier: 1.38,
    holeDensity: 0.5,
    obstacleDensity: 0.44,
    warpAmplitude: 0.23,
    collectibleChance: 0.18,
  },
];

const maxSides = Math.max(...STAGE_PROFILES.map((stage) => stage.sides));

export const GAME = {
  maxSides,
  radius: 5.1,
  playerAngle: -Math.PI / 2,
  segmentCount: 24,
  segmentLength: 6,
  spawnStartZ: -14,
  despawnZ: 8.5,
  playerZ: 0,

  baseSpeed: 20,
  speedRamp: 0.68,
  maxSpeed: 47,
  scoreRate: 18,

  springStiffness: 24,
  springDamping: 12,
  maxAngularVelocity: 9,

  turnCooldownMs: 72,
  flipCooldownMs: 180,
  flipFovBoost: 18,

  stageFlashDuration: 1.4,
  comboWindow: 0.58,
  nearMissMargin: 0.24,

  classicTargetScore: 18000,
  dailyTargetScore: 14000,

  audioFile: '/fun/audio/sfx_swooshing.wav',
  audioFFTSize: 256,

  tunnelLength: 180,
  tunnelShellRadius: 7.8,

  collisionThresholdZ: 0.5,
  collectibleThresholdZ: 0.8,
} as const;

export const FIBER_COLORS = {
  bg: '#050506',
  fog: '#0d1117',
  shell: '#8bb8ff',
  shell2: '#1d3252',
  wire: '#65efff',
  lane: '#1a2e45',
  laneHot: '#45f6ff',
  obstacle: '#ff6438',
  obstacleHot: '#ffb56d',
  player: '#fefefe',
  playerGlow: '#69f0ff',
  danger: '#ff5a4f',
  accent: '#ffa94d',
} as const;
