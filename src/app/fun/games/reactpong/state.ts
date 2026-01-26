import { proxy } from 'valtio';
import { defaultBallTexture, reactPongSkins } from './constants';
import type { Block, HitEffect, ReactPongMode, ScorePopup } from './types';
import {
  advanceWallModeLevel,
  collectPowerup,
  createWallModeState,
  generateWallZones,
  getWallModeMultiplier,
  hasPowerup,
  resetWallMode,
  updatePowerups,
  usePowerup,
  wallModeCaptureBall,
  wallModeHitWall,
  wallModeMiss,
  wallModeReleaseBall,
} from './state/wallMode';
import {
  addHitEffect,
  addScorePopup,
  getMultiplier,
  hitBlock,
  pong,
  reset,
  triggerScreenShake,
} from './state/scoring';

export const reactPongState = proxy({
  score: 0,
  highScore: 0,
  hitStreak: 0,
  bestStreak: 0,
  totalHits: 0,
  ballColor: '#00d4ff',
  scoreColor: '#00d4ff',
  currentMultiplier: 1,
  ballTexture: defaultBallTexture,
  count: 0,

  scorePopups: [] as ScorePopup[],
  hitEffects: [] as HitEffect[],
  screenShake: 0,
  comboText: '',
  comboColor: '#ffffff',

  audio: {
    paddleHitSound: null as HTMLAudioElement | null,
    wallHitSound: null as HTMLAudioElement | null,
    scoreSound: null as HTMLAudioElement | null,
    scoreBonusSound: null as HTMLAudioElement | null,
  },

  blocks: {
    breakable: {} as Record<string, Block>,
    stationary: {} as Record<string, Block>,
    bouncy: {} as Record<string, Block>,
  },

  skins: [...reactPongSkins],
  mode: 'SoloPaddle' as ReactPongMode,

  wallMode: createWallModeState(),

  setMode: (mode: ReactPongMode) => {
    reactPongState.mode = mode;
    if (mode === 'WallMode') {
      reactPongState.resetWallMode();
    }
  },

  resetWallMode: () => resetWallMode(reactPongState),
  generateWallZones: () => generateWallZones(reactPongState),
  advanceWallModeLevel: () => advanceWallModeLevel(reactPongState),
  wallModeCaptureBall: () => wallModeCaptureBall(reactPongState),
  wallModeReleaseBall: () => wallModeReleaseBall(reactPongState),
  wallModeHitWall: (zoneType?: string, isPerfectCatch: boolean = false) =>
    wallModeHitWall(reactPongState, zoneType, isPerfectCatch),
  wallModeMiss: () => wallModeMiss(reactPongState),
  getWallModeMultiplier: () => getWallModeMultiplier(reactPongState),
  collectPowerup: (type: Parameters<typeof collectPowerup>[1]) =>
    collectPowerup(reactPongState, type),
  updatePowerups: (delta: number) => updatePowerups(reactPongState, delta),
  hasPowerup: (type: Parameters<typeof hasPowerup>[1]) =>
    hasPowerup(reactPongState, type),
  usePowerup: (type: Parameters<typeof usePowerup>[1]) =>
    usePowerup(reactPongState, type),

  addScorePopup: (
    value: number,
    position: [number, number, number],
    color: string,
    combo?: string
  ) => addScorePopup(reactPongState, value, position, color, combo),
  addHitEffect: (
    position: [number, number, number],
    color: string,
    intensity: number
  ) => addHitEffect(reactPongState, position, color, intensity),
  triggerScreenShake: (intensity: number) =>
    triggerScreenShake(reactPongState, intensity),
  getMultiplier: () => getMultiplier(reactPongState),
  hitBlock: (type: Parameters<typeof hitBlock>[1], id: string) =>
    hitBlock(reactPongState, type, id),
  pong: (
    velocity: number,
    colliderType: string,
    position?: [number, number, number]
  ) => pong(reactPongState, velocity, colliderType, position),
  reset: () => reset(reactPongState),
});

export type ReactPongState = typeof reactPongState;
