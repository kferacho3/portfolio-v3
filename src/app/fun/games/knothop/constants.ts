import type { BallSkin, PlatformTheme } from './types';

export const KNOT_HOP_TITLE = 'Knot Hop';

export const STORAGE_KEYS = {
  best: 'rachos-fun-knothop-best',
  gems: 'rachos-fun-knothop-gems',
  unlockedBalls: 'rachos-fun-knothop-unlocked-balls',
  unlockedThemes: 'rachos-fun-knothop-unlocked-themes',
  selectedBall: 'rachos-fun-knothop-selected-ball',
  selectedTheme: 'rachos-fun-knothop-selected-theme',
};

export const GAME = {
  platformWidth: 2.6,
  platformHeight: 0.55,
  lengthMin: 3.2,
  lengthMax: 4.6,
  gapMin: 0.85,
  gapMax: 1.55,
  // movement
  runSpeedBase: 3.05,
  runSpeedIncPerScore: 0.055,
  // how fast the current platform yaws (twists)
  twistSpeedBase: 0.55,
  twistSpeedIncPerScore: 0.02,
  twistMax: 1.85,
  // jump physics
  gravity: -16,
  jumpVY: 5.2,
  // keep a small margin so edge hits feel fair
  landingMargin: 0.18,
};

export const BALL_SKINS: BallSkin[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    color: '#0B0F1A',
    roughness: 0.15,
    metalness: 0.1,
  },
  { id: 'cloud', name: 'Cloud', color: '#F3F4F6', roughness: 0.28 },
  {
    id: 'neon',
    name: 'Neon',
    color: '#22D3EE',
    emissive: '#01262B',
    roughness: 0.22,
  },
  {
    id: 'berry',
    name: 'Berry',
    color: '#FB7185',
    emissive: '#2B020B',
    roughness: 0.22,
  },
  {
    id: 'violet',
    name: 'Violet',
    color: '#A78BFA',
    emissive: '#12062B',
    roughness: 0.25,
  },
  {
    id: 'azure',
    name: 'Azure',
    color: '#60A5FA',
    emissive: '#06152B',
    roughness: 0.25,
  },
  {
    id: 'gold',
    name: 'Gold',
    color: '#FBBF24',
    roughness: 0.25,
    metalness: 0.9,
  },
  {
    id: 'mint',
    name: 'Mint',
    color: '#34D399',
    emissive: '#012B1A',
    roughness: 0.22,
  },
  {
    id: 'coral',
    name: 'Coral',
    color: '#FB923C',
    emissive: '#2B1200',
    roughness: 0.24,
  },
  {
    id: 'candy',
    name: 'Candy',
    color: '#F472B6',
    emissive: '#2B0012',
    roughness: 0.22,
  },
];

export const PLATFORM_THEMES: PlatformTheme[] = [
  { id: 'aqua', name: 'Aqua', topColor: '#4A90E2', edgeColor: '#2B4D7A' },
  { id: 'ice', name: 'Ice', topColor: '#60A5FA', edgeColor: '#2B4D7A' },
  { id: 'mint', name: 'Mint', topColor: '#34D399', edgeColor: '#14532D' },
  { id: 'peach', name: 'Peach', topColor: '#FB923C', edgeColor: '#7C2D12' },
  { id: 'rose', name: 'Rose', topColor: '#FB7185', edgeColor: '#7F1D1D' },
  { id: 'violet', name: 'Violet', topColor: '#A78BFA', edgeColor: '#312E81' },
  { id: 'mono', name: 'Mono', topColor: '#E5E7EB', edgeColor: '#1F2937' },
  { id: 'night', name: 'Night', topColor: '#111827', edgeColor: '#000000' },
];

export const DEFAULT_BALL = BALL_SKINS[0].id;
export const DEFAULT_THEME = PLATFORM_THEMES[0].id;
