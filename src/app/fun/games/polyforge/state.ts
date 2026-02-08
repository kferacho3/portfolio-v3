import { proxy } from 'valtio';

export type PolyForgePhase = 'menu' | 'playing' | 'gameover';
export type PolyForgeMode = 'classic' | 'endless' | 'daily';
export type PolyForgeEndlessMusicMode = 'zen' | 'chromatic' | 'polyrhythm';

const BEST_KEY = 'rachos-fun-polyforge-best';
const DAILY_BEST_KEY = 'rachos-fun-polyforge-daily-best';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

function hashInt(v: number) {
  let x = v | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

function readDailyMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(DAILY_BEST_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeDailyMap(map: Record<string, number>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DAILY_BEST_KEY, JSON.stringify(map));
}

export function getDailyKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function seedFromDailyKey(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000_000;
}

export type PolyForgeLevelProfile = {
  segments: number;
  rotationSpeed: number;
  height: number;
  colorCount: number;
  isAntiprism: boolean;
  twistAmount: number;
  strikeLimit: number;
};

export function getLevelProfile(
  level: number,
  mode: PolyForgeMode
): PolyForgeLevelProfile {
  const segments = clamp(4 + Math.floor(level * 0.35), 4, 16);
  const rotationSpeed = 0.35 * (1 + level * 0.06);
  const height = 2.4 + ((level % 6) / 6) * (4.2 - 2.4);
  const isAntiprism = level >= 7 && level % 3 === 0;
  const twistAmount = isAntiprism ? smoothstep(0, 1, (level - 7) / 6) : 0;
  const colorCount = clamp(2 + Math.floor(level / 4), 2, 5);
  const strikeLimit = mode === 'endless' ? 2 : level < 6 ? 2 : 1;

  return {
    segments,
    rotationSpeed,
    height,
    colorCount,
    isAntiprism,
    twistAmount,
    strikeLimit,
  };
}

// Tone.js-ready synth chain design targets (implemented with WebAudio runtime in index.tsx).
export const POLYFORGE_TONE_CHAINS = {
  hitMain: {
    synth: 'FMSynth',
    envelope: { attack: 0.003, decay: 0.16, sustain: 0.12, release: 0.18 },
    harmonicity: 2.2,
    modulationIndex: 12,
    filter: { type: 'lowpass', frequency: 2200, q: 0.8 },
    fx: { chorus: 0.12, reverb: 0.18 },
  },
  hitAccent: {
    synth: 'PluckSynth',
    attackNoise: 0.9,
    dampening: 3800,
    resonance: 0.7,
    fx: { delay: '1/16', feedback: 0.17, wet: 0.12 },
  },
  fail: {
    synth: 'MonoSynth',
    envelope: { attack: 0.001, decay: 0.25, sustain: 0.0, release: 0.24 },
    filterEnvelope: {
      attack: 0.002,
      decay: 0.2,
      baseFrequency: 110,
      octaves: 1.4,
    },
    fx: { lowpass: 360, drive: 0.25 },
  },
} as const;

// Anti-cheese hit fairness tuning constants.
export const POLYFORGE_HIT_RULES = {
  edgeDeadzoneBarycentric: 0.075,
  minIncidenceDot: 0.18,
  shootCooldownMs: 95,
} as const;

const DEFAULT_PROFILE = getLevelProfile(1, 'classic');

export const polyForgeState = proxy({
  phase: 'menu' as PolyForgePhase,
  mode: 'classic' as PolyForgeMode,
  endlessMusicMode: 'chromatic' as PolyForgeEndlessMusicMode,

  score: 0,
  best: 0,
  dailyBest: 0,
  dailyKey: getDailyKey(),

  level: 1,
  progress: 0,
  total: DEFAULT_PROFILE.segments,
  strikes: 0,
  strikeLimit: DEFAULT_PROFILE.strikeLimit,

  combo: 0,
  bestCombo: 0,
  totalHits: 0,

  segments: DEFAULT_PROFILE.segments,
  rotationSpeed: DEFAULT_PROFILE.rotationSpeed,
  height: DEFAULT_PROFILE.height,
  colorCount: DEFAULT_PROFILE.colorCount,
  isAntiprism: DEFAULT_PROFILE.isAntiprism,
  twistAmount: DEFAULT_PROFILE.twistAmount,

  runSeed: randomSeed(),
  levelSeed: randomSeed(),
  worldSeed: randomSeed(), // compatibility alias with existing game shell

  loadBest: () => {
    if (typeof window === 'undefined') return;

    const rawBest = window.localStorage.getItem(BEST_KEY);
    const parsedBest = rawBest ? Number(rawBest) : 0;
    polyForgeState.best = Number.isFinite(parsedBest) ? parsedBest : 0;

    polyForgeState.dailyKey = getDailyKey();
    const dailyMap = readDailyMap();
    polyForgeState.dailyBest = dailyMap[polyForgeState.dailyKey] ?? 0;
  },

  setMode: (mode: PolyForgeMode) => {
    if (mode !== 'classic' && mode !== 'endless' && mode !== 'daily') return;
    polyForgeState.mode = mode;
    if (mode === 'daily') {
      polyForgeState.dailyKey = getDailyKey();
      polyForgeState.runSeed = seedFromDailyKey(polyForgeState.dailyKey);
      const dailyMap = readDailyMap();
      polyForgeState.dailyBest = dailyMap[polyForgeState.dailyKey] ?? 0;
    }
  },

  setEndlessMusicMode: (mode: PolyForgeEndlessMusicMode) => {
    if (mode !== 'zen' && mode !== 'chromatic' && mode !== 'polyrhythm') return;
    polyForgeState.endlessMusicMode = mode;
  },

  configureLevel: (level: number) => {
    const safeLevel = Math.max(1, Math.floor(level));
    const profile = getLevelProfile(safeLevel, polyForgeState.mode);

    polyForgeState.level = safeLevel;
    polyForgeState.progress = 0;
    polyForgeState.total = profile.segments;
    polyForgeState.strikes = 0;

    polyForgeState.segments = profile.segments;
    polyForgeState.rotationSpeed = profile.rotationSpeed;
    polyForgeState.height = profile.height;
    polyForgeState.colorCount = profile.colorCount;
    polyForgeState.isAntiprism = profile.isAntiprism;
    polyForgeState.twistAmount = profile.twistAmount;
    polyForgeState.strikeLimit = profile.strikeLimit;

    const levelSeed = hashInt(
      polyForgeState.runSeed ^ ((safeLevel + 17) * 0x9e3779b9)
    );
    polyForgeState.levelSeed = levelSeed % 1_000_000_000;
    polyForgeState.worldSeed = polyForgeState.levelSeed;
  },

  startGame: () => {
    polyForgeState.phase = 'playing';
    polyForgeState.score = 0;
    polyForgeState.combo = 0;
    polyForgeState.bestCombo = 0;
    polyForgeState.totalHits = 0;

    const dailyKey = getDailyKey();
    polyForgeState.dailyKey = dailyKey;
    if (polyForgeState.mode === 'daily') {
      polyForgeState.runSeed = seedFromDailyKey(dailyKey);
      const dailyMap = readDailyMap();
      polyForgeState.dailyBest = dailyMap[dailyKey] ?? 0;
    } else {
      polyForgeState.runSeed = randomSeed();
    }

    polyForgeState.configureLevel(1);
  },

  registerFaceSuccess: () => {
    polyForgeState.progress = Math.min(
      polyForgeState.total,
      polyForgeState.progress + 1
    );
    polyForgeState.combo += 1;
    polyForgeState.bestCombo = Math.max(
      polyForgeState.bestCombo,
      polyForgeState.combo
    );
    polyForgeState.totalHits += 1;

    const comboMul = 1 + clamp(polyForgeState.combo * 0.08, 0, 1.8);
    const gain = Math.round((12 + polyForgeState.level * 3) * comboMul);
    polyForgeState.score += gain;

    if (polyForgeState.progress >= polyForgeState.total) {
      polyForgeState.completeLevel();
      return 'level-up' as const;
    }
    return 'continue' as const;
  },

  registerStrike: () => {
    polyForgeState.strikes += 1;
    polyForgeState.combo = 0;
    polyForgeState.score = Math.max(0, polyForgeState.score - 12);
    if (polyForgeState.strikes >= polyForgeState.strikeLimit) {
      polyForgeState.endGame();
      return true;
    }
    return false;
  },

  completeLevel: () => {
    const clearBonus = 90 + polyForgeState.level * 25;
    polyForgeState.score += clearBonus;
    polyForgeState.configureLevel(polyForgeState.level + 1);
  },

  endGame: () => {
    if (polyForgeState.phase === 'gameover') return;
    polyForgeState.phase = 'gameover';
    polyForgeState.best = Math.max(polyForgeState.best, polyForgeState.score);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BEST_KEY, String(polyForgeState.best));

      if (polyForgeState.mode === 'daily') {
        const dailyMap = readDailyMap();
        const key = polyForgeState.dailyKey;
        dailyMap[key] = Math.max(dailyMap[key] ?? 0, polyForgeState.score);
        writeDailyMap(dailyMap);
        polyForgeState.dailyBest = dailyMap[key];
      }
    }
  },

  reset: () => {
    polyForgeState.phase = 'menu';
    polyForgeState.score = 0;
    polyForgeState.level = 1;
    polyForgeState.progress = 0;
    polyForgeState.strikes = 0;
    polyForgeState.combo = 0;
    polyForgeState.bestCombo = 0;
    polyForgeState.totalHits = 0;

    if (polyForgeState.mode === 'daily') {
      polyForgeState.dailyKey = getDailyKey();
      polyForgeState.runSeed = seedFromDailyKey(polyForgeState.dailyKey);
      const dailyMap = readDailyMap();
      polyForgeState.dailyBest = dailyMap[polyForgeState.dailyKey] ?? 0;
    } else {
      polyForgeState.runSeed = randomSeed();
    }

    polyForgeState.configureLevel(1);
  },
});
