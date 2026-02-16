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
  | 'smooth_lane'
  | 'drift_boost'
  | 'reverse_drift'
  | 'pulse_pad'
  | 'spring_pad'
  | 'warp_gate'
  | 'phase_lane'
  | 'resin_lane'
  | 'crusher_lane'
  | 'overdrive_strip'
  | 'split_rail'
  | 'gravity_drift';

export type OctaObstacleType =
  | 'none'
  | 'arc_blade'
  | 'shutter_gate'
  | 'pulse_laser'
  | 'gravity_orb'
  | 'prism_mine'
  | 'flame_jet'
  | 'phase_portal'
  | 'trap_split'
  | 'magnetron'
  | 'spike_fan'
  | 'thunder_column'
  | 'vortex_saw'
  | 'ion_barrier'
  | 'void_serpent'
  | 'ember_wave'
  | 'quantum_shard';

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

export type OctaReplayGhostFrame = {
  frame: number;
  x: number;
  y: number;
  z: number;
};

export type OctaReplayOutcome = 'complete' | 'death' | 'abort';

export type OctaReplayModeState = 'off' | 'record' | 'playback';

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
  ghostFrames: OctaReplayGhostFrame[];
};
