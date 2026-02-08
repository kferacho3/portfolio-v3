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
  clusterCount: 24,
  pathChance: 0.2,
  minY: 0.35,
  maxY: 3.8,
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
  baseHeight: 5.2,
  baseDistance: 10.8,
  followLerp: 4.6,
  lookLerp: 5.5,
  lookAhead: 2.15,
  headingLerp: 7.5,
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
  qualityHigh: 1,
  qualityLow: 0.58,
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

export type WorldTierName = (typeof WORLD_TIER_NAMES)[number];
