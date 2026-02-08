export type Face = 0 | 1 | 2 | 3;
export type PowerupType = 'boost' | 'shield';

export type BranchFlipPhase = 'menu' | 'playing' | 'gameover';

export interface BranchSegment {
  slot: number;
  sequence: number;
  z: number;
  blockedFaces: Face[];
  safeFace: Face;
  gemFace: Face | null;
  powerupFace: Face | null;
  powerupType: PowerupType | null;
  gemTaken: boolean;
  powerupTaken: boolean;
  cleared: boolean;
}

export interface BranchFlipGameState {
  phase: BranchFlipPhase;
  paused: boolean;
  time: number;
  score: number;
  gems: number;
  speed: number;
  bestScore: number;
  perfectTurns: number;
  shieldMs: number;
  boostMs: number;
}
