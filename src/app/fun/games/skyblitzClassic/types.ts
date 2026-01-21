export type SkyBlitzClassicMode = 'UfoMode' | 'RunnerManMode';
export type SkyBlitzGraphicsMode = 'clean' | 'classic';

export interface SkyBlitzClassicState {
  score: number;
  health: number;
  mode: SkyBlitzClassicMode;
  graphicsMode: SkyBlitzGraphicsMode;
  setMode: (mode: SkyBlitzClassicMode) => void;
  setGraphicsMode: (mode: SkyBlitzGraphicsMode) => void;
  reset: () => void;
}

export interface RunnerObstacleData {
  position: [number, number, number];
  scale: number;
}
