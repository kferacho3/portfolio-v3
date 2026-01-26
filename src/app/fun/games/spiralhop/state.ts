import { proxy } from 'valtio';

import {
  BALL_SKINS,
  DEFAULT_BALL,
  DEFAULT_THEME,
  PLATFORM_THEMES,
  STORAGE_KEYS,
} from './constants';
import type { SpiralHopPhase } from './types';

function safeJSONParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeNumber(raw: string | null, fallback: number): number {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

const BALL_IDS = BALL_SKINS.map((s) => s.id);
const THEME_IDS = PLATFORM_THEMES.map((t) => t.id);

const COSTS = {
  ball: 60,
  theme: 80,
};

export const spiralHopState = proxy({
  phase: 'menu' as SpiralHopPhase,
  score: 0,
  best: 0,
  combo: 0,
  bestCombo: 0,

  runGems: 0,
  totalGems: 0,

  unlockedBalls: [DEFAULT_BALL] as string[],
  unlockedThemes: [DEFAULT_THEME] as string[],
  selectedBall: DEFAULT_BALL,
  selectedTheme: DEFAULT_THEME,

  toast: '' as string,
  toastUntil: 0,

  worldSeed: Math.floor(Math.random() * 1e9),

  load: () => {
    if (typeof window === 'undefined') return;

    spiralHopState.best = safeNumber(
      localStorage.getItem(STORAGE_KEYS.best),
      0
    );
    spiralHopState.bestCombo = safeNumber(
      localStorage.getItem(STORAGE_KEYS.bestCombo),
      0
    );
    spiralHopState.totalGems = safeNumber(
      localStorage.getItem(STORAGE_KEYS.gems),
      0
    );

    spiralHopState.unlockedBalls = uniq(
      safeJSONParse<string[]>(
        localStorage.getItem(STORAGE_KEYS.unlockedBalls),
        [DEFAULT_BALL]
      ).filter((id) => BALL_IDS.includes(id))
    );

    spiralHopState.unlockedThemes = uniq(
      safeJSONParse<string[]>(
        localStorage.getItem(STORAGE_KEYS.unlockedThemes),
        [DEFAULT_THEME]
      ).filter((id) => THEME_IDS.includes(id))
    );

    const selectedBall =
      localStorage.getItem(STORAGE_KEYS.selectedBall) ?? DEFAULT_BALL;
    if (spiralHopState.unlockedBalls.includes(selectedBall))
      spiralHopState.selectedBall = selectedBall;

    const selectedTheme =
      localStorage.getItem(STORAGE_KEYS.selectedTheme) ?? DEFAULT_THEME;
    if (spiralHopState.unlockedThemes.includes(selectedTheme))
      spiralHopState.selectedTheme = selectedTheme;
  },

  save: () => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEYS.best, String(spiralHopState.best));
    localStorage.setItem(
      STORAGE_KEYS.bestCombo,
      String(spiralHopState.bestCombo)
    );
    localStorage.setItem(STORAGE_KEYS.gems, String(spiralHopState.totalGems));
    localStorage.setItem(
      STORAGE_KEYS.unlockedBalls,
      JSON.stringify(spiralHopState.unlockedBalls)
    );
    localStorage.setItem(
      STORAGE_KEYS.unlockedThemes,
      JSON.stringify(spiralHopState.unlockedThemes)
    );
    localStorage.setItem(
      STORAGE_KEYS.selectedBall,
      spiralHopState.selectedBall
    );
    localStorage.setItem(
      STORAGE_KEYS.selectedTheme,
      spiralHopState.selectedTheme
    );
  },

  start: () => {
    spiralHopState.phase = 'playing';
    spiralHopState.score = 0;
    spiralHopState.combo = 0;
    spiralHopState.runGems = 0;
    spiralHopState.toast = '';
    spiralHopState.toastUntil = 0;
    spiralHopState.worldSeed = Math.floor(Math.random() * 1e9);
  },

  end: () => {
    spiralHopState.phase = 'gameover';

    if (spiralHopState.score > spiralHopState.best)
      spiralHopState.best = spiralHopState.score;
    if (spiralHopState.combo > spiralHopState.bestCombo)
      spiralHopState.bestCombo = spiralHopState.combo;

    spiralHopState.totalGems += spiralHopState.runGems;
    spiralHopState.runGems = 0;

    spiralHopState.save();
  },

  addGem: (amount = 1) => {
    spiralHopState.runGems += amount;
  },

  setBall: (id: string) => {
    if (!spiralHopState.unlockedBalls.includes(id)) return;
    spiralHopState.selectedBall = id;
    spiralHopState.save();
  },

  setTheme: (id: string) => {
    if (!spiralHopState.unlockedThemes.includes(id)) return;
    spiralHopState.selectedTheme = id;
    spiralHopState.save();
  },

  unlockRandomBall: () => {
    if (spiralHopState.totalGems < COSTS.ball) return;

    const locked = BALL_IDS.filter(
      (id) => !spiralHopState.unlockedBalls.includes(id)
    );
    if (locked.length === 0) {
      spiralHopState.toast = 'All balls unlocked';
      spiralHopState.toastUntil = Date.now() + 2000;
      return;
    }

    const id = locked[Math.floor(Math.random() * locked.length)];
    spiralHopState.totalGems -= COSTS.ball;
    spiralHopState.unlockedBalls = uniq([...spiralHopState.unlockedBalls, id]);
    spiralHopState.selectedBall = id;
    spiralHopState.toast = `Unlocked ball: ${BALL_SKINS.find((b) => b.id === id)?.name ?? id}`;
    spiralHopState.toastUntil = Date.now() + 2500;
    spiralHopState.save();
  },

  unlockRandomTheme: () => {
    if (spiralHopState.totalGems < COSTS.theme) return;

    const locked = THEME_IDS.filter(
      (id) => !spiralHopState.unlockedThemes.includes(id)
    );
    if (locked.length === 0) {
      spiralHopState.toast = 'All platform colors unlocked';
      spiralHopState.toastUntil = Date.now() + 2000;
      return;
    }

    const id = locked[Math.floor(Math.random() * locked.length)];
    spiralHopState.totalGems -= COSTS.theme;
    spiralHopState.unlockedThemes = uniq([
      ...spiralHopState.unlockedThemes,
      id,
    ]);
    spiralHopState.selectedTheme = id;
    spiralHopState.toast = `Unlocked platform: ${PLATFORM_THEMES.find((t) => t.id === id)?.name ?? id}`;
    spiralHopState.toastUntil = Date.now() + 2500;
    spiralHopState.save();
  },
});
