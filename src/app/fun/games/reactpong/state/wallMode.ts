import { WALL_MODE_COMBO_MULTIPLIERS, WALL_MODE_LEVELS } from '../constants';
import type { PowerupType, WallModeState, WallZone } from '../types';
import type { ReactPongState } from '../state';

export const createWallModeState = (): WallModeState => ({
  lives: 5,
  currentLevel: 1,
  gameState: 'ready',
  currentSpeed: WALL_MODE_LEVELS[0].baseSpeed,
  maxSpeed: 35,
  rallyStreak: 0,
  levelStreak: 0,
  isBallCaptured: false,
  captureStartTime: 0,
  captureHoldTime: 0.3,
  chargeAmount: 0,
  spinIntensity: 0,
  lastPaddleVelocity: { x: 0, y: 0 },
  currentLevelConfig: WALL_MODE_LEVELS[0],
  wallZones: [],
  activePowerups: [],
  availablePowerup: null,
  stabilizeMode: false,
  lastCatchWasPerfect: false,
});

export const resetWallMode = (state: ReactPongState) => {
  state.wallMode.lives = 5;
  state.wallMode.currentLevel = 1;
  state.wallMode.gameState = 'ready';
  state.wallMode.currentSpeed = WALL_MODE_LEVELS[0].baseSpeed;
  state.wallMode.rallyStreak = 0;
  state.wallMode.levelStreak = 0;
  state.wallMode.isBallCaptured = false;
  state.wallMode.captureStartTime = 0;
  state.wallMode.chargeAmount = 0;
  state.wallMode.spinIntensity = 0;
  state.wallMode.currentLevelConfig = WALL_MODE_LEVELS[0];
  state.wallMode.activePowerups = [];
  state.wallMode.availablePowerup = null;
  state.wallMode.lastCatchWasPerfect = false;
  state.score = 0;
  state.hitStreak = 0;
  state.comboText = '';
  generateWallZones(state);
};

export const generateWallZones = (state: ReactPongState) => {
  const config = state.wallMode.currentLevelConfig;
  const zones: WallZone[] = [];

  if (config.wallType === 'plain') {
    state.wallMode.wallZones = [];
    return;
  }

  const wallWidth = 16;
  const wallHeight = 8;

  if (config.wallType === 'zones' || config.wallType === 'advanced' || config.wallType === 'chaos') {
    zones.push({
      id: 'speed-1',
      type: 'speed',
      position: [-wallWidth / 4, 0, 0],
      size: [3, 2],
      effect: 1.3,
    });

    zones.push({
      id: 'spin-1',
      type: 'spin',
      position: [wallWidth / 4, 1, 0],
      size: [2.5, 2.5],
      effect: 0.8,
    });

    zones.push({
      id: 'bounce-1',
      type: 'bounce',
      position: [0, -2, 0],
      size: [3, 1.5],
      effect: 1.5,
    });
  }

  if (config.hasTargetZones) {
    zones.push({
      id: 'target-1',
      type: 'target',
      position: [Math.random() * wallWidth / 2 - wallWidth / 4, Math.random() * wallHeight / 2 - wallHeight / 4, 0],
      size: [1.5, 1.5],
      effect: 100,
    });
  }

  if (config.hasHazardZones) {
    zones.push({
      id: 'hazard-1',
      type: 'hazard',
      position: [Math.random() > 0.5 ? wallWidth / 3 : -wallWidth / 3, Math.random() * 2 - 1, 0],
      size: [2, 2],
      effect: 2,
    });
  }

  state.wallMode.wallZones = zones;
};

export const advanceWallModeLevel = (state: ReactPongState) => {
  const nextLevel = state.wallMode.currentLevel + 1;
  if (nextLevel > 10) {
    state.wallMode.gameState = 'victory';
    return;
  }

  state.wallMode.currentLevel = nextLevel;
  state.wallMode.currentLevelConfig = WALL_MODE_LEVELS[nextLevel - 1];
  state.wallMode.currentSpeed = state.wallMode.currentLevelConfig.baseSpeed;
  state.wallMode.levelStreak = 0;
  state.wallMode.rallyStreak = 0;
  state.wallMode.gameState = 'ready';
  state.wallMode.activePowerups = [];
  state.wallMode.availablePowerup = null;
  generateWallZones(state);
};

export const wallModeCaptureBall = (state: ReactPongState) => {
  if (!state.wallMode.isBallCaptured) {
    state.wallMode.isBallCaptured = true;
    state.wallMode.captureStartTime = Date.now();
    state.wallMode.chargeAmount = 0;
    state.wallMode.gameState = 'captured';
  }
};

export const wallModeReleaseBall = (state: ReactPongState): { speed: number; spin: number; charge: number } => {
  const charge = state.wallMode.chargeAmount;
  const spin = state.wallMode.spinIntensity;
  const baseSpeed = state.wallMode.currentSpeed;
  const chargeBonus = 1 + charge * 0.5;

  state.wallMode.isBallCaptured = false;
  state.wallMode.gameState = 'playing';
  state.wallMode.chargeAmount = 0;

  return {
    speed: baseSpeed * chargeBonus,
    spin,
    charge,
  };
};

