export interface Tile {
  x: number;
  z: number;
  gem: boolean;
  taken: boolean;
  id: string;
}

export interface BranchFlipGameState {
  phase: 'menu' | 'playing' | 'gameover';
  paused: boolean;
  time: number;
  score: number;
  gems: number;
  speed: number;
  dir: number;
  falling: boolean;
  fallT: number;
  shake: number;
  bestScore: number;
}
