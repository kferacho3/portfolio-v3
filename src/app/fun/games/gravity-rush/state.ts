/**
 * GravityRush Game State
 * 
 * Valtio proxy state for GravityRush game.
 */
import { proxy } from 'valtio';
import type { GravityRushGameState, ThemeKey, PowerupType } from './types';

export const gravityRushState = proxy<GravityRushGameState & {
  reset: () => void;
  startGame: () => void;
  gameOver: () => void;
  addScore: (points: number) => void;
  collectCoin: () => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  activatePowerup: (type: PowerupType) => void;
  updatePowerupTimers: (delta: number) => void;
  setTheme: (theme: ThemeKey) => void;
  setControls: (key: keyof GravityRushGameState['controls'], value: boolean) => void;
}>({
  phase: 'menu',
  score: 0,
  distance: 0,
  highScore: 0,
  coins: 0,
  currentTheme: 'neon',
  themeTransition: 0,
  hasShield: false,
  shieldTimer: 0,
  hasSpeedBoost: false,
  speedBoostTimer: 0,
  hasDoublePoints: false,
  doublePointsTimer: 0,
  comboCount: 0,
  comboMultiplier: 1,
  lastLandTime: 0,
  worldSeed: Date.now(),
  controls: { forward: false, back: false, left: false, right: false, jump: false },
  
  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.currentTheme = 'neon';
    this.themeTransition = 0;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.hasSpeedBoost = false;
    this.speedBoostTimer = 0;
    this.hasDoublePoints = false;
    this.doublePointsTimer = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.lastLandTime = 0;
    this.worldSeed = Date.now();
  },
  
  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.hasShield = false;
    this.hasSpeedBoost = false;
    this.hasDoublePoints = false;
    this.worldSeed = Date.now();
  },
  
  gameOver() {
    if (this.phase !== 'playing') return;
    this.phase = 'gameover';
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  },
  
  addScore(points: number) {
    const multiplier = this.hasDoublePoints ? this.comboMultiplier * 2 : this.comboMultiplier;
    this.score += Math.floor(points * multiplier);
  },
  
  collectCoin() {
    this.coins += 1;
    this.addScore(10);
    this.incrementCombo();
  },
  
  incrementCombo() {
    this.comboCount += 1;
    if (this.comboCount >= 10) this.comboMultiplier = 4;
    else if (this.comboCount >= 5) this.comboMultiplier = 2;
    else this.comboMultiplier = 1;
  },
  
  resetCombo() {
    this.comboCount = 0;
    this.comboMultiplier = 1;
  },
  
  activatePowerup(type: PowerupType) {
    switch (type) {
      case 'shield':
        this.hasShield = true;
        this.shieldTimer = 10;
        break;
      case 'speed':
        this.hasSpeedBoost = true;
        this.speedBoostTimer = 8;
        break;
      case 'doublePoints':
        this.hasDoublePoints = true;
        this.doublePointsTimer = 15;
        break;
    }
  },
  
  updatePowerupTimers(delta: number) {
    if (this.hasShield) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) {
        this.hasShield = false;
        this.shieldTimer = 0;
      }
    }
    if (this.hasSpeedBoost) {
      this.speedBoostTimer -= delta;
      if (this.speedBoostTimer <= 0) {
        this.hasSpeedBoost = false;
        this.speedBoostTimer = 0;
      }
    }
    if (this.hasDoublePoints) {
      this.doublePointsTimer -= delta;
      if (this.doublePointsTimer <= 0) {
        this.hasDoublePoints = false;
        this.doublePointsTimer = 0;
      }
    }
  },
  
  setTheme(theme: ThemeKey) {
    this.currentTheme = theme;
  },
  
  setControls(key: keyof GravityRushGameState['controls'], value: boolean) {
    this.controls[key] = value;
  },
});
