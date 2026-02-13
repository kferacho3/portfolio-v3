import { proxy } from 'valtio';

import { CHARACTER_MODELS, DEFAULT_CHARACTER, STORAGE_KEYS } from './constants';
import type { CollectibleRarity, KnotHopPhase } from './types';

export type SpiralDirection = 'CW' | 'CCW';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const parseIntSafe = (raw: string | null, fallback = 0) => {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const parseJSONSafe = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const uniq = (arr: string[]) => Array.from(new Set(arr));

const validCharacterIds = new Set(CHARACTER_MODELS.map((character) => character.id));

const normalizeUnlocked = (ids: string[]) => {
  const cleaned = uniq(ids).filter((id) => validCharacterIds.has(id));
  if (!cleaned.includes(DEFAULT_CHARACTER)) cleaned.unshift(DEFAULT_CHARACTER);
  return cleaned;
};

export const knotHopState = proxy({
  phase: 'menu' as KnotHopPhase,
  score: 0,
  best: 0,
  crashReason: '',

  streak: 0,
  dodged: 0,
  collected: 0,
  speed: 0,
  direction: 'CW' as SpiralDirection,

  gold: 0,
  green: 0,
  purple: 0,
  runGold: 0,
  runGreen: 0,
  runPurple: 0,

  unlockedCharacters: [DEFAULT_CHARACTER] as string[],
  selectedCharacter: DEFAULT_CHARACTER,

  gameOver: false,
  resetVersion: 0,

  toastText: '',
  toastTime: 0,

  load() {
    if (typeof window === 'undefined') return;

    this.best = parseIntSafe(localStorage.getItem(STORAGE_KEYS.best));

    const legacyGems = parseIntSafe(localStorage.getItem(STORAGE_KEYS.gemsLegacy));
    const goldRaw = localStorage.getItem(STORAGE_KEYS.walletGold);
    this.gold =
      goldRaw === null
        ? legacyGems
        : parseIntSafe(goldRaw, legacyGems);
    this.green = parseIntSafe(localStorage.getItem(STORAGE_KEYS.walletGreen));
    this.purple = parseIntSafe(localStorage.getItem(STORAGE_KEYS.walletPurple));

    const legacyUnlocked = parseJSONSafe<string[]>(
      localStorage.getItem(STORAGE_KEYS.unlockedBallsLegacy),
      [DEFAULT_CHARACTER]
    );
    const unlocked = parseJSONSafe<string[]>(
      localStorage.getItem(STORAGE_KEYS.unlockedCharacters),
      legacyUnlocked
    );
    this.unlockedCharacters = normalizeUnlocked(unlocked);

    const legacySelected = localStorage.getItem(STORAGE_KEYS.selectedBallLegacy) ?? DEFAULT_CHARACTER;
    const selected =
      localStorage.getItem(STORAGE_KEYS.selectedCharacter) ?? legacySelected;
    this.selectedCharacter = this.unlockedCharacters.includes(selected)
      ? selected
      : this.unlockedCharacters[0];
  },

  saveProfile() {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEYS.best, String(this.best));
    localStorage.setItem(STORAGE_KEYS.walletGold, String(this.gold));
    localStorage.setItem(STORAGE_KEYS.walletGreen, String(this.green));
    localStorage.setItem(STORAGE_KEYS.walletPurple, String(this.purple));
    localStorage.setItem(STORAGE_KEYS.gemsLegacy, String(this.gold));
    localStorage.setItem(STORAGE_KEYS.unlockedCharacters, JSON.stringify(this.unlockedCharacters));
    localStorage.setItem(STORAGE_KEYS.selectedCharacter, this.selectedCharacter);
  },

  reset() {
    this.resetVersion += 1;
    this.phase = 'menu';
    this.score = 0;
    this.crashReason = '';
    this.streak = 0;
    this.dodged = 0;
    this.collected = 0;
    this.speed = 0;
    this.direction = 'CW';
    this.runGold = 0;
    this.runGreen = 0;
    this.runPurple = 0;
    this.gameOver = false;
    this.toastText = '';
    this.toastTime = 0;
  },

  start() {
    this.phase = 'playing';
    this.score = 0;
    this.crashReason = '';
    this.streak = 0;
    this.dodged = 0;
    this.collected = 0;
    this.speed = 0;
    this.direction = 'CW';
    this.runGold = 0;
    this.runGreen = 0;
    this.runPurple = 0;
    this.gameOver = false;
    this.toastText = '';
    this.toastTime = 0;
  },

  tick(dt: number) {
    if (this.phase !== 'playing') return;
    this.toastTime = Math.max(0, this.toastTime - dt);
  },

  setToast(text: string, duration = 0.55) {
    this.toastText = text;
    this.toastTime = Math.max(this.toastTime, duration);
  },

  addCollectible(rarity: CollectibleRarity) {
    if (rarity === 'gold') {
      this.gold += 1;
      this.runGold += 1;
      return;
    }
    if (rarity === 'green') {
      this.green += 1;
      this.runGreen += 1;
      return;
    }
    this.purple += 1;
    this.runPurple += 1;
  },

  cycleCharacter(directionStep: number) {
    const total = CHARACTER_MODELS.length;
    if (total <= 0) return;
    const currentIdx = Math.max(
      0,
      CHARACTER_MODELS.findIndex((character) => character.id === this.selectedCharacter)
    );
    const nextIdx = (currentIdx + directionStep + total * 8) % total;
    this.selectedCharacter = CHARACTER_MODELS[nextIdx].id;
    if (this.unlockedCharacters.includes(this.selectedCharacter)) {
      this.saveProfile();
    }
  },

  selectCharacter(id: string) {
    if (!validCharacterIds.has(id)) return;
    if (!this.unlockedCharacters.includes(id)) {
      this.setToast('Character locked', 0.45);
      return;
    }
    this.selectedCharacter = id;
    this.saveProfile();
  },

  unlockSelectedCharacter() {
    const character =
      CHARACTER_MODELS.find((candidate) => candidate.id === this.selectedCharacter) ??
      CHARACTER_MODELS[0];
    if (!character) return;

    if (this.unlockedCharacters.includes(character.id)) {
      this.setToast(`${character.name} ready`, 0.35);
      return;
    }

    const { gold, green, purple } = character.cost;
    const affordable =
      this.gold >= gold &&
      this.green >= green &&
      this.purple >= purple;
    if (!affordable) {
      this.setToast(
        `Need ${gold}G ${green}E ${purple}V`,
        0.8
      );
      return;
    }

    this.gold -= gold;
    this.green -= green;
    this.purple -= purple;
    this.unlockedCharacters = normalizeUnlocked([...this.unlockedCharacters, character.id]);
    this.selectedCharacter = character.id;
    this.saveProfile();
    this.setToast(`Unlocked ${character.name}`, 0.9);
  },

  updateHud(hud: {
    score: number;
    streak: number;
    dodged: number;
    collected: number;
    speed: number;
    direction: SpiralDirection;
  }) {
    if (this.phase !== 'playing') return;
    this.score = Math.max(0, Math.floor(hud.score));
    this.streak = Math.max(0, Math.floor(hud.streak));
    this.dodged = Math.max(0, Math.floor(hud.dodged));
    this.collected = Math.max(0, Math.floor(hud.collected));
    this.speed = clamp(hud.speed, 0, 999);
    this.direction = hud.direction;
  },

  end(finalScore: number, reason = '') {
    const score = Math.max(0, Math.floor(finalScore));
    this.phase = 'gameover';
    this.score = score;
    this.crashReason = reason;
    this.gameOver = true;

    const nextBest = Math.max(this.best, score);
    if (nextBest !== this.best) {
      this.best = nextBest;
      this.saveProfile();
      return;
    }

    this.saveProfile();
  },
});
