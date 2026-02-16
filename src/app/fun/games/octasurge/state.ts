import { proxy } from 'valtio';
import {
  CAMERA_MODES,
  FX_LEVELS,
  MODES,
  RUNNER_SHAPES,
  STORAGE_KEY,
  TILE_VARIANTS,
} from './constants';
import type {
  OctaCameraMode,
  OctaFxLevel,
  OctaReplay,
  OctaReplayInput,
  OctaRunSummary,
  OctaRunnerShape,
  OctaSurgeMode,
  OctaSurgePhase,
  OctaTileVariant,
} from './types';

const randomSeed = () => Math.floor(Math.random() * 1_000_000_000);

const clampFx = (value: number): OctaFxLevel => {
  if (value <= 0) return 0;
  if (value >= 2) return 2;
  return 1;
};

const cycleValue = <T,>(list: readonly T[], value: T, direction: -1 | 1) => {
  const index = list.indexOf(value);
  const from = index >= 0 ? index : 0;
  return list[(from + direction + list.length) % list.length] ?? list[0];
};

const isReplayInput = (value: unknown): value is OctaReplayInput => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OctaReplayInput>;
  return (
    typeof candidate.t === 'number' &&
    Number.isFinite(candidate.t) &&
    (candidate.dir === -1 || candidate.dir === 1)
  );
};

const isReplay = (value: unknown): value is OctaReplay => {
  if (!value || typeof value !== 'object') return false;
  const replay = value as Partial<OctaReplay>;
  if (replay.v !== 1) return false;
  if (typeof replay.seed !== 'number' || !Number.isFinite(replay.seed)) return false;
  if (!MODES.includes(replay.mode as OctaSurgeMode)) return false;
  if (!CAMERA_MODES.includes(replay.cameraMode as OctaCameraMode)) return false;
  if (!TILE_VARIANTS.includes(replay.tileVariant as OctaTileVariant)) return false;
  if (!RUNNER_SHAPES.includes(replay.runnerShape as OctaRunnerShape)) return false;
  if (!FX_LEVELS.includes(replay.fxLevel as OctaFxLevel)) return false;
  if (typeof replay.createdAt !== 'number' || !Number.isFinite(replay.createdAt)) {
    return false;
  }
  if (typeof replay.score !== 'number' || !Number.isFinite(replay.score)) return false;
  if (typeof replay.distance !== 'number' || !Number.isFinite(replay.distance)) {
    return false;
  }
  if (typeof replay.bestCombo !== 'number' || !Number.isFinite(replay.bestCombo)) {
    return false;
  }
  if (!Array.isArray(replay.inputs)) return false;
  return replay.inputs.every(isReplayInput);
};

const decodeReplayPayload = (raw: string) => {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    try {
      if (typeof atob !== 'function') return null;
      return JSON.parse(atob(trimmed)) as unknown;
    } catch {
      return null;
    }
  }
};

const encodeReplayPayload = (replay: OctaReplay) => {
  const serialized = JSON.stringify(replay);
  if (typeof btoa === 'function') return btoa(serialized);
  return serialized;
};

