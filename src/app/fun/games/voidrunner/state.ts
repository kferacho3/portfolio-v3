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
  GAME_SPEED_MULTIPLIER,
  DIFFICULTY_SETTINGS,
  PLAYER_START_X,
  PLAYER_START_Z,
} from './constants';

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
    mutation.desiredSpeed = INITIAL_GAME_SPEED * DIFFICULTY_SETTINGS[this.difficulty].speedMult;
    mutation.playerZ = PLAYER_START_Z;
    mutation.playerX = PLAYER_START_X;
    mutation.horizontalVelocity = 0;
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
    mutation.desiredSpeed += GAME_SPEED_MULTIPLIER * DIFFICULTY_SETTINGS[this.difficulty].speedMult;
  },

  addNearMiss() {
    this.nearMissCount += 1;
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
