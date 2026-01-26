export type ReactPongMode = 'SoloPaddle' | 'SoloWalls' | 'WallMode';

export type PowerupType =
  | 'slowmo'
  | 'widen'
  | 'magnet'
  | 'shield'
  | 'curveBoost';

export interface ActivePowerup {
  type: PowerupType;
  remainingTime?: number;
  remainingUses?: number;
}

export interface WallZone {
  id: string;
  type: 'speed' | 'spin' | 'bounce' | 'target' | 'hazard';
  position: readonly [number, number, number];
  size: readonly [number, number];
  effect: number;
}

export type BlockType = 'breakable' | 'stationary' | 'bouncy';

export interface Block {
  color: string;
  position: readonly [number, number, number];
  hitsLeft: number;
}

export interface UnlockableSkin {
  name: string;
  url: string;
  unlocked: boolean;
  achievement: string;
}

export interface ScorePopup {
  id: string;
  value: number;
  position: readonly [number, number, number];
  color: string;
  combo?: string;
  timestamp: number;
}

export interface HitEffect {
  id: string;
  position: readonly [number, number, number];
  color: string;
  intensity: number;
  timestamp: number;
}

export interface WallModeState {
  lives: number;
  currentLevel: number;
  gameState:
    | 'ready'
    | 'playing'
    | 'captured'
    | 'levelComplete'
    | 'gameOver'
    | 'victory';
  currentSpeed: number;
  maxSpeed: number;
  rallyStreak: number;
  levelStreak: number;
  isBallCaptured: boolean;
  captureStartTime: number;
  captureHoldTime: number;
  chargeAmount: number;
  spinIntensity: number;
  lastPaddleVelocity: { x: number; y: number };
  currentLevelConfig: (typeof import('./constants').WALL_MODE_LEVELS)[number];
  wallZones: WallZone[];
  activePowerups: ActivePowerup[];
  availablePowerup: {
    type: PowerupType;
    position: [number, number, number];
  } | null;
  stabilizeMode: boolean;
  lastCatchWasPerfect: boolean;
}

export interface SpacePongBallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  rotation: number;
}
