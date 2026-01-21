import { proxy } from 'valtio';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export type PortalPunchEvent = 'DoubleTargets' | 'PortalDrift' | 'LaserSweep' | null;

export const portalPunchState = proxy({
  score: 0,
  bestScore: 0,
  gameOver: false,

  chain: 0,
  chainTime: 0,

  integrity: 100, // 0..100
  integrityDecay: 2.2, // per second

  chargedTime: 0, // seconds remaining
  dashPrimeTime: 0, // seconds remaining
  punchTime: 0, // seconds remaining

  elapsed: 0,

  event: null as PortalPunchEvent,
  eventTime: 0,
  eventDuration: 0,
  nextEventAt: 26,

  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  reset() {
    this.score = 0;
    this.gameOver = false;
    this.chain = 0;
    this.chainTime = 0;
    this.integrity = 100;
    this.chargedTime = 0;
    this.dashPrimeTime = 0;
    this.punchTime = 0;
    this.elapsed = 0;
    this.event = null;
    this.eventTime = 0;
    this.eventDuration = 0;
    this.nextEventAt = 26;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;
  },

  tick(dt: number) {
    if (this.gameOver) return;
    this.elapsed += dt;

    this.toastTime = Math.max(0, this.toastTime - dt);
    this.slowMoTime = Math.max(0, this.slowMoTime - dt);

    this.chainTime = Math.max(0, this.chainTime - dt);
    if (this.chainTime <= 0) this.chain = 0;

    this.chargedTime = Math.max(0, this.chargedTime - dt);
    this.dashPrimeTime = Math.max(0, this.dashPrimeTime - dt);
    this.punchTime = Math.max(0, this.punchTime - dt);

    this.integrity = clamp(this.integrity - this.integrityDecay * dt, 0, 100);
    if (this.integrity <= 0) {
      this.integrity = 0;
      this.gameOver = true;
    }

    if (this.eventTime > 0) {
      this.eventTime = Math.max(0, this.eventTime - dt);
      if (this.eventTime <= 0) {
        this.event = null;
        this.eventDuration = 0;
      }
    } else if (this.elapsed >= this.nextEventAt) {
      const roll = Math.random();
      this.event = roll < 0.34 ? 'DoubleTargets' : roll < 0.67 ? 'PortalDrift' : 'LaserSweep';
      this.eventDuration = this.event === 'DoubleTargets' ? 8 : this.event === 'PortalDrift' ? 7 : 7.5;
      this.eventTime = this.eventDuration;
      this.nextEventAt = this.elapsed + 26;
    }
  },

  setToast(text: string, time = 1.1, slowMo: boolean = true) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, time);
    if (slowMo) this.slowMoTime = Math.max(this.slowMoTime, 0.12);
  },

  addScore(points: number) {
    const p = Math.max(0, Math.round(points));
    this.score += p;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },

  breakChain() {
    this.chain = 0;
    this.chainTime = 0;
  },

  damageIntegrity(amount: number) {
    if (this.gameOver) return;
    this.integrity = clamp(this.integrity - amount, 0, 100);
    if (this.integrity <= 0) {
      this.integrity = 0;
      this.gameOver = true;
    }
  },

  restoreIntegrity(amount: number) {
    if (this.gameOver) return;
    this.integrity = clamp(this.integrity + amount, 0, 100);
  },

  onDash() {
    if (this.gameOver) return;
    this.dashPrimeTime = 0.35;
  },

  onTeleport(): { ok: boolean; punch: boolean } {
    if (this.gameOver) return { ok: false, punch: false };
    if (this.integrity < 12) return { ok: false, punch: false };
    const punch = this.dashPrimeTime > 0;
    this.integrity = clamp(this.integrity - 12, 0, 100);
    this.chargedTime = 1.2;
    this.dashPrimeTime = 0;
    this.punchTime = punch ? 0.75 : 0;
    this.chain += 1;
    this.chainTime = 1.4;
    this.addScore(punch ? 14 : 6);
    if (punch) this.setToast('PUNCH TELEPORT!');
    return { ok: true, punch };
  },

  onTargetHit(speed: number, punch: boolean) {
    if (this.gameOver) return;
    if (this.chainTime > 0) this.chain += 1;
    else this.chain = 1;

    this.chainTime = 1.4;

    const chainMult = 1 + clamp(this.chain, 0, 25) * 0.06;
    const speedBonus = clamp(speed * 2, 0, 45);
    const punchBonus = punch ? 40 : 0;
    this.addScore(60 * chainMult + speedBonus + punchBonus);

    const integrityRestore = punch ? 28 : 20;
    this.restoreIntegrity(integrityRestore);
  },
});
