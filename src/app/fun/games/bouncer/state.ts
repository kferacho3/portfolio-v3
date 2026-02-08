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

// Flat, minimal base palettes inspired by classic Ketchapp-era aesthetics.
const basePalettes: Palette[] = [
  {
    name: 'Cream',
    bg: '#FAF9F6',
    platform: '#D9B89E',
    spikes: '#2F9D57',
    scoreTint: '#D9B89E',
    pickupOuter: '#2F9D57',
    pickupInner: '#FF7A3D',
  },
  {
    name: 'Midnight',
    bg: '#13201D',
    platform: '#3A5F56',
    spikes: '#FF6A3D',
    scoreTint: '#3A5F56',
    pickupOuter: '#86D6B3',
    pickupInner: '#FF6A3D',
  },
  {
    name: 'Sky',
    bg: '#0F86E6',
    platform: '#2BC7B3',
    spikes: '#F44E5E',
    scoreTint: '#2BC7B3',
    pickupOuter: '#FCEB8B',
    pickupInner: '#1B2330',
  },
  {
    name: 'Lilac',
    bg: '#F7F1FF',
    platform: '#BBA7E6',
    spikes: '#2B7A78',
    scoreTint: '#BBA7E6',
    pickupOuter: '#2B7A78',
    pickupInner: '#FF5A8A',
  },
];

function generatePalettePack(count: number) {
  const generated: Palette[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count);
    const hueA = (0.04 + t * 0.92 + ((i * 37) % 13) * 0.003) % 1;
    const hueB = (hueA + 0.11 + ((i * 17) % 9) * 0.004) % 1;
    const hueC = (hueA + 0.51 + ((i * 19) % 11) * 0.003) % 1;
    generated.push({
      name: `Flux ${i + 1}`,
      bg: hslToHex(hueA, 0.46, 0.93),
      platform: hslToHex(hueB, 0.55, 0.7),
      spikes: hslToHex(hueC, 0.72, 0.45),
      scoreTint: hslToHex(hueB, 0.34, 0.74),
      pickupOuter: hslToHex((hueC + 0.07) % 1, 0.72, 0.53),
      pickupInner: hslToHex((hueA + 0.5) % 1, 0.84, 0.56),
    });
  }
  return generated;
}

// Base + large procedural set (effectively "infinite" feeling in normal play).
export const palettes: Palette[] = [
  ...basePalettes,
  ...generatePalettePack(384),
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

function load(): SaveV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        bestScore: 0,
        squares: 0,
        paletteIndex: 1,
        selectedSkin: 0,
        unlockedSkinIds: ['rose'],
      };
    }
    const parsed = JSON.parse(raw) as Partial<SaveV1>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      squares: typeof parsed.squares === 'number' ? parsed.squares : 0,
      paletteIndex:
        typeof parsed.paletteIndex === 'number' ? parsed.paletteIndex : 0,
      selectedSkin:
        typeof parsed.selectedSkin === 'number' ? parsed.selectedSkin : 0,
      unlockedSkinIds: Array.isArray(parsed.unlockedSkinIds)
        ? (parsed.unlockedSkinIds.filter(Boolean) as string[])
        : ['rose'],
    };
  } catch {
    return {
      bestScore: 0,
      squares: 0,
      paletteIndex: 0,
      selectedSkin: 0,
      unlockedSkinIds: ['rose'],
    };
  }
}

const saved = load();

export const bouncerState = proxy({
  phase: 'menu' as BouncerPhase,
  bestScore: saved.bestScore,
  squares: saved.squares,
  paletteIndex: Math.max(0, Math.min(palettes.length - 1, saved.paletteIndex)),
  selectedSkin: Math.max(0, Math.min(ballSkins.length - 1, saved.selectedSkin)),
  unlockedSkinIds: new Set<string>(
    saved.unlockedSkinIds.length ? saved.unlockedSkinIds : ['rose']
  ),
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
        paletteIndex: bouncerState.paletteIndex,
        selectedSkin: bouncerState.selectedSkin,
        unlockedSkinIds: Array.from(bouncerState.unlockedSkinIds),
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
  if (score > bouncerState.bestScore) {
    bouncerState.bestScore = score;
    scheduleSave();
  }
}

export function cyclePalette() {
  bouncerState.paletteIndex = (bouncerState.paletteIndex + 1) % palettes.length;
  scheduleSave();
}

export function isSkinUnlocked(index: number) {
  const skin = ballSkins[index];
  return bouncerState.unlockedSkinIds.has(skin.id);
}

export function tryUnlockSkin(index: number) {
  const skin = ballSkins[index];
  if (bouncerState.unlockedSkinIds.has(skin.id)) return true;
  if (bouncerState.squares < skin.price) return false;
  bouncerState.squares -= skin.price;
  bouncerState.unlockedSkinIds.add(skin.id);
  scheduleSave();
  return true;
}

export function selectSkin(index: number) {
  bouncerState.selectedSkin = Math.max(
    0,
    Math.min(ballSkins.length - 1, index)
  );
  scheduleSave();
}
