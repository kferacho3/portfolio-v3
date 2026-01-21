import { proxy } from 'valtio';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export type FlipBoxEvent = 'AxisLock' | 'Heavy' | 'Sticky' | null;
export type FlipBoxAim = 'left' | 'right' | 'forward' | 'back';

export const flipBoxState = proxy({
  score: 0,
  bestScore: 0,
  health: 100,
  gameOver: false,

  // Perfect chain: collect a core shortly after a snap
  chain: 0,
  snapWindow: 0, // seconds remaining
  faceStreak: 0,
  lastFace: -1,
  snapCatches: 0,

  // Focus shield
  focusTime: 0,
  focusCooldown: 0,
  focusCooldownMax: 6.5,

  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  elapsed: 0,

  // Event deck
  event: null as FlipBoxEvent,
  eventTime: 0,
  nextEventAt: 24,

  reset() {
    this.score = 0;
    this.bestScore = this.bestScore; // keep best
    this.health = 100;
    this.gameOver = false;
    this.chain = 0;
    this.snapWindow = 0;
    this.faceStreak = 0;
    this.lastFace = -1;
    this.snapCatches = 0;
    this.focusTime = 0;
    this.focusCooldown = 0;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;
    this.elapsed = 0;
    this.event = null;
    this.eventTime = 0;
    this.nextEventAt = 24;
  },

  tick(dt: number) {
    if (this.gameOver) return;
    this.elapsed += dt;

    this.snapWindow = Math.max(0, this.snapWindow - dt);
    this.focusTime = Math.max(0, this.focusTime - dt);
    this.focusCooldown = Math.max(0, this.focusCooldown - dt);
    this.toastTime = Math.max(0, this.toastTime - dt);
    this.slowMoTime = Math.max(0, this.slowMoTime - dt);

    if (this.eventTime > 0) {
      this.eventTime = Math.max(0, this.eventTime - dt);
      if (this.eventTime <= 0) this.event = null;
    } else if (this.elapsed >= this.nextEventAt) {
      const roll = Math.random();
      this.event = roll < 0.34 ? 'AxisLock' : roll < 0.67 ? 'Heavy' : 'Sticky';
      this.eventTime = 8;
      this.nextEventAt = this.elapsed + 30;
    }
  },

  addScore(points: number) {
    const chainMult = 1 + clamp(this.chain, 0, 12) * 0.12;
    const p = Math.max(0, Math.round(points * chainMult));
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
    if (this.health <= 0) this.gameOver = true;
  },

  onSnap() {
    if (this.gameOver) return;
    this.snapWindow = 0.9;
    this.addScore(2);
  },

  tryFocus(): boolean {
    if (this.gameOver) return false;
    if (this.focusCooldown > 0 || this.focusTime > 0) return false;
    this.focusTime = 1.3;
    this.focusCooldown = this.focusCooldownMax;
    return true;
  },

  onCoreCollected(basePoints: number, face: number, snapCatch: boolean) {
    if (this.gameOver) return;
    if (snapCatch) {
      this.chain += 1;
      this.snapCatches += 1;
      this.setToast('SNAP CATCH!');
    } else {
      this.chain = 0;
    }

    this.snapWindow = 0; // force another snap for the next chain step

    if (this.lastFace >= 0 && face !== this.lastFace) {
      this.faceStreak = clamp(this.faceStreak + 1, 0, 6);
      if (!snapCatch && this.faceStreak >= 2) {
        this.setToast(`FACE STREAK x${this.faceStreak}`);
      }
    } else if (this.lastFace >= 0 && face === this.lastFace) {
      this.faceStreak = 0;
    }
    this.lastFace = face;

    const faceMult = 1 + clamp(this.faceStreak, 0, 6) * 0.15;
    const snapMult = snapCatch ? 1.2 : 1;
    this.addScore(basePoints * faceMult * snapMult);
  },
});