export const wallModeHitWall = (state: ReactPongState, zoneType?: string, isPerfectCatch: boolean = false) => {
  state.wallMode.rallyStreak++;
  state.wallMode.levelStreak++;

  const multiplier = state.wallMode.currentLevelConfig.speedMultiplier;
  state.wallMode.currentSpeed = Math.min(
    state.wallMode.maxSpeed,
    state.wallMode.currentSpeed * multiplier
  );

  let baseScore = 10;
  if (zoneType === 'target') baseScore = 100;
  if (zoneType === 'hazard') baseScore = 25;
  if (zoneType === 'speed') baseScore = 15;
  if (zoneType === 'spin') baseScore = 15;
  if (isPerfectCatch) {
    baseScore *= 1.5;
    state.wallMode.lastCatchWasPerfect = true;
  } else {
    state.wallMode.lastCatchWasPerfect = false;
  }

  const comboData = getWallModeMultiplier(state);
  const totalScore = Math.round(baseScore * comboData.multiplier);
  state.score += totalScore;

  const comboThresholds = Object.keys(WALL_MODE_COMBO_MULTIPLIERS).map(Number);
  if (comboThresholds.includes(state.wallMode.rallyStreak)) {
    const combo = WALL_MODE_COMBO_MULTIPLIERS[state.wallMode.rallyStreak as keyof typeof WALL_MODE_COMBO_MULTIPLIERS];
    state.comboText = combo.name;
    state.comboColor = combo.color;
    state.triggerScreenShake(0.15);
  }

  if (state.score > state.highScore) {
    state.highScore = state.score;
  }

  if (state.wallMode.levelStreak >= state.wallMode.currentLevelConfig.streakGoal) {
    state.wallMode.gameState = 'levelComplete';
  }

  const powerupChance = zoneType === 'target' ? 0.05 : 0.02;
  if (Math.random() < powerupChance && !state.wallMode.availablePowerup) {
    const powerupTypes: PowerupType[] = ['slowmo', 'widen', 'magnet', 'shield', 'curveBoost'];
    state.wallMode.availablePowerup = {
      type: powerupTypes[Math.floor(Math.random() * powerupTypes.length)],
      position: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, 0],
    };
  }

  return { score: totalScore, combo: comboData };
};

export const wallModeMiss = (state: ReactPongState) => {
  state.wallMode.lives--;
  state.wallMode.rallyStreak = 0;
  state.wallMode.currentSpeed = state.wallMode.currentLevelConfig.baseSpeed;
  state.comboText = '';

  if (state.wallMode.lives <= 0) {
    state.wallMode.gameState = 'gameOver';
  } else {
    state.wallMode.gameState = 'ready';
  }
};

export const getWallModeMultiplier = (state: ReactPongState) => {
  const thresholds = Object.keys(WALL_MODE_COMBO_MULTIPLIERS).map(Number).sort((a, b) => b - a);
  for (const threshold of thresholds) {
    if (state.wallMode.rallyStreak >= threshold) {
      return WALL_MODE_COMBO_MULTIPLIERS[threshold as keyof typeof WALL_MODE_COMBO_MULTIPLIERS];
    }
  }
  return { multiplier: 1, name: '', color: '#ffffff' };
};

export const collectPowerup = (state: ReactPongState, type: PowerupType) => {
  state.wallMode.availablePowerup = null;

  switch (type) {
    case 'slowmo':
      state.wallMode.activePowerups.push({ type: 'slowmo', remainingTime: 2 });
      break;
    case 'widen':
      state.wallMode.activePowerups.push({ type: 'widen', remainingTime: 5 });
      break;
    case 'magnet':
      state.wallMode.activePowerups.push({ type: 'magnet', remainingUses: 3 });
      break;
    case 'shield':
      state.wallMode.activePowerups.push({ type: 'shield', remainingUses: 1 });
      break;
    case 'curveBoost':
      state.wallMode.activePowerups.push({ type: 'curveBoost', remainingUses: 1 });
      break;
  }
};

export const updatePowerups = (state: ReactPongState, delta: number) => {
  state.wallMode.activePowerups = state.wallMode.activePowerups.filter((p) => {
    if (p.remainingTime !== undefined) {
      p.remainingTime -= delta;
      return p.remainingTime > 0;
    }
    if (p.remainingUses !== undefined) {
      return p.remainingUses > 0;
    }
    return true;
  });
};

export const hasPowerup = (state: ReactPongState, type: PowerupType) =>
  state.wallMode.activePowerups.some((p) => p.type === type);

export const usePowerup = (state: ReactPongState, type: PowerupType) => {
  const powerup = state.wallMode.activePowerups.find((p) => p.type === type);
  if (powerup && powerup.remainingUses !== undefined) {
    powerup.remainingUses--;
  }
};
