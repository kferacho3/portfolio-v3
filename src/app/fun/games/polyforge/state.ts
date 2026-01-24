import { proxy } from 'valtio';

export type PolyForgePhase = 'menu' | 'playing' | 'gameover';

const BEST_KEY = 'rachos-fun-polyforge-best';

export const polyForgeState = proxy({
  phase: 'menu' as PolyForgePhase,
  score: 0,
  best: 0,
  level: 1,
  lives: 3,
  progress: 0,
  total: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const n = raw ? Number(raw) : 0;
    polyForgeState.best = Number.isFinite(n) ? n : 0;
  },

  reset: () => {
    polyForgeState.phase = 'menu';
    polyForgeState.score = 0;
    polyForgeState.level = 1;
    polyForgeState.lives = 3;
    polyForgeState.progress = 0;
    polyForgeState.total = 0;
    polyForgeState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  startGame: () => {
    polyForgeState.phase = 'playing';
    polyForgeState.score = 0;
    polyForgeState.level = 1;
    polyForgeState.lives = 3;
    polyForgeState.progress = 0;
    polyForgeState.total = 0;
    polyForgeState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  nextLevel: () => {
    polyForgeState.level += 1;
    polyForgeState.progress = 0;
    polyForgeState.total = 0;
    // Refill lives a bit to keep the pace arcade-like.
    polyForgeState.lives = 3;
    polyForgeState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: () => {
    polyForgeState.phase = 'gameover';
    polyForgeState.best = Math.max(polyForgeState.best, polyForgeState.score);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_KEY, String(polyForgeState.best));
    }
  },
});
