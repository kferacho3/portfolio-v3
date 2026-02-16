import { create } from 'zustand';
import type { OctaCameraMode } from './types';

export type OctaRuntimeState = {
  cameraMode: OctaCameraMode;
  laneFloat: number;
  laneIndex: number;
  sides: number;
  speed: number;
  combo: number;
  score: number;
  collectibles: number;
  speedTier: number;
  patternLabel: string;
  fxPulse: number;
  hitFlash: number;
  switchBlur: number;
};

export const useOctaRuntimeStore = create<OctaRuntimeState>(() => ({
  cameraMode: 'chase',
  laneFloat: 0,
  laneIndex: 0,
  sides: 8,
  speed: 0,
  combo: 0,
  score: 0,
  collectibles: 0,
  speedTier: 0,
  patternLabel: 'Axial Gates',
  fxPulse: 0,
  hitFlash: 0,
  switchBlur: 0,
}));
