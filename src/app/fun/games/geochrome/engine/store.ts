import { create } from 'zustand';
import type { PickupToast } from './types';
import { PLAYER_TUNING } from './constants';

interface GeoChromeStore {
  started: boolean;
  audioReady: boolean;
  lowPerf: boolean;
  targetDpr: number;
  diameter: number;
  stuckCount: number;
  worldCount: number;
  recentPickups: PickupToast[];
  start: () => void;
  setAudioReady: (ready: boolean) => void;
  setLowPerf: (lowPerf: boolean) => void;
  setTargetDpr: (targetDpr: number) => void;
  setDiameter: (diameter: number) => void;
  setStuckCount: (count: number) => void;
  setWorldCount: (count: number) => void;
  pushPickup: (pickup: Omit<PickupToast, 'id'>) => void;
  resetProgress: () => void;
  resetRun: () => void;
}

let pickupId = 1;
const baseDiameter = PLAYER_TUNING.baseRadius * 2;

export const useGeoChromeStore = create<GeoChromeStore>((set) => ({
  started: false,
  audioReady: false,
  lowPerf: false,
  targetDpr: 1.25,
  diameter: baseDiameter,
  stuckCount: 0,
  worldCount: 0,
  recentPickups: [],

  start: () => set({ started: true }),

  setAudioReady: (audioReady) => set({ audioReady }),

  setLowPerf: (lowPerf) => set({ lowPerf }),

  setTargetDpr: (targetDpr) => set({ targetDpr }),

  setDiameter: (diameter) => set({ diameter }),

  setStuckCount: (stuckCount) => set({ stuckCount }),

  setWorldCount: (worldCount) => set({ worldCount }),

  pushPickup: (pickup) =>
    set((state) => ({
      recentPickups: [{ ...pickup, id: pickupId++ }, ...state.recentPickups].slice(
        0,
        5
      ),
    })),

  resetProgress: () =>
    set({
      diameter: baseDiameter,
      stuckCount: 0,
      worldCount: 0,
      recentPickups: [],
    }),

  resetRun: () =>
    set({
      started: false,
      audioReady: false,
      diameter: baseDiameter,
      stuckCount: 0,
      worldCount: 0,
      recentPickups: [],
      lowPerf: false,
      targetDpr: 1.25,
    }),
}));
