import * as THREE from 'three';
import { proxy } from 'valtio';
import {
  ARENA_KEYS,
  DIRECTIONS,
  GEM_BASE_POINTS,
  GEM_SCORE_MULTIPLIER_CAP,
  GEM_SCORE_MULTIPLIER_STEP,
  GEM_SCORE_STEP,
  INITIAL_SPEED,
  MODE_SETTINGS,
  POWERUP_DURATION,
  SPEED_INCREMENT,
  SPEED_LIMIT,
  SPHERE_RADIUS,
  TILE_DEPTH,
  THEME_KEYS,
} from './constants';
import type {
  ApexGameState,
  ArenaPresetKey,
  Difficulty,
  GameMode,
  GemData,
  GemType,
  PlayerSkin,
  PowerUpData,
  PowerUpType,
  ThemeKey,
  TileData,
} from './types';

const pickRandomThemeKey = (exclude?: ThemeKey): ThemeKey => {
  if (THEME_KEYS.length === 1) return THEME_KEYS[0];
  let next = THEME_KEYS[
    Math.floor(Math.random() * THEME_KEYS.length)
  ] as ThemeKey;
  while (exclude && next === exclude) {
    next = THEME_KEYS[
      Math.floor(Math.random() * THEME_KEYS.length)
    ] as ThemeKey;
  }
  return next;
};

const PRISM_SKINS: PlayerSkin[] = [
  'prism',
  'prismflare',
  'prismshift',
  'prismhalo',
  'prismglint',
  'prismedge',
  'prismvibe',
  'prismflux',
];
const FRACTAL_SKINS: PlayerSkin[] = [
  'fractal',
  'fractalcrown',
  'fractalsurge',
  'fractalrune',
  'fractalspire',
  'fractalshard',
  'fractalwarp',
  'fractalshade',
];
const NOVA_SKINS: PlayerSkin[] = [
  'nova',
  'novapulse',
  'novabloom',
  'novacore',
  'novaflare',
  'novastorm',
  'novaspike',
  'novaring',
];

const pickSkin = (skins: PlayerSkin[]) =>
  skins[Math.floor(Math.random() * skins.length)];

const getStoredArena = (): ArenaPresetKey | null => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem('apex-arena');
  if (!stored) return null;
  return (ARENA_KEYS as readonly string[]).includes(stored)
    ? (stored as ArenaPresetKey)
    : null;
};

export const apexState = proxy<
  ApexGameState & {
    reset: () => void;
    startGame: () => void;
    endGame: () => void;
    setMode: (mode: GameMode) => void;
    setArena: (arena: ArenaPresetKey) => void;
    setPlayerSkin: (skin: PlayerSkin) => void;
    setDifficulty: (difficulty: Difficulty) => void;
    addScore: (points: number) => number;
    collectGem: (type?: GemType) => number;
    breakCombo: () => void;
    activatePowerUp: (type: Exclude<PowerUpType, 'none'>) => void;
    levelUp: () => void;
    loadHighScores: () => void;
    saveHighScores: () => void;
  }
