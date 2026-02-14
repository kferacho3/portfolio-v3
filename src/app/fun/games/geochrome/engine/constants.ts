export const COLLISION_GROUPS = {
  PLAYER: 0,
  WORLD: 1,
} as const;

export type GeoChromePaletteId =
  | 'aurora'
  | 'neon'
  | 'sunset'
  | 'reef'
  | 'obsidian'
  | 'candy';

export type GeoChromePalette = {
  id: GeoChromePaletteId;
  name: string;
  description: string;
  background: string;
  fog: string;
  ambient: string;
  hemisphereSky: string;
  hemisphereGround: string;
  keyLight: string;
  fillLightA: string;
  fillLightB: string;
  centerLight: string;
  skyTopA: string;
  skyTopB: string;
  skyHorizonA: string;
  skyHorizonB: string;
  skyNebulaA: string;
  skyNebulaB: string;
  skyStar: string;
  skySun: string;
  skyMoon: string;
  terrainBiomes: [string, string, string, string];
  terrainHighlight: string;
  terrainRingGlow: string;
  terrainEmissive: string;
  ringColors: [string, string, string, string];
  ringEmissive: [string, string, string, string];
  boundaryColor: string;
  boundaryEmissive: string;
  landmarkColor: string;
  landmarkEmissive: string;
  worldHueBase: [number, number, number, number];
  worldSatRange: [number, number];
  worldLightRange: [number, number];
  hudAccent: string;
};

