import { create } from 'zustand';
import type { PickupToast } from './types';
import {
  DEFAULT_GEOCHROME_PALETTE,
  GEOCHROME_PALETTE_ORDER,
  GROWTH_TUNING,
  PLAYER_TUNING,
  randomGeoChromePaletteId,
  type GeoChromePaletteId,
} from './constants';

interface GeoChromeStore {
  started: boolean;
  audioReady: boolean;
  lowPerf: boolean;
  targetDpr: number;
  diameter: number;
  pickupLimit: number;
  stuckCount: number;
  worldCount: number;
  combo: number;
  comboMultiplier: number;
  maxCombo: number;
  lastPickupAt: number;
  recentPickups: PickupToast[];
  paletteId: GeoChromePaletteId;
  start: () => void;
  setAudioReady: (ready: boolean) => void;
  setLowPerf: (lowPerf: boolean) => void;
  setTargetDpr: (targetDpr: number) => void;
  setDiameter: (diameter: number) => void;
  setPickupLimit: (pickupLimit: number) => void;
  setStuckCount: (count: number) => void;
  setWorldCount: (count: number) => void;
  setPalette: (paletteId: GeoChromePaletteId) => void;
  nextPalette: () => void;
  randomizePalette: () => void;
  pushPickup: (pickup: Omit<PickupToast, 'id'>) => void;
  registerPickupCombo: (size: number) => void;
  tickCombo: (now: number) => void;
  resetProgress: () => void;
  resetRun: () => void;
}

let pickupId = 1;
const baseDiameter = PLAYER_TUNING.baseRadius * 2;
const basePickupLimit = PLAYER_TUNING.baseRadius * GROWTH_TUNING.pickupFactor;

export const useGeoChromeStore = create<GeoChromeStore>((set) => ({
  started: false,
  audioReady: false,
  lowPerf: false,
  targetDpr: 1.25,
  diameter: baseDiameter,
  pickupLimit: basePickupLimit,
  stuckCount: 0,
  worldCount: 0,
  combo: 0,
  comboMultiplier: 1,
  maxCombo: 0,
  lastPickupAt: 0,
  recentPickups: [],
  paletteId: DEFAULT_GEOCHROME_PALETTE,

  start: () => set({ started: true }),

  setAudioReady: (audioReady) => set({ audioReady }),

  setLowPerf: (lowPerf) => set({ lowPerf }),

  setTargetDpr: (targetDpr) => set({ targetDpr }),

  setDiameter: (diameter) => set({ diameter }),

  setPickupLimit: (pickupLimit) => set({ pickupLimit }),

  setStuckCount: (stuckCount) => set({ stuckCount }),

  setWorldCount: (worldCount) => set({ worldCount }),

  setPalette: (paletteId) => set({ paletteId }),

  nextPalette: () =>
    set((state) => {
      const currentIndex = GEOCHROME_PALETTE_ORDER.indexOf(state.paletteId);
      const nextIndex =
        currentIndex >= 0
          ? (currentIndex + 1) % GEOCHROME_PALETTE_ORDER.length
          : 0;
      return { paletteId: GEOCHROME_PALETTE_ORDER[nextIndex] };
    }),

  randomizePalette: () =>
    set((state) => {
      let next = randomGeoChromePaletteId();
      if (GEOCHROME_PALETTE_ORDER.length > 1 && next === state.paletteId) {
        const currentIndex = GEOCHROME_PALETTE_ORDER.indexOf(state.paletteId);
        next =
          GEOCHROME_PALETTE_ORDER[
            (Math.max(0, currentIndex) + 1) % GEOCHROME_PALETTE_ORDER.length
          ];
      }
      return { paletteId: next };
    }),

  pushPickup: (pickup) =>
    set((state) => ({
      recentPickups: [
        { ...pickup, id: pickupId++ },
        ...state.recentPickups,
      ].slice(0, 5),
    })),

  registerPickupCombo: (size) =>
    set((state) => {
      const now = performance.now();
      const withinWindow =
        state.lastPickupAt > 0 &&
        now - state.lastPickupAt <= GROWTH_TUNING.comboWindowMs;
      const combo = withinWindow ? state.combo + 1 : 1;
      const bonus = Math.min(
        GROWTH_TUNING.comboMaxMultiplierBonus,
        combo * GROWTH_TUNING.comboMultiplierStep + size * 0.045
      );
      return {
        combo,
        comboMultiplier: 1 + bonus,
        maxCombo: Math.max(state.maxCombo, combo),
        lastPickupAt: now,
      };
    }),

  tickCombo: (now) =>
    set((state) => {
      if (state.combo <= 0) return state;
      if (now - state.lastPickupAt <= GROWTH_TUNING.comboWindowMs) {
        return state;
      }
      return {
        combo: 0,
        comboMultiplier: 1,
      };
    }),

  resetProgress: () =>
    set({
      diameter: baseDiameter,
      pickupLimit: basePickupLimit,
      stuckCount: 0,
      worldCount: 0,
      combo: 0,
      comboMultiplier: 1,
      maxCombo: 0,
      lastPickupAt: 0,
      recentPickups: [],
    }),

  resetRun: () =>
    set((state) => ({
      started: false,
      audioReady: false,
      diameter: baseDiameter,
      pickupLimit: basePickupLimit,
      stuckCount: 0,
      worldCount: 0,
      combo: 0,
      comboMultiplier: 1,
      maxCombo: 0,
      lastPickupAt: 0,
      recentPickups: [],
      lowPerf: false,
      targetDpr: 1.25,
      paletteId: state.paletteId ?? DEFAULT_GEOCHROME_PALETTE,
    })),
}));
