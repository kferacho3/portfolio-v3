export type ThemeKey = 'neon' | 'ice' | 'lava' | 'void' | 'cyber' | 'forest';

export interface Theme {
  name: string;
  background: string;
  platform: string;
  accent: string;
  ball: string;
  crumble: string;
  boost: string;
  fog: string;
}

export type PlatformType = 'static' | 'crumble' | 'moving' | 'boost' | 'start';

export interface Platform {
  id: string;
  type: PlatformType;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  rotation?: number;
  moveAxis?: 'x' | 'z';
  moveRange?: number;
  movePhase?: number;
  crumbleTimer?: number;
  touched?: boolean;
}

export interface Collectible {
  id: string;
  type: 'coin' | 'gem' | 'powerup';
  x: number;
  y: number;
  z: number;
  collected: boolean;
  powerupType?: 'shield' | 'speed' | 'doublePoints';
}
