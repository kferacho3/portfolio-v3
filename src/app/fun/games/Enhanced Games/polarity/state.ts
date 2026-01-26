import { proxy } from 'valtio';

export type PolarityCharge = 1 | -1;
export type PolarityEvent = 'PolarityStorm' | 'Superconductor' | 'IonBloom' | null;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const COMBO_TIME_MAX = 3.25;

export const polarityState = proxy({
  score: 0,
  bestScore: 0,
  health: 100,
  gameOver: false,

  charge: 1 as PolarityCharge,

  combo: 0,
  comboTime: 0, // seconds remaining
  comboWindow: 2.25, // recalculated as difficulty increases
  comboTimeMax: COMBO_TIME_MAX,

  instability: 0, // 0..100
  wobbleTime: 0, // seconds remaining
  wobbleFlip: 1 as 1 | -1,

  pulseCooldown: 0, // seconds remaining
  pulseCooldownMax: 1.25,

  stabilizeTime: 0, // seconds remaining
  stabilizeCooldown: 0, // seconds remaining
  stabilizeCooldownMax: 7.5,

  resonance: 0, // 0..100
  burstReady: false,

  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  elapsed: 0,
  level: 1,

  event: null as PolarityEvent,
  eventTime: 0,
  nextEventAt: 25,
  zone: null as { x: number; z: number; radius: number } | null,
  zoneActive: false,

  reset() {
    this.score = 0;
    this.health = 100;
    this.gameOver = false;
    this.charge = 1;

    this.combo = 0;
    this.comboTime = 0;
    this.comboWindow = 2.25;
    this.comboTimeMax = COMBO_TIME_MAX;

    this.instability = 0;
    this.wobbleTime = 0;
    this.wobbleFlip = 1;

    this.pulseCooldown = 0;
    this.stabilizeTime = 0;
    this.stabilizeCooldown = 0;

    this.resonance = 0;
    this.burstReady = false;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;

    this.elapsed = 0;
    this.level = 1;
    this.event = null;
    this.eventTime = 0;
    this.nextEventAt = 25;
    this.zone = null;
    this.zoneActive = false;
  },

  tick(dt: number) {
    if (this.gameOver) return;

    this.elapsed += dt;
    this.level = 1 + Math.floor(this.elapsed / 20);
    this.comboWindow = clamp(2.25 - (this.level - 1) * 0.05, 1.2, 2.25);

    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime <= 0) this.combo = 0;

    this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    this.wobbleTime = Math.max(0, this.wobbleTime - dt);
    this.stabilizeTime = Math.max(0, this.stabilizeTime - dt);
    this.stabilizeCooldown = Math.max(0, this.stabilizeCooldown - dt);
    this.toastTime = Math.max(0, this.toastTime - dt);
    this.slowMoTime = Math.max(0, this.slowMoTime - dt);

    // Slow decay so instability stays “pressure” but not permanent punishment
    const decay = this.stabilizeTime > 0 ? 18 : 6;
    this.instability = clamp(this.instability - dt * decay, 0, 100);

    if (this.eventTime > 0) {
      this.eventTime = Math.max(0, this.eventTime - dt);
      if (this.eventTime <= 0) {
        this.event = null;
        this.zone = null;
        this.zoneActive = false;
      }
    } else if (this.elapsed >= this.nextEventAt) {
      const roll = Math.random();
      this.event = roll < 0.34 ? 'PolarityStorm' : roll < 0.67 ? 'Superconductor' : 'IonBloom';
      this.eventTime = this.event === 'Superconductor' ? 10 : 8;
      this.nextEventAt = this.elapsed + 25;
    }
  },

  flipCharge() {
    if (this.gameOver) return;
    this.charge = this.charge === 1 ? -1 : 1;
  },

  breakCombo() {
    this.combo = 0;
    this.comboTime = 0;
  },

  refreshCombo(extraSeconds: number = 0) {
    const base = Math.max(this.comboTime, this.comboWindow);
    this.comboTime = clamp(base + extraSeconds, 0, this.comboTimeMax);
  },

  addScore(basePoints: number, zoneMult: number = 1) {
    const comboBoost = 1 + clamp(this.combo - 1, 0, 20) * 0.12;
    const levelBoost = 1 + clamp(this.level - 1, 0, 50) * 0.04;
    const points = Math.round(basePoints * comboBoost * levelBoost * zoneMult);
    this.score += points;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },

  setToast(text: string, time = 1.1) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, time);
    this.slowMoTime = Math.max(this.slowMoTime, 0.12);
  },

  addResonance(amount: number) {
    this.resonance = clamp(this.resonance + amount, 0, 100);
    this.burstReady = this.resonance >= 100;
  },

  addInstability(amount: number) {
    this.instability = clamp(this.instability + amount, 0, 100);
    if (this.instability >= 75 && this.wobbleTime <= 0) {
      this.wobbleTime = 1.2;
      this.wobbleFlip = Math.random() < 0.5 ? -1 : 1;
    }
    if (this.instability >= 100) {
      // Clamp and add a small penalty for repeated mismatches.
      this.instability = 65;
      this.wobbleTime = Math.max(this.wobbleTime, 1.4);
      this.wobbleFlip = Math.random() < 0.5 ? -1 : 1;
      this.takeDamage(6);
    }
  },

  tryPulse(): 'burst' | 'pulse' | null {
    if (this.gameOver) return null;
    if (this.pulseCooldown > 0) return null;
    const burst = this.burstReady;
    if (burst) {
      this.resonance = 0;
      this.burstReady = false;
      this.setToast('RESONANCE!');
      this.pulseCooldown = this.pulseCooldownMax + 0.35;
      return 'burst';
    }
    this.pulseCooldown = this.pulseCooldownMax;
    return 'pulse';
  },

  tryStabilize(): boolean {
    if (this.gameOver) return false;
    if (this.stabilizeCooldown > 0 || this.stabilizeTime > 0) return false;
    this.stabilizeTime = 1.2;
    this.stabilizeCooldown = this.stabilizeCooldownMax;
    this.instability = clamp(this.instability - 28, 0, 100);
    return true;
  },

  onIonCollected(matchesCharge: boolean, zoneMult: number = 1, resonanceMult: number = 1) {
    if (this.comboTime > 0) {
      this.combo += 1;
    } else {
      this.combo = 1;
    }

    if (matchesCharge) {
      this.addScore(18, zoneMult);
      this.refreshCombo(0.55);
      this.addResonance(7 * resonanceMult);
    } else {
      this.addScore(6, zoneMult);
      this.refreshCombo(0.18);
      this.addInstability(16);
      this.softDamage(4);
      this.addResonance(12 * resonanceMult);
    }
  },

  onNearMiss(zoneMult: number = 1, resonanceMult: number = 1) {
    this.addScore(10, zoneMult);
    this.refreshCombo(0.22);
    this.addResonance(6 * resonanceMult);
  },

  onPylonWhip(zoneMult: number = 1, resonanceMult: number = 1) {
    this.addScore(12, zoneMult);
    this.refreshCombo(0.18);
    this.addResonance(8 * resonanceMult);
  },

  onFlipPerfect(zoneMult: number = 1, resonanceMult: number = 1) {
    this.addScore(28, zoneMult);
    this.refreshCombo(0.3);
    this.addResonance(10 * resonanceMult);
    this.pulseCooldown = Math.max(0, this.pulseCooldown - 0.4);
    this.setToast('FLIP PERFECT');
  },

  onResonanceBurst(zoneMult: number = 1) {
    this.addScore(140, zoneMult);
    this.setToast('RESONANCE!');
  },

  takeDamage(amount: number) {
    this.health = clamp(this.health - amount, 0, 100);
    this.breakCombo();
    if (this.health <= 0) this.gameOver = true;
  },

  softDamage(amount: number) {
    this.health = clamp(this.health - amount, 0, 100);
    if (this.health <= 0) this.gameOver = true;
  },

  heal(amount: number) {
    this.health = clamp(this.health + amount, 0, 100);
  },
});
