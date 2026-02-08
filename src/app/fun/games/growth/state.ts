import { proxy } from 'valtio';
import type { GrowthGameState } from './types';
import { BEST_SCORE_KEY } from './constants';

export const growthState = proxy<
  GrowthGameState & {
    reset: () => void;
    startGame: () => void;
    endGame: () => void;
    pause: () => void;
    resume: () => void;
    collectGem: () => void;
    addClearScore: (amount?: number) => void;
    addPerfectTurn: () => void;
    grantShield: (durationMs?: number) => void;
    triggerBoost: (durationMs?: number) => void;
    tickTimers: (dt: number) => void;
    loadBestScore: () => void;
  }
>({
  phase: 'menu',
  paused: false,
  time: 0,
  score: 0,
  gems: 0,
  speed: 0,
  bestScore: 0,
  perfectTurns: 0,
  shieldMs: 0,
  boostMs: 0,

  reset() {
    this.phase = 'menu';
    this.paused = false;
    this.time = 0;
    this.score = 0;
    this.gems = 0;
    this.speed = 0;
    this.perfectTurns = 0;
    this.shieldMs = 0;
    this.boostMs = 0;
    this.loadBestScore();
  },

  startGame() {
    this.phase = 'playing';
    this.paused = false;
    this.time = 0;
    this.score = 0;
    this.gems = 0;
    this.speed = 0;
    this.perfectTurns = 0;
    this.shieldMs = 0;
    this.boostMs = 0;
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

  collectGem() {
    this.gems += 1;
    this.score += 8;
  },

  addClearScore(amount = 1) {
    this.score += amount;
  },

  addPerfectTurn() {
    this.perfectTurns += 1;
  },

  grantShield(durationMs = 0) {
    this.shieldMs = Math.max(this.shieldMs, durationMs);
  },

  triggerBoost(durationMs = 0) {
    this.boostMs = Math.max(this.boostMs, durationMs);
  },

  tickTimers(dt: number) {
    if (this.shieldMs > 0) {
      this.shieldMs = Math.max(0, this.shieldMs - dt * 1000);
    }
    if (this.boostMs > 0) {
      this.boostMs = Math.max(0, this.boostMs - dt * 1000);
    }
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
