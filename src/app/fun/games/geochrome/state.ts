import { proxy } from 'valtio';
import { SHAPES } from './constants';
import type { ShapeType } from './types';

export const geoState = proxy({
  score: 0,
  bestScore: 0,
  health: 100,
  level: 1,
  cargo: {} as Record<ShapeType, number>,
  deposited: 0,
  targetDeposits: 15,
  gameOver: false,
  paused: false,
  currentShape: 'sphere' as ShapeType,

  reset() {
    this.score = 0;
    this.health = 100;
    this.level = 1;
    this.cargo = SHAPES.reduce((acc, shape) => ({ ...acc, [shape]: 0 }), {} as Record<ShapeType, number>);
    this.deposited = 0;
    this.targetDeposits = 15;
    this.gameOver = false;
    this.currentShape = 'sphere';
  },

  addCargo(shape: ShapeType) {
    this.cargo[shape] = (this.cargo[shape] || 0) + 1;
  },

  depositCargo(shape: ShapeType): boolean {
    if (this.cargo[shape] > 0) {
      this.cargo[shape]--;
      this.deposited++;
      this.score += 100 + this.level * 25;
      if (this.score > this.bestScore) this.bestScore = this.score;
      return true;
    }
    return false;
  },

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.gameOver = true;
  },

  heal(amount: number) {
    this.health = Math.min(100, this.health + amount);
  },

  nextLevel() {
    this.level++;
    this.deposited = 0;
    this.targetDeposits = 15 + this.level * 5;
    this.heal(25);
  },

  cycleShape() {
    const idx = SHAPES.indexOf(this.currentShape);
    this.currentShape = SHAPES[(idx + 1) % SHAPES.length];
  },
});
