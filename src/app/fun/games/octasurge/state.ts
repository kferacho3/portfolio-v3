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
  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  load: () => {
    if (typeof localStorage === 'undefined') return;
    octaSurgeState.best = safeNumber(localStorage.getItem(STORAGE_KEYS.best), 0);
  },

  save: () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.best, String(octaSurgeState.best));
  },

  start: () => {
    octaSurgeState.phase = 'playing';
    octaSurgeState.progress = 0;
    octaSurgeState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  end: () => {
    octaSurgeState.phase = 'gameover';
    if (octaSurgeState.progress > octaSurgeState.best) {
      octaSurgeState.best = octaSurgeState.progress;
      octaSurgeState.save();
    }
  },
});
