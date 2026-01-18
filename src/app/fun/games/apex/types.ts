/**
 * Apex Type Definitions
 */
import * as THREE from 'three';

export type GameMode = 'classic' | 'curved' | 'spiral' | 'gravity' | 'speedrush' | 'zen';
export type PowerUpType = 'none' | 'shield' | 'magnet' | 'slowmo';
export type TileStatus = 'active' | 'falling' | 'removed';
export type ThemeKey = 'neon' | 'sunset' | 'forest' | 'galaxy' | 'gold';
export type GamePhase = 'menu' | 'playing' | 'gameover';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface TileData {
  id: number;
  x: number;
  y: number;
  z: number;
  status: TileStatus;
  lastContactTime: number;
  fallVelocity: number;
}

export interface GemData {
  id: number;
  x: number;
  y: number;
  z: number;
  tileId: number;
  collected: boolean;
  rotation: number;
}

export interface PowerUpData {
  id: number;
  type: Exclude<PowerUpType, 'none'>;
  x: number;
  y: number;
  z: number;
  tileId: number;
  collected: boolean;
}

export interface ThemeColors {
  name: string;
  tile: THREE.Color;
  tileHex: string;
  gem: THREE.Color;
  gemHex: string;
  glow: THREE.Color;
  bg: string;
  accent: string;
}

export interface ApexGameState {
  phase: GamePhase;
  mode: GameMode;
  score: number;
  gems: number;
  level: number;
  distance: number;
  bestCombo: number;
  highScores: Record<GameMode, number>;
  combo: number;
  comboMultiplier: number;
  powerUp: PowerUpType;
  powerUpTimer: number;
  currentTheme: ThemeKey;
  difficulty: Difficulty;
}
