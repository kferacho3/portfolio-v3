export type OctaSurgePhase = 'menu' | 'playing' | 'gameover';

export type OctaSurgeMode = 'symmetry' | 'evolve' | 'gauntlet';

export type OctaCameraMode = 'chase' | 'firstPerson' | 'topDown';

export type OctaTileVariant = 'prism' | 'wire' | 'glass';

export type OctaRunnerShape = string;

export type OctaRunnerGeometry =
  | 'octa'
  | 'kite'
  | 'orb'
  | 'tetra'
  | 'icosa'
  | 'dodeca'
  | 'diamond'
  | 'capsule'
  | 'crystal';

export type OctaFxLevel = 0 | 1 | 2;

export type ModeSides = 6 | 8 | 10 | 12;

export type OctaObstaclePattern =
  | 'axialGates'
  | 'crownTeeth'
  | 'mirrorFan'
  | 'quadCross'
  | 'orbitalPairs'
  | 'pulseLattice'
  | 'laserSweep'
  | 'prismClusters'
  | 'splitPillars'
  | 'helixSnare';

export type TurnDirection = -1 | 1;

export type OctaReplayInput = {
  t: number;
  dir: TurnDirection;
};

export type OctaReplay = {
  v: 1;
  seed: number;
  mode: OctaSurgeMode;
  cameraMode: OctaCameraMode;
  tileVariant: OctaTileVariant;
  runnerShape: OctaRunnerShape;
  fxLevel: OctaFxLevel;
  createdAt: number;
  score: number;
  distance: number;
  bestCombo: number;
  collectibles?: number;
  inputs: OctaReplayInput[];
};

export type OctaRunSummary = {
  score: number;
  distance: number;
  bestCombo: number;
  nearMisses: number;
  collectibles: number;
  replay: OctaReplay;
};
