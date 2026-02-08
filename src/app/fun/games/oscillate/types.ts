export type RunStatus = {
  t: number;
  seg: number;
  s: number; // forward distance along segment
  l: number; // lateral offset within segment
  lDir: -1 | 1;

  y: number;
  vy: number;
  alive: boolean;
  cleared: boolean;
  gateOpen: boolean;
  bouncesOnSeg: number;
  totalBounces: number;

  // scoring/juice
  score: number;
  comboCount: number;
  comboTime: number;
  pulseCd: number;
  pulseCdMax: number;
  perfectFlash: number;
  missFlash: number;
  gateFlash: number;
  shake: number;
  squash: number;
  stretch: number;
  lastTapAt: number;
  gemsThisRun: number;
};

export type {
  OnePathAxis as OscillateAxis,
  OnePathWall as OscillateWall,
  OnePathGate as OscillateGate,
  OnePathLevel as OscillateLevel,
  OnePathSegment as OscillateSegment,
  OnePathGem as OscillateGem,
  OnePathPhase as OscillatePhase,
  OnePathMode as OscillateMode,
  OnePathSkin as OscillateSkin,
} from './state';