>({
  phase: 'menu',
  mode: 'classic',
  arena: getStoredArena() ?? 'classic',
  playerSkin: 'classic',
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

    mutation.speed = INITIAL_SPEED;
    mutation.spherePos.set(0, SPHERE_RADIUS, 0);
    mutation.velocity.set(0, 0, 0);
    mutation.directionIndex = 0;
    mutation.currentDirection.copy(DIRECTIONS[0]);
    mutation.targetDirection.copy(DIRECTIONS[0]);
    mutation.isOnPlatform = true;
    mutation.gameOver = false;
    mutation.tiles = [];
    mutation.gems = [];
    mutation.powerUps = [];
    mutation.nextTileId = 0;
    mutation.nextGemId = 0;
    mutation.lastTilePos.set(0, -TILE_DEPTH / 2, 0);
    mutation.divergenceX = 0;
    mutation.divergenceZ = 0;
    const curveSeed = Math.random() < 0.5 ? 1 : -1;
    const spiralSeed = Math.random() < 0.5 ? 1 : -1;
    mutation.curveCenterPos.set(0, -TILE_DEPTH / 2, 0);
    mutation.curveTheta = 0;
    mutation.curveCurvature = 0.5;
    mutation.curveCurvatureVel = 1;
    mutation.curveDirection = curveSeed;
    mutation.curveLane = 1;
    mutation.curveLaneOffset = 0;
    mutation.pathCurveTheta = 0;
    mutation.pathCurveCurvature = 0.5;
    mutation.pathCurveCurvatureVel = 1;
    mutation.pathCurveDirection = curveSeed;
    mutation.pathCurveSegmentRemaining = 0;
    mutation.spiralDirection = spiralSeed;
    mutation.pathSpiralDirection = spiralSeed;
    mutation.pathSpiralSwitchRemaining = 0;
    mutation.gravityPhase = 0;
    mutation.zenPhase = 0;
    mutation.activeTileId = null;
    mutation.activeTileY = null;
    mutation.initialized = false;
  },

  startGame() {
    this.phase = 'playing';
    this.score = 0;
    this.gems = 0;
    this.level = 1;
    this.distance = 0;
    this.combo = 0;
    this.comboMultiplier = 1;
    this.bestCombo = 0;
    this.powerUp = 'none';
    this.powerUpTimer = 0;
    this.currentTheme = pickRandomThemeKey(this.currentTheme);

    const difficultyMult =
      this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.3 : 1;
    const modeSettings = MODE_SETTINGS[this.mode];
    mutation.speed =
      INITIAL_SPEED * difficultyMult * modeSettings.speedMultiplier;
    mutation.gameOver = false;
    mutation.isOnPlatform = true;
    mutation.initialized = false;
  },

  endGame() {
    if (this.mode === 'zen') return;
    this.phase = 'gameover';
    mutation.gameOver = true;
    if (this.score > this.highScores[this.mode]) {
      this.highScores[this.mode] = this.score;
      this.saveHighScores();
    }
  },

  setMode(mode: GameMode) {
    this.mode = mode;
  },

  setArena(arena: ArenaPresetKey) {
    this.arena = arena;
    try {
      localStorage.setItem('apex-arena', arena);
    } catch {
      /* ignore */
    }
  },

  setPlayerSkin(skin: PlayerSkin) {
    this.playerSkin = skin;
  },

  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty;
  },

  addScore(points: number) {
    if (!Number.isFinite(points)) return 0;
    const multiplier =
      this.comboMultiplier * MODE_SETTINGS[this.mode].scoreMultiplier;
    const awarded = Math.floor(points * multiplier);
    if (awarded > 0) this.score += awarded;
    return awarded;
  },

  collectGem(type: GemType = 'normal') {
    this.gems += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (this.combo >= 10) this.comboMultiplier = 3;
    else if (this.combo >= 5) this.comboMultiplier = 2;
    else if (this.combo >= 2) this.comboMultiplier = 1.5;
    const tier = Math.floor(this.score / GEM_SCORE_STEP);
    const tierBoost =
      1 + Math.min(tier, GEM_SCORE_MULTIPLIER_CAP) * GEM_SCORE_MULTIPLIER_STEP;
    const basePoints = GEM_BASE_POINTS[type] ?? 20;
    const awarded = this.addScore(basePoints * tierBoost);

    if (type !== 'normal') {
      if (type === 'prism') this.playerSkin = pickSkin(PRISM_SKINS);
      else if (type === 'fractal') this.playerSkin = pickSkin(FRACTAL_SKINS);
      else if (type === 'nova') this.playerSkin = pickSkin(NOVA_SKINS);
    }

    return awarded;
  },

  breakCombo() {
    this.combo = 0;
    this.comboMultiplier = 1;
  },

  activatePowerUp(type: Exclude<PowerUpType, 'none'>) {
    this.powerUp = type;
    this.powerUpTimer = POWERUP_DURATION;
  },

  levelUp() {
    this.level += 1;
    if (this.level % 2 === 0) {
      this.currentTheme = pickRandomThemeKey(this.currentTheme);
    }
    const difficultyMult =
      this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.3 : 1;
    const modeSettings = MODE_SETTINGS[this.mode];
    mutation.speed = Math.min(
      mutation.speed +
        SPEED_INCREMENT *
          10 *
          difficultyMult *
          modeSettings.speedIncrementMultiplier,
      SPEED_LIMIT * modeSettings.speedLimitMultiplier
    );
  },

  loadHighScores() {
    try {
      const saved = localStorage.getItem('apex-highscores');
      if (saved) Object.assign(this.highScores, JSON.parse(saved));
    } catch {
      /* ignore */
    }
  },

  saveHighScores() {
    try {
      localStorage.setItem('apex-highscores', JSON.stringify(this.highScores));
    } catch {
      /* ignore */
    }
  },
});

export const mutation = {
  speed: INITIAL_SPEED,
  spherePos: new THREE.Vector3(0, SPHERE_RADIUS, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  directionIndex: 0,
  currentDirection: new THREE.Vector3(0, 0, -1),
  targetDirection: new THREE.Vector3(0, 0, -1),
  isOnPlatform: true,
  gameOver: false,
  initialized: false,

  tiles: [] as TileData[],
  gems: [] as GemData[],
  powerUps: [] as PowerUpData[],
  nextTileId: 0,
  nextGemId: 0,

  lastTilePos: new THREE.Vector3(0, -TILE_DEPTH / 2, 0),
  divergenceX: 0,
  divergenceZ: 0,

  curveCenterPos: new THREE.Vector3(0, -TILE_DEPTH / 2, 0),
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

  spiralDirection: 1,
  pathSpiralDirection: 1,
  pathSpiralSwitchRemaining: 0,

  gravityPhase: 0,
  zenPhase: 0,

  activeTileId: null as number | null,
  activeTileY: null as number | null,
};
