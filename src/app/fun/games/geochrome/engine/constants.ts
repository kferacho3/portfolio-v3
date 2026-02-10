export const COLLISION_GROUPS = {
  PLAYER: 0,
  WORLD: 1,
} as const;

export const WORLD_TUNING = {
  seedBase: 773,
  itemCount: 4200,
  liteItemCount: 2400,
  maxStuckItems: 12000,
  radius: 185,
  halfExtent: 220,
  clusterCount: 24,
  pathChance: 0.35,
  minY: 0.12,
  maxY: 0.95,
  ringStartRadius: 9,
  ringStep: 46,
  decorativeCount: 84,
} as const;

export const PLAYER_TUNING = {
  spawnHeight: 1.4,
  accel: 48,
  torque: 22,
  maxSpeed: 54,
  boostMultiplier: 1.85,
  linearDamping: 0.95,
  angularDamping: 0.8,
  baseRadius: 0.72,
  friction: 1.2,
  restitution: 0.04,
  speedScaleExponent: 0.58,
  maxScaleSpeedFactor: 5.3,
  accelScaleGain: 0.38,
  maxAccelScaleFactor: 3.2,
  torqueScaleGain: 0.2,
  maxTorqueScaleFactor: 2.1,
  velocityResponse: 9.5,
  coastDrag: 2.9,
} as const;

export const GROWTH_TUNING = {
  pickupFactor: 1.2,
  growthK: 0.65,
  visualLerp: 5.5,
  colliderLerp: 4.8,
  colliderUpdateInterval: 0.08,
  hudUpdateInterval: 0.05,
} as const;

export const CAMERA_TUNING = {
  baseHeight: 3.2,
  baseDistance: 18,
  minDistance: 14,
  maxDistance: 46,
  pitchDeg: 56,
  followLerp: 9.5,
  lookLerp: 10.5,
  targetLerp: 11,
  lookAhead: 4.2,
  lookHeight: 1.2,
  headingLerp: 11.2,
  speedDistanceFactor: 0.22,
  speedHeightFactor: 0.03,
  catchUpDistance: 14,
  catchUpLerp: 15,
  baseFov: 52,
  minFov: 50,
  maxFov: 63,
  speedFovGain: 0.1,
  scaleFovGain: 1.35,
  fovLerp: 6.2,
} as const;

export const PHYSICS_CULLING = {
  activeRadius: 72,
  liteRadius: 54,
  checkInterval: 0.22,
  liteCheckInterval: 0.14,
} as const;

export const RENDER_TUNING = {
  highPerfDpr: 1.5,
  baseDpr: 1.25,
  lowPerfDpr: 1,
  worldSegments: 14,
  worldRings: 12,
  terrainSegments: 128,
  qualityHigh: 1,
  qualityLow: 0.58,
} as const;

export const ARENA_TUNING = {
  terrainAmplitude: 0.18,
  terrainFrequency: 0.028,
  boundaryHeight: 12,
  boundaryThickness: 5.5,
  boundaryRadius: 214,
  tileSize: 8,
} as const;

export const AUDIO_TUNING = {
  rollMaxVolume: 0.55,
  rollSpeedToVolume: 0.035,
  rollMinRate: 0.55,
  rollMaxRate: 1.8,
  rollBaseRate: 1.35,
  sizeToRateFalloff: 0.085,
  speedToRateGain: 0.01,
  popMaxPerWindow: 2,
  popWindowMs: 80,
  popBaseVolume: 0.44,
} as const;

export const WORLD_SHAPE_LABELS = [
  'micro prism',
  'orbit cube',
  'neon spindle',
  'facet bloom',
  'poly shell',
  'chrome nugget',
  'arc shard',
  'star node',
  'spiral pod',
  'grid stone',
] as const;

export const WORLD_TIER_NAMES = ['tiny', 'small', 'medium', 'large'] as const;

export const GOAL_DIAMETERS = [2, 3.5, 5.5, 8, 11, 15, 20, 28, 38] as const;

export type WorldTierName = (typeof WORLD_TIER_NAMES)[number];
