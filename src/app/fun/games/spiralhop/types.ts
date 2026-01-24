export type SpiralHopPhase = 'menu' | 'playing' | 'gameover';

export type BallSkin = {
  id: string;
  name: string;
  color: string;
  emissive?: string;
  metalness?: number;
  roughness?: number;
};

export type PlatformTheme = {
  id: string;
  name: string;
  topColor: string;
  edgeColor: string;
  glowColor: string;
  fogColor: string;
  skyTop: string;
  skyBottom: string;
};

export type PlatformData = {
  id: number;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  yaw: number;
  baseYaw: number;
  twistSpeed: number;
  hasGem: boolean;
};
