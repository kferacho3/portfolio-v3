import { proxy } from 'valtio';

export type TwoDotsPhase = 'menu' | 'playing' | 'levelComplete' | 'gameover';

const BEST_KEY = 'rachos-fun-twodots-best';

export const twoDotsState = proxy({
  phase: 'menu' as TwoDotsPhase,
  score: 0,
  best: 0,
  movesLeft: 20,
  level: 1,
  stars: 0,
  targetColors: [0, 0, 0, 0],
  remainingColors: [0, 0, 0, 0],
  targetAnchors: 0,
  remainingAnchors: 0,
  bombs: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const v = raw ? parseInt(raw, 10) : 0;
    if (Number.isFinite(v)) twoDotsState.best = v;
  },

  startGame: () => {
    twoDotsState.phase = 'playing';
    twoDotsState.score = 0;
    twoDotsState.movesLeft = 20;
    twoDotsState.level = 1;
    twoDotsState.stars = 0;
    twoDotsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  setLevelState: (
    level: number,
    moves: number,
    targetColors: number[],
    targetAnchors: number,
    bombs: number
  ) => {
    twoDotsState.level = level;
    twoDotsState.movesLeft = moves;
    twoDotsState.targetColors = [...targetColors];
    twoDotsState.remainingColors = [...targetColors];
    twoDotsState.targetAnchors = targetAnchors;
    twoDotsState.remainingAnchors = targetAnchors;
    twoDotsState.bombs = bombs;
  },

  endGame: () => {
    twoDotsState.phase = 'gameover';
    if (twoDotsState.score > twoDotsState.best) {
      twoDotsState.best = twoDotsState.score;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BEST_KEY, String(twoDotsState.best));
      }
    }
  },

  reset: () => {
    twoDotsState.phase = 'menu';
    twoDotsState.score = 0;
    twoDotsState.movesLeft = 20;
    twoDotsState.level = 1;
    twoDotsState.stars = 0;
    twoDotsState.targetColors = [0, 0, 0, 0];
    twoDotsState.remainingColors = [0, 0, 0, 0];
    twoDotsState.targetAnchors = 0;
    twoDotsState.remainingAnchors = 0;
    twoDotsState.bombs = 0;
    twoDotsState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },
});
