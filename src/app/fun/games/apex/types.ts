/**
 * Apex Type Definitions
 */
import * as THREE from 'three';

export type GameMode =
  | 'classic'
  | 'curved'
  | 'spiral'
  | 'gravity'
  | 'speedrush'
  | 'zen';
export type PowerUpType = 'none' | 'shield' | 'magnet' | 'slowmo';
export type TileStatus = 'active' | 'falling' | 'removed';
export type ThemeKey = 'neon' | 'sunset' | 'forest' | 'galaxy' | 'gold';
export type GamePhase = 'menu' | 'playing' | 'gameover';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type SpecialGemType = 'prism' | 'fractal' | 'nova';
export type GemType = 'normal' | SpecialGemType;
export type PlayerSkin =
  | 'classic'
  | 'prism'
  | 'prismflare'
  | 'prismshift'
  | 'prismhalo'
  | 'prismglint'
  | 'prismedge'
  | 'prismvibe'
  | 'prismflux'
  | 'fractal'
  | 'fractalcrown'
  | 'fractalsurge'
  | 'fractalrune'
  | 'fractalspire'
  | 'fractalshard'
  | 'fractalwarp'
  | 'fractalshade'
  | 'nova'
  | 'novapulse'
  | 'novabloom'
  | 'novacore'
  | 'novaflare'
  | 'novastorm'
  | 'novaspike'
  | 'novaring';

export type ArenaPresetKey =
  | 'classic'
  | 'zigzagClassic'
  | 'voxelQuilt'
  | 'prismaticLattice'
  | 'trailPulse'
  | 'trailChevron'
  | 'trailDash'
  | 'rippleField'
  | 'crossWeave'
  | 'radialSpokes'
  | 'diamondTess'
  | 'spineRidges'
  | 'gridForge'
  | 'fracturePlates'
  | 'sunkenSteps'
  | 'spiralBloom'
  | 'coreRing'
  | 'grasslands'
  | 'iceway';

export interface TileData {
  id: number;
  x: number;
  y: number;
  z: number;
  status: TileStatus;
  lastContactTime: number;
  fallVelocity: number;
  rotationY: number;
  scaleX: number;
  scaleZ: number;
}

export interface GemData {
  id: number;
  x: number;
  y: number;
  z: number;
  tileId: number;
  type: GemType;
  collected: boolean;
  rotation: number;
  absorbing: boolean;
  absorbProgress: number;
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

export interface ModeSettings {
  speedMultiplier: number;
  scoreMultiplier: number;
  speedIncrementMultiplier: number;
  speedLimitMultiplier: number;
  gemSpawnChance: number;
  powerUpChance: number;
  fallDelay: number;
}

export interface ApexGameState {
  phase: GamePhase;
  mode: GameMode;
  arena: ArenaPresetKey;
  playerSkin: PlayerSkin;
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
