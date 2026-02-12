export type OctaSurgePhase = 'menu' | 'playing' | 'gameover';

export type OctaSurgeMode = 'classic' | 'endless' | 'daily';

export type OctaFxLevel = 'full' | 'medium' | 'low';

export type OctaCameraMode = 'chase' | 'firstPerson' | 'topDown';

export type CollectibleKind = 'shard' | 'core' | 'sync' | null;

export type StageProfile = {
  id: number;
  label: string;
  sides: number;
  scoreGate: number;
  speedMultiplier: number;
  holeDensity: number;
  obstacleDensity: number;
  warpAmplitude: number;
  collectibleChance: number;
};

export type SegmentPattern = {
  slot: number;
  index: number;
  z: number;
  prevZ: number;
  sides: number;
  solidMask: number;
  obstacleMask: number;
  safeLane: number;
  collectibleLane: number;
  collectibleType: CollectibleKind;
  collected: boolean;
  warpSeed: number;
  stageId: number;
  checked: boolean;
};
