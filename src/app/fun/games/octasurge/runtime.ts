import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import { GAME, STAGE_PROFILES } from './constants';
import { normalizeLane } from './generator';
import type { OctaCameraMode, OctaSurgeMode } from './types';

export type RuntimeStore = {
  seed: number;
  mode: OctaSurgeMode;
  cameraMode: OctaCameraMode;

  laneIndex: number;
  sides: number;
  targetRotation: number;
  rotation: number;
  angularVelocity: number;

  speed: number;
  distance: number;
  score: number;
  runTime: number;

  combo: number;
  comboTimer: number;
  multiplier: number;

  stageId: number;
  stageFlash: number;

  nextSegmentIndex: number;
  farthestBackZ: number;
  lastSafeLane: number;

  slowMoMeter: number;
  slowMoTime: number;
  shardCount: number;
  syncTimer: number;

  flipPulse: number;
  dangerPulse: number;
  audioReactive: number;

  turnCooldown: number;
  flipCooldown: number;

  resetRun: (params: {
    seed: number;
    mode: OctaSurgeMode;
    cameraMode: OctaCameraMode;
  }) => void;
  stepLane: (direction: -1 | 1) => void;
  flipLane: () => void;
  cycleCameraMode: () => void;
  setCameraMode: (mode: OctaCameraMode) => void;
};

const TWO_PI = Math.PI * 2;

const laneStep = (sides: number) => TWO_PI / Math.max(3, sides);
const rotationForLane = (lane: number, sides: number) =>
  GAME.playerAngle - normalizeLane(lane, sides) * laneStep(sides);

const defaultSides = STAGE_PROFILES[0].sides;

export const useOctaRuntimeStore = create<RuntimeStore>()(
  subscribeWithSelector((set, get) => ({
    seed: 1,
    mode: 'classic',
    cameraMode: 'chase',

    laneIndex: Math.floor(defaultSides / 2),
    sides: defaultSides,
    targetRotation: rotationForLane(Math.floor(defaultSides / 2), defaultSides),
    rotation: rotationForLane(Math.floor(defaultSides / 2), defaultSides),
    angularVelocity: 0,

    speed: GAME.baseSpeed,
    distance: 0,
    score: 0,
    runTime: 0,

    combo: 0,
    comboTimer: 0,
    multiplier: 1,

    stageId: STAGE_PROFILES[0].id,
    stageFlash: 0,

    nextSegmentIndex: GAME.segmentCount,
    farthestBackZ: GAME.spawnStartZ - (GAME.segmentCount - 1) * GAME.segmentLength,
    lastSafeLane: Math.floor(defaultSides / 2),

    slowMoMeter: 0,
    slowMoTime: 0,
    shardCount: 0,
    syncTimer: 0,

    flipPulse: 0,
    dangerPulse: 0,
    audioReactive: 0,

    turnCooldown: 0,
    flipCooldown: 0,

    resetRun: ({ seed, mode, cameraMode }) => {
      const sides = STAGE_PROFILES[0].sides;
      const laneIndex = Math.floor(sides / 2);
      set({
        seed,
        mode,
        cameraMode,
        laneIndex,
        sides,
        targetRotation: rotationForLane(laneIndex, sides),
        rotation: rotationForLane(laneIndex, sides),
        angularVelocity: 0,
        speed: GAME.baseSpeed,
        distance: 0,
        score: 0,
        runTime: 0,
        combo: 0,
        comboTimer: 0,
        multiplier: 1,
        stageId: STAGE_PROFILES[0].id,
        stageFlash: 0,
        nextSegmentIndex: GAME.segmentCount,
        farthestBackZ:
          GAME.spawnStartZ - (GAME.segmentCount - 1) * GAME.segmentLength,
        lastSafeLane: laneIndex,
        slowMoMeter: 0,
        slowMoTime: 0,
        shardCount: 0,
        syncTimer: 0,
        flipPulse: 0,
        dangerPulse: 0,
        audioReactive: 0,
        turnCooldown: 0,
        flipCooldown: 0,
      });
    },

    stepLane: (direction) => {
      const state = get();
      if (state.turnCooldown > 0) return;

      const sides = state.sides;
      const nextLane = normalizeLane(state.laneIndex + direction, sides);
      set({
        laneIndex: nextLane,
        targetRotation: rotationForLane(nextLane, sides),
        turnCooldown: GAME.turnCooldownMs / 1000,
      });
    },

    flipLane: () => {
      const state = get();
      if (state.flipCooldown > 0) return;

      const sides = state.sides;
      const opposite = Math.floor(sides / 2);
      const nextLane = normalizeLane(state.laneIndex + opposite, sides);

      set({
        laneIndex: nextLane,
        targetRotation: rotationForLane(nextLane, sides),
        flipPulse: 1,
        flipCooldown: GAME.flipCooldownMs / 1000,
      });
    },

    cycleCameraMode: () => {
      const mode = get().cameraMode;
      const next: OctaCameraMode =
        mode === 'chase'
          ? 'firstPerson'
          : mode === 'firstPerson'
            ? 'topDown'
            : 'chase';
      set({ cameraMode: next });
    },

    setCameraMode: (mode) => set({ cameraMode: mode }),
  }))
);
