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
  nearMissMargin: 0.24,

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
