import type { BallSkin, PlatformTheme } from './types';

export const SPIRAL_HOP_TITLE = 'Spiral Hop';

export const STORAGE_KEYS = {
  best: 'rachos-fun-spiralhop-best',
  gems: 'rachos-fun-spiralhop-gems',
  unlockedBalls: 'rachos-fun-spiralhop-unlocked-balls',
  unlockedThemes: 'rachos-fun-spiralhop-unlocked-themes',
  selectedBall: 'rachos-fun-spiralhop-selected-ball',
  selectedTheme: 'rachos-fun-spiralhop-selected-theme',
  bestCombo: 'rachos-fun-spiralhop-best-combo',
};

export const GAME = {
  platformWidth: 2.7,
  platformHeight: 0.6,
  lengthMin: 3.1,
  lengthMax: 4.8,
  gapMin: 0.8,
  gapMax: 1.6,
  heightStep: 0.65,
  heightClamp: 1.3,
  // movement
  runSpeedBase: 3.2,
  runSpeedIncPerScore: 0.06,
  // how fast the current platform yaws (twists)
  twistSpeedBase: 0.55,
  twistSpeedIncPerScore: 0.025,
  twistMax: 2.1,
  // jump physics
  gravity: -17,
  jumpVY: 5.35,
  // keep a small margin so edge hits feel fair
  landingMargin: 0.2,
  perfectWindow: 0.22,
  gemBobAmp: 0.25,
  gemBobSpeed: 2.6,
};

export const BALL_SKINS: BallSkin[] = [
  { id: 'midnight', name: 'Midnight', color: '#0B0F1A', roughness: 0.15, metalness: 0.1 },
  { id: 'neon', name: 'Neon', color: '#22D3EE', emissive: '#01262B', roughness: 0.22 },
  { id: 'flare', name: 'Flare', color: '#F97316', emissive: '#2B1200', roughness: 0.28 },
  { id: 'violet', name: 'Violet', color: '#A78BFA', emissive: '#12062B', roughness: 0.25 },
  { id: 'mint', name: 'Mint', color: '#34D399', emissive: '#012B1A', roughness: 0.22 },
  { id: 'rose', name: 'Rose', color: '#FB7185', emissive: '#2B020B', roughness: 0.24 },
  { id: 'candy', name: 'Candy', color: '#F472B6', emissive: '#2B0012', roughness: 0.22 },
  { id: 'glacier', name: 'Glacier', color: '#E5E7EB', roughness: 0.3 },
  { id: 'gold', name: 'Gold', color: '#FBBF24', roughness: 0.25, metalness: 0.9 },
];

export const PLATFORM_THEMES: PlatformTheme[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    topColor: '#38BDF8',
    edgeColor: '#0EA5E9',
    glowColor: '#7DD3FC',
    fogColor: '#E0F2FE',
    skyTop: '#E0F2FE',
    skyBottom: '#F8FAFC',
  },
  {
    id: 'sherbet',
    name: 'Sherbet',
    topColor: '#FB7185',
    edgeColor: '#BE123C',
    glowColor: '#FDA4AF',
    fogColor: '#FFF1F2',
    skyTop: '#FFE4E6',
    skyBottom: '#FFF7ED',
  },
  {
    id: 'mint',
    name: 'Mint',
    topColor: '#34D399',
    edgeColor: '#047857',
    glowColor: '#6EE7B7',
    fogColor: '#ECFDF5',
    skyTop: '#ECFDF5',
    skyBottom: '#F0FDFA',
  },
  {
    id: 'violet',
    name: 'Violet',
    topColor: '#A78BFA',
    edgeColor: '#6D28D9',
    glowColor: '#C4B5FD',
    fogColor: '#F5F3FF',
    skyTop: '#F5F3FF',
    skyBottom: '#EEF2FF',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    topColor: '#F97316',
    edgeColor: '#C2410C',
    glowColor: '#FDBA74',
    fogColor: '#FFF7ED',
    skyTop: '#FFEDD5',
    skyBottom: '#FEF3C7',
  },
  {
    id: 'mono',
    name: 'Mono',
    topColor: '#111827',
    edgeColor: '#000000',
    glowColor: '#475569',
    fogColor: '#0F172A',
    skyTop: '#0F172A',
    skyBottom: '#020617',
  },
];

export const DEFAULT_BALL = BALL_SKINS[0].id;
export const DEFAULT_THEME = PLATFORM_THEMES[0].id;
