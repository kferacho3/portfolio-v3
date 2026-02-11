export const OCTA_SURGE_TITLE = 'Octa Surge';

export const STORAGE_KEYS = {
  bestScore: 'rachos-fun-octasurge-best-score-v3',
  bestClassic: 'rachos-fun-octasurge-best-classic-v3',
  bestDaily: 'rachos-fun-octasurge-best-daily-v3',
  totalGems: 'rachos-fun-octasurge-total-gems-v3',
  totalBoost: 'rachos-fun-octasurge-total-boost-v3',
  totalShield: 'rachos-fun-octasurge-total-shield-v3',
  totalMagnet: 'rachos-fun-octasurge-total-magnet-v3',
  totalPrism: 'rachos-fun-octasurge-total-prism-v3',
  totalPhase: 'rachos-fun-octasurge-total-phase-v3',
  fxLevel: 'rachos-fun-octasurge-fx-level-v3',
};

export const GAME = {
  faces: 8,
  bottomFace: 6,
  faceStep: (Math.PI * 2) / 8,

  radius: 3.36,
  ringSpacing: 1.22,
  ringDepth: 1.08,
  tileThickness: 0.14,
  bumpHeight: 0.38,
  crusherHeight: 0.68,
  speedPadHeight: 0.08,

  ringBuffer: 92,
  spawnStartZ: -10,
  despawnWorldZ: 1.28,

  playerDepth: 0.5,
  playerPlaneZ: 0,

  rotationResponse: 15.2,
  inputBufferMs: 82,
  laneFlipCooldownMs: 124,

  classicRunSeconds: 60,
  dailyRunSeconds: 60,

  baseSpeed: 11.8,
  speedRampPerSecond: 0.16,
  speedRampFromScore: 0.0034,
  maxSpeed: 26,
  maxInputRateLanePerSecond: 8.8,

  comboWindow: 1.85,
  comboStep: 0.09,
  clearScore: 2.8,
  nearMissScore: 24,
  gemScore: 22,
  boostScore: 50,
  shieldScore: 42,
  magnetScore: 48,
  prismScore: 56,
  phaseScore: 60,
  speedPadScore: 14,

  warmupRings: 12,
  difficultyRampRings: 580,
  densityEarly: 0.2,
  densityMid: 0.48,
  densityLate: 0.78,
  breatherEvery: 9,
  lookaheadRings: 11,
  generatorMaxAttempts: 16,

  collectibleGemChance: 0.3,
  collectibleBoostChance: 0.085,
  collectibleShieldChance: 0.055,
  collectibleMagnetChance: 0.048,
  collectiblePrismChance: 0.04,
  collectiblePhaseChance: 0.032,

  boostDuration: 2.4,
  boostMultiplier: 1.34,
  speedPadDuration: 0.46,
  speedPadMultiplier: 1.22,
  shieldMaxCharges: 2,
  magnetDuration: 4.8,
  magnetLaneReach: 1,
  prismDuration: 5.4,
  prismMultiplier: 1.92,
  phaseDuration: 3.4,

  surgeDrainRate: 44,
  surgeRechargeRate: 14,
  surgeBoostRecharge: 10,
  surgeSlowScale: 0.58,

  cameraBaseFov: 73,
  cameraMaxFovBoost: 18,
  cameraBaseZ: 8.9,
  cameraSpeedZoom: 1.24,
  cameraLookAhead: 24,

  collisionLaneTolerance: 0.36,
  nearMissLaneTolerance: 1.1,

  fxPool: 54,
  fxLife: 0.68,
  pulseInterval: 0.52,
};
