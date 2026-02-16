import type {
  ModeSides,
  OctaCameraMode,
  OctaFxLevel,
  OctaObstaclePattern,
  OctaRunnerGeometry,
  OctaRunnerShape,
  OctaSurgeMode,
  OctaTileVariant,
} from './types';

export const STORAGE_KEY = 'rachos-fun-octasurge-v3';
export const TEST_UNLOCK_ALL_CHARACTERS = true;

export const GAME_CONFIG = {
  ringCount: 240,
  maxSides: 12,
  ringSpacing: 1.06,
  tunnelRadius: 3.5,
  platformDepth: 1.04,
  platformWidthScale: 0.9,
  obstacleWidthScale: 0.86,
  platformCornerRadius: 0.08,
  laneWidthScale: 1.0,
  fixedStep: 1 / 120,
  scoreDistanceFactor: 2.8,
  scoreNearMissBonus: 24,
  scoreComboBonus: 11,
  collectibleScoreBonus: 95,
  pointsPerSpeedTier: 500,
  speedTierBoost: 0.38,
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

export const FX_LEVELS: readonly OctaFxLevel[] = [0, 1, 2] as const;

export const OBSTACLE_PATTERNS: readonly OctaObstaclePattern[] = [
  'axialGates',
  'crownTeeth',
  'mirrorFan',
  'quadCross',
  'orbitalPairs',
  'pulseLattice',
  'laserSweep',
  'prismClusters',
  'splitPillars',
  'helixSnare',
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
    baseSpeed: 7.2,
    bonusSpeed: 4,
    rampDistance: 900,
    densityBias: -0.16,
  },
  evolve: {
    baseSpeed: 8,
    bonusSpeed: 4.8,
    rampDistance: 980,
    densityBias: -0.12,
  },
  gauntlet: {
    baseSpeed: 8.8,
    bonusSpeed: 5.8,
    rampDistance: 1080,
    densityBias: -0.06,
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
  laserSweep: 'Laser Sweep',
  prismClusters: 'Prism Clusters',
  splitPillars: 'Split Pillars',
  helixSnare: 'Helix Snare',
};

type CharacterPalette = {
  color: string;
  emissive: string;
  accent: string;
};

export type RunnerCharacterDef = {
  id: OctaRunnerShape;
  label: string;
  cost: number;
  geometry: OctaRunnerGeometry;
  color: string;
  emissive: string;
  accent: string;
};

const BASE_CHARACTERS: RunnerCharacterDef[] = [
  {
    id: 'core',
    label: 'Core',
    cost: 0,
    geometry: 'octa',
    color: '#84e4ff',
    emissive: '#57c6ff',
    accent: '#a0f2ff',
  },
  {
    id: 'kite',
    label: 'Kite',
    cost: 0,
    geometry: 'kite',
    color: '#99fff1',
    emissive: '#59ead4',
    accent: '#ccfff8',
  },
  {
    id: 'orb',
    label: 'Orb',
    cost: 0,
    geometry: 'orb',
    color: '#b7d9ff',
    emissive: '#7eaef9',
    accent: '#d6e8ff',
  },
];

const CHARACTER_PREFIXES = [
  'aurora',
  'lumen',
  'solace',
  'velvet',
  'nova',
  'zenith',
  'vanta',
  'ember',
  'aether',
  'sylph',
] as const;

const CHARACTER_SUFFIXES = [
  'spire',
  'glyph',
  'shard',
  'halo',
  'crest',
] as const;

const CHARACTER_GEOMETRY_ROTATION: readonly OctaRunnerGeometry[] = [
  'tetra',
  'icosa',
  'dodeca',
  'diamond',
  'capsule',
  'crystal',
  'orb',
  'octa',
  'kite',
] as const;

const CHARACTER_PALETTES: readonly CharacterPalette[] = [
  { color: '#ff7ab3', emissive: '#ff4f92', accent: '#ffd0e8' },
  { color: '#ffcf70', emissive: '#ffad33', accent: '#fff2c8' },
  { color: '#84f7ff', emissive: '#46dfff', accent: '#d1f9ff' },
  { color: '#c2a1ff', emissive: '#9f69ff', accent: '#e7dcff' },
  { color: '#91ffbe', emissive: '#3ee887', accent: '#d8ffe8' },
  { color: '#ffa18f', emissive: '#ff6d58', accent: '#ffe2dc' },
  { color: '#a4b9ff', emissive: '#6f8cff', accent: '#dce5ff' },
  { color: '#f8a9ff', emissive: '#e16dff', accent: '#fbe2ff' },
  { color: '#9be6ff', emissive: '#5fcfff', accent: '#d8f3ff' },
  { color: '#ffd9a1', emissive: '#ffb95c', accent: '#fff0d6' },
] as const;

const toTitle = (value: string) =>
  value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

const GENERATED_CHARACTERS: RunnerCharacterDef[] = CHARACTER_PREFIXES.flatMap(
  (prefix, prefixIndex) =>
    CHARACTER_SUFFIXES.map((suffix, suffixIndex) => {
      const idx = prefixIndex * CHARACTER_SUFFIXES.length + suffixIndex;
      const palette = CHARACTER_PALETTES[idx % CHARACTER_PALETTES.length];
      return {
        id: `${prefix}-${suffix}`,
        label: `${toTitle(prefix)} ${toTitle(suffix)}`,
        cost: 120 + idx * 18,
        geometry:
          CHARACTER_GEOMETRY_ROTATION[idx % CHARACTER_GEOMETRY_ROTATION.length] ??
          'octa',
        color: palette.color,
        emissive: palette.emissive,
        accent: palette.accent,
      };
    })
);

export const RUNNER_CHARACTERS: RunnerCharacterDef[] = [
  ...BASE_CHARACTERS,
  ...GENERATED_CHARACTERS,
];

export const RUNNER_SHAPES = RUNNER_CHARACTERS.map(
  (character) => character.id
) as readonly OctaRunnerShape[];

export const SHAPE_LABELS: Record<string, string> = Object.fromEntries(
  RUNNER_CHARACTERS.map((character) => [character.id, character.label])
);

export const RUNNER_CHARACTER_BY_ID: Record<string, RunnerCharacterDef> =
  Object.fromEntries(
    RUNNER_CHARACTERS.map((character) => [character.id, character])
  );

export const getRunnerCharacter = (
  id: OctaRunnerShape
): RunnerCharacterDef => {
  return RUNNER_CHARACTER_BY_ID[id] ?? RUNNER_CHARACTERS[0];
};

export const GENERATED_CHARACTER_COUNT = GENERATED_CHARACTERS.length;
