export const COLLISION_GROUPS = {
  PLAYER: 0,
  WORLD: 1,
} as const;

export const WORLD_TUNING = {
  seedBase: 773,
  itemCount: 5600,
  liteItemCount: 3200,
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
  accel: 28,
  torque: 18,
  maxSpeed: 26,
  boostMultiplier: 1.35,
  linearDamping: 1.75,
  angularDamping: 1.4,
  baseRadius: 0.72,
  friction: 1.2,
  restitution: 0.04,
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
  baseHeight: 6.6,
  baseDistance: 12.8,
  followLerp: 4.2,
  lookLerp: 4.8,
  lookAhead: 1.9,
  headingLerp: 5.8,
  headingInfluence: 0.35,
} as const;

export const PHYSICS_CULLING = {
  activeRadius: 62,
  liteRadius: 48,
  checkInterval: 0.22,
  liteCheckInterval: 0.14,
} as const;

export const RENDER_TUNING = {
  highPerfDpr: 1.5,
  baseDpr: 1.25,
  lowPerfDpr: 1,
  worldSegments: 18,
  worldRings: 16,
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