export const GEOCHROME_PALETTES: Record<GeoChromePaletteId, GeoChromePalette> = {
  aurora: {
    id: 'aurora',
    name: 'Aurora Drift',
    description: 'Cyan-violet arctic glow with electric ring highlights.',
    background: '#060d1f',
    fog: '#0a1830',
    ambient: '#b6f0ff',
    hemisphereSky: '#d4efff',
    hemisphereGround: '#111a2f',
    keyLight: '#c8f0ff',
    fillLightA: '#22d3ee',
    fillLightB: '#60a5fa',
    centerLight: '#a5f3fc',
    skyTopA: '#133674',
    skyTopB: '#0a1b42',
    skyHorizonA: '#1fa7c7',
    skyHorizonB: '#6b4fd3',
    skyNebulaA: '#44f6ff',
    skyNebulaB: '#8f6bff',
    skyStar: '#d9f8ff',
    skySun: '#fef3c7',
    skyMoon: '#bfdbfe',
    terrainBiomes: ['#1d4ed8', '#0891b2', '#0f766e', '#7c3aed'],
    terrainHighlight: '#e0f2fe',
    terrainRingGlow: '#7dd3fc',
    terrainEmissive: '#081526',
    ringColors: ['#7dd3fc', '#67e8f9', '#93c5fd', '#bfdbfe'],
    ringEmissive: ['#1d4ed8', '#0891b2', '#0c4a6e', '#0369a1'],
    boundaryColor: '#102640',
    boundaryEmissive: '#0a1d33',
    landmarkColor: '#38bdf8',
    landmarkEmissive: '#164e63',
    worldHueBase: [0.55, 0.48, 0.62, 0.08],
    worldSatRange: [0.72, 0.9],
    worldLightRange: [0.48, 0.67],
    hudAccent: '#22d3ee',
  },
  neon: {
    id: 'neon',
    name: 'Neon Hypergrid',
    description: 'High-contrast cyber glow with hot magenta and cyan lanes.',
    background: '#07040f',
    fog: '#160c2c',
    ambient: '#f0dcff',
    hemisphereSky: '#f2dbff',
    hemisphereGround: '#1a1028',
    keyLight: '#fbcfff',
    fillLightA: '#8b5cf6',
    fillLightB: '#06b6d4',
    centerLight: '#e879f9',
    skyTopA: '#2a0d45',
    skyTopB: '#130a2f',
    skyHorizonA: '#8b2be2',
    skyHorizonB: '#00b7ff',
    skyNebulaA: '#ff47d6',
    skyNebulaB: '#4ef3ff',
    skyStar: '#ffe7ff',
    skySun: '#ffd1fb',
    skyMoon: '#93c5fd',
    terrainBiomes: ['#3b0764', '#4c1d95', '#0f172a', '#1d4ed8'],
    terrainHighlight: '#f5d0fe',
    terrainRingGlow: '#f472b6',
    terrainEmissive: '#1a0f2f',
    ringColors: ['#f472b6', '#a78bfa', '#22d3ee', '#c084fc'],
    ringEmissive: ['#be185d', '#5b21b6', '#155e75', '#6d28d9'],
    boundaryColor: '#1b1330',
    boundaryEmissive: '#28164b',
    landmarkColor: '#c084fc',
    landmarkEmissive: '#7e22ce',
    worldHueBase: [0.84, 0.63, 0.56, 0.03],
    worldSatRange: [0.78, 0.96],
    worldLightRange: [0.44, 0.7],
    hudAccent: '#f472b6',
  },
  sunset: {
    id: 'sunset',
    name: 'Solar Bloom',
    description: 'Warm dusk gradients with bright amber and crimson energy.',
    background: '#140b0b',
    fog: '#2a1012',
    ambient: '#ffe4c7',
    hemisphereSky: '#ffd7ad',
    hemisphereGround: '#2d1414',
    keyLight: '#ffd6b0',
    fillLightA: '#fb7185',
    fillLightB: '#f59e0b',
    centerLight: '#fde68a',
    skyTopA: '#4a1c20',
    skyTopB: '#2f1a3a',
    skyHorizonA: '#ff8b3d',
    skyHorizonB: '#f43f5e',
    skyNebulaA: '#ffb84f',
    skyNebulaB: '#ff5d7d',
    skyStar: '#ffe9cf',
    skySun: '#fff4b8',
    skyMoon: '#fecaca',
    terrainBiomes: ['#7f1d1d', '#b45309', '#c2410c', '#9a3412'],
    terrainHighlight: '#ffedd5',
    terrainRingGlow: '#fdba74',
    terrainEmissive: '#251116',
    ringColors: ['#fb923c', '#f97316', '#fca5a5', '#fde68a'],
    ringEmissive: ['#c2410c', '#9a3412', '#9f1239', '#92400e'],
    boundaryColor: '#35161b',
    boundaryEmissive: '#441a20',
    landmarkColor: '#fdba74',
    landmarkEmissive: '#b45309',
    worldHueBase: [0.04, 0.08, 0.96, 0.01],
    worldSatRange: [0.7, 0.9],
    worldLightRange: [0.46, 0.66],
    hudAccent: '#f59e0b',
  },
  reef: {
    id: 'reef',
    name: 'Coral Reef',
    description: 'Tropical cyan-lime ocean tones with clear deep-water sky.',
    background: '#031018',
    fog: '#072330',
    ambient: '#cbffff',
    hemisphereSky: '#b8fbff',
    hemisphereGround: '#0e1f23',
    keyLight: '#bff9ff',
    fillLightA: '#14b8a6',
    fillLightB: '#84cc16',
    centerLight: '#5eead4',
    skyTopA: '#0b3a55',
    skyTopB: '#0a2841',
    skyHorizonA: '#0ea5e9',
    skyHorizonB: '#14b8a6',
    skyNebulaA: '#53fff2',
    skyNebulaB: '#a7f850',
    skyStar: '#d5fbff',
    skySun: '#d9f99d',
    skyMoon: '#bae6fd',
    terrainBiomes: ['#0f766e', '#0891b2', '#0c4a6e', '#3f6212'],
    terrainHighlight: '#d9f99d',
    terrainRingGlow: '#67e8f9',
    terrainEmissive: '#061f2b',
    ringColors: ['#2dd4bf', '#22d3ee', '#84cc16', '#a3e635'],
    ringEmissive: ['#0f766e', '#0e7490', '#365314', '#4d7c0f'],
    boundaryColor: '#0d2a34',
    boundaryEmissive: '#0d3f47',
    landmarkColor: '#2dd4bf',
    landmarkEmissive: '#0f766e',
    worldHueBase: [0.49, 0.55, 0.28, 0.43],
    worldSatRange: [0.7, 0.94],
    worldLightRange: [0.44, 0.68],
    hudAccent: '#14b8a6',
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Pulse',
    description: 'Dark cinematic palette with deep blues and ruby highlights.',
    background: '#05060a',
    fog: '#0f1220',
    ambient: '#d3deff',
    hemisphereSky: '#ced7ff',
    hemisphereGround: '#0f1117',
    keyLight: '#d6ddff',
    fillLightA: '#60a5fa',
    fillLightB: '#ef4444',
    centerLight: '#818cf8',
    skyTopA: '#0f172a',
    skyTopB: '#050b1f',
    skyHorizonA: '#1d4ed8',
    skyHorizonB: '#7f1d1d',
    skyNebulaA: '#3b82f6',
    skyNebulaB: '#f43f5e',
    skyStar: '#f8fafc',
    skySun: '#fda4af',
    skyMoon: '#c4b5fd',
    terrainBiomes: ['#0f172a', '#1e293b', '#1d4ed8', '#7f1d1d'],
    terrainHighlight: '#e2e8f0',
    terrainRingGlow: '#93c5fd',
    terrainEmissive: '#0b1120',
    ringColors: ['#60a5fa', '#818cf8', '#f87171', '#c4b5fd'],
    ringEmissive: ['#1d4ed8', '#4338ca', '#b91c1c', '#5b21b6'],
    boundaryColor: '#121827',
    boundaryEmissive: '#151f35',
    landmarkColor: '#93c5fd',
    landmarkEmissive: '#1e40af',
    worldHueBase: [0.61, 0.67, 0.98, 0.02],
    worldSatRange: [0.55, 0.86],
    worldLightRange: [0.4, 0.62],
    hudAccent: '#818cf8',
  },
  candy: {
    id: 'candy',
    name: 'Candy Cloud',
    description: 'Playful pastel world with soft pink, blue, and mint accents.',
    background: '#f7f2ff',
    fog: '#f3e8ff',
    ambient: '#fff7ff',
    hemisphereSky: '#fff7ff',
    hemisphereGround: '#efe4fb',
    keyLight: '#ffe7fb',
    fillLightA: '#f9a8d4',
    fillLightB: '#93c5fd',
    centerLight: '#a7f3d0',
    skyTopA: '#dbeafe',
    skyTopB: '#ede9fe',
    skyHorizonA: '#fbcfe8',
    skyHorizonB: '#bfdbfe',
    skyNebulaA: '#f9a8d4',
    skyNebulaB: '#a5f3fc',
    skyStar: '#ffffff',
    skySun: '#fde68a',
    skyMoon: '#ddd6fe',
    terrainBiomes: ['#fbcfe8', '#bfdbfe', '#a7f3d0', '#ddd6fe'],
    terrainHighlight: '#ffffff',
    terrainRingGlow: '#f9a8d4',
    terrainEmissive: '#eadcf8',
    ringColors: ['#f9a8d4', '#93c5fd', '#a7f3d0', '#c4b5fd'],
    ringEmissive: ['#be185d', '#1d4ed8', '#047857', '#6d28d9'],
    boundaryColor: '#efe3fb',
    boundaryEmissive: '#e5d3fb',
    landmarkColor: '#f9a8d4',
    landmarkEmissive: '#db2777',
    worldHueBase: [0.93, 0.58, 0.47, 0.76],
    worldSatRange: [0.56, 0.82],
    worldLightRange: [0.56, 0.78],
    hudAccent: '#f472b6',
  },
};

