import { proxy } from 'valtio';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export type TraceEvent = 'Mirror' | 'SoftStorm' | 'Overclock' | null;

export const traceState = proxy({
  score: 0,
  bestScore: 0,
  gameOver: false,
  resetVersion: 0,

  // Phase “charges” economy (max 2)
  phaseCharges: 2,
  phaseMaxCharges: 2,
  phaseTime: 0, // seconds remaining

  // Combo window (timer-based, not perfection forever)
  combo: 0,
  comboTime: 0,
  comboWindow: 1.6,

  purgeCooldown: 0,
  purgeCooldownMax: 8,

  seals: 0,
  perfectPhases: 0,
  sealCooldown: 0,
  sealCooldownMax: 1.0,

  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  elapsed: 0,

  // Event deck
  event: null as TraceEvent,
  eventTime: 0, // seconds remaining
  nextEventAt: 18,

  reset() {
    this.resetVersion += 1;
    this.score = 0;
    this.gameOver = false;
    this.phaseCharges = this.phaseMaxCharges;
    this.phaseTime = 0;
    this.combo = 0;
    this.comboTime = 0;
    this.comboWindow = 1.6;
    this.purgeCooldown = 0;
    this.seals = 0;
    this.perfectPhases = 0;
    this.sealCooldown = 0;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;
    this.elapsed = 0;
    this.event = null;
    this.eventTime = 0;
    this.nextEventAt = 18;
  },

  tick(dt: number) {
    if (this.gameOver) return;

    this.elapsed += dt;

    this.toastTime = Math.max(0, this.toastTime - dt);
    this.slowMoTime = Math.max(0, this.slowMoTime - dt);

    // Shrink combo window a bit as time passes (but keep it fair)
    this.comboWindow = clamp(1.6 - this.elapsed * 0.0025, 0.85, 1.6);

    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime <= 0) this.combo = 0;

    this.phaseTime = Math.max(0, this.phaseTime - dt);
    this.purgeCooldown = Math.max(0, this.purgeCooldown - dt);
    this.sealCooldown = Math.max(0, this.sealCooldown - dt);

    // Event deck timing
    if (this.eventTime > 0) {
      this.eventTime = Math.max(0, this.eventTime - dt);
      if (this.eventTime <= 0) this.event = null;
    } else if (this.elapsed >= this.nextEventAt) {
      const roll = Math.random();
      this.event =
        roll < 0.34 ? 'Mirror' : roll < 0.67 ? 'SoftStorm' : 'Overclock';
      this.eventTime =
        this.event === 'Mirror' ? 6 : this.event === 'SoftStorm' ? 7 : 8;
      this.nextEventAt = this.elapsed + 22;
    }
  },

  addScore(points: number) {
    const mult = 1 + clamp(this.combo, 0, 30) * 0.1;
    const p = Math.max(0, Math.round(points * mult));
    this.score += p;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },

  setToast(text: string, time = 1.1) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, time);
    this.slowMoTime = Math.max(this.slowMoTime, 0.12);
  },

  refreshCombo(extra: number) {
    this.comboTime = clamp(this.comboWindow + extra, 0, 2.4);
    this.combo = this.comboTime > 0 ? this.combo + 1 : 1;
  },

  onShard() {
    this.refreshCombo(0.45);
    this.addScore(40);
    this.phaseCharges = clamp(this.phaseCharges + 1, 0, this.phaseMaxCharges);
  },

  onGraze() {
    this.refreshCombo(0.12);
    this.addScore(8);
  },

  onSeal(cleared: number) {
    this.seals += 1;
    this.sealCooldown = this.sealCooldownMax;
    this.refreshCombo(0.5);
    this.addScore(120 + cleared * 0.6);
    this.phaseCharges = clamp(this.phaseCharges + 1, 0, this.phaseMaxCharges);
    this.setToast('SEALED!');
  },

  onPerfectPhase() {
    this.perfectPhases += 1;
    this.refreshCombo(0.3);
    this.addScore(55);
    this.phaseCharges = clamp(this.phaseCharges + 1, 0, this.phaseMaxCharges);
    this.setToast('PERFECT PHASE');
  },

  tryPhase(): boolean {
    if (this.gameOver) return false;
    if (this.phaseTime > 0) return false;
    if (this.phaseCharges <= 0) return false;
    this.phaseCharges -= 1;
    this.phaseTime = 0.6;
    return true;
  },

  tryPurge(): boolean {
    if (this.gameOver) return false;
    if (this.purgeCooldown > 0) return false;
    this.purgeCooldown = this.purgeCooldownMax;
    this.combo = 0;
    this.comboTime = 0;
    return true;
  },
});
