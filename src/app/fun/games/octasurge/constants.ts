export const OCTA_SURGE_TITLE = 'Octa Surge';

export const STORAGE_KEYS = {
  best: 'rachos-fun-octasurge-best',
  bestScore: 'rachos-fun-octasurge-best-score',
  totalCollectibles: 'rachos-fun-octasurge-collectibles',
  totalSpecial: 'rachos-fun-octasurge-special',
  totalBoost: 'rachos-fun-octasurge-boost',
  totalShield: 'rachos-fun-octasurge-shield',
};

export const GAME = {
  faces: 8,
  runSeconds: 70,

  // Tunnel
  apothem: 3.6,
  tunnelLength: 150,

  // Player (fixed at bottom)
  playerInset: 0.36,
  playerZ: 0.75,
  playerDepth: 0.54,

  // Controls
  keyRotationSpeed: 3.15,
  dragRotationFactor: 0.007,
  rotationEase: 11,

  // Motion
  baseSpeed: 17,
  speedRamp: 1.45,
  spawnDistance: 128,

  // Obstacles
  obstacleCount: 24,
  obstacleDepth: 2.35,
  wedgeScaleX: 1.45,
  baseHazard: 0.16,
  hazardRamp: 0.5,

  // Collision
  faceHitTightness: 0.4,
  collectibleFaceTolerance: 0.62,
  nearMissFaceTolerance: 0.9,

  // Collectibles
  collectibleHitRadius: 0.58,
  specialHitRadius: 0.46,
  powerupHitRadius: 0.54,
  collectibleCount: 14,
  specialCollectibleCount: 5,
  boostCollectibleCount: 3,
  shieldCollectibleCount: 2,
  collectibleGapLeadMin: 1.9,
  collectibleGapLeadMax: 4.4,
  specialZOffsetMin: 1.35,
  specialZOffsetMax: 2.65,
  powerupZOffsetMin: 2.1,
  powerupZOffsetMax: 4.8,

  // Boost / shield / surge systems
  boostDuration: 2.8,
  boostSpeedMultiplier: 1.3,
  boostScoreMultiplier: 1.25,
  maxShieldCharges: 2,
  invulnDuration: 0.45,
  shieldInvulnDuration: 0.8,
  surgeSlowScale: 0.58,
  surgeDrainRate: 48,
  surgeRechargeRate: 14,
  surgeBoostRechargeRate: 12,
  surgeGainNormal: 8,
  surgeGainSpecial: 14,
  surgeGainPowerup: 20,

  // Scoring
  distanceScoreFactor: 1.85,
  nearMissScore: 28,
  comboWindow: 2.1,
  comboStep: 0.09,
  pointsNormal: 24,
  pointsSpecial: 78,
  pointsBoost: 110,
  pointsShield: 88,

  // FX
  ringCount: 30,
  collectionEffectLife: 0.72,
  impactEffectLife: 0.62,
};
