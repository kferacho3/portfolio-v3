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

const UNLOCK_THRESHOLDS = [15, 35, 60, 90, 130, 175] as const;

const isVariant = (value: unknown): value is StepsTileVariant =>
  value === 'classic' ||
  value === 'voxel' ||
  value === 'carved' ||
  value === 'alloy' ||
  value === 'prismatic' ||
  value === 'gridforge' ||
  value === 'diamond' ||
  value === 'sunken' ||
  value === 'ripple';

const isRunnerShape = (value: unknown): value is StepsRunnerShape =>
  value === 'cube' ||
  value === 'rounded_cube' ||
  value === 'tri_prism' ||
  value === 'hex_prism' ||
  value === 'pyramid' ||
  value === 'tetra' ||
  value === 'octa' ||
  value === 'dodeca' ||
  value === 'icosa' ||
  value === 'star_prism' ||
  value === 'fortress' ||
  value === 'rhombic' ||
  value === 'pillar' ||
  value === 'wide_box';

function persistUnlocked() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(UNLOCKED_KEY, JSON.stringify(stepsState.unlockedVariants));
  window.localStorage.setItem(UNLOCK_TIER_KEY, String(stepsState.variantUnlockTier));
}

function unlockNextVariant() {
  const locked = TILE_VARIANTS.filter((variant) => !stepsState.unlockedVariants.includes(variant));
  if (locked.length === 0) return;

  const pick = locked[Math.floor(Math.random() * locked.length)];
  stepsState.unlockedVariants = [...stepsState.unlockedVariants, pick];
  stepsState.lastUnlockedVariant = pick;
  persistUnlocked();
}

export const stepsState = proxy({
  phase: 'menu' as StepsPhase,
  pathStyle: 'smooth-classic' as StepsPathStyle,

  score: 0,
  best: 0,
  gems: 0,
  runGems: 0,
  pressure: 0,
  failReason: '',

  tileVariant: 'classic' as StepsTileVariant,
  unlockedVariants: ['classic', 'voxel', 'carved'] as StepsTileVariant[],
  variantUnlockTier: 0,
  lastUnlockedVariant: '' as '' | StepsTileVariant,
  runnerShape: 'cube' as StepsRunnerShape,

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

    const rawStyle = window.localStorage.getItem(STYLE_KEY);
    if (isVariant(rawStyle)) {
      stepsState.tileVariant = rawStyle;
    }

    const rawRunnerShape = window.localStorage.getItem(RUNNER_SHAPE_KEY);
    if (isRunnerShape(rawRunnerShape)) {
      stepsState.runnerShape = rawRunnerShape;
    }

    const rawUnlocked = window.localStorage.getItem(UNLOCKED_KEY);
    if (rawUnlocked) {
      try {
        const parsed = JSON.parse(rawUnlocked) as unknown[];
        const normalized = parsed.filter(isVariant);
        if (normalized.length > 0) {
          const merged = Array.from(new Set<StepsTileVariant>(['classic', 'voxel', 'carved', ...normalized]));
          stepsState.unlockedVariants = merged;
        }
      } catch {
        stepsState.unlockedVariants = ['classic', 'voxel', 'carved'];
      }
    }

    const rawTier = window.localStorage.getItem(UNLOCK_TIER_KEY);
    const parsedTier = rawTier ? Number(rawTier) : 0;
    if (!Number.isNaN(parsedTier)) {
      stepsState.variantUnlockTier = Math.max(0, Math.min(UNLOCK_THRESHOLDS.length, Math.floor(parsedTier)));
    }

    if (!stepsState.unlockedVariants.includes(stepsState.tileVariant)) {
      stepsState.tileVariant = stepsState.unlockedVariants[0] ?? 'classic';
    }
  },

  startGame: () => {
    stepsState.phase = 'playing';
    stepsState.score = 0;
    stepsState.runGems = 0;
    stepsState.pressure = 0;
    stepsState.failReason = '';
    stepsState.lastUnlockedVariant = '';
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
    stepsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  collectGem: (count = 1) => {
    const amount = Math.max(1, Math.floor(count));
    stepsState.runGems += amount;
    stepsState.gems += amount;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(GEMS_KEY, String(stepsState.gems));
    }

    while (
      stepsState.variantUnlockTier < UNLOCK_THRESHOLDS.length &&
      stepsState.gems >= UNLOCK_THRESHOLDS[stepsState.variantUnlockTier]
    ) {
      stepsState.variantUnlockTier += 1;
      unlockNextVariant();
    }

    persistUnlocked();
  },

  setPressure: (value: number) => {
    stepsState.pressure = Math.max(0, Math.min(1, value));
  },

  setTileVariant: (variant: StepsTileVariant) => {
    if (!stepsState.unlockedVariants.includes(variant)) return;
    stepsState.tileVariant = variant;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STYLE_KEY, variant);
    }
  },

  cycleTileVariant: (direction = 1) => {
    if (stepsState.unlockedVariants.length <= 1) return;
    const currentIndex = Math.max(0, stepsState.unlockedVariants.indexOf(stepsState.tileVariant));
    const nextIndex = (currentIndex + direction + stepsState.unlockedVariants.length) % stepsState.unlockedVariants.length;
    const next = stepsState.unlockedVariants[nextIndex] ?? 'classic';
    stepsState.tileVariant = next;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STYLE_KEY, next);
    }
  },

  setRunnerShape: (shape: StepsRunnerShape) => {
    if (!isRunnerShape(shape)) return;
    stepsState.runnerShape = shape;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RUNNER_SHAPE_KEY, shape);
    }
  },

  cycleRunnerShape: (direction = 1) => {
    const currentIndex = Math.max(0, RUNNER_SHAPES.indexOf(stepsState.runnerShape));
    const nextIndex = (currentIndex + direction + RUNNER_SHAPES.length) % RUNNER_SHAPES.length;
    const next = RUNNER_SHAPES[nextIndex] ?? 'cube';
    stepsState.runnerShape = next;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RUNNER_SHAPE_KEY, next);
    }
  },
});

export const stepsTileVariants = TILE_VARIANTS;
export const stepsRunnerShapes = RUNNER_SHAPES;
