import { proxy } from 'valtio';
import {
  BEST_SCORE_KEY,
  COMBO_WINDOW,
  POWER_DURATION,
  WIZARD_DURATION,
  XANDAR_TIME,
} from './constants';
import type { ArenaThemeId, GamePhase, PowerMode } from './types';

type SaveData = {
  highScore: number;
  arena: ArenaThemeId;
};

const SAVE_KEY = 'rollette_pinball_ultimate_save_v3';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const rolletteState = proxy({
  phase: 'playing' as GamePhase,
  arena: 'nebula' as ArenaThemeId,

  score: 0,
  highScore: 0,
  bonusBank: 0,

  lives: 3,
  maxLives: 3,

  combo: 0,
  comboTimer: 0,
  multiplier: 1,
  multiplierTimer: 0,

  powerMode: null as PowerMode,
  powerTimer: 0,

  wizardActive: false,
  wizardTime: 0,

  xandarActive: false,
  xandarPhase: 0,
  xandarTimer: 0,

  nudgeCooldown: 0,
  tiltLockTime: 0,

  toast: '',
  toastTimer: 0,

  dropBanksCleared: 0,
  spinnerHits: 0,
  bullseyeHits: 0,
  rolloverHits: 0,
  mysteryHits: 0,
  wormholeUses: 0,
  miniBossHits: 0,

  resetTick: 0,

  load: () => {
    if (typeof window === 'undefined') return;
    try {
      const bestRaw = window.localStorage.getItem(BEST_SCORE_KEY);
      if (bestRaw) rolletteState.highScore = Math.max(0, Math.floor(Number(bestRaw) || 0));
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (typeof parsed.highScore === 'number') {
        rolletteState.highScore = Math.max(
          rolletteState.highScore,
          Math.floor(parsed.highScore)
        );
      }
      if (
        parsed.arena === 'nebula' ||
        parsed.arena === 'cotton' ||
        parsed.arena === 'nature'
      ) {
        rolletteState.arena = parsed.arena;
      }
    } catch {
      // noop
    }
  },

  save: () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, `${Math.floor(rolletteState.highScore)}`);
      const payload: SaveData = {
        highScore: Math.floor(rolletteState.highScore),
        arena: rolletteState.arena,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // noop
    }
  },

  setArena: (arena: ArenaThemeId) => {
    rolletteState.arena = arena;
    rolletteState.save();
  },

  setToast: (message: string, duration = 1.25) => {
    rolletteState.toast = message;
    rolletteState.toastTimer = Math.max(rolletteState.toastTimer, duration);
  },

  start: () => {
    rolletteState.phase = 'playing';
    rolletteState.score = 0;
    rolletteState.bonusBank = 0;
    rolletteState.lives = rolletteState.maxLives;
    rolletteState.combo = 0;
    rolletteState.comboTimer = 0;
    rolletteState.multiplier = 1;
    rolletteState.multiplierTimer = 0;
    rolletteState.powerMode = null;
    rolletteState.powerTimer = 0;
    rolletteState.wizardActive = false;
    rolletteState.wizardTime = 0;
    rolletteState.xandarActive = false;
    rolletteState.xandarPhase = 0;
    rolletteState.xandarTimer = 0;
    rolletteState.nudgeCooldown = 0;
    rolletteState.tiltLockTime = 0;
    rolletteState.toast = '';
    rolletteState.toastTimer = 0;
    rolletteState.dropBanksCleared = 0;
    rolletteState.spinnerHits = 0;
    rolletteState.bullseyeHits = 0;
    rolletteState.rolloverHits = 0;
    rolletteState.mysteryHits = 0;
    rolletteState.wormholeUses = 0;
    rolletteState.miniBossHits = 0;
    rolletteState.resetTick += 1;
  },

  // Compatibility with shared game shell reset/start helpers.
  reset: () => {
    rolletteState.start();
  },

  startGame: () => {
    rolletteState.start();
  },

  gameOver: () => {
    if (rolletteState.phase === 'gameover') return;
    rolletteState.phase = 'gameover';
    rolletteState.combo = 0;
    rolletteState.comboTimer = 0;
    rolletteState.setToast('BALL LOST', 1.8);
    rolletteState.save();
  },

  loseLife: () => {
    if (rolletteState.phase !== 'playing') return;
    rolletteState.lives = Math.max(0, rolletteState.lives - 1);
    rolletteState.combo = 0;
    rolletteState.comboTimer = 0;
    if (rolletteState.lives <= 0) rolletteState.gameOver();
    else rolletteState.setToast(`BALL DRAINED · ${rolletteState.lives} LEFT`, 1.2);
  },

  addScore: (points: number) => {
    if (!Number.isFinite(points) || points <= 0) return;
    const p = Math.floor(points);
    rolletteState.score += p;
    if (rolletteState.score > rolletteState.highScore) {
      rolletteState.highScore = rolletteState.score;
      rolletteState.save();
    }
  },

  addBonus: (points: number) => {
    if (!Number.isFinite(points) || points <= 0) return;
    rolletteState.bonusBank += Math.floor(points);
  },

  cashBonus: () => {
    if (rolletteState.bonusBank <= 0) return;
    rolletteState.addScore(rolletteState.bonusBank);
    rolletteState.bonusBank = 0;
  },

  comboScore: (base: number, miniBonus = false) => {
    if (!Number.isFinite(base) || base <= 0) return;

    rolletteState.combo = rolletteState.comboTimer > 0 ? rolletteState.combo + 1 : 1;
    rolletteState.comboTimer = COMBO_WINDOW;

    const comboMult = 1 + clamp(rolletteState.combo - 1, 0, 30) * 0.09;
    const miniMult = miniBonus ? 1.22 : 1;
    const wizardMult = rolletteState.wizardActive ? 2.2 : 1;
    const xandarMult = rolletteState.xandarActive ? 2.6 : 1;
    const points =
      base * comboMult * miniMult * wizardMult * xandarMult * rolletteState.multiplier;

    rolletteState.addScore(points);
    rolletteState.addBonus(points * 0.18);
  },

  activatePower: (power: PowerMode, duration = POWER_DURATION) => {
    rolletteState.powerMode = power;
    rolletteState.powerTimer = Math.max(rolletteState.powerTimer, duration);
    rolletteState.setToast(power ? `${power} MODE` : 'POWER OFF', 0.9);
  },

  activateMultiplier: (multiplier: number, duration = 10) => {
    rolletteState.multiplier = Math.max(rolletteState.multiplier, multiplier);
    rolletteState.multiplierTimer = Math.max(rolletteState.multiplierTimer, duration);
  },

  activateWizard: (duration = WIZARD_DURATION) => {
    rolletteState.wizardActive = true;
    rolletteState.wizardTime = Math.max(rolletteState.wizardTime, duration);
    rolletteState.setToast('WIZARD MODE', 1.4);
  },

  activateXandar: () => {
    rolletteState.xandarActive = true;
    rolletteState.xandarTimer = XANDAR_TIME;
    rolletteState.xandarPhase = 1;
    rolletteState.setToast('SAVE XANDAR', 1.4);
  },

  advanceXandar: () => {
    if (!rolletteState.xandarActive) return;
    rolletteState.xandarPhase += 1;
    if (rolletteState.xandarPhase > 3) {
      rolletteState.xandarActive = false;
      rolletteState.xandarPhase = 0;
      rolletteState.xandarTimer = 0;
      rolletteState.activateMultiplier(3, 14);
      rolletteState.addScore(60_000);
      rolletteState.setToast('XANDAR SAVED · SUPER JACKPOT', 2.2);
    } else {
      rolletteState.setToast(`XANDAR PHASE ${rolletteState.xandarPhase}`, 1.2);
    }
  },

  tick: (dt: number) => {
    if (!Number.isFinite(dt) || dt <= 0) return;

    rolletteState.comboTimer = Math.max(0, rolletteState.comboTimer - dt);
    if (rolletteState.comboTimer <= 0) rolletteState.combo = 0;

    rolletteState.nudgeCooldown = Math.max(0, rolletteState.nudgeCooldown - dt);
    rolletteState.tiltLockTime = Math.max(0, rolletteState.tiltLockTime - dt);
    rolletteState.toastTimer = Math.max(0, rolletteState.toastTimer - dt);

    if (rolletteState.multiplierTimer > 0) {
      rolletteState.multiplierTimer = Math.max(0, rolletteState.multiplierTimer - dt);
      if (rolletteState.multiplierTimer <= 0) rolletteState.multiplier = 1;
    }

    if (rolletteState.powerTimer > 0) {
      rolletteState.powerTimer = Math.max(0, rolletteState.powerTimer - dt);
      if (rolletteState.powerTimer <= 0) rolletteState.powerMode = null;
    }

    if (rolletteState.wizardTime > 0) {
      rolletteState.wizardTime = Math.max(0, rolletteState.wizardTime - dt);
      if (rolletteState.wizardTime <= 0) rolletteState.wizardActive = false;
    }

    if (rolletteState.xandarActive) {
      rolletteState.xandarTimer = Math.max(0, rolletteState.xandarTimer - dt);
      if (rolletteState.xandarTimer <= 0) {
        rolletteState.xandarActive = false;
        rolletteState.xandarPhase = 0;
        rolletteState.setToast('XANDAR LOST', 1.6);
      }
    }
  },
});
