/**
 * Apex Game State
 * 
 * Valtio proxy state for Apex game.
 */
import { proxy } from 'valtio';
import * as THREE from 'three';
import type {
  ApexGameState,
  GameMode,
  PowerUpType,
  ThemeKey,
  Difficulty,
  ArenaPresetKey,
  PlayerSkin,
  TileData,
  GemData,
  PowerUpData,
  GemType,
} from './types';
import { DIRECTIONS, POWERUP_DURATION } from './constants';

const GEM_POINTS: Record<GemType, number> = {
  normal: 10,
  prism: 15,
  fractal: 20,
  nova: 30,
};

export const apexState = proxy<ApexGameState & {
  reset: () => void;
  startGame: (mode?: GameMode) => void;
  gameOver: () => void;
  endGame: () => void;
  levelUp: () => void;
  addScore: (points: number) => number;
  collectGem: (type?: GemType) => number;
  incrementCombo: () => void;
  resetCombo: () => void;
  activatePowerUp: (type: Exclude<PowerUpType, 'none'>) => void;
  updatePowerUpTimer: (delta: number) => void;
  setTheme: (theme: ThemeKey) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setMode: (mode: GameMode) => void;
  setArena: (arena: ArenaPresetKey) => void;
  setPlayerSkin: (skin: PlayerSkin) => void;
  loadHighScores: () => void;
}>({
  phase: 'menu',
  mode: 'classic',
  score: 0,
  gems: 0,
  level: 1,
  distance: 0,
  bestCombo: 0,
  highScores: {
    classic: 0,
    curved: 0,
    spiral: 0,
    gravity: 0,
    speedrush: 0,
    zen: 0,
  },
  combo: 0,
  comboMultiplier: 1,
  powerUp: 'none',
  powerUpTimer: 0,
  currentTheme: 'neon',
  difficulty: 'normal',
  arena: 'classic',
  playerSkin: 'classic',
  
  reset() {
    this.phase = 'menu';
    this.score = 0;
    this.gems = 0;
    this.level = 1;
    this.distance = 0;
    this.combo = 0;
    this.comboMultiplier = 1;
    this.bestCombo = 0;
    this.powerUp = 'none';
    this.powerUpTimer = 0;
  },
  
  startGame(mode?: GameMode) {
    this.phase = 'playing';
    if (mode) {
      this.mode = mode;
    }
    this.score = 0;
    this.gems = 0;
    this.level = 1;
    this.distance = 0;
    this.combo = 0;
    this.comboMultiplier = 1;
    this.powerUp = 'none';
    this.powerUpTimer = 0;
  },
  
  gameOver() {
    this.endGame();
  },
  
  endGame() {
    if (this.phase !== 'playing') return;
    this.phase = 'gameover';
    mutation.gameOver = true;
    mutation.isOnPlatform = false;
    if (this.score > this.highScores[this.mode]) {
      this.highScores[this.mode] = this.score;
    }
    if (this.combo > this.bestCombo) {
      this.bestCombo = this.combo;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('apex-high-scores', JSON.stringify(this.highScores));
      } catch (e) {
        console.warn('Failed to save high scores:', e);
      }
    }
  },

  levelUp() {
    this.level += 1;
  },

  addScore(points: number) {
    const awarded = Math.round(points * this.comboMultiplier);
    this.score += awarded;
    return awarded;
  },
  
  collectGem(type: GemType = 'normal') {
    this.gems += 1;
    const basePoints = GEM_POINTS[type] ?? GEM_POINTS.normal;
    const awarded = this.addScore(basePoints);
    this.incrementCombo();
    return awarded;
  },
  
  incrementCombo() {
    this.combo += 1;
    if (this.combo >= 10) this.comboMultiplier = 3;
    else if (this.combo >= 5) this.comboMultiplier = 2;
    else this.comboMultiplier = 1;
  },
  
  resetCombo() {
    if (this.combo > this.bestCombo) {
      this.bestCombo = this.combo;
    }
    this.combo = 0;
    this.comboMultiplier = 1;
  },
  
  activatePowerUp(type: Exclude<PowerUpType, 'none'>) {
    this.powerUp = type;
    this.powerUpTimer = POWERUP_DURATION;
  },
  
  updatePowerUpTimer(delta: number) {
    if (this.powerUp !== 'none') {
      this.powerUpTimer -= delta;
      if (this.powerUpTimer <= 0) {
        this.powerUp = 'none';
        this.powerUpTimer = 0;
      }
    }
  },
  
  setTheme(theme: ThemeKey) {
    this.currentTheme = theme;
  },
  
  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty;
  },

  setMode(mode: GameMode) {
    this.mode = mode;
  },
  
  setArena(arena: ArenaPresetKey) {
    this.arena = arena;
  },
  
  setPlayerSkin(skin: PlayerSkin) {
    this.playerSkin = skin;
  },
  
  loadHighScores() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('apex-high-scores');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.assign(this.highScores, parsed);
      }
    } catch (e) {
      console.warn('Failed to load high scores:', e);
    }
  },
});

/**
 * Mutation state - runtime game state that changes frequently
 * This is separate from apexState to avoid unnecessary re-renders
 */
export const mutation = proxy({
  // Game entities
  tiles: [] as TileData[],
  gems: [] as GemData[],
  powerUps: [] as PowerUpData[],
  
  // Sphere/player state
  spherePos: new THREE.Vector3(0, 0.26, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  currentDirection: DIRECTIONS[0].clone(),
  targetDirection: DIRECTIONS[0].clone(),
  directionIndex: 0,
  speed: 5.75,
  isOnPlatform: true,
  gameOver: false,
  initialized: false,
  
  // Tile generation
  nextTileId: 0,
  nextGemId: 0,
  lastTilePos: new THREE.Vector3(0, 0, 0),
  divergenceX: 0,
  divergenceZ: 0,
  activeTileId: null as number | null,
  activeTileY: null as number | null,
  fallOffTimer: 0,
  
  // Curve mode state
  curveCenterPos: new THREE.Vector3(0, 0, 0),
  curveTheta: 0,
  curveCurvature: 0,
  curveCurvatureVel: 0,
  curveDirection: 1,
  curveLane: 1,
  curveLaneOffset: 0,
  pathCurveTheta: 0,
  pathCurveCurvature: 0,
  pathCurveCurvatureVel: 0,
  pathCurveDirection: 1,
  pathCurveSegmentRemaining: 0,
  
  // Spiral mode state
  spiralDirection: 1,
  pathSpiralDirection: 1,
  pathSpiralSwitchRemaining: 0,
  
  // Gravity/Zen mode state
  gravityPhase: 0,
  zenPhase: 0,
});
