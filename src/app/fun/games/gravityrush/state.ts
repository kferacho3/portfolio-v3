import { proxy } from 'valtio';
import type { Collectible, Platform, ThemeKey } from './types';

export const gravityRushState = proxy({
  phase: 'menu' as 'menu' | 'playing' | 'gameover',
  score: 0,
  distance: 0,
  highScore: 0,
  coins: 0,
  collectibleScore: 0,
  currentTheme: 'neon' as ThemeKey,
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
    this.collectibleScore = 0;
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
    this.controls = { forward: false, back: false, left: false, right: false, jump: false };
    mutation.playerPos = [0, 2, 0];
    mutation.playerVel = [0, 0, 0];
    mutation.isGrounded = false;
    mutation.currentChunk = 0;
    mutation.chunks.clear();
    mutation.collectibles.clear();
  },

  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.collectibleScore = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.worldSeed = Date.now();
    mutation.playerPos = [0, 2, 0];
    mutation.playerVel = [0, 0, 0];
    mutation.isGrounded = false;
    mutation.currentChunk = 0;
    mutation.chunks.clear();
    mutation.collectibles.clear();
  },

  endGame() {
    this.phase = 'gameover';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('gravityrush-highscore', String(this.score));
      } catch {
        // ignore
      }
    }
  },

  loadHighScore() {
    try {
      const saved = localStorage.getItem('gravityrush-highscore');
      if (saved) this.highScore = parseInt(saved, 10);
    } catch {
      // ignore
    }
  },

  addCombo() {
    const now = Date.now();
    if (now - this.lastLandTime < 2000) {
      this.comboCount++;
      this.comboMultiplier = Math.min(1 + this.comboCount * 0.2, 5);
    } else {
      this.comboCount = 1;
      this.comboMultiplier = 1;
    }
    this.lastLandTime = now;
  },

  collectCoin(value: number) {
    const multiplier = this.hasDoublePoints ? 2 : 1;
    this.collectibleScore += Math.floor(value * this.comboMultiplier * multiplier);
    this.coins++;
  },

  activatePowerup(type: 'shield' | 'speed' | 'doublePoints') {
    if (type === 'shield') {
      this.hasShield = true;
      this.shieldTimer = 10;
    } else if (type === 'speed') {
      this.hasSpeedBoost = true;
      this.speedBoostTimer = 5;
    } else if (type === 'doublePoints') {
      this.hasDoublePoints = true;
      this.doublePointsTimer = 15;
    }
  },
});

export const mutation = {
  playerPos: [0, 2, 0] as [number, number, number],
  playerVel: [0, 0, 0] as [number, number, number],
  isGrounded: false,
  currentChunk: 0,
  chunks: new Map<number, Platform[]>(),
  collectibles: new Map<string, Collectible>(),
};
