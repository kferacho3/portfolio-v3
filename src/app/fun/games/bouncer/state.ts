import { proxy } from 'valtio';
import { subscribeKey } from 'valtio/utils';

export type Palette = {
  name: string;
  bg: string;
  platform: string;
  spikes: string;
  scoreTint: string;
  pickupOuter: string;
  pickupInner: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hslToHex(h: number, s: number, l: number) {
  const hue = ((h % 1) + 1) % 1;
  const sat = clamp(s, 0, 1);
  const lig = clamp(l, 0, 1);

  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue * 6) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 1 / 6) {
    r = c;
    g = x;
  } else if (hue < 2 / 6) {
    r = x;
    g = c;
  } else if (hue < 3 / 6) {
    g = c;
    b = x;
  } else if (hue < 4 / 6) {
    g = x;
    b = c;
  } else if (hue < 5 / 6) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (v: number) => {
    const n = Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
    return n;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Brighter "Rollbounce" launch palettes before procedural Flux variants kick in.
const basePalettes: Palette[] = [
  {
    name: 'Lagoon',
    bg: '#EAF9FF',
    platform: '#4F86F7',
    spikes: '#11357F',
    scoreTint: '#9EC5FF',
    pickupOuter: '#13BBAF',
    pickupInner: '#FF9E5D',
  },
  {
    name: 'Afterglow',
    bg: '#190B2E',
    platform: '#51327E',
    spikes: '#FFD166',
    scoreTint: '#734CB1',
    pickupOuter: '#5DE2E7',
    pickupInner: '#FF8FA3',
  },
  {
    name: 'Sunset Run',
    bg: '#FFF0D9',
    platform: '#FF9F43',
    spikes: '#D7263D',
    scoreTint: '#FFC46B',
    pickupOuter: '#1CA7EC',
    pickupInner: '#5A189A',
  },
  {
    name: 'Mint Night',
    bg: '#E7FFF9',
    platform: '#3AA17E',
    spikes: '#111827',
    scoreTint: '#98E2C0',
    pickupOuter: '#00B4D8',
    pickupInner: '#FF5D8F',
  },
];

function pseudo(seed: number, salt: number) {
  const v = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453123;
  return v - Math.floor(v);
}

function fluxPalette(index: number): Palette {
  const seed = Math.max(0, Math.floor(index));
  const hueA =
    (seed * 0.618033988749895 + pseudo(seed, 0.17) * 0.23 + 0.04) % 1;
  const hueB = (hueA + 0.12 + pseudo(seed, 0.53) * 0.2) % 1;
  const hueC = (hueA + 0.49 + pseudo(seed, 0.91) * 0.28) % 1;
  const softHue = (hueB + 0.08 + pseudo(seed, 0.29) * 0.14) % 1;
  const accentHue = (hueC + 0.04 + pseudo(seed, 0.67) * 0.16) % 1;

  return {
    name: `Flux ${seed + 1}`,
    bg: hslToHex(
      hueA,
      0.28 + pseudo(seed, 1.11) * 0.34,
      0.84 + pseudo(seed, 1.31) * 0.12
    ),
    platform: hslToHex(
      softHue,
      0.42 + pseudo(seed, 1.57) * 0.3,
      0.58 + pseudo(seed, 1.77) * 0.22
    ),
    spikes: hslToHex(
      hueC,
      0.62 + pseudo(seed, 2.03) * 0.34,
      0.36 + pseudo(seed, 2.23) * 0.22
    ),
    scoreTint: hslToHex(
      hueB,
      0.28 + pseudo(seed, 2.51) * 0.3,
      0.62 + pseudo(seed, 2.71) * 0.24
    ),
    pickupOuter: hslToHex(
      accentHue,
      0.64 + pseudo(seed, 3.17) * 0.3,
      0.46 + pseudo(seed, 3.37) * 0.22
    ),
    pickupInner: hslToHex(
      (hueA + 0.5) % 1,
      0.76 + pseudo(seed, 3.91) * 0.2,
      0.5 + pseudo(seed, 4.11) * 0.2
    ),
  };
}

const paletteCache = new Map<number, Palette>();
const PALETTE_CACHE_LIMIT = 4096;

export function paletteAt(index: number): Palette {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  if (safeIndex < basePalettes.length) return basePalettes[safeIndex];

  let cached = paletteCache.get(safeIndex);
  if (!cached) {
    cached = fluxPalette(safeIndex - basePalettes.length);
    paletteCache.set(safeIndex, cached);
    if (paletteCache.size > PALETTE_CACHE_LIMIT) {
      const first = paletteCache.keys().next().value;
      if (typeof first === 'number') paletteCache.delete(first);
    }
  }
  return cached;
}

// Small preview export for menus/debug; gameplay uses paletteAt(index) for effectively infinite variation.
export const palettes: Palette[] = [
  ...basePalettes,
  ...Array.from({ length: 512 }, (_, i) => fluxPalette(i)),
];

export type BallSkin = {
  id: string;
  name: string;
  fill: string;
  inner: string;
  ring: string;
  price: number; // in squares
};

export const ballSkins: BallSkin[] = [
  {
    id: 'rose',
    name: 'Rose',
    fill: '#FF5A8A',
    inner: '#FF88A9',
    ring: '#FFFFFF',
    price: 0,
  },
  {
    id: 'mint',
    name: 'Mint',
    fill: '#33D6B1',
    inner: '#7FF0D8',
    ring: '#FFFFFF',
    price: 25,
  },
  {
    id: 'sun',
    name: 'Sun',
    fill: '#FFB703',
    inner: '#FFD166',
    ring: '#FFFFFF',
    price: 50,
  },
  {
    id: 'void',
    name: 'Void',
    fill: '#1B2330',
    inner: '#3B4A63',
    ring: '#FFFFFF',
    price: 75,
  },
  {
    id: 'cloud',
    name: 'Cloud',
    fill: '#FFFFFF',
    inner: '#E8EEF6',
    ring: '#1B2330',
    price: 100,
  },
];

export type BouncerPhase = 'menu' | 'playing' | 'gameover';

type SaveV1 = {
  bestScore: number;
  squares: number;
  paletteIndex: number;
  selectedSkin: number;
  unlockedSkinIds: string[];
};

const STORAGE_KEY = 'fun:bouncer:v1';
const LOCKED_BOUNCER_PALETTE_INDEX = 0;
const LOCKED_BOUNCER_SKIN_INDEX = 0;
const LOCKED_BOUNCER_SKIN_ID = ballSkins[LOCKED_BOUNCER_SKIN_INDEX]?.id ?? 'rose';

function load(): SaveV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        bestScore: 0,
        squares: 0,
        paletteIndex: LOCKED_BOUNCER_PALETTE_INDEX,
        selectedSkin: LOCKED_BOUNCER_SKIN_INDEX,
        unlockedSkinIds: [LOCKED_BOUNCER_SKIN_ID],
      };
    }
    const parsed = JSON.parse(raw) as Partial<SaveV1>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      squares: typeof parsed.squares === 'number' ? parsed.squares : 0,
      paletteIndex: LOCKED_BOUNCER_PALETTE_INDEX,
      selectedSkin: LOCKED_BOUNCER_SKIN_INDEX,
      unlockedSkinIds: [LOCKED_BOUNCER_SKIN_ID],
    };
  } catch {
    return {
      bestScore: 0,
      squares: 0,
      paletteIndex: LOCKED_BOUNCER_PALETTE_INDEX,
      selectedSkin: LOCKED_BOUNCER_SKIN_INDEX,
      unlockedSkinIds: [LOCKED_BOUNCER_SKIN_ID],
    };
  }
}

