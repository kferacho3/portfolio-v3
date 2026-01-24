import { proxy } from 'valtio';

export type ShadesPhase = 'menu' | 'playing' | 'gameover';

const BEST_KEY = 'rachos-fun-shades-best';

export const shadesState = proxy({
  phase: 'menu' as ShadesPhase,
  score: 0,
  lines: 0,
  best: 0,
  columns: 5,
  paletteIndex: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const v = raw ? parseInt(raw, 10) : 0;
    if (!Number.isNaN(v)) shadesState.best = v;
  },

  startGame: () => {
    shadesState.phase = 'playing';
    shadesState.score = 0;
    shadesState.lines = 0;
    // New seed = new run
    shadesState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: () => {
    shadesState.phase = 'gameover';
    shadesState.best = Math.max(shadesState.best, shadesState.score);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_KEY, String(shadesState.best));
    }
  },

  reset: () => {
    shadesState.phase = 'menu';
    shadesState.score = 0;
    shadesState.lines = 0;
    shadesState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },
});
