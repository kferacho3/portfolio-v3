import { proxy } from 'valtio';

export type GrowthPhase = 'menu' | 'playing' | 'gameover';

type GrowthSaveV1 = {
  bestScore: number;
  bankGems: number;
  skin: number;
  unlocked: number[];
};

const STORAGE_KEY = 'fun_growth_save_v1';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function loadSave(): GrowthSaveV1 {
  if (typeof window === 'undefined') {
    return { bestScore: 0, bankGems: 0, skin: 0, unlocked: [0] };
  }
  const saved = safeParse<GrowthSaveV1>(
    window.localStorage.getItem(STORAGE_KEY)
  );
  if (!saved) return { bestScore: 0, bankGems: 0, skin: 0, unlocked: [0] };

  return {
    bestScore: Number.isFinite(saved.bestScore) ? saved.bestScore : 0,
    bankGems: Number.isFinite(saved.bankGems) ? saved.bankGems : 0,
    skin: Number.isFinite(saved.skin) ? saved.skin : 0,
    unlocked:
      Array.isArray(saved.unlocked) && saved.unlocked.length
        ? saved.unlocked
        : [0],
  };
}

function persistSave(next: GrowthSaveV1) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

const initial = loadSave();

export const growthSkins = [
  { id: 0, name: 'Sprout', cost: 0, primary: '#a13d2d', accent: '#1f1f1f' },
  { id: 1, name: 'Amber', cost: 25, primary: '#c15b2b', accent: '#0f0f10' },
  { id: 2, name: 'Mint', cost: 25, primary: '#2f9d89', accent: '#0f0f10' },
  { id: 3, name: 'Violet', cost: 30, primary: '#7e4bd6', accent: '#0f0f10' },
  { id: 4, name: 'Solar', cost: 30, primary: '#ffb000', accent: '#1a1a1a' },
  { id: 5, name: 'Crimson', cost: 35, primary: '#dc2626', accent: '#1a1a1a' },
  { id: 6, name: 'Azure', cost: 35, primary: '#2563eb', accent: '#0f0f10' },
  { id: 7, name: 'Emerald', cost: 40, primary: '#10b981', accent: '#0f0f10' },
  { id: 8, name: 'Rose', cost: 40, primary: '#f43f5e', accent: '#1a1a1a' },
  { id: 9, name: 'Cyan', cost: 45, primary: '#06b6d4', accent: '#0f0f10' },
  { id: 10, name: 'Lime', cost: 45, primary: '#84cc16', accent: '#0f0f10' },
  { id: 11, name: 'Indigo', cost: 50, primary: '#6366f1', accent: '#0f0f10' },
  { id: 12, name: 'Pink', cost: 50, primary: '#ec4899', accent: '#1a1a1a' },
  { id: 13, name: 'Teal', cost: 55, primary: '#14b8a6', accent: '#0f0f10' },
  { id: 14, name: 'Orange', cost: 55, primary: '#f97316', accent: '#1a1a1a' },
  { id: 15, name: 'Purple', cost: 60, primary: '#a855f7', accent: '#0f0f10' },
  { id: 16, name: 'Yellow', cost: 60, primary: '#eab308', accent: '#1a1a1a' },
  { id: 17, name: 'Red', cost: 65, primary: '#ef4444', accent: '#1a1a1a' },
  { id: 18, name: 'Blue', cost: 65, primary: '#3b82f6', accent: '#0f0f10' },
  { id: 19, name: 'Green', cost: 70, primary: '#22c55e', accent: '#0f0f10' },
  { id: 20, name: 'Magenta', cost: 70, primary: '#d946ef', accent: '#1a1a1a' },
  {
    id: 21,
    name: 'Turquoise',
    cost: 75,
    primary: '#06b6d4',
    accent: '#0f0f10',
  },
  { id: 22, name: 'Gold', cost: 75, primary: '#fbbf24', accent: '#1a1a1a' },
  { id: 23, name: 'Silver', cost: 80, primary: '#94a3b8', accent: '#0f0f10' },
  { id: 24, name: 'Copper', cost: 80, primary: '#b45309', accent: '#1a1a1a' },
  { id: 25, name: 'Neon', cost: 85, primary: '#00ff88', accent: '#0f0f10' },
  { id: 26, name: 'Plasma', cost: 85, primary: '#ff00ff', accent: '#1a1a1a' },
  { id: 27, name: 'Frost', cost: 90, primary: '#bae6fd', accent: '#0f0f10' },
  { id: 28, name: 'Flame', cost: 90, primary: '#f87171', accent: '#1a1a1a' },
  { id: 29, name: 'Cosmic', cost: 95, primary: '#8b5cf6', accent: '#0f0f10' },
  { id: 30, name: 'Nova', cost: 100, primary: '#fbbf24', accent: '#1a1a1a' },
] as const;

export const growthState = proxy({
  phase: 'menu' as GrowthPhase,

  // Run stats
  score: 0,
  runGems: 0,

  // Meta
  bestScore: initial.bestScore,
  bankGems: initial.bankGems,

  skin: initial.skin,
  unlocked: initial.unlocked,

  // UI
  hintPulse: 0,

  start() {
    if (growthState.phase === 'playing') return;
    growthState.phase = 'playing';
    growthState.score = 0;
    growthState.runGems = 0;
    growthState.hintPulse = 0;
  },

  gameOver() {
    if (growthState.phase !== 'playing') return;
    growthState.phase = 'gameover';

    // Commit
    growthState.bankGems += growthState.runGems;
    if (growthState.score > growthState.bestScore)
      growthState.bestScore = growthState.score;

    persistSave({
      bestScore: growthState.bestScore,
      bankGems: growthState.bankGems,
      skin: growthState.skin,
      unlocked: growthState.unlocked,
    });
  },

  reset() {
    growthState.phase = 'menu';
    growthState.score = 0;
    growthState.runGems = 0;
    growthState.hintPulse = 0;
  },

  addGem(amount = 1) {
    growthState.runGems += amount;
  },

  trySelectSkin(id: number) {
    if (!growthState.unlocked.includes(id)) return false;
    growthState.skin = id;
    persistSave({
      bestScore: growthState.bestScore,
      bankGems: growthState.bankGems,
      skin: growthState.skin,
      unlocked: growthState.unlocked,
    });
    return true;
  },

  tryUnlockSkin(id: number) {
    const skin = growthSkins.find((s) => s.id === id);
    if (!skin) return false;
    if (growthState.unlocked.includes(id)) return true;
    if (growthState.bankGems < skin.cost) return false;

    growthState.bankGems -= skin.cost;
    growthState.unlocked = [...growthState.unlocked, id];
    growthState.skin = id;

    persistSave({
      bestScore: growthState.bestScore,
      bankGems: growthState.bankGems,
      skin: growthState.skin,
      unlocked: growthState.unlocked,
    });

    return true;
  },
});
