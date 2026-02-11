import { proxy } from 'valtio';

import { CHARACTERS, DEFAULT_CHARACTER_ID, STORAGE_KEYS } from './constants';
import type { PrismJumpPhase } from './types';

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

export const prismJumpState = proxy({
  phase: 'menu' as PrismJumpPhase,

  // Score
  score: 0,
  best: 0,
  combo: 0,
  multiplier: 1,
  perfectCount: 0,
  furthestRowIndex: 0,

  // Currency
  runCubes: 0,
  totalCubes: 0,

  // Cosmetics
  unlocked: [DEFAULT_CHARACTER_ID] as string[],
  selected: DEFAULT_CHARACTER_ID,

  // HUD helper (0..1)
  edgeSafe: 1,

  // Minimap (updated each frame when playing)
  minimapPlayerX: 0,
  minimapPlayerZ: 0,
  minimapRows: [] as { z: number; platforms: { x: number }[] }[],

  // Lightweight toast messaging
  toast: '' as string,
  toastUntil: 0,

  // For deterministic world resets when global arcade restart is pressed
  worldSeed: Math.floor(Math.random() * 1e9),

  load: () => {
    if (typeof window === 'undefined') return;

    prismJumpState.best =
      Number(localStorage.getItem(STORAGE_KEYS.best) ?? '0') || 0;
    prismJumpState.totalCubes =
      Number(localStorage.getItem(STORAGE_KEYS.cubes) ?? '0') || 0;

    const unlocked = safeJSONParse<string[]>(
      localStorage.getItem(STORAGE_KEYS.unlocked),
      [DEFAULT_CHARACTER_ID]
    );
    prismJumpState.unlocked = uniq(unlocked).filter((id) =>
      CHARACTERS.some((c) => c.id === id)
    );
    if (!prismJumpState.unlocked.includes(DEFAULT_CHARACTER_ID))
      prismJumpState.unlocked.unshift(DEFAULT_CHARACTER_ID);

    const selected =
      localStorage.getItem(STORAGE_KEYS.selected) ?? DEFAULT_CHARACTER_ID;
    prismJumpState.selected = prismJumpState.unlocked.includes(selected)
      ? selected
      : prismJumpState.unlocked[0];
  },

  save: () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.best, String(prismJumpState.best));
    localStorage.setItem(STORAGE_KEYS.cubes, String(prismJumpState.totalCubes));
    localStorage.setItem(
      STORAGE_KEYS.unlocked,
      JSON.stringify(prismJumpState.unlocked)
    );
    localStorage.setItem(STORAGE_KEYS.selected, prismJumpState.selected);
  },

  setToast: (msg: string, ms = 1800) => {
    prismJumpState.toast = msg;
    prismJumpState.toastUntil = Date.now() + ms;
  },

  setSelected: (id: string) => {
    if (!prismJumpState.unlocked.includes(id)) return;
    prismJumpState.selected = id;
    prismJumpState.save();
  },

  unlockRandom: () => {
    const COST = 100;
    if (prismJumpState.totalCubes < COST) {
      prismJumpState.setToast(`Need ${COST} cubes`);
      return;
    }

    const locked = CHARACTERS.map((c) => c.id).filter(
      (id) => !prismJumpState.unlocked.includes(id)
    );
    if (locked.length === 0) {
      prismJumpState.setToast('All characters unlocked!');
      return;
    }

    const pick = locked[Math.floor(Math.random() * locked.length)];
    prismJumpState.totalCubes -= COST;
    prismJumpState.unlocked = uniq([...prismJumpState.unlocked, pick]);
    prismJumpState.selected = pick;
    prismJumpState.save();

    const pickedName = CHARACTERS.find((c) => c.id === pick)?.name ?? pick;
    prismJumpState.setToast(`Unlocked: ${pickedName}`, 2400);
  },

  start: () => {
    prismJumpState.worldSeed = (prismJumpState.worldSeed + 1) % 1_000_000_000;
    prismJumpState.score = 0;
    prismJumpState.combo = 0;
    prismJumpState.multiplier = 1;
    prismJumpState.perfectCount = 0;
    prismJumpState.furthestRowIndex = 0;
    prismJumpState.runCubes = 0;
    prismJumpState.edgeSafe = 1;
    prismJumpState.phase = 'playing';
  },

  startGame: () => {
    prismJumpState.start();
  },

  addRunCubes: (amount: number) => {
    prismJumpState.runCubes += amount;
  },

  end: () => {
    // Persist
    prismJumpState.best = Math.max(prismJumpState.best, prismJumpState.score);
    prismJumpState.totalCubes += prismJumpState.runCubes;
    prismJumpState.runCubes = 0;
    prismJumpState.save();

    prismJumpState.phase = 'gameover';
  },

  backToMenu: () => {
    prismJumpState.phase = 'menu';
  },

  bumpSeed: () => {
    prismJumpState.worldSeed = (prismJumpState.worldSeed + 1) % 1_000_000_000;
  },
});
