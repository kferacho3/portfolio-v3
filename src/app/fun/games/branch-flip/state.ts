import { proxy } from 'valtio';
import type { BranchFlipGameState, Tile } from './types';
import { BEST_SCORE_KEY } from './constants';

export const branchFlipState = proxy<
  BranchFlipGameState & {
    reset: () => void;
    startGame: () => void;
    endGame: () => void;
    pause: () => void;
    resume: () => void;
    flip: () => void;
    collectGem: () => void;
    loadBestScore: () => void;
  }
>({
  phase: 'menu',
  paused: false,
  time: 0,
  score: 0,
  gems: 0,
  speed: 4.8,
  dir: 0,
  falling: false,
  fallT: 0,
  shake: 0,
  bestScore: 0,

  reset() {
    this.phase = 'menu';
    this.paused = false;
    this.time = 0;
    this.score = 0;
    this.gems = 0;
    this.speed = 4.8;
    this.dir = 0;
    this.falling = false;
    this.fallT = 0;
    this.shake = 0;
    this.loadBestScore();
  },

  startGame() {
    this.phase = 'playing';
    this.paused = false;
    this.time = 0;
    this.score = 0;
    this.gems = 0;
    this.speed = 4.8;
    this.dir = 0;
    this.falling = false;
    this.fallT = 0;
    this.shake = 0;
  },

  endGame() {
    this.phase = 'gameover';
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
      } catch {
        // ignore
      }
    }
  },

  pause() {
    if (this.phase === 'playing') this.paused = true;
  },

  resume() {
    if (this.phase === 'playing') this.paused = false;
  },

  flip() {
    if (this.phase === 'playing' && !this.paused && !this.falling) {
      this.dir = 1 - this.dir;
    }
  },

  collectGem() {
    this.gems += 1;
    this.score += 10;
  },

  loadBestScore() {
    try {
      const best = localStorage.getItem(BEST_SCORE_KEY);
      if (best) this.bestScore = parseInt(best, 10) || 0;
    } catch {
      // ignore
    }
  },
});

export const mutation = {
  playerPos: [0, 0.35, 0] as [number, number, number],
  tiles: [] as Tile[],
  tileIndexByKey: new Map<string, number>(),
};
