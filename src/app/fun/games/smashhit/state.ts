import { proxy } from 'valtio';

export type SmashHitPhase = 'menu' | 'playing' | 'gameover';

const BEST_KEY = 'rachos-fun-smashhit-best';

export const smashHitState = proxy({
  phase: 'menu' as SmashHitPhase,
  score: 0,
  best: 0,
  balls: 25,
  combo: 0,

  // Used by the React component to regenerate the world.
  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isNaN(parsed)) smashHitState.best = parsed;
  },

  startGame: () => {
    smashHitState.phase = 'playing';
    smashHitState.score = 0;
    smashHitState.balls = 25;
    smashHitState.combo = 0;
    smashHitState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: () => {
    if (smashHitState.phase === 'gameover') return;
    smashHitState.phase = 'gameover';
    if (smashHitState.score > smashHitState.best) {
      smashHitState.best = smashHitState.score;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BEST_KEY, String(smashHitState.best));
      }
    }
  },

  reset: () => {
    smashHitState.phase = 'menu';
    smashHitState.score = 0;
    smashHitState.balls = 25;
    smashHitState.combo = 0;
    smashHitState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  addScore: (points: number) => {
    smashHitState.score = Math.max(0, Math.floor(smashHitState.score + points));
  },

  addBalls: (count: number) => {
    smashHitState.balls = Math.max(0, Math.floor(smashHitState.balls + count));
  },

  useBall: () => {
    if (smashHitState.balls <= 0) return false;
    smashHitState.balls -= 1;
    return true;
  },
});
