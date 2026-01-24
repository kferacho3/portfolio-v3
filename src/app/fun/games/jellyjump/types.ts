export type JellyJumpPhase = 'menu' | 'playing' | 'gameover';

export type PlatformKind = 'slide' | 'rotate' | 'base';

export type JellyPalette = {
  name: string;
  bg: string;
  fog: string;
  accent: string;
  platformSlide: string;
  platformRotate: string;
  platformBase: string;
  player: string;
  lava: string;
};

export type PlatformPattern = {
  seed: number;
  types: boolean[]; // true=slide, false=rotate
  activationTimes: number[]; // seconds
  obstacles: ObstacleData[]; // bombs/obstacles
  levers: LeverData[]; // levers to activate
  boosters: BoosterData[]; // level skips or freeze
  gems: GemData[]; // collectible gems
};

export type PlatformPieceTransform = {
  x: number;
  y: number;
  z: number;
  rotZ: number;
  solid: boolean;
};

export type ObstacleData = {
  rowIndex: number;
  x: number;
  z: number;
  type: 'bomb'; // future: could add spikes, etc.
  driftAmp: number;
  driftSpeed: number;
  driftPhase: number;
};

export type LeverData = {
  rowIndex: number;
  x: number;
  z: number;
  targetRowIndex: number; // which row it unlocks
  activated: boolean;
};

export type BoosterData = {
  rowIndex: number;
  x: number;
  z: number;
  type: 'levelSkip' | 'freeze';
  collected: boolean;
};

export type GemData = {
  rowIndex: number;
  x: number;
  z: number;
  collected: boolean;
  value: number; // points
};

export type Character = {
  id: string;
  name: string;
  color: string;
  emissive: string;
  size: number;
};

export type EffectKind = 'bomb' | 'booster' | 'lever' | 'gem';

export type EffectVariant = 'levelSkip' | 'freeze';

export type EffectEvent = {
  id: number;
  type: EffectKind;
  variant?: EffectVariant;
  x: number;
  y: number;
  z: number;
  createdAt: number;
};
