import { proxy } from 'valtio';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export type FlipBoxEvent = 'AxisLock' | 'Heavy' | 'Sticky' | null;

export const flipBoxState = proxy({
  score: 0,
  bestScore: 0,
  health: 100,
  gameOver: false,

  chain: 0,
  chainTime: 0,
  perfectWindow: 1.05,

  brakeCd: 0,
  brakeCdMax: 4.2,
  brakeTime: 0,

  elapsed: 0,

  event: null as FlipBoxEvent,
  eventTime: 0,
  nextEventAt: 30,
  axisLockMask: 0 as number, // bitmask of allowed axes (x,y,z) during AxisLock

  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  reset() {
    this.score = 0;
    this.health = 100;
    this.gameOver = false;
    this.chain = 0;
    this.chainTime = 0;
    this.brakeCd = 0;
    this.brakeTime = 0;
    this.elapsed = 0;
    this.event = null;
    this.eventTime = 0;
    this.nextEventAt = 30;
    this.axisLockMask = 0;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;
  },

  tick(dt: number) {
    this.toastTime = Math.max(0, this.toastTime - dt);
    this.slowMoTime = Math.max(0, this.slowMoTime - dt);
    if (this.gameOver) return;
    this.elapsed += dt;

    this.chainTime = Math.max(0, this.chainTime - dt);
    if (this.chainTime <= 0) this.chain = 0;

    this.brakeCd = Math.max(0, this.brakeCd - dt);
    this.brakeTime = Math.max(0, this.brakeTime - dt);

    if (this.eventTime > 0) {
      this.eventTime = Math.max(0, this.eventTime - dt);
      if (this.eventTime <= 0) {
        this.event = null;
        this.axisLockMask = 0;
      }
    } else if (this.elapsed >= this.nextEventAt) {
      const roll = Math.random();
      this.event = roll < 0.34 ? 'AxisLock' : roll < 0.67 ? 'Heavy' : 'Sticky';
      this.eventTime = 8.5;
      this.nextEventAt = this.elapsed + 30;
      if (this.event === 'AxisLock') {
        // Allow exactly 2 random axes (bit 0=x,1=y,2=z)
        const a = 1 << Math.floor(Math.random() * 3);
        let b = 1 << Math.floor(Math.random() * 3);
        while (b === a) b = 1 << Math.floor(Math.random() * 3);
        this.axisLockMask = a | b;
        this.setToast('AXIS LOCK');
      } else if (this.event === 'Heavy') {
        this.setToast('HEAVY');
      } else {
        this.setToast('STICKY');
      }
    }
  },

  setToast(text: string, time = 1.1) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, time);
    this.slowMoTime = Math.max(this.slowMoTime, 0.12);
  },

  addScore(points: number) {
    const chainMult = 1 + clamp(this.chain, 0, 12) * 0.12;
    const p = Math.max(0, Math.round(points * chainMult));
    this.score += p;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },

  onCoreCollected(withinPerfect: boolean) {
    if (this.chainTime > 0 && withinPerfect) this.chain += 1;
    else this.chain = 1;
    this.chainTime = this.perfectWindow;

    const base = 60;
    this.addScore(base);
    if (withinPerfect) {
      this.addScore(18);
      this.setToast('PERFECT');
    }
  },

  tryBrake(): boolean {
    if (this.gameOver) return false;
    if (this.brakeCd > 0) return false;
    this.brakeCd = this.brakeCdMax;
    this.brakeTime = 0.65;
    this.setToast('BRAKE', 0.7);
    return true;
  },

  damage(amount: number) {
    if (this.gameOver) return;
    this.health = clamp(this.health - amount, 0, 100);
    if (this.health <= 0) this.gameOver = true;
  },

  heal(amount: number) {
    this.health = clamp(this.health + amount, 0, 100);
  },
});
