import { proxy } from 'valtio';
import { TUNING } from './tuning';

export type OscillatePhase = 'menu' | 'playing' | 'cleared' | 'gameover';
export type OscillateMode = 'levels' | 'infinite';

type SaveData = {
  bestLevel: number;
  selectedLevel: number;
  gems: number;
  bestInfiniteDistance: number;
};

const SAVE_KEY = 'oscillate_runner_save_v1';

const toInt = (n: number, min = 0) => Math.max(min, Math.floor(n));

const levelGoal = (level: number) =>
  TUNING.difficulty.levelGoalBase +
  (Math.max(1, level) - 1) * TUNING.difficulty.levelGoalStep;

export const onePathState = proxy({
  phase: 'menu' as OscillatePhase,
  mode: 'levels' as OscillateMode,

  level: 1,
  selectedLevel: 1,
  bestLevel: 1,

  gems: 0,
  lastRunGems: 0,
  lastDistance: 0,
  bestInfiniteDistance: 0,

  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<SaveData>;

      if (typeof data.bestLevel === 'number') {
        onePathState.bestLevel = toInt(data.bestLevel, 1);
      }
      if (typeof data.selectedLevel === 'number') {
        onePathState.selectedLevel = toInt(data.selectedLevel, 1);
      }
      if (typeof data.gems === 'number') {
        onePathState.gems = toInt(data.gems, 0);
      }
      if (typeof data.bestInfiniteDistance === 'number') {
        onePathState.bestInfiniteDistance = toInt(data.bestInfiniteDistance, 0);
      }
    } catch {
      // noop
    }
  },

  save: () => {
    try {
      const payload: SaveData = {
        bestLevel: onePathState.bestLevel,
        selectedLevel: onePathState.selectedLevel,
        gems: onePathState.gems,
        bestInfiniteDistance: onePathState.bestInfiniteDistance,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // noop
    }
  },

  selectMode: (mode: OscillateMode) => {
    onePathState.mode = mode;
  },

  selectLevel: (level: number) => {
    onePathState.selectedLevel = toInt(level, 1);
  },

  start: () => {
    onePathState.mode = 'levels';
    onePathState.level = onePathState.selectedLevel;
    onePathState.phase = 'playing';
    onePathState.lastRunGems = 0;
    onePathState.lastDistance = 0;
  },

  startInfinite: () => {
    onePathState.mode = 'infinite';
    onePathState.level = 1;
    onePathState.phase = 'playing';
    onePathState.lastRunGems = 0;
    onePathState.lastDistance = 0;
  },

  retry: () => {
    onePathState.phase = 'playing';
    onePathState.lastRunGems = 0;
    onePathState.lastDistance = 0;
  },

  goMenu: () => {
    onePathState.phase = 'menu';
    onePathState.save();
  },

  fail: (distanceMeters: number, gemsCollected: number) => {
    onePathState.phase = 'gameover';
    onePathState.lastDistance = toInt(distanceMeters, 0);
    onePathState.lastRunGems = toInt(gemsCollected, 0);
    onePathState.gems += onePathState.lastRunGems;

    if (onePathState.mode === 'infinite') {
      onePathState.bestInfiniteDistance = Math.max(
        onePathState.bestInfiniteDistance,
        onePathState.lastDistance
      );
    }

    onePathState.save();
  },

  clear: (distanceMeters: number, gemsCollected: number) => {
    onePathState.phase = 'cleared';
    onePathState.lastDistance = toInt(distanceMeters, 0);
    onePathState.lastRunGems = toInt(gemsCollected, 0);
    onePathState.gems += onePathState.lastRunGems;
    onePathState.bestLevel = Math.max(
      onePathState.bestLevel,
      onePathState.level
    );
    onePathState.save();
  },

  next: () => {
    onePathState.level += 1;
    onePathState.selectedLevel = onePathState.level;
    onePathState.bestLevel = Math.max(
      onePathState.bestLevel,
      onePathState.level
    );
    onePathState.phase = 'playing';
    onePathState.lastRunGems = 0;
    onePathState.lastDistance = 0;
    onePathState.save();
  },

  addGems: (n: number) => {
    onePathState.gems += toInt(n, 0);
    onePathState.save();
  },

  currentGoalMeters: () => levelGoal(onePathState.level),
});

export const getLevelGoalMeters = (level: number) => levelGoal(level);
