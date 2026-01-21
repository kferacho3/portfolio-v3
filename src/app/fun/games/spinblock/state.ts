import { proxy } from 'valtio';
import { BOARD_PRESETS } from './constants';
import type { SpinBlockBoardSize } from './types';

export const spinBlockState = proxy({
  score: 0,
  highScore: 0,
  boardSize: 'small' as SpinBlockBoardSize,
  maxHearts: BOARD_PRESETS.small.maxHearts,
  hearts: BOARD_PRESETS.small.maxHearts,
  combo: 0,
  coinsCollected: 0,
  gemsCollected: 0,
  level: 1,
  isPlaying: true,
  gameOver: false,
  multiplier: 1,
  multiplierTime: 0,
  shieldTime: 0,
  slowTime: 0,

  setBoardSize(size: SpinBlockBoardSize) {
    this.boardSize = size;
    this.maxHearts = BOARD_PRESETS[size].maxHearts;
    this.reset();
  },

  addScore(points: number) {
    const finalPoints = points * this.multiplier;
    this.score += finalPoints;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  },

  collectCoin() {
    this.coinsCollected++;
    this.combo++;
    this.addScore(10 + this.combo * 2);
  },

  collectGem() {
    this.gemsCollected++;
    this.combo++;
    this.addScore(50 + this.combo * 5);
  },

  hitBumper() {
    this.addScore(5);
  },

  hitHazard() {
    if (this.shieldTime > 0) {
      this.shieldTime = 0;
      return;
    }
    this.hearts--;
    this.combo = 0;
    if (this.hearts <= 0) {
      this.gameOver = true;
      this.isPlaying = false;
    }
  },

  loseLife() {
    this.hitHazard();
  },

  activateMultiplier() {
    this.multiplier = 2;
    this.multiplierTime = 10;
  },

  activateShield() {
    this.shieldTime = 8;
  },

  activateSlowTime() {
    this.slowTime = 6;
  },

  reset() {
    this.score = 0;
    this.hearts = this.maxHearts;
    this.combo = 0;
    this.coinsCollected = 0;
    this.gemsCollected = 0;
    this.level = 1;
    this.isPlaying = true;
    this.gameOver = false;
    this.multiplier = 1;
    this.multiplierTime = 0;
    this.shieldTime = 0;
    this.slowTime = 0;
  },
});
