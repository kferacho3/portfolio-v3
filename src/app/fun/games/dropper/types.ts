export type DropperDifficulty = 'easy' | 'medium' | 'hard';

export type ItemType =
  | 'coin'
  | 'gem'
  | 'diamond'
  | 'star'
  | 'crown'
  | 'pearl'
  | 'ruby'
  | 'emerald'
  | 'rareGold'
  | 'rarePlatinum'
  | 'rareRainbow'
  | 'heart'
  | 'shield'
  | 'magnet'
  | 'doublePoints'
  | 'slowTime'
  | 'bomb'
  | 'skull'
  | 'spike'
  | 'poison';

export type PowerUpType =
  | 'heart'
  | 'shield'
  | 'magnet'
  | 'doublePoints'
  | 'slowTime';

export interface ItemConfig {
  points: number;
  probability: number;
  fallSpeed: number;
  color: string;
  emissive: string;
  scale: number;
  isRare: boolean;
  isDangerous: boolean;
  isPowerUp: boolean;
  powerUpType?: PowerUpType;
  shape:
    | 'sphere'
    | 'box'
    | 'octahedron'
    | 'dodecahedron'
    | 'icosahedron'
    | 'torus'
    | 'cone'
    | 'heart';
}

export interface FallingItem {
  id: string;
  x: number;
  y: number;
  type: ItemType;
  config: ItemConfig;
  collected: boolean;
  visualScale: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

export interface DropperState {
  score: number;
  difficulty: DropperDifficulty;
  reset: () => void;
}
