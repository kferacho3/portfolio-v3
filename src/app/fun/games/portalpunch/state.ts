import { proxy } from 'valtio';

export type PortalPunchEvent =
  | 'PhaseShift'
  | 'PrismSplit'
  | 'PortalTransfer'
  | 'TargetLock'
  | null;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const portalPunchState = proxy({
  score: 0,
  bestScore: 0,
  gameOver: false,
  resetVersion: 0,

  level: 1,
  levelName: 'Portal Punch',
  solved: false,

  chain: 0,
  chainTime: 0,

  integrity: 100,
  integrityDecay: 0,
  idleTime: 0,

  chargedTime: 0,
  dashPrimeTime: 0,
  punchTime: 0,

  elapsed: 0,

  event: null as PortalPunchEvent,
  eventTime: 0,
  eventDuration: 0,
  nextEventAt: 18,

  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  reset() {
    this.resetVersion += 1;
    this.score = 0;
    this.gameOver = false;
    this.level = 1;
    this.levelName = 'Portal Punch';
    this.solved = false;
    this.chain = 0;
    this.chainTime = 0;
    this.integrity = 100;
    this.idleTime = 0;
    this.chargedTime = 0;
    this.dashPrimeTime = 0;
    this.punchTime = 0;
    this.elapsed = 0;
    this.event = null;
    this.eventTime = 0;
    this.eventDuration = 0;
    this.nextEventAt = 18;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;
  },

  tick(dt: number) {
    this.elapsed += dt;
    this.toastTime = Math.max(0, this.toastTime - dt);
    this.slowMoTime = Math.max(0, this.slowMoTime - dt);
    this.chainTime = Math.max(0, this.chainTime - dt);
    if (this.chainTime <= 0) this.chain = 0;

    if (this.eventTime > 0) {
      this.eventTime = Math.max(0, this.eventTime - dt);
      if (this.eventTime <= 0) {
        this.event = null;
        this.eventDuration = 0;
      }
    } else if (this.elapsed >= this.nextEventAt) {
      const roll = Math.random();
      this.event =
        roll < 0.25
          ? 'PhaseShift'
          : roll < 0.5
            ? 'PrismSplit'
            : roll < 0.75
              ? 'PortalTransfer'
              : 'TargetLock';
      this.eventDuration = 4.5;
      this.eventTime = this.eventDuration;
      this.nextEventAt = this.elapsed + 18;
    }
  },

  setToast(text: string, time = 1.2) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, time);
  },

  addScore(points: number) {
    const p = Math.max(0, Math.floor(points));
    this.score += p;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },

  setLevel(level: number, name: string) {
    this.level = level;
    this.levelName = name;
    this.solved = false;
  },

  markSolved() {
    this.solved = true;
  },

  damageIntegrity(amount: number) {
    this.integrity = clamp(this.integrity - amount, 0, 100);
    if (this.integrity <= 0) {
      this.integrity = 0;
      this.gameOver = true;
    }
  },

  restoreIntegrity(amount: number) {
    this.integrity = clamp(this.integrity + amount, 0, 100);
  },
});
