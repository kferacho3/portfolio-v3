import { proxy } from 'valtio';

export type KnotHopPhase = 'menu' | 'playing' | 'gameover';

const BEST_KEY = 'knothop_hyper_best_v2';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const readBest = () => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_KEY);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const writeBest = (score: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_KEY, String(Math.max(0, Math.floor(score))));
};

export const knotHopState = proxy({
  phase: 'menu' as KnotHopPhase,
  score: 0,
  best: 0,
  combo: 0,
  knotsPassed: 0,
  perfects: 0,
  speed: 0,

  gameOver: false,
  resetVersion: 0,

  toastText: '',
  toastTime: 0,

  load() {
    this.best = readBest();
  },

  reset() {
    this.resetVersion += 1;
    this.phase = 'menu';
    this.score = 0;
    this.combo = 0;
    this.knotsPassed = 0;
    this.perfects = 0;
    this.speed = 0;
    this.gameOver = false;
    this.toastText = '';
    this.toastTime = 0;
  },

  start() {
    this.phase = 'playing';
    this.score = 0;
    this.combo = 0;
    this.knotsPassed = 0;
    this.perfects = 0;
    this.speed = 0;
    this.gameOver = false;
    this.toastText = '';
    this.toastTime = 0;
  },

  tick(dt: number) {
    if (this.phase !== 'playing') return;
    this.toastTime = Math.max(0, this.toastTime - dt);
  },

  setToast(text: string, duration = 0.55) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, duration);
  },

  updateHud(hud: {
    score: number;
    combo: number;
    knotsPassed: number;
    perfects: number;
    speed: number;
  }) {
    if (this.phase !== 'playing') return;
    this.score = Math.max(0, Math.floor(hud.score));
    this.combo = Math.max(0, Math.floor(hud.combo));
    this.knotsPassed = Math.max(0, Math.floor(hud.knotsPassed));
    this.perfects = Math.max(0, Math.floor(hud.perfects));
    this.speed = clamp(hud.speed, 0, 999);
  },

  end(finalScore: number) {
    const score = Math.max(0, Math.floor(finalScore));
    this.phase = 'gameover';
    this.score = score;
    this.gameOver = true;

    const nextBest = Math.max(this.best, score);
    if (nextBest !== this.best) {
      this.best = nextBest;
      writeBest(nextBest);
    }
  },
});
