/**
 * Apex Game State
 * 
 * Valtio proxy state for Apex game.
 */
import { proxy } from 'valtio';
import type { ApexGameState, GameMode, PowerUpType, ThemeKey, Difficulty } from './types';

export const apexState = proxy<ApexGameState & {
  reset: () => void;
  startGame: (mode: GameMode) => void;
  gameOver: () => void;
  addScore: (points: number) => void;
  collectGem: () => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  activatePowerUp: (type: Exclude<PowerUpType, 'none'>) => void;
  updatePowerUpTimer: (delta: number) => void;
  setTheme: (theme: ThemeKey) => void;
  setDifficulty: (difficulty: Difficulty) => void;
}>({
  phase: 'menu',
  mode: 'classic',
  score: 0,
  gems: 0,
  level: 1,
  distance: 0,
  bestCombo: 0,
  highScores: {
    classic: 0,
    curved: 0,
    spiral: 0,
    gravity: 0,
    speedrush: 0,
    zen: 0,
  },
  combo: 0,
  comboMultiplier: 1,
  powerUp: 'none',
  powerUpTimer: 0,
  currentTheme: 'neon',
  difficulty: 'normal',
  
  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.gems = 0;
    this.level = 1;
    this.distance = 0;
    this.combo = 0;
    this.comboMultiplier = 1;
    this.bestCombo = 0;
    this.powerUp = 'none';
    this.powerUpTimer = 0;
  },
  
  startGame(mode: GameMode) {
    this.phase = 'playing';
    this.mode = mode;
    this.score = 0;
    this.gems = 0;
    this.level = 1;
    this.distance = 0;
    this.combo = 0;
    this.comboMultiplier = 1;
    this.powerUp = 'none';
    this.powerUpTimer = 0;
  },
  
  gameOver() {
    if (this.phase !== 'playing') return;
    this.phase = 'gameover';
    if (this.score > this.highScores[this.mode]) {
      this.highScores[this.mode] = this.score;
    }
    if (this.combo > this.bestCombo) {
      this.bestCombo = this.combo;
    }
  },
  
  addScore(points: number) {
    this.score += points * this.comboMultiplier;
  },
  
  collectGem() {
    this.gems += 1;
    this.addScore(10);
    this.incrementCombo();
  },
  
  incrementCombo() {
    this.combo += 1;
    if (this.combo >= 10) this.comboMultiplier = 3;
    else if (this.combo >= 5) this.comboMultiplier = 2;
    else this.comboMultiplier = 1;
  },
  
  resetCombo() {
    if (this.combo > this.bestCombo) {
      this.bestCombo = this.combo;
    }
    this.combo = 0;
    this.comboMultiplier = 1;
  },
  
  activatePowerUp(type: Exclude<PowerUpType, 'none'>) {
    this.powerUp = type;
    this.powerUpTimer = 5; // 5 seconds
  },
  
  updatePowerUpTimer(delta: number) {
    if (this.powerUp !== 'none') {
      this.powerUpTimer -= delta;
      if (this.powerUpTimer <= 0) {
        this.powerUp = 'none';
        this.powerUpTimer = 0;
      }
    }
  },
  
  setTheme(theme: ThemeKey) {
    this.currentTheme = theme;
  },
  
  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty;
  },
});
