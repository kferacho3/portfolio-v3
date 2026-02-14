import { proxy } from 'valtio';
import { PRISM_CHARACTER_SKINS, STORAGE_KEYS } from './constants';
import type { PrismJumpPhase } from './types';

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

export const prismJumpState = proxy({
  phase: 'menu' as PrismJumpPhase,

  score: 0,
  jumpScore: 0,
  gemBonusScore: 0,
  best: 0,
  furthestRowIndex: 0,

  runCubes: 0,
  lastRunCubes: 0,
  totalCubes: 0,
  selectedSkin: 0,

  edgeSafe: 1,
  toast: '' as string,
  toastUntil: 0,

  worldSeed: randomSeed(),

  load: () => {
    if (typeof window === 'undefined') return;
    prismJumpState.best =
      Number(localStorage.getItem(STORAGE_KEYS.best) ?? '0') || 0;
    prismJumpState.totalCubes =
      Number(localStorage.getItem(STORAGE_KEYS.cubes) ?? '0') || 0;
    const selectedSkin = Number(localStorage.getItem(STORAGE_KEYS.skin) ?? '0') || 0;
    prismJumpState.selectedSkin = Math.max(
      0,
      Math.min(PRISM_CHARACTER_SKINS.length - 1, Math.floor(selectedSkin))
    );
  },

  save: () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.best, String(prismJumpState.best));
    localStorage.setItem(STORAGE_KEYS.cubes, String(prismJumpState.totalCubes));
    localStorage.setItem(STORAGE_KEYS.skin, String(prismJumpState.selectedSkin));
  },

  setToast: (message: string, ms = 900) => {
    prismJumpState.toast = message;
    prismJumpState.toastUntil = Date.now() + ms;
  },

  start: () => {
    prismJumpState.worldSeed = (prismJumpState.worldSeed + 1) % 1_000_000_000;
    prismJumpState.score = 0;
    prismJumpState.jumpScore = 0;
    prismJumpState.gemBonusScore = 0;
    prismJumpState.furthestRowIndex = 0;
    prismJumpState.runCubes = 0;
    prismJumpState.lastRunCubes = 0;
    prismJumpState.edgeSafe = 1;
    prismJumpState.phase = 'playing';
  },

  startGame: () => {
    prismJumpState.start();
  },

  addRunCubes: (amount: number) => {
    if (amount <= 0) return;
    prismJumpState.runCubes += amount;
  },

  addGemBonusScore: (amount: number) => {
    if (amount <= 0) return;
    prismJumpState.gemBonusScore += Math.floor(amount);
    prismJumpState.score = prismJumpState.jumpScore + prismJumpState.gemBonusScore;
  },

  setJumpScore: (jumpScore: number) => {
    const next = Math.max(0, Math.floor(jumpScore));
    if (next <= prismJumpState.jumpScore) return;
    prismJumpState.jumpScore = next;
    prismJumpState.score = prismJumpState.jumpScore + prismJumpState.gemBonusScore;
  },

  setSelectedSkin: (index: number) => {
    prismJumpState.selectedSkin = Math.max(
      0,
      Math.min(PRISM_CHARACTER_SKINS.length - 1, Math.floor(index))
    );
    prismJumpState.save();
  },

  cycleSkin: (direction: -1 | 1) => {
    const max = PRISM_CHARACTER_SKINS.length;
    if (max <= 0) return;
    const next = (prismJumpState.selectedSkin + direction + max) % max;
    prismJumpState.selectedSkin = next;
    prismJumpState.save();
  },

  end: () => {
    if (prismJumpState.phase !== 'playing') return;
    prismJumpState.lastRunCubes = prismJumpState.runCubes;
    prismJumpState.best = Math.max(prismJumpState.best, prismJumpState.score);
    prismJumpState.totalCubes += prismJumpState.runCubes;
    prismJumpState.runCubes = 0;
    prismJumpState.save();
    prismJumpState.phase = 'gameover';
  },

  backToMenu: () => {
    prismJumpState.phase = 'menu';
  },

  reset: () => {
    prismJumpState.score = 0;
    prismJumpState.jumpScore = 0;
    prismJumpState.gemBonusScore = 0;
    prismJumpState.furthestRowIndex = 0;
    prismJumpState.runCubes = 0;
    prismJumpState.lastRunCubes = 0;
    prismJumpState.edgeSafe = 1;
    prismJumpState.phase = 'menu';
    prismJumpState.worldSeed = randomSeed();
  },
});
