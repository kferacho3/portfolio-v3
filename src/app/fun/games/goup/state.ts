import { proxy } from 'valtio';

export type GoUpPhase = 'menu' | 'playing' | 'gameover';
export type CrashType = 'none' | 'fell' | 'riser' | 'spike';

const BEST_KEY = 'rachos-fun-goup-best';
const ARENA_KEY = 'rachos-fun-goup-arena';
const ARENA_MODE_KEY = 'rachos-fun-goup-arena-mode';

export const goUpState = proxy({
  phase: 'menu' as GoUpPhase,
  score: 0,
  best: 0,
  gems: 0,
  gapsJumped: 0,
  wallsClimbed: 0,
  spikesAvoided: 0,
  arenaIndex: 0,
  arenaMode: 'auto' as 'auto' | 'fixed',

  crashType: 'none' as CrashType,
  crashX: 0,
  crashY: 0,
  crashZ: 0,

  worldSeed: Math.floor(Math.random() * 1_000_000_000),

  loadBest: () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isNaN(parsed)) goUpState.best = parsed;
  },

  loadArena: () => {
    if (typeof window === 'undefined') return;
    const storedArena = window.localStorage.getItem(ARENA_KEY);
    const storedMode = window.localStorage.getItem(ARENA_MODE_KEY);
    const parsedArena = storedArena ? Number(storedArena) : 0;
    if (!Number.isNaN(parsedArena)) goUpState.arenaIndex = parsedArena;
    if (storedMode === 'auto' || storedMode === 'fixed') {
      goUpState.arenaMode = storedMode;
    }
  },

  setArena: (index: number) => {
    goUpState.arenaIndex = index;
    goUpState.arenaMode = 'fixed';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ARENA_KEY, String(index));
      window.localStorage.setItem(ARENA_MODE_KEY, goUpState.arenaMode);
    }
  },

  setArenaMode: (mode: 'auto' | 'fixed') => {
    goUpState.arenaMode = mode;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ARENA_MODE_KEY, mode);
    }
  },

  startGame: () => {
    goUpState.phase = 'playing';
    goUpState.score = 0;
    goUpState.gems = 0;
    goUpState.gapsJumped = 0;
    goUpState.wallsClimbed = 0;
    goUpState.spikesAvoided = 0;
    goUpState.crashType = 'none';
    goUpState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },

  endGame: (crashType: CrashType = 'none', x = 0, y = 0, z = 0) => {
    if (goUpState.phase === 'gameover') return;
    goUpState.phase = 'gameover';
    goUpState.crashType = crashType;
    goUpState.crashX = x;
    goUpState.crashY = y;
    goUpState.crashZ = z;
    if (goUpState.score > goUpState.best) {
      goUpState.best = goUpState.score;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BEST_KEY, String(goUpState.best));
      }
    }
  },

  addGapBonus: () => {
    goUpState.gapsJumped += 1;
  },

  addWallBonus: () => {
    goUpState.wallsClimbed += 1;
  },

  addSpikeAvoidBonus: () => {
    goUpState.spikesAvoided += 1;
  },

  reset: () => {
    goUpState.phase = 'menu';
    goUpState.score = 0;
    goUpState.gems = 0;
    goUpState.gapsJumped = 0;
    goUpState.wallsClimbed = 0;
    goUpState.spikesAvoided = 0;
    goUpState.crashType = 'none';
    goUpState.worldSeed = Math.floor(Math.random() * 1_000_000_000);
  },
});
