import { proxy } from 'valtio';

import { GAME, STORAGE_KEYS } from './constants';
import type {
  CollectibleType,
  OctaFxLevel,
  OctaSurgeMode,
  OctaSurgePhase,
} from './types';

const safeNum = (raw: string | null, fallback = 0) => {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const safeFxLevel = (raw: string | null): OctaFxLevel => {
  if (raw === 'full' || raw === 'medium' || raw === 'low') return raw;
  return 'full';
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
  magnetActive: false,
  prismActive: false,
  phaseActive: false,
  speedPadActive: false,
  dangerPulse: 0,

  bestClassic: 0,
  bestDaily: 0,

  runGems: 0,
  runBoost: 0,
  runShield: 0,
  runMagnet: 0,
  runPrism: 0,
  runPhase: 0,
  runNearMisses: 0,

  totalGems: 0,
  totalBoost: 0,
  totalShield: 0,
  totalMagnet: 0,
  totalPrism: 0,
  totalPhase: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),
  fxLevel: 'full' as OctaFxLevel,

  setMode(mode: OctaSurgeMode) {
    this.mode = mode;
  },

  setFxLevel(level: OctaFxLevel) {
    this.fxLevel = level;
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
    this.magnetActive = false;
    this.prismActive = false;
    this.phaseActive = false;
    this.speedPadActive = false;
    this.dangerPulse = 0;

    this.runGems = 0;
    this.runBoost = 0;
    this.runShield = 0;
    this.runMagnet = 0;
    this.runPrism = 0;
    this.runPhase = 0;
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
    this.totalMagnet += this.runMagnet;
    this.totalPrism += this.runPrism;
    this.totalPhase += this.runPhase;
    this.boostActive = false;
    this.magnetActive = false;
    this.prismActive = false;
    this.phaseActive = false;
    this.speedPadActive = false;

    this.save();
  },

  addCollect(type: CollectibleType) {
    if (type === 'gem') this.runGems += 1;
    if (type === 'boost') this.runBoost += 1;
    if (type === 'shield') this.runShield += 1;
    if (type === 'magnet') this.runMagnet += 1;
    if (type === 'prism') this.runPrism += 1;
    if (type === 'phase') this.runPhase += 1;
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
    this.totalMagnet = safeNum(
      localStorage.getItem(STORAGE_KEYS.totalMagnet),
      0
    );
    this.totalPrism = safeNum(localStorage.getItem(STORAGE_KEYS.totalPrism), 0);
    this.totalPhase = safeNum(localStorage.getItem(STORAGE_KEYS.totalPhase), 0);
    this.fxLevel = safeFxLevel(localStorage.getItem(STORAGE_KEYS.fxLevel));
  },

  save() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.bestScore, String(this.bestScore));
    localStorage.setItem(STORAGE_KEYS.bestClassic, String(this.bestClassic));
    localStorage.setItem(STORAGE_KEYS.bestDaily, String(this.bestDaily));
    localStorage.setItem(STORAGE_KEYS.totalGems, String(this.totalGems));
    localStorage.setItem(STORAGE_KEYS.totalBoost, String(this.totalBoost));
    localStorage.setItem(STORAGE_KEYS.totalShield, String(this.totalShield));
    localStorage.setItem(STORAGE_KEYS.totalMagnet, String(this.totalMagnet));
    localStorage.setItem(STORAGE_KEYS.totalPrism, String(this.totalPrism));
    localStorage.setItem(STORAGE_KEYS.totalPhase, String(this.totalPhase));
    localStorage.setItem(STORAGE_KEYS.fxLevel, this.fxLevel);
  },
});
