import { proxy } from 'valtio';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const tetherDriftState = proxy({
  score: 0,
  bestScore: 0,
  health: 100,
  gameOver: false,

  // Gate chaining
  chain: 0,
  chainTime: 0, // seconds remaining

  // Heat builds with speed; cools while tethered
  heat: 0, // 0..100

  // Micro flash on perfect release
  perfectFlash: 0, // seconds remaining

  perfects: 0,
  constellationsCleared: 0,

  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  elapsed: 0,

  reset() {
    this.score = 0;
    this.health = 100;
    this.gameOver = false;
    this.chain = 0;
    this.chainTime = 0;
    this.heat = 0;
    this.perfectFlash = 0;
    this.perfects = 0;
    this.constellationsCleared = 0;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;
    this.elapsed = 0;
  },

  tick(dt: number) {
    if (this.gameOver) return;
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

  setToast(text: string, time = 1.1) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, time);
    this.slowMoTime = Math.max(this.slowMoTime, 0.12);
  },

  damage(amount: number) {
    if (this.gameOver) return;
    this.health = clamp(this.health - amount, 0, 100);
    this.chain = 0;
    this.chainTime = 0;
    if (this.health <= 0) this.gameOver = true;
  },

  breakChain() {
    this.chain = 0;
    this.chainTime = 0;
  },

  onGatePassed(opts: { perfect?: boolean; constellationDone?: boolean }) {
    if (this.gameOver) return;
    this.chain += 1;
    this.chainTime = clamp(this.chainTime + 0.55, 0, 3.0);

    const chainMult = 1 + clamp(this.chain, 0, 18) * 0.08;
    const base = 25 + this.chain * 6;
    const perfectBonus = opts.perfect ? 35 : 0;
    const constellationBonus = opts.constellationDone ? 90 : 0;
    const heatMult = 1 + (this.heat / 100) * 0.75;
    this.addScore((base + perfectBonus + constellationBonus) * chainMult * heatMult);
    if (opts.perfect) {
      this.perfectFlash = 0.2;
      this.perfects += 1;
      this.setToast('PERFECT RELEASE!');
    }
    if (opts.constellationDone) {
      this.constellationsCleared += 1;
      this.setToast('CONSTELLATION!');
      this.heal(6);
    }
  },

  setHeat(next: number) {
    this.heat = clamp(next, 0, 100);
  },

  heal(amount: number) {
    this.health = clamp(this.health + amount, 0, 100);
  },
});
