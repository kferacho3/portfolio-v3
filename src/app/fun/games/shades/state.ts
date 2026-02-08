import { proxy } from 'valtio';

export type ShadesPhase = 'menu' | 'playing' | 'gameover';

const BEST_KEY = 'rachos-fun-shades-best';

export const shadesState = proxy({
  phase: 'menu' as ShadesPhase,

  score: 0,
  best: 0,

  combo: 0,
  multiplier: 1,

  clears: 0,
  merges: 0,

  paletteIndex: 0,

  nextColorGroup: 0,
  nextLevel: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    if (!Number.isNaN(parsed)) shadesState.best = parsed;
  },

  startGame: () => {
    shadesState.phase = 'playing';
    shadesState.score = 0;
    shadesState.combo = 0;
    shadesState.multiplier = 1;
    shadesState.clears = 0;
    shadesState.merges = 0;
    shadesState.nextColorGroup = 0;
    shadesState.nextLevel = 0;
    shadesState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: () => {
    if (shadesState.phase === 'gameover') return;
    shadesState.phase = 'gameover';
    shadesState.best = Math.max(shadesState.best, shadesState.score);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_KEY, String(shadesState.best));
    }
  },

  resetToMenu: () => {
    shadesState.phase = 'menu';
    shadesState.score = 0;
    shadesState.combo = 0;
    shadesState.multiplier = 1;
    shadesState.clears = 0;
    shadesState.merges = 0;
    shadesState.nextColorGroup = 0;
    shadesState.nextLevel = 0;
    shadesState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  // Compatibility for shared reset utility.
  reset: () => {
    shadesState.resetToMenu();
  },
});
