export const GLASS_PHYSICS = {
  restitution: 0.8,
  friction: 0.05,
  density: 0.2,
  linearDamping: 0.15,
  angularDamping: 0.35,
  impulseThreshold: 6.5,
  shardTTL: 2.0,
} as const;

export const STONE_PHYSICS = {
  restitution: 0.2,
  friction: 0.8,
  density: 3.0,
  linearDamping: 0.6,
  angularDamping: 0.9,
  impulseThreshold: Number.POSITIVE_INFINITY,
} as const;

export const BALL_PHYSICS = {
  restitution: 0.95,
  friction: 0.01,
  density: 1.0,
  linearDamping: 0.01,
  angularDamping: 0.05,
  ccd: true,
} as const;

export const SMASH_GLASS_MATERIAL = {
  transmission: 1,
  thickness: 0.35,
  roughness: 0.05,
  ior: 1.45,
  chromaticAberration: 0.02,
  anisotropy: 0,
  distortion: 0,
  distortionScale: 0,
  temporalDistortion: 0,
} as const;

export const PERFORMANCE_LIMITS = {
  maxShardBodies: 160,
  minShardBodies: 68,
  maxRigidBodyEstimate: 150,
} as const;
