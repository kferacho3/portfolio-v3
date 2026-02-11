import { proxy } from 'valtio';

export type TetherDriftPhase = 'menu' | 'playing' | 'gameover';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const tetherDriftState = proxy({
  phase: 'menu' as TetherDriftPhase,
  score: 0,
  bestScore: 0,
  health: 100,
  gameOver: false,
  resetVersion: 0,

  // Combo + pacing telemetry used by HUD
  chain: 0,
  chainTime: 0,
  heat: 0,
  speed: 0,
  reeling: false,

  // Momentary feedback
  perfectFlash: 0,
  perfects: 0,
  constellationsCleared: 0,
  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  elapsed: 0,

  reset() {
    this.resetVersion += 1;
    this.phase = 'menu';
    this.score = 0;
    this.health = 100;
    this.gameOver = false;
    this.chain = 0;
    this.chainTime = 0;
    this.heat = 0;
    this.speed = 0;
    this.reeling = false;
    this.perfectFlash = 0;
    this.perfects = 0;
    this.constellationsCleared = 0;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;
    this.elapsed = 0;
  },

  tick(dt: number) {
    if (this.phase !== 'playing') return;
    this.elapsed += dt;
    this.chainTime = Math.max(0, this.chainTime - dt);
    if (this.chainTime <= 0) this.chain = 0;
    this.perfectFlash = Math.max(0, this.perfectFlash - dt);
    this.toastTime = Math.max(0, this.toastTime - dt);
    this.slowMoTime = Math.max(0, this.slowMoTime - dt);
  },

  addScore(points: number) {
    const p = Math.max(0, Math.round(points));
    this.score += p;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },

  setToast(text: string, time = 1, slowMo = 0) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, time);
    this.slowMoTime = Math.max(this.slowMoTime, slowMo);
  },

  setHealth(next: number) {
    this.health = clamp(next, 0, 100);
    if (this.health <= 0) {
      this.phase = 'gameover';
      this.gameOver = true;
    }
  },
});
