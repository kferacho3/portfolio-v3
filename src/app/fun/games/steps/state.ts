import { proxy } from 'valtio';

export type StepsPhase = 'menu' | 'playing' | 'gameover';
export type StepsTrailStyle = 'classic' | 'voxel' | 'carved';

const BEST_KEY = 'rachos-fun-steps-best';
const GEMS_KEY = 'rachos-fun-steps-gems';
const STYLE_KEY = 'rachos-fun-steps-style';

export const stepsState = proxy({
  phase: 'menu' as StepsPhase,
  score: 0,
  best: 0,
  gems: 0,
  runGems: 0,
  pressure: 0,
  failReason: '',
  trailStyle: 'classic' as StepsTrailStyle,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isNaN(parsed)) stepsState.best = parsed;

    const rawGems = window.localStorage.getItem(GEMS_KEY);
    const parsedGems = rawGems ? Number(rawGems) : 0;
    if (!Number.isNaN(parsedGems)) {
      stepsState.gems = Math.max(0, Math.floor(parsedGems));
    }

    const rawStyle = window.localStorage.getItem(STYLE_KEY);
    if (rawStyle === 'classic' || rawStyle === 'voxel' || rawStyle === 'carved') {
      stepsState.trailStyle = rawStyle;
    }
  },

  startGame: () => {
    stepsState.phase = 'playing';
    stepsState.score = 0;
    stepsState.runGems = 0;
    stepsState.pressure = 0;
    stepsState.failReason = '';
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
    stepsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  collectGem: (count = 1) => {
    const amount = Math.max(1, Math.floor(count));
    stepsState.runGems += amount;
    stepsState.gems += amount;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(GEMS_KEY, String(stepsState.gems));
    }
  },

  setPressure: (value: number) => {
    stepsState.pressure = Math.max(0, Math.min(1, value));
  },

  setTrailStyle: (style: StepsTrailStyle) => {
    stepsState.trailStyle = style;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STYLE_KEY, style);
    }
  },
});
