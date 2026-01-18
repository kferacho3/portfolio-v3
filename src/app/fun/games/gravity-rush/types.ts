/**
 * GravityRush Type Definitions
 */

export type ThemeKey = 'neon' | 'ice' | 'lava' | 'void' | 'cyber' | 'forest';
export type GamePhase = 'menu' | 'playing' | 'gameover';
export type PlatformType = 'static' | 'crumble' | 'moving' | 'boost' | 'start';
export type PowerupType = 'shield' | 'speed' | 'doublePoints';
export type CollectibleType = 'coin' | 'gem' | 'powerup';

export interface ThemeColors {
  name: string;
  background: string;
  platform: string;
  accent: string;
  ball: string;
  crumble: string;
  boost: string;
  fog: string;
}

export interface Platform {
  id: string;
  type: PlatformType;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  rotation?: number;
  moveAxis?: 'x' | 'z';
  moveRange?: number;
  movePhase?: number;
  crumbleTimer?: number;
  touched?: boolean;
}

export interface Collectible {
  id: string;
  type: CollectibleType;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  powerupType?: PowerupType;
}

export interface Controls {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface GravityRushGameState {
  phase: GamePhase;
  score: number;
  distance: number;
  highScore: number;
  coins: number;
  currentTheme: ThemeKey;
  themeTransition: number;
  hasShield: boolean;
  shieldTimer: number;
  hasSpeedBoost: boolean;
  speedBoostTimer: number;
  hasDoublePoints: boolean;
  doublePointsTimer: number;
  comboCount: number;
  comboMultiplier: number;
  lastLandTime: number;
  worldSeed: number;
  controls: Controls;
}