export const octaSurgeState = proxy({
  phase: 'menu' as OctaSurgePhase,

  mode: 'evolve' as OctaSurgeMode,
  cameraMode: 'chase' as OctaCameraMode,
  tileVariant: 'prism' as OctaTileVariant,
  runnerShape: 'core' as OctaRunnerShape,
  fxLevel: 1 as OctaFxLevel,

  score: 0,
  distance: 0,
  combo: 0,
  best: 0,
  bestCombo: 0,
  nearMisses: 0,

  worldSeed: randomSeed(),

  queuedReplay: null as OctaReplay | null,
  lastReplay: null as OctaReplay | null,

  load: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        best: number;
        bestCombo: number;
        mode: OctaSurgeMode;
        cameraMode: OctaCameraMode;
        tileVariant: OctaTileVariant;
        runnerShape: OctaRunnerShape;
        fxLevel: number;
      }>;
      octaSurgeState.best = Number.isFinite(parsed.best) ? Math.floor(parsed.best ?? 0) : 0;
      octaSurgeState.bestCombo = Number.isFinite(parsed.bestCombo)
        ? Math.floor(parsed.bestCombo ?? 0)
        : 0;
      if (parsed.mode && MODES.includes(parsed.mode)) octaSurgeState.mode = parsed.mode;
      if (parsed.cameraMode && CAMERA_MODES.includes(parsed.cameraMode)) {
        octaSurgeState.cameraMode = parsed.cameraMode;
      }
      if (parsed.tileVariant && TILE_VARIANTS.includes(parsed.tileVariant)) {
        octaSurgeState.tileVariant = parsed.tileVariant;
      }
      if (parsed.runnerShape && RUNNER_SHAPES.includes(parsed.runnerShape)) {
        octaSurgeState.runnerShape = parsed.runnerShape;
      }
      if (typeof parsed.fxLevel === 'number' && Number.isFinite(parsed.fxLevel)) {
        octaSurgeState.fxLevel = clampFx(parsed.fxLevel);
      }
    } catch {
      // Ignore malformed local storage payload.
    }
  },

  save: () => {
    if (typeof window === 'undefined') return;
    const payload = {
      best: Math.floor(octaSurgeState.best),
      bestCombo: Math.floor(octaSurgeState.bestCombo),
      mode: octaSurgeState.mode,
      cameraMode: octaSurgeState.cameraMode,
      tileVariant: octaSurgeState.tileVariant,
      runnerShape: octaSurgeState.runnerShape,
      fxLevel: octaSurgeState.fxLevel,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  },

  start: () => {
    const replay = octaSurgeState.queuedReplay;
    if (replay) {
      octaSurgeState.mode = replay.mode;
      octaSurgeState.cameraMode = replay.cameraMode;
      octaSurgeState.tileVariant = replay.tileVariant;
      octaSurgeState.runnerShape = replay.runnerShape;
      octaSurgeState.fxLevel = replay.fxLevel;
      octaSurgeState.worldSeed = replay.seed;
    } else {
      octaSurgeState.worldSeed = (octaSurgeState.worldSeed + 1 + Math.floor(Math.random() * 89)) % 1_000_000_000;
    }

    octaSurgeState.score = 0;
    octaSurgeState.distance = 0;
    octaSurgeState.combo = 0;
    octaSurgeState.nearMisses = 0;
    octaSurgeState.phase = 'playing';
  },

  startGame: () => {
    octaSurgeState.start();
  },

  setRunMetrics: (score: number, distance: number, combo: number, nearMisses: number) => {
    octaSurgeState.score = Math.max(0, Math.floor(score));
    octaSurgeState.distance = Math.max(0, Number(distance.toFixed(2)));
    octaSurgeState.combo = Math.max(0, Number(combo.toFixed(2)));
    octaSurgeState.nearMisses = Math.max(0, Math.floor(nearMisses));
  },

  finishRun: (summary: OctaRunSummary) => {
    if (octaSurgeState.phase !== 'playing') return;

    octaSurgeState.score = Math.max(0, Math.floor(summary.score));
    octaSurgeState.distance = Math.max(0, Number(summary.distance.toFixed(2)));
    octaSurgeState.combo = Math.max(0, Math.floor(summary.bestCombo));
    octaSurgeState.nearMisses = Math.max(0, Math.floor(summary.nearMisses));

    if (octaSurgeState.score > octaSurgeState.best) {
      octaSurgeState.best = octaSurgeState.score;
    }
    if (summary.bestCombo > octaSurgeState.bestCombo) {
      octaSurgeState.bestCombo = Math.floor(summary.bestCombo);
    }

    octaSurgeState.lastReplay = summary.replay;
    octaSurgeState.phase = 'gameover';
    octaSurgeState.save();
  },

  backToMenu: () => {
    octaSurgeState.phase = 'menu';
    octaSurgeState.score = 0;
    octaSurgeState.combo = 0;
    octaSurgeState.distance = 0;
    octaSurgeState.nearMisses = 0;
  },

  reset: () => {
    octaSurgeState.phase = 'menu';
    octaSurgeState.score = 0;
    octaSurgeState.combo = 0;
    octaSurgeState.distance = 0;
    octaSurgeState.nearMisses = 0;
    octaSurgeState.worldSeed = randomSeed();
  },

  setMode: (mode: OctaSurgeMode) => {
    if (!MODES.includes(mode)) return;
    octaSurgeState.mode = mode;
    octaSurgeState.save();
  },

  setCameraMode: (cameraMode: OctaCameraMode) => {
    if (!CAMERA_MODES.includes(cameraMode)) return;
    octaSurgeState.cameraMode = cameraMode;
    octaSurgeState.save();
  },

  cycleFxLevel: () => {
    const current = FX_LEVELS.indexOf(octaSurgeState.fxLevel);
    const next = (current + 1) % FX_LEVELS.length;
    octaSurgeState.fxLevel = FX_LEVELS[next] ?? 1;
  },

  setTileVariant: (variant: OctaTileVariant) => {
    if (!TILE_VARIANTS.includes(variant)) return;
    octaSurgeState.tileVariant = variant;
    octaSurgeState.save();
  },

  cycleTileVariant: (direction: -1 | 1) => {
    octaSurgeState.tileVariant = cycleValue(
      TILE_VARIANTS,
      octaSurgeState.tileVariant,
      direction
    );
    octaSurgeState.save();
  },

  setRunnerShape: (shape: OctaRunnerShape) => {
    if (!RUNNER_SHAPES.includes(shape)) return;
    octaSurgeState.runnerShape = shape;
    octaSurgeState.save();
  },

  cycleRunnerShape: (direction: -1 | 1) => {
    octaSurgeState.runnerShape = cycleValue(
      RUNNER_SHAPES,
      octaSurgeState.runnerShape,
      direction
    );
    octaSurgeState.save();
  },

  queueReplayPlayback: (replay: OctaReplay) => {
    octaSurgeState.queuedReplay = replay;
    octaSurgeState.worldSeed = replay.seed;
  },

  consumeReplayPlayback: () => {
    const replay = octaSurgeState.queuedReplay;
    octaSurgeState.queuedReplay = null;
    return replay;
  },

  exportLastReplay: () => {
    if (!octaSurgeState.lastReplay) return null;
    return encodeReplayPayload(octaSurgeState.lastReplay);
  },

  importReplay: (raw: string) => {
    const parsed = decodeReplayPayload(raw);
    if (!isReplay(parsed)) return null;
    octaSurgeState.lastReplay = parsed;
    octaSurgeState.queuedReplay = parsed;
    return parsed;
  },
});
