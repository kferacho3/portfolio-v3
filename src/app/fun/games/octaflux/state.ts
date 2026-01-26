import { proxy } from 'valtio';

import { DEFAULT_RIDER, RIDER_SKINS, STORAGE_KEYS } from './constants';
import type { OctaFluxPhase } from './types';

function safeNumber(raw: string | null, fallback: number): number {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function safeJSONParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

const RIDER_IDS = RIDER_SKINS.map((r) => r.id);
const COSTS = {
  rider: 120,
};

export const octaFluxState = proxy({
  phase: 'menu' as OctaFluxPhase,
  score: 0,
  best: 0,
  runGems: 0,
  totalGems: 0,

  unlockedRiders: [DEFAULT_RIDER] as string[],
  selectedRider: DEFAULT_RIDER,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  load: () => {
    if (typeof localStorage === 'undefined') return;

    octaFluxState.best = safeNumber(localStorage.getItem(STORAGE_KEYS.best), 0);
    octaFluxState.totalGems = safeNumber(
      localStorage.getItem(STORAGE_KEYS.gems),
      0
    );

    octaFluxState.unlockedRiders = uniq(
      safeJSONParse<string[]>(
        localStorage.getItem(STORAGE_KEYS.unlockedRiders),
        [DEFAULT_RIDER]
      ).filter((id) => RIDER_IDS.includes(id))
    );

    const selectedRider =
      localStorage.getItem(STORAGE_KEYS.selectedRider) ?? DEFAULT_RIDER;
    if (octaFluxState.unlockedRiders.includes(selectedRider))
      octaFluxState.selectedRider = selectedRider;
  },

  save: () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.best, String(octaFluxState.best));
    localStorage.setItem(STORAGE_KEYS.gems, String(octaFluxState.totalGems));
    localStorage.setItem(
      STORAGE_KEYS.unlockedRiders,
      JSON.stringify(octaFluxState.unlockedRiders)
    );
    localStorage.setItem(
      STORAGE_KEYS.selectedRider,
      octaFluxState.selectedRider
    );
  },

  start: () => {
    octaFluxState.phase = 'playing';
    octaFluxState.score = 0;
    octaFluxState.runGems = 0;
    octaFluxState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  end: () => {
    octaFluxState.phase = 'gameover';
    if (octaFluxState.score > octaFluxState.best) {
      octaFluxState.best = octaFluxState.score;
    }
    octaFluxState.totalGems += octaFluxState.runGems;
    octaFluxState.runGems = 0;
    octaFluxState.save();
  },

  addGem: (amount = 1) => {
    octaFluxState.runGems += amount;
  },

  setRider: (id: string) => {
    if (!octaFluxState.unlockedRiders.includes(id)) return;
    octaFluxState.selectedRider = id;
    octaFluxState.save();
  },

  unlockRandomRider: () => {
    if (octaFluxState.totalGems < COSTS.rider) return;

    const locked = RIDER_IDS.filter(
      (id) => !octaFluxState.unlockedRiders.includes(id)
    );
    if (locked.length === 0) return;

    const id = locked[Math.floor(Math.random() * locked.length)];
    octaFluxState.totalGems -= COSTS.rider;
    octaFluxState.unlockedRiders = uniq([...octaFluxState.unlockedRiders, id]);
    octaFluxState.selectedRider = id;
    octaFluxState.save();
  },
});