export const GEOCHROME_PALETTE_ORDER: GeoChromePaletteId[] = [
  'aurora',
  'neon',
  'sunset',
  'reef',
  'obsidian',
  'candy',
];

export const DEFAULT_GEOCHROME_PALETTE: GeoChromePaletteId = 'aurora';

export function getGeoChromePalette(paletteId: GeoChromePaletteId) {
  return GEOCHROME_PALETTES[paletteId] ?? GEOCHROME_PALETTES[DEFAULT_GEOCHROME_PALETTE];
}

export function randomGeoChromePaletteId() {
  const index = Math.floor(Math.random() * GEOCHROME_PALETTE_ORDER.length);
  return GEOCHROME_PALETTE_ORDER[index] ?? DEFAULT_GEOCHROME_PALETTE;
}

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
  spawnHeight: 1.1,
  accel: 48,
  torque: 19,
  maxSpeed: 53,
  boostMultiplier: 1.75,
  linearDamping: 0.96,
  angularDamping: 0.92,
  baseRadius: 0.72,
  friction: 1.05,
  restitution: 0.04,
  speedScaleExponent: 0.54,
  maxScaleSpeedFactor: 5.3,
  accelScaleGain: 0.34,
  maxAccelScaleFactor: 3.2,
  torqueScaleGain: 0.17,
  maxTorqueScaleFactor: 1.95,
  velocityResponse: 9.4,
  coastDrag: 2.05,
  sideGrip: 7.5,
  startAssist: 21,
} as const;

export const GROWTH_TUNING = {
  pickupFactor: 1.3,
  growthK: 0.74,
  visualLerp: 6.2,
  colliderLerp: 6.6,
  colliderUpdateInterval: 0.05,
  hudUpdateInterval: 0.05,
  absorbDistancePadding: 0.34,
  autoCollectCellSize: 9.5,
  autoCollectInterval: 0.075,
  autoCollectBudget: 14,
  autoCollectMaxCandidates: 180,
  comboWindowMs: 1700,
  comboMultiplierStep: 0.08,
  comboMaxMultiplierBonus: 2.8,
} as const;

export const CAMERA_TUNING = {
  baseHeight: 3.2,
  baseDistance: 18,
  minDistance: 14,
  maxDistance: 46,
  pitchDeg: 56,
  followLerp: 8.2,
  lookLerp: 9.3,
  targetLerp: 9.5,
  lookAhead: 4.2,
  lookHeight: 1.2,
  headingLerp: 9.4,
  speedDistanceFactor: 0.22,
  speedHeightFactor: 0.03,
  catchUpDistance: 14,
  catchUpLerp: 15,
  baseFov: 52,
  minFov: 50,
  maxFov: 63,
  speedFovGain: 0.1,
  scaleFovGain: 1.35,
  fovLerp: 5.4,
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
