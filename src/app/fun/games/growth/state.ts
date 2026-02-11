import { proxy } from 'valtio';
import type { GrowthGameState, GrowthPathStyleId } from './types';
import { BEST_SCORE_KEY, PATH_STYLE_KEY } from './constants';

const PATH_STYLE_IDS: GrowthPathStyleId[] = ['voxelized', 'classic', 'apex'];

const isGrowthPathStyle = (value: string): value is GrowthPathStyleId =>
  PATH_STYLE_IDS.includes(value as GrowthPathStyleId);

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
    setPathStyle: (style: GrowthPathStyleId) => void;
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
  pathStyle: 'voxelized',

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

  setPathStyle(style) {
    if (this.pathStyle === style) return;
    this.pathStyle = style;
    try {
      localStorage.setItem(PATH_STYLE_KEY, style);
    } catch {
      // ignore
    }
  },

  tickTimers(dt: number) {
    const updateStepMs = 50;
    if (this.shieldMs > 0) {
      const next = Math.max(0, this.shieldMs - dt * 1000);
      const quantized = next === 0 ? 0 : Math.ceil(next / updateStepMs) * updateStepMs;
      if (quantized !== this.shieldMs) {
        this.shieldMs = quantized;
      }
    }
    if (this.boostMs > 0) {
      const next = Math.max(0, this.boostMs - dt * 1000);
      const quantized = next === 0 ? 0 : Math.ceil(next / updateStepMs) * updateStepMs;
      if (quantized !== this.boostMs) {
        this.boostMs = quantized;
      }
    }
  },

  loadBestScore() {
    try {
      const best = localStorage.getItem(BEST_SCORE_KEY);
      if (best) this.bestScore = parseInt(best, 10) || 0;
      const pathStyle = localStorage.getItem(PATH_STYLE_KEY);
      if (pathStyle && isGrowthPathStyle(pathStyle)) {
        this.pathStyle = pathStyle;
      }
    } catch {
      // ignore
    }
  },
});
