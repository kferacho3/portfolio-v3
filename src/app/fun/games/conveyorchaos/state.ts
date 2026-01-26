import { proxy } from 'valtio';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export type ConveyorEvent = 'Blackout' | 'Overdrive' | null;

export const conveyorChaosState = proxy({
  score: 0,
  bestScore: 0,
  level: 1,
  chain: 0,
  deliveryStreak: 0,
  strikes: 0,
  maxStrikes: 3,
  gameOver: false,

  goalTime: 12,

  reverseTime: 0,
  reverseCooldown: 0,
  overrideCooldown: 0,
  overrideCooldownMax: 6.5,
  usedReverseThisGoal: false,
  usedOverrideThisGoal: false,

  elapsed: 0,
  event: null as ConveyorEvent,
  eventTime: 0,
  nextEventAt: 18,

  toastText: '',
  toastTime: 0,
  slowMoTime: 0,

  reset() {
    this.score = 0;
    this.level = 1;
    this.chain = 0;
    this.deliveryStreak = 0;
    this.strikes = 0;
    this.gameOver = false;
    this.goalTime = 12;
    this.reverseTime = 0;
    this.reverseCooldown = 0;
    this.overrideCooldown = 0;
    this.usedReverseThisGoal = false;
    this.usedOverrideThisGoal = false;
    this.elapsed = 0;
    this.event = null;
    this.eventTime = 0;
    this.nextEventAt = 18;
    this.toastText = '';
    this.toastTime = 0;
    this.slowMoTime = 0;
  },

  tick(dt: number) {
    this.toastTime = Math.max(0, this.toastTime - dt);
    this.slowMoTime = Math.max(0, this.slowMoTime - dt);
    if (this.gameOver) return;
    this.elapsed += dt;

    this.goalTime = Math.max(0, this.goalTime - dt);
    this.reverseTime = Math.max(0, this.reverseTime - dt);
    this.reverseCooldown = Math.max(0, this.reverseCooldown - dt);
    this.overrideCooldown = Math.max(0, this.overrideCooldown - dt);

    if (this.eventTime > 0) {
      this.eventTime = Math.max(0, this.eventTime - dt);
      if (this.eventTime <= 0) this.event = null;
    } else if (this.elapsed >= this.nextEventAt) {
      this.event = Math.random() < 0.5 ? 'Blackout' : 'Overdrive';
      this.eventTime = this.event === 'Blackout' ? 6 : 8;
      this.nextEventAt = this.elapsed + 24;
    }
  },

  setToast(text: string, time = 1.2, slowMo: boolean = true) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, time);
    if (slowMo) this.slowMoTime = Math.max(this.slowMoTime, 0.12);
  },

  addScore(points: number) {
    const p = Math.max(0, Math.round(points));
    this.score += p;
    if (this.score > this.bestScore) this.bestScore = this.score;
  },

  tryReverse(): boolean {
    if (this.reverseCooldown > 0) return false;
    this.reverseCooldown = 3.5;
    this.reverseTime = 1.35;
    this.usedReverseThisGoal = true;
    // small penalty (encourages skill, but doesn’t ruin runs)
    this.score = Math.max(0, this.score - 12);
    return true;
  },

  tryOverride(): boolean {
    if (this.overrideCooldown > 0) return false;
    this.overrideCooldown = this.overrideCooldownMax;
    this.usedOverrideThisGoal = true;
    return true;
  },

  onDelivery() {
    this.chain += 1;
    const goalMax = clamp(12 - this.level * 0.35, 6, 12);
    const timeRemaining = this.goalTime;
    const usedTools = this.usedReverseThisGoal || this.usedOverrideThisGoal;

    let grade: 'Perfect' | 'Clean' | 'Scuffed' = 'Clean';
    if (timeRemaining >= goalMax * 0.45 && !usedTools) grade = 'Perfect';
    else if (timeRemaining <= 1) grade = 'Scuffed';

    if (grade === 'Perfect') {
      this.deliveryStreak += 1;
    } else {
      this.deliveryStreak = 0;
    }

    const chainMult = 1 + clamp(this.chain, 0, 10) * 0.15;
    const streakMult = 1 + clamp(this.deliveryStreak, 0, 6) * 0.12;
    const timeBonus = Math.round(this.goalTime * 12);
    const perfectBurst = grade === 'Perfect' ? Math.round(80 + timeRemaining * 18 + this.deliveryStreak * 20) : 0;
    const base = 100 + timeBonus + perfectBurst;
    const overdriveMult = this.event === 'Overdrive' ? 1.2 : 1;
    const gradeMult = grade === 'Perfect' ? 1.35 : grade === 'Clean' ? 1.05 : 0.85;
    this.addScore(base * chainMult * streakMult * overdriveMult * gradeMult);

    if (this.strikes > 0 && grade !== 'Scuffed') {
      this.strikes = Math.max(0, this.strikes - 1);
    }

    if (grade === 'Perfect') {
      const label = this.deliveryStreak > 1 ? `EXPRESS DELIVERY x${this.deliveryStreak}` : 'EXPRESS DELIVERY!';
      this.setToast(label, 1.2, true);
    } else if (grade === 'Clean') {
      this.setToast('CLEAN DELIVERY', 1.0, false);
    } else {
      this.setToast('SCUFFED DELIVERY', 1.0, false);
    }

    this.level += 1;
    this.goalTime = clamp(12 - this.level * 0.35, 6, 12);
    this.usedReverseThisGoal = false;
    this.usedOverrideThisGoal = false;
  },

  onFail(reason: 'timeout' | 'hole' | 'crusher') {
    // Recoverable: break chain, keep score, escalate stress
    this.chain = 0;
    this.deliveryStreak = 0;
    this.strikes = clamp(this.strikes + 1, 0, this.maxStrikes);
    this.goalTime = clamp(12 - this.level * 0.35, 6, 12);
    this.usedReverseThisGoal = false;
    this.usedOverrideThisGoal = false;

    if (this.strikes >= this.maxStrikes) {
      this.gameOver = true;
      this.setToast('FACTORY SHUTDOWN', 1.2, false);
      return;
    }

    const reasonText =
      reason === 'timeout' ? 'LATE DELIVERY' : reason === 'hole' ? 'PACKAGE LOST' : 'CRUSHED';
    this.setToast(reasonText, 1.0, false);
  },
});
