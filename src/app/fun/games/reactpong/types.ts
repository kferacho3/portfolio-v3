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
  gameState: 'playing' | 'gameOver';
  /** Whether the ball has been launched for this run */
  started: boolean;
  /** Seconds survived (run timer) */
  elapsed: number;

  /** Time-based speed curve */
  baseSpeed: number;
  currentSpeed: number;
  maxSpeed: number;
  /** Per-second exponential multiplier (e.g. 1.0085) */
  speedGrowth: number;

  /** Persistent spin that curves trajectories (compounds until death) */
  spin: { x: number; y: number };
  /** How strongly spin bends velocity each frame */
  spinStrength: number;
  /** How much paddle motion/offset adds spin */
  spinSensitivity: number;
  /** Additional spin sensitivity per second */
  spinSensitivityGrowth: number;

  /** 0..1, used to ramp opposing wall deflection noise */
  wallChaos: number;

  paddleHits: number;
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
