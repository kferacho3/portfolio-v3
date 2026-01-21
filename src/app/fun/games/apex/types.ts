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

export type ArenaShaderKind =
  | 'none'
  | 'alloy'
  | 'prismatic'
  | 'quilt'
  | 'zigzag'
  | 'biome'
  | 'kintsugi'
  | 'circuit'
  | 'truchet'
  | 'quasicrystal'
  | 'honeycomb'
  | 'starwork'
  | 'topographic'
  | 'lava'
  | 'origami'
  | 'obsidian'
  | 'stainedglass'
  | 'aurora';

export type ArenaVoxelPattern =
  | 'quilt'
  | 'lattice'
  | 'alloy'
  | 'tuft'
  | 'hexCells'
  | 'crackInlay'
  | 'componentGrid'
  | 'contourSteps'
  | 'foldRidges'
  | 'basaltChunks'
  | 'mandalaRelief';

export type ArenaPresetKey =
  | 'classic'
  | 'zigzagClassic'
  | 'zigzagPulse'
  | 'zigzagNoir'
  | 'voxelQuilt'
  | 'prismaticLattice'
  | 'verdantQuilt'
  | 'kintsugiPorcelain'
  | 'circuitCathedral'
  | 'truchetLabyrinth'
  | 'quasicrystalEcho'
  | 'honeycombPrism'
  | 'arcticHexglass'
  | 'zelligeStarwork'
  | 'kaleidoMandala'
  | 'topographicAtlas'
  | 'lavaRift'
  | 'obsidianMirror'
  | 'stainedGlassRose'
  | 'origamiFoldfield'
  | 'auroraWeave';

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
  | 'prismstellate'
  | 'prismcage'
  | 'prismorbitx'
  | 'prismlens'
  | 'prismhelixtube'
  | 'fractal'
  | 'fractalcrown'
  | 'fractalsurge'
  | 'fractalrune'
  | 'fractalspire'
  | 'fractalshard'
  | 'fractalwarp'
  | 'fractalshade'
  | 'fractalsupershape'
  | 'fractalasteroid'
  | 'fractalsierpinski'
  | 'fractalmenger'
  | 'fractallissajous'
  | 'nova'
  | 'novapulse'
  | 'novabloom'
  | 'novacore'
  | 'novaflare'
  | 'novastorm'
  | 'novaspike'
  | 'novaring'
  | 'novacorona'
  | 'novapulsar'
  | 'novaeclipse'
  | 'novacomet'
  | 'novaflareburst';

export type GemType = 'normal' | 'prism' | 'fractal' | 'nova';

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
  collected: boolean;
  rotation: number;
  type: GemType;
  absorbing?: boolean;
  absorbProgress?: number;
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
  arena: ArenaPresetKey;
  playerSkin: PlayerSkin;
}
