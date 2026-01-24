import { proxy } from 'valtio';

import { BALL_SKINS, DEFAULT_BALL, DEFAULT_THEME, PLATFORM_THEMES, STORAGE_KEYS } from './constants';
import type { KnotHopPhase } from './types';

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

const BALL_IDS = BALL_SKINS.map((s) => s.id);
const THEME_IDS = PLATFORM_THEMES.map((t) => t.id);

const COSTS = {
  ball: 60,
  theme: 80,
};

export const knotHopState = proxy({
  phase: 'menu' as KnotHopPhase,
  score: 0,
  best: 0,

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

    knotHopState.best = Number(localStorage.getItem(STORAGE_KEYS.best) ?? '0') || 0;
    knotHopState.totalGems = Number(localStorage.getItem(STORAGE_KEYS.gems) ?? '0') || 0;

    knotHopState.unlockedBalls = uniq(
      safeJSONParse<string[]>(localStorage.getItem(STORAGE_KEYS.unlockedBalls), [DEFAULT_BALL]).filter((id) =>
        BALL_IDS.includes(id),
      ),
    );

    knotHopState.unlockedThemes = uniq(
      safeJSONParse<string[]>(localStorage.getItem(STORAGE_KEYS.unlockedThemes), [DEFAULT_THEME]).filter((id) =>
        THEME_IDS.includes(id),
      ),
    );

    const selectedBall = localStorage.getItem(STORAGE_KEYS.selectedBall) ?? DEFAULT_BALL;
    if (knotHopState.unlockedBalls.includes(selectedBall)) knotHopState.selectedBall = selectedBall;

    const selectedTheme = localStorage.getItem(STORAGE_KEYS.selectedTheme) ?? DEFAULT_THEME;
    if (knotHopState.unlockedThemes.includes(selectedTheme)) knotHopState.selectedTheme = selectedTheme;
  },

  save: () => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEYS.best, String(knotHopState.best));
    localStorage.setItem(STORAGE_KEYS.gems, String(knotHopState.totalGems));
    localStorage.setItem(STORAGE_KEYS.unlockedBalls, JSON.stringify(knotHopState.unlockedBalls));
    localStorage.setItem(STORAGE_KEYS.unlockedThemes, JSON.stringify(knotHopState.unlockedThemes));
    localStorage.setItem(STORAGE_KEYS.selectedBall, knotHopState.selectedBall);
    localStorage.setItem(STORAGE_KEYS.selectedTheme, knotHopState.selectedTheme);
  },

  start: () => {
    knotHopState.phase = 'playing';
    knotHopState.score = 0;
    knotHopState.runGems = 0;
    knotHopState.toast = '';
    knotHopState.toastUntil = 0;
    knotHopState.worldSeed = Math.floor(Math.random() * 1e9);
  },

  end: () => {
    knotHopState.phase = 'gameover';

    if (knotHopState.score > knotHopState.best) knotHopState.best = knotHopState.score;

    knotHopState.totalGems += knotHopState.runGems;
    knotHopState.runGems = 0;

    knotHopState.save();
  },

  addGem: (amount = 1) => {
    knotHopState.runGems += amount;
  },

  setBall: (id: string) => {
    if (!knotHopState.unlockedBalls.includes(id)) return;
    knotHopState.selectedBall = id;
    knotHopState.save();
  },

  setTheme: (id: string) => {
    if (!knotHopState.unlockedThemes.includes(id)) return;
    knotHopState.selectedTheme = id;
    knotHopState.save();
  },

  unlockRandomBall: () => {
    if (knotHopState.totalGems < COSTS.ball) return;

    const locked = BALL_IDS.filter((id) => !knotHopState.unlockedBalls.includes(id));
    if (locked.length === 0) {
      knotHopState.toast = 'All balls unlocked';
      knotHopState.toastUntil = Date.now() + 2000;
      return;
    }

    const id = locked[Math.floor(Math.random() * locked.length)];
    knotHopState.totalGems -= COSTS.ball;
    knotHopState.unlockedBalls = uniq([...knotHopState.unlockedBalls, id]);
    knotHopState.selectedBall = id;
    knotHopState.toast = `Unlocked ball: ${BALL_SKINS.find((b) => b.id === id)?.name ?? id}`;
    knotHopState.toastUntil = Date.now() + 2500;
    knotHopState.save();
  },

  unlockRandomTheme: () => {
    if (knotHopState.totalGems < COSTS.theme) return;

    const locked = THEME_IDS.filter((id) => !knotHopState.unlockedThemes.includes(id));
    if (locked.length === 0) {
      knotHopState.toast = 'All platform colors unlocked';
      knotHopState.toastUntil = Date.now() + 2000;
      return;
    }

    const id = locked[Math.floor(Math.random() * locked.length)];
    knotHopState.totalGems -= COSTS.theme;
    knotHopState.unlockedThemes = uniq([...knotHopState.unlockedThemes, id]);
    knotHopState.selectedTheme = id;
    knotHopState.toast = `Unlocked platform: ${PLATFORM_THEMES.find((t) => t.id === id)?.name ?? id}`;
    knotHopState.toastUntil = Date.now() + 2500;
    knotHopState.save();
  },
});
