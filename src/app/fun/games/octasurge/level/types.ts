import type {
  CollectibleKind,
  OctaObstacleType,
  OctaPlatformType,
} from '../types';

export type RingMask = number;

export type ModeSides = 6 | 8 | 10 | 12;

export type RingLaneMeta = {
  lane: number;
  platform: OctaPlatformType;
  platformPhase: number;
  obstacle: OctaObstacleType;
  obstaclePhase: number;
  obstacleCycle: number;
  obstacleOpenWindow: number;
  obstacleWindowStart: number;
};

export type RingData = {
  index: number;
  sides: ModeSides;
  stageId: number;
  solidMask: RingMask;
  safeLane: number;
  warpSeed: number;
  laneMeta: RingLaneMeta[];
  collectibleLane: number;
  collectibleType: CollectibleKind;
  collected: boolean;
};
