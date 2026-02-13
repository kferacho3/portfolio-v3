import { proxy } from 'valtio';
import { COMBO_WINDOW_S, NUDGE_COOLDOWN_S } from './constants';
import type { PowerMode, ThemeId } from './types';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const rolletteState = proxy({
  score: 0,
  highScore: 0,
  gameOver: false,

  health: 100,
  maxHealth: 100,

  bonusBank: 0,

  combo: 0,
  comboTimer: 0,

  nudgeCooldown: 0,
  nudgeCooldownMax: NUDGE_COOLDOWN_S,

  shieldTime: 0,
  multiplier: 1,
  multiplierTime: 0,

  powerMode: null as PowerMode,
  powerTime: 0,

  wizardActive: false,
  wizardTime: 0,

  multiballActive: false,
  multiballTime: 0,
  multiballLit: false,

  inMiniZone: false,

  theme: 'nebula' as ThemeId,

  toast: '',
  toastTime: 0,

  reset: () => {
    rolletteState.score = 0;
    rolletteState.gameOver = false;

    rolletteState.health = rolletteState.maxHealth;
    rolletteState.bonusBank = 0;

    rolletteState.combo = 0;
    rolletteState.comboTimer = 0;

    rolletteState.nudgeCooldown = 0;

    rolletteState.shieldTime = 0;
    rolletteState.multiplier = 1;
    rolletteState.multiplierTime = 0;

    rolletteState.powerMode = null;
    rolletteState.powerTime = 0;

    rolletteState.wizardActive = false;
    rolletteState.wizardTime = 0;

    rolletteState.multiballActive = false;
    rolletteState.multiballTime = 0;
    rolletteState.multiballLit = false;

    rolletteState.inMiniZone = false;

    rolletteState.toast = '';
    rolletteState.toastTime = 0;
  },

  setTheme: (theme: ThemeId) => {
    rolletteState.theme = theme;
  },

  setToast: (msg: string, t = 1.2) => {
    rolletteState.toast = msg;
    rolletteState.toastTime = Math.max(rolletteState.toastTime, t);
  },

  addScore: (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return;
    const pts = Math.floor(raw);
    rolletteState.score += pts;
    if (rolletteState.score > rolletteState.highScore) {
      rolletteState.highScore = rolletteState.score;
    }
  },

  addBank: (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return;
    rolletteState.bonusBank += Math.floor(raw);
  },

  clearBank: () => {
    rolletteState.bonusBank = 0;
  },

  addComboPoints: (base: number, inMini = false) => {
    if (!Number.isFinite(base) || base <= 0) return;

    rolletteState.combo = rolletteState.comboTimer > 0 ? rolletteState.combo + 1 : 1;
    rolletteState.comboTimer = COMBO_WINDOW_S;

    const comboMult = 1 + Math.max(0, rolletteState.combo - 1) * 0.08;
    const miniMult = inMini ? 1.3 : 1;
    const wizardMult = rolletteState.wizardActive ? 2.25 : 1;
    const multiBallMult = rolletteState.multiballActive ? 1.7 : 1;
    const powerMult = rolletteState.multiplier;

    const points =
      base * comboMult * miniMult * wizardMult * multiBallMult * powerMult;
    rolletteState.addScore(points);
    rolletteState.addBank(points * 0.14);
  },

  takeDamage: (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return;

    if (rolletteState.shieldTime > 0) {
      rolletteState.shieldTime = 0;
      rolletteState.setToast('SHIELD BROKE', 0.7);
      return;
    }

    rolletteState.health = clamp(rolletteState.health - raw, 0, rolletteState.maxHealth);
    rolletteState.combo = 0;
    rolletteState.comboTimer = 0;

    if (rolletteState.health <= 0) {
      rolletteState.health = 0;
      rolletteState.gameOver = true;
      rolletteState.setToast('GAME OVER', 1.6);
    }
  },

  heal: (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return;
    rolletteState.health = clamp(rolletteState.health + raw, 0, rolletteState.maxHealth);
  },

  setPower: (mode: PowerMode, duration: number) => {
    rolletteState.powerMode = mode;
    rolletteState.powerTime = mode ? Math.max(rolletteState.powerTime, duration) : 0;
  },

  activateMultiplier: (mult: number, duration: number) => {
    rolletteState.multiplier = Math.max(rolletteState.multiplier, mult);
    rolletteState.multiplierTime = Math.max(rolletteState.multiplierTime, duration);
  },

  activateShield: (duration: number) => {
    rolletteState.shieldTime = Math.max(rolletteState.shieldTime, duration);
  },

  activateWizard: (duration: number) => {
    rolletteState.wizardActive = true;
    rolletteState.wizardTime = Math.max(rolletteState.wizardTime, duration);
  },

  activateMultiball: (duration: number) => {
    rolletteState.multiballActive = true;
    rolletteState.multiballTime = Math.max(rolletteState.multiballTime, duration);
    rolletteState.multiballLit = false;
  },

  setMultiballLit: (lit: boolean) => {
    rolletteState.multiballLit = lit;
  },

  tick: (dt: number) => {
    rolletteState.comboTimer = Math.max(0, rolletteState.comboTimer - dt);
    rolletteState.nudgeCooldown = Math.max(0, rolletteState.nudgeCooldown - dt);
    rolletteState.shieldTime = Math.max(0, rolletteState.shieldTime - dt);
    rolletteState.toastTime = Math.max(0, rolletteState.toastTime - dt);

    if (rolletteState.multiplierTime > 0) {
      rolletteState.multiplierTime = Math.max(0, rolletteState.multiplierTime - dt);
      if (rolletteState.multiplierTime === 0) rolletteState.multiplier = 1;
    }

    if (rolletteState.powerTime > 0) {
      rolletteState.powerTime = Math.max(0, rolletteState.powerTime - dt);
      if (rolletteState.powerTime === 0) rolletteState.powerMode = null;
    }

    if (rolletteState.wizardTime > 0) {
      rolletteState.wizardTime = Math.max(0, rolletteState.wizardTime - dt);
      if (rolletteState.wizardTime === 0) rolletteState.wizardActive = false;
    }

    if (rolletteState.multiballTime > 0) {
      rolletteState.multiballTime = Math.max(0, rolletteState.multiballTime - dt);
      if (rolletteState.multiballTime === 0) rolletteState.multiballActive = false;
    }
  },
});
