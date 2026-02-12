import { proxy } from 'valtio';

import {
  CAMERA_MODE_LABEL,
  GAME,
  STORAGE_KEYS,
  STAGE_PROFILES,
} from './constants';
import type {
  OctaCameraMode,
  OctaFxLevel,
  OctaSurgeMode,
  OctaSurgePhase,
} from './types';

const safeNum = (raw: string | null, fallback = 0) => {
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : fallback;
};

const safeFxLevel = (raw: string | null): OctaFxLevel => {
  if (raw === 'full' || raw === 'medium' || raw === 'low') return raw;
  return 'full';
};

const safeCameraMode = (raw: string | null): OctaCameraMode => {
  if (raw === 'chase' || raw === 'firstPerson' || raw === 'topDown') return raw;
  return 'chase';
};

const dailySeedFromDate = () => {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

export const octaSurgeState = proxy({
  phase: 'menu' as OctaSurgePhase,
  mode: 'classic' as OctaSurgeMode,
  fxLevel: 'full' as OctaFxLevel,
  cameraMode: 'chase' as OctaCameraMode,

  score: 0,
  bestScore: 0,
  bestClassic: 0,
  bestDaily: 0,

  combo: 0,
  multiplier: 1,
  speed: GAME.baseSpeed,
  time: 0,
  distance: 0,
  progress: 0,

  sides: STAGE_PROFILES[0].sides,
  stage: STAGE_PROFILES[0].id,
  stageLabel: STAGE_PROFILES[0].label,
  stageFlash: 0,

  slowMoMeter: 0,
  shardCount: 0,
  hudPulse: 0,
  audioReactive: 0,

  crashReason: '',
  worldSeed: randomSeed(),

  setMode(mode: OctaSurgeMode) {
    this.mode = mode;
  },

  setFxLevel(level: OctaFxLevel) {
    this.fxLevel = level;
  },

  cycleFxLevel() {
    this.fxLevel =
      this.fxLevel === 'full'
        ? 'medium'
        : this.fxLevel === 'medium'
          ? 'low'
          : 'full';
  },

  setCameraMode(mode: OctaCameraMode) {
    this.cameraMode = mode;
    this.save();
  },

  cycleCameraMode() {
    this.cameraMode =
      this.cameraMode === 'chase'
        ? 'firstPerson'
        : this.cameraMode === 'firstPerson'
          ? 'topDown'
          : 'chase';
    this.save();
  },

  setCrashReason(reason: string) {
    this.crashReason = reason;
  },

  start() {
    this.phase = 'playing';
    this.crashReason = '';
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.speed = GAME.baseSpeed;
    this.time = 0;
    this.distance = 0;
    this.progress = 0;
    this.sides = STAGE_PROFILES[0].sides;
    this.stage = STAGE_PROFILES[0].id;
    this.stageLabel = STAGE_PROFILES[0].label;
    this.stageFlash = 0;
    this.slowMoMeter = 0;
    this.shardCount = 0;
    this.hudPulse = 0;
    this.audioReactive = 0;
    this.worldSeed = this.mode === 'daily' ? dailySeedFromDate() : randomSeed();
  },

  end() {
    this.phase = 'gameover';
    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.mode === 'classic' && this.score > this.bestClassic) {
      this.bestClassic = this.score;
    }
    if (this.mode === 'daily' && this.score > this.bestDaily) {
      this.bestDaily = this.score;
    }
    this.save();
  },

  load() {
    if (typeof localStorage === 'undefined') return;
    this.bestScore = safeNum(localStorage.getItem(STORAGE_KEYS.bestScore), 0);
    this.bestClassic = safeNum(localStorage.getItem(STORAGE_KEYS.bestClassic), 0);
    this.bestDaily = safeNum(localStorage.getItem(STORAGE_KEYS.bestDaily), 0);
    this.fxLevel = safeFxLevel(localStorage.getItem(STORAGE_KEYS.fxLevel));
    this.cameraMode = safeCameraMode(
      localStorage.getItem(STORAGE_KEYS.cameraMode)
    );
  },

  save() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.bestScore, String(this.bestScore));
    localStorage.setItem(STORAGE_KEYS.bestClassic, String(this.bestClassic));
    localStorage.setItem(STORAGE_KEYS.bestDaily, String(this.bestDaily));
    localStorage.setItem(STORAGE_KEYS.fxLevel, this.fxLevel);
    localStorage.setItem(STORAGE_KEYS.cameraMode, this.cameraMode);
  },

  syncFrame(payload: {
    score: number;
    combo: number;
    multiplier: number;
    speed: number;
    time: number;
    distance: number;
    progress: number;
    sides: number;
    stage: number;
    stageLabel: string;
    stageFlash: number;
    slowMoMeter: number;
    shardCount: number;
    hudPulse: number;
    audioReactive: number;
  }) {
    this.score = payload.score;
    this.combo = payload.combo;
    this.multiplier = payload.multiplier;
    this.speed = payload.speed;
    this.time = payload.time;
    this.distance = payload.distance;
    this.progress = payload.progress;
    this.sides = payload.sides;
    this.stage = payload.stage;
    this.stageLabel = payload.stageLabel;
    this.stageFlash = payload.stageFlash;
    this.slowMoMeter = payload.slowMoMeter;
    this.shardCount = payload.shardCount;
    this.hudPulse = payload.hudPulse;
    this.audioReactive = payload.audioReactive;
  },

  getCameraLabel() {
    return CAMERA_MODE_LABEL[this.cameraMode];
  },
});
