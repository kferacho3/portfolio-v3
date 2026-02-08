import { proxy } from 'valtio';

import { GAME, STORAGE_KEYS } from './constants';
import type { CollectibleType, OctaSurgeMode, OctaSurgePhase } from './types';

const safeNum = (raw: string | null, fallback = 0) => {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const dailySeedFromDate = () => {
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
};

export const octaSurgeState = proxy({
  phase: 'menu' as OctaSurgePhase,
  mode: 'classic' as OctaSurgeMode,

  score: 0,
  bestScore: 0,
  combo: 0,
  bestCombo: 0,
  progress: 0,
  time: 0,
  speed: GAME.baseSpeed,

  shieldCharges: 0,
  surgeMeter: 100,
  boostActive: false,

  bestClassic: 0,
  bestDaily: 0,

  runGems: 0,
  runBoost: 0,
  runShield: 0,
  runNearMisses: 0,

  totalGems: 0,
  totalBoost: 0,
  totalShield: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  setMode(mode: OctaSurgeMode) {
    this.mode = mode;
  },

  start() {
    this.phase = 'playing';
    this.score = 0;
    this.combo = 0;
    this.progress = 0;
    this.time = 0;
    this.speed = GAME.baseSpeed;
    this.shieldCharges = 0;
    this.surgeMeter = 100;
    this.boostActive = false;

    this.runGems = 0;
    this.runBoost = 0;
    this.runShield = 0;
    this.runNearMisses = 0;

    this.worldSeed =
      this.mode === 'daily'
        ? dailySeedFromDate()
        : Math.floor(Math.random() * 1_000_000_000);
  },

  end() {
    this.phase = 'gameover';
    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;

    if (this.mode === 'classic') {
      if (this.score > this.bestClassic) this.bestClassic = this.score;
    }
    if (this.mode === 'daily') {
      if (this.score > this.bestDaily) this.bestDaily = this.score;
    }

    this.totalGems += this.runGems;
    this.totalBoost += this.runBoost;
    this.totalShield += this.runShield;
    this.boostActive = false;

    this.save();
  },

  addCollect(type: CollectibleType) {
    if (type === 'gem') this.runGems += 1;
    if (type === 'boost') this.runBoost += 1;
    if (type === 'shield') this.runShield += 1;
  },

  addNearMiss() {
    this.runNearMisses += 1;
  },

  load() {
    if (typeof localStorage === 'undefined') return;
    this.bestScore = safeNum(localStorage.getItem(STORAGE_KEYS.bestScore), 0);
    this.bestClassic = safeNum(
      localStorage.getItem(STORAGE_KEYS.bestClassic),
      0
    );
    this.bestDaily = safeNum(localStorage.getItem(STORAGE_KEYS.bestDaily), 0);
    this.totalGems = safeNum(localStorage.getItem(STORAGE_KEYS.totalGems), 0);
    this.totalBoost = safeNum(localStorage.getItem(STORAGE_KEYS.totalBoost), 0);
    this.totalShield = safeNum(
      localStorage.getItem(STORAGE_KEYS.totalShield),
      0
    );
  },

  save() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.bestScore, String(this.bestScore));
    localStorage.setItem(STORAGE_KEYS.bestClassic, String(this.bestClassic));
    localStorage.setItem(STORAGE_KEYS.bestDaily, String(this.bestDaily));
    localStorage.setItem(STORAGE_KEYS.totalGems, String(this.totalGems));
    localStorage.setItem(STORAGE_KEYS.totalBoost, String(this.totalBoost));
    localStorage.setItem(STORAGE_KEYS.totalShield, String(this.totalShield));
  },
});
