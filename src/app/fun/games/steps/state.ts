import { proxy } from 'valtio';

export type StepsPhase = 'menu' | 'playing' | 'gameover';

const BEST_KEY = 'rachos-fun-steps-best';

export const stepsState = proxy({
  phase: 'menu' as StepsPhase,
  score: 0,
  best: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isNaN(parsed)) stepsState.best = parsed;
  },

  startGame: () => {
    stepsState.phase = 'playing';
    stepsState.score = 0;
    stepsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: () => {
    if (stepsState.phase === 'gameover') return;
    stepsState.phase = 'gameover';
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
    stepsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },
});