const saved = load();

export const bouncerState = proxy({
  phase: 'menu' as BouncerPhase,
  score: 0,
  bestScore: saved.bestScore,
  squares: saved.squares,
  paletteIndex: LOCKED_BOUNCER_PALETTE_INDEX,
  selectedSkin: LOCKED_BOUNCER_SKIN_INDEX,
  unlockedSkinIds: new Set<string>([LOCKED_BOUNCER_SKIN_ID]),
});

let saveTimer: number | null = null;
function scheduleSave() {
  if (typeof window === 'undefined') return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const payload: SaveV1 = {
        bestScore: bouncerState.bestScore,
        squares: bouncerState.squares,
        paletteIndex: LOCKED_BOUNCER_PALETTE_INDEX,
        selectedSkin: LOCKED_BOUNCER_SKIN_INDEX,
        unlockedSkinIds: [LOCKED_BOUNCER_SKIN_ID],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, 150);
}

// Persist important keys.
subscribeKey(bouncerState, 'bestScore', scheduleSave);
subscribeKey(bouncerState, 'squares', scheduleSave);
subscribeKey(bouncerState, 'paletteIndex', scheduleSave);
subscribeKey(bouncerState, 'selectedSkin', scheduleSave);

export function addSquares(n: number) {
  bouncerState.squares = Math.max(0, bouncerState.squares + Math.floor(n));
  scheduleSave();
}

export function setBestScore(score: number) {
  const next = Math.max(0, Math.floor(score));
  if (next > bouncerState.bestScore) {
    bouncerState.bestScore = next;
    scheduleSave();
  }
}

export function setScore(score: number) {
  const next = Math.max(0, Math.floor(score));
  if (next !== bouncerState.score) {
    bouncerState.score = next;
  }
}

export function cyclePalette() {
  bouncerState.paletteIndex = LOCKED_BOUNCER_PALETTE_INDEX;
  scheduleSave();
}

export function isSkinUnlocked(index: number) {
  return index === LOCKED_BOUNCER_SKIN_INDEX;
}

export function tryUnlockSkin(index: number) {
  if (index !== LOCKED_BOUNCER_SKIN_INDEX) return false;
  bouncerState.selectedSkin = LOCKED_BOUNCER_SKIN_INDEX;
  scheduleSave();
  return true;
}

export function selectSkin(index: number) {
  if (index !== LOCKED_BOUNCER_SKIN_INDEX) return;
  bouncerState.selectedSkin = LOCKED_BOUNCER_SKIN_INDEX;
  scheduleSave();
}
