import { proxy } from 'valtio';

import {
  CAMERA_MODE_LABEL,
  GAME,
  OCTA_DEFAULT_UNLOCKED_VARIANTS,
  OCTA_TILE_UNLOCK_THRESHOLDS,
  OCTA_TILE_VARIANTS,
  STORAGE_KEYS,
  STAGE_PROFILES,
} from './constants';
import type {
  OctaCameraMode,
  OctaFxLevel,
  OctaObstacleType,
  OctaPathStyle,
  OctaPlatformType,
  OctaReplayRun,
  OctaSurgeMode,
  OctaSurgePhase,
  OctaTileVariant,
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

const safeVariant = (raw: string | null): OctaTileVariant => {
  if (raw && OCTA_TILE_VARIANTS.includes(raw as OctaTileVariant)) {
    return raw as OctaTileVariant;
  }
  return OCTA_DEFAULT_UNLOCKED_VARIANTS[0];
};

const safeVariantTier = (raw: string | null) => {
  const value = raw ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(OCTA_TILE_UNLOCK_THRESHOLDS.length, Math.floor(value)));
};

const parseUnlockedVariants = (raw: string | null): OctaTileVariant[] => {
  if (!raw) return [...OCTA_DEFAULT_UNLOCKED_VARIANTS];
  try {
    const parsed = JSON.parse(raw) as unknown[];
    const normalized = parsed.filter((item): item is OctaTileVariant =>
      OCTA_TILE_VARIANTS.includes(item as OctaTileVariant)
    );
    if (normalized.length <= 0) return [...OCTA_DEFAULT_UNLOCKED_VARIANTS];
    return Array.from(
      new Set<OctaTileVariant>([...OCTA_DEFAULT_UNLOCKED_VARIANTS, ...normalized])
    );
  } catch {
    return [...OCTA_DEFAULT_UNLOCKED_VARIANTS];
  }
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

const persistVariantProgress = () => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.tileVariant, octaSurgeState.tileVariant);
  localStorage.setItem(
    STORAGE_KEYS.unlockedVariants,
    JSON.stringify(octaSurgeState.unlockedVariants)
  );
  localStorage.setItem(
    STORAGE_KEYS.variantUnlockTier,
    String(octaSurgeState.variantUnlockTier)
  );
  localStorage.setItem(STORAGE_KEYS.styleShards, String(octaSurgeState.styleShards));
};

const unlockNextVariant = () => {
  const next = OCTA_TILE_VARIANTS.find(
    (variant) => !octaSurgeState.unlockedVariants.includes(variant)
  );
  if (!next) return;
  octaSurgeState.unlockedVariants = [...octaSurgeState.unlockedVariants, next];
  octaSurgeState.lastUnlockedVariant = next;
};

const cloneReplayRun = (run: OctaReplayRun): OctaReplayRun => ({
  ...run,
  events: run.events.map((event) => ({ ...event })),
});

