export const OCTA_SURGE_TITLE = 'Octa Surge';

export const STORAGE_KEYS = {
  bestScore: 'rachos-fun-octasurge-best-score-v2',
  bestClassic: 'rachos-fun-octasurge-best-classic-v2',
  bestDaily: 'rachos-fun-octasurge-best-daily-v2',
  totalGems: 'rachos-fun-octasurge-total-gems-v2',
  totalBoost: 'rachos-fun-octasurge-total-boost-v2',
  totalShield: 'rachos-fun-octasurge-total-shield-v2',
};

export const GAME = {
  faces: 8,
  bottomFace: 6,
  faceStep: (Math.PI * 2) / 8,

  radius: 3.35,
  ringSpacing: 1.18,
  ringDepth: 1.06,
  tileThickness: 0.14,
  bumpHeight: 0.42,

  ringBuffer: 84,
  spawnStartZ: -10,
  despawnWorldZ: 1.2,

  playerDepth: 0.5,
  playerPlaneZ: 0,

  rotationDurationMs: 192,
  rotationQueueLimit: 3,

  classicRunSeconds: 62,
  dailyRunSeconds: 68,

  baseSpeed: 11.4,
  speedRampPerSecond: 0.14,
  speedRampFromScore: 0.0028,
  maxSpeed: 24.5,

  comboWindow: 1.75,
  comboStep: 0.08,
  clearScore: 2,
  nearMissScore: 26,
  gemScore: 22,
  boostScore: 50,
  shieldScore: 42,

  warmupRings: 14,
  difficultyRampRings: 520,
  densityEarly: 0.2,
  densityMid: 0.46,
  densityLate: 0.72,
  breatherEvery: 10,

  collectibleGemChance: 0.32,
  collectibleBoostChance: 0.08,
  collectibleShieldChance: 0.055,

  boostDuration: 2.3,
  boostMultiplier: 1.34,
  shieldMaxCharges: 2,

  surgeDrainRate: 44,
  surgeRechargeRate: 13,
  surgeBoostRecharge: 10,
  surgeSlowScale: 0.62,

  cameraBaseFov: 72,
  cameraMaxFovBoost: 16,

  collisionLaneTolerance: 0.42,
  nearMissLaneTolerance: 0.9,

  fxLife: 0.62,
};
