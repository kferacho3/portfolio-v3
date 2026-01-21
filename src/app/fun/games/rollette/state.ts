import { proxy } from 'valtio';
import {
  CHAIN_WINDOW_S,
  COMBO_STEP,
  DASH_COOLDOWN_S,
  DIFFICULTY_STEP_S,
  PYRAMID_DAMAGE,
  PYRAMID_DEBT,
  RING_BASE_POINTS,
  ZONE_DURATION_S,
  ZONE_INTERVAL_S,
  ZONE_MULTIPLIER,
  ZONE_RADIUS_END,
  ZONE_RADIUS_START,
} from './constants';
import type { PyramidType, RingColor, Vec3 } from './types';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const rolletteState = proxy({
  score: 0,
  highScore: 0,
  gameOver: false,

  debt: 0,

  health: 100,
  maxHealth: 100,

  combo: 0,
  comboTimer: 0,

  dashCooldown: 0,
  dashCooldownMax: DASH_COOLDOWN_S,

  shieldTime: 0,
  slowTime: 0,
  slipperyTime: 0,

  bonusMultiplier: 1,
  bonusMultiplierTime: 0,

  inZone: false,

  zoneCenter: [0, 0, 0] as Vec3,
  zoneTimeLeft: ZONE_DURATION_S,
  zoneSinceMove: 0,
  zoneMoveId: 0,
  zoneRadius: ZONE_RADIUS_START,

  starChain: 0,

  difficultyLevel: 1,
  elapsed: 0,

  toast: '',
  toastTime: 0,

  lastDamageAtMs: 0,

  reset: () => {
    rolletteState.score = 0;
    rolletteState.debt = 0;
    rolletteState.health = rolletteState.maxHealth;
    rolletteState.gameOver = false;
    rolletteState.combo = 0;
    rolletteState.comboTimer = 0;
    rolletteState.dashCooldown = 0;
    rolletteState.shieldTime = 0;
    rolletteState.slowTime = 0;
    rolletteState.slipperyTime = 0;
    rolletteState.bonusMultiplier = 1;
    rolletteState.bonusMultiplierTime = 0;
    rolletteState.inZone = false;
    rolletteState.zoneCenter = [0, 0, 0];
    rolletteState.zoneTimeLeft = ZONE_DURATION_S;
    rolletteState.zoneSinceMove = 0;
    rolletteState.zoneMoveId = 0;
    rolletteState.zoneRadius = ZONE_RADIUS_START;
    rolletteState.starChain = 0;
    rolletteState.difficultyLevel = 1;
    rolletteState.elapsed = 0;
    rolletteState.toast = '';
    rolletteState.toastTime = 0;
    rolletteState.lastDamageAtMs = 0;
  },

  setToast: (text: string, time = 1.25) => {
    rolletteState.toast = text;
    rolletteState.toastTime = Math.max(rolletteState.toastTime, time);
  },

  addScore: (rawPoints: number) => {
    if (!Number.isFinite(rawPoints) || rawPoints <= 0) return;
    const points = Math.floor(rawPoints);
    if (rolletteState.debt > 0) {
      const before = rolletteState.debt;
      rolletteState.debt = Math.max(0, rolletteState.debt - points);
      const paid = before - rolletteState.debt;
      const leftover = points - paid;
      if (rolletteState.debt === 0 && before > 0) {
        rolletteState.setToast('DEBT CLEARED!');
      }
      if (leftover > 0) rolletteState.score += leftover;
    } else {
      rolletteState.score += points;
    }
    if (rolletteState.score > rolletteState.highScore) rolletteState.highScore = rolletteState.score;
  },

  addDebt: (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    rolletteState.debt += Math.floor(amount);
  },

  takeDamage: (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const nowMs = performance.now();
    rolletteState.lastDamageAtMs = nowMs;

    if (rolletteState.shieldTime > 0) {
      rolletteState.shieldTime = 0;
      rolletteState.setToast('SHIELD BROKE');
      return;
    }

    rolletteState.health = clamp(rolletteState.health - amount, 0, rolletteState.maxHealth);
    rolletteState.combo = 0;
    rolletteState.comboTimer = 0;
    rolletteState.starChain = 0;
    if (rolletteState.health <= 0) {
      rolletteState.gameOver = true;
      rolletteState.setToast('RUN LOST');
    }
  },

  heal: (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    rolletteState.health = clamp(rolletteState.health + amount, 0, rolletteState.maxHealth);
  },

  refillDash: (fraction: number) => {
    if (!Number.isFinite(fraction) || fraction <= 0) return;
    rolletteState.dashCooldown = Math.max(0, rolletteState.dashCooldown - rolletteState.dashCooldownMax * fraction);
  },

  hitRing: (color: RingColor, inZone: boolean) => {
    const base = RING_BASE_POINTS[color];
    if (rolletteState.comboTimer > 0) rolletteState.combo += 1;
    else rolletteState.combo = 0;
    rolletteState.comboTimer = CHAIN_WINDOW_S;

    const comboMult = 1 + rolletteState.combo * COMBO_STEP;
    const zoneMult = inZone ? ZONE_MULTIPLIER : 1;
    const mult = rolletteState.bonusMultiplier;

    rolletteState.addScore(base * comboMult * zoneMult * mult);
  },

  hitPyramid: (type: PyramidType) => {
    rolletteState.addDebt(PYRAMID_DEBT[type]);
    rolletteState.takeDamage(PYRAMID_DAMAGE[type]);
    rolletteState.setToast(`PENALTY +${PYRAMID_DEBT[type]}`);
    if (type === 'black') {
      rolletteState.slipperyTime = Math.max(rolletteState.slipperyTime, 3);
      rolletteState.setToast('SLIPPERY!');
    }
  },

  hitStar: () => {
    rolletteState.starChain += 1;
    const chain = rolletteState.starChain;
    const reward = 300 * Math.pow(chain, 1.35);
    rolletteState.addScore(reward);
    rolletteState.setToast(`STAR CHAIN x${chain}`);
  },

  activateMultiplier: (mult: number, time: number) => {
    rolletteState.bonusMultiplier = Math.max(rolletteState.bonusMultiplier, mult);
    rolletteState.bonusMultiplierTime = Math.max(rolletteState.bonusMultiplierTime, time);
    rolletteState.setToast(`MULTIPLIER x${rolletteState.bonusMultiplier}`);
  },

  activateShield: (time: number) => {
    rolletteState.shieldTime = Math.max(rolletteState.shieldTime, time);
    rolletteState.setToast('SHIELD ON');
  },

  activateSlow: (time: number) => {
    rolletteState.slowTime = Math.max(rolletteState.slowTime, time);
    rolletteState.setToast('SLOW-MO');
  },

  tick: (dt: number) => {
    rolletteState.elapsed += dt;

    rolletteState.comboTimer = Math.max(0, rolletteState.comboTimer - dt);
    rolletteState.dashCooldown = Math.max(0, rolletteState.dashCooldown - dt);
    rolletteState.shieldTime = Math.max(0, rolletteState.shieldTime - dt);
    rolletteState.slowTime = Math.max(0, rolletteState.slowTime - dt);
    rolletteState.slipperyTime = Math.max(0, rolletteState.slipperyTime - dt);
    rolletteState.toastTime = Math.max(0, rolletteState.toastTime - dt);

    if (rolletteState.bonusMultiplierTime > 0) {
      rolletteState.bonusMultiplierTime = Math.max(0, rolletteState.bonusMultiplierTime - dt);
      if (rolletteState.bonusMultiplierTime === 0) rolletteState.bonusMultiplier = 1;
    }

    rolletteState.zoneSinceMove += dt;
    rolletteState.zoneTimeLeft = Math.max(0, rolletteState.zoneTimeLeft - dt);
    const t = 1 - clamp(rolletteState.zoneTimeLeft / ZONE_DURATION_S, 0, 1);
    rolletteState.zoneRadius = ZONE_RADIUS_START + (ZONE_RADIUS_END - ZONE_RADIUS_START) * t;

    if (rolletteState.zoneSinceMove >= ZONE_INTERVAL_S) {
      rolletteState.zoneSinceMove = 0;
      rolletteState.zoneTimeLeft = ZONE_DURATION_S;
      rolletteState.zoneMoveId += 1;
      // zoneCenter is set externally so the arena can apply spawn fairness.
    }

    // difficulty ramps every ~25s
    const nextLevel = Math.floor(rolletteState.elapsed / DIFFICULTY_STEP_S) + 1;
    rolletteState.difficultyLevel = Math.max(1, nextLevel);
  },
});

