/**
 * VoidRunner Type Definitions
 */

export type GamePhase = 'menu' | 'playing' | 'gameover';
export type GameMode = 'classic' | 'zen';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Character = 'shipNova' | 'shipDart' | 'shipWasp' | 'ufoMini';
export type ShipPalette = 'cyan' | 'ember' | 'lime' | 'violet' | 'sunset';

export interface ColorDef {
  name: string;
  hex: string;
  three: import('three').Color;
}

export interface DifficultySettings {
  speedMult: number;
  obstacleSpacing: number;
}

export interface Controls {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface VoidRunnerGameState {
  phase: GamePhase;
  score: number;
  level: number;
  speed: number;
  highScore: number;
  controls: Controls;
  mode: GameMode;
  difficulty: Difficulty;
  character: Character;
  shipPalette: ShipPalette;
  hasShield: boolean;
  nearMissCount: number;
  comboMultiplier: number;
}

export interface MutationState {
  gameOver: boolean;
  gameSpeed: number;
  desiredSpeed: number;
  horizontalVelocity: number;
  verticalVelocity: number;
  colorLevel: number;
  playerZ: number;
  playerX: number;
  playerY: number;
  isJumping: boolean;
  currentLevelLength: number;
  globalColor: import('three').Color;
  spacingScalar: number;
  shake: number;
  shakeDecay: number;
  hitStop: number;
  speedBoostTimer: number;
}
