export type SimDir = [number, 0, number];
export type SimVec3 = [number, number, number];

export type ObstacleType = 'wall' | 'spike' | 'bar';

export type Obstacle = {
  id: number;
  type: ObstacleType;
  along: number;
  lateral: number;
  w: number;
  h: number;
  d: number;
  requiredClearY: number;
  cleared: boolean;
  nearMissed: boolean;
};

export type Step = {
  i: number;
  pos: SimVec3; // Tread center (top plane)
  start: SimVec3;
  end: SimVec3;
  dir: SimDir;
  length: number;
  width: number;
  height: number; // Top plane y
  riseToNext: number;
  gapAfter: boolean;
  gapLength: number;
  obstacles?: Obstacle[];
  gem?: {
    offset: SimVec3;
    collected: boolean;
  };
};

export type GenMode = 'classic' | 'curved' | 'spiral';
export type TrackMode = 'auto' | 'classic' | 'curved' | 'spiral' | 'mix';

export type GenState = {
  pos: SimVec3;
  dir: SimDir;
  yaw: number;
  yawVel: number;
  mode: GenMode;
  modeStepsLeft: number;
  spiralSign: 1 | -1;
  classicRunRemaining: number;
  classicTurnSign: 1 | -1;
  tension: boolean;
  tensionStepsLeft: number;
  obstacleCooldown: number;
  hazardBurstRemaining: number;
  demandingCooldown: number;
  prevGapAfter: boolean;
  prevRiseToNext: number;
  totalStepIndex: number;
};
