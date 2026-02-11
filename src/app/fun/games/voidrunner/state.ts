/**
 * VoidRunner Game State
 *
 * Valtio proxy state for VoidRunner game.
 */
import * as THREE from 'three';
import { proxy } from 'valtio';
import type {
  VoidRunnerGameState,
  MutationState,
  Difficulty,
  GameMode,
  Character,
} from './types';
import {
  COLORS,
  INITIAL_GAME_SPEED,
  DIFFICULTY_SETTINGS,
  PLAYER_START_X,
  PLAYER_START_Y,
  PLAYER_START_Z,
  LEVEL_SCORE_STEP,
} from './constants';

const LEVEL_BASE_STEP = 0.08;
const LEVEL_CURVE_STEP = 0.012;
const LEVEL_CURVE_POWER = 1.24;

const getSpeedForLevel = (level: number, difficulty: Difficulty) => {
  const lv = Math.max(0, level - 1);
  const baseSpeed =
    INITIAL_GAME_SPEED +
    lv * LEVEL_BASE_STEP +
    Math.pow(lv, LEVEL_CURVE_POWER) * LEVEL_CURVE_STEP;
  return baseSpeed * DIFFICULTY_SETTINGS[difficulty].speedMult;
};

const getSpacingScaleForLevel = (level: number) => {
  return Math.max(0.66, 1 - (Math.max(0, level - 1) * 0.024));
};

// Fast mutation object for per-frame updates (not reactive)
export const mutation: MutationState = {
  gameOver: false,
  gameSpeed: 0,
  desiredSpeed: 0,
  horizontalVelocity: 0,
  verticalVelocity: 0,
  colorLevel: 0,
  playerZ: 0,
  playerX: 0,
  playerY: PLAYER_START_Y,
  isJumping: false,
  currentLevelLength: 0,
  globalColor: new THREE.Color(0xff2190),
  spacingScalar: 1,
  shake: 0,
  shakeDecay: 2.6,
  hitStop: 0,
  speedBoostTimer: 0,
};

export const voidRunnerState = proxy<
  VoidRunnerGameState & {
    reset: () => void;
    startGame: () => void;
    endGame: () => void;
    setCharacter: (c: Character) => void;
    setShipPalette: (palette: VoidRunnerGameState['shipPalette']) => void;
    setDifficulty: (d: Difficulty) => void;
    setMode: (m: GameMode) => void;
    incrementLevel: () => void;
    syncLevelByScore: (score: number) => void;
    queueJump: () => void;
    applySpeedBoost: (seconds?: number) => void;
    addScoreBonus: (points: number) => void;
    addNearMiss: () => void;
    loadHighScore: () => void;
  }
>({
  phase: 'menu',
  score: 0,
  level: 1,
  speed: 0,
  bonusScore: 0,
  highScore: 0,
  controls: { left: false, right: false, jump: false },
  mode: 'classic',
  difficulty: 'normal',
  character: 'shipNova',
  shipPalette: 'cyan',
  hasShield: false,
  nearMissCount: 0,
  comboMultiplier: 1,

  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.level = 1;
    this.speed = 0;
    this.bonusScore = 0;
    this.hasShield = false;
    this.nearMissCount = 0;
    this.comboMultiplier = 1;
    this.controls = { left: false, right: false, jump: false };
    mutation.gameSpeed = 0;
    mutation.desiredSpeed = 0;
    mutation.horizontalVelocity = 0;
    mutation.verticalVelocity = 0;
    mutation.colorLevel = 0;
    mutation.playerZ = PLAYER_START_Z;
    mutation.playerX = PLAYER_START_X;
    mutation.playerY = PLAYER_START_Y;
    mutation.isJumping = false;
    mutation.gameOver = false;
    mutation.globalColor.copy(COLORS[0].three);
    mutation.spacingScalar = 1;
    mutation.shake = 0;
    mutation.hitStop = 0;
    mutation.speedBoostTimer = 0;
  },

  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.level = 1;
    this.bonusScore = 0;
    this.controls = { left: false, right: false, jump: false };
    this.hasShield = false;
    this.nearMissCount = 0;
    this.comboMultiplier = 1;
    mutation.gameOver = false;
    mutation.gameSpeed = 0;
    mutation.desiredSpeed = getSpeedForLevel(this.level, this.difficulty);
    mutation.playerZ = PLAYER_START_Z;
    mutation.playerX = PLAYER_START_X;
    mutation.playerY = PLAYER_START_Y;
    mutation.horizontalVelocity = 0;
    mutation.verticalVelocity = 0;
    mutation.isJumping = false;
    mutation.speedBoostTimer = 0;
    mutation.spacingScalar = getSpacingScaleForLevel(this.level);
    mutation.shake = 0;
    mutation.hitStop = 0;
  },

  setCharacter(c: Character) {
    this.character = c;
  },

  setShipPalette(palette) {
    this.shipPalette = palette;
  },

  endGame() {
    if (this.mode === 'zen') return;
    this.phase = 'gameover';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('voidrunner-highscore', String(this.score));
      } catch (e) {
        /* ignore */
      }
    }
    mutation.gameOver = true;
    mutation.gameSpeed = 0;
    mutation.hitStop = 0.05;
    mutation.shake = 0.8;
    mutation.speedBoostTimer = 0;
  },

  setDifficulty(d: Difficulty) {
    this.difficulty = d;
    mutation.desiredSpeed = getSpeedForLevel(this.level, this.difficulty);
  },

  setMode(m: GameMode) {
    this.mode = m;
  },

  incrementLevel() {
    this.level += 1;
    mutation.colorLevel = (mutation.colorLevel + 1) % COLORS.length;
    mutation.desiredSpeed = getSpeedForLevel(this.level, this.difficulty);
    mutation.spacingScalar = getSpacingScaleForLevel(this.level);
  },

  syncLevelByScore(score: number) {
    const newLevel = Math.max(1, Math.floor(score / LEVEL_SCORE_STEP) + 1);
    if (newLevel === this.level) return;
    this.level = newLevel;
    mutation.colorLevel = (newLevel - 1) % COLORS.length;
    mutation.desiredSpeed = getSpeedForLevel(this.level, this.difficulty);
    mutation.spacingScalar = getSpacingScaleForLevel(this.level);
  },

  queueJump() {
    if (this.phase !== 'playing' || mutation.gameOver) return;
    this.controls.jump = true;
  },

  applySpeedBoost(seconds = 2.8) {
    mutation.speedBoostTimer = Math.max(mutation.speedBoostTimer, seconds);
  },

  addScoreBonus(points: number) {
    this.bonusScore += Math.max(0, Math.floor(points));
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
    } catch (e) {
      /* ignore */
    }
  },
});
