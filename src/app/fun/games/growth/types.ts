export type Face = 0 | 1 | 2 | 3;
export type PowerupType = 'boost' | 'shield';
export type GrowthPathStyleId = 'voxelized' | 'classic' | 'apex';

export type GrowthPhase = 'menu' | 'playing' | 'gameover';

export interface GrowthSegment {
  slot: number;
  sequence: number;
  z: number;
  blockedFaces: Face[];
  obstacleHeights: number[];
  obstacleTargetHeights: number[];
  obstacleGrowthRates: number[];
  safeFace: Face;
  gemFace: Face | null;
  powerupFace: Face | null;
  powerupType: PowerupType | null;
  gemTaken: boolean;
  powerupTaken: boolean;
  growthActivated: boolean;
  growthStartZ: number;
  cleared: boolean;
}

export interface GrowthGameState {
  phase: GrowthPhase;
  paused: boolean;
  time: number;
  score: number;
  gems: number;
  speed: number;
  bestScore: number;
  perfectTurns: number;
  shieldMs: number;
  boostMs: number;
  pathStyle: GrowthPathStyleId;
}
