import { proxy } from 'valtio';

export type StepsPhase = 'menu' | 'playing' | 'gameover';
export type StepsPathStyle = 'smooth-classic';
export type StepsTileVariant =
  | 'classic'
  | 'voxel'
  | 'carved'
  | 'alloy'
  | 'prismatic'
  | 'gridforge'
  | 'diamond'
  | 'sunken'
  | 'ripple';

export type StepsRunnerShape =
  | 'cube'
  | 'rounded_cube'
  | 'tri_prism'
  | 'hex_prism'
  | 'pyramid'
  | 'tetra'
  | 'octa'
  | 'dodeca'
  | 'icosa'
  | 'star_prism'
  | 'fortress'
  | 'rhombic'
  | 'pillar'
  | 'wide_box';

const BEST_KEY = 'rachos-fun-steps-best';
const GEMS_KEY = 'rachos-fun-steps-gems';
const STYLE_KEY = 'rachos-fun-steps-style';
const RUNNER_SHAPE_KEY = 'rachos-fun-steps-runner-shape-v1';
const UNLOCKED_KEY = 'rachos-fun-steps-unlocked-variants';
const UNLOCK_TIER_KEY = 'rachos-fun-steps-unlock-tier';

const TILE_VARIANTS: StepsTileVariant[] = [
  'classic',
  'voxel',
  'carved',
  'alloy',
  'prismatic',
  'gridforge',
  'diamond',
  'sunken',
  'ripple',
];

const RUNNER_SHAPES: StepsRunnerShape[] = [
  'cube',
  'rounded_cube',
  'tri_prism',
  'hex_prism',
  'pyramid',
  'tetra',
  'octa',
  'dodeca',
  'icosa',
  'star_prism',
  'fortress',
  'rhombic',
  'pillar',
  'wide_box',
];

const LOCKED_TILE_VARIANT: StepsTileVariant = 'classic';
const LOCKED_RUNNER_SHAPE: StepsRunnerShape = 'cube';

export const stepsRunnerShapeLabels: Record<StepsRunnerShape, string> = {
  cube: 'Cube',
  rounded_cube: 'Rounded Cube',
  tri_prism: 'Tri Prism',
  hex_prism: 'Hex Prism',
  pyramid: 'Pyramid',
  tetra: 'Tetra',
  octa: 'Octa',
  dodeca: 'Dodeca',
  icosa: 'Icosa',
  star_prism: 'Star Prism',
  fortress: 'Fortress',
  rhombic: 'Rhombic',
  pillar: 'Pillar',
  wide_box: 'Wide Box',
};

export const stepsState = proxy({
  phase: 'menu' as StepsPhase,
  pathStyle: 'smooth-classic' as StepsPathStyle,

  score: 0,
  best: 0,
  gems: 0,
  runGems: 0,
  pressure: 0,
  failReason: '',

  tileVariant: LOCKED_TILE_VARIANT as StepsTileVariant,
  unlockedVariants: [LOCKED_TILE_VARIANT] as StepsTileVariant[],
  variantUnlockTier: 0,
  lastUnlockedVariant: '' as '' | StepsTileVariant,
  runnerShape: LOCKED_RUNNER_SHAPE as StepsRunnerShape,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;

    const rawBest = window.localStorage.getItem(BEST_KEY);
    const parsedBest = rawBest ? Number(rawBest) : 0;
    if (!Number.isNaN(parsedBest)) stepsState.best = parsedBest;

    const rawGems = window.localStorage.getItem(GEMS_KEY);
    const parsedGems = rawGems ? Number(rawGems) : 0;
    if (!Number.isNaN(parsedGems)) {
      stepsState.gems = Math.max(0, Math.floor(parsedGems));
    }

    stepsState.tileVariant = LOCKED_TILE_VARIANT;
    stepsState.runnerShape = LOCKED_RUNNER_SHAPE;
    stepsState.unlockedVariants = [LOCKED_TILE_VARIANT];
    stepsState.variantUnlockTier = 0;
    stepsState.lastUnlockedVariant = '';

    window.localStorage.setItem(STYLE_KEY, LOCKED_TILE_VARIANT);
    window.localStorage.setItem(RUNNER_SHAPE_KEY, LOCKED_RUNNER_SHAPE);
    window.localStorage.setItem(UNLOCKED_KEY, JSON.stringify([LOCKED_TILE_VARIANT]));
    window.localStorage.setItem(UNLOCK_TIER_KEY, '0');
  },

  startGame: () => {
    stepsState.phase = 'playing';
    stepsState.score = 0;
    stepsState.runGems = 0;
    stepsState.pressure = 0;
    stepsState.failReason = '';
    stepsState.lastUnlockedVariant = '';
    stepsState.tileVariant = LOCKED_TILE_VARIANT;
    stepsState.runnerShape = LOCKED_RUNNER_SHAPE;
    stepsState.unlockedVariants = [LOCKED_TILE_VARIANT];
    stepsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: (reason = 'Run over') => {
    if (stepsState.phase === 'gameover') return;
    stepsState.phase = 'gameover';
    stepsState.failReason = reason;
    stepsState.pressure = 0;
    if (stepsState.score > stepsState.best) {
      stepsState.best = stepsState.score;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BEST_KEY, String(stepsState.best));
      }
    }
  },

  reset: () => {
    stepsState.phase = 'menu';
    stepsState.score = 0;
    stepsState.runGems = 0;
    stepsState.pressure = 0;
    stepsState.failReason = '';
    stepsState.lastUnlockedVariant = '';
    stepsState.tileVariant = LOCKED_TILE_VARIANT;
    stepsState.runnerShape = LOCKED_RUNNER_SHAPE;
    stepsState.unlockedVariants = [LOCKED_TILE_VARIANT];
    stepsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  collectGem: (count = 1) => {
    const amount = Math.max(1, Math.floor(count));
    stepsState.runGems += amount;
    stepsState.gems += amount;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(GEMS_KEY, String(stepsState.gems));
    }

    stepsState.variantUnlockTier = 0;
    stepsState.lastUnlockedVariant = '';
    stepsState.unlockedVariants = [LOCKED_TILE_VARIANT];
  },

  setPressure: (value: number) => {
    stepsState.pressure = Math.max(0, Math.min(1, value));
  },

  setTileVariant: (variant: StepsTileVariant) => {
    if (variant !== LOCKED_TILE_VARIANT) return;
    stepsState.tileVariant = LOCKED_TILE_VARIANT;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STYLE_KEY, LOCKED_TILE_VARIANT);
    }
  },

  cycleTileVariant: () => {
    stepsState.tileVariant = LOCKED_TILE_VARIANT;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STYLE_KEY, LOCKED_TILE_VARIANT);
    }
  },

  setRunnerShape: (shape: StepsRunnerShape) => {
    if (shape !== LOCKED_RUNNER_SHAPE) return;
    stepsState.runnerShape = LOCKED_RUNNER_SHAPE;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RUNNER_SHAPE_KEY, LOCKED_RUNNER_SHAPE);
    }
  },

  cycleRunnerShape: () => {
    stepsState.runnerShape = LOCKED_RUNNER_SHAPE;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RUNNER_SHAPE_KEY, LOCKED_RUNNER_SHAPE);
    }
  },
});

export const stepsTileVariants = TILE_VARIANTS;
export const stepsRunnerShapes = RUNNER_SHAPES;
