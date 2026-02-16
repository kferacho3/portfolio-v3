export type OctaSurgePhase = 'menu' | 'playing' | 'gameover';

export type OctaSurgeMode = 'classic' | 'endless' | 'daily';

export type OctaFxLevel = 'full' | 'medium' | 'low';

export type OctaCameraMode = 'chase' | 'firstPerson' | 'topDown';

export type OctaPathStyle = 'smooth-classic';

export type OctaTileVariant =
  | 'classic'
  | 'alloy'
  | 'prismatic'
  | 'trailChevron'
  | 'gridForge'
  | 'diamondTess'
  | 'sunkenSteps'
  | 'rippleField';

export type OctaPlatformType =
  | 'standard'
  | 'conveyor_belt'
  | 'reverse_conveyor'
  | 'bouncer'
  | 'trampoline'
  | 'teleporter'
  | 'ghost_platform'
  | 'sticky_glue'
  | 'crushing_ceiling'
  | 'speed_ramp';

export type OctaObstacleType =
  | 'none'
  | 'laser_grid'
  | 'gravity_well'
  | 'rotating_cross_blades'
  | 'homing_mine'
  | 'rising_lava'
  | 'telefrag_portal'
  | 'trapdoor_row'
  | 'pulse_expander'
  | 'magnetic_field'
  | 'spike_wave'
  | 'lightning_striker';

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

export type SegmentLanePattern = {
  lane: number;
  platform: OctaPlatformType;
  platformPhase: number;
  obstacle: OctaObstacleType;
  obstaclePhase: number;
  obstacleCycle: number;
  obstacleOpenWindow: number;
  obstacleWindowStart: number;
};

export type SegmentPattern = {
  slot: number;
  index: number;
  z: number;
  prevZ: number;
  sides: number;
  solidMask: number;
  obstacleMask: number;
  lanePatterns: SegmentLanePattern[];
  safeLane: number;
  collectibleLane: number;
  collectibleType: CollectibleKind;
  collected: boolean;
  warpSeed: number;
  stageId: number;
  checked: boolean;
};

export type OctaReplayInputAction =
  | 'turn_left'
  | 'turn_right'
  | 'flip'
  | 'slow_mo';

export type OctaReplayInputEvent = {
  frame: number;
  action: OctaReplayInputAction;
};

export type OctaReplayOutcome = 'complete' | 'death' | 'abort';

export type OctaReplayRun = {
  version: 1;
  seed: number;
  mode: OctaSurgeMode;
  cameraMode: OctaCameraMode;
  recordedAt: number;
  totalFrames: number;
  finalScore: number;
  finalDistance: number;
  finalTime: number;
  outcome: OctaReplayOutcome;
  endReason: string;
  events: OctaReplayInputEvent[];
};
