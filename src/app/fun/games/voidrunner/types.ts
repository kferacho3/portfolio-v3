/**
 * VoidRunner Type Definitions
 */

export type GamePhase = 'menu' | 'playing' | 'gameover';
export type GameMode = 'classic' | 'zen';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Character = 'ship' | 'ufoMini';

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
  hasShield: boolean;
  nearMissCount: number;
  comboMultiplier: number;
}

export interface MutationState {
  gameOver: boolean;
  gameSpeed: number;
  desiredSpeed: number;
  horizontalVelocity: number;
  colorLevel: number;
  playerZ: number;
  playerX: number;
  currentLevelLength: number;
  globalColor: import('three').Color;
}
