import { proxy } from 'valtio';

import { STORAGE_KEYS } from './constants';
import type { OctaSurgePhase } from './types';

function safeNumber(raw: string | null, fallback: number): number {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const octaSurgeState = proxy({
  phase: 'menu' as OctaSurgePhase,
  progress: 0, // 0..1
  best: 0, // best progress (0..1)
  score: 0,
  bestScore: 0,
  combo: 0,
  bestCombo: 0,
  shieldCharges: 0,
  surgeMeter: 32,
  boostActive: false,
  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  runCollectibles: 0,
  runSpecial: 0,
  runBoost: 0,
  runShield: 0,
  runNearMisses: 0,
  totalCollectibles: 0,
  totalSpecial: 0,
  totalBoost: 0,
  totalShield: 0,

  load: () => {
    if (typeof localStorage === 'undefined') return;
    octaSurgeState.best = safeNumber(
      localStorage.getItem(STORAGE_KEYS.best),
      0
    );
    octaSurgeState.bestScore = safeNumber(
      localStorage.getItem(STORAGE_KEYS.bestScore),
      0
    );
    octaSurgeState.totalCollectibles = safeNumber(
      localStorage.getItem(STORAGE_KEYS.totalCollectibles),
      0
    );
    octaSurgeState.totalSpecial = safeNumber(
      localStorage.getItem(STORAGE_KEYS.totalSpecial),
      0
    );
    octaSurgeState.totalBoost = safeNumber(
      localStorage.getItem(STORAGE_KEYS.totalBoost),
      0
    );
    octaSurgeState.totalShield = safeNumber(
      localStorage.getItem(STORAGE_KEYS.totalShield),
      0
    );
  },

  save: () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.best, String(octaSurgeState.best));
    localStorage.setItem(
      STORAGE_KEYS.bestScore,
      String(octaSurgeState.bestScore)
    );
    localStorage.setItem(
      STORAGE_KEYS.totalCollectibles,
      String(octaSurgeState.totalCollectibles)
    );
    localStorage.setItem(
      STORAGE_KEYS.totalSpecial,
      String(octaSurgeState.totalSpecial)
    );
    localStorage.setItem(
      STORAGE_KEYS.totalBoost,
      String(octaSurgeState.totalBoost)
    );
    localStorage.setItem(
      STORAGE_KEYS.totalShield,
      String(octaSurgeState.totalShield)
    );
  },

  start: () => {
    octaSurgeState.phase = 'playing';
    octaSurgeState.progress = 0;
    octaSurgeState.score = 0;
    octaSurgeState.combo = 0;
    octaSurgeState.shieldCharges = 0;
    octaSurgeState.surgeMeter = 32;
    octaSurgeState.boostActive = false;
    octaSurgeState.runCollectibles = 0;
    octaSurgeState.runSpecial = 0;
    octaSurgeState.runBoost = 0;
    octaSurgeState.runShield = 0;
    octaSurgeState.runNearMisses = 0;
    octaSurgeState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  end: () => {
    octaSurgeState.phase = 'gameover';
    if (octaSurgeState.progress > octaSurgeState.best) {
      octaSurgeState.best = octaSurgeState.progress;
    }
    if (octaSurgeState.score > octaSurgeState.bestScore) {
      octaSurgeState.bestScore = octaSurgeState.score;
    }
    if (octaSurgeState.combo > octaSurgeState.bestCombo) {
      octaSurgeState.bestCombo = octaSurgeState.combo;
    }
    octaSurgeState.totalCollectibles += octaSurgeState.runCollectibles;
    octaSurgeState.totalSpecial += octaSurgeState.runSpecial;
    octaSurgeState.totalBoost += octaSurgeState.runBoost;
    octaSurgeState.totalShield += octaSurgeState.runShield;
    octaSurgeState.boostActive = false;
    octaSurgeState.save();
  },

  collect: (type: 'normal' | 'special' | 'boost' | 'shield') => {
    if (type === 'normal') octaSurgeState.runCollectibles += 1;
    else if (type === 'special') octaSurgeState.runSpecial += 1;
    else if (type === 'boost') octaSurgeState.runBoost += 1;
    else octaSurgeState.runShield += 1;
  },

  addNearMiss: () => {
    octaSurgeState.runNearMisses += 1;
  },
});