export const octaSurgeState = proxy({
  phase: 'menu' as OctaSurgePhase,
  mode: 'classic' as OctaSurgeMode,
  fxLevel: 'full' as OctaFxLevel,
  cameraMode: 'chase' as OctaCameraMode,
  pathStyle: 'smooth-classic' as OctaPathStyle,

  tileVariant: OCTA_DEFAULT_UNLOCKED_VARIANTS[0] as OctaTileVariant,
  unlockedVariants: [...OCTA_DEFAULT_UNLOCKED_VARIANTS] as OctaTileVariant[],
  variantUnlockTier: 0,
  styleShards: 0,
  lastUnlockedVariant: '' as '' | OctaTileVariant,

  score: 0,
  bestScore: 0,
  bestClassic: 0,
  bestDaily: 0,

  combo: 0,
  multiplier: 1,
  speed: GAME.baseSpeed as number,
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
  currentPlatform: 'standard' as OctaPlatformType,
  currentObstacle: 'none' as OctaObstacleType,

  crashReason: '',
  worldSeed: randomSeed(),
  lastReplay: null as OctaReplayRun | null,
  replayPlaybackQueue: null as OctaReplayRun | null,

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

  setLastReplay(replay: OctaReplayRun | null) {
    this.lastReplay = replay ? cloneReplayRun(replay) : null;
  },

  queueReplayPlayback(replay?: OctaReplayRun) {
    const source = replay ?? this.lastReplay;
    if (!source) return false;
    this.replayPlaybackQueue = cloneReplayRun(source);
    return true;
  },

  consumeReplayPlayback() {
    const replay = this.replayPlaybackQueue;
    this.replayPlaybackQueue = null;
    return replay ? cloneReplayRun(replay) : null;
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
    this.currentPlatform = 'standard';
    this.currentObstacle = 'none';
    this.lastUnlockedVariant = '';
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

    this.styleShards = Math.max(
      0,
      Math.floor(safeNum(localStorage.getItem(STORAGE_KEYS.styleShards), 0))
    );
    this.unlockedVariants = parseUnlockedVariants(
      localStorage.getItem(STORAGE_KEYS.unlockedVariants)
    );
    this.variantUnlockTier = safeVariantTier(
      localStorage.getItem(STORAGE_KEYS.variantUnlockTier)
    );
    this.tileVariant = safeVariant(localStorage.getItem(STORAGE_KEYS.tileVariant));

    let expectedTier = 0;
    while (
      expectedTier < OCTA_TILE_UNLOCK_THRESHOLDS.length &&
      this.styleShards >= OCTA_TILE_UNLOCK_THRESHOLDS[expectedTier]
    ) {
      expectedTier += 1;
    }
    this.variantUnlockTier = Math.max(this.variantUnlockTier, expectedTier);

    const targetUnlockedCount = Math.min(
      OCTA_TILE_VARIANTS.length,
      OCTA_DEFAULT_UNLOCKED_VARIANTS.length + this.variantUnlockTier
    );
    while (this.unlockedVariants.length < targetUnlockedCount) {
      const next = OCTA_TILE_VARIANTS.find(
        (variant) => !this.unlockedVariants.includes(variant)
      );
      if (!next) break;
      this.unlockedVariants = [...this.unlockedVariants, next];
    }

    if (!this.unlockedVariants.includes(this.tileVariant)) {
      this.tileVariant = this.unlockedVariants[0] ?? OCTA_DEFAULT_UNLOCKED_VARIANTS[0];
    }
  },

  save() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.bestScore, String(this.bestScore));
    localStorage.setItem(STORAGE_KEYS.bestClassic, String(this.bestClassic));
    localStorage.setItem(STORAGE_KEYS.bestDaily, String(this.bestDaily));
    localStorage.setItem(STORAGE_KEYS.fxLevel, this.fxLevel);
    localStorage.setItem(STORAGE_KEYS.cameraMode, this.cameraMode);
    persistVariantProgress();
  },

  setTileVariant(variant: OctaTileVariant) {
    if (!this.unlockedVariants.includes(variant)) return;
    this.tileVariant = variant;
    persistVariantProgress();
  },

  cycleTileVariant(direction = 1) {
    if (this.unlockedVariants.length <= 1) return;
    const currentIndex = Math.max(
      0,
      this.unlockedVariants.indexOf(this.tileVariant)
    );
    const nextIndex =
      (currentIndex +
        (direction >= 0 ? 1 : -1) +
        this.unlockedVariants.length) %
      this.unlockedVariants.length;
    this.tileVariant = this.unlockedVariants[nextIndex] ?? this.tileVariant;
    persistVariantProgress();
  },

  collectStyleShards(count = 1) {
    const gain = Math.max(1, Math.floor(count));
    this.styleShards += gain;

    while (
      this.variantUnlockTier < OCTA_TILE_UNLOCK_THRESHOLDS.length &&
      this.styleShards >= OCTA_TILE_UNLOCK_THRESHOLDS[this.variantUnlockTier]
    ) {
      this.variantUnlockTier += 1;
      unlockNextVariant();
    }

    persistVariantProgress();
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
    currentPlatform: OctaPlatformType;
    currentObstacle: OctaObstacleType;
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
    this.currentPlatform = payload.currentPlatform;
    this.currentObstacle = payload.currentObstacle;
  },

  getCameraLabel() {
    return CAMERA_MODE_LABEL[this.cameraMode];
  },
});
