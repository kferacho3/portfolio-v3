import type {
  ModeSides,
  OctaCameraMode,
  OctaFxLevel,
  OctaObstaclePattern,
  OctaRunnerShape,
  OctaSurgeMode,
  OctaTileVariant,
} from './types';

export const STORAGE_KEY = 'rachos-fun-octasurge-v3';

export const GAME_CONFIG = {
  ringCount: 240,
  maxSides: 12,
  ringSpacing: 0.72,
  tunnelRadius: 5.2,
  fixedStep: 1 / 120,
  scoreDistanceFactor: 2.8,
  scoreNearMissBonus: 24,
  scoreComboBonus: 11,
} as const;

export const SIDE_SEQUENCE: readonly ModeSides[] = [6, 8, 10, 12] as const;

export const MODES: readonly OctaSurgeMode[] = [
  'symmetry',
  'evolve',
  'gauntlet',
] as const;

export const CAMERA_MODES: readonly OctaCameraMode[] = [
  'chase',
  'firstPerson',
  'topDown',
] as const;

export const TILE_VARIANTS: readonly OctaTileVariant[] = [
  'prism',
  'wire',
  'glass',
] as const;

export const RUNNER_SHAPES: readonly OctaRunnerShape[] = [
  'core',
  'kite',
  'orb',
] as const;

export const FX_LEVELS: readonly OctaFxLevel[] = [0, 1, 2] as const;

export const OBSTACLE_PATTERNS: readonly OctaObstaclePattern[] = [
  'axialGates',
  'crownTeeth',
  'mirrorFan',
  'quadCross',
  'orbitalPairs',
  'pulseLattice',
] as const;

export const MODE_SETTINGS: Record<
  OctaSurgeMode,
  {
    baseSpeed: number;
    bonusSpeed: number;
    rampDistance: number;
    densityBias: number;
  }
> = {
  symmetry: {
    baseSpeed: 16.5,
    bonusSpeed: 13.5,
    rampDistance: 380,
    densityBias: -0.06,
  },
  evolve: {
    baseSpeed: 17.5,
    bonusSpeed: 16,
    rampDistance: 460,
    densityBias: 0,
  },
  gauntlet: {
    baseSpeed: 19,
    bonusSpeed: 18.5,
    rampDistance: 520,
    densityBias: 0.08,
  },
};

export const MODE_LABELS: Record<OctaSurgeMode, string> = {
  symmetry: 'Symmetry',
  evolve: 'Morph',
  gauntlet: 'Gauntlet',
};

export const TILE_LABELS: Record<OctaTileVariant, string> = {
  prism: 'Prism Weave',
  wire: 'Wireframe',
  glass: 'Glassline',
};

export const SHAPE_LABELS: Record<OctaRunnerShape, string> = {
  core: 'Core',
  kite: 'Kite',
  orb: 'Orb',
};

export const CAMERA_LABELS: Record<OctaCameraMode, string> = {
  chase: 'Chase',
  firstPerson: 'First Person',
  topDown: 'Top Down',
};

export const FX_LABELS: Record<OctaFxLevel, string> = {
  0: 'Clean',
  1: 'Bloom',
  2: 'Hyper',
};

export const PATTERN_LABELS: Record<OctaObstaclePattern, string> = {
  axialGates: 'Axial Gates',
  crownTeeth: 'Crown Teeth',
  mirrorFan: 'Mirror Fan',
  quadCross: 'Quad Cross',
  orbitalPairs: 'Orbital Pairs',
  pulseLattice: 'Pulse Lattice',
};
