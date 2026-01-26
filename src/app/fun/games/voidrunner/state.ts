/**
 * VoidRunner Game State
 * 
 * Valtio proxy state for VoidRunner game.
 */
import * as THREE from 'three';
import { proxy } from 'valtio';
import type { VoidRunnerGameState, MutationState, Difficulty, GameMode, Character } from './types';
import {
  COLORS,
  INITIAL_GAME_SPEED,
  DIFFICULTY_SETTINGS,
  PLAYER_START_X,
  PLAYER_START_Z,
} from './constants';

const BREATHER_INTERVAL = 6;
const BREATHER_SPEED_SCALE = 0.92;
const BREATHER_SPACING_SCALE = 1.18;
const GENTLE_LEVELS = 7;
const GENTLE_STEP = 0.045;
const LATE_STEP = 0.028;
const LATE_EXPONENT = 1.35;

const getBreatherSpeedScale = (level: number) =>
  level % BREATHER_INTERVAL === 0 ? BREATHER_SPEED_SCALE : 1;

const getBreatherSpacingScale = (level: number) =>
  level % BREATHER_INTERVAL === 0 ? BREATHER_SPACING_SCALE : 1;

const getSpeedForLevel = (level: number, difficulty: Difficulty) => {
  const gentle = Math.min(level, GENTLE_LEVELS) * GENTLE_STEP;
  const lateLevels = Math.max(0, level - GENTLE_LEVELS);
  const late = Math.pow(lateLevels, LATE_EXPONENT) * LATE_STEP;
  const baseSpeed = INITIAL_GAME_SPEED + gentle + late;
  return baseSpeed * DIFFICULTY_SETTINGS[difficulty].speedMult * getBreatherSpeedScale(level);
};

// Fast mutation object for per-frame updates (not reactive)
export const mutation: MutationState = {
  gameOver: false,
  gameSpeed: 0,
  desiredSpeed: 0,
  horizontalVelocity: 0,
  colorLevel: 0,
  playerZ: 0,
  playerX: 0,
  currentLevelLength: 0,
  globalColor: new THREE.Color(0xff2190),
  spacingScalar: 1,
  shake: 0,
  shakeDecay: 2.6,
  hitStop: 0,
};

export const voidRunnerState = proxy<VoidRunnerGameState & {
  reset: () => void;
  startGame: () => void;
  endGame: () => void;
  setCharacter: (c: Character) => void;
  setDifficulty: (d: Difficulty) => void;
  setMode: (m: GameMode) => void;
  incrementLevel: () => void;
  addNearMiss: () => void;
  loadHighScore: () => void;
}>({
  phase: 'menu',
  score: 0,
  level: 1,
  speed: 0,
  highScore: 0,
  controls: { left: false, right: false },
  mode: 'classic',
  difficulty: 'normal',
  character: 'ship',
  hasShield: false,
  nearMissCount: 0,
  comboMultiplier: 1,

  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.level = 1;
    this.speed = 0;
    this.hasShield = false;
    this.nearMissCount = 0;
    this.comboMultiplier = 1;
    this.controls = { left: false, right: false };
    mutation.gameSpeed = 0;
    mutation.desiredSpeed = 0;
    mutation.horizontalVelocity = 0;
    mutation.colorLevel = 0;
    mutation.playerZ = PLAYER_START_Z;
    mutation.playerX = PLAYER_START_X;
    mutation.gameOver = false;
    mutation.globalColor.copy(COLORS[0].three);
    mutation.spacingScalar = 1;
    mutation.shake = 0;
    mutation.hitStop = 0;
  },

  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.level = 1;
    this.hasShield = false;
    this.nearMissCount = 0;
    this.comboMultiplier = 1;
    mutation.gameOver = false;
    mutation.gameSpeed = 0;
    mutation.desiredSpeed = getSpeedForLevel(this.level, this.difficulty);
    mutation.playerZ = PLAYER_START_Z;
    mutation.playerX = PLAYER_START_X;
    mutation.horizontalVelocity = 0;
    mutation.spacingScalar = getBreatherSpacingScale(this.level);
    mutation.shake = 0;
    mutation.hitStop = 0;
  },

  setCharacter(c: Character) {
    this.character = c;
  },

  endGame() {
    if (this.mode === 'zen') return;
    this.phase = 'gameover';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('voidrunner-highscore', String(this.score));
      } catch (e) { /* ignore */ }
    }
    mutation.gameOver = true;
    mutation.gameSpeed = 0;
    mutation.hitStop = 0.05;
    mutation.shake = 0.8;
  },

  setDifficulty(d: Difficulty) {
    this.difficulty = d;
  },

  setMode(m: GameMode) {
    this.mode = m;
  },

  incrementLevel() {
    this.level += 1;
    mutation.colorLevel = (mutation.colorLevel + 1) % COLORS.length;
    mutation.desiredSpeed = getSpeedForLevel(this.level, this.difficulty);
    mutation.spacingScalar = getBreatherSpacingScale(this.level);
  },

  addNearMiss() {
    this.nearMissCount += 1;
    mutation.shake = Math.min(0.45, mutation.shake + 0.12);
    if (this.nearMissCount >= 3) {
      this.comboMultiplier = Math.min(this.comboMultiplier + 0.5, 5);
      this.nearMissCount = 0;
    }
  },

  loadHighScore() {
    try {
      const saved = localStorage.getItem('voidrunner-highscore');
      if (saved) this.highScore = parseInt(saved, 10);
    } catch (e) { /* ignore */ }
  },
});
