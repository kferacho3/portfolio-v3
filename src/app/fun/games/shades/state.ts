import { proxy } from 'valtio';
import {
  STARTER_PALETTE_ID,
  getPaletteOrderIndex,
  getUnlockablePaletteIds,
  isPaletteId,
  orderPaletteIds,
} from './palettes';

export type ShadesPhase = 'menu' | 'playing' | 'gameover';

const BEST_KEY = 'rachos-fun-shades-best';
const UNLOCKS_KEY = 'rachos-fun-shades-unlocks';
const SELECTED_KEY = 'rachos-fun-shades-selected-palette';

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);
const defaultUnlocked = [STARTER_PALETTE_ID];

function persistProgress() {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(BEST_KEY, String(shadesState.best));
  window.localStorage.setItem(
    UNLOCKS_KEY,
    JSON.stringify(shadesState.unlockedPaletteIds)
  );
  window.localStorage.setItem(SELECTED_KEY, shadesState.selectedPaletteId);
}

function parseUnlocked(raw: string | null): string[] {
  if (!raw) return defaultUnlocked;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultUnlocked;

    return orderPaletteIds(
      parsed.filter((value): value is string => typeof value === 'string')
    );
  } catch {
    return defaultUnlocked;
  }
}

export const shadesState = proxy({
  phase: 'menu' as ShadesPhase,

  score: 0,
  best: 0,

  combo: 0,
  multiplier: 1,

  clears: 0,
  merges: 0,

  selectedPaletteId: STARTER_PALETTE_ID,
  runPaletteId: null as string | null,
  paletteIndex: getPaletteOrderIndex(STARTER_PALETTE_ID),
  unlockedPaletteIds: defaultUnlocked,
  discoveredPaletteId: null as string | null,

  nextShade: 1,
  worldSeed: randomSeed(),

  loadProgress: () => {
    if (typeof window === 'undefined') return;

    const rawBest = window.localStorage.getItem(BEST_KEY);
    const parsedBest = rawBest ? parseInt(rawBest, 10) : 0;
    if (!Number.isNaN(parsedBest)) shadesState.best = parsedBest;

    const unlocked = parseUnlocked(window.localStorage.getItem(UNLOCKS_KEY));
    shadesState.unlockedPaletteIds = unlocked;

    const rawSelected = window.localStorage.getItem(SELECTED_KEY);
    const selected =
      rawSelected && isPaletteId(rawSelected) && unlocked.includes(rawSelected)
        ? rawSelected
        : unlocked[0] ?? STARTER_PALETTE_ID;

    shadesState.selectedPaletteId = selected;
    shadesState.paletteIndex = getPaletteOrderIndex(selected);
  },

  // Back-compat for older calls.
  loadBest: () => {
    shadesState.loadProgress();
  },

  setSelectedPalette: (paletteId: string, persist = true) => {
    if (!isPaletteId(paletteId)) return;
    if (!shadesState.unlockedPaletteIds.includes(paletteId)) return;

    shadesState.selectedPaletteId = paletteId;
    shadesState.paletteIndex = getPaletteOrderIndex(paletteId);

    if (persist) persistProgress();
  },

  cyclePalette: (direction = 1) => {
    const unlocked = shadesState.unlockedPaletteIds;
    if (unlocked.length <= 1) return;

    const currentIndex = unlocked.indexOf(shadesState.selectedPaletteId);
    const delta = direction >= 0 ? 1 : -1;
    const nextIndex = (currentIndex + delta + unlocked.length) % unlocked.length;

    shadesState.setSelectedPalette(unlocked[nextIndex], true);
  },

  unlockEligiblePalettes: () => {
    const currentlyUnlocked = new Set(shadesState.unlockedPaletteIds);
    const eligible = orderPaletteIds(
      getUnlockablePaletteIds({
        score: shadesState.score,
        clears: shadesState.clears,
        combo: shadesState.combo,
      })
    );

    const newlyUnlocked = eligible.filter((id) => !currentlyUnlocked.has(id));
    if (newlyUnlocked.length === 0) return [] as string[];

    shadesState.unlockedPaletteIds = orderPaletteIds([
      ...shadesState.unlockedPaletteIds,
      ...newlyUnlocked,
    ]);

    const newest = newlyUnlocked[newlyUnlocked.length - 1];
    shadesState.discoveredPaletteId = newest;
    persistProgress();

    return newlyUnlocked;
  },

  dismissDiscoveryToast: () => {
    shadesState.discoveredPaletteId = null;
  },

  startGame: () => {
    shadesState.phase = 'playing';
    shadesState.score = 0;
    shadesState.combo = 0;
    shadesState.multiplier = 1;
    shadesState.clears = 0;
    shadesState.merges = 0;
    shadesState.discoveredPaletteId = null;
    shadesState.nextShade = 1;
    shadesState.runPaletteId = shadesState.selectedPaletteId;
    shadesState.paletteIndex = getPaletteOrderIndex(shadesState.selectedPaletteId);
    shadesState.worldSeed = randomSeed();
  },

  endGame: () => {
    if (shadesState.phase === 'gameover') return;

    shadesState.phase = 'gameover';
    shadesState.best = Math.max(shadesState.best, shadesState.score);
    persistProgress();
  },

  resetToMenu: () => {
    shadesState.phase = 'menu';
    shadesState.score = 0;
    shadesState.combo = 0;
    shadesState.multiplier = 1;
    shadesState.clears = 0;
    shadesState.merges = 0;
    shadesState.discoveredPaletteId = null;
    shadesState.nextShade = 1;
    shadesState.runPaletteId = null;
    shadesState.paletteIndex = getPaletteOrderIndex(shadesState.selectedPaletteId);
    shadesState.worldSeed = randomSeed();
  },

  // Compatibility for shared reset utility.
  reset: () => {
    shadesState.resetToMenu();
  },
});
